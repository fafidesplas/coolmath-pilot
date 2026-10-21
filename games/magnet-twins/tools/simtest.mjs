// Headless checks for the simulation, plus scripted solutions for each level.
//   node tools/simtest.mjs          run the checks and replay the solution files
//   node tools/simtest.mjs --write  also (re)write levels/solutions/*.json from the bots
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { Sim } from '../src/sim.js';
import { B, T } from '../src/config.js';
import { encodeRecording, decodeRecording } from '../src/record.js';
import w1l01 from '../levels/w1l01.js';

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
  const s = new Sim(w1l01);
  run(s, 30);
  run(s, 200, () => B.L);
  ok(s.events.some(e => e.type === 'hazard'), 'walking into spikes triggers a reset');
}

// --- Scripted solutions ------------------------------------------------------

function solve(level, mode) {
  const sim = new Sim(level, mode);
  const frames = [];
  const hold = [0, 0];
  const R = sim.robots, crate = sim.crates[0];
  const center = r => r.x + r.w / 2;

  const frame = (i, bits) => {
    if (mode === 'solo') return bits;
    const a = hold[0] | (i === 0 ? bits : 0), b = hold[1] | (i === 1 ? bits : 0);
    return a | (b << 8);
  };
  const tick = bits => { frames.push(bits); sim.step(bits); if (frames.length > 120 * 120) throw new Error('bot timed out'); };
  const focus = i => { if (mode === 'solo' && sim.active !== i) { tick(B.S); tick(0); } };
  const wait = (n, i = 0) => { for (let k = 0; k < n; k++) tick(frame(i, 0)); };
  const settle = i => { for (let k = 0; k < 90 && (Math.abs(R[i].vx) > 1 || !R[i].grounded); k++) tick(frame(i, 0)); };
  const walkTo = (i, x) => {
    focus(i);
    const r = R[i];
    for (let k = 0; k < 2400; k++) {
      const d = x - center(r), stop = (r.vx * r.vx) / (2 * 3000) + 1;
      if (Math.abs(d) <= stop) break;
      tick(frame(i, d > 0 ? B.R : B.L));
    }
    settle(i);
  };
  const power = (i, on, aim = 0) => {
    focus(i);
    if (mode === 'coop') {
      if (on) { hold[i] |= B.P; tick(frame(i, aim)); tick(frame(i, aim)); }
      else { hold[i] &= ~B.P; tick(frame(i, 0)); }
    } else if (R[i].power !== on) { tick(B.P | aim); tick(aim); tick(0); }
  };
  // Jump towards x and keep going until standing with feet at or above surfaceY.
  const hopTo = (i, x, surfaceY) => {
    focus(i);
    const r = R[i];
    for (let tries = 0; tries < 6; tries++) {
      tick(frame(i, 0));
      for (let k = 0; k < 120; k++) {
        const d = x - center(r);
        const dir = Math.abs(d) < 3 ? 0 : d > 0 ? B.R : B.L;
        tick(frame(i, B.U | dir));
        if (k > 4 && r.grounded) break;
      }
      settle(i);
      if (r.y + r.h <= surfaceY + 0.5 && Math.abs(x - center(r)) < 25) return;
    }
    throw new Error(`${r.pol} could not reach ${x},${surfaceY}`);
  };

  // 1. Minus steps aside, Plus pulls the crate across the spikes.
  walkTo(1, 505);
  walkTo(0, 258);
  power(0, true);
  wait(80);
  // 2. Plus walks backwards, dragging the crate, then lets go.
  walkTo(0, 430);
  power(0, false);
  wait(20);
  // 3. Both climb: crate, then the plateau (surface y = 360).
  hopTo(0, crate.x + 20, crate.y);
  hopTo(0, 560, 360);
  walkTo(1, crate.x + crate.w + 22);
  hopTo(1, crate.x + 20, crate.y);
  hopTo(1, 540, 360);
  // 4. Plus holds the left plate; Minus goes through and holds the right one.
  walkTo(0, 620);
  power(0, true, B.U);
  wait(50);
  walkTo(1, 1100);
  power(1, true, B.U);
  wait(50);
  // 5. Plus lets go, hops over Minus to the exit; Minus follows.
  power(0, false);
  walkTo(0, 1040);
  hopTo(0, 1218, 360);
  power(1, false);
  walkTo(1, 1178);
  wait(60, 1);
  if (!sim.done) throw new Error('bot did not finish');
  return { frames, time: sim.time };
}

function replay(level, rec) {
  const sim = new Sim(level, rec.mode);
  const frames = decodeRecording(rec);
  for (const bits of frames) sim.step(bits);
  return sim;
}

for (const mode of ['coop', 'solo']) {
  const file = new URL(`../levels/solutions/${w1l01.id}.${mode}.json`, import.meta.url);
  if (WRITE) {
    try {
      const { frames, time } = solve(w1l01, mode);
      const rec = encodeRecording(w1l01.id, mode, frames);
      writeFileSync(file, JSON.stringify(rec) + '\n');
      console.log(`wrote ${w1l01.id}.${mode}.json  (${time.toFixed(2)} s, par ${Math.ceil(time * 1.25)} s)`);
    } catch (e) { ok(false, `${mode} bot: ${e.message}`); continue; }
  }
  if (!existsSync(file)) { ok(false, `${w1l01.id}.${mode}.json missing`); continue; }
  const rec = JSON.parse(readFileSync(file, 'utf8'));
  const a = replay(w1l01, rec), b = replay(w1l01, rec);
  ok(a.done, `${w1l01.id} ${mode} solution reaches the exit (${a.time.toFixed(2)} s)`);
  ok(a.robots[0].x === b.robots[0].x && a.steps === b.steps, `${mode} replay is deterministic`);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
