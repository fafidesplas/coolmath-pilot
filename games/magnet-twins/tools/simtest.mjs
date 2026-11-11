// Headless checks for the simulation, plus scripted solutions for each level.
//   node tools/simtest.mjs          run the checks and replay the solution files
//   node tools/simtest.mjs --write  also (re)write levels/solutions/*.json from the bots
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { Sim } from '../src/sim.js';
import { B, T } from '../src/config.js';
import { encodeRecording, decodeRecording } from '../src/record.js';
import w1l10 from '../levels/w1l10.js';

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

{ // Spikes reset both robots; crates stay
  const s = new Sim(w1l10);
  run(s, 30);
  run(s, 200, () => B.L);
  ok(s.events.some(e => e.type === 'hazard'), 'walking into spikes triggers a reset');
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
