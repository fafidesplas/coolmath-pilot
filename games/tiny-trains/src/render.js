// Board, tiles, trains and particles, all drawn in code (Toybox Flat, GDD 9).
// Static track goes to an offscreen canvas once per level/resize; switches, trains,
// stations and depots are drawn every frame.
import { DX, DY, opp, switchArms } from './track.js';
import {
  INK, CREAM, WOOD, WOOD_LIGHT, WOOD_DARK, GRASS, GRASS_DARK, GREEN, TRAIN_COLORS, TRAIN_SHAPES,
  BOARD_AREA, CELL_MIN, CELL_MAX, mix, GOLD, PAPER,
} from './config.js';
import { T, img } from './theme.js';
export { GOLD };

export const MAT = 22; // grass margin around the board

export function computeLayout(level) {
  const a = BOARD_AREA;
  const cell = Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor(Math.min(a.w / level.w, a.h / level.h))));
  const bw = cell * level.w, bh = cell * level.h;
  return { cell, ox: Math.round(a.x + (a.w - bw) / 2), oy: Math.round(a.y + (a.h - bh) / 2), bw, bh };
}

// ---- Paths through a cell ----------------------------------------------------------
// A point along the path from edge e1 to edge e2, s in [0,1] (0.5 = the middle).
// Unit cell centered on 0,0. Writes x, y and the heading angle a into `out`.
export function pathPoint(e1, e2, s, out) {
  if (((e1 - e2) & 3) === 2 || e1 === e2) {
    const x1 = DX[e1] * 0.5, y1 = DY[e1] * 0.5, x2 = DX[e2] * 0.5, y2 = DY[e2] * 0.5;
    out.x = x1 + (x2 - x1) * s; out.y = y1 + (y2 - y1) * s;
    out.a = Math.atan2(DY[e2], DX[e2]);
    return out;
  }
  const cx = (DX[e1] + DX[e2]) * 0.5, cy = (DY[e1] + DY[e2]) * 0.5;
  const a1 = Math.atan2(-DY[e2], -DX[e2]), a2 = Math.atan2(-DY[e1], -DX[e1]);
  let d = a2 - a1;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  const ang = a1 + d * s;
  out.x = cx + Math.cos(ang) * 0.5; out.y = cy + Math.sin(ang) * 0.5;
  out.a = ang + Math.sign(d) * Math.PI / 2;
  return out;
}

const P = { x: 0, y: 0, a: 0 };
function segPath(ctx, px, py, cell, e1, e2, s0, s1, off) {
  const curved = ((e1 - e2) & 3) !== 2;
  const n = curved ? 10 : 1;
  for (let i = 0; i <= n; i++) {
    pathPoint(e1, e2, s0 + (s1 - s0) * (i / n), P);
    const x = px + (P.x - Math.sin(P.a) * off) * cell, y = py + (P.y + Math.cos(P.a) * off) * cell;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
}

// Track segments of a tile: [e1, e2, s0, s1, branch] (branch: 0 trunk→straight, 1 trunk→curved).
export function tileSegments(t) {
  const r = t.rot & 3;
  switch (t.t) {
    case 'straight': return [[r, opp(r), 0, 1, -1]];
    case 'curve': return [[r, (r + 1) & 3, 0, 1, -1]];
    case 'switch': { const a = switchArms(t); return [[a.trunk, a.straight, 0, 1, 0], [a.trunk, a.curved, 0, 1, 1]]; }
    case 'station': case 'buffer': case 'depot': return [[r, opp(r), 0, 0.5, -1]];
  }
  return [];
}

// Wooden toy track: ink outline, wood bed, two grooves. `layer` 0 = outline, 1 = bed, 2 = grooves.
function strokeSeg(ctx, px, py, cell, seg, layer, faded) {
  if (T.track === 'rail') { railSeg(ctx, px, py, cell, seg, layer, faded); return; }
  if (T.track === 'neon') { neonSeg(ctx, px, py, cell, seg, layer, faded); return; }
  const [e1, e2, s0, s1] = seg;
  ctx.lineCap = 'butt';
  if (layer === 0) {
    ctx.strokeStyle = faded ? mix(INK, CREAM, 0.6) : INK;
    ctx.lineWidth = cell * 0.44 + 6;
    ctx.beginPath(); segPath(ctx, px, py, cell, e1, e2, s0, s1, 0); ctx.stroke();
  } else if (layer === 1) {
    ctx.strokeStyle = faded ? mix(WOOD_LIGHT, CREAM, 0.55) : WOOD_LIGHT;
    ctx.lineWidth = cell * 0.44;
    ctx.beginPath(); segPath(ctx, px, py, cell, e1, e2, s0, s1, 0); ctx.stroke();
  } else {
    ctx.strokeStyle = faded ? mix(WOOD, CREAM, 0.55) : WOOD_DARK;
    ctx.lineWidth = Math.max(2, cell * 0.04);
    ctx.beginPath();
    segPath(ctx, px, py, cell, e1, e2, s0, s1, -0.11);
    segPath(ctx, px, py, cell, e1, e2, s0, s1, 0.11);
    ctx.stroke();
  }
}

// Railway track (art styles 'pixel' and 'meadow'): gravel bed, wooden sleepers, two
// steel rails. Same three passes as the wooden track so joints merge.
const RAIL = '#9AA0A8';
function railSeg(ctx, px, py, cell, seg, layer, faded) {
  const [e1, e2, s0, s1] = seg;
  ctx.save();
  if (faded) ctx.globalAlpha = 0.4;
  ctx.lineCap = 'butt';
  if (layer === 0) {
    ctx.strokeStyle = mix(INK, CREAM, 0.15);
    ctx.lineWidth = cell * 0.5 + 4;
    ctx.beginPath(); segPath(ctx, px, py, cell, e1, e2, s0, s1, 0); ctx.stroke();
    ctx.strokeStyle = mix(WOOD, '#B8B2A6', 0.7);
    ctx.lineWidth = cell * 0.5;
    ctx.stroke();
  } else if (layer === 1) {
    ctx.fillStyle = WOOD_DARK;
    const n = Math.max(1, Math.round((s1 - s0) * 4));
    for (let i = 0; i < n; i++) {
      pathPoint(e1, e2, s0 + (s1 - s0) * ((i + 0.5) / n), P);
      ctx.save();
      ctx.translate(px + P.x * cell, py + P.y * cell); ctx.rotate(P.a);
      ctx.fillRect(-cell * 0.045, -cell * 0.24, cell * 0.09, cell * 0.48);
      ctx.restore();
    }
  } else {
    for (const off of [-0.13, 0.13]) {
      ctx.beginPath(); segPath(ctx, px, py, cell, e1, e2, s0, s1, off);
      ctx.strokeStyle = INK; ctx.lineWidth = Math.max(3, cell * 0.06); ctx.stroke();
      ctx.strokeStyle = RAIL; ctx.lineWidth = Math.max(1.5, cell * 0.03); ctx.stroke();
    }
  }
  ctx.restore();
}

// Neon track (art style 'neon'): a dark bed, faint ties and two glowing rails.
function neonSeg(ctx, px, py, cell, seg, layer, faded) {
  const [e1, e2, s0, s1] = seg;
  ctx.save();
  ctx.lineCap = 'butt';
  if (faded) ctx.globalAlpha = 0.3;
  if (layer === 0) {
    ctx.strokeStyle = mix(CREAM, INK, 0.1);
    ctx.lineWidth = cell * 0.44;
    ctx.beginPath(); segPath(ctx, px, py, cell, e1, e2, s0, s1, 0); ctx.stroke();
  } else if (layer === 1) {
    ctx.strokeStyle = mix(CREAM, T.neon, 0.25); ctx.lineWidth = Math.max(1, cell * 0.02);
    const n = Math.max(1, Math.round((s1 - s0) * 4));
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      pathPoint(e1, e2, s0 + (s1 - s0) * ((i + 0.5) / n), P);
      const nx = -Math.sin(P.a) * 0.2, ny = Math.cos(P.a) * 0.2;
      ctx.moveTo(px + (P.x - nx) * cell, py + (P.y - ny) * cell); ctx.lineTo(px + (P.x + nx) * cell, py + (P.y + ny) * cell);
    }
    ctx.stroke();
  } else {
    ctx.strokeStyle = T.neon; ctx.lineWidth = Math.max(2, cell * 0.035);
    if (!faded) { ctx.shadowColor = T.neon; ctx.shadowBlur = cell * 0.12; }
    ctx.beginPath();
    segPath(ctx, px, py, cell, e1, e2, s0, s1, -0.12);
    segPath(ctx, px, py, cell, e1, e2, s0, s1, 0.12);
    ctx.stroke();
  }
  ctx.restore();
}

// Oval track for the title screen, in the current style's track look.
export function ovalTrack(ctx, cx, cy, rx, ry) {
  ctx.save();
  const ring = (dr, col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.ellipse(cx, cy, rx + dr, ry + dr, 0, 0, Math.PI * 2); ctx.stroke(); };
  if (T.track === 'rail' || T.track === 'neon') {
    const neon = T.track === 'neon';
    ring(0, neon ? mix(CREAM, INK, 0.1) : mix(INK, CREAM, 0.15), 46);
    if (!neon) ring(0, mix(WOOD, '#B8B2A6', 0.7), 42);
    ctx.strokeStyle = neon ? mix(CREAM, T.neon, 0.25) : WOOD_DARK; ctx.lineWidth = neon ? 2 : 8;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2, x = Math.cos(a), y = Math.sin(a);
      ctx.beginPath(); ctx.moveTo(cx + x * (rx - 19), cy + y * (ry - 19)); ctx.lineTo(cx + x * (rx + 19), cy + y * (ry + 19)); ctx.stroke();
    }
    if (neon) { ctx.shadowColor = T.neon; ctx.shadowBlur = 12; ring(-12, T.neon, 3); ring(12, T.neon, 3); }
    else { for (const d of [-12, 12]) { ring(d, INK, 6); ring(d, '#9AA0A8', 3); } }
  } else {
    ring(0, INK, 46); ring(0, WOOD_LIGHT, 40);
    ring(-9, WOOD, 3); ring(9, WOOD, 3);
  }
  ctx.restore();
}

// ---- Static board layer ------------------------------------------------------------
function hash(x, y, k) { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

export function buildBoardLayer(level, L, scale) {
  const W = L.bw + MAT * 2, H = L.bh + MAT * 2;
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(W * scale); cv.height = Math.ceil(H * scale);
  const ctx = cv.getContext('2d');
  ctx.scale(scale, scale);
  ctx.translate(MAT, MAT);
  const c = L.cell;
  // Shadow + grass mat
  ctx.fillStyle = 'rgba(46,36,64,0.18)';
  roundRect(ctx, -MAT + 4, -MAT + 8, W, H, 28); ctx.fill();
  ctx.fillStyle = GRASS; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  roundRect(ctx, -MAT, -MAT, W, H, 28 * T.radius); ctx.fill();
  const tiled = grassTiles(ctx, level, c, W, H);
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  roundRect(ctx, -MAT, -MAT, W, H, 28 * T.radius); ctx.stroke();
  // Checker tint so cells read as a grid
  ctx.fillStyle = GRASS_DARK;
  ctx.globalAlpha = tiled ? 0.12 : 0.25;
  for (let y = 0; y < level.h; y++) for (let x = 0; x < level.w; x++) if ((x + y) & 1) ctx.fillRect(x * c, y * c, c, c);
  ctx.globalAlpha = 1;
  // Scenery in empty cells: trees, bushes, flowers (never on track)
  const used = new Set(level.tiles.map(t => `${t.x},${t.y}`));
  for (let y = 0; y < level.h; y++) for (let x = 0; x < level.w; x++) {
    if (used.has(`${x},${y}`)) continue;
    const r = hash(x, y, 1);
    const cx = (x + 0.3 + hash(x, y, 2) * 0.4) * c, cy = (y + 0.3 + hash(x, y, 3) * 0.4) * c;
    if (spriteScenery(ctx, x, y, c)) continue;
    if (r < 0.55) tree(ctx, cx, cy, c * (0.2 + hash(x, y, 4) * 0.08));
    else if (r < 0.8) { tree(ctx, cx - c * 0.15, cy, c * 0.14); tree(ctx, cx + c * 0.15, cy + c * 0.08, c * 0.12); }
    else flowers(ctx, cx, cy, c);
  }
  // Track (not switches): outline pass, bed pass, groove pass so joints merge
  const tiles = level.tiles.filter(t => t.t !== 'switch');
  for (let layer = 0; layer < 3; layer++) {
    for (const t of tiles) {
      const px = (t.x + 0.5) * c, py = (t.y + 0.5) * c;
      for (const seg of tileSegments(t)) strokeSeg(ctx, px, py, c, seg, layer, false);
    }
  }
  // Buffer stops (static)
  for (const t of level.tiles) if (t.t === 'buffer') bufferStop(ctx, (t.x + 0.5) * c, (t.y + 0.5) * c, c, t.rot);
  return cv;
}

// Image grass (art styles with a tile pack): tiles over the mat, clipped to its corners.
function grassTiles(ctx, level, c, W, H) {
  const keys = (T.grassTiles || []).filter(k => img(k));
  if (!keys.length) return false;
  const n = T.pixel ? 2 : 1, s = c / n;
  ctx.save();
  roundRect(ctx, -MAT, -MAT, W, H, 28 * T.radius); ctx.clip();
  ctx.imageSmoothingEnabled = !T.pixel;
  const x0 = -Math.ceil(MAT / s), y0 = -Math.ceil(MAT / s);
  for (let y = y0; y < level.h * n - y0; y++) for (let x = x0; x < level.w * n - x0; x++) {
    const k = keys[Math.floor(hash(x + 50, y + 50, 7) * keys.length)];
    ctx.drawImage(img(k), x * s, y * s, s + 0.5, s + 0.5);
  }
  ctx.restore();
  return true;
}

// Image scenery in an empty cell: one big sprite, or two small ones. False if the style
// has none loaded (the procedural trees draw instead).
function spriteScenery(ctx, x, y, c) {
  const keys = (T.scenery || []).filter(k => img(k));
  if (!keys.length) return false;
  ctx.imageSmoothingEnabled = !T.pixel;
  const pick = i => img(keys[Math.floor(hash(x, y, 10 + i) * keys.length)]);
  const put = (im, cx, cy, h) => {
    if (!T.pixel) h *= im.height / 96;   // trimmed sprites keep their relative sizes (tall pines, low bushes)
    const w = h * im.width / im.height;
    ctx.fillStyle = 'rgba(46,36,64,0.18)';
    ctx.beginPath(); ctx.ellipse(cx + h * 0.06, cy + h * 0.42, w * 0.38, h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
  };
  const r = hash(x, y, 1);
  const big = T.pixel ? 0.62 : 0.95, small = T.pixel ? 0.42 : 0.62;
  if (r < 0.55) put(pick(0), (x + 0.5) * c, (y + 0.5) * c, c * big);
  else {
    put(pick(1), (x + 0.3) * c, (y + 0.32) * c, c * small);
    put(pick(2), (x + 0.68) * c, (y + 0.66) * c, c * small);
  }
  return true;
}

function tree(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(46,36,64,0.2)';
  ctx.beginPath(); ctx.ellipse(x + r * 0.15, y + r * 0.35, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = GREEN; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = mix(GREEN, '#FFFFFF', 0.3);
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
}

function flowers(ctx, x, y, c) {
  const cols = [TRAIN_COLORS.yellow, '#FFFFFF', TRAIN_COLORS.red];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = cols[i]; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + (i - 1) * c * 0.12, y + (i % 2) * c * 0.1, c * 0.04, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

function bufferStop(ctx, px, py, c, rot) {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(DY[rot], DX[rot]) + Math.PI / 2);
  // bar across the track at the cell center, facing the open edge (up after rotation)
  const w = c * 0.56, h = c * 0.16;
  ctx.fillStyle = TRAIN_COLORS.yellow; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  roundRect(ctx, -w / 2, -h / 2, w, h, 4); ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = INK;
  for (let i = -4; i < 5; i++) { ctx.beginPath(); ctx.moveTo(i * h, -h / 2); ctx.lineTo(i * h + h * 0.6, -h / 2); ctx.lineTo(i * h + h * 0.6 - h, h / 2); ctx.lineTo(i * h - h, h / 2); ctx.fill(); }
  ctx.restore();
  roundRect(ctx, -w / 2, -h / 2, w, h, 4); ctx.stroke();
  ctx.restore();
}

// ---- Switches (dynamic) ------------------------------------------------------------
// anim: 0..1 position of the lever (0 straight, 1 curved), may overshoot.
export function drawSwitch(ctx, t, L, set, anim, opts) {
  const c = L.cell, px = L.ox + (t.x + 0.5) * c, py = L.oy + (t.y + 0.5) * c;
  const segs = tileSegments(t);
  const active = segs[set ? 1 : 0], idle = segs[set ? 0 : 1];
  // Interactive halo so switches read as tappable
  if (opts.interactive) {
    ctx.fillStyle = T.neon ? 'rgba(79,240,255,0.14)' : 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(px, py, c * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  for (let layer = 0; layer < 3; layer++) strokeSeg(ctx, px, py, c, idle, layer, true);
  for (let layer = 0; layer < 3; layer++) strokeSeg(ctx, px, py, c, active, layer, false);
  // Arrow on the active branch
  const a = switchArms(t);
  const out = set ? a.curved : a.straight;
  pathPoint(a.trunk, out, 0.72, P);
  const ax = px + P.x * c, ay = py + P.y * c;
  ctx.save();
  ctx.translate(ax, ay); ctx.rotate(P.a);
  ctx.fillStyle = INK;
  const s = c * 0.11;
  ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.7, -s * 0.9); ctx.lineTo(-s * 0.7, s * 0.9); ctx.closePath(); ctx.fill();
  ctx.restore();
  // Lever knob beside the trunk, on the side away from the curve, tilting towards the active branch
  const side = opp(a.curved);
  const kx = px + (DX[side] * 0.34 + DX[a.trunk] * 0.16) * c, ky = py + (DY[side] * 0.34 + DY[a.trunk] * 0.16) * c;
  const base = Math.atan2(DY[a.straight], DX[a.straight]);
  const curveSign = ((a.curved - a.straight) & 3) === 1 ? 1 : -1;
  const ang = base + curveSign * anim * Math.PI / 3;
  ctx.save();
  ctx.translate(kx, ky);
  ctx.rotate(ang);
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(c * 0.16, 0); ctx.stroke();
  const pop = opts.pulse ? 1 + 0.25 * Math.max(0, 1 - opts.pulse * 6) : 1;
  ctx.fillStyle = set ? TRAIN_COLORS.yellow : '#FFFFFF'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(c * 0.16, 0, c * 0.075 * pop, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = WOOD_DARK; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(kx, ky, c * 0.05, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (opts.locked) {
    // Set by a hint (GDD 3.13): a gold ring that pulses for a moment, then settles, and
    // a small padlock in the corner (shape, not just color).
    const k = Math.max(0, 1 - (opts.pulse || 0) / 1.2);
    const ring = 0.56 + 0.04 * Math.sin((opts.time || 0) * 4) + 0.25 * k;
    ctx.strokeStyle = GOLD; ctx.lineWidth = 5 + 4 * k;
    ctx.beginPath(); ctx.arc(px, py, c * ring, 0, Math.PI * 2); ctx.stroke();
    drawPadlock(ctx, px + c * 0.36, py - c * 0.36, c * 0.26);
  }
  if (opts.selected) {
    ctx.strokeStyle = INK; ctx.lineWidth = 6;
    ctx.setLineDash([10, 7]);
    ctx.beginPath(); ctx.arc(px, py, c * 0.6, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
}

// Padlock of size s centred on x, y (a hinted switch).
export function drawPadlock(ctx, x, y, s) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(2.5, s * 0.16);
  ctx.beginPath(); ctx.arc(x, y - s * 0.12, s * 0.3, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = GOLD; ctx.lineWidth = Math.max(2.5, s * 0.12);
  roundRect(ctx, x - s * 0.45, y - s * 0.14, s * 0.9, s * 0.66, s * 0.14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(x, y + s * 0.14, s * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---- Stations and depots -----------------------------------------------------------
export function drawStation(ctx, t, L, bounce) {
  const c = L.cell, px = L.ox + (t.x + 0.5) * c, py = L.oy + (t.y + 0.5) * c;
  const col = TRAIN_COLORS[t.color];
  const sq = 1 + bounce * 0.18;
  // platform toward the track edge
  ctx.fillStyle = mix(CREAM, INK, 0.12); ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.save();
  ctx.translate(px, py);
  // shadow
  ctx.fillStyle = 'rgba(46,36,64,0.2)';
  roundRect(ctx, -c * 0.3 + 4, -c * 0.18 + 6, c * 0.6, c * 0.46, 6); ctx.fill();
  // house body
  ctx.fillStyle = CREAM;
  roundRect(ctx, -c * 0.3, -c * 0.12, c * 0.6, c * 0.4, 6); ctx.fill(); ctx.stroke();
  // door
  ctx.fillStyle = mix(col, INK, 0.35);
  roundRect(ctx, -c * 0.07, c * 0.06, c * 0.14, c * 0.22, 4); ctx.fill();
  // roof (bounces on arrival)
  ctx.save();
  ctx.translate(0, -c * 0.12);
  ctx.scale(1 / sq, sq);
  ctx.fillStyle = col; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-c * 0.4, 0); ctx.lineTo(-c * 0.22, -c * 0.26); ctx.lineTo(c * 0.22, -c * 0.26); ctx.lineTo(c * 0.4, 0); ctx.closePath();
  ctx.fill(); ctx.stroke();
  // shape sign on the roof
  drawShape(ctx, TRAIN_SHAPES[t.color], 0, -c * 0.13, c * 0.085 * (T.symbol || 1), '#FFFFFF', INK, 2.5);
  ctx.restore();
  ctx.restore();
}

export function drawDepot(ctx, t, L, trains) {
  const c = L.cell, px = L.ox + (t.x + 0.5) * c, py = L.oy + (t.y + 0.5) * c;
  const r = t.rot & 3;
  // shed: back half of the cell, open toward the exit edge
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.atan2(DY[r], DX[r]));
  ctx.fillStyle = 'rgba(46,36,64,0.2)';
  roundRect(ctx, -c * 0.46 + 3, -c * 0.36 + 5, c * 0.5, c * 0.72, 8); ctx.fill();
  ctx.fillStyle = WOOD; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  roundRect(ctx, -c * 0.46, -c * 0.36, c * 0.5, c * 0.72, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = mix(INK, WOOD, 0.35);
  roundRect(ctx, -c * 0.12, -c * 0.24, c * 0.14, c * 0.48, 4); ctx.fill();
  ctx.restore();
  // clock badge per train: shape token + pips (one pip per departure tick)
  let bx = px + c * 0.3, by = py - c * 0.36;
  for (const tr of trains) {
    ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    const w = c * 0.16 + Math.max(1, tr.depart) * c * 0.06;
    roundRect(ctx, bx - c * 0.12, by - c * 0.1, w, c * 0.2, c * 0.1); ctx.fill(); ctx.stroke();
    drawShape(ctx, TRAIN_SHAPES[tr.color], bx - c * 0.03, by, c * 0.055 * (T.symbol || 1), TRAIN_COLORS[tr.color], INK, 2);
    if (tr.depart === 0) {
      ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(bx + c * 0.07, by, c * 0.03, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = INK;
      for (let i = 0; i < tr.depart; i++) { ctx.beginPath(); ctx.arc(bx + c * 0.07 + i * c * 0.06, by, c * 0.022, 0, Math.PI * 2); ctx.fill(); }
    }
    by -= c * 0.24;
  }
}

// ---- Trains ------------------------------------------------------------------------
export function drawTrain(ctx, x, y, ang, color, c, opts = {}) {
  const col = TRAIN_COLORS[color];
  const sc = opts.scale ?? 1;
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.translate(x, y + (opts.bob || 0));
  ctx.rotate(ang + (opts.tilt || 0));
  ctx.scale(sc * (opts.stretch || 1), sc / (opts.stretch || 1));
  const L = c * 0.66, Wd = c * 0.4;
  if (T.glow) { ctx.shadowColor = col; ctx.shadowBlur = c * 0.25; }
  ctx.fillStyle = 'rgba(46,36,64,0.25)';
  roundRect(ctx, -L / 2 + 3, -Wd / 2 + 5, L, Wd, Wd * 0.35); ctx.fill();
  // wheels
  ctx.fillStyle = INK;
  for (const wx of [-0.22, 0.02, 0.22]) { roundRect(ctx, wx * c - c * 0.06, -Wd / 2 - c * 0.04, c * 0.12, Wd + c * 0.08, 3); ctx.fill(); }
  if (T.loco) locoBody(ctx, col, c, L, Wd);
  else {
  // body
  ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  roundRect(ctx, -L / 2, -Wd / 2, L, Wd, Wd * 0.35); ctx.fill(); ctx.stroke();
  // cab at the back
  ctx.fillStyle = mix(col, INK, 0.3);
  roundRect(ctx, -L / 2, -Wd / 2, L * 0.36, Wd, Wd * 0.3); ctx.fill(); ctx.stroke();
  // chimney at the front
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(L * 0.32, 0, c * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = mix(col, '#FFFFFF', 0.4);
  ctx.beginPath(); ctx.arc(L * 0.32, 0, c * 0.035, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // Shape symbol on the roof, kept upright
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  const ox = Math.cos(ang) * L * 0.02, oy = Math.sin(ang) * L * 0.02;
  drawShape(ctx, TRAIN_SHAPES[color], x + ox, y + oy + (opts.bob || 0), c * 0.09 * sc * (T.symbol || 1), '#FFFFFF', INK, 2.5);
  ctx.restore();
}

// Storybook steam loco (art style 'meadow'): round boiler with brass bands, a roofed cab,
// a red buffer beam and a lamp at the front.
function locoBody(ctx, col, c, L, Wd) {
  ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  // buffer beam
  ctx.fillStyle = TRAIN_COLORS.red;
  roundRect(ctx, L * 0.42, -Wd * 0.58, L * 0.1, Wd * 1.16, 3); ctx.fill(); ctx.stroke();
  // boiler
  ctx.fillStyle = col;
  roundRect(ctx, -L * 0.18, -Wd * 0.42, L * 0.64, Wd * 0.84, Wd * 0.42); ctx.fill(); ctx.stroke();
  ctx.fillStyle = mix(col, '#FFFFFF', 0.35);
  roundRect(ctx, -L * 0.14, -Wd * 0.3, L * 0.56, Wd * 0.16, Wd * 0.08); ctx.fill();
  ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(2, c * 0.025);
  for (const bx of [0.02, 0.2]) { ctx.beginPath(); ctx.moveTo(L * bx, -Wd * 0.4); ctx.lineTo(L * bx, Wd * 0.4); ctx.stroke(); }
  // chimney and lamp
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.fillStyle = mix(INK, CREAM, 0.15);
  ctx.beginPath(); ctx.arc(L * 0.33, 0, c * 0.065, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = TRAIN_COLORS.yellow;
  ctx.beginPath(); ctx.arc(L * 0.47, 0, c * 0.03, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // cab with a roof
  ctx.fillStyle = mix(col, INK, 0.25);
  roundRect(ctx, -L * 0.5, -Wd * 0.52, L * 0.34, Wd * 1.04, 5); ctx.fill(); ctx.stroke();
  ctx.fillStyle = mix(col, INK, 0.45);
  roundRect(ctx, -L * 0.47, -Wd * 0.4, L * 0.28, Wd * 0.8, 4); ctx.fill();
}

// Golden ticket (GDD 3.11): a gold star token with a shine, on a little round base so it
// reads as a pickup, not as the yellow train's triangle. GOLD lives in config.js.
export function drawTicket(ctx, x, y, c, t, opts = {}) {
  const sc = opts.scale ?? 1, a = opts.alpha ?? 1;
  if (sc <= 0.01 || a <= 0.01) return;
  const bob = Math.sin(t * 3) * c * 0.03;
  const r = c * 0.2 * sc;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(46,36,64,0.22)';
  ctx.beginPath(); ctx.ellipse(x, y + c * 0.16 * sc, r * 0.95, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PAPER; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y + bob, r * 1.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  star(ctx, x, y + bob, r, GOLD, INK, 2.5, Math.sin(t * 2) * 0.12);
  // shine sweep
  const sh = (t * 0.8) % 1.6;
  if (sh < 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(2, c * 0.03); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y + bob, r * 0.7, -2.4 + sh * 2, -1.9 + sh * 2); ctx.stroke();
  }
  ctx.restore();
}

export function drawShape(ctx, shape, x, y, r, fill, stroke, lw) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round';
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (shape === 'square') ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else if (shape === 'triangle') { ctx.moveTo(x, y - r * 1.1); ctx.lineTo(x + r * 1.05, y + r * 0.75); ctx.lineTo(x - r * 1.05, y + r * 0.75); ctx.closePath(); }
  else if (shape === 'diamond') { ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.15); ctx.lineTo(x - r, y); ctx.closePath(); }
  ctx.fill(); ctx.stroke();
}

export function star(ctx, x, y, r, fill, stroke, lw, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5, rr = i & 1 ? r * 0.48 : r;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- Particles (fixed pool, no allocation per frame) ---------------------------------
const POOL = Array.from({ length: 260 }, () => ({ on: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, color: '#fff', rot: 0, vr: 0 }));
export const FX = { PUFF: 0, CONF: 1, STAR: 2, STEAM: 3 };

export function emit(kind, x, y, n, color, spread = 1) {
  for (let k = 0; k < n; k++) {
    const p = POOL.find(q => !q.on);
    if (!p) return;
    const a = Math.random() * Math.PI * 2, sp = (kind === FX.CONF ? 220 : kind === FX.STAR ? 160 : 70) * spread * (0.4 + Math.random() * 0.8);
    p.on = true; p.kind = kind; p.x = x; p.y = y;
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - (kind === FX.CONF ? 160 : kind === FX.STEAM ? 40 : 0);
    p.max = p.life = kind === FX.CONF ? 1.1 : kind === FX.STAR ? 0.9 : kind === FX.STEAM ? 0.8 : 0.7;
    p.size = kind === FX.PUFF ? 14 + Math.random() * 14 : kind === FX.STEAM ? 6 + Math.random() * 5 : kind === FX.STAR ? 10 : 6 + Math.random() * 4;
    p.color = color; p.rot = Math.random() * 6; p.vr = (Math.random() - 0.5) * 12;
  }
}

export function updateParticles(dt) {
  for (const p of POOL) {
    if (!p.on) continue;
    p.life -= dt;
    if (p.life <= 0) { p.on = false; continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    if (p.kind === FX.CONF) { p.vy += 500 * dt; p.vx *= 0.98; }
    else { p.vx *= 0.92; p.vy *= 0.92; }
  }
}

export function clearParticles() { for (const p of POOL) p.on = false; }

export function drawParticles(ctx) {
  for (const p of POOL) {
    if (!p.on) continue;
    const t = p.life / p.max;
    ctx.globalAlpha = Math.min(1, t * 1.5);
    if (p.kind === FX.PUFF || p.kind === FX.STEAM) {
      const r = p.size * (1.6 - t * 0.6);
      ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = mix(INK, '#FFFFFF', 0.5); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (p.kind === FX.CONF) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    } else {
      star(ctx, p.x, p.y, p.size, p.color, INK, 2, p.rot);
    }
  }
  ctx.globalAlpha = 1;
}
