// HUD and screens (GDD 8): title, pause, results and runners. layout() returns this
// frame's buttons, and main.js hit-tests pointers against the same list, so a
// sliding panel's buttons are always where they are drawn.
import { VIEW_W, VIEW_H, RUN, HATCH, RUNNER_LIST } from './config.js';
import { drawText, textWidth } from './font.js';
import { PAL, SPR, MARGIN } from './sprites.js';
import { CELL } from './art.js';

export const RESULTS_DELAY_MS = 500;   // the panel slides up this long after the crash
const PANEL_MS = 350, COUNT_MS = 700, FLASH_MS = 250, HINT_MS = 5000, SLIDE_HINT_MS = 2000, BUMP_MS = 150;
const PANEL_Y = 34, PANEL_H = 242;
const ease = t => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;
const pad = n => String(n).padStart(5, '0');
const grid = v => Math.round(v / CELL) * CELL;

// The Runners screen (GDD 8): one card per runner, centered in a row.
const CARD = { y: 50, w: 120, h: 120, gap: 12 };
const cardX = i => (VIEW_W - RUNNER_LIST.length * (CARD.w + CARD.gap) + CARD.gap) / 2 + i * (CARD.w + CARD.gap);
export const canHatch = (data, R) => R.price > 0 && !data.unlocked.includes(R.id) && data.eggs >= R.price;
// The hatch scene (GDD 7.1), in ms from the Hatch press: the egg wobbles,
// cracks 3 times, opens, and a press closes it once the runner has landed.
export const HATCH_MS = { crack: [700, 1100, 1500], open: 1900, done: 2500 };

function panelY(g, now) {
  return Math.round(VIEW_H + 10 - (VIEW_H + 10 - PANEL_Y) * ease((now - g.crashAt - RESULTS_DELAY_MS) / PANEL_MS));
}

// The pause and sound buttons sit in the top-right corner; their hit square is
// at least 64 CSS px, so pressing them never jumps (GDD 4).
function corner(id, r) {
  const hit = Math.max(40, r.logicalPx(64));
  return { id, icon: id, x: VIEW_W - 32, y: 8, w: 24, h: 24, hit: { x: VIEW_W - hit, y: 0, w: hit, h: hit } };
}

export function layout(g, now, r) {
  const B = [];
  if (g.screen === 'title') {
    B.push({ id: 'play', label: 'PLAY', size: 4, big: true, x: 250, y: 102, w: 140, h: 44 });
    B.push({ id: 'runners', label: 'RUNNERS', size: 2, x: 260, y: 200, w: 120, h: 30 });
    B.push({ ...corner('sound', r), on: g.data.settings.sfx });
  } else if (g.screen === 'playing') {
    B.push(corner('pause', r));
  } else if (g.screen === 'paused') {
    B.push({ id: 'resume', label: 'RESUME', size: 4, big: true, x: 224, y: 130, w: 192, h: 44 });
    B.push({ id: 'restart', label: 'RESTART', size: 2, x: 240, y: 182, w: 160, h: 30 });
    B.push({ id: 'menu', label: 'MENU', size: 2, x: 240, y: 218, w: 160, h: 30 });
  } else if (g.screen === 'complete' && now - g.crashAt >= RESULTS_DELAY_MS) {
    const y = panelY(g, now);
    B.push({ id: 'retry', label: 'RETRY', size: 4, big: true, x: 152, y: y + 166, w: 150, h: 44 });
    B.push({ id: 'runners', label: 'RUNNERS', size: 2, x: 310, y: y + 172, w: 110, h: 32 });
    B.push({ id: 'menu', label: 'MENU', size: 2, x: 428, y: y + 172, w: 64, h: 32 });
  } else if (g.screen === 'runners' && !g.hatch) {
    RUNNER_LIST.forEach((R, i) => {   // a Hatch button before its card, so it wins the hit test
      const x = cardX(i);
      if (canHatch(g.data, R)) B.push({ id: 'hatch', i, label: 'HATCH', size: 2, big: true, x: x + 14, y: CARD.y + 82, w: 92, h: 30 });
      B.push({ id: 'card', i, card: true, x, y: CARD.y, w: CARD.w, h: CARD.h });
    });
    B.push({ id: 'back', label: 'BACK', size: 2, x: 504, y: 304, w: 112, h: 32 });
  }
  return B;
}

export function hitButton(buttons, x, y) {
  return buttons.find(b => {
    const h = b.hit || b;
    return x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h;
  });
}

// ---- drawing ------------------------------------------------------------------------------
// A panel or button in 2 px art pixels: border with cut corners, and a darker lip along the bottom.
function box(ctx, x, y, w, h, border, fill, lip) {
  ctx.fillStyle = border;
  ctx.fillRect(x + 2, y, w - 4, h);
  ctx.fillRect(x, y + 2, w, h - 4);
  ctx.fillStyle = lip;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 8);
}

function drawButton(ctx, b) {
  if (b.card) return;   // drawn by drawRunners
  if (b.icon) return drawIcon(ctx, b);
  box(ctx, b.x, b.y, b.w, b.h, PAL.ink, b.big ? PAL.orange : PAL.slate, b.big ? '#C46A12' : '#46546A');
  ctx.fillStyle = 'rgba(255,246,224,0.35)';
  ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 2);
  drawText(ctx, b.label, b.x + b.w / 2, b.y + 2 * Math.round((b.h - 4 - 7 * b.size) / 4), b.size, PAL.cream, 'center');
}

function drawIcon(ctx, b) {
  box(ctx, b.x, b.y, b.w, b.h, PAL.ink, PAL.slate, '#46546A');
  ctx.fillStyle = PAL.cream;
  const x = b.x, y = b.y;
  if (b.icon === 'pause') {
    ctx.fillRect(x + 6, y + 6, 4, 10);
    ctx.fillRect(x + 14, y + 6, 4, 10);
  } else if (b.icon === 'sound') {
    ctx.fillRect(x + 4, y + 8, 2, 6);                       // speaker
    for (let i = 0; i < 2; i++) ctx.fillRect(x + 6 + i * 2, y + 6 - i * 2, 2, 10 + i * 4);
    if (b.on) {
      ctx.fillRect(x + 14, y + 8, 2, 6);
      ctx.fillRect(x + 18, y + 6, 2, 10);
    } else {
      for (let i = 0; i < 3; i++) { ctx.fillRect(x + 13 + i * 2, y + 7 + i * 2, 2, 2); ctx.fillRect(x + 17 - i * 2, y + 7 + i * 2, 2, 2); }
    }
  }
}

function dim(ctx, r, alpha) {
  const { x0, x1, y0, y1 } = r.bounds;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.globalAlpha = 1;
}

function drawHud(ctx, g, now, r) {
  const run = g.run, text = r.night > 0.5 ? PAL.cream : PAL.ink;
  const flashing = now < g.flashUntil && Math.floor((g.flashUntil - now) / FLASH_MS) % 2 === 1;
  const score = flashing ? '     ' : pad(run.score);
  drawText(ctx, g.data.best ? `HI ${pad(g.data.best)}  ${score}` : score, VIEW_W / 2, 14, 2, text, 'center');

  // This run's eggs, top left; the icon hops on each pickup.
  const bump = now - g.eggBumpAt < BUMP_MS ? 2 : 0;
  ctx.drawImage(SPR.egg[0], 10, 12 - bump);
  drawText(ctx, String(run.eggCount), 28, 14, 2, text);

  if (g.screen !== 'playing') return;
  // First run only: faint jump and slide (duck) zones, until the first jump or 5 s (GDD 4).
  if (g.firstRun) {
    const alpha = hintAlpha(now, g.runStart, g.jumpedAt ?? g.runStart + HINT_MS);
    if (alpha > 0) {
      ctx.globalAlpha = alpha;
      arrow(ctx, VIEW_W / 2, 92, -1);
      drawText(ctx, 'JUMP', VIEW_W / 2, 136, 2, PAL.ink, 'center');
      ctx.globalAlpha = 1;
      slideHint(ctx, alpha);
    }
  }
  // Until the first slide: the slide zone again as the first pterodactyl comes,
  // for 2 s or until the player slides.
  if (g.slideHintAt !== null) {
    const end = Math.min(g.slideHintAt + SLIDE_HINT_MS, g.slidAt ?? Infinity);
    slideHint(ctx, hintAlpha(now, g.slideHintAt, end));
  }
}

// A hint fades in over 300 ms from `start` and out over 400 ms from `end`.
function hintAlpha(now, start, end) {
  return 0.7 * (now < end ? Math.min(1, (now - start) / 300) : Math.max(0, 1 - (now - end) / 400));
}

function slideHint(ctx, alpha) {
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  arrow(ctx, VIEW_W / 2, 330, 1);
  drawText(ctx, 'SLIDE', VIEW_W / 2, 272, 2, PAL.ink, 'center');
  ctx.globalAlpha = 1;
}

// A pixel arrow with its tip at (x, y), in 2 px art pixels; dir -1 points up, 1 down.
function arrow(ctx, x, y, dir) {
  ctx.fillStyle = PAL.ink;
  for (let i = 0; i < 5; i++) ctx.fillRect(x - 2 * i - 2, dir < 0 ? y + 2 * i : y - 2 * i - 2, 4 * i + 4, 2);
  ctx.fillRect(x - 4, dir < 0 ? y + 10 : y - 26, 8, 16);
}

function drawTitle(ctx, g, now) {
  const cx = VIEW_W / 2;
  drawText(ctx, 'DINOSAUR GAME', cx + 2, 30, 4, PAL.orange, 'center');
  drawText(ctx, 'DINOSAUR GAME', cx, 28, 4, PAL.ink, 'center');
  box(ctx, cx - 76, 66, 152, 24, PAL.ink, PAL.orange, '#C46A12');
  drawText(ctx, 'COOL EDITION', cx, 70, 2, PAL.cream, 'center');
  if (Math.floor(now / 600) % 2 === 0) drawText(ctx, 'SPACE, UP OR W TO START', cx, 156, 2, PAL.ink, 'center');
  if (g.data.best) drawText(ctx, `BEST ${g.data.best} M`, cx, 178, 2, PAL.ink, 'center');
}

function drawPause(ctx, r) {
  dim(ctx, r, 0.6);
  drawText(ctx, 'PAUSED', VIEW_W / 2, 80, 4, PAL.cream, 'center');
}

function drawResults(ctx, g, now) {
  if (now - g.crashAt < RESULTS_DELAY_MS) return;
  const x = 140, w = 360, y = panelY(g, now), cx = x + w / 2;
  box(ctx, x, y, w, PANEL_H, PAL.ink, PAL.slate, '#46546A');
  drawText(ctx, 'GAME OVER', cx, y + 12, 4, PAL.cream, 'center');
  const p = ease((now - g.crashAt - RESULTS_DELAY_MS - PANEL_MS) / COUNT_MS);
  drawText(ctx, `${Math.round(g.result * p)} M`, cx, y + 48, 4, PAL.cream, 'center');
  drawText(ctx, `BEST ${g.data.best} M`, cx, y + 84, 2, PAL.sand, 'center');

  // Eggs from this run count up, then the next hatch's progress (GDD 7.3).
  const eggs = Math.round(g.runEggs * p), label = `+${eggs} EGGS`;
  ctx.drawImage(SPR.egg[0], cx - 46, y + 102);
  drawText(ctx, label, cx - 30, y + 106, 2, PAL.cream);
  const next = HATCH.find(h => !g.data.unlocked.includes(h.id));
  if (next) {
    const bank = g.data.eggs - g.runEggs + eggs, fill = Math.min(1, bank / next.price);
    const text = bank >= next.price ? `${next.name}: ready to hatch!` : `${next.name}: ${bank} / ${next.price}`;
    drawText(ctx, text, cx, y + 128, 2, PAL.sand, 'center');
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(cx - 100, y + 148, 200, 8);
    ctx.fillStyle = PAL.orange;
    ctx.fillRect(cx - 98, y + 150, 2 * Math.round(98 * fill), 4);
  }
  if (g.newBest && p >= 1) {   // the banner bounces in once the count-up ends
    const t = (now - g.crashAt - RESULTS_DELAY_MS - PANEL_MS - COUNT_MS) / 400;
    const bounce = t < 1 ? 2 * Math.round(-Math.abs(Math.sin(t * Math.PI * 2)) * 4 * (1 - t)) : 0;
    box(ctx, x + w - 104, y - 14 + bounce, 118, 24, PAL.ink, PAL.orange, '#C46A12');
    drawText(ctx, 'NEW BEST!', x + w - 45, y - 9 + bounce, 2, PAL.cream, 'center');
  }
  const ready = now - g.crashAt >= RUN.restartLockMs;
  drawText(ctx, ready ? 'SPACE OR R TO RETRY' : 'R TO RETRY', cx, y + 220, 2, PAL.sand, 'center');
}

// One card per runner: the runner if unlocked, else its egg with the bank's
// progress towards its price. The focused card has a cream frame.
function drawRunners(ctx, g, now) {
  const d = g.data, cx = VIEW_W / 2;
  drawText(ctx, 'RUNNERS', cx + 2, 14, 4, PAL.orange, 'center');
  drawText(ctx, 'RUNNERS', cx, 12, 4, PAL.ink, 'center');
  const bank = String(d.eggs);   // the egg bank, top right
  ctx.drawImage(SPR.egg[0], VIEW_W - 34 - textWidth(bank, 2), 14);
  drawText(ctx, bank, VIEW_W - 16, 16, 2, PAL.ink, 'right');

  RUNNER_LIST.forEach((R, i) => {
    const x = cardX(i), y = CARD.y, mid = x + CARD.w / 2;
    if (i === g.pick) box(ctx, x - 4, y - 4, CARD.w + 8, CARD.h + 8, PAL.ink, PAL.cream, PAL.cream);
    box(ctx, x, y, CARD.w, CARD.h, PAL.ink, PAL.slate, '#46546A');
    if (d.unlocked.includes(R.id)) {
      const img = SPR.runners[R.id].jump;
      ctx.drawImage(img, mid - 22 - MARGIN, y + 14 + img.oy - MARGIN);
      if (d.equipped === R.id) drawText(ctx, 'EQUIPPED', mid, y + 84, 2, PAL.cream, 'center');
      return;
    }
    // A locked egg: it rocks now and then once there are enough eggs to hatch it.
    const egg = SPR.hatchEgg.stages[0], ready = d.eggs >= R.price, beat = Math.floor(now / 110) % 9;
    const rock = ready && beat < 3 ? [-2, 2, 0][beat] : 0;
    ctx.drawImage(egg, mid - 22 + rock - MARGIN, y + 10 - MARGIN);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x + 12, y + 70, 96, 8);
    ctx.fillStyle = PAL.orange;
    ctx.fillRect(x + 14, y + 72, 2 * Math.round(46 * Math.min(1, d.eggs / R.price)), 4);
    if (!ready) drawText(ctx, `${d.eggs}/${R.price}`, mid, y + 86, 2, PAL.cream, 'center');
  });

  const R = RUNNER_LIST[g.pick], open = d.unlocked.includes(R.id);
  const hint = open ? (d.equipped === R.id ? 'NOW RUNNING' : 'SPACE OR CLICK TO RUN WITH IT')
    : d.eggs >= R.price ? `HATCH IT FOR ${R.price} EGGS` : `${R.price - d.eggs} MORE EGGS TO HATCH IT`;
  drawText(ctx, R.name, cx, 182, 2, PAL.ink, 'center');
  drawText(ctx, hint, cx, 200, 2, PAL.ink, 'center');
}

// The hatch scene over the dimmed desert, alone so nothing gives the runner away (GDD 7.1, 9).
function drawHatch(ctx, g, now, r) {
  const h = g.hatch, t = now - h.at, cx = VIEW_W / 2, ground = 236;
  const E = SPR.hatchEgg, ex = cx - 22, ey = ground - 56;
  dim(ctx, r, 0.7);
  if (t < HATCH_MS.open) {
    // Wobbles harder up to the first crack, then a jolt on each crack.
    const step = HATCH_MS.crack.filter(c => t >= c).length;
    const k = step ? Math.max(0, 1 - (t - HATCH_MS.crack[step - 1]) / 200) : Math.min(1, t / HATCH_MS.crack[0]);
    ctx.drawImage(E.stages[step], grid(ex + Math.sin(t / 35) * 4 * k) - MARGIN, ey - MARGIN);
    return;
  }
  // Open: the top flies off in two halves, sparks burst, and the runner pops
  // out in a hop, landing in the bottom shell.
  const s = (t - HATCH_MS.open) / 1000;
  ctx.globalAlpha = Math.max(0, 1 - s / 0.8);
  for (const [img, dir] of [[E.left, -1], [E.right, 1]]) {
    ctx.drawImage(img, grid(ex + dir * 90 * s) - MARGIN, grid(ey - 220 * s + 500 * s * s) - MARGIN);
  }
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, d = 10 + 70 * Math.min(1, s * 2);
    ctx.fillStyle = i % 2 ? PAL.orange : PAL.cream;
    ctx.fillRect(grid(cx + Math.cos(a) * d), grid(ey + 20 + Math.sin(a) * d * 0.7), CELL, CELL);
  }
  ctx.globalAlpha = 1;
  const img = SPR.runners[h.id].jump, hop = Math.min(1, s / 0.45);
  // It stands in the bottom shell, its feet hidden by the shell's front.
  ctx.drawImage(img, cx - 22 - MARGIN, grid(ground - 61 - Math.sin(hop * Math.PI) * 40 + 20 * (1 - Math.min(1, s * 8))) + img.oy - MARGIN);
  ctx.drawImage(E.bottom, ex - MARGIN, ey - MARGIN);

  const pop = 2 * Math.round(-Math.abs(Math.sin(Math.min(1, s / 0.4) * Math.PI)) * 4);
  drawText(ctx, `${h.name}!`, cx, 70 + pop, 4, PAL.cream, 'center');
  drawText(ctx, 'HATCHED AND READY TO RUN', cx, 110, 2, PAL.sand, 'center');
  if (t >= HATCH_MS.done && Math.floor(now / 500) % 2 === 0) drawText(ctx, 'CLICK OR PRESS ANY KEY', cx, 280, 2, PAL.cream, 'center');
}

export function drawUI(ctx, g, now, r) {
  if (g.screen === 'title') drawTitle(ctx, g, now);
  else if (g.screen === 'runners') { if (!g.hatch) drawRunners(ctx, g, now); }
  else drawHud(ctx, g, now, r);
  if (g.screen === 'paused') drawPause(ctx, r);
  if (g.screen === 'complete') drawResults(ctx, g, now);
  for (const b of g.buttons) drawButton(ctx, b);
  if (g.hatch) drawHatch(ctx, g, now, r);
}
