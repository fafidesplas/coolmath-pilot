// Headless checks for the simulation, plus scripted solutions for each level.
//   node tools/simtest.mjs          run the checks and replay the solution files
//   node tools/simtest.mjs --write  also (re)write levels/solutions/*.json from the bots
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { Sim } from '../src/sim.js';
import { B, T } from '../src/config.js';
import { encodeRecording, decodeRecording } from '../src/record.js';

const WRITE = process.argv.includes('--write');
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failed++; };

// A flat test room: floor surface at y = 480 (row 12).
function room(objects = [], spawn = { plus: [6, 11], minus: [10, 11] }, extraRows = {}) {
  const tiles = [];
  for (let y = 0; y < 16; y++) {
    if (extraRows[y]) tiles.push(extraRows[y]);
    else if (y === 0 || y >= 12) tiles.push('#'.repeat(32));
    else tiles.push('#' + '.'.repeat(30) + '#');
  }
  return { id: 'test', name: 'test', par: { coop: 1, solo: 1 }, tiles, spawn, exit: [28, 10], bolts: [], objects };
}
const run = (sim, n, bits = 0) => { for (let i = 0; i < n; i++) sim.step(typeof bits === 'function' ? bits(i) : bits); };
const cy = r => r.y + r.h / 2;

// --- Mechanics -------------------------------------------------------------

{ // Jump height ≈ 102 px (GDD 3.3)
  const s = new Sim(room());
  run(s, 30);
  const p = s.robots[0], y0 = p.y;
  let minY = y0;
  run(s, 80, () => B.U);
  for (let i = 0; i < 80; i++) { s.step(B.U); minY = Math.min(minY, p.y); }
  const s2 = new Sim(room()); run(s2, 30);
  let m2 = s2.robots[0].y;
  for (let i = 0; i < 100; i++) { s2.step(i < 70 ? B.U : 0); m2 = Math.min(m2, s2.robots[0].y); }
  const h = y0 - m2;
  ok(Math.abs(h - 102) < 6, `full jump height ${h.toFixed(1)} px (want ~102)`);
}

{ // Minus launches Plus: hover ~133 px above Minus's center (GDD 3.4)
  const s = new Sim(room([], { plus: [10, 10], minus: [10, 11] }));
  run(s, 60);
  const [p, m] = s.robots;
  ok(p.ground === m, 'Plus can stand on Minus');
  run(s, 240, i => ((i === 0 ? B.U : 0) | B.P | (i === 0 ? 0 : 0)) << 8 | 0);
  // hold ↑ only on the first step so the aim is up, then just keep power
  const s2 = new Sim(room([], { plus: [10, 10], minus: [10, 11] }));
  run(s2, 60);
  run(s2, 300, i => ((i < 2 ? B.U : 0) | B.P) << 8);
  const gap = cy(s2.robots[1]) - cy(s2.robots[0]);
  ok(Math.abs(gap - 133) < 8, `hover gap ${gap.toFixed(1)} px (want ~133)`);
  ok(Math.abs(s2.robots[0].vy) < 5, `hover settled (vy ${s2.robots[0].vy.toFixed(1)})`);
  ok(s2.robots[1].y + s2.robots[1].h === 480, 'launching did not make Minus jump');
  // Plus jumps off the field
  let top = s2.robots[0].y;
  for (let i = 0; i < 120; i++) { s2.step((i < 60 ? B.U : 0) | (B.P << 8)); top = Math.min(top, s2.robots[0].y); }
  const reach = 480 - (top + 36);
  ok(reach > 5.5 * T, `launch + jump reach ${(reach / T).toFixed(2)} tiles (want ~6)`);
}

{ // Shield rule: both fields on each other must not fly forever
  const s = new Sim(room([], { plus: [10, 9], minus: [10, 11] }));
  run(s, 60);
  run(s, 600, () => (B.P | B.D) | ((B.P | B.U) << 8));
  const p = s.robots[0], m = s.robots[1];
  ok(p.y > 200 && m.y > 200, `no infinite flight (Plus y ${p.y.toFixed(0)}, Minus y ${m.y.toFixed(0)})`);
}

{ // Plus pulls a crate and carries it walking backwards
  const s = new Sim(room([{ type: 'crate', x: 4, y: 11 }], { plus: [8, 11], minus: [20, 11] }));
  run(s, 30);
  run(s, 2, () => B.L); run(s, 30);              // face left
  run(s, 90, () => B.P);
  const c = s.crates[0], p = s.robots[0];
  ok(Math.abs((p.x) - (c.x + c.w)) < 1, `crate pressed against Plus (gap ${(p.x - c.x - c.w).toFixed(2)})`);
  const before = c.x;
  run(s, 60, () => B.P | B.R);
  ok(p.facing === -1, 'facing stays locked while the power is on');
  ok(c.x - before > 80, `crate carried ${(c.x - before).toFixed(0)} px`);
}

{ // Walking into a crate pushes it at 80 px/s
  const s = new Sim(room([{ type: 'crate', x: 10, y: 11 }], { plus: [8, 11], minus: [20, 11] }));
  run(s, 30);
  run(s, 60, () => B.R);
  const c = s.crates[0];
  const x0 = c.x;
  run(s, 120, () => B.R);
  ok(Math.abs((c.x - x0) - 80) < 4, `crate pushed ${(c.x - x0).toFixed(1)} px in 1 s (want 80)`);
}

{ // Aim grace: W then F within 150 ms aims up and takes the hop back
  const s = new Sim(room());
  run(s, 30);
  const p = s.robots[0], y0 = p.y;
  s.step(B.U);
  s.step(B.U | B.P);
  ok(p.aim === 'up', 'W then F aims up');
  run(s, 30, () => B.U | B.P);
  ok(Math.abs(p.y - y0) < 0.5, `no hop (moved ${(y0 - p.y).toFixed(1)} px)`);
  const s2 = new Sim(room()); run(s2, 30);
  s2.step(B.P); s2.step(B.P); s2.step(B.P | B.U);
  ok(s2.robots[0].aim === 'up', 'F then W within 150 ms aims up');
  run(s2, 20, () => B.P | B.U);
  ok(Math.abs(s2.robots[0].y - y0) < 0.5, 'F then W does not jump');
}

{ // Door: opens while a plate is in a field, closes when let go, nudges bodies out
  const objs = [{ type: 'door', id: 'd', x: 16, y: 9, lock: 'any' }, { type: 'plate', door: 'd', x: 10, y: 8 }];
  const s = new Sim(room(objs, { plus: [10, 11], minus: [20, 11] }));
  run(s, 30);
  run(s, 50, () => B.P | (s.steps < 32 ? B.U : 0));
  ok(s.gates[0].open === 1, 'gate opens with Plus under the plate aiming up');
  run(s, 100);
  ok(s.gates[0].open === 0, 'gate closes after letting go');
  const s2 = new Sim(room([{ type: 'door', id: 'd', x: 16, y: 9, lock: 'plus' }, { type: 'plate', door: 'd', x: 10, y: 8 }], { plus: [20, 11], minus: [10, 11] }));
  run(s2, 30);
  run(s2, 60, i => (B.P | (i < 2 ? B.U : 0)) << 8);
  ok(s2.gates[0].open === 0, 'a + lock ignores Minus');
}

// Checkpoints (GDD 3.6). A room with spikes at column 16, a crate at 22 and, optionally, a flag
// at column 10. Plus walks right alone; Minus stays at the start.
const spikeRow = '#' + '.'.repeat(15) + '^' + '.'.repeat(14) + '#';
const cpRoom = withFlag => room([{ type: 'crate', x: 22, y: 11 }, ...(withFlag ? [{ type: 'checkpoint', x: 10, y: 11 }] : [])],
  { plus: [4, 11], minus: [2, 11] }, { 11: spikeRow });
const RESET = Math.round(0.4 * 120);

{ // Spikes with no flag: both robots go back to the level start; crates stay
  const s = new Sim(cpRoom(false));
  run(s, 30);
  const crateX = s.crates[0].x;
  s.events.length = 0;
  let k = 0;
  while (!s.events.some(e => e.type === 'hazard') && k++ < 600) s.step(B.R);
  ok(s.events.some(e => e.type === 'hazard' && e.kind === 'spikes'), 'walking into spikes triggers a reset');
  run(s, RESET + 2);
  ok(s.events.some(e => e.type === 'respawn'), 'robots rebuild after the 400 ms poof');
  ok(s.robots[0].x === s.spawn.plus.x && s.robots[1].x === s.spawn.minus.x, 'with no checkpoint, both robots respawn at the level start');
  ok(s.crates[0].x === crateX, 'a hazard reset leaves crates where they are');
}

{ // A flag touched by one robot is raised for both; a hazard then respawns both at the flag
  const s = new Sim(cpRoom(true));
  run(s, 30);
  const f = s.flags[0];
  ok(s.flags.length === 1 && !f.on, 'the level has one flag, down at the start');
  let k = 0;
  while (!f.on && k++ < 600) s.step(B.R);
  ok(f.on && s.events.some(e => e.type === 'checkpoint' && e.pol === 'plus'), 'Plus walking past the flag raises it');
  ok(s.robots[1].x < 3 * T, 'Minus is still far away at the start when the flag goes up');
  s.events.length = 0;
  k = 0;
  while (!s.events.some(e => e.type === 'hazard') && k++ < 600) s.step(B.R);
  ok(s.events.some(e => e.type === 'hazard'), 'Plus then walks into the spikes');
  run(s, RESET + 2);
  const [p, m] = s.robots;
  ok(p.x === f.x - p.w - 2 && m.x === f.x + T + 2, `both robots respawn side by side at the flag (Plus ${p.x}, Minus ${m.x}; flag at ${f.x})`);
  ok(p.y + p.h === f.base && m.y + m.h === f.base, 'both stand on the floor at the flag');
  ok(p.x !== s.spawn.plus.x && m.x !== s.spawn.minus.x, 'not at the level start');
  run(s, 60);
  ok(p.grounded && m.grounded && !p.hidden && !m.hidden, 'after the respawn both robots stand there, visible');
  ok(f.on, 'the flag stays up after the reset');
}

// Hanging platform on a horizontal rail (GDD 3.5). The slab hangs at row 8 (top y = 320), its
// rail runs from column 6 to column 21, so its left edge stays between x = 240 and x = 760.
const railRoom = (spawn, extra = [], rail = { from: 6, to: 21 }) =>
  room([{ type: 'platform', x: 10, y: 8, rail: 'h', ...rail }, ...extra], spawn);
const STOP_STEPS = Math.round(0.2 * 120);

{ // Moves only along its rail, with no gravity
  const s = new Sim(railRoom({ plus: [12, 11], minus: [2, 11] }));
  const pf = s.platforms[0], y0 = pf.y;
  run(s, 240);
  ok(pf.x === 400 && pf.y === y0, 'a platform with no field stays put: no gravity, no drift');
  // Plus stands under the slab's right end and pulls up: the force is diagonal, the slab only
  // slides along its rail
  run(s, 2, () => B.P | B.U);
  run(s, 240, () => B.P);
  ok(pf.y === y0, `pulled at an angle, the slab keeps its height (y ${pf.y})`);
  ok(pf.x > 400 && Math.abs(pf.x + pf.w / 2 - (s.robots[0].x + 15)) < 20, `it slides over to sit above Plus (slab center ${(pf.x + 60).toFixed(0)}, Plus ${(s.robots[0].x + 15).toFixed(0)})`);
}

{ // Half acceleration: the slab gets half of what a crate gets at the same spot
  // Plus stands on a shelf at the slab's height, 120 px from the slab's center (full strength).
  const spot = { plus: [7, 7], minus: [2, 11] };
  const extraRows = { 8: '#' + '#'.repeat(7) + '.'.repeat(23) + '#' };
  const mk = objs => new Sim(room(objs, spot, extraRows));
  const s = mk([{ type: 'platform', x: 9, y: 8, rail: 'h', from: 8, to: 20 }]);
  const c = mk([{ type: 'crate', x: 10, y: 8 }]);                       // crate center = slab center
  s.step(B.P); c.step(B.P);                                             // first step: no time to fall
  const pv = s.platforms[0].v, cv = c.crates[0].vx;
  ok(pv < 0 && Math.abs(pv / cv - 0.5) < 1e-9, `pulled towards Plus, the slab gains half of a crate's speed in one step (${pv.toFixed(3)} vs ${cv.toFixed(3)} px/s)`);
  // and at full strength, straight along the rail: Plus on a shelf level with the slab's center
  const s2 = mk([{ type: 'platform', x: 9, y: 8, rail: 'h', from: 8, to: 20 }]);
  s2.platforms[0].y = s2.robots[0].y + 18 - 20;                         // slab center level with Plus's, 120 px away
  s2.step(B.P);
  ok(Math.abs(s2.platforms[0].v * 120 + 1500) < 1e-6, `straight along the rail at full strength: ${(-s2.platforms[0].v * 120).toFixed(1)} px/s² (GDD: 1500)`);
}

{ // Clamps at both rail ends
  // Plus starts under the slab and leads it a step at a time, far past each rail end.
  const s2 = new Sim(railRoom({ plus: [11, 11], minus: [2, 11] }));
  const p2 = s2.platforms[0];
  run(s2, 2, () => B.P | B.U);
  let maxX = 0;
  for (let i = 0; i < 900; i++) { s2.step(B.P | (i % 48 < 16 ? B.R : 0)); maxX = Math.max(maxX, p2.x); }
  ok(maxX === 760 && p2.x === 760, `led right, the slab stops at the right rail end (x ${p2.x}, max seen ${maxX})`);
  const s3 = new Sim(railRoom({ plus: [11, 11], minus: [2, 11] }));
  const p3 = s3.platforms[0];
  run(s3, 2, () => B.P | B.U);
  let minX = 999;
  for (let i = 0; i < 600; i++) { s3.step(B.P | (i % 48 < 16 ? B.L : 0)); minX = Math.min(minX, p3.x); }
  ok(minX === 240 && p3.x === 240, `led left, the slab stops at the left rail end (x ${p3.x}, min seen ${minX})`);
}

{ // Stops within 0.2 s when the field lets go, from full speed
  const s = new Sim(railRoom({ plus: [11, 11], minus: [2, 11] }));
  const pf = s.platforms[0];
  // Minus-free shove: Plus pulls up from under the right end so the slab gets going, then lets go
  run(s, 2, () => B.P | B.U);
  let top = 0;
  for (let i = 0; i < 120 && Math.abs(pf.v) < 100; i++) { s.step(B.P | B.R); top = Math.max(top, Math.abs(pf.v)); }
  const v0 = Math.abs(pf.v);
  let k = 0;
  while (pf.v !== 0 && k < 200) { s.step(0); k++; }
  ok(v0 >= 100 && k <= STOP_STEPS, `moving at ${v0.toFixed(0)} px/s, it stops ${k} steps after the field lets go (max ${STOP_STEPS})`);
  // and from the speed cap
  pf.v = 480;
  k = 0;
  while (pf.v !== 0 && k < 200) { s.step(0); k++; }
  ok(k <= STOP_STEPS, `from 480 px/s it stops in ${k} steps (${(k / 120).toFixed(3)} s)`);
}

{ // Carries a rider; a robot cannot move the platform it stands on
  const s = new Sim(railRoom({ plus: [11, 11], minus: [11, 7] }));
  const pf = s.platforms[0], m = s.robots[1];
  run(s, 60);
  ok(m.ground === pf, 'Minus stands on the platform');
  run(s, 2, () => (B.P | B.D) << 8);
  run(s, 120, () => B.P << 8);
  ok(pf.x === 400, 'Minus aiming down at its own platform does not move it');
  run(s, 1, () => 0);
  const dxRider = m.x, dxSlab = pf.x;
  run(s, 2, () => B.P | B.U);
  for (let i = 0; i < 240; i++) s.step(B.P | (i % 48 < 16 ? B.R : 0));
  ok(pf.x > dxSlab + 40 && Math.abs((m.x - dxRider) - (pf.x - dxSlab)) < 0.001, `the rider moves with the slab (slab +${(pf.x - dxSlab).toFixed(1)}, Minus +${(m.x - dxRider).toFixed(1)})`);
  ok(m.ground === pf && m.y + m.h === pf.y, 'and stays standing on it');
}

// --- Levels: recorded solutions, par, bolts and the naive bot ------------------------------
// Every level has a solution script (tools/solutions.mjs) run in co-op and in solo. The
// recordings (levels/solutions/<id>.<mode>.json) must reach the exit, collect all 3 bolts,
// replay identically, and match the par stored in the level (recorded time × 1.25). A bot
// that only walks right must NOT finish the level.
import { runScript, naiveReaches } from './bot.mjs';
import { SCRIPTS } from './solutions.mjs';
import { WORLDS, DEBUG_LEVELS } from '../levels/index.js';

const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const all = WORLDS.flatMap(w => w.levels);
ok(all.length === new Set(all.map(l => l.id)).size, `${all.length} levels in the world list, all with different ids`);

function replay(level, rec) {
  const sim = new Sim(level, rec.mode);
  for (const bits of decodeRecording(rec)) sim.step(bits);
  return sim;
}

for (const level of all) {
  const script = SCRIPTS[level.id];
  if (!script) { ok(false, `${level.id}: no solution script`); continue; }
  const files = m => new URL(`../levels/solutions/${level.id}.${m}.json`, import.meta.url);
  if (WRITE && (!ONLY.length || ONLY.includes(level.id))) {
    try {
      const out = runScript(level, script);
      for (const m of ['coop', 'solo']) {
        const rec = { ...encodeRecording(level.id, m, out[m].frames), time: Math.round(out[m].time * 100) / 100, bolts: out[m].bolts };
        writeFileSync(files(m), JSON.stringify(rec) + '\n');
      }
      console.log(`wrote ${level.id}: co-op ${out.coop.time.toFixed(1)} s, solo ${out.solo.time.toFixed(1)} s`);
    } catch (e) { ok(false, `${level.id}: ${e.message}`); continue; }
  }
  for (const m of ['coop', 'solo']) {
    if (!existsSync(files(m))) { ok(false, `${level.id} ${m}: no recording (run with --write)`); continue; }
    const rec = JSON.parse(readFileSync(files(m), 'utf8'));
    const a = replay(level, rec), b = replay(level, rec);
    ok(a.done && a.boltCount === 3, `${level.id} ${m} solution reaches the exit with all 3 bolts (${a.time.toFixed(1)} s)`);
    ok(a.steps === b.steps && a.robots[0].x === b.robots[0].x && a.robots[1].x === b.robots[1].x, `${level.id} ${m} replay is deterministic`);
    ok(level.par[m] === Math.ceil(rec.time * 1.25), `${level.id} ${m} par ${level.par[m]} s = recorded ${rec.time} s × 1.25`);
  }
  ok(!naiveReaches(level, 'coop') && !naiveReaches(level, 'solo'), `${level.id}: a bot that only walks right does not finish it`);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
