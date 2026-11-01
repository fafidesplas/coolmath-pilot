// Headless bonus flight checks (GDD 3.8, 12: "every flight must have a path through").
//   node tools/flight-test.mjs [seeds]     (default 300; the GDD's full check is 1000)
import { Flight } from '../src/flight.js';
import { stream, STREAM } from '../src/gen.js';
import { FLIGHT as F } from '../src/config.js';

let failed = 0, passed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };
const SEEDS = +process.argv[2] || 300;
const make = seed => new Flight(stream(seed, STREAM.flight));

// ---- 1. Deterministic ------------------------------------------------------------------------
{
  const a = make(42), b = make(42);
  const key = f => JSON.stringify([f.hazards.map(h => [h.ax, h.ay, h.bx, h.by]), f.eggs.map(e => [e.x, e.y]), f.wild.map(w => w.arriveAt)]);
  ok(key(a) === key(b), 'the same seed gives the same flight');
}

// ---- 2. A path through every flight -----------------------------------------------------------
// Every reachable (height, vertical speed) state, frame by frame, holding or
// releasing each frame, keeping only those that touch no thundercloud. Wild
// pterodactyls are left out: they only arrive where no thundercloud is near,
// and checked separately below.
function finishable(f) {
  const BY = F.box[1], top = F.ceiling - BY, bottom = F.floor - BY - F.box[3];
  let states = new Map([[0, [F.startY, 0]]]);
  for (let frame = 1; frame <= F.frames; frame++) {
    const scroll = frame * F.scroll, next = new Map(), hit = new Map();   // hit: blocked, by whole-px height, this frame
    const near = f.hazards.some(h => h.x0 < F.x + F.box[0] + F.box[2] + scroll + 20 && h.x1 > F.x + scroll - 20);
    for (const [y, vy] of states.values()) {
      for (const hold of [0, 1]) {
        let v = Math.max(-F.maxVy, Math.min(F.maxVy, vy + F.gravity - (hold ? F.flap : 0))), ny = y + v;
        if (ny < top) { ny = top; v = 0; }
        if (ny > bottom) { ny = bottom; v = 0; }
        const iy = Math.round(ny), k = iy * 64 + Math.round(v / 0.45) + 20;
        if (next.has(k)) continue;
        if (near) {
          if (!hit.has(iy)) hit.set(iy, f.blocked(iy, scroll));
          if (hit.get(iy)) continue;
        }
        next.set(k, [ny, v]);
      }
    }
    if (!next.size) return frame;
    states = next;
  }
  return 0;
}
{
  const stuck = [];
  let eggs = 0, minEggs = Infinity, maxEggs = 0, hazards = 0, wild = 0;
  const t0 = Date.now();
  for (let seed = 1; seed <= SEEDS; seed++) {
    const f = make(seed);
    const at = finishable(f);
    if (at) stuck.push(`seed ${seed} at ${(at / 60).toFixed(1)} s`);
    eggs += f.eggs.length; minEggs = Math.min(minEggs, f.eggs.length); maxEggs = Math.max(maxEggs, f.eggs.length);
    hazards += f.hazards.length; wild += f.wild.length;
  }
  ok(stuck.length === 0, `every one of ${SEEDS} flights has a path through (${((Date.now() - t0) / 1000).toFixed(1)} s)${stuck.length ? ': ' + stuck.length + ' stuck, e.g. ' + stuck.slice(0, 4).join('; ') : ''}`);
  console.log(`      per flight: ${(hazards / SEEDS).toFixed(1)} thunderclouds, ${(wild / SEEDS).toFixed(1)} wild pterodactyls, ${(eggs / SEEDS).toFixed(0)} eggs (${minEggs}–${maxEggs})`);
  ok(eggs / SEEDS >= 90 && eggs / SEEDS <= 150, `about 120 eggs in a flight (${(eggs / SEEDS).toFixed(0)})`);
}

// ---- 3. Hazard rules ---------------------------------------------------------------------------
{
  const bad = [];
  for (let seed = 1; seed <= SEEDS; seed++) {
    const f = make(seed);
    for (const h of f.hazards) {
      if ((h.y1 - h.y0) > (F.floor - F.ceiling) * F.maxBlock + 0.5) bad.push(`seed ${seed}: closes ${Math.round(h.y1 - h.y0)} px`);
      if (h.x0 < F.x + F.clearFrames * F.scroll) bad.push(`seed ${seed}: hazard in the first 3 s`);
    }
    for (const e of f.eggs) if (f.hazards.some(h => f.touches(h, e.x, e.y, e.x + 10, e.y + 13))) bad.push(`seed ${seed}: egg on a hazard`);
  }
  ok(bad.length === 0, `no hazard closes more than 60% of the height or comes in the first 3 s; no egg on a hazard${bad.length ? ': ' + bad.slice(0, 3).join('; ') : ''}`);
}

// ---- 4. A wild pterodactyl can always be dodged -------------------------------------------------
// A player who sits still until the warning locks, then flaps (or glides, at
// the ceiling) away, is never hit by it.
{
  let hits = 0, total = 0;
  for (let seed = 1; seed <= Math.min(SEEDS, 100); seed++) {
    const f = make(seed);
    f.hazards.length = 0;                 // only the pterodactyls
    for (const w of f.wild) {
      total++;
      const g = make(seed); g.hazards.length = 0; g.wild = [g.wild.find(x => x.arriveAt === w.arriveAt)];
      g.y = 40 + ((seed * 37 + w.arriveAt) % 200);
      while (g.frame < w.lockAt) { g.holding = g.vy > 0; g.step(); }   // hover
      const up = g.y > 150;
      while (g.frame < w.arriveAt + 10 && !g.hit) { g.holding = up; g.step(); }
      if (g.hit) hits++;
    }
  }
  ok(hits === 0, `moving away after the warning locks dodges every wild pterodactyl (${hits} of ${total} hit)`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
