// Drawing hooks for the downloaded art styles (see theme.js and assets/CREDITS.md).
// Every hook returns false while its images are still loading, so the drawn-shape
// version from render.js shows instead. Sprites are tinted once into small cached
// canvases (echoes = the player's sprite tinted with the echo color), never per frame.
import { T, COLS, ROWS, VIEW_W, VIEW_H, COLORS as C } from './config.js';
import { THEMES, ART } from './theme.js';
import { rgba } from './render.js';

const hasDOM = () => typeof document !== 'undefined' && typeof document.createElement === 'function';
const newCanvas = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };

// ---- Sprite helpers ---------------------------------------------------------------------

const tintCache = new Map();
// A region of an image, optionally tinted (amount 0..1 of `color` over the sprite's own pixels).
function sprite(img, sx, sy, sw, sh, color = null, amount = 0) {
  const key = `${img.src}|${sx},${sy},${sw},${sh}|${color}|${amount}`;
  let cv = tintCache.get(key);
  if (cv) return cv;
  cv = newCanvas(sw, sh);
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  if (color && amount > 0) {
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = amount;
    g.fillStyle = color;
    g.fillRect(0, 0, sw, sh);
  }
  tintCache.set(key, cv);
  return cv;
}

// Which tint a figure gets: the live player keeps the sprite's own colors; echoes and
// hint ghosts are the same sprite washed in their color (shape stays, color tells role).
function roleTint(o, base) {
  if (o.color === C.cyan) return [base, 0];
  if (o.color === C.violet) return [C.violet, 0.6];
  return [o.color, 0.75];
}

function drawSpriteFigure(ctx, cv, cx, bottom, o, w, h, footPad = 0) {
  const { alpha = 1, facing = 1, sx = 1, sy = 1, dashed = false } = o;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, bottom + footPad);
  ctx.scale(sx * (facing < 0 ? -1 : 1), sy);
  ctx.drawImage(cv, -w / 2, -h, w, h);
  ctx.restore();
  if (dashed) {   // echoes keep a dashed outline so they read as "not you" in every style
    ctx.save();
    ctx.globalAlpha = alpha * 0.6;
    ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = o.color;
    ctx.strokeRect(cx - w * 0.36, bottom - h * 0.92, w * 0.72, h * 0.92);
    ctx.restore();
  }
}

// Tiles that touch open space (incl. diagonals) are "near"; the rest is deep fill.
function near(solid, c, r) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cc = c + dx, rr = r + dy;
    if (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS && !solid(cc, rr)) return true;
  }
  return false;
}
const openSides = (solid, c, r) => [
  r > 0 && !solid(c, r - 1), c < COLS - 1 && !solid(c + 1, r), r < ROWS - 1 && !solid(c, r + 1), c > 0 && !solid(c - 1, r),
];
const hash = (c, r) => ((c * 73856093) ^ (r * 19349663)) >>> 0;

function edgeLines(ctx, c, r, open, color, w) {
  ctx.strokeStyle = color; ctx.lineWidth = w;
  ctx.beginPath();
  const x = c * T, y = r * T, h = w / 2;
  if (open[0]) { ctx.moveTo(x, y + h); ctx.lineTo(x + T, y + h); }
  if (open[1]) { ctx.moveTo(x + T - h, y); ctx.lineTo(x + T - h, y + T); }
  if (open[2]) { ctx.moveTo(x, y + T - h); ctx.lineTo(x + T, y + T - h); }
  if (open[3]) { ctx.moveTo(x + h, y); ctx.lineTo(x + h, y + T); }
  ctx.stroke();
}

// Room layers cover every cell visible after the centering offset (cells outside the
// 32×16 grid count as solid), so the offset never shows a gap.
function eachTile(off, fn) {
  const c0 = Math.floor(-off.ox / T) - 1, c1 = Math.ceil((COLS * T - off.ox) / T) + 1;
  const r0 = Math.floor(-off.oy / T) - 1, r1 = Math.ceil((ROWS * T - off.oy) / T) + 1;
  for (let r = r0; r < r1; r++) for (let c = c0; c < c1; c++) fn(c, r);
}

// Backdrops are cached per style and file-load version.
const backdropCache = new Map();
function cachedBackdrop(id, w, h, paint) {
  const key = `${id}|${ART.version}|${w}x${h}`;
  let cv = backdropCache.get(key);
  if (!cv) {
    if (backdropCache.size > 12) backdropCache.clear();
    cv = newCanvas(w, h);
    paint(cv.getContext('2d'), w, h);
    backdropCache.set(key, cv);
  }
  return cv;
}

// ---- Pixel Meadow: Kenney "Pixel Platformer" (CC0), 18 px tiles, 24 px characters -------------

const PX = 18, PC = 24;
const pxTile = (img, c, r) => sprite(img, c * PX, r * PX, PX, PX);

// Kenney's 3-row background strip: sky (stretched up), clouds and trees, ground (stretched down).
// floorY puts the trees just behind the room's floor.
function pixelSky(ctx, w, h, floorY = h - 40) {
  const bg = ART.img.bgs;
  const tw = PC * 4;
  const yClouds = floorY - tw + 10, yGround = yClouds + tw;
  ctx.imageSmoothingEnabled = false;
  for (let i = 0, x = 0; x < w; i++, x += tw) {
    const col = i % 4;
    ctx.drawImage(bg, col * PC, 0, PC, PC, x, 0, tw, yClouds + 1);
    ctx.drawImage(bg, col * PC, PC, PC, PC, x, yClouds, tw, tw);
    ctx.drawImage(bg, col * PC, PC * 2, PC, PC, x, yGround, tw, Math.max(tw, h - yGround));
  }
}

const pixel = {
  room(ctx, lv, off, solid) {
    const im = ART.img;
    if (!im.tiles || !im.bgs) return false;
    let floor = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!solid(c, r)) floor = Math.max(floor, r + 1);
    pixelSky(ctx, COLS * T, ROWS * T, floor * T + off.oy);
    ctx.translate(off.ox, off.oy);
    ctx.imageSmoothingEnabled = false;
    const dirt = [pxTile(im.tiles, 4, 0), pxTile(im.tiles, 5, 0), pxTile(im.tiles, 4, 1), pxTile(im.tiles, 5, 1)];
    const grass = pxTile(im.tiles, 2, 0);
    eachTile(off, (c, r) => {
      if (!solid(c, r)) return;
      const n = c >= 0 && c < COLS && r >= 0 && r < ROWS && near(solid, c, r);
      const open = n ? openSides(solid, c, r) : [false, false, false, false];
      ctx.drawImage(open[0] ? grass : dirt[hash(c, r) % 4], c * T, r * T, T, T);
      if (!n) { ctx.fillStyle = 'rgba(30,20,40,0.3)'; ctx.fillRect(c * T, r * T, T, T); }
      else edgeLines(ctx, c, r, [false, open[1], open[2], open[3]], '#3F2F4F', 4);
    });
    // a few plants on the floor for life (never on plates, gates, spawn or exit)
    const busy = new Set([...lv.plates.map(p => `${p.col},${p.row}`), ...lv.gates.flatMap(g => [`${g.col},${g.row + g.h - 1}`]), `${lv.spawn.col},${lv.spawn.row}`, `${lv.exit.col},${lv.exit.row}`]);
    const deco = [pxTile(im.tiles, 4, 6), pxTile(im.tiles, 5, 6), pxTile(im.tiles, 6, 6)];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (solid(c, r) || !solid(c, r + 1) || busy.has(`${c},${r}`) || busy.has(`${c - 1},${r}`) || busy.has(`${c + 1},${r}`)) continue;
      if (hash(c, r) % 7 !== 0) continue;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(deco[hash(r, c) % 3], c * T, r * T, T, T);
      ctx.globalAlpha = 1;
    }
    return true;
  },
  figure(ctx, cx, bottom, o) {
    const img = ART.img.chars;
    if (!img) return false;
    const frame = o.air ? 1 : o.run ? (Math.floor(o.t * 10) % 2) : 0;
    const [col, amt] = roleTint(o, null);
    const cv = sprite(img, (2 + frame) * PC, 0, PC, PC, col, amt);
    ctx.imageSmoothingEnabled = false;
    drawSpriteFigure(ctx, cv, cx, bottom, o, 48, 48, 2);
    return true;
  },
  plate(ctx, p, pressed) {
    const img = ART.img.tiles;
    if (!img) return false;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pxTile(img, pressed ? 9 : 8, 7), p.x0, p.y - T + (pressed ? 2 : 0), T, T);
    return true;
  },
  gate(ctx, g, h) {
    const img = ART.img.tiles;
    if (!img) return false;
    if (h <= 0.5) return true;
    ctx.save();
    ctx.beginPath(); ctx.rect(g.x, g.y, T, h); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    const block = pxTile(img, 9, 0), lock = pxTile(img, 10, 0);
    for (let y = g.y + h - T, i = 0; y > g.y - T; y -= T, i++) ctx.drawImage(i === 0 ? lock : block, g.x, y, T, T);
    ctx.restore();
    return true;
  },
  exit(ctx, ex, t) {
    const img = ART.img.tiles;
    if (!img) return false;
    const x = ex.col * T, bottom = (ex.row + 1) * T;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pxTile(img, 10, 6), x, bottom - 2 * T, T, T);
    ctx.drawImage(pxTile(img, 10, 7), x, bottom - T, T, T);
    ctx.drawImage(pxTile(img, 11, 5), x + T * 0.55, bottom - 2 * T - 30 + Math.sin(t * 3) * 2, T, T);   // flag
    arrowAbove(ctx, x + T / 2, bottom - 2 * T - 14 + Math.sin(t * 4) * 3);
    return true;
  },
  // Title and room select: earth all around, a strip of sky where the title demo walks.
  backdrop(ctx) {
    const im = ART.img;
    if (!im.bgs || !im.tiles) return false;
    ctx.drawImage(cachedBackdrop('pixel', VIEW_W, VIEW_H, (g, w, h) => {
      g.imageSmoothingEnabled = false;
      const dirt = [pxTile(im.tiles, 4, 0), pxTile(im.tiles, 5, 0), pxTile(im.tiles, 4, 1), pxTile(im.tiles, 5, 1)];
      for (let r = 0; r * T < h; r++) for (let c = 0; c * T < w; c++) g.drawImage(dirt[hash(c, r) % 4], c * T, r * T, T, T);
      g.fillStyle = 'rgba(30,20,40,0.45)'; g.fillRect(0, 0, w, h);
      const top = 480, floor = 650;
      g.save(); g.beginPath(); g.rect(0, top, w, floor - top); g.clip();
      pixelSky(g, w, h, floor);
      g.restore();
      g.fillStyle = '#3F2F4F'; g.fillRect(0, top - 4, w, 4);
      const grass = pxTile(im.tiles, 2, 0);
      for (let c = 0; c * T < w; c++) g.drawImage(grass, c * T, floor, T, T);
    }), 0, 0);
    return true;
  },
};

function arrowAbove(ctx, x, y) {
  ctx.beginPath(); ctx.moveTo(x - 8, y + 5); ctx.lineTo(x, y - 4); ctx.lineTo(x + 8, y + 5);
  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = C.cyan; ctx.stroke();
}

// ---- Toybox Shapes: Kenney "Abstract Platformer" (CC0), 64 px tiles --------------------------

function toyBack(ctx, w, h, shift = 0) {
  ctx.fillStyle = '#54417A'; ctx.fillRect(0, 0, w, h);
  const im = ART.img;
  ctx.imageSmoothingEnabled = true;
  if (im.shapes) { ctx.globalAlpha = 0.55; for (let x = -shift % 1280; x < w; x += 1280) ctx.drawImage(im.shapes, x, h - 960, 1280, 960); ctx.globalAlpha = 1; }
  if (im.hills) for (let x = 0; x < w; x += 1280) ctx.drawImage(im.hills, x, h - 900, 1280, 960);
}

const toybox = {
  room(ctx, lv, off, solid) {
    const im = ART.img;
    if (!im.top || !im.fill) return false;
    toyBack(ctx, COLS * T, ROWS * T);
    ctx.translate(off.ox, off.oy);
    ctx.imageSmoothingEnabled = true;
    eachTile(off, (c, r) => {
      if (!solid(c, r)) return;
      const inGrid = c >= 0 && c < COLS && r >= 0 && r < ROWS;
      const open = inGrid ? openSides(solid, c, r) : [false, false, false, false];
      const deep = !inGrid || !near(solid, c, r);
      let img = open[0] ? im.top : im.fill;
      if (!open[0] && deep && im.deco && hash(c, r) % 29 === 0) img = hash(r, c) % 2 ? im.deco : im.deco2 || im.deco;
      ctx.drawImage(img, c * T, r * T, T + 0.5, T + 0.5);
      if (!open[0]) edgeLines(ctx, c, r, [false, open[1], open[2], open[3]], 'rgba(255,255,255,0.18)', 3);
    });
    return true;
  },
  figure(ctx, cx, bottom, o) {
    const im = ART.img;
    if (!im.stand) return false;
    let img = im.stand;
    if (o.air && im.up) img = im.up;
    else if (o.run) img = im[`walk${1 + (Math.floor(o.t * 12) % 5)}`] || im.stand;
    const [col, amt] = roleTint(o, null);
    const cv = sprite(img, 0, 0, img.width, img.height, col, amt);
    ctx.imageSmoothingEnabled = true;
    drawSpriteFigure(ctx, cv, cx, bottom, o, 38, 46, 1);
    return true;
  },
  plate(ctx, p, pressed) {
    const img = pressed ? ART.img.buttonDown : ART.img.button;
    if (!img) return false;
    ctx.drawImage(img, p.x0 + 2, p.y - 21, 36, 21);
    return true;
  },
  gate(ctx, g, h) {
    const im = ART.img;
    if (!im.lockMid) return false;
    if (h <= 0.5) return true;
    ctx.save();
    ctx.beginPath(); ctx.rect(g.x, g.y, T, h); ctx.clip();
    const n = Math.max(1, Math.ceil(g.hpx / T));
    for (let i = 0; i < n; i++) {
      const y = g.y + h - (i + 1) * T;
      const img = i === 0 ? im.lockBottom : i === n - 1 ? im.lockTop : im.lockMid;
      ctx.drawImage(img || im.lockMid, g.x + 3, y, T - 6, T);
    }
    ctx.restore();
    return true;
  },
  exit(ctx, ex, t) {
    const im = ART.img;
    if (!im.door || !im.doorTop) return false;
    const x = ex.col * T, bottom = (ex.row + 1) * T;
    ctx.drawImage(im.doorTop, x - 2, bottom - 2 * T - 4, T + 4, T + 4);
    ctx.drawImage(im.door, x - 2, bottom - T, T + 4, T);
    if (im.flag) ctx.drawImage(im.flag, x + T * 0.5, bottom - 2 * T - 40, T, T);
    arrowAbove(ctx, x + T / 2, bottom - 2 * T - 18 + Math.sin(t * 4) * 3);
    return true;
  },
  backdrop(ctx, t) {
    if (!ART.img.shapes) return false;
    ctx.fillStyle = '#54417A'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const im = ART.img;
    ctx.globalAlpha = 0.55;
    const s = (t * 12) % 1280;
    ctx.drawImage(im.shapes, -s, VIEW_H - 960, 1280, 960);
    ctx.drawImage(im.shapes, 1280 - s, VIEW_H - 960, 1280, 960);
    ctx.globalAlpha = 1;
    if (im.hills) ctx.drawImage(im.hills, 0, VIEW_H - 900, 1280, 960);
    ctx.fillStyle = 'rgba(30,24,52,0.35)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    return true;
  },
};

// ---- Green Terminal: Kenney "1-Bit Pack" (CC0), 16 px monochrome tiles, scanlines --------------

const OB = 16;
const obTile = (img, c, r, color) => sprite(img, c * OB, r * OB, OB, OB, color, 1);

const terminal = {
  room(ctx, lv, off, solid) {
    const img = ART.img.sheet;
    if (!img) return false;
    ctx.fillStyle = '#030803'; ctx.fillRect(0, 0, COLS * T, ROWS * T);
    ctx.translate(off.ox, off.oy);
    ctx.imageSmoothingEnabled = false;
    const brick = obTile(img, 10, 17, '#2E7A35');
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!solid(c, r)) {
        ctx.fillStyle = rgba(C.cyan, 0.08);
        ctx.fillRect(c * T + T / 2 - 1, r * T + T / 2 - 1, 2, 2);
        continue;
      }
      if (!near(solid, c, r)) continue;
      ctx.drawImage(brick, c * T, r * T, T, T);
      edgeLines(ctx, c, r, openSides(solid, c, r), C.pale, 2);
    }
    return true;
  },
  figure(ctx, cx, bottom, o) {
    const img = ART.img.sheet;
    if (!img) return false;
    const frame = o.run ? (Math.floor(o.t * 8) % 2) : 0;
    const cv = obTile(img, frame ? 26 : 25, 0, o.color);
    ctx.imageSmoothingEnabled = false;
    drawSpriteFigure(ctx, cv, cx, bottom, o, 42, 42, 1);
    return true;
  },
  gate(ctx, g, h) {
    const img = ART.img.sheet;
    if (!img) return false;
    if (h <= 0.5) return true;
    ctx.save();
    ctx.beginPath(); ctx.rect(g.x, g.y, T, h); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    const tile = obTile(img, 1, 9, C.pink);
    for (let y = g.y + h - T; y > g.y - T; y -= T) ctx.drawImage(tile, g.x, y, T, T);
    ctx.restore();
    return true;
  },
  exit(ctx, ex, t) {
    const img = ART.img.sheet;
    if (!img) return false;
    const x = ex.col * T, bottom = (ex.row + 1) * T;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.75 + Math.sin(t * 6) * 0.25;
    ctx.drawImage(obTile(img, 3, 9, C.cyan), x - 8, bottom - 56, 56, 56);
    ctx.globalAlpha = 1;
    arrowAbove(ctx, x + T / 2, bottom - 74 + Math.sin(t * 4) * 3);
    return true;
  },
  backdrop(ctx) {
    ctx.fillStyle = '#030803'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = rgba(C.cyan, 0.07);
    for (let y = 20; y < VIEW_H; y += 40) for (let x = 20; x < VIEW_W; x += 40) ctx.fillRect(x - 1, y - 1, 2, 2);
    return true;
  },
};

// Full-screen CRT scanlines, pre-rendered once.
let scan = null;
export function drawScanlines(ctx) {
  if (!ART.cur.scanlines || !hasDOM()) return;
  if (!scan) {
    scan = newCanvas(VIEW_W, VIEW_H);
    const g = scan.getContext('2d');
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < VIEW_H; y += 4) g.fillRect(0, y, VIEW_W, 2);
    const v = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = v; g.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  ctx.drawImage(scan, 0, 0, VIEW_W, VIEW_H);
}

// Title and room-select background for the current style; false = use the classic one.
export function drawBackdrop(ctx, t) {
  const h = ART.cur.hooks && ART.cur.hooks.backdrop;
  return !!(h && hasDOM() && h(ctx, t));
}

const HOOKS = { pixel, toybox, terminal };
for (const th of THEMES) if (HOOKS[th.id]) th.hooks = HOOKS[th.id];
