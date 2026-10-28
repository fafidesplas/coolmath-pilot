// The deterministic room (GDD 3): live player, echoes, plates, gates, loop clock.
// No DOM and no Math.random / transcendental functions, so the same code runs in
// the browser, in tools/simtest.mjs, in the lone-runner bot and in the forecast.
// All mutable state lives in `this.s` (plain data) so tools can snapshot it.
import { HZ, STEP, PLAYER as P, ECHO, GATE, PLATE_OVERLAP, BIT, MOVE_BITS } from './config.js';
import { gateWants } from './level.js';
import { scan, hit, gateOverlap, EPS } from './physics.js';
import { Tape, POSE, GROUND } from './tape.js';

const approach = (v, target, d) => (v < target ? Math.min(v + d, target) : Math.max(v - d, target));

function newEcho() {
  return { x: 0, y: 0, px: 0, py: 0, vy: 0, grounded: true, ground: GROUND.SOLID, pose: POSE.STAND, resting: false, broken: false, hold: false, brokeAt: -1 };
}

export class Sim {
  // opts.lone: no loop clock limit, Loop/Delete ignored (lone-runner bot)
  // opts.ghost: the echo-only forecast pre-run; opts.share: the Sim whose tapes it replays
  constructor(lv, opts = {}) {
    this.lv = lv;
    this.lone = !!opts.lone;
    this.ghost = !!opts.ghost;
    this.events = [];
    this.emitOn = opts.events !== false;
    const N = ECHO.maxSteps;
    this.tapes = opts.share ? opts.share.tapes : Array.from({ length: ECHO.maxSlots }, () => new Tape());
    this.liveTape = new Tape();
    // History of the current loop for the rewind and the results replay.
    this.hist = Array.from({ length: ECHO.maxSlots }, () => ({ x: new Float32Array(N), y: new Float32Array(N), pose: new Uint8Array(N) }));
    this.gateHist = lv.gates.map(() => new Float32Array(N));
    this.last = {
      len: 0, count: 0, live: new Tape(),
      echoes: Array.from({ length: ECHO.maxSlots }, () => ({ x: new Float32Array(N), y: new Float32Array(N), pose: new Uint8Array(N), brokeAt: -1 })),
      gates: lv.gates.map(() => new Float32Array(N)),
    };
    this.s = {
      n: 0, prev: 0, clock: 0, running: false, roomSteps: 0, done: false, count: 0,
      p: { x: 0, y: 0, vx: 0, vy: 0, grounded: true, ground: GROUND.SOLID, coyote: 0, buffer: 0, jumping: false, facing: 1 },
      echoes: Array.from({ length: ECHO.maxSlots }, newEcho),
      open: new Float64Array(lv.gates.length),
      want: new Uint8Array(lv.gates.length),
      pressed: new Uint8Array(lv.plates.length),
      ch: 0, liveCh: 0, liveOnCh: 0,
      counts: { loops: 0, early: 0, timeout: 0, full: 0, deletes: 0, breaks: 0 },
    };
    if (opts.share) this.s.count = opts.share.s.count;
    this.resetLoop(false);
  }

  get open() { return this.s.open; }
  get p() { return this.s.p; }
  get echoes() { return this.s.echoes; }
  get count() { return this.s.count; }
  get loopTime() { return this.s.clock / HZ; }
  get roomTime() { return this.s.roomSteps / HZ; }

  emit(type, data) { if (this.emitOn) this.events.push(data ? { type, ...data } : { type }); }

  // ---- Loop control -------------------------------------------------------------

  resetLoop(emit = true) {
    const s = this.s, lv = this.lv, sp = lv.spawn;
    s.clock = 0;
    s.running = this.ghost;
    s.liveCh = 0; s.liveOnCh = 0;
    Object.assign(s.p, { x: sp.x, y: sp.y, vx: 0, vy: 0, grounded: true, ground: GROUND.SOLID, coyote: 0, buffer: 0, jumping: false, facing: 1 });
    for (let i = 0; i < ECHO.maxSlots; i++) {
      const e = s.echoes[i];
      Object.assign(e, { x: sp.x, y: sp.y, px: sp.x, py: sp.y, vy: 0, grounded: true, ground: GROUND.SOLID, pose: POSE.STAND, resting: false, broken: false, hold: false, brokeAt: -1 });
      if (i < s.count && this.tapes[i].len === 0) e.resting = true;
    }
    this.updatePlates(false);
    for (let i = 0; i < lv.gates.length; i++) {
      const w = gateWants(lv.gates[i], s.ch);
      s.want[i] = w ? 1 : 0;
      s.open[i] = w ? 1 : 0;
    }
    if (emit) this.emit('loopReset');
  }

  snapshotLoop() {
    const s = this.s, L = this.last, len = s.clock;
    L.len = len; L.count = s.count;
    L.live.x.set(this.liveTape.x.subarray(0, len)); L.live.y.set(this.liveTape.y.subarray(0, len)); L.live.pose.set(this.liveTape.pose.subarray(0, len));
    for (let i = 0; i < s.count; i++) {
      const h = this.hist[i], d = L.echoes[i];
      d.x.set(h.x.subarray(0, len)); d.y.set(h.y.subarray(0, len)); d.pose.set(h.pose.subarray(0, len));
      d.brokeAt = s.echoes[i].brokeAt;
    }
    this.gateHist.forEach((g, i) => L.gates[i].set(g.subarray(0, len)));
  }

  endLoop(reason) {
    const s = this.s;
    this.snapshotLoop();
    s.counts.loops++;
    s.counts[reason]++;
    let slot = -1;
    if (s.count < this.lv.slots) {
      slot = s.count;
      const t = this.tapes[slot];
      this.tapes[slot] = this.liveTape;          // swap buffers, nothing allocated
      this.liveTape = t;
      this.tapes[slot].len = s.clock;
      this.tapes[slot].zap = false;
      s.count++;
    } else {
      s.counts.full++;
    }
    this.emit('loopEnd', { reason, slot, len: s.clock, moved: s.running });
    this.resetLoop();
  }

  deleteEcho() {
    const s = this.s;
    this.snapshotLoop();
    let slot = -1;
    if (s.count > 0) { s.count--; slot = s.count; s.counts.deletes++; }
    this.emit('delete', { slot });
    this.resetLoop();
  }

  // ---- One 120 Hz step (GDD 3.2 order) -----------------------------------------------

  step(bits) {
    const s = this.s;
    s.n++;
    const edges = bits & ~s.prev;
    s.prev = bits;
    if (s.done) return;
    // (1) Loop or Delete ends the loop here, before anything moves.
    if (!this.lone && !this.ghost) {
      if (edges & BIT.DEL) { this.deleteEcho(); return; }
      if (edges & BIT.LOOP) { this.endLoop('early'); return; }
    }
    if (!s.running) {
      if (!(bits & MOVE_BITS)) return;           // the clock waits for the first move
      s.running = true;
      this.emit('clockStart');
    }
    const c = s.clock;
    this.updateGates(c);                          // (2)
    for (let i = 0; i < s.count; i++) this.updateEcho(i, c);   // (3)
    if (!this.ghost) this.updateLive(bits, edges);              // (4)
    this.updatePlates(true);                      // (5)
    if (!this.ghost) {
      const p = s.p, ex = this.lv.exit;           // (7)
      if (p.x + P.w > ex.x && p.x < ex.x + ex.w && p.y + P.h > ex.y && p.y < ex.y + ex.h) s.done = true;
      const pose = (p.grounded ? POSE.STAND : 0) | (p.facing < 0 ? POSE.LEFT : 0) | (Math.abs(p.vx) > 20 ? POSE.RUN : 0) | (p.vy < 0 ? POSE.RISE : 0);
      this.liveTape.write(c, p.x, p.y, pose, p.grounded ? p.ground : GROUND.AIR);   // (8)
    }
    for (let i = 0; i < s.count; i++) {
      const e = s.echoes[i], h = this.hist[i];
      h.x[c] = e.x; h.y[c] = e.y; h.pose[c] = e.broken ? 0 : e.pose;
    }
    for (let i = 0; i < this.gateHist.length; i++) this.gateHist[i][c] = s.open[i];
    s.clock++;                                    // (9)
    s.roomSteps++;
    if (s.done) { this.snapshotLoop(); this.emit('exit'); return; }
    if (s.clock % HZ === 0) this.emit('second', { sec: s.clock / HZ });
    if (!this.lone && !this.ghost && s.clock >= this.lv.loopSteps) this.endLoop('timeout');
  }

  // ---- Devices ----------------------------------------------------------------------

  updateGates() {
    const s = this.s, gates = this.lv.gates;
    for (let i = 0; i < gates.length; i++) {
      const g = gates[i], want = gateWants(g, s.ch) ? 1 : 0;
      if (want !== s.want[i]) { s.want[i] = want; this.emit(want ? 'gateOpen' : 'gateClose', { gate: i }); }
      const o = s.open[i];
      s.open[i] = want ? Math.min(1, o + STEP / GATE.openTime) : Math.max(0, o - STEP / GATE.closeTime);
      if (s.open[i] < o) {
        // A closing gate never crushes: it pushes bodies out to the side their center is on.
        if (!this.ghost) this.pushOut(s.p, i);
        for (let k = 0; k < s.count; k++) { const e = s.echoes[k]; if (e.resting && !e.broken) this.pushOut(e, i); }
      }
    }
  }

  pushOut(b, gi) {
    const g = this.lv.gates[gi];
    const o = gateOverlap(this, b.x, b.y, P.w, P.h);
    if (!o || o.gate !== gi) return;
    b.x = b.x + P.w / 2 < g.x + g.w / 2 ? g.x - P.w : g.x + g.w;
    if (b.vx !== undefined) b.vx = 0;
  }

  updatePlates(emit) {
    const s = this.s, lv = this.lv, p = s.p;
    let ch = 0, liveOn = 0;
    for (let k = 0; k < s.count; k++) s.echoes[k].hold = false;
    for (let i = 0; i < lv.plates.length; i++) {
      const pl = lv.plates[i];
      let on = false;
      if (!this.ghost && p.grounded && Math.abs(p.y + P.h - pl.y) < 0.5 && Math.min(p.x + P.w, pl.x1) - Math.max(p.x, pl.x0) >= PLATE_OVERLAP) {
        on = true; liveOn |= 1 << pl.ch;
      }
      for (let k = 0; k < s.count; k++) {
        const e = s.echoes[k];
        if (e.broken || !e.grounded) continue;
        if (Math.abs(e.y + P.h - pl.y) < 0.5 && Math.min(e.x + P.w, pl.x1) - Math.max(e.x, pl.x0) >= PLATE_OVERLAP) { on = true; e.hold = true; }
      }
      if (on !== !!s.pressed[i]) {
        s.pressed[i] = on ? 1 : 0;
        if (emit) this.emit(on ? 'plateDown' : 'plateUp', { plate: i, live: !!(liveOn & (1 << pl.ch)) });
      }
      if (on) ch |= 1 << pl.ch;
    }
    s.ch = ch;
    s.liveOnCh = liveOn;
    s.liveCh |= liveOn;
  }

  // ---- Echoes (GDD 3.5) ---------------------------------------------------------------

  breakEcho(i, gate) {
    const e = this.s.echoes[i];
    e.broken = true; e.brokeAt = this.s.clock; e.hold = false;
    this.s.counts.breaks++;
    this.emit('break', { echo: i, gate });
  }

  updateEcho(i, c) {
    const s = this.s, e = s.echoes[i], tape = this.tapes[i];
    e.px = e.x; e.py = e.y;
    if (e.broken) return;
    if (c < tape.len) {
      e.x = tape.x[c]; e.y = tape.y[c]; e.pose = tape.pose[c]; e.ground = tape.ground[c];
      e.grounded = (e.pose & POSE.STAND) !== 0;
      const o = gateOverlap(this, e.x, e.y, P.w, P.h);
      if (o && o.overlap > ECHO.breakOverlap) { this.breakEcho(i, o.gate); return; }
      if (e.ground >= GROUND.ECHO0 && s.echoes[e.ground - GROUND.ECHO0].broken) { this.breakEcho(i, -1); return; }
      return;
    }
    if (!e.resting) {
      // Tape over: rest at the last spot; drop if it ended in mid-air.
      e.resting = true; e.vy = 0;
      e.pose = (e.pose & POSE.LEFT) | (e.grounded ? POSE.STAND : 0);
      this.emit('rest', { echo: i });
    }
    if (e.grounded && e.ground >= GROUND.ECHO0) {
      const sup = s.echoes[e.ground - GROUND.ECHO0];
      if (sup.broken) { this.breakEcho(i, -1); return; }
      if (!sup.grounded) e.grounded = false;
      else { e.x += sup.x - sup.px; e.y += sup.y - sup.py; }
    }
    if (!e.grounded) {
      e.vy = Math.min(e.vy + P.gravity * STEP, P.maxFall);
      this.moveY(e, e.vy * STEP, i, false);
      if (e.grounded) e.pose |= POSE.STAND;
    }
  }

  // ---- The live player (GDD 3.3) --------------------------------------------------------

  updateLive(bits, edges) {
    const s = this.s, p = s.p;
    if (p.grounded && p.ground >= GROUND.ECHO0) {
      const e = s.echoes[p.ground - GROUND.ECHO0];
      if (!e.broken && e.grounded) {
        const dx = e.x - e.px, dy = e.y - e.py;
        if (dx) this.moveX(p, dx, false);
        if (dy) { if (dy < 0) { if (!scan(this, p.x, p.y + dy, P.w, P.h)) p.y += dy; } else p.y += dy; }
      } else p.grounded = false;
    }
    const dir = (bits & BIT.RIGHT ? 1 : 0) - (bits & BIT.LEFT ? 1 : 0);
    const g0 = p.grounded;
    if (dir) {
      p.vx = approach(p.vx, dir * P.maxSpeed, (g0 ? P.accel : P.airAccel) * STEP);
      p.facing = dir;
    } else {
      p.vx = approach(p.vx, 0, (g0 ? P.decel : P.airDecel) * STEP);
    }
    if (edges & BIT.JUMP) p.buffer = P.bufferSteps;
    if (p.buffer > 0) {
      if (p.grounded || p.coyote > 0) {
        p.vy = -P.jumpSpeed; p.jumping = true; p.grounded = false; p.ground = GROUND.AIR; p.coyote = 0; p.buffer = 0;
        this.emit('jump');
      } else p.buffer--;
    }
    if (p.jumping && (!(bits & BIT.JUMP) || p.vy >= 0)) {
      if (p.vy < 0) p.vy *= P.jumpCut;
      p.jumping = false;
    }
    const g = p.jumping ? P.gravityHold : P.gravity;
    p.vy = Math.min(p.vy + g * STEP, P.maxFall);
    const before = p.x + P.w / 2, vyIn = p.vy;
    if (p.vx) this.moveX(p, p.vx * STEP, true);
    const wasGround = g0;
    this.moveY(p, p.vy * STEP, s.count, true);
    if (p.grounded) {
      p.coyote = P.coyoteSteps;
      if (!wasGround) this.emit('land', { speed: vyIn, echo: p.ground >= GROUND.ECHO0 ? p.ground - GROUND.ECHO0 : -1 });
    } else if (p.coyote > 0) p.coyote--;
    // Passing a gate (tutorial step 3: a gate an echo holds open).
    const after = p.x + P.w / 2, gates = this.lv.gates;
    for (let i = 0; i < gates.length; i++) {
      const gx = gates[i].x + gates[i].w / 2;
      if ((before < gx) !== (after < gx) && s.open[i] > 0.5) {
        this.emit('passGate', { gate: i, echoHeld: (s.ch & gates[i].mask) !== 0 && (s.liveOnCh & gates[i].mask) === 0 });
      }
    }
  }

  moveX(b, dx, nudge) {
    const nx = b.x + dx;
    if (!scan(this, nx, b.y, P.w, P.h)) { b.x = nx; return; }
    const left = hit.left, right = hit.right, top = hit.top;
    if (nudge) {
      // A ledge lip within 6 px below your feet lifts you onto it (GDD 3.3).
      const lift = b.y + P.h - top;
      if (lift > 0 && lift <= P.nudge && !scan(this, nx, top - P.h, P.w, P.h)) { b.x = nx; b.y = top - P.h; if (b.vy > 0) b.vy = 0; return; }
    }
    if (dx > 0) b.x = Math.max(b.x, left - P.w); else b.x = Math.min(b.x, right);
    b.vx = 0;
  }

  // Vertical move with landing on solids and on standing echo tops (one-way).
  // Bodies may stand on echoes with index < maxEcho.
  moveY(b, dy, maxEcho, live) {
    const ny = b.y + dy;
    if (dy < 0) {
      if (scan(this, b.x, ny, P.w, P.h)) {
        const bottom = hit.bottom;
        if (live) {
          // Bumping a ceiling corner by up to 6 px slides you past it.
          for (let k = 1; k <= P.nudge; k++) {
            if (!scan(this, b.x + k, ny, P.w, P.h)) { b.x += k; b.y = ny; b.grounded = false; b.ground = GROUND.AIR; return; }
            if (!scan(this, b.x - k, ny, P.w, P.h)) { b.x -= k; b.y = ny; b.grounded = false; b.ground = GROUND.AIR; return; }
          }
          b.jumping = false;
        }
        b.y = Math.max(b.y, bottom);
        b.vy = 0;
      } else b.y = ny;
      b.grounded = false; b.ground = GROUND.AIR;
      return;
    }
    let top = Infinity, ref = GROUND.AIR;
    if (scan(this, b.x, ny, P.w, P.h)) { top = hit.top; ref = GROUND.SOLID; }
    const echoes = this.s.echoes, pad = ECHO.topPad, foot = b.y + P.h;
    for (let k = 0; k < maxEcho; k++) {
      const e = echoes[k];
      if (e.broken || !e.grounded || e === b) continue;
      if (b.x + P.w > e.x - pad + EPS && b.x < e.x + P.w + pad - EPS && foot <= e.y + 0.01 && ny + P.h >= e.y && e.y < top) { top = e.y; ref = GROUND.ECHO0 + k; }
    }
    if (ref) { b.y = top - P.h; b.vy = 0; b.grounded = true; b.ground = ref; }
    else { b.y = ny; b.grounded = false; b.ground = GROUND.AIR; }
  }

  // ---- Tools ------------------------------------------------------------------------

  snapshot() { return structuredClone(this.s); }
  restore(snap) { this.s = structuredClone(snap); }
  forceWin() { this.s.done = true; this.snapshotLoop(); this.emit('exit'); }
}
