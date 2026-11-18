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
    if (k === 'drawImage') return im => { if (!im || typeof im !== 'object') throw new TypeError('drawImage: not an image'); };
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
ok(G.level === 'world01:level09' && G.screen === 'playing', `Next after 1-8 opens 1-9 (${G.level})`);
G.start('1-9'); frames(2); G.win(); frames(800); frames(150);
key('Enter'); frames(5);
ok(G.level === 'world01:level10' && G.screen === 'playing', `Next after 1-9 opens 1-10 (${G.level})`);
G.start('1-10'); frames(2); G.win(); frames(800); frames(150);
key('Enter'); frames(5);
ok(G.screen === 'levels', 'Next after 1-10 (the last level) opens the level select');
key('Escape'); frames(2);

// 1-9 with the start setting: both trains circle the ring. Once the board repeats
// (tick 12), the rest of the run to the tick limit (24) plays 5× fast, then it ends
// lost and the game rewinds to planning.
G.start('1-9'); frames(3);
const gaBefore = gaLog.length;
key(' '); frames(5);
const { findLevel } = await import('../levels/index.js');
const { loopTick } = await import('../src/solver.js');
const { run: runSim, defaultSetup: defSetup } = await import('../src/sim.js');
const L9 = findLevel('1-9'), loop9 = loopTick(runSim(L9, defSetup(L9)));
frames(Math.floor(loop9 * 450 / 16) - 10);   // just before the loop is detected, at 1×
ok(G.phase === 'run' && !G.looping && !errors.length, `1-9: the first ${loop9} ticks of the loop play at normal speed`);
frames(20);
ok(G.phase === 'run' && G.looping, '1-9: then the run skips ahead ("Going round in circles")');
let lostMs = (loop9 * 450) + 10 * 16;
while (G.phase === 'run' && lostMs < 20000) { frames(1); lostMs += 16; }
ok(G.phase === 'crash' && lostMs < 7000, `1-9: the lost run now ends after ${(lostMs / 1000).toFixed(1)} s (was ${(L9.tickLimit * 0.45).toFixed(1)} s)`);
frames(400);
ok(G.phase === 'plan' && gaLog.slice(gaBefore).some(l => l.includes(`level:crash:lost`) && l.includes(String(L9.tickLimit))) && !errors.length,
  '1-9: the start setting still ends lost at the tick limit (level:crash:lost, tick 24) and rewinds to planning');

// ---- Hints (GDD 3.13) -----------------------------------------------------------------
{
  const { ticketSolutions } = await import('../src/solver.js');
  const { flipCount } = await import('../src/sim.js');
  const L = findLevel('1-7');
  G.start('1-7'); frames(3);
  ok(!G.hintVisible, '1-7: no hint button on a fresh level');
  key(' '); frames(500);
  ok(G.phase === 'plan' && G.fails === 1 && !G.hintVisible, '1-7: still no hint button after 1 failed run');
  key('h'); frames(2);
  ok(Object.keys(G.locked).length === 0 && !G.hintUsed, '1-7: H does nothing before the button shows');
  key(' '); frames(500);
  ok(G.phase === 'plan' && G.fails === 2 && G.hintVisible, '1-7: the hint button shows after 2 failed runs');
  frames(30);   // let it slide in
  const before = G.switches, gaAt = gaLog.length;
  tap(884 + 80, 642 + 33); frames(5);   // the Hint button beside GO
  const locked = G.locked, keys = Object.keys(locked), after = G.switches;
  const changed = Object.keys(after).filter(k => after[k] !== before[k]);
  ok(keys.length === 1 && changed.length === 1 && changed[0] === keys[0] && after[keys[0]] === locked[keys[0]],
    `1-7: tapping Hint sets and padlocks exactly one switch (${keys[0]} → ${locked[keys[0]]})`);
  const sols = ticketSolutions(L);
  ok(sols.some(s => s.switches[keys[0]] === locked[keys[0]]) && before[keys[0]] !== locked[keys[0]],
    '1-7: the hint fixes a wrong switch to its setting in a solution that wins with the ticket');
  ok(gaLog.slice(gaAt).some(l => l === 'design ui:hint = 2'), '1-7: ui:hint is sent with the fails before the hint (2)');
  ok(!G.hintVisible, '1-7: the button hides again until 2 more failed runs');
  G.flip(+keys[0].split(',')[0], +keys[0].split(',')[1]); frames(2);
  ok(G.switches[keys[0]] === locked[keys[0]], '1-7: a padlocked switch cannot be flipped');
  key('r'); frames(2);
  ok(G.switches[keys[0]] === locked[keys[0]], '1-7: Reset keeps the hinted switch');
  // Finish with a par-flip ticket solution that agrees with the hint: the par star is off.
  const target = sols.filter(s => s.switches[keys[0]] === locked[keys[0]]).sort((a, b) => flipCount(L, a) - flipCount(L, b))[0];
  for (const k in target.switches) if (G.switches[k] !== target.switches[k]) G.flip(+k.split(',')[0], +k.split(',')[1]);
  key(' '); frames(800);
  const R = G.result;
  ok(G.screen === 'complete' && R && R.flips <= R.par && !R.parStar && G.score === 2,
    `1-7: a win after a hint with ${R && R.flips} flips (par ${L.par}) earns ${G.score} stars: no par star`);
  frames(150);
  key('r'); frames(5);   // Retry: a fresh visit
  ok(G.screen === 'playing' && !G.hintUsed && Object.keys(G.locked).length === 0 && !G.hintVisible, '1-7: Retry starts clean (no padlock, no hint button)');
}

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
// Ten levels: two rows of five, 190 px apart, centred on x 640; row 2 at y 460.
tap(640, 460); frames(5);   // level 8 button: middle of the second row
ok(G.level === 'world01:level08' && G.screen === 'playing', `level select opens 1-8 from its button (${G.level})`);
key('Escape'); frames(2);
tap(520 + 120, 456 + 30); frames(30);  // pause → Levels
tap(640 + 2 * 190, 460); frames(5);    // level 10 button: end of the second row
ok(G.level === 'world01:level10' && G.screen === 'playing', `level select opens 1-10 from its button (${G.level})`);

const saved = JSON.parse(store['cm_tiny-trains_save']);
ok(saved.v === 1 && Object.keys(saved.levels).length === G.levels.length, `save has all ${G.levels.length} levels solved`);
store['cm_tiny-trains_save'] = '{broken';
const { loadSave } = await import('../src/save.js');
ok(loadSave().v === 1, 'a corrupted save resets to defaults');

// ?hints=now (presenter demo): a second boot with the flag shows the hint at once.
{
  const urls = [];
  globalThis.location = { search: '?level=1-3&hints=now' };
  globalThis.history = { replaceState(a, b, u) { urls.push(u); } };
  boot(mkCanvas());
  const D = globalThis.game;
  frames(5);
  ok(D.level === 'world01:level03' && D.fails === 0 && D.hintVisible, '?hints=now: the hint button shows with no failed runs');
  ok(urls.at(-1) === '?level=world01:level03&hints=now', `?hints=now survives the URL update (${urls.at(-1)})`);
  D.hint(); frames(3);
  ok(Object.keys(D.locked).length === 1 && D.hintUsed, '?hints=now: a hint padlocks one switch');
  ok(!errors.length, 'no runtime errors with the demo flag');
}

// Art styles (presentation): every ?art id boots, plays a crash and a win, draws every
// screen, and the A key / Art pill cycle the styles and keep the other URL params.
{
  const fs = await import('node:fs');
  // Image stub: "loads" on the next frame if the file exists, so the image paths of
  // every style are checked and the image code paths (tiles, sprites) are drawn.
  const missing = [];
  globalThis.Image = class {
    set src(u) {
      this._src = u;
      const ok = fs.existsSync(new URL(u));
      if (!ok) missing.push(u);
      this.width = 16; this.height = 16;
      queueMicrotask(() => (ok ? this.onload : this.onerror)?.());
    }
    get src() { return this._src; }
  };
  const opts = JSON.parse(fs.readFileSync(new URL('../art-options.json', import.meta.url), 'utf8'));
  const ids = globalThis.game.arts;
  ok(JSON.stringify(opts.map(o => o.id)) === JSON.stringify(ids), `art-options.json lists the styles in selector order (${ids.join(', ')})`);
  for (const id of ids) {
    const urls = [];
    globalThis.location = { search: `?level=1-4&art=${id}`, pathname: '/games/tiny-trains/' };
    globalThis.history = { replaceState(a, b, u) { urls.push(u); } };
    const before = errors.length;
    for (const k in listeners) delete listeners[k];   // only the newest boot listens
    boot(mkCanvas());
    const D = globalThis.game;
    frames(2);
    await new Promise(r => setTimeout(r, 0));   // let the style's images "load"
    D.restart(); key('Escape'); frames(5); tap(520 + 120, 456 + 30); frames(5); key('Escape'); frames(5);   // title, level select, back
    D.start('1-4'); frames(10);
    ok(D.art === id && D.level === 'world01:level04', `?art=${id} boots into the level with that style`);
    D.go(); frames(600);
    ok(D.phase === 'plan', `?art=${id}: a failed run plays and rewinds`);
    D.win(); frames(600);
    ok(D.screen === 'complete' && D.score >= 1, `?art=${id}: the reference solution wins (${D.score} stars)`);
    key('Escape'); frames(40); key('Escape'); frames(40);
    ok(errors.length === before, `?art=${id}: no runtime errors on any screen`);
    ok(id === 'classic' ? !urls.at(-1)?.includes('art=') : urls.some(u => u.includes(`art=${id}`)), `?art=${id} stays in the URL (${urls.at(-1)})`);
  }
  // Cycling: A on the title goes to the next style and writes it to the URL.
  const urls = [];
  globalThis.location = { search: '?hints=now', pathname: '/games/tiny-trains/' };
  globalThis.history = { replaceState(a, b, u) { urls.push(u); globalThis.location.search = u.startsWith('?') ? u : ''; } };
  for (const k in listeners) delete listeners[k];
  boot(mkCanvas());
  const D = globalThis.game;
  frames(5);
  const seen = [D.art];
  for (let i = 0; i < ids.length; i++) { key('a'); frames(20); seen.push(D.art); }
  ok(JSON.stringify(seen) === JSON.stringify([...ids, ids[0]]), `A cycles every style and back (${seen.join(' → ')})`);
  ok(urls.some(u => u.includes('hints=now') && u.includes(`art=${ids[1]}`)), `switching keeps the other params (${urls[0]})`);
  tap(120, 676); frames(20);
  ok(D.art === ids[1], `the Art pill on the title switches the style (${D.art})`);
  ok(D.screen === 'title' && !errors.length, 'no runtime errors while switching styles');
  await new Promise(r => setTimeout(r, 0));
  ok(!missing.length, `every style image file exists (${missing.length ? missing.join(', ') : 'all found'})`);
}

if (errors.length) for (const e of errors) origLog(e);
origLog(`\n${passed} passed, ${failed} failed`);
process.exit(failed || errors.length ? 1 : 0);
