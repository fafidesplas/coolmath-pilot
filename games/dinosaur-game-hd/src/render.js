// The scene (GDD 3.1, 9): sky, parallax layers, ground, obstacles and runner.
// Everything is drawn straight onto the display canvas through a scale
// transform, so positions interpolated between 60 Hz steps land on device
// pixels and 144 Hz screens don't judder. The layers are pre-rendered once.
import { VIEW_W, VIEW_H, LANE, RUN, RUNNER, RUNNER_BOXES, OBSTACLES, ANIM, EGGS, RUNNER_IDS, FLIGHT } from './config.js';
import { drawText } from './font.js';
import { mulberry32 } from './gen.js';
import { SPR, PAL, MARGIN, up } from './sprites.js';
import { CELL } from './art.js';
import { drawUI } from './ui.js';

const GROUND = LANE.top1P + LANE.ground;   // 250
const SKY_DAY = ['#FFEFC9', '#FFE6B0', '#FDDA97', '#FBCB80', '#F8B96A', '#F5A55A'];
const SKY_NIGHT = ['#0F1530', '#141B3A', '#1B2340', '#222B4D', '#2B355C', '#36406A'];
const NIGHT_TINT = 0.55;       // Night Ink over the background layers at night
const SHAKE_MS = 150, SHAKE_PX = 4;
export const FX_MS = 500;                  // egg pickup pop and "+1"
const born = new WeakMap();                // when an egg that starts inside the view was first drawn
const grid = v => Math.round(v / CELL) * CELL;   // snapped to the art pixel grid
const ease = t => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// The background layers are drawn at art resolution (1 px per art pixel,
// half the logical size) and scaled up CELL times, so they are as chunky as
// the sprites. A = art px; W, H, GA = the view width, height and ground in art px.
const W = VIEW_W / CELL, H = VIEW_H / CELL, GA = GROUND / CELL;

// Stepped bands, top to bottom: the 16-bit look of a gradient.
function bands(h, colors) {
  const [c, g] = canvas(1, h), bh = h / colors.length;
  colors.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, Math.round(i * bh), 1, Math.ceil(bh)); });
  return up(c);
}

function disc(r, fill, rim) {
  const [c, g] = canvas(r * 2, r * 2);
  for (let y = 0; y < r * 2; y++) {
    const half = Math.round(Math.sqrt(r * r - (y + 0.5 - r) ** 2));
    g.fillStyle = rim; g.fillRect(r - half, y, half * 2, 1);
    g.fillStyle = fill; g.fillRect(r - half + 1, y, Math.max(0, half * 2 - 2), 1);
  }
  return [c, g];
}

function tinted(src) {
  const [c, g] = canvas(src.width, src.height);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = NIGHT_TINT;
  g.fillStyle = PAL.ink;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

function buildLayers() {
  const rand = mulberry32(7);
  const L = { skyDay: bands(GA, SKY_DAY), skyNight: bands(GA, SKY_NIGHT) };

  // Stars, a 640 px tile over the sky.
  {
    const [c, g] = canvas(W, 100);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = i % 5 ? 'rgba(255,246,224,0.7)' : PAL.cream;
      const x = Math.floor(rand() * W), y = Math.floor(rand() * 100);
      if (i % 9) g.fillRect(x, y, 1, 1);
      else { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }   // a bright one: a little cross
    }
    L.stars = up(c);
  }
  L.sun = up(disc(11, '#FFF1C2', '#FDD27E')[0]);
  {
    const [moon, g] = disc(7, PAL.cream, '#D8D2C0');
    g.fillStyle = '#E4DDC8';
    g.fillRect(4, 4, 2, 2); g.fillRect(8, 8, 3, 2); g.fillRect(6, 10, 2, 2);
    L.moon = up(moon);
  }

  // Clouds (0.05×), a 640×60 tile with its top at y = 24.
  {
    const [c, g] = canvas(W, 30);
    g.fillStyle = 'rgba(255,246,224,0.85)';
    for (const [x, y, w] of [[15, 15, 28], [95, 4, 20], [165, 18, 35], [235, 7, 24], [290, 20, 18]]) {
      g.fillRect(x, y + 3, w, 3);
      g.fillRect(x + 3, y + 1, w - 8, 2);
      g.fillRect(x + Math.round(w * 0.3), y, Math.round(w * 0.3), 1);
    }
    L.clouds = up(c); L.cloudsN = tinted(L.clouds);
  }

  // Mountains (0.1×), a 640×110 tile resting on the ground: flat-topped mesas and rounded hills
  // of different heights. Each is [kind, x, width, height] in half-size pixels.
  {
    const [c, g] = canvas(W, 55);
    const LIGHT = '#E39A57', TOP = '#EDB073', SHADE = '#CF844A';
    const shapes = [
      ['mesa', 10, 54, 35], ['hill', 72, 46, 48], ['hill', 108, 44, 30], ['mesa', 156, 60, 40],
      ['hill', 208, 40, 52], ['hill', 250, 38, 34], ['hill', 292, 26, 28],
    ];
    for (const [kind, x, w, h] of shapes) {
      for (let row = 0; row < h; row++) {
        const y = 55 - h + row;
        if (kind === 'mesa') {
          const grow = Math.floor(row / 3);
          g.fillStyle = row < 2 ? TOP : LIGHT;
          g.fillRect(x - grow, y, w + grow * 2, 1);
          g.fillStyle = SHADE;
          g.fillRect(x + w + grow - 4, y, 4, 1);
        } else {
          // a rounded hill, between a mesa and a peak
          const cx = x + Math.floor(w / 2), t = (row + 0.5) / h;
          const half = Math.round((w / 2) * Math.pow(t, 0.55));
          const l = cx - half, r = cx + half + 1;
          g.fillStyle = row < 2 ? TOP : LIGHT;
          g.fillRect(l, y, r - l, 1);
          const split = cx + Math.round(half * 0.2);   // the shaded side, a smooth diagonal
          if (row >= 3) { g.fillStyle = SHADE; g.fillRect(split, y, r - split, 1); }
        }
      }
    }
    L.mesas = up(c); L.mesasN = tinted(L.mesas);
  }

  // Dunes (0.2×), a 640×50 tile resting on the ground; the curve repeats every 640 px.
  {
    const [c, g] = canvas(W, 25);
    for (let x = 0; x < W; x++) {
      const h = Math.round(10 + 4.5 * Math.sin(x / W * Math.PI * 6) + 3 * Math.sin(x / W * Math.PI * 10 + 1));
      g.fillStyle = '#EDBE6E'; g.fillRect(x, 25 - h, 1, h);
      g.fillStyle = '#F6D592'; g.fillRect(x, 25 - h, 1, 1);
    }
    L.dunes = up(c); L.dunesN = tinted(L.dunes);
  }

  // Ground (1×): sand with pebbles, a 640×110 tile from the ground line down.
  {
    const [c, g] = canvas(W, H - GA);
    g.fillStyle = PAL.sand; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#B07A3A'; g.fillRect(0, 0, c.width, 1);
    g.fillStyle = '#D7A458'; g.fillRect(0, 1, c.width, 1);
    for (let i = 0; i < 60; i++) {
      const x = Math.floor(rand() * W), y = 3 + Math.floor(rand() * (c.height - 4));
      g.fillStyle = i % 4 ? '#D7A458' : '#B07A3A';
      g.fillRect(x, y, i % 3 ? 1 : 2, 1);
    }
    for (let i = 0; i < 12; i++) {   // bumps on the ground line
      g.fillStyle = '#B07A3A';
      g.fillRect(Math.floor(rand() * W), 1, 1 + Math.floor(rand() * 2), 1);
    }
    L.ground = up(c); L.groundN = tinted(L.ground);
  }
  return L;
}

// Sand kicked up by the slide (GDD 9 juice): a burst along the belly when it
// starts, a trail from the tail and the whole belly while it lasts; a puff out both sides of the feet on takeoff and landing; a
// little kick at each footfall of the run. A fixed pool, so nothing is
// allocated per frame.
const DUST_MAX = 128, DUST_COLORS = ['#FFF6E0', '#FBE3B0', '#C99A55'], DUST_NIGHT = ['#A9A08A', '#8C8471', '#6B6556'];
const BELLY_X0 = 8, BELLY_X1 = 40;   // the slide's belly on the sand, from the runner's x
class Dust {
  constructor() {
    this.p = Array.from({ length: DUST_MAX }, () => ({ on: false, front: false, big: 0, cloud: false, s: 1, ln: 0, lx: [0, 0, 0, 0], lr: [1, 1, 1, 1], x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, c: 0 }));
    this.next = 0;
    this.carry = 0;
    this.n = 0;
  }

  // One puff at the tail. scroll: the ground's speed in px/s.
  emit(scroll, kick, cloud = false) {
    const d = this.p[this.next];
    this.next = (this.next + 1) % DUST_MAX;
    d.on = true;
    d.front = false;
    d.big = 0;
    d.cloud = cloud;
    d.s = 1;
    if (cloud) this.shape(d);   // slide puffs are clouds; the run, takeoff and landing keep the old square sand
    d.x = RUNNER.x + 2 + Math.random() * 10;
    d.y = GROUND - 2 - Math.random() * 3;
    d.vx = -scroll * (0.25 + Math.random() * 0.35) - Math.random() * 40 * kick;
    d.vy = -(15 + Math.random() * 45) * kick;
    d.age = 0;
    d.life = 0.3 + Math.random() * 0.25;
    d.c = Math.floor(Math.random() * DUST_COLORS.length);
  }

  // Every cloud gets its own look: a size, and 2 to 4 lobes (offset and radius,
  // both in units of the cloud's radius), so no two puffs match.
  shape(d) {
    d.s = 0.7 + Math.random() * 0.7;
    d.ln = 2 + Math.floor(Math.random() * 3);
    d.lx[0] = 0; d.lr[0] = 1;
    for (let i = 1; i < d.ln; i++) {
      d.lx[i] = (Math.random() * 2 - 1) * 1.4;
      d.lr[i] = 0.45 + Math.random() * 0.5;
    }
  }

  burst(n, scroll, kick) {
    for (let i = 0; i < n; i++) {
      this.emit(scroll, kick, true);
      if (i % 2) this.belly(this.last);
    }
  }

  get last() { return this.p[(this.next + DUST_MAX - 1) % DUST_MAX]; }

  // Takeoff or landing: n puffs spread forward and back from the feet, low and quick.
  feet(n, scroll) {
    for (let i = 0; i < n; i++) {
      this.emit(scroll, 1.2);
      const d = this.last, side = i % 2 ? 1 : -1;
      d.x = RUNNER.x + 22 + side * (4 + Math.random() * 8);
      d.vx = -scroll * 0.3 + side * (30 + Math.random() * 50);
      d.life = 0.25 + Math.random() * 0.2;
    }
  }

  // A footfall of the run: a few puffs kicked back from the planted foot (x).
  // Every other puff is drawn in front of the runner, over its feet.
  step(x, scroll) {
    for (let i = 0; i < 4; i++) {
      this.emit(scroll, 0.5 + Math.random() * 0.3);
      const d = this.last;
      d.x = RUNNER.x + x + Math.random() * 8 - 2;
      d.life = 0.15 + Math.random() * 0.2;
      d.s = 1 - 0.5 * Math.min(1, Math.max(0, (d.x - RUNNER.x - 13) / 10));   // smaller toward the front foot
      if (i % 2) {
        d.front = true;
        d.y = GROUND - Math.random() * 3;
        d.vy *= 0.5;
      }
    }
  }

  // While sliding: puffs from the tail, and more along the whole belly
  // dragging on the sand (2 of every 3 puffs).
  trail(dt, scroll) {
    this.carry += dt * 120;
    while (this.carry >= 1) {
      this.carry--;
      if (++this.n % 3 === 0) { this.emit(scroll, 0.6, true); continue; }
      this.emit(scroll, 0.5, true);
      this.belly(this.last);
    }
  }

  // Moves a puff under the belly. Belly puffs are drawn in front of the
  // runner, so the sand sprays over the belly's lower edge.
  belly(d) {
    d.front = true;
    d.big = 1;   // belly clouds are bigger: they hide the legs
    d.s = 0.85 + Math.random() * 0.4;   // but varied less, so the legs stay hidden
    d.x = RUNNER.x + BELLY_X0 + Math.random() * (BELLY_X1 - BELLY_X0);
    d.s *= 1 - 0.55 * (d.x - RUNNER.x - BELLY_X0) / (BELLY_X1 - BELLY_X0);   // smaller toward the head
    d.y = GROUND + 3 - Math.random() * 2;   // starts on the sand line, at the feet
    d.vy *= 0.4;                           // and rises only a little
    d.vx -= Math.random() * 30;
    d.life = 0.3 + Math.random() * 0.25;
  }

  update(dt) {
    for (const d of this.p) {
      if (!d.on) continue;
      d.age += dt;
      if (d.age >= d.life) { d.on = false; continue; }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 120 * dt;   // settles back down
      const floor = d.big ? GROUND + 3 : GROUND - 1;
      if (d.y > floor) d.y = floor;
    }
  }

  // front: the belly puffs, drawn over the runner; otherwise the rest, under it.
  draw(ctx, night, front) {
    const colors = night > 0.5 ? DUST_NIGHT : DUST_COLORS;
    for (const d of this.p) {
      if (!d.on || d.front !== front) continue;
      if (!d.cloud) {   // the old sand: a fading square, 2 to 4 art px
        const t = d.age / d.life, size = CELL * Math.max(1, Math.round((2 + t * 2) * d.s));
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = colors[d.c];
        ctx.fillRect(grid(d.x - size / 2), grid(d.y - size), size, size);
        continue;
      }
      // A cloud: a round body with 1 to 3 bumps and a flat bottom on the sand, growing as it
      // fades (belly clouds 3 to 4 art px radius, about leg height). Lit from the top:
      // light on top, a mid tone, and shadow on the underside and the right edge.
      const t = d.age / d.life, R = ((d.big ? 3 : 2) + t * (d.big ? 1.3 : 2.5)) * d.s;
      const bx = grid(d.x), by = grid(d.y);
      ctx.globalAlpha = Math.min(1, (1 - t) * (d.big ? 2.2 : 1.6));
      let top = 0;
      for (let i = 0; i < d.ln; i++) top = Math.max(top, Math.ceil(2 * Math.max(1, d.lr[i] * R)));
      for (let j = 0; j < top; j++) {   // rows from the bottom up
        let lo = 1e9, hi = -1e9;
        for (let i = 0; i < d.ln; i++) {
          const r = Math.max(1, d.lr[i] * R), dy = j + 0.5 - r;
          if (Math.abs(dy) > r) continue;
          const hw = Math.sqrt(r * r - dy * dy), cx = d.lx[i] * R;
          lo = Math.min(lo, Math.round(cx - hw)); hi = Math.max(hi, Math.round(cx + hw));
        }
        if (hi <= lo) continue;
        const x = bx + lo * CELL, y = by - (j + 1) * CELL, w = (hi - lo) * CELL;
        ctx.fillStyle = j === 0 ? colors[2] : j >= top * 0.45 ? colors[0] : colors[1];
        ctx.fillRect(x, y, w, CELL);
        if (j > 0 && j <= top * 0.6 && hi - lo >= 3) {   // the shaded right edge
          ctx.fillStyle = j <= 1 ? colors[2] : colors[1];   // darkest only near the bottom
          ctx.fillRect(x + w - CELL, y, CELL, CELL);
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}

const SETUP_RUNNER_X = 200;   // race setup: each lane's runner, between its arrows
const SQUASH_MS = 50, SQUASH = [[6, 6], [2, 2]];   // per frame: extra width, lost height (px)
const STRETCH = [[-8, -10], [-4, -5], [-2, -2]];      // takeoff: narrower and taller, one frame longer

export class Renderer {
  constructor(cv) {
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    this.L = buildLayers();
    this.night = 0;          // 0 day … 1 night, faded over 1 s (GDD 3.6)
    // Per lane (1P uses lane 0): its dust, and when its runner last landed
    // and took off (the squash and stretch).
    this.fx = [0, 1].map(() => ({ dust: new Dust(), landAt: -1e9, jumpAt: -1e9 }));
    this.cur = this.fx[0];   // the lane being drawn
    this.bounds = { x0: 0, x1: VIEW_W, y0: 0, y1: VIEW_H };
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  // Largest integer scale that fills at least 85% of the window; otherwise the
  // exact fit (GDD 12). The rest of the window shows more sky and sand.
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.cv.width = Math.round(innerWidth * dpr);
    this.cv.height = Math.round(innerHeight * dpr);
    const fit = Math.min(this.cv.width / VIEW_W, this.cv.height / VIEW_H);
    const whole = Math.floor(fit);
    this.s = whole >= 1 && whole / fit >= 0.85 ? whole : fit;
    this.ox = Math.floor((this.cv.width - VIEW_W * this.s) / 2);
    this.oy = Math.floor((this.cv.height - VIEW_H * this.s) / 2);
  }

  toLogical(clientX, clientY) {
    const r = this.cv.getBoundingClientRect();
    return [((clientX - r.left) * this.dpr - this.ox) / this.s, ((clientY - r.top) * this.dpr - this.oy) / this.s];
  }

  // CSS pixels to logical pixels (touch target sizes).
  logicalPx(css) { return css * this.dpr / this.s; }

  snap(v) { return Math.round(v * this.s) / this.s; }

  get dust() { return this.fx[0].dust; }

  resetNight() { this.night = 0; }

  draw(g, now, dt) {
    // The Runners screen hides the run: the runner runs on a treadmill instead.
    const { ctx, s } = this, menu = g.screen === 'runners';
    const flying = !!g.flight && (g.screen === 'bonus' || g.screen === 'paused');
    const run = menu || flying ? null : g.run;
    const target = run?.night ? 1 : 0;
    this.night += Math.max(-dt, Math.min(dt, target - this.night));

    let sx = 0, sy = 0;
    if (now < g.shakeUntil) {
      const k = (g.shakeUntil - now) / SHAKE_MS * SHAKE_PX;
      sx = Math.round((Math.random() * 2 - 1) * k); sy = Math.round((Math.random() * 2 - 1) * k);
    }
    const ox = this.ox + sx * s, oy = this.oy + sy * s;
    ctx.setTransform(s, 0, 0, s, ox, oy);
    ctx.imageSmoothingEnabled = false;
    const b = this.bounds;
    b.x0 = -ox / s; b.x1 = (this.cv.width - ox) / s; b.y0 = -oy / s; b.y1 = (this.cv.height - oy) / s;

    if (flying) return this.drawFlight(g, now, dt);
    if (g.mode === 'versus' && g.screen !== 'runners') return this.drawRace(g, now, dt);
    this.cur = this.fx[0];
    const a = g.alpha, lerp = (p, c) => p + (c - p) * a;
    const scroll = run ? lerp(run.prevScrollPx, run.scrollPx) : menu ? Math.max(0, now - g.screenAt) * RUN.speed * 60 / 1000 : 0;
    this.drawBackground(scroll, now);

    if (run) {
      for (const o of run.obstacles) this.drawObstacle(o, this.snap(lerp(o.prevX, o.x)), g.showBoxes);
      for (const e of run.eggs) if (!e.taken) this.drawEgg(e, this.snap(lerp(e.prevX, e.x)), now);
      const gold = run.golden;
      if (gold && !gold.taken) this.drawGold(this.snap(lerp(gold.prevX, gold.x)), LANE.top1P + gold.y, now);
    }
    const y = run ? this.snap(lerp(run.prevY, run.y)) : LANE.ground - RUNNER.height;
    if (g.screen !== 'paused') this.dust.update(dt);
    this.dust.draw(ctx, this.night, false);
    const focus = RUNNER_IDS[g.pick], shown = menu && (g.data.unlocked.includes(focus) || g.peek) ? focus : g.data.equipped;
    if (!(menu && g.hatch)) this.drawRunner(SPR.runners[shown], menu ? { timeMs: Math.max(0, now - g.screenAt) } : run, y, now, g.showBoxes && !menu);
    this.dust.draw(ctx, this.night, true);
    this.drawPickups(g.fx, now);
    if (g.goldFx && run) this.drawGoldBurst(g.goldFx, now);

    drawUI(ctx, g, now, this);
  }

  // ---- the golden egg (GDD 3.7, 9) -------------------------------------------------------------
  // A gold egg that wobbles, with a white sparkle twinkling around it.
  drawGold(x, y, now) {
    const ctx = this.ctx, bob = Math.sin(now / 200) > 0.2 ? -CELL : 0;
    const img = SPR.goldEgg[(now / 90) % 30 < 3 ? 1 : 0];
    this.rim(img, x, y + bob, 1);
    this.sprite(img, x, y + bob);
    const k = Math.floor(now / 160) % 4, sx = grid(x + [-6, 16, 14, -4][k]), sy = grid(y + bob + [-4, 0, 14, 10][k]);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(sx, sy - CELL, CELL, CELL * 3);
    ctx.fillRect(sx - CELL, sy, CELL * 3, CELL);
  }

  // Grabbed: 12 gold and white sparks fly out (GDD 9).
  drawGoldBurst(f, now) {
    const t = (now - f.t) / 700, ctx = this.ctx;
    if (t >= 1) return;
    ctx.globalAlpha = 1 - t;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, d = 6 + 40 * ease(t);
      ctx.fillStyle = i % 2 ? '#F5C542' : '#FFFFFF';
      ctx.fillRect(grid(f.x + Math.cos(a) * d), grid(f.y + Math.sin(a) * d), CELL * 2, CELL * 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---- the bonus flight (GDD 3.8, 9) -----------------------------------------------------------
  // The same desert seen from higher up: the whole background 50 px lower.
  drawFlight(g, now, dt) {
    const { ctx } = this, f = g.flight, b = this.bounds, a = g.alpha, lerp = (p, c) => p + (c - p) * a;
    const scroll = this.snap(lerp(f.prevScroll, f.scroll)), DROP = FLIGHT.floor - GROUND;
    ctx.save();
    ctx.translate(0, DROP);
    b.y0 -= DROP; b.y1 -= DROP;
    this.drawBackground(scroll, now);
    b.y0 += DROP; b.y1 += DROP;
    ctx.restore();

    this.drawStreaks(now);
    for (const h of f.hazards) if (h.x1 - scroll > b.x0 && h.x0 - scroll < b.x1) this.drawCloud(h, scroll, now);
    for (const e of f.eggs) {
      const x = e.x - scroll;
      if (e.taken || x < b.x0 - 20 || x > b.x1 + 20) continue;
      const bob = Math.sin(now / 220 + e.x * 0.05) > 0.3 ? -CELL : 0;
      this.sprite(SPR.egg[(now / 90 + e.x) % 30 < 3 ? 1 : 0], x, e.y + bob);
    }
    for (const w of f.wild) this.drawWild(w, lerp(w.prevX, w.x), now);
    this.drawMount(g, f, lerp, now);
    this.drawPickups(g.fx, now);
    if (g.showBoxes) {
      const [bx, by, bw, bh] = FLIGHT.box;
      this.boxes(FLIGHT.x + bx, lerp(f.prevY, f.y) + by, [[0, 0, bw, bh]], '#2a7de1');
    }
    drawUI(ctx, g, now, this);
  }

  // Wind streaks blowing past (GDD 9).
  drawStreaks(now) {
    const { ctx } = this, { x0, x1 } = this.bounds, w = x1 - x0 + 80;
    ctx.fillStyle = 'rgba(255,246,224,0.55)';
    for (let i = 0; i < 9; i++) {
      const x = x1 - ((now * 0.9 + i * 197) % w), y = 50 + (i * 71) % 230;
      ctx.fillRect(grid(x), grid(y), 24 + (i % 3) * 8, CELL);
    }
  }

  // A thundercloud: a Night Ink cloud at each end and a crackling cream zigzag bar between.
  drawCloud(h, scroll, now) {
    const { ctx } = this, ax = h.ax - scroll, bx = h.bx - scroll;
    const len = Math.hypot(bx - ax, h.by - h.ay), n = Math.max(2, Math.round(len / 6));
    const nx = -(h.by - h.ay) / len, ny = (bx - ax) / len, phase = Math.floor(now / 70) % 2;
    ctx.fillStyle = PAL.ink;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      ctx.fillRect(grid(ax + (bx - ax) * t) - 4, grid(h.ay + (h.by - h.ay) * t) - 4, 8, 8);
    }
    ctx.fillStyle = (Math.floor(now / 50) % 7) ? PAL.cream : '#FFFFFF';
    for (let i = 0; i <= n; i++) {
      const t = i / n, z = ((i + phase) % 2 ? 2 : -2);
      ctx.fillRect(grid(ax + (bx - ax) * t + nx * z) - 1, grid(h.ay + (h.by - h.ay) * t + ny * z) - 1, CELL, CELL);
    }
    for (const [x, y] of [[ax, h.ay], [bx, h.by]]) this.puff(x, y);
  }

  puff(x, y) {
    const { ctx } = this;
    x = grid(x); y = grid(y);
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x - 14, y - 6, 28, 14);
    ctx.fillRect(x - 10, y - 12, 14, 8);
    ctx.fillRect(x - 2, y - 10, 12, 6);
    ctx.fillStyle = '#3A4466';
    ctx.fillRect(x - 12, y - 4, 24, 4);
    ctx.fillRect(x - 8, y - 10, 10, 6);
  }

  // A wild pterodactyl: a flashing ! at the right edge while it is still out of view, then the pterodactyl.
  drawWild(w, x, now) {
    if (!w.on) return;
    const { ctx } = this, edge = this.bounds.x1;
    if (x > edge - 4) {
      if (Math.floor(now / 120) % 2) return;
      const ex = grid(edge - 28), ey = grid(w.y + 6);
      ctx.fillStyle = PAL.ink; ctx.fillRect(ex - 4, ey - 4, 20, 36);
      ctx.fillStyle = '#E0402A'; ctx.fillRect(ex, ey, 12, 28);
      ctx.fillStyle = PAL.cream; ctx.fillRect(ex + 4, ey + 4, 4, 12); ctx.fillRect(ex + 4, ey + 20, 4, 4);
      return;
    }
    if (x < this.bounds.x0 - 60) return;
    this.sprite(SPR.ptero[Math.floor(now / 80) % 2], this.snap(x), w.y);
  }

  // The mount with the equipped runner on its back; after a hit the rider
  // tumbles off and the mount flaps away to the right.
  drawMount(g, f, lerp, now) {
    const { ctx } = this, y = this.snap(lerp(f.prevY, f.y)), mx = this.snap(lerp(f.mountPrevX, f.mountX));
    const T = SPR.runners[g.data.equipped];
    const flapping = f.hit || f.holding || f.vy < -2;
    const wing = SPR.mount[flapping ? Math.floor(now / 70) % 2 : 0];
    if (f.rider) {
      const r = f.rider, img = T.crash;
      ctx.save();
      ctx.translate(r.x + 22, r.y + 23);
      ctx.rotate(r.spin * 0.15);
      ctx.drawImage(img, -22 - MARGIN, -23 + img.oy - MARGIN);
      ctx.restore();
    } else this.sprite(T.jump, mx - 2, y - 26);
    this.sprite(wing, mx, y);
  }

  // A layer tile repeated across the window, moved left by `offset`.
  tile(img, offset, y) {
    const { x0, x1 } = this.bounds, w = img.width;
    offset = this.snap(offset);
    for (let x = Math.floor((x0 + offset) / w) * w - offset; x < x1; x += w) this.ctx.drawImage(img, x, y);
  }

  layer(day, night, offset, y) {
    this.tile(day, offset, y);
    if (this.night > 0) {
      this.ctx.globalAlpha = this.night;
      this.tile(night, offset, y);
      this.ctx.globalAlpha = 1;
    }
  }

  drawBackground(scroll, now) {
    const { ctx, L, night: n } = this, { x0, x1, y0, y1 } = this.bounds, w = x1 - x0;
    ctx.fillStyle = SKY_DAY[0];
    ctx.fillRect(x0, y0, w, -y0 + 1);
    ctx.drawImage(L.skyDay, x0, 0, w, GROUND);
    if (n > 0) {
      ctx.globalAlpha = n;
      ctx.fillStyle = SKY_NIGHT[0];
      ctx.fillRect(x0, y0, w, -y0 + 1);
      ctx.drawImage(L.skyNight, x0, 0, w, GROUND);
      this.tile(L.stars, scroll * 0.02, 0);
      ctx.drawImage(L.moon, 500, 40);
      ctx.globalAlpha = 1;
    }
    if (n < 1) {
      ctx.globalAlpha = 1 - n;
      ctx.drawImage(L.sun, 452, 120);
      ctx.globalAlpha = 1;
    }
    this.layer(L.clouds, L.cloudsN, scroll * 0.05 + now * 0.004, 24);
    this.layer(L.mesas, L.mesasN, scroll * 0.1, GROUND - 110);
    this.layer(L.dunes, L.dunesN, scroll * 0.2, GROUND - 50);
    this.layer(L.ground, L.groundN, scroll, GROUND);
    if (y1 > VIEW_H) {   // sand below the view
      ctx.fillStyle = PAL.sand;
      ctx.fillRect(x0, VIEW_H, w, y1 - VIEW_H);
      if (n > 0) {
        ctx.globalAlpha = n * NIGHT_TINT;
        ctx.fillStyle = PAL.ink;
        ctx.fillRect(x0, VIEW_H, w, y1 - VIEW_H);
        ctx.globalAlpha = 1;
      }
    }
  }

  drawObstacle(o, x, boxes) {
    const ctx = this.ctx, t = OBSTACLES[o.id], y = LANE.top1P + o.y;
    if (o.id === 'ptero') {
      const img = SPR.ptero[Math.floor(o.flapMs / t.flapMs) % 2];
      this.rim(img, x, y, 1);
      this.sprite(img, x, y);
    } else {   // a group's rims first, so they never cover a neighbour's outline
      const img = SPR[o.id];
      for (let i = 0; i < o.size; i++) this.rim(img, x + i * t.w, y, 1);
      for (let i = 0; i < o.size; i++) this.sprite(img, x + i * t.w, y);
    }
    if (boxes) {
      this.boxes(x + 1, y + 1, o.boxes, '#e0303a');
      this.boxes(x + 1, y + 1, [[0, 0, o.w - 2, o.h - 2]], '#2a7de1');
    }
  }

  // Eggs wobble 1 art px and glint now and then, each on its own phase.
  drawEgg(e, x, now) {
    const ctx = this.ctx, phase = e.y * 0.37 + e.group * 1.7;
    const bob = Math.sin(now / 220 + phase) > 0.3 ? -CELL : 0;
    const glint = (now / 90 + phase * 10) % 30 < 3 ? 1 : 0;
    let alpha = 1;
    if (e.fade) {
      if (!born.has(e)) born.set(e, now);
      alpha = Math.min(1, (now - born.get(e)) / 200);
    }
    const y = LANE.top1P + e.y + bob;
    this.rim(SPR.egg[glint], x, y, alpha);
    ctx.globalAlpha = alpha;
    this.sprite(SPR.egg[glint], x, y);
    ctx.globalAlpha = 1;
  }

  // A sprite whose box starts at (x, y).
  sprite(img, x, y) { this.ctx.drawImage(img, x - MARGIN, y + img.oy - MARGIN); }

  // The night rim under a sprite whose box starts at (x, y), faded in with the night.
  rim(img, x, y, alpha) {
    if (this.night <= 0) return;
    this.ctx.globalAlpha = this.night * alpha;
    this.ctx.drawImage(img.rim, x - 2 * MARGIN, y + img.oy - 2 * MARGIN);
    this.ctx.globalAlpha = 1;
  }

  // A pop of 4 sparks and a "+1" rising from each egg picked up.
  drawPickups(fx, now) {
    const ctx = this.ctx;
    for (const f of fx) {
      const t = (now - f.t) / FX_MS;
      if (t >= 1) continue;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = f.n % 2 ? PAL.orange : PAL.cream;
      const d = 3 + t * 10;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect(grid(f.x + dx * d), grid(f.y + dy * d), CELL, CELL);
      const ty = grid(f.y - 16 - t * 14);
      drawText(ctx, '+1', grid(f.x) + CELL, ty + CELL, 2, PAL.ink, 'center');   // shadow: readable day and night
      drawText(ctx, '+1', grid(f.x), ty, 2, PAL.cream, 'center');
      ctx.globalAlpha = 1;
    }
  }

  drawRunner(T, run, y, now, boxes) {
    const ctx = this.ctx, top = LANE.top1P;
    let img, dy = top + y;
    if (!run) img = T.sleep;
    else if (run.ducking) {
      img = run.crashed ? T.slideCrash : T.slide[Math.floor(run.timeMs / ANIM.duck) % 2];
      dy = top + LANE.ground - RUNNER.heightDuck;
    } else if (run.crashed) img = T.crash;
    else if (run.jumping) img = T.jump;
    else img = T.run[Math.floor(run.timeMs / ANIM.run) % 4];
    // Landing squash and takeoff stretch (GDD 9): 2 and 3 frames, wider and
    // lower on landing, narrower and taller on takeoff, the feet kept where
    // they are. Drawing only; the hitbox doesn't change.
    const live = run && !run.ducking && !run.crashed;
    const [sw, sh] = !live ? [0, 0]
      : run.jumping ? STRETCH[Math.floor((now - this.cur.jumpAt) / SQUASH_MS)] || [0, 0]
      : SQUASH[Math.floor((now - this.cur.landAt) / SQUASH_MS)] || [0, 0];
    ctx.drawImage(img, RUNNER.x - MARGIN - sw / 2, dy + img.oy - MARGIN + sh, img.width + sw, img.height - sh);

    if (!run) {   // asleep on the title: Zz
      ctx.fillStyle = PAL.ink;
      for (let i = 0; i < 3; i++) {
        const p = (now / 1600 + i / 3) % 1, size = 3 + i;   // in art px
        this.zee(RUNNER.x + 40 + p * 14 + i * 2, top + y - 6 - p * 26, size, 1 - p);
      }
    } else if (run.crashed) {   // dizzy stars over the head (standing or sliding)
      const hx = RUNNER.x + (run.ducking ? 48 : 32), hy = run.ducking ? dy - 4 : top + y - 5;
      for (let i = 0; i < 3; i++) {
        const ang = now / 180 + i * Math.PI * 2 / 3;
        ctx.fillStyle = i % 2 ? PAL.orange : PAL.cream;
        ctx.fillRect(Math.round(hx + Math.cos(ang) * 10), Math.round(hy + Math.sin(ang) * 3), 2, 2);
      }
    }
    if (boxes && run) {
      this.boxes(RUNNER.x + 1, top + y + 1, run.ducking ? RUNNER_BOXES.duck : RUNNER_BOXES.run, PAL.cream);
      this.boxes(RUNNER.x + 1, top + y + 1, [[0, 0, RUNNER.width - 2, RUNNER.height - 2]], '#2a7de1');
    }
  }

  // The runner takes off: dust and the stretch start now.
  takeoff(scroll, lane = 0) {
    const f = this.fx[lane];
    f.dust.feet(6, scroll);
    f.jumpAt = performance.now();
  }

  // The runner lands on its feet: dust and the squash start now.
  land(scroll, lane = 0) {
    const f = this.fx[lane];
    f.dust.feet(10, scroll);
    f.landAt = performance.now();
  }

  // ---- the 2P race (GDD 3.1, 8, 9) -------------------------------------------------------------
  // Two 640×180 lanes, P1 on top. Each lane is the 1P scene moved up or down
  // so its ground line is 150 px below the lane's top, and clipped to the
  // lane; the window's extra space shows sky above P1 and sand below P2. In
  // race setup (no runs yet) each lane's runner runs on a treadmill.
  drawRace(g, now, dt) {
    const { ctx } = this, b = this.bounds, runs = g.runs, setup = g.screen === 'setup';
    const target = !setup && runs?.some(r => r.night) ? 1 : 0;
    this.night += Math.max(-dt, Math.min(dt, target - this.night));
    const a = g.alpha, lerp = (p, c) => p + (c - p) * a;
    for (let i = 0; i < 2; i++) {
      const run = setup ? null : runs[i], d = LANE.top2P[i] - LANE.top1P;
      const top = i ? LANE.seam : b.y0, bottom = i ? b.y1 : LANE.seam;
      this.cur = this.fx[i];
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.x0, top, b.x1 - b.x0, bottom - top);
      ctx.clip();
      ctx.translate(0, d);
      b.y0 -= d; b.y1 -= d;
      const scroll = run ? lerp(run.prevScrollPx, run.scrollPx) : Math.max(0, now - g.screenAt) * RUN.speed * 60 / 1000;
      this.drawBackground(scroll, now);
      if (run) {
        for (const o of run.obstacles) this.drawObstacle(o, this.snap(lerp(o.prevX, o.x)), g.showBoxes);
        for (const e of run.eggs) if (!e.taken) this.drawEgg(e, this.snap(lerp(e.prevX, e.x)), now);
      }
      if (g.screen !== 'paused') this.cur.dust.update(dt);
      this.cur.dust.draw(ctx, this.night, false);
      const id = i ? g.data.p2Runner : g.data.equipped;
      const y = run ? this.snap(lerp(run.prevY, run.y)) : LANE.ground - RUNNER.height;
      const dx = setup ? SETUP_RUNNER_X - RUNNER.x : 0;
      const ghost = run?.crashed && g.winner;
      ctx.translate(dx, 0);
      if (ghost) ctx.globalAlpha = 0.5;
      this.drawRunner(SPR.runners[id], run || { timeMs: Math.max(0, now - g.screenAt) }, y, now, g.showBoxes && !!run);
      ctx.globalAlpha = 1;
      if (ghost) this.xEyes(run);
      this.cur.dust.draw(ctx, this.night, true);
      const won = g.winner === (i ? 'p2' : 'p1');
      if (won && g.endAt) this.drawCrown(run, y, now - g.endAt);
      ctx.restore();
      b.y0 += d; b.y1 += d;
      if (won && g.screen === 'complete') this.drawConfetti(i, now - g.crashAt);
    }
    // The seam between the lanes.
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(b.x0, LANE.seam - 2, b.x1 - b.x0, 4);
    this.drawPickups(g.fx, now);
    drawUI(ctx, g, now, this);
  }

  // The ghost's X eyes: an X in Night Ink over the head of the crashed runner.
  xEyes(run) {
    const ctx = this.ctx;
    const x = RUNNER.x + (run.ducking ? 46 : 30), y = LANE.top1P + (run.ducking ? LANE.ground - RUNNER.heightDuck + 2 : run.y + 4);
    ctx.fillStyle = PAL.ink;
    for (let k = 0; k < 4; k++) {
      ctx.fillRect(grid(x) + k * CELL, grid(y) + k * CELL, CELL, CELL);
      ctx.fillRect(grid(x) + (3 - k) * CELL, grid(y) + k * CELL, CELL, CELL);
    }
  }

  // The winner's crown drops from the sky onto its head and bounces once (GDD 9).
  drawCrown(run, y, t) {
    const ctx = this.ctx, p = Math.min(1, t / 450);
    const fall = p < 1 ? -90 * (1 - p) ** 2 : 0;
    const bounce = t > 450 && t < 650 ? -Math.sin((t - 450) / 200 * Math.PI) * 6 : 0;
    const top = LANE.top1P + (run.ducking ? LANE.ground - RUNNER.heightDuck : y);
    const x = grid(RUNNER.x + (run.ducking ? 34 : 20)), cy = grid(top - 14 + fall + bounce);
    // 11×6 art px: three points, a gold band with red gems, Night Ink outline.
    const rows = ['.1...1...1.', '1G1.1G1.1G1', '1GG1GGG1GG1', '1GGGGGGGGG1', '1GRGGRGGRG1', '11111111111'];
    rows.forEach((row, r) => [...row].forEach((c, k) => {
      if (c === '.') return;
      ctx.fillStyle = c === '1' ? PAL.ink : c === 'R' ? '#E0402A' : '#F5C542';
      ctx.fillRect(x + k * CELL, cy + r * CELL, CELL, CELL);
    }));
  }

  // Confetti falling through the winner's lane while the results show.
  drawConfetti(lane, t) {
    if (t < 0) return;
    const ctx = this.ctx, top = lane ? LANE.seam : 0, colors = [PAL.orange, PAL.cream, '#F5C542', '#3FA34D', '#E0402A'];
    for (let i = 0; i < 40; i++) {
      const sp = 40 + (i * 53) % 60, x = (i * 97 + Math.sin(t / 300 + i) * 10) % VIEW_W;
      const y = top - 10 + ((t / 1000 * sp + i * 37) % 190);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(grid(x), grid(y), CELL * (i % 3 ? 1 : 2), CELL * 2);
    }
  }

  // A "Z" `size` art px wide.
  zee(x, y, size, alpha) {
    const ctx = this.ctx, c = CELL;
    x = grid(x); y = grid(y);
    ctx.globalAlpha = alpha;
    ctx.fillRect(x, y, size * c, c);
    for (let i = 1; i < size - 1; i++) ctx.fillRect(x + (size - 1 - i) * c, y + i * c, c, c);
    ctx.fillRect(x, y + (size - 1) * c, size * c, c);
    ctx.globalAlpha = 1;
  }

  boxes(x, y, list, color) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1 / this.s;
    for (const b of list) ctx.strokeRect(x + b[0], y + b[1], b[2], b[3]);
  }
}
