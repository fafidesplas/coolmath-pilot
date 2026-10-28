// Headless checks (GDD 12): the contact and fail rules first, then every level.
//   node tools/simtest.mjs
import { parseLevel, blockedAt } from '../src/level.js';
import { Sim, runLine } from '../src/sim.js';
import { penStroke } from '../src/pen.js';
import { simplifyStroke, polyLength } from '../src/geom.js';
import { HZ, BALL, PEN } from '../src/config.js';
import { LEVELS } from '../levels/index.js';

let failed = 0, passed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };

const level = (o = {}) => parseLevel({ id: 'test', name: 'test', ink: 2000, marks: { three: 1, two: 2 }, balls: [{ x: 100, y: 0 }], cups: [], walls: [], ...o });
const draw = (lv, path) => penStroke((x, y) => blockedAt(lv, x, y), lv.ink, path).result;
const speedOf = b => Math.sqrt(b.vx * b.vx + b.vy * b.vy);

// ---- Mechanics -----------------------------------------------------------------

{ // Falling the whole 640 px playfield takes 0.84 s
  const sim = new Sim(level({ balls: [{ x: 640, y: 0 }] }));
  while (sim.balls[0].y < 640) sim.step();
  ok(Math.abs(sim.time - 0.84) < 0.02, `640 px fall takes ${sim.time.toFixed(3)} s (want 0.84)`);
}

{ // A drawn quarter-pipe keeps its speed (glancing hits)
  const lv = level({ balls: [{ x: 300, y: 60 }] });
  // Arc of radius 260 from nearly vertical down to flat, drawn through the pen.
  const cx = 540, cy = 140, R = 260, path = [];
  for (let a = 0; a <= 80; a += 2) {
    const r = (180 - 10 - a) * Math.PI / 180;   // from 170° down to 90°
    path.push([cx + R * Math.cos(r), cy + R * Math.sin(r)]);
  }
  path.push([cx + 300, cy + R]);
  const line = draw(lv, path);
  const sim = new Sim(lv, line.pts);
  let contactLen = 0, v1 = null, y1 = 0;
  while (!sim.done && sim.balls[0].x < cx + 100) {
    const b = sim.balls[0], x0 = b.x, yy = b.y;
    sim.step();
    if (b.touch) {
      if (v1 === null) { v1 = speedOf(b); y1 = b.y; } else contactLen += Math.sqrt((b.x - x0) ** 2 + (b.y - yy) ** 2);
    }
  }
  const b = sim.balls[0];
  const ideal = Math.sqrt(v1 * v1 + 2 * BALL.gravity * (b.y - y1) - 2 * BALL.roll * contactLen);
  const k = speedOf(b) / ideal;
  ok(k > 0.97 && k < 1.02, `quarter-pipe keeps ${(k * 100).toFixed(1)}% of the ideal speed from landing to exit (${line.pts.length} points after RDP)`);
  // Without the glancing rule (sanity): the same curve loses clearly more.
}

{ // A 10 px step (convex corner) rolls over at 95% speed; a 16 px one does not
  for (const [h, want] of [[10, true], [16, false]]) {
    const lv = level({ balls: [{ x: 420, y: 382, vx: 300 }], walls: [[[0, 400], [600, 400], [600, 640], [0, 640]], [[602, 400 - h], [1280, 400 - h], [1280, 640], [602, 640]]] });
    const sim = new Sim(lv);
    sim.run(300);
    const b = sim.balls[0];
    ok((b.x > 650) === want, `${h} px step ${want ? 'rolls over' : 'stops Dot'} (x ${b.x.toFixed(0)}, lips ${sim.events.filter(e => e.type === 'lip').length})`);
  }
}

{ // A stroke lying on the floor (sticks 10 px into the path) is rolled onto
  const lv = level({ balls: [{ x: 420, y: 382, vx: 300 }], walls: [[[0, 400], [1280, 400], [1280, 640], [0, 640]]] });
  const sim = new Sim(lv, [[500, 395], [900, 395]]);
  sim.run(300);
  const b = sim.balls[0];
  ok(b.x > 700 && sim.events.some(e => e.type === 'lip'), `Dot rolls over a stroke end lying on the floor (x ${b.x.toFixed(0)})`);
}

{ // A jittery 5° line rolls once simplified
  const lv = level({ balls: [{ x: 200, y: 100 }] });
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const path = [];
  for (let x = 170; x <= 770; x += 3) path.push([x, 160 + (x - 170) * 0.0875 + (rnd() * 2 - 1)]);
  const line = draw(lv, path);
  const r = runLine(lv, line.pts);
  const end = r.sim.balls[0];
  ok(r.cause === 'lost' && end.x > 700, `jittery 5° line: Dot rolls off its end after RDP (${line.pts.length} points, ${r.cause} at x ${end.x.toFixed(0)})`);
  const raw = runLine(lv, path.map(p => [p[0], Math.round(p[1])]));
  console.log(`      (same line unsimplified: ${raw.cause} at x ${raw.sim.balls[0].x.toFixed(0)})`);
}

{ // Fail rules fire in time
  const lost = runLine(level({ balls: [{ x: 640, y: 0 }] }), null);
  ok(lost.cause === 'lost' && lost.time < 0.95, `lost: falling off the bottom fails at ${lost.time.toFixed(2)} s`);
  const top = runLine(level({ balls: [{ x: 640, y: 300, vy: -2000 }] }), null);
  ok(top.cause === 'lost' && top.sim.balls[0].y > 600, 'off the top is allowed (comes back down, then lost at the bottom)');

  const flat = runLine(level({ balls: [{ x: 640, y: 300 }], walls: [[[0, 400], [1280, 400], [1280, 640], [0, 640]]] }), null);
  ok(flat.cause === 'stuck' && flat.time < 1.4, `stuck: resting on a floor fails at ${flat.time.toFixed(2)} s`);

  const valley = level({ balls: [{ x: 560, y: 300 }], walls: [[[0, 300], [640, 460], [1280, 300], [1280, 640], [0, 640]]] });
  const v = runLine(valley, null);
  ok(v.cause === 'stuck' && v.time < 3, `stuck: rocking in a valley fails at ${v.time.toFixed(2)} s (turn-back rule)`);

  // Loop: no world-1 element can loop, so test the detector directly: no gravity,
  // no rolling resistance, Dot circling inside a ring of ink.
  const ring = [];
  for (let a = 0; a <= 360; a += 10) { const r = a * Math.PI / 180; ring.push([640 + Math.round(150 * Math.cos(r)), 320 + Math.round(150 * Math.sin(r))]); }
  const lp = runLine(level({ balls: [{ x: 640, y: 320 + 127, vx: 400 }] }), ring, { gravity: 0, roll: 0 });
  ok(lp.cause === 'loop' && lp.time < 3.5, `loop: circling forever fails at ${lp.time.toFixed(2)} s`);

  const slow = runLine(level({ balls: [{ x: 300, y: 300, vx: 30 }] }), null, { gravity: 0, roll: 0 });
  ok(slow.cause === 'timeout' && Math.abs(slow.time - 12) < 0.02, `timeout at ${slow.time.toFixed(2)} s`);
}

{ // Determinism: the same line gives the same end state twice
  const lv = level({ balls: [{ x: 200, y: 100 }], walls: [[[0, 560], [1280, 560], [1280, 640], [0, 640]]] });
  const pts = draw(lv, [[170, 200], [400, 300], [600, 280], [800, 420]]).pts;
  ok(new Sim(lv, pts).run().snapshot() === new Sim(lv, pts).run().snapshot(), 'same line, same end state');
}

{ // Pen: blocked areas stop the tip at the edge; the pot stops the line
  const lv = level({ balls: [{ x: 100, y: 100 }], walls: [[[400, 0], [500, 0], [500, 640], [400, 640]]], ink: 200 });
  const { pen } = penStroke((x, y) => blockedAt(lv, x, y), 1000, [[200, 300], [700, 300]]);
  ok(pen.tether === 'wall' && Math.abs(pen.tip[0] - 400) < 1, `pen stops at a wall's edge (tip x ${pen.tip[0].toFixed(1)})`);
  const { pen: p2 } = penStroke((x, y) => blockedAt(lv, x, y), 120, [[100, 400], [380, 400]]);
  ok(p2.dry && Math.abs(p2.used - 120) < 1e-9, `pen runs dry at the pot (${p2.used} px)`);
  const { result: tiny } = penStroke((x, y) => blockedAt(lv, x, y), 1000, [[200, 300], [215, 300]]);
  ok(tiny === null, 'a line under 20 px is ignored');
}

// ---- Levels ----------------------------------------------------------------------

const shifted = (pts, dx, dy) => pts.map(p => [p[0] + dx, p[1] + dy]);
for (const data of LEVELS) {
  const lv = parseLevel(data), id = data.id;
  const none = runLine(lv, null);
  ok(!none.win, `${id} fails with no line (${none.cause} at ${none.time.toFixed(2)} s)`);
  for (const [name, d] of [['easy', 8], ['gold', 4]]) {
    const ref = data.refs[name];
    const res = [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]].map(([dx, dy]) => ({ dx, dy, r: runLine(lv, shifted(ref.pts, dx, dy)) }));
    const bad = res.filter(x => !x.r.win);
    ok(!bad.length, `${id} ${name} line (${ref.ink} px) wins shifted 0/±${d} px` + (bad.length ? `: fails at ${bad.map(x => `(${x.dx},${x.dy}) ${x.r.cause}`).join(', ')}` : ''));
    const slow = res.filter(x => x.r.win && x.r.time > 8);
    ok(!slow.length, `${id} ${name} runs last at most 8 s (${Math.max(...res.map(x => x.r.time)).toFixed(2)} s)`);
    ok(new Sim(lv, ref.pts).run().snapshot() === new Sim(lv, ref.pts).run().snapshot(), `${id} ${name} line replays identically`);
    ok(ref.pts.every(p => !blockedAt(lv, p[0], p[1])), `${id} ${name} line avoids blocked areas`);
  }
  const { three, two } = data.marks, easy = data.refs.easy.ink, gold = data.refs.gold.ink;
  // Level 1 has the guide and no hint, so its easy line need not use more ink than ★★ (GDD 3.8).
  const easyOk = data.guide ? true : two < easy;
  ok(gold * 1.1 <= three && three < two && easyOk && easy <= data.ink / 1.1,
    `${id} marks in order: gold ${gold}×1.1 ≤ ★★★ ${three} < ★★ ${two} < easy ${easy}${data.guide ? ' (not required: guide level)' : ''} ≤ pot ${data.ink}÷1.1`);
  ok(easy <= 600, `${id} easy line fits a trackpad drag (${easy} px ≤ 600)`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
