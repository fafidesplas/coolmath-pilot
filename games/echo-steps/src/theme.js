// Switchable art styles (presentation build). ?art=<id> picks one; the default is
// "classic", the Night Neon look from GDD 9; the others use downloaded art packs. A style swaps the six palette colors in
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
    id: 'adventure', name: 'Pixel Adventure',
    colors: { navy: '#211F30', pale: '#FFFFFF', cyan: '#3FA9F5', violet: '#F06FC0', yellow: '#FFC93C', pink: '#E8483B' },
    bg: '#211F30', dark: '#211F30', overlay: 'rgba(33,31,48,0.62)',
    font: '"Silkscreen", ' + SYSTEM_FONT, fontFile: 'Silkscreen-Bold.ttf', fontFamily: 'Silkscreen', fontScale: 0.75,
    glow: false, pixelated: true, ui: { radius: 0.25, shadow: 4 },
    images: {
      terrain: 'terrain.png', bg: 'bg-blue.png',
      idle: 'vguy-idle.png', run: 'vguy-run.png', jump: 'vguy-jump.png', fall: 'vguy-fall.png',
      eIdle: 'pinkman-idle.png', eRun: 'pinkman-run.png', eJump: 'pinkman-jump.png', eFall: 'pinkman-fall.png',
      plate: 'plate-off.png', plateOn: 'plate-on.png', trophy: 'trophy.png',
    },
  },
  {
    id: 'lab', name: 'Robot Lab',
    colors: { navy: '#1C1F2B', pale: '#F2F4F7', cyan: '#FFC21A', violet: '#5FD3F3', yellow: '#9BE15D', pink: '#FF5A4E' },
    bg: '#14161F', dark: '#14161F', overlay: 'rgba(16,18,26,0.66)',
    font: '"Chakra Petch", ' + SYSTEM_FONT, fontFile: 'ChakraPetch-Bold.ttf', fontFamily: 'Chakra Petch', maxWeight: 700,
    glow: false, ui: { radius: 0.4, shadow: 0 },
    images: {
      top: 'tile-2.png', fill: 'tile-5.png', ledge: 'tile-12.png', back: 'bgtile-3.png', back2: 'bgtile-4.png', lamp: 'bgtile-1.png',
      door: 'doorlocked.png', exit: 'dooropen.png',
      idle: 'robot-idle.png', run: 'robot-run.png', jump: 'robot-jump.png',
    },
  },
  {
    id: 'planet', name: 'Alien Planet',
    colors: { navy: '#3A3354', pale: '#FFFFFF', cyan: '#62C46B', violet: '#5AA8E8', yellow: '#FFCC00', pink: '#F0662F' },
    bg: '#D2F4F7', dark: '#3A3354', overlay: 'rgba(40,34,62,0.55)',
    font: '"Fredoka", ' + SYSTEM_FONT, fontFile: 'Fredoka.ttf', fontFamily: 'Fredoka', maxWeight: 700,
    glow: false, ui: { radius: 1.4, shadow: 6 },
    images: {
      top: 'planetMid.png', fill: 'planetCenter.png', sky: 'blue_shroom.png',
      stand: 'alienGreen_stand.png', walk1: 'alienGreen_walk1.png', walk2: 'alienGreen_walk2.png', jump: 'alienGreen_jump.png',
      eStand: 'alienBlue_stand.png', eWalk1: 'alienBlue_walk1.png', eWalk2: 'alienBlue_walk2.png', eJump: 'alienBlue_jump.png',
      button: 'switchYellow.png', buttonDown: 'switchYellow_pressed.png', lock: 'lockRed.png',
      door: 'doorOpen_mid.png', doorTop: 'doorOpen_top.png',
    },
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
