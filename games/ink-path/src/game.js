// Screen flow (GDD 8), the attempt flow (GDD 3.4–3.7), the HUD, and the glue
// between pen, sim, render, sound, saving and analytics. Frame loop, buttons and
// panels adapted from Flip Runner.
import { VIEW_W, VIEW_H, HUD_H, FIELD_W, FIELD_H, STEP, MAX_FRAME_DT, BALL, PEN, CUP, FAIL, DROP_DELAY, WIN_DELAY, HINT_AFTER, SIM_VERSION, COLORS as C } from './config.js';
import { parseLevel, blockedAt } from './level.js';
import { Pen } from './pen.js';
import { Sim } from './sim.js';
import { Keys, pointerSamples } from './input.js';
import { Sound } from './audio.js';
import { FX } from './fx.js';
import { GA, levelId } from './analytics.js';
import { loadSave, storeSave, loadSettings, storeSettings } from './save.js';
import { rrect, text, drawPaper, renderLevelLayer, drawNoInk, drawInk, drawStar, drawCup, drawTrapdoor, drawBall, drawBubble, drawCross, drawHand, drawLock, drawNib, makeCursor } from './render.js';
import { WORLDS, LEVELS, LEVELS_PER_WORLD, findLevel } from '../levels/index.js';

const easeOutBack = k => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
const BUBBLES = { lost: 'Oops!', stuck: 'Stuck!', loop: 'Dizzy!', timeout: 'Too slow!' };
const METER = { x: 430, y: 24, w: 420, h: 30 };

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
    this.keys = new Keys(code => this.onKey(code));

    this.screen = 'title';
    this.paused = false;
    this.level = null;          // level module data
    this.lv = null;             // parsed level
    this.phase = 'ready';       // ready | drawing | setting | run | failed | won
    this.acc = 0;
    this.t = 0;
    this.buttons = [];
    this.focus = -1;
    this.hover = null;
    this.pressed = null;
    this.mouse = { x: VIEW_W / 2, y: VIEW_H / 2 };
    this.fixedHz = Number(this.params.get('hz')) || 0;
    this.result = null;
    this.penSpeed = 0;
    this.cursors = { pen: makeCursor(false), blocked: makeCursor(true) };

    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.cancelStroke(); this.pause(true); } });
    window.addEventListener('blur', () => this.cancelStroke());
    this.bindPointer();

    const lvParam = this.params.get('level');
    if (lvParam && findLevel(lvParam)) this.startLevel(findLevel(lvParam));

    this.api = this.makeApi();
    this.last = performance.now();
    requestAnimationFrame(now => this.frame(now));
  }

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
    if (this.lv) this.layer = renderLevelLayer(this.lv, this.scale * this.dpr);
  }

  toView(e) { return { x: (e.clientX - this.ox) / this.scale, y: (e.clientY - this.oy) / this.scale }; }

  // Buttons are rebuilt every frame, so they are matched by key, never by object.
  hitButton(p) {
    return this.buttons.find(b => !b.disabled && p.x >= b.x && p.x <= b.x + b.w && p.y >= (b.hy ?? b.y) && p.y <= (b.hy ?? b.y) + (b.hh ?? b.h)) || null;
  }

  bindPointer() {
    const cv = this.canvas;
    cv.addEventListener('pointerdown', e => {
      if (e.button !== undefined && e.button !== 0) return;
      this.sound.unlock();
      const p = this.toView(e);
      this.mouse = p;
      if (this.penPointer !== undefined && this.penPointer !== null) return;   // only the first pointer draws
      this.pressed = this.hitButton(p);
      if (this.pressed) { try { cv.setPointerCapture(e.pointerId); } catch { /* ok */ } return; }
      if (!this.canDraw() || p.y < HUD_H) return;   // a press on the HUD never starts a stroke
      this.penPointer = e.pointerId;
      try { cv.setPointerCapture(e.pointerId); } catch { /* ok */ }
      const f = this.toField(p);
      if (this.phase === 'run' || this.phase === 'setting') this.pendingRedraw = f;   // drag to redraw
      else this.beginStroke(f);
    });
    cv.addEventListener('pointermove', e => {
      const p = this.toView(e);
      this.mouse = p;
      this.hover = this.hitButton(p);
      if (e.pointerId === this.penPointer) {
        for (const s of pointerSamples(e)) this.penMove(this.toField(this.toView(s)));
      }
      this.updateCursor();
    });
    const up = (e, cancel) => {
      if (e.pointerId === this.penPointer) {
        this.penPointer = null;
        this.pendingRedraw = null;
        if (this.phase === 'drawing') { if (cancel) this.cancelStroke(); else this.release(); }
        return;
      }
      const b = this.hitButton(this.toView(e));
      if (!cancel && b && this.pressed && b.key === this.pressed.key) this.activate(b);
      this.pressed = null;
    };
    cv.addEventListener('pointerup', e => up(e, false));
    cv.addEventListener('pointercancel', e => up(e, true));
    cv.addEventListener('contextmenu', e => e.preventDefault());
  }

  updateCursor() {
    let c = 'default';
    if (this.hover) c = 'pointer';
    else if (this.canDraw() && this.mouse.y >= HUD_H) {
      const f = this.toField(this.mouse);
      c = blockedAt(this.lv, f.x, f.y) ? this.cursors.blocked : this.cursors.pen;
    }
    if (c !== this.cursor) { this.cursor = c; this.canvas.style.cursor = c; }
  }

  toField(p) { return { x: p.x, y: p.y - HUD_H }; }

  makeApi() {
    const g = this;
    return {
      get screen() { return g.screen; },
      get level() { return g.level ? g.level.id : null; },
      get score() { return g.result ? g.result.stars : 0; },
      get phase() { return g.phase; },
      get paused() { return g.paused; },
      get hint() { return g.hintOn; },
      get ink() { return g.pen ? g.pen.used : 0; },
      get attempts() { return g.visit ? g.visit.attempts : 0; },
      get sim() { return g.sim; },
      get save() { return g.save; },
      get ga() { return GA.log; },
      start() { g.startLevel(g.nextLevel()); },
      restart() { if (g.level) g.restartAttempt(); },
      // Debug only (removed in release): win at once with the gold line's ink.
      win() { if (g.screen === 'playing' && g.phase !== 'won') { g.line = g.line || { pts: g.level.refs.gold.pts, ink: g.level.refs.gold.ink }; g.onWin(); } },
      // Debug only: draw a line through the real pen (playfield coordinates) and let go.
      stroke(points) {
        if (g.screen !== 'playing' || g.paused || g.phase === 'won') return false;
        if (g.phase === 'run' || g.phase === 'setting') g.abandonRun('redraw');
        g.beginStroke({ x: points[0][0], y: points[0][1] });
        for (let i = 1; i < points.length; i++) {
          const [ax, ay] = points[i - 1], [bx, by] = points[i];
          const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 3));
          for (let k = 1; k <= n; k++) g.penMove({ x: ax + (bx - ax) * k / n, y: ay + (by - ay) * k / n });
        }
        g.release();
        return true;
      },
    };
  }

  // ---- Levels -----------------------------------------------------------------

  levelPos(id) {
    for (let w = 0; w < WORLDS.length; w++) {
      const i = WORLDS[w].levels.findIndex(l => l.id === id);
      if (i >= 0) return { world: w + 1, level: i + 1 };
    }
    return { world: 1, level: 0 };
  }

  lid(level = this.level) { const p = this.levelPos(level.id); return levelId(p.world, p.level); }
  rec(id) { return this.save.levels[id] || null; }
  nextLevel() { return LEVELS.find(l => !this.rec(l.id)) || LEVELS[0]; }

  // GDD 7: finishing a level unlocks the next; the two after the furthest finished one are open.
  isOpen(level) {
    let furthest = -1;
    LEVELS.forEach((l, i) => { if (this.rec(l.id)) furthest = i; });
    return LEVELS.indexOf(level) <= furthest + 2;
  }

  startLevel(level) {
    if (this.screen === 'playing' && this.level) this.endVisit(false);
    const fromComplete = this.screen === 'complete' && this.level && this.level.id === level.id && this.line;
    this.level = level;
    this.lv = parseLevel(level);
    this.layer = renderLevelLayer(this.lv, this.scale * this.dpr);
    this.screen = 'playing';
    this.paused = false;
    this.ghost = fromComplete ? this.line.pts : null;   // Retry keeps the winning line as the ghost
    this.line = null;
    this.sim = null;
    this.pen = new Pen((x, y) => blockedAt(this.lv, x, y), this.lv.ink);
    this.phase = 'ready';
    this.acc = 0;
    this.result = null;
    this.beads = [];
    this.hintOn = false;
    this.focus = -1;
    this.buttons = [];
    this.fx.clear();
    this.introT = this.t;
    this.visit = { attempts: 0, fails: 0, causes: { lost: 0, stuck: 0, loop: 0, timeout: 0, redraw: 0 }, blocked: 0, dry: 0, cancel: 0, restarts: 0, ended: false };
    this.view = this.lv.balls.map(b => ({ x: b.x, y: b.y, spin: 0, vx: 0, vy: 0 }));
    const r = this.rec(level.id);
    if (r) GA.design(`level:replay:${this.lid()}`, r.stars);
    const next = this.nextLevel();
    if (LEVELS.indexOf(level) > LEVELS.indexOf(next) && this.rec(next.id) === null) GA.design('ui:skip');
  }

  // Level end (complete or leave): per-action counts, once, with a value (GDD 11).
  endVisit(completed) {
    const v = this.visit;
    if (!v || v.ended) return;
    v.ended = true;
    if (this.phase === 'run') this.abandonRun('leave');
    const id = this.lid();
    if (!completed && v.attempts > 0) GA.design(`level:abandon:${id}`, v.attempts);
    for (const k in v.causes) if (v.causes[k]) GA.design(`fail:${k}:${id}`, v.causes[k]);
    if (v.blocked) GA.design('stroke:blocked', v.blocked);
    if (v.dry) GA.design('stroke:dry', v.dry);
    if (v.cancel) GA.design('stroke:cancel', v.cancel);
    if (v.restarts) GA.design('ui:restart', v.restarts);
  }

  toMenu(screen = 'title') {
    if (this.screen === 'playing') { this.cancelStroke(); this.endVisit(false); }
    this.screen = screen;
    this.paused = false;
    this.sim = null;
    this.focus = -1;
    this.sound.setLayer(this.sound.scratch, 0);
    this.sound.setLayer(this.sound.rumble, 0);
    this.sound.rolling = 0;
  }

  pause(on) {
    if (this.screen !== 'playing' || this.phase === 'won' || this.paused === on) return;
    if (on) this.cancelStroke();
    this.paused = on;
    this.focus = on ? 0 : -1;
    this.sound.setLayer(this.sound.rumble, 0);
  }

  // ---- Attempt flow -------------------------------------------------------------

  canDraw() { return this.screen === 'playing' && !this.paused && this.phase !== 'won'; }

  beginStroke(f) {
    if (this.phase === 'failed') this.resetAttempt(true);
    this.pen.begin(f.x, f.y);
    this.phase = 'drawing';
    this.beads = [];
    this.lastUsed = 0;
    if (!this.save.tut.s1) { this.save.tut.s1 = true; storeSave(this.save); GA.design('tutorial:step01'); }
  }

  penMove(f) {
    if (this.phase !== 'drawing') {
      const r = this.pendingRedraw;
      if (r && (this.phase === 'run' || this.phase === 'setting') && Math.hypot(f.x - r.x, f.y - r.y) > PEN.redrawDrag) {
        this.abandonRun('redraw');
        this.beginStroke(r);
        this.pendingRedraw = null;
      } else return;
    }
    const before = this.pen.used, wasActive = this.pen.active;
    this.pen.move(f.x, f.y);
    if (!wasActive && this.pen.active) this.sound.play('tk', {});
    const used = this.pen.used, m = this.lv.marks;
    for (const [mark, n] of [[m.three, 3], [m.two, 2]]) {
      if (before <= mark && used > mark) {
        this.beads.push({ x: this.pen.tip[0], y: this.pen.tip[1], n, t: this.t });
        this.sound.play('pip');
        const pos = this.markX(mark);
        this.fx.spawn({ x: pos, y: METER.y + METER.h + 13, type: 'fly', tx: this.pen.tip[0], ty: this.pen.tip[1] + HUD_H, life: 0.5 });
      }
    }
    this.penSpeed = Math.min(1, (used - before) / 12);
    for (const e of this.pen.events) {
      if (e.type === 'blocked') { this.sound.play('tk'); this.blockFlash = this.t; }
      else if (e.type === 'dry') { this.sound.play('dry'); this.fx.burst(this.pen.tip[0], this.pen.tip[1] + HUD_H, 8, C.ink, 120, 'dot', 0.3, 3, 300); }
    }
    this.pen.events.length = 0;
    // pen scratch particles at the tip
    if (used > before && this.fx.rnd() < 0.5) this.fx.spawn({ x: this.pen.tip[0], y: this.pen.tip[1] + HUD_H, vx: (this.fx.rnd() - 0.5) * 80, vy: -30 - this.fx.rnd() * 40, color: 'rgba(58,111,216,0.5)', type: 'dot', size: 2, life: 0.3, g: 300 });
  }

  cancelStroke(counted = false) {
    if (this.phase !== 'drawing') return;
    if (counted) this.visit.cancel++;
    this.countStrokeFlags();
    this.pen.reset();
    this.phase = 'ready';
    this.beads = [];
    this.penPointer = null;
    this.sound.setLayer(this.sound.scratch, 0);
  }

  countStrokeFlags() {
    if (this.pen.hitBlocked) this.visit.blocked++;
    if (this.pen.dry) this.visit.dry++;
  }

  release() {
    if (this.phase !== 'drawing') return;
    const res = this.pen.finish();
    if (!res) {
      // A click or a line under 20 px does nothing; a real short line counts as canceled.
      if (this.pen.used > 0) this.visit.cancel++;
      this.countStrokeFlags();
      this.pen.reset();
      this.phase = 'ready';
      return;
    }
    this.countStrokeFlags();
    this.line = res;
    this.ghost = null;          // the ghost lasts until the next release
    this.phase = 'setting';
    this.setT = this.t;
    this.sound.play('set');
    this.sound.setLayer(this.sound.scratch, 0);
    this.fx.burst(res.pts[res.pts.length - 1][0], res.pts[res.pts.length - 1][1] + HUD_H, 8, '#fff', 120, 'spark', 0.25, 3, 0);
  }

  drop() {
    this.sim = new Sim(this.lv, this.line.pts);
    this.view = this.sim.balls.map(b => ({ x: b.x, y: b.y, spin: 0, vx: 0, vy: 0 }));
    this.phase = 'run';
    this.acc = 0;
    this.runT = this.t;
    this.visit.attempts++;
    const p = this.levelPos(this.level.id);
    GA.progression('Start', p.world, p.level);
    if (!this.save.tut.s2) { this.save.tut.s2 = true; storeSave(this.save); GA.design('tutorial:step02'); }
    this.sound.play('clack');
    for (const b of this.lv.balls) this.fx.kick(`b${this.lv.balls.indexOf(b)}`, 0.8, 1.2);   // little gulp
  }

  // A run ends without a win because of the player: a new line, R, or leaving.
  abandonRun(reason) {
    if (this.phase === 'run') {
      const p = this.levelPos(this.level.id);
      GA.progression('Fail', p.world, p.level);
      if (reason === 'redraw') this.visit.causes.redraw++;
      if (this.sim.time >= 1) this.visit.fails++;   // runs cut short in under 1 s don't count for the hint
    }
    if (this.phase === 'run' || this.phase === 'setting' || this.phase === 'failed') this.resetAttempt(true);
  }

  restartAttempt() {
    if (this.screen !== 'playing' || this.phase === 'won') return;
    if (this.phase === 'drawing') { this.cancelStroke(true); return; }
    if (this.phase === 'ready' && !this.ghost) return;
    this.visit.restarts++;
    this.abandonRun('restart');
    this.sound.play('glug');
  }

  onFail(e) {
    const p = this.levelPos(this.level.id);
    GA.progression('Fail', p.world, p.level);
    this.visit.causes[e.cause]++;
    this.visit.fails++;
    this.phase = 'failed';
    this.failT = this.t;
    this.failInfo = { cause: e.cause, ball: e.ball, label: e.close ? 'So close!' : BUBBLES[e.cause] };
    const v = this.view[e.ball];
    if (e.cause === 'lost') {
      const x = Math.max(12, Math.min(FIELD_W - 12, e.x)), y = Math.max(12, Math.min(FIELD_H - 12, e.y));
      v.splat = { x, y };
      this.fx.burst(x, y + HUD_H, 18, C.coral, 300, 'dot', 0.5, 5, 400);
      this.fx.shake(4, 0.15);
      this.sound.play('bwomp');
    } else this.sound.play(e.cause === 'loop' ? 'warble' : 'bwomp');
  }

  // Back to drawing: the line becomes the ghost, balls back, the meter refills.
  resetAttempt(quick) {
    if (this.line) this.ghost = this.line.pts;
    this.line = null;
    this.sim = null;
    this.failInfo = null;
    this.phase = 'ready';
    this.pen.reset();
    this.beads = [];
    this.view = this.lv.balls.map(b => ({ x: b.x, y: b.y, spin: 0, vx: 0, vy: 0, pop: this.t }));
    this.lv.balls.forEach((b, i) => this.fx.kick(`b${i}`, 1.3, 0.7));
    this.refillT = this.t;
    if (!quick) this.sound.play('glug');
    this.sound.setLayer(this.sound.rumble, 0);
    this.sound.rolling = 0;
  }

  onWin() {
    this.phase = 'won';
    this.wonT = this.t;
    this.sound.setLayer(this.sound.rumble, 0);
    this.sound.rolling = 0;
    const level = this.level, ink = this.line.ink, pot = this.lv.ink, m = this.lv.marks;
    const stars = ink <= m.three ? 3 : ink <= m.two ? 2 : 1;
    const pct = Math.round(ink / pot * 100);
    const dev = level.refs.gold.ink;
    const old = this.rec(level.id);
    const rec = old ? { ...old } : { stars: 0, ink: null, pct: null, nib: false, best: null, sv: SIM_VERSION };
    const id = this.lid(), p = this.levelPos(level.id);
    GA.progression('Complete', p.world, p.level, stars);
    GA.design(`level:attempts:${id}`, this.visit.attempts);
    GA.design(`level:ink_used:${id}`, pct);
    if (old && stars > old.stars) GA.design(`stars:improve:${id}`, stars);
    rec.stars = Math.max(rec.stars, stars);
    const newBest = old !== null && (old.ink === null || ink < old.ink);
    if (rec.ink === null || ink < rec.ink) { rec.ink = Math.round(ink); rec.pct = pct; rec.best = this.line.pts; rec.sv = SIM_VERSION; }
    let nib = false;
    if (ink <= dev && !rec.nib) { rec.nib = true; nib = true; GA.design(`nib:earned:${id}`, pct); }
    this.save.levels[level.id] = rec;
    if (level.id === 'w1l01' && !this.save.tut.s3) { this.save.tut.s3 = true; GA.design('tutorial:step03'); }
    if (level.id === 'w1l03' && !this.save.tut.done) { this.save.tut.done = true; GA.design('tutorial:done'); }
    storeSave(this.save);
    this.endVisit(true);
    this.result = { stars, pct, ink, tries: this.visit.attempts, newBest, nib, devPct: Math.round(dev / pot * 100), bestPct: rec.pct, shownAt: 0 };
  }

  // ---- Input ------------------------------------------------------------------

  onKey(code) {
    this.sound.unlock();
    if (this.screen === 'playing' && !this.paused) {
      if (code === 'KeyP' || code === 'Escape') { if (this.phase !== 'won') { this.pause(true); this.sound.play('click'); } return; }
      if (code === 'KeyR') { this.restartAttempt(); return; }
      if ((code === 'KeyZ' || code === 'Backspace') && this.phase === 'drawing') { this.cancelStroke(true); this.sound.play('click'); return; }
      if (code === 'KeyH' && this.hintReady()) { this.showHint(); return; }
      return;
    }
    if (this.screen === 'playing' && this.paused && (code === 'KeyP' || code === 'Escape')) { this.pause(false); return; }
    if (this.screen === 'complete' && (code === 'Enter' || code === 'Space') && this.focus < 0) { this.goNext(); return; }
    if (this.screen === 'complete' && code === 'KeyR') { this.startLevel(this.level); return; }

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

  hintReady() {
    return this.screen === 'playing' && !this.hintOn && !this.lv.guide && this.level.refs && this.visit.fails >= HINT_AFTER;
  }

  showHint() {
    this.hintOn = true;
    GA.design('ui:hint', this.visit.fails);
  }

  goNext() {
    const i = LEVELS.indexOf(this.level), next = LEVELS[i + 1];
    if (next) this.startLevel(next); else this.toMenu('levels');
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
    dt = Math.min(Math.max(dt, 0), MAX_FRAME_DT);
    this.t += dt;
    if (this.screen === 'playing' && !this.paused) this.update(dt);
    this.fx.update(dt);
    this.draw();
    requestAnimationFrame(n => this.frame(n));
  }

  update(dt) {
    if (this.phase === 'drawing') { this.sound.setLayer(this.sound.scratch, this.penSpeed || 0); this.penSpeed *= 0.8; }
    if (this.phase === 'setting' && this.t - this.setT >= DROP_DELAY) this.drop();
    if (this.phase === 'run') {
      this.acc += dt;
      while (this.acc >= STEP && this.phase === 'run') {
        this.sim.step();
        this.acc -= STEP;
        this.handleEvents();
      }
      this.updateView(dt);
    }
    if (this.phase === 'failed' && this.t - this.failT >= FAIL.feedback + FAIL.reset) this.resetAttempt(false);
    if (this.phase === 'won' && this.t - this.wonT >= WIN_DELAY) { this.screen = 'complete'; this.focus = -1; }
  }

  handleEvents() {
    const fx = this.fx, snd = this.sound;
    for (const e of this.sim.events) {
      switch (e.type) {
        case 'land': {
          const k = Math.min(1, e.speed / 900);
          snd.play(e.kind === 'ink' ? 'pat' : 'thud', { k });
          fx.kick(`b${e.ball}`, 1 + k * 0.4, 1 - k * 0.35);
          if (e.kind !== 'ink') fx.dust(e.x, e.y + BALL.r + HUD_H, 5);
          if (e.kind !== 'ink' && e.speed > 700) fx.shake(3, 0.12);
          break;
        }
        case 'lip': snd.play('lip'); break;
        case 'capture': {
          const c = this.lv.cups[e.cup], v = this.view[e.ball];
          v.inCup = e.cup; v.capT = this.t;
          snd.play('plop'); snd.play('cheer');
          if (e.label === 'Swish!') snd.play('swish');
          fx.kick(`cup${e.cup}`, 1.25, 0.8);
          fx.kick(`b${e.ball}`, 1.4, 0.6);
          fx.burst(c.x, c.y + HUD_H, 40, C.yellow, 460, 'confetti', 1.2, 5, 700);
          fx.burst(c.x, c.y + HUD_H, 24, C.coral, 380, 'confetti', 1.1, 4, 700);
          fx.burst(c.x, c.y + HUD_H, 24, C.green, 380, 'confetti', 1.1, 4, 700);
          fx.spawn({ x: c.x, y: c.y - 60 + HUD_H - c.board * 0.3, vy: -50, g: 0, type: 'text', label: e.label, size: 34, color: C.yellow, life: 1.0 });
          this.punchT = this.t;
          break;
        }
        case 'fail': this.onFail(e); break;
        case 'win': this.onWin(); break;
      }
      if (this.phase !== 'run') break;
    }
    this.sim.events.length = 0;
  }

  updateView(dt) {
    if (!this.sim) return;
    const a = Math.min(1, this.acc / STEP);
    let rolling = 0;
    this.sim.balls.forEach((b, i) => {
      const v = this.view[i];
      if (b.state === 'in') return;
      v.x = b.px + (b.x - b.px) * a; v.y = b.py + (b.y - b.py) * a;
      v.vx = b.vx; v.vy = b.vy;
      const sp = Math.hypot(b.vx, b.vy);
      if (b.touch) { v.spin += (b.vx >= 0 ? 1 : -1) * sp * dt / BALL.r; rolling = Math.max(rolling, sp / 900); }
      else v.spin += (b.vx >= 0 ? 1 : -1) * dt * 2;
      if (sp > 900 && this.fx.rnd() < 0.6) this.fx.spawn({ x: v.x, y: v.y + HUD_H, color: C.coral, type: 'ghost', life: 0.18, size: BALL.r * 0.8, g: 0 });
    });
    this.sound.setLayer(this.sound.rumble, rolling);
    this.sound.rolling = rolling;
  }

  // ---- Drawing ---------------------------------------------------------------

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.outline;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.ox, this.dpr * this.oy);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, VIEW_W, VIEW_H); ctx.clip();

    this.buttons = [];
    if (this.screen === 'title') this.drawTitle();
    else if (this.screen === 'levels') this.drawLevels();
    else if (this.lv) {
      this.drawField();
      this.drawHud();
      const [sx, sy] = this.fx.offset();
      ctx.save(); ctx.translate(sx, sy); this.fx.draw(ctx); ctx.restore();
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
    ctx.save();
    ctx.translate(0, lift);
    rrect(ctx, b.x, b.y + 5, b.w, b.h, r); ctx.fillStyle = C.outline; ctx.fill();
    rrect(ctx, b.x, b.y, b.w, b.h, r);
    ctx.fillStyle = b.disabled ? '#DDD6CA' : (b.color || '#fff'); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = C.outline; ctx.stroke();
    if (focused || hot) { ctx.lineWidth = 3; ctx.strokeStyle = C.ink; rrect(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12, r + 6); ctx.stroke(); }
    if (b.draw) b.draw(ctx, b);
    else text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.size || 26, b.disabled ? '#9A948A' : (b.textColor || C.outline), 'center', 900);
    ctx.restore();
    return b;
  }

  settingsButtons(x, y, w = 200) {
    this.addButton({ key: 'sound', x, y, w, h: 52, size: 20, label: this.settings.sfx ? 'SOUND: ON' : 'SOUND: OFF', action: () => this.toggleSfx() });
    this.addButton({ key: 'music', x: x + w + 16, y, w, h: 52, size: 20, label: this.settings.music ? 'MUSIC: ON' : 'MUSIC: OFF', action: () => this.toggleMusic() });
  }

  drawTitle() {
    const ctx = this.ctx, t = this.t;
    drawPaper(ctx, VIEW_W, VIEW_H);
    // Logo: INK PATH, and Dot rolling along a swoosh of ink under it.
    ctx.save(); ctx.translate(VIEW_W / 2, 150 + Math.sin(t * 2) * 3); ctx.rotate(-0.03);
    text(ctx, 'INK PATH', 0, 0, 112, C.ink, 'center', 900, 16);
    ctx.restore();
    const swoosh = [];
    for (let i = 0; i <= 40; i++) { const k = i / 40; swoosh.push([300 + k * 680, 250 + Math.sin(k * Math.PI) * 50 - k * 20]); }
    drawInk(ctx, swoosh, 'solid');
    const k = (t * 0.25) % 1, e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) ** 2;
    const i = Math.min(39, Math.floor(e * 40)), f = e * 40 - i;
    const bx = swoosh[i][0] + (swoosh[i + 1][0] - swoosh[i][0]) * f, by = swoosh[i][1] + (swoosh[i + 1][1] - swoosh[i][1]) * f;
    const ang = Math.atan2(swoosh[i + 1][1] - swoosh[i][1], swoosh[i + 1][0] - swoosh[i][0]);
    drawBall(ctx, bx - Math.sin(ang) * -23, by - Math.cos(ang) * 23, { spin: e * 40, mood: 'happy' });

    this.addButton({ key: 'play', x: VIEW_W / 2 - 170, y: 360, w: 340, h: 96, label: 'PLAY', size: 46, color: C.yellow, isDefault: true,
      action: () => this.startLevel(this.nextLevel()) });
    this.addButton({ key: 'levels', x: VIEW_W / 2 - 120, y: 480, w: 240, h: 64, label: 'LEVELS', size: 26, action: () => { this.screen = 'levels'; this.focus = -1; } });
    this.settingsButtons(VIEW_W / 2 - 216, 590);
    text(ctx, 'Draw one line. Let go. Get Dot in the cup.', VIEW_W / 2, 685, 18, C.grey, 'center', 700);
  }

  drawLevels() {
    const ctx = this.ctx, t = this.t;
    drawPaper(ctx, VIEW_W, VIEW_H);
    this.addButton({ key: 'back', x: 30, y: 24, w: 150, h: 58, label: '‹ BACK', size: 22, action: () => this.toMenu('title') });
    WORLDS.forEach((w, i) => {
      const x = 240 + i * 210, open = w.levels.length > 0;
      rrect(ctx, x, 30, 190, 50, 12);
      ctx.fillStyle = open ? C.yellow : '#DDD6CA'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.outline; ctx.stroke();
      text(ctx, `${i + 1} ${w.name.toUpperCase()}`, x + 95 - (open ? 0 : 12), 56, 20, open ? C.outline : C.grey, 'center', 900);
      if (!open) drawLock(ctx, x + 166, 56, 0.6);
    });
    const next = this.nextLevel();
    const world = WORLDS[0];
    for (let i = 0; i < LEVELS_PER_WORLD; i++) {
      const col = i % 5, row = Math.floor(i / 5);
      const x = 190 + col * 190, y = 150 + row * 250;
      const level = world.levels[i];
      const open = level && this.isOpen(level);
      if (!open) {
        ctx.save(); ctx.translate(x + 75, y + 80); ctx.rotate(((i * 37) % 7 - 3) * 0.01);
        rrect(ctx, -75, -80, 150, 160, 10); ctx.fillStyle = '#E8E1D4'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.outline; ctx.stroke();
        text(ctx, String(i + 1), 0, -26, 40, '#B9B1A3', 'center', 900);
        drawLock(ctx, 0, 34, 1);
        ctx.restore();
        continue;
      }
      const r = this.rec(level.id);
      const isNext = level === next && !r;
      const bounce = isNext ? Math.abs(Math.sin(t * 4)) * -8 : 0;
      this.addButton({
        key: `level:${level.id}`, x, y: y + bounce, w: 150, h: 160, r: 10, color: isNext ? '#FFE08A' : '#FFF6C9', isDefault: isNext,
        action: () => this.startLevel(level),
        draw: (c, b) => {
          text(c, String(i + 1), b.x + 75, b.y + 44, 44, C.outline, 'center', 900);
          text(c, level.name, b.x + 75, b.y + 82, 15, C.outline, 'center', 700);
          for (let s = 0; s < 3; s++) drawStar(c, b.x + 39 + s * 36, b.y + 114, 14, r && r.stars > s ? C.yellow : '#E3DDD0');
          if (r) text(c, `${r.pct}% ink`, b.x + 75, b.y + 143, 15, C.ink, 'center', 800);
          if (r && r.nib) drawNib(c, b.x + 130, b.y + 20, 0.9);
        },
      });
    }
    text(ctx, 'More levels in the full game', VIEW_W / 2, VIEW_H - 30, 18, C.grey, 'center', 700);
  }

  markX(mark) { return METER.x + METER.w * (1 - mark / this.lv.ink); }

  drawHud() {
    const ctx = this.ctx, t = this.t, lv = this.lv;
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, VIEW_W, HUD_H);
    ctx.fillStyle = 'rgba(43,43,43,0.12)'; ctx.fillRect(0, HUD_H - 4, VIEW_W, 4);
    ctx.strokeStyle = C.outline; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, HUD_H); ctx.lineTo(VIEW_W, HUD_H); ctx.stroke();
    const live = this.screen === 'playing' && !this.paused && this.phase !== 'won';
    // left: pause and the level name
    const pause = { key: 'hud:pause', hud: true, x: 14, y: 8, w: 64, h: 64, hy: 0, hh: HUD_H, r: 32, action: () => this.pause(true),
      draw: (c, b) => { c.fillStyle = C.outline; c.fillRect(b.x + 22, b.y + 19, 7, 26); c.fillRect(b.x + 35, b.y + 19, 7, 26); } };
    if (live) this.addButton(pause);
    const p = this.levelPos(this.level.id);
    text(ctx, `${p.world}-${p.level}  ${this.level.name}`, 96, 40, 24, C.outline, 'left', 900);

    // center: the ink meter, a pen-shaped bar with star notches
    const used = this.phase === 'drawing' ? this.pen.used : this.line ? this.line.ink : 0;
    let left = Math.max(0, 1 - used / lv.ink);
    if (this.phase === 'ready' && this.refillT && t - this.refillT < 0.25) left = (t - this.refillT) / 0.25;
    const intro = t - this.introT < 2.5 ? Math.abs(Math.sin((t - this.introT) * 8)) * (1 - (t - this.introT) / 2.5) : 0;
    const { x, y, w, h } = METER;
    ctx.save();
    if (lv.intro === 'meter' && intro) { ctx.translate(x + w / 2, y + h / 2); ctx.scale(1 + intro * 0.12, 1 + intro * 0.12); ctx.translate(-(x + w / 2), -(y + h / 2)); }
    rrect(ctx, x, y, w, h, 12); ctx.fillStyle = '#fff'; ctx.fill();
    if (left > 0) { rrect(ctx, x, y, Math.max(16, w * left), h, 12); ctx.fillStyle = C.ink; ctx.fill(); }
    rrect(ctx, x, y, w, h, 12); ctx.lineWidth = 3; ctx.strokeStyle = C.outline; ctx.stroke();
    // nib at the end
    ctx.beginPath(); ctx.moveTo(x + w + 2, y + 4); ctx.lineTo(x + w + 26, y + h / 2); ctx.lineTo(x + w + 2, y + h - 4); ctx.closePath();
    ctx.fillStyle = C.outline; ctx.fill();
    ctx.restore();
    const starBounce = lv.intro === 'stars' ? intro : 0;
    for (const [mark, n] of [[lv.marks.three, '3'], [lv.marks.two, '2']]) {
      const mx = this.markX(mark), passed = used > mark;
      ctx.fillStyle = C.outline; ctx.fillRect(mx - 1.5, y - 4, 3, h + 8);
      const sy = y + h + 13 - starBounce * 10;
      ctx.globalAlpha = passed ? 0.3 : 1;
      drawStar(ctx, mx, sy, 11 + starBounce * 3, C.yellow, n);
      ctx.globalAlpha = 1;
    }
    if (lv.intro === 'stars' && t - this.introT < 4) {
      ctx.globalAlpha = Math.min(1, (4 - (t - this.introT)) * 2);
      text(ctx, 'Less ink, more stars', this.markX(lv.marks.three), y + h + 40, 18, C.ink, 'center', 900);
      ctx.globalAlpha = 1;
    }
    text(ctx, `${Math.round(used / lv.ink * 100)}% used`, x + w + 36, y + h / 2, 18, C.outline, 'left', 800);

    // right: tries, hint, restart
    const tries = this.visit.attempts + (this.phase === 'ready' || this.phase === 'drawing' ? 1 : 0);
    text(ctx, `Try ${Math.max(1, tries)}`, 1040, 40, 22, C.outline, 'center', 900);
    if (live && this.hintReady()) {
      const wig = Math.sin(t * 12) * 0.12 * (Math.sin(t * 2) > 0 ? 1 : 0);
      this.addButton({ key: 'hud:hint', hud: true, x: 1100, y: 8, w: 64, h: 64, hy: 0, hh: HUD_H, r: 32, color: C.yellow, action: () => this.showHint(),
        draw: (c, b) => {
          c.save(); c.translate(b.x + 32, b.y + 30); c.rotate(wig);
          c.beginPath(); c.arc(0, -4, 13, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 3; c.strokeStyle = C.outline; c.stroke();
          c.fillStyle = C.outline; c.fillRect(-6, 10, 12, 8);
          c.restore();
        } });
    }
    if (live) this.addButton({ key: 'hud:restart', hud: true, x: 1196, y: 8, w: 64, h: 64, hy: 0, hh: HUD_H, r: 32, action: () => this.restartAttempt(),
      draw: (c, b) => {
        c.strokeStyle = C.outline; c.lineWidth = 5; c.lineCap = 'round';
        c.beginPath(); c.arc(b.x + 32, b.y + 32, 15, -0.3, Math.PI * 1.55); c.stroke();
        c.fillStyle = C.outline; c.beginPath(); c.moveTo(b.x + 47, b.y + 15); c.lineTo(b.x + 50, b.y + 33); c.lineTo(b.x + 33, b.y + 26); c.fill();
      } });
  }

  // First solid thing straight below a waiting ball (drop preview, GDD 3.5).
  dropPreview(b, live) {
    let best = Infinity;
    const test = (ax, ay, bx2, by2, r) => {
      if ((ax - b.x) * (bx2 - b.x) > 0 || ax === bx2) return;
      const y = ay + (by2 - ay) * (b.x - ax) / (bx2 - ax) - r;
      if (y > b.y + BALL.r && y < best) best = y;
    };
    for (const s of this.lv.segs) test(s.ax, s.ay, s.bx, s.by, 0);
    for (let i = 1; i < live.length; i++) test(live[i - 1][0], live[i - 1][1], live[i][0], live[i][1], PEN.inkR);
    return best;
  }

  drawField() {
    const ctx = this.ctx, t = this.t, lv = this.lv;
    const [sx, sy] = this.fx.offset();
    ctx.save();
    ctx.translate(sx, HUD_H + sy);
    if (this.punchT && t - this.punchT < 0.2) {
      const k = 1 + 0.02 * Math.sin((t - this.punchT) / 0.2 * Math.PI);
      ctx.translate(FIELD_W / 2, FIELD_H / 2); ctx.scale(k, k); ctx.translate(-FIELD_W / 2, -FIELD_H / 2);
    }
    ctx.drawImage(this.layer, 0, 0, FIELD_W, FIELD_H);
    if (this.blockFlash && t - this.blockFlash < 0.3) for (const z of lv.walls) drawNoInk(ctx, z, 1 - (t - this.blockFlash) / 0.3);

    const drawing = this.phase === 'drawing';
    const waiting = this.phase === 'ready' || drawing;
    const liveLine = drawing ? this.pen.line() : [];

    // overlays: guide (level 1), hint, ghost
    if (lv.guide && waiting) {
      drawInk(ctx, lv.guide, 'guide', t);
      if (!drawing) {
        const g = lv.guide, k = ((t * 0.45) % 1.3) / 1.0;
        if (k <= 1) {
          const f = k * (g.length - 1), i = Math.min(g.length - 2, Math.floor(f)), u = f - i;
          drawHand(ctx, g[i][0] + (g[i + 1][0] - g[i][0]) * u, g[i][1] + (g[i + 1][1] - g[i][1]) * u, Math.sin(k * Math.PI));
        }
      }
    }
    if (this.hintOn && waiting) {
      const h = this.level.refs.easy.pts;
      drawInk(ctx, h, 'hint');
      text(ctx, '💡', h[0][0] - 18, h[0][1] - 18, 22);
    }
    if (this.ghost && waiting) drawInk(ctx, this.ghost, 'ghost');

    // cups
    lv.cups.forEach((c, i) => drawCup(ctx, c, t, this.fx.sq(`cup${i}`)));

    // the line
    if (drawing) drawInk(ctx, liveLine, 'live');
    else if (this.line && this.phase !== 'ready') {
      const fresh = this.phase === 'setting' || (this.phase === 'run' && t - this.runT < 0.15);
      ctx.save();
      if (this.phase === 'failed') ctx.globalAlpha = Math.max(0.25, 1 - (t - this.failT - FAIL.feedback) / FAIL.reset);
      drawInk(ctx, this.line.pts, fresh ? 'set' : 'solid');
      ctx.restore();
    }
    if (drawing || this.phase === 'setting' || this.phase === 'run') for (const b of this.beads) drawStar(ctx, b.x, b.y, 9, C.yellow);

    // trapdoors, drop preview, balls
    lv.balls.forEach((b, i) => {
      const open = this.phase === 'run' ? Math.min(1, (t - this.runT) / 0.12) : 0;
      drawTrapdoor(ctx, b, open);
      if (waiting) {
        const y = this.dropPreview(b, liveLine);
        ctx.save(); ctx.setLineDash([3, 7]); ctx.strokeStyle = 'rgba(43,43,43,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(b.x, b.y + BALL.r + 14); ctx.lineTo(b.x, Math.min(y, FIELD_H)); ctx.stroke(); ctx.restore();
        if (y < FIELD_H) drawCross(ctx, b.x, y - 6, 6, 'rgba(43,43,43,0.6)');
        else text(ctx, '↓', b.x, FIELD_H - 14, 22, 'rgba(43,43,43,0.6)', 'center', 900);
      }
    });
    this.drawBalls();

    // blocked tether and the ring at the pen tip
    if (drawing && this.pen.active) {
      const [tx, ty] = this.pen.tip;
      if (this.pen.tether && this.pen.ptr) {
        const [px, py] = this.pen.ptr;
        ctx.strokeStyle = C.coral; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke();
        drawCross(ctx, px, py, 7, C.coral);
      }
      const left = this.pen.left / lv.ink;
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(43,43,43,0.2)';
      ctx.beginPath(); ctx.arc(tx, ty, 16, 0, Math.PI * 2); ctx.stroke();
      if (left > 0) { ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.arc(tx, ty, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left); ctx.stroke(); }
      if (this.pen.dry && Math.sin(t * 40) > 0) drawCross(ctx, tx + 20, ty - 20, 5, C.ink);
    }
    ctx.restore();
  }

  drawBalls() {
    const ctx = this.ctx, t = this.t, lv = this.lv;
    lv.balls.forEach((b0, i) => {
      const v = this.view[i] || { x: b0.x, y: b0.y, spin: 0, vx: 0, vy: 0 };
      const sq = this.fx.sq(`b${i}`);
      const sim = this.sim, sb = sim ? sim.balls[i] : null;
      let mood = 'idle', look = [0, 0], x = v.x, y = v.y;
      if (this.phase === 'drawing' && this.pen.active) {
        const dx = this.pen.tip[0] - x, dy = this.pen.tip[1] - y, d = Math.hypot(dx, dy) || 1;
        look = [dx / d * 2.5, dy / d * 2.5];
        if (dy > 0 && Math.abs(dx) < 60) mood = 'squint';
      }
      if (sb && sb.state === 'live') {
        const sp = Math.hypot(v.vx, v.vy);
        mood = sp > 700 ? 'fast' : sb.touch ? 'idle' : 'fall';
        look = [v.vx / (sp || 1) * 2.5, v.vy / (sp || 1) * 2.5];
      }
      if (v.inCup !== undefined) {
        const c = lv.cups[v.inCup], k = Math.min(1, (t - v.capT) / 0.15);
        x = v.x + (c.x - v.x) * k; y = v.y + (c.y + CUP.depth - BALL.r - v.y) * k;
        mood = 'happy';
      }
      if (this.phase === 'failed' && this.failInfo && this.failInfo.ball === i) {
        mood = 'dizzy';
        if (v.splat) { x = v.splat.x; y = v.splat.y; }
      }
      let sx = sq.sx, sy = sq.sy;
      if (this.phase === 'ready' && v.pop !== undefined && t - v.pop < 0.25) { const k = easeOutBack((t - v.pop) / 0.25); sx *= k; sy *= k; }
      drawBall(ctx, x, y, { sx, sy, spin: v.spin, look, mood });
      if (y < -BALL.r) { // off the top: an arrow tracks it
        ctx.fillStyle = C.coral; ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x - 10, 20); ctx.lineTo(x + 10, 20); ctx.closePath(); ctx.fill();
      }
      if (this.phase === 'failed' && this.failInfo && this.failInfo.ball === i) {
        const k = Math.min(1, (t - this.failT) / 0.12);
        drawBubble(ctx, Math.max(70, Math.min(FIELD_W - 70, x)), Math.max(40, y - 48), this.failInfo.label, easeOutBack(k));
      }
    });
  }

  drawPanel(w, h, k = 1) {
    const ctx = this.ctx;
    const x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2 + (1 - k) * 500;
    ctx.fillStyle = 'rgba(43,43,43,0.45)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    rrect(ctx, x + 6, y + 8, w, h, 20); ctx.fillStyle = 'rgba(43,43,43,0.4)'; ctx.fill();
    rrect(ctx, x, y, w, h, 20); ctx.fillStyle = C.paper; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = C.outline; ctx.stroke();
    return { x, y };
  }

  drawPause() {
    const ctx = this.ctx;
    const { x, y } = this.drawPanel(480, 520);
    text(ctx, 'PAUSED', VIEW_W / 2, y + 56, 44, C.outline, 'center', 900);
    const bx = x + 110, bw = 260;
    this.addButton({ key: 'p:resume', x: bx, y: y + 100, w: bw, h: 60, label: 'RESUME', color: C.yellow, size: 24, action: () => this.pause(false) });
    this.addButton({ key: 'p:retry', x: bx, y: y + 176, w: bw, h: 60, label: 'RETRY', size: 24, action: () => { this.pause(false); this.restartAttempt(); } });
    this.addButton({ key: 'p:levels', x: bx, y: y + 252, w: bw, h: 60, label: 'LEVELS', size: 24, action: () => this.toMenu('levels') });
    this.addButton({ key: 'p:menu', x: bx, y: y + 328, w: bw, h: 60, label: 'MENU', size: 24, action: () => this.toMenu('title') });
    this.settingsButtons(x + 32, y + 420, 200);
  }

  drawComplete() {
    const ctx = this.ctx, r = this.result;
    if (!r.shownAt) r.shownAt = this.t;
    const e = this.t - r.shownAt;
    const k = easeOutBack(Math.min(1, e / 0.45));
    const { x, y } = this.drawPanel(640, 520, k);
    rrect(ctx, VIEW_W / 2 - 190, y - 26, 380, 62, 14); ctx.fillStyle = C.green; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.outline; ctx.stroke();
    text(ctx, 'IN THE CUP!', VIEW_W / 2, y + 6, 36, '#fff', 'center', 900, 7);

    for (let i = 0; i < 3; i++) {
      const at = 0.5 + i * 0.3, lit = r.stars > i && e > at;
      let s = 1;
      if (lit) {
        const q = Math.min(1, (e - at) / 0.22);
        s = 1 + (1 - q) * 1.2;
        if (!r[`stamp${i}`]) { r[`stamp${i}`] = true; this.sound.play('star', { i }); this.fx.shake(3, 0.08); }
      }
      ctx.save(); ctx.translate(VIEW_W / 2 - 115 + i * 115, y + 120); ctx.scale(s, s);
      drawStar(ctx, 0, 0, i === 1 ? 46 : 40, lit ? C.yellow : '#E3DDD0');
      ctx.restore();
    }
    const c = Math.min(1, Math.max(0, e - 0.4) / 0.8);
    const shown = Math.round(r.pct * c);
    if (c > 0 && c < 1 && Math.floor(e * 30) !== this.lastCount) { this.lastCount = Math.floor(e * 30); this.sound.play('count', { k: c }); }
    text(ctx, `Ink used  ${shown}%`, VIEW_W / 2, y + 205, 32, C.ink, 'center', 900);
    if (r.newBest && e > 1.3) {
      ctx.save(); ctx.translate(VIEW_W / 2 + 200, y + 200); ctx.rotate(-0.12);
      text(ctx, 'New best!', 0, 0, 22, C.coral, 'center', 900);
      ctx.restore();
    }
    text(ctx, `Tries ${r.tries}   ·   Best ink ${r.bestPct}%`, VIEW_W / 2, y + 252, 20, C.outline, 'center', 800);
    if (r.stars === 3) {
      text(ctx, `Dev: ${r.devPct}%`, VIEW_W / 2, y + 292, 20, C.grey, 'center', 800);
      if (r.nib) { drawNib(ctx, VIEW_W / 2 + 80, y + 292, 1); text(ctx, 'Gold nib!', VIEW_W / 2 + 140, y + 292, 18, C.outline, 'center', 900); }
    } else {
      const m = this.lv.marks, need = r.stars === 1 ? m.two : m.three;
      text(ctx, `★${r.stars + 1} needs ${Math.round(need / this.lv.ink * 100)}% or less`, VIEW_W / 2, y + 292, 20, C.grey, 'center', 800);
    }

    if (e < 0.35) return;
    const by = y + 400;
    this.addButton({ key: 'c:menu', x: x + 50, y: by, w: 170, h: 64, label: 'MENU', size: 24, action: () => this.toMenu('levels') });
    this.addButton({ key: 'c:retry', x: x + 235, y: by, w: 170, h: 64, label: 'RETRY', size: 24, action: () => this.startLevel(this.level) });
    this.addButton({ key: 'c:next', x: x + 420, y: by, w: 170, h: 64, label: 'NEXT ›', size: 24, color: C.yellow, action: () => this.goNext() });
  }
}
