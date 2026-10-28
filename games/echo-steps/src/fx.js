// Juice outside the simulation: pooled particles, screen shake, squash and stretch.
// Has its own random generator, so the sim never sees it. (Copied from Flip Runner and adapted.)
import { COLORS, } from './config.js';
import { FONT } from './render.js';

const MAX = 400;

export class FX {
  constructor() {
    this.p = Array.from({ length: MAX }, () => ({ on: false }));
    this.shakeT = 0; this.shakeA = 0;
    this.seed = 1;
    this.squash = { sx: 1, sy: 1, vx: 0, vy: 0 };
  }

  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  spawn(o) {
    for (const q of this.p) {
      if (q.on) continue;
      q.on = true; q.x = o.x; q.y = o.y; q.vx = o.vx || 0; q.vy = o.vy || 0;
      q.life = q.max = o.life || 0.5; q.size = o.size || 4; q.color = o.color || COLORS.pale;
      q.type = o.type || 'dot'; q.g = o.g ?? 0; q.label = o.label; q.tx = o.tx; q.ty = o.ty;
      return q;
    }
    return null;
  }

  burst(x, y, n, color, speed = 200, type = 'dot', life = 0.5, size = 3, g = 0) {
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2, s = speed * (0.4 + this.rnd() * 0.6);
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, type, life: life * (0.6 + this.rnd() * 0.6), size, g });
    }
  }

  // A figure dissolving into squares (breaks, slots full pop).
  dissolve(x, y, color, n = 16) {
    for (let i = 0; i < n; i++) {
      this.spawn({ x: x - 12 + this.rnd() * 24, y: y - 40 + this.rnd() * 40, vx: (this.rnd() - 0.5) * 120, vy: -40 - this.rnd() * 80, color, type: 'square', life: 0.5 + this.rnd() * 0.3, size: 3 + this.rnd() * 3, g: 200 });
    }
  }

  ring(x, y, color, size = 10, life = 0.4) { this.spawn({ x, y, type: 'ring', color, size, life }); }
  text(x, y, label, color, size = 22, life = 0.8) { this.spawn({ x, y, vy: -40, type: 'text', label, color, size, life }); }

  shake(amount, time) { this.shakeA = Math.max(this.shakeA, amount); this.shakeT = Math.max(this.shakeT, time); }
  kick(sx, sy) { this.squash.sx = sx; this.squash.sy = sy; }
  clear() { for (const q of this.p) q.on = false; this.shakeT = 0; }

  update(dt) {
    for (const q of this.p) {
      if (!q.on) continue;
      q.life -= dt;
      if (q.life <= 0) { q.on = false; continue; }
      if (q.type === 'fly') {
        const k = Math.min(1, dt * 7);
        q.x += (q.tx - q.x) * k; q.y += (q.ty - q.y) * k;
      } else {
        q.vy += q.g * dt;
        q.x += q.vx * dt; q.y += q.vy * dt;
      }
    }
    if (this.shakeT > 0) this.shakeT -= dt;
    const s = this.squash;
    s.vx += (-(s.sx - 1) * 320 - s.vx * 14) * dt;
    s.vy += (-(s.sy - 1) * 320 - s.vy * 14) * dt;
    s.sx += s.vx * dt; s.sy += s.vy * dt;
  }

  offset() {
    if (this.shakeT <= 0) return [0, 0];
    return [(this.rnd() - 0.5) * 2 * this.shakeA, (this.rnd() - 0.5) * 2 * this.shakeA];
  }

  draw(ctx) {
    for (const q of this.p) {
      if (!q.on) continue;
      const k = q.life / q.max;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.fillStyle = q.color;
      ctx.strokeStyle = q.color;
      if (q.type === 'spark') {
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.04, q.y - q.vy * 0.04); ctx.stroke();
      } else if (q.type === 'ring') {
        ctx.lineWidth = 3 * k + 1;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size + (1 - k) * 40, 0, Math.PI * 2); ctx.stroke();
      } else if (q.type === 'square') {
        ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
      } else if (q.type === 'text') {
        ctx.font = `900 ${q.size}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.strokeStyle = COLORS.navy; ctx.strokeText(q.label, q.x, q.y);
        ctx.fillText(q.label, q.x, q.y);
      } else {
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (q.type === 'fly' ? 1 : k), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
