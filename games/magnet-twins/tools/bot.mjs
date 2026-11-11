// A bot with macro-actions that plays a level in co-op or solo and records the inputs
// (levels/solutions/*.json). A solution is a small script of walkTo / hopTo / power / wait.
// The same script runs in both modes: in solo the bot swaps robots with Tab and toggles powers.
import { Sim } from '../src/sim.js';
import { B } from '../src/config.js';

export class Bot {
  constructor(data, mode) {
    this.mode = mode;
    this.sim = new Sim(data, mode);
    this.R = this.sim.robots;
    this.frames = [];
    this.hold = [0, 0];                    // co-op: keys a robot keeps pressed (its power)
    this.data = data;
  }

  center(i) { const r = this.R[i]; return r.x + r.w / 2; }
  get time() { return this.sim.time; }

  // Bits for one step. i = the robot acting, bits = its keys this step.
  frame(i, bits = 0) {
    if (this.mode === 'solo') return bits;
    const a = this.hold[0] | (i === 0 ? bits : 0), b = this.hold[1] | (i === 1 ? bits : 0);
    return a | (b << 8);
  }
  tick(bits) {
    this.frames.push(bits);
    this.sim.step(bits);
    if (this.frames.length > 120 * 240) throw new Error('bot timed out');
  }
  // Solo: make robot i the one under control.
  focus(i) {
    if (this.mode === 'solo' && this.sim.active !== i) { this.tick(B.S); this.tick(0); }
  }
  wait(n, i = 0) { for (let k = 0; k < n; k++) this.tick(this.frame(i, 0)); }
  // Wait until the robot stands still on something.
  settle(i) { for (let k = 0; k < 120 && (Math.abs(this.R[i].vx) > 1 || !this.R[i].grounded); k++) this.tick(this.frame(i, 0)); }

  walkTo(i, x) {
    this.focus(i);
    const r = this.R[i];
    for (let k = 0; k < 2400; k++) {
      const d = x - this.center(i), stop = (r.vx * r.vx) / (2 * 3000) + 1;
      if (Math.abs(d) <= stop) break;
      this.tick(this.frame(i, d > 0 ? B.R : B.L));
    }
    this.settle(i);
  }

  // Press the power key. aim: 0 (the way it faces), B.U or B.D (held as it turns on).
  power(i, on, aim = 0) {
    this.focus(i);
    if (this.mode === 'coop') {
      if (on) { this.hold[i] |= B.P; this.tick(this.frame(i, aim)); this.tick(this.frame(i, aim)); }
      else { this.hold[i] &= ~B.P; this.tick(this.frame(i, 0)); }
    } else if (this.R[i].power !== on) { this.tick(B.P | aim); this.tick(aim); this.tick(0); }
  }

  // Face a direction without moving much (a tap of the arrow before turning the power on).
  face(i, dir) {
    this.focus(i);
    if (this.R[i].facing !== dir) { this.tick(this.frame(i, dir > 0 ? B.R : B.L)); this.tick(this.frame(i, 0)); this.settle(i); }
  }

  // Jump towards x until standing with the feet at or above surfaceY (the top of whatever it should land on).
  hopTo(i, x, surfaceY, tries = 8, slack = 25) {
    this.focus(i);
    const r = this.R[i];
    for (let t = 0; t < tries; t++) {
      this.tick(this.frame(i, 0));
      for (let k = 0; k < 120; k++) {
        const d = x - this.center(i);
        const dir = Math.abs(d) < 3 ? 0 : d > 0 ? B.R : B.L;
        this.tick(this.frame(i, B.U | dir));
        if (k > 4 && r.grounded) break;
      }
      this.settle(i);
      if (r.y + r.h <= surfaceY + 0.5 && Math.abs(x - this.center(i)) < slack) return;
    }
    throw new Error(`${r.pol} could not reach x=${x}, surface y=${surfaceY} (is at ${this.center(i).toFixed(0)}, ${(r.y + r.h).toFixed(0)})`);
  }

  // Steer robot i towards x for a number of steps, for example to stay centred over a twin
  // whose field is lifting it (the field pushes radially, so a robot off-centre drifts out).
  steer(i, x, steps, follow = null) {
    this.focus(i);
    for (let k = 0; k < steps; k++) {
      const target = follow !== null ? this.center(follow) : x, d = target - this.center(i);
      this.tick(this.frame(i, Math.abs(d) < 3 ? 0 : d > 0 ? B.R : B.L));
    }
  }

  // Jump straight up until the feet are above the surface, then move over onto it. For ledges
  // that stick out over your head: jumping sideways would bump the head on the underside.
  climbTo(i, x, surfaceY) {
    this.focus(i);
    const r = this.R[i];
    this.tick(this.frame(i, 0));
    for (let k = 0; k < 60; k++) { this.tick(this.frame(i, B.U)); if (r.y + r.h <= surfaceY - 6) break; }
    for (let k = 0; k < 120; k++) {
      const d = x - this.center(i);
      this.tick(this.frame(i, Math.abs(d) < 3 ? 0 : d > 0 ? B.R : B.L));
      if (k > 3 && r.grounded) break;
    }
    this.settle(i);
    if (r.y + r.h > surfaceY + 0.5) throw new Error(`${r.pol} could not climb to y=${surfaceY} at x=${x} (is at ${this.center(i).toFixed(0)}, ${(r.y + r.h).toFixed(0)})`);
  }

  // Walk off an edge or drop down to a spot.
  dropTo(i, x) { this.walkTo(i, x); }

  done() { return this.sim.done; }
}

// Run a script in both modes; returns { coop: {frames, time, bolts}, solo: {...} }.
export function runScript(data, script, modes = ['coop', 'solo']) {
  const out = {};
  for (const mode of modes) {
    const bot = new Bot(data, mode);
    script(bot, data);
    if (!bot.done()) throw new Error(`${data.id} ${mode}: the script did not reach the exit`);
    out[mode] = { frames: bot.frames, time: bot.time, bolts: bot.sim.boltCount };
  }
  return out;
}

// A bot that only walks right and jumps when it hits something: no powers, no thinking.
// A level is only a puzzle if this bot cannot finish it.
export function naiveReaches(data, mode = 'coop', seconds = 40) {
  const sim = new Sim(data, mode);
  const steps = seconds * 120;
  for (let i = 0; i < steps && !sim.done; i++) {
    let bits = 0;
    const jumpNow = r => (r.vx < 5 && r.grounded) || (i % 90 === 0);
    if (mode === 'coop') {
      const a = B.R | (jumpNow(sim.robots[0]) ? B.U : 0), b = B.R | (jumpNow(sim.robots[1]) ? B.U : 0);
      bits = a | (b << 8);
    } else {
      // solo: swap every 3 seconds and walk the active robot
      bits = B.R | (jumpNow(sim.robots[sim.active]) ? B.U : 0) | (i % 360 === 0 ? B.S : 0);
    }
    sim.step(bits);
  }
  return sim.done;
}
