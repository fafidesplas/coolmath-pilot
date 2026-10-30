// The scene (GDD 3.1, 9): sky, parallax layers, ground, obstacles and runner.
// Everything is drawn straight onto the display canvas through a scale
// transform, so positions interpolated between 60 Hz steps land on device
// pixels and 144 Hz screens don't judder. The layers are pre-rendered once.
import { VIEW_W, VIEW_H, LANE, RUN, RUNNER, RUNNER_BOXES, OBSTACLES, ANIM, EGGS, RUNNER_IDS } from './config.js';
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

  // Mesas (0.1×), flat-topped, a 640×110 tile resting on the ground.
  {
    const [c, g] = canvas(W, 55);
    for (const [x, w, h] of [[10, 60, 35], [105, 35, 22], [165, 80, 46], [270, 40, 28]]) {
      for (let row = 0; row < h; row++) {
        const grow = Math.floor(row / 3);
        g.fillStyle = row < 2 ? '#EDB073' : '#E39A57';
        g.fillRect(x - grow, 55 - h + row, w + grow * 2, 1);
        g.fillStyle = '#CF844A';
        g.fillRect(x + w + grow - 4, 55 - h + row, 4, 1);
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
    this.p = Array.from({ length: DUST_MAX }, () => ({ on: false, front: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0, c: 0 }));
    this.next = 0;
    this.carry = 0;
    this.n = 0;
  }

  // One puff at the tail. scroll: the ground's speed in px/s.
  emit(scroll, kick) {
    const d = this.p[this.next];
    this.next = (this.next + 1) % DUST_MAX;
    d.on = true;
    d.front = false;
    d.x = RUNNER.x + 2 + Math.random() * 10;
    d.y = GROUND - 2 - Math.random() * 3;
    d.vx = -scroll * (0.25 + Math.random() * 0.35) - Math.random() * 40 * kick;
    d.vy = -(15 + Math.random() * 45) * kick;
    d.age = 0;
    d.life = 0.3 + Math.random() * 0.25;
    d.c = Math.floor(Math.random() * DUST_COLORS.length);
  }

  burst(n, scroll, kick) {
    for (let i = 0; i < n; i++) {
      this.emit(scroll, kick);
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

  // A footfall of the run: a small puff kicked back from the planted foot (x).
  step(x, scroll) {
    this.emit(scroll, 0.4);
    const d = this.last;
    d.x = RUNNER.x + x + Math.random() * 4;
    d.life = 0.15 + Math.random() * 0.15;
  }

  // While sliding: puffs from the tail, and more along the whole belly
  // dragging on the sand (2 of every 3 puffs).
  trail(dt, scroll) {
    this.carry += dt * 120;
    while (this.carry >= 1) {
      this.carry--;
      if (++this.n % 3 === 0) { this.emit(scroll, 0.6); continue; }
      this.emit(scroll, 0.5);
      this.belly(this.last);
    }
  }

  // Moves a puff under the belly. Belly puffs are drawn in front of the
  // runner, so the sand sprays over the belly's lower edge.
  belly(d) {
    d.front = true;
    d.x = RUNNER.x + BELLY_X0 + Math.random() * (BELLY_X1 - BELLY_X0);
    d.y = GROUND - Math.random() * 2;
    d.vx -= Math.random() * 30;
    d.life = 0.2 + Math.random() * 0.25;
  }

  update(dt) {
    for (const d of this.p) {
      if (!d.on) continue;
      d.age += dt;
      if (d.age >= d.life) { d.on = false; continue; }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 120 * dt;   // settles back down
      if (d.y > GROUND - 1) d.y = GROUND - 1;
    }
  }

  // front: the belly puffs, drawn over the runner; otherwise the rest, under it.
  draw(ctx, night, front) {
    const colors = night > 0.5 ? DUST_NIGHT : DUST_COLORS;
    for (const d of this.p) {
      if (!d.on || d.front !== front) continue;
      const t = d.age / d.life, size = CELL * (2 + Math.round(t * 2));   // 2 to 4 art px
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = colors[d.c];
      ctx.fillRect(grid(d.x - size / 2), grid(d.y - size), size, size);
    }
    ctx.globalAlpha = 1;
  }
}

const SQUASH_MS = 50, SQUASH = [[6, 6], [2, 2]];   // per frame: extra width, lost height (px)
const STRETCH = [[-8, -10], [-4, -5], [-2, -2]];      // takeoff: narrower and taller, one frame longer

export class Renderer {
  constructor(cv) {
    this.cv = cv;
    this.ctx = cv.getContext('2d');
    this.L = buildLayers();
    this.night = 0;          // 0 day … 1 night, faded over 1 s (GDD 3.6)
    this.dust = new Dust();
    this.landAt = -1e9;      // performance.now() of the last landing on the feet
    this.jumpAt = -1e9;      // performance.now() of the last takeoff
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

  resetNight() { this.night = 0; }

  draw(g, now, dt) {
    // The Runners screen hides the run: the runner runs on a treadmill instead.
    const { ctx, s } = this, menu = g.screen === 'runners', run = menu ? null : g.run;
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

    const a = g.alpha, lerp = (p, c) => p + (c - p) * a;
    const scroll = run ? lerp(run.prevScrollPx, run.scrollPx) : menu ? Math.max(0, now - g.screenAt) * RUN.speed * 60 / 1000 : 0;
    this.drawBackground(scroll, now);

    if (run) {
      for (const o of run.obstacles) this.drawObstacle(o, this.snap(lerp(o.prevX, o.x)), g.showBoxes);
      for (const e of run.eggs) if (!e.taken) this.drawEgg(e, this.snap(lerp(e.prevX, e.x)), now);
    }
    const y = run ? this.snap(lerp(run.prevY, run.y)) : LANE.ground - RUNNER.height;
    if (g.screen !== 'paused') this.dust.update(dt);
    this.dust.draw(ctx, this.night, false);
    const focus = RUNNER_IDS[g.pick], shown = menu && g.data.unlocked.includes(focus) ? focus : g.data.equipped;
    if (!(menu && g.hatch)) this.drawRunner(SPR.runners[shown], menu ? { timeMs: Math.max(0, now - g.screenAt) } : run, y, now, g.showBoxes && !menu);
    this.dust.draw(ctx, this.night, true);
    this.drawPickups(g.fx, now);

    drawUI(ctx, g, now, this);
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
      : run.jumping ? STRETCH[Math.floor((now - this.jumpAt) / SQUASH_MS)] || [0, 0]
      : SQUASH[Math.floor((now - this.landAt) / SQUASH_MS)] || [0, 0];
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
  takeoff(scroll) {
    this.dust.feet(6, scroll);
    this.jumpAt = performance.now();
  }

  // The runner lands on its feet: dust and the squash start now.
  land(scroll) {
    this.dust.feet(10, scroll);
    this.landAt = performance.now();
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
