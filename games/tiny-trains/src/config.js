// Tuning numbers and palette (GDD 3.1, 3.2, 9).
export const VIEW_W = 1280, VIEW_H = 720;
export const HUD_H = 80;
// Board area: below the HUD, above the Go button row.
export const BOARD_AREA = { x: 40, y: 92, w: 1200, h: 536 };
export const CELL_MIN = 72, CELL_MAX = 112;

export const TICK_S = 0.45;          // 1× tick; 2× fast-forward halves it
export const CRASH_HOLD_S = 1.2;     // crash shown before rewind (tap to skip)
export const REWIND_S = 0.4;
export const WIN_HOLD_S = 0.9;       // after the last arrival, before the results panel

export const SAVE_KEY = 'cm_tiny-trains_save';

export const INK = '#2E2440';
export const CREAM = '#FFF3DC';
export const WOOD = '#C98B4F';
export const TRAIN_COLORS = { red: '#E8483B', blue: '#3B7DD8', yellow: '#F5C327', green: '#4DB35E' };
export const TRAIN_SHAPES = { red: 'circle', blue: 'square', yellow: 'triangle', green: 'diamond' };
export const GREEN = TRAIN_COLORS.green;

// Tints and shades of the palette only.
export function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}
export const WOOD_LIGHT = mix(WOOD, '#FFFFFF', 0.35);
export const WOOD_DARK = mix(WOOD, INK, 0.25);
export const GRASS = mix(GREEN, CREAM, 0.55);
export const GRASS_DARK = mix(GREEN, CREAM, 0.3);
export const PANEL = mix(CREAM, INK, 0.06);

export const CRASH_TEXT = {
  collision: 'Crash!',
  swap: 'Head-on crash!',
  derail: 'Off the rails!',
  wrong_station: 'Wrong station!',
  lost: 'Lost in a loop!',
};
