// Tuning numbers (GDD 3): the original game's values, in its units, logical px
// and frames at 60 Hz. The sim works in "lane" coordinates, the original's
// 150 px tall playfield (y down, feet rest on y = 140); the renderer places the
// lane on screen.

export const DEBUG = true;                 // debug keys and window.game.crash(); false in release builds

export const HZ = 60;
export const STEP_MS = 1000 / HZ;
export const MAX_FRAME_DT = 0.05;          // s, frame dt cap (STANDARDS)
export const VIEW_W = 640, VIEW_H = 360;   // logical resolution (GDD 3.1)

export const LANE = {
  ground: 140,      // y where feet and obstacle bottoms rest
  top1P: 110,       // 1P: lane y 140 lands on screen y 250 (GDD 3.1)
};

export const RUN = {
  speed: 6,                 // px/frame at the start
  acceleration: 0.001,      // px/frame added every frame
  maxSpeed: 13,
  clearTimeMs: 3000,        // no obstacles before this
  gapCoefficient: 0.6,
  maxGapCoefficient: 1.5,
  maxObstacleLength: 3,     // cacti per group
  maxObstacleDuplication: 2,
  distanceCoefficient: 0.025, // metres per px
  milestone: 100,           // m between score flashes
  nightDistance: 700,       // m between nights
  nightMs: 12000,
  restartLockMs: 1200,      // jump keys can't restart for this long after a crash
};

export const RUNNER = {
  x: 50,
  width: 44, height: 47,          // standing footprint
  widthDuck: 59, heightDuck: 25,  // ducking footprint
  gravity: 0.6,
  initialJumpVelocity: 10,        // + speed / 10, upwards
  dropVelocity: 5,                // upward speed a released jump is cut to
  minJumpHeight: 30,              // releases count only above this rise
  maxJumpHeight: 63,              // the jump is cut above this rise
  speedDropCoefficient: 3,        // fast-fall movement multiplier
};

// Collision boxes [x, y, w, h], relative to the sprite's top-left.
export const RUNNER_BOXES = {
  run: [[22, 0, 17, 16], [1, 18, 30, 9], [10, 35, 14, 8], [1, 24, 29, 5], [5, 30, 21, 4], [9, 34, 15, 4]],
  duck: [[1, 18, 55, 25]],
};

// y is the sprite's top in lane coordinates; the pterodactyl picks one of 3.
export const OBSTACLES = {
  'cactus-small': {
    w: 17, h: 35, y: 105, multipleSpeed: 4, minGap: 120, minSpeed: 0,
    boxes: [[0, 7, 5, 27], [4, 0, 6, 34], [10, 4, 7, 14]],
  },
  'cactus-large': {
    w: 25, h: 50, y: 90, multipleSpeed: 7, minGap: 120, minSpeed: 0,
    boxes: [[0, 12, 7, 38], [8, 0, 7, 49], [13, 10, 10, 38]],
  },
  'ptero': {
    w: 46, h: 40, y: [100, 75, 50], multipleSpeed: 999, minGap: 150, minSpeed: 8.5,
    speedOffset: 0.8, flapMs: 1000 / 6,
    boxes: [[15, 15, 16, 5], [18, 21, 24, 6], [2, 14, 4, 3], [6, 10, 4, 7], [10, 8, 6, 9]],
  },
};
export const OBSTACLE_IDS = Object.keys(OBSTACLES);
export const PTERO_HEIGHTS = { 100: 'low', 75: 'mid', 50: 'high' };

export const ANIM = {           // ms per frame (GDD 3.4)
  run: 1000 / 12,
  duck: 1000 / 8,
};
