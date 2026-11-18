// Art styles you can switch live (presentation build): ?art=<id>, the pill at the bottom of
// the screen, or the V key. `classic` is the drawn-in-code look from the GDD and stays the
// default. The other styles draw the robots, tiles, background and level objects with
// sprites from third-party CC0 packs (see assets/CREDITS.md); fields, aim previews, the HUD
// and menus stay drawn in code with the style's palette and font. Gameplay never changes.
import { COLORS, T } from './config.js';

// Colors used by the renderer beyond the GDD's six. Classic values match the original look.
const BASE = {
  plus: '#E8463A', minus: '#2F7FE0', ink: '#2B2238', bg: '#FFF1DC', metal: '#9AA5B1', bolt: '#FFC531',
  text: '#2B2238',        // text on backgrounds and panels
  onBolt: '#2B2238',      // text on yellow buttons
  panel: '#FFFFFF',       // button and card fill
  hud: '#2B2238', hudText: '#FFF1DC',
  tileFill: '#E9C9A0', tileTop: '#F7E3C4', tileDark: '#D4AE84',
  metalDark: '#7D8894', spike: '#C8CED6', water: 'rgba(47,127,224,0.45)',
  off: '#CFC3B4', dim: '#8C7F9C', faint: '#A89A8A', sub: '#6B5D7A',
  slot: '#E2D6C6', slotText: '#B4A797', lock: '#9C8F80', starOff: '#D9CDBD',
  next: '#FFE9A8', soloTint: '#F6C3BE', coopTint: '#BFD6F5', exitIn: '#5A4A6E',
  frame: '#2B2238',       // letterbox around the 16:9 view
  line: '#2B2238',        // outline of buttons and panels
};

const dir = id => `assets/art/${id}/`;
const sfx = (id, names) => Object.fromEntries(Object.entries(names).map(([k, v]) => [k, [].concat(v).map(f => `${dir(id)}sfx/${f}.mp3`)]));

// Sprite rects: [image key, sx, sy, sw, sh]. Cells of a horizontal atlas row:
const row = (key, size, y = 0) => i => [key, i * size, y, size, size];
const B16 = row('tiles', 16), K80 = row('tiles', 80);

export const STYLES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'The look from the GDD, drawn in code: warm workshop, thick outlines.',
    pack: 'None (procedural canvas drawing, system font, synthesized sound)',
    author: 'Magnet Twins team',
    license: 'Original work',
    url: '',
    palette: {},
  },
  {
    id: 'bay',
    name: 'Sunset Bay',
    description: '8-bit pixel art: NES-style robots, brick and steel tiles, a sunset sea behind.',
    pack: 'Gum Bot sprites (GrafxKid) + Mega Bot Areas Pack 1 and Stomper (ansimuz)',
    author: 'GrafxKid; Luis Zuno (ansimuz)',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/megabot-areas-pack-1',
    extras: 'Font Press Start 2P (SIL OFL 1.1); sounds Kenney Digital Audio (CC0)',
    font: { family: 'MT Press Start', file: 'PressStart2P-Regular.ttf', scale: 0.6, weight: 400 },
    round: 0,
    pixel: 0.4,           // world drawn at 40% resolution: one 16 px source tile per 40 px game tile
    images: { tiles: 'tiles.png', bg: 'bg.png', plus: 'plus.png', minus: 'minus.png' },
    sprites: {
      // 32x32 frames, 16x18 px robot standing on the frame's bottom row; 1 source px = 2.5 game px
      robot: { fw: 32, fh: 32, w: 80, h: 80, foot: 0, ox: -1, idle: [0], blink: 1, jump: 2, walk: [3, 4, 5, 6], fps: 10, badge: [0, 30, 6] },
      fill: [B16(0), B16(1), B16(2), B16(3)], top: [B16(0), B16(1)], quad: true,
      metal: B16(4), crate: B16(5), spikes: B16(6), waterTop: B16(7), water: B16(8),
      gate: [B16(10), B16(9)], plat: [B16(11), B16(12), B16(11)],
      bolt: { frames: [0, 1, 2, 3, 4, 5].map(i => ['tiles', i * 16, 16, 16, 16]), size: 40, fps: 8 },
      exit: { closed: [[['tiles', 96, 16, 24, 25], 10, 18, 60, 62.5]], open: [[['tiles', 120, 16, 24, 25], 10, 18, 60, 62.5]] },
      bg: { key: 'bg', mode: 'bottom', scale: 2.5, sky: '#DB4161' },
    },
    palette: {
      plus: '#D8283A', minus: '#1399D3', ink: '#15111F', bg: '#F9DDB8', metal: '#9C7BD0', bolt: '#FFB547',
      text: '#15111F', onBolt: '#15111F', panel: '#FDEBD3', hud: '#2A1838', hudText: '#FFF1DC',
      metalDark: '#5B4386', off: '#BFA7A0', dim: '#7C6578', faint: '#A08A86', sub: '#5B4386',
      slot: '#E8C9A8', slotText: '#B0927A', lock: '#9C7BD0', starOff: '#D9BFA6',
      next: '#FFD27A', soloTint: '#F2A2AA', coopTint: '#9FD3EE', exitIn: '#1E1030', frame: '#160C24',
    },
    sounds: sfx('bay', {
      click: 'click', jump: 'jump', bolt: 'bolt', zap: 'zap', powerOn: 'powerOn', switch: 'switch',
      checkpoint: 'checkpoint', star: 'star', doorOpen: 'doorOpen', doorShut: 'doorShut', rebuild: 'rebuild', exit: 'exit',
    }),
    volume: 0.45,
  },
  {
    id: 'lab',
    name: 'Sci-Fi Lab',
    description: 'Illustrated cartoon: armored robots with soft shading in a dark steel lab.',
    pack: 'The Robot - Free Sprite + Free Sci-Fi Platformer Game Tileset (GameArt2D)',
    author: 'pzUH (GameArt2D.com)',
    license: 'CC0 1.0',
    url: 'https://opengameart.org/content/free-sci-fi-platformer-game-tileset',
    extras: 'Font Orbitron (SIL OFL 1.1); sounds Kenney Sci-fi Sounds (CC0)',
    font: { family: 'MT Orbitron', file: 'Orbitron.ttf', scale: 0.8 },
    round: 0.5,
    images: { tiles: 'tiles.png', obj: 'objects.png', plus: 'plus.png', minus: 'minus.png' },
    sprites: {
      // 88x112 frames drawn at half size, feet on the frame's bottom edge
      robot: { fw: 88, fh: 112, w: 44, h: 56, foot: 0.5, ox: 0, idle: [0, 1, 2], idleFps: 3, jump: 11, walk: [3, 4, 5, 6, 7, 8, 9, 10], fps: 14, badge: [-6, 24, 6.5] },
      top: [K80(0)], fill: [K80(1)], metal: K80(2), crate: K80(3), spikes: K80(4),
      waterTop: K80(5), water: K80(6), gate: [K80(7)], plat: [K80(8), K80(9), K80(10)],
      exit: { closed: [[['obj', 0, 0, 96, 160], 16, 0, 48, 80]], open: [[['obj', 96, 0, 96, 160], 16, 0, 48, 80]] },
      flag: { off: ['obj', 192, 0, 45, 160], on: ['obj', 237, 0, 45, 160], w: 22, h: 78 },
      bg: { mode: 'checker', cells: [K80(11), K80(12)], wash: 'rgba(150,160,185,0.22)' },
    },
    palette: {
      plus: '#E8333A', minus: '#2F86E8', ink: '#1B1D26', bg: '#E6EAF0', metal: '#C9C3B6', bolt: '#FFD23F',
      text: '#1B1D26', onBolt: '#1B1D26', panel: '#F4F1EA', hud: '#1B1D26', hudText: '#F4F1EA',
      metalDark: '#3B3F55', water: 'rgba(124,214,62,0.5)', off: '#B9BCC6', dim: '#6E7385', faint: '#8B90A0', sub: '#4A4F66',
      slot: '#D6DAE2', slotText: '#9AA0B0', lock: '#8B90A0', starOff: '#C9CDD6',
      next: '#FFE58A', soloTint: '#F4B4B6', coopTint: '#B4D2F4', exitIn: '#0E0F15', frame: '#0E0F15',
    },
    sounds: sfx('lab', {
      powerOn: 'powerOn', clank: 'clank', doorOpen: 'doorOpen', doorShut: 'doorShut', zap: 'zap',
      jump: 'jump', switch: 'switch', rebuild: 'rebuild', click: 'click',
    }),
    volume: 0.5,
  },
  {
    id: 'yard',
    name: 'Robot Yard',
    description: 'Flat vector: boxy tracked robots, grass and dirt blocks, keyhole locks, pale sky.',
    pack: 'Robot Pack + Platformer Pack Redux (Kenney)',
    author: 'Kenney (kenney.nl)',
    license: 'CC0 1.0',
    url: 'https://kenney.nl/assets/robot-pack',
    extras: 'Font Lilita One (SIL OFL 1.1); sounds Kenney Impact Sounds and Interface Sounds (CC0)',
    font: { family: 'MT Lilita', file: 'LilitaOne-Regular.ttf', scale: 1.05, weight: 400 },
    round: 1,
    images: { tiles: 'tiles.png', bg: 'bg.png', plus: 'plus.png', minus: 'minus.png' },
    sprites: {
      // 100x83 frames (body top-left, tracks below), drawn at half size
      robot: { fw: 100, fh: 83, w: 50, h: 41.5, foot: 4, ox: 2, idle: [0], jump: 2, walk: [0, 1], fps: 12, badge: [-8, 22, 6.5] },
      top: [K80(0)], fill: [K80(1)], metal: K80(2), crate: K80(3), spikes: K80(4),
      waterTop: K80(5), water: K80(6), plat: [K80(2), K80(2), K80(2)],
      gateLock: { plus: K80(7), minus: K80(8), any: K80(9) },
      plateLock: { plus: K80(7), minus: K80(8), any: K80(9) },
      exit: { closed: [[K80(10), 20, 0, 40, 40], [K80(11), 20, 40, 40, 40]], open: [[K80(12), 20, 0, 40, 40], [K80(13), 20, 40, 40, 40]] },
      bolt: { frames: [K80(14)], size: 56, spin: true },
      flag: { off: K80(15), on: [K80(16), K80(17)], w: 56, h: 56, ox: 12, fps: 5 },
      bg: { key: 'bg', mode: 'repeat', size: 640, sky: '#D1F2F6' },
    },
    palette: {
      plus: '#E2603F', minus: '#2E86DE', ink: '#33414F', bg: '#D7F1F5', metal: '#B4BEC4', bolt: '#FFCB2E',
      text: '#33414F', onBolt: '#33414F', panel: '#FFFFFF', hud: '#33414F', hudText: '#FFFFFF',
      metalDark: '#7F8C94', water: 'rgba(90,190,230,0.55)', off: '#C9D3D8', dim: '#8193A3', faint: '#93A3B0', sub: '#5B6B7B',
      slot: '#DCE6EB', slotText: '#A3B3BE', lock: '#8C9CA8', starOff: '#D4DDE3',
      next: '#FFE7A0', soloTint: '#F7C2B6', coopTint: '#C0DAF4', exitIn: '#4A5868', frame: '#26303B',
    },
    sounds: sfx('yard', {
      click: 'click', clank: ['clank1', 'clank2', 'clank3'], land: ['land1', 'land2'], doorShut: 'doorShut',
      doorOpen: 'doorOpen', star: 'star', bolt: 'bolt', switch: 'switch', checkpoint: 'checkpoint', zap: 'zap', jump: 'jump',
    }),
    volume: 0.7,
  },
];

export const ART_IDS = STYLES.map(s => s.id);

// The active style. Renderers read `art.style`, `art.img` and the patched COLORS.
export const art = { style: STYLES[0], img: {}, font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' };
const SYSTEM_FONT = art.font;

const imgCache = {};
const fontCache = {};

function loadImage(url) {
  if (!imgCache[url]) {
    imgCache[url] = new Promise(resolve => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => { console.warn('art: missing image', url); resolve(null); };
      im.src = url;
    });
  }
  return imgCache[url];
}

function loadFont(style) {
  const f = style.font;
  if (!f || typeof FontFace === 'undefined' || typeof document === 'undefined' || !document.fonts) return Promise.resolve(false);
  if (!fontCache[f.family]) {
    const face = new FontFace(f.family, `url(${dir(style.id)}${f.file})`);
    fontCache[f.family] = face.load().then(ff => { document.fonts.add(ff); return true; })
      .catch(e => { console.warn('art: font failed', f.file, e); return false; });
  }
  return fontCache[f.family];
}

export function styleById(id) { return STYLES.find(s => s.id === id) || null; }

// Loads a style's files (once) and makes it active. A missing file never stops the game:
// anything without its sprite falls back to the drawn look and text to the system font.
export async function applyArt(id) {
  const style = styleById(id) || STYLES[0];
  const entries = Object.entries(style.images || {});
  const timeout = new Promise(r => setTimeout(r, 4000));
  const [imgs, fontOk] = await Promise.race([
    Promise.all([Promise.all(entries.map(([, f]) => loadImage(dir(style.id) + f))), loadFont(style)]),
    timeout.then(() => [entries.map(() => null), false]),
  ]);
  art.style = style;
  art.img = {};
  entries.forEach(([k], i) => { if (imgs[i]) art.img[k] = imgs[i]; });
  art.font = style.font && fontOk ? `"${style.font.family}", ${SYSTEM_FONT}` : SYSTEM_FONT;
  for (const k in COLORS) delete COLORS[k];
  Object.assign(COLORS, BASE, style.palette);
  return style;
}

// Font string for a size and weight, scaled for wide pixel/techno fonts.
export function fontSpec(size, weight = 800) {
  const f = art.style.font;
  const w = f && f.weight ? f.weight : weight;
  const s = f && f.scale ? size * f.scale : size;
  return `${w} ${Math.round(s * 10) / 10}px ${art.font}`;
}

// Start with the classic palette (synchronously) so nothing draws with missing colors.
Object.assign(COLORS, BASE);

// The active style's sprite table, or null for classic.
export function spr() { return art.style.sprites || null; }

// Draws a sprite rect into (x, y, w, h). Returns false when its sheet is not loaded.
export function blit(ctx, src, x, y, w = T, h = T) {
  const im = src && art.img[src[0]];
  if (!im) return false;
  ctx.drawImage(im, src[1], src[2], src[3], src[4], x, y, w, h);
  return true;
}

// Paints one tile for sprite styles. Returns false to let the classic painter handle it.
// kind: 'top' | 'fill' | 'metal' | 'spikes' | 'water' | 'waterTop'; tx, ty: tile coords.
export function paintTile(ctx, kind, px, py, tx = 0, ty = 0) {
  const S = spr();
  if (!S) return false;
  let src = S[kind];
  if (Array.isArray(src) && Array.isArray(src[0])) {
    // variants: a 2x2 block (quad) or a left-right alternation
    src = S.quad && src.length === 4 ? src[(tx & 1) + (kind === 'top' ? 0 : (ty & 1) * 2)] : src[tx % src.length];
  }
  return blit(ctx, src, px, py);
}

// Background for the playfield (w × h). Returns false for the classic pegboard.
export function paintBackground(ctx, w, h) {
  const S = spr();
  const bg = S && S.bg;
  if (!bg) return false;
  if (bg.mode === 'checker') {
    for (let y = 0, j = 0; y < h; y += 2 * T, j++) for (let x = 0, i = 0; x < w; x += 2 * T, i++) {
      if (!blit(ctx, bg.cells[(i + j) % bg.cells.length], x, y, 2 * T, 2 * T)) return false;
    }
    if (bg.wash) { ctx.fillStyle = bg.wash; ctx.fillRect(0, 0, w, h); }
    return true;
  }
  const im = art.img[bg.key];
  if (!im) return false;
  ctx.fillStyle = bg.sky; ctx.fillRect(0, 0, w, h);
  if (bg.mode === 'bottom') {
    // pixel art: one source px per low-res px, anchored to the bottom, repeated sideways
    const tw = im.width * bg.scale, th = im.height * bg.scale;
    for (let x = 0; x < w; x += tw) ctx.drawImage(im, x, h - th, tw, th);
  } else {
    for (let x = 0; x < w; x += bg.size) ctx.drawImage(im, x, h - bg.size, bg.size, bg.size);
  }
  return true;
}
