// Box queries against tiles and closed gates (GDD 3.2, 3.8). No allocations:
// scan() writes the bounds of everything solid it overlaps into `hit`.
import { T, COLS, ROWS } from './config.js';

export const EPS = 1e-6;
export const hit = { n: 0, left: 0, right: 0, top: 0, bottom: 0, gate: -1 };

function add(x0, y0, x1, y1) {
  hit.n++;
  if (x0 < hit.left) hit.left = x0;
  if (x1 > hit.right) hit.right = x1;
  if (y0 < hit.top) hit.top = y0;
  if (y1 > hit.bottom) hit.bottom = y1;
}

// Height of a gate's solid part (it slides up into its header as it opens).
export const gateSolidH = (g, open) => g.hpx * (1 - open);

// world: { lv, open: Float64Array (one per gate) }
export function scan(world, x, y, w, h) {
  hit.n = 0; hit.left = Infinity; hit.right = -Infinity; hit.top = Infinity; hit.bottom = -Infinity; hit.gate = -1;
  const lv = world.lv;
  const c0 = Math.floor((x + EPS) / T), c1 = Math.floor((x + w - EPS) / T);
  const r0 = Math.floor((y + EPS) / T), r1 = Math.floor((y + h - EPS) / T);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS || lv.tiles[r * COLS + c] === 1) add(c * T, r * T, c * T + T, r * T + T);
    }
  }
  const gates = lv.gates;
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i], gh = gateSolidH(g, world.open[i]);
    if (gh <= EPS) continue;
    if (x + w > g.x + EPS && x < g.x + g.w - EPS && y + h > g.y + EPS && y < g.y + gh - EPS) { add(g.x, g.y, g.x + g.w, g.y + gh); hit.gate = i; }
  }
  return hit.n;
}

// Largest overlap (the smaller of the two axes) between a box and any closed gate part.
export function gateOverlap(world, x, y, w, h) {
  let best = 0, which = -1;
  const gates = world.lv.gates;
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i], gh = gateSolidH(g, world.open[i]);
    if (gh <= EPS) continue;
    const ox = Math.min(x + w, g.x + g.w) - Math.max(x, g.x);
    const oy = Math.min(y + h, g.y + gh) - Math.max(y, g.y);
    const o = Math.min(ox, oy);
    if (ox > 0 && oy > 0 && o > best) { best = o; which = i; }
  }
  return which < 0 ? null : { overlap: best, gate: which };
}
