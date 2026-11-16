// Builds the reference solutions in levels/solutions/ by steering the real sim
// with a short script per room (until rooms are recorded in the game with ?record).
// Prints each room's echo count, room time and the time par it sets (GDD 3.10).
//   node tools/make-solutions.mjs          print only
//   node tools/make-solutions.mjs --write  also write levels/solutions/<id>.json
import { writeFileSync } from 'node:fs';
import { Driver } from './driver.mjs';
import { encodeRecording } from '../src/record.js';
import { BIT, PLAYER, HZ, TIME_PAR_FACTOR } from '../src/config.js';
import { WORLDS } from '../levels/index.js';

const L = BIT.LEFT, R = BIT.RIGHT, J = BIT.JUMP, LOOP = BIT.LOOP;
const stop = d => d.hold(0, d => d.p.vx === 0);
const loopNow = d => { d.step(LOOP); d.step(0); };
const done = d => d.s.done;
// Final-loop wait for a gate an echo opens: run right to x, stand still until gate
// `g` is fully open, then 0.35 s more, so the input stream still works when the
// echo's loop is delayed by 0.25 s (the timing-tolerance rule, GDD 6).
const waitAt = (d, x, g) => {
  d.hold(R, d => d.p.x >= x); stop(d);
  d.hold(0, d => d.s.open[g] >= 1);
  d.wait(42, 0);
};

export const SCRIPTS = {
  // Walk onto the plate, Loop; then walk to the exit through the held gate.
  w1l01(d) {
    d.hold(R, d => d.p.x >= 420); stop(d); loopNow(d);
    d.hold(R, done);
  },
  // Rest at the foot of the wall; then jump on the echo and up the ledge.
  w1l02(d) {
    d.hold(R, d => d.p.x >= 695.9); stop(d); loopNow(d);
    d.hold(R, d => d.p.x >= 695.9);
    d.hold(R | J, d => d.p.grounded && d.p.ground === 2);
    d.step(R);
    d.hold(R | J, d => d.p.grounded && d.p.y + PLAYER.h <= 480.01);
    d.hold(R, done);
  },
  // One echo on each plate (Loop early twice), then run through both gates.
  w1l03(d) {
    d.hold(L, d => d.p.x <= 336); stop(d); loopNow(d);
    d.hold(R, d => d.p.x >= 650); stop(d); loopNow(d);
    d.hold(R, done);
  },
  // Echo 1 holds plate A; echo 2 walks through gate A to plate B; then run to the exit.
  w1l04(d) {
    d.hold(R, d => d.p.x >= 348); stop(d); loopNow(d);
    d.hold(R, d => d.p.x >= 668); stop(d); loopNow(d);
    d.hold(R, done);
  },
  // Echo 1 rests at the foot of the 4-tile wall; echo 2 jumps on it and rests;
  // then climb echo 1, echo 2 and the ledge.
  w1l05(d) {
    const foot = d => d.p.x >= 775.9;
    const onEcho = k => d => d.p.grounded && d.p.ground === 2 + k;
    d.hold(R, foot); stop(d); loopNow(d);
    d.hold(R, foot);
    d.hold(R | J, onEcho(0)); stop(d); loopNow(d);
    d.hold(R, foot);
    d.hold(R | J, onEcho(0)); d.step(R);
    d.hold(R | J, onEcho(1)); d.step(R);
    d.hold(R | J, d => d.p.grounded && d.p.y + PLAYER.h <= 440.01);
    d.hold(R, done);
  },
  // One echo on each plate of the AND gate (Loop early twice), then run through it.
  w1l06(d) {
    d.hold(L, d => d.p.x <= 176); stop(d); loopNow(d);
    d.hold(R, d => d.p.x >= 570); stop(d); loopNow(d);
    d.hold(R, done);
  },
  // The echo holds plate A until you are past gate A (clock 1.6 s), then steps off to
  // the left so the inverted gate opens; then run through gate A, wait between the
  // gates until the inverted one is open, and run to the exit.
  w1l07(d) {
    d.hold(L, d => d.p.x <= 262); stop(d);
    d.hold(0, d => d.s.clock >= 192);
    d.hold(L, d => d.p.x <= 200); stop(d); loopNow(d);
    waitAt(d, 760, 1);
    d.hold(R, done);
  },
  // One echo, two jobs: hold plate A until you are past gate A (clock 1.75 s), then
  // walk to plate B and rest. Wait between the gates until gate B is open, then go.
  w1l08(d) {
    d.hold(L, d => d.p.x <= 222); stop(d);
    d.hold(0, d => d.s.clock >= 210);
    d.hold(R, d => d.p.x >= 362); stop(d); loopNow(d);
    waitAt(d, 740, 1);
    d.hold(R, done);
  },
  // Echo 1 rests at the foot of the shelf; echo 2 climbs it, walks onto the high plate
  // and rests. Then run right and wait at gate B until it is open.
  w1l09(d) {
    const foot = d => d.p.x <= 280.01;
    d.hold(L, foot); stop(d); loopNow(d);
    d.hold(L, foot);
    d.hold(L | J, d => d.p.grounded && d.p.ground === 2); d.step(L);
    d.hold(L | J, d => d.p.grounded && d.p.y + PLAYER.h <= 480.01);
    d.hold(L, d => d.p.x <= 214); stop(d); loopNow(d);
    waitAt(d, 800, 0);
    d.hold(R, done);
  },
  // Echo 1: Loop before moving, a step right at the spawn (no time spent). Echo 2
  // walks to the plate and rests. Then jump onto echo 1, up the wall, run to the exit.
  w1l10(d) {
    loopNow(d);
    d.hold(L, d => d.p.x <= 102); stop(d); loopNow(d);
    d.step(R);   // start the clock with a step into the wall, so the jump is a fresh press
    d.hold(R | J, d => d.p.grounded && d.p.ground === 2); d.step(R);
    d.hold(R | J, d => d.p.grounded && d.p.y + PLAYER.h <= 480.01);
    d.hold(R, done);
  },
};

export function buildSolution(data) {
  const d = new Driver(data);
  SCRIPTS[data.id](d);
  const roomTime = d.s.roomSteps / HZ;
  return { rec: encodeRecording(data.id, d.frames), echoes: d.s.count, roomTime, timePar: Math.ceil(roomTime * TIME_PAR_FACTOR - 1e-9) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const write = process.argv.includes('--write');
  for (const w of WORLDS) for (const r of w.rooms) {
    const s = buildSolution(r);
    console.log(`${r.id}: ${s.echoes} echoes, room time ${s.roomTime.toFixed(2)} s, time par ${s.timePar} s (data: ${r.par.echoes} / ${r.par.time})`);
    if (write) writeFileSync(new URL(`../levels/solutions/${r.id}.json`, import.meta.url), JSON.stringify(s.rec) + '\n');
  }
}
