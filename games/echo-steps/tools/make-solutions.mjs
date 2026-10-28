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
