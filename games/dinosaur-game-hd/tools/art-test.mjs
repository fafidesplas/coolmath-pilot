// Checks every sprite against its hitboxes (GDD 3.4): no box pixel may be
// more than 2 px from the outlined sprite, so nobody dies without visibly
// touching something. Sprites are the exported Aseprite sheets
// (assets/sprites, see tools/export-sprites.sh), drawn CELL px per art px.
//   node tools/art-test.mjs
import fs from 'node:fs';
import { CELL, CACTUS_OY } from '../src/art.js';
import { RUNNER, RUNNER_BOXES, OBSTACLES, RUNNER_IDS } from '../src/config.js';
import { readPng } from './png.mjs';

let failed = 0, passed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };

// The farthest any box pixel is from the outlined sprite (Chebyshev px).
function gap(sprite, boxes) {
  const on = sprite.on;
  let worst = 0;
  for (const [bx, by, bw, bh] of boxes) for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
    let d = 0;
    while (d < 20) {
      let hit = false;
      for (let j = -d; j <= d && !hit; j++) for (let i = -d; i <= d && !hit; i++) hit = on.has(`${x + i},${y + j}`);
      if (hit) break;
      d++;
    }
    worst = Math.max(worst, d);
  }
  return worst;
}

const check = (name, sprite, boxes, limit = 2) => {
  const g = gap(sprite, boxes);
  ok(g <= limit, `${name}: every box within ${limit} px of the outline (worst ${g} px)`);
};

// Each frame is checked from its exported pixels: every opaque pixel, outline
// included, of a runner frame's 'stand' or 'slide' slice, or a world frame.
// Pixel (px, py) of a slice covers logical ((px - 1) * CELL, (py - 1) * CELL + oy).
const OY = { stand: 1, slide: 5 };
// { tag: [{ on, oy, rows }] } from assets/sprites/<name>.png + .json.
// Runner sheets use their 'stand' / 'slide' slices; world sheets the whole
// frame with the given oy.
function readSheet(name, worldOy = 0) {
  const base = new URL(`../assets/sprites/${name}`, import.meta.url).pathname;
  if (!fs.existsSync(`${base}.png`)) throw new Error(`missing sheet assets/sprites/${name}.png`);
  const png = readPng(`${base}.png`), data = JSON.parse(fs.readFileSync(`${base}.json`, 'utf8'));
  const slice = Object.fromEntries((data.meta.slices || []).map(s => [s.name, s.keys[0].bounds]));
  const T = {};
  for (const t of data.meta.frameTags) {
    const kind = slice.stand ? (t.name.startsWith('slide') ? 'slide' : 'stand') : null;
    T[t.name] = [];
    for (let i = t.from; i <= t.to; i++) {
      const f = data.frames[i].frame, b = kind ? slice[kind] : { x: 0, y: 0, w: f.w, h: f.h };
      const oy = kind ? OY[kind] : worldOy, on = new Set();
      let last = -1;
      for (let py = 0; py < b.h; py++) for (let px = 0; px < b.w; px++) {
        if (png.alpha(f.x + b.x + px, f.y + b.y + py) < 128) continue;
        last = Math.max(last, py);
        for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) on.add(`${(px - 1) * CELL + x},${(py - 1) * CELL + oy + y}`);
      }
      // rows: one row per fill row, for the footprint checks below.
      T[t.name].push({ on, oy, rows: Array(last - 1).fill('x'), sheet: true });
    }
  }
  return T;
}
function sheet(id) {
  const T = readSheet(id);
  return { run: T.run, jump: T.jump[0], crash: T.crash[0], sleep: T.sleep[0], slide: T.slide, slideCrash: T.slideCrash[0] };
}

for (const id of RUNNER_IDS) {
  const R = sheet(id);
  ok(R.run.length === 4 && R.slide.length === 2, `${id}: sheet has 4 run and 2 slide frames`);
  const standing = { ...Object.fromEntries(R.run.map((s, i) => [`${id} run ${i}`, s])), [`${id} jump`]: R.jump, [`${id} crash`]: R.crash, [`${id} sleep`]: R.sleep };
  for (const [name, s] of Object.entries(standing)) {
    ok(s.oy + s.rows.length * CELL === RUNNER.height, `${name}: feet on the footprint's bottom`);
    // The one exception: the original's body box reaches up to 4 px into the
    // notch between the tail and the back, on every runner with the T-Rex's
    // back (GDD 3.4, Pao's call).
    check(name, s, RUNNER_BOXES.run, 4);
  }

  // The duck box is placed from the standing top, 22 px above the duck
  // footprint's. The flat slide can't fill the top of the box (GDD 3.4): check
  // the part below the slide's top.
  const shift = RUNNER.height - RUNNER.heightDuck;
  const slides = { [`${id} slide 0`]: R.slide[0], [`${id} slide 1`]: R.slide[1], [`${id} slide crash`]: R.slideCrash };
  for (const [name, s] of Object.entries(slides)) {
    ok(s.oy + s.rows.length * CELL === RUNNER.heightDuck, `${name}: on the duck footprint's bottom`);
    const low = RUNNER_BOXES.duck.map(([x, y, w, h]) => [x, Math.max(y - shift, s.oy), w, y - shift + h - Math.max(y - shift, s.oy)]);
    check(name, s, low);
  }
}

for (const id of ['cactus-small', 'cactus-large']) {
  const t = OBSTACLES[id], s = readSheet(id, CACTUS_OY[id]).idle[0];
  ok(s.oy + s.rows.length * CELL === t.h, `${id}: base on the ground`);
  check(id, s, t.boxes);
}
readSheet('ptero').flap.forEach((s, i) => check(`ptero ${i}`, s, OBSTACLES.ptero.boxes));
for (const [id, tag, n] of [['egg', 'glint', 2], ['gold-egg', 'glint', 2], ['mount', 'flap', 2], ['hatch-egg', 'stage', 4]]) {
  ok(readSheet(id)[tag].length === n, `${id}: sheet has ${n} ${tag} frames`);
}

// Background layers (batch 6): 320 art px wide so they tile every 640 logical
// px, and the heights render.js places them at. Buttons: a 9-slice per color.
const size = name => { const d = JSON.parse(fs.readFileSync(new URL(`../assets/sprites/${name}.json`, import.meta.url), 'utf8')); return [d.frames[0].frame.w, d.frames[0].frame.h, d]; };
for (const [id, w, h] of [['sky', 320, 125], ['stars', 320, 100], ['clouds', 320, 30], ['mesas', 320, 55], ['dunes', 320, 25], ['ground', 320, 55]]) {
  const [fw, fh] = size(`bg-${id}`);
  ok(fw === w && fh === h, `bg-${id}: ${w}×${h} art px (is ${fw}×${fh})`);
}
ok(readSheet('bg-sky').day && readSheet('bg-sky').night, 'bg-sky: day and night tags');
{
  const [, , d] = size('ui-button'), T = readSheet('ui-button'), c = d.meta.slices?.[0]?.keys[0].center;
  ok(['orange', 'slate', 'gold'].every(k => T[k]?.length === 2), 'ui-button: orange, slate, gold, each normal and pressed');
  ok(!!c, 'ui-button: a 9-slice center');
  const I = readSheet('ui-icons');
  ok(['pause', 'soundOn', 'soundOff', 'prev', 'next'].every(k => I[k]?.length === 1), 'ui-icons: all 5 glyphs');
}
{
  // Header font (Rubik Dirt (Pixel)): every character the headers use, one frame each, 13×14 art px cells.
  const F = readSheet('font-header'), [w, h] = size('font-header');
  const need = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 'excl', 'quest', 'dash', 'apos', 'dot'];
  ok(need.every(k => F[k]?.length === 1), 'font-header: A-Z, 0-9 and punctuation');
  ok(w === 13 && h === 14, `font-header: 13×14 art px cells (is ${w}×${h})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
