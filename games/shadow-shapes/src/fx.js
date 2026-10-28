// Juice: pooled particles, screen shake, squash and stretch. Nothing is
// allocated per frame. (Copied from Ink Path and adapted to Night Neon.)
import { COLORS as C } from './config.js';
import { drawStar } from './ui.js';

const MAX = 400;

export class FX {
  constructor() {
    this.p = Array.from({ length: MAX }, () => ({ on: false }));
    this.shakeT = 0; this.shakeA = 0;
    this.seed = 1;
    this.squash = {};
  }

  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }

  spawn(o) {
    for (const q of this.p) {
      if (q.on) continue;
      q.on = true; q.x = o.x; q.y = o.y; q.vx = o.vx || 0; q.vy = o.vy || 0;
      q.life = q.max = o.life || 0.5; q.size = o.size || 4; q.color = o.color || C.gold;
      q.type = o.type || 'dot'; q.g = o.g ?? 0; q.rot = this.rnd() * 6.28; q.spin = (this.rnd() - 0.5) * 8;
      q.label = o.label; q.delay = o.delay || 0;
      return q;
    }
    return null;
  }

  burst(x, y, n, color, speed = 220, type = 'spark', life = 0.6, size = 3, g = 0) {
    for (let i = 0; i < n; i++) {
      const a = this.rnd() * Math.PI * 2, s = speed * (0.4 + this.rnd() * 0.6);
      this.spawn({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, color, type, life: life * (0.6 + this.rnd() * 0.6), size, g });
    }
  }

  shake(amount, time) { this.shakeA = Math.max(this.shakeA, amount); this.shakeT = Math.max(this.shakeT, time); }
  sq(key) { return this.squash[key] || (this.squash[key] = { sx: 1, sy: 1, vx: 0, vy: 0 }); }
  kick(key, sx, sy) { const s = this.sq(key); s.sx = sx; s.sy = sy; }
  clear() { for (const q of this.p) q.on = false; this.shakeT = 0; }

  update(dt) {
    for (const q of this.p) {
      if (!q.on) continue;
      if (q.delay > 0) { q.delay -= dt; continue; }
      q.life -= dt;
      if (q.life <= 0) { q.on = false; continue; }
      q.vy += q.g * dt;
      q.vx *= 1 - Math.min(1, dt * 1.5); q.vy *= 1 - Math.min(1, dt * 1.5);
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.rot += q.spin * dt;
    }
    if (this.shakeT > 0) this.shakeT -= dt;
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
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const q of this.p) {
      if (!q.on || q.delay > 0) continue;
      const k = q.life / q.max;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.fillStyle = q.color; ctx.strokeStyle = q.color;
      if (q.type === 'spark') {
        // four-point twinkle
        const s = q.size * (0.6 + k);
        ctx.beginPath();
        ctx.moveTo(q.x, q.y - s * 2); ctx.lineTo(q.x + s * 0.5, q.y); ctx.lineTo(q.x, q.y + s * 2); ctx.lineTo(q.x - s * 0.5, q.y);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(q.x - s * 2, q.y); ctx.lineTo(q.x, q.y + s * 0.5); ctx.lineTo(q.x + s * 2, q.y); ctx.lineTo(q.x, q.y - s * 0.5);
        ctx.closePath(); ctx.fill();
      } else if (q.type === 'ring') {
        const e = 1 - k;
        ctx.lineWidth = 6 * k + 1;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size + e * 260, 0, Math.PI * 2); ctx.stroke();
      } else if (q.type === 'star') {
        ctx.globalCompositeOperation = 'source-over';
        drawStar(ctx, q.x, q.y, q.size, q.color);
        ctx.globalCompositeOperation = 'lighter';
      } else {
        ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }
}
