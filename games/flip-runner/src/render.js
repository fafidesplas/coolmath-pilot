// Everything drawn in code (GDD 9). Long levels are pre-rendered in cached strips
// of 32 columns, so a frame never redraws the whole level.
import { T, ROWS, VIEW_W, COLORS as C, SPIKE_H, RUNNER } from './config.js';
import { TILE, tileAt, isSolid } from './level.js';
import { drawStarShape } from './fx.js';

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const STRIP = 32;

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function text(ctx, str, x, y, size, color = C.ink, align = 'center', weight = 800, outline = 0) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = outline;
    ctx.strokeStyle = C.ink;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ---- Tile strips -----------------------------------------------------------------

export class Strips {
  constructor(lv, colors, pixelScale) {
    this.lv = lv; this.colors = colors; this.scale = pixelScale;
    this.cache = new Map();
  }

  get(i) {
    let cv = this.cache.get(i);
    if (cv) { this.cache.delete(i); this.cache.set(i, cv); return cv; }
    cv = this.render(i);
    this.cache.set(i, cv);
    if (this.cache.size > 4) this.cache.delete(this.cache.keys().next().value);
    return cv;
  }

  draw(ctx, camX) {
    const first = Math.floor(camX / (STRIP * T)), last = Math.floor((camX + VIEW_W) / (STRIP * T));
    for (let i = first; i <= last; i++) {
      if (i * STRIP >= this.lv.cols) break;
      ctx.drawImage(this.get(i), i * STRIP * T - camX, 0, STRIP * T, ROWS * T);
    }
  }

  render(i) {
    const lv = this.lv, col = this.colors;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(STRIP * T * this.scale);
    cv.height = Math.ceil(ROWS * T * this.scale);
    const ctx = cv.getContext('2d');
    ctx.scale(this.scale, this.scale);
    ctx.translate(-i * STRIP * T, 0);
    const c0 = i * STRIP, c1 = Math.min(lv.cols, c0 + STRIP + 1);
    const solid = (x, y) => isSolid(lv, x, y);

    for (let y = 0; y < ROWS; y++) for (let x = c0 - 1; x < c1; x++) {
      const t = tileAt(lv, x, y), px = x * T, py = y * T;
      if (t === TILE.SOLID) {
        const floorMass = y >= 8;
        ctx.fillStyle = floorMass ? col.floor : col.ceiling;
        ctx.fillRect(px, py, T, T);
        if (!solid(x, y - 1)) { ctx.fillStyle = shade(floorMass ? col.floor : col.ceiling, 1.18); ctx.fillRect(px, py, T, 9); }
        if (!solid(x, y + 1)) {
          ctx.fillStyle = shade(floorMass ? col.floor : col.ceiling, 0.82); ctx.fillRect(px, py + T - 9, T, 9);
          ctx.fillStyle = C.ink;
          ctx.beginPath(); ctx.arc(px + 20, py + T - 4, 2.5, 0, 7); ctx.fill();
        }
        if ((x * 7 + y * 3) % 6 === 0) {
          ctx.fillStyle = shade(floorMass ? col.floor : col.ceiling, 0.9);
          ctx.fillRect(px + 10, py + 16, 20, 4);
        }
      } else if (t === TILE.SPIKE_UP || t === TILE.SPIKE_DOWN) {
        ctx.fillStyle = C.spike; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
        for (let k = 0; k < 3; k++) {
          const sx = px + 1 + k * 12.7;
          ctx.beginPath();
          if (t === TILE.SPIKE_UP) { ctx.moveTo(sx, py + T); ctx.lineTo(sx + 6.3, py + T - SPIKE_H); ctx.lineTo(sx + 12.7, py + T); }
          else { ctx.moveTo(sx, py); ctx.lineTo(sx + 6.3, py + SPIKE_H); ctx.lineTo(sx + 12.7, py); }
          ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
    }

    // Warning stripes on exposed vertical faces (walls and gap edges).
    for (let y = 0; y < ROWS; y++) for (let x = c0 - 1; x < c1; x++) {
      if (!solid(x, y)) continue;
      for (const side of [-1, 1]) {
        if (solid(x + side, y) || x + side < 0) continue;
        const fx = side < 0 ? x * T : x * T + T - 7;
        ctx.save();
        ctx.beginPath(); ctx.rect(fx, y * T, 7, T); ctx.clip();
        ctx.fillStyle = C.star; ctx.fillRect(fx, y * T, 7, T);
        ctx.fillStyle = C.ink;
        for (let k = -1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(fx, y * T + k * 14); ctx.lineTo(fx + 7, y * T + k * 14 - 7); ctx.lineTo(fx + 7, y * T + k * 14); ctx.lineTo(fx, y * T + k * 14 + 7); ctx.fill(); }
        ctx.restore();
      }
    }

    ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let y = 0; y < ROWS; y++) for (let x = c0 - 1; x < c1; x++) {
      if (!solid(x, y)) continue;
      const px = x * T, py = y * T;
      if (!solid(x, y - 1) && y > 0) { ctx.moveTo(px, py); ctx.lineTo(px + T, py); }
      if (!solid(x, y + 1) && y < ROWS - 1) { ctx.moveTo(px, py + T); ctx.lineTo(px + T, py + T); }
      if (!solid(x - 1, y) && x > 0) { ctx.moveTo(px, py); ctx.lineTo(px, py + T); }
      if (!solid(x + 1, y)) { ctx.moveTo(px + T, py); ctx.lineTo(px + T, py + T); }
    }
    ctx.stroke();
    return cv;
  }
}

// ---- Background (two parallax layers, pre-rendered once) -------------------------

export function renderBackdrop(colors, pixelScale) {
  const make = (alpha, seed, big) => {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(VIEW_W * pixelScale);
    cv.height = Math.ceil(ROWS * T * pixelScale);
    const ctx = cv.getContext('2d');
    ctx.scale(pixelScale, pixelScale);
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    ctx.fillStyle = shade(colors.bg, 0.9);
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 9; i++) {
      const w = big ? 120 + rnd() * 160 : 50 + rnd() * 80, h = big ? 200 + rnd() * 260 : 60 + rnd() * 120;
      const x = rnd() * VIEW_W, y = 60 + rnd() * (ROWS * T - h - 60);
      rrect(ctx, x, y, w, h, 18); ctx.fill();
      if (x + w > VIEW_W) { rrect(ctx, x - VIEW_W, y, w, h, 18); ctx.fill(); }
    }
    return cv;
  };
  return { far: make(0.5, 7, true), near: make(0.7, 31, false) };
}

export function drawBackdrop(ctx, bg, colors, camX) {
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, VIEW_W, ROWS * T);
  for (const [layer, k] of [[bg.far, 0.2], [bg.near, 0.45]]) {
    const off = -((camX * k) % VIEW_W);
    ctx.drawImage(layer, off, 0, VIEW_W, ROWS * T);
    ctx.drawImage(layer, off + VIEW_W, 0, VIEW_W, ROWS * T);
  }
}

// ---- Runner and scarf --------------------------------------------------------------

export class Scarf {
  constructor(n = 7, seg = 7) { this.n = n; this.seg = seg; this.p = []; }
  reset(x, y) { this.p = Array.from({ length: this.n }, (_, i) => ({ x: x - i * this.seg, y, ox: x - i * this.seg, oy: y })); }
  update(ax, ay, g, dt) {
    if (!this.p.length) this.reset(ax, ay);
    const p = this.p;
    p[0].x = ax; p[0].y = ay;
    for (let i = 1; i < p.length; i++) {
      const q = p[i];
      const vx = (q.x - q.ox) * 0.9, vy = (q.y - q.oy) * 0.9;
      q.ox = q.x; q.oy = q.y;
      q.x += vx - 30 * dt * 10;
      q.y += vy + g * 700 * dt * dt;
    }
    for (let k = 0; k < 3; k++) for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
      const f = (d - this.seg) / d;
      b.x -= dx * f; b.y -= dy * f;
    }
  }
  draw(ctx, offX) {
    if (!this.p.length) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, color] of [[11, C.ink], [6, C.scarf]]) {
      ctx.lineWidth = w; ctx.strokeStyle = color;
      ctx.beginPath();
      this.p.forEach((q, i) => (i ? ctx.lineTo(q.x - offX, q.y) : ctx.moveTo(q.x - offX, q.y)));
      ctx.stroke();
    }
  }
}

// x, y: center of the hitbox. flip: 1 upright … −1 upside down (tweened).
export function drawRunner(ctx, x, y, flip, opt = {}) {
  const sx = opt.sx ?? 1, sy = opt.sy ?? 1, t = opt.t ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy * (Math.abs(flip) < 0.15 ? 0.15 * Math.sign(flip || 1) : flip));
  const r = 18;
  // feet
  const run = opt.running ? Math.sin(t * 22) * 4 : 0;
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.ellipse(-6 + run, r - 1, 6, 3.5, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6 - run, r - 1, 6, 3.5, 0, 0, 7); ctx.fill();
  // body
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = opt.color || C.runner; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath(); ctx.ellipse(-7, -9, 6, 3.5, -0.5, 0, 7); ctx.fill();
  // eyes, looking ahead
  for (const ex of [3, 11]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(ex, -3, 5, opt.blink ? 1 : 6.5, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2; ctx.stroke();
    if (!opt.blink) { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(ex + 2, -3, 2.6, 0, 7); ctx.fill(); }
  }
  // determined brow
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(14, -9); ctx.stroke();
  ctx.restore();
}

export function drawFlag(ctx, x, surfaceY, g, active, t) {
  const top = surfaceY - g * 64;
  ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x, surfaceY); ctx.lineTo(x, top); ctx.stroke();
  const fy = active ? top : surfaceY - g * 24;
  const wave = Math.sin(t * 8) * 3;
  ctx.fillStyle = active ? C.star : '#C9CED8';
  ctx.beginPath();
  ctx.moveTo(x, fy); ctx.lineTo(x + 30, fy + g * (8 + wave)); ctx.lineTo(x, fy + g * 18);
  ctx.closePath(); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, top, 4, 0, 7); ctx.fill();
}

export function drawGoal(ctx, x, t) {
  // A striped arch across the whole corridor.
  const y0 = 2 * T, y1 = 13 * T, w = 28;
  for (const px of [x - w, x + 70]) {
    ctx.save();
    ctx.beginPath(); ctx.rect(px, y0, w, y1 - y0); ctx.clip();
    ctx.fillStyle = '#fff'; ctx.fillRect(px, y0, w, y1 - y0);
    ctx.fillStyle = C.scarf;
    for (let k = -2; k < 14; k++) { const yy = y0 + k * 40 + (t * 40) % 40; ctx.beginPath(); ctx.moveTo(px, yy); ctx.lineTo(px + w, yy - 20); ctx.lineTo(px + w, yy); ctx.lineTo(px, yy + 20); ctx.fill(); }
    ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.strokeRect(px, y0, w, y1 - y0);
  }
  rrect(ctx, x - w - 10, y0 - 40, 70 + 2 * w + 20, 50, 14);
  ctx.fillStyle = C.star; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
  text(ctx, 'GOAL', x + 35, y0 - 15, 26, C.ink, 'center', 900);
}

export function drawLevelStar(ctx, x, y, t, ghost) {
  const bob = Math.sin(t * 3 + x) * 3;
  if (ghost) {
    ctx.globalAlpha = 0.6;
    drawStarShape(ctx, x, y + bob, 15, C.star, Math.cos(t * 2.5 + y), true);
    ctx.globalAlpha = 1;
  } else drawStarShape(ctx, x, y + bob, 15, C.star, Math.cos(t * 2.5 + y));
}

export { RUNNER };
