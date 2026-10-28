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

    const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
    for (let y = 0; y < ROWS; y++) for (let x = c0 - 1; x < c1; x++) {
      const t = tileAt(lv, x, y), px = x * T, py = y * T;
      if (t === TILE.SOLID) {
        const floorMass = y >= 8, base = floorMass ? col.floor : col.ceiling;
        ctx.fillStyle = base;
        ctx.fillRect(px, py, T, T);
        // rock facets
        const h = hash(x, y);
        ctx.fillStyle = shade(base, 0.86);
        ctx.beginPath(); ctx.moveTo(px + (h % 20), py + T); ctx.lineTo(px + 12 + (h % 17), py + 14 + (h % 9)); ctx.lineTo(px + T, py + 26 + (h % 11)); ctx.lineTo(px + T, py + T); ctx.fill();
        if (!solid(x, y - 1)) { ctx.fillStyle = shade(base, 1.25); ctx.fillRect(px, py, T, 8); }
        if (!solid(x, y + 1)) {
          // underside: a lip and a little hanging stalactite now and then
          ctx.fillStyle = shade(base, 0.78); ctx.fillRect(px, py + T - 8, T, 8);
          if (h % 3 === 0 && !solid(x, y + 2) && y < ROWS - 2) {
            ctx.fillStyle = shade(base, 0.92);
            ctx.beginPath(); ctx.moveTo(px + 8, py + T); ctx.lineTo(px + 15, py + T + 12 + (h % 8)); ctx.lineTo(px + 22, py + T); ctx.fill();
          }
        }
        // glowing crystal vein
        if (h % 7 === 0) {
          ctx.fillStyle = col.accent; ctx.globalAlpha = 0.55;
          ctx.beginPath(); ctx.moveTo(px + 10, py + 30); ctx.lineTo(px + 16, py + 14); ctx.lineTo(px + 22, py + 30); ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else if (t === TILE.SPIKE_UP || t === TILE.SPIKE_DOWN) {
        // crystal shards (spikes): faceted, with a bright edge
        ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
        for (let k = 0; k < 3; k++) {
          const sx = px + 1 + k * 12.7, hgt = SPIKE_H - (k === 1 ? 0 : 3);
          const tipY = t === TILE.SPIKE_UP ? py + T - hgt : py + hgt, baseY = t === TILE.SPIKE_UP ? py + T : py;
          ctx.fillStyle = col.spike;
          ctx.beginPath(); ctx.moveTo(sx, baseY); ctx.lineTo(sx + 6.3, tipY); ctx.lineTo(sx + 12.7, baseY); ctx.closePath(); ctx.fill();
          ctx.fillStyle = shade(col.spike, 0.75);
          ctx.beginPath(); ctx.moveTo(sx + 6.3, tipY); ctx.lineTo(sx + 12.7, baseY); ctx.lineTo(sx + 6.3, baseY); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.moveTo(sx, baseY); ctx.lineTo(sx + 6.3, tipY); ctx.lineTo(sx + 12.7, baseY); ctx.closePath(); ctx.stroke();
        }
      }
    }

    // Glowing edges on exposed vertical faces (walls and gap edges): a dashed crystal line.
    for (let y = 0; y < ROWS; y++) for (let x = c0 - 1; x < c1; x++) {
      if (!solid(x, y)) continue;
      for (const side of [-1, 1]) {
        if (solid(x + side, y) || x + side < 0) continue;
        const fx = side < 0 ? x * T + 2 : x * T + T - 7;
        ctx.fillStyle = col.accent;
        for (let k = 0; k < 3; k++) ctx.fillRect(fx, y * T + 3 + k * 13, 5, 8);
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

// ---- Background (sky gradient plus two silhouette layers, pre-rendered once) ----

function silhouette(ctx, kind, rnd, color, big) {
  const H = ROWS * T;
  ctx.fillStyle = color;
  if (kind === 'cave' || kind === 'forest') {
    // stalactites / hanging roots from the top, stalagmites / trees from the bottom
    for (let i = 0; i < (big ? 10 : 16); i++) {
      const x = rnd() * VIEW_W, w = big ? 60 + rnd() * 90 : 24 + rnd() * 40, h = big ? 120 + rnd() * 200 : 50 + rnd() * 110;
      const top = rnd() < 0.5;
      for (const ox of [0, -VIEW_W, VIEW_W]) {
        ctx.beginPath();
        if (kind === 'forest' && !top) {
          ctx.moveTo(x + ox - w / 2, H); ctx.lineTo(x + ox - w * 0.1, H - h * 0.4);
          ctx.arc(x + ox, H - h * 0.7, w * 0.6, Math.PI * 0.9, Math.PI * 2.1); ctx.lineTo(x + ox + w / 2, H);
        } else if (top) { ctx.moveTo(x + ox - w / 2, 0); ctx.lineTo(x + ox, h); ctx.lineTo(x + ox + w / 2, 0); }
        else { ctx.moveTo(x + ox - w / 2, H); ctx.lineTo(x + ox, H - h); ctx.lineTo(x + ox + w / 2, H); }
        ctx.fill();
      }
    }
  } else if (kind === 'tower') {
    // arched windows and hanging bells
    for (let i = 0; i < (big ? 5 : 8); i++) {
      const x = (i + rnd() * 0.5) * VIEW_W / (big ? 5 : 8), w = big ? 110 : 50, top = big ? 120 + rnd() * 80 : 60 + rnd() * 200;
      if (big) { rrect(ctx, x, top, w, H - top + 40, w / 2); ctx.fill(); }
      else { ctx.fillRect(x - 2, 0, 4, top); ctx.beginPath(); ctx.arc(x, top + 20, 22, Math.PI, 0); ctx.lineTo(x + 26, top + 40); ctx.lineTo(x - 26, top + 40); ctx.fill(); }
    }
  } else {
    // fair: a ferris wheel and tents
    if (big) {
      const cx = VIEW_W * 0.65, cy = H * 0.45, r = 210;
      ctx.lineWidth = 10; ctx.strokeStyle = color;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 16, 0, 7); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(cx - 120, H); ctx.lineTo(cx, cy); ctx.lineTo(cx + 120, H); ctx.stroke();
    } else {
      for (let i = 0; i < 5; i++) { const x = rnd() * VIEW_W, w = 120 + rnd() * 80, h = 90 + rnd() * 60; ctx.beginPath(); ctx.moveTo(x - w / 2, H); ctx.lineTo(x - w / 2, H - h * 0.5); ctx.lineTo(x, H - h); ctx.lineTo(x + w / 2, H - h * 0.5); ctx.lineTo(x + w / 2, H); ctx.fill(); }
    }
  }
}

export function renderBackdrop(colors, pixelScale) {
  const make = (alpha, seed, big) => {
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(VIEW_W * pixelScale);
    cv.height = Math.ceil(ROWS * T * pixelScale);
    const ctx = cv.getContext('2d');
    ctx.scale(pixelScale, pixelScale);
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    ctx.globalAlpha = alpha;
    silhouette(ctx, colors.kind, rnd, shade(colors.bg, big ? 0.7 : 0.55), big);
    if (!big) {
      // little glowing crystals / fireflies / lanterns stuck in the near layer
      ctx.globalAlpha = 0.8;
      for (let i = 0; i < 14; i++) {
        const x = rnd() * VIEW_W, y = 40 + rnd() * (ROWS * T - 80);
        ctx.fillStyle = colors.accent;
        ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 9); ctx.lineTo(x - 5, y); ctx.fill();
      }
    }
    return cv;
  };
  // The sky gradient is pre-rendered too, so no full-screen gradient is redrawn per frame.
  const sky = document.createElement('canvas');
  sky.width = 4; sky.height = Math.ceil(ROWS * T * pixelScale);
  const sc = sky.getContext('2d');
  const g = sc.createLinearGradient(0, 0, 0, sky.height);
  g.addColorStop(0, colors.bg); g.addColorStop(1, colors.bg2);
  sc.fillStyle = g; sc.fillRect(0, 0, 4, sky.height);
  return { sky, far: make(1, 7, true), near: make(1, 31, false) };
}

export function drawBackdrop(ctx, bg, colors, camX, t, speed) {
  ctx.drawImage(bg.sky, 0, 0, VIEW_W, ROWS * T);
  // the moon, far away (barely moves)
  const mx = 980 - (camX * 0.02) % 200, my = 120;
  ctx.fillStyle = C.moon; ctx.globalAlpha = 0.18;
  ctx.beginPath(); ctx.arc(mx, my, 90, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.9;
  ctx.beginPath(); ctx.arc(mx, my, 54, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  for (const [layer, k] of [[bg.far, 0.2], [bg.near, 0.45]]) {
    const off = -((camX * k) % VIEW_W);
    ctx.drawImage(layer, off, 0, VIEW_W, ROWS * T);
    ctx.drawImage(layer, off + VIEW_W, 0, VIEW_W, ROWS * T);
  }
  // Drifting motes of light (crystal dust, fireflies), faster than the world: the speed feel
  ctx.fillStyle = colors.accent;
  for (let i = 0; i < 22; i++) {
    const h1 = ((i * 7919) % 1000) / 1000, h2 = ((i * 104729) % 1000) / 1000;
    const span = VIEW_W + 300;
    const x = VIEW_W + 100 - ((t * speed * (0.9 + h2) + h2 * span * 3) % span);
    const y = 40 + h1 * (ROWS * T - 80) + Math.sin(t * 2 + i) * 10;
    const len = 6 + h2 * 30;
    ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(t * 3 + i * 1.3));
    rrect(ctx, x, y - 1.5, len, 3, 1.5); ctx.fill();
  }
  ctx.globalAlpha = 1;
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
  draw(ctx, offX, scarfColor = C.scarf) {
    if (!this.p.length) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, color] of [[11, C.ink], [6, scarfColor]]) {
      ctx.lineWidth = w; ctx.strokeStyle = color;
      ctx.beginPath();
      this.p.forEach((q, i) => (i ? ctx.lineTo(q.x - offX, q.y) : ctx.moveTo(q.x - offX, q.y)));
      ctx.stroke();
    }
  }
}

function batEars(ctx, color) {
  for (const ex of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(ex * 4, -15); ctx.lineTo(ex * 13, -30); ctx.lineTo(ex * 15, -11); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex * 7, -16); ctx.lineTo(ex * 12, -25); ctx.lineTo(ex * 12.5, -14); ctx.closePath();
    ctx.fillStyle = C.ear; ctx.fill();
  }
}

function batFace(ctx, blink) {
  for (const ex of [1, 10]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(ex, -2, 5.5, blink ? 1 : 7, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
    if (!blink) {
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(ex + 2, -2, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 3, -4, 1.1, 0, 7); ctx.fill();
    }
  }
  // tiny fangs
  ctx.fillStyle = '#fff'; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
  for (const fx of [4, 8]) { ctx.beginPath(); ctx.moveTo(fx - 2, 8); ctx.lineTo(fx, 12); ctx.lineTo(fx + 2, 8); ctx.closePath(); ctx.fill(); ctx.stroke(); }
}

// The bat. x, y: center of the hitbox. flip: 1 upright … −1 upside down (tweened).
export function drawRunner(ctx, x, y, flip, opt = {}) {
  const sx = opt.sx ?? 1, sy = opt.sy ?? 1, t = opt.t ?? 0;
  const color = opt.color || C.runner;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy * (Math.abs(flip) < 0.15 ? 0.15 * Math.sign(flip || 1) : flip));
  const r = 17;
  // little feet scurrying
  const run = opt.running ? Math.sin(t * 24) * 4 : 0;
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.ellipse(-5 + run, r, 5, 3, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(6 - run, r, 5, 3, 0, 0, 7); ctx.fill();
  // folded wing behind, flapping a little
  const flap = Math.sin(t * (opt.running ? 18 : 6)) * 0.25;
  ctx.save(); ctx.translate(-10, 2); ctx.rotate(-0.5 + flap);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-20, -6, -22, 8); ctx.quadraticCurveTo(-14, 6, -12, 12); ctx.quadraticCurveTo(-6, 8, 0, 10); ctx.closePath();
  ctx.fillStyle = shade(color, 0.72); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.restore();
  batEars(ctx, color);
  // body
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.fillStyle = C.belly;
  ctx.beginPath(); ctx.ellipse(-2, 7, 9, 7, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.ellipse(-8, -8, 5, 3, -0.5, 0, 7); ctx.fill();
  batFace(ctx, opt.blink);
  ctx.restore();
}

// Glider form: the bat with its wings spread, pointing where it is going.
export function drawGlider(ctx, x, y, angle, t, color = C.runner) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle * 0.8);
  const beat = Math.sin(t * 14) * 5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.quadraticCurveTo(-14, side * (26 + beat), -30, side * (22 + beat));
    ctx.quadraticCurveTo(-26, side * 14, -22, side * 12);
    ctx.quadraticCurveTo(-18, side * 16, -14, side * 10);
    ctx.quadraticCurveTo(-10, side * 14, -6, side * 8);
    ctx.closePath();
    ctx.fillStyle = shade(color, 0.75); ctx.fill();
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  }
  ctx.scale(0.85, 0.85);
  batEars(ctx, color);
  ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7);
  ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = C.ink; ctx.stroke();
  batFace(ctx, false);
  ctx.restore();
}

export const FORM_STYLE = {
  flip: { color: C.runner, label: 'FLIP' },
  glider: { color: '#5FC8FF', label: 'GLIDE' },
  twin: { color: '#FFB05F', label: 'TWIN' },
};

// A portal: a shimmering band of moonlight across the playfield with the form's
// name in a tag at the top and bottom (shape and text, not only color).
export function drawPortal(ctx, x, form, t) {
  const st = FORM_STYLE[form];
  ctx.save();
  ctx.globalAlpha = 0.16 + Math.sin(t * 6) * 0.05;
  ctx.fillStyle = st.color;
  ctx.fillRect(x - 22, 0, 44, ROWS * T);
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = st.color; ctx.lineWidth = 3;
  // swirling motes rising through the band
  for (let k = 0; k < 10; k++) {
    const yy = ROWS * T - ((t * 160 + k * 64) % (ROWS * T));
    ctx.beginPath(); ctx.arc(x + Math.sin(t * 4 + k) * 12, yy, 3, 0, 7); ctx.stroke();
  }
  ctx.setLineDash([12, 10]); ctx.lineDashOffset = -t * 60;
  ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ROWS * T); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  for (const y of [T * 0.9, ROWS * T - T * 0.9]) {
    rrect(ctx, x - 44, y - 16, 88, 32, 10);
    ctx.fillStyle = st.color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
    text(ctx, st.label, x, y + 1, 16, '#fff', 'center', 900, 4);
  }
  ctx.restore();
}

// Checkpoint: a lantern on a post that lights up when you pass it.
export function drawFlag(ctx, x, surfaceY, g, active, t) {
  const top = surfaceY - g * 58;
  ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x, surfaceY); ctx.lineTo(x, top); ctx.lineTo(x + 14, top); ctx.stroke();
  const lx = x + 14, ly = top + g * 14 + Math.sin(t * 3) * 1.5;
  if (active) {
    ctx.fillStyle = C.star; ctx.globalAlpha = 0.22 + Math.sin(t * 5) * 0.05;
    ctx.beginPath(); ctx.arc(lx, ly, 34, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  rrect(ctx, lx - 9, ly - 12, 18, 24, 6);
  ctx.fillStyle = active ? C.star : '#5A5478'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.fillStyle = C.ink; ctx.fillRect(lx - 7, ly - 15, 14, 4); ctx.fillRect(lx - 7, ly + 11, 14, 4);
}

// Goal: the roost, a ring of rock around the full moon spanning the corridor.
export function drawGoal(ctx, x, t) {
  const cx = x + 20, cy = 7.5 * T, r = 4.2 * T;
  ctx.fillStyle = C.moon; ctx.globalAlpha = 0.2 + Math.sin(t * 3) * 0.05;
  ctx.beginPath(); ctx.arc(cx, cy, r + 30, 0, 7); ctx.fill();
  ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 14; ctx.strokeStyle = '#5A4B7E';
  ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, 7); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = C.ink;
  ctx.beginPath(); ctx.arc(cx, cy, r + 13, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, 7); ctx.stroke();
  rrect(ctx, cx - 54, cy - r - 46, 108, 40, 12);
  ctx.fillStyle = C.star; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
  text(ctx, 'HOME', cx, cy - r - 25, 24, C.ink, 'center', 900);
}

export function drawLevelStar(ctx, x, y, t, ghost) {
  const bob = Math.sin(t * 3 + x) * 3;
  if (ghost) {
    ctx.globalAlpha = 0.6;
    drawStarShape(ctx, x, y + bob, 15, C.star, Math.cos(t * 2.5 + y), true);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = C.star; ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.arc(x, y + bob, 24, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    drawStarShape(ctx, x, y + bob, 15, C.star, Math.cos(t * 2.5 + y));
  }
}

export { RUNNER };
