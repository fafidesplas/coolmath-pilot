// Screen flow (GDD 8), the frame loop, and the glue between sim, input, render,
// sound, saving and analytics. Button and panel code adapted from Magnet Twins.
import { VIEW_W, VIEW_H, HUD_H, STEP, MAX_FRAME_DT, T, ROWS, COLORS as C, WORLD_COLORS, RUNNER, CAMERA, NEAR_MISS, SPIKE_H, SPIKE_INSET } from './config.js';
import { Sim, bankedCount } from './sim.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { FX, drawStarShape } from './fx.js';
import { GA } from './analytics.js';
import { loadSave, storeSave, loadSettings, storeSettings } from './save.js';
import { Recorder, decodeRecording } from './record.js';
import { Strips, renderBackdrop, drawBackdrop, Scarf, drawRunner, drawGlider, drawPortal, FORM_STYLE, drawFlag, drawGoal, drawLevelStar, rrect, text } from './render.js';
import { isSolid, tileAt, TILE } from './level.js';
import { WORLDS, LEVELS_PER_WORLD, findLevel } from '../levels/index.js';

const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const easeOutBack = k => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;

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
    this.input = new Input(code => this.onKey(code));
    this.scarf = new Scarf();
    this.scarf2 = new Scarf();

    this.screen = 'title';
    this.paused = false;
    this.level = null;
    this.sim = null;
    this.acc = 0;
    this.t = 0;
    this.buttons = [];
    this.focus = -1;
    this.hover = null;
    this.pressed = null;
    this.mouse = { x: VIEW_W / 2, y: VIEW_H / 2 };
    this.fixedHz = Number(this.params.get('hz')) || 0;
    this.lastRecording = null;
    this.titleFlip = 1; this.titleG = 1;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(true); });
    this.bindPointer();

    const replay = this.params.get('replay');
    const lvParam = this.params.get('level');
    if (replay !== null) this.startReplay(lvParam || WORLDS[0].levels[0].id);
    else if (lvParam && findLevel(lvParam)) this.startLevel(findLevel(lvParam));

    this.last = performance.now();
    requestAnimationFrame(now => this.frame(now));
    this.api = this.makeApi();
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
    if (this.sim) this.buildLayers();
  }

  buildLayers() {
    const colors = WORLD_COLORS[Math.max(0, this.levelPos(this.level.id).world - 1)];
    this.colors = colors;
    this.strips = new Strips(this.sim.lv, colors, this.scale * this.dpr);
    this.backdrop = renderBackdrop(colors, this.scale * this.dpr);
  }

  bindPointer() {
    const toView = e => ({ x: (e.clientX - this.ox) / this.scale, y: (e.clientY - this.oy) / this.scale });
    const hit = p => this.buttons.find(b => !b.disabled && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) || null;
    this.canvas.addEventListener('pointerdown', e => {
      this.sound.unlock();
      const p = toView(e);
      this.mouse = p;
      this.pressed = hit(p);
      if (this.pressed) { this.canvas.setPointerCapture(e.pointerId); return; }
      // Tap anywhere in the playfield flips (never on the HUD); holding counts for glider form.
      if (this.live() && p.y > HUD_H) { this.input.press(); this.input.pointerHeld = true; }
      else if (this.screen === 'title' && p.y > 470) this.titleTap();
    });
    this.canvas.addEventListener('pointermove', e => {
      const p = toView(e);
      this.mouse = p;
      this.hover = hit(p);
      this.canvas.style.cursor = this.hover ? 'pointer' : 'default';
    });
    this.canvas.addEventListener('pointerup', e => {
      this.input.pointerHeld = false;
      // Buttons are rebuilt every frame, so match by key, not by object.
      const b = hit(toView(e));
      if (b && this.pressed && b.key === this.pressed.key) this.activate(b);
      this.pressed = null;
    });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  makeApi() {
    const g = this;
    return {
      get screen() { return g.screen; },
      get level() { return g.level ? g.level.id : null; },
      get score() { return g.level ? (g.save.stars[g.level.id] || [0, 0, 0]).filter(Boolean).length : 0; },
      start() { g.startLevel(g.nextLevel()); },
      restart() { if (g.level) g.restart(); },
      win() { if (g.sim && g.screen === 'playing') g.sim.forceWin(); },   // debug only
      get sim() { return g.sim; },
      get recording() { return g.lastRecording; },
      replay(rec) { g.startLevel(findLevel(rec.level), decodeRecording(rec)); },
    };
  }

  live() { return this.screen === 'playing' && !this.paused && this.sim && !this.sim.s.done; }

  // ---- Levels -----------------------------------------------------------------

  levelPos(id) {
    for (let w = 0; w < WORLDS.length; w++) {
      const i = WORLDS[w].levels.findIndex(l => l.id === id);
      if (i >= 0) return { world: w + 1, level: i + 1 };
    }
    return { world: 1, level: 0 };
  }

  nextLevel() {
    for (const w of WORLDS) for (const l of w.levels) if (!this.save.done[l.id]) return l;
    return WORLDS[0].levels[0];
  }

  startLevel(level, replayFrames = null) {
    this.level = level;
    this.sim = new Sim(level);
    this.replay = replayFrames;
    this.recorder = this.params.has('record') && !replayFrames ? new Recorder() : null;
    this.buildLayers();
    this.screen = 'playing';
    this.paused = false;
    this.acc = 0;
    this.completeAt = 0;
    this.result = null;
    this.input.clear();
    this.input.accepting = !replayFrames;
    this.fx.clear();
    this.buttons = [];
    this.focus = -1;
    this.flipK = this.sim.s.g;
    this.hop = 0;
    this.chain = 0; this.lastFlipT = -9;
    this.hintT = -9; this.hintIdx = 0;
    this.flagsPassed = new Set();
    this.closeCalls = 0; this.lastClose = -9; this.dustT = 0; this.ghostT = 0;
    const s = this.sim.s;
    this.prevX = s.x; this.prevY = s.y;
    this.cam = this.cameraTarget();
    this.scarf.reset(s.x + RUNNER.w / 2 - 8, s.y + RUNNER.h / 2);
    const pos = this.levelPos(level.id);
    GA.progression('Start', pos.world, pos.level);
  }

  async startReplay(id) {
    try {
      const rec = await (await fetch(`levels/solutions/${id}.json`)).json();
      this.startLevel(findLevel(id), decodeRecording(rec));
    } catch (e) { console.warn('No recording to replay', e); }
  }

  sendDeathCounts() {
    const s = this.sim.s;
    GA.design('level:deaths', s.deaths);
    for (const k in s.deathTypes) if (s.deathTypes[k]) GA.design(`death:${k}`, s.deathTypes[k]);
  }

  // Attempt ends without reaching the goal (restart or quit).
  endAttempt() {
    if (!this.sim || this.sim.s.done || this.replay) return;
    const pos = this.levelPos(this.level.id);
    GA.progression('Fail', pos.world, pos.level, Math.round(this.sim.time));
    this.sendDeathCounts();
    if (this.sim.s.lastDeath) GA.design(`quit:${this.sim.s.lastDeath}`);
    GA.design(`quit:form:${this.sim.s.form}`);
  }

  restart() {
    this.endAttempt();
    GA.design('ui:restart');
    this.sound.play('click');
    this.startLevel(this.level);
  }

  toMenu(screen = 'title') {
    if (this.screen === 'playing') this.endAttempt();
    this.screen = screen;
    this.paused = false;
    this.sim = null;
    this.focus = -1;
    this.input.accepting = false;
  }

  pause(on) {
    if (this.screen !== 'playing' || !this.sim || this.sim.s.done || this.paused === on) return;
    this.paused = on;
    if (on) this.sound.stopMusic(); else this.sound.startMusic();
    this.focus = on ? 0 : -1;
    this.input.accepting = !on && !this.replay;
    this.input.clear();
  }

  // ---- Input ------------------------------------------------------------------

  onKey(code) {
    this.sound.unlock();
    if (this.screen === 'playing' && (code === 'KeyP' || code === 'Escape')) {
      if (this.sim && !this.sim.s.done) { this.pause(!this.paused); this.sound.play('click'); }
      return;
    }
    if (this.screen === 'playing' && code === 'KeyR' && !this.paused) { this.restart(); return; }
    if (this.live()) return;
    if (this.screen === 'title' && code === 'Space' && this.focus < 0) { this.titleTap(); }

    const list = this.buttons.filter(b => !b.disabled && !b.hud);
    if (!list.length) return;
    const i = list.indexOf(this.buttons[this.focus]);
    const move = d => { const n = list[(Math.max(i, 0) + d + list.length) % list.length]; this.focus = this.buttons.indexOf(n); this.sound.play('click'); };
    if (code === 'ArrowRight' || code === 'ArrowDown') move(i < 0 ? 0 : 1);
    else if (code === 'ArrowLeft' || code === 'ArrowUp') move(i < 0 ? 0 : -1);
    else if (code === 'Enter') {
      const b = this.buttons[this.focus] || list.find(q => q.isDefault) || list[0];
      this.activate(b);
    } else if (code === 'Escape' && this.screen === 'levels') this.toMenu('title');
  }

  activate(b) {
    this.sound.unlock();
    this.sound.play('click');
    b.action();
  }

  titleTap() {
    this.titleG = -this.titleG;
    this.sound.play('whoop', { g: this.titleG });
  }

  // ---- Frame ------------------------------------------------------------------

  frame(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (this.fixedHz) dt = 1 / this.fixedHz;
    dt = Math.min(Math.max(dt, 0), MAX_FRAME_DT);
    this.t += dt;

    if (this.screen === 'playing' && !this.paused && this.sim) {
      this.acc += dt;
      while (this.acc >= STEP) { this.tick(); this.acc -= STEP; }
      this.handleEvents();
      if (this.sim.s.done && this.completeAt && this.t >= this.completeAt) { this.completeAt = 0; this.screen = 'complete'; this.focus = -1; }
      this.updateView(dt);
    } else if (this.screen === 'complete' && this.sim) {
      this.updateView(dt);
    }
    this.titleFlip += (this.titleG - this.titleFlip) * Math.min(1, dt * 16);

    this.fx.update(dt);
    this.draw();
    requestAnimationFrame(n => this.frame(n));
  }

  tick() {
    const s = this.sim.s;
    this.prevX = s.x; this.prevY = s.y;
    let bits;
    if (this.replay) bits = this.replay[s.step] ?? 0;
    else bits = this.input.sample();
    if (this.recorder) this.recorder.push(bits);
    this.sim.step(bits);
    if (!this.sim.s.dead && !this.sim.s.done) this.checkClose();
  }

  // A close call: passing within NEAR_MISS px of a spike's deadly area.
  checkClose() {
    const s = this.sim.s, lv = this.sim.lv, m = NEAR_MISS;
    if (this.t - this.lastClose < 0.4) return;
    const x0 = s.x - m, x1 = s.x + RUNNER.w + m, y0 = s.y - m, y1 = s.y + RUNNER.h + m;
    for (let ty = Math.floor(y0 / T); ty <= Math.floor(y1 / T); ty++) {
      for (let tx = Math.floor(x0 / T); tx <= Math.floor(x1 / T); tx++) {
        const t = tileAt(lv, tx, ty);
        if (t !== TILE.SPIKE_UP && t !== TILE.SPIKE_DOWN) continue;
        const sx0 = tx * T + SPIKE_INSET, sx1 = tx * T + T - SPIKE_INSET;
        const sy0 = t === TILE.SPIKE_UP ? ty * T + T - SPIKE_H + SPIKE_INSET : ty * T;
        const sy1 = t === TILE.SPIKE_UP ? ty * T + T : ty * T + SPIKE_H - SPIKE_INSET;
        if (x1 > sx0 && x0 < sx1 && y1 > sy0 && y0 < sy1) {
          this.lastClose = this.t;
          this.closeCalls++;
          this.sound.play('close');
          const cx = s.x + RUNNER.w / 2, cy = s.y + RUNNER.h / 2;
          this.fx.spawn({ x: cx, y: cy - s.g * 46, vy: -s.g * 60, g: 0, type: 'text', label: 'CLOSE!', size: 26, color: C.star, life: 0.6 });
          this.fx.burst(cx, cy, 10, C.star, 220, 'spark', 0.3, 3, 0);
          return;
        }
      }
    }
  }

  cameraTarget() {
    const s = this.sim.s;
    const k = Math.min(1, Math.max(0, (s.speed - this.level.speed) / (CAMERA.fastSpeed - this.level.speed || 1)));
    const lead = CAMERA.lead + (CAMERA.leadFast - CAMERA.lead) * k;
    const max = this.sim.lv.cols * T - VIEW_W;
    return Math.max(0, Math.min(max, s.x - lead * VIEW_W));
  }

  updateView(dt) {
    const s = this.sim.s;
    this.flipK += (s.g - this.flipK) * Math.min(1, dt * 16);
    this.hop *= Math.exp(-dt * 30);
    const target = this.cameraTarget();
    this.cam = Math.abs(target - this.cam) > 300 ? this.cam + (target - this.cam) * Math.min(1, dt * 10) : target;
    const a = Math.min(1, this.acc / STEP);
    const x = this.prevX + (s.x - this.prevX) * a, y = this.prevY + (s.y - this.prevY) * a;
    this.view = { x: x + RUNNER.w / 2, y: y + RUNNER.h / 2 + this.hop };
    if (s.b2) {
      this.view2 = { x: this.view.x, y: s.b2.y + RUNNER.h / 2 };
      if (!s.dead) this.scarf2.update(this.view2.x - 10, this.view2.y - s.g * 2, s.g, dt);
    }
    if (!s.dead) this.scarf.update(this.view.x - 10, this.view.y - s.g * 2, s.g, dt);
    if (!s.dead && !s.done && !this.paused) {
      this.dustT -= dt; this.ghostT -= dt;
      if (s.grounded && this.dustT <= 0) {
        this.dustT = 0.05;
        this.fx.spawn({ x: this.view.x - 8, y: this.view.y + s.g * 15, vx: -60 - this.fx.rnd() * 60, vy: -s.g * (20 + this.fx.rnd() * 30), color: 'rgba(43,34,56,0.25)', type: 'puff', life: 0.25, size: 3 + this.fx.rnd() * 2, g: 0 });
      }
      if ((!s.grounded || s.form === 'glider') && this.ghostT <= 0) {
        this.ghostT = 0.016;
        this.fx.spawn({ x: this.view.x, y: this.view.y, color: FORM_STYLE[s.form].color, type: 'ghost', life: s.form === 'glider' ? 0.3 : 0.16, size: s.form === 'glider' ? 9 : 17, g: 0 });
      }
    }

    // Level 1 hints: "TAP!" right when a flip is needed
    const hints = this.sim.lv.hints;
    while (this.hintIdx < hints.length && s.x >= hints[this.hintIdx].x) { this.hintLabel = hints[this.hintIdx].label; this.hintIdx++; this.hintT = this.t; this.sound.play('tap'); }
  }

  handleEvents() {
    const sim = this.sim, fx = this.fx, snd = this.sound, s = sim.s;
    for (const e of sim.events) {
      switch (e.type) {
        case 'flip':
          this.chain = this.t - this.lastFlipT < 0.5 ? this.chain + 1 : 0;
          this.lastFlipT = this.t;
          snd.play('whoop', { g: e.g, chain: this.chain });
          fx.kick('runner', 0.75, 1.35);
          fx.dust(s.x + RUNNER.w / 2, e.g > 0 ? s.y : s.y + RUNNER.h, 4);
          if (!this.save.tut.flip && !this.replay) { this.save.tut.flip = true; storeSave(this.save); GA.design('tutorial:step01'); }
          break;
        case 'land':
          snd.play('land');
          fx.kick('runner', 1.35, 0.7);
          fx.dust(s.x + RUNNER.w / 2, e.g > 0 ? s.y + RUNNER.h : s.y, 6);
          break;
        case 'step':
          snd.play('step');
          this.hop += e.g * T;
          fx.kick('runner', 0.85, 1.2);
          break;
        case 'death':
          snd.play('crunch');
          fx.shake(6, 0.2);
          fx.vignette = 1;
          for (let i = 0; i < 12; i++) {
            const a = fx.rnd() * Math.PI * 2, sp = 200 + fx.rnd() * 300;
            fx.spawn({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 100, color: i % 3 ? C.runner : C.scarf, type: 'piece', life: 0.6, size: 4 + fx.rnd() * 4, g: 1400 * s.g });
          }
          fx.burst(e.x, e.y, 10, C.ink, 200, 'spark', 0.3, 3, 0);
          break;
        case 'respawn':
          snd.play('rebuild');
          this.prevX = s.x; this.prevY = s.y;
          this.flipK = s.g;
          this.scarf.reset(s.x + RUNNER.w / 2 - 8, s.y + RUNNER.h / 2);
          if (s.b2) this.scarf2.reset(s.b2.x + RUNNER.w / 2 - 8, s.b2.y + RUNNER.h / 2);
          fx.kick('runner', 0.5, 1.5);
          fx.spawn({ x: s.x + RUNNER.w / 2, y: s.y + RUNNER.h / 2, type: 'ring', color: C.runner, life: 0.35, size: 8, g: 0 });
          break;
        case 'star': {
          snd.play('star', { i: s.stars.filter(v => v).length - 1 });
          fx.burst(e.x, e.y, 14, C.star, 260, 'dot', 0.45, 4);
          fx.spawn({ x: e.x, y: e.y, type: 'ring', color: C.star, life: 0.4, size: 12, g: 0 });
          break;
        }
        case 'bank':
          snd.play('bank');
          for (let i = 0; i < 3; i++) { const sl = this.starSlot(i); fx.spawn({ x: sl.x + this.cam, y: sl.y - HUD_H, type: 'ring', color: C.star, life: 0.4, size: 10, g: 0 }); }
          break;
        case 'flag':
          snd.play('checkpoint');
          fx.burst(e.x, this.flagSurface(e.i).y - 50 * this.flagSurface(e.i).g, 22, C.star, 260, 'confetti', 0.9, 4, 500);
          if (!this.flagsPassed.has(e.i) && !this.replay) { this.flagsPassed.add(e.i); GA.design(`checkpoint:${e.i + 1}`); }
          if (!this.save.tut.flag && !this.replay) { this.save.tut.flag = true; storeSave(this.save); GA.design('tutorial:step02'); }
          break;
        case 'form': {
          const st = FORM_STYLE[e.form];
          snd.play('checkpoint');
          fx.burst(s.x + RUNNER.w / 2, s.y + RUNNER.h / 2, 26, st.color, 340, 'confetti', 0.8, 4, 0);
          fx.spawn({ x: s.x + RUNNER.w / 2 + 40, y: s.y - 40, vy: -40, g: 0, type: 'text', label: st.label + '!', size: 30, color: st.color, life: 0.8 });
          if (s.b2) this.scarf2.reset(s.b2.x + RUNNER.w / 2 - 8, s.b2.y + RUNNER.h / 2);
          break;
        }
        case 'goal': this.onComplete(); break;
      }
    }
    sim.events.length = 0;
  }

  flagSurface(i) {
    const f = this.sim.lv.flags[i];
    const g = isSolid(this.sim.lv, Math.floor(f.x / T), f.ty + 1) ? 1 : -1;
    return { x: f.x, y: g > 0 ? (f.ty + 1) * T : f.ty * T, g };
  }

  onComplete() {
    const level = this.level, s = this.sim.s;
    const run = s.stars.map(v => (v === 2 ? 1 : 0));
    const before = this.save.stars[level.id] || [0, 0, 0];
    this.save.stars[level.id] = before.map((v, i) => v || run[i]);
    this.save.done[level.id] = true;
    const prev = this.save.best[level.id];
    const best = {
      time: prev ? Math.min(prev.time, this.sim.time) : this.sim.time,
      deaths: prev ? Math.min(prev.deaths, s.deaths) : s.deaths,
    };
    this.save.best[level.id] = best;
    if (level.id === 'w1l01' && !this.save.tut.done && !this.replay) { this.save.tut.done = true; GA.design('tutorial:done'); }
    if (!this.replay) storeSave(this.save);

    const pos = this.levelPos(level.id);
    GA.progression('Complete', pos.world, pos.level, bankedCount(s));
    this.sendDeathCounts();

    this.result = { run, merged: this.save.stars[level.id], time: this.sim.time, deaths: s.deaths, best, close: this.closeCalls, shownAt: 0 };
    this.sound.play('goal');
    const gx = this.sim.lv.goal + 35;
    this.fx.burst(gx, 5 * T, 40, C.star, 420, 'confetti', 1.3, 5, 600);
    this.fx.burst(gx, 8 * T, 25, C.scarf, 360, 'confetti', 1.2, 4, 600);
    this.fx.burst(gx, 8 * T, 25, C.runner, 360, 'confetti', 1.2, 4, 600);
    this.completeAt = this.t + 0.9;
    this.input.accepting = false;

    if (this.recorder) {
      this.lastRecording = this.recorder.finish(level.id, 'solo');
      console.log(`Recording for levels/solutions/${level.id}.json:\n` + JSON.stringify(this.lastRecording));
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
    else if (this.sim) {
      this.drawWorld();
      this.drawHud();
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
    const lift = b.disabled ? 0 : down ? 1 : hot || focused ? -3 : 0;
    ctx.save();
    ctx.translate(0, lift);
    rrect(ctx, b.x, b.y + 6, b.w, b.h, b.r ?? 18);
    ctx.fillStyle = C.ink; ctx.fill();
    rrect(ctx, b.x, b.y, b.w, b.h, b.r ?? 18);
    ctx.fillStyle = b.disabled ? '#D5D2CC' : (b.color || '#fff');
    ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
    if (focused || hot) {
      ctx.lineWidth = 3; ctx.strokeStyle = C.star;
      rrect(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12, (b.r ?? 18) + 6); ctx.stroke();
    }
    if (b.draw) b.draw(ctx, b);
    else text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.size || 28, b.disabled ? '#8E8A84' : (b.textColor || C.ink));
    ctx.restore();
    return b;
  }

  drawLock(x, y, s) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineWidth = 4; ctx.strokeStyle = C.ink;
    ctx.beginPath(); ctx.arc(0, -8, 9, Math.PI, 0); ctx.stroke();
    rrect(ctx, -14, -8, 28, 22, 5); ctx.fillStyle = '#9C9890'; ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  drawTitle() {
    const ctx = this.ctx, t = this.t;
    const col = WORLD_COLORS[0];
    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // A strip of corridor along the bottom, scrolling under a runner that runs in place.
    const floorY = 640, ceilY = 500;
    ctx.fillStyle = col.ceiling; ctx.fillRect(0, 470, VIEW_W, ceilY - 470);
    ctx.fillStyle = col.floor; ctx.fillRect(0, floorY, VIEW_W, VIEW_H - floorY);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, ceilY); ctx.lineTo(VIEW_W, ceilY); ctx.moveTo(0, floorY); ctx.lineTo(VIEW_W, floorY); ctx.stroke();
    const scroll = (t * 320) % 80;
    ctx.fillStyle = 'rgba(43,34,56,0.25)';
    for (let x = -scroll; x < VIEW_W; x += 80) { ctx.fillRect(x, floorY + 14, 30, 5); ctx.fillRect(x + 40, ceilY - 19, 30, 5); }
    const ry = this.titleG > 0 ? floorY - 18 : ceilY + 18;
    const cy = ry + (this.titleFlip - this.titleG) * -60;
    drawRunner(ctx, 250, cy, this.titleFlip, { t, running: true, blink: (t % 3.5) < 0.1 });
    text(ctx, 'click here to flip', 250, 452, 18, '#6B7894', 'center', 700);

    // Logo: FLIP the right way up, RUNNER upside down.
    ctx.save();
    ctx.translate(VIEW_W / 2, 120 + Math.sin(t * 2) * 4);
    text(ctx, 'FLIP', 0, -10, 104, C.runner, 'center', 900, 22);
    ctx.save(); ctx.translate(0, 82); ctx.scale(1, -1);
    text(ctx, 'RUNNER', 0, 0, 80, C.scarf, 'center', 900, 18);
    ctx.restore();
    ctx.restore();

    this.addButton({ x: VIEW_W / 2 - 160, y: 262, w: 320, h: 92, label: 'PLAY', size: 44, color: C.star, isDefault: true,
      action: () => this.startLevel(this.nextLevel()) });
    this.addButton({ x: VIEW_W / 2 - 330, y: 378, w: 200, h: 62, label: 'LEVELS', size: 24, action: () => { this.screen = 'levels'; this.focus = -1; } });
    const lockedNote = (c, b) => { text(c, b.label, b.x + b.w / 2 + 12, b.y + b.h / 2, 22, '#8E8A84'); this.drawLock(b.x + 28, b.y + b.h / 2 + 2, 0.7); };
    this.addButton({ x: VIEW_W / 2 - 100, y: 378, w: 200, h: 62, label: 'DAILY', disabled: true, draw: lockedNote, action: () => {} });
    this.addButton({ x: VIEW_W / 2 + 130, y: 378, w: 200, h: 62, label: 'ENDLESS', disabled: true, draw: lockedNote, action: () => {} });
    this.addButton({ key: 'sound', x: VIEW_W - 250, y: 28, w: 220, h: 56, size: 22,
      label: this.settings.sfx ? 'SOUND: ON' : 'SOUND: OFF', action: () => this.toggleSfx() });
    this.addButton({ key: 'music', x: VIEW_W - 250, y: 96, w: 220, h: 56, size: 22,
      label: this.settings.music ? 'MUSIC: ON' : 'MUSIC: OFF', action: () => this.toggleMusic() });
    text(ctx, 'Daily and Endless open after the Lab', VIEW_W / 2 + 115, 456, 16, '#6B7894', 'center', 700);
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

  drawLevels() {
    const ctx = this.ctx, t = this.t;
    ctx.fillStyle = WORLD_COLORS[0].bg; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.addButton({ x: 30, y: 26, w: 150, h: 60, label: '‹ BACK', size: 24, action: () => { this.screen = 'title'; this.focus = -1; } });

    WORLDS.forEach((w, i) => {
      const x = 130 + i * 260, open = w.levels.length > 0;
      rrect(ctx, x, 120, 240, 56, 14);
      ctx.fillStyle = i === 0 ? C.star : '#D5D2CC'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
      text(ctx, `${i + 1}  ${w.name.toUpperCase()}`, x + 120, 149, 21, C.ink);
      if (!open) this.drawLock(x + 216, 148, 0.65);
    });

    const next = this.nextLevel();
    const world = WORLDS[0];
    for (let i = 0; i < LEVELS_PER_WORLD; i++) {
      const col = i % 5, row = Math.floor(i / 5);
      const x = 255 + col * 160, y = 230 + row * 200;
      const level = world.levels[i];
      if (!level) {
        rrect(ctx, x, y + 6, 130, 130, 22); ctx.fillStyle = C.ink; ctx.fill();
        rrect(ctx, x, y, 130, 130, 22); ctx.fillStyle = '#E3E6EC'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
        text(ctx, String(i + 1), x + 65, y + 50, 40, '#B5BAC6');
        this.drawLock(x + 65, y + 96, 1);
        continue;
      }
      const stars = this.save.stars[level.id] || [0, 0, 0];
      const done = this.save.done[level.id];
      const isNext = level === next && !done;
      const bounce = isNext ? Math.abs(Math.sin(t * 4)) * -6 : 0;
      this.addButton({
        key: `level:${level.id}`, x, y: y + bounce, w: 130, h: 130, r: 22, color: isNext ? '#FFE9A8' : '#fff', isDefault: true,
        action: () => this.startLevel(level),
        draw: (c, b) => {
          text(c, String(i + 1), b.x + 65, b.y + 52, 48);
          for (let s = 0; s < 3; s++) drawStarShape(c, b.x + 33 + s * 32, b.y + 100, 13, stars[s] ? C.star : '#D8DCE4');
          if (done) {
            c.beginPath(); c.arc(b.x + 112, b.y + 18, 15, 0, 7); c.fillStyle = C.runner; c.fill(); c.lineWidth = 3; c.strokeStyle = C.ink; c.stroke();
            c.strokeStyle = '#fff'; c.lineWidth = 4; c.lineCap = 'round';
            c.beginPath(); c.moveTo(b.x + 105, b.y + 18); c.lineTo(b.x + 110, b.y + 24); c.lineTo(b.x + 119, b.y + 12); c.stroke();
          }
        },
      });
    }
    text(ctx, world.levels[0].name, VIEW_W / 2, VIEW_H - 45, 24, C.ink, 'center', 700);
  }

  drawWorld() {
    const ctx = this.ctx, sim = this.sim, s = sim.s, lv = sim.lv, t = this.t;
    const [sx, sy] = this.fx.offset();
    const cam = Math.round(this.cam);
    ctx.save();
    ctx.translate(sx, HUD_H + sy);
    drawBackdrop(ctx, this.backdrop, this.colors, cam, this.t, this.sim.s.speed);
    this.strips.draw(ctx, cam);

    ctx.save();
    ctx.translate(-cam, 0);
    lv.flags.forEach((f, i) => { if (f.x > cam - 60 && f.x < cam + VIEW_W + 60) { const p = this.flagSurface(i); drawFlag(ctx, f.x, p.y, p.g, i <= s.flag, t); } });
    if (lv.goal > cam - 120 && lv.goal < cam + VIEW_W + 120) drawGoal(ctx, lv.goal, t);
    lv.portals.forEach((p, i) => { if (i > s.portal && p.x > cam - 60 && p.x < cam + VIEW_W + 60) drawPortal(ctx, p.x, p.form, t); });
    const saved = this.save.stars[this.level.id] || [0, 0, 0];
    lv.stars.forEach((st, i) => { if (s.stars[i] === 0 && st.x > cam - 40 && st.x < cam + VIEW_W + 40) drawLevelStar(ctx, st.x, st.y, t, saved[i]); });

    if (!s.dead) {
      const sq = this.fx.squash.runner;
      if (s.form === 'glider') {
        drawGlider(ctx, this.view.x, this.view.y, Math.atan2(s.vy, s.speed), t, FORM_STYLE.glider.color);
      } else {
        this.scarf.draw(ctx, 0);
        drawRunner(ctx, this.view.x, this.view.y, this.flipK, { sx: sq.sx, sy: sq.sy, t, running: s.grounded, blink: (t % 3.7) < 0.1 });
        if (s.b2 && this.view2) {
          this.scarf2.draw(ctx, 0, C.runner);
          drawRunner(ctx, this.view2.x, this.view2.y, this.flipK, { sx: sq.sx, sy: sq.sy, t, running: s.b2.grounded, color: FORM_STYLE.twin.color, blink: (t % 4.1) < 0.1 });
        }
      }
      // Level 1 tap cue
      if (t - this.hintT < 0.7) {
        const k = (t - this.hintT) / 0.7;
        const py = this.view.y - s.g * (62 + k * 10);
        ctx.globalAlpha = 1 - k * k;
        rrect(ctx, this.view.x - 62, py - 22, 124, 44, 14); ctx.fillStyle = C.star; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
        text(ctx, this.hintLabel || 'TAP!', this.view.x, py + 1, 26, C.ink, 'center', 900);
        ctx.globalAlpha = 1;
      }
    }
    this.fx.draw(ctx);
    ctx.restore();

    if (this.fx.vignette > 0) {
      const g = ctx.createRadialGradient(VIEW_W / 2, ROWS * T / 2, 200, VIEW_W / 2, ROWS * T / 2, 760);
      g.addColorStop(0, 'rgba(43,34,56,0)');
      g.addColorStop(1, `rgba(43,34,56,${0.45 * this.fx.vignette})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, VIEW_W, ROWS * T);
    }
    ctx.restore();
  }

  starSlot(i) { return { x: 470 + i * 40, y: 40 }; }

  drawHud() {
    const ctx = this.ctx, sim = this.sim, s = sim.s, t = this.t;
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, VIEW_W, HUD_H);
    const pos = this.levelPos(this.level.id);
    rrect(ctx, 20, 18, 70, 44, 10); ctx.fillStyle = C.star; ctx.fill();
    text(ctx, `${pos.world}-${pos.level}`, 55, 41, 24);
    text(ctx, this.level.name.toUpperCase(), 106, 41, 22, C.panel, 'left', 800);

    const saved = this.save.stars[this.level.id] || [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      const sl = this.starSlot(i), v = s.stars[i];
      if (v === 2) drawStarShape(ctx, sl.x, sl.y, 15, C.star);
      else if (v === 1) { ctx.globalAlpha = 0.6 + Math.sin(t * 10) * 0.4; drawStarShape(ctx, sl.x, sl.y, 15, C.star); ctx.globalAlpha = 1; }
      else drawStarShape(ctx, sl.x, sl.y, 15, saved[i] ? 'rgba(255,197,49,0.55)' : '#5C5470', 1, true);
    }

    // Current form badge
    const fst = FORM_STYLE[s.form];
    rrect(ctx, 1030, 58, 72, 18, 9); ctx.fillStyle = fst.color; ctx.fill();
    text(ctx, fst.label, 1066, 67.5, 12, '#fff', 'center', 900);

    // Progress bar with flag marks
    const bx = 610, bw = 300, by = 40;
    rrect(ctx, bx, by - 6, bw, 12, 6); ctx.fillStyle = '#4A4060'; ctx.fill();
    const prog = Math.min(1, s.x / sim.lv.goal);
    rrect(ctx, bx, by - 6, Math.max(12, bw * prog), 12, 6); ctx.fillStyle = C.runner; ctx.fill();
    sim.lv.flags.forEach((f, i) => {
      const fx = bx + bw * f.x / sim.lv.goal;
      ctx.fillStyle = i <= s.flag ? C.star : '#8E85A6';
      ctx.fillRect(fx - 2, by - 12, 4, 24);
    });
    ctx.beginPath(); ctx.arc(bx + bw * prog, by, 9, 0, 7); ctx.fillStyle = C.runner; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.panel; ctx.stroke();

    // Death counter: a little crumpled runner, no skull
    ctx.save(); ctx.translate(975, 40);
    ctx.beginPath(); ctx.ellipse(0, 4, 14, 10, 0, 0, 7); ctx.fillStyle = C.runner; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.panel; ctx.stroke();
    ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
    for (const ex of [-5, 4]) { ctx.beginPath(); ctx.moveTo(ex - 3, 0); ctx.lineTo(ex + 3, 6); ctx.moveTo(ex + 3, 0); ctx.lineTo(ex - 3, 6); ctx.stroke(); }
    ctx.restore();
    text(ctx, `×${s.deaths}`, 998, 42, 24, C.panel, 'left', 800);

    const pause = { key: 'hud:pause', hud: true, x: 1124, y: 14, w: 52, h: 52, r: 26, action: () => this.pause(true),
      draw: (c, b) => { c.fillStyle = C.ink; c.fillRect(b.x + 18, b.y + 15, 6, 22); c.fillRect(b.x + 29, b.y + 15, 6, 22); } };
    const restart = { key: 'hud:restart', hud: true, x: 1196, y: 14, w: 52, h: 52, r: 26, action: () => this.restart(),
      draw: (c, b) => {
        c.strokeStyle = C.ink; c.lineWidth = 4.5; c.lineCap = 'round';
        c.beginPath(); c.arc(b.x + 26, b.y + 26, 12, -0.3, Math.PI * 1.55); c.stroke();
        c.fillStyle = C.ink; c.beginPath(); c.moveTo(b.x + 38, b.y + 13); c.lineTo(b.x + 40, b.y + 27); c.lineTo(b.x + 27, b.y + 21); c.fill();
      } };
    if (this.screen === 'playing' && !this.paused && !s.done) { this.addButton(pause); this.addButton(restart); }
  }

  drawPanel(w, h, k = 1) {
    const ctx = this.ctx;
    const x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2 + (1 - k) * 500;
    ctx.fillStyle = 'rgba(43,34,56,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    rrect(ctx, x, y + 8, w, h, 28); ctx.fillStyle = C.ink; ctx.fill();
    rrect(ctx, x, y, w, h, 28); ctx.fillStyle = C.panel; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.stroke();
    return { x, y };
  }

  drawPause() {
    const ctx = this.ctx;
    const { x, y } = this.drawPanel(420, 440);
    text(ctx, 'PAUSED', VIEW_W / 2, y + 56, 46, C.ink, 'center', 900);
    const bx = x + 90, bw = 240;
    this.addButton({ x: bx, y: y + 110, w: bw, h: 64, label: 'RESUME', color: C.star, size: 26, action: () => this.pause(false) });
    this.addButton({ x: bx, y: y + 190, w: bw, h: 64, label: 'RESTART', size: 26, action: () => this.restart() });
    this.addButton({ x: bx, y: y + 270, w: bw, h: 64, label: 'MENU', size: 26, action: () => this.toMenu('levels') });
    text(ctx, 'Tap or Space to flip  ·  hold to glide', VIEW_W / 2, y + 385, 18, '#6B7894', 'center', 700);
  }

  drawComplete() {
    const ctx = this.ctx, r = this.result;
    if (!r.shownAt) r.shownAt = this.t;
    const e = this.t - r.shownAt;
    const k = easeOutBack(Math.min(1, e / 0.45));
    const { x, y } = this.drawPanel(640, 500, k);

    // COMPLETE ribbon
    rrect(ctx, VIEW_W / 2 - 200, y - 26, 400, 64, 16); ctx.fillStyle = C.runner; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.stroke();
    text(ctx, 'COMPLETE!', VIEW_W / 2, y + 7, 38, '#fff', 'center', 900, 8);

    for (let i = 0; i < 3; i++) {
      const at = 0.5 + i * 0.3;
      const lit = r.run[i] && e > at;
      let s = 1;
      if (lit) {
        const q = Math.min(1, (e - at) / 0.25);
        s = 1 + (1 - q) * 1.2;
        if (!r[`stamp${i}`]) { r[`stamp${i}`] = true; this.sound.play('star', { i }); }
      }
      ctx.save(); ctx.translate(VIEW_W / 2 - 110 + i * 110, y + 115); ctx.scale(s, s);
      drawStarShape(ctx, 0, 0, i === 1 ? 46 : 40, lit ? C.star : '#D8DCE4');
      ctx.restore();
    }

    const shown = r.time * Math.min(1, Math.max(0, e - 0.3) / 0.8);
    text(ctx, `TIME  ${fmt(shown)}   ·   CLOSE CALLS  ${r.close}`, VIEW_W / 2, y + 200, 24, C.ink, 'center', 800);

    // The death count stamps in big: dying a lot is part of the fun.
    const da = 1.5;
    if (e > da) {
      const q = Math.min(1, (e - da) / 0.2);
      if (!r.stampD) { r.stampD = true; this.sound.play('stamp'); this.fx.shake(4, 0.12); }
      ctx.save(); ctx.translate(VIEW_W / 2, y + 268); ctx.rotate(-0.06); ctx.scale(1 + (1 - q) * 1.5, 1 + (1 - q) * 1.5);
      text(ctx, `DEATHS ×${r.deaths}`, 0, 0, 44, C.scarf, 'center', 900, 8);
      ctx.restore();
    }
    text(ctx, `BEST  ${fmt(r.best.time)}   ·   FEWEST DEATHS  ${r.best.deaths}`, VIEW_W / 2, y + 322, 17, '#6B7894', 'center', 700);

    if (e < 0.35) return;
    const by = y + 380;
    const pos = this.levelPos(this.level.id);
    const nextLevel = WORLDS[pos.world - 1].levels[pos.level];
    this.addButton({ x: x + 50, y: by, w: 170, h: 64, label: 'MENU', size: 24, action: () => this.toMenu('levels') });
    this.addButton({ x: x + 235, y: by, w: 170, h: 64, label: 'RETRY', size: 24, action: () => this.startLevel(this.level) });
    this.addButton({ x: x + 420, y: by, w: 170, h: 64, label: 'NEXT ›', size: 24, color: C.star,
      action: () => nextLevel ? this.startLevel(nextLevel) : this.toMenu('levels') });
    if (this.focus < 0) this.focus = this.buttons.length - 1;
  }
}
