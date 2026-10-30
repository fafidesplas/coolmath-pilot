// Seeded random streams and the obstacle generator (GDD 3.2, 3.5).
import { RUN, OBSTACLES, OBSTACLE_IDS, LANE, RUNNER, EGGS, EGG_PATTERNS } from './config.js';

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

// ---- Eggs (GDD 3.7) ---------------------------------------------------------------------
// After each obstacle spawns, the egg stream may put a pattern over it or in
// the gap after it. Patterns only use gaps the obstacle generator already
// made, and the obstacles never read the egg stream.

const RUNNER_TOP = LANE.ground - RUNNER.height;   // runner's top on the ground

// An egg centered on (cx, y top), moving with the scroll (+ speedOffset).
function egg(cx, y, pattern, group, speedOffset = 0) {
  const x = Math.round(cx - EGGS.w / 2);
  return { x, y: Math.round(y), prevX: x, pattern, group, speedOffset, taken: false, fade: false };
}

export class EggGen {
  // curve(speed): the runner's height after each frame of a held jump (sim.js).
  constructor(rand, curve) {
    this.rand = rand;
    this.curve = curve;
    this.slot = 0;
    this.lastSlot = -2;
    this.lastNest = -Infinity;
    this.groups = 0;
  }

  // Eggs for obstacle `o`, which has just spawned, `m` metres into the run.
  place(o, speed, m) {
    const slot = this.slot++;
    if (slot === this.lastSlot + 1 || this.rand() >= EGGS.chance) return [];
    const h = this.curve(speed);
    const v = Math.floor(speed + o.speedOffset);  // how fast the obstacle (and its eggs) come
    const jump = h.length * Math.floor(speed);    // ground a held jump covers
    const ptero = o.id === 'ptero';
    // Each pterodactyl height gets the eggs that reward its answer (GDD 3.7):
    // low: jump over; mid: duck under or jump over; high: stay on the ground.
    const fits = {
      'jump-arc': o.id === 'cactus-small',
      'grid': !ptero && o.gap >= 2 * jump,
      'big-arc': o.id === 'cactus-large',
      'ptero-arc': ptero && o.y !== 50,
      'duck-line': ptero && o.y === 75,
      'head-line': ptero && o.y === 50,
      'nest': !ptero && o.gap >= 2 * jump + 40 && m - this.lastNest >= EGGS.nestEvery,
    };
    const options = Object.keys(EGG_PATTERNS).filter(p => m >= EGG_PATTERNS[p] && fits[p]);
    if (!options.length) return [];
    const p = options[randInt(this.rand, 0, options.length - 1)];
    this.lastSlot = slot;
    if (p === 'nest') this.lastNest = m;
    const group = this.groups++, out = [];
    const add = (cx, y) => out.push(egg(cx, y, p, group, o.speedOffset));
    const gapX = o.x + o.w + o.gap / 2;        // middle of the gap after o
    const apex = h.indexOf(Math.max(...h)) + 1;
    const onCurve = f => RUNNER_TOP - h[f - 1] + EGGS.bodyY;

    if (p === 'jump-arc' || p === 'big-arc' || p === 'ptero-arc') {
      // Along the held jump whose apex is right over the obstacle: at frame f
      // the runner's middle is (f - apex) * v px from the obstacle's middle.
      const step = Math.round(h.length / 7);
      for (let k = -2; k <= 2; k++) {
        const f = apex + k * step;
        add(o.x + o.w / 2 + (f - apex) * v, onCurve(f));
      }
    } else if (p === 'grid') {
      const cols = randInt(this.rand, 4, 6);
      const rows = [EGGS.groundY, RUNNER_TOP - 58 + EGGS.bodyY, RUNNER_TOP - 86 + EGGS.bodyY];
      for (const y of rows) for (let i = 0; i < cols; i++) add(gapX + (i - (cols - 1) / 2) * EGGS.spacing, y);
    } else if (p === 'duck-line') {
      for (let i = 0; i < 3; i++) add(o.x + 9 + i * 14, EGGS.groundY);
    } else if (p === 'head-line') {
      for (let i = 0; i < 3; i++) add(o.x + 9 + i * 14, EGGS.headY);
    } else if (p === 'nest') {
      // An egg-shaped bunch on the held jump's apex: 17 eggs in an ellipse.
      const cy = onCurve(apex);
      for (let y = -20; y <= 20; y += 10) {
        for (let x = -36; x <= 36; x += 12) {
          if ((x / 34) ** 2 + (y / 20) ** 2 <= 1) add(gapX + x, cy + y);
        }
      }
    }
    return out;
  }
}
