// Dinosaur Game: Cool Edition: the loop and the screens (GDD 8).
// The sim runs fixed 60 Hz steps from an accumulator (GDD 3.2); the renderer
// draws every display frame, interpolating between the last two steps.
import { Run } from './sim.js';
import { STEP_MS, MAX_FRAME_DT, VIEW_H, RUN, DEBUG } from './config.js';
import { load, save } from './save.js';
import * as sfx from './audio.js';
import { GA } from './analytics.js';
import { Keys, JUMP_KEYS, DUCK_KEYS } from './input.js';
import { Renderer } from './render.js';
import { layout, hitButton } from './ui.js';

const canvas = document.getElementById('view');
const r = new Renderer(canvas);
const keys = new Keys();
const data = load();
sfx.setEnabled(data.settings.sfx);

// Everything the renderer and UI read.
const g = {
  screen: 'title',      // 'title' | 'playing' | 'paused' | 'complete'
  mode: 'endless',
  run: null,
  alpha: 0,             // how far between the last two steps
  data,
  buttons: [],
  runStart: 0, jumpedAt: null, firstRun: false,
  crashAt: 0, result: 0, newBest: false,
  flashUntil: 0, shakeUntil: 0,
  showBoxes: false, invincible: false,
};
const pointers = new Map();   // pointerId -> 'jump' | 'duck'
let acc = 0, last = performance.now();

// ---- screens -------------------------------------------------------------------------------
function startRun(withJump) {
  g.run = new Run((Math.random() * 2 ** 32) >>> 0, { invincible: g.invincible });
  g.screen = 'playing';
  g.alpha = 0; acc = 0;
  g.runStart = performance.now(); g.jumpedAt = null;
  g.firstRun = !data.firstRunDone;
  g.flashUntil = 0;
  pointers.clear();
  r.resetNight();
  GA.progression('Start', g.mode);
  if (withJump) press('jump', true);
}

function retry() {
  GA.design('ui:restart');
  startRun(false);
}

function menu() {
  g.screen = 'title';
  g.run = null;
}

function pause() {
  if (g.screen !== 'playing') return;
  g.screen = 'paused';
  g.run.release('jump');
  g.run.release('duck');
  pointers.clear();
  keys.clear();
}

function resume() {
  g.screen = 'playing';
  last = performance.now();
}

function toggleSound() {
  data.settings.sfx = !data.settings.sfx;
  sfx.setEnabled(data.settings.sfx);
  save(data);
  if (!data.settings.sfx) GA.design('settings:sfx:off');
}

function onCrash() {
  const run = g.run, m = run.score;
  g.screen = 'complete';
  g.crashAt = performance.now();
  g.shakeUntil = g.crashAt + 150;
  g.result = m;
  g.newBest = m > data.best;
  if (g.newBest) data.best = m;
  data.totalDistance += m;
  data.totalNights += run.nights;
  data.firstRunDone = true;
  save(data);
  pointers.clear();
  sfx.crash();
  GA.progression('Fail', g.mode, m);
  if (run.deathId) GA.design(`run:death:${run.deathId}`, m);
  GA.design('run:distance', m);
}

function tutorial(step, id) {
  if (data.tutorial[step]) return;
  data.tutorial[step] = true;
  save(data);
  GA.design(id);
}

// ---- the run -------------------------------------------------------------------------------
function press(action, repeat) {
  if (g.screen !== 'playing') return;
  const run = g.run;
  if (action === 'duck' && run.jumping && !run.speedDrop) sfx.duck();   // fast-fall
  run.press(action, repeat);
  handleEvents();
}

// Released only when no key and no pointer still holds the action.
function release(action) {
  if (g.screen !== 'playing') return;
  if (keys.holds(action) || [...pointers.values()].includes(action)) return;
  g.run.release(action);
}

function handleEvents() {
  const run = g.run;
  for (const e of run.events) {
    if (e === 'jump') {
      sfx.jump();
      g.jumpedAt ??= performance.now();
      tutorial('jump', 'tutorial:step01');
    } else if (e === 'duck') {
      sfx.duck();
      tutorial('duck', 'tutorial:step02');
    } else if (e === 'milestone') {
      sfx.milestone();
      g.flashUntil = performance.now() + 2000;
      tutorial('done', 'tutorial:done');
    } else if (e === 'night') sfx.night();
    else if (e === 'crash') onCrash();
  }
  run.events.length = 0;
}

// ---- input ---------------------------------------------------------------------------------
keys.onDown = (code, first) => {
  sfx.unlock();
  const s = g.screen;
  if (JUMP_KEYS.includes(code)) {
    if (!first) return;
    if (s === 'title') startRun(true);   // the first press is also the first jump
    else if (s === 'playing') press('jump', true);
  } else if (DUCK_KEYS.includes(code)) {
    if (first && s === 'playing') press('duck', false);
  } else if (code === 'KeyR') {
    if (s !== 'title') retry();
  } else if (code === 'Enter') {
    if (s === 'title') startRun(false);
    else if (s === 'complete') retry();
    else if (s === 'paused') resume();
  } else if (code === 'KeyP' || code === 'Escape') {
    if (s === 'playing') pause();
    else if (s === 'paused') resume();
  } else if (DEBUG && code === 'KeyH') g.showBoxes = !g.showBoxes;
  else if (DEBUG && code === 'KeyI') {
    g.invincible = !g.invincible;
    if (g.run) g.run.invincible = g.invincible;
    console.log(`invincible: ${g.invincible}`);
  }
};

keys.onUp = (code, lastOfGroup) => {
  if (JUMP_KEYS.includes(code)) {
    // Space, Up and W restart on release, after the original's lock (GDD 8).
    if (g.screen === 'complete') {
      if (performance.now() - g.crashAt >= RUN.restartLockMs) retry();
    } else if (lastOfGroup) release('jump');
  } else if (DUCK_KEYS.includes(code) && lastOfGroup) release('duck');
};

const ACTIONS = { play: () => startRun(false), sound: toggleSound, pause, resume, restart: retry, retry, menu };

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  sfx.unlock();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointers (tests) */ }
  const [x, y] = r.toLogical(e.clientX, e.clientY);
  const b = hitButton(layout(g, performance.now(), r), x, y);
  if (b) {
    sfx.click();
    ACTIONS[b.id]();
  } else if (g.screen === 'playing') {
    const action = y >= VIEW_H * 2 / 3 ? 'duck' : 'jump';   // bottom third ducks (GDD 4)
    pointers.set(e.pointerId, action);
    press(action, false);
  }
});

const pointerEnd = e => {
  const action = pointers.get(e.pointerId);
  if (!action) return;
  pointers.delete(e.pointerId);
  release(action);
};
canvas.addEventListener('pointerup', pointerEnd);
canvas.addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ---- loop ----------------------------------------------------------------------------------
function frame(now) {
  const dt = Math.min((now - last) / 1000, MAX_FRAME_DT);
  last = now;
  if (g.screen === 'playing') {
    acc += dt * 1000;
    while (acc >= STEP_MS && g.screen === 'playing') {
      g.run.step();
      handleEvents();
      acc -= STEP_MS;
    }
    g.alpha = g.screen === 'playing' ? acc / STEP_MS : 1;
  }
  g.buttons = layout(g, now, r);
  r.draw(g, now, dt);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
canvas.focus();

// ---- testing hook (STANDARDS, GDD 12) -----------------------------------------------------
window.game = {
  get screen() { return g.screen; },
  get level() { return g.mode; },
  get mode() { return g.mode; },
  get score() { return g.run ? g.run.score : 0; },
  get eggs() { return 0; },
  start() { startRun(false); },
  restart() { retry(); },
};
if (DEBUG) {
  window.game.crash = () => {
    if (g.screen !== 'playing') return;
    g.run.crashed = true;
    g.run.events.push('crash');
    handleEvents();
  };
  window.game.win = window.game.crash;
  window.game.run = () => g.run;
}
