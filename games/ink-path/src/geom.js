// Small geometry helpers shared by the pen, the sim and the renderer.
// Only + − × ÷ and sqrt, so results are identical in every browser (GDD 3.2).

// Parameter (0..1) of the point on segment AB closest to P.
export function segT(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  if (l2 === 0) return 0;
  const t = ((px - ax) * dx + (py - ay) * dy) / l2;
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function distToSeg(px, py, ax, ay, bx, by) {
  const t = segT(px, py, ax, ay, bx, by);
  const qx = ax + (bx - ax) * t - px, qy = ay + (by - ay) * t - py;
  return Math.sqrt(qx * qx + qy * qy);
}

export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < xi + ((y - yi) * (xj - xi)) / (yj - yi)) inside = !inside;
  }
  return inside;
}

// Twice the signed area; > 0 means clockwise on screen (y down).
export function signedArea2(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]);
  return a;
}

export function polyLength(pts) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

// Ramer–Douglas–Peucker with distance to the segment (not the infinite line),
// so loops simplify correctly. Returns a new array.
export function rdp(pts, eps) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let best = -1, bi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = distToSeg(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]);
      if (d > best) { best = d; bi = i; }
    }
    if (best > eps) { keep[bi] = 1; stack.push([a, bi], [bi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// Simplify a drawn line the way release does (GDD 3.4): RDP, whole pixels,
// no repeated points.
export function simplifyStroke(pts, eps) {
  const out = [];
  for (const p of rdp(pts, eps)) {
    const q = [Math.round(p[0]), Math.round(p[1])];
    const l = out[out.length - 1];
    if (!l || l[0] !== q[0] || l[1] !== q[1]) out.push(q);
  }
  return out;
}
