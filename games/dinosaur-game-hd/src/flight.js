// The bonus flight (GDD 3.8): mount physics and egg shapes, nothing to dodge.
// No drawing. One step() is one frame at 60 Hz. Eggs live in world x (on
// screen at wx - scroll). `hazards` and `wild` stay empty: the flight is only
// about the eggs (the renderer and the hit logic still read them).
import { VIEW_W, FLIGHT as F, EGGS } from './config.js';

const [BX, BY, BW, BH] = F.box;
const END_X = F.x + BX + BW + F.frames * F.scroll;   // world x the hitbox's front reaches at the end
const SPAN = F.floor - F.ceiling;

// Egg shapes (GDD 3.8), Joyride's coin shapes made of eggs: [dx, dy] from the shape's top-left.
const SHAPES = {
  line: () => Array.from({ length: 8 }, (_, i) => [i * 16, 0]),
  wave: () => Array.from({ length: 12 }, (_, i) => [i * 16, Math.round(30 + 30 * Math.sin(i / 11 * Math.PI * 2))]),
  block: () => Array.from({ length: 40 }, (_, i) => [(i % 8) * 14, Math.floor(i / 8) * 14]),
  stairs: () => Array.from({ length: 12 }, (_, i) => [i * 16, 60 - Math.floor(i / 3) * 20]),
  wall: () => Array.from({ length: 60 }, (_, i) => [(i % 10) * 14, Math.floor(i / 10) * 14]),
  arrow: () => [0, 1, 2, 3, 4].flatMap(i => i === 4 ? [[56, 56]] : [[i * 14, i * 14], [i * 14, 112 - i * 14]]),
};
const SHAPE_WEIGHTS = [['line', 2], ['wave', 3], ['stairs', 2], ['arrow', 2], ['block', 3], ['wall', 2]];

export class Flight {
  constructor(rand) {
    this.rand = rand;
    this.frame = 0;
    this.y = F.startY;          // the mount sprite's top
    this.prevY = this.y;
    this.vy = 0;
    this.holding = false;
    this.scroll = 0;
    this.prevScroll = 0;
    this.hazards = [];
    this.eggs = [];
    this.wild = [];             // { x, y, prevX, warnAt, lockAt, arriveAt }
    this.eggCount = 0;
    this.pickups = [];          // eggs picked up; the caller empties it
    this.events = [];           // flap, egg, warn, hit, complete; the caller empties it
    this.hit = false;
    this.done = false;          // 30 s flown, or the outro after a hit is over
    this.result = null;         // 'hit' | 'complete'
    this.hitFrame = 0;
    this.rider = null;          // after a hit: { x, y, vy, spin }
    this.mountX = F.x;          // the mount flies off to the right after a hit
    this.mountPrevX = F.x;
    this.outroN = 0;
    this.generate();
  }

  // ---- generation ---------------------------------------------------------------------------
  // Egg shapes one after the other for the whole flight, each at a random
  // height with a short gap after it: no thundercloud, no wild pterodactyl.
  generate() {
    const r = this.rand;
    let x = VIEW_W - 120;
    while (x < END_X - 120) {
      let pick = r() * SHAPE_WEIGHTS.reduce((t, [, w]) => t + w, 0), name = 'line';
      for (const [n, w] of SHAPE_WEIGHTS) { if ((pick -= w) < 0) { name = n; break; } }
      const pts = SHAPES[name](), h = Math.max(...pts.map(p => p[1])) + EGGS.h;
      const y = F.ceiling + 6 + r() * (SPAN - h - 12);
      x = this.shape(x, y, name) + F.eggGap * (0.6 + 0.8 * r());
    }
  }

  // Places shape `name` at (x, y); returns its right end.
  shape(x, y, name) {
    let right = x;
    for (const [dx, dy] of SHAPES[name]()) {
      const e = { x: Math.round(x + dx), y: Math.round(y + dy), taken: false, shape: name };
      this.eggs.push(e);
      right = Math.max(right, e.x + EGGS.w);
    }
    return right;
  }

  // ---- play ---------------------------------------------------------------------------------
  press() {
    if (!this.holding && !this.hit && !this.done) this.events.push('flap');
    this.holding = true;
  }
  release() { this.holding = false; }

  get timeLeft() { return Math.max(0, F.frames - this.frame) / 60; }

  step() {
    this.prevY = this.y;
    this.prevScroll = this.scroll;
    this.mountPrevX = this.mountX;
    this.scroll += F.scroll;
    if (this.hit) return this.outro();
    this.frame++;

    // Hold to flap up, release to glide down; skim the ceiling and the floor.
    this.vy = Math.max(-F.maxVy, Math.min(F.maxVy, this.vy + F.gravity - (this.holding ? F.flap : 0)));
    this.y += this.vy;
    const top = F.ceiling - BY, bottom = F.floor - BY - BH;
    if (this.y < top) { this.y = top; this.vy = 0; }
    if (this.y > bottom) { this.y = bottom; this.vy = 0; }

    this.collect();
    if (this.frame >= F.frames && !this.done) {
      this.done = true;
      this.result = 'complete';
      this.events.push('complete');
    }
  }

  // After a hit: the rider tumbles off and the mount flaps away; then it's over.
  outro() {
    const r = this.rider;
    r.vy += 0.5; r.y += r.vy; r.x -= 1; r.spin++;
    this.vy = Math.max(-5, this.vy - 0.4);
    this.y += this.vy;
    this.mountX += 3;
    if (++this.outroN >= F.outroFrames) this.done = true;
  }

  collect() {
    const P = EGGS.pickup, x0 = F.x + BX + this.scroll, y0 = this.y + BY;
    for (const e of this.eggs) {
      if (e.taken || e.x > x0 + BW + P) continue;
      const ex = e.x + (EGGS.w - P) / 2, ey = e.y + (EGGS.h - P) / 2;
      if (ex < x0 + BW && ex + P > x0 && ey < y0 + BH && ey + P > y0) {
        e.taken = true;
        this.eggCount++;
        this.pickups.push(e);
        this.events.push('egg');
      }
    }
  }
}
