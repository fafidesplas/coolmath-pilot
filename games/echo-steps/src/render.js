// Everything drawn in code (GDD 9, Night Neon). The room (tiles, grid, dim wires)
// is pre-rendered once per room to an offscreen canvas; glows are pre-rendered
// sprites, so no shadowBlur is used per frame.
import { T, COLS, ROWS, PLAYER, COLORS as C } from './config.js';
import { isSolid } from './level.js';

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const DARK = '#0A0E22';

export function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function text(ctx, str, x, y, size, color = C.pale, align = 'center', weight = 800) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---- Glow sprites ---------------------------------------------------------------------

const glowCache = new Map();
export function glow(color) {
  let cv = glowCache.get(color);
  if (cv) return cv;
  cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, rgba(color, 0.55));
  grad.addColorStop(0.4, rgba(color, 0.18));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowCache.set(color, cv);
  return cv;
}
export const drawGlow = (ctx, color, x, y, r) => ctx.drawImage(glow(color), x - r, y - r, r * 2, r * 2);

// ---- Channel glyphs (shape, not color: ▲ ● ■ ◆) -----------------------------------------------

export function drawGlyph(ctx, ch, x, y, r, color, filled = true) {
  ctx.beginPath();
  if (ch === 0) { ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.95, y + r * 0.75); ctx.lineTo(x - r * 0.95, y + r * 0.75); ctx.closePath(); }
  else if (ch === 1) ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
  else if (ch === 2) ctx.rect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5);
  else { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
  if (filled) { ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke(); }
}

export function drawStar(ctx, x, y, r, fill, outline = C.navy) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r;
    i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.lineJoin = 'round';
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.lineWidth = Math.max(2, r * 0.14);
  ctx.strokeStyle = outline;
  ctx.stroke();
}

// ---- Room layer ---------------------------------------------------------------------------

// Small rooms sit centered: offset of the room drawing inside the 1280×640 area.
export function roomOffset(lv) {
  let c0 = COLS, c1 = -1, r0 = ROWS, r1 = -1;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!isSolid(lv, c, r)) { c0 = Math.min(c0, c); c1 = Math.max(c1, c); r0 = Math.min(r0, r); r1 = Math.max(r1, r); }
  }
  // Keep one solid tile of frame below and around the open area.
  const ox = Math.round(((COLS - (c1 - c0 + 1)) / 2 - c0) * T);
  const oy = Math.round(((ROWS - (r1 - r0 + 2)) / 2 - r0) * T);
  return { ox, oy };
}

export function wirePath(lv, plate, gate) {
  // L-shaped: horizontal along the floor, then up to the gate's header.
  const x0 = plate.x0 + T / 2, y0 = plate.y + 10, x1 = gate.x + T / 2, y1 = gate.y - 10;
  return [x0, y0, x1, y0, x1, y1];
}

export function renderRoom(lv, pixelScale, off) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(COLS * T * pixelScale);
  cv.height = Math.ceil(ROWS * T * pixelScale);
  const ctx = cv.getContext('2d');
  ctx.scale(pixelScale, pixelScale);
  ctx.fillStyle = DARK;
  ctx.fillRect(0, 0, COLS * T, ROWS * T);
  ctx.translate(off.ox, off.oy);
  const solid = (c, r) => isSolid(lv, c, r);
  // Open cells: navy with a 4% cyan grid (Lab).
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (solid(c, r)) continue;
    ctx.fillStyle = C.navy; ctx.fillRect(c * T, r * T, T, T);
    ctx.strokeStyle = rgba(C.cyan, 0.05); ctx.lineWidth = 1;
    ctx.strokeRect(c * T + 0.5, r * T + 0.5, T, T);
  }
  // Solid tiles touching the room: pale at 8% with a 2 px pale edge on open sides.
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!solid(c, r)) continue;
    const open = [!solid(c, r - 1) && r > 0, !solid(c + 1, r) && c < COLS - 1, !solid(c, r + 1) && r < ROWS - 1, !solid(c - 1, r) && c > 0];
    let near = open.some(Boolean);
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (!solid(c + dx, r + dy) && c + dx >= 0 && c + dx < COLS && r + dy >= 0 && r + dy < ROWS) near = true;
    if (!near) continue;
    ctx.fillStyle = C.navy; ctx.fillRect(c * T, r * T, T, T);
    ctx.fillStyle = rgba(C.pale, 0.08); ctx.fillRect(c * T, r * T, T, T);
    ctx.strokeStyle = C.pale; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    if (open[0]) { ctx.moveTo(c * T, r * T + 1); ctx.lineTo(c * T + T, r * T + 1); }
    if (open[1]) { ctx.moveTo(c * T + T - 1, r * T); ctx.lineTo(c * T + T - 1, r * T + T); }
    if (open[2]) { ctx.moveTo(c * T, r * T + T - 1); ctx.lineTo(c * T + T, r * T + T - 1); }
    if (open[3]) { ctx.moveTo(c * T + 1, r * T); ctx.lineTo(c * T + 1, r * T + T); }
    ctx.stroke();
  }
  // Gate headers
  for (const g of lv.gates) {
    ctx.fillStyle = rgba(C.pink, 0.25);
    ctx.fillRect(g.x + 4, g.y - 8, T - 8, 8);
  }
  return cv;
}

// ---- Bodies -------------------------------------------------------------------------------

// A capsule figure with a round head, feet at (cx, bottom). Drawn about 32×44.
export function drawFigure(ctx, cx, bottom, o) {
  const { color, alpha = 1, dashed = false, facing = 1, run = false, air = false, t = 0, sx = 1, sy = 1 } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  drawGlow(ctx, color, cx, bottom - 20, dashed ? 34 : 44);
  ctx.translate(cx, bottom);
  ctx.scale(sx, sy);
  const lean = run ? facing * 0.14 : air ? facing * 0.06 : 0;
  ctx.transform(1, 0, -lean, 1, 0, 0);
  const bob = run ? Math.abs(Math.sin(t * 18)) * 1.5 : 0;
  // body
  rrect(ctx, -11, -28 - bob, 22, 28 + bob, 10);
  ctx.fillStyle = dashed ? rgba(color, 0.22) : color;
  ctx.fill();
  if (dashed) { ctx.setLineDash([5, 4]); ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke(); }
  // head
  ctx.beginPath(); ctx.arc(facing * 1.5, -37 - bob, 8, 0, Math.PI * 2);
  ctx.fillStyle = dashed ? rgba(color, 0.22) : color; ctx.fill();
  if (dashed) { ctx.stroke(); ctx.setLineDash([]); }
  else { ctx.lineWidth = 2; ctx.strokeStyle = rgba(C.pale, 0.8); ctx.stroke(); }
  ctx.restore();
}

export function drawSilhouette(ctx, cx, bottom, t) {
  ctx.save();
  ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.15;
  ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.strokeStyle = C.violet;
  rrect(ctx, cx - 11, bottom - 28, 22, 28, 10); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, bottom - 37, 8, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawBadge(ctx, x, y, n, opt = {}) {
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
  ctx.fillStyle = C.navy; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = C.violet; ctx.stroke();
  text(ctx, String(n), x, y + 1, 13, C.pale, 'center', 900);
  if (opt.resting) {   // ‖
    ctx.fillStyle = C.pale;
    ctx.fillRect(x + 13, y - 6, 2.5, 12); ctx.fillRect(x + 18, y - 6, 2.5, 12);
  }
}

// ---- Devices ------------------------------------------------------------------------------

export function drawPlate(ctx, p, pressed, t) {
  const sink = pressed ? 4 : 0;
  const x = p.x0 + 4, y = p.y - 6 + sink;
  if (pressed) drawGlow(ctx, C.yellow, p.x0 + T / 2, p.y, 30);
  rrect(ctx, x, y, T - 8, 8, 3);
  ctx.fillStyle = pressed ? C.yellow : rgba(C.yellow, 0.45); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = C.yellow; ctx.stroke();
  drawGlyph(ctx, p.ch, p.x0 + T / 2, p.y + 14, 6, pressed ? C.yellow : rgba(C.yellow, 0.6));
  void t;
}

export function drawGate(ctx, g, open, wantOpen) {
  const h = g.hpx * (1 - open);
  if (h > 0.5) {
    ctx.save();
    ctx.beginPath(); ctx.rect(g.x + 6, g.y, T - 12, h); ctx.clip();
    ctx.fillStyle = rgba(C.pink, 0.3); ctx.fillRect(g.x + 6, g.y, T - 12, h);
    ctx.strokeStyle = C.pink; ctx.lineWidth = 4;
    ctx.beginPath();
    for (let k = -T; k < g.hpx + T; k += 16) { ctx.moveTo(g.x + 6, g.y + h - k); ctx.lineTo(g.x + T - 6, g.y + h - k - 14); }
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 2.5; ctx.strokeStyle = C.pink; ctx.strokeRect(g.x + 6, g.y, T - 12, h);
  }
  // Header with the channel glyph(s)
  rrect(ctx, g.x + 2, g.y - 12, T - 4, 14, 4);
  ctx.fillStyle = C.navy; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.pink; ctx.stroke();
  g.chans.forEach((ch, i) => drawGlyph(ctx, ch, g.x + T / 2 + (i - (g.chans.length - 1) / 2) * 12, g.y - 5, 5, wantOpen ? C.yellow : rgba(C.yellow, 0.55)));
  if (g.invert) { ctx.strokeStyle = C.pink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g.x + 10, g.y - 2); ctx.lineTo(g.x + T - 10, g.y - 10); ctx.stroke(); }
}

export function drawExit(ctx, ex, t) {
  const cx = ex.col * T + T / 2, bottom = (ex.row + 1) * T;
  drawGlow(ctx, C.cyan, cx, bottom - 36, 52 + Math.sin(t * 3) * 4);
  ctx.beginPath();
  ctx.moveTo(cx - 17, bottom); ctx.lineTo(cx - 17, bottom - 58);
  ctx.arc(cx, bottom - 58, 17, Math.PI, 0);
  ctx.lineTo(cx + 17, bottom);
  ctx.fillStyle = rgba(C.cyan, 0.18); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = C.cyan; ctx.stroke();
  // chevron ▲ above it
  const y = bottom - 92 + Math.sin(t * 4) * 3;
  ctx.beginPath(); ctx.moveTo(cx - 8, y + 5); ctx.lineTo(cx, y - 4); ctx.lineTo(cx + 8, y + 5);
  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
}

export function drawKeycap(ctx, x, y, label, alpha = 1, w = 0) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `800 16px ${FONT}`;
  const ww = w || Math.max(30, label.length * 10 + 16);
  rrect(ctx, x - ww / 2, y - 15, ww, 30, 7);
  ctx.fillStyle = rgba(C.navy, 0.9); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = C.pale; ctx.stroke();
  ctx.fillStyle = C.pale; ctx.fillRect(x - ww / 2 + 4, y + 11, ww - 8, 2);
  text(ctx, label, x, y - 1, 15, C.pale, 'center', 800);
  ctx.restore();
}

// Ring around the live player (GDD 3.4): empties clockwise, a tick per second,
// dashed and pulsing in the last 2 s, full and breathing with ▶ before the clock starts.
export function drawRing(ctx, cx, cy, o) {
  const { frac, waiting, last2, loopSec, t, ffwd } = o;
  const R = 34;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = rgba(C.pale, 0.12);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  const color = last2 ? C.pink : C.cyan;
  let r = R;
  if (waiting) r = R + Math.sin(t * 3) * 2;
  if (last2) { r = R + Math.abs(Math.sin(t * 10)) * 2.5; ctx.setLineDash([6, 5]); }
  ctx.strokeStyle = color;
  ctx.globalAlpha = waiting ? 0.75 : 1;
  ctx.beginPath();
  const a0 = -Math.PI / 2 + (1 - frac) * Math.PI * 2;
  ctx.arc(cx, cy, r, a0, -Math.PI / 2 + Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // second ticks
  ctx.lineWidth = 2;
  for (let s = 0; s < loopSec; s++) {
    const a = -Math.PI / 2 + (s / loopSec) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4)); ctx.lineTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (waiting) {
    ctx.fillStyle = C.cyan;
    ctx.beginPath(); ctx.moveTo(cx + R + 8, cy - 6); ctx.lineTo(cx + R + 17, cy); ctx.lineTo(cx + R + 8, cy + 6); ctx.fill();
  }
  if (ffwd) text(ctx, '»', cx, cy - R - 10, 20, C.cyan, 'center', 900);
  ctx.restore();
}
