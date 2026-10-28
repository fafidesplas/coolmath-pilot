// Screen flow (GDD 8), build mode (GDD 3.4), test flow (GDD 3.7), the HUD and
// toolbar, and the glue between bridge, sim, render, sound, saving and analytics.
// Frame loop, keyed canvas buttons and panels adapted from Ink Path.
import { VIEW_W, VIEW_H, TOP_H, BAR_H, FIELD_Y, FIELD_W, FIELD_H, CELL, STEP, MAX_FRAME_DT, MATERIALS, VEHICLES, BUILD, TEST, HINT_AFTER, COLORS as C } from './config.js';
import { parseLevel, starsFor } from './level.js';
import { Bridge, pairKey, pieceLen } from './bridge.js';
import { Sim, MAT_NAMES } from './sim.js';
import { Keys } from './input.js';
import { Sound } from './audio.js';
import { FX, drawStarShape } from './fx.js';
import { GA } from './analytics.js';
import { loadSave, storeSave, loadSettings, storeSettings } from './save.js';
import { rrect, text, money, renderBackground, renderGrid, drawMember, drawJoint, drawVehicle, drawBubble, drawStamp, drawHand, drawLock, drawHardHat, drawCrack, drawIcon, stressColor } from './render.js';
import { WORLDS, LEVELS, LEVELS_PER_WORLD, findLevel } from '../levels/index.js';
import demoLevel from '../levels/w1l04.js';

const easeOutBack = k => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
const METER = { x: 420, y: 10, w: 440, h: 24 };
const BAR_Y = VIEW_H - BAR_H;               // 624
const BTN_Y = BAR_Y + 8;
const FIELD_BOTTOM = BAR_Y;
const memberKey = m => pairKey(m.x1, m.y1, m.x2, m.y2) + ':' + m.mat;
const DEMO_BRIDGE = [[13, 7, 15, 7, 'road'], [15, 7, 17, 7, 'road'], [17, 7, 19, 7, 'road'], [13, 7, 14, 5, 'wood'], [14, 5, 15, 7, 'wood'], [15, 7, 16, 5, 'wood'],
  [16, 5, 17, 7, 'wood'], [17, 7, 18, 5, 'wood'], [18, 5, 19, 7, 'wood'], [14, 5, 16, 5, 'wood'], [16, 5, 18, 5, 'wood']];

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.params = new URLSearchParams(location.search);
    this.save = loadSave();
    this.settings = loadSettings();
    this.sound = new Sound();
    this.sound.setEnabled(this.settings.sfx);
    this.sound.musicOn = this.settings.music;
    this.fx = new FX();
    this.keys = new Keys((code, e) => this.onKey(code, e));

    this.screen = 'title';
    this.mode = 'build';         // build | test
    this.paused = false;
    this.level = null;
    this.lv = null;
    this.bridge = null;
    this.sim = null;
    this.acc = 0;
    this.t = 0;
    this.buttons = [];
    this.focus = -1;
    this.hover = null;
    this.pressed = null;
    this.mouse = { x: VIEW_W / 2, y: VIEW_H / 2 };
    this.pointer = null;
    this.touch = false;
    this.fixedHz = Number(this.params.get('hz')) || 0;
    this.pops = new Map();
    this.cam = { k: 1, x: FIELD_W / 2, y: FIELD_H / 2, tk: 1, tx: FIELD_W / 2, ty: FIELD_H / 2 };

    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(true); });
    this.bindPointer();
    this.makeDemo();

    const lvParam = this.params.get('level');
    if (lvParam && findLevel(lvParam)) this.startLevel(findLevel(lvParam));

    this.api = this.makeApi();
    this.last = performance.now();
    requestAnimationFrame(now => this.frame(now));
  }

  makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ---- Setup ---------------------------------------------------------------

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.scale = Math.min(w / VIEW_W, h / VIEW_H);
    this.ox = (w - VIEW_W * this.scale) / 2;
    this.oy = (h - VIEW_H * this.scale) / 2;
    this.dpr = dpr;
    this.layers = null;          // re-rendered lazily at the new pixel scale
    if (this.demo) this.demo.layer = null;
  }

  ensureLayers() {
    if (this.lv && !this.layers) {
      const ps = this.scale * this.dpr * 1.3;    // a little extra for the camera zoom
      this.layers = { bg: renderBackground(this.lv, ps, (w, h) => this.makeCanvas(w, h)), grid: renderGrid(this.lv, ps, (w, h) => this.makeCanvas(w, h)) };
    }
  }

  toView(e) { return { x: (e.clientX - this.ox) / this.scale, y: (e.clientY - this.oy) / this.scale }; }
  toCell(p) { return { x: p.x / CELL, y: (p.y - FIELD_Y) / CELL }; }
  inField(p) { return p.y >= FIELD_Y && p.y < FIELD_BOTTOM && p.x >= 0 && p.x <= VIEW_W; }

  // Buttons are rebuilt every frame, so they are matched by key, never by object.
  hitButton(p) {
    for (let i = this.buttons.length - 1; i >= 0; i--) {
      const b = this.buttons[i];
      if (!b.disabled && p.x >= b.x && p.x <= b.x + b.w && p.y >= (b.hy ?? b.y) && p.y <= (b.hy ?? b.y) + (b.hh ?? b.h)) return b;
    }
    return null;
  }

  bindPointer() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      this.sound.unlock();
      const p = this.toView(e);
      this.mouse = p;
      this.touch = e.pointerType === 'touch';
      if (this.pointer !== null) return;                     // only the first pointer builds
      this.pressed = this.hitButton(p);
      if (this.pressed) { try { cv.setPointerCapture(e.pointerId); } catch { /* ok */ } return; }
      if (this.screen !== 'playing' || this.paused) return;
      if (this.mode === 'test') { if (this.failInfo) this.failInfo.skip = true; return; }
      if (!this.inField(p)) return;                          // toolbar and top bar never draw beams
      this.pointer = e.pointerId;
      try { cv.setPointerCapture(e.pointerId); } catch { /* ok */ }
      this.buildDown(p);
    });
    cv.addEventListener('pointermove', e => {
      const p = this.toView(e);
      this.mouse = p;
      this.hover = this.hitButton(p);
      if (e.pointerId === this.pointer && this.erasing) this.eraseAlong(this.toCell(p));
      if (e.pointerId === this.pointer && this.drawing && this.drawing.mode === 'drag') {
        const d = this.drawing.press;
        if (Math.hypot(p.x - d.x, p.y - d.y) > BUILD.clickSlop) this.drawing.moved = true;
      }
      const c = this.hover ? 'pointer' : this.screen === 'playing' && this.mode === 'build' && this.inField(p) ? 'crosshair' : 'default';
      if (c !== this.cursor) { this.cursor = c; cv.style.cursor = c; }
    });
    const up = (e, cancel) => {
      const p = this.toView(e);
      if (e.pointerId === this.pointer) {
        this.pointer = null;
        this.mouse = p;
        if (cancel) { this.drawing = null; this.erasing = null; return; }
        this.buildUp(p);
        return;
      }
      const b = this.hitButton(p);
      if (!cancel && b && this.pressed && b.key === this.pressed.key) this.activate(b);
      this.pressed = null;
    };
    cv.addEventListener('pointerup', e => up(e, false));
    cv.addEventListener('pointercancel', e => up(e, true));
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => e.preventDefault(), { passive: false });
  }

  makeApi() {
    const g = this;
    return {
      get screen() { return g.screen; },
      get mode() { return g.mode; },
      get level() { return g.level ? g.level.id : null; },
      get score() { return g.bridge ? g.bridge.cost() : 0; },
      get bridge() { return g.bridge ? g.bridge.serialize() : []; },
      get paused() { return g.paused; },
      get tool() { return g.tool; },
      get result() { return g.sim && g.sim.result ? { ...g.sim.result } : null; },
      get results() { return g.results ? { ...g.results } : null; },
      get stressView() { return g.stressView; },
      get mark() { return g.mark; },
      get save() { return g.save; },
      get ga() { return GA.log; },
      get sim() { return g.sim; },
      start() { g.startLevel(g.nextLevel()); },
      restart() { if (g.screen === 'playing') g.startTest(); },
      // Debug only (removed in release): pass at once with the reference bridge.
      win() {
        if (g.screen !== 'playing') return;
        g.bridge.load(g.solution(), true);
        g.startTest();
        while (g.mode === 'test' && !(g.sim.result && g.sim.result.pass) && g.sim.time < TEST.timeout + 1) g.stepSim();
      },
      // Debug only: load a bridge ([[x1, y1, x2, y2, mat], ...] or its JSON).
      loadBridge(json) { if (g.bridge && g.mode === 'build') g.bridge.load(typeof json === 'string' ? JSON.parse(json) : json); },
    };
  }

  // The reference bridge for win(): the same members as levels/solutions (debug only).
  solution() {
    const id = this.level.id;
    if (id === 'w1l01') return [[14, 7, 16, 7, 'road'], [16, 7, 18, 7, 'road']];
    if (id === 'w1l02') return [[13, 7, 15, 7, 'road'], [15, 7, 17, 7, 'road'], [17, 7, 19, 7, 'road'], [13, 7, 15, 6, 'wood'], [15, 6, 17, 6, 'wood'], [17, 6, 19, 7, 'wood'], [15, 7, 15, 6, 'wood'], [17, 7, 17, 6, 'wood'], [15, 6, 17, 7, 'wood']];
    if (id === 'w1l03') return [[13, 7, 15, 7, 'road'], [15, 7, 17, 7, 'road'], [17, 7, 19, 7, 'road'], [13, 9, 15, 7, 'wood'], [19, 9, 17, 7, 'wood']];
    return DEMO_BRIDGE;
  }

  // ---- Levels -------------------------------------------------------------------

  levelPos(id) {
    for (let w = 0; w < WORLDS.length; w++) {
      const i = WORLDS[w].levels.findIndex(l => l.id === id);
      if (i >= 0) return { world: w + 1, level: i + 1 };
    }
    return { world: 1, level: 0 };
  }

  stars(id) { return this.save.stars[id] || 0; }
  nextLevel() { return LEVELS.find(l => !this.stars(l.id)) || LEVELS[LEVELS.length - 1]; }
  // GDD 7: any pass unlocks the next level.
  isOpen(level) { const i = LEVELS.indexOf(level); return i === 0 || this.stars(LEVELS[i - 1].id) > 0; }

  startLevel(level) {
    if (this.screen === 'playing' || this.screen === 'complete') this.endVisit();
    this.level = level;
    this.lv = parseLevel(level);
    this.layers = null;
    this.bridge = new Bridge(this.lv);
    const last = this.save.last[level.id];
    if (Array.isArray(last)) this.bridge.load(last, false);
    this.savedVersion = this.bridge.version;
    this.saveAt = 0;
    this.screen = 'playing';
    this.mode = 'build';
    this.paused = false;
    this.sim = null;
    this.tool = this.lv.materials[0];
    this.lastMat = this.tool;
    this.drawing = null;
    this.erasing = null;
    this.mirrorOn = false;
    this.stressView = false;
    this.lastTest = null;
    this.mark = null;
    this.prevFirst = null;
    this.hintOn = false;
    this.results = null;
    this.failInfo = null;
    this.toast = null;
    this.nudge = null;
    this.tip = null;
    this.focus = -1;
    this.buttons = [];
    this.fx.clear();
    this.introT = this.t;
    this.cam.k = this.cam.tk = 1;
    this.visit = { tests: 0, failed: 0, passed: false, afterPass: 0, cheapest: null, undo: 0, restarts: 0, stress: 0, ended: false };
    const p = this.levelPos(level.id);
    GA.progression('Start', p.world, p.level);
    this.sound.testing = false;
  }

  // Leaving a level: the per-visit events, once, with a value (GDD 11).
  endVisit() {
    const v = this.visit;
    if (!v || v.ended) return;
    v.ended = true;
    const p = this.levelPos(this.level.id);
    this.storeLast();
    if (v.passed) {
      GA.design('level:cost', v.cheapest);
      GA.design('level:optimize', v.afterPass);
    } else {
      GA.progression('Fail', p.world, p.level, v.tests);
      if (!this.stars(this.level.id)) GA.design('level:giveup', v.tests);
    }
    if (v.undo) GA.design('ui:undo', v.undo);
    if (v.restarts) GA.design('ui:restart', v.restarts);
    if (v.stress) GA.design('ui:stressview', v.stress);
  }

  storeLast() {
    if (!this.bridge) return;
    this.save.last[this.level.id] = this.bridge.serialize();
    this.savedVersion = this.bridge.version;
    storeSave(this.save);
  }

  toMenu(screen = 'title') {
    if (this.screen === 'playing' || this.screen === 'complete') this.endVisit();
    this.stopEngine();
    this.screen = screen;
    this.paused = false;
    this.sim = null;
    this.mode = 'build';
    this.focus = -1;
    this.drawing = null;
  }

  pause(on) {
    if (this.screen !== 'playing' || this.paused === on) return;
    this.paused = on;
    this.drawing = null;
    this.erasing = null;
    this.focus = on ? 0 : -1;
    if (on) this.sound.setEngine(false);
  }

  // ---- Build mode ------------------------------------------------------------------

  canBuild() { return this.screen === 'playing' && !this.paused && this.mode === 'build'; }

  buildDown(p) {
    const c = this.toCell(p);
    if (this.tool === 'eraser') { this.erasing = { any: false, last: c }; this.eraseAt(c); return; }
    if (this.drawing && this.drawing.mode === 'chain') { this.drawing.press = p; this.drawing.pressOn = true; return; }
    const j = this.bridge.jointAt(c.x, c.y, this.touch ? BUILD.pickTouch : BUILD.pickMouse);
    if (!j) { this.nudge = { t: this.t, x: p.x, y: p.y - FIELD_Y }; this.sound.play('invalid'); return; }
    this.drawing = { sx: j.x, sy: j.y, mode: 'drag', press: p, moved: false };
    this.fx.kick(`j${j.x},${j.y}`, 1.4, 1.4);
    this.sound.play('click');
  }

  buildUp(p) {
    if (this.erasing) { this.erasing = null; return; }
    const d = this.drawing;
    if (!d) return;
    if (d.mode === 'drag') {
      if (!d.moved && Math.hypot(p.x - d.press.x, p.y - d.press.y) <= BUILD.clickSlop) { d.mode = 'chain'; return; }   // picked up: click-click
      this.place();
      this.drawing = null;
      return;
    }
    if (!d.pressOn) return;
    d.pressOn = false;
    const g = this.ghost();
    if (g.ex === d.sx && g.ey === d.sy) { this.drawing = null; return; }      // clicked the start joint: stop chaining
    if (this.place()) { d.sx = g.ex; d.sy = g.ey; }
  }

  // The ghost: snapped end, plan and the mirrored plan (GDD 3.4).
  ghost() {
    const d = this.drawing;
    if (!d) return null;
    const c = this.toCell(this.mouse);
    const [ex, ey] = this.bridge.snapEnd(d.sx, d.sy, c.x, c.y, this.tool);
    const key = `${d.sx},${d.sy},${ex},${ey},${this.tool},${this.bridge.version},${this.mirrorOn}`;
    if (this.ghostCache && this.ghostCache.key === key) return this.ghostCache;
    const plan = this.bridge.plan(d.sx, d.sy, ex, ey, this.tool);
    let mplan = null;
    if (this.mirrorOn && this.lv.mirror) {
      const m = this.bridge.mirrorOf(d.sx, d.sy, ex, ey);
      if (pairKey(...m) !== pairKey(d.sx, d.sy, ex, ey)) mplan = this.bridge.plan(m[0], m[1], m[2], m[3], this.tool);
    }
    const delta = plan.ok ? plan.delta + (mplan && mplan.ok ? mplan.delta : 0) : 0;
    this.ghostCache = { key, ex, ey, plan, mplan, delta };
    return this.ghostCache;
  }

  place() {
    const g = this.ghost();
    if (!g) return false;
    if (!g.plan.ok) {
      if (g.plan.reason === 'Already built') return true;
      if (g.plan.reason !== 'none') { this.sound.play('invalid'); this.wiggleT = this.t; }
      return false;
    }
    const before = this.bridge.cost();
    this.bridge.apply([g.plan, g.mplan]);
    const pieces = [...g.plan.pieces, ...(g.mplan && g.mplan.ok ? g.mplan.pieces : [])];
    let len = 0;
    for (const q of pieces) {
      this.pops.set(memberKey(q), this.t);
      len = Math.max(len, pieceLen(q.x1, q.y1, q.x2, q.y2));
      for (const [x, y] of [[q.x1, q.y1], [q.x2, q.y2]]) {
        this.fx.kick(`j${x},${y}`, 1.35, 1.35);
        if (this.bridge.anchors.has(`${x},${y}`)) this.fx.dust(x * CELL, y * CELL + FIELD_Y, 4);
      }
    }
    this.sound.play('place:' + this.tool, { k: Math.min(1, len / 4) });
    this.meterBump(before, this.bridge.cost());
    if (!this.save.tut.s1) { this.save.tut.s1 = 1; storeSave(this.save); GA.design('tutorial:step01'); }
    if (this.tool === 'wood' && !this.save.tut.s4) { this.save.tut.s4 = 1; storeSave(this.save); GA.design('tutorial:step04'); }
    if (this.tip && this.tip.until === 'place') this.tip = null;
    return true;
  }

  meterBump(before, after) {
    this.fx.kick('meter', 1.06, 1.18);
    const lv = this.lv;
    for (const line of [lv.target, lv.budget]) if ((before <= line) !== (after <= line)) this.meterFlash = this.t;
  }

  eraseAt(c) {
    const b = this.bridge;
    let idx = [];
    const j = b.jointAt(c.x, c.y, 0.4);
    if (j && !j.anchor) idx = b.membersOfJoint(j.x, j.y);
    else { const i = b.memberAt(c.x, c.y); if (i >= 0) idx = [i]; }
    if (!idx.length) return;
    if (this.mirrorOn && this.lv.mirror) {
      for (const i of idx.slice()) {
        const m = b.members[i], q = b.mirrorOf(m.x1, m.y1, m.x2, m.y2);
        const k = b.findPair(...q);
        if (k >= 0) idx.push(k);
      }
    }
    const before = b.cost();
    const removed = b.erase(idx, !this.erasing || !this.erasing.any);
    if (!removed.length) return;
    if (this.erasing) this.erasing.any = true;
    for (const m of removed) this.fx.burst((m.x1 + m.x2) / 2 * CELL, (m.y1 + m.y2) / 2 * CELL + FIELD_Y, 8, m.mat === 'wood' ? C.wood : m.mat === 'steel' ? C.steel : C.ink, 160, 'confetti', 0.4, 4, 500);
    this.sound.play('erase');
    this.meterBump(before, b.cost());
  }

  eraseAlong(c) {
    const e = this.erasing, dx = c.x - e.last.x, dy = c.y - e.last.y, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.15));
    for (let k = 1; k <= n; k++) {
      const x = e.last.x + dx * k / n, y = e.last.y + dy * k / n;
      const i = this.bridge.memberAt(x, y);
      if (i >= 0) this.eraseAt({ x, y });
    }
    e.last = c;
  }

  selectTool(name) {
    if (!this.canBuild()) return;
    if (name !== 'eraser' && !this.lv.materials.includes(name)) return;
    this.drawing = null;
    this.tool = name;
    if (name !== 'eraser') this.lastMat = name;
    if (name === 'eraser' && !this.save.tut.eraser) { this.save.tut.eraser = 1; storeSave(this.save); this.tip = { label: 'Tap pieces to remove them.', t: this.t, until: 'time' }; }
  }

  undo() { if (this.canBuild() && this.bridge.undo()) { this.visit.undo++; this.drawing = null; this.sound.play('undo'); } }
  redo() { if (this.canBuild() && this.bridge.redo()) { this.drawing = null; this.sound.play('undo'); } }

  clearBridge() {
    if (!this.canBuild() && !(this.paused && this.mode === 'build')) return;
    if (this.bridge.clear()) {
      this.drawing = null;
      this.sound.play('clear');
      this.toast = { label: 'Cleared · Undo (Z)', t: this.t };
      GA.design('ui:clear');
    }
  }

  toggleMirror() {
    if (!this.canBuild() || !this.lv.mirror) return;
    this.mirrorOn = !this.mirrorOn;
    if (this.mirrorOn) GA.design('ui:mirror:on');
  }

  toggleStress() {
    if (!this.canBuild() || !this.lastTest) return;
    this.stressView = !this.stressView;
    if (this.stressView) this.openedStress();
  }

  openedStress() {
    this.visit.stress++;
    if (!this.save.tut.s5) { this.save.tut.s5 = 1; storeSave(this.save); GA.design('tutorial:step05'); }
  }

  hintReady() { return this.screen === 'playing' && !this.hintOn && this.visit.failed >= HINT_AFTER; }
  showHint() { if (!this.hintReady()) return; this.hintOn = true; GA.design('ui:hint'); }

  loadBest() {
    const b = this.save.best[this.level.id];
    if (!b || this.mode !== 'build') return;
    this.bridge.load(b.members);
    GA.design('ui:best');
    this.pause(false);
  }

  // ---- Test mode -------------------------------------------------------------------

  startTest(replay = false) {
    if (this.screen !== 'playing') this.screen = 'playing';
    if (this.mode === 'test') this.captureTest();
    this.drawing = null;
    this.erasing = null;
    this.paused = false;
    this.storeLast();
    this.sim = new Sim(this.lv, this.bridge.simMembers());
    this.simKeys = this.bridge.members.map(memberKey);
    this.simCost = this.bridge.cost();
    this.mode = 'test';
    this.acc = 0;
    this.slowT = 0;
    this.firstKey = null;
    this.failInfo = null;
    this.passInfo = null;
    this.replaying = replay;
    this.cam.tk = 1; this.cam.tx = FIELD_W / 2; this.cam.ty = FIELD_H / 2;
    this.spin = 0;
    if (!replay) {
      this.visit.tests++;
      if (this.visit.passed) this.visit.afterPass++;
      if (!this.save.tut.s2) { this.save.tut.s2 = 1; storeSave(this.save); GA.design('tutorial:step02'); }
    }
    this.sound.play('honk2');
    this.sound.testing = true;
    for (let k = 0; k < this.sim.vehicles.length; k++) this.fx.kick(`v${k}`, 0.9, 1.15);
    if (this.tip && this.tip.until === 'test') this.tip = null;
  }

  // Back to build mode with the bridge exactly as built.
  stopTest() {
    if (this.mode !== 'test') return;
    this.captureTest();
    this.mode = 'build';
    this.sim = null;
    this.failInfo = null;
    this.stopEngine();
    this.cam.k = this.cam.tk = 1;
  }

  restartTest() {
    if (this.mode === 'test') this.visit.restarts++;
    this.startTest(this.replaying);
  }

  fixIt() {
    const failed = this.failInfo;
    this.stopTest();
    if (failed) {
      this.stressView = true;
      this.openedStress();
      if (this.lv.tutorial === 'triangles' && !this.save.tut.l2) {
        this.save.tut.l2 = 1; storeSave(this.save);
        this.tip = { label: 'Snap! Make triangles with wood', t: this.t, until: 'place', hand: [[13, 7], [15, 6]] };
        this.tool = 'wood'; this.lastMat = 'wood';
      }
    }
  }

  stopEngine() { this.sound.setEngine(false); this.sound.testing = false; this.sound.tension = 0; }

  // The last test, for the stress view: peak, sign and broken state per member.
  captureTest() {
    const s = this.sim;
    if (!s || this.replaying) return;
    const map = new Map();
    for (let i = 0; i < s.m; i++) map.set(this.simKeys[i], { peak: s.mpeak[i], sign: s.msign[i], broken: !s.alive[i], slack: s.mat[i] === 3 && s.slack[i] === 1 });
    this.lastTest = map;
    if (s.firstBreak >= 0) this.prevFirst = this.simKeys[s.firstBreak];
  }

  stepSim() {
    this.sim.step();
    this.handleEvents();
  }

  handleEvents() {
    const s = this.sim, fx = this.fx, snd = this.sound;
    for (const e of s.events) {
      switch (e.type) {
        case 'break': {
          const x = e.x * CELL, y = e.y * CELL + FIELD_Y;
          if (e.mat === 'wood') fx.burst(x, y, 14, C.wood, 260, 'confetti', 0.7, 4, 700);
          else if (e.mat === 'steel') fx.burst(x, y, 14, C.yellow, 380, 'spark', 0.4, 3, 300);
          else if (e.mat === 'cable') fx.burst(x, y, 8, C.ink, 300, 'spark', 0.3, 2, 200);
          else fx.burst(x, y, 12, C.ink, 220, 'piece', 0.7, 4, 800);
          fx.dust(x, y, 6);
          fx.shake(4, 0.15);
          snd.play('snap:' + e.mat);
          if (e.first && !e.locked) {
            this.firstKey = this.simKeys[e.m];
            if (this.firstKey !== this.prevFirst) {   // slow motion only when the weak spot is new (GDD 3.7)
              this.slowT = TEST.slowmoTime;
              const v = s.vehicles[0];
              this.cam.tk = 1.3;
              this.cam.tx = (e.x * CELL + (s.x[v.f] + s.x[v.r]) * CELL / 2) / 2;
              this.cam.ty = (e.y * CELL + (s.y[v.f] + s.y[v.r]) * CELL / 2) / 2;
            }
          }
          break;
        }
        case 'splash': {
          const x = e.x * CELL, wet = this.lv.water !== null, y = (wet ? this.lv.water : this.lv.lowerTop + 3) * CELL + FIELD_Y;
          fx.burst(x, y, 30, wet ? '#fff' : 'rgba(168,110,63,0.8)', 420, 'dot', 0.9, 6, 900);
          fx.burst(x, y, 16, C.blue, 300, 'dot', 0.8, 5, 900);
          fx.shake(8, 0.25);
          snd.play(wet ? 'splash' : 'crash');
          break;
        }
        case 'flag': snd.play('honk'); break;
        case 'pass': this.onPass(); break;
        case 'fail': this.onFail(e.reason); break;
      }
    }
    s.events.length = 0;
  }

  onPass() {
    const s = this.sim, cost = this.simCost, lv = this.lv, id = this.level.id;
    const r = s.result;
    const stamp = r.broken > 0 ? 'HELD TOGETHER!' : r.peak >= TEST.closeCall ? 'CLOSE CALL!' : 'MADE IT!';
    this.passInfo = { t: this.t };
    this.sound.play('pass');
    this.sound.play('fanfare');
    if (stamp === 'CLOSE CALL!') this.sound.play('phew');
    const v = s.vehicles[0];
    this.cam.tk = 1.15; this.cam.tx = lv.flag * CELL; this.cam.ty = (s.y[v.f] - 1) * CELL;
    if (this.replaying) { this.results = { ...this.results, replay: true }; return; }
    const stars = starsFor(cost, lv);
    const oldStars = this.stars(id);
    const oldBest = this.save.best[id];
    const newBest = !oldBest || cost < oldBest.cost;
    const hat = cost <= lv.reference;
    const firstHat = hat && !this.save.hats[id];
    // saving
    this.save.stars[id] = Math.max(oldStars, stars);
    if (newBest) this.save.best[id] = { cost, members: this.bridge.serialize() };
    if (hat) this.save.hats[id] = 1;
    this.save.last[id] = this.bridge.serialize();
    storeSave(this.save);
    // analytics (GDD 11)
    const p = this.levelPos(id);
    GA.design('test:pass', cost);
    if (!this.visit.passed) {
      this.visit.passed = true;
      GA.progression('Complete', p.world, p.level, stars);
      GA.design('level:tests_to_pass', this.visit.tests);
      const meters = this.bridge.meters();
      for (const m of Object.keys(meters)) GA.design(`material:${m}:used`, Math.round(meters[m]));
    }
    this.visit.cheapest = this.visit.cheapest === null ? cost : Math.min(this.visit.cheapest, cost);
    if (oldStars && stars > oldStars) GA.design('level:stars_up', stars);
    if (firstHat) GA.design('badge:engineer', cost);
    this.results = { stars, cost, stamp, newBest: newBest && !!oldBest, best: this.save.best[id].cost, hat, firstHat, savedStars: this.save.stars[id], peak: r.peak, broken: r.broken, shownAt: 0 };
  }

  onFail(reason) {
    const s = this.sim;
    const label = reason === 'fall' ? (this.lv.water !== null ? 'SPLASH!' : 'CRASH!') : reason === 'stuck' ? 'STUCK!' : reason === 'boat' ? 'BONK!' : 'TOO SLOW';
    this.failInfo = { reason, label, t: this.t, skip: false };
    this.sound.play('wahwah');
    if (this.replaying) return;
    this.visit.failed++;
    GA.design(`test:fail:${reason}`, this.simCost);
    if (!this.save.tut.s3) { this.save.tut.s3 = 1; storeSave(this.save); GA.design('tutorial:step03'); }
    this.mark = s.firstBreak >= 0 ? this.simKeys[s.firstBreak] : null;
  }

  // ---- Input ------------------------------------------------------------------

  onKey(code, e = {}) {
    this.sound.unlock();
    if (this.screen === 'playing' && !this.paused) {
      if (this.mode === 'build') {
        const mat = ['road', 'wood', 'steel', 'cable'][['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(code)];
        if (mat) { this.selectTool(mat); return; }
        switch (code) {
          case 'KeyE': this.selectTool(this.tool === 'eraser' ? this.lastMat : 'eraser'); return;
          case 'KeyZ': if (e.shiftKey) this.redo(); else this.undo(); return;
          case 'KeyY': this.redo(); return;
          case 'KeyM': this.toggleMirror(); return;
          case 'KeyS': this.toggleStress(); return;
          case 'KeyH': this.showHint(); return;
          case 'KeyF': this.toggleFast(); return;
          case 'Space': case 'Enter': case 'KeyR': this.startTest(); return;
          case 'Escape': if (this.drawing) { this.drawing = null; return; } this.pause(true); return;
          case 'KeyP': this.pause(true); return;
        }
        return;
      }
      // test mode
      const waiting = this.failInfo && !this.bannerUp();
      if (code === 'Space' || code === 'Enter') { if (this.failInfo) this.fixIt(); else if (!this.passInfo) this.stopTest(); return; }
      if (code === 'KeyR') { this.restartTest(); return; }
      if (code === 'KeyF') { this.toggleFast(); return; }
      if (code === 'KeyP' || code === 'Escape') { this.pause(true); return; }
      if (waiting) this.failInfo.skip = true;
      return;
    }
    if (this.screen === 'playing' && this.paused && (code === 'KeyP' || code === 'Escape')) { this.pause(false); return; }
    if (this.screen === 'complete' && (code === 'Enter' || code === 'Space') && this.focus < 0) { this.goNext(); return; }
    if (this.screen === 'complete' && code === 'KeyR') { this.screen = 'playing'; this.startTest(true); return; }

    const list = this.buttons.filter(b => !b.disabled && !b.hud);
    if (!list.length) return;
    const i = list.indexOf(this.buttons[this.focus]);
    const move = d => { const n = list[(Math.max(i, 0) + d + list.length) % list.length]; this.focus = this.buttons.indexOf(n); this.sound.play('click'); };
    if (code === 'ArrowRight' || code === 'ArrowDown' || code === 'KeyD' || code === 'KeyS') move(i < 0 ? 0 : 1);
    else if (code === 'ArrowLeft' || code === 'ArrowUp' || code === 'KeyA' || code === 'KeyW') move(i < 0 ? 0 : -1);
    else if (code === 'Enter' || code === 'Space') {
      const b = this.buttons[this.focus] || list.find(q => q.isDefault) || list[0];
      this.activate(b);
    } else if (code === 'Escape' && this.screen === 'levels') this.toMenu('title');
  }

  activate(b) {
    this.sound.unlock();
    this.sound.play('click');
    b.action();
  }

  goNext() {
    const i = LEVELS.indexOf(this.level), next = LEVELS[i + 1];
    if (next) this.startLevel(next); else this.toMenu('levels');
  }

  toggleFast() {
    this.settings.fast = !this.settings.fast;
    storeSettings(this.settings);
    if (this.settings.fast) GA.design('ui:fast:on');
  }

  toggleMusic() {
    this.settings.music = !this.settings.music;
    this.sound.setMusic(this.settings.music);
    storeSettings(this.settings);
    if (!this.settings.music) GA.design('settings:music:off');
  }

  toggleSfx() {
    this.settings.sfx = !this.settings.sfx;
    this.sound.setEnabled(this.settings.sfx);
    storeSettings(this.settings);
    if (!this.settings.sfx) GA.design('settings:sfx:off');
  }

  bannerUp() { const f = this.failInfo; return f && (f.skip || this.t - f.t >= TEST.stampDelay + TEST.stampShow); }

  // ---- Frame ------------------------------------------------------------------

  frame(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (this.fixedHz) dt = 1 / this.fixedHz;
    dt = Math.min(Math.max(dt, 0), MAX_FRAME_DT);
    this.t += dt;
    if (this.screen === 'playing' && !this.paused) this.update(dt);
    if (this.screen === 'title') this.updateDemo(dt);
    this.fx.update(dt);
    const ck = Math.min(1, dt * 6);
    const c = this.cam;
    c.k += (c.tk - c.k) * ck; c.x += (c.tx - c.x) * ck; c.y += (c.ty - c.y) * ck;
    this.draw();
    requestAnimationFrame(n => this.frame(n));
  }

  update(dt) {
    if (this.mode === 'build') {
      if (this.bridge.version !== this.savedVersion) {
        if (!this.saveAt) this.saveAt = this.t + BUILD.autosave;
        if (this.t >= this.saveAt) { this.storeLast(); this.saveAt = 0; }
      }
      return;
    }
    const s = this.sim;
    const fast = this.settings.fast ? TEST.fast : 1;
    let speed = fast;
    if (this.slowT > 0) {
      speed *= TEST.slowmo;
      this.slowT -= dt * fast;
      if (this.slowT <= 0 && !this.passInfo) this.cam.tk = 1;
    }
    this.acc += dt * speed;
    let n = 0;
    while (this.acc >= STEP && n < 12) { this.stepSim(); this.acc -= STEP; n++; }
    if (n === 12) this.acc = 0;
    // engine, creaks and the snare roll follow the bridge
    let top = 0;
    for (let i = 0; i < s.m; i++) if (s.alive[i] && s.stress[i] > top) top = s.stress[i];
    this.sound.tension = top;
    const v = s.vehicles[0];
    this.sound.setEngine(!this.failInfo, v ? Math.min(1, Math.abs(v.speed) / 5) : 0);
    if (top > 0.5 && this.fx.rnd() < (top - 0.4) * dt * 12) this.sound.play('creak', { k: Math.min(1, top) });
    if (v) this.spin += v.speed * dt * speed / v.rad;
    // results 1.5 s after the pass
    if (this.passInfo && s.time >= s.result.time + TEST.afterPass && this.screen === 'playing') {
      this.screen = 'complete';
      this.captureTest();
      this.stopEngine();
      this.focus = -1;
      if (this.results) this.results.shownAt = 0;
    }
  }

  // Title demo: the real simulation with the level 4 reference bridge.
  makeDemo() {
    const lv = parseLevel(demoLevel);
    this.demo = { lv, sim: new Sim(lv, DEMO_BRIDGE), acc: 0, layer: null, keys: DEMO_BRIDGE };
  }

  updateDemo(dt) {
    const d = this.demo;
    d.acc += dt;
    while (d.acc >= STEP) {
      d.sim.step(); d.sim.events.length = 0; d.acc -= STEP;
      if (d.sim.result && d.sim.time > d.sim.result.time + 2.5) d.sim = new Sim(d.lv, DEMO_BRIDGE);
    }
  }

  // ---- Drawing ---------------------------------------------------------------

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.ox, this.dpr * this.oy);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, VIEW_W, VIEW_H); ctx.clip();

    this.buttons = [];
    if (this.screen === 'title') this.drawTitle();
    else if (this.screen === 'levels') this.drawLevels();
    else if (this.lv) {
      this.drawField();
      this.drawTopBar();
      this.drawToolbar();
      const [sx, sy] = this.fx.offset();
      ctx.save(); ctx.translate(sx, sy); this.fx.draw(ctx); ctx.restore();
      if (this.mode === 'test' && this.failInfo && this.screen === 'playing') this.drawFail();
      if (this.paused) this.drawPause();
      if (this.screen === 'complete') this.drawComplete();
    }
    ctx.restore();
  }

  addButton(b) {
    b.key = b.key || b.label;
    this.buttons.push(b);
    const ctx = this.ctx;
    const idx = this.buttons.length - 1;
    const hot = this.hover && this.hover.key === b.key;
    const focused = this.focus === idx;
    const down = this.pressed && this.pressed.key === b.key;
    const lift = b.disabled ? 0 : down ? 2 : hot || focused ? -3 : 0;
    const r = b.r ?? 16;
    const sq = b.squash ? this.fx.sq(b.squash) : null;
    ctx.save();
    ctx.translate(0, lift);
    if (sq || b.pulse) {
      const k = b.pulse ? 1 + Math.abs(Math.sin(this.t * 5)) * 0.06 : 1;
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale((sq ? sq.sx : 1) * k, (sq ? sq.sy : 1) * k); ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
    }
    rrect(ctx, b.x, b.y + 5, b.w, b.h, r); ctx.fillStyle = C.ink; ctx.fill();
    rrect(ctx, b.x, b.y, b.w, b.h, r);
    ctx.fillStyle = b.disabled ? '#DDD6CA' : b.active ? '#FFE08A' : (b.color || '#fff'); ctx.fill();
    ctx.lineWidth = b.active ? 4 : 3; ctx.strokeStyle = C.ink; ctx.stroke();
    if (focused || hot) { ctx.lineWidth = 3; ctx.strokeStyle = C.blue; rrect(ctx, b.x - 5, b.y - 5, b.w + 10, b.h + 10, r + 5); ctx.stroke(); }
    if (b.draw) { ctx.globalAlpha = b.disabled ? 0.35 : 1; b.draw(ctx, b); ctx.globalAlpha = 1; }
    else text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.size || 26, b.disabled ? '#9A948A' : (b.textColor || C.ink), 'center', 900);
    ctx.restore();
    return b;
  }

  settingsButtons(x, y, w = 200) {
    this.addButton({ key: 'sound', x, y, w, h: 52, size: 20, label: this.settings.sfx ? 'SOUND: ON' : 'SOUND: OFF', action: () => this.toggleSfx() });
    this.addButton({ key: 'music', x: x + w + 16, y, w, h: 52, size: 20, label: this.settings.music ? 'MUSIC: ON' : 'MUSIC: OFF', action: () => this.toggleMusic() });
  }

  drawTitle() {
    const ctx = this.ctx, t = this.t, d = this.demo;
    ctx.fillStyle = C.cream; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // live demo window
    if (!d.layer) d.layer = renderBackground(d.lv, this.scale * this.dpr * 0.6, (w, h) => this.makeCanvas(w, h));
    ctx.save();
    ctx.translate(VIEW_W / 2 - 384, 150);
    rrect(ctx, -8, -8, 784, 352, 18); ctx.fillStyle = C.ink; ctx.fill();
    ctx.beginPath(); ctx.rect(0, 0, 768, 336); ctx.clip();
    ctx.scale(0.6, 0.6);
    ctx.drawImage(d.layer, 0, 0, FIELD_W, FIELD_H);
    this.drawSimWorld(ctx, d.sim, d.lv, Math.min(1, d.acc / STEP), d.keys.map(m => pairKey(m[0], m[1], m[2], m[3]) + ':' + m[4]), t);
    ctx.restore();
    // logo
    ctx.save(); ctx.translate(VIEW_W / 2, 78 + Math.sin(t * 2) * 3); ctx.rotate(-0.02);
    text(ctx, 'BRIDGE BUDGET', 0, 0, 92, C.yellow, 'center', 900, 16);
    ctx.restore();
    drawMember(ctx, 'wood', VIEW_W / 2 - 330, 128, VIEW_W / 2 + 330, 128);
    this.addButton({ key: 'play', x: VIEW_W / 2 - 170, y: 512, w: 340, h: 88, label: 'PLAY', size: 46, color: C.green, textColor: '#fff', isDefault: true,
      action: () => this.startLevel(this.nextLevel()) });
    this.addButton({ key: 'levels', x: VIEW_W / 2 - 448, y: 628, w: 200, h: 52, label: 'LEVELS', size: 22, action: () => { this.screen = 'levels'; this.focus = -1; } });
    this.settingsButtons(VIEW_W / 2 - 232, 628, 200);
    text(ctx, 'Build it. Test it. Make it cheaper.', VIEW_W / 2 + 330, 700, 16, C.grey, 'center', 700);
  }

  drawLevels() {
    const ctx = this.ctx, t = this.t;
    ctx.fillStyle = C.cream; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.addButton({ key: 'back', x: 30, y: 24, w: 150, h: 58, label: '‹ BACK', size: 22, action: () => this.toMenu('title') });
    WORLDS.forEach((w, i) => {
      const x = 280 + i * 250, open = w.levels.length > 0;
      rrect(ctx, x, 30, 230, 50, 12);
      ctx.fillStyle = open ? C.blue : '#DDD6CA'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
      text(ctx, `${i + 1} ${w.name.toUpperCase()}`, x + 115 - (open ? 0 : 14), 56, 22, open ? '#fff' : C.grey, 'center', 900);
      if (!open) drawLock(ctx, x + 204, 56, 0.6);
    });
    const next = this.nextLevel();
    const world = WORLDS[0];
    for (let i = 0; i < LEVELS_PER_WORLD; i++) {
      const col = i % 5, row = Math.floor(i / 5);
      const x = 160 + col * 200, y = 140 + row * 260;
      const level = world.levels[i];
      const open = level && this.isOpen(level);
      if (!open) {
        rrect(ctx, x, y, 160, 200, 12); ctx.fillStyle = '#E8E1D4'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
        text(ctx, String(i + 1), x + 80, y + 60, 44, '#B9B1A3', 'center', 900);
        drawLock(ctx, x + 80, y + 130, 1);
        continue;
      }
      const id = level.id, st = this.stars(id), best = this.save.best[id];
      const isNext = level === next && !st;
      const bounce = isNext ? Math.abs(Math.sin(t * 4)) * -8 : 0;
      this.addButton({
        key: `level:${id}`, x, y: y + bounce, w: 160, h: 200, r: 12, color: isNext ? '#FFE08A' : '#fff', isDefault: isNext,
        action: () => this.startLevel(level),
        draw: (c, b) => {
          text(c, String(i + 1), b.x + 80, b.y + 46, 46, C.ink, 'center', 900);
          text(c, level.name, b.x + 80, b.y + 88, 17, C.ink, 'center', 800);
          for (let s = 0; s < 3; s++) drawStarShape(c, b.x + 44 + s * 36, b.y + 126, 14, st > s ? C.yellow : '#E3DDD0');
          if (best) text(c, money(best.cost), b.x + 80, b.y + 168, 18, C.ink, 'center', 800);
          if (this.save.hats[id]) drawHardHat(c, b.x + 136, b.y + 24, 0.8);
        },
      });
    }
    text(ctx, 'More levels in the full game', VIEW_W / 2, VIEW_H - 30, 18, C.grey, 'center', 700);
  }

  // ---- The playfield --------------------------------------------------------------

  drawField() {
    const ctx = this.ctx, t = this.t, lv = this.lv;
    this.ensureLayers();
    const [sx, sy] = this.fx.offset();
    ctx.save();
    ctx.beginPath(); ctx.rect(0, FIELD_Y, VIEW_W, FIELD_H); ctx.clip();
    ctx.translate(sx, FIELD_Y + sy);
    const c = this.cam;
    if (Math.abs(c.k - 1) > 0.001) { ctx.translate(c.x, c.y); ctx.scale(c.k, c.k); ctx.translate(-c.x, -c.y); }   // zoom about the focus point
    ctx.drawImage(this.layers.bg, 0, 0, FIELD_W, FIELD_H);
    if (this.mode === 'build') {
      ctx.drawImage(this.layers.grid, 0, 0, FIELD_W, FIELD_H);
      this.drawBuildWorld(ctx);
    } else if (this.sim) {
      this.drawSimWorld(ctx, this.sim, lv, Math.min(1, this.acc / STEP), this.simKeys, t);
    }
    ctx.restore();
    // tips and bubbles (screen space over the field)
    if (this.nudge && t - this.nudge.t < 1.2) drawBubble(ctx, Math.max(130, Math.min(VIEW_W - 130, this.nudge.x)), this.nudge.y + FIELD_Y - 30, 'Start from a joint', easeOutBack(Math.min(1, (t - this.nudge.t) / 0.15)));
    if (this.toast && t - this.toast.t < 2.5) drawBubble(ctx, VIEW_W / 2, FIELD_Y + 40, this.toast.label, 1);
    const tip = this.currentTip();
    if (tip && this.mode === 'build') drawBubble(ctx, VIEW_W / 2, FIELD_Y + 44, tip, 1, '#FFE08A');
  }

  currentTip() {
    const lv = this.lv;
    if (this.tip && (this.tip.until !== 'time' || this.t - this.tip.t < 3)) return this.tip.label;
    if (lv.tutorial === 'hand' && !this.bridge.members.length) return 'Drag road from bolt to bolt';
    if (lv.tutorial === 'hand' && this.bridge.members.length && !this.visit.tests) return 'Press TEST!';
    if (lv.tutorial === 'below' && !this.visit.tests && !this.bridge.members.some(m => m.y1 > 7 || m.y2 > 7)) return 'Push from below!';
    return null;
  }

  drawBuildWorld(ctx) {
    const lv = this.lv, b = this.bridge, t = this.t, px = CELL;
    // hint ghosts
    if (this.hintOn) for (const [x1, y1, x2, y2] of lv.hintMembers) drawMember(ctx, y1 === y2 && y1 === lv.leftTop ? 'road' : 'wood', x1 * px, y1 * px, x2 * px, y2 * px, { alpha: 0.4, dash: [8, 8] });
    // tutorial hand (level 1 until the first piece; level 2 after the first fail)
    const hand = lv.tutorial === 'hand' && !b.members.length ? [[14, 7], [16, 7]] : this.tip && this.tip.hand ? this.tip.hand : null;
    if (hand) {
      const k = (t * 0.6) % 1.4, e = Math.min(1, k);
      const [a, c] = hand;
      drawMember(ctx, lv.tutorial === 'hand' ? 'road' : 'wood', a[0] * px, a[1] * px, c[0] * px, c[1] * px, { alpha: 0.3, dash: [10, 8] });
      drawHand(ctx, (a[0] + (c[0] - a[0]) * e) * px, (a[1] + (c[1] - a[1]) * e) * px, k < 1 ? 1 : 0);
    }
    // members
    const sv = this.stressView && this.lastTest;
    for (const m of b.members) {
      const key = memberKey(m);
      const pop = this.pops.get(key);
      ctx.save();
      if (pop !== undefined && t - pop < 0.12) {
        const k = 1.1 - (t - pop) / 0.12 * 0.1, mx = (m.x1 + m.x2) / 2 * px, my = (m.y1 + m.y2) / 2 * px;
        ctx.translate(mx, my); ctx.scale(k, k); ctx.translate(-mx, -my);
      }
      const rec = sv ? this.lastTest.get(key) : null;
      drawMember(ctx, m.mat, m.x1 * px, m.y1 * px, m.x2 * px, m.y2 * px, rec ? { tint: stressColor(Math.min(1, rec.peak)), stress: null } : {});
      ctx.restore();
      if (rec) this.stressLabel(ctx, m, rec);
      if (m.mat === 'road' && Math.abs(m.y2 - m.y1) >= Math.abs(m.x2 - m.x1) * BUILD.steep) {
        text(ctx, '⚠ Steep!', (m.x1 + m.x2) / 2 * px + 30, (m.y1 + m.y2) / 2 * px, 16, C.red, 'left', 900, 4);
      }
    }
    // first break marker (until changed or erased)
    if (this.mark) {
      const m = b.members.find(q => memberKey(q) === this.mark);
      if (m) {
        const mx = (m.x1 + m.x2) / 2 * px, my = (m.y1 + m.y2) / 2 * px, bob = Math.abs(Math.sin(t * 5)) * 8;
        drawCrack(ctx, mx, my, 1);
        ctx.fillStyle = C.red; ctx.strokeStyle = C.ink; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(mx, my - 18 - bob); ctx.lineTo(mx - 12, my - 36 - bob); ctx.lineTo(mx - 5, my - 36 - bob); ctx.lineTo(mx - 5, my - 52 - bob); ctx.lineTo(mx + 5, my - 52 - bob); ctx.lineTo(mx + 5, my - 36 - bob); ctx.lineTo(mx + 12, my - 36 - bob); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else this.mark = null;
    }
    // joints
    const g = this.ghost();
    const nudge = this.nudge && t - this.nudge.t < 0.6 ? Math.sin((t - this.nudge.t) / 0.6 * Math.PI) : 0;
    const facePulse = this.currentTip() === 'Push from below!' ? Math.abs(Math.sin(t * 5)) : 0;
    for (const j of b.joints().values()) {
      const face = j.anchor && j.y > lv.leftTop;
      const sq = this.fx.sq(`j${j.x},${j.y}`);
      drawJoint(ctx, j.x * px, j.y * px, j.anchor, nudge + (face ? facePulse : 0) + (sq.sx - 1), face);
    }
    // the ghost
    if (g && this.canBuild()) this.drawGhost(ctx, g);
    // vehicles waiting on the bank
    let back = lv.startX;
    for (const name of lv.vehicles) {
      const v = VEHICLES[name], y = lv.startY - v.r;
      drawVehicle(ctx, name, back * px, y * px, (back - v.base) * px, y * px, { idle: true, t, tag: `${v.name} · ${v.tons} t` });
      back -= v.base + 2.5;
    }
  }

  stressLabel(ctx, m, rec) {
    const px = CELL, mx = (m.x1 + m.x2) / 2 * px, my = (m.y1 + m.y2) / 2 * px;
    if (rec.broken) { drawCrack(ctx, mx, my, 0.8); return; }
    if (rec.slack) { text(ctx, '~ slack', mx, my - 14, 14, C.ink, 'center', 800, 3); return; }
    if (rec.peak >= 0.5) {
      // pulled (arrows out) or squeezed (arrows in), drawn along the member
      const dx = m.x2 - m.x1, dy = m.y2 - m.y1, l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
      ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        const cx = mx + ux * s * 13, cy = my + uy * s * 13, d = rec.sign > 0 ? s : -s;
        ctx.beginPath(); ctx.moveTo(cx - ux * d * 4 - uy * 4, cy - uy * d * 4 + ux * 4); ctx.lineTo(cx + ux * d * 2, cy + uy * d * 2); ctx.lineTo(cx - ux * d * 4 + uy * 4, cy - uy * d * 4 - ux * 4); ctx.stroke();
      }
      ctx.restore();
    }
    if (rec.peak >= 0.75) text(ctx, `${Math.round(rec.peak * 100)}%`, mx, my - 18, 16, '#fff', 'center', 900, 4);
  }

  drawGhost(ctx, g) {
    const px = CELL, d = this.drawing, t = this.t;
    const mat = this.tool, max = MATERIALS[mat].max;
    // reach
    ctx.save(); ctx.setLineDash([6, 8]); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(43,43,43,0.4)';
    ctx.beginPath(); ctx.arc(d.sx * px, d.sy * px, max * px, 0, 7); ctx.stroke(); ctx.restore();
    const wig = this.wiggleT && t - this.wiggleT < 0.25 ? Math.sin((t - this.wiggleT) * 60) * 3 : 0;
    for (const p of [g.plan, g.mplan]) {
      if (!p || p.reason === 'none') continue;
      ctx.save(); ctx.translate(wig, 0);
      if (p.ok) {
        for (const q of p.pieces) drawMember(ctx, mat, q.x1 * px, q.y1 * px, q.x2 * px, q.y2 * px, { alpha: 0.6 });
        for (const [x, y] of p.rings) { ctx.beginPath(); ctx.arc(x * px, y * px, 13, 0, 7); ctx.lineWidth = 3; ctx.strokeStyle = C.green; ctx.stroke(); }
        ctx.beginPath(); ctx.arc(p.x2 * px, p.y2 * px, 10, 0, 7); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
      } else {
        drawMember(ctx, mat, p.x1 * px, p.y1 * px, p.x2 * px, p.y2 * px, { alpha: 0.7, invalid: true, dash: [8, 8] });
        const ex = p.x2 * px, ey = p.y2 * px;
        ctx.beginPath(); ctx.arc(ex, ey, 11, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.red; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ex - 7, ey + 7); ctx.lineTo(ex + 7, ey - 7); ctx.stroke();
      }
      ctx.restore();
    }
    // label near the pointer (64 px above a finger)
    const c = this.toCell(this.mouse);
    const lx = c.x * px + 20, ly = c.y * px - (this.touch ? 64 : 26);
    const label = g.plan.ok ? (g.mplan && g.mplan.ok ? `+$${g.delta} (×2)` : g.plan.label) : g.plan.reason === 'none' ? '' : g.plan.reason;
    if (label) {
      ctx.font = `900 20px system-ui, sans-serif`;
      const w = ctx.measureText(label).width + 18;
      rrect(ctx, lx - 4, ly - 15, w, 30, 9); ctx.fillStyle = g.plan.ok ? '#fff' : C.red; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.ink; ctx.stroke();
      text(ctx, label, lx + 5, ly + 1, 20, g.plan.ok ? C.ink : '#fff', 'left', 900);
    }
  }

  // Bridge, debris and vehicles from the simulation, interpolated between steps.
  drawSimWorld(ctx, s, lv, a, keys, t) {
    const px = CELL;
    const X = i => (s.prevX[i] + (s.x[i] - s.prevX[i]) * a) * px;
    const Y = i => (s.prevY[i] + (s.y[i] - s.prevY[i]) * a) * px;
    for (let i = 0; i < s.m; i++) {
      const A = s.ma[i], B = s.mb[i], mat = MAT_NAMES[s.mat[i]];
      if (s.alive[i]) {
        const st = s.stress[i];
        const sh = st >= 0.9 ? [(this.fx.rnd() - 0.5) * 2, (this.fx.rnd() - 0.5) * 2] : null;
        drawMember(ctx, mat, X(A), Y(A), X(B), Y(B), { stress: s.mat[i] === 3 && s.slack[i] ? 0 : st, shake: sh });
      } else {
        // two halves dangling from their joints (visual only)
        const dt = s.time - s.brokeAt[i], L = s.rest[i] * px / 2;
        const a0 = Math.atan2(s.breakDir[i * 2 + 1], s.breakDir[i * 2]);
        for (const [j, base] of [[A, a0], [B, a0 + Math.PI]]) {
          let diff = Math.PI / 2 - base; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          const ang = Math.PI / 2 - diff * Math.exp(-dt * 2.5) * Math.cos(dt * 7);
          drawMember(ctx, mat, X(j), Y(j), X(j) + Math.cos(ang) * L, Y(j) + Math.sin(ang) * L, {});
        }
      }
    }
    for (let j = 0; j < s.bridgeJoints; j++) drawJoint(ctx, X(j), Y(j), s.fixed[j], 0, s.fixed[j] && s.y[j] > lv.leftTop);
    s.vehicles.forEach((v, k) => {
      const cx = (s.x[v.f] + s.x[v.r]) / 2;
      let sweat = false;
      for (let i = 0; i < s.m && !sweat; i++) {
        if (!s.alive[i] || s.stress[i] < 0.8) continue;
        const mx = (s.x[s.ma[i]] + s.x[s.mb[i]]) / 2;
        if (Math.abs(mx - cx) < 2) sweat = true;
      }
      const falling = s.vy[v.f] > 3 || v.fell;
      const mood = v.passed ? 'grin' : falling ? 'fall' : sweat ? 'scared' : 'idle';
      const sq = this.fx.sq(`v${k}`);
      ctx.save();
      const mx = (X(v.f) + X(v.r)) / 2, my = (Y(v.f) + Y(v.r)) / 2;
      ctx.translate(mx, my); ctx.scale(sq.sx, sq.sy); ctx.translate(-mx, -my);
      drawVehicle(ctx, v.name, X(v.f), Y(v.f), X(v.r), Y(v.r), { mood, sweat, t, spin: this.spin || t * 6 });
      ctx.restore();
    });
  }

  // ---- HUD -------------------------------------------------------------------

  drawTopBar() {
    const ctx = this.ctx, lv = this.lv, t = this.t;
    ctx.fillStyle = C.cream; ctx.fillRect(0, 0, VIEW_W, TOP_H);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, TOP_H); ctx.lineTo(VIEW_W, TOP_H); ctx.stroke();
    const p = this.levelPos(this.level.id);
    text(ctx, `${p.world}-${p.level}  ${lv.name}`, 20, 32, 24, C.ink, 'left', 900);
    // cost meter
    const cost = this.mode === 'test' ? this.simCost : this.bridge.cost();
    const g = this.mode === 'build' && this.canBuild() ? this.ghost() : null;
    const preview = g && g.plan.ok ? cost + g.delta : null;
    const top = Math.max(lv.budget * 1.25, cost, preview || 0);
    const X = v => METER.x + METER.w * Math.min(1, v / top);
    const { x, y, w, h } = METER;
    const sq = this.fx.sq('meter');
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2); ctx.scale(sq.sx, sq.sy); ctx.translate(-(x + w / 2), -(y + h / 2));
    rrect(ctx, x, y, w, h, 10); ctx.fillStyle = '#fff'; ctx.fill();
    const over = cost > lv.budget;
    const flash = this.meterFlash && t - this.meterFlash < 0.3;
    if (cost > 0) { rrect(ctx, x, y, Math.max(20, X(cost) - x), h, 10); ctx.fillStyle = flash ? '#fff6c0' : over ? C.red : C.yellow; ctx.fill(); }
    if (preview !== null && preview !== cost) {
      const a = X(Math.min(cost, preview)), b2 = X(Math.max(cost, preview));
      ctx.save(); ctx.beginPath(); ctx.rect(a, y, b2 - a, h); ctx.clip();
      ctx.fillStyle = preview > cost ? 'rgba(255,201,60,0.5)' : 'rgba(239,91,91,0.4)'; ctx.fillRect(a, y, b2 - a, h);
      ctx.strokeStyle = 'rgba(43,43,43,0.45)'; ctx.lineWidth = 3;
      for (let k = a - h; k < b2; k += 9) { ctx.beginPath(); ctx.moveTo(k, y + h); ctx.lineTo(k + h, y); ctx.stroke(); }
      ctx.restore();
    }
    rrect(ctx, x, y, w, h, 10); ctx.lineWidth = 3; ctx.strokeStyle = C.ink; ctx.stroke();
    // star lines and the best flag
    for (const [v, n] of [[lv.target, 3], [lv.budget, 2]]) {
      const lx = X(v);
      ctx.fillStyle = C.ink; ctx.fillRect(lx - 1.5, y - 4, 3, h + 8);
      for (let k = 0; k < n; k++) drawStarShape(ctx, lx - (n - 1) * 6 + k * 12, y + h + 9, 6, C.yellow);
    }
    const best = this.save.best[this.level.id];
    if (best) {
      const bx = X(best.cost);
      ctx.fillStyle = C.ink; ctx.fillRect(bx - 1, y - 8, 2, 12);
      ctx.fillStyle = C.green; ctx.beginPath(); ctx.moveTo(bx + 1, y - 8); ctx.lineTo(bx + 12, y - 4); ctx.lineTo(bx + 1, y); ctx.fill();
    }
    ctx.restore();
    const label = over ? `⚠ ${money(cost)}  Over budget: 1 ★ max` : `${money(cost)} / budget ${money(lv.budget)}`;
    text(ctx, label, x + w + 14, y + h / 2 + 2, 18, over ? C.red : C.ink, 'left', 900);
    // vehicle card
    const v = VEHICLES[lv.vehicles[0]];
    text(ctx, `${v.name} · ${v.tons} t${lv.vehicles.length > 1 ? '  ×' + lv.vehicles.length : ''}`, VIEW_W - 20, 32, 22, C.ink, 'right', 900);
  }

  toolButton(key, x, opt) {
    return this.addButton({ key: 'tb:' + key, hud: true, x, y: BTN_Y, w: opt.w || 80, h: 80, hy: BAR_Y, hh: BAR_H, r: 14, ...opt });
  }

  drawToolbar() {
    const ctx = this.ctx, lv = this.lv;
    ctx.fillStyle = '#E7D3B0'; ctx.fillRect(0, BAR_Y, VIEW_W, BAR_H);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, BAR_Y); ctx.lineTo(VIEW_W, BAR_Y); ctx.stroke();
    if (this.screen !== 'playing' || this.paused) return;
    this.toolButton('pause', 8, { action: () => this.pause(true), draw: (c, b) => drawIcon(c, 'pause', b.x + 40, b.y + 40) });
    if (this.mode === 'build') {
      let x = 104;
      for (const m of lv.materials) {
        const mat = MATERIALS[m];
        this.toolButton(m, x, { active: this.tool === m, action: () => this.selectTool(m),
          draw: (c, b) => { drawIcon(c, m, b.x + 40, b.y + 30); text(c, `$${mat.cost}/m`, b.x + 40, b.y + 64, 15, C.ink, 'center', 800); text(c, String(mat.key), b.x + 70, b.y + 12, 13, C.grey, 'center', 900); } });
        x += 88;
      }
      x += 16;
      this.toolButton('eraser', x, { active: this.tool === 'eraser', action: () => this.selectTool(this.tool === 'eraser' ? this.lastMat : 'eraser'), draw: (c, b) => { drawIcon(c, 'eraser', b.x + 40, b.y + 34); text(c, 'E', b.x + 70, b.y + 12, 13, C.grey, 'center', 900); } });
      this.toolButton('undo', x + 88, { disabled: !this.bridge.undoStack.length, action: () => this.undo(), draw: (c, b) => { drawIcon(c, 'undo', b.x + 40, b.y + 34); text(c, 'Z', b.x + 70, b.y + 12, 13, C.grey, 'center', 900); } });
      this.toolButton('clear', x + 176, { disabled: !this.bridge.members.some(m => !m.locked), action: () => this.clearBridge(), draw: (c, b) => drawIcon(c, 'clear', b.x + 40, b.y + 38) });
      x += 264 + 16;
      if (lv.mirror) { this.toolButton('mirror', x, { active: this.mirrorOn, action: () => this.toggleMirror(), draw: (c, b) => { drawIcon(c, 'mirror', b.x + 40, b.y + 38); text(c, 'M', b.x + 70, b.y + 12, 13, C.grey, 'center', 900); } }); x += 88; }
      this.toolButton('stress', x, { active: this.stressView, disabled: !this.lastTest, action: () => this.toggleStress(), draw: (c, b) => { drawIcon(c, 'eye', b.x + 40, b.y + 38); text(c, 'S', b.x + 70, b.y + 12, 13, C.grey, 'center', 900); } });
      x += 88;
      if (this.hintReady()) this.toolButton('hint', x, { color: C.yellow, pulse: true, action: () => this.showHint(), draw: (c, b) => drawIcon(c, 'bulb', b.x + 40, b.y + 38) });
      const pulse = lv.tutorial === 'hand' && this.bridge.members.length > 0 && !this.visit.tests;
      this.toolButton('test', VIEW_W - 208, { w: 200, color: C.green, pulse, action: () => this.startTest(),
        draw: (c, b) => text(c, 'TEST ▶', b.x + 100, b.y + 42, 34, '#fff', 'center', 900, 6) });
      if (this.hintOn) text(ctx, '💡 ' + lv.hint, VIEW_W / 2, FIELD_Y + 90, 20, C.ink, 'center', 900);
    } else {
      this.toolButton('restart', VIEW_W - 384, { action: () => this.restartTest(), draw: (c, b) => { drawIcon(c, 'restart', b.x + 40, b.y + 34); text(c, 'R', b.x + 70, b.y + 12, 13, C.grey, 'center', 900); } });
      this.toolButton('fast', VIEW_W - 296, { active: this.settings.fast, action: () => this.toggleFast(), draw: (c, b) => { drawIcon(c, 'fast', b.x + 40, b.y + 34); text(c, '2×', b.x + 40, b.y + 64, 15, C.ink, 'center', 900); } });
      if (!this.passInfo) this.toolButton('stop', VIEW_W - 208, { w: 200, color: C.red, action: () => this.failInfo ? this.fixIt() : this.stopTest(),
        draw: (c, b) => text(c, this.failInfo ? 'FIX IT' : 'STOP ■', b.x + 100, b.y + 42, 34, '#fff', 'center', 900, 6) });
      text(ctx, this.replaying ? 'Replay' : `Test ${this.visit.tests}`, 120, BAR_Y + 48, 22, C.ink, 'left', 900);
    }
  }

  drawFail() {
    const ctx = this.ctx, f = this.failInfo, e = this.t - f.t;
    if (e < TEST.stampDelay && !f.skip) return;
    if (!f.stampT) { f.stampT = this.t; this.sound.play('stamp'); this.fx.shake(5, 0.12); }
    const k = Math.min(1, (this.t - f.stampT) / 0.18);
    drawStamp(ctx, f.label, VIEW_W / 2, FIELD_Y + 150, 1.8 - 0.8 * k, C.red);
    if (!this.bannerUp()) return;
    const y = FIELD_Y + 250;
    this.addButton({ key: 'f:fix', x: VIEW_W / 2 - 250, y, w: 240, h: 66, label: 'FIX IT (Space)', size: 22, color: C.yellow, isDefault: true, action: () => this.fixIt() });
    this.addButton({ key: 'f:watch', x: VIEW_W / 2 + 10, y, w: 240, h: 66, label: 'WATCH AGAIN (R)', size: 20, action: () => this.restartTest() });
  }

  drawPanel(w, h, k = 1) {
    const ctx = this.ctx;
    const x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2 + (1 - k) * 500;
    ctx.fillStyle = 'rgba(43,43,43,0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    rrect(ctx, x + 6, y + 8, w, h, 20); ctx.fillStyle = 'rgba(43,43,43,0.4)'; ctx.fill();
    rrect(ctx, x, y, w, h, 20); ctx.fillStyle = C.cream; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
    return { x, y };
  }

  drawPause() {
    const ctx = this.ctx;
    const { x, y } = this.drawPanel(560, 600);
    text(ctx, 'PAUSED', VIEW_W / 2, y + 50, 44, C.ink, 'center', 900);
    const bx = x + 150, bw = 260, build = this.mode === 'build';
    this.addButton({ key: 'p:resume', x: bx, y: y + 90, w: bw, h: 56, label: 'RESUME', color: C.yellow, size: 24, action: () => this.pause(false) });
    this.addButton({ key: 'p:best', x: bx, y: y + 158, w: bw, h: 56, label: 'LOAD MY BEST', size: 22, disabled: !build || !this.save.best[this.level.id], action: () => this.loadBest() });
    this.addButton({ key: 'p:clear', x: bx, y: y + 226, w: bw, h: 56, label: 'CLEAR BRIDGE', size: 22, disabled: !build, action: () => { this.pause(false); this.clearBridge(); } });
    this.addButton({ key: 'p:levels', x: bx, y: y + 294, w: bw, h: 56, label: 'LEVELS', size: 22, action: () => this.toMenu('levels') });
    text(ctx, 'Drag from a bolt to build · click, click to chain', VIEW_W / 2, y + 382, 17, C.ink, 'center', 700);
    text(ctx, 'E erase · Z undo · Space test · R run again', VIEW_W / 2, y + 408, 17, C.ink, 'center', 700);
    this.settingsButtons(x + 64, y + 440, 208);
    this.addButton({ key: 'p:menu', x: bx, y: y + 512, w: bw, h: 56, label: 'MENU', size: 22, action: () => this.toMenu('title') });
  }

  drawComplete() {
    const ctx = this.ctx, r = this.results;
    if (!r) return;
    if (!r.shownAt) r.shownAt = this.t;
    const e = this.t - r.shownAt;
    const k = easeOutBack(Math.min(1, e / 0.45));
    const { x, y } = this.drawPanel(660, 540, k);
    if (!r.confetti) { r.confetti = true; for (const col of [C.yellow, C.red, C.green, C.blue]) this.fx.burst(VIEW_W / 2, y + 40, 22, col, 520, 'confetti', 1.3, 5, 700); }
    const stampColor = r.stamp === 'MADE IT!' ? C.green : r.stamp === 'CLOSE CALL!' ? '#E08A2E' : C.red;
    drawStamp(ctx, r.stamp, VIEW_W / 2, y + 10, 0.62 * Math.min(1, 0.6 + e * 2), stampColor);
    for (let i = 0; i < 3; i++) {
      const at = 0.5 + i * 0.3, lit = r.stars > i && e > at;
      let s = 1;
      if (lit) {
        const q = Math.min(1, (e - at) / 0.22);
        s = 1 + (1 - q) * 1.2;
        if (!r[`stamp${i}`]) { r[`stamp${i}`] = true; this.sound.play('star', { i }); this.fx.shake(3, 0.08); }
      }
      ctx.save(); ctx.translate(VIEW_W / 2 - 115 + i * 115, y + 120); ctx.scale(s, s);
      drawStarShape(ctx, 0, 0, i === 1 ? 46 : 40, lit ? C.yellow : '#E3DDD0');
      ctx.restore();
    }
    const c = Math.min(1, Math.max(0, e - 0.4) / 0.8);
    if (c > 0 && c < 1 && Math.floor(e * 30) !== this.lastCount) { this.lastCount = Math.floor(e * 30); this.sound.play('count', { k: c }); }
    text(ctx, `Cost  ${money(r.cost * c)}`, VIEW_W / 2, y + 200, 34, C.ink, 'center', 900);
    if (r.newBest && e > 1.3) { ctx.save(); ctx.translate(VIEW_W / 2 + 210, y + 196); ctx.rotate(-0.12); text(ctx, 'New best!', 0, 0, 22, C.red, 'center', 900); ctx.restore(); }
    const lv = this.lv;
    text(ctx, `★★★ ${money(lv.target)}   ·   ★★ budget ${money(lv.budget)}   ·   Best ${money(r.best)}`, VIEW_W / 2, y + 246, 19, C.ink, 'center', 800);
    if (r.hat && e > 1.5) {
      if (!r.hatSound) { r.hatSound = true; this.sound.play('hat'); }
      const drop = Math.min(1, (e - 1.5) / 0.3);
      drawHardHat(ctx, VIEW_W / 2 - 150, y + 290 - (1 - drop) * 60, 1.2);
      text(ctx, 'You beat the engineer!', VIEW_W / 2 + 20, y + 292, 22, C.ink, 'center', 900);
    } else if (r.savedStars === 3) {
      text(ctx, `Engineer's bridge: ${money(lv.reference)}`, VIEW_W / 2, y + 292, 20, C.grey, 'center', 800);
    } else {
      const need = r.stars === 1 ? lv.budget : lv.target;
      text(ctx, `★${r.stars + 1} needs ${money(need)} or less`, VIEW_W / 2, y + 292, 20, C.grey, 'center', 800);
    }
    if (r.broken) text(ctx, `${r.broken} piece${r.broken > 1 ? 's' : ''} broke, but it made it!`, VIEW_W / 2, y + 330, 18, C.red, 'center', 800);
    if (e < 0.35) return;
    const by = y + 400;
    this.addButton({ key: 'c:menu', x: x + 30, y: by, w: 140, h: 64, label: 'MENU', size: 22, action: () => this.toMenu('levels') });
    this.addButton({ key: 'c:replay', x: x + 182, y: by, w: 140, h: 64, label: 'REPLAY', size: 22, action: () => { this.screen = 'playing'; this.startTest(true); } });
    this.addButton({ key: 'c:improve', x: x + 334, y: by, w: 140, h: 64, label: 'IMPROVE', size: 22, action: () => { this.screen = 'playing'; this.stopTest(); } });
    this.addButton({ key: 'c:next', x: x + 486, y: by, w: 144, h: 64, label: 'NEXT ›', size: 24, color: C.yellow, action: () => this.goNext() });
  }
}
