// Boots the real game (src/game.js) in node with a stub canvas and DOM, then drives
// it through the shell and every level via window.game, drawing every frame. Catches
// runtime errors in the render and state code without a browser.
//   node tools/smoketest.mjs
let passed = 0, failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };

// ---- Stubs --------------------------------------------------------------------------
const ctxStub = () => new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'measureText') return s => ({ width: String(s).length * 20 });
    if (k === 'getImageData') return () => ({ data: [] });
    return () => {};
  },
  set(t, k, v) { t[k] = v; return true; },
});
const listeners = {};
const mkCanvas = () => ({
  width: 0, height: 0, style: {},
  getContext: () => ctxStub(),
  addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
  setPointerCapture() {},
});
const canvas = mkCanvas();
let rafCb = null, now = 0;
globalThis.window = globalThis;
globalThis.innerWidth = 1280; globalThis.innerHeight = 720; globalThis.devicePixelRatio = 1;
globalThis.addEventListener = (type, fn) => { (listeners['win:' + type] ||= []).push(fn); };
globalThis.document = { createElement: () => mkCanvas(), getElementById: () => canvas, addEventListener() {}, hidden: false };
globalThis.requestAnimationFrame = cb => { rafCb = cb; };
globalThis.performance = { now: () => now };
globalThis.location = { search: '' };
globalThis.history = { replaceState() {} };
const store = {};
globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } };
const errors = [];
const origLog = console.log;
console.log = (...a) => { if (!String(a[0]).startsWith('%c[GA]')) origLog(...a); else gaLog.push(String(a[0]).slice(7)); };
const gaLog = [];

const { boot } = await import('../src/game.js');
boot(canvas);
const G = globalThis.game;

function frames(n, ms = 16) {
  for (let i = 0; i < n; i++) {
    now += ms;
    const cb = rafCb; rafCb = null;
    try { cb(now); } catch (e) { errors.push(e); return; }
  }
}
const key = (k, extra = {}) => { for (const fn of listeners['win:keydown'] || []) fn({ key: k, preventDefault() {}, repeat: false, shiftKey: false, ...extra }); };
const tap = (x, y) => {
  for (const fn of listeners.pointerdown || []) fn({ clientX: x, clientY: y, pointerId: 1 });
  for (const fn of listeners.pointerup || []) fn({ clientX: x, clientY: y, pointerId: 1 });
};

// ---- Shell --------------------------------------------------------------------------
frames(30);
ok(G.screen === 'title' && !errors.length, 'boots to the title screen');
tap(640, 494); frames(5);  // PLAY button
ok(G.screen === 'playing' && G.level === 'world01:level01', `Play starts the first level (${G.level})`);

// Plan → Go with the start setting crashes, rewinds, back to planning.
key(' '); frames(5);
ok(G.phase === 'run', 'Space starts the run');
frames(400);
ok(G.phase === 'plan' && !errors.length, 'a crash plays, rewinds and returns to planning');
ok(gaLog.some(l => l.startsWith('progression Fail:world01:level01')) && gaLog.some(l => l.includes('level:crash:derail')), 'Fail and crash cause events sent');

// Keyboard: Tab selects the switch, Enter flips it.
key('Tab'); key('Enter'); frames(5);
ok(G.flips === 1, 'Tab + Enter flips the switch');
key('r'); frames(2);
ok(G.flips === 0, 'R resets the switches in planning');
// Tap the switch on the board (cell 2,1 in a 5×3 board at 112 px).
tap(640 - 2.5 * 112 + 2.5 * 112, 92 + (536 - 336) / 2 + 1.5 * 112); frames(2);
ok(G.flips === 1, 'tapping the switch flips it');
key(' '); frames(600);
ok(G.screen === 'complete' && G.score === 3, `solving on run 2 gives ${G.score} stars (home + ticket, a level without a ticket, + par)`);
frames(120);
key('Enter'); frames(5);
ok(G.level === 'world01:level02' && G.screen === 'playing', 'Next goes to level 1-2');

// ---- Every level via the reference solution ------------------------------------------
for (const id of G.levels) {
  G.start(id); frames(3);
  G.win(); frames(800);
  ok(G.screen === 'complete' && G.score === 3 && !errors.length, `${id}: reference solution completes with 3 stars (home, ticket, par)`);
  frames(150);
}

// Next after 1-5 goes to 1-6; Next after the last level goes to the level select.
G.start('1-5'); frames(2); G.win(); frames(800); frames(150);
key('Enter'); frames(5);
ok(G.level === 'world01:level06' && G.screen === 'playing', `Next after 1-5 opens 1-6 (${G.level})`);
G.start('1-8'); frames(2); G.win(); frames(800); frames(150);
key('Enter'); frames(5);
ok(G.screen === 'levels', 'Next after 1-8 (the last level) opens the level select');
key('Escape'); frames(2);

// Pause, menu, level select, sound toggle, fast-forward, ?level param path
G.start('1-5'); frames(2);
key('p'); frames(2); key('p'); frames(2);
key(' '); frames(3); key('f'); frames(200);
ok(!errors.length, 'pause/resume and fast-forward run without errors');
key('Escape'); frames(2);
tap(520 + 120, 456 + 30); frames(2);  // Levels button on the pause panel
ok(G.screen === 'levels', 'pause → Levels opens the level select');
frames(30);
key('Escape'); frames(5);
ok(G.screen === 'title', 'Escape goes back to the title');
key('l'); frames(2);
tap(925, 460); frames(5);   // level 8 button: second row of the two-row select
ok(G.level === 'world01:level08' && G.screen === 'playing', `level select opens 1-8 from its button (${G.level})`);

const saved = JSON.parse(store['cm_tiny-trains_save']);
ok(saved.v === 1 && Object.keys(saved.levels).length === G.levels.length, `save has all ${G.levels.length} levels solved`);
store['cm_tiny-trains_save'] = '{broken';
const { loadSave } = await import('../src/save.js');
ok(loadSave().v === 1, 'a corrupted save resets to defaults');

if (errors.length) for (const e of errors) origLog(e);
origLog(`\n${passed} passed, ${failed} failed`);
process.exit(failed || errors.length ? 1 : 0);
