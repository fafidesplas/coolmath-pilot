// Screen flow (GDD 8), the frame loop, and the glue between sim, input, render,
// sound, saving and analytics. Button and panel code adapted from Flip Runner
// (buttons are rebuilt every frame and matched by a stable key, never by identity).
import { VIEW_W, VIEW_H, HUD_H, HZ, STEP, MAX_FRAME_DT, T, PLAYER as P, BIT, MOVE_BITS, REWIND, FFWD, COLORS as C, ECHO_ALPHA, WORLD_NAMES, ROOMS_PER_WORLD } from './config.js';
import { parseLevel } from './level.js';
import { Sim } from './sim.js';
import { Forecast } from './forecast.js';
import { POSE } from './tape.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { FX } from './fx.js';
import { GA } from './analytics.js';
import { loadSave, storeSave, loadSettings, storeSettings } from './save.js';
import { Recorder, decodeRecording } from './record.js';
import { renderRoom, roomOffset, wirePath, drawFigure, drawSilhouette, drawBadge, drawPlate, drawGate, drawExit, drawKeycap, drawRing, drawStar, drawGlow, rrect, text, rgba } from './render.js';
import { drawHud, fmtTime, fmtTenths, iconLoop, iconClock, iconDelete } from './hud.js';
import { WORLDS, findRoom, roomPos } from '../levels/index.js';

const easeOutBack = k => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
const clamp01 = k => Math.max(0, Math.min(1, k));
const MENU_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Space', 'Escape', 'KeyA', 'KeyD', 'KeyW', 'KeyS']);

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

    this.screen = 'title';
    this.paused = false;
    this.phase = 'play';
    this.room = null; this.lv = null; this.sim = null; this.forecast = null;
    this.acc = 0; this.t = 0;
    this.buttons = []; this.focus = -1; this.hover = null; this.pressed = null;
    this.touchMode = false; this.touches = new Map();
    this.fixedHz = Number(this.params.get('hz')) || 0;
    this.lastRecording = null;
    this.slotShake = 0; this.slotPop = [0, 0, 0, 0];

    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.pause(true); });
    this.bindPointer();

    const roomParam = this.params.get('room');
    if (this.params.has('replay')) this.startReplay(roomParam || WORLDS[0].rooms[0].id);
    else if (roomParam && findRoom(roomParam)) this.startRoom(findRoom(roomParam));

    this.last = performance.now();
    requestAnimationFrame(now => this.frame(now));
    this.api = this.makeApi();
  }

  // ---- Setup -----------------------------------------------------------------------

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.cssW = w; this.cssH = h;
    this.scale = Math.min(w / VIEW_W, h / VIEW_H);
    this.ox = (w - VIEW_W * this.scale) / 2;
    this.oy = (h - VIEW_H * this.scale) / 2;
    this.dpr = dpr;
    if (this.lv) this.layer = renderRoom(this.lv, this.scale * dpr, this.off);
  }

  bindPointer() {
    const toView = e => ({ x: (e.clientX - this.ox) / this.scale, y: (e.clientY - this.oy) / this.scale });
    const hit = p => {
      for (const b of this.buttons) {
        if (b.disabled) continue;
        // Hit areas never under 48 CSS px (GDD 4): enlarge small buttons around their drawing.
        const pw = Math.max(0, (48 / this.scale - b.w) / 2), ph = Math.max(0, (48 / this.scale - b.h) / 2);
        if (p.x >= b.x - pw && p.x <= b.x + b.w + pw && p.y >= b.y - ph && p.y <= b.y + b.h + ph) return b;
      }
      return null;
    };
    this.canvas.addEventListener('pointerdown', e => {
      this.sound.unlock();
      if (e.pointerType === 'touch') this.touchMode = true;
      if (this.touchMode && this.screen === 'playing' && !this.paused) {
        const tb = this.touchButtonAt(e.clientX, e.clientY);
        if (tb) { this.touches.set(e.pointerId, tb); this.applyTouches(tb, true); this.skipRewind(); return; }
      }
      const p = toView(e);
      this.pressed = hit(p);
      if (this.pressed && this.canvas.setPointerCapture) this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', e => {
      this.hover = hit(toView(e));
      this.canvas.style.cursor = this.hover ? 'pointer' : 'default';
    });
    const up = e => {
      if (this.touches.has(e.pointerId)) { this.touches.delete(e.pointerId); this.applyTouches(null, false); return; }
      // Buttons are rebuilt every frame, so match by key, not by object.
      const b = hit(toView(e));
      if (b && this.pressed && b.key === this.pressed.key) this.activate(b);
      this.pressed = null;
    };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', e => { this.touches.delete(e.pointerId); this.applyTouches(null, false); this.pressed = null; });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  makeApi() {
    const g = this;
    return {
      get screen() { return g.screen; },
      get level() { return g.room ? g.room.id : null; },
      get score() { const r = g.room && g.save.rooms[g.room.id]; return r ? r.stars.filter(Boolean).length : 0; },
      get loop() { return g.sim ? g.sim.loopTime : 0; },
      get echoes() { return g.sim ? g.sim.count : 0; },
      start() { g.startRoom(g.nextRoom()); },
      restart() { if (g.room) g.restart(); },
      win() { if (g.sim && g.screen === 'playing' && !g.sim.s.done) { g.sim.forceWin(); g.handleEvents(); } },   // debug only
      replay(rec) { return rec ? g.startRoom(findRoom(rec.level), decodeRecording(rec)) : g.startReplay(g.room ? g.room.id : 'w1l01'); },  // debug only
      get sim() { return g.sim; },
      get phase() { return g.phase; },
      get paused() { return g.paused; },
      get recording() { return g.lastRecording; },
      get buttons() { return g.buttons.map(b => ({ key: b.key, x: b.x, y: b.y, w: b.w, h: b.h, disabled: !!b.disabled })); },
      get view() { return { scale: g.scale, ox: g.ox, oy: g.oy }; },
      get analytics() { return GA.log; },
      get save() { return g.save; },
    };
  }

  live() { return this.screen === 'playing' && !this.paused && this.sim && !this.sim.s.done; }

  // ---- Rooms -----------------------------------------------------------------------

  roomPos(id) { return roomPos(id); }
  roomNumber(id) { const p = roomPos(id); return (p.world - 1) * ROOMS_PER_WORLD + p.level; }
  isDone(id) { const r = this.save.rooms[id]; return !!(r && r.stars && r.stars[0]); }
  isUnlocked(i) { const rooms = WORLDS[0].rooms; return i === 0 || (rooms[i - 1] && this.isDone(rooms[i - 1].id)); }
  nextRoom() {
    for (const w of WORLDS) for (const r of w.rooms) if (!this.isDone(r.id)) return r;
    return WORLDS[0].rooms[0];
  }
  showTimeline() { const p = roomPos(this.room.id); return !(p.world === 1 && p.level <= 2); }

  startRoom(room, replayFrames = null) {
    if (!room) return;
    this.room = room;
    this.lv = parseLevel(room);
    this.sim = new Sim(this.lv);
    this.forecast = new Forecast(this.sim).run();
    this.off = roomOffset(this.lv);
    this.layer = renderRoom(this.lv, this.scale * this.dpr, this.off);
    this.replay = replayFrames;
    this.recorder = this.params.has('record') && !replayFrames ? new Recorder() : null;
    this.screen = 'playing';
    this.paused = false;
    this.phase = 'play';
    this.acc = 0;
    this.result = null;
    this.input.clear();
    this.input.ignoreHeld();   // a key still held from the menu (Enter, Space) is not an input
    this.input.accepting = !replayFrames;
    this.fx.clear();
    this.buttons = []; this.focus = -1;
    this.cue = { moved: false, jumped: false, stillT: 0 };
    this.rewind = null;
    this.slotShake = 0; this.slotPop = [0, 0, 0, 0];
    this.zapKey = 0;
    this.sound.layers = 0;
    this.sound.want(true);
    this.sound.restartMusic();
    if (!replayFrames) { const pos = roomPos(room.id); GA.progression('Start', pos.world, pos.level); }
  }

  async startReplay(id) {
    try {
      const rec = await (await fetch(`levels/solutions/${id}.json`)).json();
      this.startRoom(findRoom(id), decodeRecording(rec));
    } catch (e) { console.warn('No recording to replay', e); }
  }

  loopsPlayed() { const s = this.sim.s; return s.counts.loops + (s.running || s.done ? 1 : 0); }

  sendCounts() {
    const c = this.sim.s.counts;
    GA.design('level:loops', this.loopsPlayed());
    GA.design('loop:early', c.early);
    GA.design('loop:timeout', c.timeout);
    if (c.full) GA.design('loop:full', c.full);
    GA.design('echo:delete', c.deletes);
    if (c.breaks) GA.design('echo:break', c.breaks);
  }

  // Attempt ends without reaching the exit (restart, or quit to the menu).
  endAttempt() {
    if (!this.sim || this.sim.s.done || this.replay) return;
    const pos = roomPos(this.room.id);
    GA.progression('Fail', pos.world, pos.level, Math.round(this.sim.roomTime));
    this.sendCounts();
  }

  restart() {
    if (!this.room) return;
    const old = this.sim;
    this.endAttempt();
    if (!this.replay) GA.design('ui:restart');
    this.sound.play('rewind');
    const replay = this.replay;
    if (old && !old.s.done) old.snapshotLoop();
    this.startRoom(this.room, replay);
    if (old && old.last.len > 0) this.rewind = { t: 0, last: old.last, freeze: 0, dur: REWIND.restart, slot: -1 };
    if (this.rewind) this.phase = 'rewind';
  }

  toMenu(screen = 'title') {
    if (this.screen === 'playing') this.endAttempt();
    this.screen = screen;
    this.paused = false;
    this.sim = null; this.lv = null;
    this.focus = -1;
    this.input.accepting = false;
    this.sound.want(false);
  }

  pause(on) {
    if (this.screen !== 'playing' || !this.sim || this.sim.s.done || this.paused === on) return;
    this.paused = on;
    this.sound.want(!on);
    this.focus = on ? 0 : -1;
    this.input.accepting = !on && !this.replay;
    this.input.clear();
    this.input.ignoreHeld();
  }

  // ---- Input -----------------------------------------------------------------------

  onKey(code) {
    this.sound.unlock();
    if (this.touchMode) { this.touchMode = false; this.touches.clear(); this.input.touchBits = 0; }
    if (this.screen === 'playing' && (code === 'KeyP' || code === 'Escape')) {
      if (this.sim && !this.sim.s.done) { this.pause(!this.paused); this.sound.play('click'); }
      return;
    }
    if (this.screen === 'playing' && code === 'KeyR' && !this.paused && !this.sim.s.done) { this.restart(); return; }
    if (this.phase === 'rewind' && this.live()) {
      // Any key skips the rest of the rewind; Loop and Delete only skip.
      if (code === 'KeyE' || code === 'Enter' || code === 'Backspace' || code === 'Delete') this.input.clear(BIT.LOOP | BIT.DEL);
      this.skipRewind();
      return;
    }
    if (this.live()) return;
    if (!MENU_KEYS.has(code)) return;
    const list = this.buttons.filter(b => !b.disabled && !b.hud);
    if (!list.length) return;
    const i = list.indexOf(this.buttons[this.focus]);
    const move = d => { const n = list[(Math.max(i, 0) + d + list.length) % list.length]; this.focus = this.buttons.indexOf(n); this.sound.play('click'); };
    if (code === 'ArrowRight' || code === 'ArrowDown' || code === 'KeyD' || code === 'KeyS') move(i < 0 ? 0 : 1);
    else if (code === 'ArrowLeft' || code === 'ArrowUp' || code === 'KeyA' || code === 'KeyW') move(i < 0 ? 0 : -1);
    else if (code === 'Enter' || code === 'Space') {
      const b = this.buttons[this.focus] && !this.buttons[this.focus].disabled ? this.buttons[this.focus] : list.find(q => q.isDefault) || list[0];
      this.activate(b);
    } else if (code === 'Escape' && this.screen === 'levels') this.toMenu('title');
  }

  activate(b) {
    this.sound.unlock();
    this.sound.play('click');
    b.action();
  }

  // Touch buttons in CSS px, not scaled with the canvas (GDD 4).
  touchLayout() {
    const W = this.cssW, H = this.cssH, m = 18;
    return [
      { id: 'left', bit: BIT.LEFT, x: m, y: H - m - 64, s: 64, label: '◀' },
      { id: 'right', bit: BIT.RIGHT, x: m + 76, y: H - m - 64, s: 64, label: '▶' },
      { id: 'jump', bit: BIT.JUMP, x: W - m - 64, y: H - m - 64, s: 64, label: 'JUMP' },
      { id: 'ffwd', bit: 0, x: W - m - 64 - 68, y: H - m - 56, s: 56, label: '»' },
      { id: 'loop', bit: BIT.LOOP, x: W - m - 60, y: H - m - 64 - 68, s: 56, label: 'loop' },
      { id: 'del', bit: BIT.DEL, x: W - m - 60 - 68, y: H - m - 64 - 68, s: 56, label: 'del' },
    ];
  }

  touchButtonAt(cx, cy) {
    return this.touchLayout().find(b => cx >= b.x - 6 && cx <= b.x + b.s + 6 && cy >= b.y - 6 && cy <= b.y + b.s + 6) || null;
  }

  applyTouches(pressed, down) {
    if (down && pressed && (pressed.bit === BIT.LOOP || pressed.bit === BIT.DEL)) this.input.press(pressed.bit);
    let bits = 0, ff = false;
    for (const b of this.touches.values()) { if (b.bit & MOVE_BITS) bits |= b.bit; if (b.id === 'ffwd') ff = true; }
    this.input.touchBits = bits;
    this.input.ffwdTouch = ff;
    if (down && pressed && (pressed.bit & MOVE_BITS)) this.input.press(pressed.bit);
  }

  skipRewind() {
    if (this.phase === 'rewind' && this.rewind) this.rewind.t = 99;
  }

  // ---- Frame -----------------------------------------------------------------------

  frame(now) {
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (this.fixedHz) dt = 1 / this.fixedHz;
    dt = Math.min(Math.max(dt, 0), MAX_FRAME_DT);
    this.t += dt;

    if (this.screen === 'playing' && !this.paused && this.sim) this.update(dt);
    else if (this.screen === 'complete' && this.result) this.result.replayT += dt;
    this.slotShake = Math.max(0, this.slotShake - dt * 3);
    for (let i = 0; i < 4; i++) this.slotPop[i] = Math.max(0, this.slotPop[i] - dt * 3);
    this.fx.update(dt);
    this.draw();
    requestAnimationFrame(n => this.frame(n));
  }

  update(dt) {
    if (this.phase === 'rewind') {
      const r = this.rewind;
      r.t += dt;
      if (r.t >= r.freeze + r.dur) this.endRewind();
      return;
    }
    if (this.phase === 'exit') {
      this.exitT += dt;
      if (this.exitT >= 1.1) { this.screen = 'complete'; this.focus = -1; this.result.shownAt = this.t; }
      return;
    }
    const s = this.sim.s, p = s.p;
    // Fast-forward: hold ↓ / S while standing still on the ground (display speed only).
    this.ffwd = this.input.ffwd && s.running && p.grounded && p.vx === 0 && !(this.input.held & MOVE_BITS) && !this.replay;
    if (this.ffwd && !this.save.tut.ffwd) { this.save.tut.ffwd = true; storeSave(this.save); }
    this.acc += dt * (this.ffwd ? FFWD : 1);
    while (this.acc >= STEP && this.phase === 'play' && this.screen === 'playing') {
      this.tick();
      this.acc -= STEP;
    }
    if (this.phase !== 'play') this.acc = 0;
    // Contextual ↓ keycap: standing still with an echo event still to come.
    if (s.running && p.grounded && p.vx === 0 && s.count > 0) this.cue.stillT += dt; else this.cue.stillT = 0;
  }

  tick() {
    const sim = this.sim;
    const bits = this.replay ? (this.replay[sim.s.n] ?? 0) : this.input.sample();
    if (this.recorder) this.recorder.push(bits);
    sim.step(bits);
    this.handleEvents();
  }

  tut(key, id) {
    if (this.replay || this.save.tut[key]) return;
    this.save.tut[key] = true;
    storeSave(this.save);
    GA.design(id);
  }

  handleEvents() {
    const sim = this.sim, fx = this.fx, snd = this.sound, s = sim.s, p = s.p;
    const cx = p.x + P.w / 2;
    for (const e of sim.events) {
      switch (e.type) {
        case 'clockStart':
          this.cue.moved = true;
          this.tut('s1', 'tutorial:step01');
          snd.restartMusic();
          break;
        case 'second': {
          const left = sim.lv.loopSteps / HZ - e.sec;
          snd.play('tick', { late: left <= 3 });
          break;
        }
        case 'jump':
          this.cue.jumped = true;
          snd.play('jump');
          fx.kick(0.8, 1.25);
          break;
        case 'land':
          snd.play('land');
          fx.kick(1.25, 0.8);
          fx.burst(cx, p.y + P.h, 6, C.cyan, 90, 'spark', 0.25, 2);
          if (e.echo >= 0) this.tut('s4', 'tutorial:step04');
          break;
        case 'plateDown': snd.play('plateDown'); this.pulsePlate(e.plate); break;
        case 'plateUp': snd.play('plateUp'); break;
        case 'gateOpen': snd.play('gateOpen'); break;
        case 'gateClose': {
          snd.play('gateClose');
          const g = sim.lv.gates[e.gate];
          if (Math.abs(g.x + T / 2 - cx) < 3 * T) fx.shake(2, 0.06);
          break;
        }
        case 'passGate': if (e.echoHeld) this.tut('s3', 'tutorial:step03'); break;
        case 'break': {
          const ec = s.echoes[e.echo];
          snd.play('break');
          fx.dissolve(ec.x + P.w / 2, ec.y + P.h, C.violet, 20);
          if (e.gate >= 0) { const g = sim.lv.gates[e.gate]; fx.burst(g.x + T / 2, g.y + 40, 10, C.pink, 160, 'spark', 0.3, 2); }
          break;
        }
        case 'loopEnd': this.onLoopEnd(e); break;
        case 'delete': this.onLoopEnd({ ...e, reason: 'delete' }); break;
        case 'exit': this.onComplete(); break;
      }
    }
    sim.events.length = 0;
  }

  pulsePlate(i) {
    const pl = this.sim.lv.plates[i];
    this.fx.burst(pl.x0 + T / 2, pl.y - 2, 8, C.yellow, 120, 'spark', 0.25, 2);
    for (const g of this.sim.lv.gates) {
      if (!g.chans.includes(pl.ch)) continue;
      const w = wirePath(this.sim.lv, pl, g);
      this.fx.spawn({ x: w[0], y: w[1], type: 'fly', tx: w[4], ty: w[5], color: C.yellow, life: 0.3, size: 3 });
    }
  }

  onLoopEnd(e) {
    const sim = this.sim, snd = this.sound, s = sim.s;
    const L = sim.last;
    if (e.reason === 'early') this.tut('s5', 'tutorial:step05');
    if (e.slot >= 0 && e.reason !== 'delete') this.tut('s2', 'tutorial:step02');
    snd.play('rewind');
    snd.stopMusic();
    if (e.reason !== 'delete' && e.slot < 0) {
      // Slots full: nothing recorded. The figure pops, the slots shake.
      snd.play('full');
      this.slotShake = 1;
      const n = Math.max(0, L.len - 1);
      if (L.len) this.fx.dissolve(L.live.x[n] + P.w / 2, L.live.y[n] + P.h, C.cyan, 18);
    }
    this.rewind = { t: 0, last: L, freeze: REWIND.freeze, dur: REWIND.time, slot: e.reason === 'delete' ? -1 : e.slot };
    this.phase = L.len > 0 ? 'rewind' : 'play';
    if (this.phase === 'play') this.endRewind();
    this.forecast.run();
    snd.layers = s.count;
  }

  endRewind() {
    const r = this.rewind;
    this.phase = 'play';
    this.rewind = null;
    this.acc = 0;
    if (r && r.slot >= 0) {
      // The new echo ripples from cyan to violet and its badge pops.
      const sp = this.sim.lv.spawn;
      this.fx.ring(sp.x + P.w / 2, sp.y + P.h / 2, C.violet, 12, 0.5);
      this.fx.ring(sp.x + P.w / 2, sp.y + P.h / 2, C.cyan, 6, 0.35);
      this.slotPop[r.slot] = 1;
      this.sound.play('echo', { i: r.slot });
    }
    this.sound.restartMusic();
  }

  onComplete() {
    const room = this.room, sim = this.sim, s = sim.s, lv = sim.lv;
    const echoes = s.count, time = sim.roomTime;
    const run = [1, echoes <= lv.par.echoes ? 1 : 0, s.roomSteps <= lv.par.time * HZ ? 1 : 0];
    const prev = this.save.rooms[room.id];
    const best = {
      stars: prev ? prev.stars.map((v, i) => (v || run[i] ? 1 : 0)) : run.slice(),
      echoes: prev && prev.echoes !== undefined ? Math.min(prev.echoes, echoes) : echoes,
      time: prev && prev.time !== undefined ? Math.min(prev.time, Math.round(time * 10) / 10) : Math.round(time * 10) / 10,
      skipped: false,
    };
    if (!this.replay) {
      this.save.rooms[room.id] = best;
      const pos = roomPos(room.id);
      if (pos.world === 1 && pos.level === 3) this.tut('done', 'tutorial:done');
      storeSave(this.save);
      GA.progression('Complete', pos.world, pos.level, run.filter(Boolean).length);
      GA.design('level:echoes_used', echoes);
      if (echoes < lv.par.echoes) GA.design('level:under_par', echoes);
      this.sendCounts();
    }
    this.result = { run, echoes, time, best, prevBest: prev || null, shownAt: 0, replayT: 0, stamped: [false, false, false] };
    this.phase = 'exit';
    this.exitT = 0;
    this.input.accepting = false;
    this.sound.play('exit');
    // Each echo streams into the exit as light, one by one with its note.
    const ex = lv.exit, tx = ex.col * T + T / 2, ty = (ex.row + 1) * T - 30;
    for (let i = 0; i < s.count; i++) {
      const e = s.echoes[i];
      if (e.broken) continue;
      for (let k = 0; k < 6; k++) this.fx.spawn({ x: e.x + P.w / 2, y: e.y + P.h / 2 - k * 4, type: 'fly', tx, ty, color: C.violet, life: 0.5 + i * 0.15 + k * 0.03, size: 4 });
      setTimeout(() => this.sound.play('sparkle', { i }), 150 + i * 150);
    }
    this.fx.burst(tx, ty, 36, C.yellow, 300, 'spark', 0.8, 2);
    this.fx.burst(tx, ty, 20, C.cyan, 220, 'dot', 0.7, 3);
    if (this.recorder) {
      this.lastRecording = this.recorder.finish(room.id);
      console.log(`Recording for levels/solutions/${room.id}.json:\n` + JSON.stringify(this.lastRecording));
    }
  }

  // ---- Drawing ---------------------------------------------------------------------

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#070A18';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.dpr * this.ox, this.dpr * this.oy);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, VIEW_W, VIEW_H); ctx.clip();
    this.buttons = [];
    if (this.screen === 'title') this.drawTitle();
    else if (this.screen === 'levels') this.drawRooms();
    else if (this.sim) {
      this.drawRoom();
      drawHud(this);
      if (this.paused) this.drawPause();
      if (this.screen === 'complete') this.drawComplete();
    }
    ctx.restore();
    if (this.touchMode && this.screen === 'playing' && !this.paused) this.drawTouch();
  }

  addButton(b) {
    b.key = b.key || b.label;
    this.buttons.push(b);
    const ctx = this.ctx, idx = this.buttons.length - 1;
    const hot = this.hover && this.hover.key === b.key;
    const focused = this.focus === idx;
    const down = this.pressed && this.pressed.key === b.key;
    const lift = b.disabled ? 0 : down ? 2 : hot || focused ? -2 : 0;
    ctx.save();
    ctx.translate(0, lift);
    ctx.globalAlpha = b.disabled ? 0.4 : 1;
    rrect(ctx, b.x, b.y, b.w, b.h, b.r ?? 16);
    ctx.fillStyle = b.primary ? C.cyan : rgba(C.pale, 0.06);
    ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = b.primary ? C.cyan : rgba(C.pale, 0.6); ctx.stroke();
    if (focused || hot) {
      ctx.lineWidth = 3; ctx.strokeStyle = C.yellow;
      rrect(ctx, b.x - 5, b.y - 5, b.w + 10, b.h + 10, (b.r ?? 16) + 5); ctx.stroke();
    }
    if (b.draw) b.draw(ctx, b);
    else text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, b.size || 26, b.primary ? C.navy : C.pale, 'center', 900);
    ctx.restore();
    return b;
  }

  drawLock(x, y, s) {
    const ctx = this.ctx;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.lineWidth = 3.5; ctx.strokeStyle = rgba(C.pale, 0.6);
    ctx.beginPath(); ctx.arc(0, -8, 8, Math.PI, 0); ctx.stroke();
    rrect(ctx, -12, -8, 24, 19, 4); ctx.fillStyle = rgba(C.pale, 0.2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ---- Title -----------------------------------------------------------------------

  drawTitle() {
    const ctx = this.ctx, t = this.t;
    ctx.fillStyle = C.navy; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.strokeStyle = rgba(C.cyan, 0.04); ctx.lineWidth = 1;
    for (let x = 0; x <= VIEW_W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VIEW_H); ctx.stroke(); }
    for (let y = 0; y <= VIEW_H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW_W, y); ctx.stroke(); }
    this.drawTitleDemo(t);

    // Logo with two violet echoes trailing behind
    ctx.save();
    ctx.translate(VIEW_W / 2, 140 + Math.sin(t * 1.6) * 3);
    for (let k = 2; k >= 1; k--) {
      ctx.globalAlpha = 0.5 - k * 0.15;
      text(ctx, 'ECHO STEPS', -k * 14 * (1 + Math.sin(t * 2) * 0.15), k * 4, 96, C.violet, 'center', 900);
    }
    ctx.globalAlpha = 1;
    drawGlow(ctx, C.cyan, 0, 0, 200);
    text(ctx, 'ECHO STEPS', 0, 0, 96, C.cyan, 'center', 900);
    ctx.fillStyle = C.pale; ctx.fillRect(-300, 56, 600, 3);
    ctx.restore();

    const next = this.nextRoom();
    this.addButton({ key: 'play', x: VIEW_W / 2 - 160, y: 250, w: 320, h: 90, label: 'PLAY', size: 44, primary: true, isDefault: true,
      action: () => this.startRoom(next) });
    text(ctx, `Room ${this.roomNumber(next.id)}: ${next.name}`, VIEW_W / 2, 360, 17, rgba(C.pale, 0.6), 'center', 700);
    this.addButton({ key: 'rooms', x: VIEW_W / 2 - 220, y: 390, w: 210, h: 60, label: 'ROOMS', size: 24, action: () => { this.screen = 'levels'; this.focus = -1; } });
    this.addButton({ key: 'trails', x: VIEW_W / 2 + 10, y: 390, w: 210, h: 60, label: 'TRAILS', disabled: true, size: 24, action: () => {},
      draw: (c, b) => { text(c, 'TRAILS', b.x + b.w / 2 + 14, b.y + b.h / 2, 22, C.pale, 'center', 900); this.drawLock(b.x + 34, b.y + b.h / 2 + 3, 0.7); } });
    text(ctx, 'Trails unlock with time stars', VIEW_W / 2 + 115, 466, 14, rgba(C.pale, 0.45), 'center', 700);
    this.addButton({ key: 'sound', x: VIEW_W - 250, y: 24, w: 220, h: 52, size: 20,
      label: this.settings.sfx ? 'SOUND: ON' : 'SOUND: OFF', action: () => this.toggleSfx() });
    this.addButton({ key: 'music', x: VIEW_W - 250, y: 88, w: 220, h: 52, size: 20,
      label: this.settings.music ? 'MUSIC: ON' : 'MUSIC: OFF', action: () => this.toggleMusic() });
  }

  // Behind the title: the player and three echoes loop a little demo on a plate and a gate.
  drawTitleDemo(t) {
    const ctx = this.ctx, floor = 650, cycle = 6, k = (t % cycle) / cycle;
    ctx.fillStyle = rgba(C.pale, 0.08); ctx.fillRect(0, floor, VIEW_W, VIEW_H - floor);
    ctx.fillStyle = C.pale; ctx.fillRect(0, floor, VIEW_W, 2);
    const plateX = 380, gateX = 820;
    const holder = Math.min(1, k / 0.25);
    const ex = 200 + (plateX - 200) * holder;
    const open = clamp01((k - 0.22) / 0.06);
    // plate and gate
    rrect(ctx, plateX - 16, floor - 6 + (holder >= 1 ? 4 : 0), 32, 8, 3);
    ctx.fillStyle = holder >= 1 ? C.yellow : rgba(C.yellow, 0.4); ctx.fill();
    ctx.strokeStyle = C.pink; ctx.lineWidth = 3;
    const gh = 120 * (1 - open);
    ctx.fillStyle = rgba(C.pink, 0.3); ctx.fillRect(gateX - 14, floor - 120, 28, gh); ctx.strokeRect(gateX - 14, floor - 120, 28, gh);
    ctx.setLineDash([4, 6]); ctx.strokeStyle = rgba(C.yellow, holder >= 1 ? 0.8 : 0.3); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(plateX, floor + 14); ctx.lineTo(gateX, floor + 14); ctx.stroke(); ctx.setLineDash([]);
    // echoes and player
    drawFigure(ctx, ex, floor, { color: C.violet, alpha: 0.85, dashed: true, run: holder < 1, t, facing: 1 });
    drawFigure(ctx, 1050 + Math.sin(t * 0.7) * 10, floor, { color: C.violet, alpha: 0.6, dashed: true, t });
    drawFigure(ctx, 130, floor, { color: C.violet, alpha: 0.5, dashed: true, t });
    const px = 200 + clamp01((k - 0.2) / 0.6) * 900;
    drawFigure(ctx, px, floor, { color: C.cyan, run: k > 0.2 && k < 0.8, t, facing: 1 });
    ctx.globalAlpha = 0.7;
    drawRing(ctx, px, floor - 22, { frac: 1 - k, waiting: false, last2: k > 0.8, loopSec: 6, t });
    ctx.globalAlpha = 1;
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

  togglePaths() {
    this.settings.paths = !this.settings.paths;
    storeSettings(this.settings);
    if (!this.settings.paths) GA.design('settings:paths:off');
  }

  // ---- Room select -------------------------------------------------------------------

  drawRooms() {
    const ctx = this.ctx, t = this.t;
    ctx.fillStyle = C.navy; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    this.addButton({ key: 'back', x: 30, y: 24, w: 140, h: 56, label: '‹ BACK', size: 22, action: () => { this.screen = 'title'; this.focus = -1; } });
    text(ctx, 'ROOMS', VIEW_W / 2, 52, 40, C.pale, 'center', 900);
    WORLD_NAMES.forEach((name, i) => {
      const x = 250 + i * 270, open = i === 0;
      rrect(ctx, x, 104, 240, 52, 14);
      ctx.fillStyle = open ? C.cyan : rgba(C.pale, 0.06); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = open ? C.cyan : rgba(C.pale, 0.3); ctx.stroke();
      text(ctx, name.toUpperCase(), x + 120, 124, 20, open ? C.navy : rgba(C.pale, 0.5), 'center', 900);
      if (!open) { text(ctx, i === 1 ? 'Finish the Lab' : 'Finish the Archive', x + 120, 144, 12, rgba(C.pale, 0.5), 'center', 700); this.drawLock(x + 214, 132, 0.6); }
    });
    const rooms = WORLDS[0].rooms, next = this.nextRoom();
    for (let i = 0; i < ROOMS_PER_WORLD; i++) {
      const col = i % 6, row = Math.floor(i / 6);
      const x = 115 + col * 180, y = 190 + row * 245;
      const room = rooms[i];
      if (!room || !this.isUnlocked(i)) {
        rrect(ctx, x, y, 150, 200, 18); ctx.fillStyle = rgba(C.pale, 0.03); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = rgba(C.pale, 0.15); ctx.stroke();
        text(ctx, String(i + 1), x + 75, y + 60, 40, rgba(C.pale, 0.2), 'center', 900);
        this.drawLock(x + 75, y + 128, 1);
        if (!room) text(ctx, 'coming soon', x + 75, y + 172, 13, rgba(C.pale, 0.3), 'center', 700);
        continue;
      }
      const rec = this.save.rooms[room.id];
      const stars = rec ? rec.stars : [0, 0, 0];
      const isNext = room === next && !this.isDone(room.id);
      const bounce = isNext ? -Math.abs(Math.sin(t * 4)) * 6 : 0;
      this.addButton({
        key: `room:${room.id}`, x, y: y + bounce, w: 150, h: 200, r: 18, isDefault: isNext,
        action: () => this.startRoom(room),
        draw: (c, b) => {
          if (isNext) { rrect(c, b.x, b.y, b.w, b.h, 18); c.strokeStyle = C.cyan; c.lineWidth = 3; c.stroke(); }
          text(c, String(i + 1), b.x + 75, b.y + 46, 44, isNext ? C.cyan : C.pale, 'center', 900);
          text(c, room.name, b.x + 75, b.y + 86, 16, C.pale, 'center', 800);
          for (let k = 0; k < 3; k++) drawStar(c, b.x + 35 + k * 40, b.y + 122, 13, stars[k] ? C.yellow : null, stars[k] ? C.navy : rgba(C.pale, 0.35));
          text(c, 'EXIT', b.x + 35, b.y + 143, 9, rgba(C.pale, 0.5), 'center', 800);
          text(c, 'ECHO', b.x + 75, b.y + 143, 9, rgba(C.pale, 0.5), 'center', 800);
          text(c, 'TIME', b.x + 115, b.y + 143, 9, rgba(C.pale, 0.5), 'center', 800);
          if (rec) {
            iconLoop(c, b.x + 30, b.y + 172, 6, C.violet);
            text(c, String(rec.echoes), b.x + 42, b.y + 173, 15, C.pale, 'left', 800);
            iconClock(c, b.x + 78, b.y + 172, 6, C.yellow);
            text(c, fmtTenths(rec.time), b.x + 90, b.y + 173, 14, C.pale, 'left', 800);
          }
        },
      });
    }
  }

  // ---- In the room -----------------------------------------------------------------

  drawRoom() {
    const ctx = this.ctx, sim = this.sim, s = sim.s, lv = sim.lv, t = this.t;
    const [sx, sy] = this.fx.offset();
    ctx.save();
    ctx.translate(sx, HUD_H + sy);
    ctx.drawImage(this.layer, 0, 0, 1280, 640);
    ctx.translate(this.off.ox, this.off.oy);

    const rw = this.phase === 'rewind' ? this.rewind : null;
    const cplt = this.screen === 'complete' && this.result ? this.result : null;
    let idx = -1, src = null;
    if (rw) {
      const k = clamp01((rw.t - rw.freeze) / rw.dur);
      src = rw.last; idx = Math.max(0, Math.floor((src.len - 1) * (1 - k)));
    } else if (cplt && sim.last.len) {
      src = sim.last;
      const n = src.len + 90;
      idx = Math.min(src.len - 1, Math.floor(cplt.replayT * HZ * 1.5) % n);
    }
    const gateOpen = i => (src ? src.gates[i][idx] : s.open[i]);
    const chOn = ch => (src ? false : !!(s.ch & (1 << ch)));

    // Wires (dashed, L-shaped), lit while the channel is on
    ctx.setLineDash([5, 6]); ctx.lineWidth = 2;
    for (const pl of lv.plates) for (const g of lv.gates) {
      if (!g.chans.includes(pl.ch)) continue;
      const w = wirePath(lv, pl, g);
      ctx.strokeStyle = chOn(pl.ch) ? C.yellow : rgba(C.yellow, 0.2);
      ctx.beginPath(); ctx.moveTo(w[0], w[1]); ctx.lineTo(w[2], w[3]); ctx.lineTo(w[4], w[5]); ctx.stroke();
    }
    ctx.setLineDash([]);

    lv.plates.forEach((pl, i) => drawPlate(ctx, pl, src ? false : !!s.pressed[i], t));
    drawExit(ctx, lv.exit, t);
    lv.gates.forEach((g, i) => drawGate(ctx, g, gateOpen(i), src ? gateOpen(i) > 0.5 : !!s.want[i]));
    if (!src) this.drawForecastArcs();
    this.drawCues();

    if (src) this.drawFromHistory(src, idx, !!rw);
    else {
      if (this.settings.paths) this.drawPaths();
      this.drawEchoes();
      if (this.phase !== 'exit' || this.exitT < 0.4) this.drawLive();
    }
    this.fx.draw(ctx);
    if (rw) {
      // Scanline shimmer during the rewind
      ctx.fillStyle = rgba(C.pale, 0.05);
      const off = (this.t * 600) % 16;
      for (let y = -this.off.oy + off; y < 640 - this.off.oy; y += 16) ctx.fillRect(-this.off.ox, y, 1280, 3);
    }
    ctx.restore();
  }

  drawFromHistory(src, idx, rewinding) {
    const ctx = this.ctx, t = this.t;
    for (let i = 0; i < src.count; i++) {
      const e = src.echoes[i];
      if (e.brokeAt >= 0 && idx >= e.brokeAt) continue;
      const pose = e.pose[idx];
      drawFigure(ctx, e.x[idx] + P.w / 2, e.y[idx] + P.h, { color: C.violet, alpha: ECHO_ALPHA[i], dashed: true, facing: pose & POSE.LEFT ? -1 : 1, run: !rewinding && !!(pose & POSE.RUN), t });
    }
    const L = src.live, pose = L.pose[idx];
    drawFigure(ctx, L.x[idx] + P.w / 2, L.y[idx] + P.h, { color: C.cyan, facing: pose & POSE.LEFT ? -1 : 1, run: !rewinding && !!(pose & POSE.RUN), air: !(pose & POSE.STAND), t });
  }

  drawPaths() {
    const ctx = this.ctx, fc = this.forecast, s = this.sim.s, L = fc.len;
    const waiting = !s.running, clock = s.clock;
    for (let i = 0; i < fc.count; i++) {
      const P2 = fc.paths[i], tapeLen = this.sim.tapes[i].len;
      ctx.fillStyle = rgba(C.violet, waiting ? 0.45 : 0.2);
      for (let c = 0; c < L; c += 5) ctx.fillRect(P2.x[c] + P.w / 2 - 1, P2.y[c] + P.h / 2 - 1, 2.5, 2.5);
      // The next second, brighter, with an arrowhead
      const a = Math.min(clock, L - 1), b = Math.min(clock + HZ, L - 1);
      if (b > a + 2 && !s.echoes[i].broken) {
        ctx.strokeStyle = rgba(C.violet, 0.8); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(P2.x[a] + P.w / 2, P2.y[a] + P.h / 2);
        for (let c = a; c <= b; c += 3) ctx.lineTo(P2.x[c] + P.w / 2, P2.y[c] + P.h / 2);
        ctx.stroke();
        const dx = P2.x[b] - P2.x[Math.max(a, b - 6)], dy = P2.y[b] - P2.y[Math.max(a, b - 6)];
        if (Math.abs(dx) + Math.abs(dy) > 0.5) {
          const ang = Math.atan2(dy, dx), hx = P2.x[b] + P.w / 2, hy = P2.y[b] + P.h / 2;
          ctx.fillStyle = C.violet; ctx.beginPath();
          ctx.moveTo(hx + Math.cos(ang) * 7, hy + Math.sin(ang) * 7);
          ctx.lineTo(hx + Math.cos(ang + 2.5) * 7, hy + Math.sin(ang + 2.5) * 7);
          ctx.lineTo(hx + Math.cos(ang - 2.5) * 7, hy + Math.sin(ang - 2.5) * 7);
          ctx.fill();
        }
      }
      // ▼ where it will press a plate, ‖ where it comes to rest
      ctx.fillStyle = C.yellow;
      for (let c = 0; c < L; c++) {
        if (P2.hold[c] && (c === 0 || !P2.hold[c - 1])) {
          const x = P2.x[c] + P.w / 2, y = P2.y[c] - 14;
          ctx.beginPath(); ctx.moveTo(x - 5, y - 5); ctx.lineTo(x + 5, y - 5); ctx.lineTo(x, y + 2); ctx.fill();
        }
      }
      if (tapeLen < L) {
        const c = Math.max(0, tapeLen - 1), x = P2.x[c] + P.w / 2 + 16, y = P2.y[c] + 4;
        ctx.fillStyle = rgba(C.pale, 0.7); ctx.fillRect(x, y, 2.5, 10); ctx.fillRect(x + 5, y, 2.5, 10);
      }
    }
  }

  drawForecastArcs() {
    const ctx = this.ctx, s = this.sim.s, lv = this.sim.lv, fc = this.forecast;
    if (!fc.count) return;
    lv.gates.forEach((g, i) => {
      if (s.liveCh & g.mask) return;      // the live player changed this channel: forecast dropped
      const ch = fc.nextChange(i, s.clock, HZ);
      if (!ch) return;
      const k = (ch.step - s.clock) / HZ;   // 1 → 0
      const cx = g.x + T / 2, cy = g.y - 26;
      ctx.lineWidth = 3; ctx.strokeStyle = ch.open ? C.yellow : C.pink;
      ctx.beginPath(); ctx.arc(cx, cy, 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = rgba(C.pale, 0.3);
      ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();
    });
  }

  drawCues() {
    const ctx = this.ctx, sim = this.sim, s = sim.s, t = this.t, p = s.p;
    for (const cue of sim.lv.cues) {
      if (cue.kind === 'silhouette' && s.count === 0) drawSilhouette(ctx, cue.x * T + T / 2, (cue.y + 1) * T, t);
      if (cue.kind === 'keys' && cue.keys === 'move' && !this.cue.moved) {
        drawKeycap(ctx, cue.x * T, cue.y * T, '←'); drawKeycap(ctx, cue.x * T + 40, cue.y * T, '→');
        text(ctx, 'or A D', cue.x * T + 20, cue.y * T + 28, 13, rgba(C.pale, 0.6), 'center', 700);
      }
      if (cue.kind === 'keys' && cue.keys === 'jump' && !this.cue.jumped && s.running) drawKeycap(ctx, cue.x * T + 20, cue.y * T, 'SPACE', 0.9, 90);
      if (cue.kind === 'keys' && cue.keys === 'loop' && cue.on === 'plate' && s.running && s.liveOnCh && this.phase === 'play') {
        drawKeycap(ctx, p.x + P.w / 2, p.y - 66 + Math.sin(t * 5) * 2, 'E');
      }
    }
    // Contextual ↓ (fast-forward) after standing still 1.5 s with an echo event still to come
    if (!this.save.tut.ffwd && this.cue.stillT > 1.5 && s.clock < sim.lv.loopSteps - HZ) drawKeycap(ctx, p.x + P.w / 2, p.y - 66, '↓ hold', 0.9, 70);
  }

  drawEchoes() {
    const ctx = this.ctx, sim = this.sim, s = sim.s, t = this.t;
    for (let i = 0; i < s.count; i++) {
      const e = s.echoes[i];
      if (e.broken) continue;
      const h = sim.hist[i], c = s.clock;
      // fading violet trail
      ctx.fillStyle = C.violet;
      for (let k = 1; k <= 6 && c - k * 3 >= 0; k++) {
        const j = c - k * 3;
        if (Math.abs(h.x[j] - e.x) + Math.abs(h.y[j] - e.y) < 2) break;
        ctx.globalAlpha = (0.3 - k * 0.045) * ECHO_ALPHA[i];
        ctx.beginPath(); ctx.arc(h.x[j] + P.w / 2, h.y[j] + P.h / 2, 9 - k, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const cx = e.x + P.w / 2, bottom = e.y + P.h;
      drawFigure(ctx, cx, bottom, { color: C.violet, alpha: ECHO_ALPHA[i], dashed: true, facing: e.pose & POSE.LEFT ? -1 : 1, run: !!(e.pose & POSE.RUN) && !e.resting, air: !e.grounded, t });
      if (e.grounded) { ctx.fillStyle = rgba(C.violet, 0.8); ctx.fillRect(e.x - 4, e.y - 1, P.w + 8, 2); }   // standable top
      const pop = 1 + this.slotPop[i] * 0.6;
      ctx.save(); ctx.translate(cx, e.y - 18 - i * 0); ctx.scale(pop, pop);
      drawBadge(ctx, 0, -2, i + 1, { resting: e.resting });
      ctx.restore();
    }
  }

  drawLive() {
    const ctx = this.ctx, sim = this.sim, s = sim.s, p = s.p, t = this.t;
    const cx = p.x + P.w / 2, bottom = p.y + P.h;
    let shrink = 1;
    if (this.phase === 'exit') shrink = 1 - this.exitT / 0.4;
    const sq = this.fx.squash;
    drawFigure(ctx, cx, bottom, { color: C.cyan, facing: p.facing, run: p.grounded && Math.abs(p.vx) > 20, air: !p.grounded, t, sx: sq.sx * shrink, sy: sq.sy * shrink });
    if (this.phase === 'exit') return;
    const L = sim.lv.loopSteps;
    drawRing(ctx, cx, p.y + P.h / 2, {
      frac: s.running ? 1 - s.clock / L : 1, waiting: !s.running,
      last2: s.running && L - s.clock <= 2 * HZ, loopSec: Math.round(L / HZ), t, ffwd: this.ffwd,
    });
  }

  // ---- Panels ------------------------------------------------------------------------

  drawPanel(w, h, k = 1) {
    const ctx = this.ctx;
    const x = (VIEW_W - w) / 2, y = (VIEW_H - h) / 2 + (1 - k) * 500;
    ctx.fillStyle = 'rgba(7,10,24,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    rrect(ctx, x, y, w, h, 24); ctx.fillStyle = C.navy; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(C.cyan, 0.7); ctx.stroke();
    return { x, y };
  }

  drawPause() {
    const ctx = this.ctx;
    const { x, y } = this.drawPanel(560, 560);
    text(ctx, 'PAUSED', VIEW_W / 2, y + 50, 40, C.pale, 'center', 900);
    const bx = x + 40, bw = 230, bx2 = x + 290;
    this.addButton({ key: 'resume', x: bx, y: y + 100, w: bw, h: 58, label: 'RESUME', primary: true, size: 22, isDefault: true, action: () => this.pause(false) });
    this.addButton({ key: 'p:restart', x: bx2, y: y + 100, w: bw, h: 58, label: 'RESTART ROOM', size: 20, action: () => { this.paused = false; this.restart(); } });
    this.addButton({ key: 'p:paths', x: bx, y: y + 176, w: bw, h: 58, label: this.settings.paths ? 'PATHS: ON' : 'PATHS: OFF', size: 20, action: () => this.togglePaths() });
    this.addButton({ key: 'p:music', x: bx2, y: y + 176, w: bw, h: 58, label: this.settings.music ? 'MUSIC: ON' : 'MUSIC: OFF', size: 20, action: () => this.toggleMusic() });
    this.addButton({ key: 'p:sound', x: bx, y: y + 252, w: bw, h: 58, label: this.settings.sfx ? 'SOUND: ON' : 'SOUND: OFF', size: 20, action: () => this.toggleSfx() });
    this.addButton({ key: 'p:menu', x: bx2, y: y + 252, w: bw, h: 58, label: 'MENU', size: 20, action: () => this.toMenu('levels') });
    // Controls card
    const cy = y + 340;
    rrect(ctx, x + 40, cy, 480, 190, 14); ctx.fillStyle = rgba(C.pale, 0.05); ctx.fill();
    const rows = [['← → / A D', 'Move'], ['SPACE / ↑ / W', 'Jump (hold for full height)'], ['E / ENTER', 'Loop now: end the loop, make an echo'], ['BACKSPACE', 'Delete the latest echo, retry the loop'], ['hold ↓ / S', 'Fast-forward while standing still'], ['R  ·  P / ESC', 'Restart room  ·  Pause']];
    rows.forEach(([k, v], i) => {
      text(ctx, k, x + 200, cy + 24 + i * 29, 14, C.yellow, 'right', 800);
      text(ctx, v, x + 216, cy + 24 + i * 29, 14, C.pale, 'left', 600);
    });
  }

  drawComplete() {
    const ctx = this.ctx, r = this.result, lv = this.sim.lv;
    const e = this.t - r.shownAt;
    const k = easeOutBack(Math.min(1, e / 0.45));
    const { x, y } = this.drawPanel(620, 470, k);
    text(ctx, 'ROOM COMPLETE', VIEW_W / 2, y + 48, 36, C.cyan, 'center', 900);
    const goals = ['Exit', `≤ ${lv.par.echoes} echo${lv.par.echoes === 1 ? '' : 'es'}`, `≤ ${fmtTime(lv.par.time)}`];
    for (let i = 0; i < 3; i++) {
      const at = 0.5 + i * 0.35, lit = r.run[i] && e > at;
      let sc = 1;
      if (lit) {
        const q = Math.min(1, (e - at) / 0.25);
        sc = 1 + (1 - q) * 1.2;
        if (!r.stamped[i]) { r.stamped[i] = true; this.sound.play('star', { i }); this.fx.shake(3, 0.1); }
      }
      const sx = VIEW_W / 2 - 150 + i * 150, sy = y + 140;
      ctx.save(); ctx.translate(sx, sy); ctx.scale(sc, sc);
      drawStar(ctx, 0, 0, 38, lit ? C.yellow : null, lit ? C.navy : rgba(C.pale, 0.3));
      ctx.restore();
      text(ctx, goals[i], sx, sy + 58, 17, lit ? C.pale : rgba(C.pale, 0.45), 'center', 800);
    }
    const q = clamp01((e - 0.3) / 0.8);
    const shownT = r.time * q;
    iconLoop(ctx, VIEW_W / 2 - 200, y + 262, 9, C.violet);
    text(ctx, `ECHOES ${Math.round(r.echoes * q)}  (par ${lv.par.echoes})`, VIEW_W / 2 - 184, y + 263, 20, C.pale, 'left', 800);
    iconClock(ctx, VIEW_W / 2 + 40, y + 262, 9, C.yellow);
    text(ctx, `TIME ${fmtTenths(shownT)}  (par ${fmtTime(lv.par.time)})`, VIEW_W / 2 + 56, y + 263, 20, C.pale, 'left', 800);
    const b = r.best;
    text(ctx, `BEST  ${b.echoes} echo${b.echoes === 1 ? '' : 'es'}  ·  ${fmtTenths(b.time)}`, VIEW_W / 2, y + 305, 16, rgba(C.pale, 0.55), 'center', 700);
    if (e < 0.35) return;
    const by = y + 360;
    const pos = roomPos(this.room.id);
    const next = WORLDS[pos.world - 1].rooms[pos.level];
    this.addButton({ key: 'c:menu', x: x + 40, y: by, w: 170, h: 62, label: 'MENU', size: 22, action: () => this.toMenu('levels') });
    this.addButton({ key: 'c:retry', x: x + 225, y: by, w: 170, h: 62, label: 'RETRY', size: 22, action: () => this.startRoom(this.room) });
    this.addButton({ key: 'c:next', x: x + 410, y: by, w: 170, h: 62, label: next ? 'NEXT ›' : 'ROOMS ›', size: 22, primary: true, isDefault: true,
      action: () => (next ? this.startRoom(next) : this.toMenu('levels')) });
    if (this.focus < 0) this.focus = this.buttons.length - 1;
  }

  // Touch buttons, drawn in CSS px after the view transform (GDD 4).
  drawTouch() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const held = new Set([...this.touches.values()].map(b => b.id));
    for (const b of this.touchLayout()) {
      rrect(ctx, b.x, b.y, b.s, b.s, b.s / 3);
      ctx.fillStyle = held.has(b.id) ? rgba(C.cyan, 0.45) : rgba(C.navy, 0.55); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(C.pale, 0.7); ctx.stroke();
      const cx = b.x + b.s / 2, cy = b.y + b.s / 2;
      if (b.id === 'loop') iconLoop(ctx, cx, cy, 11, C.cyan);
      else if (b.id === 'del') iconDelete(ctx, cx, cy, 12, C.violet);
      else text(ctx, b.label, cx, cy + 1, b.label.length > 2 ? 15 : 26, C.pale, 'center', 900);
    }
    ctx.restore();
  }
}

