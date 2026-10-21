// Screen flow (GDD 8), the frame loop, and the glue between sim, input, render,
// sound, saving and analytics.
import { VIEW_W, VIEW_H, HUD_H, STEP, MAX_FRAME_DT, COLORS as C, B } from './config.js';
import { Sim } from './sim.js';
import { Input, KEY_LABELS } from './input.js';
import { Sound } from './audio.js';
import { FX, drawHex } from './fx.js';
import { GA } from './analytics.js';
import { loadSave, storeSave, loadSettings, storeSettings } from './save.js';
import { Recorder, decodeRecording } from './record.js';
import { previewTargets } from './magnet.js';
import {
  renderTiles, drawRobot, drawField, drawAimPreview, drawCrate, drawGate, drawPlate, drawExit, drawBolt,
  drawKeycap, rrect, text, FONT,
} from './render.js';
import { WORLDS, LEVELS_PER_WORLD, findLevel } from '../levels/index.js';

const previewHits = [];
const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const easeOutBack = k => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;

function drawStar(ctx, x, y, r, filled, scale = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(scale, scale);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.48 : r;
    i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? C.bolt : '#D9CDBD';
  ctx.fill();
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2.5, r * 0.14); ctx.strokeStyle = C.ink; ctx.stroke();
  ctx.restore();
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.params = new URLSearchParams(location.search);
    this.save = loadSave();
    this.settings = loadSettings();
    this.sound = new Sound();
    this.sound.setEnabled(this.settings.sfx);
    this.fx = new FX();
    this.input = new Input(code => this.onKey(code));

    this.screen = 'title';
    this.mode = this.save.mode === 'solo' ? 'solo' : 'coop';
    this.paused = false;
    this.level = null;          // level data
    this.sim = null;
    this.acc = 0;
    this.t = 0;
    this.buttons = [];
    this.focus = -1;
    this.hover = null;
    this.pressed = null;
    this.mouse = { x: VIEW_W / 2, y: VIEW_H / 2 };
    this.keytest = this.params.has('keytest');
    this.fixedHz = Number(this.params.get('hz')) || 0;
    this.recorder = null;
    this.replay = null;
    this.lastRecording = null;
    this.layer = null;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(true); });
    this.bindPointer();

    const debugLevel = this.params.get('level');
    const replayMode = this.params.get('replay');
    if (replayMode) this.startReplay(this.params.get('level') || WORLDS[0].levels[0].id, replayMode);
    else if (debugLevel && findLevel(debugLevel)) this.startLevel(findLevel(debugLevel), this.params.get('mode') === 'solo' ? 'solo' : this.mode);

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
    if (this.sim) this.layer = renderTiles(this.sim.tiles, this.scale * dpr);
  }

  bindPointer() {
    const toView = e => ({ x: (e.clientX - this.ox) / this.scale, y: (e.clientY - this.oy) / this.scale });
    const hit = p => this.buttons.find(b => !b.disabled && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) || null;
    this.canvas.addEventListener('pointerdown', e => {
      this.sound.unlock();
      if (e.pointerType === 'touch') { this.input.usedTouch = true; }
      const p = toView(e);
      this.mouse = p;
      this.pressed = hit(p);
      if (this.pressed) this.canvas.setPointerCapture(e.pointerId);
      // Solo touch: tap a robot to switch to it
      if (!this.pressed && this.screen === 'playing' && !this.paused && this.mode === 'solo' && this.sim) {
        const r = this.sim.robots[this.sim.active ^ 1];
        const wx = p.x, wy = p.y - HUD_H;
        if (wx > r.x - 20 && wx < r.x + r.w + 20 && wy > r.y - 20 && wy < r.y + r.h + 20) this.tapSwitch = true;
      }
    });
    this.canvas.addEventListener('pointermove', e => {
      const p = toView(e);
      this.mouse = p;
      this.hover = hit(p);
      this.canvas.style.cursor = this.hover ? 'pointer' : 'default';
    });
    this.canvas.addEventListener('pointerup', e => {
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
      get score() { return g.level ? g.starsFor(g.level.id).filter(Boolean).length : 0; },
      get mode() { return g.mode; },
      start(mode = g.mode) { g.startLevel(g.nextLevel(), mode); },
      restart() { if (g.level) g.restart(); },
      win() { if (g.sim && g.screen === 'playing') g.sim.forceWin(); },   // debug only
      get sim() { return g.sim; },
      get recording() { return g.lastRecording; },
      replay(rec) { g.startLevel(findLevel(rec.level), rec.mode, decodeRecording(rec)); },
    };
  }

  // ---- Levels -----------------------------------------------------------------

  levelPos(id) {
    for (let w = 0; w < WORLDS.length; w++) {
      const i = WORLDS[w].levels.findIndex(l => l.id === id);
      if (i >= 0) return { world: w + 1, level: i + 1 };
    }
    return { world: 0, level: 0 };
  }

  starsFor(id) { return this.save.stars[id] || [0, 0, 0]; }

  nextLevel() {
    for (const w of WORLDS) for (const l of w.levels) if (!this.starsFor(l.id)[0]) return l;
    return WORLDS[0].levels[0];
  }

  startLevel(level, mode, replayFrames = null) {
    this.level = level;
    this.mode = mode;
    this.sim = new Sim(level, mode);
    this.replay = replayFrames;
    this.recorder = this.params.has('record') && !replayFrames ? new Recorder() : null;
    this.layer = renderTiles(this.sim.tiles, this.scale * this.dpr);
    this.screen = 'playing';
    this.paused = false;
    this.acc = 0;
    this.completeAt = 0;
    this.result = null;
    this.exitOpen = 0;
    this.fx.clear();
    this.sound.stopHums();
    this.buttons = [];
    this.focus = -1;
    this.save.mode = mode;
    storeSave(this.save);
    const pos = this.levelPos(level.id);
    GA.progression('Start', pos.world, pos.level, mode);
    this.input.showTouch(this.showTouch());
  }

  async startReplay(id, mode) {
    const level = findLevel(id);
    try {
      const rec = await (await fetch(`levels/solutions/${id}.${mode}.json`)).json();
      this.startLevel(level, mode, decodeRecording(rec));
    } catch (e) {
      console.warn('No recording to replay', e);
    }
  }

  // Attempt ends without a win (restart or quit): Fail + per-attempt counts.
  endAttempt() {
    if (!this.sim || this.sim.done) return;
    const pos = this.levelPos(this.level.id);
    GA.progression('Fail', pos.world, pos.level, this.mode, Math.round(this.sim.time));
    this.sendCounts();
  }

  sendCounts() {
    GA.design('power:plus:use', this.sim.counts.plus);
    GA.design('power:minus:use', this.sim.counts.minus);
    if (this.mode === 'solo') GA.design('solo:switch', this.sim.counts.switches);
  }

  restart() {
    this.endAttempt();
    GA.design('ui:restart');
    this.sound.play('click');
    this.startLevel(this.level, this.mode);
  }

  toMenu(screen = 'title') {
    if (this.screen === 'playing') this.endAttempt();
    this.sound.stopHums();
    this.screen = screen;
    this.paused = false;
    this.sim = null;
    this.focus = -1;
    this.input.showTouch(false);
  }

  pause(on) {
    if (this.screen !== 'playing' || (this.sim && this.sim.done)) return;
    if (this.paused === on) return;
    this.paused = on;
    this.focus = on ? 0 : -1;
    if (on) this.sound.stopHums();
    else for (const r of this.sim.robots) if (r.power) this.sound.hum(r.pol, true);
    this.input.showTouch(this.showTouch());
  }

  showTouch() {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return this.screen === 'playing' && !this.paused && this.mode === 'solo' && (coarse || this.input.usedTouch);
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.save.mode = mode;
    storeSave(this.save);
    GA.design(`mode:${mode}`);
  }

  // ---- Input ------------------------------------------------------------------

  onKey(code) {
    this.sound.unlock();
    const playing = this.screen === 'playing' && !this.paused && !(this.sim && this.sim.done);
    if (this.screen === 'playing' && (code === 'KeyP' || code === 'Escape')) {
      if (!(this.sim && this.sim.done)) { this.pause(!this.paused); this.sound.play('click'); }
      return;
    }
    if (this.screen === 'playing' && code === 'KeyR' && !this.paused) { this.restart(); return; }
    if (playing) return;

    // Menu navigation
    const list = this.buttons.filter(b => !b.disabled && !b.hud);
    if (!list.length) return;
    const i = list.indexOf(this.buttons[this.focus]);
    const move = d => { const n = list[(Math.max(i, 0) + d + list.length) % list.length]; this.focus = this.buttons.indexOf(n); this.sound.play('click'); };
    if (code === 'ArrowRight' || code === 'ArrowDown' || code === 'KeyD' || code === 'KeyS') move(i < 0 ? 0 : 1);
    else if (code === 'ArrowLeft' || code === 'ArrowUp' || code === 'KeyA' || code === 'KeyW') move(i < 0 ? 0 : -1);
    else if (code === 'Enter' || code === 'Space') {
      const b = this.buttons[this.focus] || list.find(q => q.isDefault) || list[0];
      this.activate(b);
    }
    else if (code === 'Escape' && this.screen === 'levels') this.toMenu('title');
  }

  activate(b) {
    this.sound.unlock();
    this.sound.play('click');
    b.action();
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
      while (this.acc >= STEP) {
        this.tick();
        this.acc -= STEP;
      }
      this.handleEvents();
      if (this.sim.done && this.completeAt && this.t >= this.completeAt) { this.completeAt = 0; this.screen = 'complete'; this.focus = -1; this.input.showTouch(false); }
    } else if (this.screen === 'complete' && this.sim) {
      // keep the world alive behind the results panel
    }

    this.fx.update(dt);
    this.draw();
    requestAnimationFrame(n => this.frame(n));
  }

  tick() {
    let bits;
    if (this.replay) bits = this.replay[this.sim.steps] ?? 0;
    else {
      bits = this.input.sample(this.mode);
      if (this.tapSwitch) { bits |= 32; this.tapSwitch = false; }
    }
    if (this.recorder) this.recorder.push(bits);
    this.sim.step(bits);
  }

  handleEvents() {
    const sim = this.sim, fx = this.fx, snd = this.sound;
    const robotOf = pol => sim.robots[pol === 'plus' ? 0 : 1];
    for (const e of sim.events) {
      switch (e.type) {
        case 'jump': snd.play('jump'); fx.kick(e.pol, 0.78, 1.28); break;
        case 'land': {
          const r = robotOf(e.pol);
          snd.play('land');
          fx.kick(e.pol, 1.32, 0.7);
          fx.dust(r.x + r.w / 2, r.y + r.h, 6);
          break;
        }
        case 'power':
          snd.hum(e.pol, e.on);
          if (e.on) {
            snd.play('powerOn', { pol: e.pol });
            this.tutorial(e.pol === 'plus' ? 'power_plus' : 'power_minus');
          }
          break;
        case 'switch': {
          const r = sim.robots[e.active];
          snd.play('switch');
          fx.spawn({ x: r.x + r.w / 2, y: r.y + r.h / 2, type: 'ring', color: e.active ? C.minus : C.plus, life: 0.35, size: 18, g: 0 });
          this.tutorial('switched');
          break;
        }
        case 'clank':
          snd.play('clank', e);
          fx.shake(3, 0.1);
          fx.burst(e.x, e.y, 6, C.bolt, 220, 'spark', 0.3, 3);
          break;
        case 'bolt': {
          snd.play('bolt', e);
          fx.burst(e.x, e.y, 14, C.bolt, 260, 'dot', 0.45, 4);
          fx.spawn({ x: e.x, y: e.y, type: 'ring', color: C.bolt, life: 0.4, size: 10, g: 0 });
          const slot = this.boltSlot(e.n - 1);
          fx.spawn({ x: e.x, y: e.y, type: 'fly', life: 0.7, tx: slot.x, ty: slot.y - HUD_H });
          break;
        }
        case 'door':
          snd.play(e.open ? 'doorOpen' : 'doorShut');
          if (!e.open) {
            const g = sim.gates.find(q => q.id === e.id);
            fx.dust(g.x + g.w / 2, g.y + g.fullH, 8);
            fx.shake(2, 0.08);
          }
          break;
        case 'hazard':
          snd.play(e.kind === 'water' ? 'splash' : 'zap');
          fx.shake(6, 0.25);
          for (const a of e.at) {
            fx.burst(a.x, a.y, 18, a.pol === 'plus' ? C.plus : C.minus, 320, 'spark', 0.45, 3);
            fx.burst(a.x, a.y, 10, C.bolt, 200, 'dot', 0.4, 3);
          }
          GA.design(`checkpoint:reset:${e.kind}`);
          break;
        case 'respawn':
          snd.play('rebuild');
          for (const r of sim.robots) {
            fx.spawn({ x: r.x + r.w / 2, y: r.y + r.h / 2, type: 'ring', color: r.pol === 'plus' ? C.plus : C.minus, life: 0.4, size: 8, g: 0 });
            fx.kick(r.pol, 0.6, 1.4);
          }
          break;
        case 'splash': snd.play('splash'); fx.burst(e.x, e.y, 14, C.minus, 240, 'dot', 0.5, 4); break;
        case 'checkpoint':
          snd.play('checkpoint');
          fx.burst(e.x, e.y, 24, C.bolt, 260, 'confetti', 0.9, 4, 500);
          break;
        case 'complete': this.onComplete(e); break;
      }
    }
    sim.events.length = 0;

    // Tutorial: first movement of each robot
    for (const r of sim.robots) {
      if (Math.abs(r.x - sim.spawn[r.pol].x) > 6) this.tutorial(r.pol === 'plus' ? 'moved_plus' : 'moved_minus');
    }
  }

  tutorial(flag) {
    const tut = this.save.tut;
    if (tut[flag]) return;
    tut[flag] = true;
    const step = { moved_plus: 'step01', moved_minus: 'step02', switched: 'step02', power_plus: 'step03', power_minus: 'step04' }[flag];
    const sent = `sent_${step}`;
    if (step && !tut[sent]) { tut[sent] = true; GA.design(`tutorial:${step}`); }
    storeSave(this.save);
  }

  onComplete(e) {
    const level = this.level, mode = this.mode;
    const par = level.par[mode];
    const run = [1, e.bolts >= 3 ? 1 : 0, e.time <= par ? 1 : 0];
    const before = this.starsFor(level.id);
    const merged = before.map((s, i) => s || run[i]);
    this.save.stars[level.id] = merged;
    const bestPrev = this.save.best[mode][level.id];
    if (bestPrev === undefined || e.time < bestPrev) this.save.best[mode][level.id] = e.time;
    if (level.tutorialDone && !this.save.tut.sent_done) { this.save.tut.sent_done = true; GA.design('tutorial:done'); }
    storeSave(this.save);

    const pos = this.levelPos(level.id);
    GA.progression('Complete', pos.world, pos.level, mode, run.reduce((a, b) => a + b, 0));
    this.sendCounts();

    this.result = { run, merged, newStars: merged.map((s, i) => s && !before[i]), time: e.time, bolts: e.bolts, best: this.save.best[mode][level.id], par, shownAt: 0 };
    this.sound.stopHums();
    this.sound.play('exit');
    const ex = this.sim.exit;
    this.fx.burst(ex.x + ex.w / 2, ex.y + 10, 40, C.bolt, 380, 'confetti', 1.2, 5, 500);
    this.fx.burst(ex.x + ex.w / 2, ex.y + 10, 20, C.plus, 300, 'confetti', 1.1, 4, 500);
    this.fx.burst(ex.x + ex.w / 2, ex.y + 10, 20, C.minus, 300, 'confetti', 1.1, 4, 500);
    this.fx.kick('plus', 0.7, 1.35);
    this.fx.kick('minus', 0.7, 1.35);
    this.completeAt = this.t + 0.9;

    if (this.recorder) {
      this.lastRecording = this.recorder.finish(level.id, mode);
      console.log(`Recording for levels/solutions/${level.id}.${mode}.json:\n` + JSON.stringify(this.lastRecording));
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
    if (this.keytest) this.drawKeytest();
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
    ctx.fillStyle = b.disabled ? '#CFC3B4' : (b.color || '#fff');
    ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
    if (focused || hot) {
      ctx.lineWidth = 3; ctx.strokeStyle = C.bolt;
      rrect(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12, (b.r ?? 18) + 6); ctx.stroke();
    }
    if (b.draw) b.draw(ctx, b);
    else text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.size || 28, b.textColor || C.ink);
    ctx.restore();
    return b;
  }

  drawBackdrop() {
    const ctx = this.ctx;
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(43,34,56,0.06)';
    for (let y = 20; y < VIEW_H; y += 40) for (let x = 20; x < VIEW_W; x += 40) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#E9C9A0';
    ctx.fillRect(0, VIEW_H - 90, VIEW_W, 90);
    ctx.fillStyle = '#F7E3C4';
    ctx.fillRect(0, VIEW_H - 90, VIEW_W, 10);
    ctx.lineWidth = 4; ctx.strokeStyle = C.ink;
    ctx.beginPath(); ctx.moveTo(0, VIEW_H - 90); ctx.lineTo(VIEW_W, VIEW_H - 90); ctx.stroke();
  }

  drawLogo(x, y, size) {
    const ctx = this.ctx, t = this.t;
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 2) * 4);
    ctx.rotate(Math.sin(t * 1.3) * 0.015);
    text(ctx, 'MAGNET', -size * 1.55, 0, size, C.plus, 'center', 900, size * 0.22);
    text(ctx, 'TWINS', size * 1.95, 0, size, C.minus, 'center', 900, size * 0.22);
    ctx.restore();
  }

  drawTitle() {
    const ctx = this.ctx, t = this.t;
    this.drawBackdrop();
    this.drawLogo(VIEW_W / 2 - 20, 150, 92);

    // The twins idle at each side and watch the pointer.
    const look = (x, y) => { const dx = this.mouse.x - x, dy = this.mouse.y - y, d = Math.hypot(dx, dy) || 1; return { x: dx / d, y: dy / d }; };
    const bob = k => 1 + Math.sin(t * 3 + k) * 0.04;
    const blink = k => (t * 0.7 + k) % 4 < 0.1;
    ctx.save(); ctx.translate(190, VIEW_H - 90); ctx.scale(2.6, 2.6);
    drawRobot(ctx, 0, 0, 'plus', 1, { sx: 2 - bob(0), sy: bob(0), t, look: look(190, 520), blink: blink(0) });
    ctx.restore();
    ctx.save(); ctx.translate(VIEW_W - 190, VIEW_H - 90); ctx.scale(2.6, 2.6);
    drawRobot(ctx, 0, 0, 'minus', -1, { sx: 2 - bob(1.5), sy: bob(1.5), t, look: look(VIEW_W - 190, 520), blink: blink(2) });
    ctx.restore();

    const cy = 300;
    this.addButton({ x: 340, y: cy, w: 280, h: 104, color: C.plus, textColor: '#fff', label: '1 PLAYER', size: 36, isDefault: this.mode === 'solo',
      action: () => { this.setMode('solo'); this.startLevel(this.nextLevel(), 'solo'); } });
    this.addButton({ x: 660, y: cy, w: 280, h: 104, color: C.minus, textColor: '#fff', label: '2 PLAYERS', size: 36, isDefault: this.mode === 'coop',
      action: () => { this.setMode('coop'); this.startLevel(this.nextLevel(), 'coop'); } });
    this.addButton({ x: 500, y: cy + 140, w: 280, h: 72, label: 'LEVELS', size: 30, action: () => { this.screen = 'levels'; this.focus = -1; } });
    this.addButton({ x: VIEW_W - 250, y: 28, w: 220, h: 56, size: 22,
      key: 'sound', label: this.settings.sfx ? 'SOUND: ON' : 'SOUND: OFF', action: () => this.toggleSfx() });

    text(ctx, '2 players: WASD + F   and   Arrows + /', VIEW_W / 2, VIEW_H - 58, 22, C.ink, 'center', 700);
    text(ctx, '1 player: TAB swaps robots', VIEW_W / 2, VIEW_H - 28, 22, C.ink, 'center', 700);
  }

  toggleSfx() {
    this.settings.sfx = !this.settings.sfx;
    this.sound.setEnabled(this.settings.sfx);
    storeSettings(this.settings);
    if (!this.settings.sfx) GA.design('settings:sfx:off');
  }

  drawLevels() {
    const ctx = this.ctx, t = this.t;
    this.drawBackdrop();
    this.addButton({ x: 30, y: 26, w: 150, h: 60, label: '‹ BACK', size: 24, action: () => { this.screen = 'title'; this.focus = -1; } });
    this.addButton({ x: VIEW_W - 290, y: 26, w: 260, h: 60, size: 22,
      key: 'mode', label: this.mode === 'solo' ? 'MODE: 1 PLAYER' : 'MODE: 2 PLAYERS',
      color: this.mode === 'solo' ? '#F6C3BE' : '#BFD6F5',
      action: () => this.setMode(this.mode === 'solo' ? 'coop' : 'solo') });

    // World tabs
    WORLDS.forEach((w, i) => {
      const x = 250 + i * 270, open = w.levels.length > 0;
      rrect(ctx, x, 120, 240, 56, 14);
      ctx.fillStyle = i === 0 ? C.bolt : '#CFC3B4'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
      text(ctx, `${i + 1}  ${w.name.toUpperCase()}`, x + 120, 149, 22, C.ink);
      if (!open) this.drawLock(x + 214, 148, 0.7);
    });

    const next = this.nextLevel();
    const world = WORLDS[0];
    for (let i = 0; i < LEVELS_PER_WORLD; i++) {
      const col = i % 5, row = Math.floor(i / 5);
      const x = 255 + col * 160, y = 230 + row * 200;
      const level = world.levels[i];
      if (!level) {
        rrect(ctx, x, y + 6, 130, 130, 22); ctx.fillStyle = C.ink; ctx.fill();
        rrect(ctx, x, y, 130, 130, 22); ctx.fillStyle = '#E2D6C6'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = C.ink; ctx.stroke();
        text(ctx, String(i + 1), x + 65, y + 50, 40, '#B4A797');
        this.drawLock(x + 65, y + 96, 1);
        continue;
      }
      const stars = this.starsFor(level.id);
      const isNext = level === next;
      const bounce = isNext ? Math.abs(Math.sin(t * 4)) * -6 : 0;
      this.addButton({
        key: `level:${level.id}`, x, y: y + bounce, w: 130, h: 130, r: 22, color: isNext ? '#FFE9A8' : '#fff', isDefault: isNext,
        action: () => this.startLevel(level, this.mode),
        draw: (c, b) => {
          text(c, String(i + 1), b.x + 65, b.y + 52, 48);
          for (let s = 0; s < 3; s++) drawStar(c, b.x + 33 + s * 32, b.y + 100, 13, stars[s]);
        },
      });
    }
    text(ctx, world.levels[0] ? world.levels[0].name : '', VIEW_W / 2, VIEW_H - 45, 24, C.ink, 'center', 700);
  }

  drawLock(x, y, s) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineWidth = 4; ctx.strokeStyle = C.ink;
    ctx.beginPath(); ctx.arc(0, -8, 9, Math.PI, 0); ctx.stroke();
    rrect(ctx, -14, -8, 28, 22, 5); ctx.fillStyle = '#9C8F80'; ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  drawWorld() {
    const ctx = this.ctx, sim = this.sim, t = this.t;
    const a = this.paused || sim.done ? 1 : Math.min(1, this.acc / STEP);
    const lx = b => b.px + (b.x - b.px) * a, ly = b => b.py + (b.y - b.py) * a;
    const [sx, sy] = this.fx.offset();

    ctx.save();
    ctx.translate(sx, HUD_H + sy);
    if (this.layer) ctx.drawImage(this.layer, 0, 0, VIEW_W, VIEW_H - HUD_H);

    for (const p of sim.plates) drawPlate(ctx, p, sim.tiles, t);
    for (const g of sim.gates) drawGate(ctx, g);

    const inside = sim.inExit || [false, false];
    const target = sim.done ? 1 : (inside[0] + inside[1]) * 0.25;
    this.exitOpen += (target - this.exitOpen) * 0.15;
    drawExit(ctx, sim.exit, inside, t, this.exitOpen);

    for (const b of sim.bolts) if (!b.got) drawBolt(ctx, b, t);
    for (const c of sim.crates) if (c.sunk === 0) drawCrate(ctx, lx(c), ly(c));

    // Aim preview while the power is off (the controlled robots only).
    if (!sim.done && !this.replay) {
      sim.robots.forEach((r, i) => {
        if (r.power || r.hidden || (this.mode === 'solo' && sim.active !== i)) return;
        const held = sim.prev[i];
        const aim = held & (B.U | B.AU) ? 'up' : held & (B.D | B.AD) ? 'down' : 'side';
        previewTargets(sim, r, aim, previewHits);
        drawAimPreview(ctx, r.pol, aim, r.facing, lx(r) + r.w / 2, ly(r) + r.h / 2, previewHits, t);
      });
    }

    // Fields under the robots, robots on top.
    for (const r of sim.robots) {
      if (!r.power || r.hidden) continue;
      drawField(ctx, r, lx(r) + r.w / 2, ly(r) + r.h / 2, t);
      for (let i = 0; i < r.hits.length; i += 2) {
        if (this.fx.rnd() < 0.25) this.fx.spawn({ x: r.hits[i] + (this.fx.rnd() - 0.5) * 20, y: r.hits[i + 1] + (this.fx.rnd() - 0.5) * 20, vx: (this.fx.rnd() - 0.5) * 120, vy: (this.fx.rnd() - 0.5) * 120, type: 'spark', color: C.bolt, life: 0.18, g: 0 });
      }
    }
    sim.robots.forEach((r, i) => {
      if (r.hidden) return;
      const other = sim.robots[i ^ 1];
      const x = lx(r) + r.w / 2, y = ly(r) + r.h;
      let look;
      if (r.power) { const d = r.aim === 'up' ? { x: 0, y: -1 } : r.aim === 'down' ? { x: 0, y: 1 } : { x: r.facing, y: 0 }; look = d; }
      else { const dx = other.x - r.x, dy = other.y - r.y, d = Math.hypot(dx, dy) || 1; look = { x: dx / d, y: dy / d }; }
      const sq = this.fx.squash[r.pol];
      drawRobot(ctx, x, y, r.pol, r.facing, {
        sx: sq.sx, sy: sq.sy, t, look, power: r.power,
        walk: r.grounded && Math.abs(r.vx) > 20, blink: (t * 0.7 + i * 1.7) % 4 < 0.1,
      });
      if (this.mode === 'solo' && sim.active === i && !sim.done) {
        const ay = y - 66 + Math.sin(t * 6) * 3;
        ctx.fillStyle = r.pol === 'plus' ? C.plus : C.minus;
        ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x - 9, ay - 8); ctx.lineTo(x + 9, ay - 8); ctx.lineTo(x, ay + 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
    });

    this.drawPrompts(lx, ly);
    ctx.restore();
  }

  // Keycap hints instead of a text tutorial (GDD 8, first run).
  drawPrompts(lx, ly) {
    const ctx = this.ctx, sim = this.sim, tut = this.save.tut, t = this.t;
    if (sim.done) return;
    const near = (r, d) => {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      return sim.crates.some(c => Math.hypot(c.x + 20 - cx, c.y + 20 - cy) < d) || sim.plates.some(p => Math.hypot(p.x - cx, p.y - cy) < d);
    };
    const nearPlate = r => sim.plates.some(p => Math.abs(p.x - (r.x + r.w / 2)) < 60 && p.y < r.y);
    sim.robots.forEach((r, i) => {
      if (r.hidden) return;
      const x = lx(r) + r.w / 2, y = ly(r) - 48 + Math.sin(t * 4 + i) * 2;
      const solo = this.mode === 'solo';
      const keys = solo ? KEY_LABELS.solo : KEY_LABELS.coop[i];
      const active = !solo || sim.active === i;
      if (solo && !active) {
        if (!tut.switched) drawKeycap(ctx, keys.swap, x, y);
        return;
      }
      if (!tut[`moved_${r.pol}`]) { drawKeycap(ctx, keys.move, x, y); drawKeycap(ctx, keys.jump, x, y - 34); return; }
      if (!r.power && !tut[`power_${r.pol}`] && near(r, 180)) {
        drawKeycap(ctx, nearPlate(r) ? `${keys.jump} + ${keys.power}` : keys.power, x, y);
      }
    });
  }

  boltSlot(i) { return { x: 560 + i * 44, y: 40 }; }

  drawHud() {
    const ctx = this.ctx, sim = this.sim;
    ctx.fillStyle = C.ink;
    ctx.fillRect(0, 0, VIEW_W, HUD_H);
    const pos = this.levelPos(this.level.id);
    rrect(ctx, 20, 18, 70, 44, 10); ctx.fillStyle = C.bolt; ctx.fill();
    text(ctx, pos.world ? `${pos.world}-${pos.level}` : '–', 55, 41, 24);
    text(ctx, this.level.name.toUpperCase(), 108, 41, 24, C.bg, 'left', 800);

    for (let i = 0; i < 3; i++) {
      const s = this.boltSlot(i);
      if (i < sim.boltCount) drawHex(ctx, s.x, s.y, 14, C.bolt);
      else { ctx.globalAlpha = 0.35; drawHex(ctx, s.x, s.y, 14, '#8C7F9C'); ctx.globalAlpha = 1; }
    }

    const par = this.level.par[this.mode];
    const over = sim.time > par;
    text(ctx, fmt(sim.time), 760, 33, 30, C.bg, 'center', 800);
    text(ctx, `PAR ${fmt(par)}`, 760, 62, 15, over ? '#8C7F9C' : C.bolt, 'center', 800);

    if (this.mode === 'solo') {
      const r = sim.robots[sim.active];
      ctx.save(); ctx.translate(960, 66); ctx.scale(0.9, 0.9);
      drawRobot(ctx, 0, 0, r.pol, 1, { t: this.t, power: r.power });
      ctx.restore();
      drawKeycap(ctx, 'TAB', 1020, 41);
    }

    const pause = { key: 'hud:pause', hud: true, x: 1124, y: 14, w: 52, h: 52, r: 26, action: () => this.pause(true),
      draw: (c, b) => { c.fillStyle = C.ink; c.fillRect(b.x + 18, b.y + 15, 6, 22); c.fillRect(b.x + 29, b.y + 15, 6, 22); } };
    const restart = { key: 'hud:restart', hud: true, x: 1196, y: 14, w: 52, h: 52, r: 26, action: () => this.restart(),
      draw: (c, b) => {
        c.strokeStyle = C.ink; c.lineWidth = 4.5; c.lineCap = 'round';
        c.beginPath(); c.arc(b.x + 26, b.y + 26, 12, -0.3, Math.PI * 1.55); c.stroke();
        c.fillStyle = C.ink; c.beginPath(); c.moveTo(b.x + 38, b.y + 13); c.lineTo(b.x + 40, b.y + 27); c.lineTo(b.x + 27, b.y + 21); c.fill();
      } };
    if (this.screen === 'playing' && !this.paused && !sim.done) { this.addButton(pause); this.addButton(restart); }
  }

  drawPanel(w, h, k = 1) {
    const ctx = this.ctx;
    const x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2 + (1 - k) * 500;
    ctx.fillStyle = 'rgba(43,34,56,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    rrect(ctx, x, y + 8, w, h, 28); ctx.fillStyle = C.ink; ctx.fill();
    rrect(ctx, x, y, w, h, 28); ctx.fillStyle = C.bg; ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.stroke();
    return { x, y };
  }

  drawPause() {
    const ctx = this.ctx;
    const { x, y } = this.drawPanel(640, 520);
    text(ctx, 'PAUSED', VIEW_W / 2, y + 56, 46, C.ink, 'center', 900);
    const bx = x + 60, bw = 240;
    this.addButton({ x: bx, y: y + 110, w: bw, h: 64, label: 'RESUME', color: C.bolt, size: 26, action: () => this.pause(false) });
    this.addButton({ x: bx, y: y + 190, w: bw, h: 64, label: 'RESTART', size: 26, action: () => this.restart() });
    const other = this.mode === 'solo' ? 'coop' : 'solo';
    this.addButton({ x: bx, y: y + 270, w: bw, h: 64, size: 22, label: other === 'solo' ? 'SWITCH TO 1P' : 'SWITCH TO 2P',
      action: () => { this.endAttempt(); this.setMode(other); this.startLevel(this.level, other); } });
    this.addButton({ x: bx, y: y + 350, w: bw, h: 64, label: 'MENU', size: 26, action: () => this.toMenu('levels') });

    // Controls card for the current mode
    const cx = x + 340, cy = y + 120;
    rrect(ctx, cx, cy, 250, 300, 18); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = C.ink; ctx.stroke();
    text(ctx, 'CONTROLS', cx + 125, cy + 28, 20, C.ink, 'center', 900);
    const rows = this.mode === 'solo'
      ? [['MOVE', 'A D'], ['JUMP', 'W'], ['POWER', 'F (tap)'], ['AIM UP', 'W + F'], ['SWAP', 'TAB']]
      : [['', 'PLUS', 'MINUS'], ['MOVE', 'A D', '← →'], ['JUMP', 'W', '↑'], ['POWER', 'F', '/'], ['AIM UP', 'W+F', '↑+/']];
    rows.forEach((row, i) => {
      const ry = cy + 72 + i * 44;
      text(ctx, row[0], cx + 18, ry, 15, C.ink, 'left', 800);
      if (row.length === 2) text(ctx, row[1], cx + 232, ry, 17, C.ink, 'right', 800);
      else {
        text(ctx, row[1], cx + 150, ry, 17, i ? C.ink : C.plus, 'center', 800);
        text(ctx, row[2], cx + 215, ry, 17, i ? C.ink : C.minus, 'center', 800);
      }
    });
  }

  drawComplete() {
    const ctx = this.ctx, r = this.result;
    if (!r.shownAt) r.shownAt = this.t;
    const e = this.t - r.shownAt;
    const k = easeOutBack(Math.min(1, e / 0.45));
    const { x, y } = this.drawPanel(620, 470, k);
    text(ctx, 'LEVEL COMPLETE!', VIEW_W / 2, y + 58, 42, C.ink, 'center', 900);

    for (let i = 0; i < 3; i++) {
      const at = 0.5 + i * 0.35;
      const lit = r.merged[i] && e > at;
      let s = 1;
      if (lit) {
        const q = Math.min(1, (e - at) / 0.25);
        s = 1 + (1 - q) * 1.2;
        if (!r[`stamp${i}`]) { r[`stamp${i}`] = true; this.sound.play('star', { i }); this.fx.burst(VIEW_W / 2 - 110 + i * 110, y + 150 - HUD_H, 12, C.bolt, 260, 'dot', 0.4, 4, 300); }
      }
      drawStar(ctx, VIEW_W / 2 - 110 + i * 110, y + 150, i === 1 ? 46 : 40, lit, s);
    }
    const labels = ['FINISH', 'ALL BOLTS', 'UNDER PAR'];
    labels.forEach((l, i) => text(ctx, l, VIEW_W / 2 - 110 + i * 110, y + 205, 13, r.run[i] ? C.ink : '#A89A8A', 'center', 800));

    const shown = Math.min(r.time, r.time * Math.min(1, Math.max(0, e - 0.3) / 0.8));
    text(ctx, `TIME  ${fmt(shown)}`, VIEW_W / 2, y + 252, 28, C.ink, 'center', 800);
    text(ctx, `BEST ${fmt(r.best)}   ·   PAR ${fmt(r.par)}`, VIEW_W / 2, y + 288, 18, '#6B5D7A', 'center', 700);
    for (let i = 0; i < 3; i++) {
      if (i < r.bolts) drawHex(ctx, VIEW_W / 2 - 40 + i * 40, y + 326, 13, C.bolt);
      else { ctx.globalAlpha = 0.35; drawHex(ctx, VIEW_W / 2 - 40 + i * 40, y + 326, 13, '#8C7F9C'); ctx.globalAlpha = 1; }
    }

    if (e < 0.35) return;
    const by = y + 372;
    const pos = this.levelPos(this.level.id);
    const nextLevel = pos.world ? WORLDS[pos.world - 1].levels[pos.level] : null;
    this.addButton({ x: x + 40, y: by, w: 170, h: 64, label: 'MENU', size: 24, action: () => this.toMenu('levels') });
    this.addButton({ x: x + 225, y: by, w: 170, h: 64, label: 'RETRY', size: 24, action: () => this.startLevel(this.level, this.mode) });
    this.addButton({ x: x + 410, y: by, w: 170, h: 64, label: 'NEXT ›', size: 24, color: C.bolt,
      action: () => nextLevel ? this.startLevel(nextLevel, this.mode) : this.toMenu('levels') });
    if (this.focus < 0) this.focus = this.buttons.length - 1;
  }

  drawKeytest() {
    const ctx = this.ctx;
    const keys = [...this.input.down];
    rrect(ctx, 10, VIEW_H - 150, 620, 140, 12);
    ctx.fillStyle = 'rgba(43,34,56,0.85)'; ctx.fill();
    text(ctx, 'KEY TEST (?keytest)', 26, VIEW_H - 128, 16, C.bolt, 'left', 800);
    text(ctx, `held: ${keys.join(' ') || '—'}`, 26, VIEW_H - 98, 16, '#fff', 'left', 600);
    const b = this.input.sample('coop');
    const bitStr = n => ['L', 'R', 'U', 'D', 'P'].filter((_, i) => n & (1 << i)).join('') || '·';
    text(ctx, `plus: ${bitStr(b & 255)}    minus: ${bitStr(b >> 8)}    solo: ${bitStr(this.input.sample('solo'))}`, 26, VIEW_H - 68, 16, '#fff', 'left', 600);
    text(ctx, `${keys.length} keys at once`, 26, VIEW_H - 38, 16, '#fff', 'left', 600);
  }
}
