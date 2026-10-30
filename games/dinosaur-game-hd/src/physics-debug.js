// Physics check page (slice step 1): runs sim.js and draws boxes only.
// Space/Up/W jump, Down/S duck, R or Enter restart, H hitboxes,
// P pause, . one frame while paused, , slow motion (1/4), I invincible.
import { Run } from './sim.js';
import { HZ, STEP_MS, MAX_FRAME_DT, VIEW_W, VIEW_H, LANE, RUN, RUNNER, RUNNER_BOXES } from './config.js';

const view = document.getElementById('view');
const vctx = view.getContext('2d');
const scene = document.createElement('canvas');
scene.width = VIEW_W; scene.height = VIEW_H;
const ctx = scene.getContext('2d');

const seedParam = new URLSearchParams(location.search).get('seed');
const newSeed = () => seedParam !== null ? Number(seedParam) >>> 0 : (Math.random() * 2 ** 32) >>> 0;

const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'], DUCK_KEYS = ['ArrowDown', 'KeyS'];
const held = new Set();         // jump and duck keys held
let run = null;                 // null until the first press
let best = 0, crashAt = 0, acc = 0, last = performance.now();
let paused = false, slow = false, showBoxes = true, invincible = false;
let jumps = [], cur = null;     // jump log: hold time, apex, airtime
let flashUntil = 0;

function start(withJump) {
  run = new Run(newSeed(), { invincible });
  jumps = []; cur = null; acc = 0;
  if (withJump) press('jump', true);
}

function press(action, repeat) {
  if (!run || run.crashed) return;
  run.press(action, repeat);
  logEvents();
}

function release(action) {
  if (!run) return;
  if (action === 'jump' && cur && cur.hold === null) cur.hold = run.frame - cur.start;
  run.release(action);
}

function logEvents() {
  for (const e of run.events) {
    if (e === 'jump') cur = { start: run.frame, hold: null, apex: 0 };
    if (e === 'land' && cur) {
      cur.air = run.frame - cur.start;
      jumps.unshift(cur); jumps.length = Math.min(jumps.length, 8);
      cur = null;
    }
    if (e === 'milestone') flashUntil = performance.now() + 2000;
    if (e === 'crash') { crashAt = performance.now(); best = Math.max(best, run.score); }
  }
  run.events.length = 0;
}

function step() {
  run.step();
  if (cur) cur.apex = Math.max(cur.apex, run.height);
  logEvents();
}

// ---- input ---------------------------------------------------------------------------
addEventListener('keydown', e => {
  const jump = JUMP_KEYS.includes(e.code), duck = DUCK_KEYS.includes(e.code);
  if (jump || duck) e.preventDefault();
  if (e.repeat) return;   // the sim repeats a held jump itself
  if (jump) {
    const first = !JUMP_KEYS.some(k => held.has(k));
    held.add(e.code);
    if (!run) start(true);
    else if (first) press('jump', true);
  } else if (duck) {
    held.add(e.code);
    press('duck');
  } else if (e.code === 'KeyR' || e.code === 'Enter') start(false);
  else if (e.code === 'KeyH') showBoxes = !showBoxes;
  else if (e.code === 'KeyP' || e.code === 'Escape') paused = !paused;
  else if (e.code === 'Period' && paused && run) step();
  else if (e.code === 'Comma') slow = !slow;
  else if (e.code === 'KeyI') { invincible = !invincible; if (run) run.invincible = invincible; }
});

addEventListener('keyup', e => {
  const wasHeld = held.delete(e.code);
  if (JUMP_KEYS.includes(e.code)) {
    // Restart on release, after the lock (GDD 8).
    if (run?.crashed && performance.now() - crashAt >= RUN.restartLockMs) start(false);
    else if (wasHeld && !JUMP_KEYS.some(k => held.has(k))) release('jump');
  } else if (DUCK_KEYS.includes(e.code) && !DUCK_KEYS.some(k => held.has(k))) release('duck');
});

// Pointer: top 2/3 jumps, bottom 1/3 ducks (GDD 4).
const pointerAction = new Map();
view.addEventListener('pointerdown', e => {
  view.setPointerCapture(e.pointerId);
  if (run?.crashed) { start(false); return; }
  const action = e.clientY > view.clientHeight * 2 / 3 ? 'duck' : 'jump';
  pointerAction.set(e.pointerId, action);
  if (!run) start(action === 'jump');
  else press(action, false);
});
const pointerEnd = e => {
  const action = pointerAction.get(e.pointerId);
  pointerAction.delete(e.pointerId);
  if (action && ![...pointerAction.values()].includes(action)) release(action);
};
view.addEventListener('pointerup', pointerEnd);
view.addEventListener('pointercancel', pointerEnd);

document.addEventListener('visibilitychange', () => { if (document.hidden) paused = true; });

// ---- drawing -------------------------------------------------------------------------
const COL = {
  sky: '#F2C879', night: '#1B2340', sand: '#e0b062', ink: '#1B2340', cream: '#FFF6E0',
  runner: '#5A6B7D', box: '#e0303a', outer: '#2a7de1', cactus: '#3FA34D', ptero: '#8a5a9e',
};

function drawBoxes(x, y, boxes, color) {
  ctx.strokeStyle = color;
  for (const b of boxes) ctx.strokeRect(x + b[0] + 0.5, y + b[1] + 0.5, b[2] - 1, b[3] - 1);
}

function drawScene() {
  const top = LANE.top1P;
  const night = run?.night;
  ctx.fillStyle = night ? COL.night : COL.sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = COL.sand;
  ctx.fillRect(0, top + LANE.ground, VIEW_W, VIEW_H);
  // ground ticks scroll in whole pixels, like the original's horizon line
  ctx.fillStyle = COL.ink;
  ctx.fillRect(0, top + LANE.ground - 1, VIEW_W, 1);
  const off = run ? run.scrollPx % 40 : 0;
  for (let x = -off; x < VIEW_W; x += 40) ctx.fillRect(x, top + LANE.ground + 4, 6, 1);
  // the original's 600 px view, for comparison
  ctx.fillStyle = 'rgba(27,35,64,0.25)';
  ctx.fillRect(600, top, 1, LANE.ground);

  if (run) {
    for (const o of run.obstacles) {
      ctx.fillStyle = o.id === 'ptero' ? COL.ptero : COL.cactus;
      ctx.fillRect(o.x, top + o.y, o.w, o.h);
      if (showBoxes) {
        drawBoxes(o.x + 1, top + o.y + 1, o.boxes, COL.box);
        ctx.strokeStyle = COL.outer;
        ctx.strokeRect(o.x + 1.5, top + o.y + 1.5, o.w - 3, o.h - 3);
      }
    }
  }

  const y = run ? run.y : LANE.ground - RUNNER.height;
  const duck = run?.ducking;
  ctx.fillStyle = run?.crashed ? COL.box : COL.runner;
  if (duck) ctx.fillRect(RUNNER.x, top + LANE.ground - RUNNER.heightDuck, RUNNER.widthDuck, RUNNER.heightDuck);
  else ctx.fillRect(RUNNER.x, top + y, RUNNER.width, RUNNER.height);
  if (showBoxes) {
    drawBoxes(RUNNER.x + 1, top + y + 1, duck ? RUNNER_BOXES.duck : RUNNER_BOXES.run, COL.cream);
    ctx.strokeStyle = COL.outer;
    ctx.strokeRect(RUNNER.x + 1.5, top + y + 1.5, RUNNER.width - 3, RUNNER.height - 3);
  }
}

const pad = n => String(n).padStart(5, '0');
const ms = f => Math.round(f * 1000 / HZ);

function drawHud(scale, ox, oy) {
  const fs = Math.max(12, Math.round(5 * scale));
  vctx.font = `${fs}px ui-monospace, Menlo, Consolas, monospace`;
  vctx.textBaseline = 'top';
  vctx.fillStyle = run?.night ? COL.cream : COL.ink;
  const line = (t, x, y, align = 'left') => { vctx.textAlign = align; vctx.fillText(t, ox + x * scale, oy + y * scale); };
  const L = (i) => 8 + i * (fs / scale + 2);

  const flashing = performance.now() < flashUntil && Math.floor((flashUntil - performance.now()) / 250) % 2 === 1;
  line(`HI ${pad(best)}  ${flashing ? '     ' : pad(run ? run.score : 0)}`, VIEW_W - 8, L(0), 'right');
  if (!run) { line('Space, Up or W (or tap the top 2/3) to start', 8, L(0)); }
  else {
    const state = run.crashed ? `CRASH: ${run.deathId}` : run.jumping ? (run.speedDrop ? 'fast-fall' : 'jump') : run.ducking ? 'duck' : 'run';
    line(`seed ${run.seed}   frame ${run.frame}   ${(run.timeMs / 1000).toFixed(2)} s`, 8, L(0));
    line(`speed ${run.speed.toFixed(3)} px/f  (moves ${Math.floor(run.speed)} px/f)`, 8, L(1));
    line(`height ${run.height} px   vy ${(-run.vy).toFixed(2)}   ${state}`, 8, L(2));
    line(`${paused ? 'PAUSED (. = 1 frame)  ' : ''}${slow ? 'SLOW x1/4  ' : ''}${invincible ? 'INVINCIBLE  ' : ''}${run.night ? 'NIGHT' : ''}`, 8, L(3));
    line('jumps (newest first): held, apex, airtime', 8, L(5));
    jumps.forEach((j, i) => {
      const hold = j.hold === null ? 'held' : `${ms(j.hold)} ms`;
      line(`${hold.padStart(7)}  ${String(j.apex).padStart(3)} px  ${ms(j.air)} ms (${j.air} f)`, 8, L(6 + i));
    });
  }
  line('Space/Up/W jump  Down/S duck  R restart  H boxes  P pause  , slow  I invincible', 8, VIEW_H - 14);
}

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  view.width = Math.round(innerWidth * dpr);
  view.height = Math.round(innerHeight * dpr);
}
addEventListener('resize', resize);
resize();

function frame(now) {
  const dt = Math.min((now - last) / 1000, MAX_FRAME_DT);
  last = now;
  if (run && !paused && !run.crashed) {
    acc += dt * 1000 * (slow ? 0.25 : 1);
    while (acc >= STEP_MS) { step(); acc -= STEP_MS; }
  }
  drawScene();
  const fit = Math.min(view.width / VIEW_W, view.height / VIEW_H);
  const scale = fit >= 1 ? Math.floor(fit) : fit;
  const w = VIEW_W * scale, h = VIEW_H * scale;
  const ox = Math.floor((view.width - w) / 2), oy = Math.floor((view.height - h) / 2);
  vctx.fillStyle = COL.ink;
  vctx.fillRect(0, 0, view.width, view.height);
  vctx.imageSmoothingEnabled = false;
  vctx.drawImage(scene, ox, oy, w, h);
  drawHud(scale, ox, oy);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
view.focus();
window.run = () => run;   // console access while checking
