// The echo-only pre-run (GDD 3.6): at the start of each loop the room is run once
// with the echoes alone. It gives the echo paths (rests and drops included), the
// moments they hold plates, and when each gate will change (forecast arcs).
import { Sim } from './sim.js';
import { ECHO } from './config.js';

export class Forecast {
  constructor(sim) {
    this.main = sim;
    this.ghost = new Sim(sim.lv, { ghost: true, share: sim, events: false });
    const N = ECHO.maxSteps;
    this.paths = Array.from({ length: ECHO.maxSlots }, () => ({ x: new Float32Array(N), y: new Float32Array(N), hold: new Uint8Array(N), stand: new Uint8Array(N) }));
    this.gateWant = sim.lv.gates.map(() => new Uint8Array(N));
    this.changes = sim.lv.gates.map(() => []);
    this.len = 0; this.count = 0;
  }

  run() {
    const g = this.ghost, lv = this.main.lv, L = lv.loopSteps;
    g.s.count = this.main.s.count;
    g.resetLoop(false);
    this.count = g.s.count; this.len = L;
    const start = lv.gates.map((_, i) => g.s.want[i]);
    this.changes.forEach(c => { c.length = 0; });
    for (let c = 0; c < L; c++) {
      g.step(0);
      for (let i = 0; i < this.count; i++) {
        const e = g.s.echoes[i], P = this.paths[i];
        P.x[c] = e.x; P.y[c] = e.y; P.hold[c] = e.hold ? 1 : 0; P.stand[c] = !e.broken && e.grounded ? 1 : 0;
      }
      // Gates move from the previous step's channels: record what they will want next.
      for (let i = 0; i < lv.gates.length; i++) {
        const want = ((g.s.ch & lv.gates[i].mask) === lv.gates[i].mask) !== lv.gates[i].invert ? 1 : 0;
        this.gateWant[i][c] = want;
        const prev = c ? this.gateWant[i][c - 1] : start[i];
        if (want !== prev) this.changes[i].push({ step: c + 1, open: !!want });
      }
    }
    return this;
  }

  // Next forecast change of gate i at or after `clock`, within `within` steps.
  nextChange(i, clock, within) {
    for (const ch of this.changes[i]) if (ch.step >= clock && ch.step - clock <= within) return ch;
    return null;
  }
}
