// Every tuning number from GDD.md lives here, in one place.

export const T = 40;              // tile size in px (GDD 3.1)
export const COLS = 32;
export const ROWS = 16;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 80;

export const HZ = 120;            // fixed simulation step (GDD 3.2)
export const STEP = 1 / HZ;
export const MAX_FRAME_DT = 0.05;

export const PLAYER = {           // GDD 3.3
  w: 24, h: 36,
  maxSpeed: 280,
  accel: 3000, decel: 4000,
  airAccel: 2400, airDecel: 1500,
  jumpSpeed: 720,
  gravityHold: 2400, gravity: 3000,
  maxFall: 900,
  jumpCut: 0.45,
  coyoteSteps: Math.round(0.08 * HZ),
  bufferSteps: Math.round(0.10 * HZ),
  nudge: 6,
};

export const ECHO = {             // GDD 3.5
  topPad: 4,                      // the standable top is 4 px wider than the hitbox on each side
  maxSteps: 10 * HZ,
  maxSlots: 4,
  breakOverlap: 2,
};

export const GATE = { openTime: 0.15, closeTime: 0.2 };   // GDD 3.8
export const PLATE_OVERLAP = 8;                           // GDD 3.7
export const EXIT_INNER = { w: 24, h: 60 };

// Input bits, one bitmask per step (GDD 6).
export const BIT = { LEFT: 1, RIGHT: 2, JUMP: 4, LOOP: 8, DEL: 16 };
export const MOVE_BITS = 1 | 2 | 4;

export const REWIND = { freeze: 0.08, time: 0.4, restart: 0.3 };
export const FFWD = 4;            // fast-forward speed (GDD 3.4)
export const TIME_PAR_FACTOR = 1.25;

export const COLORS = {           // GDD 9
  navy: '#121833',
  pale: '#EAF0FF',
  cyan: '#3EE6FF',
  violet: '#B48CFF',
  yellow: '#FFD25A',
  pink: '#FF5FA2',
};
export const ECHO_ALPHA = [0.85, 0.75, 0.65, 0.55];
export const CHANNELS = ['A', 'B', 'C', 'D'];
export const GLYPHS = ['▲', '●', '■', '◆'];

export const WORLD_NAMES = ['Lab', 'Archive', 'Core'];
export const ROOMS_PER_WORLD = 12;

export const SAVE_KEY = 'cm_echo-steps_save';
export const SETTINGS_KEY = 'cm_echo-steps_settings';
