// The deterministic world (GDD 3.2–3.7): balls, contacts against walls, cups and
// the ink line, capture, and the fail-fast rules. No DOM. Only + − × ÷ and sqrt,
// so the same line gives the same run on every machine.
import { BALL, CONTACT, PEN, FAIL, CUP, HZ, FIELD_W, FIELD_H } from './config.js';
import { makeSeg } from './level.js';

const DT = 1 / HZ;
const HIST = Math.ceil(FAIL.loopMaxSteps / FAIL.sampleEvery) + 1;

// The solid line: a chain of capsules. Only its two ends can act as lips.
export function strokeSegs(pts) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    out.push(makeSeg(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], PEN.inkR, 'ink', i === 1, i === pts.length - 1));
  }
  return out;
}

function newBall(b, i) {
  return {
    i, x: b.x, y: b.y, vx: b.vx, vy: b.vy, px: b.x, py: b.y,
    state: 'live',                 // 'live' | 'in' | 'out'
    touch: false, touchKind: null, cup: -1, label: '',
    touchedCup: false, touchedBoard: false,
    ax: b.x, ay: b.y, aStep: 0,    // stuck box anchor
    lastDir: 0, turns: 0,
    hist: new Float64Array(HIST * 5), histN: 0,
    mouth: 1e9,                    // closest pass to a cup's mouth
    lipCool: 0,
  };
}

export class Sim {
  // opts (tests only): { gravity, roll } override the GDD numbers.
  constructor(lv, pts = null, opts = {}) {
    this.lv = lv;
    this.pts = pts;
    this.segs = pts && pts.length > 1 ? lv.segs.concat(strokeSegs(pts)) : lv.segs;
    this.g = opts.gravity ?? BALL.gravity * lv.gravity;
    this.roll = opts.roll ?? BALL.roll;
    this.balls = lv.balls.map(newBall);
    this.steps = 0;
    this.done = null;              // 'win' | 'fail'
    this.cause = null;             // 'lost' | 'stuck' | 'loop' | 'timeout'
    this.failBall = -1;
    this.events = [];
  }

  get time() { return this.steps * DT; }

  step() {
    if (this.done) return;
    for (const b of this.balls) if (b.state === 'live') this.moveBall(b);
    this.steps++;
    for (const b of this.balls) {
      if (b.state !== 'live') continue;
      this.checkCapture(b);
      if (b.state === 'live') this.checkFail(b);
      if (this.done) return;
    }
    if (this.balls.every(b => b.state === 'in')) { this.done = 'win'; this.events.push({ type: 'win' }); }
  }

  run(maxSteps = FAIL.timeoutSteps + 10) {
    while (!this.done && this.steps < maxSteps) this.step();
    return this;
  }

  moveBall(b) {
    b.px = b.x; b.py = b.y;
    const vx0 = b.vx, vy0 = b.vy, sp0 = Math.sqrt(vx0 * vx0 + vy0 * vy0);
    b.vy += this.g * DT;
    let sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp > BALL.maxSpeed) { b.vx *= BALL.maxSpeed / sp; b.vy *= BALL.maxSpeed / sp; }
    b.x += b.vx * DT; b.y += b.vy * DT;
    if (b.lipCool > 0) b.lipCool--;

    const wasTouching = b.touch;
    let touched = false, gravityLeft = true, impact = 0, kind = null;
    for (let pass = 0; pass < CONTACT.passes; pass++) {
      // Deepest contact first.
      let best = null, bestPen = 0, qx = 0, qy = 0, bt = 0;
      for (const s of this.segs) {
        if (b.x < s.minx || b.x > s.maxx || b.y < s.miny || b.y > s.maxy) continue;
        const dx = s.bx - s.ax, dy = s.by - s.ay, l2 = dx * dx + dy * dy;
        let t = l2 > 0 ? ((b.x - s.ax) * dx + (b.y - s.ay) * dy) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = s.ax + dx * t, cy = s.ay + dy * t;
        const ex = b.x - cx, ey = b.y - cy, d2 = ex * ex + ey * ey;
        const R = BALL.r + s.r;
        if (d2 >= R * R) continue;
        const pen = R - Math.sqrt(d2);
        if (pen > bestPen) { bestPen = pen; best = s; qx = cx; qy = cy; bt = t; }
      }
      if (!best) break;
      const s = best, R = BALL.r + s.r;
      let ex = b.x - qx, ey = b.y - qy, d = Math.sqrt(ex * ex + ey * ey);
      let nx, ny;
      if (d > 1e-9) { nx = ex / d; ny = ey / d; } else {
        // Center exactly on the segment: push out along the segment's normal.
        const sx = s.bx - s.ax, sy = s.by - s.ay, sl = Math.sqrt(sx * sx + sy * sy) || 1;
        nx = -sy / sl; ny = sx / sl;
      }
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      const vn = b.vx * nx + b.vy * ny;

      // Small lips roll over (GDD 3.3): a stroke end or convex corner sticking at
      // most 10 px into Dot's path lifts Dot over it at 95% speed.
      const lipEnd = (bt <= 0 && s.lipA) || (bt >= 1 && s.lipB);
      // Measured across the direction Dot was travelling before this step's gravity.
      if (lipEnd && vn < 0 && sp0 > 1 && -vn >= CONTACT.glance * speed) {
        const ux = vx0 / sp0, uy = vy0 / sp0;
        const rx = qx - b.x, ry = qy - b.y;
        const along = ux * rx + uy * ry;
        const cross = ux * ry - uy * rx;
        const h = R - (cross < 0 ? -cross : cross);
        if (along > 0 && h > 0 && h <= CONTACT.lip + 0.5) {   // + the sink of one gravity step
          const sg = cross > 0 ? 1 : -1;     // move to the side away from the lip
          b.x += uy * sg * (h + 0.25);
          b.y += -ux * sg * (h + 0.25);
          if (b.lipCool === 0) { b.vx *= CONTACT.lipKeep; b.vy *= CONTACT.lipKeep; this.events.push({ type: 'lip', ball: b.i, x: qx, y: qy }); }
          b.lipCool = 12;
          touched = true; kind = s.kind;
          continue;
        }
      }

      // Push out.
      b.x += nx * bestPen; b.y += ny * bestPen;
      touched = true; kind = s.kind;
      if (s.kind === 'cup') { b.touchedCup = true; if (qy < this.lv.cups[s.cup].y - 4) b.touchedBoard = true; }
      if (vn >= 0) continue;

      // The part of the approach that is just this step's gravity is absorbed.
      let gIn = 0;
      if (gravityLeft) { const gn = this.g * DT * ny; gIn = gn < 0 ? gn : 0; gravityLeft = false; }
      let vg = vn - gIn;
      if (vg > 0) vg = 0;
      let tx = b.vx - vn * nx, ty = b.vy - vn * ny;
      if (-vn > impact) impact = -vn;
      if (-vg <= CONTACT.glance * speed) {
        // Glancing hit: turned along the surface at the same speed.
        const ts = Math.sqrt(tx * tx + ty * ty);
        if (ts > 1e-9) { const k = Math.sqrt(ts * ts + vg * vg) / ts; tx *= k; ty *= k; }
        b.vx = tx; b.vy = ty;
      } else if (s.kind !== 'ink' && -vn > CONTACT.bounceMin) {
        b.vx = tx - CONTACT.wallBounce * vn * nx;
        b.vy = ty - CONTACT.wallBounce * vn * ny;
      } else {
        b.vx = tx; b.vy = ty;
      }
    }

    if (touched && this.roll > 0) {
      const v = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      const k = v > 0 ? Math.max(0, v - this.roll * DT) / v : 0;
      b.vx *= k; b.vy *= k;
    }
    if (touched && !wasTouching && impact > 120) this.events.push({ type: 'land', ball: b.i, speed: impact, kind, x: b.x, y: b.y });
    b.touch = touched;
    b.touchKind = kind;
  }

  checkCapture(b) {
    this.lv.cups.forEach((c, i) => {
      if (b.state !== 'live') return;
      const dx = b.x - c.x;
      const half = c.w / 2;
      if ((dx < 0 ? -dx : dx) < half - CUP.inset && b.y > c.y - CUP.above && b.y < c.y + CUP.depth) {
        b.state = 'in'; b.cup = i;
        b.label = !b.touchedCup ? 'Swish!' : b.touchedBoard ? 'Bank!' : 'Rim!';
        this.events.push({ type: 'capture', ball: b.i, cup: i, label: b.label, speed: Math.sqrt(b.vx * b.vx + b.vy * b.vy) });
        return;
      }
      // Distance to the mouth, for "So close!".
      const mx = dx < -half ? dx + half : dx > half ? dx - half : 0, my = b.y - c.y;
      const md = Math.sqrt(mx * mx + my * my);
      if (md < b.mouth) b.mouth = md;
    });
  }

  fail(b, cause) {
    b.state = 'out';
    this.done = 'fail'; this.cause = cause; this.failBall = b.i;
    const close = cause === 'lost' && b.mouth <= CUP.close;
    this.events.push({ type: 'fail', ball: b.i, cause, x: b.x, y: b.y, close });
  }

  checkFail(b) {
    const m = FAIL.margin;
    if (b.x < -m || b.x > FIELD_W + m || b.y > FIELD_H + m) return this.fail(b, 'lost');
    // Stuck: inside a 24 × 24 box for 1 s...
    const dx = b.x - b.ax, dy = b.y - b.ay;
    if (dx > FAIL.box || dx < -FAIL.box || dy > FAIL.box || dy < -FAIL.box) { b.ax = b.x; b.ay = b.y; b.aStep = this.steps; }
    else if (this.steps - b.aStep >= FAIL.boxSteps) return this.fail(b, 'stuck');
    // ...or rolls to a stop and turns back for the second time.
    const dir = b.vx > 1 ? 1 : b.vx < -1 ? -1 : 0;
    if (dir !== 0) {
      if (b.touch && b.lastDir !== 0 && dir !== b.lastDir && b.vx * b.vx + b.vy * b.vy < FAIL.turnSpeed * FAIL.turnSpeed) {
        b.turns++;
        if (b.turns >= FAIL.turns) return this.fail(b, 'stuck');
      }
      b.lastDir = dir;
    }
    // Loop: back within 8 px and 30 px/s of a state 0.5–4 s ago, after leaving
    // the stuck box since then (resting is the stuck rule's job).
    if (this.steps % FAIL.sampleEvery === 0) {
      const h = b.hist;
      const n = Math.min(b.histN, HIST);
      for (let k = 0; k < n; k++) {
        const o = ((b.histN - 1 - k) % HIST) * 5;
        const age = this.steps - h[o];
        if (age < FAIL.loopMinSteps || age > FAIL.loopMaxSteps || h[o] >= b.aStep) continue;
        const px = b.x - h[o + 1], py = b.y - h[o + 2], vx = b.vx - h[o + 3], vy = b.vy - h[o + 4];
        if (px * px + py * py < FAIL.loopDist * FAIL.loopDist && vx * vx + vy * vy < FAIL.loopSpeed * FAIL.loopSpeed) return this.fail(b, 'loop');
      }
      const o = (b.histN % HIST) * 5;
      h[o] = this.steps; h[o + 1] = b.x; h[o + 2] = b.y; h[o + 3] = b.vx; h[o + 4] = b.vy;
      b.histN++;
    }
    if (this.steps >= FAIL.timeoutSteps) return this.fail(b, 'timeout');
  }

  // A compact end state, for determinism checks.
  snapshot() {
    return JSON.stringify({ s: this.steps, d: this.done, c: this.cause, b: this.balls.map(b => [b.x, b.y, b.vx, b.vy, b.state, b.cup]) });
  }
}

// Runs a whole attempt with a line and reports the result (tools and tests).
export function runLine(lv, pts, opts) {
  const sim = new Sim(lv, pts, opts).run();
  return { win: sim.done === 'win', cause: sim.cause, time: sim.time, sim };
}
