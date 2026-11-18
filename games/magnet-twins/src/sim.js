// The deterministic game world. No DOM here: the same code runs in the browser
// and in Node (tools/simtest.mjs). One call to step() = one 120 Hz tick.
import {
  T, HZ, STEP, ROBOT, GRAVITY, MAX_FALL, MAGNET, CRATE, DOOR, SPIKE_H, PLATFORM,
  EXIT_STEPS, RESET_STEPS, LAND_EVENT_SPEED, CLANK_SPEED, B,
} from './config.js';
import { parseLevel, TILE, tileAt } from './level.js';
import { moveX, moveY } from './physics.js';
import { applyFields } from './magnet.js';

function approach(v, target, amount) {
  return v < target ? Math.min(v + amount, target) : Math.max(v - amount, target);
}

function makeRobot(pol, spawn) {
  return {
    kind: 'robot', pol, x: spawn.x, y: spawn.y, w: ROBOT.w, h: ROBOT.h,
    px: spawn.x, py: spawn.y, vx: 0, vy: 0, ax: 0, ay: 0, inField: false,
    facing: pol === 'plus' ? 1 : -1, inputDir: 0,
    grounded: false, ground: null, lastGroundStep: -99,
    jumpBufferStep: -99, jumpStep: -99, jumpStartY: 0, jumping: false,
    power: false, aim: 'side', powerOnStep: -99, riding: false, pushing: false,
    lastDx: 0, lastDy: 0, hits: [],
  };
}

function makeCrate(c) {
  return {
    kind: 'crate', x: c.x, y: c.y, w: CRATE.size, h: CRATE.size, sx: c.x, sy: c.y,
    px: c.x, py: c.y, vx: 0, vy: 0, ax: 0, ay: 0, inField: false,
    grounded: false, ground: null, lastDx: 0, lastDy: 0, sunk: 0,
  };
}

export class Sim {
  constructor(data, mode = 'coop') {
    const lv = parseLevel(data);
    this.data = data;
    this.mode = mode;
    this.tiles = lv.tiles;
    this.spawn = lv.spawn;
    this.exit = lv.exit;
    this.robots = [makeRobot('plus', lv.spawn.plus), makeRobot('minus', lv.spawn.minus)];
    this.crates = lv.crates.map(makeCrate);
    this.bodies = [...this.robots, ...this.crates];
    this.gates = lv.doors.map(d => ({
      kind: 'gate', id: d.id, lock: d.lock, x: d.tx * T, y: d.ty * T, w: T, h: 3 * T, fullH: 3 * T, open: 0,
    }));
    // Hanging platforms (GDD 3.5): solid, moved by fields along one axis only, no gravity.
    this.platforms = lv.platforms.map(p => ({
      kind: 'platform', rail: p.rail, x: p.x, y: p.y, w: PLATFORM.w, h: PLATFORM.h, px: p.x, py: p.y,
      min: p.min, max: p.max, v: 0, ax: 0, ay: 0, inField: false, ground: null, lastDx: 0, lastDy: 0,
    }));
    this.obstacles = [...this.bodies, ...this.gates, ...this.platforms];
    this.order = this.bodies.slice();
    this.plates = lv.plates.map(p => ({ ...p, gate: this.gates.find(g => g.id === p.door), touched: false }));
    this.bolts = lv.bolts.map(b => ({ ...b, got: false }));
    // Checkpoint flags (GDD 3.6): the touch box is the pole, 2 tiles tall, standing on the floor
    // of its tile. onStep is the step it was raised (the renderer animates from it).
    this.flags = lv.checkpoints.map(c => ({ x: c.x * T, y: (c.y - 1) * T, w: T, h: 2 * T, base: (c.y + 1) * T, on: false, onStep: -1 }));
    this.respawn = { plus: { ...lv.spawn.plus }, minus: { ...lv.spawn.minus } };

    this.steps = 0;
    this.active = 0;                 // solo: index of the robot under control
    this.prev = [0, 0];
    this.prevSolo = 0;
    this.resetTimer = 0;
    this.exitSteps = 0;
    this.done = false;
    this.events = [];
    this.counts = { plus: 0, minus: 0, switches: 0 };
  }

  get time() { return this.steps / HZ; }
  get boltCount() { return this.bolts.reduce((n, b) => n + (b.got ? 1 : 0), 0); }

  emit(type, data) { this.events.push({ type, ...data }); }

  // bits: co-op = plus byte | minus byte << 8; solo = one controller byte.
  step(bits) {
    if (this.done) return;
    this.steps++;
    for (const b of this.bodies) { b.px = b.x; b.py = b.y; }
    for (const p of this.platforms) { p.px = p.x; p.py = p.y; p.lastDx = 0; p.lastDy = 0; }

    if (this.resetTimer > 0) {
      if (--this.resetTimer === 0) this.respawnRobots();
      return;
    }

    let c0, c1;
    if (this.mode === 'solo') {
      const c = bits & 255;
      if ((c & B.S) && !(this.prevSolo & B.S)) {
        this.active ^= 1;
        this.counts.switches++;
        this.emit('switch', { active: this.active });
      }
      this.prevSolo = c;
      const own = c & ~B.S;
      c0 = this.active === 0 ? own : 0;
      c1 = this.active === 1 ? own : 0;
    } else {
      c0 = bits & 255;
      c1 = (bits >> 8) & 255;
    }
    this.control(this.robots[0], c0, this.prev[0]);
    this.control(this.robots[1], c1, this.prev[1]);
    this.prev[0] = c0; this.prev[1] = c1;

    applyFields(this);
    for (const r of this.robots) this.integrateRobot(r);
    for (const c of this.crates) this.integrateCrate(c);

    // Platforms move first: they carry whatever stands on them.
    for (const p of this.platforms) this.movePlatform(p);

    // Lowest bodies first, so carriers move before their riders.
    this.order.sort((a, b) => (b.y + b.h) - (a.y + a.h));
    for (const b of this.order) this.moveBody(b);

    this.updateGates();
    this.checkWorld();
  }

  control(r, cur, prev) {
    const pressed = cur & ~prev, released = prev & ~cur;
    const grace = MAGNET.aimGraceSteps;

    let turnedOnUp = false;
    let want = r.power;
    if (this.mode === 'solo') { if (pressed & B.P) want = !r.power; }
    else want = !!(cur & B.P);

    if (want && !r.power) {
      r.power = true;
      r.powerOnStep = this.steps;
      this.counts[r.pol]++;
      if (cur & (B.U | B.AU)) {
        r.aim = 'up';
        turnedOnUp = true;
        r.jumpBufferStep = -99;
        // Up came first and started a jump a moment ago: take the hop back.
        if (r.jumping && this.steps - r.jumpStep <= grace && r.jumpStartY - r.y < MAGNET.aimCancelRise) {
          r.y = r.jumpStartY; r.vy = 0; r.jumping = false; r.grounded = true;
        }
      } else if (cur & (B.D | B.AD)) r.aim = 'down';
      else r.aim = 'side';
      this.emit('power', { pol: r.pol, on: true });
    } else if (!want && r.power) {
      r.power = false;
      this.emit('power', { pol: r.pol, on: false });
    }

    const fresh = r.power && r.aim === 'side' && this.steps - r.powerOnStep <= grace;
    if ((pressed & B.U) && !turnedOnUp) {
      if (fresh) r.aim = 'up';
      else r.jumpBufferStep = this.steps;
    }
    if ((pressed & B.D) && fresh) r.aim = 'down';
    if (r.power && (pressed & B.AU)) r.aim = 'up';
    if (r.power && (pressed & B.AD)) r.aim = 'down';

    if ((released & B.U) && r.jumping && r.vy < 0) { r.vy *= ROBOT.jumpCut; r.jumping = false; }

    r.inputDir = ((cur & B.R) ? 1 : 0) - ((cur & B.L) ? 1 : 0);
    if (!r.power && r.inputDir) r.facing = r.inputDir;   // facing locks while the power is on
  }

  integrateRobot(r) {
    const dir = r.inputDir;
    if (dir !== 0) {
      if (Math.sign(r.vx) !== dir || Math.abs(r.vx) < ROBOT.maxSpeed) {
        const acc = ROBOT.accel * (r.grounded ? 1 : ROBOT.airControl);
        r.vx = approach(r.vx, dir * ROBOT.maxSpeed, acc * STEP);
      }
    } else if (r.grounded && r.ax === 0) {
      r.vx = approach(r.vx, 0, ROBOT.decel * STEP);
    }
    this.integrateForces(r);

    r.riding = r.ay < -1 && Math.abs(r.vy) < MAGNET.rideSpeed;
    const canJump = r.grounded || this.steps - r.lastGroundStep <= ROBOT.coyoteSteps || r.riding;
    if (this.steps - r.jumpBufferStep <= ROBOT.bufferSteps && canJump) {
      r.vy = -ROBOT.jumpSpeed;
      r.jumpStep = this.steps;
      r.jumpStartY = r.y;
      r.jumpBufferStep = -99;
      r.lastGroundStep = -99;
      r.jumping = true;
      r.grounded = false;
      this.emit('jump', { pol: r.pol });
    }
  }

  integrateCrate(c) {
    if (c.sunk > 0) return;
    if (c.grounded && c.ax === 0) c.vx = approach(c.vx, 0, CRATE.decel * STEP);
    this.integrateForces(c);
  }

  integrateForces(b) {
    b.vx += b.ax * STEP;
    b.vy += (GRAVITY + b.ay) * STEP;
    if (b.ay < 0 && b.vy > 0) b.vy *= 1 - MAGNET.hoverDamp;   // settle at the hover point
    if (b.inField) {
      b.vx = Math.max(-MAGNET.maxSpeed, Math.min(MAGNET.maxSpeed, b.vx));
      if (b.vy < -MAGNET.maxSpeed && !b.jumping) b.vy = -MAGNET.maxSpeed;
    }
    if (b.vy > MAX_FALL) b.vy = MAX_FALL;
  }

  // A platform keeps only the force along its rail, at half strength. It brakes when no field
  // touches it, or when the field pulls against its motion (so it settles instead of swinging).
  movePlatform(p) {
    const h = p.rail === 'h';
    const a = (h ? p.ax : p.ay) * PLATFORM.accelScale;
    p.v += a * STEP;
    if (a === 0 || Math.sign(p.v) !== Math.sign(a)) p.v = approach(p.v, 0, PLATFORM.brake * STEP);
    p.v = Math.max(-MAGNET.maxSpeed, Math.min(MAGNET.maxSpeed, p.v));
    if (p.v === 0) return;
    const pos = h ? p.x : p.y;
    const want = Math.max(p.min, Math.min(p.max, pos + p.v * STEP));
    const hit = want !== pos && (h ? moveX(this, p, want - pos) : moveY(this, p, want - pos));
    const now = h ? p.x : p.y;
    if (hit || now <= p.min || now >= p.max) p.v = 0;   // a rail end or a body in the way stops it
    p.lastDx = p.x - p.px;
    p.lastDy = p.y - p.py;
  }

  moveBody(b) {
    if (b.sunk > 0) return;
    const x0 = b.x, y0 = b.y;
    const carrier = b.ground && b.ground !== 'tile' ? b.ground : null;

    // Ride along with whatever we stand on.
    if (carrier) {
      if (carrier.lastDx) moveX(this, b, carrier.lastDx);
      if (carrier.lastDy) moveY(this, b, carrier.lastDy);
    }

    const dx = b.vx * STEP;
    const h = moveX(this, b, dx);
    b.pushing = false;
    if (h) {
      const crate = h.body && h.body.kind === 'crate' ? h.body : null;
      if (b.kind === 'robot' && crate && b.grounded && Math.sign(dx) === b.inputDir) {
        // Walking into a crate pushes it slowly.
        const amount = Math.sign(dx) * Math.min(Math.abs(dx), ROBOT.pushSpeed * STEP);
        moveX(this, crate, amount, b);
        moveX(this, b, amount);
        b.vx = Math.sign(dx) * Math.min(Math.abs(b.vx), ROBOT.pushSpeed);
        b.pushing = true;
      } else {
        if (b.kind === 'crate' && Math.abs(b.vx) > CLANK_SPEED) this.emit('clank', { x: b.x + b.w / 2, y: b.y + b.h / 2, speed: Math.abs(b.vx) });
        b.vx = 0;
      }
    }

    const wasGrounded = b.grounded;
    const vy = b.vy;
    b.grounded = false;
    b.ground = null;
    const v = moveY(this, b, b.vy * STEP);
    if (v && b.vy > 0) {
      b.grounded = true;
      b.ground = v.body || 'tile';
      b.vy = 0;
      if (b.kind === 'robot') {
        b.jumping = false;
        if (!wasGrounded && vy > LAND_EVENT_SPEED) this.emit('land', { pol: b.pol, speed: vy });
      } else if (!wasGrounded && vy > CLANK_SPEED) {
        this.emit('clank', { x: b.x + b.w / 2, y: b.y + b.h, speed: vy });
      }
    } else if (v && b.vy < 0) {
      b.vy = 0;
      b.jumping = false;
    }
    if (b.grounded && b.kind === 'robot') b.lastGroundStep = this.steps;

    b.lastDx = b.x - x0;
    b.lastDy = b.y - y0;
  }

  updateGates() {
    for (const g of this.gates) {
      let touched = false;
      for (const p of this.plates) if (p.gate === g && p.touched) touched = true;
      const before = g.open;
      if (touched) {
        g.open = Math.min(1, g.open + STEP / DOOR.openTime);
      } else if (g.open > 0) {
        // A closing gate never crushes and never stays open for a body: it nudges it out.
        let blocked = false;
        for (const b of this.bodies) {
          if (b.sunk > 0) continue;
          if (b.x < g.x + g.w && b.x + b.w > g.x && b.y < g.y + g.fullH && b.y + b.h > g.y + g.h - 1) {
            blocked = true;
            const side = b.x + b.w / 2 < g.x + g.w / 2 ? -1 : 1;
            moveX(this, b, side * DOOR.pushOut * STEP);
          }
        }
        if (!blocked) g.open = Math.max(0, g.open - STEP / DOOR.closeTime);
      }
      g.h = g.fullH * (1 - g.open);
      if (before === 0 && g.open > 0) this.emit('door', { id: g.id, open: true });
      if (before > 0 && g.open === 0) this.emit('door', { id: g.id, open: false });
    }
  }

  checkWorld() {
    // Hazards
    for (const r of this.robots) {
      const hz = this.hazardUnder(r);
      if (hz) { this.hazard(hz); return; }
    }

    // Crates in water sink and come back
    for (const c of this.crates) {
      if (c.sunk > 0) {
        if (--c.sunk === 0) {
          const spot = { x: c.sx, y: c.sy, w: c.w, h: c.h };
          if (this.bodies.some(b => b !== c && b.sunk === 0 && overlapsBox(b, spot))) c.sunk = 1;
          else { c.x = c.px = c.sx; c.y = c.py = c.sy; c.vx = c.vy = 0; this.emit('crateBack', { x: c.x + 20, y: c.y + 20 }); }
        }
        continue;
      }
      const t = tileAt(this.tiles, Math.floor((c.x + c.w / 2) / T), Math.floor((c.y + c.h / 2) / T));
      if (t === TILE.WATER) {
        c.sunk = HZ;
        c.vx = c.vy = 0;
        c.y = -1000;   // out of the way while sunk
        this.emit('splash', { x: c.px + 20, y: c.py + 20 });
      }
    }

    // Bolts
    for (let i = 0; i < this.bolts.length; i++) {
      const bolt = this.bolts[i];
      if (bolt.got) continue;
      for (const r of this.robots) {
        const nx = Math.max(r.x, Math.min(bolt.x, r.x + r.w));
        const ny = Math.max(r.y, Math.min(bolt.y, r.y + r.h));
        if ((nx - bolt.x) ** 2 + (ny - bolt.y) ** 2 < 14 * 14) {
          bolt.got = true;
          this.emit('bolt', { i, n: this.boltCount, x: bolt.x, y: bolt.y, pol: r.pol });
          break;
        }
      }
    }

    // Checkpoints: one touch from either robot raises the flag for both. The robots then
    // respawn side by side at it, Plus on the left of the pole and Minus on the right.
    for (const f of this.flags) {
      if (f.on) continue;
      const r = this.robots.find(q => overlapsBox(q, f));
      if (r) {
        for (const o of this.flags) o.on = false;
        f.on = true;
        f.onStep = this.steps;
        this.respawn.plus = { x: f.x - ROBOT.w - 2, y: f.base - ROBOT.h };
        this.respawn.minus = { x: f.x + T + 2, y: f.base - ROBOT.h };
        this.emit('checkpoint', { x: f.x + T / 2, y: f.y, pol: r.pol, index: this.flags.indexOf(f) });
      }
    }

    // Exit: both robot centers inside for a moment
    const e = this.exit;
    const inside = this.robots.map(r => {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      return cx > e.x && cx < e.x + e.w && cy > e.y && cy < e.y + e.h;
    });
    this.inExit = inside;
    if (inside[0] && inside[1]) {
      if (++this.exitSteps >= EXIT_STEPS) {
        this.done = true;
        this.emit('complete', { time: this.time, bolts: this.boltCount });
      }
    } else this.exitSteps = 0;
  }

  hazardUnder(r) {
    // 1 px margin so touching spikes from the side or from above counts.
    const left = r.x - 1, right = r.x + r.w + 1, bottom = r.y + r.h + 1;
    const x0 = Math.floor(left / T), x1 = Math.floor(right / T);
    const y0 = Math.floor(r.y / T), y1 = Math.floor(bottom / T);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const t = tileAt(this.tiles, tx, ty);
        if (t === TILE.SPIKES && bottom > ty * T + T - SPIKE_H + 2 && right > tx * T + 2 && left < tx * T + T - 2) return 'spikes';
        if (t === TILE.WATER && r.y + r.h > ty * T + 8) return 'water';
      }
    }
    return null;
  }

  hazard(kind) {
    this.resetTimer = RESET_STEPS;
    this.emit('hazard', { kind, at: this.robots.map(r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2, pol: r.pol })) });
    for (const r of this.robots) {
      if (r.power) { r.power = false; this.emit('power', { pol: r.pol, on: false }); }
      r.vx = r.vy = 0;
      r.hidden = true;
    }
  }

  respawnRobots() {
    for (const r of this.robots) {
      const s = this.respawn[r.pol];
      r.x = r.px = s.x; r.y = r.py = s.y;
      r.vx = r.vy = 0;
      r.ground = null; r.grounded = false; r.jumping = false;
      r.jumpBufferStep = -99; r.lastGroundStep = -99; r.aim = 'side';
      r.hidden = false;
      r.facing = r.pol === 'plus' ? 1 : -1;
    }
    this.emit('respawn', {});
  }

  // Debug: jump straight to the exit (window.game.win()).
  forceWin() {
    if (this.done) return;
    this.done = true;
    this.emit('complete', { time: this.time, bolts: this.boltCount });
  }
}

function overlapsBox(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
