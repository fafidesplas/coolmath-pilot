// Magnet fields (GDD 3.4): cones, line of sight, radial force, shield rule,
// fixed plates that move the robot instead.
import { T, MAGNET, COLS, ROWS } from './config.js';
import { TILE, tileAt } from './level.js';

const COS_HALF = Math.cos(MAGNET.halfAngle);

export function fieldOrigin(r) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function fieldDir(r) {
  if (r.aim === 'up') return { x: 0, y: -1 };
  if (r.aim === 'down') return { x: 0, y: 1 };
  return { x: r.facing, y: 0 };
}

export function strength(d) {
  if (d <= MAGNET.full) return 1;
  if (d >= MAGNET.range) return 0;
  return (MAGNET.range - d) / (MAGNET.range - MAGNET.full);
}

// Distance to (tx, ty) if it is inside the cone, else -1.
function coneDist(o, dir, tx, ty) {
  const vx = tx - o.x, vy = ty - o.y;
  const d = Math.hypot(vx, vy);
  if (d > MAGNET.range || d < 0.001) return -1;
  if ((vx * dir.x + vy * dir.y) / d < COS_HALF) return -1;
  return d;
}

// True if no plain solid tile sits between the two points (metal never blocks).
function clearLine(tiles, x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.ceil(d / 6);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (d * (1 - t) < 3) break;
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
    if (tileAt(tiles, Math.floor(x / T), Math.floor(y / T)) === TILE.SOLID) return false;
  }
  return true;
}

// Lenient sight: the center or any corner of the box is visible.
function canSeeBox(tiles, o, b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  if (clearLine(tiles, o.x, o.y, cx, cy)) return true;
  const i = 3;
  return clearLine(tiles, o.x, o.y, b.x + i, b.y + i)
    || clearLine(tiles, o.x, o.y, b.x + b.w - i, b.y + i)
    || clearLine(tiles, o.x, o.y, b.x + i, b.y + b.h - i)
    || clearLine(tiles, o.x, o.y, b.x + b.w - i, b.y + b.h - i);
}

function push(r, target, o, d) {
  const cx = target.x + target.w / 2, cy = target.y + target.h / 2;
  const a = MAGNET.accel * strength(d);
  const sign = r.pol === 'plus' ? -1 : 1;    // plus pulls towards itself
  target.ax += sign * (cx - o.x) / d * a;
  target.ay += sign * (cy - o.y) / d * a;
  target.inField = true;
}

// Sets ax/ay on every affected body and marks touched lock plates.
export function applyFields(w) {
  for (const b of w.bodies) { b.ax = 0; b.ay = 0; b.inField = false; }
  for (const p of w.plates) p.touched = false;

  for (const r of w.robots) {
    r.hits.length = 0;
    if (!r.power) continue;
    const o = fieldOrigin(r), dir = fieldDir(r);

    for (const b of w.bodies) {
      if (b === r) continue;
      if (b.kind === 'robot' && b.power) continue;   // shield rule
      const d = coneDist(o, dir, b.x + b.w / 2, b.y + b.h / 2);
      if (d < 0 || !canSeeBox(w.tiles, o, b)) continue;
      push(r, b, o, d);
      r.hits.push(b.x + b.w / 2, b.y + b.h / 2);
    }

    for (const p of w.plates) {
      if (p.gate.lock !== 'any' && p.gate.lock !== r.pol) continue;
      const d = coneDist(o, dir, p.x, p.y);
      if (d < 0 || !clearLine(w.tiles, o.x, o.y, p.x, p.y)) continue;
      p.touched = true;
      r.hits.push(p.x, p.y);
    }

    // Fixed metal plates: the nearest one in the cone moves the robot instead.
    let best = -1, bx = 0, by = 0;
    const tx0 = Math.max(0, Math.floor((o.x - MAGNET.range) / T)), tx1 = Math.min(COLS - 1, Math.floor((o.x + MAGNET.range) / T));
    const ty0 = Math.max(0, Math.floor((o.y - MAGNET.range) / T)), ty1 = Math.min(ROWS - 1, Math.floor((o.y + MAGNET.range) / T));
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (tileAt(w.tiles, tx, ty) !== TILE.METAL) continue;
        const cx = (tx + 0.5) * T, cy = (ty + 0.5) * T;
        const d = coneDist(o, dir, cx, cy);
        if (d < 0 || (best >= 0 && d >= best)) continue;
        if (!clearLine(w.tiles, o.x, o.y, cx, cy)) continue;
        best = d; bx = cx; by = cy;
      }
    }
    if (best >= 0) {
      const a = MAGNET.accel * strength(best);
      const sign = r.pol === 'plus' ? 1 : -1;   // plus goes to the plate, minus away
      r.ax += sign * (bx - o.x) / best * a;
      r.ay += sign * (by - o.y) / best * a;
      r.inField = true;
      r.hits.push(bx, by);
    }
  }
}
