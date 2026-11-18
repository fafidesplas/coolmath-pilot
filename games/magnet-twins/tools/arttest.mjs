// Headless smoke test for the art styles (no browser, no dependencies):
//   node tools/arttest.mjs
// Stubs just enough DOM (canvas, Image, FontFace, window, location) to boot the real Game,
// then for every style: switch to it, draw the title, the level select, play a level that
// uses every element, pause, and the results screen. Any exception is a FAIL. It also checks
// that every file a style names exists and that art-options.json matches art.js.
import { existsSync, readFileSync } from 'node:fs';

const ROOT = new URL('../', import.meta.url);
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failed++; };

// ---- Stubs ---------------------------------------------------------------------
// A 2D context that accepts every call and property. Records drawImage sources so we can
// see the sprite styles really draw their sheets.
const drawn = new Set();
function makeCtx(canvas) {
  const state = { canvas, imageSmoothingEnabled: true, globalAlpha: 1 };
  const grad = { addColorStop() {} };
  return new Proxy(state, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'measureText') return s => ({ width: String(s).length * 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'drawImage') return (img, ...args) => {
        if (!img || (img.tagName !== 'IMG' && img.tagName !== 'CANVAS')) throw new Error('drawImage with a bad source');
        for (const n of args) if (!Number.isFinite(n)) throw new Error('drawImage with a non-finite number');
        if (img.src) drawn.add(img.src);
      };
      if (k === 'arc' || k === 'ellipse') return (...a) => { if (a.slice(0, 4).some(n => !Number.isFinite(n))) throw new Error(`${k} with NaN`); if (a[2] < 0) throw new Error(`${k} negative radius`); };
      if (k === 'arcTo') return (...a) => { if (a[4] < 0) throw new Error('arcTo negative radius'); };
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.style = {}; this.dataset = {}; this.hidden = false; this.textContent = '';
    this.classList = { toggle() {}, add() {}, remove() {} };
    this._ctx = null; this.width = 300; this.height = 150; this.listeners = {};
  }
  getContext() { return this._ctx || (this._ctx = makeCtx(this)); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  click() { for (const fn of this.listeners.click || []) fn({ preventDefault() {} }); }
  querySelectorAll() { return []; }
  focus() {} blur() {} setPointerCapture() {}
}
const elements = { game: new Element('canvas'), artpill: new Element('button'), touch: new Element('div') };
globalThis.document = {
  body: new Element('body'),
  createElement: tag => new Element(tag),
  getElementById: id => elements[id] || null,
  addEventListener() {},
  hidden: false,
  fonts: { add() {} },
};
const fileOf = url => new URL(url, ROOT);
globalThis.Image = class extends Element {
  constructor() { super('img'); }
  set src(v) {
    this._src = v;
    setTimeout(() => (existsSync(fileOf(v)) ? this.onload : this.onerror)?.(), 0);
  }
  get src() { return this._src; }
};
globalThis.FontFace = class {
  constructor(family, src) { this.family = family; this.file = src.replace(/^url\((.*)\)$/, '$1'); }
  load() { return existsSync(fileOf(this.file)) ? Promise.resolve(this) : Promise.reject(new Error('missing ' + this.file)); }
};
const listeners = {};
globalThis.window = globalThis;
window.addEventListener = (type, fn) => { (listeners[type] ||= []).push(fn); };
window.innerWidth = 1280; window.innerHeight = 720; window.devicePixelRatio = 1;
window.matchMedia = () => ({ matches: false });
let href = 'http://localhost/games/magnet-twins/?level=w1l01';
globalThis.location = { get href() { return href; }, get search() { return new URL(href).search; } };
globalThis.history = { state: null, replaceState(_s, _t, u) { href = String(u); } };
globalThis.localStorage = { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = String(v); } };
globalThis.requestAnimationFrame = () => 0;
const realLog = console.log;
console.log = (...a) => { if (!String(a[0]).startsWith('%c[GA]')) realLog(...a); };   // quiet analytics stub
const warnings = [];
console.warn = (...a) => warnings.push(a.join(' '));

// ---- Load ------------------------------------------------------------------------
const { STYLES, ART_IDS, applyArt, art } = await import('../src/art.js');
const { Game } = await import('../src/game.js');
const { findLevel } = await import('../levels/index.js');

// Files every style names must exist (so a deploy can't silently lose them).
for (const s of STYLES) {
  const dir = `assets/art/${s.id}/`;
  const files = [...Object.values(s.images || {}), ...(s.font ? [s.font.file] : []),
    ...Object.values(s.sounds || {}).flat().map(u => u.slice(dir.length))];
  const missing = files.filter(f => !existsSync(new URL(dir + f, ROOT)));
  ok(!missing.length, `${s.id}: all ${files.length} asset files exist${missing.length ? ' — missing ' + missing.join(', ') : ''}`);
}

// art-options.json (read by the presentation page) lists the same styles in the same order.
{
  const opts = JSON.parse(readFileSync(new URL('art-options.json', ROOT), 'utf8'));
  ok(JSON.stringify(opts.map(o => o.id)) === JSON.stringify(ART_IDS), `art-options.json ids match the selector order (${ART_IDS.join(', ')})`);
  ok(opts.every(o => o.name && o.description && o.license && 'url' in o && o.pack), 'art-options.json entries have name, description, pack, license, url');
}

// Boot the real game on a level that has crates, doors, plates, spikes, water and a checkpoint.
await applyArt('classic');
const game = new Game(elements.game);
const levelIds = ['w1l10', 'w2l13'];
const frame = n => { for (let i = 0; i < n; i++) game.frame(game.last + 1000 / 60); };

for (const id of ART_IDS) {
  let err = null;
  try {
    await game.setArt(id);
    if (art.style.id !== id) throw new Error(`active style is ${art.style.id}`);
    game.toMenu('title'); frame(5);
    game.screen = 'levels'; frame(3);
    for (const lid of levelIds) {
      game.startLevel(findLevel(lid), 'coop');
      frame(30);
      game.pause(true); frame(2); game.pause(false);
      game.startLevel(findLevel(lid), 'solo'); frame(10);
    }
    game.sim.forceWin(); frame(200);
    if (game.screen !== 'complete') throw new Error(`expected the results screen, got ${game.screen}`);
  } catch (e) { err = e; }
  ok(!err, `${id}: title, level select, levels ${levelIds.join(' + ')}, pause and results draw without errors${err ? ' — ' + (err.stack || err) : ''}`);
  ok(new URL(href).searchParams.get('art') === id && new URL(href).searchParams.get('level') === 'w1l01', `${id}: URL updated to ?art=${id}, other params kept`);
  const sheets = Object.values(art.style.images || {}).map(f => `assets/art/${id}/${f}`);
  if (sheets.length) ok(sheets.some(f => drawn.has(f)), `${id}: sprite sheets are actually drawn`);
}

// The pill and the V key cycle through every style and wrap around.
{
  await game.setArt(ART_IDS[0]);
  const seen = [];
  for (let i = 0; i < ART_IDS.length; i++) { elements.artpill.click(); await new Promise(r => setTimeout(r, 5)); seen.push(art.style.id); }
  ok(JSON.stringify(seen) === JSON.stringify([...ART_IDS.slice(1), ART_IDS[0]]), `pill cycles ${seen.join(' → ')}`);
  game.onKey('KeyV'); await new Promise(r => setTimeout(r, 5));
  ok(art.style.id === ART_IDS[1], 'V key moves to the next style');
  ok(/ART 2\/\d+: /.test(elements.artpill.textContent), `pill label "${elements.artpill.textContent}"`);
}

ok(!warnings.length, `no warnings while loading styles${warnings.length ? ': ' + warnings.join(' | ') : ''}`);
console.log(failed ? `\n${failed} FAILED` : '\nall art checks passed');
process.exit(failed ? 1 : 0);
