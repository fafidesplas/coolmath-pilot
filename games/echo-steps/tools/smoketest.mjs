// Smoke test of the real game (src/game.js) in Node with a stubbed DOM: the real
// frame loop, key presses and pointer clicks on canvas buttons. Covers hints and
// skip (GDD 7) and replays every room's reference solution through the UI.
//   node tools/smoketest.mjs
import { readFileSync } from 'node:fs';
import { WORLDS } from '../levels/index.js';
import { HZ } from '../src/config.js';

let failed = 0, passed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };

// ---- DOM stubs ----------------------------------------------------------------------------
const noop = () => {};
const ctxProxy = () => new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'measureText') return s => ({ width: String(s).length * 10 });
    if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => ({ addColorStop: noop });
    return noop;
  },
  set(t, k, v) { t[k] = v; return true; },
});
const makeCanvas = () => {
  const listeners = {};
  return {
    width: 0, height: 0, style: {}, listeners,
    getContext: () => ctxProxy(),
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    setPointerCapture: noop, focus: noop,
  };
};
const store = new Map();
let clock = 0, rafCb = null, winListeners = {};
globalThis.window = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener: (type, fn) => { (winListeners[type] ||= []).push(fn); },
};
globalThis.document = { hidden: false, createElement: () => makeCanvas(), addEventListener: noop };
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.location = { search: '' };
Object.defineProperty(globalThis, 'performance', { value: { now: () => clock }, configurable: true });
globalThis.requestAnimationFrame = cb => { rafCb = cb; return 1; };
let fetchFails = false;
globalThis.fetch = async url => {
  if (fetchFails) throw new Error('offline');
  const text = readFileSync(new URL(`../${url}`, import.meta.url), 'utf8');   // sync: resolves within one flush
  return { json: async () => JSON.parse(text) };
};
const origLog = console.log;
console.log = (...a) => { if (typeof a[0] === 'string' && a[0].startsWith('%c[GA]')) return; origLog(...a); };   // quiet GA stub
console.warn = noop;

const { Game } = await import('../src/game.js');

// ---- Driver -------------------------------------------------------------------------------
let game, api, canvas;
const flush = () => new Promise(r => setImmediate(r));
async function boot(search) {
  winListeners = {};
  location.search = search;
  canvas = makeCanvas();
  clock = 0;
  game = new Game(canvas);
  api = game.api;
  await flush(); await flush();
  frames(2);
}
function frames(n) { for (let i = 0; i < n; i++) { clock += 1000 / 60; const cb = rafCb; cb(clock); } }
const key = (code, type = 'keydown') => (winListeners[type] || []).forEach(fn => fn({ code, repeat: false, preventDefault: noop }));
const tap = code => { key(code); frames(1); key(code, 'keyup'); frames(1); };
function click(k) {
  const b = api.buttons.find(q => q.key === k);
  if (!b) return false;
  const v = api.view, x = v.ox + (b.x + b.w / 2) * v.scale, y = v.oy + (b.y + b.h / 2) * v.scale;
  const ev = { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse' };
  canvas.listeners.pointerdown.forEach(fn => fn(ev));
  canvas.listeners.pointerup.forEach(fn => fn(ev));
  frames(1);
  return true;
}
const btn = k => api.buttons.find(q => q.key === k);
const gaCount = (id, value) => api.analytics.filter(e => e.id === id && (value === undefined || e.value === value)).length;
const saved = () => JSON.parse(store.get('cm_echo-steps_save') || '{}');

// ---- 1. Demo param: hints and skip at once ----------------------------------------------------
store.clear();
await boot('?room=w1l01&hints=now');
ok(api.screen === 'playing' && api.level === 'w1l01', '?room=w1l01&hints=now starts room 1');
ok(api.hints && api.hints.available && api.hints.total === 2 && api.hints.canSkip, 'demo: hints (2) and skip available at once');
ok(!!btn('hud:hint'), 'demo: the bulb button is in the HUD');
ok(click('hud:hint') && api.hints.shown === 1 && gaCount('ui:hint', 1) === 1, 'clicking the bulb shows hint 1 and sends ui:hint = 1');
frames(120);
tap('KeyH');
ok(api.hints.shown === 2 && gaCount('ui:hint', 2) === 1, 'H shows hint 2 (the live route) and sends ui:hint = 2');
tap('KeyH');
ok(api.hints.shown === 2 && gaCount('ui:hint') === 2 && btn('hud:hint').disabled, 'no hint past the last one; the bulb greys out');
tap('ArrowRight'); frames(60);
ok(api.hints.shown === 2 && api.screen === 'playing', 'hints stay drawn while playing (frames render without errors)');
tap('KeyP');
ok(api.paused && btn('p:hint') && btn('p:hint').disabled && btn('p:skip') && !btn('p:skip').disabled, 'pause menu: Hint (all shown, greyed) and Skip room offered');
const failsBefore = gaCount('Fail:world01:level01');
ok(click('p:skip'), 'Skip room clicked');
ok(gaCount('ui:skip') === 1 && gaCount('Fail:world01:level01') === failsBefore + 1, 'skip sends ui:skip and Fail for the room');
ok(JSON.stringify(saved().rooms.w1l01) === JSON.stringify({ stars: [0, 0, 0], skipped: true }), 'cm_echo-steps_save: w1l01 = { stars: [0,0,0], skipped: true }');
ok(api.screen === 'playing' && api.level === 'w1l02' && !api.paused && api.hints.shown === 0, 'skip starts the next room with fresh hints');
tap('KeyP'); click('p:menu'); frames(2);
ok(api.screen === 'levels' && !!btn('room:w1l02') && !btn('room:w1l03'), 'room select: room 2 unlocked by the skip, room 3 still locked');
key('Escape'); frames(2);
ok(api.screen === 'title', 'back to the title');
click('play'); frames(2);
ok(api.level === 'w1l02', 'PLAY goes to the room after the skipped one');
tap('Escape'); click('p:menu'); frames(2);
click('room:w1l01'); frames(2);
ok(api.level === 'w1l01', 'a skipped room can still be played');
api.win(); frames(120);
const r1 = saved().rooms.w1l01;
ok(r1.stars[0] === 1 && r1.skipped === false && typeof r1.echoes === 'number', 'finishing a skipped room clears the mark and saves stars');

// ---- 2. Unlock by loops, state across R, skip after every hint -----------------------------------
store.clear();
await boot('?room=w1l03');
ok(api.hints && !api.hints.available && !btn('hud:hint'), 'no demo: no bulb at the start');
tap('KeyP');
ok(btn('p:hint') && btn('p:hint').disabled && btn('p:skip') && btn('p:skip').disabled, 'pause menu: Hint and Skip greyed until they unlock');
tap('KeyP');
for (let i = 0; i < 7; i++) { tap('KeyE'); frames(3); }
ok(api.hints.loops === 7 && !api.hints.available, '7 loops: still no hint');
tap('KeyE'); frames(3);
ok(api.hints.loops === 8 && api.hints.available && !!btn('hud:hint'), '8 loops: the bulb appears');
tap('KeyR'); frames(40);
ok(api.hints.loops === 8 && api.hints.available, 'the hint unlock survives R (same room)');
tap('ArrowRight'); key('ArrowRight'); frames(30); key('ArrowRight', 'keyup'); frames(5);
ok(api.hints.steps > 0 && api.hints.steps === api.sim.s.roomSteps, `hint clock counts room time (${api.hints.steps} steps)`);
ok(!api.hints.canSkip, 'skip not yet offered (hints left, under 3 min)');
tap('KeyH'); tap('KeyH');
ok(!api.hints.canSkip && api.hints.shown === 2, '2 of 3 hints: still no skip');
tap('KeyH');
ok(api.hints.shown === 3 && api.hints.canSkip, 'every hint shown: Skip room unlocks');
tap('KeyP');
ok(btn('p:skip') && !btn('p:skip').disabled, 'pause menu offers Skip room');
tap('KeyP');

// ---- 3. Hint clock by time (real frames, no loops) ----------------------------------------------
store.clear();
await boot('?room=w1l03');
// Hold left: the clock runs and the 10 s loops time out, so 60 s is only 6 loops.
key('ArrowLeft');
for (let i = 0; i < 59 * 60; i++) frames(1);   // rewinds don't count as room time
ok(!api.hints.available && api.hints.steps < 60 * HZ, `59 s of frames: no bulb yet (${(api.hints.steps / HZ).toFixed(1)} s, ${api.hints.loops} loops)`);
for (let i = 0; i < 10 * 60 && !api.hints.available; i++) frames(1);
key('ArrowLeft', 'keyup');
const st = api.hints;
ok(st.available && st.steps >= 60 * HZ && st.loops < 8, `bulb appears after 60 s of room time (${(st.steps / HZ).toFixed(2)} s, ${st.loops} loops)`);

// ---- 4. Missing solution file: no crash, no bulb -------------------------------------------------
store.clear();
fetchFails = true;
await boot('?room=w1l04&hints=now');
ok(api.screen === 'playing' && !api.hints.available && !btn('hud:hint'), 'no solution file: no bulb, no crash');
tap('KeyH'); tap('KeyP'); frames(2);
ok(api.paused && btn('p:hint').disabled, 'pause menu still draws');
fetchFails = false;

// ---- 5. Every room still plays through the UI (?replay) ------------------------------------------
for (const room of WORLDS[0].rooms) {
  store.clear();
  await boot(`?replay&room=${room.id}`);
  for (let i = 0; i < 60 * 60 && api.screen !== 'complete'; i++) frames(1);
  ok(api.screen === 'complete' && api.hints === null && !btn('hud:hint'), `${room.id}: ?replay reaches the exit through the UI (no hints in replays)`);
}

console.log(failed ? `\n${failed} of ${passed + failed} smoke checks FAILED` : `\nall ${passed} smoke checks passed`);
process.exit(failed ? 1 : 0);
