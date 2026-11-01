// The bonus flight (GDD 3.8): mount physics, thunderclouds, wild
// pterodactyls and egg shapes. No drawing. One step() is one frame at 60 Hz.
// Hazards and eggs live in world x (on screen at wx - scroll); wild
// pterodactyls live in screen x, since they fly on their own.
import { VIEW_W, FLIGHT as F, EGGS } from './config.js';
import { randInt } from './gen.js';

const [BX, BY, BW, BH] = F.box;
const END_X = F.x + BX + BW + F.frames * F.scroll;   // world x the hitbox's front reaches at the end
const SPAN = F.floor - F.ceiling;

// Distance from (px, py) to the rectangle (x0, y0)–(x1, y1).
const rectDist = (px, py, x0, y0, x1, y1) => Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(y0 - py, 0, py - y1));

// Frames to move `d` px up or down from a standstill at full flap or glide.
export function framesToMove(d) {
  let y = 0, v = 0, f = 0;
  while (y < d) { v = Math.min(F.maxVy, v + F.gravity); y += v; f++; }
  return f;
}

// A thundercloud: a lightning bar from (ax, ay) to (bx, by) with a cloud at each end.
function cloud(ax, ay, bx, by) {
  const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(len / 4)), pts = [];
  for (let i = 0; i <= n; i++) pts.push([ax + (bx - ax) * i / n, ay + (by - ay) * i / n]);
  const R = F.nodeR;
  return {
    ax, ay, bx, by, pts,
    x0: Math.min(ax, bx) - R, x1: Math.max(ax, bx) + R,     // world extent
    y0: Math.min(ay, by) - R, y1: Math.max(ay, by) + R,
  };
}

// The vertical bands a hitbox can fly through past a hazard, as ranges of its top.
function bands(h) {
  const out = [];
  if (h.y0 - F.ceiling >= BH + 8) out.push([F.ceiling, h.y0 - BH - 4]);
  if (F.floor - h.y1 >= BH + 8) out.push([h.y1 + 4, F.floor - BH]);
  return out;
}

// Egg shapes (GDD 3.8), Joyride's coin shapes made of eggs: [dx, dy] from the shape's top-left.
const SHAPES = {
  line: () => Array.from({ length: 8 }, (_, i) => [i * 16, 0]),
  wave: () => Array.from({ length: 12 }, (_, i) => [i * 16, Math.round(30 + 30 * Math.sin(i / 11 * Math.PI * 2))]),
  block: () => Array.from({ length: 40 }, (_, i) => [(i % 8) * 14, Math.floor(i / 8) * 14]),
  stairs: () => Array.from({ length: 12 }, (_, i) => [i * 16, 60 - Math.floor(i / 3) * 20]),
  arrow: () => [0, 1, 2, 3, 4].flatMap(i => i === 4 ? [[56, 56]] : [[i * 14, i * 14], [i * 14, 112 - i * 14]]),
};
const SHAPE_WEIGHTS = [['line', 3], ['wave', 3], ['stairs', 2], ['arrow', 2], ['block', 1]];

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
    this.done = false;          // 20 s flown, or the outro after a hit is over
    this.result = null;         // 'hit' | 'complete'
    this.hitFrame = 0;
    this.rider = null;          // after a hit: { x, y, vy, spin }
    this.mountX = F.x;          // the mount flies off to the right after a hit
    this.mountPrevX = F.x;
    this.outroN = 0;
    this.generate();
  }

  // ---- generation ---------------------------------------------------------------------------
  generate() {
    const r = this.rand;
    // The first 3 s: eggs only.
    const clearX = F.x + F.clearFrames * F.scroll;
    let x = VIEW_W - 120;
    while (x < clearX - 100) x = this.shape(x, 70 + r() * 120, ['line', 'wave'][randInt(r, 0, 1)]) + 120;

    // Then hazards, closer and closer, each far enough from the last to reach a
    // band past it at full flap or glide (GDD 3.8), with an egg shape between some.
    let prev = null, hx = Math.max(x, clearX);
    while (hx < END_X) {
      const t = (hx - clearX) / (END_X - clearX);
      const h = this.makeHazard(hx);
      if (prev) {
        const gap = this.needGap(prev, h);
        if (h.x0 - prev.x1 < gap) { this.shiftHazard(h, prev.x1 + gap - h.x0); }
        if (h.x0 > END_X) break;
        const room = h.x0 - prev.x1;
        if (room > 200 && r() < F.eggChance) this.eggsBetween(prev, h);
      }
      this.hazards.push(h);
      prev = h;
      hx = h.x1 + (F.spacing[0] + (F.spacing[1] - F.spacing[0]) * t) * (0.8 + 0.4 * r()) - (h.x1 - h.x0);
    }

    // Wild pterodactyls, arriving where no thundercloud is near, so there is
    // always room to dodge one.
    let at = F.wildFrom + randInt(r, 0, 60);
    while (at < F.frames - 30) {
      const wx0 = F.x + (at - 20) * F.scroll - 40, wx1 = F.x + BX + BW + (at + 8) * F.scroll + 40;
      if (this.hazards.every(h => h.x1 < wx0 || h.x0 > wx1)) {
        const warnAt = at - F.warnFrames;
        this.wild.push({ warnAt, lockAt: warnAt + F.lockFrames, arriveAt: at, x: 0, prevX: 0, y: 0, on: false });
        at += randInt(r, F.wildEvery[0], F.wildEvery[1]);
      } else at += 10;
    }
  }

  makeHazard(x) {
    const r = this.rand, kind = randInt(r, 0, 2), R = F.nodeR, max = SPAN * F.maxBlock - 2 * R;
    if (kind === 0) {   // vertical, sometimes from the ceiling or down to the floor
      const len = Math.min(max, 60 + r() * 70), edge = r();
      const top = edge < 0.25 ? F.ceiling : edge < 0.5 ? F.floor - len : F.ceiling + R + r() * (SPAN - len - 2 * R);
      return cloud(x + R, top, x + R, top + len);
    }
    if (kind === 1) {   // horizontal
      const len = 100 + r() * 60, y = F.ceiling + 20 + r() * (SPAN - 40);
      return cloud(x + R, y, x + R + len, y);
    }
    const d = (100 + r() * 40) / Math.SQRT2, y = F.ceiling + R + r() * (SPAN - d - 2 * R), up = r() < 0.5;   // diagonal
    return cloud(x + R, up ? y + d : y, x + R + d, up ? y : y + d);
  }

  shiftHazard(h, dx) {
    h.ax += dx; h.bx += dx; h.x0 += dx; h.x1 += dx;
    for (const p of h.pts) p[0] += dx;
  }

  // The space needed between two hazards: enough to fly from a band past the
  // first to the nearest band past the second.
  needGap(a, b) {
    let best = Infinity;
    for (const [a0, a1] of bands(a)) for (const [b0, b1] of bands(b)) {
      best = Math.min(best, Math.max(0, b0 - a1, a0 - b1));
    }
    return BW + 40 + framesToMove(best === Infinity ? SPAN : best) * F.scroll * 1.5;
  }

  // An egg shape centered between two hazards; eggs too close to either are dropped.
  eggsBetween(a, b) {
    const r = this.rand;
    let total = SHAPE_WEIGHTS.reduce((s, [, w]) => s + w, 0), pick = r() * total, name = 'line';
    for (const [n, w] of SHAPE_WEIGHTS) { if ((pick -= w) < 0) { name = n; break; } }
    const pts = SHAPES[name](), w = Math.max(...pts.map(p => p[0])) + EGGS.w, h = Math.max(...pts.map(p => p[1])) + EGGS.h;
    if (w > b.x0 - a.x1 - 60) return;
    const x = Math.round((a.x1 + b.x0 - w) / 2), y = F.ceiling + 6 + r() * (SPAN - h - 12);
    this.shape(x, y, name, [a, b]);
  }

  // Places shape `name` at (x, y); returns its right end.
  shape(x, y, name, near = []) {
    let right = x;
    for (const [dx, dy] of SHAPES[name]()) {
      const e = { x: Math.round(x + dx), y: Math.round(y + dy), taken: false, shape: name };
      if (near.some(hz => this.touches(hz, e.x - 6, e.y - 6, e.x + EGGS.w + 6, e.y + EGGS.h + 6))) continue;
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

  // Does hazard `h` touch the rectangle (world x)?
  touches(h, x0, y0, x1, y1) {
    if (h.x1 < x0 - F.boltR || h.x0 > x1 + F.boltR) return false;
    if (rectDist(h.ax, h.ay, x0, y0, x1, y1) <= F.nodeR || rectDist(h.bx, h.by, x0, y0, x1, y1) <= F.nodeR) return true;
    return h.pts.some(([px, py]) => rectDist(px, py, x0, y0, x1, y1) <= F.boltR);
  }

  // Would a hitbox with its mount at `y` touch a thundercloud, with the world scrolled by `scroll`?
  blocked(y, scroll) {
    const x0 = F.x + BX + scroll, y0 = y + BY;
    for (const h of this.hazards) {
      if (h.x0 > x0 + BW + 20) break;
      if (this.touches(h, x0, y0, x0 + BW, y0 + BH)) return true;
    }
    return false;
  }

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

    // Wild pterodactyls: a warning that follows your height, then locks, then the pterodactyl.
    for (const w of this.wild) {
      w.prevX = w.x;
      if (this.frame === w.warnAt) { w.on = true; this.events.push('warn'); }
      if (!w.on) continue;
      if (this.frame <= w.lockAt) w.y = Math.round(this.y + BY + BH / 2 - 24);
      w.x = F.x + BX + BW - (this.frame - w.arriveAt) * F.wildSpeed;
      if (this.frame < w.warnAt + 1) w.prevX = w.x;
    }

    if (!this.done && this.collides()) {
      this.hit = true;
      this.result = 'hit';
      this.hitFrame = this.frame;
      this.rider = { x: F.x, y: this.y - 22, vy: -4, spin: 0 };
      this.events.push('hit');
      return;
    }
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

  collides() {
    const x0 = F.x + BX, y0 = this.y + BY, x1 = x0 + BW, y1 = y0 + BH;
    if (this.blocked(this.y, this.scroll)) return true;
    const [wx, wy, ww, wh] = F.wildBox;
    return this.wild.some(w => w.on && w.x + wx < x1 && w.x + wx + ww > x0 && w.y + wy < y1 && w.y + wy + wh > y0);
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
