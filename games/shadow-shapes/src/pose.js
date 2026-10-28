// The three dials (GDD 3.3–3.6). Pure: no DOM, used by the game and the tools.
// World frame: x right on the wall, y up, z from the wall towards the light.
// Orientation = Spin · Tip · Turn (Turn first): Turn about the object's up axis,
// Tip about the world x axis (positive tips the front down), Spin about the light
// axis (positive turns the shadow counterclockwise).
export const DEG = Math.PI / 180;
export const AXES = ['turn', 'tip', 'spin'];

// Angle in (−180, 180].
export function wrap(a) {
  let r = ((a + 180) % 360 + 360) % 360 - 180;
  if (r <= -180) r += 360;
  return Math.abs(r) < 1e-9 ? 0 : r;
}

export const wrapPose = p => [wrap(p[0]), wrap(p[1]), wrap(p[2])];

// Row-major 3×3 rotation matrix for a pose [turn, tip, spin] in degrees.
export function matrix(turn, tip, spin, out = new Float64Array(9)) {
  const a = turn * DEG, b = tip * DEG, g = spin * DEG;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
  // Rx(tip) · Ry(turn)
  const m00 = ca, m01 = 0, m02 = sa;
  const m10 = sb * sa, m11 = cb, m12 = -sb * ca;
  const m20 = -cb * sa, m21 = sb, m22 = cb * ca;
  // Rz(spin) · that
  out[0] = cg * m00 - sg * m10; out[1] = cg * m01 - sg * m11; out[2] = cg * m02 - sg * m12;
  out[3] = sg * m00 + cg * m10; out[4] = sg * m01 + cg * m11; out[5] = sg * m02 + cg * m12;
  out[6] = m20; out[7] = m21; out[8] = m22;
  return out;
}

export const poseMatrix = (p, out) => matrix(p[0], p[1], p[2], out);

export function apply(m, x, y, z) {
  return [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z];
}

// Rotation angle (degrees) between two poses: the angle of Ma^T · Mb.
export function rotationAngle(pa, pb) {
  const a = poseMatrix(pa), b = poseMatrix(pb);
  let tr = 0;
  for (let i = 0; i < 3; i++) for (let k = 0; k < 3; k++) tr += a[k * 3 + i] * b[k * 3 + i];
  return Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) / DEG;
}

// Keyboard (GDD 3.6): the next multiple of 15° in that direction (37 → 45).
// Returns an unwrapped value so the dial eases the short way.
export function keyStep(value, dir, step = 15) {
  return dir > 0 ? Math.floor(value / step + 1e-6) * step + step : Math.ceil(value / step - 1e-6) * step - step;
}

// Spin always rests on 15° notches (GDD 3.4).
export const spinStop = (v, step = 15) => wrap(Math.round(v / step) * step);

// Nearest solution by rotation angle (ties: smallest dial distance). Returns the
// target pose unwrapped from `pose`, so each dial eases the short way round.
export function nearestSolution(pose, solutions) {
  let best = null, bestA = Infinity, bestD = Infinity;
  for (const s of solutions) {
    const a = rotationAngle(pose, s);
    const d = Math.abs(wrap(s[0] - pose[0])) + Math.abs(wrap(s[1] - pose[1])) + Math.abs(wrap(s[2] - pose[2]));
    if (a < bestA - 1e-6 || (Math.abs(a - bestA) <= 1e-6 && d < bestD)) { best = s; bestA = a; bestD = d; }
  }
  return {
    solution: best,
    angle: bestA,
    target: [0, 1, 2].map(i => pose[i] + wrap(best[i] - pose[i])),
  };
}

// Screen directions (y down) of a drag that drives Turn and Tip (GDD 3.4, 3.5).
// With Spin at 0: right = +Turn, down = +Tip. Upside down (|Tip| > 90°) Turn is
// flipped so the front follows the pointer.
export function dragDirs(pose) {
  const g = pose[2] * DEG, c = Math.cos(g), s = Math.sin(g);
  const flip = Math.abs(wrap(pose[1])) > 90 ? -1 : 1;
  // Spin turns the picture counterclockwise on screen (y down: (x, y) → (x c + y s, −x s + y c)).
  return {
    turn: [flip * c, -flip * s],
    tip: [s, c],
    flip,
  };
}

// The axis whose arrow best matches the drag (dx, dy in CSS px).
export function pickAxis(dx, dy, dirs) {
  const t = Math.abs(dx * dirs.turn[0] + dy * dirs.turn[1]);
  const p = Math.abs(dx * dirs.tip[0] + dy * dirs.tip[1]);
  return t >= p ? 'turn' : 'tip';
}
