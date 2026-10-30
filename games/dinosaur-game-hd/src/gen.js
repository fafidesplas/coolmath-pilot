// Seeded random streams and the obstacle generator (GDD 3.2, 3.5).
import { RUN, OBSTACLES, OBSTACLE_IDS } from './config.js';

export function mulberry32(a) {
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Separate streams per run seed, so egg logic can never change the obstacles.
export const STREAM = { obstacles: 1, eggs: 2, flight: 3 };
export function stream(seed, id) {
  const mix = mulberry32((seed ^ Math.imul(id, 0x9E3779B9)) | 0);
  return mulberry32((mix() * 4294967296) | 0);
}

// Inclusive integer in [min, max].
export const randInt = (rand, min, max) => Math.floor(rand() * (max - min + 1)) + min;

// An obstacle group of `size`, its sprite top at lane y. Groups widen the middle box.
export function makeObstacle(id, size = 1, y = null) {
  const t = OBSTACLES[id];
  const w = t.w * size;
  const boxes = t.boxes.map(b => b.slice());
  if (size > 1) {
    boxes[1][2] = w - boxes[0][2] - boxes[2][2];
    boxes[2][0] = w - boxes[2][2];
  }
  return {
    id, size, w, h: t.h, x: 0, y: y ?? (Array.isArray(t.y) ? t.y[0] : t.y), boxes,
    speedOffset: 0, gap: 0, minGap: 0, maxGap: 0, spawnSpeed: 0, followed: false, flapMs: 0,
  };
}

export class ObstacleGen {
  constructor(rand) {
    this.rand = rand;
    this.history = [];   // newest first, at most maxObstacleDuplication
    this.count = 0;
    this.pteros = 0;
  }

  // Would `id` be the 3rd of its type in a row?
  isRepeat(id) {
    return this.history.length >= RUN.maxObstacleDuplication && this.history.every(h => h === id);
  }

  // The next obstacle, just off the right edge of a view `viewW` wide.
  next(speed, viewW) {
    const r = this.rand;
    let id;
    if (this.count === 0) id = 'cactus-small';   // teaching order: a single small cactus first
    else {
      do id = OBSTACLE_IDS[randInt(r, 0, OBSTACLE_IDS.length - 1)];
      while (this.isRepeat(id) || speed < OBSTACLES[id].minSpeed);
    }
    const t = OBSTACLES[id];
    let size = randInt(r, 1, RUN.maxObstacleLength);
    if (this.count === 0 || (size > 1 && t.multipleSpeed > speed)) size = 1;
    let y = t.y;
    if (Array.isArray(t.y)) {
      y = this.pteros === 0 ? 75 : t.y[randInt(r, 0, t.y.length - 1)];  // first one flies mid
      this.pteros++;
    }
    const o = makeObstacle(id, size, y);
    o.x = viewW + t.w;
    if (t.speedOffset) o.speedOffset = r() > 0.5 ? t.speedOffset : -t.speedOffset;
    o.spawnSpeed = speed;
    o.minGap = Math.round(o.w * speed + t.minGap * RUN.gapCoefficient);
    o.maxGap = Math.round(o.minGap * RUN.maxGapCoefficient);
    o.gap = randInt(r, o.minGap, o.maxGap);
    this.history.unshift(id);
    this.history.length = Math.min(this.history.length, RUN.maxObstacleDuplication);
    this.count++;
    return o;
  }
}
