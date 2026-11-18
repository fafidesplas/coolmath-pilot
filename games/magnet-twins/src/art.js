// Art styles you can switch live (presentation build): ?art=<id>, the pill at the bottom of
// the screen, or the V key. Each style is a palette, a font, optional tile/background sprites
// (CC0 packs, see assets/CREDITS.md) and optional sound samples. Gameplay never changes.
// `classic` is the drawn-in-code look from the GDD and stays the default.
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

export const STYLES = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'The look from the GDD: drawn in code, warm workshop, thick outlines.',
    pack: 'None (procedural canvas drawing, system font, synthesized sound)',
    license: 'Original work',
    url: '',
    palette: {},
  },
  {
    id: 'pixel',
    name: 'Pixel Workshop',
    description: 'Retro pixel art: Kenney pixel tiles, the whole world rendered at low resolution, 8-bit sounds.',
    pack: 'Kenney Pixel Platformer + Pixel Platformer Industrial Expansion + Digital Audio; font Press Start 2P',
    license: 'CC0 1.0 (Kenney packs), SIL OFL 1.1 (font)',
    url: 'https://kenney.nl/assets/pixel-platformer',
    font: { family: 'MT Press Start', file: 'PressStart2P-Regular.ttf', scale: 0.6, weight: 400 },
    round: 0,
    pixel: 0.45,          // world drawn at 45% resolution: one 18 px source tile per 40 px game tile
    images: { tiles: 'tiles.png', ind: 'tiles-industrial.png', bg: 'backgrounds.png' },
    palette: {
      plus: '#E43B44', minus: '#0099DB', ink: '#262B44', bg: '#DFF6F5', metal: '#8B9BB4', bolt: '#FEE761',
      text: '#262B44', onBolt: '#262B44', panel: '#F4ECD6', hud: '#262B44', hudText: '#FFFFFF',
      metalDark: '#5A6988', spike: '#C0CBDC', off: '#B9B4A6', dim: '#6E7A95', faint: '#8F8A7E', sub: '#5A6988',
      slot: '#D9CFB5', slotText: '#A79F88', lock: '#8B9BB4', starOff: '#C9C1AB',
      next: '#FEE761', soloTint: '#F2A7AB', coopTint: '#A6D8F0', exitIn: '#3A4466', frame: '#181425',
    },
    sounds: sfx('pixel', {
      click: 'click', jump: 'jump', bolt: 'bolt', zap: 'zap', powerOn: 'powerOn', switch: 'switch',
      checkpoint: 'checkpoint', star: 'star', doorOpen: 'doorOpen', doorShut: 'doorShut', rebuild: 'rebuild', exit: 'exit',
    }),
    volume: 0.45,
  },
  {
    id: 'factory',
    name: 'Toy Factory',
    description: 'Clean flat vector art: Kenney industrial tiles and metal crates in a sunny yard, chunky rounded font, real metal clanks.',
    pack: 'Kenney Platformer Pack Industrial + New Platformer Pack (backgrounds) + Impact Sounds + Interface Sounds; font Lilita One',
    license: 'CC0 1.0 (Kenney packs), SIL OFL 1.1 (font)',
    url: 'https://kenney.nl/assets/platformer-pack-industrial',
    font: { family: 'MT Lilita', file: 'LilitaOne-Regular.ttf', scale: 1.05, weight: 400 },
    round: 1,
    images: { tiles: 'tiles.png', hills: 'background_color_hills.png', clouds: 'background_clouds.png' },
    palette: {
      plus: '#EA5B3F', minus: '#3B8FDB', ink: '#35414F', bg: '#C3E3FF', metal: '#B7C5CA', bolt: '#FFCC33',
      text: '#35414F', onBolt: '#35414F', panel: '#FFFFFF', hud: '#35414F', hudText: '#FFFFFF',
      metalDark: '#7F9399', spike: '#D5DEE1', off: '#C9D3D8', dim: '#8193A3', faint: '#93A3B0', sub: '#5B6B7B',
      slot: '#DCE6EB', slotText: '#A3B3BE', lock: '#8C9CA8', starOff: '#D4DDE3',
      next: '#FFE7A0', soloTint: '#F7C2B6', coopTint: '#C0DAF4', exitIn: '#4A5868', frame: '#26303B',
    },
    sounds: sfx('factory', {
      click: 'click', clank: ['clank1', 'clank2', 'clank3'], land: ['land1', 'land2'], doorShut: 'doorShut',
      doorOpen: 'doorOpen', star: 'star', bolt: 'bolt', switch: 'switch', checkpoint: 'checkpoint', zap: 'zap', jump: 'jump',
    }),
    volume: 0.7,
  },
  {
    id: 'neon',
    name: 'Night Neon',
    description: 'Dark synthwave arcade: glowing outlines and fields, neon grid, techno font, sci-fi sounds.',
    pack: 'Kenney Sci-fi Sounds; font Orbitron (visuals drawn in code)',
    license: 'CC0 1.0 (Kenney pack), SIL OFL 1.1 (font)',
    url: 'https://kenney.nl/assets/sci-fi-sounds',
    font: { family: 'MT Orbitron', file: 'Orbitron.ttf', scale: 0.8 },
    round: 0.6,
    glow: true,
    palette: {
      plus: '#FF3D7F', minus: '#22D3FF', ink: '#0B0918', bg: '#140F2E', metal: '#7880C8', bolt: '#FFE14D',
      text: '#EDE9FF', onBolt: '#0B0918', panel: '#211A47', hud: '#0B0918', hudText: '#EDE9FF',
      tileFill: '#1C1640', tileTop: '#2C2366', tileDark: '#3A2F80',
      metalDark: '#3B3F78', spike: '#FF3D7F', water: 'rgba(34,211,255,0.30)',
      off: '#3A3458', dim: '#5E567E', faint: '#6F6796', sub: '#A79FD0',
      slot: '#1A1438', slotText: '#4A4274', lock: '#5E567E', starOff: '#3A3458',
      next: '#3B2F7A', soloTint: '#5A1F45', coopTint: '#163E5C', exitIn: '#05040C', frame: '#05040C',
      edge: '#9B7BFF', line: '#9B7BFF',
    },
    sounds: sfx('neon', {
      powerOn: 'powerOn', clank: 'clank', doorOpen: 'doorOpen', doorShut: 'doorShut', zap: 'zap',
      jump: 'jump', switch: 'switch', rebuild: 'rebuild', click: 'click',
    }),
    volume: 0.5,
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
// tiles fall back to the drawn look and text to the system font.
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

// ---- Tile and background painters for the sprite styles ------------------------------

// Source rects: [image key, sx, sy, size].
const PX = s => (c, r) => [s, c * 18, r * 18, 18];
const pp = PX('tiles'), ind = PX('ind');
const PIXEL_TILES = {
  top: ind(2, 0), fill: ind(2, 2), metal: ind(14, 3), spikes: pp(8, 3), waterTop: pp(13, 1), water: pp(13, 2),
};
const FX70 = (c, r) => ['tiles', c * 70, r * 70, 70];
const FACTORY_TILES = {
  top: ['tiles', 140, 0, 70], fill: ['tiles', 280, 70, 70], metal: FX70(0, 5), spikes: FX70(9, 3),
  water: FX70(9, 6), crate: FX70(0, 4),
};

function blit(ctx, src, x, y, w = T, h = T) {
  const im = art.img[src[0]];
  if (!im) return false;
  ctx.drawImage(im, src[1], src[2], src[3], src[3], x, y, w, h);
  return true;
}

// Paints one tile for sprite styles. Returns false to let the classic painter handle it.
// kind: 'top' | 'fill' | 'metal' | 'spikes' | 'water' | 'waterTop'
export function paintTile(ctx, kind, px, py) {
  const id = art.style.id;
  if (id === 'pixel') {
    const src = PIXEL_TILES[kind];
    return !!src && blit(ctx, src, px, py);
  }
  if (id === 'factory') {
    const k = kind === 'waterTop' ? 'water' : kind;
    const src = FACTORY_TILES[k];
    if (!src) return false;
    if (k === 'water') {
      ctx.globalAlpha = 0.8;
      const ok = blit(ctx, src, px, py + (kind === 'waterTop' ? 8 : 0), T, kind === 'waterTop' ? T - 8 : T);
      ctx.globalAlpha = 1;
      return ok;
    }
    return blit(ctx, src, px, py);
  }
  return false;
}

export function crateSprite() {
  return art.style.id === 'factory' && art.img.tiles ? FACTORY_TILES.crate : null;
}
export { blit };

// Background for the playfield (w × h). Returns false for the classic pegboard.
export function paintBackground(ctx, w, h) {
  const id = art.style.id, C = COLORS;
  if (id === 'pixel' && art.img.bg) {
    // 24 px background tiles (pale cyan scene, columns 0–3): sky, skyline, ground.
    const s = 24 / art.style.pixel, im = art.img.bg;
    const horizon = Math.round(h * 0.5 / s) * s;
    for (let x = 0, i = 0; x < w; x += s, i++) {
      const col = i % 4;
      for (let y = 0; y < horizon; y += s) ctx.drawImage(im, col * 24, 0, 24, 24, x, y, s, s);
      ctx.drawImage(im, col * 24, 24, 24, 24, x, horizon, s, s);
      for (let y = horizon + s; y < h; y += s) ctx.drawImage(im, col * 24, 48, 24, 24, x, y, s, s);
    }
    return true;
  }
  if (id === 'factory' && art.img.clouds) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    const k = 1.5, tw = 256 * k;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 256 * k - 8, w, h);
    for (let x = 0; x < w; x += tw) ctx.drawImage(art.img.clouds, x, 0, tw, 256 * k);
    if (art.img.hills) for (let x = 0; x < w; x += tw) ctx.drawImage(art.img.hills, 0, 100, 256, 156, x, h - 156 * k, tw, 156 * k);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, 0, w, h);
    return true;
  }
  if (id === 'neon') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0E0A24'); g.addColorStop(0.6, '#24103F'); g.addColorStop(1, '#3A1250');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // stars
    let seed = 11;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(237,233,255,${0.25 + rnd() * 0.5})`;
      ctx.fillRect(rnd() * w, rnd() * h * 0.6, 2, 2);
    }
    // sun
    const sy = h * 0.62;
    const sg = ctx.createLinearGradient(0, sy - 150, 0, sy);
    sg.addColorStop(0, 'rgba(255,225,77,0.55)'); sg.addColorStop(1, 'rgba(255,61,127,0.45)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(w / 2, sy, 150, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#24103F';
    for (let i = 0; i < 6; i++) ctx.fillRect(w / 2 - 160, sy - 14 - i * 22, 320, 3 + i * 0.6);
    // perspective grid below the horizon
    ctx.strokeStyle = 'rgba(155,123,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = -16; i <= 16; i++) { ctx.moveTo(w / 2 + i * 30, sy); ctx.lineTo(w / 2 + i * 160, h); }
    for (let k = 0; k < 8; k++) { const y = sy + (h - sy) * (k / 8) ** 1.8; ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    return true;
  }
  return false;
}
