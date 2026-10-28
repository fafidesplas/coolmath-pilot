// Headless checks of the mechanics against GDD.md, then every room's reference
// solution and the room rules of GDD 6.
//   node tools/simtest.mjs
import { readFileSync, existsSync } from 'node:fs';
import { parseLevel } from '../src/level.js';
import { Sim } from '../src/sim.js';
import { Forecast } from '../src/forecast.js';
import { HZ, BIT, PLAYER, T, TIME_PAR_FACTOR } from '../src/config.js';
import { decodeRecording } from '../src/record.js';
import { Driver, replayLoops } from './driver.mjs';
import { loneBot } from './lonebot.mjs';
import { buildSolution } from './make-solutions.mjs';
import { WORLDS } from '../levels/index.js';

const L = BIT.LEFT, R = BIT.RIGHT, J = BIT.JUMP, LOOP = BIT.LOOP, DEL = BIT.DEL;
let failed = 0, passed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };
const FLOOR = 15 * T;

// Test room: open rows 4–14, cols 1–30, floor surface y = 600. edit(grid) adds things.
function room(edit = () => {}, extra = {}) {
  const g = Array.from({ length: 16 }, (_, r) => Array.from({ length: 32 }, (_, c) => (r >= 4 && r <= 14 && c >= 1 && c <= 30 ? '.' : '#')));
  edit(g);
  return { id: 'test', name: 'Test', loop: 10, slots: 4, par: { echoes: 0, time: 0 }, tiles: g.map(r => r.join('')), spawn: [4, 14], exit: { x: 30, y: 14 }, objects: [], ...extra };
}
const wall = (c0, c1, h) => g => { for (let c = c0; c <= c1; c++) for (let r = 15 - h; r < 15; r++) g[r][c] = '#'; };
const drv = data => new Driver(data);

// ---- Movement (GDD 3.3) -------------------------------------------------------------

{ // Full jump apex, air time, distance
  const d = drv(room());
  d.step(R); d.hold(R, d => d.p.vx >= PLAYER.maxSpeed);
  const x0 = d.p.x;
  let apex = 0, steps = 0;
  d.step(R | J);
  while (!d.p.grounded) { d.step(R | J); steps++; apex = Math.max(apex, FLOOR - (d.p.y + PLAYER.h)); }
  const air = (steps + 1) / HZ, dist = d.p.x - x0;
  ok(Math.abs(apex - 105) < 1, `full jump apex ${apex.toFixed(1)} px (GDD 105)`);
  ok(Math.abs(air - 0.57) < 0.02, `air time ${air.toFixed(3)} s (GDD 0.57)`);
  ok(Math.abs(dist - 159) < 6, `horizontal travel at full speed ${dist.toFixed(0)} px (GDD 159)`);
}
{ // Tap hop
  const d = drv(room());
  d.step(J); d.step(0);
  let apex = 0;
  while (!d.p.grounded) { d.step(0); apex = Math.max(apex, FLOOR - (d.p.y + PLAYER.h)); }
  ok(Math.abs(apex - 21) < 2, `tap hop ${apex.toFixed(1)} px (GDD 21)`);
}
{ // Run speed and acceleration
  const d = drv(room());
  let n = 0;
  d.step(R); n++;
  while (d.p.vx < PLAYER.maxSpeed) { d.step(R); n++; }
  ok(n / HZ <= 0.1 && d.p.vx === 280, `full speed 280 px/s in ${(n / HZ * 1000).toFixed(0)} ms (GDD 0.1 s)`);
}

// Climb table: n tiles of ledge with k stacked echoes. Echoes are built by play:
// echo 1 = Loop before moving at the foot; echo j+1 jumps onto echo j and rests.
function climb(tiles, echoes) {
  const data = room(wall(5, 30, tiles), { spawn: [4, 14] });
  const d = drv(data);
  const ledge = FLOOR - tiles * T;
  const jumpOn = level => {   // jump straight up from the floor / echo top until standing on echo `level`
    for (let j = 0; j < level; j++) {
      d.hold(R | J, d => d.p.grounded && d.p.ground === 2 + j, 400);
      d.step(R);
    }
  };
  for (let k = 0; k < echoes; k++) {
    if (k === 0) { d.step(LOOP); d.step(0); continue; }
    d.step(R);                         // start the clock (bump the wall)
    jumpOn(k); d.step(0); d.step(LOOP); d.step(0);
  }
  d.step(R);
  try { jumpOn(echoes); } catch { return { ok: false, spare: NaN }; }
  // Final jump: hold right into the wall; measure the highest feet and whether we land on top.
  let best = Infinity;
  const startFeet = d.p.y + PLAYER.h;
  d.step(R | J);
  for (let i = 0; i < 200 && !(d.p.grounded && i > 2); i++) {
    d.step(R | J);
    best = Math.min(best, d.p.y + PLAYER.h);
  }
  // Spare and time above the ledge: the same jump straight up from the same height.
  const reach = startFeet - 105;
  const free = drv(room());
  const rel = startFeet - ledge;          // ledge height above the take-off surface
  let n = 0;
  free.step(J);
  do { free.step(J); if (FLOOR - (free.p.y + PLAYER.h) > rel) n++; } while (!free.p.grounded);
  return { ok: d.p.grounded && Math.abs(d.p.y + PLAYER.h - ledge) < 0.01, spare: ledge - reach, aboveMs: n / HZ * 1000, startFeet };
}
for (const [tiles, k, spare, ms] of [[2, 0, 25, 267], [3, 1, 21, 250], [4, 2, 17, 225], [5, 3, 13, 200]]) {
  const r = climb(tiles, k);
  ok(r.ok && Math.abs(r.spare - spare) < 1, `${tiles}-tile ledge climbed with ${k} echo(es), ${r.spare.toFixed(0)} px spare (GDD ${spare})`);
  ok(Math.abs(r.aboveMs - ms) <= 10, `  time above the ledge ${r.aboveMs?.toFixed(0)} ms (GDD ${ms})`);
  const miss = climb(tiles + 1, k);
  ok(!miss.ok, `${tiles + 1}-tile ledge NOT climbed with ${k} echo(es) (misses by ${(-miss.spare).toFixed(0)} px)`);
}

{ // Gaps: a 4-tile gap is jumped, a 6-tile gap is not (trench 2 deep)
  // Raised floor: rows 13–14 solid everywhere except the trench; walking surface y = 520.
  const gap = w => room(g => { for (let c = 1; c <= 30; c++) if (c < 10 || c >= 10 + w) { g[13][c] = '#'; g[14][c] = '#'; } }, { spawn: [3, 12] });
  const run = w => {
    const d = drv(gap(w));
    // run to the edge and jump at the last moment (coyote off: jump while still on the ledge)
    d.hold(R, d => d.p.x + PLAYER.w >= 10 * T - 2);
    d.step(R | J);
    d.hold(R | J, d => d.p.grounded, 400);
    return d.p.y + PLAYER.h === 13 * T;
  };
  ok(run(4), '4-tile gap is crossed by a running jump');
  ok(!run(6), '6-tile gap is not crossed');
}
{ // Coyote and buffer
  const ledge = room(g => { for (let c = 1; c <= 9; c++) { g[13][c] = '#'; g[14][c] = '#'; } }, { spawn: [3, 12] });
  const coyote = late => {
    const d = drv(ledge);
    d.hold(R, d => !d.p.grounded);
    d.wait(late, R);
    const y0 = d.p.y;
    d.step(R | J); d.wait(5, R | J);
    return d.p.y < y0 - 5;
  };
  ok(coyote(6), 'jump 50 ms after running off a ledge works (coyote 80 ms)');
  ok(!coyote(12), 'jump 100 ms after running off a ledge does not');
  const buffer = early => {
    const d = drv(room());
    d.step(J); d.wait(20, J); d.hold(0, d => d.p.vy > 0);
    // find landing step from here
    const probe = drv(room()); probe.step(J); probe.wait(20, J); probe.hold(0, d => d.p.vy > 0);
    let k = 0; while (!probe.p.grounded) { probe.step(0); k++; }
    d.wait(k - early, 0); d.step(J); d.wait(early + 3, J);
    return d.p.y + PLAYER.h < FLOOR - 5;
  };
  ok(buffer(10), 'jump pressed 83 ms before landing fires on landing (buffer 100 ms)');
  ok(!buffer(18), 'jump pressed 150 ms before landing is dropped');
}

// ---- Loops and echoes (GDD 3.4, 3.5) ---------------------------------------------------

{ // Clock waits for the first move
  const d = drv(room());
  d.wait(600, 0);
  ok(d.s.clock === 0 && d.s.roomSteps === 0 && !d.s.running, 'clock waits for the first move (5 s idle = 0 room time)');
  d.step(R);
  ok(d.s.running && d.s.clock === 1, 'a move starts the clock at once');
}
{ // Echo replays the recorded path exactly, every loop, and the rewind restores the start
  const data = room(wall(14, 16, 1));
  const d = drv(data);
  const script = [];
  for (let i = 0; i < 400; i++) script.push(i < 90 ? R : i < 140 ? R | J : i < 200 ? L : i < 260 ? R | J : i % 37 < 20 ? R : L);
  const live = [];
  script.forEach(b => { d.step(b); live.push([Math.fround(d.p.x), Math.fround(d.p.y)]); });
  d.step(LOOP); d.step(0);
  ok(d.s.count === 1 && d.sim.tapes[0].len === 400, 'Loop press records a 400-step echo');
  const sp = d.sim.lv.spawn;
  ok(d.p.x === sp.x && d.p.y === sp.y && d.s.clock === 0 && !d.s.running, 'rewind restores the exact start state');
  let same = true;
  for (let loop = 0; loop < 2; loop++) {       // two more loops with different live inputs
    d.step(R);
    for (let i = 1; i < 500; i++) {
      const e = d.s.echoes[0], c = d.s.clock - 1;
      if (c < 400 && (e.x !== live[c][0] || e.y !== live[c][1])) same = false;
      d.step(i % 50 < 25 ? L : 0);
    }
    if (loop === 0) { d.step(LOOP); d.step(0); }
  }
  ok(same, 'echo takes its recorded position every step, in every later loop');
  ok(d.s.echoes[0].resting && d.s.echoes[0].x === live[399][0], 'after its tape the echo rests at its last spot');
}
{ // Rest mid-air drops; Loop before moving rests at the spawn
  const d = drv(room());
  d.step(R | J); d.wait(20, R | J); d.step(LOOP); d.step(0);
  d.step(R); d.wait(120, 0);
  const e = d.s.echoes[0];
  ok(e.resting && e.grounded && e.y + PLAYER.h === FLOOR, 'an echo whose tape ended mid-air drops and lands');
  const d2 = drv(room());
  d2.step(LOOP); d2.step(0);
  ok(d2.s.count === 1 && d2.sim.tapes[0].len === 0 && d2.s.echoes[0].resting && d2.s.echoes[0].x === d2.sim.lv.spawn.x, 'Loop before moving records an empty tape resting at the spawn');
}
{ // Delete, slots, room time
  const data = room(); data.slots = 2;
  const d = drv(data);
  d.wait(30, R); d.step(LOOP); d.step(0);
  d.wait(30, R); d.step(LOOP); d.step(0);
  ok(d.s.count === 2, 'two loops, two echoes');
  d.wait(30, R); d.step(LOOP); d.step(0);
  ok(d.s.count === 2 && d.s.counts.full === 1, 'with every slot full, ending a loop records nothing');
  d.wait(30, R); d.step(DEL); d.step(0);
  ok(d.s.count === 1 && d.s.counts.deletes === 1 && d.s.clock === 0, 'Delete removes the latest echo and restarts the loop');
  ok(d.s.roomSteps === 120, `room time counts every loop incl. deleted ones (${(d.s.roomSteps / HZ).toFixed(2)} s)`);
  d.step(R); d.wait(1300, 0);
  ok(d.s.counts.timeout === 1 && d.s.count === 2, 'the clock running out ends the loop and records an echo');
}
{ // One-way echo tops: walk through from the side, jump up through, land on top; not solid in the air
  const d = drv(room());
  d.step(LOOP); d.step(0);                       // echo 1 rests at the spawn
  d.wait(40, L); d.hold(R, d => d.p.x > d.sim.lv.spawn.x + 60);
  ok(d.p.grounded && d.p.ground === 1, 'walking through a standing echo from the side');
  d.step(DEL); d.step(0); d.step(LOOP); d.step(0);
  d.step(J); d.hold(J, d => d.p.grounded, 200);
  ok(d.p.ground === 2 && d.p.y + PLAYER.h === FLOOR - PLAYER.h, 'jumping up through an echo lands on its top (36 px up)');
  // Jumping echo: record an echo that jumps, stand where it jumps, it must not launch you
  const d2 = drv(room());
  d2.step(R); d2.wait(120, 0); d2.step(J); d2.wait(50, J); d2.wait(40, 0); d2.step(LOOP); d2.step(0);
  d2.step(J); d2.hold(J, d => d.p.grounded, 200);
  const onEcho = d2.p.ground === 2;
  let maxRise = 0; const y0 = d2.p.y;
  for (let i = 0; i < 120; i++) { d2.step(0); maxRise = Math.max(maxRise, y0 - d2.p.y); }
  ok(onEcho && maxRise < 1, `a jumping echo drops its rider instead of launching it (rider rose ${maxRise.toFixed(1)} px)`);
}
{ // Standing on a walking echo carries you
  const d = drv(room());
  d.step(R); d.wait(60, 0); d.wait(80, R); d.wait(30, 0); d.step(LOOP); d.step(0);
  d.step(J); d.hold(J, d => d.p.grounded && d.p.ground === 2, 200);
  const x0 = d.p.x; d.wait(70, 0);
  ok(d.p.ground === 2 && d.p.x - x0 > 100, `riding a walking echo carries you (${(d.p.x - x0).toFixed(0)} px)`);
}

// ---- Plates and gates (GDD 3.7, 3.8) ---------------------------------------------------

const plateRoom = (invert = false) => room(g => { for (let c = 0; c < 32; c++) for (let r = 0; r < 12; r++) g[r][c] = '#'; }, {
  objects: [{ type: 'plate', x: 8, y: 14, ch: 'A' }, { type: 'gate', x: 16, y: 12, h: 3, on: 'A', invert }],
});
{
  const d = drv(plateRoom());
  d.hold(R, d => d.s.pressed[0] === 1);
  let n = 0; while (d.s.open[0] < 1) { d.step(0); n++; }
  ok(Math.abs(n / HZ - 0.15) < 0.02, `gate opens in ${(n / HZ * 1000).toFixed(0)} ms (GDD 150)`);
  d.hold(L, d => d.s.pressed[0] === 0);
  n = 0; while (d.s.open[0] > 0) { d.step(0); n++; }
  ok(Math.abs(n / HZ - 0.2) <= 1 / HZ + 1e-9, `gate closes in ${(n / HZ * 1000).toFixed(0)} ms (GDD 200, gates follow the previous step)`);
  const d2 = drv(plateRoom());
  d2.hold(R, d => d.s.pressed[0] === 1); d2.hold(R, d => d.p.x > 17 * T || d.p.vx === 0, 300);
  ok(d2.p.x < 16 * T, 'a lone runner leaving the plate is stopped by its gate (plate rule)');
}
{ // A closing gate pushes a body out to the side its center is on
  const d = drv(plateRoom());
  d.hold(R, d => d.s.pressed[0] === 1); d.hold(0, d => d.p.vx === 0); d.wait(240, 0);
  d.hold(L, d => d.s.pressed[0] === 0); d.wait(5, 0); d.step(LOOP); d.step(0);   // echo holds ~2 s, then leaves
  d.hold(R, d => d.p.x >= 16 * T + 4); d.hold(0, d => d.p.vx === 0);           // live stands in the doorway
  const inside = d.p.x;
  d.hold(0, d => d.s.open[0] === 0, 900);
  ok(inside > 16 * T - PLAYER.w && inside < 17 * T && d.p.x === 17 * T, `a closing gate pushes a body in the doorway out to its side (x ${inside.toFixed(0)} -> ${d.p.x})`);
}
{ // Breaks: the live player closes an inverted gate in an echo's recorded path
  const d = drv(plateRoom(true));
  d.hold(R, d => d.p.x > 18 * T); d.step(LOOP); d.step(0);   // echo walks through the open inverted gate
  ok(d.s.count === 1, 'echo recorded walking through an inverted gate');
  const ev = [];
  d.hold(R, d => d.s.pressed[0] === 1); d.hold(0, d => d.p.vx === 0);
  for (let i = 0; i < 400; i++) { d.sim.step(0); ev.push(...d.sim.events); d.sim.events.length = 0; }
  ok(ev.some(e => e.type === 'break' && e.gate === 0) && d.s.echoes[0].broken, 'standing on the plate closes the gate in the echo\'s path: it breaks');
  d.step(DEL); d.step(0);
}
{ // Forecast: gate change predicted from the echoes alone
  const d = drv(plateRoom());
  d.hold(R, d => d.s.pressed[0] === 1); const at = d.s.clock; d.hold(0, d => d.p.vx === 0); d.step(LOOP); d.step(0);
  const f = new Forecast(d.sim).run();
  const ch = f.changes[0][0];
  ok(ch && ch.open && Math.abs(ch.step - at) <= 2, `forecast: gate opens at step ${ch?.step} (echo reaches the plate at ${at})`);
}

// ---- Rooms (GDD 6 room rules) ---------------------------------------------------------

for (const w of WORLDS) for (const data of w.rooms) {
  const lv = parseLevel(data);
  const file = new URL(`../levels/solutions/${data.id}.json`, import.meta.url);
  if (!existsSync(file)) { ok(false, `${data.id}: reference solution missing`); continue; }
  const rec = JSON.parse(readFileSync(file, 'utf8'));
  const frames = decodeRecording(rec);
  const play = () => { const sim = new Sim(lv); for (const b of frames) { sim.step(b); sim.events.length = 0; } return sim; };
  const a = play(), b = play();
  const t = a.s.roomSteps / HZ;
  ok(a.s.done, `${data.id} "${data.name}": reference solution reaches the exit`);
  ok(a.s.count === data.par.echoes, `${data.id}: echoes used ${a.s.count} = echo par ${data.par.echoes}`);
  ok(data.par.time === Math.ceil(t * TIME_PAR_FACTOR - 1e-9), `${data.id}: room time ${t.toFixed(2)} s sets time par ${data.par.time} s`);
  ok(a.s.p.x === b.s.p.x && a.s.n === b.s.n && a.s.roomSteps === b.s.roomSteps, `${data.id}: replay is deterministic`);
  ok(JSON.stringify(buildSolution(data).rec) === JSON.stringify(rec), `${data.id}: solution file matches tools/make-solutions.mjs`);
  const base = replayLoops(data, frames);
  ok(base.sim.s.done, `${data.id}: loop-by-loop replay reaches the exit`);
  let tol = true;
  for (let k = 0; k < base.loops; k++) if (!replayLoops(data, frames, k, 30).sim.s.done) tol = false;
  ok(tol, `${data.id}: still solved with any one loop delayed by 0.25 s (${base.loops} loops)`);
  const waits = base.still.map(s => s / HZ);
  ok(waits.slice(0, -1).every(s => s <= 3) && waits[waits.length - 1] <= 1.5, `${data.id}: short waits (longest still per loop: ${waits.map(s => s.toFixed(2)).join(', ')} s)`);
  const bot = loneBot(data);
  ok(!bot.solved, `${data.id}: lone-runner bot fails with zero echoes (${bot.nodes} positions searched)`);
  let plateRule = true;
  for (const g of lv.gates) for (const p of lv.plates) if (g.chans.includes(p.ch) && Math.abs(g.col - p.col) < 3) plateRule = false;
  ok(plateRule, `${data.id}: every plate is at least 3 tiles from its gate`);
}

console.log(failed ? `\n${failed} of ${passed + failed} checks FAILED` : `\nall ${passed} checks passed`);
process.exit(failed ? 1 : 0);
