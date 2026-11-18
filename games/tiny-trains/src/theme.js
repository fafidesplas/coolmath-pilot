// Art styles (presentation): switch with ?art=<id>, the Art pill on the title, level
// select and pause screens, or the A key. Each style sets the palette, the font, the
// track look, the board scenery (image tiles from CC0 packs), the UI corner radius and
// the sound set. Credits: assets/CREDITS.md. The list order matches art-options.json.
import { applyPalette, CLASSIC_PALETTE } from './config.js';

const ART = new URL('../assets/art/', import.meta.url).href;
const SYS_FONT = '"Trebuchet MS", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

// Sprite kits (styles baked from a 3D pack into top-down sprites by tools/artbake):
// track_h, track_v, curve0..3 (curve r joins edges r and r+1), groundN, scenery
// sprites, an optional buffer stop and trains.png (16 headings x 4 colors).
function kitImages(dir, n) {
  const im = { trains: `${dir}/trains.png`, track_h: `${dir}/track_h.png`, track_v: `${dir}/track_v.png` };
  for (let r = 0; r < 4; r++) im['curve' + r] = `${dir}/curve${r}.png`;
  const ground = [], scenery = [];
  for (let i = 1; i <= (n.ground || 0); i++) { im['ground' + i] = `${dir}/ground${i}.png`; ground.push('ground' + i); }
  for (const k of ['tree', 'bush', 'stone', 'rock', 'flower']) for (let i = 1; i <= (n[k] || 0); i++) { im[k + i] = `${dir}/${k}${i}.png`; scenery.push(k + i); }
  if (n.buffer) im.buffer = `${dir}/buffer.png`;
  return { images: im, ground, scenery };
}

export const THEMES = [
  {
    id: 'classic', name: 'Classic Toybox',
    palette: CLASSIC_PALETTE,
    track: 'wood', pixel: 0, radius: 1, outline: 1,
  },
  {
    id: 'voxel', name: 'Voxel Railway',
    palette: {
      ink: '#26303A', cream: '#EEF3E2', wood: '#7A5A3C',
      red: '#D23B33', blue: '#2F78D0', yellow: '#E8C21E', green: '#2E9E46',
      grass: '#1F9A3E', grassDark: '#178535', panel: '#DCE6CF',
    },
    track: 'kit', pixel: 0, radius: 0.4, outline: 1, symbol: 1.15,
    kit: kitImages('voxel', { ground: 4, tree: 4, stone: 2, buffer: true }),
    trainScale: 1.45, sceneryScale: 1.0,
  },
];

// The current style (a live binding) and its font stack.
export let T = THEMES[0];
export let FONT = SYS_FONT;
// Bumped whenever the look changes (style switch, an image or font finished loading), so
// cached layers (the board) know to rebuild.
export let artRev = 0;
let onChange = () => {};
export function onArtChange(fn) { onChange = fn; }

export const artUrl = f => ART + f;

export function findTheme(id) { return THEMES.find(t => t.id === id) || null; }

export function setTheme(id) {
  T = findTheme(id) || THEMES[0];
  applyPalette(T.palette);
  FONT = T.font ? `"${T.font.family}", ${SYS_FONT}` : SYS_FONT;
  artRev++;
  loadAssets(T);
  return T;
}

export function nextThemeId() {
  return THEMES[(THEMES.indexOf(T) + 1) % THEMES.length].id;
}

// Images and font load in the background; until they arrive the style draws its
// procedural fallback, so a slow or failed load never blocks play.
function loadAssets(th) {
  if (th.img) return;
  th.img = {};
  const bump = () => { if (T === th) { artRev++; onChange(); } };
  if (th.kit && !th.images) th.images = th.kit.images;
  if (th.images && typeof Image !== 'undefined') {
    for (const [k, f] of Object.entries(th.images)) {
      const im = new Image();
      im.onload = () => { th.img[k] = im; bump(); };
      im.src = artUrl(f);
    }
  }
  if (th.font && typeof FontFace !== 'undefined' && typeof document !== 'undefined' && document.fonts) {
    try {
      const ff = new FontFace(th.font.family, `url(${artUrl(th.font.file)})`, { weight: th.font.weight || 'normal' });
      ff.load().then(f => { document.fonts.add(f); bump(); }).catch(() => {});
    } catch { /* old browser: system font */ }
  }
}

// Picks a loaded image by key, or null.
export function img(k) { return (T.img && T.img[k]) || null; }
