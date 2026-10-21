// Everything drawn in code (GDD 9): pre-rendered tile layer, robots, metal,
// fields. World coordinates are playfield px; the caller translates below the HUD.
import { T, COLS, ROWS, VIEW_W, HUD_H, COLORS, MAGNET } from './config.js';
import { TILE, tileAt } from './level.js';
import { fieldDir } from './magnet.js';
import { drawHex } from './fx.js';

const C = COLORS;
export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TILE_FILL = '#E9C9A0';
const TILE_TOP = '#F7E3C4';
const TILE_DARK = '#D4AE84';

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

// ---- Static layer ------------------------------------------------------------

export function renderTiles(tiles, pixelScale) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(VIEW_W * pixelScale);
  cv.height = Math.ceil(ROWS * T * pixelScale);
  const ctx = cv.getContext('2d');
  ctx.scale(pixelScale, pixelScale);

  // Background: warm wall with a pegboard pattern and a soft vignette.
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, VIEW_W, ROWS * T);
  ctx.fillStyle = 'rgba(43,34,56,0.06)';
  for (let y = 20; y < ROWS * T; y += 40) for (let x = 20; x < VIEW_W; x += 40) {
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
  }
  const g = ctx.createRadialGradient(VIEW_W / 2, 300, 200, VIEW_W / 2, 300, 800);
  g.addColorStop(0, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(43,34,56,0.10)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, ROWS * T);

  const solid = (x, y) => { const t = tileAt(tiles, x, y); return t === TILE.SOLID || t === TILE.METAL; };

  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    const t = tileAt(tiles, x, y), px = x * T, py = y * T;
    if (t === TILE.SOLID) {
      ctx.fillStyle = TILE_FILL;
      ctx.fillRect(px, py, T, T);
      if (!solid(x, y - 1)) { ctx.fillStyle = TILE_TOP; ctx.fillRect(px, py, T, 10); }
      if ((x * 7 + y * 13) % 5 === 0) {
        ctx.fillStyle = TILE_DARK;
        ctx.beginPath(); ctx.arc(px + 12, py + 26, 2.5, 0, 7); ctx.arc(px + 28, py + 26, 2.5, 0, 7); ctx.fill();
      }
    } else if (t === TILE.METAL) {
      ctx.fillStyle = '#7D8894';
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = C.metal;
      ctx.fillRect(px + 4, py + 4, T - 8, T - 8);
      ctx.fillStyle = C.ink;
      for (const [rx, ry] of [[9, 9], [31, 9], [9, 31], [31, 31]]) { ctx.beginPath(); ctx.arc(px + rx, py + ry, 3, 0, 7); ctx.fill(); }
    } else if (t === TILE.SPIKES) {
      ctx.fillStyle = '#C8CED6';
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      for (let i = 0; i < 3; i++) {
        const sx = px + 2 + i * 12.5;
        ctx.beginPath();
        ctx.moveTo(sx, py + T);
        ctx.lineTo(sx + 6, py + T - 20);
        ctx.lineTo(sx + 12, py + T);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
      }
    } else if (t === TILE.WATER) {
      ctx.fillStyle = 'rgba(47,127,224,0.45)';
      ctx.fillRect(px, py + 8, T, T - 8);
    }
  }

  // Thick outlines where solid meets air.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (!solid(x, y)) continue;
    const px = x * T, py = y * T;
    if (!solid(x, y - 1) && y > 0) { ctx.moveTo(px, py); ctx.lineTo(px + T, py); }
    if (!solid(x, y + 1) && y < ROWS - 1) { ctx.moveTo(px, py + T); ctx.lineTo(px + T, py + T); }
    if (!solid(x - 1, y) && x > 0) { ctx.moveTo(px, py); ctx.lineTo(px, py + T); }
    if (!solid(x + 1, y) && x < COLS - 1) { ctx.moveTo(px + T, py); ctx.lineTo(px + T, py + T); }
  }
  ctx.stroke();
  return cv;
}

// ---- Robots --------------------------------------------------------------------

// x, y: bottom center. look: unit-ish vector for the pupils.
export function drawRobot(ctx, x, y, pol, facing, opt = {}) {
  const color = pol === 'plus' ? C.plus : C.minus;
  const sx = opt.sx ?? 1, sy = opt.sy ?? 1, t = opt.t ?? 0;
  const W = 38 * sx, H = 36 * sy;
  ctx.save();
  ctx.translate(x, y);

  // feet
  const step = opt.walk ? Math.sin(t * 18) * 3 : 0;
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.ellipse(-8 * sx, -2 + Math.max(0, step), 7, 4, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8 * sx, -2 + Math.max(0, -step), 7, 4, 0, 0, 7); ctx.fill();

  // antenna
  const top = -H - 3;
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, top + 2); ctx.lineTo(facing * -2, top - 8); ctx.stroke();
  ctx.fillStyle = opt.power ? C.bolt : color;
  ctx.beginPath(); ctx.arc(facing * -2, top - 10, 4.5, 0, 7); ctx.fill(); ctx.stroke();

  // body
  rrect(ctx, -W / 2, top, W, H, 14 * Math.min(sx, sy));
  ctx.fillStyle = color; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = C.ink; ctx.stroke();
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  rrect(ctx, -W / 2 + 5, top + 4, W * 0.35, 6, 3); ctx.fill();

  // eyes
  const ey = top + H * 0.36, look = opt.look || { x: facing, y: 0 };
  const blink = opt.blink ? 0.15 : 1;
  for (const ex of [-7, 7]) {
    const cx = ex * sx + facing * 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(cx, ey, 5.5, 6.5 * blink, 0, 0, 7); ctx.fill();
    ctx.lineWidth = 2; ctx.stroke();
    if (blink > 0.5) {
      ctx.fillStyle = C.ink;
      ctx.beginPath(); ctx.arc(cx + look.x * 2.2, ey + look.y * 2.2, 2.8, 0, 7); ctx.fill();
    }
  }

  // chest badge with + or −
  const by = top + H * 0.74;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(0, by, 7.5, 0, 7); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-4, by); ctx.lineTo(4, by);
  if (pol === 'plus') { ctx.moveTo(0, by - 4); ctx.lineTo(0, by + 4); }
  ctx.stroke();

  // shield ring while the power is on (immune to the twin's field)
  if (opt.power) {
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -t * 30;
    ctx.strokeStyle = color; ctx.globalAlpha = 0.55; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, top + H / 2, 28, 0, 7); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ---- Fields --------------------------------------------------------------------

export function drawField(ctx, r, ox, oy, t) {
  const plus = r.pol === 'plus';
  const color = plus ? C.plus : C.minus;
  const d = fieldDir(r);
  const ang = Math.atan2(d.y, d.x), h = MAGNET.halfAngle, R = MAGNET.range;

  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(ox, oy); ctx.arc(ox, oy, R, ang - h, ang + h); ctx.closePath(); ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    let k = (t * 1.4 + i / 4) % 1;
    if (plus) k = 1 - k;                 // plus flows inward, minus outward
    const rr = 18 + k * (R - 18);
    ctx.globalAlpha = 0.75 * (1 - k * 0.7);
    ctx.lineWidth = 4;
    if (plus) {
      // chevrons pointing back at the robot
      for (const s of [-0.6, 0, 0.6]) {
        const a = ang + s * h;
        const cx = ox + Math.cos(a) * rr, cy = oy + Math.sin(a) * rr;
        const bx = Math.cos(a), by = Math.sin(a), px = -by, py = bx;
        ctx.beginPath();
        ctx.moveTo(cx + bx * 6 + px * 6, cy + by * 6 + py * 6);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + bx * 6 - px * 6, cy + by * 6 - py * 6);
        ctx.stroke();
      }
    } else {
      ctx.beginPath(); ctx.arc(ox, oy, rr, ang - h * 0.9, ang + h * 0.9); ctx.stroke();
    }
  }
  ctx.restore();
}

// Ghost cone shown while the power is off: where the field would go right now,
// with a pulsing ring on everything it would reach.
export function drawAimPreview(ctx, pol, aim, facing, ox, oy, targets, t) {
  const color = pol === 'plus' ? C.plus : C.minus;
  const ang = aim === 'up' ? -Math.PI / 2 : aim === 'down' ? Math.PI / 2 : facing > 0 ? 0 : Math.PI;
  const h = MAGNET.halfAngle, R = MAGNET.range;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([7, 7]);
  ctx.lineDashOffset = -t * 20;
  ctx.beginPath();
  ctx.moveTo(ox + Math.cos(ang - h) * 26, oy + Math.sin(ang - h) * 26);
  ctx.arc(ox, oy, R, ang - h, ang + h);
  ctx.lineTo(ox + Math.cos(ang + h) * 26, oy + Math.sin(ang + h) * 26);
  ctx.stroke();
  ctx.setLineDash([]);

  // arrow just outside the body
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = color;
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  const ax = ox + Math.cos(ang) * 34, ay = oy + Math.sin(ang) * 34;
  const px = -Math.sin(ang), py = Math.cos(ang);
  ctx.beginPath();
  ctx.moveTo(ax + Math.cos(ang) * 9, ay + Math.sin(ang) * 9);
  ctx.lineTo(ax + px * 7, ay + py * 7);
  ctx.lineTo(ax - px * 7, ay - py * 7);
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  const pulse = 1 + Math.sin(t * 8) * 0.08;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.7;
  ctx.setLineDash([5, 5]);
  for (let i = 0; i < targets.length; i += 2) {
    ctx.beginPath(); ctx.arc(targets[i], targets[i + 1], 26 * pulse, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// ---- Metal and level objects ----------------------------------------------------

export function drawCrate(ctx, x, y, s = 40) {
  rrect(ctx, x + 1, y + 1, s - 2, s - 2, 5);
  ctx.fillStyle = C.metal; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.strokeStyle = 'rgba(43,34,56,0.55)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + 8, y + 8); ctx.lineTo(x + s - 8, y + s - 8); ctx.moveTo(x + s - 8, y + 8); ctx.lineTo(x + 8, y + s - 8); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.strokeRect(x + 6, y + 6, s - 12, s - 12);
  ctx.fillStyle = C.ink;
  for (const [rx, ry] of [[6, 6], [s - 6, 6], [6, s - 6], [s - 6, s - 6]]) { ctx.beginPath(); ctx.arc(x + rx, y + ry, 2.2, 0, 7); ctx.fill(); }
}

export function drawGate(ctx, g) {
  // posts
  ctx.fillStyle = C.ink;
  ctx.fillRect(g.x - 4, g.y, 4, g.fullH);
  ctx.fillRect(g.x + g.w, g.y, 4, g.fullH);
  if (g.h <= 0.5) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(g.x, g.y, g.w, g.h); ctx.clip();
  ctx.fillStyle = C.metal; ctx.fillRect(g.x, g.y, g.w, g.h);
  ctx.fillStyle = 'rgba(43,34,56,0.35)';
  for (let k = -3; k < 8; k++) {
    const yy = g.y + g.h - g.fullH + k * 22;
    ctx.beginPath(); ctx.moveTo(g.x, yy); ctx.lineTo(g.x + g.w, yy - 14); ctx.lineTo(g.x + g.w, yy - 4); ctx.lineTo(g.x, yy + 10); ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = 3.5; ctx.strokeStyle = C.ink;
  ctx.strokeRect(g.x, g.y, g.w, g.h);
  ctx.fillStyle = C.ink; ctx.fillRect(g.x, g.y + g.h - 6, g.w, 6);
}

export function drawPlate(ctx, p, tiles, t) {
  // chain up to the ceiling
  let top = p.y - 20;
  while (top > 0 && tileAt(tiles, Math.floor(p.x / T), Math.floor((top - 1) / T)) !== TILE.SOLID) top -= T;
  top = Math.floor(top / T) * T;
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(p.x, top); ctx.lineTo(p.x, p.y - 16); ctx.stroke();
  ctx.setLineDash([]);

  if (p.touched) {
    ctx.fillStyle = 'rgba(255,197,49,0.45)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 24 + Math.sin(t * 20) * 2, 0, 7); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, 7);
  ctx.fillStyle = C.metal; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = C.ink; ctx.stroke();

  const lock = p.gate.lock;
  ctx.lineCap = 'round';
  if (lock === 'any') {
    // horseshoe magnet icon
    ctx.lineWidth = 5;
    ctx.strokeStyle = C.ink;
    ctx.beginPath(); ctx.arc(p.x, p.y - 1, 6.5, Math.PI, 0, true); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p.x - 6.5, p.y - 1); ctx.lineTo(p.x - 6.5, p.y - 7); ctx.moveTo(p.x + 6.5, p.y - 1); ctx.lineTo(p.x + 6.5, p.y - 7); ctx.stroke();
  } else {
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = lock === 'plus' ? C.plus : C.minus;
    ctx.beginPath(); ctx.moveTo(p.x - 7, p.y); ctx.lineTo(p.x + 7, p.y);
    if (lock === 'plus') { ctx.moveTo(p.x, p.y - 7); ctx.lineTo(p.x, p.y + 7); }
    ctx.stroke();
  }
}

export function drawExit(ctx, e, inside, t, open) {
  const x = e.x + 4, y = e.y, w = e.w - 8, h = e.h;
  rrect(ctx, x - 4, y - 8, w + 8, h + 8, 10);
  ctx.fillStyle = C.ink; ctx.fill();
  ctx.fillStyle = '#5A4A6E';
  ctx.fillRect(x, y, w, h);
  const o = open * (w / 2 - 4);
  ctx.fillStyle = C.bolt;
  ctx.fillRect(x, y, w / 2 - o, h);
  ctx.fillRect(x + w / 2 + o, y, w / 2 - o, h);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w / 2 - o, h);
  ctx.strokeRect(x + w / 2 + o, y, w / 2 - o, h);
  // two lamps: + and −, lit when that robot is inside
  for (let i = 0; i < 2; i++) {
    const lx = x + w * (i ? 0.75 : 0.25), ly = y - 18;
    ctx.beginPath(); ctx.arc(lx, ly, 9, 0, 7);
    ctx.fillStyle = inside[i] ? (i ? C.minus : C.plus) : '#CFC3B4';
    ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(lx - 4, ly); ctx.lineTo(lx + 4, ly);
    if (!i) { ctx.moveTo(lx, ly - 4); ctx.lineTo(lx, ly + 4); }
    ctx.stroke();
  }
  // little "two robots" sign
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.arc(x + w / 2 - 7, y + 22, 5, 0, 7); ctx.arc(x + w / 2 + 7, y + 22, 5, 0, 7); ctx.fill();
}

export function drawBolt(ctx, b, t) {
  const bob = Math.sin(t * 3 + b.x) * 3;
  drawHex(ctx, b.x, b.y + bob, 12, C.bolt, Math.cos(t * 3 + b.y));
}

export function drawKeycap(ctx, label, x, y, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.font = `800 15px ${FONT}`;
  const w = Math.max(28, ctx.measureText(label).width + 14);
  rrect(ctx, x - w / 2, y - 14, w, 28, 7);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.fillStyle = 'rgba(43,34,56,0.15)';
  ctx.fillRect(x - w / 2 + 3, y + 8, w - 6, 3);
  text(ctx, label, x, y - 1, 15);
  ctx.globalAlpha = 1;
  return w;
}

export { HUD_H };
