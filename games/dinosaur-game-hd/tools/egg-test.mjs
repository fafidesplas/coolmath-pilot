// Headless egg checks (GDD 3.7).
//   node tools/egg-test.mjs
import { Run } from '../src/sim.js';
import { RUNNER, EGGS, EGG_PATTERNS, RUN } from '../src/config.js';

let failed = 0, passed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };
const SEEDS = 300;
const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

// An invincible run that records each obstacle spawn and each egg pattern
// (with its obstacle, slot and distance).
function recorded(seed, opts = {}) {
  const r = new Run(seed, { invincible: true, ...opts });
  r.log = []; r.groups = new Map(); r.slots = [];
  const next = r.gen.next.bind(r.gen);
  r.gen.next = (...a) => {
    const o = next(...a);
    r.log.push(`${o.id}/${o.size}/${o.y}/${o.gap}/${o.speedOffset}`);
    return o;
  };
  if (r.eggGen) {
    const place = r.eggGen.place.bind(r.eggGen);
    r.eggGen.place = (o, speed, m) => {
      const slot = r.eggGen.slot, eggs = place(o, speed, m);
      if (eggs.length) {
        r.groups.set(eggs[0].group, { o, eggs, m, pattern: eggs[0].pattern, slot, at: eggs.map(e => ({ ...e })), obstacles: r.obstacles.map(x => ({ ...x })) });
        r.slots.push(slot);
      }
      return eggs;
    };
  }
  return r;
}

// ---- 1. Eggs never change the obstacles ---------------------------------------------------
{
  let diff = 0;
  for (let seed = 1; seed <= 50; seed++) {
    const a = recorded(seed), b = recorded(seed, { noEggs: true });
    for (let f = 0; f < 8000; f++) { a.step(); b.step(); }
    if (a.log.join() !== b.log.join()) diff++;
  }
  ok(diff === 0, `same obstacles with and without eggs over 50 seeds x 8,000 frames (${diff} differ)`);
}

// ---- 2. Placement rules -------------------------------------------------------------------
const all = [];   // every pattern placed, over all seeds, up to 3000 m
{
  const bad = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const r = recorded(seed);
    while (r.score < 3000) r.step();
    for (const g of r.groups.values()) {
      all.push({ ...g, seed });
      if (g.m < EGG_PATTERNS[g.pattern]) bad.push(`seed ${seed}: ${g.pattern} at ${g.m} m`);
      for (const e of g.at) {
        for (const o of g.obstacles) {   // positions when the pattern was placed
          if (overlap(e.x, e.y, EGGS.w, EGGS.h, o.x, o.y, o.w, o.h)) bad.push(`seed ${seed}: ${g.pattern} egg on ${o.id}`);
        }
      }
    }
    for (let i = 1; i < r.slots.length; i++) if (r.slots[i] === r.slots[i - 1] + 1) bad.push(`seed ${seed}: patterns in a row`);
    const nests = [...r.groups.values()].filter(g => g.pattern === 'nest').map(g => g.m);
    for (let i = 1; i < nests.length; i++) if (nests[i] - nests[i - 1] < EGGS.nestEvery) bad.push(`seed ${seed}: nests ${nests[i] - nests[i - 1]} m apart`);
  }
  ok(bad.length === 0, `unlock distances, no egg on an obstacle, never two in a row, nests 500 m apart${bad.length ? ': ' + [...new Set(bad)].slice(0, 4).join('; ') : ''}`);
  const counts = {};
  for (const g of all) counts[g.pattern] = (counts[g.pattern] || 0) + 1;
  ok(Object.keys(EGG_PATTERNS).every(p => counts[p] > 0), `every pattern appears: ${JSON.stringify(counts)}`);
}

// ---- 3. A held jump collects every arc egg; ducking collects the duck line -------------------
// Replays the seed, and at the frame that centers the jump's apex over the
// obstacle, presses jump and holds it (or ducks under the pterodactyl).
function collects(seed, group) {
  const r = recorded(seed);
  let g;
  while (!(g = r.groups.get(group))) r.step();
  const o = g.o, cx = RUNNER.x + RUNNER.width / 2;
  if (g.pattern === 'duck-line') {
    r.press('duck');
    while (o.x + o.w > RUNNER.x - 5) r.step();
  } else {
    const h = [], probe = new Run(0, { noEggs: true });
    probe.speed = r.speed; probe.press('jump');
    while (probe.jumping) { probe.step(); h.push(probe.height); }
    const apex = h.indexOf(Math.max(...h)) + 1;
    while (o.x + o.w / 2 - apex * Math.floor(r.speed) > cx) r.step();
    r.press('jump');
    do r.step(); while (r.jumping);
  }
  return g.eggs.filter(e => e.taken).length;
}
{
  const bad = [];
  let arcs = 0, ducks = 0;
  for (const g of all) {
    if (!['jump-arc', 'big-arc', 'duck-line'].includes(g.pattern)) continue;
    if (g.pattern === 'duck-line') ducks++; else arcs++;
    const got = collects(g.seed, g.eggs[0].group);
    if (got < g.eggs.length) bad.push(`seed ${g.seed} ${g.pattern} at ${g.m} m: ${got}/${g.eggs.length}`);
  }
  ok(bad.length === 0, `held jump collects every arc egg (${arcs} arcs), ducking every duck line (${ducks})${bad.length ? ': ' + bad.length + ' miss, e.g. ' + bad.slice(0, 3).join('; ') : ''}`);
}

// ---- 4. Egg rate ---------------------------------------------------------------------------
// Eggs placed in the first 400 m (what a perfect player could get), and what a
// runner who never jumps picks up (ground lines, ground rows).
{
  let placed = 0, ground = 0;
  const per = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const r = new Run(seed, { invincible: true });
    let n = 0;
    while (r.score < 400) {
      const before = r.eggs.length;
      r.step();
      if (r.eggs.length > before) n += r.eggs.length - before;
    }
    placed += n; ground += r.eggCount; per.push(n);
  }
  per.sort((a, b) => a - b);
  const avg = placed / SEEDS;
  console.log(`      400 m: ${avg.toFixed(1)} eggs placed on average (10th–90th percentile ${per[SEEDS * 0.1 | 0]}–${per[SEEDS * 0.9 | 0]}), ${(ground / SEEDS).toFixed(1)} picked up without jumping`);
  ok(avg >= 30 && avg <= 90, `eggs placed in 400 m: ${avg.toFixed(1)} (want 30–90, so a typical run gets 20–50)`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
