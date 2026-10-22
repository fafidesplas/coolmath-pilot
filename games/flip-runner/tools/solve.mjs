// One-button solver (GDD 12). Breadth-first over 120 Hz steps: from every
// standing state try "flip now" or "wait". States that look the same are merged.
// Reports whether the level can be beaten, the most stars reachable, the input
// route, and the tightest flip window on that route.
//   node tools/solve.mjs [levelId]
import { parseLevel } from '../src/level.js';
import { initialState, cloneState, advance, bankedCount } from '../src/sim.js';
import { RUNNER, HZ } from '../src/config.js';

const keyOf = s => {
  let mask = 0;
  for (let i = 0; i < s.stars.length; i++) if (s.stars[i]) mask |= 1 << i;
  const coyote = Math.min(s.step - s.lastGround, RUNNER.coyoteSteps + 1);
  const b = s.b2 ? `${Math.round(s.b2.y * 2)}|${Math.round(s.b2.vy)}|${Math.min(s.step - s.b2.lastGround, RUNNER.coyoteSteps + 1)}` : '';
  return `${s.form}|${s.g}|${Math.round(s.y * 2)}|${Math.round(s.vy)}|${coyote}|${mask}|${b}`;
};

export function solve(data, { maxSteps = 120 * 180 } = {}) {
  const lv = parseLevel(data);
  let layer = [{ s: initialState(lv), parent: null, press: false, kids: null }];
  const all = [layer];
  const goals = [];

  for (let step = 0; step < maxSteps && layer.length; step++) {
    const next = new Map();
    for (const node of layer) {
      node.kids = [null, null];
      // Action 1 is "press" in flip and twin form, "hold" in glider form.
      const ns = node.s, glider = ns.form === 'glider';
      const can = b => b.grounded || (ns.step + 1) - b.lastGround <= RUNNER.coyoteSteps;
      const canAct = glider || (can(ns) && (!ns.b2 || can(ns.b2)));
      for (const press of canAct ? [false, true] : [false]) {
        const s = cloneState(ns);
        advance(lv, s, press ? (glider ? 2 : 1) : 0);
        if (s.dead > 0) continue;
        if (s.done) { const g = { s, parent: node, press, kids: [] }; goals.push(g); node.kids[press ? 1 : 0] = g; continue; }
        const k = keyOf(s);
        let child = next.get(k);
        if (!child) { child = { s, parent: node, press, kids: null }; next.set(k, child); }
        node.kids[press ? 1 : 0] = child;
      }
    }
    layer = [...next.values()];
    all.push(layer);
  }
  if (!goals.length) return { ok: false, layers: all.length };

  // Most stars any route can bank, then mark the nodes that can still reach
  // a goal with that many stars (backwards over the layers).
  const bestStars = Math.max(...goals.map(g => bankedCount(g.s)));
  for (const g of goals) g.good = bankedCount(g.s) === bestStars;
  for (let i = all.length - 1; i >= 0; i--) {
    for (const n of all[i]) if (!n.good && n.kids) n.good = n.kids.some(k => k && k.good);
  }

  // Build a route that flips in the middle of the widest good window each time,
  // and measure that window. Waiting through a stretch is preferred when it works.
  const presses = [], windows = [], holds = [];
  let n = all[0][0];
  while (!n.s.done) {
    if (!n.kids[1]) { n = n.kids[0]; continue; }
    const chain = [];
    let m = n;
    while (m && !m.s.done && m.kids && m.kids[1]) { chain.push(m); m = m.kids[0]; }
    if (m && m.good) { n = m; continue; }
    let bestA = -1, bestLen = 0;
    for (let a = 0; a < chain.length;) {
      if (!chain[a].kids[1].good) { a++; continue; }
      let b = a;
      while (b < chain.length && chain[b].kids[1].good) b++;
      if (b - a > bestLen) { bestA = a; bestLen = b - a; }
      a = b;
    }
    if (bestA < 0) throw new Error('solver lost the route');
    const pick = chain[bestA + (bestLen >> 1)];
    if (pick.s.form === 'glider') holds.push(pick.s.step);
    else {
      presses.push(pick.s.step);
      windows.push({ step: pick.s.step, col: Math.floor((pick.s.x + RUNNER.w) / 40), ms: Math.round(bestLen / HZ * 1000) });
    }
    n = pick.kids[1];
  }

  return {
    ok: true,
    stars: bankedCount(n.s),
    time: n.s.step / HZ,
    presses,
    holds,
    frames: n.s.step,
    tightestMs: Math.min(...windows.map(w => w.ms)),
    windows,
  };
}

// Input frames (one bit per step) for a solution route.
export function framesOf(result) {
  const f = new Array(result.frames).fill(0);
  for (const p of result.presses) f[p] = 1;
  for (const p of result.holds) f[p] = 2;
  return f;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2] || 'w1l01';
  const data = (await import(`../levels/${id}.js`)).default;
  const t0 = Date.now();
  const r = solve(data);
  console.log(r.ok
    ? `${id}: beatable, ${r.stars}/3 stars, ${r.time.toFixed(2)} s, ${r.presses.length} flips, tightest window ${r.tightestMs} ms  (${Date.now() - t0} ms)`
    : `${id}: NOT beatable`);
  if (r.ok && process.argv.includes('-v')) for (const w of r.windows) console.log(`  flip at column ${w.col}: window ${w.ms} ms`);
}
