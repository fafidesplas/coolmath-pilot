// The lone-runner bot (GDD 12): a breadth-first search over standing positions
// using macro moves played through the real simulation, with no echoes and no loop
// limit. It may press plates. If it reaches the exit, the room needs no echoes and
// must be redesigned.
//   node tools/lonebot.mjs            check every room
import { parseLevel } from '../src/level.js';
import { Sim } from '../src/sim.js';
import { BIT } from '../src/config.js';

const L = BIT.LEFT, R = BIT.RIGHT, J = BIT.JUMP;
const STEPS_PER_TILE = 17;

// Each macro: list of [bits, steps], then coast with `after` bits until grounded.
function macros() {
  const m = [];
  for (const d of [L, R]) {
    m.push({ seq: [[d, STEPS_PER_TILE]], after: 0 });                      // walk one tile and stop
    for (const k of [3, 6, 10]) m.push({ seq: [[d, STEPS_PER_TILE * k]], after: 0 });   // run k tiles
    m.push({ seq: [[d | J, 40]], after: d });                             // full jump sideways
    m.push({ seq: [[d | J, 1]], after: d });                              // short hop
    m.push({ seq: [[d, 20], [d | J, 40]], after: d });                    // running jump
  }
  m.push({ seq: [[J, 40]], after: 0 });                                   // straight up
  m.push({ seq: [[0, 30]], after: 0 });                                   // wait for gates
  return m;
}

export function loneBot(data, maxNodes = 6000) {
  const lv = parseLevel(data);
  const sim = new Sim(lv, { lone: true, events: false });
  const key = s => `${Math.round(s.p.x / 6)},${Math.round(s.p.y / 4)},${Array.from(s.open, o => (o > 0.5 ? 1 : 0)).join('')}`;
  const seen = new Set([key(sim.s)]);
  const queue = [sim.snapshot()];
  const M = macros();
  let nodes = 0;
  while (queue.length && nodes < maxNodes) {
    const snap = queue.shift();
    nodes++;
    for (const mac of M) {
      sim.restore(snap);
      for (const [bits, n] of mac.seq) for (let i = 0; i < n && !sim.s.done; i++) sim.step(bits);
      for (let i = 0; i < 240 && !sim.s.done && !sim.s.p.grounded; i++) sim.step(mac.after);
      if (sim.s.done) return { solved: true, nodes };
      for (let i = 0; i < 2; i++) sim.step(0);   // release, so the next jump is a fresh press
      if (sim.s.done) return { solved: true, nodes };
      const k = key(sim.s);
      if (!seen.has(k)) { seen.add(k); queue.push(sim.snapshot()); }
    }
  }
  return { solved: false, nodes, exhausted: queue.length === 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { WORLDS } = await import('../levels/index.js');
  for (const w of WORLDS) for (const r of w.rooms) {
    const res = loneBot(r);
    console.log(`${r.id}: ${res.solved ? 'SOLVED WITHOUT ECHOES' : 'not solvable alone'} (${res.nodes} positions${res.exhausted ? ', search exhausted' : ''})`);
  }
}
