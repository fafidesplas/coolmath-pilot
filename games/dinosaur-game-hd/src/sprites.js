// Placeholder sprites drawn in code (GDD 9): the runners, the cacti, the
// pterodactyl and the egg, built from the cell maps in art.js in the
// one-pager's chunky style: each art pixel is CELL×CELL logical px, with a
// 1 cell Night Ink outline. The final art replaces them with a sprite sheet.
// Every sprite canvas has a 1 cell margin for the outline: draw it at
// (x - MARGIN, y + oy - MARGIN), where oy is the sprite's own offset.
import { RUNNERS, ART, CELL } from './art.js';

export const PAL = {
  ink: '#1B2340', sand: '#F2C879', orange: '#F08A24', green: '#3FA34D', slate: '#5A6B7D', cream: '#FFF6E0',
};
export const MARGIN = CELL;
const COLOR = {
  g: PAL.green, l: '#6CC46F', G: '#2C7D3A',          // cactus
  P: '#C8662A', D: '#9E4F22', f: PAL.sand,           // pterodactyl
  c: PAL.cream, o: PAL.orange, W: '#FFFFFF',         // egg
  w: PAL.cream, k: PAL.ink,
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// A canvas CELL times bigger, crisp.
export function up(src) {
  const [c, g] = canvas(src.width * CELL, src.height * CELL);
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// The cell map at 1 px per cell, with a 1 cell margin for the outline.
function cells(rows, colors = COLOR) {
  const [fill, f] = canvas(rows[0].length + 2, rows.length + 2);
  rows.forEach((row, y) => [...row].forEach((v, x) => {
    if (v === '.') return;
    f.fillStyle = colors[v];
    f.fillRect(x + 1, y + 1, 1, 1);
  }));
  const [out, o] = canvas(fill.width, fill.height);
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) o.drawImage(fill, dx, dy);
  o.globalCompositeOperation = 'source-in';
  o.fillStyle = PAL.ink;
  o.fillRect(0, 0, out.width, out.height);
  o.globalCompositeOperation = 'source-over';
  o.drawImage(fill, 0, 0);
  return out;
}

// A night rim (GDD 3.6): the outlined shape grown by 1 cell, in Egg Cream.
// Draw it 1 cell further up and left than the sprite, under it, so only the ring shows.
function rim(small) {
  const [out, o] = canvas(small.width + 2, small.height + 2);
  for (let dy = 0; dy <= 2; dy++) for (let dx = 0; dx <= 2; dx++) if (dx !== 1 || dy !== 1) o.drawImage(small, dx, dy);
  o.globalCompositeOperation = 'source-in';
  o.fillStyle = PAL.cream;
  o.fillRect(0, 0, out.width, out.height);
  return up(out);
}

function sprite({ rows, oy }, withRim, colors) {
  const small = cells(rows, colors), img = up(small);
  img.oy = oy;
  if (withRim) img.rim = rim(small);
  return img;
}

// A runner's frames, in its own colors.
function runner(R) {
  const colors = { ...COLOR, ...R.colors }, one = s => sprite(s, false, colors);
  return {
    run: R.run.map(one),
    jump: one(R.jump),
    crash: one(R.crash),
    sleep: one(R.sleep),
    slide: R.slide.map(one),
    slideCrash: one(R.slideCrash),
  };
}

export const SPR = {
  runners: Object.fromEntries(Object.entries(RUNNERS).map(([id, R]) => [id, runner(R)])),
  'cactus-small': sprite(ART['cactus-small'], true),
  'cactus-large': sprite(ART['cactus-large'], true),
  ptero: ART.ptero.map(s => sprite(s, true)),
  egg: ART.egg.map(s => sprite(s, true)),   // plain, glinting
  hatchEgg: {
    stages: ART.hatchEgg.stages.map(s => sprite(s)),
    left: sprite(ART.hatchEgg.left),
    right: sprite(ART.hatchEgg.right),
    bottom: sprite(ART.hatchEgg.bottom),
  },
};
