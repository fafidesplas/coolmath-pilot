// Pixel bitmap font, 5×7 glyphs drawn in code (GDD 9: no web fonts).
// Each glyph is 7 rows of 5 bits, top row first. One atlas canvas per color.

const GLYPHS = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31],
  3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12],
  '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4], ':': [0, 12, 12, 0, 12, 12, 0], '-': [0, 0, 0, 31, 0, 0, 0],
  '/': [1, 1, 2, 4, 8, 16, 16], "'": [4, 4, 8, 0, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0],
  '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8],
};
const CHARS = Object.keys(GLYPHS);
const INDEX = new Map(CHARS.map((c, i) => [c, i]));
const atlases = new Map();

function atlas(color) {
  let c = atlases.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = CHARS.length * 6; c.height = 7;
  const g = c.getContext('2d');
  g.fillStyle = color;
  CHARS.forEach((ch, i) => GLYPHS[ch].forEach((row, y) => {
    for (let x = 0; x < 5; x++) if (row & (16 >> x)) g.fillRect(i * 6 + x, y, 1, 1);
  }));
  atlases.set(color, c);
  return c;
}

export const textWidth = (text, size = 1) => text.length ? (text.length * 6 - 1) * size : 0;

// Draws `text` with its top at y. align: 'left' | 'center' | 'right'.
export function drawText(ctx, text, x, y, size, color, align = 'left') {
  text = String(text).toUpperCase();
  const w = textWidth(text, size);
  if (align === 'center') x -= Math.floor(w / 2);
  else if (align === 'right') x -= w;
  const a = atlas(color);
  for (let i = 0; i < text.length; i++) {
    const g = INDEX.get(text[i]);
    if (g !== undefined) ctx.drawImage(a, g * 6, 0, 5, 7, x + i * 6 * size, y, 5 * size, 7 * size);
  }
}
