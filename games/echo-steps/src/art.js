// Drawing hooks for the downloaded art styles (see theme.js and assets/CREDITS.md).
// Every hook returns false while its images are still loading, so the drawn-shape
// version from render.js shows instead. Sprites are tinted once into small cached
// canvases, never per frame. Echoes use a second character of the pack where it has one.
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

function arrowAbove(ctx, x, y) {
  ctx.beginPath(); ctx.moveTo(x - 8, y + 5); ctx.lineTo(x, y - 4); ctx.lineTo(x + 8, y + 5);
  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = C.cyan; ctx.stroke();
}

// Lowest open row of the room (+1): where the floor is, so skies line up with it.
function floorRow(solid) {
  let floor = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!solid(c, r)) floor = Math.max(floor, r + 1);
  return floor;
}

// Frame i of a horizontal strip of square-ish frames (fw wide).
const frame = (img, i, fw, fh = img.height) => [img, (i % Math.max(1, Math.floor(img.width / fw))) * fw, 0, fw, fh];

// ---- Pixel Adventure: Pixel Frog "Pixel Adventure 1" (CC0), 16 px terrain, 32 px characters ----
// Player: Virtual Guy. Echoes: Pink Man (a different character of the pack, not a recolor).

const PA = 16;
const paTile = (img, c, r) => sprite(img, c * PA, r * PA, PA, PA);

function paBack(ctx, w, h) {
  const bg = ART.img.bg;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y += 128) for (let x = 0; x < w; x += 128) ctx.drawImage(bg, x, y, 128, 128);
}

const adventure = {
  room(ctx, lv, off, solid) {
    const im = ART.img;
    if (!im.terrain || !im.bg) return false;
    paBack(ctx, COLS * T, ROWS * T);
    ctx.translate(off.ox, off.oy);
    ctx.imageSmoothingEnabled = false;
    // grass block of the terrain sheet: a 3×3 slice at tiles (6..8, 0..2)
    eachTile(off, (c, r) => {
      if (!solid(c, r)) return;
      const inGrid = c >= 0 && c < COLS && r >= 0 && r < ROWS;
      const o = inGrid ? openSides(solid, c, r) : [false, false, false, false];
      const col = o[3] && !o[1] ? 6 : o[1] && !o[3] ? 8 : 7;
      const row = o[0] ? 0 : o[2] ? 2 : 1;
      ctx.drawImage(paTile(im.terrain, col, row), c * T, r * T, T, T);
      if (!inGrid || !near(solid, c, r)) { ctx.fillStyle = 'rgba(33,31,48,0.35)'; ctx.fillRect(c * T, r * T, T, T); }
    });
    return true;
  },
  figure(ctx, cx, bottom, o) {
    const im = ART.img;
    const echo = o.color === C.violet;
    const set = echo ? [im.eIdle, im.eRun, im.eJump, im.eFall] : [im.idle, im.run, im.jump, im.fall];
    if (set.some(x => !x)) return false;
    const [idle, run, jump, fall] = set;
    const img = o.air ? (o.t % 0.6 < 0.3 ? jump : fall) : o.run ? run : idle;
    const n = Math.floor(o.t * 20);            // the pack's animations run at 20 fps
    const [src, sx, sy, sw, sh] = frame(img, n, 32, 32);
    const tint = !echo && o.color !== C.cyan ? [C.pale, 0.7] : [null, 0];
    const cv = sprite(src, sx, sy, sw, sh, ...tint);
    ctx.imageSmoothingEnabled = false;
    drawSpriteFigure(ctx, cv, cx, bottom, { ...o, dashed: false }, 64, 64, 0);
    return true;
  },
  plate(ctx, p, pressed) {
    const im = ART.img;
    if (!im.plate || !im.plateOn) return false;
    ctx.imageSmoothingEnabled = false;
    if (pressed) ctx.drawImage(sprite(im.plateOn, 0, 0, 32, 8), p.x0, p.y - 6, T, 10);
    else ctx.drawImage(im.plate, p.x0, p.y - 10, T, 10);
    return true;
  },
  gate(ctx, g, h) {
    const im = ART.img;
    if (!im.terrain) return false;
    if (h <= 0.5) return true;
    ctx.save();
    ctx.beginPath(); ctx.rect(g.x, g.y, T, h); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    const gold = sprite(im.terrain, 272, 144, 16, 16);   // riveted gold block
    for (let y = g.y + h - T; y > g.y - T; y -= T) ctx.drawImage(gold, g.x, y, T, T);
    ctx.restore();
    return true;
  },
  exit(ctx, ex, t) {
    const im = ART.img;
    if (!im.trophy) return false;
    const cx = ex.col * T + T / 2, bottom = (ex.row + 1) * T;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im.trophy, cx - 48, bottom - 96, 96, 96);
    arrowAbove(ctx, cx, bottom - 82 + Math.sin(t * 4) * 3);
    return true;
  },
  backdrop(ctx) {
    const im = ART.img;
    if (!im.terrain || !im.bg) return false;
    ctx.drawImage(cachedBackdrop('adventure', VIEW_W, VIEW_H, (g, w, h) => {
      paBack(g, w, h);
      g.imageSmoothingEnabled = false;
      const floor = 650;
      for (let c = 0; c * T < w; c++) {
        g.drawImage(paTile(im.terrain, 7, 0), c * T, floor, T, T);
        g.drawImage(paTile(im.terrain, 7, 1), c * T, floor + T, T, T);
      }
    }), 0, 0);
    return true;
  },
};

// ---- Robot Lab: GameArt2D "Free Sci-Fi Platformer Tileset" + "The Robot" (CC0), vector art ------
// Player: the yellow robot. Echoes: the same robot washed in the echo color (the pack has one robot).

function labBack(ctx, w, h) {
  const im = ART.img;
  ctx.imageSmoothingEnabled = true;
  for (let r = 0; r * 80 < h; r++) for (let c = 0; c * 80 < w; c++) {
    const k = hash(c, r);
    const img = k % 23 === 0 && im.lamp ? im.lamp : k % 2 ? im.back : im.back2 || im.back;
    ctx.drawImage(img, c * 80, r * 80, 80, 80);
  }
}

const lab = {
  room(ctx, lv, off, solid) {
    const im = ART.img;
    if (!im.top || !im.fill || !im.back) return false;
    labBack(ctx, COLS * T, ROWS * T);
    ctx.fillStyle = 'rgba(10,12,20,0.25)'; ctx.fillRect(0, 0, COLS * T, ROWS * T);
    ctx.translate(off.ox, off.oy);
    ctx.imageSmoothingEnabled = true;
    eachTile(off, (c, r) => {
      if (!solid(c, r)) return;
      const inGrid = c >= 0 && c < COLS && r >= 0 && r < ROWS;
      const o = inGrid ? openSides(solid, c, r) : [false, false, false, false];
      ctx.drawImage(o[0] ? im.top : im.fill, c * T, r * T, T + 0.5, T + 0.5);
      if (!inGrid || !near(solid, c, r)) { ctx.fillStyle = 'rgba(8,10,16,0.55)'; ctx.fillRect(c * T, r * T, T + 0.5, T + 0.5); }
      else edgeLines(ctx, c, r, [false, o[1], o[2], o[3]], '#D9D2C7', 3);
    });
    return true;
  },
  figure(ctx, cx, bottom, o) {
    const im = ART.img;
    if (!im.idle || !im.run || !im.jump) return false;
    const fw = 114;
    let src;
    if (o.air) src = frame(im.jump, o.t % 0.6 < 0.3 ? 0 : 1, fw);
    else if (o.run) src = frame(im.run, Math.floor(o.t * 16), fw);
    else src = frame(im.idle, Math.floor(o.t * 8), fw);
    const [col, amt] = roleTint(o, null);
    const cv = sprite(...src, col, amt * 0.85);
    ctx.imageSmoothingEnabled = true;
    drawSpriteFigure(ctx, cv, cx, bottom, { ...o, dashed: false }, 46, 52, 1);
    return true;
  },
  plate(ctx, p, pressed) {
    const im = ART.img;
    if (!im.ledge) return false;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(im.ledge, 0, 0, 80, 26, p.x0 + 1, p.y - (pressed ? 6 : 12), T - 2, 13);
    ctx.fillStyle = pressed ? C.yellow : 'rgba(0,0,0,0.6)';   // the slot lights up when held
    ctx.fillRect(p.x0 + 12, p.y - (pressed ? 2 : 8), T - 24, 3);
    return true;
  },
  gate(ctx, g, h) {
    const im = ART.img;
    if (!im.door) return false;
    if (h <= 0.5) return true;
    ctx.save();
    ctx.beginPath(); ctx.rect(g.x - 4, g.y, T + 8, h); ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(im.door, g.x - 3, g.y + h - g.hpx, T + 6, g.hpx);   // the door slides up into the ceiling
    ctx.restore();
    return true;
  },
  exit(ctx, ex, t) {
    const im = ART.img;
    if (!im.exit) return false;
    const cx = ex.col * T + T / 2, bottom = (ex.row + 1) * T;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(im.exit, cx - 26, bottom - 86, 52, 86);
    arrowAbove(ctx, cx, bottom - 100 + Math.sin(t * 4) * 3);
    return true;
  },
  backdrop(ctx) {
    const im = ART.img;
    if (!im.back || !im.top) return false;
    ctx.drawImage(cachedBackdrop('lab', VIEW_W, VIEW_H, (g, w, h) => {
      labBack(g, w, h);
      g.fillStyle = 'rgba(10,12,20,0.45)'; g.fillRect(0, 0, w, h);
      for (let c = 0; c * T < w; c++) { g.drawImage(im.top, c * T, 650, T, T); g.drawImage(im.fill, c * T, 690, T, T); }
    }), 0, 0);
    return true;
  },
};

// ---- Alien Planet: Kenney "Platformer Pack Redux" (CC0), flat vector ----------------------------
// Player: the green alien. Echoes: the blue alien of the same pack.

function planetSky(ctx, w, h, floorY) {
  const sky = ART.img.sky;
  ctx.fillStyle = '#D2F4F7'; ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  const s = Math.max(w, 720), y0 = floorY + 30 - s * 0.66;   // the hills meet the floor
  for (let x = 0; x < w; x += s) ctx.drawImage(sky, x, y0, s, s);
  ctx.fillStyle = '#C6ECEF'; ctx.fillRect(0, y0 + s - 1, w, Math.max(0, h - (y0 + s - 1)));
}

const planet = {
  room(ctx, lv, off, solid) {
    const im = ART.img;
    if (!im.top || !im.fill || !im.sky) return false;
    planetSky(ctx, COLS * T, ROWS * T, floorRow(solid) * T + off.oy);
    ctx.translate(off.ox, off.oy);
    ctx.imageSmoothingEnabled = true;
    eachTile(off, (c, r) => {
      if (!solid(c, r)) return;
      const inGrid = c >= 0 && c < COLS && r >= 0 && r < ROWS;
      const o = inGrid ? openSides(solid, c, r) : [false, false, false, false];
      ctx.drawImage(o[0] ? im.top : im.fill, c * T, r * T, T + 0.5, T + 0.5);
      if (!inGrid || !near(solid, c, r)) { ctx.fillStyle = 'rgba(58,51,84,0.35)'; ctx.fillRect(c * T, r * T, T + 0.5, T + 0.5); }
      else edgeLines(ctx, c, r, [false, o[1], o[2], o[3]], '#8E86A8', 3);
    });
    return true;
  },
  figure(ctx, cx, bottom, o) {
    const im = ART.img;
    const echo = o.color === C.violet;
    const p = echo ? 'e' : '';
    const k = s => im[p ? p + s[0].toUpperCase() + s.slice(1) : s];
    const stand = k('stand');
    if (!stand) return false;
    let img = stand;
    if (o.air) img = k('jump') || stand;
    else if (o.run) img = k(Math.floor(o.t * 8) % 2 ? 'walk2' : 'walk1') || stand;
    const tint = !echo && o.color !== C.cyan ? [C.pale, 0.6] : [null, 0];
    const cv = sprite(img, 0, 0, img.width, img.height, ...tint);
    ctx.imageSmoothingEnabled = true;
    drawSpriteFigure(ctx, cv, cx, bottom, { ...o, dashed: false }, 36, 48, 0);
    return true;
  },
  plate(ctx, p, pressed) {
    const img = pressed ? ART.img.buttonDown : ART.img.button;
    if (!img) return false;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, p.x0, p.y - 37, T, T);
    return true;
  },
  gate(ctx, g, h) {
    const im = ART.img;
    if (!im.lock) return false;
    if (h <= 0.5) return true;
    ctx.save();
    ctx.beginPath(); ctx.rect(g.x, g.y, T, h); ctx.clip();
    ctx.imageSmoothingEnabled = true;
    for (let y = g.y + h - T; y > g.y - T; y -= T) ctx.drawImage(im.lock, g.x, y, T, T);
    ctx.restore();
    return true;
  },
  exit(ctx, ex, t) {
    const im = ART.img;
    if (!im.door || !im.doorTop) return false;
    const x = ex.col * T, bottom = (ex.row + 1) * T;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(im.doorTop, x - 4, bottom - 2 * T - 8, T + 8, T + 8);
    ctx.drawImage(im.door, x - 4, bottom - T, T + 8, T);
    arrowAbove(ctx, x + T / 2, bottom - 2 * T - 22 + Math.sin(t * 4) * 3);
    return true;
  },
  backdrop(ctx) {
    const im = ART.img;
    if (!im.sky || !im.top) return false;
    ctx.drawImage(cachedBackdrop('planet', VIEW_W, VIEW_H, (g, w, h) => {
      planetSky(g, w, h, 650);
      for (let c = 0; c * T < w; c++) { g.drawImage(im.top, c * T, 650, T, T); g.drawImage(im.fill, c * T, 690, T, T); }
    }), 0, 0);
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

const HOOKS = { adventure, lab, planet };
for (const th of THEMES) if (HOOKS[th.id]) th.hooks = HOOKS[th.id];
