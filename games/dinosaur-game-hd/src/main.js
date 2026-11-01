// Dinosaur Game: Cool Edition: the loop and the screens (GDD 8).
// The sim runs fixed 60 Hz steps from an accumulator (GDD 3.2); the renderer
// draws every display frame, interpolating between the last two steps.
import { Run } from './sim.js';
import { Flight } from './flight.js';
import { stream, STREAM } from './gen.js';
import { STEP_MS, MAX_FRAME_DT, VIEW_W, VIEW_H, LANE, RUN, EGGS, HATCH, RUNNER_LIST, RUNNER_IDS, ANIM, DEBUG, GOLD } from './config.js';
import { load, save } from './save.js';
import * as sfx from './audio.js';
import { GA } from './analytics.js';
import { Keys, JUMP_KEYS, DUCK_KEYS } from './input.js';
import { Renderer, FX_MS } from './render.js';
import { FOOTFALL_X } from './art.js';
import { layout, hitButton, canHatch, HATCH_MS, PAGE, RESULTS_DELAY_MS, FLIGHT_END_MS } from './ui.js';

const canvas = document.getElementById('view');
const r = new Renderer(canvas);
const keys = new Keys();
const data = load();
sfx.setEnabled(data.settings.sfx);

// Everything the renderer and UI read.
const g = {
  screen: 'title',      // 'title' | 'playing' | 'paused' | 'complete' | 'runners' | 'bonus'
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
  peek: false,          // debug: the Runners screen shows every runner as unlocked
  hatch: null,          // the hatch scene: { id, name, at, step }
  goldAt: 0,            // when the golden egg was grabbed (HUD pop, sparkle burst)
  goldFx: null,         // the sparkle burst: { x, y, t }
  earned: false,        // the run on the results grabbed the golden egg and its flight is still banked
  flight: null,         // the bonus flight (GDD 3.8)
  flightFrom: 'title',  // where the flight returns: 'complete' (with its run) or 'title'
  flightEndAt: 0,       // when "+N eggs" started counting up
  flightHint: false,    // the first flight's "hold to fly up"
  pausedFrom: 'playing',
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
  leaveFlight();
  if (g.screen === 'complete' && g.earned) GA.design('bonus:bank', data.flights);   // skipped: it stays banked
  g.earned = false;
  GA.design('ui:restart');
  startRun(false);
}

function menu() {
  leaveFlight();
  g.earned = false;
  g.screen = 'title';
  g.run = null;
}

// ---- the golden egg and the bonus flight (GDD 3.7, 3.8) --------------------------------------
// A banked flight starts at once; the run on the results (if any) gives its seed.
function startFlight() {
  if (data.flights <= 0) return;
  data.flights--;
  g.flightHint = !data.flown;
  data.flown = true;
  save(data);
  g.flightFrom = g.screen === 'complete' ? 'complete' : 'title';
  const seed = g.flightFrom === 'complete' ? g.run.seed : (Math.random() * 2 ** 32) >>> 0;
  g.flight = new Flight(stream(seed, STREAM.flight));
  g.earned = false;
  g.screen = 'bonus';
  g.flightEndAt = 0;
  g.runStart = performance.now();
  g.fx.length = 0;
  g.streak = 0;
  acc = 0; g.alpha = 0;
  pointers.clear();
  GA.design('bonus:start', data.flights);
}

// The flight is over: its eggs are banked, whatever ended it.
function bankFlight() {
  const f = g.flight;
  if (!f || f.banked) return;
  f.banked = true;
  data.eggs += f.eggCount;
  data.totalEggs += f.eggCount;
  save(data);
  GA.design(`bonus:end:${f.result || 'hit'}`, f.eggCount);
}

// Back to the results (with the eggs added) or the title, once "+N eggs" has counted up.
function endFlight() {
  const f = g.flight;
  bankFlight();
  g.flight = null;
  if (g.flightFrom === 'complete') {
    g.runEggs += f.eggCount;
    g.newBest = false;
    g.screen = 'complete';
    g.crashAt = performance.now() - RESULTS_DELAY_MS;   // the panel slides up again; Space waits out the rest of the lock
  } else g.screen = 'title';
}

function leaveFlight() {
  if (!g.flight) return;
  bankFlight();
  if (g.flightFrom === 'complete') g.runEggs += g.flight.eggCount;
  g.flight = null;
}

function flightEvents() {
  const f = g.flight, now = performance.now();
  for (const e of f.events) {
    if (e === 'flap') sfx.flap();
    else if (e === 'egg') {
      g.streak = now - g.lastEggAt < EGGS.streakMs ? Math.min(8, g.streak + 1) : 0;
      g.lastEggAt = g.eggBumpAt = now;
      sfx.egg(g.streak);
    } else if (e === 'warn') sfx.warn();
    else if (e === 'hit') sfx.tumble();
  }
  f.events.length = 0;
  for (const e of f.pickups) g.fx.push({ x: e.x - f.scroll + EGGS.w / 2, y: e.y + EGGS.h / 2, t: now, n: g.fx.length, flight: true });
  f.pickups.length = 0;
  if (f.done && !g.flightEndAt) { g.flightEndAt = now; bankFlight(); }
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

// The same slot on the next or previous page, or its last card.
function turnPage(dir) {
  g.pick = Math.min(RUNNER_LIST.length - 1, (Math.floor(g.pick / PAGE) + dir) * PAGE + g.pick % PAGE);
}

function runnersKey(code) {
  const n = RUNNER_LIST.length, row = PAGE / 2;
  if (code === 'ArrowLeft' || code === 'KeyA') g.pick = (g.pick + n - 1) % n;
  else if (code === 'ArrowRight' || code === 'KeyD') g.pick = (g.pick + 1) % n;
  else if ((code === 'ArrowUp' || code === 'KeyW') && g.pick >= row) g.pick -= row;
  else if ((code === 'ArrowDown' || code === 'KeyS') && g.pick + row < n) g.pick += row;
  else if (DEBUG && code === 'KeyU') g.peek = !g.peek;   // show every runner as if unlocked
  else if (code === 'Space' || code === 'Enter') choose(g.pick);
  else if (code === 'Escape' || code === 'Backspace') back();
  else return;
  sfx.click();
}

function pause() {
  if (g.screen !== 'playing' && !(g.screen === 'bonus' && !g.flightEndAt)) return;
  g.pausedFrom = g.screen;
  g.screen = 'paused';
  if (g.flight) g.flight.release();
  else { g.run.release('jump'); g.run.release('duck'); }
  pointers.clear();
  keys.clear();
}

function resume() {
  g.screen = g.pausedFrom;
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
  g.earned = run.goldenTaken && data.flights < GOLD.maxFlights;   // the flight is banked at once
  if (g.earned) data.flights++;
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
    } else if (e === 'golden') {
      sfx.golden();
      g.goldAt = performance.now();
      g.goldFx = { x: run.golden.x + GOLD.w / 2, y: LANE.top1P + run.golden.y + GOLD.h / 2, t: g.goldAt };
      GA.design('bonus:golden-egg', run.score);
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
  if (s === 'bonus') {
    if (JUMP_KEYS.includes(code) && first && !g.flightEndAt) g.flight.press();
    else if (code === 'KeyP' || code === 'Escape') pause();
    return;
  }
  if (DEBUG && code === 'KeyG') return debugGolden();
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
      if (performance.now() - g.crashAt >= RUN.restartLockMs) g.earned ? startFlight() : retry();   // Fly! takes Space (GDD 8)
    } else if (g.screen === 'bonus') {
      if (lastOfGroup && ![...pointers.values()].includes('flap')) g.flight.release();
    } else if (lastOfGroup) release('jump');
  } else if (DUCK_KEYS.includes(code) && lastOfGroup) release('duck');
};

const ACTIONS = {
  play: () => startRun(false), sound: toggleSound, pause, resume, restart: retry, retry, menu,
  runners: openRunners, back, fly: startFlight, card: b => choose(b.i), hatch: b => choose(b.i), page: b => turnPage(b.dir),
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
  } else if (g.screen === 'bonus') {
    if (g.flightEndAt) return;
    pointers.set(e.pointerId, 'flap');
    g.flight.press();
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
  if (action === 'flap') {
    if (g.flight && !keys.holds('jump') && ![...pointers.values()].includes('flap')) g.flight.release();
  } else release(action);
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
  } else if (g.screen === 'bonus') {
    acc += dt * 1000;
    while (acc >= STEP_MS) {
      g.flight.step();
      flightEvents();
      acc -= STEP_MS;
    }
    g.alpha = acc / STEP_MS;
    if (g.flightEndAt && now - g.flightEndAt >= FLIGHT_END_MS) endFlight();
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

// Debug (G): in a run, the golden egg goes in the next long enough gap;
// elsewhere, a flight is banked.
function debugGolden() {
  if (g.screen === 'playing' && g.run.eggGen && !g.run.golden) g.run.eggGen.goldenAt = 0;
  else if (g.screen === 'title' || g.screen === 'complete') { data.flights = Math.min(GOLD.maxFlights, data.flights + 1); save(data); }
  else return;
  console.log(g.screen === 'playing' ? 'golden egg: next long gap' : `flights banked: ${data.flights}`);
}

// ---- testing hook (STANDARDS, GDD 12) -----------------------------------------------------
window.game = {
  get screen() { return g.screen; },
  get level() { return g.mode; },
  get mode() { return g.mode; },
  get score() { return g.run ? g.run.score : 0; },
  get eggs() { return g.flight ? g.flight.eggCount : g.run ? g.run.eggCount : 0; },
  get flights() { return data.flights; },
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
  window.game.flight = () => g.flight;
  window.game.fly = () => { data.flights = Math.max(1, data.flights); startFlight(); };
}
