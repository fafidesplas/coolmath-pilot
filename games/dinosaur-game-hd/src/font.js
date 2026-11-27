// Pixel fonts drawn from Aseprite sheets (GDD 9: no web fonts).
// Body and button text: Jersey 25 (Pixel), art/aseprite/ui/font-body.lua.
// Screen headers: Rubik Dirt (Pixel), drawHeader() below.
import { SPR } from './sprites.js';
import { CELL } from './art.js';

// ---- Body font ----
// Capitals are 7 dots tall and one dot is `size` px, so size 2 puts the
// letters on the art grid. Proportional: the advance is the glyph's width + 1.
const BODY_NAMES = { '.': 'dot', ',': 'comma', '!': 'excl', '?': 'quest', ':': 'colon', '-': 'dash',
  '/': 'slash', "'": 'apos', '+': 'plus', '(': 'lparen', ')': 'rparen' };
const SPACE = 3;   // dots
const bodyTinted = new Map();

// { img, adv } for a character in a color; adv in dots. null if not in the font.
function bodyGlyph(ch, color) {
  const key = color + ch;
  if (!bodyTinted.has(key)) {
    const g = SPR.body[BODY_NAMES[ch] || ch];
    let v = null;
    if (g) {
      const c = document.createElement('canvas');
      c.width = g.small.width; c.height = g.small.height;
      const x = c.getContext('2d');
      x.drawImage(g.small, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = color;
      x.fillRect(0, 0, c.width, c.height);
      v = { img: c, adv: g.adv + 1 };
    }
    bodyTinted.set(key, v);
  }
  return bodyTinted.get(key);
}

const advance = ch => ch === ' ' ? SPACE : (bodyGlyph(ch, '#fff')?.adv || 0);

// Width in px, without the gap after the last glyph.
export function textWidth(text, size = 1) {
  let w = 0;
  for (const ch of String(text).toUpperCase()) w += advance(ch);
  return Math.max(0, w - 1) * size;
}

// Draws `text` with its top at y. align: 'left' | 'center' | 'right'.
export function drawText(ctx, text, x, y, size, color, align = 'left') {
  text = String(text).toUpperCase();
  const w = textWidth(text, size);
  if (align === 'center') x -= Math.floor(w / 2);
  else if (align === 'right') x -= w;
  for (const ch of text) {
    const g = ch === ' ' ? null : bodyGlyph(ch, color);
    if (g) ctx.drawImage(g.img, x, y, g.img.width * size, g.img.height * size);
    x += advance(ch) * size;
  }
}

// ---- Header font (art/aseprite/ui/font-header.lua) ----
// Small glyphs are 11 art px tall plus the outline. The big size (the title
// logo) doubles the fill but keeps a 1 art px outline, so the letters stay
// on the game's art grid and their counters stay open.
const HEADER_NAMES = { '!': 'excl', '?': 'quest', '-': 'dash', "'": 'apos', '.': 'dot' };
const INK_RGB = [0x1b, 0x23, 0x40];
const glyphCache = new Map();

function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// One canvas for reading glyph pixels.
const reader = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
function pixels(img) {
  reader.canvas.width = img.width; reader.canvas.height = img.height;
  reader.drawImage(img, 0, 0);
  return reader.getImageData(0, 0, img.width, img.height).data;
}

function bigGlyph(small) {
  const w = small.width, h = small.height;
  const src = pixels(small);
  const W = (w - 2) * 2 + 2, H = (h - 2) * 2 + 2;
  const [c, g] = newCanvas(W, H);
  const out = g.createImageData(W, H), d = out.data;
  const fill = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] === 255;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = (y * w + x) * 4;
    if (!src[i + 3] || (src[i] === INK_RGB[0] && src[i + 1] === INK_RGB[1] && src[i + 2] === INK_RGB[2])) continue;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const j = ((1 + (y - 1) * 2 + dy) * W + 1 + (x - 1) * 2 + dx) * 4;
      d[j] = src[i]; d[j + 1] = src[i + 1]; d[j + 2] = src[i + 2]; d[j + 3] = 255;
    }
  }
  const ring = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (!fill(x, y) && (fill(x - 1, y) || fill(x + 1, y) || fill(x, y - 1) || fill(x, y + 1))) ring.push((y * W + x) * 4);
  for (const j of ring) { d[j] = INK_RGB[0]; d[j + 1] = INK_RGB[1]; d[j + 2] = INK_RGB[2]; d[j + 3] = 255; }
  g.putImageData(out, 0, 0);
  return c;
}

// { img, adv } for a character at a size; adv in art px.
function headerGlyph(ch, big) {
  const key = (big ? 'B' : 'S') + ch;
  if (glyphCache.has(key)) return glyphCache.get(key);
  const g = SPR.header[HEADER_NAMES[ch] || ch];
  const v = g ? (big ? { img: bigGlyph(g.small), adv: (g.adv - 2) * 2 + 2 } : { img: g.small, adv: g.adv }) : null;
  glyphCache.set(key, v);
  return v;
}

// The glyph filled with one color, for the drop shadow.
const tinted = new Map();
function tint(img, color) {
  const m = tinted.get(img) || new Map();
  tinted.set(img, m);
  if (!m.has(color)) {
    const [c, g] = newCanvas(img.width, img.height);
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    m.set(color, c);
  }
  return m.get(color);
}

const space = big => (big ? 8 : 5);   // art px

// Width in logical px.
export function headerWidth(text, big = false) {
  let w = 0;
  for (const ch of String(text).toUpperCase()) w += ch === ' ' ? space(big) : (headerGlyph(ch, big)?.adv || 0);
  return w * CELL;
}

// Draws a header with its top at y: cream letters with a Night Ink outline,
// and a drop shadow 1 art px down and right when shadow is a color.
// big: the title logo size (24 art px tall instead of 13).
export function drawHeader(ctx, text, x, y, { big = false, align = 'center', shadow = null } = {}) {
  text = String(text).toUpperCase();
  if (align === 'center') x -= Math.floor(headerWidth(text, big) / 2 / CELL) * CELL;
  else if (align === 'right') x -= headerWidth(text, big);
  for (const pass of shadow ? ['shadow', 'glyph'] : ['glyph']) {
    let pen = x;
    for (const ch of text) {
      if (ch === ' ') { pen += space(big) * CELL; continue; }
      const g = headerGlyph(ch, big);
      if (!g) continue;
      const img = pass === 'shadow' ? tint(g.img, shadow) : g.img, o = pass === 'shadow' ? CELL : 0;
      ctx.drawImage(img, pen + o, y + o, img.width * CELL, img.height * CELL);
      pen += g.adv * CELL;
    }
  }
}
