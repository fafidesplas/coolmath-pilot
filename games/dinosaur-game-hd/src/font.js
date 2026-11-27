// Pixel bitmap font, 5×7 glyphs drawn in code (GDD 9: no web fonts), for body
// text. Screen headers use the Aseprite header font below (drawHeader).
import { SPR } from './sprites.js';
import { CELL } from './art.js';

// Each glyph is 7 rows of 5 bits, top row first. One atlas canvas per color.

const GLYPHS = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31],
  3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12],
  '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4], ':': [0, 12, 12, 0, 12, 12, 0], '-': [0, 0, 0, 31, 0, 0, 0],
  '/': [1, 1, 2, 4, 8, 16, 16], "'": [4, 4, 8, 0, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0],
  '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8],
};
const CHARS = Object.keys(GLYPHS);
const INDEX = new Map(CHARS.map((c, i) => [c, i]));
const atlases = new Map();

function atlas(color) {
  let c = atlases.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = CHARS.length * 6; c.height = 7;
  const g = c.getContext('2d');
  g.fillStyle = color;
  CHARS.forEach((ch, i) => GLYPHS[ch].forEach((row, y) => {
    for (let x = 0; x < 5; x++) if (row & (16 >> x)) g.fillRect(i * 6 + x, y, 1, 1);
  }));
  atlases.set(color, c);
  return c;
}

export const textWidth = (text, size = 1) => text.length ? (text.length * 6 - 1) * size : 0;

// Draws `text` with its top at y. align: 'left' | 'center' | 'right'.
export function drawText(ctx, text, x, y, size, color, align = 'left') {
  text = String(text).toUpperCase();
  const w = textWidth(text, size);
  if (align === 'center') x -= Math.floor(w / 2);
  else if (align === 'right') x -= w;
  const a = atlas(color);
  for (let i = 0; i < text.length; i++) {
    const g = INDEX.get(text[i]);
    if (g !== undefined) ctx.drawImage(a, g * 6, 0, 5, 7, x + i * 6 * size, y, 5 * size, 7 * size);
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
