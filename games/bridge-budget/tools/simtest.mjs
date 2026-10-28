// Headless checks (GDD 12): the calibration checks first, then every level's
// reference and naive bridge.   node tools/simtest.mjs
import { readFileSync } from 'node:fs';
import { parseLevel, thresholds } from '../src/level.js';
import { Sim, runBridge, MAT_NAMES } from '../src/sim.js';
import { Bridge, pieceCost } from '../src/bridge.js';
import { HZ, STEP, MAX_FRAME_DT, TEST, MATERIALS } from '../src/config.js';
import { LEVELS } from '../levels/index.js';

let failed = 0, passed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };
const pct = r => `${(r * 100).toFixed(1)}%`;
const here = new URL('.', import.meta.url);

// A bare test level: two banks with a gap between x = gl and x = gr.
const testLevel = (o = {}) => parseLevel({
  id: 'test', name: 'test', number: 99,
  terrain: [[[-8, 7], [o.gl ?? 13, 7], [o.gl ?? 13, 14], [-8, 14]], [[o.gr ?? 19, 7], [40, 7], [40, 14], [o.gr ?? 19, 14]]],
  water: 10, anchors: [[o.gl ?? 13, 7], [o.gr ?? 19, 7], ...(o.anchors || [])], buildArea: [0, 0, 32, 14],
  vehicles: o.vehicles || [], flag: o.flag ?? 22, reference: 0, budget: 0, target: 0, ...o.extra,
});

// ---- 1. Statics: a loaded king-post settles to hand-calculated forces -------------------
{
  // Anchors A(13,7) and B(17,7); rafters to the top D(15,6); the post hangs C(15,7)
  // from D and carries 1000 kg. Statically determinate, so statics give exact forces.
  const lv = testLevel({ gl: 13, gr: 17 });
  const mem = [[13, 7, 15, 6, 'wood'], [15, 6, 17, 7, 'wood'], [15, 6, 15, 7, 'wood']];
  const sim = new Sim(lv, mem, { loads: [[15, 7, 1000]], vehicles: [] });
  for (let i = 0; i < HZ * 6; i++) sim.step();
  const w = MATERIALS.wood.mass, g = 9.81, rafter = Math.sqrt(5);
  const massC = 1000 + w * 1 * 0.5;                              // load + half the post
  const massD = w * rafter * 0.5 * 2 + w * 1 * 0.5;              // halves of two rafters + half the post
  const post = massC * g;                                        // tension
  // rafters: equilibrium at D on the settled (slightly flatter) shape
  const d = sim.bridgeJoints - 2, A = 0;                          // D is the first joint after the anchors
  const dx = sim.x[d] - sim.x[A], dy = sim.y[A] - sim.y[d], sin = dy / Math.sqrt(dx * dx + dy * dy);
  const raft = -(massD * g + post) / (2 * sin);                  // compression
  const f = sim.force;
  const err = (a, b) => Math.abs(a - b) / Math.abs(b);
  ok(err(f[2], post) < 0.01, `king-post: post ${(f[2] / 1e3).toFixed(2)} kN vs statics ${(post / 1e3).toFixed(2)} kN (within 1%)`);
  ok(err(f[0], raft) < 0.01 && err(f[1], raft) < 0.01, `king-post: rafters ${(f[0] / 1e3).toFixed(2)} / ${(f[1] / 1e3).toFixed(2)} kN vs statics ${(raft / 1e3).toFixed(2)} kN (within 1%)`);
}

// ---- 2. Settling: the gravity ramp plus the settle phase leave no jelly -----------------
{
  const data = (await import('../levels/w1l04.js')).default;
  const sol = JSON.parse(readFileSync(new URL('../levels/solutions/w1l04.json', here)));
  const sim = new Sim(parseLevel(data), sol.members, { vehicles: [] });
  let maxV = 0;
  for (let i = 0; i < HZ * 4; i++) {
    sim.step();
    if (sim.time >= 1.5) for (let j = 0; j < sim.bridgeJoints; j++) maxV = Math.max(maxV, Math.sqrt(sim.vx[j] ** 2 + sim.vy[j] ** 2));
  }
  ok(maxV < 0.03, `settle: joints move under 3 cm/s after 1.5 s (max ${(maxV * 100).toFixed(2)} cm/s)`);
}

// ---- 3. Cables go slack instead of pushing ---------------------------------------------
{
  const lv = testLevel({ gl: 13, gr: 17 });
  // A cable hanging down from a joint held by two wood rafters: pushed, it must carry nothing.
  const sim = new Sim(lv, [[13, 7, 15, 5, 'wood'], [15, 5, 17, 7, 'wood'], [15, 5, 15, 7, 'cable']], { vehicles: [] });
  sim.y[sim.bridgeJoints - 1] -= 0.5;   // lift the cable's free end: compressed
  sim.step();
  ok(sim.force[2] === 0 && sim.slack[2] === 1, 'a compressed cable is slack and carries no force');
}

// ---- 4. Breaking: over the limit breaks and is reported ------------------------------------
{
  const lv = testLevel({ gl: 13, gr: 17 });
  const sim = new Sim(lv, [[13, 7, 15, 7, 'wood'], [15, 7, 17, 7, 'wood']], { loads: [[15, 7, 3000]], vehicles: [] });
  const events = [];
  for (let i = 0; i < HZ * 3 && sim.broken === 0; i++) { sim.step(); events.push(...sim.events); sim.events.length = 0; }
  const br = events.find(e => e.type === 'break');
  ok(br && br.first && sim.firstBreak >= 0, `a 3 t load on a flat 4 m wooden pair breaks it (first break: member ${sim.firstBreak} at ${sim.time.toFixed(2)} s)`);
}

// ---- 5. Substeps: 8 and 16 agree on every reference and naive bridge ---------------------
const levelData = [];
for (const data of LEVELS) {
  const sol = JSON.parse(readFileSync(new URL(`../levels/solutions/${data.id}.json`, here)));
  levelData.push({ data, lv: parseLevel(data), sol });
}
{
  const bad = [];
  for (const { data, lv, sol } of levelData) {
    for (const [name, m] of [['reference', sol.members], ['naive', sol.naive]]) {
      if (!m) continue;
      const a = runBridge(lv, m), b = runBridge(lv, m, { substeps: 16 });
      if (a.pass !== b.pass) bad.push(`${data.id} ${name}`);
    }
  }
  ok(!bad.length, `8 and 16 substeps give the same pass/fail on every stored bridge${bad.length ? ': ' + bad.join(', ') : ''}`);
}

// ---- 6. Slopes: 1:2 and 2:3 are climbed, a 4 m-high 45° ramp stalls ------------------------
{
  const ramp = (run, rise) => parseLevel({
    id: 'ramp', name: 'ramp', number: 99,
    terrain: [[[-8, 7], [6, 7], [6 + run, 7 - rise], [40, 7 - rise], [40, 14], [-8, 14]]],
    anchors: [], buildArea: [0, 0, 32, 14], vehicles: [], flag: 6 + run + 4, start: 3, startY: 7, reference: 0, budget: 0, target: 0,
  });
  for (const v of ['car', 'truck', 'bus']) {
    const r12 = runBridge(ramp(8, 4), [], { vehicles: [v] });
    const r23 = runBridge(ramp(6, 4), [], { vehicles: [v] });
    const r45 = runBridge(ramp(4, 4), [], { vehicles: [v] });
    ok(r12.pass && r23.pass && !r45.pass && r45.reason === 'stuck',
      `${v}: climbs 1:2 (${r12.reason} ${r12.time.toFixed(1)} s) and 2:3 (${r23.reason} ${r23.time.toFixed(1)} s), stalls on 45° (${r45.reason})`);
  }
}

// ---- 7. Determinism ------------------------------------------------------------------------
{
  const { lv, sol } = levelData.find(l => l.data.id === 'w1l04');
  const a = new Sim(lv, sol.members), b = new Sim(lv, sol.members);
  for (let i = 0; i < HZ * 5; i++) { a.step(); b.step(); }
  ok(a.snapshot() === b.snapshot(), 'two identical runs give bit-identical joint positions');
  // The game's accumulator at 60 Hz, 144 Hz, uneven frames and 2× fast-forward.
  const run = (frames, speed = 1) => {
    const s = new Sim(lv, sol.members);
    let acc = 0, i = 0;
    while (s.steps < HZ * 5) {
      acc += Math.min(frames[i++ % frames.length], MAX_FRAME_DT) * speed;
      while (acc >= STEP && s.steps < HZ * 5) { s.step(); acc -= STEP; }
    }
    return s.snapshot();
  };
  const ref = a.snapshot();
  ok(run([1 / 60]) === ref && run([1 / 144]) === ref && run([0.007, 0.031, 0.016, 0.05, 0.002]) === ref && run([1 / 60], TEST.fast) === ref,
    'same end state at 60 Hz, 144 Hz, uneven frames and 2× fast-forward');
}

// ---- 8. The sim uses only exact arithmetic ---------------------------------------------------
{
  const src = readFileSync(new URL('../src/sim.js', here), 'utf8').replace(/\/\/.*$/gm, '');
  const banned = ['Math.hypot', 'Math.sin', 'Math.cos', 'Math.atan', 'Math.pow', 'Math.exp', 'Math.random', '**', 'Date', 'performance'].filter(k => src.includes(k));
  ok(!banned.length, `sim.js uses only + − × ÷, comparisons and Math.sqrt${banned.length ? ' (found ' + banned.join(', ') + ')' : ''}`);
}

// ---- 9. Every level: reference, naive, costs, thresholds ------------------------------------
for (const { data, lv, sol } of levelData) {
  const id = data.id;
  const b = new Bridge(lv);
  b.load(sol.members, false);
  ok(b.members.length === sol.members.length, `${id} reference loads into the editor (${b.members.length} pieces)`);
  const cost = sol.members.reduce((s, m) => s + pieceCost(m[4], m[0], m[1], m[2], m[3]), 0);
  ok(cost === sol.cost && cost === data.reference, `${id} reference costs $${cost} (solution file $${sol.cost}, level $${data.reference})`);
  const th = thresholds(data.reference);
  ok(th.target === data.target && th.budget === data.budget, `${id} target $${data.target} and budget $${data.budget} match the reference (want $${th.target} / $${th.budget})`);
  // every reference piece must be buildable by drawing it (valid nodes, no terrain crossing)
  const draw = new Bridge(lv);
  const badDraw = sol.members.filter(m => { const p = draw.plan(m[0], m[1], m[2], m[3], m[4]); if (p.ok) draw.apply([p]); return !p.ok && p.reason !== 'Already built'; });
  ok(!badDraw.length, `${id} every reference piece can be drawn in the editor${badDraw.length ? ': ' + JSON.stringify(badDraw) : ''}`);
  ok(sol.members.every(m => lv.materials.includes(m[4])), `${id} reference uses only the level's materials (${lv.materials.join(', ')})`);
  const r = runBridge(lv, sol.members);
  ok(r.pass && r.broken === 0 && r.peak <= 0.9, `${id} reference passes at peak ${pct(r.peak)} ≤ 90%, ${r.broken} broken (${r.time.toFixed(2)} s)`);
  ok(Math.abs(r.peak - sol.peak) < 0.005, `${id} stored peak ${pct(sol.peak)} matches ${pct(r.peak)}`);
  const again = runBridge(lv, sol.members);
  ok(again.sim.snapshot() === r.sim.snapshot(), `${id} reference replays bit-identically`);
  if (sol.naive) {
    const n = runBridge(lv, sol.naive);
    const s = n.sim;
    ok(!n.pass, `${id} naive bridge fails (${n.reason} at ${n.time.toFixed(2)} s, first break ${s.firstBreak >= 0 ? MAT_NAMES[s.mat[s.firstBreak]] : 'none'})`);
    if (sol.naive.length) {
      const d = runBridge(lv, sol.naive, { noBreak: true });
      ok(d.peak >= 1.1, `${id} naive bridge fails with margin: unbreakable, it peaks at ${pct(d.peak)} (≥ 110%)`);
    }
  }
}

// ---- 10. Level 2's lesson holds for every way to lay a bare road -----------------------------
{
  const { lv } = levelData.find(l => l.data.id === 'w1l02');
  const parts = [[13, 15, 17, 19], [13, 14, 15, 16, 17, 18, 19], [13, 15, 16, 17, 19], [13, 14, 16, 18, 19], [13, 15, 17, 18, 19], [13, 14, 15, 17, 19]];
  const res = parts.map(p => runBridge(lv, p.slice(1).map((x, i) => [p[i], 7, x, 7, 'road']), { noBreak: true }).peak);
  ok(res.every(r => r >= 1.1), `w1l02: every bare road split needs ≥ 110% (${res.map(pct).join(', ')})`);
}

// ---- 11. Performance: ms per 120 Hz step for a ~160-member bridge with the truck ---------------
{
  const lv = testLevel({ gl: 4, gr: 28, vehicles: ['truck'], flag: 31 });
  const m = [];
  for (let x = 4; x < 28; x++) {
    m.push([x, 7, x + 1, 7, 'road']);
    m.push([x, 5, x + 1, 5, 'steel']);
    m.push([x, 7, x + 1, 5, 'steel']);
    m.push([x + 1, 7, x, 5, 'steel']);
    m.push([x, 9, x + 1, 9, 'steel']);
    if (x % 3 === 0) m.push([x, 7, x, 9, 'wood']);
    if (m.length > 160) break;
  }
  for (let x = 5; x < 28 && m.length < 160; x++) m.push([x, 5, x, 7, 'wood']);
  const sim = new Sim(lv, m.slice(0, 160));
  for (let i = 0; i < 60; i++) sim.step();            // warm up
  const t0 = performance.now();
  const N = 1200;
  for (let i = 0; i < N; i++) sim.step();
  const ms = (performance.now() - t0) / N;
  ok(ms < 2, `${sim.m} members + truck: ${ms.toFixed(3)} ms per 120 Hz step in Node (budget 2 ms at 4× throttle)`);
  console.log(`      (at 4× CPU throttle that is about ${(ms * 4).toFixed(2)} ms)`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
