// Everything drawn in code (GDD 9): Toybox Flat, a cardboard-and-wood diorama.
// Background, terrain and the build grid are pre-rendered once per level; pieces,
// vehicles and particles are drawn each frame. Trig is fine here: rendering never
// feeds the sim. Field coordinates: 1 cell = 40 px, origin at the playfield's top-left.
import { FIELD_W, FIELD_H, CELL, COLORS as C, VEHICLES } from './config.js';

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

export const money = n => '$' + Math.round(n).toLocaleString('en-US');

function polyPath(ctx, poly, s = CELL, dx = 0, dy = 0) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x * s + dx, y * s + dy) : ctx.moveTo(x * s + dx, y * s + dy)));
  ctx.closePath();
}

const isBank = p => p.some(q => q[0] <= 0 || q[0] >= 32);

// Sky, hills, water, banks, rocks and the flag, pre-rendered.
export function renderBackground(lv, pixelScale, makeCanvas) {
  const cv = makeCanvas(Math.ceil(FIELD_W * pixelScale), Math.ceil(FIELD_H * pixelScale));
  const ctx = cv.getContext('2d');
  ctx.scale(pixelScale, pixelScale);
  drawScene(ctx, lv);
  return cv;
}

export function drawScene(ctx, lv) {
  // sky: cream with a light blue tint, flat bands (no full-screen gradient per frame)
  ctx.fillStyle = '#DCEEF7'; ctx.fillRect(0, 0, FIELD_W, FIELD_H);
  ctx.fillStyle = '#E9F3F4'; ctx.fillRect(0, FIELD_H * 0.35, FIELD_W, FIELD_H);
  // clouds
  ctx.fillStyle = '#fff';
  for (const [x, y, s] of [[150, 70, 1], [520, 40, 0.8], [980, 90, 1.1], [1180, 30, 0.7]]) {
    ctx.beginPath(); ctx.arc(x, y, 22 * s, 0, 7); ctx.arc(x + 26 * s, y - 8 * s, 26 * s, 0, 7); ctx.arc(x + 54 * s, y, 20 * s, 0, 7); ctx.fill();
  }
  // far hills (cardboard cutouts)
  ctx.fillStyle = '#B9DDB0';
  ctx.beginPath(); ctx.moveTo(0, 260);
  for (let x = 0; x <= FIELD_W; x += 40) ctx.lineTo(x, 250 - Math.sin(x / 140) * 40 - Math.sin(x / 57) * 10);
  ctx.lineTo(FIELD_W, FIELD_H); ctx.lineTo(0, FIELD_H); ctx.fill();
  // water
  if (lv.water !== null) {
    const wy = lv.water * CELL;
    ctx.fillStyle = C.blue; ctx.fillRect(0, wy, FIELD_W, FIELD_H - wy);
    ctx.fillStyle = '#3B8DC4'; ctx.fillRect(0, wy + 50, FIELD_W, FIELD_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) { const x = (i * 97) % FIELD_W, y = wy + 14 + (i % 3) * 22; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 30, y); ctx.stroke(); }
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, wy); ctx.lineTo(FIELD_W, wy); ctx.stroke();
  }
  // terrain: shadow, earth or rock, outline, grass on the bank tops
  ctx.lineJoin = 'round';
  for (const p of lv.terrain) { polyPath(ctx, p, CELL, 6, 7); ctx.fillStyle = 'rgba(43,43,43,0.15)'; ctx.fill(); }
  for (const p of lv.terrain) {
    polyPath(ctx, p); ctx.fillStyle = isBank(p) ? C.earth : '#9C978E'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.save(); polyPath(ctx, p); ctx.clip();
    ctx.fillStyle = 'rgba(43,43,43,0.12)';
    for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc((i * 131) % FIELD_W, 300 + (i * 53) % 260, 3 + (i % 3), 0, 7); ctx.fill(); }
    ctx.restore();
    if (isBank(p)) {
      ctx.strokeStyle = C.green; ctx.lineWidth = 8; ctx.lineCap = 'round';
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        if (a[1] === b[1] && a[1] === Math.min(...p.map(q => q[1]))) { ctx.beginPath(); ctx.moveTo(a[0] * CELL, a[1] * CELL + 3); ctx.lineTo(b[0] * CELL, b[1] * CELL + 3); ctx.stroke(); }
      }
    } else {
      ctx.fillStyle = C.green; ctx.beginPath(); ctx.ellipse(p[0][0] * CELL - 6, p[0][1] * CELL + 16, 10, 5, -0.4, 0, 7); ctx.fill();   // moss
    }
  }
  // scenery at the edges: trees, never over the build area
  for (const x of [60, 170, 1110, 1220]) drawTree(ctx, x, lv.leftTop * CELL);
  // flag
  const fx = lv.flag * CELL, fy = lv.rightTop * CELL;
  ctx.fillStyle = C.ink; ctx.fillRect(fx - 3, fy - 92, 6, 92);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    ctx.fillStyle = (r + c) % 2 ? C.ink : '#fff';
    ctx.fillRect(fx + 3 + c * 11, fy - 90 + r * 11, 11, 11);
  }
  ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(fx + 3, fy - 90, 44, 33);
}

function drawTree(ctx, x, ground) {
  ctx.fillStyle = '#8A5A33'; ctx.fillRect(x - 5, ground - 50, 10, 50);
  ctx.beginPath(); ctx.arc(x, ground - 64, 28, 0, 7); ctx.fillStyle = '#4FAE5E'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.strokeRect(x - 5, ground - 36, 10, 36);
}

// The dashed build area and its grid dots (build mode only).
export function renderGrid(lv, pixelScale, makeCanvas) {
  const cv = makeCanvas(Math.ceil(FIELD_W * pixelScale), Math.ceil(FIELD_H * pixelScale));
  const ctx = cv.getContext('2d');
  ctx.scale(pixelScale, pixelScale);
  const a = lv.buildArea;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(a.x * CELL, a.y * CELL, a.w * CELL, a.h * CELL);
  ctx.setLineDash([10, 8]); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(43,43,43,0.55)';
  ctx.strokeRect(a.x * CELL, a.y * CELL, a.w * CELL, a.h * CELL);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(43,43,43,0.35)';
  for (let x = a.x; x <= a.x + a.w; x++) for (let y = a.y; y <= a.y + a.h; y++) {
    ctx.beginPath(); ctx.arc(x * CELL, y * CELL, 2.5, 0, 7); ctx.fill();
  }
  for (const z of lv.noBuild) {
    ctx.save(); ctx.beginPath(); ctx.rect(z.x * CELL, z.y * CELL, z.w * CELL, z.h * CELL); ctx.clip();
    ctx.strokeStyle = 'rgba(239,91,91,0.5)'; ctx.lineWidth = 3;
    for (let k = -FIELD_H; k < FIELD_W; k += 14) { ctx.beginPath(); ctx.moveTo(k, FIELD_H); ctx.lineTo(k + FIELD_H, 0); ctx.stroke(); }
    ctx.restore();
  }
  return cv;
}

// Stress ratio → fill color: green (0–40%) → yellow (60%) → orange (80%) → red (95%+).
const STOPS = [[0, [92, 196, 107]], [0.4, [92, 196, 107]], [0.6, [255, 201, 60]], [0.8, [247, 140, 60]], [0.95, [239, 91, 91]]];
export function stressColor(r) {
  if (r >= 0.95) return C.red;
  for (let i = 1; i < STOPS.length; i++) {
    const [b, cb] = STOPS[i];
    if (r <= b) {
      const [a, ca] = STOPS[i - 1], k = (r - a) / (b - a || 1);
      return `rgb(${ca.map((v, j) => Math.round(v + (cb[j] - v) * k)).join(',')})`;
    }
  }
  return C.red;
}

export const MAT_FILL = { road: C.ink, wood: C.wood, steel: C.steel, cable: C.ink };
const BASE_W = { road: 13, wood: 10, steel: 11, cable: 3 };

// One member, from (ax, ay) to (bx, by) in field px.
// o: { alpha, stress (0..1 or null), dash, invalid, shake }
export function drawMember(ctx, mat, ax, ay, bx, by, o = {}) {
  const dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len, uy = dy / len;
  let nx = -uy, ny = ux; if (ny < 0) { nx = -nx; ny = -ny; }   // normal pointing down
  const s = o.stress;
  let w = BASE_W[mat];
  if (s != null && s > 0.5) w *= 1 + Math.min(0.5, (s - 0.5));          // +50% width from 50% to 100%
  if (o.shake) { ax += o.shake[0]; ay += o.shake[1]; bx += o.shake[0]; by += o.shake[1]; }
  // the road's top surface is the member line (wheels touch it)
  if (mat === 'road') { const off = w / 2; ax += nx * off; ay += ny * off; bx += nx * off; by += ny * off; }
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.lineCap = 'round';
  const fill = o.invalid ? C.red : s != null ? stressColor(s) : (o.tint || MAT_FILL[mat]);
  if (o.dash) ctx.setLineDash(o.dash);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
  if (mat === 'cable') {
    ctx.lineWidth = w + (s != null ? 2 : 0); ctx.strokeStyle = s != null || o.invalid || o.tint ? fill : C.ink; ctx.stroke();
  } else {
    ctx.lineWidth = w + 5; ctx.strokeStyle = C.ink; ctx.stroke();
    ctx.lineWidth = w; ctx.strokeStyle = fill; ctx.stroke();
    if (mat === 'road' && !o.dash) {
      ctx.setLineDash([8, 10]); ctx.lineWidth = 2.5; ctx.strokeStyle = s != null && !o.tint ? 'rgba(43,43,43,0.6)' : C.yellow; ctx.stroke(); ctx.setLineDash([]);
    } else if (mat === 'wood' && !o.dash) {
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(43,43,43,0.3)';
      ctx.beginPath(); ctx.moveTo(ax + ux * 8 + nx * 1.5, ay + uy * 8 + ny * 1.5); ctx.lineTo(bx - ux * 14 + nx * 1.5, by - uy * 14 + ny * 1.5); ctx.stroke();
    } else if (mat === 'steel' && !o.dash) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let k = 12; k < len - 8; k += 18) { ctx.beginPath(); ctx.arc(ax + ux * k, ay + uy * k, 1.8, 0, 7); ctx.fill(); }
    }
  }
  // chevrons at 75% or more (not color alone)
  if (s != null && s >= 0.75 && len > 24) {
    ctx.setLineDash([]);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    for (const k of [-8, 0, 8]) {
      const cx = mx + ux * k, cy = my + uy * k;
      ctx.beginPath(); ctx.moveTo(cx - ux * 3 - nx * 4, cy - uy * 3 - ny * 4); ctx.lineTo(cx + ux * 3, cy + uy * 3); ctx.lineTo(cx - ux * 3 + nx * 4, cy - uy * 3 + ny * 4); ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawJoint(ctx, x, y, anchor, pulse = 0, face = false) {
  const r = (anchor ? 14 : 7) * (1 + pulse * 0.4);
  ctx.save();
  if (anchor) { ctx.beginPath(); ctx.arc(x + 3, y + 4, r, 0, 7); ctx.fillStyle = 'rgba(43,43,43,0.25)'; ctx.fill(); }
  if (face) { rrect(ctx, x - 18, y - 18, 36, 36, 6); ctx.fillStyle = '#C7CCD1'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
  ctx.fillStyle = anchor ? '#fff' : '#E9E4DA'; ctx.fill();
  ctx.lineWidth = anchor ? 3.5 : 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
  if (anchor) { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y); ctx.moveTo(x, y - 6); ctx.lineTo(x, y + 6); ctx.stroke(); }
  else { ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill(); }
  ctx.restore();
}

// A vehicle from its two wheel centers (field px). o: { mood, t, sweat, tag, skin }
export function drawVehicle(ctx, name, fx, fy, rx, ry, o = {}) {
  const v = VEHICLES[name], r = v.r * CELL;
  const ang = Math.atan2(fy - ry, fx - rx), base = Math.hypot(fx - rx, fy - ry);
  const t = o.t || 0;
  ctx.save();
  ctx.translate(rx, ry); ctx.rotate(ang);
  const bob = o.idle ? Math.sin(t * 9) * 1.2 : 0;
  ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = C.ink;
  const color = name === 'bus' ? C.yellow : C.red;
  ctx.translate(0, bob);
  if (name === 'truck') {
    rrect(ctx, -r - 6, -r - 46, base * 0.62 + r, 46, 6); ctx.fillStyle = '#F6EFE3'; ctx.fill(); ctx.stroke();     // cargo box
    ctx.fillStyle = 'rgba(43,43,43,0.15)'; ctx.fillRect(-r, -r - 38, base * 0.5, 4);
    rrect(ctx, base * 0.62 - 6, -r - 40, base * 0.38 + r + 10, 40, 10); ctx.fillStyle = color; ctx.fill(); ctx.stroke();   // cab
    rrect(ctx, -r - 8, -r - 4, base + 2 * r + 12, 12, 5); ctx.fillStyle = color; ctx.fill(); ctx.stroke();
  } else if (name === 'car') {
    ctx.beginPath(); ctx.moveTo(-r - 8, -r + 6); ctx.lineTo(-r - 8, -r - 14); ctx.quadraticCurveTo(base * 0.2, -r - 40, base * 0.65, -r - 26);
    ctx.quadraticCurveTo(base + r + 12, -r - 22, base + r + 10, -r + 6); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.stroke();
  } else {
    rrect(ctx, -r - 10, -r - 50, base + 2 * r + 20, 56, 10); ctx.fillStyle = color; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#BFE3F5'; for (let k = 0; k < 4; k++) { rrect(ctx, -r + k * 26, -r - 42, 20, 18, 4); ctx.fill(); ctx.stroke(); }
  }
  // face on the front
  const ex = name === 'truck' ? base * 0.62 + 18 : base * 0.62, ey = name === 'car' ? -r - 16 : -r - 24;
  const mood = o.mood || 'idle';
  for (const k of [0, 13]) {
    ctx.beginPath(); ctx.ellipse(ex + k, ey, 5.5, mood === 'scared' ? 8 : 6.5, 0, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(ex + k + 2, ey + (mood === 'fall' ? -2 : 1), 2.6, 0, 7); ctx.fillStyle = C.ink; ctx.fill();
  }
  ctx.lineWidth = 2.5;
  if (mood === 'fall') { ctx.beginPath(); ctx.ellipse(ex + 7, ey + 13, 4, 5, 0, 0, 7); ctx.fillStyle = C.ink; ctx.fill(); }
  else if (mood === 'grin') { ctx.beginPath(); ctx.arc(ex + 7, ey + 8, 7, 0.1 * Math.PI, 0.9 * Math.PI); ctx.fillStyle = C.ink; ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(ex + 7, ey + 8, 5, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
  if (o.sweat) { ctx.beginPath(); ctx.moveTo(ex - 8, ey - 12); ctx.quadraticCurveTo(ex - 14, ey - 2, ex - 8, ey); ctx.quadraticCurveTo(ex - 2, ey - 2, ex - 8, ey - 12); ctx.fillStyle = '#BFE3F5'; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.translate(0, -bob);
  // wheels
  for (const wx of [0, base]) {
    ctx.beginPath(); ctx.arc(wx, 0, r, 0, 7); ctx.fillStyle = C.ink; ctx.fill();
    ctx.beginPath(); ctx.arc(wx, 0, r * 0.45, 0, 7); ctx.fillStyle = '#ccc'; ctx.fill();
    const sp = (o.spin || 0) + (wx ? 1 : 0);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx, 0); ctx.lineTo(wx + Math.cos(sp) * r * 0.45, Math.sin(sp) * r * 0.45); ctx.stroke();
  }
  ctx.restore();
  if (o.tag) {
    ctx.save();
    const mx = (fx + rx) / 2, my = Math.min(fy, ry) - r - 78;
    ctx.font = `800 18px ${FONT}`;
    const w = ctx.measureText(o.tag).width + 20;
    rrect(ctx, mx - w / 2, my - 15, w, 30, 10); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
    text(ctx, o.tag, mx, my, 18, C.ink, 'center', 800);
    ctx.restore();
  }
}

export function drawBubble(ctx, x, y, label, k = 1, color = '#fff') {
  ctx.save();
  ctx.translate(x, y); ctx.scale(k, k);
  ctx.font = `900 22px ${FONT}`;
  const w = ctx.measureText(label).width + 28;
  rrect(ctx, -w / 2, -22, w, 40, 14);
  ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, 17); ctx.lineTo(0, 30); ctx.lineTo(8, 17); ctx.fillStyle = color; ctx.fill();
  text(ctx, label, 0, -2, 22, C.ink, 'center', 900);
  ctx.restore();
}

export function drawStamp(ctx, label, x, y, k, color) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(-0.08); ctx.scale(k, k);
  ctx.font = `900 64px ${FONT}`;
  const w = ctx.measureText(label).width + 50;
  rrect(ctx, -w / 2, -48, w, 96, 16);
  ctx.fillStyle = 'rgba(246,239,227,0.92)'; ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = color; ctx.stroke();
  text(ctx, label, 0, 2, 64, color, 'center', 900);
  ctx.restore();
}

// The ghost hand (tutorial): a fingertip with a soft ring.
export function drawHand(ctx, x, y, press) {
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(x, y, 10 + press * 6, 0, 7);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
  ctx.translate(x + 4, y + 4); ctx.rotate(-0.5);
  rrect(ctx, -7, 0, 14, 34, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  rrect(ctx, -12, 22, 24, 30, 10); ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function drawLock(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineWidth = 4; ctx.strokeStyle = C.ink;
  ctx.beginPath(); ctx.arc(0, -8, 9, Math.PI, 0); ctx.stroke();
  rrect(ctx, -14, -8, 28, 22, 5); ctx.fillStyle = C.grey; ctx.fill(); ctx.stroke();
  ctx.restore();
}

// Hard-hat badge ("You beat the engineer!").
export function drawHardHat(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.arc(0, 4, 16, Math.PI, 0); ctx.closePath(); ctx.fillStyle = C.yellow; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
  rrect(ctx, -22, 2, 44, 7, 3); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(0, 2); ctx.stroke();
  ctx.restore();
}

export function drawCrack(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.red; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-3, -9); ctx.lineTo(3, -2); ctx.lineTo(-3, 2); ctx.lineTo(3, 9); ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}

// Toolbar icons, centered at (x, y).
export function drawIcon(ctx, name, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = 4;
  switch (name) {
    case 'road': case 'wood': case 'steel': case 'cable':
      drawMember(ctx, name, -20, 8, 20, -8);
      if (name !== 'road') { drawJoint(ctx, -20, 8, false); drawJoint(ctx, 20, -8, false); }
      break;
    case 'eraser':
      ctx.rotate(-0.6); rrect(ctx, -16, -9, 32, 18, 4); ctx.fillStyle = '#F4A6B0'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#fff'; rrect(ctx, 4, -9, 12, 18, 3); ctx.fill(); ctx.stroke(); break;
    case 'undo':
      ctx.beginPath(); ctx.arc(2, 2, 12, Math.PI * 1.1, Math.PI * 0.6, false); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-16, -8); ctx.lineTo(-11, 2); ctx.lineTo(-3, -6); ctx.stroke(); break;
    case 'clear':
      ctx.lineWidth = 3; rrect(ctx, -11, -8, 22, 22, 3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(15, -12); ctx.moveTo(-5, -16); ctx.lineTo(5, -16); ctx.moveTo(-4, -3); ctx.lineTo(-4, 9); ctx.moveTo(4, -3); ctx.lineTo(4, 9); ctx.stroke(); break;
    case 'mirror':
      ctx.lineWidth = 3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke(); ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(-6, -10); ctx.lineTo(-18, 8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6, -10); ctx.lineTo(18, 8); ctx.lineTo(6, 8); ctx.closePath(); ctx.stroke(); break;
    case 'eye':
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(0, -18, 18, 0); ctx.quadraticCurveTo(0, 18, -18, 0); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fillStyle = C.green; ctx.fill(); ctx.stroke(); break;
    case 'bulb':
      ctx.beginPath(); ctx.arc(0, -4, 12, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = C.ink; ctx.fillRect(-6, 10, 12, 7); break;
    case 'pause': ctx.fillRect(-9, -13, 7, 26); ctx.fillRect(3, -13, 7, 26); break;
    case 'restart':
      ctx.beginPath(); ctx.arc(0, 0, 13, -0.3, Math.PI * 1.55); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(15, -17); ctx.lineTo(18, 1); ctx.lineTo(1, -6); ctx.closePath(); ctx.fill(); break;
    case 'fast':
      for (const dx of [-12, 2]) { ctx.beginPath(); ctx.moveTo(dx, -12); ctx.lineTo(dx + 13, 0); ctx.lineTo(dx, 12); ctx.closePath(); ctx.fill(); }
      break;
  }
  ctx.restore();
}
