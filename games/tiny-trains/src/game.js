// Game states (GDD 3, 8): title → levels → playing (plan ⇄ run → crash → rewind | win) → complete.
import { run, ticketStar, defaultSetup, flipCount, switchTiles, cellKey, buildBoard } from './sim.js';
import { opp } from './track.js';
import { pickHint, loopTick } from './solver.js';
import {
  VIEW_W, VIEW_H, TICK_S, LOOP_TICK_S, CRASH_HOLD_S, REWIND_S, WIN_HOLD_S, HINT_FAILS, CREAM, INK, TRAIN_COLORS, mix,
} from './config.js';
import {
  computeLayout, buildBoardLayer, drawSwitch, drawStation, drawDepot, drawTrain, pathPoint,
  emit, FX, updateParticles, drawParticles, clearParticles, MAT, drawTicket, GOLD,
} from './render.js';
import {
  resetButtons, hitButton, drawTitle, drawLevels, drawHUD, drawPause, drawComplete, drawCrashLabel, drawHand, drawArtToast,
} from './ui.js';
import { T, THEMES, setTheme, findTheme, nextThemeId, artRev, artUrl } from './theme.js';
import { WORLDS, ALL_LEVELS, findLevel } from '../levels/index.js';
import { loadSave, storeSave } from './save.js';
import { GA } from './analytics.js';
import { sfx, audio, unlockAudio, setSampleSet } from './audio.js';

const LEVELS = WORLDS[0].levels;

function applyArt(id) {
  const th = setTheme(findTheme(id) ? id : 'classic');
  setSampleSet(th.sfx ? Object.fromEntries(Object.entries(th.sfx).map(([k, v]) => [k, Array.isArray(v) ? v.map(artUrl) : artUrl(v)])) : null);
}

export function boot(canvas) {
  const ctx = canvas.getContext('2d'), mainCtx = ctx;
  const view = { scale: 1, ox: 0, oy: 0, dpr: 1 };

  // Art style (presentation): ?art=<id>, default classic.
  applyArt(new URLSearchParams(location.search).get('art'));

  const G = {
    artT: 9, fadeT: 9, shownScreen: null,
    screen: 'title', save: loadSave(), time: 0, t: 0,
    level: null, index: -1, L: null, board: null, layer: null, layerScale: 0,
    switches: [], setup: null, phase: 'plan', paused: false,
    runs: 0, fails: 0, sel: -1, kb: false, fast: false,
    res: null, pos: 0, done: 0, arrivals: 0,
    swAnim: {}, swVel: {}, swPulse: {}, stBounce: {}, shake: 0,
    result: null, starsPlayed: 0, ticketGot: false, ticketT: 0, pressId: null, flippedOnce: false, crashAt: null,
    // Hints (GDD 3.13). locked = { "x,y": value }: switches set and padlocked by hints this visit.
    // ?hints=now (presenter demo) shows the button from the first plan, without failing twice.
    demoHints: new URLSearchParams(location.search).get('hints') === 'now',
    locked: {}, hintUsed: false, hintFails: 0, hintT: 9, hintMsg: null,
    loopAt: -1,   // tick from which this run's board repeats (it can only end lost), or -1
    // The button shows in planning after HINT_FAILS failed runs since the last hint.
    hintReady() { return G.phase === 'plan' && !G.paused && (G.demoHints || G.fails - G.hintFails >= HINT_FAILS); },
    flips() { return flipCount(G.level, G.setup); },
    isOpen(i) { return i <= furthest() + 2 || !!G.save.levels[LEVELS[i]?.id]; },
    nextIndex() { const i = LEVELS.findIndex(l => !G.save.levels[l.id]); return i; },
    hasNext() { return G.index + 1 < ALL_LEVELS.length; },
  };
  audio.enabled = G.save.settings.sfx;

  function furthest() {
    let f = -1;
    LEVELS.forEach((l, i) => { if (G.save.levels[l.id]) f = i; });
    return f;
  }

  // ---- Level flow ------------------------------------------------------------------
  function startLevel(level) {
    if (G.screen === 'playing' && G.level && G.runs > 0 && !G.save.levels[G.level.id]) GA.design(`level:abandon:${G.level.id}`, G.runs);
    const idx = ALL_LEVELS.indexOf(level);
    if (idx > furthest() + 1) GA.design('ui:skip');
    G.level = level; G.index = idx;
    G.L = computeLayout(level);
    G.board = buildBoard(level);
    G.layer = null;
    G.switches = switchTiles(level);
    G.setup = defaultSetup(level);
    G.swAnim = {}; G.swVel = {}; G.swPulse = {}; G.stBounce = {};
    for (const t of G.switches) { const k = cellKey(t.x, t.y); G.swAnim[k] = G.setup.switches[k]; G.swVel[k] = 0; G.swPulse[k] = 9; }
    G.phase = 'plan'; G.paused = false; G.runs = 0; G.fails = 0; G.sel = -1; G.kb = false; G.fast = false;
    G.res = null; G.result = null; G.flippedOnce = false; G.ticketGot = false; G.ticketT = 0;
    G.locked = {}; G.hintUsed = false; G.hintFails = 0; G.hintT = 9; G.hintMsg = null; G.loopAt = -1;
    clearParticles();
    G.screen = 'playing';
    if (idx === 0) GA.design('tutorial:step01');
    try { history.replaceState(null, '', `?level=${level.id}${G.demoHints ? '&hints=now' : ''}${T.id === 'classic' ? '' : `&art=${T.id}`}`); } catch { /* file:// */ }
  }

  function flip(t) {
    if (G.phase !== 'plan' || G.paused) return;
    const k = cellKey(t.x, t.y);
    if (k in G.locked) { G.swPulse[k] = 0; sfx.pop(); return; }   // padlocked by a hint: wiggle, no flip
    G.setup.switches[k] ^= 1;
    G.swPulse[k] = 0;
    sfx.click(G.setup.switches[k]);
    const c = G.L.cell;
    emit(FX.PUFF, G.L.ox + (t.x + 0.5) * c, G.L.oy + (t.y + 0.5) * c, 3, '#fff', 0.6);
    if (!G.flippedOnce && G.index === 0) GA.design('tutorial:step02');
    G.flippedOnce = true;
  }

  function resetSwitches() {
    if (G.phase !== 'plan' || G.flips() === hintFlips()) return;
    G.setup = { switches: { ...defaultSetup(G.level).switches, ...G.locked } };   // hinted switches stay set
    for (const t of G.switches) G.swPulse[cellKey(t.x, t.y)] = 0;
    sfx.pop();
    GA.design('ui:restart');
  }

  // Flips that hints forced (Reset keeps them).
  function hintFlips() {
    const d = defaultSetup(G.level).switches;
    return Object.keys(G.locked).filter(k => G.locked[k] !== d[k]).length;
  }

  // Hint (GDD 3.13): set and padlock one switch of the ticket solution closest to the
  // player's setup: the wrong one a train reaches first. No par star for the rest of
  // this visit. Each further hint needs HINT_FAILS more failed runs.
  function useHint() {
    if (G.screen !== 'playing' || !G.hintReady()) return;
    const h = pickHint(G.level, G.setup, G.locked);
    G.hintT = 0;
    if (!h) { G.hintMsg = 'Your switches already work. Press GO!'; sfx.pop(); return; }
    GA.design('ui:hint', G.fails);
    G.locked[h.key] = h.value;
    G.setup.switches[h.key] = h.value;
    G.swPulse[h.key] = 0;
    G.hintUsed = true;
    G.hintFails = G.fails;
    G.hintMsg = 'The padlocked switch is set right. No par star now.';
    G.sel = G.switches.findIndex(t => cellKey(t.x, t.y) === h.key);
    const c = G.L.cell, t = G.switches[G.sel];
    emit(FX.STAR, G.L.ox + (t.x + 0.5) * c, G.L.oy + (t.y + 0.5) * c, 10, GOLD, 1);
    sfx.click(h.value); sfx.star(1);
  }

  function go() {
    if (G.paused) return;
    if (G.phase === 'plan') {
      G.res = run(G.level, G.setup);
      G.loopAt = loopTick(G.res);   // the board repeats: the run can only end lost, so play the rest fast
      G.runs++;
      G.pos = 0; G.done = 0; G.arrivals = 0;
      G.ticketGot = false; G.ticketT = 0;
      G.phase = 'run';
      GA.progression('Start', G.level.id);
      if (G.index === 0 && G.runs === 1) GA.design('tutorial:step03');
      sfx.whistle();
      onFrame(0);
    } else if (G.phase === 'run') {
      beginRewind();
    }
  }

  function beginRewind() {
    G.phase = 'rewind'; G.t = 0; G.fast = false;
    sfx.rewind();
  }

  function onFrame(k) {
    const fr = G.res.frames[k];
    const c = G.L.cell;
    let moving = 0;
    for (const ev of fr.events) {
      if (ev.type === 'arrive') {
        G.arrivals++;
        sfx.ding(G.arrivals);
        const tr = G.level.trains[ev.id];
        const x = G.L.ox + (ev.x + 0.5) * c, y = G.L.oy + (ev.y + 0.5) * c;
        emit(FX.CONF, x, y - c * 0.2, 24, TRAIN_COLORS[tr.color]);
        emit(FX.CONF, x, y - c * 0.2, 8, '#FFFFFF');
        G.stBounce[cellKey(ev.x, ev.y)] = 1;
      } else if (ev.type === 'ticket') {
        G.ticketGot = true; G.ticketT = 0;
        const x = G.L.ox + (ev.x + 0.5) * c, y = G.L.oy + (ev.y + 0.5) * c;
        emit(FX.STAR, x, y, 8, GOLD, 0.9);
        emit(FX.CONF, x, y, 10, GOLD, 0.6);
        sfx.star(2);
        GA.design('level:ticket');
      } else if (ev.type === 'depart') {
        const tr = G.level.trains[ev.id];
        emit(FX.STEAM, G.L.ox + (tr.depot[0] + 0.5) * c, G.L.oy + (tr.depot[1] + 0.5) * c - c * 0.2, 5, '#fff', 0.8);
      }
    }
    for (const tr of fr.trains) if (tr.state === 'run') moving++;
    if (k > 0 && moving) sfx.chug();
    if (k === G.res.frames.length - 1) {
      if (G.res.result === 'win') {
        G.phase = 'win'; G.t = 0;
        sfx.win();
      } else {
        G.phase = 'crash'; G.t = 0; G.fails++;
        G.crashAt = crashPoint();
        emit(FX.PUFF, G.crashAt.x, G.crashAt.y, 14, '#fff', 1.4);
        emit(FX.STAR, G.crashAt.x, G.crashAt.y, 6, TRAIN_COLORS.yellow, 1.2);
        G.shake = 0.15;
        sfx.crash();
        GA.progression('Fail', G.level.id);
        GA.design(`level:crash:${G.res.cause}`, G.res.tick);
      }
    }
  }

  function crashPoint() {
    const cr = G.res.crash, c = G.L.cell;
    const cx = x => G.L.ox + (x + 0.5) * c, cy = y => G.L.oy + (y + 0.5) * c;
    if (cr.cause === 'swap') return { x: (cx(cr.x) + cx(cr.x2)) / 2, y: (cy(cr.y) + cy(cr.y2)) / 2 };
    if (cr.cause === 'derail') {
      const last = G.res.frames[G.res.frames.length - 1].trains[cr.ids[0]];
      return { x: (cx(last.x) + cx(cr.x)) / 2, y: (cy(last.y) + cy(cr.y)) / 2 };
    }
    return { x: cx(cr.x), y: cy(cr.y) };
  }

  function complete() {
    const lv = G.level;
    const flips = G.flips(), first = G.runs === 1;
    const ticket = ticketStar(lv, G.res);
    const par = flips <= lv.par && !G.hintUsed;   // a hint costs the par star (GDD 3.13)
    const stars = 1 + (ticket ? 1 : 0) + (par ? 1 : 0);
    const rec = G.save.levels[lv.id] || { stars: 0, bestFlips: 99 };
    rec.stars = Math.max(rec.stars, stars);
    rec.bestFlips = Math.min(rec.bestFlips, flips);
    G.save.levels[lv.id] = rec;
    storeSave(G.save);
    GA.progression('Complete', lv.id, stars);
    GA.design('level:runs', G.runs);
    if (first) GA.design('level:perfect');
    if (G.index === 2) GA.design('tutorial:done');
    G.result = { stars, flips, par: lv.par, parStar: par, hint: G.hintUsed, first, ticket, hasTicket: !!lv.ticket, bestStars: rec.stars };
    G.screen = 'complete'; G.t = 0; G.starsPlayed = 0;
    // confetti shower over the results panel
    for (const [i, col] of ['red', 'blue', 'yellow', 'green'].entries()) emit(FX.CONF, 380 + i * 170, 60, 14, TRAIN_COLORS[col], 1.3);
  }

  function retry() { startLevel(G.level); }
  function next() {
    if (G.hasNext()) startLevel(ALL_LEVELS[G.index + 1]);
    else G.screen = 'levels';
  }
  // Next art style (Art pill or A): palette, font, board and sounds change in place; the
  // game state, the level and the run are untouched. The URL keeps its other params.
  function switchArt(id) {
    applyArt(id || nextThemeId());
    G.artT = 0;
    G.layer = null;
    try {
      const p = new URLSearchParams(location.search);
      if (T.id === 'classic') p.delete('art'); else p.set('art', T.id);
      const q = p.toString().replace(/%3A/gi, ':');
      history.replaceState(null, '', q ? `?${q}` : location.pathname);
    } catch { /* file:// */ }
    emit(FX.CONF, 640, 120, 18, TRAIN_COLORS.yellow, 0.7);
    emit(FX.CONF, 640, 120, 12, TRAIN_COLORS.blue, 0.7);
  }

  function toggleSound() {
    G.save.settings.sfx = !G.save.settings.sfx;
    audio.enabled = G.save.settings.sfx;
    storeSave(G.save);
    if (!G.save.settings.sfx) GA.design('settings:sfx:off');
    else sfx.pop();
  }
  function toMenu() {
    if (G.level && G.runs > 0 && !G.save.levels[G.level.id] && G.screen === 'playing') GA.design(`level:abandon:${G.level.id}`, G.runs);
    G.paused = false; G.screen = 'levels';
  }
  function play() {
    const i = G.nextIndex();
    startLevel(LEVELS[i >= 0 ? i : 0]);
  }

  function action(id) {
    sfx.pop();
    if (id === 'play') play();
    else if (id === 'levels') G.screen = 'levels';
    else if (id === 'back') G.screen = 'title';
    else if (id === 'sound') toggleSound();
    else if (id === 'art') switchArt();
    else if (id.startsWith('lvl:')) startLevel(LEVELS[+id.slice(4)]);
    else if (id === 'pause') G.paused = true;
    else if (id === 'resume') G.paused = false;
    else if (id === 'restart') retry();
    else if (id === 'menu') toMenu();
    else if (id === 'go') go();
    else if (id === 'fast') toggleFast();
    else if (id === 'reset') resetSwitches();
    else if (id === 'hint') useHint();
    else if (id === 'retry') retry();
    else if (id === 'next') next();
  }

  function toggleFast() {
    if (G.phase !== 'run') return;
    G.fast = !G.fast;
    if (G.fast) GA.design('ui:fastforward');
  }

  // ---- Input -----------------------------------------------------------------------
  function toView(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) - view.ox) / view.scale, y: ((e.clientY - r.top) - view.oy) / view.scale };
  }

  canvas.addEventListener('pointerdown', e => {
    unlockAudio();
    const p = toView(e);
    G.kb = false;
    const id = hitButton(p.x, p.y);
    if (id) { G.pressId = id; canvas.setPointerCapture?.(e.pointerId); return; }
    if (G.screen !== 'playing' || G.paused) return;
    if (G.phase === 'crash') { G.t = CRASH_HOLD_S; return; }
    if (G.phase === 'plan') {
      const c = G.L.cell;
      let best = null, bd = 1e9;
      for (const t of G.switches) {
        const dx = p.x - (G.L.ox + (t.x + 0.5) * c), dy = p.y - (G.L.oy + (t.y + 0.5) * c);
        const d = Math.hypot(dx, dy);
        if (d < c * 0.6 && d < bd) { bd = d; best = t; }   // tap target 1.2 × cell (GDD 3.1)
      }
      if (best) { flip(best); G.sel = G.switches.indexOf(best); }
    }
  });
  canvas.addEventListener('pointerup', e => {
    const p = toView(e);
    const id = G.pressId;
    G.pressId = null;
    if (id && hitButton(p.x, p.y) === id) action(id);
  });
  canvas.addEventListener('pointercancel', () => { G.pressId = null; });

  window.addEventListener('keydown', e => {
    unlockAudio();
    const k = e.key;
    if (k === 'Tab' || k === ' ') e.preventDefault();
    if (e.repeat && k !== 'Tab') return;
    if ((k === 'a' || k === 'A') && !e.ctrlKey && !e.metaKey) { switchArt(); return; }   // art style (presentation)
    if (G.screen === 'title') {
      if (k === 'Enter' || k === ' ') play();
      else if (k === 'l' || k === 'L') G.screen = 'levels';
      return;
    }
    if (G.screen === 'levels') {
      if (k === 'Escape') G.screen = 'title';
      else if (/^[1-9]$/.test(k) && LEVELS[+k - 1] && G.isOpen(+k - 1)) startLevel(LEVELS[+k - 1]);
      else if (k === 'Enter' || k === ' ') play();
      return;
    }
    if (G.screen === 'complete') {
      if (G.t < 0.35) return;
      if (k === 'Enter' || k === ' ' || k === 'n' || k === 'N') next();
      else if (k === 'r' || k === 'R') retry();
      else if (k === 'Escape') toMenu();
      return;
    }
    // playing
    if (G.paused) {
      if (k === 'p' || k === 'P' || k === 'Escape' || k === 'Enter' || k === ' ') G.paused = false;
      return;
    }
    if (G.phase === 'crash') { G.t = CRASH_HOLD_S; return; }   // any key skips the crash replay
    if (k === 'p' || k === 'P' || k === 'Escape') { G.paused = true; return; }
    if (k === ' ') { go(); return; }
    if (k === 'r' || k === 'R') { if (G.phase === 'run') beginRewind(); else resetSwitches(); return; }
    if (k === 'f' || k === 'F') { toggleFast(); return; }
    if (k === 'h' || k === 'H') { useHint(); return; }
    if (k === 'Tab' && G.switches.length) {
      G.kb = true;
      const n = G.switches.length;
      G.sel = G.sel < 0 ? (e.shiftKey ? n - 1 : 0) : (G.sel + (e.shiftKey ? n - 1 : 1)) % n;
      return;
    }
    if (k === 'Enter' && G.phase === 'plan') {
      if (G.sel < 0) { G.sel = 0; G.kb = true; }
      else flip(G.switches[G.sel]);
    }
  });

  // ---- Update ----------------------------------------------------------------------
  function update(dt) {
    G.time += dt;
    G.artT += dt; G.fadeT += dt;
    if (G.screen === 'title') {
      G.titleT = (G.titleT || 0) + dt;
      G.steamT = (G.steamT || 0) + dt;
      if (G.steamT > 0.3) {   // puffs from the lead train's chimney on the title oval
        G.steamT = 0;
        const a = G.time * 0.7 + 1.0;
        emit(FX.STEAM, 640 + Math.cos(a) * 360, 342 + Math.sin(a) * 66 - 12, 1, '#fff', 0.5);
      }
    } else G.titleT = 0;
    G.ticketT += dt;
    G.hintT += dt;
    G.hintVisT = G.screen === 'playing' && G.hintReady() ? (G.hintVisT || 0) + dt : 0;   // hint button slide-in
    updateParticles(dt);
    G.shake = Math.max(0, G.shake - dt);
    if (G.screen === 'complete') {
      G.t += dt;
      const R = G.result;
      const earned = [true, R.ticket, R.parStar];
      while (G.starsPlayed < 3 && G.t > 0.45 + G.starsPlayed * 0.35) {
        if (earned[G.starsPlayed]) {
          sfx.star(G.starsPlayed);
          const y = 130 + 160;
          emit(FX.STAR, 640 + (G.starsPlayed - 1) * 140, y, 6, TRAIN_COLORS.yellow, 0.8);
        }
        G.starsPlayed++;
      }
      return;
    }
    if (G.screen !== 'playing') return;
    // switch lever springs (snap with overshoot)
    for (const t of G.switches) {
      const k = cellKey(t.x, t.y);
      const target = G.setup.switches[k];
      G.swVel[k] += (target - G.swAnim[k]) * 900 * dt;
      G.swVel[k] *= Math.exp(-22 * dt);
      G.swAnim[k] += G.swVel[k] * dt;
      G.swPulse[k] += dt;
    }
    for (const k in G.stBounce) G.stBounce[k] = Math.max(0, G.stBounce[k] - dt * 3);
    if (G.paused) return;
    if (G.phase === 'run') {
      const last = G.res.frames.length - 1;
      const looping = G.loopAt >= 0 && G.pos >= G.loopAt;
      G.pos = Math.min(last, G.pos + dt / (looping ? LOOP_TICK_S : TICK_S * (G.fast ? 0.5 : 1)));
      while (G.done < Math.floor(G.pos)) { G.done++; onFrame(G.done); if (G.phase !== 'run') break; }
    } else if (G.phase === 'crash') {
      G.t += dt;
      if (G.t >= CRASH_HOLD_S) beginRewind();
    } else if (G.phase === 'rewind') {
      G.t += dt;
      if (G.t >= REWIND_S) { G.phase = 'plan'; G.res = null; G.ticketGot = false; }
    } else if (G.phase === 'win') {
      G.t += dt;
      if (G.t >= WIN_HOLD_S) complete();
    }
  }

  // ---- Draw ------------------------------------------------------------------------
  const PT = { x: 0, y: 0, a: 0 };

  function depotPose(tr, out) {
    const d = G.board.get(cellKey(tr.depot[0], tr.depot[1]));
    const r = d.rot & 3;
    pathPoint(opp(r), r, 0.5, PT);
    out.x = G.L.ox + (d.x + 0.5 + PT.x) * G.L.cell; out.y = G.L.oy + (d.y + 0.5 + PT.y) * G.L.cell; out.a = PT.a;
  }

  function cellPose(x, y, e1, e2, s, out) {
    pathPoint(e1, e2, s, PT);
    out.x = G.L.ox + (x + 0.5 + PT.x) * G.L.cell; out.y = G.L.oy + (y + 0.5 + PT.y) * G.L.cell; out.a = PT.a;
  }

  // Interpolated pose of a train between two frames. Returns false when hidden.
  const POSE = { x: 0, y: 0, a: 0, tilt: 0, scale: 1 };
  function trainPose(def, A, B, f, out) {
    out.tilt = 0; out.scale = 1;
    if (A.state === 'home') return false;
    if (B.state === 'wait' || (A.state === 'wait')) { depotPose(def, out); return true; }
    if (B.state === 'crash' && B.cause === 'derail') {
      cellPose(A.x, A.y, A.inE, A.dir, 0.5 + 0.42 * f, out);
      out.tilt = 0.5 * f;
      return true;
    }
    if (!B.moved) { cellPose(B.x, B.y, B.inE, B.dir, 0.5, out); return true; }
    let g = f;
    if (B.cause === 'swap') g = Math.min(f, 0.42);
    else if (B.cause === 'collision') g = Math.min(f, 0.8);
    else if (B.cause === 'wrong_station') g = Math.min(f, 0.75);
    if (g < 0.5) cellPose(A.x, A.y, A.inE, A.dir, 0.5 + g, out);
    else cellPose(B.x, B.y, B.inE, B.dir, g - 0.5, out);
    if (B.state === 'home' && g > 0.6) out.scale = 1 - (g - 0.6) * 1.8;
    if (B.state === 'crash') out.tilt = (B.cause === 'swap' ? 0.3 : 0.4) * Math.max(0, f - 0.5) * 2 * (def.id % 2 ? -1 : 1);
    return true;
  }

  // Pixel styles draw the board into a small buffer and blow it up with no smoothing;
  // the HUD and labels stay sharp on top.
  let pix = null, pixCtx = null;
  function drawPlaying() {
    const L = G.L, lv = G.level;
    const px = T.pixel;
    let ctx = mainCtx;
    if (px) {
      const w = Math.round(VIEW_W / px), h = Math.round(VIEW_H / px);
      if (!pix) { pix = document.createElement('canvas'); pixCtx = pix.getContext('2d'); }
      if (pix.width !== w || pix.height !== h) { pix.width = w; pix.height = h; }
      ctx = pixCtx;
      ctx.setTransform(w / VIEW_W, 0, 0, h / VIEW_H, 0, 0);
      ctx.imageSmoothingEnabled = false;
    }
    const k = px ? 1 / px : view.scale * view.dpr;
    if (!G.layer || G.layerScale !== k || G.layerRev !== artRev) { G.layer = buildBoardLayer(lv, L, k); G.layerScale = k; G.layerRev = artRev; }
    ctx.fillStyle = CREAM; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    if (G.shake > 0) ctx.translate((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    ctx.drawImage(G.layer, L.ox - MAT, L.oy - MAT, L.bw + MAT * 2, L.bh + MAT * 2);
    const plan = G.phase === 'plan';
    G.switches.forEach((t, i) => {
      const key = cellKey(t.x, t.y);
      drawSwitch(ctx, t, L, G.setup.switches[key], G.swAnim[key], {
        interactive: plan, selected: G.kb && G.sel === i && plan, pulse: G.swPulse[key],
        locked: key in G.locked, time: G.time,
      });
    });
    // golden ticket: on its cell until a train collects it this run; pops away, comes back on rewind
    if (lv.ticket) {
      const tx = L.ox + (lv.ticket[0] + 0.5) * L.cell, ty = L.oy + (lv.ticket[1] + 0.5) * L.cell;
      if (!G.ticketGot) drawTicket(ctx, tx, ty, L.cell, G.time);
      else if (G.phase === 'rewind') drawTicket(ctx, tx, ty, L.cell, G.time, { scale: Math.min(1, G.t / REWIND_S) });
      else if (G.ticketT < 0.35) drawTicket(ctx, tx, ty - G.ticketT * L.cell * 1.2, L.cell, G.time, { scale: 1 + G.ticketT * 1.5, alpha: 1 - G.ticketT / 0.35 });
    }
    // depots under the trains
    for (const t of lv.tiles) if (t.t === 'depot') drawDepot(ctx, t, L, lv.trains.filter(tr => tr.depot[0] === t.x && tr.depot[1] === t.y));
    // trains
    const c = L.cell;
    if (G.phase === 'plan' || !G.res) {
      for (const def of lv.trains) { depotPose(def, POSE); drawTrain(ctx, POSE.x, POSE.y, POSE.a, def.color, c); }
    } else {
      const fr = G.res.frames, last = fr.length - 1;
      const i = Math.min(Math.floor(G.pos), last - 1), f = G.pos - i;
      const A = fr[i], B = fr[i + 1];
      const rewinding = G.phase === 'rewind';
      const fade = rewinding ? Math.min(1, G.t / REWIND_S) : 0;
      for (const def of lv.trains) {
        const a = A.trains[def.id], b = B.trains[def.id];
        if (trainPose(def, a, b, f, POSE)) {
          const bob = G.phase === 'run' && b.state === 'run' && b.moved ? -Math.sin(Math.PI * f) * 2 : 0;
          drawTrain(ctx, POSE.x, POSE.y, POSE.a, def.color, c, { tilt: POSE.tilt, scale: Math.max(0.05, POSE.scale), bob, alpha: 1 - fade });
        }
        if (rewinding) { depotPose(def, POSE); drawTrain(ctx, POSE.x, POSE.y, POSE.a, def.color, c, { alpha: fade, scale: 0.6 + 0.4 * fade }); }
      }
    }
    for (const t of lv.tiles) if (t.t === 'station') drawStation(ctx, t, L, G.stBounce[cellKey(t.x, t.y)] || 0);
    drawParticles(ctx);
    ctx.restore();
    if (px) {
      ctx = mainCtx;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pix, 0, 0, VIEW_W, VIEW_H);
      ctx.imageSmoothingEnabled = true;
    }
    if (G.phase === 'crash' && G.crashAt) drawCrashLabel(ctx, G, G.crashAt.x, G.crashAt.y, G.res.cause, G.t);

    drawHUD(ctx, G);
    if (lv.tutorial && plan && !G.paused) {
      if (!G.flippedOnce) { const t = G.switches[0]; drawHand(ctx, L.ox + (t.x + 0.6) * c, L.oy + (t.y + 0.6) * c, G.time); }
      else if (G.runs === 0) drawHand(ctx, 1150, 690, G.time);
    }
    if (G.paused) drawPause(ctx, G);
  }

  function draw() {
    resetButtons();
    // letterbox
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = mix(CREAM, INK, 0.12);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const s = view.scale * view.dpr;
    ctx.setTransform(s, 0, 0, s, view.ox * view.dpr, view.oy * view.dpr);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, VIEW_W, VIEW_H); ctx.clip();
    if (G.screen === 'title') { drawTitle(ctx, G); drawParticles(ctx); }
    else if (G.screen === 'levels') drawLevels(ctx, G);
    else {
      drawPlaying();
      if (G.screen === 'complete') { resetButtons(); drawComplete(ctx, G); drawParticles(ctx); }
    }
    // Screen change: a short fade from the backdrop color (results overlay excluded).
    const base = G.screen === 'complete' ? 'playing' : G.screen;
    if (base !== G.shownScreen) { if (G.shownScreen) G.fadeT = 0; G.shownScreen = base; }   // no fade on the first screen
    if (G.fadeT < 0.3) {
      ctx.globalAlpha = 1 - G.fadeT / 0.3;
      ctx.fillStyle = CREAM; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
    if (G.artT < 1.6) { drawArtToast(ctx, G.artT); drawParticles(ctx); }
    ctx.restore();
  }

  // ---- Resize and loop ---------------------------------------------------------------
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    view.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * view.dpr); canvas.height = Math.round(h * view.dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    view.scale = Math.min(w / VIEW_W, h / VIEW_H);
    view.ox = (w - VIEW_W * view.scale) / 2; view.oy = (h - VIEW_H * view.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  let lastT = performance.now(), hidden = false;
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    lastT = performance.now();
    if (hidden && G.screen === 'playing' && G.phase === 'run') G.paused = true;
  });
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!hidden) { update(dt); draw(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- Testing hook (STANDARDS.md) ---------------------------------------------------
  window.game = {
    get screen() { return G.screen; },
    get level() { return G.level ? G.level.id : null; },
    get phase() { return G.phase; },
    get score() { return G.result ? G.result.stars : 0; },
    get flips() { return G.level ? G.flips() : 0; },
    get switches() { return G.setup ? { ...G.setup.switches } : {}; },
    get fails() { return G.fails; },
    get hintVisible() { return G.screen === 'playing' && G.hintReady(); },
    get hintUsed() { return G.hintUsed; },
    get locked() { return { ...G.locked }; },
    get looping() { return G.phase === 'run' && G.loopAt >= 0 && G.pos >= G.loopAt; },
    get result() { return G.result ? { ...G.result } : null; },
    hint() { useHint(); },
    get art() { return T.id; },
    arts: THEMES.map(t => t.id),
    setArt(id) { switchArt(id); },
    levels: ALL_LEVELS.map(l => l.id),
    start(ref) { const l = findLevel(String(ref ?? '1-1')) || LEVELS[0]; startLevel(l); },
    restart() { if (G.level) retry(); },
    go() { go(); },
    flip(x, y) { const t = G.switches.find(s => s.x === x && s.y === y); if (t) flip(t); },
    // Debug: set the reference solution and run it.
    win() {
      if (!G.level) startLevel(LEVELS[0]);
      if (G.phase !== 'plan') return;
      G.setup = { switches: { ...defaultSetup(G.level).switches, ...G.level.solution.switches } };
      G.locked = {}; G.hintUsed = false;   // win() is always the clean reference run
      go();
    },
  };

  // ?level=<id> (or 1-3, or 3) starts straight into a level
  const ref = new URLSearchParams(location.search).get('level');
  const lv = findLevel(ref);
  if (lv) startLevel(lv);
}
