// Dinosaur Game: Cool Edition: the loop and the screens (GDD 8).
// The sim runs fixed 60 Hz steps from an accumulator (GDD 3.2); the renderer
// draws every display frame, interpolating between the last two steps.
import { Run } from './sim.js';
import { STEP_MS, MAX_FRAME_DT, VIEW_W, VIEW_H, LANE, RUN, EGGS, HATCH, RUNNER_LIST, RUNNER_IDS, ANIM, DEBUG } from './config.js';
import { load, save } from './save.js';
import * as sfx from './audio.js';
import { GA } from './analytics.js';
import { Keys, JUMP_KEYS, DUCK_KEYS } from './input.js';
import { Renderer, FX_MS } from './render.js';
import { FOOTFALL_X } from './art.js';
import { layout, hitButton, canHatch, HATCH_MS } from './ui.js';

const canvas = document.getElementById('view');
const r = new Renderer(canvas);
const keys = new Keys();
const data = load();
sfx.setEnabled(data.settings.sfx);

// Everything the renderer and UI read.
const g = {
  screen: 'title',      // 'title' | 'playing' | 'paused' | 'complete' | 'runners'
  mode: 'endless',
  run: null,
  alpha: 0,             // how far between the last two steps
  data,
  buttons: [],
  runStart: 0, jumpedAt: null, firstRun: false,
  slideHintAt: null, slidAt: null,   // the slide reminder before the first pterodactyl (GDD 4)
  crashAt: 0, result: 0, newBest: false, runEggs: 0,
  fx: [],               // egg pickup pops: { x, y, t, n }
  eggBumpAt: 0, lastEggAt: 0, streak: 0,
  sliding: false, wasInAir: false, runFrame: -1,
  flashUntil: 0, shakeUntil: 0,
  showBoxes: false, invincible: false,
  pick: 0, screenAt: 0, runnersFrom: 'title',   // the Runners screen: focused card, when it opened, where Back goes
  hatch: null,          // the hatch scene: { id, name, at, step }
};
const pointers = new Map();   // pointerId -> 'jump' | 'duck'
let acc = 0, last = performance.now();

// ---- screens -------------------------------------------------------------------------------
function startRun(withJump) {
  g.run = new Run((Math.random() * 2 ** 32) >>> 0, { invincible: g.invincible });
  g.screen = 'playing';
  g.alpha = 0; acc = 0;
  g.runStart = performance.now(); g.jumpedAt = null;
  g.slideHintAt = g.slidAt = null;
  g.firstRun = !data.firstRunDone;
  g.flashUntil = 0;
  g.fx.length = 0;
  g.streak = 0;
  pointers.clear();
  r.resetNight();
  GA.progression('Start', g.mode);
  GA.design(`eggs:progress:${hatchBucket()}`);
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

// ---- runners (GDD 7.1, 8) ------------------------------------------------------------------
function openRunners() {
  g.runnersFrom = g.screen;
  g.screen = 'runners';
  g.screenAt = performance.now();
  g.pick = RUNNER_IDS.indexOf(data.equipped);
  pointers.clear();
}

function back() {
  if (g.hatch) return;
  g.screen = g.runnersFrom;   // the results keep their run
}

// Equips an unlocked runner, or hatches a locked one there are eggs for.
function choose(i) {
  const R = RUNNER_LIST[i];
  g.pick = i;
  if (data.unlocked.includes(R.id)) equip(R.id);
  else if (canHatch(data, R)) hatch(R);
}

function equip(id) {
  if (data.equipped === id) return;
  data.equipped = id;
  save(data);
  GA.design(`runner:equip:${id}`);
}

// The eggs are spent and the runner unlocked and equipped at once, so closing
// the scene early never loses it.
function hatch(R) {
  data.eggs -= R.price;
  data.unlocked.push(R.id);
  save(data);
  GA.design(`runner:hatch:${R.id}`, R.price);
  equip(R.id);
  g.hatch = { id: R.id, name: R.name, at: performance.now(), step: 0 };
}

// A click per crack, then the jingle as it opens.
function updateHatch(now) {
  const h = g.hatch;
  if (!h) return;
  const due = HATCH_MS.crack.filter(c => now - h.at >= c).length + (now - h.at >= HATCH_MS.open ? 1 : 0);
  for (; h.step < due; h.step++) h.step < 3 ? sfx.crack() : sfx.hatch();
}

function closeHatch() {
  if (performance.now() - g.hatch.at >= HATCH_MS.done) g.hatch = null;
}

function runnersKey(code) {
  const n = RUNNER_LIST.length;
  if (code === 'ArrowLeft' || code === 'KeyA') g.pick = (g.pick + n - 1) % n;
  else if (code === 'ArrowRight' || code === 'KeyD') g.pick = (g.pick + 1) % n;
  else if (code === 'Space' || code === 'Enter') choose(g.pick);
  else if (code === 'Escape' || code === 'Backspace') back();
  else return;
  sfx.click();
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
  g.runEggs = run.eggCount;              // every egg is banked, crash or not
  data.eggs += run.eggCount;
  data.totalEggs += run.eggCount;
  data.firstRunDone = true;
  save(data);
  pointers.clear();
  sfx.crash();
  GA.progression('Fail', g.mode, m);
  if (run.deathId) GA.design(`run:death:${run.deathId}`, m);
  GA.design('run:distance', m);
  GA.design('eggs:earned', run.eggCount);
}

// How far the bank is towards the next hatch, in 20% buckets (GDD 11).
function hatchBucket() {
  const next = HATCH.find(h => !data.unlocked.includes(h.id));
  if (!next) return 'done';
  const b = Math.min(4, Math.floor(data.eggs / next.price * 5)) * 20;
  return `${b}-${b + 20}`;
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
      r.takeoff(run.speed * 60);
      g.jumpedAt ??= performance.now();
      tutorial('jump', 'tutorial:step01');
    } else if (e === 'egg') {
      const now = performance.now();
      g.streak = now - g.lastEggAt < EGGS.streakMs ? Math.min(8, g.streak + 1) : 0;
      g.lastEggAt = g.eggBumpAt = now;
      sfx.egg(g.streak);
    } else if (e === 'duck') {
      sfx.duck();
      g.slidAt ??= performance.now();
      tutorial('duck', 'tutorial:step02');
    } else if (e === 'milestone') {
      sfx.milestone();
      g.flashUntil = performance.now() + 2000;
      tutorial('done', 'tutorial:done');
    } else if (e === 'land') {
      if (!run.ducking) r.land(run.speed * 60);   // landing into a slide gets the slide's burst
    } else if (e === 'night') sfx.night();
    else if (e === 'crash') onCrash();
  }
  run.events.length = 0;
  for (const e of run.pickups) {
    g.fx.push({ x: e.x + EGGS.w / 2, y: LANE.top1P + e.y + EGGS.h / 2, t: performance.now(), n: g.fx.length });
  }
  run.pickups.length = 0;
}

// ---- input ---------------------------------------------------------------------------------
keys.onDown = (code, first) => {
  sfx.unlock();
  const s = g.screen;
  if (g.hatch) return closeHatch();
  if (s === 'runners') return runnersKey(code);
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

const ACTIONS = {
  play: () => startRun(false), sound: toggleSound, pause, resume, restart: retry, retry, menu,
  runners: openRunners, back, card: b => choose(b.i), hatch: b => choose(b.i),
};

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  sfx.unlock();
  try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointers (tests) */ }
  if (g.hatch) return closeHatch();
  const [x, y] = r.toLogical(e.clientX, e.clientY);
  const b = hitButton(layout(g, performance.now(), r), x, y);
  if (b) {
    sfx.click();
    ACTIONS[b.id](b);
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

// Running dust: a puff from the planted foot as each foot comes down (every
// run frame, GDD 9).
function updateRunDust() {
  const run = g.run;
  if (g.screen !== 'playing' || !run || run.jumping || run.ducking || run.crashed) { g.runFrame = -1; return; }
  const f = Math.floor(run.timeMs / ANIM.run) % 4;
  if (f !== g.runFrame) r.dust.step(FOOTFALL_X[f], run.speed * 60);
  g.runFrame = f;
}

// The slide (the duck, drawn as a belly slide): dust and a scrape while it
// lasts, and a bigger burst when a jump or fast-fall lands into it.
function updateSlide(dt) {
  const run = g.run, sliding = g.screen === 'playing' && !!run && run.ducking && !run.crashed;
  const scroll = run ? run.speed * 60 : 0;
  if (sliding && !g.sliding) r.dust.burst(g.wasInAir ? 24 : 14, scroll, g.wasInAir ? 1.5 : 1);
  if (sliding) r.dust.trail(dt, scroll);
  sfx.slide(sliding);
  g.sliding = sliding;
  g.wasInAir = !!run?.jumping;
}

// Until the player has slid once, the slide hint shows again for 2 s as the
// run's first pterodactyl comes: from one view-width before it comes into
// view, about 2 s before it reaches the runner (GDD 4).
function updateSlideHint(now) {
  const run = g.run;
  if (g.screen !== 'playing' || g.slideHintAt !== null || data.tutorial.duck) return;
  if (run.obstacles.some(o => o.id === 'ptero' && o.x < VIEW_W * 2)) g.slideHintAt = now;
}

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
  updateSlide(dt);
  updateRunDust();
  updateSlideHint(now);
  updateHatch(now);
  while (g.fx.length && now - g.fx[0].t > FX_MS) g.fx.shift();
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
  get eggs() { return g.run ? g.run.eggCount : 0; },
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
