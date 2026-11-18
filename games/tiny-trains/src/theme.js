// Art styles (presentation): switch with ?art=<id>, the Art pill on the title, level
// select and pause screens, or the A key. Each style sets the palette, the font, the
// track look, the board scenery (image tiles from CC0 packs), the UI corner radius and
// the sound set. Credits: assets/CREDITS.md. The list order matches art-options.json.
import { applyPalette, CLASSIC_PALETTE } from './config.js';

const ART = new URL('../assets/art/', import.meta.url).href;
const SYS_FONT = '"Trebuchet MS", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

export const THEMES = [
  {
    id: 'classic', name: 'Classic Toybox',
    palette: CLASSIC_PALETTE,
    track: 'wood', pixel: 0, radius: 1, outline: 1,
  },
  {
    id: 'pixel', name: 'Pixel Town',
    palette: {
      ink: '#2B1E2F', cream: '#E9F2D0', wood: '#B7764A',
      red: '#E0473C', blue: '#3A6FD0', yellow: '#F2C230', green: '#5CB34A',
      grass: '#8BC34A', grassDark: '#6FA83A', panel: '#D7E5B4',
    },
    font: { family: 'Pixelify Sans', file: 'pixel/PixelifySans.ttf', weight: '400 700' },
    track: 'rail', pixel: 3, radius: 0.3, outline: 1, symbol: 1.3,
    images: {
      grass0: 'pixel/tiles/tile_0000.png', grass1: 'pixel/tiles/tile_0001.png', grass2: 'pixel/tiles/tile_0002.png',
      bush: 'pixel/tiles/tile_0005.png', treeA: 'pixel/tiles/tile_0016.png', treeB: 'pixel/tiles/tile_0015.png',
      treeC: 'pixel/tiles/tile_0028.png', treeD: 'pixel/tiles/tile_0027.png',
      shroom: 'pixel/tiles/tile_0029.png',
    },
    grassTiles: ['grass0', 'grass0', 'grass1', 'grass2'],
    scenery: ['treeA', 'treeA', 'treeB', 'treeC', 'treeD', 'bush', 'bush', 'shroom'],
    sfx: {
      click: 'pixel/sfx/pepSound1.mp3', pop: 'pixel/sfx/pepSound3.mp3', whistle: 'pixel/sfx/powerUp2.mp3',
      ding: 'pixel/sfx/twoTone1.mp3', crash: 'pixel/sfx/lowDown.mp3', rewind: 'pixel/sfx/phaserDown1.mp3',
      star: 'pixel/sfx/highUp.mp3', win: 'pixel/sfx/threeTone1.mp3',
    },
  },
  {
    id: 'meadow', name: 'Storybook Meadow',
    palette: {
      ink: '#3B2A1E', cream: '#F6EED8', wood: '#9A6A3E',
      red: '#D9533F', blue: '#3C7FB8', yellow: '#F0B537', green: '#5FA35A',
      grass: '#7DBE5E', grassDark: '#5FA349', panel: '#EADFC2',
    },
    font: { family: 'Fredoka', file: 'meadow/Fredoka.ttf', weight: '300 700' },
    track: 'rail', pixel: 0, radius: 1.4, outline: 0.75, loco: true,
    images: {
      grass0: 'meadow/sprites/medievalTile_57.png', grass1: 'meadow/sprites/medievalTile_58.png',
      cypress: 'meadow/sprites/medievalEnvironment_01.png', pineS: 'meadow/sprites/medievalEnvironment_02.png',
      pine: 'meadow/sprites/medievalEnvironment_03.png', rock: 'meadow/sprites/medievalEnvironment_07.png',
      bush: 'meadow/sprites/medievalEnvironment_12.png', berry: 'meadow/sprites/medievalEnvironment_19.png',
      cypress2: 'meadow/sprites/medievalEnvironment_21.png',
    },
    grassTiles: ['grass0', 'grass1'],
    scenery: ['pine', 'pine', 'cypress', 'pineS', 'cypress2', 'bush', 'berry', 'rock'],
    sfx: {
      click: 'meadow/sfx/switch_002.mp3', pop: 'meadow/sfx/click_002.mp3', whistle: 'meadow/sfx/confirmation_001.mp3',
      ding: 'meadow/sfx/glass_001.mp3', crash: ['meadow/sfx/impactWood_heavy_000.mp3', 'meadow/sfx/impactPlank_medium_000.mp3'],
      rewind: 'meadow/sfx/minimize_006.mp3', star: 'meadow/sfx/confirmation_002.mp3', win: 'meadow/sfx/confirmation_004.mp3',
    },
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
