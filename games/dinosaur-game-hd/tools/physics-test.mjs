// Headless physics checks against the original's numbers (GDD 3, 12).
//   node tools/physics-test.mjs
import { Run } from '../src/sim.js';
import { ObstacleGen, makeObstacle, mulberry32 } from '../src/gen.js';
import { HZ, VIEW_W, RUN, RUNNER, OBSTACLES } from '../src/config.js';

let failed = 0, passed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };

// A jump at `speed`, released after `release` frames (Infinity = held),
// with down pressed at frame `drop`. Returns apex (px) and airtime (frames).
function jump(speed, release = Infinity, drop = Infinity) {
  const r = new Run(1);
  r.speed = speed;
  r.press('jump');
  let apex = 0, f = 0;
  while (r.jumping && f < 200) {
    f++;
    if (f === drop) r.press('duck');
    r.step();
    apex = Math.max(apex, r.height);
    if (f === release) r.release('jump');
  }
  return { apex, frames: f };
}
const same = (a, b) => a.apex === b.apex && a.frames === b.frames;
const show = j => `${j.apex} px / ${j.frames} f (${Math.round(j.frames * 1000 / HZ)} ms)`;

// ---- 1. Jump heights and airtimes (expected values simulated from the source rules) ----
{
  const expect = [
    [6, 1, { apex: 91, frames: 35 }, 'release before 30 px is ignored: full jump'],
    [6, 3, { apex: 91, frames: 35 }, 'release at 50 ms still a full jump'],
    [6, 4, { apex: 62, frames: 28 }, 'shortest jump (release at 67 ms)'],
    [6, 5, { apex: 70, frames: 30 }, 'release at 83 ms'],
    [6, 6, { apex: 78, frames: 32 }, 'release at 100 ms'],
    [6, 7, { apex: 85, frames: 33 }, 'release at 117 ms'],
    [6, Infinity, { apex: 91, frames: 35 }, 'held jump'],
    [9.5, 4, { apex: 63, frames: 28 }, 'shortest jump'],
    [9.5, Infinity, { apex: 87, frames: 33 }, 'held jump'],
    [13, 4, { apex: 65, frames: 28 }, 'shortest jump'],
    [13, Infinity, { apex: 90, frames: 34 }, 'held jump'],
  ];
  for (const [speed, rel, want, label] of expect) {
    const got = jump(speed, rel);
    ok(same(got, want), `speed ${speed}, ${label}: ${show(got)} (want ${show(want)})`);
  }
}

// ---- 2. Fast-fall --------------------------------------------------------------------
{
  const got = jump(6, Infinity, 10);
  ok(same(got, { apex: 73, frames: 17 }), `held jump, down at frame 10: ${show(got)} (want 73 px / 17 f)`);

  // Releasing down ends the fast-fall: the jump lasts longer than a full fast-fall.
  const r = new Run(1);
  r.press('jump');
  let f = 0;
  while (r.jumping && f < 200) {
    f++;
    if (f === 10) r.press('duck');
    if (f === 12) r.release('duck');
    r.step();
  }
  ok(f > 17 && f < 35, `down released 2 frames later: lands at frame ${f} (between 17 and 35)`);

  // Still holding down on landing: the runner ducks.
  const d = new Run(1);
  d.press('jump');
  for (let i = 1; i <= 60; i++) { if (i === 10) d.press('duck'); d.step(); }
  ok(!d.jumping && d.ducking, 'holding down through the landing: ducking');
}

// ---- 3. Input rules ------------------------------------------------------------------
{
  const r = new Run(1);
  r.press('duck');
  r.press('jump');
  ok(!r.jumping, 'no jump while ducking');

  const a = new Run(1);
  a.press('jump');
  for (let i = 0; i < 10; i++) a.step();
  const vy = a.vy;
  a.press('jump');
  ok(a.vy === vy, 'a jump pressed in the air is ignored');

  // Held jump key (keyboard) jumps again on landing; a held pointer doesn't.
  const count = repeat => {
    const k = new Run(1);
    k.press('jump', repeat);
    k.events.length = 0;   // count re-jumps only
    let jumps = 0;
    for (let i = 0; i < 120; i++) { k.step(); if (k.events.includes('jump')) jumps++; k.events.length = 0; }
    return jumps;
  };
  ok(count(true) >= 3, `held key over 2 s: ${count(true)} re-jumps`);
  ok(count(false) === 0, 'held pointer: no re-jump');
}

// ---- 4. Speed and distance -----------------------------------------------------------
{
  const r = new Run(7, { invincible: true });
  while (r.speed < RUN.maxSpeed && r.frame < 10000) r.step();
  ok(Math.abs(r.frame - 7000) <= 1, `top speed after ${r.frame} frames (want 7000, ~117 s)`);
  ok(Math.abs(r.score - 1663) <= 2, `top speed at ${r.score} m (want ~1663)`);

  const s = new Run(7, { invincible: true });
  for (let i = 0; i < 600; i++) s.step();
  ok(s.score === 95, `after 10 s: ${s.score} m (want 95: 3,780 px)`);
}

// ---- 5. Clear time, milestones, night ------------------------------------------------
{
  const r = new Run(3, { invincible: true });
  let firstObstacle = 0, milestone = 0, night = 0, day = 0;
  while (r.frame < 9000) {
    r.step();
    if (!firstObstacle && r.obstacles.length) firstObstacle = r.frame;
    if (!milestone && r.events.includes('milestone')) milestone = r.score;
    if (!night && r.events.includes('night')) night = r.frame;
    if (night && !day && r.events.includes('day')) day = r.frame;
    r.events.length = 0;
  }
  ok(firstObstacle === 181, `first obstacle at frame ${firstObstacle} (want 181: after 3 s)`);
  ok(milestone === 100, `first milestone at ${milestone} m`);
  ok(night > 0 && Math.abs((day - night) - 721) <= 1, `night lasts ${day - night} frames (want ~721: 12 s)`);
  ok(r.nights >= 2, `nights by frame 9000: ${r.nights}`);
}

// ---- 6. Obstacle generator rules -----------------------------------------------------
{
  let bad = [];
  for (let seed = 1; seed <= 300; seed++) {
    const g = new ObstacleGen(mulberry32(seed));
    const ids = [];
    let firstPtero = null;
    for (let i = 0; i < 400; i++) {
      const speed = Math.min(RUN.maxSpeed, RUN.speed + i * 0.03);
      const o = g.next(speed, VIEW_W);
      const t = OBSTACLES[o.id];
      ids.push(o.id);
      if (i === 0 && (o.id !== 'cactus-small' || o.size !== 1)) bad.push(`seed ${seed}: first is ${o.id} x${o.size}`);
      if (speed < t.minSpeed) bad.push(`seed ${seed}: ${o.id} at speed ${speed.toFixed(2)}`);
      if (o.size > 1 && speed < t.multipleSpeed) bad.push(`seed ${seed}: group of ${o.id} at ${speed.toFixed(2)}`);
      if (o.gap < o.minGap || o.gap > o.maxGap) bad.push(`seed ${seed}: gap ${o.gap} outside ${o.minGap}–${o.maxGap}`);
      if (o.minGap !== Math.round(o.w * speed + t.minGap * RUN.gapCoefficient)) bad.push(`seed ${seed}: minGap`);
      if (ids.length >= 3 && ids.slice(-3).every(x => x === o.id)) bad.push(`seed ${seed}: 3 ${o.id} in a row`);
      if (o.id === 'ptero' && firstPtero === null) { firstPtero = o.y; if (o.y !== 75) bad.push(`seed ${seed}: first ptero at y ${o.y}`); }
    }
  }
  ok(bad.length === 0, `generator rules over 300 seeds x 400 obstacles${bad.length ? ': ' + bad.slice(0, 3).join('; ') : ''}`);

  const a = new Run(42), b = new Run(42);
  const inputs = f => f % 47 === 0;
  for (const r of [a, b]) {
    for (let f = 1; f < 5000 && !r.crashed; f++) { if (inputs(f)) r.press('jump'); if (inputs(f - 9)) r.release('jump'); r.step(); }
  }
  ok(a.frame === b.frame && a.deathId === b.deathId && a.score === b.score,
    `same seed and inputs, same run (crash at frame ${a.frame}, ${a.score} m, ${a.deathId})`);
}

// ---- 7. Hitboxes ---------------------------------------------------------------------
{
  // Sweep an obstacle across the runner's x range; does any position hit?
  const hitsAnywhere = (id, size, y, setup) => {
    const r = new Run(1);
    setup?.(r);
    const o = makeObstacle(id, size, y);
    for (let x = RUNNER.x - o.w - 5; x <= RUNNER.x + RUNNER.widthDuck + 5; x++) {
      o.x = x;
      if (r.collides(o)) return true;
    }
    return false;
  };
  const duck = r => r.press('duck');
  ok(hitsAnywhere('ptero', 1, 75), 'mid pterodactyl hits a standing runner');
  ok(!hitsAnywhere('ptero', 1, 75, duck), 'mid pterodactyl passes over a ducking runner');
  ok(!hitsAnywhere('ptero', 1, 50), 'high pterodactyl passes over a standing runner');
  ok(hitsAnywhere('ptero', 1, 50, r => { r.y = r.groundY - 30; }), 'high pterodactyl hits a runner 30 px up');
  ok(hitsAnywhere('ptero', 1, 100, duck), 'low pterodactyl hits a ducking runner');
  ok(hitsAnywhere('cactus-small', 1, 105), 'small cactus hits a standing runner');
  ok(!hitsAnywhere('cactus-large', 3, 90, r => { r.y = r.groundY - 60; }), '3 large cacti pass under a runner 60 px up');
}

// ---- 8. Every group is clearable with a held jump at its speed -----------------------
{
  // Fly one obstacle at the runner; can some press frame clear it?
  const clears = (id, size, speed) => {
    for (let press = 0; press < 120; press++) {
      const r = new Run(1);
      r.speed = speed;
      r.timeMs = RUN.clearTimeMs + 1;
      const o = makeObstacle(id, size);
      o.x = VIEW_W; o.gap = 1e9;
      r.obstacles.push(o);
      for (let f = 0; f < 200 && !r.crashed && o.x + o.w > 0; f++) {
        if (f === press) r.press('jump', true);
        if (f === press + 1) r.jumpRepeat = false;   // one held jump, no re-jump
        r.step();
      }
      if (!r.crashed) return true;
    }
    return false;
  };
  for (const [id, size, speed] of [['cactus-small', 1, 6], ['cactus-small', 3, 6], ['cactus-large', 1, 6], ['cactus-large', 3, 7], ['cactus-large', 3, 13], ['cactus-small', 3, 13]]) {
    ok(clears(id, size, speed), `${size} x ${id} clearable at speed ${speed}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
