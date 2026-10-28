// Screen flow (GDD 8), dragging and keys (3.4, 3.6), match and snap (3.7), the
// reveal (3.13), stars (3.14), the HUD and the book, and the glue to the 3D view,
// the wall, sound, saving and analytics. Frame loop, keyed canvas buttons and
// panels adapted from Ink Path.
import { VIEW_W, VIEW_H, HUD_H, MAX_FRAME_DT, OBJ_CENTER, WALL, METER, DRAG, KEYS, SNAP, NOTES, REVEAL, COLORS as C, RING_COLORS } from './config.js';
import { wrap, wrapPose, keyStep, nearestSolution, dragDirs, pickAxis } from './pose.js';
import { projectBlocks, rasterize, iou, matchPct } from './shadow.js';
import { parseLevel } from './level.js';
import { Scene3D } from './scene3d.js';
import { Wall, PANEL } from './wall.js';
import { Keys } from './input.js';
import { Sound } from './audio.js';
import { FX } from './fx.js';
import { GA, levelId } from './analytics.js';
import { loadSave, storeSave, loadSettings, storeSettings } from './save.js';
import { rrect, text, drawStar, drawLock, drawHand, drawKeycap, drawMosaic, outlinePath, fmtTime } from './ui.js';
import { ROOMS, LEVELS, LEVELS_PER_ROOM, findLevel } from '../levels/index.js';

const AXIS_INDEX = { turn: 0, tip: 1, spin: 2 };
const KEY_AXIS = {
  ArrowLeft: ['turn', -1], KeyA: ['turn', -1], ArrowRight: ['turn', 1], KeyD: ['turn', 1],
  ArrowUp: ['tip', -1], KeyW: ['tip', -1], ArrowDown: ['tip', 1], KeyS: ['tip', 1],
  KeyQ: ['spin', 1], KeyE: ['spin', -1],
};
const easeOutBack = k => 1 + 2.70158 * (k - 1) ** 3 + 1.70158 * (k - 1) ** 2;
const easeOut = k => 1 - (1 - k) ** 3;
const easeInOut = k => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
const clamp01 = k => Math.max(0, Math.min(1, k));

export class Game {
  constructor({ bg, gl, ui }) {
    this.bg = bg; this.ui = ui;
    this.bctx = bg.getContext('2d');
    this.ctx = ui.getContext('2d');
    this.scene = new Scene3D(gl);
    this.wall = new Wall();
    this.params = new URLSearchParams(location.search);
    this.save = loadSave();
    this.settings = loadSettings();
    this.sound = new Sound();
    this.sound.setEnabled(this.settings.sfx);
    this.sound.musicOn = this.settings.music;
    this.fx = new FX();
    this.keys = new Keys(code => this.onKey(code), code => this.onKeyUp(code));

    this.screen = 'title';
    this.paused = false;
    this.phase = 'play';         // play | snap (reveal and results run while screen = 'complete')
    this.level = null;
    this.lv = null;
    this.lvCache = new Map();
    this.t = 0;
    this.buttons = [];
    this.focus = -1;
    this.hover = null;
    this.pressed = null;
    this.mouse = { x: 0, y: 0 };
    this.bookTab = 0;
    this.held = new Map();
    this.drag = null;
    this.anim = null;
    this.pose = [0, 0, 0];
    this.fixedHz = Number(this.params.get('hz')) || 0;
    this.slow = 0;
    this.titleLv = this.parse(LEVELS[0]);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.endDrag(true); this.held.clear(); this.pause(true); } });
    this.bindPointer();

    const lvParam = this.params.get('level');
    if (lvParam && findLevel(lvParam)) this.startLevel(findLevel(lvParam));

    this.api = this.makeApi();
    this.last = performance.now();
    requestAnimationFrame(now => this.frame(now));
  }

  // ---- Setup ---------------------------------------------------------------

  parse(level) {
    if (!this.lvCache.has(level.id)) this.lvCache.set(level.id, parseLevel(level));
    return this.lvCache.get(level.id);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    for (const c of [this.bg, this.ui]) {
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      c.style.width = w + 'px'; c.style.height = h + 'px';
    }
    this.scale = Math.min(w / VIEW_W, h / VIEW_H);
    this.ox = (w - VIEW_W * this.scale) / 2;
    this.oy = (h - VIEW_H * this.scale) / 2;
    this.dpr = dpr;
    this.scene.resize(this.scale, dpr, this.ox, this.oy);
    this.wall.buildRoom(this.scale * dpr);
    if (this.lv) this.wall.build(this.lv, this.scale * dpr);
  }

  toView(e) { return { x: (e.clientX - this.ox) / this.scale, y: (e.clientY - this.oy) / this.scale }; }

  // Buttons are rebuilt every frame, so they are matched by key, never by object.
  hitButton(p) {
    return this.buttons.find(b => !b.disabled && p.x >= b.x - (b.pad || 0) && p.x <= b.x + b.w + (b.pad || 0) && p.y >= b.y - (b.pad || 0) && p.y <= b.y + b.h + (b.pad || 0)) || null;
  }

  bindPointer() {
    const cv = this.ui;
    cv.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      this.sound.unlock();
      const p = this.toView(e);
      this.mouse = p;
      if (this.drag) return;                       // a second finger during a drag is ignored
      if (this.screen === 'complete' && !this.resultsShown()) { this.skipReveal(); return; }
      this.pressed = this.hitButton(p);
      if (this.pressed) { try { cv.setPointerCapture(e.pointerId); } catch { /* ok */ } return; }
      if (this.canRotate() && p.y >= HUD_H) {
        this.finishAnim();
        this.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, axis: null, dirs: dragDirs(this.pose), start: 0 };
        try { cv.setPointerCapture(e.pointerId); } catch { /* ok */ }
      }
    });
    cv.addEventListener('pointermove', e => {
      const p = this.toView(e);
      this.mouse = p;
      this.hover = this.hitButton(p);
      if (this.drag && e.pointerId === this.drag.id) this.dragMove(e.clientX, e.clientY);
      const c = this.hover ? 'pointer' : this.canRotate() && p.y >= HUD_H ? (this.drag ? 'grabbing' : 'grab') : 'default';
      if (c !== this.cursor) { this.cursor = c; cv.style.cursor = c; }
    });
    const up = (e, cancel) => {
      if (this.drag && e.pointerId === this.drag.id) { this.endDrag(cancel); return; }
      const b = this.hitButton(this.toView(e));
      if (!cancel && b && this.pressed && b.key === this.pressed.key) this.activate(b);
      this.pressed = null;
    };
    cv.addEventListener('pointerup', e => up(e, false));
    cv.addEventListener('pointercancel', e => up(e, true));
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }

  makeApi() {
    const g = this;
    return {
      get screen() { return g.screen; },
      get level() { return g.level ? g.level.id : null; },
      get score() { return g.result ? g.result.stars : 0; },
      get pose() { return wrapPose(g.pose); },
      get match() { return g.match; },
      get pct() { return Math.round(g.pct); },
      get phase() { return g.screen === 'complete' ? (g.resultsShown() ? 'results' : 'reveal') : g.phase; },
      get paused() { return g.paused; },
      get time() { return g.clock; },
      get renderer() { return g.scene.mode; },
      get save() { return g.save; },
      get ga() { return GA.log; },
      start() { g.startLevel(g.nextLevel()); },
      restart() { if (g.level) g.restartAttempt(); },
      // Debug only (removed in release): solve at once.
      win() { if (g.screen === 'playing' && g.phase === 'play') { g.startClock(); g.snap(); } },
      // Debug only: set the dials (like a key step landing: snaps if it matches).
      setPose(turn, tip, spin = 0) {
        if (g.screen !== 'playing' || g.phase !== 'play') return false;
        g.anim = null; g.endDrag(true);
        g.pose = [turn, tip, spin];
        g.startClock();
        g.refreshShadow();
        g.checkSnap();
        return true;
      },
    };
  }

  // ---- Levels -----------------------------------------------------------------

  levelPos(id) {
    for (let r = 0; r < ROOMS.length; r++) {
      const i = ROOMS[r].levels.findIndex(l => l.id === id);
      if (i >= 0) return { world: r + 1, level: i + 1 };
    }
    return { world: 1, level: 0 };
  }

  lid(level = this.level) { const p = this.levelPos(level.id); return levelId(p.world, p.level); }
  rec(id) { return this.save.levels[id] || null; }
  nextLevel() { return LEVELS.find(l => !this.rec(l.id)) || LEVELS[0]; }
  // GDD 7: finishing a level unlocks the next.
  isOpen(level) { const i = LEVELS.indexOf(level); return i === 0 || (i > 0 && !!this.rec(LEVELS[i - 1].id)); }

  startLevel(level) {
    if (this.screen === 'playing' && this.level && this.phase === 'play') this.failAttempt();
    this.level = level;
    this.lv = this.parse(level);
    this.scene.setLevel(this.lv);
    this.scene.setView(0);
    this.wall.build(this.lv, this.scale * this.dpr);
    this.screen = 'playing';
    this.phase = 'play';
    this.paused = false;
    this.focus = -1;
    this.buttons = [];
    this.result = null;
    this.drag = null;
    this.anim = null;
    this.held.clear();
    this.fx.clear();
    this.pose = this.lv.start.slice();
    this.introT = this.t;
    this.wobble = null;
    this.keyFlash = { turn: -1, tip: -1, spin: -1 };
    this.newAttempt();
    this.refreshShadow();
    this.lastStep = Math.floor(this.pct / 10);
  }

  newAttempt() {
    this.attemptT = this.t;
    this.clock = 0;
    this.clockOn = false;
    this.moves = 0;
    this.bestPct = 0;
    this.hold = 0;
    this.firstMove = false;
    const p = this.levelPos(this.level.id);
    GA.progression('Start', p.world, p.level);
  }

  // R, quitting to the menu or the book (GDD 11): Fail with seconds since the level started.
  failAttempt() {
    const p = this.levelPos(this.level.id);
    GA.progression('Fail', p.world, p.level, Math.round(this.t - this.attemptT));
    GA.design(`level:best:${this.lid()}`, Math.round(this.bestPct));
  }

  restartAttempt() {
    if (this.screen !== 'playing' || this.phase !== 'play') return;
    this.endDrag(true);
    this.failAttempt();
    GA.design('ui:restart');
    this.held.clear();
    const from = this.pose.slice();
    const to = this.lv.start.map((v, i) => from[i] + wrap(v - from[i]));
    this.anim = { from, to, t: 0, dur: SNAP.restart, ease: easeOut, kind: 'restart' };
    this.sound.play('restart');
    this.newAttempt();
  }

  toMenu(screen = 'title') {
    if (this.screen === 'playing' && this.phase === 'play') this.failAttempt();
    this.endDrag(true);
    this.held.clear();
    this.screen = screen;
    this.paused = false;
    this.focus = -1;
    this.sound.setWhirr(0);
    if (screen === 'levels') this.sound.play('page');
  }

  pause(on) {
    if (this.screen !== 'playing' || this.phase !== 'play' || this.paused === on) return;
    if (on) { this.endDrag(true); this.held.clear(); }
    this.paused = on;
    this.focus = on ? 0 : -1;
    this.sound.setWhirr(0);
  }

  goNext() {
    const i = LEVELS.indexOf(this.level), next = LEVELS[i + 1];
    if (next) this.startLevel(next); else this.toMenu('levels');
  }

  // ---- Rotation ---------------------------------------------------------------

  canRotate() { return this.screen === 'playing' && !this.paused && this.phase === 'play'; }

  startClock() {
    if (!this.clockOn) { this.clockOn = true; this.clock = 0; }
  }

  firstRotation(axis) {
    this.startClock();
    this.moves++;
    this.firstMove = true;
    if (axis === 'turn' && !this.save.tut.turn) { this.save.tut.turn = true; storeSave(this.save); GA.design('tutorial:step01'); }
    if (axis === 'tip' && !this.save.tut.tip) { this.save.tut.tip = true; storeSave(this.save); GA.design('tutorial:step03'); }
  }

  dragMove(cx, cy) {
    const d = this.drag;
    const dx = cx - d.x0, dy = cy - d.y0;
    if (!d.axis) {
      if (Math.hypot(dx, dy) < DRAG.lockPx) return;
      const axis = pickAxis(dx, dy, d.dirs);
      if (!this.lv.axes[axis]) {
        d.axis = 'dead';
        this.wobble = { axis, t0: this.t };
        this.sound.play('tock');
        return;
      }
      d.axis = axis;
      d.start = this.pose[AXIS_INDEX[axis]];
      this.sound.play('lock');
      this.firstRotation(axis);
    }
    if (d.axis === 'dead') return;
    const dir = d.dirs[d.axis];
    this.pose[AXIS_INDEX[d.axis]] = d.start + DRAG.degPerPx * (dx * dir[0] + dy * dir[1]);
  }

  endDrag(cancel) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.pose = wrapPose(this.pose);
    if (!cancel && d.axis && d.axis !== 'dead') { this.refreshShadow(); this.checkSnap(); }
  }

  keyStepAxis(axis, dir) {
    if (!this.canRotate() || this.drag) return;
    if (!this.lv.axes[axis]) {
      this.wobble = { axis, t0: this.t };
      this.sound.play('tock');
      return;
    }
    const i = AXIS_INDEX[axis];
    const flip = axis === 'turn' ? dragDirs(this.pose).flip : 1;
    const base = this.anim && this.anim.kind === 'key' ? this.anim.to : this.pose.map(v => v);
    const to = base.slice();
    to[i] = keyStep(base[i], dir * flip, KEYS.step);
    this.anim = { from: this.pose.slice(), to, t: 0, dur: KEYS.ease, ease: easeOut, kind: 'key' };
    this.keyFlash[axis] = this.t;
    this.sound.play('step');
    this.firstRotation(axis);
  }

  finishAnim() {
    if (!this.anim) return;
    const a = this.anim;
    this.anim = null;
    this.pose = wrapPose(a.to);
    this.refreshShadow();
    if (a.kind === 'key') this.checkSnap();
  }

  refreshShadow() {
    const lv = this.lv;
    this.polys = projectBlocks(lv.blocks, lv.frame.pivot, this.pose);
    this.mask = rasterize(this.polys, lv.frame, this.mask);
    this.match = iou(this.mask, lv.target);
    this.pct = matchPct(this.match, lv.base, lv.match);
    if (this.firstMove) this.bestPct = Math.max(this.bestPct, this.pct);
  }

  // Snap trigger (GDD 3.7): drag released or key step landed while at threshold.
  checkSnap() {
    if (this.phase === 'play' && this.screen === 'playing' && this.match >= this.lv.match) this.snap();
  }

  snap() {
    const lv = this.lv;
    this.endDrag(true);
    this.held.clear();
    this.phase = 'snap';
    this.screen = 'complete';
    this.focus = -1;
    const near = nearestSolution(this.pose, lv.solutions);
    this.anim = { from: this.pose.slice(), to: near.target, t: 0, dur: SNAP.ease, ease: easeOutBack, kind: 'snap' };
    this.revealT = this.t;
    this.revealFired = {};
    this.sound.play('snap');
    this.sound.setWhirr(0);
    this.fx.shake(2, 0.12);
    this.fx.spawn({ x: WALL.cx, y: WALL.cy, type: 'ring', color: C.cyan, size: 60, life: 0.6 });

    // Stars for time (GDD 3.14), save, analytics.
    const level = this.level, time = this.clock, par = lv.par;
    const stars = time <= par ? 3 : time <= 2 * par ? 2 : 1;
    const old = this.rec(level.id);
    const first = !old;
    const rec = old ? { ...old } : { stars: 0, best: Infinity };
    const newBest = !first && time < old.best;
    rec.stars = Math.max(rec.stars, stars);
    rec.best = Math.round(Math.min(rec.best, time) * 10) / 10;
    this.save.levels[level.id] = rec;
    const p = this.levelPos(level.id), id = this.lid();
    GA.progression('Complete', p.world, p.level, stars);
    GA.design(`level:time:${id}`, Math.round(time * 10) / 10);
    GA.design(`level:moves:${id}`, this.moves);
    if (level.id === 'w1l01' && first) GA.design('tutorial:step02');
    storeSave(this.save);
    this.result = { stars, time, best: rec.best, newBest, first, par };
  }

  resultsShown() { return this.screen === 'complete' && this.t - this.revealT >= REVEAL.results; }

  skipReveal() {
    if (this.screen !== 'complete' || this.resultsShown()) return;
    this.revealT = this.t - REVEAL.results;
    this.finishAnim();
    this.revealFired = { sparkle: true, name: true };
  }

  // ---- Input ------------------------------------------------------------------

  onKey(code) {
    this.sound.unlock();
    if (this.screen === 'playing' && !this.paused) {
      if (code === 'KeyP' || code === 'Escape') { this.pause(true); this.sound.play('click'); return; }
      if (code === 'KeyR') { this.restartAttempt(); return; }
      const ka = KEY_AXIS[code];
      if (ka && this.canRotate() && !this.drag) {
        this.held.set(code, { axis: ka[0], dir: ka[1], next: this.t + KEYS.repeatDelay });
        this.keyStepAxis(ka[0], ka[1]);
      }
      return;
    }
    if (this.screen === 'playing' && this.paused && (code === 'KeyP' || code === 'Escape')) { this.pause(false); return; }
    if (this.screen === 'complete') {
      if (!this.resultsShown()) { if (code === 'Space' || code === 'Enter') this.skipReveal(); return; }
      if (this.t - this.revealT < REVEAL.results + REVEAL.ignore) return;
      if ((code === 'Enter' || code === 'Space') && this.focus < 0) { this.goNext(); return; }
      if (code === 'KeyR') { this.startLevel(this.level); return; }
    }
    const list = this.buttons.filter(b => !b.disabled && !b.hud);
    if (!list.length) return;
    const i = list.indexOf(this.buttons[this.focus]);
    const move = d => { const n = list[(Math.max(i, 0) + d + list.length) % list.length]; this.focus = this.buttons.indexOf(n); this.sound.play('click'); };
    if (code === 'ArrowRight' || code === 'ArrowDown' || code === 'KeyD' || code === 'KeyS' || code === 'Tab') move(i < 0 ? 0 : 1);
    else if (code === 'ArrowLeft' || code === 'ArrowUp' || code === 'KeyA' || code === 'KeyW') move(i < 0 ? 0 : -1);
    else if (code === 'Enter' || code === 'Space') {
      const b = this.buttons[this.focus] || list.find(q => q.isDefault) || list[0];
      this.activate(b);
    } else if (code === 'Escape' && this.screen === 'levels') this.toMenu('title');
  }

  onKeyUp(code) {
    if (code === '*') this.held.clear(); else this.held.delete(code);
  }

  activate(b) {
    this.sound.unlock();
    this.sound.play('click');
    this.fx.kick(`btn:${b.key}`, 0.94, 0.94);
    b.action();
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

  // ---- Frame ------------------------------------------------------------------

  frame(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (this.fixedHz) dt = 1 / this.fixedHz;
    // Drop the WebGL resolution to 1× if frames take over 18 ms for 2 s (GDD 12).
    if (dt > 0.018 && dt < 0.2) this.slow += dt; else this.slow = Math.max(0, this.slow - dt);
    if (this.slow > 2 && this.scene.maxDpr > 1) this.scene.setMaxDpr(1);
    dt = Math.min(Math.max(dt, 0), MAX_FRAME_DT);
    this.t += dt;
    if ((this.screen === 'playing' && !this.paused) || this.screen === 'complete') this.update(dt);
    this.fx.update(dt);
    this.draw();
    requestAnimationFrame(n => this.frame(n));
  }

  update(dt) {
    const before = this.pose.slice();
    // key repeat: every 150 ms after 300 ms (GDD 3.6)
    if (this.canRotate()) {
      for (const [, h] of this.held) {
        if (this.t >= h.next) { h.next += KEYS.repeatEvery; this.keyStepAxis(h.axis, h.dir); }
      }
    }
    if (this.anim) {
      const a = this.anim;
      a.t += dt;
      const k = clamp01(a.t / a.dur), e = a.ease(k);
      this.pose = a.from.map((v, i) => v + (a.to[i] - v) * e);
      if (k >= 1) this.finishAnim();
    }
    const moved = before.some((v, i) => v !== this.pose[i]);
    if (moved) this.refreshShadow();
    if (this.clockOn && this.phase === 'play') this.clock += dt;

    // Rotation speed drives the whirr and the halo.
    const speed = moved ? before.reduce((s, v, i) => s + Math.abs(this.pose[i] - v), 0) / dt : 0;
    this.spin = (this.spin || 0) + (Math.min(1, speed / 400) - (this.spin || 0)) * Math.min(1, dt * 10);
    this.sound.setWhirr(this.phase === 'play' ? this.spin : 0);

    if (this.phase === 'play') {
      // held at threshold for 150 ms (a fast swipe passing through doesn't count)
      if (this.match >= this.lv.match) { this.hold += dt; if (this.hold >= SNAP.hold) this.snap(); } else this.hold = 0;
      // warm notes: one per 10% step up, a muted tick down, max one per 80 ms
      const step = Math.floor(this.pct / 10);
      if (step !== this.lastStep) {
        if (this.firstMove && this.t - (this.noteT || 0) >= NOTES.minGap) {
          this.sound.play(step > this.lastStep ? 'note' : 'tick', { i: step - 1 });
          this.noteT = this.t;
        }
        this.lastStep = step;
      }
    }

    if (this.screen === 'complete') this.updateReveal();
  }

  updateReveal() {
    const e = this.t - this.revealT, f = this.revealFired;
    this.scene.setView(easeInOut(clamp01((e - REVEAL.swingAt) / REVEAL.swing)));
    if (e >= REVEAL.swingAt && !f.sparkle) {
      f.sparkle = true;
      this.sound.play('reveal');
      // 40 sparkles along the outline
      const lv = this.lv, pts = lv.loops.flat();
      for (let i = 0; i < 40; i++) {
        const p = pts[Math.floor(this.fx.rnd() * pts.length)];
        this.fx.spawn({ x: WALL.cx + p[0] * lv.cellPx, y: WALL.cy - p[1] * lv.cellPx, vx: (this.fx.rnd() - 0.5) * 90, vy: -30 - this.fx.rnd() * 60, color: i % 3 ? C.gold : C.cyan, type: 'spark', size: 3 + this.fx.rnd() * 2, life: 0.9, delay: this.fx.rnd() * 0.4 });
      }
    }
    if (e >= REVEAL.animAt && !f.name) {
      f.name = true;
      this.fx.kick('name', 1.5, 0.6);
    }
  }

  // ---- Drawing ---------------------------------------------------------------

  draw() {
    const [sx, sy] = this.fx.offset();
    // background and wall
    const b = this.bctx;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.fillStyle = C.ink; b.fillRect(0, 0, this.bg.width, this.bg.height);
    b.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * (this.ox + sx * this.scale), this.dpr * (this.oy + sy * this.scale));
    const inLevel = (this.screen === 'playing' || this.screen === 'complete') && this.lv;
    if (inLevel) this.drawWall(b); else this.wall.drawRoom(b);

    // object view
    if (inLevel) this.updateScene();
    else if (this.screen === 'title') this.updateTitleScene();
    this.scene.setVisible(!!inLevel || this.screen === 'title');
    if (inLevel || this.screen === 'title') this.scene.render();

    // UI
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.ui.width, this.ui.height);
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.ox, this.dpr * this.oy);
    // letterbox bars
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, VIEW_W, VIEW_H); ctx.clip();
    this.buttons = [];
    if (this.screen === 'title') this.drawTitle();
    else if (this.screen === 'levels') this.drawBook();
    else if (inLevel) {
      ctx.save(); ctx.translate(sx, sy);
      this.drawPlayOverlay();
      this.fx.draw(ctx);
      ctx.restore();
      this.drawHud();
      if (this.paused) this.drawPause();
      if (this.screen === 'complete') this.drawReveal();
    }
    ctx.restore();
  }

  displayPose() {
    const p = this.pose.slice();
    const w = this.wobble;
    if (w && this.t - w.t0 < DRAG.wobbleTime) {
      const k = (this.t - w.t0) / DRAG.wobbleTime;
      p[AXIS_INDEX[w.axis]] += Math.sin(k * Math.PI * 3) * DRAG.wobbleDeg * (1 - k);
    }
    return p;
  }

  ringAlpha(axis) {
    if (!this.lv.axes[axis]) return 0;
    if (this.screen === 'complete') return Math.max(0, 0.3 - (this.t - this.revealT) * 1.5);
    if (this.t - this.keyFlash[axis] < 0.3) return 1;
    const d = this.drag;
    if (d && d.axis && d.axis !== 'dead') return d.axis === axis ? 1 : 0.1;
    if (d) return 0.6;
    return 0.3;
  }

  updateScene() {
    this.scene.setLevel(this.lv);
    if (this.screen === 'playing') this.scene.setView(0);
    this.scene.setPose(this.displayPose());
    for (const a of ['turn', 'tip', 'spin']) this.scene.setRing(a, this.ringAlpha(a));
  }

  // Title: the first sculpture turns in the lamplight and clicks into its picture.
  updateTitleScene() {
    const lv = this.titleLv, cyc = this.t % 6.5;
    this.scene.setLevel(lv);
    let turn = 0, tip = 0, k = 0;
    if (cyc < 4.5) { const e = easeInOut(cyc / 4.5); turn = 360 * e; tip = 22 * Math.sin(e * Math.PI); }
    else k = easeInOut(clamp01((cyc - 4.5) / 0.4)) * (1 - easeInOut(clamp01((cyc - 6.1) / 0.4)));
    if (cyc >= 4.5 && !this.titleClick) { this.titleClick = true; if (this.sound.ctx) this.sound.play('step'); }
    if (cyc < 4.5) this.titleClick = false;
    this.scene.setView(k);
    this.scene.setPose([turn, tip, 0]);
    for (const a of ['turn', 'tip', 'spin']) this.scene.setRing(a, 0);
  }

  drawWall(b) {
    this.wall.drawHalo(b, 0.5 + (this.spin || 0) * 0.8 + (this.screen === 'complete' ? 0.4 : 0));
    // dust motes drifting in the beam
    b.fillStyle = 'rgba(255,225,150,0.5)';
    for (let i = 0; i < 18; i++) {
      const u = ((i * 0.618 + this.t * 0.02 * (1 + (i % 3))) % 1);
      const x = 60 + u * 1100, y = 690 - u * 520 + Math.sin(this.t * 0.7 + i * 2.1) * 40 + ((i * 37) % 90) - 45;
      b.beginPath(); b.arc(x, y, 1.2 + (i % 3) * 0.6, 0, Math.PI * 2); b.fill();
    }
    const complete = this.screen === 'complete', e = complete ? this.t - this.revealT : 0;
    this.wall.draw(b, {
      polys: this.polys,
      pct: complete ? 100 : this.pct,
      t: this.t,
      solid: complete,
      flash: complete ? clamp01(1 - e / 0.4) : 0,
      mosaic: complete ? easeOut(clamp01((e - REVEAL.swingAt) / REVEAL.mosaic)) : 0,
      anim: complete ? e - REVEAL.animAt : -1,
    });
  }

  // Rings' icons, the wobble lock, the meter, the ghost hand and the caption.
  drawPlayOverlay() {
    const ctx = this.ctx, lv = this.lv, t = this.t;
    if (this.screen === 'playing') {
      // ring icons: arrow pairs at the front of the Turn and Tip rings
      for (const axis of ['turn', 'tip']) {
        if (!lv.axes[axis]) continue;
        const p = this.scene.ringPoint(axis, axis === 'turn' ? -0.55 : 0.55);
        const a = Math.max(0.45, this.ringAlpha(axis));
        ctx.save();
        ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(18,24,51,0.85)'; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = RING_COLORS[axis]; ctx.stroke();
        const locked = this.drag && this.drag.axis === axis;
        const slide = locked ? Math.sin(t * 10) * 3 : 0;
        text(ctx, axis === 'turn' ? '⟷' : '↕', p.x + (axis === 'turn' ? slide : 0), p.y + 1 + (axis === 'tip' ? slide : 0), 24, RING_COLORS[axis], 'center', 900);
        ctx.restore();
      }
      // lock flash where a disallowed ring would be
      const w = this.wobble;
      if (w && t - w.t0 < 0.6) {
        const p = this.scene.ringPoint(w.axis, w.axis === 'turn' ? -0.55 : 0.55);
        ctx.globalAlpha = 1 - (t - w.t0) / 0.6;
        drawLock(ctx, p.x, p.y, 1, C.moon);
        ctx.globalAlpha = 1;
      }
      // the ghost hand on levels 1 and 3, until the first rotation (GDD 8)
      const idx = LEVELS.indexOf(this.level);
      if (!this.firstMove && (idx === 0 || idx === 2) && t - this.introT > 0.6) {
        const k = ((t - this.introT) % 2.2) / 2.2, s = Math.sin(k * Math.PI * 2);
        const horiz = idx === 0;
        const hx = OBJ_CENTER.x + (horiz ? s * 90 : 40), hy = OBJ_CENTER.y + (horiz ? 40 : s * 80);
        drawHand(ctx, hx, hy, Math.abs(Math.cos(k * Math.PI * 2)) * 0.5);
        if (horiz) { drawKeycap(ctx, OBJ_CENTER.x - 26, 680, '←'); drawKeycap(ctx, OBJ_CENTER.x + 26, 680, '→'); }
        else { drawKeycap(ctx, OBJ_CENTER.x - 26, 680, '↑'); drawKeycap(ctx, OBJ_CENTER.x + 26, 680, '↓'); }
      }
      // caption on level 1, fades after the first move
      if (idx === 0) {
        this.captionA = this.firstMove ? Math.max(0, (this.captionA ?? 1) - 0.03) : 1;
        if (this.captionA > 0) { ctx.globalAlpha = this.captionA; text(ctx, 'Fill the outline', WALL.cx, PANEL.y + PANEL.h - 34, 26, C.cyan, 'center', 900, 5); ctx.globalAlpha = 1; }
      }
      // room intro (GDD 8): the room's name on its first level, 1.2 s
      if (idx === 0 && t - this.introT < 1.6) {
        const k = t - this.introT, a = k < 0.2 ? k / 0.2 : k > 1.2 ? 1 - (k - 1.2) / 0.4 : 1;
        ctx.globalAlpha = clamp01(a);
        text(ctx, 'THE ATTIC', OBJ_CENTER.x, 150, 44, C.gold, 'center', 900, 6);
        text(ctx, 'turn ⟷', OBJ_CENTER.x, 192, 24, RING_COLORS.turn, 'center', 800, 4);
        ctx.globalAlpha = 1;
      }
    }
    this.drawMeter();
  }

  // Match % ring and number in the wall's top-left corner (GDD 3.8).
  drawMeter() {
    const ctx = this.ctx, { x, y, r } = METER;
    const pct = this.screen === 'complete' ? 100 : this.pct;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(8,11,28,0.7)'; ctx.fill();
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(234,240,255,0.15)'; ctx.stroke();
    if (pct > 0) {
      ctx.save();
      ctx.shadowColor = C.cyan; ctx.shadowBlur = 6 + pct / 8;
      ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct / 100);
      ctx.strokeStyle = C.cyan; ctx.lineCap = 'round'; ctx.stroke();
      ctx.restore();
    }
    text(ctx, `${Math.round(pct)}%`, x, y + 1, 22, C.moon, 'center', 900);
  }

  addButton(b) {
    b.key = b.key || b.label;
    this.buttons.push(b);
    const ctx = this.ctx;
    const idx = this.buttons.length - 1;
    const hot = this.hover && this.hover.key === b.key;
    const focused = this.focus === idx;
    const down = this.pressed && this.pressed.key === b.key;
    const sq = this.fx.sq(`btn:${b.key}`);
    const s = (down ? 0.94 : 1) * sq.sx;
    const r = b.r ?? 16;
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.scale(s, s); ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
    if (!b.flat) {
      rrect(ctx, b.x, b.y, b.w, b.h, r);
      ctx.fillStyle = b.disabled ? 'rgba(35,42,82,0.6)' : (b.color || C.wall); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = b.disabled ? 'rgba(234,240,255,0.15)' : (b.stroke || 'rgba(234,240,255,0.45)'); ctx.stroke();
    }
    if (focused || hot) {
      ctx.save(); ctx.shadowColor = C.cyan; ctx.shadowBlur = 12;
      rrect(ctx, b.x - 4, b.y - 4, b.w + 8, b.h + 8, r + 4); ctx.lineWidth = 3; ctx.strokeStyle = C.cyan; ctx.stroke();
      ctx.restore();
    }
    if (b.draw) b.draw(ctx, b);
    else text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.size || 26, b.disabled ? 'rgba(234,240,255,0.35)' : (b.textColor || C.moon), 'center', 900);
    ctx.restore();
    return b;
  }

  settingsButtons(x, y, w = 200) {
    this.addButton({ key: 'sound', x, y, w, h: 56, size: 22, label: this.settings.sfx ? 'SOUND: ON' : 'SOUND: OFF', action: () => this.toggleSfx() });
    this.addButton({ key: 'music', x: x + w + 16, y, w, h: 56, size: 22, label: this.settings.music ? 'MUSIC: ON' : 'MUSIC: OFF', action: () => this.toggleMusic() });
  }

  drawTitle() {
    const ctx = this.ctx, t = this.t;
    // Logo: the words with a long cast shadow.
    const lx = 950, ly = 170 + Math.sin(t * 1.5) * 3;
    ctx.save();
    ctx.translate(lx + 14, ly + 18); ctx.transform(1, 0, -0.5, 1, 0, 0);
    text(ctx, 'SHADOW', 0, -40, 84, 'rgba(8,11,28,0.85)', 'center', 900);
    text(ctx, 'SHAPES', 0, 44, 84, 'rgba(8,11,28,0.85)', 'center', 900);
    ctx.restore();
    ctx.save(); ctx.shadowColor = C.gold; ctx.shadowBlur = 18;
    text(ctx, 'SHADOW', lx, ly - 40, 84, C.moon, 'center', 900);
    text(ctx, 'SHAPES', lx, ly + 44, 84, C.gold, 'center', 900);
    ctx.restore();

    const next = this.nextLevel();
    this.addButton({ key: 'play', x: lx - 170, y: 330, w: 340, h: 96, label: 'PLAY', size: 46, color: C.gold, textColor: C.ink, stroke: '#FFF1C2', isDefault: true,
      action: () => this.startLevel(next) });
    this.addButton({ key: 'book', x: lx - 170, y: 446, w: 162, h: 64, label: 'BOOK', size: 24, action: () => { this.toMenu('levels'); } });
    const dailyOpen = false;   // unlocks after level 5 (not in the slice)
    this.addButton({ key: 'daily', x: lx + 8, y: 446, w: 162, h: 64, disabled: !dailyOpen, action: () => {},
      draw: (c, b) => { drawLock(c, b.x + 32, b.y + 34, 0.7, 'rgba(234,240,255,0.5)'); text(c, 'DAILY', b.x + 98, b.y + 33, 24, 'rgba(234,240,255,0.5)', 'center', 900); } });
    this.settingsButtons(lx - 216, 534);
    text(ctx, 'Daily shadow: solve level 5', lx, 624, 22, 'rgba(234,240,255,0.5)', 'center', 700);
    text(ctx, 'Turn the blocks until the shadow fills the outline.', lx, 670, 22, 'rgba(234,240,255,0.7)', 'center', 700);
  }

  drawBook() {
    const ctx = this.ctx, t = this.t;
    text(ctx, 'THE BOOK', VIEW_W / 2, 52, 40, C.gold, 'center', 900);
    this.addButton({ key: 'back', x: 24, y: 24, w: 140, h: 56, label: '‹ BACK', size: 22, action: () => this.toMenu('title') });
    const tabs = [...ROOMS.map(r => r.name), 'Daily'];
    tabs.forEach((name, i) => {
      const x = 170 + i * 192, sel = this.bookTab === i;
      this.addButton({ key: `tab:${i}`, x, y: 96, w: 180, h: 52, r: 12, color: sel ? C.wall : 'rgba(18,24,51,0.8)', stroke: sel ? C.cyan : undefined,
        action: () => { if (this.bookTab !== i) { this.bookTab = i; this.sound.play('page'); } },
        draw: (c, b) => {
          const open = i === 0;
          text(c, name.toUpperCase(), b.x + b.w / 2 - (open ? 0 : 12), b.y + b.h / 2 + 1, 22, sel ? C.moon : 'rgba(234,240,255,0.6)', 'center', 900);
          if (!open) drawLock(c, b.x + b.w - 22, b.y + b.h / 2 + 2, 0.5, 'rgba(234,240,255,0.5)');
        } });
    });
    if (this.bookTab !== 0) {
      drawLock(ctx, VIEW_W / 2, 360, 3, 'rgba(234,240,255,0.4)');
      const need = this.bookTab === 4 ? 'Solve level 5' : `Finish the ${ROOMS[this.bookTab - 1].name}`;
      text(ctx, need, VIEW_W / 2, 470, 30, C.moon, 'center', 800);
      return;
    }
    const room = ROOMS[0], next = this.nextLevel();
    for (let i = 0; i < LEVELS_PER_ROOM; i++) {
      const col = i % 5, row = Math.floor(i / 5);
      const x = 120 + col * 214, y = 178 + row * 262, w = 186, h = 240;
      const level = room.levels[i];
      if (!level || !this.isOpen(level)) {
        rrect(ctx, x, y, w, h, 14); ctx.fillStyle = 'rgba(18,24,51,0.85)'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(234,240,255,0.12)'; ctx.stroke();
        text(ctx, String(i + 1), x + w / 2, y + 40, 30, 'rgba(234,240,255,0.25)', 'center', 900);
        drawLock(ctx, x + w / 2, y + 120, 1.3, 'rgba(234,240,255,0.3)');
        continue;
      }
      const r = this.rec(level.id), lv = this.parse(level);
      const isNext = level === next && !r;
      const bounce = isNext ? -Math.abs(Math.sin(t * 4)) * 8 : 0;
      this.addButton({
        key: `level:${level.id}`, x, y: y + bounce, w, h, r: 14, isDefault: isNext, color: isNext ? '#2D3566' : C.wall, stroke: isNext ? C.gold : undefined,
        action: () => this.startLevel(level),
        draw: (c, b) => {
          const px = Math.min(16, 130 / Math.max(lv.frame.size[0], lv.frame.size[1]));
          const cx = b.x + b.w / 2, cy = b.y + 104;
          if (r) drawMosaic(c, lv, cx, cy, px, { glow: 6 });
          else {
            outlinePath(c, lv.loops, cx, cy, px);
            c.setLineDash([6, 5]); c.lineWidth = 2.5; c.strokeStyle = C.cyan; c.stroke(); c.setLineDash([]);
          }
          text(c, `${i + 1}  ${r ? level.name : '?'}`, cx, b.y + 24, 22, C.moon, 'center', 800);
          for (let s = 0; s < 3; s++) drawStar(c, cx - 40 + s * 40, b.y + 186, 15, r && r.stars > s ? C.gold : 'rgba(234,240,255,0.3)', !(r && r.stars > s));
          if (r) text(c, fmtTime(r.best), cx, b.y + 220, 22, 'rgba(234,240,255,0.75)', 'center', 700);
        },
      });
    }
  }

  drawHud() {
    const ctx = this.ctx;
    ctx.fillStyle = C.wall; ctx.fillRect(0, 0, VIEW_W, HUD_H);
    ctx.fillStyle = 'rgba(62,230,255,0.25)'; ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);
    const live = this.screen === 'playing' && !this.paused;
    if (live) this.addButton({ key: 'hud:pause', hud: true, x: 8, y: 8, w: 56, h: 56, r: 28, pad: 4, action: () => this.pause(true),
      draw: (c, b) => { c.fillStyle = C.moon; c.fillRect(b.x + 19, b.y + 17, 6, 22); c.fillRect(b.x + 31, b.y + 17, 6, 22); } });
    const p = this.levelPos(this.level.id);
    text(ctx, ROOMS[p.world - 1].name.toUpperCase(), 84, 37, 22, C.gold, 'left', 900);
    text(ctx, `${p.level}  ${this.level.name}`, 196, 37, 24, C.moon, 'left', 900);

    // three stars with draining rings and the clock (GDD 3.14)
    const par = this.lv.par, time = this.screen === 'complete' && this.result ? this.result.time : this.clock;
    const k3 = clamp01(1 - time / par), k2 = clamp01(1 - (time - par) / par);
    const sx = VIEW_W / 2 - 60;
    [1, k2, k3].forEach((k, i) => {
      const x = sx + i * 42, y = 36;
      const lit = i === 0 || k > 0;
      drawStar(ctx, x, y, 15, lit ? C.gold : 'rgba(234,240,255,0.35)', !lit);
      if (i > 0 && k > 0 && k < 1) {
        ctx.beginPath(); ctx.arc(x, y, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
        ctx.lineWidth = 2.5; ctx.strokeStyle = C.gold; ctx.stroke();
      }
    });
    text(ctx, fmtTime(time), VIEW_W / 2 + 90, 37, 24, C.moon, 'left', 800);

    if (live) this.addButton({ key: 'hud:restart', hud: true, x: VIEW_W - 64, y: 8, w: 56, h: 56, r: 28, pad: 4, action: () => this.restartAttempt(),
      draw: (c, b) => {
        c.strokeStyle = C.moon; c.lineWidth = 5; c.lineCap = 'round';
        c.beginPath(); c.arc(b.x + 28, b.y + 28, 13, -0.3, Math.PI * 1.55); c.stroke();
        c.fillStyle = C.moon; c.beginPath(); c.moveTo(b.x + 41, b.y + 13); c.lineTo(b.x + 44, b.y + 29); c.lineTo(b.x + 29, b.y + 23); c.fill();
      } });
  }

  drawPanel(x, y, w, h) {
    const ctx = this.ctx;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30;
    rrect(ctx, x, y, w, h, 22); ctx.fillStyle = 'rgba(35,42,82,0.97)'; ctx.fill();
    ctx.restore();
    rrect(ctx, x, y, w, h, 22); ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(62,230,255,0.5)'; ctx.stroke();
  }

  drawPause() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,11,28,0.6)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 520, h = 560, x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2;
    this.drawPanel(x, y, w, h);
    text(ctx, 'PAUSED', VIEW_W / 2, y + 54, 44, C.moon, 'center', 900);
    const bx = x + 110, bw = 300;
    this.addButton({ key: 'p:resume', x: bx, y: y + 96, w: bw, h: 62, label: 'RESUME', color: C.gold, textColor: C.ink, size: 26, action: () => this.pause(false) });
    this.addButton({ key: 'p:restart', x: bx, y: y + 172, w: bw, h: 62, label: 'RESTART', size: 26, action: () => { this.pause(false); this.restartAttempt(); } });
    this.addButton({ key: 'p:book', x: bx, y: y + 248, w: bw, h: 62, label: 'BOOK', size: 26, action: () => this.toMenu('levels') });
    this.settingsButtons(x + 44, y + 330, 208);
    text(ctx, 'Drag anywhere: turn ⟷ and tip ↕', VIEW_W / 2, y + 430, 22, 'rgba(234,240,255,0.8)', 'center', 700);
    text(ctx, 'Arrows / WASD: 15° steps', VIEW_W / 2, y + 466, 22, 'rgba(234,240,255,0.8)', 'center', 700);
    text(ctx, 'R restart  ·  P pause', VIEW_W / 2, y + 502, 22, 'rgba(234,240,255,0.8)', 'center', 700);
  }

  // Reveal overlay (name pop) and the results panel over the object zone (GDD 3.13, 8).
  drawReveal() {
    const ctx = this.ctx, e = this.t - this.revealT, r = this.result;
    if (e >= REVEAL.animAt) {
      const sq = this.fx.sq('name');
      ctx.save(); ctx.translate(WALL.cx, PANEL.y + PANEL.h - 40); ctx.scale(sq.sx, sq.sy);
      text(ctx, `${this.level.name.toUpperCase()}!`, 0, 0, 40, C.gold, 'center', 900, 7);
      ctx.restore();
    }
    if (e < REVEAL.results) return;
    const re = e - REVEAL.results;
    const k = easeOut(clamp01(re / 0.4));
    const w = 560, h = 600, x = 30 - (1 - k) * 660, y = 96;
    this.drawPanel(x, y, w, h);
    const cx = x + w / 2;
    text(ctx, this.level.name, cx, y + 50, 34, C.moon, 'center', 900);
    for (let i = 0; i < 3; i++) {
      const at = 0.35 + i * 0.25, lit = r.stars > i && re > at;
      let s = 1;
      if (lit) {
        const q = clamp01((re - at) / 0.22);
        s = 1 + (1 - q) * 1.2;
        if (!r[`stamp${i}`]) { r[`stamp${i}`] = true; this.sound.play('star', { i }); this.fx.shake(2, 0.08); this.fx.burst(cx - 110 + i * 110, y + 140, 10, C.gold, 200, 'spark', 0.5, 3); }
      }
      ctx.save(); ctx.translate(cx - 110 + i * 110, y + 140); ctx.scale(s, s);
      drawStar(ctx, 0, 0, i === 1 ? 46 : 40, lit ? C.gold : 'rgba(234,240,255,0.3)', !lit);
      ctx.restore();
    }
    const c = clamp01((re - 0.3) / 0.8);
    if (c > 0 && c < 1 && Math.floor(re * 30) !== this.lastCount) { this.lastCount = Math.floor(re * 30); this.sound.play('count', { k: c }); }
    text(ctx, `Time  ${fmtTime(r.time * c)}`, cx, y + 232, 32, C.cyan, 'center', 900);
    text(ctx, `Best ${fmtTime(r.best)}`, cx, y + 276, 22, 'rgba(234,240,255,0.8)', 'center', 800);
    if (r.newBest && re > 1.2) {
      ctx.save(); ctx.translate(cx + 170, y + 232); ctx.rotate(-0.15);
      text(ctx, 'NEW BEST', 0, 0, 22, C.pink, 'center', 900, 5);
      ctx.restore();
    }
    const need = r.stars === 3 ? `★★★ within ${Math.round(r.par)} s` : r.stars === 2 ? `★★★ needs ${Math.round(r.par)} s` : `★★ needs ${Math.round(2 * r.par)} s`;
    text(ctx, need, cx, y + 314, 22, C.gold, 'center', 800);
    if (r.first && re > 1.0) {
      const q = easeOutBack(clamp01((re - 1.0) / 0.3));
      ctx.save(); ctx.translate(cx, y + 360); ctx.scale(q, q);
      text(ctx, 'Added to your book!', 0, 0, 22, C.mint, 'center', 800);
      ctx.restore();
    }
    if (re < REVEAL.ignore) return;   // ignore presses for the first 300 ms
    const by = y + 420;
    this.addButton({ key: 'c:next', x: cx - 150, y: by, w: 300, h: 76, label: LEVELS.indexOf(this.level) < LEVELS.length - 1 ? 'NEXT ›' : 'BOOK ›', size: 32, color: C.gold, textColor: C.ink, stroke: '#FFF1C2', isDefault: true, action: () => this.goNext() });
    this.addButton({ key: 'c:retry', x: cx - 150, y: by + 92, w: 142, h: 60, label: 'RETRY', size: 22, action: () => this.startLevel(this.level) });
    this.addButton({ key: 'c:book', x: cx + 8, y: by + 92, w: 142, h: 60, label: 'BOOK', size: 22, action: () => this.toMenu('levels') });
  }
}
