// Headless bonus flight checks (GDD 3.8): the flight is only eggs, nothing to dodge.
//   node tools/flight-test.mjs [seeds]     (default 300)
import { Flight } from '../src/flight.js';
import { stream, STREAM } from '../src/gen.js';
import { FLIGHT as F, EGGS } from '../src/config.js';

let failed = 0, passed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };
const SEEDS = +process.argv[2] || 300;
const make = seed => new Flight(stream(seed, STREAM.flight));

// ---- 1. Deterministic ------------------------------------------------------------------------
{
  const key = f => JSON.stringify(f.eggs.map(e => [e.x, e.y]));
  ok(key(make(42)) === key(make(42)), 'the same seed gives the same flight');
}

// ---- 2. Nothing to hit, a ton of eggs, all inside the flying area -----------------------------
{
  let eggs = 0, min = Infinity, max = 0, hazards = 0, bad = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const f = make(seed);
    eggs += f.eggs.length; min = Math.min(min, f.eggs.length); max = Math.max(max, f.eggs.length);
    hazards += f.hazards.length + f.wild.length;
    for (const e of f.eggs) if (e.y < F.ceiling || e.y + EGGS.h > F.floor) bad.push(`seed ${seed}: egg at y ${e.y}`);
  }
  console.log(`      per flight: ${(eggs / SEEDS).toFixed(0)} eggs (${min}–${max})`);
  ok(hazards === 0, 'no thunderclouds and no wild pterodactyls');
  ok(min >= 400, `at least 400 eggs in every flight (fewest: ${min})`);
  ok(bad.length === 0, `every egg is between the ceiling and the floor${bad.length ? ': ' + bad.slice(0, 3).join('; ') : ''}`);
}

// ---- 3. A flight can't be lost; a simple bot grabs most of the eggs ---------------------------
{
  let hit = 0, got = 0, total = 0;
  for (let seed = 1; seed <= Math.min(SEEDS, 100); seed++) {
    const f = make(seed);
    while (!f.done) {
      const x0 = F.x + F.box[0] + f.scroll, mid = f.y + F.box[1] + F.box[3] / 2;
      const next = f.eggs.find(e => !e.taken && e.x + EGGS.w > x0);
      const want = next ? next.y + EGGS.h / 2 : 170;
      f.holding = mid > want + f.vy * 6;
      f.step();
    }
    if (f.hit) hit++;
    got += f.eggCount; total += f.eggs.length;
  }
  ok(hit === 0, 'no flight ends in a hit');
  console.log(`      a simple bot grabs ${(100 * got / total).toFixed(0)}% of the eggs`);
  ok(got / total > 0.3, 'the eggs are reachable (a simple bot gets over 30%)');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
