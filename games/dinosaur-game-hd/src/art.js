// Shared sprite constants (GDD 9). All sprites are Aseprite sheets
// (art/aseprite, exported to assets/sprites by tools/export-sprites.sh) and
// load in sprites.js. Every art pixel is CELL×CELL logical px, and every
// frame has a 1 px Night Ink outline margin.

export const CELL = 2;   // logical px per art pixel

// Where each run frame's planted foot is, from the runner's x (footfall dust).
export const FOOTFALL_X = [23, 13, 23, 13];

// How far below the obstacle's y a cactus frame's first fill row is drawn, in px:
// the small cactus sits 1 px up so its base meets the ground.
export const CACTUS_OY = { 'cactus-small': -1, 'cactus-large': 0 };
