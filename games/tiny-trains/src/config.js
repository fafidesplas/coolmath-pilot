// Tuning numbers and palette (GDD 3.1, 3.2, 9).
export const VIEW_W = 1280, VIEW_H = 720;
export const HUD_H = 80;
// Board area: below the HUD, above the Go button row.
export const BOARD_AREA = { x: 40, y: 92, w: 1200, h: 536 };
export const CELL_MIN = 72, CELL_MAX = 112;

export const TICK_S = 0.45;          // 1× tick; 2× fast-forward halves it
export const LOOP_TICK_S = 0.09;     // once the board repeats (the run can only end lost), play the rest 5× fast
export const HINT_FAILS = 2;         // failed runs before the hint button shows (GDD 3.13)
export const CRASH_HOLD_S = 1.2;     // crash shown before rewind (tap to skip)
export const REWIND_S = 0.4;
export const WIN_HOLD_S = 0.9;       // after the last arrival, before the results panel

export const SAVE_KEY = 'cm_tiny-trains_save';

// Palette. These are live bindings (`let`): applyPalette() swaps them when the art style
// changes (src/theme.js), and every module that imports them sees the new values.
export let INK = '#2E2440';
export let CREAM = '#FFF3DC';
export let WOOD = '#C98B4F';
export const TRAIN_COLORS = { red: '#E8483B', blue: '#3B7DD8', yellow: '#F5C327', green: '#4DB35E' };
export const TRAIN_SHAPES = { red: 'circle', blue: 'square', yellow: 'triangle', green: 'diamond' };
export let GREEN = TRAIN_COLORS.green;

// Tints and shades of the palette only.
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
export let WOOD_LIGHT, WOOD_DARK, GRASS, GRASS_DARK, PANEL, GOLD;

// p: { ink, cream, wood, red, blue, yellow, green, grass? } (hex colors)
export function applyPalette(p) {
  INK = p.ink; CREAM = p.cream; WOOD = p.wood;
  TRAIN_COLORS.red = p.red; TRAIN_COLORS.blue = p.blue; TRAIN_COLORS.yellow = p.yellow; TRAIN_COLORS.green = p.green;
  GREEN = p.green;
  WOOD_LIGHT = mix(WOOD, '#FFFFFF', 0.35);
  WOOD_DARK = mix(WOOD, INK, 0.25);
  GRASS = p.grass || mix(GREEN, CREAM, 0.55);
  GRASS_DARK = p.grassDark || mix(GREEN, CREAM, 0.3);
  PANEL = p.panel || mix(CREAM, INK, 0.06);
  GOLD = mix(TRAIN_COLORS.yellow, WOOD, 0.3);   // golden ticket: yellow pushed towards wood
}
export const CLASSIC_PALETTE = { ink: INK, cream: CREAM, wood: WOOD, ...TRAIN_COLORS };
applyPalette(CLASSIC_PALETTE);

export const CRASH_TEXT = {
  collision: 'Crash!',
  swap: 'Head-on crash!',
  derail: 'Off the rails!',
  wrong_station: 'Wrong station!',
  lost: 'Lost in a loop!',
};
