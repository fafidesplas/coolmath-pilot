// Switchable art styles (presentation build). ?art=<id> picks one; the default is
// "classic", the Night Neon look from GDD 9. A style swaps the six palette colors in
// place (COLORS is shared by every draw call), the font, the UI chrome and, through
// hooks registered by art.js, the room tiles, figures and devices. Images and fonts load
// in the background; until they arrive everything falls back to the drawn shapes, so a
// style never blocks the game and works without a DOM (Node tests).
import { COLORS } from './config.js';

const SYSTEM_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const CLASSIC_COLORS = { ...COLORS };

export const THEMES = [
  {
    id: 'classic', name: 'Night Neon',
    colors: CLASSIC_COLORS,
    bg: '#070A18', dark: '#0A0E22', overlay: 'rgba(7,10,24,0.6)',
    font: SYSTEM_FONT, glow: true, ui: { radius: 1, shadow: 0 },
  },
  {
    id: 'pixel', name: 'Pixel Meadow',
    colors: { navy: '#2B2240', pale: '#FFF7E8', cyan: '#4FB8FF', violet: '#F27BE0', yellow: '#FFC93C', pink: '#E8483B' },
    bg: '#1B1528', dark: '#3A2E4F', overlay: 'rgba(27,21,40,0.62)',
    font: '"Silkscreen", ' + SYSTEM_FONT, fontFile: 'Silkscreen-Bold.ttf', fontFamily: 'Silkscreen', fontScale: 0.75,
    glow: false, pixelated: true, ui: { radius: 0.25, shadow: 4 },
    images: {
      tiles: 'tilemap_packed.png',
      chars: 'tilemap-characters_packed.png',
      bgs: 'tilemap-backgrounds_packed.png',
    },
  },
  {
    id: 'toybox', name: 'Toybox Shapes',
    colors: { navy: '#2F2A4A', pale: '#FFFFFF', cyan: '#3DA5F5', violet: '#7EE08A', yellow: '#FFD23F', pink: '#F2545B' },
    bg: '#2A2442', dark: '#3B3360', overlay: 'rgba(30,24,52,0.6)',
    font: '"Fredoka", ' + SYSTEM_FONT, fontFile: 'Fredoka.ttf', fontFamily: 'Fredoka', maxWeight: 700,
    glow: false, ui: { radius: 1.4, shadow: 6 },
    images: {
      top: 'tileBlue_05.png', fill: 'tileBlue_03.png', deco: 'tileBlue_08.png', deco2: 'tileBlue_17.png',
      hills: 'set2_hills.png', shapes: 'set2_tiles.png',
      stand: 'playerBlue_stand.png', walk1: 'playerBlue_walk1.png', walk2: 'playerBlue_walk2.png', walk3: 'playerBlue_walk3.png',
      walk4: 'playerBlue_walk4.png', walk5: 'playerBlue_walk5.png', up: 'playerBlue_up1.png', fall: 'playerBlue_fall.png',
      button: 'buttonRed.png', buttonDown: 'buttonRed_pressed.png',
      lockTop: 'lockRedTop.png', lockMid: 'lockRedMid.png', lockBottom: 'lockRedBottom.png',
      door: 'doorOpen.png', doorTop: 'doorOpen_top.png', flag: 'flagGreen_up.png',
    },
  },
  {
    id: 'terminal', name: 'Green Terminal',
    colors: { navy: '#061208', pale: '#B8FFB0', cyan: '#7CFF6B', violet: '#3FD6C6', yellow: '#FFD23F', pink: '#FF6B5B' },
    bg: '#020603', dark: '#040B05', overlay: 'rgba(2,8,3,0.7)',
    font: '"VT323", ui-monospace, Menlo, Consolas, monospace', fontFile: 'VT323.ttf', fontFamily: 'VT323', maxWeight: 400, fontScale: 1.3,
    glow: true, pixelated: true, scanlines: true, ui: { radius: 0, shadow: 0 },
    images: { sheet: 'monochrome-transparent_packed.png' },
  },
];

export const ART = {
  cur: THEMES[0],
  font: SYSTEM_FONT,
  img: {},           // loaded images of the current style (only complete ones)
  version: 0,        // bumps when the style or one of its files finishes loading
  onChange: null,    // set by the game: re-render cached layers
};

export const findTheme = id => THEMES.find(t => t.id === id) || null;
export const artBase = id => `assets/art/${id}/`;
export const fontFor = (size, weight) => {
  const c = ART.cur;
  return `${Math.min(weight, c.maxWeight || 900)} ${Math.round(size * (c.fontScale || 1))}px ${ART.font}`;
};

const loaded = {};   // id -> { img: {}, font: bool } so switching back is instant

function bump() {
  ART.version++;
  if (ART.onChange) ART.onChange();
}

function ensureLoaded(t) {
  const cache = loaded[t.id] || (loaded[t.id] = { img: {}, font: false, started: false });
  if (cache.started) return cache;
  cache.started = true;
  const base = artBase(t.id);
  if (t.images && typeof Image !== 'undefined') {
    for (const [k, file] of Object.entries(t.images)) {
      const im = new Image();
      im.onload = () => { cache.img[k] = im; if (ART.cur === t) bump(); };
      im.onerror = () => console.warn('Art: missing', base + file);
      im.src = base + file;
    }
  }
  if (t.fontFile && typeof FontFace !== 'undefined' && typeof document !== 'undefined' && document.fonts) {
    const ff = new FontFace(t.fontFamily, `url(${base}${t.fontFile})`, { weight: '100 900' });   // one file serves every weight
    ff.load().then(f => {
      document.fonts.add(f);
      cache.font = true;
      if (ART.cur === t) { ART.font = t.font; bump(); }
    }).catch(e => console.warn('Art: font failed', e));
  }
  return cache;
}

export function setTheme(id) {
  const t = findTheme(id) || THEMES[0];
  ART.cur = t;
  Object.assign(COLORS, t.colors);
  const cache = ensureLoaded(t);
  ART.img = cache.img;
  ART.font = t.fontFile && !cache.font ? SYSTEM_FONT : t.font;
  bump();
  return t;
}

// Load every style's files in the background, so a switch during the demo is instant.
export function preloadAll() { for (const t of THEMES) ensureLoaded(t); }

export function nextThemeId(id) {
  const i = THEMES.findIndex(t => t.id === id);
  return THEMES[(i + 1) % THEMES.length].id;
}
