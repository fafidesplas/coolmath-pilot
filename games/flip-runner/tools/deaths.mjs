// Where and how do explored routes die? node tools/deaths.mjs w1l06 [fromCol]
// Runs the solver's search but records every death (column and cause) near the frontier.
import { parseLevel } from '../src/level.js';
import { initialState, cloneState, advance } from '../src/sim.js';
import { RUNNER } from '../src/config.js';

const [id, from = '0'] = process.argv.slice(2);
const data = (await import(new URL(`../levels/${id}.js`, import.meta.url))).default;
const lv = parseLevel(data);
const key = s => `${s.form}|${s.g}|${Math.round(s.y * 2)}|${Math.round(s.vy)}|${Math.min(s.step - s.lastGround, RUNNER.coyoteSteps + 1)}`;
let layer = [initialState(lv)];
const hist = {};
let furthest = 0;
for (let step = 0; step < 120 * 120 && layer.length; step++) {
  const next = new Map();
  for (const ns of layer) {
    const glider = ns.form === 'glider';
    const can = b => b.grounded || (ns.step + 1) - b.lastGround <= RUNNER.coyoteSteps;
    for (const press of (glider || (can(ns) && (!ns.b2 || can(ns.b2)))) ? [false, true] : [false]) {
      const s = cloneState(ns);
      let death = null;
      advance(lv, s, press ? (glider ? 2 : 1) : 0, (t, e) => { if (t === 'death') death = e; });
      if (death) {
        const col = Math.floor(s.x / 40);
        if (col >= +from) { const k = `${col} ${death.kind} g${ns.g} ${press ? 'press' : 'wait'}`; hist[k] = (hist[k] || 0) + 1; }
        continue;
      }
      if (s.done) { console.log('beatable'); process.exit(0); }
      furthest = Math.max(furthest, s.x);
      if (!next.has(key(s))) next.set(key(s), s);
    }
  }
  layer = [...next.values()];
}
console.log('furthest column', Math.floor(furthest / 40));
const top = Object.entries(hist).sort((a, b) => +a[0].split(' ')[0] - +b[0].split(' ')[0]);
for (const [k, n] of top.slice(-14)) console.log(k.padEnd(34), n);
