// HUD and screens (GDD 8): title, pause, results and runners. layout() returns this
// frame's buttons, and main.js hit-tests pointers against the same list, so a
// sliding panel's buttons are always where they are drawn.
import { VIEW_W, VIEW_H, LANE, RACE, RUN, HATCH, RUNNER_LIST, FLIGHT } from './config.js';
import { drawText, textWidth } from './font.js';
import { PAL, SPR, MARGIN } from './sprites.js';
import { CELL } from './art.js';

export const RESULTS_DELAY_MS = 500;   // the panel slides up this long after the crash
export const FLIGHT_END_MS = 1800;     // "+N eggs" over the sky after a flight, then back
const FLIGHT_HINT_MS = 3000, GOLD_POP_MS = 400;
const PANEL_MS = 350, COUNT_MS = 700, FLASH_MS = 250, HINT_MS = 5000, SLIDE_HINT_MS = 2000, BUMP_MS = 150;
const PANEL_Y = 34, PANEL_H = 242;
const RACE_PANEL = { x: 199, w: 242, h: 190 };   // the race results panel, centered
const GOLD_C = '#F5C542';
const ease = t => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;
const pad = n => String(n).padStart(5, '0');
const grid = v => Math.round(v / CELL) * CELL;

// The Runners screen (GDD 8): pages of 2 rows of 4 cards, centered, clear of
// the treadmill runner below-left; arrows beside them turn the page.
const CARD = { w: 104, h: 96, gap: 8, cols: 4 };
export const PAGE = 2 * CARD.cols;
const GRID = { x: (VIEW_W - CARD.cols * (CARD.w + CARD.gap) + CARD.gap) / 2, y: 46 };
const GRID_H = 2 * CARD.h + CARD.gap;
export const pages = () => Math.ceil(RUNNER_LIST.length / PAGE);
const cardPos = i => [GRID.x + (i % CARD.cols) * (CARD.w + CARD.gap), GRID.y + Math.floor(i % PAGE / CARD.cols) * (CARD.h + CARD.gap)];
const onPage = g => RUNNER_LIST.map((R, i) => [R, i]).slice(Math.floor(g.pick / PAGE) * PAGE).slice(0, PAGE);
export const canHatch = (data, R) => R.price > 0 && !data.unlocked.includes(R.id) && data.eggs >= R.price;
// The hatch scene (GDD 7.1), in ms from the Hatch press: the egg wobbles,
// cracks 3 times, opens, and a press closes it once the runner has landed.
export const HATCH_MS = { crack: [700, 1100, 1500], open: 1900, done: 2500 };

// The golden egg beside the results panel (GDD 8): it stands on the sand and
// hops like an eager dog until clicked. Its hit box covers the whole hop.
const EGG_X = 570, EGG_SCALE = 4, EGG_POP_MS = 300;
const EGG_HIT = { x: EGG_X - 40, y: 140, w: 80, h: 116 };
const eggShownAt = g => g.crashAt + RESULTS_DELAY_MS + PANEL_MS;   // it pops in as the panel lands

function panelY(g, now) {
  return Math.round(VIEW_H + 10 - (VIEW_H + 10 - PANEL_Y) * ease((now - g.crashAt - RESULTS_DELAY_MS) / PANEL_MS));
}

// The pause and sound buttons sit in the top-right corner; their hit square is
// at least 64 CSS px, so pressing them never jumps (GDD 4).
function corner(id, r) {
  const hit = Math.max(40, r.logicalPx(64));
  return { id, icon: id, x: VIEW_W - 32, y: 8, w: 24, h: 24, hit: { x: VIEW_W - hit, y: 0, w: hit, h: hit } };
}

// 2P: the pause button sits top center, between the two players' HUDs (GDD 4).
function pauseCenter(r) {
  const hit = Math.max(40, r.logicalPx(64));
  return { id: 'pause', icon: 'pause', x: VIEW_W / 2 - 12, y: 6, w: 24, h: 24, hit: { x: VIEW_W / 2 - hit / 2, y: 0, w: hit, h: hit } };
}

// Race setup (GDD 8): each lane's runner between two arrows, its name and keys to the right.
const SETUP = { prev: 160, next: 256, text: 296 };

export function layout(g, now, r) {
  const B = [];
  if (g.screen === 'title') {
    B.push({ id: 'play', label: 'PLAY', size: 4, big: true, x: 250, y: 102, w: 140, h: 44 });
    B.push({ id: 'versus', label: '2 PLAYERS', size: 2, x: 250, y: 200, w: 140, h: 30 });
    B.push({ id: 'runners', label: 'RUNNERS', size: 2, x: 250, y: 238, w: 140, h: 30 });
    if (g.data.flights) B.push({ id: 'fly', label: `FLY ${g.data.flights}`, gold: true, size: 2, x: 250, y: 276, w: 140, h: 30 });
    B.push({ ...corner('sound', r), on: g.data.settings.sfx });
  } else if (g.screen === 'setup') {
    // Arrows beside each lane's runner; their hit square is 48 px (STANDARDS).
    for (const p of [0, 1]) {
      const y = LANE.top2P[p] + LANE.ground - 44;
      for (const [dir, x] of [[-1, SETUP.prev], [1, SETUP.next]]) {
        B.push({ id: 'pick', p, dir, icon: dir < 0 ? 'prev' : 'next', x, y, w: 24, h: 40, hit: { x: x - 12, y: y - 4, w: 48, h: 48 } });
      }
    }
    B.push({ id: 'race', label: 'RACE!', size: 4, big: true, x: 462, y: LANE.seam - 22, w: 150, h: 44 });
    B.push({ id: 'back', label: 'BACK', size: 2, x: 540, y: 8, w: 88, h: 30 });
  } else if (g.screen === 'racing') {
    B.push(pauseCenter(r));
  } else if (g.screen === 'complete' && g.mode === 'versus') {
    if (now - g.crashAt >= RESULTS_DELAY_MS) {
      const y = panelY(g, now);
      B.push({ id: 'retry', label: 'REMATCH', size: 2, big: true, x: 217, y: y + 146, w: 134, h: 32 });
      B.push({ id: 'menu', label: 'HOME', size: 2, x: 359, y: y + 146, w: 64, h: 32 });
    }
  } else if (g.screen === 'playing' || (g.screen === 'bonus' && !g.flightEndAt)) {
    B.push(corner('pause', r));
  } else if (g.screen === 'paused') {
    B.push({ id: 'resume', label: 'RESUME', size: 4, big: true, x: 224, y: 130, w: 192, h: 44 });
    B.push({ id: 'restart', label: 'RESTART', size: 2, x: 240, y: 182, w: 160, h: 30 });
    B.push({ id: 'menu', label: 'MENU', size: 2, x: 240, y: 218, w: 160, h: 30 });
  } else if (g.screen === 'complete' && now - g.crashAt >= RESULTS_DELAY_MS) {
    const y = panelY(g, now);
    B.push({ id: 'retry', label: 'RETRY', size: 2, big: true, x: 217, y: y + 172, w: 134, h: 32 });
    B.push({ id: 'menu', label: 'MENU', size: 2, x: 359, y: y + 172, w: 64, h: 32 });
    // A flight to take (this run's, or banked): the golden egg, beside the panel.
    if ((g.earned || g.data.flights) && now >= eggShownAt(g)) B.push({ id: 'fly', egg: true, ...EGG_HIT, eager: g.earned, count: g.data.flights });
  } else if (g.screen === 'runners' && !g.hatch) {
    for (const [R, i] of onPage(g)) {   // a Hatch button before its card, so it wins the hit test
      const [x, y] = cardPos(i);
      if (canHatch(g.data, R)) B.push({ id: 'hatch', i, label: 'HATCH', size: 2, big: true, x: x + 6, y: y + 60, w: 92, h: 30 });
      B.push({ id: 'card', i, card: true, x, y, w: CARD.w, h: CARD.h });
    }
    const page = Math.floor(g.pick / PAGE), ay = GRID.y + (GRID_H - 40) / 2;
    if (page > 0) B.push({ id: 'page', dir: -1, icon: 'prev', x: GRID.x - 32, y: ay, w: 24, h: 40 });
    if (page < pages() - 1) B.push({ id: 'page', dir: 1, icon: 'next', x: VIEW_W - GRID.x + 8, y: ay, w: 24, h: 40 });
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

function drawButton(ctx, b, now, g) {
  if (b.card) return;   // drawn by drawRunners
  if (b.egg) return drawFlyEgg(ctx, b, now, g);
  if (b.icon) return drawIcon(ctx, b);
  const [fill, lip] = b.gold ? [GOLD_C, '#C9932A'] : b.big ? [PAL.orange, '#C46A12'] : [PAL.slate, '#46546A'];
  box(ctx, b.x, b.y, b.w, b.h, PAL.ink, fill, lip);
  ctx.fillStyle = 'rgba(255,246,224,0.35)';
  ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 2);
  drawText(ctx, b.label, b.x + b.w / 2, b.y + 2 * Math.round((b.h - 4 - 7 * b.size) / 4), b.size, b.gold ? PAL.ink : PAL.cream, 'center');
}

// The golden egg asking to be clicked: quick hops with a squash on each
// landing and a stretch on takeoff, leaning toward the panel in the air, and
// every third hop an excited double hop. Calmer when the flight is a banked one.
function drawFlyEgg(ctx, b, now, g) {
  const img = SPR.goldEgg[Math.floor(now / 90) % 30 < 3 ? 1 : 0];
  const beatMs = b.eager ? 560 : 900, t = now - eggShownAt(g);
  const beat = Math.floor(t / beatMs), p = (t % beatMs) / beatMs;
  const double = b.eager && beat % 3 === 2;
  // Height: one hop over the first 60% of the beat (two smaller ones on a double), resting after.
  const hopH = b.eager ? 26 : 14;
  let lift = 0;
  if (double) lift = p < 0.3 ? Math.sin(p / 0.3 * Math.PI) * hopH * 0.6 : p < 0.6 ? Math.sin((p - 0.3) / 0.3 * Math.PI) * hopH * 0.8 : 0;
  else lift = p < 0.6 ? Math.sin(p / 0.6 * Math.PI) * hopH : 0;
  // Squash just after landing, stretch just before and after takeoff.
  const land = double ? Math.min(Math.abs(p - 0.3), Math.abs(p - 0.6)) : Math.abs(p - 0.6);
  const squash = lift === 0 || land < 0.06 ? Math.max(0, 1 - land / 0.1) * 0.22 : 0;
  const stretch = lift > 0 && lift < hopH * 0.5 ? 0.12 : 0;
  const pop = ease(t / EGG_POP_MS) + (t < EGG_POP_MS * 2 ? Math.sin(Math.min(1, t / (EGG_POP_MS * 2)) * Math.PI) * 0.15 : 0);
  const sx = EGG_SCALE * (1 + squash - stretch * 0.6) * pop, sy = EGG_SCALE * (1 - squash + stretch) * pop;
  const w = img.width * sx, h = img.height * sy, ground = 252;

  // A shadow on the sand, smaller the higher it hops.
  const shadow = Math.round((1 - lift / (hopH * 1.6)) * 22 * pop) * 2;
  ctx.fillStyle = 'rgba(27,35,64,0.25)';
  ctx.fillRect(grid(EGG_X - shadow / 2), ground - 2, shadow, 4);

  ctx.save();
  ctx.translate(EGG_X, grid(ground - lift));
  ctx.rotate(lift > 0 ? -0.18 * Math.min(1, lift / (hopH * 0.5)) : 0);   // leans toward the panel
  ctx.drawImage(img, -w / 2, -h + MARGIN * sy, w, h);
  ctx.restore();

  if (b.count > 1) {   // banked flights waiting: their number on a badge
    const label = String(b.count), bx = EGG_X + 18, by = grid(ground - lift) - 74;
    box(ctx, bx, by, textWidth(label, 2) + 12, 22, PAL.ink, PAL.cream, '#D8D2C0');
    drawText(ctx, label, bx + 6, by + 4, 2, PAL.ink);
  }
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
  } else {   // a page arrow, pointing left (prev) or right (next)
    const dir = b.icon === 'next' ? 1 : -1, cx = x + b.w / 2, cy = y + 16;
    for (let i = 0; i < 4; i++) ctx.fillRect(cx - dir * (2 * i - 3) - 1, cy - 2 * i, 2, 4 * i + 2);
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
  // The golden egg, popping in next to the count once grabbed (GDD 9).
  if (run.goldenTaken) {
    const t = Math.min(1, (now - g.goldAt) / GOLD_POP_MS), img = SPR.goldEgg[Math.floor(now / 90) % 30 < 3 ? 1 : 0];
    const k = t < 1 ? 1 + Math.sin(t * Math.PI) * 0.8 : 1, w = img.width * k, h = img.height * k;
    const x = 28 + textWidth(String(run.eggCount), 2) + 14;
    ctx.drawImage(img, x + (img.width - w) / 2, 10 + (img.height - h) / 2, w, h);
  }

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
  drawText(ctx, 'COOL DINO GAME', cx + 2, 30, 4, PAL.orange, 'center');
  drawText(ctx, 'COOL DINO GAME', cx, 28, 4, PAL.ink, 'center');
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
  const hint = g.earned ? (ready ? 'SPACE TO FLY, R TO RETRY' : 'R TO RETRY') : ready ? 'SPACE OR R TO RETRY' : 'R TO RETRY';
  drawText(ctx, hint, cx, y + 220, 2, PAL.sand, 'center');
}

// One card per runner on the page: the runner if unlocked; else its egg, or
// for an achievement its silhouette, with a progress bar and the price or goal.
// The focused card has a cream frame.
function drawRunners(ctx, g, now) {
  const d = g.data, cx = VIEW_W / 2;
  drawText(ctx, 'RUNNERS', cx + 2, 14, 4, PAL.orange, 'center');
  drawText(ctx, 'RUNNERS', cx, 12, 4, PAL.ink, 'center');
  const bank = String(d.eggs);   // the egg bank, top right
  ctx.drawImage(SPR.egg[0], VIEW_W - 34 - textWidth(bank, 2), 14);
  drawText(ctx, bank, VIEW_W - 16, 16, 2, PAL.ink, 'right');

  for (const [R, i] of onPage(g)) {
    const [x, y] = cardPos(i), mid = x + CARD.w / 2;
    if (i === g.pick) box(ctx, x - 4, y - 4, CARD.w + 8, CARD.h + 8, PAL.ink, PAL.cream, PAL.cream);
    box(ctx, x, y, CARD.w, CARD.h, PAL.ink, PAL.slate, '#46546A');
    if (d.unlocked.includes(R.id) || g.peek) {
      // 1.5× (each art pixel 3×3 px) and centered in the card's face, above the lip.
      const img = SPR.runners[R.id].jump, w = 1.5 * img.width, h = 1.5 * img.height;
      ctx.drawImage(img, mid - w / 2, y + 2 + Math.floor((CARD.h - 8 - h) / 2), w, h);
      continue;
    }
    let fill, label;
    if (R.goal) {   // an achievement runner: its silhouette and its goal
      ctx.drawImage(SPR.runners[R.id].shadow, mid - 24, y + 10);
      fill = R.progress(d) / R.target;
      label = R.label;
    } else {        // an egg: it rocks now and then once there are enough eggs to hatch it
      const ready = d.eggs >= R.price, beat = Math.floor(now / 110) % 9;
      const rock = ready && beat < 3 ? [-2, 2, 0][beat] : 0;
      ctx.drawImage(SPR.hatchEgg.stages[0], mid - 24 + rock, y + 4);
      fill = d.eggs / R.price;
      label = ready ? '' : String(R.price);
    }
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x + 8, y + 66, 88, 8);
    ctx.fillStyle = PAL.orange;
    ctx.fillRect(x + 10, y + 68, 2 * Math.round(42 * Math.min(1, fill)), 4);
    if (!label) continue;
    const egg = !R.goal, w = textWidth(label, 2) + (egg ? 18 : 0), left = mid - w / 2;
    if (egg) ctx.drawImage(SPR.egg[0], left, y + 74);
    drawText(ctx, label, left + w, y + 76, 2, PAL.cream, 'right');
  }

  const R = RUNNER_LIST[g.pick], open = d.unlocked.includes(R.id);
  const hint = open ? (d.equipped === R.id ? '' : 'SPACE OR CLICK TO RUN WITH IT')
    : R.goal ? R.goal : d.eggs >= R.price ? `HATCH IT FOR ${R.price} EGGS` : '';
  drawText(ctx, R.name, cx, GRID.y + GRID_H + 10, 2, PAL.ink, 'center');
  drawText(ctx, hint, cx, GRID.y + GRID_H + 28, 2, PAL.ink, 'center');
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

// The bonus flight (GDD 8): the 20 s bar instead of the score, the eggs top
// left, "hold to fly up" on the first flight, and "+N eggs" at the end.
function drawFlightHud(ctx, g, now) {
  const f = g.flight, cx = VIEW_W / 2;
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(cx - 102, 14, 204, 12);
  ctx.fillStyle = GOLD_C;
  ctx.fillRect(cx - 100, 16, 2 * Math.round(100 * f.timeLeft / (FLIGHT.frames / 60)), 8);
  const bump = now - g.eggBumpAt < BUMP_MS ? 2 : 0;
  ctx.drawImage(SPR.egg[0], 10, 12 - bump);
  drawText(ctx, String(f.eggCount), 28, 14, 2, PAL.ink);

  if (g.flightHint) {
    const alpha = hintAlpha(now, g.runStart, g.runStart + FLIGHT_HINT_MS);
    if (alpha > 0) {
      ctx.globalAlpha = alpha;
      arrow(ctx, cx, 120, -1);
      drawText(ctx, 'HOLD TO FLY UP', cx, 164, 2, PAL.ink, 'center');
      ctx.globalAlpha = 1;
    }
  }
  if (g.flightEndAt) {
    const t = now - g.flightEndAt, p = ease(t / COUNT_MS);
    const label = `+${Math.round(f.eggCount * p)} EGGS`, w = textWidth(label, 4) + 28, left = cx - w / 2;
    const pop = 2 * Math.round(-Math.abs(Math.sin(Math.min(1, t / 400) * Math.PI)) * 4);
    box(ctx, cx - 184, 76, 368, 100, PAL.ink, PAL.slate, '#46546A');
    drawText(ctx, f.result === 'complete' ? 'WHAT A FLIGHT!' : 'OOF!', cx, 90 + pop, 4, PAL.cream, 'center');
    ctx.drawImage(SPR.egg[0], left, 146);
    drawText(ctx, label, left + 28, 142, 4, PAL.cream);
  }
}

// ---- the 2P race (GDD 4, 8) ----------------------------------------------------------------
const P_COLORS = [PAL.orange, '#2E9C9C'];   // P1 orange, P2 teal; always with the P1 / P2 label

// A player's label: plain text in the title's style, `color` with a drop
// shadow in the player's color. No box, so it never looks like a button.
function tag(ctx, p, x, y, color, size = 2) {
  const label = `P${p + 1}`;
  drawText(ctx, label, x + size, y + size, size, P_COLORS[p]);
  drawText(ctx, label, x, y, size, color);
}

// A pixel trophy, 7x7 cells of `k` px, with a 1 art pixel (k px) Night Ink outline like the sprites.
const TROPHY = ['1111111', '1011101', '1011101', '0111110', '0011100', '0001000', '0011100'];
function trophy(ctx, x, y, k = 2) {
  const cells = (ox, oy, color) => {
    ctx.fillStyle = color;
    TROPHY.forEach((row, j) => [...row].forEach((c, i) => { if (c === '1') ctx.fillRect(x + ox + i * k, y + oy + j * k, k, k); }));
  };
  for (const ox of [-k, 0, k]) for (const oy of [-k, 0, k]) if (ox || oy) cells(ox, oy, PAL.ink);
  cells(0, 0, GOLD_C);
}

function drawSetup(ctx, g) {
  const d = g.data;
  drawText(ctx, '2 PLAYERS', VIEW_W / 2 + 2, 14, 4, PAL.orange, 'center');
  drawText(ctx, '2 PLAYERS', VIEW_W / 2, 12, 4, PAL.ink, 'center');
  const keys = ['A / D TO CHANGE   W JUMP   S SLIDE', 'LEFT / RIGHT TO CHANGE   UP JUMP   DOWN SLIDE'];
  for (const p of [0, 1]) {
    const top = LANE.top2P[p] - 10;
    tag(ctx, p, 16, top + 50, PAL.ink, 4);
    const R = RUNNER_LIST.find(R => R.id === (p ? d.p2Runner : d.equipped));
    drawText(ctx, R.name, SETUP.text, top + 104, 2, PAL.ink);
    drawText(ctx, keys[p], SETUP.text, top + 124, 1, PAL.ink);
  }
}

function drawRaceHud(ctx, g, now, r) {
  const text = r.night > 0.5 ? PAL.cream : PAL.ink;
  for (const p of [0, 1]) {
    const run = g.runs[p], top = p ? LANE.seam + 6 : 4;
    tag(ctx, p, 10, top + 4, text);
    trophy(ctx, 40, top + 4);
    drawText(ctx, String(g.tally[p ? 'p2' : 'p1']), 60, top + 4, 2, text);
    drawText(ctx, pad(run.score), VIEW_W - 12, top + 8, 2, text, 'right');
  }
  if (g.screen !== 'racing') return;
  // The touch zones: P1 the left half, P2 the right, the bottom third ducks (GDD 4).
  const alpha = hintAlpha(now, g.raceAt, g.goAt + RACE.hintMs);
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha * 0.6;
  ctx.fillStyle = PAL.ink;
  for (let y = 40; y < VIEW_H; y += 12) ctx.fillRect(VIEW_W / 2 - 1, y, 2, 6);
  ctx.globalAlpha = alpha;
  for (const p of [0, 1]) {
    const cx = p ? VIEW_W * 3 / 4 : VIEW_W / 4;
    drawText(ctx, `P${p + 1}`, cx, 50, 4, PAL.ink, 'center');
    arrow(ctx, cx - 30, 92, -1);
    drawText(ctx, p ? 'UP' : 'W', cx + 10, 100, 2, PAL.ink);
    arrow(ctx, cx - 30, 340, 1);
    drawText(ctx, p ? 'DOWN' : 'S', cx + 10, 318, 2, PAL.ink);
  }
  ctx.globalAlpha = 1;
}

// Race results (GDD 8): the winner (or a draw), the winner's distance, and
// the tally kept until Home, between the two players' tags.
function drawRaceResults(ctx, g, now) {
  if (now - g.crashAt < RESULTS_DELAY_MS) return;
  const { x, w, h } = RACE_PANEL, y = panelY(g, now), cx = x + w / 2, win = g.winner;
  box(ctx, x, y, w, h, PAL.ink, PAL.slate, '#46546A');
  drawText(ctx, win === 'draw' ? 'DRAW!' : `${win.toUpperCase()} WINS!`, cx, y + 12, 4, PAL.cream, 'center');
  const p = ease((now - g.crashAt - RESULTS_DELAY_MS - PANEL_MS) / COUNT_MS);
  drawText(ctx, `${Math.round(g.result * p)} M`, cx, y + 48, 4, PAL.cream, 'center');
  tag(ctx, 0, cx - 100, y + 110, PAL.cream, 3);
  tag(ctx, 1, cx + 66, y + 110, PAL.cream, 3);
  drawText(ctx, `${g.tally.p1} - ${g.tally.p2}`, cx, y + 110, 3, PAL.cream, 'center');
}

export function drawUI(ctx, g, now, r) {
  if (g.mode === 'versus' && g.screen !== 'runners') {
    if (g.screen === 'setup') drawSetup(ctx, g);
    else drawRaceHud(ctx, g, now, r);
    if (g.screen === 'paused') drawPause(ctx, r);
    if (g.screen === 'complete') drawRaceResults(ctx, g, now);
    for (const b of g.buttons) drawButton(ctx, b, now, g);
    return;
  }
  const flying = g.screen === 'bonus' || (g.screen === 'paused' && g.pausedFrom === 'bonus');
  if (flying) drawFlightHud(ctx, g, now);
  else if (g.screen === 'title') drawTitle(ctx, g, now);
  else if (g.screen === 'runners') { if (!g.hatch) drawRunners(ctx, g, now); }
  else drawHud(ctx, g, now, r);
  if (g.screen === 'paused') drawPause(ctx, r);
  if (g.screen === 'complete') drawResults(ctx, g, now);
  for (const b of g.buttons) drawButton(ctx, b, now, g);
  if (g.hatch) drawHatch(ctx, g, now, r);
}
