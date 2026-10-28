// Shadow and match (GDD 3.7–3.8). Pure: the same code draws the shadow, computes
// the match and runs in Node for the tools.
// Blocks are [x, y, z, color, shape]; shape 0 = cube, 1–4 = wedge with its right
// angle at tl, tr, bl, br. Every block is a prism along z: its front polygon
// (CCW, in the unit cell) extruded over [z, z + 1].
import { poseMatrix } from './pose.js';

const BL = [0, 0], BR = [1, 0], TR = [1, 1], TL = [0, 1];
export const SHAPES = [
  [BL, BR, TR, TL],   // cube
  [BL, TR, TL],       // tl
  [BR, TR, TL],       // tr
  [BL, BR, TL],       // bl
  [BL, BR, TR],       // br
];
export const CUT_NAMES = { tl: 1, tr: 2, bl: 3, br: 4 };

// Which sides of the cell are full (shared faces): left, right, bottom, top.
const FULL = [
  { l: 1, r: 1, b: 1, t: 1 },
  { l: 1, r: 0, b: 0, t: 1 },
  { l: 0, r: 1, b: 0, t: 1 },
  { l: 1, r: 0, b: 1, t: 0 },
  { l: 0, r: 1, b: 1, t: 0 },
];
export const sideFull = (shape, side) => FULL[shape][side] === 1;

// Which side an edge of a front polygon lies on (null for a diagonal).
export function edgeSide(a, b) {
  if (a[1] === 0 && b[1] === 0) return 'b';
  if (a[1] === 1 && b[1] === 1) return 't';
  if (a[0] === 0 && b[0] === 0) return 'l';
  if (a[0] === 1 && b[0] === 1) return 'r';
  return null;
}

// Mask frame: n × n cells over a square of side 2R around the pivot (GDD 3.7).
export function makeFrame(blocks, n = 64) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const b of blocks) {
    x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); z0 = Math.min(z0, b[2]);
    x1 = Math.max(x1, b[0] + 1); y1 = Math.max(y1, b[1] + 1); z1 = Math.max(z1, b[2] + 1);
  }
  const pivot = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const R = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2;
  return { pivot, R, n, cell: 2 * R / n, size: [x1 - x0, y1 - y0, z1 - z0] };
}

// 2D convex hull (monotone chain), CCW, as a flat array [x0, y0, x1, y1, …].
const hullPts = [];
function hull(pts) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-12) lower.pop();
    lower.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-12) upper.pop();
    upper.push(p);
  }
  upper.pop(); lower.pop();
  const out = [];
  for (const p of lower.concat(upper)) out.push(p[0], p[1]);
  return out;
}

// Each block's shadow polygon at a pose: its rotated corners flattened along z,
// relative to the pivot (x right, y up, in cells).
export function projectBlocks(blocks, pivot, pose) {
  const m = poseMatrix(pose);
  const polys = [];
  for (const b of blocks) {
    const poly = SHAPES[b[4]];
    hullPts.length = 0;
    for (let dz = 0; dz <= 1; dz++) {
      for (const c of poly) {
        const x = b[0] + c[0] - pivot[0], y = b[1] + c[1] - pivot[1], z = b[2] + dz - pivot[2];
        hullPts.push([m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z]);
      }
    }
    polys.push(hull(hullPts));
  }
  return polys;
}

// Cell centers sit a hair off the grid so edges on whole cells never tie.
const EPS = 0.0137;

// A cell belongs to the shadow when its center is inside a polygon (GDD 3.7).
// Polygons are convex and CCW, as flat arrays relative to the pivot.
export function rasterize(polys, frame, out = new Uint8Array(frame.n * frame.n)) {
  const { n, R, cell } = frame;
  out.fill(0);
  for (const p of polys) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < p.length; i += 2) {
      minX = Math.min(minX, p[i]); maxX = Math.max(maxX, p[i]);
      minY = Math.min(minY, p[i + 1]); maxY = Math.max(maxY, p[i + 1]);
    }
    const i0 = Math.max(0, Math.floor((minX + R) / cell - 0.5 - EPS)), i1 = Math.min(n - 1, Math.ceil((maxX + R) / cell - 0.5 - EPS));
    const j0 = Math.max(0, Math.floor((R - maxY) / cell - 0.5 - EPS)), j1 = Math.min(n - 1, Math.ceil((R - minY) / cell - 0.5 - EPS));
    const len = p.length;
    for (let j = j0; j <= j1; j++) {
      const cy = R - (j + 0.5 + EPS) * cell;
      for (let i = i0; i <= i1; i++) {
        const idx = j * n + i;
        if (out[idx]) continue;
        const cx = -R + (i + 0.5 + EPS) * cell;
        let inside = true;
        for (let k = 0; k < len; k += 2) {
          const ax = p[k], ay = p[k + 1], bx = p[(k + 2) % len], by = p[(k + 3) % len];
          if ((bx - ax) * (cy - ay) - (by - ay) * (cx - ax) < 0) { inside = false; break; }
        }
        if (inside) out[idx] = 1;
      }
    }
  }
  return out;
}

export function shadowMask(blocks, frame, pose, out) {
  return rasterize(projectBlocks(blocks, frame.pivot, pose), frame, out);
}

export function area(mask) {
  let a = 0;
  for (let i = 0; i < mask.length; i++) a += mask[i];
  return a;
}

// Match value = IoU (GDD 3.7).
export function iou(a, b) {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) { inter += a[i] & b[i]; uni += a[i] | b[i]; }
  return uni ? inter / uni : 1;
}

// Match % (GDD 3.8): 0 at the level's median IoU, 100 at the snap threshold.
export function matchPct(value, base, match) {
  const k = (value - base) / Math.max(1e-6, match - base);
  return Math.max(0, Math.min(100, k * 100));
}

// ---- The picture -------------------------------------------------------------

// Picture cells in block coordinates (x from the left, y from the bottom up).
// Characters: '.' empty, a–f full cell in color 0–5, A–F half cell (wedge) whose
// right angle is given by cuts["col,row"] (picture coordinates, row 0 at the top).
export function parsePicture(picture, cuts = {}) {
  const H = picture.length, W = Math.max(...picture.map(r => r.length));
  const cells = [];
  picture.forEach((row, r) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const lower = ch.toLowerCase();
      const color = lower.charCodeAt(0) - 97;
      if (color < 0 || color > 5) throw new Error(`bad picture character "${ch}"`);
      let shape = 0;
      if (ch !== lower) {
        const cut = cuts[`${x},${r}`];
        if (!CUT_NAMES[cut]) throw new Error(`wedge at ${x},${r} needs a cut (tl, tr, bl, br)`);
        shape = CUT_NAMES[cut];
      }
      cells.push({ x, y: H - 1 - r, color, shape });
    }
  });
  return { W, H, cells };
}

// Front polygons of the picture cells relative to the pivot, as flat arrays.
export function picturePolys(cells, pivot) {
  return cells.map(c => {
    const out = [];
    for (const p of SHAPES[c.shape]) out.push(c.x + p[0] - pivot[0], c.y + p[1] - pivot[1]);
    return out;
  });
}

// The outline of the picture as closed loops of points (relative to the pivot):
// every cell edge that is not shared with a full neighbor side.
export function outlineLoops(cells, pivot) {
  const at = new Map(cells.map(c => [`${c.x},${c.y}`, c]));
  const OPP = { l: ['r', -1, 0], r: ['l', 1, 0], b: ['t', 0, -1], t: ['b', 0, 1] };
  const segs = [];
  for (const c of cells) {
    const poly = SHAPES[c.shape];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const side = edgeSide(a, b);
      if (side) {
        const [o, dx, dy] = OPP[side];
        const nb = at.get(`${c.x + dx},${c.y + dy}`);
        if (nb && sideFull(nb.shape, o)) continue;
      }
      segs.push([[c.x + a[0], c.y + a[1]], [c.x + b[0], c.y + b[1]]]);
    }
  }
  // Chain the segments into loops (they are all CCW around the filled area).
  const key = p => `${p[0]},${p[1]}`;
  const from = new Map();
  for (const s of segs) {
    const k = key(s[0]);
    if (!from.has(k)) from.set(k, []);
    from.get(k).push(s);
  }
  const used = new Set(), loops = [];
  for (const s of segs) {
    if (used.has(s)) continue;
    const loop = [s[0]];
    let cur = s;
    while (cur && !used.has(cur)) {
      used.add(cur);
      loop.push(cur[1]);
      const next = (from.get(key(cur[1])) || []).find(q => !used.has(q));
      cur = next;
    }
    loops.push(loop.map(p => [p[0] - pivot[0], p[1] - pivot[1]]));
  }
  return loops;
}
