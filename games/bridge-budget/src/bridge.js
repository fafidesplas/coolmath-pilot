// The editable bridge (GDD 3.4): members on grid nodes, joints derived from them,
// validation (reach, terrain, zones, overlap), auto-split, replace-on-redraw,
// costs, undo/redo. Integer grid coordinates, so the checks are exact. No DOM.
import { MATERIALS, BUILD } from './config.js';

export const pieceLen = (x1, y1, x2, y2) => Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
export const pieceCost = (mat, x1, y1, x2, y2) => Math.round(MATERIALS[mat].cost * pieceLen(x1, y1, x2, y2) / 10) * 10;
export const nodeKey = (x, y) => x + ',' + y;
export const pairKey = (x1, y1, x2, y2) => (x1 < x2 || (x1 === x2 && y1 <= y2)) ? `${x1},${y1}|${x2},${y2}` : `${x2},${y2}|${x1},${y1}`;

// Point strictly inside a polygon (on the boundary counts as outside).
export function insidePoly(poly, x, y) {
  if (onPolyEdge(poly, x, y)) return false;
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export function onPolyEdge(poly, x, y) {
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i];
    const cr = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(cr) > 1e-9) continue;
    const d = (x - ax) * (bx - ax) + (y - ay) * (by - ay), l2 = (bx - ax) ** 2 + (by - ay) ** 2;
    if (d >= -1e-9 && d <= l2 + 1e-9) return true;
  }
  return false;
}

const inRect = (r, x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const inRectOpen = (r, x, y) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;

export function distToSeg(px, py, ax, ay, bx, by) {
  const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
  let t = l2 ? ((px - ax) * ex + (py - ay) * ey) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (ax + ex * t), dy = py - (ay + ey * t);
  return Math.sqrt(dx * dx + dy * dy);
}

export class Bridge {
  constructor(lv) {
    this.lv = lv;
    this.anchors = new Set(lv.anchors.map(([x, y]) => nodeKey(x, y)));
    this.members = [];      // { x1, y1, x2, y2, mat, locked }
    this.undoStack = [];
    this.redoStack = [];
    for (const p of lv.prebuilt) this.members.push({ x1: p[0], y1: p[1], x2: p[2], y2: p[3], mat: p[4], locked: !!p[5] });
    this.version = 0;       // bumps on every change (autosave, stress view)
  }

  // ---- queries

  joints() {
    const map = new Map();
    for (const [x, y] of this.lv.anchors) map.set(nodeKey(x, y), { x, y, anchor: true });
    for (const m of this.members) {
      for (const [x, y] of [[m.x1, m.y1], [m.x2, m.y2]]) {
        const k = nodeKey(x, y);
        if (!map.has(k)) map.set(k, { x, y, anchor: false });
      }
    }
    return map;
  }

  isJoint(x, y) { return this.joints().has(nodeKey(x, y)); }

  cost() { let c = 0; for (const m of this.members) if (!m.locked) c += pieceCost(m.mat, m.x1, m.y1, m.x2, m.y2); return c; }

  serialize() { return this.members.filter(m => !m.locked).map(m => [m.x1, m.y1, m.x2, m.y2, m.mat]); }

  // Members as the sim wants them (prebuilt locked ones included).
  simMembers() { return this.members.map(m => [m.x1, m.y1, m.x2, m.y2, m.mat]); }

  findPair(x1, y1, x2, y2) {
    const k = pairKey(x1, y1, x2, y2);
    return this.members.findIndex(m => pairKey(m.x1, m.y1, m.x2, m.y2) === k);
  }

  meters() {
    const out = {};
    for (const m of this.members) if (!m.locked) out[m.mat] = (out[m.mat] || 0) + pieceLen(m.x1, m.y1, m.x2, m.y2);
    return out;
  }

  // Is a grid node a legal joint position (GDD 3.4)?
  nodeProblem(x, y) {
    const lv = this.lv;
    if (this.anchors.has(nodeKey(x, y))) return null;
    if (!inRect(lv.buildArea, x, y)) return 'Out of area';
    for (const p of lv.terrain) if (insidePoly(p, x, y) || onPolyEdge(p, x, y)) return 'Ground';
    for (const z of lv.noBuild) if (inRect(z, x, y)) return 'No build';
    return null;
  }

  segProblem(x1, y1, x2, y2) {
    const lv = this.lv, len = pieceLen(x1, y1, x2, y2), n = Math.max(2, Math.ceil(len * 10));
    for (let k = 1; k < n; k++) {
      const x = x1 + (x2 - x1) * k / n, y = y1 + (y2 - y1) * k / n;
      for (const p of lv.terrain) if (insidePoly(p, x, y)) return 'Ground';
      for (const z of lv.noBuild) if (inRectOpen(z, x, y)) return 'No build';
    }
    return null;
  }

  // Nearest legal-length node to a pointer position (max length is a clamp, never an error).
  snapEnd(sx, sy, px, py, mat) {
    const max = MATERIALS[mat].max;
    let gx = Math.round(px), gy = Math.round(py);
    if (pieceLen(sx, sy, gx, gy) <= max + 1e-9) return [gx, gy];
    let best = null, bd = Infinity;
    const r = Math.ceil(max);
    for (let x = sx - r; x <= sx + r; x++) for (let y = sy - r; y <= sy + r; y++) {
      if (pieceLen(sx, sy, x, y) > max + 1e-9 || (x === sx && y === sy)) continue;
      const d = (x - px) * (x - px) + (y - py) * (y - py);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best || [sx, sy];
  }

  // What drawing start → end with a material would do. Never changes the bridge.
  plan(x1, y1, x2, y2, mat) {
    const res = { ok: false, reason: null, pieces: [], replaced: [], delta: 0, rings: [], x1, y1, x2, y2, mat, label: '' };
    if (x1 === x2 && y1 === y2) { res.reason = 'none'; return res; }
    if (pieceLen(x1, y1, x2, y2) > MATERIALS[mat].max + 1e-9) { res.reason = 'Too long'; return res; }
    const endP = this.nodeProblem(x2, y2);
    if (endP) { res.reason = endP; return res; }
    const segP = this.segProblem(x1, y1, x2, y2);
    if (segP) { res.reason = segP; return res; }
    // auto-split at joints lying exactly on the segment
    const joints = this.joints();
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
    const cuts = [];
    for (const j of joints.values()) {
      if ((j.x === x1 && j.y === y1) || (j.x === x2 && j.y === y2)) continue;
      if (dx * (j.y - y1) - dy * (j.x - x1) !== 0) continue;
      const d = (j.x - x1) * dx + (j.y - y1) * dy;
      if (d > 0 && d < l2) cuts.push([d, j.x, j.y]);
    }
    cuts.sort((a, b) => a[0] - b[0]);
    const pts = [[x1, y1], ...cuts.map(c => [c[1], c[2]]), [x2, y2]];
    for (const [x, y] of pts) if (joints.has(nodeKey(x, y))) res.rings.push([x, y]);
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const idx = this.findPair(ax, ay, bx, by);
      if (idx >= 0) {
        const m = this.members[idx];
        if (m.locked) { res.reason = 'Locked'; return res; }
        if (m.mat === 'road' && mat !== 'road') { res.reason = 'Road here'; return res; }
        if (m.mat === mat) continue;                 // already there
        res.replaced.push(idx);
        res.delta -= pieceCost(m.mat, ax, ay, bx, by);
      } else if (this.overlaps(ax, ay, bx, by)) { res.reason = 'Overlap'; return res; }
      res.pieces.push({ x1: ax, y1: ay, x2: bx, y2: by, mat });
      res.delta += pieceCost(mat, ax, ay, bx, by);
    }
    if (!res.pieces.length) { res.reason = 'Already built'; return res; }
    // caps
    const newJoints = joints.has(nodeKey(x2, y2)) ? 0 : 1;
    const nonAnchor = [...joints.values()].filter(j => !j.anchor).length;
    if (this.members.length - res.replaced.length + res.pieces.length > BUILD.maxMembers || nonAnchor + newJoints > BUILD.maxJoints) { res.reason = 'Max pieces'; return res; }
    res.ok = true;
    res.newJoint = newJoints ? [x2, y2] : null;
    const upgrade = res.replaced.length > 0;
    res.label = upgrade ? (res.delta >= 0 ? `Upgrade +$${res.delta}` : `Swap −$${-res.delta}`) : `+$${res.delta}`;
    return res;
  }

  // Lies along an existing member, sharing more than a point.
  overlaps(ax, ay, bx, by) {
    for (const m of this.members) {
      const dx = m.x2 - m.x1, dy = m.y2 - m.y1;
      if (dx * (ay - m.y1) - dy * (ax - m.x1) !== 0 || dx * (by - m.y1) - dy * (bx - m.x1) !== 0) continue;
      const l2 = dx * dx + dy * dy;
      const ta = (ax - m.x1) * dx + (ay - m.y1) * dy, tb = (bx - m.x1) * dx + (by - m.y1) * dy;
      const lo = Math.max(0, Math.min(ta, tb)), hi = Math.min(l2, Math.max(ta, tb));
      if (hi > lo) return true;
    }
    return false;
  }

  mirrorOf(x1, y1, x2, y2) { const k = this.lv.mirrorX2; return [k - x1, y1, k - x2, y2]; }

  // ---- changes (each is one undo step)

  snapshot() { return this.members.map(m => ({ ...m })); }

  pushUndo() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 500) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  changed() { this.version++; }

  // Apply one or more plans (a mirrored pair) as one step.
  apply(plans) {
    const list = plans.filter(p => p && p.ok);
    if (!list.length) return false;
    this.pushUndo();
    const gone = new Set();
    for (const p of list) for (const i of p.replaced) gone.add(this.members[i]);
    this.members = this.members.filter(m => !gone.has(m));
    for (const p of list) {
      for (const q of p.pieces) {
        if (this.findPair(q.x1, q.y1, q.x2, q.y2) >= 0) continue;
        this.members.push({ ...q, locked: false });
      }
    }
    this.changed();
    return true;
  }

  // Indices of members a pointer at (x, y) hits (eraser).
  memberAt(x, y, r = BUILD.eraseDist) {
    let best = -1, bd = r;
    this.members.forEach((m, i) => {
      if (m.locked) return;
      const d = distToSeg(x, y, m.x1, m.y1, m.x2, m.y2);
      if (d <= bd) { bd = d; best = i; }
    });
    return best;
  }

  jointAt(x, y, r) {
    let best = null, bd = r;
    for (const j of this.joints().values()) {
      const d = pieceLen(x, y, j.x, j.y);
      if (d <= bd) { bd = d; best = j; }
    }
    return best;
  }

  erase(indices, pushUndo = true) {
    const set = [...new Set(indices)].filter(i => i >= 0 && this.members[i] && !this.members[i].locked);
    if (!set.length) return [];
    if (pushUndo) this.pushUndo();
    const removed = set.map(i => this.members[i]);
    this.members = this.members.filter((m, i) => !set.includes(i));
    this.changed();
    return removed;
  }

  membersOfJoint(x, y) {
    const out = [];
    this.members.forEach((m, i) => { if (!m.locked && ((m.x1 === x && m.y1 === y) || (m.x2 === x && m.y2 === y))) out.push(i); });
    return out;
  }

  clear() {
    if (!this.members.some(m => !m.locked)) return false;
    this.pushUndo();
    this.members = this.members.filter(m => m.locked);
    this.changed();
    return true;
  }

  load(list, pushUndo = true) {
    if (pushUndo) this.pushUndo();
    this.members = this.members.filter(m => m.locked);
    for (const q of list || []) {
      if (!Array.isArray(q) || q.length < 5 || !MATERIALS[q[4]]) continue;
      const [x1, y1, x2, y2, mat] = q;
      if (![x1, y1, x2, y2].every(Number.isInteger)) continue;
      if (this.findPair(x1, y1, x2, y2) >= 0) continue;
      this.members.push({ x1, y1, x2, y2, mat, locked: false });
    }
    this.changed();
  }

  undo() {
    if (!this.undoStack.length) return false;
    this.redoStack.push(this.snapshot());
    this.members = this.undoStack.pop();
    this.changed();
    return true;
  }

  redo() {
    if (!this.redoStack.length) return false;
    this.undoStack.push(this.snapshot());
    this.members = this.redoStack.pop();
    this.changed();
    return true;
  }
}
