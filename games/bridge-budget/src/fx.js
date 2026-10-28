// Juice outside the simulation: particles, screen shake, squash and stretch.
// Pooled, so nothing is allocated per frame. (Copied from Ink Path and adapted.)
import { COLORS } from './config.js';

const MAX = 500;

export class FX {
  constructor() {
    this.p = Array.from({ length: MAX }, () => ({ on: false }));
    this.shakeT = 0; this.shakeA = 0;
    this.seed = 1;
    this.squash = {};
    this.vignette = 0;
  }

  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  spawn(o) {
    for (const q of this.p) {
      if (q.on) continue;
      q.on = true; q.x = o.x; q.y = o.y; q.vx = o.vx || 0; q.vy = o.vy || 0;
      q.life = q.max = o.life || 0.5; q.size = o.size || 4; q.color = o.color || COLORS.ink;
      q.type = o.type || 'dot'; q.g = o.g ?? 600; q.rot = this.rnd() * 6.28; q.spin = (this.rnd() - 0.5) * 12;
      q.tx = o.tx; q.ty = o.ty; q.label = o.label;
      return q;
    }
    return null;
  }

  burst(x, y, n, color, speed = 260, type = 'dot', life = 0.5, size = 4, g = 600) {
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2, s = speed * (0.4 + this.rnd() * 0.6);
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, type, life: life * (0.6 + this.rnd() * 0.6), size, g });
    }
  }

  dust(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1;
      this.spawn({ x, y, vx: dir * (60 + this.rnd() * 90), vy: -20 - this.rnd() * 40, color: 'rgba(43,43,43,0.3)', type: 'puff', life: 0.35, size: 5 + this.rnd() * 4, g: -50 });
    }
  }

  shake(amount, time) { this.shakeA = Math.max(this.shakeA, amount); this.shakeT = Math.max(this.shakeT, time); }

  sq(key) { return this.squash[key] || (this.squash[key] = { sx: 1, sy: 1, vx: 0, vy: 0 }); }

  kick(key, sx, sy) { const s = this.sq(key); s.sx = sx; s.sy = sy; }

  clear() { for (const q of this.p) q.on = false; this.shakeT = 0; }

  update(dt) {
    for (const q of this.p) {
      if (!q.on) continue;
      q.life -= dt;
      if (q.life <= 0) { q.on = false; continue; }
      if (q.type === 'fly') {
        // Eases towards its target (a star flying to the HUD).
        const k = 1 - q.life / q.max;
        q.x += (q.tx - q.x) * Math.min(1, dt * (4 + k * 14));
        q.y += (q.ty - q.y) * Math.min(1, dt * (4 + k * 14));
      } else {
        q.vy += q.g * dt;
        q.x += q.vx * dt; q.y += q.vy * dt;
        q.rot += q.spin * dt;
      }
    }
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.vignette > 0) this.vignette = Math.max(0, this.vignette - dt * 2.5);
    for (const k in this.squash) {
      const s = this.squash[k];
      s.vx += (-(s.sx - 1) * 320 - s.vx * 14) * dt;
      s.vy += (-(s.sy - 1) * 320 - s.vy * 14) * dt;
      s.sx += s.vx * dt; s.sy += s.vy * dt;
    }
  }

  offset() {
    if (this.shakeT <= 0) return [0, 0];
    return [(this.rnd() - 0.5) * 2 * this.shakeA, (this.rnd() - 0.5) * 2 * this.shakeA];
  }

  draw(ctx) {
    for (const q of this.p) {
      if (!q.on) continue;
      const a = Math.min(1, q.life / q.max * 1.5);
      ctx.globalAlpha = a;
      ctx.fillStyle = q.color;
      ctx.strokeStyle = q.color;
      if (q.type === 'spark') {
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04);
        ctx.stroke();
      } else if (q.type === 'confetti') {
        ctx.save();
        ctx.translate(q.x, q.y); ctx.rotate(q.rot);
        ctx.fillRect(-q.size, -q.size / 2, q.size * 2, q.size);
        ctx.restore();
      } else if (q.type === 'ring') {
        const k = 1 - q.life / q.max;
        ctx.lineWidth = 4 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size + k * 40, 0, Math.PI * 2); ctx.stroke();
      } else if (q.type === 'fly') {
        drawStarShape(ctx, q.x, q.y, 13, COLORS.yellow);
      } else if (q.type === 'text') {
        const k = 1 - q.life / q.max;
        ctx.font = `900 ${q.size}px system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.save(); ctx.translate(q.x, q.y); ctx.scale(1 + Math.max(0, 0.3 - k) * 2, 1 + Math.max(0, 0.3 - k) * 2);
        ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = COLORS.ink; ctx.strokeText(q.label, 0, 0);
        ctx.fillStyle = q.color; ctx.fillText(q.label, 0, 0);
        ctx.restore();
      } else if (q.type === 'ghost') {
        ctx.globalAlpha = a * 0.35;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill();
      } else if (q.type === 'piece') {
        ctx.save();
        ctx.translate(q.x, q.y); ctx.rotate(q.rot);
        ctx.beginPath(); ctx.arc(0, 0, q.size, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = COLORS.ink; ctx.stroke();
        ctx.restore();
      } else {
        const s = q.type === 'puff' ? q.size * (1.5 - q.life / q.max * 0.5) : q.size;
        ctx.beginPath(); ctx.arc(q.x, q.y, s, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

export function drawStarShape(ctx, x, y, r, fill, sx = 1, outlineOnly = false) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r;
    const px = x + Math.cos(a) * rr * sx, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.lineJoin = 'round';
  if (!outlineOnly) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = Math.max(2.5, r * 0.18);
  ctx.strokeStyle = outlineOnly ? fill : COLORS.ink;
  ctx.stroke();
}
