// Headless golden egg checks (GDD 3.7).
//   node tools/golden-test.mjs
import { Run } from '../src/sim.js';
import { RUNNER, GOLD } from '../src/config.js';

let failed = 0, passed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };
const SEEDS = 300;

// ---- 1. The golden egg never changes the obstacles -----------------------------------------
{
  let diff = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const log = r => { const a = []; const next = r.gen.next.bind(r.gen); r.gen.next = (...x) => { const o = next(...x); a.push(`${o.id}/${o.size}/${o.y}/${o.gap}`); return o; }; return a; };
    const a = new Run(seed, { invincible: true }), b = new Run(seed, { invincible: true, noGolden: true }), c = new Run(seed, { invincible: true, noEggs: true });
    const la = log(a), lb = log(b), lc = log(c);
    for (let f = 0; f < 9000; f++) { a.step(); b.step(); c.step(); }
    if (la.join() !== lb.join() || la.join() !== lc.join()) diff++;
  }
  ok(diff === 0, `same obstacles with and without the golden egg over 50 seeds (${diff} differ)`);
}

// ---- 2. Where it is placed -------------------------------------------------------------------
const placed = [];
{
  const ms = [], late = [];
  let none = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const r = new Run(seed, { invincible: true });
    while (!r.golden && r.score < 1500) r.step();
    if (!r.golden) { none++; continue; }
    ms.push(r.golden.m);
    if (r.golden.m > GOLD.to) late.push(r.golden.m - r.eggGen.goldenAt);
    placed.push(seed);
  }
  ms.sort((a, b) => a - b);
  console.log(`      placed at ${ms[0]}–${ms[ms.length - 1]} m (median ${ms[ms.length >> 1]}); ${late.length} after ${GOLD.to} m (at most ${Math.round(Math.max(0, ...late))} m after its pick)`);
  ok(none === 0, `every run reaching 1500 m gets a golden egg (${none} of ${SEEDS} don't)`);
  ok(ms[0] >= GOLD.from, `never before ${GOLD.from} m`);
  ok(late.length <= SEEDS * 0.1, `at most 10% placed after ${GOLD.to} m (${late.length})`);
}

// ---- 3. A held jump at the right time grabs it and clears everything; a tap doesn't --------
// Takeoff `off` frames from the ideal one (apex over the egg). Returns { got, hit }.
function tryJump(seed, off, tap = false) {
  const r = new Run(seed, { invincible: true });
  while (!r.golden) r.step();
  const probe = new Run(0, { noEggs: true });
  probe.speed = r.speed; probe.press('jump');
  const h = [];
  while (probe.jumping) { probe.step(); h.push(probe.height); }
  const apex = h.indexOf(Math.max(...h)) + 1, mid = RUNNER.x + RUNNER.width / 2;
  while (r.golden.x + GOLD.w / 2 - (apex - off) * Math.floor(r.speed) > mid) r.step();
  let hit = false;
  const near = () => r.obstacles.find(o => o.x + o.w > 0);
  r.press('jump');
  for (let f = 0; r.jumping; f++) {
    if (tap && f === 4) r.release('jump');
    r.step();
    const o = near();
    hit ||= !!o && r.collides(o);
  }
  // Land, then a held jump over the next obstacle (it repeats on landing as a held key does).
  return { got: r.goldenTaken, hit };
}
{
  const bad = [], windows = [];
  let tapped = 0;
  for (const seed of placed) {
    const best = tryJump(seed, 0);
    if (!best.got || best.hit) bad.push(`seed ${seed}: ${best.got ? '' : 'missed'}${best.hit ? ' hit' : ''}`);
    let w = 0;
    for (let off = -12; off <= 12; off++) { const t = tryJump(seed, off); if (t.got && !t.hit) w++; }
    windows.push(w);
    if (tryJump(seed, 0, true).got) tapped++;
  }
  windows.sort((a, b) => a - b);
  ok(bad.length === 0, `a held jump with its apex on the egg grabs it without touching an obstacle${bad.length ? ': ' + bad.length + ' fail, e.g. ' + bad.slice(0, 3).join('; ') : ''}`);
  console.log(`      takeoff window that grabs it: ${windows[0]}–${windows[windows.length - 1]} frames (median ${windows[windows.length >> 1]})`);
  ok(windows[0] >= 5, `at least 5 frames (83 ms) of takeoff timing grab it`);
  ok(tapped === 0, `the shortest jump never reaches it (${tapped} do)`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
