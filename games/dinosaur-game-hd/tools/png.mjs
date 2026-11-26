// A minimal PNG reader for the tests: 8-bit RGBA or RGB, not interlaced
// (what Aseprite exports). Returns { width, height, alpha(x, y), rgba(x, y) }.
import fs from 'node:fs';
import zlib from 'node:zlib';

export function readPng(path) {
  const buf = fs.readFileSync(path);
  let pos = 8, width, height, type, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), name = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (name === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4); type = data[9];
      if (data[8] !== 8 || data[12] !== 0 || (type !== 6 && type !== 2)) throw new Error(`${path}: only 8-bit RGB(A), non-interlaced PNGs`);
    }
    if (name === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3, stride = width * bpp, raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[y * stride + i - bpp] : 0, b = y ? px[(y - 1) * stride + i] : 0;
      const c = i >= bpp && y ? px[(y - 1) * stride + i - bpp] : 0;
      const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const pred = [0, a, b, (a + b) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? b : c][f];
      px[y * stride + i] = (line[i] + pred) & 255;
    }
  }
  const at = (x, y) => (y * width + x) * bpp;
  return {
    width, height,
    alpha: (x, y) => (bpp === 4 ? px[at(x, y) + 3] : 255),
    rgba: (x, y) => [...px.subarray(at(x, y), at(x, y) + 3), bpp === 4 ? px[at(x, y) + 3] : 255],
  };
}
