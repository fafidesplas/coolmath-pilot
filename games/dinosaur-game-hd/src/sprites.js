// Placeholder sprites drawn in code (GDD 9): the T-Rex (from rex.js), the
// cacti and the pterodactyl, flat shapes with a 1 px Night Ink outline, each drawn over its
// collision boxes (GDD 3.4). The final art replaces them with a sprite sheet.
// Every sprite canvas has a 1 px margin for the outline: draw it at (x - 1, y - 1).
import { REX } from './rex.js';

export const PAL = {
  ink: '#1B2340', sand: '#F2C879', orange: '#F08A24', green: '#3FA34D', slate: '#5A6B7D', cream: '#FFF6E0',
};
const C = {
  ...PAL,
  slateDark: '#46546A', slateLight: '#9AA9B8',
  greenDark: '#2C7D3A', greenLight: '#6CC46F',
  ptero: '#C8662A', pteroDark: '#9E4F22',
  white: '#FFFFFF',
};

// shape: [x, y, w, h, color] rects, outlined together; details: drawn on top, inside the shape.
function sprite(w, h, shape, details = []) {
  const fill = document.createElement('canvas');
  fill.width = w + 2; fill.height = h + 2;
  const f = fill.getContext('2d');
  for (const [x, y, rw, rh, c] of shape) { f.fillStyle = C[c]; f.fillRect(x + 1, y + 1, rw, rh); }
  const out = document.createElement('canvas');
  out.width = w + 2; out.height = h + 2;
  const o = out.getContext('2d');
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) o.drawImage(fill, dx, dy);
  o.globalCompositeOperation = 'source-in';
  o.fillStyle = C.ink;
  o.fillRect(0, 0, out.width, out.height);
  o.globalCompositeOperation = 'source-over';
  o.drawImage(fill, 0, 0);
  for (const [x, y, rw, rh, c] of details) { o.fillStyle = C[c]; o.fillRect(x + 1, y + 1, rw, rh); }
  return out;
}

// ---- T-Rex: pixel maps from rex.js (run 44×47, slide 56×25) ------------------------------
const REX_COLOR = { S: 'slate', s: 'slateDark', b: 'slateLight', w: 'cream', k: 'ink' };
// One rect per run of same-colored pixels.
function mapRects(rows) {
  const out = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const v = row[x];
      let n = 1;
      while (row[x + n] === v) n++;
      if (v !== '.') out.push([x, y, n, 1, REX_COLOR[v]]);
      x += n;
    }
  });
  return out;
}
const rex = rows => sprite(rows[0].length, rows.length, mapRects(rows));

// ---- Cacti ------------------------------------------------------------------------------
const CACTUS_SMALL = sprite(17, 35, [
  [5, 1, 7, 34, 'green'], [6, 0, 5, 1, 'green'],      // trunk
  [0, 8, 4, 13, 'green'], [0, 18, 6, 3, 'green'],     // left arm
  [1, 27, 4, 8, 'green'],                             // shoot at the base
  [13, 4, 4, 10, 'green'], [10, 11, 7, 3, 'green'],   // right arm
], [[7, 2, 1, 31, 'greenLight'], [10, 3, 1, 30, 'greenDark'], [1, 9, 1, 9, 'greenLight']]);

const CACTUS_LARGE = sprite(25, 50, [
  [8, 1, 9, 49, 'green'], [9, 0, 7, 1, 'green'],
  [0, 12, 5, 16, 'green'], [0, 25, 9, 4, 'green'],
  [1, 38, 6, 12, 'green'],
  [20, 8, 5, 16, 'green'], [16, 20, 9, 4, 'green'],
  [18, 40, 5, 10, 'green'],
], [[10, 2, 1, 46, 'greenLight'], [15, 3, 1, 45, 'greenDark'], [1, 13, 1, 12, 'greenLight'], [21, 9, 1, 12, 'greenLight']]);

// ---- Pterodactyl, 46×40 (faces left), wings up and down -----------------------------------
const PTERO = [
  [0, 14, 9, 3, 'sand'],                             // beak
  [8, 9, 9, 9, 'ptero'], [15, 6, 9, 4, 'ptero'],     // head, crest
  [15, 15, 18, 7, 'ptero'], [18, 20, 24, 7, 'ptero'], [41, 22, 5, 3, 'ptero'],
];
const PTERO_MARKS = [[10, 11, 2, 2, 'cream'], [10, 12, 1, 1, 'ink'], [20, 24, 18, 2, 'sand']];
const WING_UP = [[20, 4, 11, 12, 'pteroDark'], [22, 0, 7, 4, 'pteroDark']];
const WING_DOWN = [[20, 26, 11, 8, 'pteroDark'], [22, 34, 7, 6, 'pteroDark']];

// ---- Egg, 10×13: cream with orange speckles and a glint ------------------------------------
const EGG = [
  [3, 0, 4, 1, 'cream'], [2, 1, 6, 1, 'cream'], [1, 2, 8, 3, 'cream'], [0, 5, 10, 6, 'cream'],
  [1, 11, 8, 1, 'cream'], [2, 12, 6, 1, 'cream'],
];
const EGG_MARKS = [[7, 3, 1, 1, 'orange'], [3, 5, 1, 1, 'orange'], [6, 6, 2, 1, 'orange'], [2, 8, 1, 1, 'orange'], [5, 9, 2, 1, 'orange'], [7, 9, 1, 1, 'orange'], [6, 10, 3, 1, 'sand'], [3, 11, 4, 1, 'sand']];
const GLINT = [[2, 3, 1, 2, 'white']];

// A night rim (GDD 3.6): the sprite's outlined shape grown by 1 px, in Egg
// Cream. Draw it at (x - 2, y - 2) under the sprite, so only the 1 px ring shows.
function rim(img) {
  const out = document.createElement('canvas');
  out.width = img.width + 2; out.height = img.height + 2;
  const o = out.getContext('2d');
  for (let dy = 0; dy <= 2; dy++) for (let dx = 0; dx <= 2; dx++) if (dx !== 1 || dy !== 1) o.drawImage(img, dx, dy);
  o.globalCompositeOperation = 'source-in';
  o.fillStyle = C.cream;
  o.fillRect(0, 0, out.width, out.height);
  return out;
}

export const SPR = {
  trex: {
    run: REX.run.map(rex),
    jump: rex(REX.jump),
    crash: rex(REX.crash),
    sleep: rex(REX.sleep),
    slide: REX.slide.map(rex),
    slideCrash: rex(REX.slideCrash),
  },
  'cactus-small': CACTUS_SMALL,
  'cactus-large': CACTUS_LARGE,
  ptero: [sprite(46, 40, [...WING_UP, ...PTERO], PTERO_MARKS), sprite(46, 40, [...WING_DOWN, ...PTERO], PTERO_MARKS)],
  egg: [sprite(10, 13, EGG, EGG_MARKS), sprite(10, 13, EGG, [...EGG_MARKS, ...GLINT])],   // plain, glinting
};
SPR.rim = {
  'cactus-small': rim(SPR['cactus-small']),
  'cactus-large': rim(SPR['cactus-large']),
  ptero: SPR.ptero.map(rim),
  egg: rim(SPR.egg[0]),   // both egg frames have the same shape
};
