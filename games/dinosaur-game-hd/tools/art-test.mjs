// Checks every sprite against its hitboxes (GDD 3.4): no box pixel may be
// more than 2 px from the outlined sprite, so nobody dies without visibly
// touching something. Sprites are cell maps (art.js) drawn CELL px per cell
// with a 1 cell outline.
//   node tools/art-test.mjs
import { REX, ART, CELL } from '../src/art.js';
import { RUNNER, RUNNER_BOXES, OBSTACLES } from '../src/config.js';

let failed = 0, passed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };

// Logical px covered by the sprite and its outline, with the first row oy px down.
function covered({ rows, oy }) {
  const on = new Set();
  rows.forEach((row, cy) => [...row].forEach((c, cx) => {
    if (c === '.') return;
    for (let y = (cy - 1) * CELL; y < (cy + 2) * CELL; y++) for (let x = (cx - 1) * CELL; x < (cx + 2) * CELL; x++) {
      const outline = (y < cy * CELL || y >= (cy + 1) * CELL) && (x < cx * CELL || x >= (cx + 1) * CELL);
      if (!outline) on.add(`${x},${y + oy}`);   // the outline is 4-connected: no corners
    }
  }));
  return on;
}

// The farthest any box pixel is from the outlined sprite (Chebyshev px).
function gap(sprite, boxes) {
  const on = covered(sprite);
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

const same = rows => rows.every(r => r.length === rows[0].length);
const check = (name, sprite, boxes, limit = 2) => {
  ok(same(sprite.rows), `${name}: rows all the same length`);
  const g = gap(sprite, boxes);
  ok(g <= limit, `${name}: every box within ${limit} px of the outline (worst ${g} px)`);
};

const standing = { ...Object.fromEntries(REX.run.map((s, i) => [`T-Rex run ${i}`, s])), 'T-Rex jump': REX.jump, 'T-Rex crash': REX.crash, 'T-Rex sleep': REX.sleep };
for (const [name, s] of Object.entries(standing)) {
  ok(s.oy + s.rows.length * CELL === RUNNER.height, `${name}: feet on the footprint's bottom`);
  // The one exception: the original's body box reaches up to 4 px into the
  // notch between the tail and the back (GDD 3.4, Pao's call).
  check(name, s, RUNNER_BOXES.run, 4);
}

// The duck box is placed from the standing top, 22 px above the duck
// footprint's. The flat slide can't fill the top of the box (GDD 3.4): check
// the part below the slide's top.
const shift = RUNNER.height - RUNNER.heightDuck;
const slides = { 'T-Rex slide 0': REX.slide[0], 'T-Rex slide 1': REX.slide[1], 'T-Rex slide crash': REX.slideCrash };
for (const [name, s] of Object.entries(slides)) {
  ok(s.oy + s.rows.length * CELL === RUNNER.heightDuck, `${name}: on the duck footprint's bottom`);
  const low = RUNNER_BOXES.duck.map(([x, y, w, h]) => [x, Math.max(y - shift, s.oy), w, y - shift + h - Math.max(y - shift, s.oy)]);
  check(name, s, low);
}

for (const id of ['cactus-small', 'cactus-large']) {
  const s = ART[id], t = OBSTACLES[id];
  ok(s.oy + s.rows.length * CELL === t.h, `${id}: base on the ground`);
  check(id, s, t.boxes);
}
ART.ptero.forEach((s, i) => check(`ptero ${i}`, s, OBSTACLES.ptero.boxes));
ART.egg.forEach((s, i) => ok(same(s.rows), `egg ${i}: rows all the same length`));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
