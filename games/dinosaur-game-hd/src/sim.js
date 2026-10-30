// One run's simulation: runner physics, obstacles, collisions, score, night.
// No drawing. One step() is one frame of the original at 60 Hz (GDD 3.2–3.6),
// so its rules apply unchanged, including whole-pixel rounding.
import { HZ, STEP_MS, VIEW_W, LANE, RUN, RUNNER, RUNNER_BOXES, PTERO_HEIGHTS } from './config.js';
import { ObstacleGen, stream, STREAM } from './gen.js';

const overlap = (ax, ay, aw, ah, bx, by, bw, bh) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

// Pixels moved this frame at `speed`, as the original computes it.
const scroll = speed => Math.floor((speed * HZ / 1000) * STEP_MS);

export class Run {
  // opts.invincible: no crashes (debug and tests only).
  constructor(seed, opts = {}) {
    this.seed = seed >>> 0;
    this.invincible = !!opts.invincible;
    this.gen = new ObstacleGen(stream(this.seed, STREAM.obstacles));
    this.frame = 0;
    this.timeMs = 0;
    this.speed = RUN.speed;
    this.distancePx = 0;
    this.scrollPx = 0;          // ground scroll, whole px
    this.obstacles = [];
    this.crashed = false;
    this.hit = null;            // obstacle that ended the run
    this.night = false;
    this.nightMs = 0;
    this.nights = 0;
    this.lastMilestone = 0;
    this.events = [];           // jump, land, duck, milestone, night, day, crash; the caller empties it after reading

    // Runner, in the original's terms: y is the sprite top, y down, vy < 0 is up.
    this.groundY = LANE.ground - RUNNER.height;
    this.y = this.groundY;
    this.vy = 0;
    this.jumping = false;
    this.ducking = false;
    this.speedDrop = false;
    this.reachedMinHeight = false;
    this.jumpRepeat = false;    // a jump key is held: jump again on landing
    this.duckHeld = false;
  }

  get score() {
    return this.distancePx ? Math.round(Math.ceil(this.distancePx) * RUN.distanceCoefficient) : 0;
  }
  get height() { return this.groundY - this.y; }   // px above the ground
  get deathId() {
    if (!this.hit) return null;
    return this.hit.id === 'ptero' ? `ptero-${PTERO_HEIGHTS[this.hit.y]}` : this.hit.id;
  }

  // Input, applied between steps like the original's key handlers.
  // `repeat`: the source auto-repeats while held (keyboard), so a held jump re-jumps on landing.
  press(action, repeat = false) {
    if (this.crashed) return;
    if (action === 'jump') {
      this.jumpRepeat = repeat;
      if (!this.jumping && !this.ducking) this.startJump();
    } else if (action === 'duck') {
      this.duckHeld = true;
      if (this.jumping) {
        this.speedDrop = true;
        this.vy = 1;
      } else if (!this.ducking) {
        this.ducking = true;
        this.events.push('duck');
      }
    }
  }

  release(action) {
    if (action === 'jump') {
      this.jumpRepeat = false;
      if (!this.crashed) this.endJump();
    } else if (action === 'duck') {
      this.duckHeld = false;
      this.speedDrop = false;
      this.ducking = false;
    }
  }

  startJump() {
    this.vy = -(RUNNER.initialJumpVelocity + this.speed / 10);
    this.jumping = true;
    this.reachedMinHeight = false;
    this.speedDrop = false;
    this.events.push('jump');
  }

  endJump() {
    if (this.reachedMinHeight && this.vy < -RUNNER.dropVelocity) this.vy = -RUNNER.dropVelocity;
  }

  step() {
    if (this.crashed) return;
    this.frame++;
    if (this.jumpRepeat && !this.jumping && !this.ducking) this.startJump();
    if (this.jumping) this.updateJump();

    this.timeMs += STEP_MS;
    const hasObstacles = this.timeMs > RUN.clearTimeMs;
    this.scrollPx += scroll(this.speed);
    if (hasObstacles) this.updateObstacles();

    const first = this.obstacles[0];
    if (hasObstacles && first && !this.invincible && this.collides(first)) {
      this.crashed = true;
      this.hit = first;
      this.events.push('crash');
      return;
    }
    this.distancePx += this.speed;
    if (this.speed < RUN.maxSpeed) this.speed += RUN.acceleration;

    const m = this.score;
    if (m > 0 && m % RUN.milestone === 0 && m !== this.lastMilestone) {
      this.lastMilestone = m;
      this.events.push('milestone');
    }
    this.updateNight(m);

    // A fast-fall that lands exactly on the ground turns into a duck for a
    // frame before the jump ends, as in the original.
    if (this.speedDrop && this.y === this.groundY) {
      this.speedDrop = false;
      this.ducking = true;
    }
  }

  updateJump() {
    this.y += Math.round(this.speedDrop ? this.vy * RUNNER.speedDropCoefficient : this.vy);
    this.vy += RUNNER.gravity;
    if (this.y < this.groundY - RUNNER.minJumpHeight || this.speedDrop) this.reachedMinHeight = true;
    if (this.y < this.groundY - RUNNER.maxJumpHeight || this.speedDrop) this.endJump();
    if (this.y > this.groundY) {
      this.y = this.groundY;
      this.vy = 0;
      this.jumping = false;
      this.speedDrop = false;
      this.ducking = this.duckHeld;   // GDD 3.4: still holding down, so duck
      this.events.push('land');
    }
  }

  updateObstacles() {
    const obs = this.obstacles;
    for (const o of obs) {
      o.x -= scroll(this.speed + o.speedOffset);
      o.flapMs += STEP_MS;
    }
    while (obs.length && obs[0].x + obs[0].w <= 0) obs.shift();
    const last = obs[obs.length - 1];
    if (!last) obs.push(this.gen.next(this.speed, VIEW_W));
    else if (!last.followed && last.x + last.w + last.gap < VIEW_W) {
      obs.push(this.gen.next(this.speed, VIEW_W));
      last.followed = true;
    }
  }

  // Outer boxes first (1 px in from each side; the runner's stays standing-size
  // while ducking), then every box pair.
  collides(o) {
    const rx = RUNNER.x + 1, ry = this.y + 1;
    const ox = o.x + 1, oy = o.y + 1;
    if (!overlap(rx, ry, RUNNER.width - 2, RUNNER.height - 2, ox, oy, o.w - 2, o.h - 2)) return false;
    for (const a of this.ducking ? RUNNER_BOXES.duck : RUNNER_BOXES.run) {
      for (const b of o.boxes) {
        if (overlap(rx + a[0], ry + a[1], a[2], a[3], ox + b[0], oy + b[1], b[2], b[3])) return true;
      }
    }
    return false;
  }

  updateNight(m) {
    if (this.nightMs > RUN.nightMs) {
      this.nightMs = 0;
      this.night = false;
      this.events.push('day');
    } else if (this.nightMs) {
      this.nightMs += STEP_MS;
    } else if (m > 0 && m % RUN.nightDistance === 0) {
      this.nightMs = STEP_MS;
      this.night = true;
      this.nights++;
      this.events.push('night');
    }
  }
}
