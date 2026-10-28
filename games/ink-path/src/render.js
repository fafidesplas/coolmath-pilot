// Everything drawn in code (GDD 9): Toybox Flat with a paper-craft feel. The
// paper and walls of a level are pre-rendered once; balls, cups, ink and the HUD
// are drawn each frame. Trig is fine here: rendering never feeds the sim.
import { FIELD_W, FIELD_H, BALL, CUP, PEN, COLORS as C } from './config.js';
import { hatchRect } from './level.js';

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

export function text(ctx, str, x, y, size, color = C.outline, align = 'center', weight = 800, outline = 0) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (outline) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = outline;
    ctx.strokeStyle = C.outline;
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function polyPath(ctx, poly, dx = 0, dy = 0) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
  ctx.closePath();
}

// Lined notebook paper (GDD 9: blue lines at 15%, a coral margin line).
export function drawPaper(ctx, w, h) {
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(58,111,216,0.15)'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let y = 40; y < h; y += 40) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(239,91,91,0.35)';
  ctx.beginPath(); ctx.moveTo(90, 0); ctx.lineTo(90, h); ctx.stroke();
}

// Pre-rendered level layer: paper, cardboard walls with shadows, no-ink zones.
export function renderLevelLayer(lv, pixelScale) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(FIELD_W * pixelScale);
  cv.height = Math.ceil(FIELD_H * pixelScale);
  const ctx = cv.getContext('2d');
  ctx.scale(pixelScale, pixelScale);
  drawPaper(ctx, FIELD_W, FIELD_H);
  for (const z of lv.noInk) drawNoInk(ctx, z);
  ctx.lineJoin = 'round';
  for (const w of lv.walls) { polyPath(ctx, w, 5, 6); ctx.fillStyle = 'rgba(43,43,43,0.15)'; ctx.fill(); }
  for (const w of lv.walls) {
    polyPath(ctx, w); ctx.fillStyle = C.card; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = C.outline; ctx.stroke();
  }
  // Corrugation lines on the cardboard, clipped to each wall.
  for (const w of lv.walls) {
    ctx.save(); polyPath(ctx, w); ctx.clip();
    ctx.strokeStyle = 'rgba(43,43,43,0.08)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = -FIELD_H; x < FIELD_W; x += 14) { ctx.moveTo(x, FIELD_H); ctx.lineTo(x + FIELD_H, 0); }
    ctx.stroke();
    ctx.restore();
  }
  return cv;
}

export function drawNoInk(ctx, z, alpha = 1) {
  ctx.save();
  polyPath(ctx, z); ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(255,201,60,0.25)'; ctx.fill();
  ctx.strokeStyle = 'rgba(43,43,43,0.35)'; ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = -FIELD_H; x < FIELD_W; x += 16) { ctx.moveTo(x, FIELD_H); ctx.lineTo(x + FIELD_H, 0); }
  ctx.stroke();
  ctx.restore();
}

function linePath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
}

// Ink overlays (GDD 3.5): never two alike.
export function drawInk(ctx, pts, style, t = 0) {
  if (!pts || pts.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  linePath(ctx, pts);
  if (style === 'ghost') {
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = PEN.inkR * 2; ctx.strokeStyle = C.ink; ctx.stroke();
  } else if (style === 'hint') {
    ctx.setLineDash([2, 12]); ctx.lineWidth = 6; ctx.strokeStyle = C.grey; ctx.stroke();
  } else if (style === 'guide') {
    ctx.setLineDash([18, 14]); ctx.lineDashOffset = -t * 40;
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(58,111,216,0.55)'; ctx.stroke();
  } else {
    // Live or solid: paper rim, ink, gloss.
    ctx.lineWidth = PEN.inkR * 2 + 4; ctx.strokeStyle = C.paper; ctx.stroke();
    ctx.lineWidth = PEN.inkR * 2; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.lineWidth = 2.5; ctx.strokeStyle = style === 'set' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)';
    ctx.save(); ctx.translate(-1.5, -2); linePath(ctx, pts); ctx.stroke(); ctx.restore();
  }
  ctx.restore();
}

export function drawStar(ctx, x, y, r, fill, numeral = '') {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r;
    i ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.16); ctx.strokeStyle = C.outline; ctx.stroke();
  if (numeral) text(ctx, numeral, x, y + r * 0.08, r * 0.8, C.outline, 'center', 900);
}

// A paper cup with a flag (GDD 5). sq: squash spring.
export function drawCup(ctx, c, t, sq = { sx: 1, sy: 1 }) {
  ctx.save();
  ctx.translate(c.x, c.y + CUP.depth + CUP.wall);
  ctx.scale(sq.sx, sq.sy);
  ctx.translate(-c.x, -(c.y + CUP.depth + CUP.wall));
  ctx.lineJoin = 'round';
  // shadow, then body
  ctx.beginPath(); c.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x + 5, y + 6) : ctx.moveTo(x + 5, y + 6))); ctx.closePath();
  ctx.fillStyle = 'rgba(43,43,43,0.15)'; ctx.fill();
  const L = c.x - c.w / 2, R = c.x + c.w / 2;
  ctx.fillStyle = 'rgba(92,196,107,0.25)'; ctx.fillRect(L, c.y, c.w, CUP.depth);
  ctx.beginPath(); c.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = C.green; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = C.outline; ctx.stroke();
  // stripes
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(L - 6, c.y + 14); ctx.lineTo(L - 6, c.y + CUP.depth); ctx.moveTo(R + 6, c.y + 14); ctx.lineTo(R + 6, c.y + CUP.depth); ctx.stroke();
  // flag on the back (or left) wall
  const fx = c.board ? (c.boardSide === 'left' ? L - 6 : R + 6) : R + 6;
  const fy = c.y - c.board;
  ctx.strokeStyle = C.outline; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 44); ctx.stroke();
  const wave = Math.sin(t * 5) * 4;
  ctx.beginPath(); ctx.moveTo(fx, fy - 44); ctx.quadraticCurveTo(fx + 16, fy - 40 + wave, fx + 30, fy - 34); ctx.lineTo(fx, fy - 24); ctx.closePath();
  ctx.fillStyle = C.yellow; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
  ctx.restore();
}

// Trapdoor hatch with a hinge; k = how open (0..1).
export function drawTrapdoor(ctx, b, k) {
  const [x0, y0, x1, y1] = hatchRect(b);
  ctx.save();
  ctx.lineWidth = 3; ctx.strokeStyle = C.outline; ctx.fillStyle = C.card;
  // bracket
  ctx.beginPath(); ctx.moveTo(x0 - 6, y0 - 34); ctx.lineTo(x0 - 6, y1); ctx.moveTo(x1 + 6, y0 - 34); ctx.lineTo(x1 + 6, y1); ctx.stroke();
  // two flaps that swing down from the sides
  for (const side of [-1, 1]) {
    const hx = side < 0 ? x0 : x1;
    ctx.save(); ctx.translate(hx, y0 + 5); ctx.rotate(-side * k * 1.4);
    rrect(ctx, side < 0 ? 0 : -(x1 - x0) / 2, -5, (x1 - x0) / 2, 10, 3); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// Dot (GDD 3.3): coral, shiny, big face. o: { sx, sy, spin, look: [dx, dy], mood }
export function drawBall(ctx, x, y, o = {}) {
  const r = BALL.r, mood = o.mood || 'idle';
  ctx.save();
  ctx.translate(x, y);
  if (o.stretchAngle !== undefined) {
    ctx.rotate(o.stretchAngle); ctx.scale(o.sx ?? 1, o.sy ?? 1); ctx.rotate(-o.stretchAngle);
  } else ctx.scale(o.sx ?? 1, o.sy ?? 1);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = o.color || C.coral; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = C.outline; ctx.stroke();
  // spinning highlight dot (visual only)
  const sp = o.spin || 0;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(Math.cos(sp - 2.3) * 10, Math.sin(sp - 2.3) * 10, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.arc(-6, -8, 5, 0, Math.PI * 2); ctx.fill();
  // face
  const [lx, ly] = o.look || [0, 0];
  const ex = Math.max(-2.5, Math.min(2.5, lx)), ey = Math.max(-2.5, Math.min(2.5, ly));
  ctx.fillStyle = C.outline; ctx.strokeStyle = C.outline; ctx.lineCap = 'round'; ctx.lineWidth = 2.5;
  if (mood === 'dizzy') {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * 7 - 3, -6); ctx.lineTo(s * 7 + 3, 0); ctx.moveTo(s * 7 + 3, -6); ctx.lineTo(s * 7 - 3, 0); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 8, 4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  } else if (mood === 'happy') {
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * 7, -2, 4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 4, 7, 0.15 * Math.PI, 0.85 * Math.PI); ctx.fill();
  } else {
    const squint = mood === 'squint';
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(s * 7, -3, 5, squint ? 2.5 : 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = C.outline;
      ctx.beginPath(); ctx.arc(s * 7 + ex, -3 + (squint ? 0 : ey), 2.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineWidth = 2.5;
    if (mood === 'fast' || mood === 'fall') { ctx.beginPath(); ctx.ellipse(0, 9, 4, 5, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(0, 6, 5, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
  }
  ctx.restore();
}

export function drawBubble(ctx, x, y, label, k = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(k, k);
  ctx.font = `900 22px ${FONT}`;
  const w = ctx.measureText(label).width + 26;
  rrect(ctx, -w / 2, -22, w, 40, 14);
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.outline; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, 17); ctx.lineTo(0, 30); ctx.lineTo(8, 17); ctx.fillStyle = '#fff'; ctx.fill();
  text(ctx, label, 0, -2, 22, C.outline, 'center', 900);
  ctx.restore();
}

// A cross (✕) mark: drop preview end, blocked tether end.
export function drawCross(ctx, x, y, s, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
}

// The ghost hand of level 1's guide: a fingertip with a soft ring.
export function drawHand(ctx, x, y, press) {
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.beginPath(); ctx.arc(x, y, 10 + press * 6, 0, Math.PI * 2);
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.stroke();
  ctx.translate(x + 4, y + 4); ctx.rotate(-0.5);
  rrect(ctx, -7, 0, 14, 34, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.outline; ctx.stroke();
  rrect(ctx, -12, 22, 24, 30, 10); ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function drawLock(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineWidth = 4; ctx.strokeStyle = C.outline;
  ctx.beginPath(); ctx.arc(0, -8, 9, Math.PI, 0); ctx.stroke();
  rrect(ctx, -14, -8, 28, 22, 5); ctx.fillStyle = C.grey; ctx.fill(); ctx.stroke();
  ctx.restore();
}

// The gold nib badge (dev record matched).
export function drawNib(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(-9, -4); ctx.lineTo(-6, -14); ctx.lineTo(6, -14); ctx.lineTo(9, -4); ctx.closePath();
  ctx.fillStyle = C.yellow; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.outline; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 12); ctx.lineTo(0, -2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -3, 2, 0, Math.PI * 2); ctx.fillStyle = C.outline; ctx.fill();
  ctx.restore();
}

// CSS cursors (GDD 4): a pen nib, and a crossed nib over blocked areas.
export function makeCursor(crossed) {
  try {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const ctx = cv.getContext('2d');
    ctx.translate(4, 28); ctx.rotate(-Math.PI / 4);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-7, -14); ctx.lineTo(-5, -26); ctx.lineTo(5, -26); ctx.lineTo(7, -14); ctx.closePath();
    ctx.fillStyle = crossed ? '#ccc' : C.ink; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (crossed) { ctx.strokeStyle = C.coral; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(14, 4); ctx.lineTo(28, 18); ctx.moveTo(28, 4); ctx.lineTo(14, 18); ctx.stroke(); }
    return `url(${cv.toDataURL()}) 4 28, crosshair`;
  } catch { return 'crosshair'; }
}
