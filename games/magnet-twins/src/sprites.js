// Sprite versions of the level drawings for the pack-based art styles (art.js). Every
// function returns false when the active style has no sprite for that thing, so the caller
// falls back to the drawn-in-code look. Positions and sizes come from the sim, untouched.
import { T, COLORS as C } from './config.js';
import { art, spr, blit } from './art.js';

// Plus / minus badge (shape, not only color, says which robot is which).
export function drawBadge(ctx, x, y, r, pol) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.3); ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.strokeStyle = pol === 'plus' ? C.plus : C.minus;
  ctx.lineWidth = Math.max(2, r * 0.42); ctx.lineCap = 'butt';
  const a = r * 0.58;
  ctx.beginPath(); ctx.moveTo(x - a, y); ctx.lineTo(x + a, y);
  if (pol === 'plus') { ctx.moveTo(x, y - a); ctx.lineTo(x, y + a); }
  ctx.stroke();
}

// x, y: bottom center of the robot's box. Same options as drawRobot in render.js.
export function drawRobotSprite(ctx, x, y, pol, facing, opt) {
  const S = spr(), R = S && S.robot, im = art.img[pol];
  if (!R || !im) return false;
  const t = opt.t ?? 0, sx = opt.sx ?? 1, sy = opt.sy ?? 1;
  let f;
  if (opt.air) f = R.jump;
  else if (opt.walk) f = R.walk[Math.floor(t * R.fps) % R.walk.length];
  else if (opt.blink && R.blink != null) f = R.blink;
  else f = R.idle[Math.floor(t * (R.idleFps || 1)) % R.idle.length];

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * sx, sy);
  if (opt.power) {
    // a soft glow in the robot's color while the power is on
    ctx.shadowColor = pol === 'plus' ? C.plus : C.minus;
    ctx.shadowBlur = 14;
  }
  ctx.drawImage(im, f * R.fw, 0, R.fw, R.fh, -R.w / 2 + R.ox, -R.h + R.foot, R.w, R.h);
  ctx.restore();

  // badge on the body, mirrored with the facing
  const [bx, by, br] = R.badge;
  drawBadge(ctx, x + bx * facing * sx, y - by * sy, br * Math.min(sx, sy, 1.2), pol);

  if (opt.power) {
    const color = pol === 'plus' ? C.plus : C.minus;
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -t * 30;
    ctx.strokeStyle = color; ctx.globalAlpha = 0.6; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y - 20 * sy, 30, 0, 7); ctx.stroke();
    ctx.restore();
  }
  return true;
}

export function drawCrateSprite(ctx, x, y, s) {
  const S = spr();
  return !!(S && S.crate) && blit(ctx, S.crate, x, y, s, s);
}

// Door on a magnetic lock: the panel tiles slide up into the ceiling as it opens.
export function drawGateSprite(ctx, g) {
  const S = spr();
  if (!S || !(S.gate || S.gateLock)) return false;
  const cells = S.gateLock ? [S.gateLock[g.lock] || S.gateLock.any] : S.gate;
  ctx.fillStyle = C.ink;
  ctx.fillRect(g.x - 4, g.y, 4, g.fullH);
  ctx.fillRect(g.x + g.w, g.y, 4, g.fullH);
  if (g.h <= 0.5) return true;
  ctx.save();
  ctx.beginPath(); ctx.rect(g.x, g.y, g.w, g.h); ctx.clip();
  const n = Math.round(g.fullH / T), y0 = g.y + g.h - g.fullH;
  for (let k = 0; k < n; k++) {
    // bottom cell first in the list, so a two-cell gate gets a distinct bottom edge
    const src = cells[k === n - 1 ? 0 : Math.min(cells.length - 1, 1)];
    if (!blit(ctx, src, g.x, y0 + k * T, g.w, T)) { ctx.restore(); return false; }
  }
  ctx.restore();
  ctx.fillStyle = C.ink; ctx.fillRect(g.x, g.y + g.h - 4, g.w, 4);
  return true;
}

// Lock plate: the pack's keyhole block in the lock's color, with the + / − / magnet glyph.
export function drawPlateSprite(ctx, p, t) {
  const S = spr();
  if (!S || !S.plateLock) return false;
  const lock = p.gate.lock;
  if (p.touched) {
    ctx.fillStyle = 'rgba(255,197,49,0.45)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 26 + Math.sin(t * 20) * 2, 0, 7); ctx.fill();
  }
  if (!blit(ctx, S.plateLock[lock] || S.plateLock.any, p.x - 18, p.y - 18, 36, 36)) return false;
  if (lock !== 'any') drawBadge(ctx, p.x + 13, p.y + 13, 7, lock);
  return true;
}

// The slab of a hanging platform (the rail and wheels stay drawn in code).
export function drawSlabSprite(ctx, x, y, w, h) {
  const S = spr();
  if (!S || !S.plat) return false;
  const n = Math.round(w / T);
  for (let i = 0; i < n; i++) {
    const src = S.plat[i === 0 ? 0 : i === n - 1 ? S.plat.length - 1 : Math.min(1, S.plat.length - 1)];
    if (!blit(ctx, src, x + i * T, y, T, h)) return false;
  }
  return true;
}

export function drawExitSprite(ctx, e, open) {
  const S = spr();
  if (!S || !S.exit) return false;
  const parts = open > 0.5 ? S.exit.open : S.exit.closed;
  for (const [src, dx, dy, dw, dh] of parts) if (!blit(ctx, src, e.x + dx, e.y + dy, dw, dh)) return false;
  return true;
}

export function drawFlagSprite(ctx, f, raise, t) {
  const S = spr(), F = S && S.flag;
  if (!F) return false;
  const src = f.on ? (Array.isArray(F.on[0]) ? F.on[Math.floor(t * (F.fps || 4)) % F.on.length] : F.on) : F.off;
  const k = f.on ? 0.9 + 0.1 * Math.min(1, raise) : 1;     // a little pop when it turns on
  const w = F.w * k, h = F.h * (f.on ? Math.max(0.9, Math.min(1.08, raise)) : 1);
  return blit(ctx, src, f.x + T / 2 - w / 2 + (F.ox || 0), f.base - h, w, h);
}

export function drawBoltSprite(ctx, x, y, t, size) {
  const S = spr(), Bo = S && S.bolt;
  if (!Bo) return false;
  const s = size || Bo.size;
  const src = Bo.frames[Math.floor(t * (Bo.fps || 1)) % Bo.frames.length];
  if (Bo.spin) {
    const k = Math.cos(t * 3 + y);
    ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.15, Math.abs(k)), 1);
    const ok = blit(ctx, src, -s / 2, -s / 2, s, s);
    ctx.restore();
    return ok;
  }
  return blit(ctx, src, x - s / 2, y - s / 2, s, s);
}
