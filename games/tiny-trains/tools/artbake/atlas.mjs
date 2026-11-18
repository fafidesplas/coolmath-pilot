// node atlas.mjs <dir> : packs train_<color>_<i>.png (16 angles) into trains.png (rows red, blue, yellow, green) and deletes the frames
import fs from 'fs'; import { PNG } from 'pngjs';
const dir = process.argv[2], C = ['red', 'blue', 'yellow', 'green'];
const f0 = PNG.sync.read(fs.readFileSync(`${dir}/train_red_0.png`)), S = f0.width;
const o = new PNG({ width: S * 16, height: S * 4 });
C.forEach((c, r) => { for (let i = 0; i < 16; i++) { const f = `${dir}/train_${c}_${i}.png`; const im = PNG.sync.read(fs.readFileSync(f)); PNG.bitblt(im, o, 0, 0, S, S, i * S, r * S); fs.unlinkSync(f); } });
fs.writeFileSync(`${dir}/trains.png`, PNG.sync.write(o, { colorType: 6 }));
