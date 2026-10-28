// The deterministic test world (GDD 3.2–3.7): joints, members, vehicles, wheel
// contacts, breaking and the pass/fail rules. XPBD at 120 Hz × 8 substeps.
// No DOM, runs in Node. Only + − × ÷, comparisons and Math.sqrt: no Math.hypot,
// trig, pow, exp or random, so the same bridge gives bit-identical results everywhere.
import { HZ, SUBSTEPS, SIM, MATERIALS, VEHICLES, DRIVE, TEST } from './config.js';

const MAT_INDEX = { road: 0, wood: 1, steel: 2, cable: 3 };
export const MAT_NAMES = ['road', 'wood', 'steel', 'cable'];

export class Sim {
  // level: parsed level; members: [[x1, y1, x2, y2, material], ...] in grid cells.
  // opts.loads: [[x, y, kg]] extra masses on joints (tests only).
  // opts.vehicles: override the level's vehicle list ([] for none).
  // opts.noBreak: members never break (tests only, to measure the demand).
  constructor(level, members, opts = {}) {
    this.level = level;
    this.sub = opts.substeps || SUBSTEPS;   // tests only: compare 8 against 16
    this.h = 1 / HZ / this.sub;
    this.time = 0;
    this.steps = 0;
    this.events = [];
    this.result = null;          // { pass, reason, time, peak, broken, firstBreak }
    this.peak = 0;               // highest stress ratio until the result is locked
    this.firstBreak = -1;
    this.broken = 0;
    this.noBreak = !!opts.noBreak;   // tests only: measure the demand without breaking

    // ---- joints: anchors first, then member ends in order of appearance
    const index = new Map();
    const jx = [], jy = [], fixed = [];
    const joint = (x, y, fix) => {
      const k = x + ',' + y;
      if (index.has(k)) return index.get(k);
      index.set(k, jx.length); jx.push(x); jy.push(y); fixed.push(fix);
      return jx.length - 1;
    };
    for (const [x, y] of level.anchors) joint(x, y, true);
    const ms = members.map(m => [joint(m[0], m[1], false), joint(m[2], m[3], false), m[4]]);
    this.bridgeJoints = jx.length;

    // ---- vehicles: two wheel particles each, appended after the bridge joints
    const vlist = opts.vehicles || level.vehicles;
    const wheels = [];
    let back = level.startX;
    for (const name of vlist) {
      const v = VEHICLES[name];
      const y = level.startY - v.r;
      wheels.push({ name, v, front: back, rear: back - v.base, y });
      back = back - v.base - DRIVE.convoyGap;
    }
    const nJ = jx.length + wheels.length * 2;
    this.n = nJ;
    this.x = new Float64Array(nJ); this.y = new Float64Array(nJ);
    this.px = new Float64Array(nJ); this.py = new Float64Array(nJ);
    this.vx = new Float64Array(nJ); this.vy = new Float64Array(nJ);
    this.w = new Float64Array(nJ);
    this.mass = new Float64Array(nJ);
    this.active = new Uint8Array(nJ);
    this.degree = new Uint16Array(nJ);
    for (let i = 0; i < jx.length; i++) { this.x[i] = jx[i]; this.y[i] = jy[i]; this.active[i] = fixed[i] ? 0 : 1; }
    this.fixed = fixed;
    this.jointKey = [...index.keys()];

    // ---- members
    const nM = ms.length;
    this.m = nM;
    this.ma = new Int32Array(nM); this.mb = new Int32Array(nM);
    this.rest = new Float64Array(nM);
    this.alpha = new Float64Array(nM);        // compliance / h²
    this.limT = new Float64Array(nM); this.limC = new Float64Array(nM);
    this.mat = new Uint8Array(nM);
    this.alive = new Uint8Array(nM);
    this.nx = new Float64Array(nM); this.ny = new Float64Array(nM);
    this.fsum = new Float64Array(nM);
    this.force = new Float64Array(nM);        // step-averaged, tension positive
    this.stress = new Float64Array(nM);       // ratio of the limit, this step
    this.mpeak = new Float64Array(nM);
    this.msign = new Int8Array(nM);          // +1 pulled, −1 squeezed, at the peak
    this.slack = new Uint8Array(nM);
    this.brokeAt = new Float64Array(nM);
    this.breakDir = new Float64Array(nM * 2);
    const h2 = this.h * this.h;
    const jm = new Float64Array(jx.length);
    for (let i = 0; i < nM; i++) {
      const [a, b, name] = ms[i], mat = MATERIALS[name];
      const dx = jx[b] - jx[a], dy = jy[b] - jy[a], L = Math.sqrt(dx * dx + dy * dy);
      this.ma[i] = a; this.mb[i] = b; this.rest[i] = L;
      this.alpha[i] = L / mat.ea / h2;
      this.limT[i] = mat.tension; this.limC[i] = mat.compression;
      this.mat[i] = MAT_INDEX[name];
      this.alive[i] = 1;
      this.brokeAt[i] = -1;
      jm[a] += mat.mass * L * 0.5; jm[b] += mat.mass * L * 0.5;
      this.degree[a]++; this.degree[b]++;
    }
    const loads = opts.loads || [];
    for (const [x, y, kg] of loads) { const k = index.get(x + ',' + y); if (k !== undefined) jm[k] += kg; }
    for (let i = 0; i < jx.length; i++) {
      const mass = jm[i] > SIM.minJointMass ? jm[i] : SIM.minJointMass;
      this.mass[i] = mass;
      this.w[i] = fixed[i] ? 0 : 1 / mass;
    }
    this.roads = [];
    for (let i = 0; i < nM; i++) if (this.mat[i] === 0) this.roads.push(i);

    // ---- vehicle state
    this.vehicles = wheels.map((wh, k) => {
      const f = jx.length + k * 2, r = f + 1, half = wh.v.mass / 2;
      this.x[f] = wh.front; this.y[f] = wh.y; this.x[r] = wh.rear; this.y[r] = wh.y;
      this.mass[f] = this.mass[r] = half;
      this.w[f] = this.w[r] = 1 / half;
      this.active[f] = this.active[r] = 1;
      return {
        name: wh.name, spec: wh.v, f, r, base: wh.v.base, rad: wh.v.r,
        engineCap: DRIVE.engine * SIM.gravity * wh.v.mass * h2 / 2,
        passed: false, fell: false, checkX: (wh.front + wh.rear) / 2, checkT: 0,
        contact: false, speed: 0,
      };
    });
    for (let i = 0; i < nJ; i++) { this.px[i] = this.x[i]; this.py[i] = this.y[i]; }
    this.prevX = new Float64Array(nJ); this.prevY = new Float64Array(nJ);   // positions at the start of the step (render interpolation)
    this.subX = new Float64Array(nJ); this.subY = new Float64Array(nJ);     // positions at the start of the substep
    this.ux = new Float64Array(nJ); this.uy = new Float64Array(nJ);         // velocities at the start of the substep (before gravity)
  }

  // One 120 Hz step = 8 substeps, then breaking and the test rules.
  step() {
    const n = this.n, nM = this.m, h = this.h;
    for (let i = 0; i < n; i++) { this.prevX[i] = this.x[i]; this.prevY[i] = this.y[i]; }
    for (let i = 0; i < nM; i++) this.fsum[i] = 0;
    for (let s = 0; s < this.sub; s++) {
      const t = this.time + s * h;
      const g = t < SIM.rampTime ? SIM.gravity * t / SIM.rampTime : SIM.gravity;
      this.substep(h, g, t < SIM.settleTime);
    }
    this.time = (this.steps + 1) / HZ;
    this.steps++;
    this.afterStep();
  }

  substep(h, g, settling) {
    const n = this.n, nB = this.bridgeJoints;
    const x = this.x, y = this.y, vx = this.vx, vy = this.vy, w = this.w, act = this.active;
    const settle = settling ? 1 - SIM.settleDamping * h : 1;
    // gravity and prediction
    for (let i = 0; i < n; i++) {
      this.subX[i] = x[i]; this.subY[i] = y[i];
      this.ux[i] = vx[i]; this.uy[i] = vy[i];
      if (!act[i]) continue;
      if (i < nB) { vx[i] *= settle; vy[i] *= settle; }
      vy[i] += g * h;
      x[i] += vx[i] * h; y[i] += vy[i] * h;
    }
    // members, in creation order
    const ma = this.ma, mb = this.mb, alive = this.alive, h2 = h * h;
    for (let i = 0; i < this.m; i++) {
      if (!alive[i]) continue;
      const a = ma[i], b = mb[i];
      const dx = x[b] - x[a], dy = y[b] - y[a];
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-9) continue;
      const nx = dx / d, ny = dy / d;
      this.nx[i] = nx; this.ny[i] = ny;
      const C = d - this.rest[i];
      if (C < 0 && this.mat[i] === 3) { this.slack[i] = 1; continue; }   // cable: slack, no push
      this.slack[i] = 0;
      const wa = w[a], wb = w[b];
      const dl = -C / (wa + wb + this.alpha[i]);
      x[a] -= wa * dl * nx; y[a] -= wa * dl * ny;
      x[b] += wb * dl * nx; y[b] += wb * dl * ny;
      this.fsum[i] += -dl / h2;
    }
    // vehicle bodies (rigid wheelbase)
    for (const v of this.vehicles) {
      const f = v.f, r = v.r;
      const dx = x[f] - x[r], dy = y[f] - y[r], d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1e-9) continue;
      const dl = -(d - v.base) / (w[f] + w[r]);
      const nx = dx / d, ny = dy / d;
      x[r] -= w[r] * dl * nx; y[r] -= w[r] * dl * ny;
      x[f] += w[f] * dl * nx; y[f] += w[f] * dl * ny;
    }
    // wheel contacts: roads, then ground
    for (const v of this.vehicles) {
      v.contact = false;
      // speed along the wheelbase (forward), from the last substep's velocities
      const bx = x[v.f] - x[v.r], by = y[v.f] - y[v.r], bl = Math.sqrt(bx * bx + by * by) || 1;
      v.speed = ((vx[v.f] + vx[v.r]) * bx + (vy[v.f] + vy[v.r]) * by) / (2 * bl);
      for (const wi of [v.f, v.r]) {
        if (!act[wi]) continue;
        for (let k = 0; k < this.roads.length; k++) {
          const mi = this.roads[k];
          if (!alive[mi]) continue;
          this.contact(v, wi, ma[mi], mb[mi], h);
        }
        const gr = this.level.ground;
        for (let k = 0; k < gr.length; k++) this.contactStatic(v, wi, gr[k], h);
      }
    }
    // velocities from positions
    const inv = 1 / h;
    for (let i = 0; i < n; i++) {
      if (!act[i]) continue;
      vx[i] = (x[i] - this.subX[i]) * inv; vy[i] = (y[i] - this.subY[i]) * inv;
    }
    // axial damping on every member
    const c = SIM.axialDamping * h < 1 ? SIM.axialDamping * h : 1;
    for (let i = 0; i < this.m; i++) {
      if (!alive[i] || this.slack[i]) continue;
      const a = ma[i], b = mb[i], ws = w[a] + w[b];
      if (ws === 0) continue;
      const nx = this.nx[i], ny = this.ny[i];
      const dv = (vx[b] - vx[a]) * nx + (vy[b] - vy[a]) * ny;
      const p = -c * dv / ws;
      vx[a] -= w[a] * p * nx; vy[a] -= w[a] * p * ny;
      vx[b] += w[b] * p * nx; vy[b] += w[b] * p * ny;
    }
    // clamp
    const vmax = SIM.maxSpeed, vmax2 = vmax * vmax;
    for (let i = 0; i < n; i++) {
      const s2 = vx[i] * vx[i] + vy[i] * vy[i];
      if (s2 > vmax2) { const k = vmax / Math.sqrt(s2); vx[i] *= k; vy[i] *= k; }
    }
  }

  // Wheel against a road member a–b (both may move).
  contact(v, wi, a, b, h) {
    const x = this.x, y = this.y, w = this.w, r = v.rad;
    const ax = x[a], ay = y[a], bx = x[b], by = y[b];
    const cx = x[wi], cy = y[wi];
    // cheap box reject
    if (cx + r < (ax < bx ? ax : bx) || cx - r > (ax > bx ? ax : bx) || cy + r < (ay < by ? ay : by) || cy - r > (ay > by ? ay : by)) return;
    const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
    if (l2 < 1e-12) return;
    let t = ((cx - ax) * ex + (cy - ay) * ey) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + ex * t, qy = ay + ey * t;
    let nx = cx - qx, ny = cy - qy;
    const d = Math.sqrt(nx * nx + ny * ny);
    if (d >= r || d < 1e-9) return;
    nx /= d; ny /= d;
    const wa = w[a] * (1 - t) * (1 - t), wb = w[b] * t * t, ww = w[wi];
    const W = ww + wa + wb;
    const ln = (r - d) / W;
    x[wi] += ww * ln * nx; y[wi] += ww * ln * ny;
    x[a] -= w[a] * (1 - t) * ln * nx; y[a] -= w[a] * (1 - t) * ln * ny;
    x[b] -= w[b] * t * ln * nx; y[b] -= w[b] * t * ln * ny;
    // friction and drive along the surface
    const sx = this.subX, sy = this.subY;
    let fx = -ny, fy = nx;                      // tangent, pointing forward (+x)
    if (fx < 0) { fx = -fx; fy = -fy; }
    const rel = (x[wi] - sx[wi]) - ((1 - t) * (x[a] - sx[a]) + t * (x[b] - sx[b]));
    const rely = (y[wi] - sy[wi]) - ((1 - t) * (y[a] - sy[a]) + t * (y[b] - sy[b]));
    // speed along the surface at the start of the substep, before gravity
    const vx = this.ux, vy = this.uy;
    const v0 = (vx[wi] - (1 - t) * vx[a] - t * vx[b]) * fx + (vy[wi] - (1 - t) * vy[a] - t * vy[b]) * fy;
    this.drive(v, wi, rel * fx + rely * fy, v0, fx, fy, ln, W, h, a, b, t);
  }

  // Wheel against a static ground segment [x1, y1, x2, y2].
  contactStatic(v, wi, s, h) {
    const x = this.x, y = this.y, r = v.rad;
    const cx = x[wi], cy = y[wi];
    const ax = s[0], ay = s[1], bx = s[2], by = s[3];
    if (cx + r < (ax < bx ? ax : bx) || cx - r > (ax > bx ? ax : bx) || cy + r < (ay < by ? ay : by) || cy - r > (ay > by ? ay : by)) return;
    const ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey;
    let t = ((cx - ax) * ex + (cy - ay) * ey) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    let nx = cx - (ax + ex * t), ny = cy - (ay + ey * t);
    const d = Math.sqrt(nx * nx + ny * ny);
    if (d >= r || d < 1e-9) return;
    nx /= d; ny /= d;
    const ww = this.w[wi];
    const ln = (r - d) / ww;
    x[wi] += ww * ln * nx; y[wi] += ww * ln * ny;
    let fx = -ny, fy = nx;
    if (fx < 0) { fx = -fx; fy = -fy; }
    const rel = (x[wi] - this.subX[wi]) * fx + (y[wi] - this.subY[wi]) * fy;
    const v0 = this.ux[wi] * fx + this.uy[wi] * fy;
    this.drive(v, wi, rel, v0, fx, fy, ln, ww, h, -1, -1, 0);
  }

  // Tangential correction: from the speed at the start of the substep, accelerate
  // towards cruise speed (or brake back to it), capped by friction (μ × normal)
  // and, when pushing forward, by the engine.
  drive(v, wi, rel, v0, fx, fy, ln, W, h, a, b, t) {
    v.contact = true;
    const cruise = v.spec.cruise;
    let target = v0 + DRIVE.accel * h;
    if (target > cruise) target = cruise;
    let lt = (target * h - rel) / W;
    const fric = DRIVE.mu * ln;
    if (lt > 0) { const cap = fric < v.engineCap ? fric : v.engineCap; if (lt > cap) lt = cap; }
    else if (lt < -fric) lt = -fric;
    const x = this.x, y = this.y, w = this.w;
    x[wi] += w[wi] * lt * fx; y[wi] += w[wi] * lt * fy;
    if (a >= 0) {
      x[a] -= w[a] * (1 - t) * lt * fx; y[a] -= w[a] * (1 - t) * lt * fy;
      x[b] -= w[b] * t * lt * fx; y[b] -= w[b] * t * lt * fy;
    }
  }

  afterStep() {
    const nM = this.m, inv = 1 / this.sub;
    const decided = this.result !== null;
    for (let i = 0; i < nM; i++) {
      if (!this.alive[i]) { this.stress[i] = 0; this.force[i] = 0; continue; }
      const f = this.fsum[i] * inv;
      this.force[i] = f;
      const lim = f >= 0 ? this.limT[i] : this.limC[i];
      const ratio = lim > 0 ? (f >= 0 ? f : -f) / lim : 0;
      this.stress[i] = ratio;
      if (ratio > this.mpeak[i]) { this.mpeak[i] = ratio; this.msign[i] = f >= 0 ? 1 : -1; }
      if (!decided && ratio > this.peak) this.peak = ratio;
      const a = this.ma[i], b = this.mb[i];
      const dx = this.x[b] - this.x[a], dy = this.y[b] - this.y[a];
      const stretched = dx * dx + dy * dy > this.rest[i] * this.rest[i] * SIM.breakStretch * SIM.breakStretch;
      if ((ratio > 1 || stretched) && !this.noBreak) this.breakMember(i, dx, dy);
    }
    // debris
    for (let i = 0; i < this.n; i++) {
      if (this.active[i] && this.y[i] > SIM.debrisY) { this.active[i] = 0; this.vx[i] = 0; this.vy[i] = 0; }
    }
    this.rules();
  }

  breakMember(i, dx, dy) {
    this.alive[i] = 0;
    this.brokeAt[i] = this.time;
    this.breakDir[i * 2] = dx; this.breakDir[i * 2 + 1] = dy;
    this.broken++;
    const first = this.firstBreak < 0;
    if (first) this.firstBreak = i;
    const a = this.ma[i], b = this.mb[i];
    this.events.push({ type: 'break', m: i, mat: MAT_NAMES[this.mat[i]], x: (this.x[a] + this.x[b]) / 2, y: (this.y[a] + this.y[b]) / 2, first, locked: this.result !== null });
  }

  rules() {
    const lv = this.level;
    let all = true;
    for (let k = 0; k < this.vehicles.length; k++) {
      const v = this.vehicles[k];
      const cx = (this.x[v.f] + this.x[v.r]) / 2, cy = (this.y[v.f] + this.y[v.r]) / 2;
      if (!v.passed && cx >= lv.flag) { v.passed = true; this.events.push({ type: 'flag', v: k }); }
      if (!v.passed) all = false;
      if (!v.fell && cy > lv.lowerTop + TEST.fallDepth) {
        v.fell = true;
        this.events.push({ type: 'splash', v: k, x: cx });
        if (!this.result) this.decide(false, 'fall');
      }
      if (cx > v.checkX + TEST.stuckDist) { v.checkX = cx; v.checkT = this.time; }
      if (!this.result && !v.passed && this.time - v.checkT >= TEST.stuckTime) this.decide(false, 'stuck');
    }
    if (!this.result && all && this.vehicles.length) this.decide(true, 'pass');
    if (!this.result && this.time >= TEST.timeout) this.decide(false, 'time');
  }

  decide(pass, reason) {
    this.result = { pass, reason, time: this.time, peak: this.peak, broken: this.broken, firstBreak: this.firstBreak };
    this.events.push({ type: pass ? 'pass' : 'fail', reason });
  }

  // Joint positions as a string: two runs must match exactly.
  snapshot() {
    let s = '';
    for (let i = 0; i < this.n; i++) s += this.x[i] + ',' + this.y[i] + ';';
    return s;
  }
}

// Run a whole test headless. Returns the result plus per-member peaks.
export function runBridge(level, members, opts = {}) {
  const sim = new Sim(level, members, opts);
  const extra = opts.after ?? 0;
  let until = Infinity;
  while (sim.time < TEST.timeout + 1) {
    sim.step();
    sim.events.length = 0;
    if (sim.result && until === Infinity) until = sim.time + extra;
    if (sim.time >= until) break;
  }
  return { ...sim.result, sim };
}

