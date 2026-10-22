// The deterministic runner world (GDD 3). No DOM: the same code runs in the
// browser, in tools/simtest.mjs and in the solver. All mutable state lives in
// one plain object so the solver can clone it cheaply.
import { T, ROWS, HZ, STEP, RUNNER, SPIKE_INSET, SPIKE_H, RESPAWN_STEPS, LAND_EVENT_SPEED, GLIDE } from './config.js';
import { parseLevel, tileAt, isSolid, TILE } from './level.js';

const EPS = 0.01;
const R = RUNNER;

function standingAt(col, row, g) {
  return { x: col * T + (T - R.w) / 2, y: g > 0 ? (row + 1) * T - R.h : row * T, g };
}

export function initialState(lv) {
  const st = lv.start;
  const p = standingAt(st.x, st.y, st.gravity);
  return {
    step: 0, x: p.x, y: p.y, vy: 0, g: p.g, speed: lv.speed,
    grounded: true, lastGround: 0, buffer: -99,
    dead: 0, done: false, deaths: 0, deathTypes: { spikes: 0, gap: 0, wall: 0 }, lastDeath: null,
    stars: lv.stars.map(() => 0),       // 0 free, 1 held (not banked yet), 2 banked
    flag: -1, flips: 0,
    form: 'flip', portal: -1, b2: null,     // b2: the second runner in twin form
    snap: null,
  };
}

const copyB2 = b => (b ? { ...b } : null);
function snapshot(s, x, y, g) {
  return { x, y, g, speed: s.speed, form: s.form, portal: s.portal, b2: copyB2(s.b2) };
}

export function cloneState(s) {
  return { ...s, deathTypes: { ...s.deathTypes }, stars: s.stars.slice(), b2: copyB2(s.b2), snap: s.snap && { ...s.snap, b2: copyB2(s.snap.b2) } };
}

function boxFree(lv, x, y) {
  for (let ty = Math.floor((y + EPS) / T); ty <= Math.floor((y + R.h - EPS) / T); ty++) {
    for (let tx = Math.floor((x + EPS) / T); tx <= Math.floor((x + R.w - EPS) / T); tx++) {
      if (isSolid(lv, tx, ty)) return false;
    }
  }
  return true;
}

// First solid column the runner's right edge would hit moving dx, or -1.
function wallAhead(lv, s, dx) {
  const edge = s.x + R.w, limit = edge + dx;
  const r0 = Math.floor((s.y + EPS) / T), r1 = Math.floor((s.y + R.h - EPS) / T);
  for (let c = Math.floor((edge - EPS) / T); c <= Math.floor(limit / T); c++) {
    if (c * T < edge - EPS || c * T >= limit) continue;
    for (let r = r0; r <= r1; r++) if (isSolid(lv, c, r)) return c;
  }
  return -1;
}

// Returns a death type, or null.
function moveX(lv, s, dx, emit) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const c = wallAhead(lv, s, dx);
    if (c < 0) { s.x += dx; return null; }

    // Solid rows of that column that overlap the runner.
    const r0 = Math.floor((s.y + EPS) / T), r1 = Math.floor((s.y + R.h - EPS) / T);
    let top = Infinity, bottom = -Infinity;
    for (let r = r0; r <= r1; r++) if (isSolid(lv, c, r)) { top = Math.min(top, r * T); bottom = Math.max(bottom, r * T + T); }

    // Corner forgiveness: clipping the very top or bottom of a wall nudges past it.
    if (s.y + R.h - top <= R.cornerForgive && boxFree(lv, s.x, top - R.h)) { s.y = top - R.h; continue; }
    if (bottom - s.y <= R.cornerForgive && boxFree(lv, s.x, bottom)) { s.y = bottom; continue; }

    // Auto-step: a 1-tile rise in the surface we stand on is climbed for free.
    if (s.grounded) {
      const ny = s.y - s.g * T;
      const feetRow = s.g > 0 ? Math.floor((s.y + R.h - EPS) / T) : Math.floor((s.y + EPS) / T);
      const above = feetRow - s.g;     // the row one tile further from the surface
      if (isSolid(lv, c, feetRow) && !isSolid(lv, c, above) && boxFree(lv, s.x, ny) && boxFree(lv, s.x + Math.min(dx, 4), ny)) {
        s.y = ny;
        if (emit) emit('step', { g: s.g });
        continue;
      }
    }
    // Stop at the wall, then die.
    s.x = c * T - R.w;
    return 'wall';
  }
  return 'wall';
}

// Returns true if it hit the surface gravity points at.
function moveY(lv, s, dy) {
  if (dy === 0) return false;
  const c0 = Math.floor((s.x + EPS) / T), c1 = Math.floor((s.x + R.w - EPS) / T);
  if (dy > 0) {
    const edge = s.y + R.h, limit = edge + dy;
    for (let r = Math.floor((edge - EPS) / T); r <= Math.floor(limit / T); r++) {
      if (r * T < edge - EPS || r * T >= limit) continue;
      for (let c = c0; c <= c1; c++) if (isSolid(lv, c, r)) { s.y = r * T - R.h; return true; }
    }
    s.y += dy;
  } else {
    const edge = s.y, limit = edge + dy;
    for (let r = Math.floor((edge + EPS) / T) - 1; r >= Math.floor(limit / T); r--) {
      if (r * T + T > edge + EPS || r * T + T <= limit) continue;
      for (let c = c0; c <= c1; c++) if (isSolid(lv, c, r)) { s.y = r * T + T; return true; }
    }
    s.y += dy;
  }
  return false;
}

function hazard(lv, s) {
  if (s.y > ROWS * T || s.y + R.h < 0) return 'gap';
  const x0 = s.x, x1 = s.x + R.w, y0 = s.y, y1 = s.y + R.h;
  for (let ty = Math.floor(y0 / T); ty <= Math.floor(y1 / T); ty++) {
    for (let tx = Math.floor(x0 / T); tx <= Math.floor(x1 / T); tx++) {
      const t = tileAt(lv, tx, ty);
      if (t !== TILE.SPIKE_UP && t !== TILE.SPIKE_DOWN) continue;
      const sx0 = tx * T + SPIKE_INSET, sx1 = tx * T + T - SPIKE_INSET;
      const sy0 = t === TILE.SPIKE_UP ? ty * T + T - SPIKE_H + SPIKE_INSET : ty * T;
      const sy1 = t === TILE.SPIKE_UP ? ty * T + T : ty * T + SPIKE_H - SPIKE_INSET;
      if (x1 > sx0 && x0 < sx1 && y1 > sy0 && y0 < sy1) return 'spikes';
    }
  }
  return null;
}

function bank(s, emit) {
  let n = 0;
  for (let i = 0; i < s.stars.length; i++) if (s.stars[i] === 1) { s.stars[i] = 2; n++; }
  if (n && emit) emit('bank', { n });
}

function die(s, b, type, emit) {
  s.dead = RESPAWN_STEPS;
  s.deaths++;
  s.deathTypes[type]++;
  s.lastDeath = type;
  for (let i = 0; i < s.stars.length; i++) if (s.stars[i] === 1) s.stars[i] = 0;   // unbanked stars go back
  if (emit) emit('death', { kind: type, x: b.x + R.w / 2, y: b.y + R.h / 2 });
}

// Twin form: the second runner appears in the lane the first one is NOT in,
// standing on the surface gravity points at.
function twinLane(s, lanes) {
  const row = (s.y + R.h / 2) / T;
  return Math.abs(row - lanes[0]) > Math.abs(row - lanes[1]) ? lanes[0] : lanes[1];
}

function spawnTwin(lv, s, lane) {
  const col = Math.floor((s.x + R.w / 2) / T);
  let r = lane;
  while (r > 0 && r < ROWS - 1 && !isSolid(lv, col, r + s.g)) r += s.g;
  const y = s.g > 0 ? (r + 1) * T - R.h : r * T;
  return { x: s.x, y, vy: 0, g: s.g, grounded: true, lastGround: s.step };
}

function setForm(lv, s, p, emit) {
  s.form = p.form;
  s.lane = p.form === 'twin' ? twinLane(s, p.lanes) : null;
  s.b2 = p.form === 'twin' ? spawnTwin(lv, s, s.lane) : null;
  if (emit) emit('form', { form: p.form });
}

// Vertical move for one body; returns true if it now stands on its surface.
function settle(lv, b, step, emit, who) {
  const wasGrounded = b.grounded;
  const vy = b.vy;
  const hit = moveY(lv, b, b.vy * STEP);
  b.grounded = hit && Math.sign(vy) === b.g;
  if (hit) b.vy = 0;
  if (b.grounded) {
    b.lastGround = step;
    if (!wasGrounded && Math.abs(vy) > LAND_EVENT_SPEED && emit) emit('land', { g: b.g, speed: Math.abs(vy), who });
  }
}

function fall(b) {
  b.vy += b.g * R.gravity * STEP;
  if (b.vy > R.maxVy) b.vy = R.maxVy;
  if (b.vy < -R.maxVy) b.vy = -R.maxVy;
}

function grabStars(lv, s, b, emit) {
  for (let i = 0; i < lv.stars.length; i++) {
    if (s.stars[i] !== 0) continue;
    const st = lv.stars[i];
    const nx = Math.max(b.x, Math.min(st.x, b.x + R.w)), ny = Math.max(b.y, Math.min(st.y, b.y + R.h));
    if ((nx - st.x) ** 2 + (ny - st.y) ** 2 < 16 * 16) {
      s.stars[i] = 1;
      if (emit) emit('star', { i, x: st.x, y: st.y });
    }
  }
}

// One 120 Hz step. bits: 1 = a press happened this step, 2 = the button is held.
export function advance(lv, s, bits, emit = null) {
  if (s.done) return;
  if (!s.snap) s.snap = snapshot(s, s.x, s.y, s.g);
  s.step++;
  if (s.dead > 0) {
    if (--s.dead === 0) {
      const p = s.snap;
      s.x = p.x; s.y = p.y; s.g = p.g; s.speed = p.speed; s.form = p.form; s.portal = p.portal; s.b2 = copyB2(p.b2);
      s.vy = 0; s.grounded = true; s.lastGround = s.step; s.buffer = -99;
      if (s.b2) { s.b2.lastGround = s.step; s.b2.vy = 0; }
      if (emit) emit('respawn', {});
    }
    return;
  }
  const press = (bits & 1) !== 0, held = (bits & 2) !== 0;
  const b2 = s.b2;

  if (s.form === 'glider') {
    // Hold to climb, release to dive, at a fixed angle. Surfaces can be slid along.
    s.g = held ? -1 : 1;
    s.vy = s.g * GLIDE * s.speed;
  } else {
    if (press) s.buffer = s.step;
    const can = b => b.grounded || s.step - b.lastGround <= R.coyoteSteps;
    // Twins flip together, and only when both have their feet down.
    if (s.step - s.buffer <= R.bufferSteps && can(s) && (!b2 || can(b2))) {
      s.g = -s.g;
      s.vy = s.g * R.kick;
      s.grounded = false; s.lastGround = -99; s.buffer = -99;
      if (b2) { b2.g = s.g; b2.vy = s.g * R.kick; b2.grounded = false; b2.lastGround = -99; }
      s.flips++;
      if (emit) emit('flip', { g: s.g, flips: s.flips });
    }
    fall(s);
    if (b2) fall(b2);
  }

  const dx = s.speed * STEP;
  const wall = moveX(lv, s, dx, emit);
  if (wall) { die(s, s, wall, emit); return; }
  if (b2) { const w2 = moveX(lv, b2, dx, emit); if (w2) { die(s, b2, w2, emit); return; } }

  settle(lv, s, s.step, emit, 0);
  if (b2) settle(lv, b2, s.step, emit, 1);

  const hz = hazard(lv, s);
  if (hz) { die(s, s, hz, emit); return; }
  if (b2) { const h2 = hazard(lv, b2); if (h2) { die(s, b2, h2, emit); return; } }

  grabStars(lv, s, s, emit);
  if (b2) grabStars(lv, s, b2, emit);

  const cx = s.x + R.w / 2;
  for (let i = s.portal + 1; i < lv.portals.length; i++) {
    if (cx < lv.portals[i].x) break;
    s.portal = i;
    setForm(lv, s, lv.portals[i], emit);
  }

  for (let i = s.flag + 1; i < lv.flags.length; i++) {
    const f = lv.flags[i];
    if (cx < f.x) break;
    s.flag = i;
    const g = isSolid(lv, Math.floor(f.x / T), f.ty + 1) ? 1 : -1;
    const p = standingAt(Math.floor(f.x / T), f.ty, g);
    s.snap = snapshot(s, p.x, p.y, g);
    if (s.b2) s.snap.b2 = spawnTwin(lv, { x: p.x, g, step: s.step }, s.lane);
    bank(s, emit);
    if (emit) emit('flag', { i, x: f.x });
  }

  if (s.x + R.w >= lv.goal) {
    s.done = true;
    bank(s, emit);
    if (emit) emit('goal', {});
  }
}

export const bankedCount = s => s.stars.reduce((n, v) => n + (v === 2 ? 1 : 0), 0);

// Convenience wrapper used by the game: owns the level and an event list.
export class Sim {
  constructor(data) {
    this.data = data;
    this.lv = parseLevel(data);
    this.s = initialState(this.lv);
    this.events = [];
    this.emit = (type, d) => this.events.push({ type, ...d });
  }
  get time() { return this.s.step / HZ; }
  // bits: 1 = a press this step (the input queues one press per step), 2 = held
  step(bits) {
    advance(this.lv, this.s, bits, this.emit);
  }
  forceWin() {
    if (this.s.done) return;
    this.s.done = true;
    bank(this.s, this.emit);
    this.emit('goal', {});
  }
}
