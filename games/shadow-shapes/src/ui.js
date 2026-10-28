// Canvas 2D drawing helpers for the UI (GDD 9, Night Neon): text, panels,
// icons and the picture mosaic used by the book and the reveal.
import { COLORS as C, PICTURE_COLORS } from './config.js';
import { SHAPES } from './shadow.js';

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function text(ctx, str, x, y, size, color = C.moon, align = 'center', weight = 800, outline = 0) {
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

export function drawStar(ctx, x, y, r, fill, outlineOnly = false) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.lineJoin = 'round';
  if (outlineOnly) { ctx.lineWidth = Math.max(2, r * 0.14); ctx.strokeStyle = fill; ctx.stroke(); return; }
  ctx.fillStyle = fill; ctx.fill();
}

export function drawLock(ctx, x, y, s, color = C.moon) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineWidth = 4; ctx.strokeStyle = color;
  ctx.beginPath(); ctx.arc(0, -8, 9, Math.PI, 0); ctx.stroke();
  rrect(ctx, -14, -8, 28, 22, 5); ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = C.wall; ctx.fillRect(-2, -1, 4, 8);
  ctx.restore();
}

// A glowing ghost hand (level 1 and 3 tutorial).
export function drawHand(ctx, x, y, press) {
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(x, y, 12 + press * 8, 0, Math.PI * 2);
  ctx.strokeStyle = C.cyan; ctx.lineWidth = 3; ctx.stroke();
  ctx.translate(x + 4, y + 4); ctx.rotate(-0.5);
  ctx.shadowColor = C.cyan; ctx.shadowBlur = 12;
  rrect(ctx, -7, 0, 14, 34, 7); ctx.fillStyle = C.moon; ctx.fill();
  rrect(ctx, -12, 22, 24, 30, 10); ctx.fill();
  ctx.restore();
}

export function drawKeycap(ctx, x, y, label) {
  rrect(ctx, x - 20, y - 20, 40, 40, 8);
  ctx.fillStyle = 'rgba(234,240,255,0.12)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(234,240,255,0.7)'; ctx.stroke();
  text(ctx, label, x, y + 1, 22, C.moon, 'center', 900);
}

// The picture as glowing tiles. cells: level cells (x right, y up); (cx, cy) is
// where the pivot goes; px per cell. reveal(k, cell) can return a scale 0..1 per tile.
export function drawMosaic(ctx, lv, cx, cy, px, opt = {}) {
  const pv = lv.frame.pivot, gap = Math.max(1, px * 0.07);
  for (const c of lv.cells) {
    const s = opt.tile ? opt.tile(c) : 1;
    if (s <= 0) continue;
    const x0 = cx + (c.x - pv[0]) * px, y0 = cy - (c.y + 1 - pv[1]) * px;
    const mx = x0 + px / 2, my = y0 + px / 2;
    ctx.save();
    ctx.translate(mx, my); ctx.scale(s, s); ctx.translate(-mx, -my);
    ctx.beginPath();
    SHAPES[c.shape].forEach((p, i) => {
      const x = x0 + gap + p[0] * (px - 2 * gap), y = y0 + gap + (1 - p[1]) * (px - 2 * gap);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    const col = (opt.color && opt.color(c)) || PICTURE_COLORS[c.color];
    ctx.fillStyle = col;
    if (opt.glow) { ctx.shadowColor = col; ctx.shadowBlur = opt.glow; }
    ctx.fill();
    ctx.restore();
  }
}

// Picture outline loops (relative to the pivot) as a path.
export function outlinePath(ctx, loops, cx, cy, px) {
  ctx.beginPath();
  for (const loop of loops) {
    loop.forEach((p, i) => (i ? ctx.lineTo(cx + p[0] * px, cy - p[1] * px) : ctx.moveTo(cx + p[0] * px, cy - p[1] * px)));
    ctx.closePath();
  }
}

export const fmtTime = s => {
  const t = Math.max(0, s);
  const m = Math.floor(t / 60), r = t - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
};
