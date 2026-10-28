// Shared helpers for the Node tools: a scripted driver that records an input
// stream while steering the real sim, and a loop-by-loop replayer.
import { parseLevel } from '../src/level.js';
import { Sim } from '../src/sim.js';
import { HZ } from '../src/config.js';

export class Driver {
  constructor(data) { this.lv = parseLevel(data); this.sim = new Sim(this.lv); this.frames = []; }
  get s() { return this.sim.s; }
  get p() { return this.sim.s.p; }
  step(bits) { this.frames.push(bits); this.sim.step(bits); this.sim.events.length = 0; }
  hold(bits, until, max = 2400) {
    for (let n = 0; !until(this); n++) {
      if (n >= max) throw new Error(`hold(${bits}) never reached its goal (x ${this.p.x.toFixed(1)}, y ${this.p.y.toFixed(1)})`);
      this.step(bits);
    }
  }
  wait(n, bits = 0) { for (let i = 0; i < n; i++) this.step(bits); }
}

// Splits a room input stream into loops: per loop the bits fed during it and the
// index (inside the loop) of the step where its clock started.
export function segment(data, frames) {
  const sim = new Sim(parseLevel(data));
  const segs = [];
  let cur = { frames: [], start: -1 };
  for (const bits of frames) {
    sim.step(bits);
    cur.frames.push(bits);
    let ended = false;
    for (const e of sim.events) {
      if (e.type === 'clockStart') cur.start = cur.frames.length - 1;
      if (e.type === 'loopEnd' || e.type === 'delete' || e.type === 'exit') ended = true;
    }
    sim.events.length = 0;
    if (ended) { segs.push(cur); cur = { frames: [], start: -1 }; }
  }
  if (cur.frames.length) segs.push(cur);
  return segs;
}

// Replays a room loop by loop. `delayLoop`/`delay` hold the live player still for
// `delay` steps right after that loop's clock starts (the 0.25 s tolerance test).
// Returns the sim plus the longest still-standing streak per loop (steps).
export function replayLoops(data, frames, delayLoop = -1, delay = 0) {
  const lv = parseLevel(data), sim = new Sim(lv);
  const segs = segment(data, frames);
  const still = [];
  segs.forEach((seg, k) => {
    if (sim.s.done) return;
    let seq = seg.frames;
    if (k === delayLoop && seg.start >= 0) seq = [...seq.slice(0, seg.start + 1), ...new Array(delay).fill(0), ...seq.slice(seg.start + 1)];
    const loopsBefore = sim.s.counts.loops + sim.s.counts.deletes;
    let run = 0, best = 0, i = 0;
    const ended = () => sim.s.done || sim.s.counts.loops + sim.s.counts.deletes !== loopsBefore;
    while (!ended() && i < seq.length + lv.loopSteps + 10) {
      const bits = i < seq.length ? seq[i] : 0;
      i++;
      sim.step(bits);
      sim.events.length = 0;
      const p = sim.s.p;
      if (sim.s.running && p.grounded && p.vx === 0 && !ended()) { run++; best = Math.max(best, run); } else run = 0;
    }
    still.push(best);
  });
  return { sim, still, loops: segs.length };
}

export const secs = steps => steps / HZ;
