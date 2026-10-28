// Turns a level module (GDD 6, level data format) into what the sim, the pen and
// the renderer need: wall and cup polygons, static collision segments, and the
// blocked-area test. No DOM.
import { FIELD_W, FIELD_H, CUP, PEN, BALL } from './config.js';
import { pointInPoly, signedArea2 } from './geom.js';

// A cup is a U of 12 px walls (GDD 3.7); the backboard is part of its polygon.
export function cupPoly(c) {
  const W = CUP.wall, D = CUP.depth, L = c.x - c.w / 2, R = c.x + c.w / 2;
  const yl = c.y - (c.board && c.boardSide === 'left' ? c.board : 0);
  const yr = c.y - (c.board && c.boardSide !== 'left' ? c.board : 0);
  return [[L - W, yl], [L, yl], [L, c.y + D], [R, c.y + D], [R, yr], [R + W, yr], [R + W, c.y + D + W], [L - W, c.y + D + W]];
}

// Collision segments of a closed polygon. Endpoints that are convex corners can
// be rolled over as lips (GDD 3.3).
function polySegs(poly, kind, cup = -1) {
  const n = poly.length, cw = signedArea2(poly) > 0;
  const convex = poly.map((p, i) => {
    const a = poly[(i + n - 1) % n], b = poly[(i + 1) % n];
    const cr = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]);
    return cw ? cr > 0 : cr < 0;
  });
  const out = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    out.push(makeSeg(poly[i][0], poly[i][1], poly[j][0], poly[j][1], 0, kind, convex[i], convex[j], cup));
  }
  return out;
}

export function makeSeg(ax, ay, bx, by, r, kind, lipA, lipB, cup = -1) {
  const pad = r + BALL.r + 1;
  return {
    ax, ay, bx, by, r, kind, lipA, lipB, cup,
    minx: Math.min(ax, bx) - pad, maxx: Math.max(ax, bx) + pad,
    miny: Math.min(ay, by) - pad, maxy: Math.max(ay, by) + pad,
  };
}

export function parseLevel(data) {
  const need = ['id', 'name', 'ink', 'marks', 'balls', 'cups'];
  for (const k of need) if (data[k] === undefined) throw new Error(`${data.id || 'level'}: missing ${k}`);
  const lv = {
    id: data.id, name: data.name, gravity: data.gravity || 1, ink: data.ink, marks: data.marks,
    balls: data.balls.map(b => ({ x: b.x, y: b.y, vx: b.vx || 0, vy: b.vy || 0 })),
    cups: data.cups.map(c => ({ x: c.x, y: c.y, w: c.w || 104, board: c.board || 0, boardSide: c.boardSide || 'right' })),
    walls: data.walls || [],
    noInk: data.noInk || [],
    guide: data.guide || null,
    intro: data.intro || null,
    refs: data.refs || null,
    segs: [],
  };
  lv.cups.forEach((c, i) => { c.poly = cupPoly(c); lv.segs.push(...polySegs(c.poly, 'cup', i)); });
  for (const w of lv.walls) {
    if (w.length < 3) throw new Error(`${lv.id}: a wall needs 3 points`);
    lv.segs.push(...polySegs(w, 'wall'));
  }
  // Blocked rectangles for the pen: cups (walls and inside) and trapdoors.
  lv.cupBoxes = lv.cups.map(c => {
    const top = c.y - c.board;
    return [c.x - c.w / 2 - CUP.wall, top, c.x + c.w / 2 + CUP.wall, c.y + CUP.depth + CUP.wall];
  });
  return lv;
}

// Trapdoor hatch under a waiting ball (render and blocked test).
export const hatchRect = b => [b.x - 26, b.y + BALL.r + 2, b.x + 26, b.y + BALL.r + 12];

// GDD 3.4: where the pen cannot draw. Returns the kind of area, or null.
export function blockedAt(lv, x, y) {
  if (x < 0 || x > FIELD_W || y < 0 || y > FIELD_H) return 'edge';
  for (const b of lv.balls) {
    const dx = x - b.x, dy = y - b.y;
    if (dx * dx + dy * dy < PEN.ballClear * PEN.ballClear) return 'ball';
    const h = hatchRect(b);
    if (x >= h[0] && x <= h[2] && y >= h[1] - 4 && y <= h[3] + 4) return 'ball';
  }
  for (const r of lv.cupBoxes) if (x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3]) return 'cup';
  for (const w of lv.walls) if (pointInPoly(x, y, w)) return 'wall';
  for (const z of lv.noInk) if (pointInPoly(x, y, z)) return 'noink';
  return null;
}
