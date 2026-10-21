// Every tuning number from GDD.md lives here, in one place.

export const T = 40;            // tile size in px
export const COLS = 32;
export const ROWS = 16;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 80;        // playfield starts below the HUD bar

export const HZ = 120;          // fixed simulation rate
export const STEP = 1 / HZ;
export const MAX_FRAME_DT = 0.05;

export const ROBOT = {
  w: 30, h: 36,
  maxSpeed: 240,
  accel: 2400,
  decel: 3000,
  airControl: 0.7,
  jumpSpeed: 640,
  jumpCut: 0.5,
  coyoteSteps: Math.round(0.08 * HZ),
  bufferSteps: Math.round(0.10 * HZ),
  pushSpeed: 80,                // walking into a crate
};

export const GRAVITY = 2000;
export const MAX_FALL = 900;

export const MAGNET = {
  range: 160,
  full: 120,                    // full strength out to here, then linear fade
  halfAngle: 30 * Math.PI / 180,
  accel: 3000,
  maxSpeed: 480,
  hoverDamp: 0.08,              // share of vertical speed lost per step while lifted
  rideSpeed: 60,                // |vy| under this while lifted counts as standing
  aimGraceSteps: Math.round(0.15 * HZ),
  aimCancelRise: 12,
};

export const CRATE = { size: 40, decel: 2400 };

export const DOOR = {
  openTime: 0.3,
  closeTime: 0.6,
  pushOut: 240,                 // px/s, closing gate nudges bodies out of the doorway
};

export const SPIKE_H = 16;      // spikes fill the bottom 16 px of their tile
export const EXIT_STEPS = Math.round(0.3 * HZ);
export const RESET_STEPS = Math.round(0.4 * HZ);
export const LAND_EVENT_SPEED = 200;
export const CLANK_SPEED = 300;

// Controller bits (one byte per controller)
export const B = { L: 1, R: 2, U: 4, D: 8, P: 16, S: 32, AU: 64, AD: 128 };

export const COLORS = {
  plus: '#E8463A',
  minus: '#2F7FE0',
  ink: '#2B2238',
  bg: '#FFF1DC',
  metal: '#9AA5B1',
  bolt: '#FFC531',
};

export const SAVE_KEY = 'cm_magnet-twins_save';
export const SETTINGS_KEY = 'cm_magnet-twins_settings';
