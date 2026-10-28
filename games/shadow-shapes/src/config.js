// Every tuning number from GDD.md lives here, in one place. No DOM, so the pure
// modules and the tools can import it in Node.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 72;
export const MAX_FRAME_DT = 0.05;

// Screen layout (GDD 3.1)
export const OBJ_ZONE = { x: 0, y: 72, w: 620, h: 648 };   // the WebGL canvas covers exactly this
export const OBJ_CENTER = { x: 320, y: 410 };
export const OBJ_RADIUS = 230;                               // bounding sphere on screen, px
export const RING_SCALE = 1.08;                              // rings sit just outside the sphere
export const WALL = { cx: 950, cy: 400, size: 600, r: 28 };  // rounded panel
export const TARGET_AREA = 440;                              // the target fits this square
export const MAX_CELL_PX = 56;
export const METER = { x: 716, y: 166, r: 40 };              // match % ring, wall's top-left corner

// Camera (GDD 3.1): orthographic, 20° to the left and 15° above the light axis.
export const CAM = { yaw: -20, pitch: 15, swing: 0.5 };

// Dragging (GDD 3.4)
export const DRAG = {
  lockPx: 8,          // CSS px before the drag locks to one axis
  degPerPx: 0.5,      // per CSS px along the locked direction
  wobbleDeg: 3,
  wobbleTime: 0.15,
};

// Keyboard (GDD 3.6)
export const KEYS = { step: 15, ease: 0.12, repeatDelay: 0.3, repeatEvery: 0.15 };

// Shadow and match (GDD 3.7)
export const MASK_N = 64;
export const SNAP = {
  hold: 0.15,         // match held this long snaps
  ease: 0.3,          // dials ease to the solution
  restart: 0.25,      // R eases back to the start pose
};
export const LEVEL_RULES = {
  window: 6,          // degrees: the threshold is the lowest IoU on this circle
  cap: 0.92,
  minMatch: 0.75,     // thinner pictures are rejected
  symHigh: 0.97,      // a real symmetry (extra solution)
  symLow: 0.75,       // clearly different
  solution: 0.97,
  nearMargin: 0.06,
  sweepStep: 3,
  startMinAngle: 45,
  startMaxPct: 35,
  maxBlocks: 60,
};

// Warmer or colder (GDD 3.8)
export const NOTES = { minGap: 0.08 };

// Reveal timeline in seconds after the snap (GDD 3.13)
export const REVEAL = { swingAt: 0.3, swing: 0.5, mosaic: 0.5, animAt: 0.8, anim: 0.6, results: 1.6, ignore: 0.3 };

export const COLORS = {
  night: '#121833',
  wall: '#232A52',
  ink: '#080B1C',
  gold: '#FFD25A',
  cyan: '#3EE6FF',
  moon: '#EAF0FF',
  pink: '#FF5FA2',
  lilac: '#B48CFF',
  mint: '#5FF0C0',
  peach: '#FFB46B',
  attic: '#1A1633',
};

// Picture colors a–f (GDD 6): pink, lilac, mint, peach, white, gold.
export const PICTURE_COLORS = ['#FF5FA2', '#B48CFF', '#5FF0C0', '#FFB46B', '#EAF0FF', '#FFD25A'];
export const RING_COLORS = { turn: '#5FF0C0', tip: '#FFB46B', spin: '#B48CFF' };

export const SAVE_KEY = 'cm_shadow-shapes_save';
export const SETTINGS_KEY = 'cm_shadow-shapes_settings';
