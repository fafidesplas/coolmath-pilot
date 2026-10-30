// Checks every T-Rex frame against the hitbox template (GDD 3.4): no box
// pixel may be more than 2 px from the outlined sprite, so nobody dies
// without visibly touching something.
//   node tools/rex-test.mjs
import { REX } from '../src/rex.js';
import { RUNNER, RUNNER_BOXES } from '../src/config.js';

let failed = 0, passed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };

// Filled pixels plus the 1 px outline sprites.js draws around them.
function outlined(map) {
  const on = new Set();
  map.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '.') return;
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) on.add(`${x + dx},${y + dy}`);
  }));
  return on;
}

// The farthest any box pixel is from the outlined sprite (Chebyshev px).
function gap(map, boxes) {
  const on = outlined(map);
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

const standing = { ...Object.fromEntries(REX.run.map((m, i) => [`run ${i}`, m])), jump: REX.jump, crash: REX.crash, sleep: REX.sleep };
for (const [name, map] of Object.entries(standing)) {
  ok(map.length === RUNNER.height && map.every(r => r.length === RUNNER.width), `${name}: ${RUNNER.width}×${RUNNER.height}`);
  const g = gap(map, RUNNER_BOXES.run);
  ok(g <= 2, `${name}: every run box within 2 px of the outline (worst ${g} px)`);
}

// The duck box is placed from the standing top, 22 px above the duck footprint's.
const duckBoxes = RUNNER_BOXES.duck.map(([x, y, w, h]) => [x, y - (RUNNER.height - RUNNER.heightDuck), w, h]);
const slides = { 'slide 0': REX.slide[0], 'slide 1': REX.slide[1], 'slide crash': REX.slideCrash };
for (const [name, map] of Object.entries(slides)) {
  ok(map.length === RUNNER.heightDuck && map.every(r => r.length <= RUNNER.widthDuck), `${name}: fits ${RUNNER.widthDuck}×${RUNNER.heightDuck}`);
  // The flat slide can't fill the top of the duck box (GDD 3.4); check the rest.
  const low = duckBoxes.map(([x, y, w, h]) => [x, Math.max(y, 8), w, y + h - Math.max(y, 8)]);
  const g = gap(map, low);
  ok(g <= 2, `${name}: the duck box below the slide's top within 2 px (worst ${g} px)`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
