// Headless checks for the runner, plus the solver on every level.
//   node tools/simtest.mjs          run the checks and replay the solution files
//   node tools/simtest.mjs --write  also (re)write levels/solutions/*.json from the solver
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { parseLevel } from '../src/level.js';
import { initialState, advance, bankedCount } from '../src/sim.js';
import { HZ, RUNNER } from '../src/config.js';
import { encodeRecording, decodeRecording } from '../src/record.js';
import { solve, framesOf } from './solve.mjs';
import w1l01 from '../levels/w1l01.js';
import proto from '../levels/proto.js';

const WRITE = process.argv.includes('--write');
let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failed++; };

// Test corridor: rows 5–10 open (6 tiles), floor surface y = 440, ceiling surface y = 200.
function corridor(cols, edit = () => {}) {
  const grid = Array.from({ length: 16 }, (_, r) => Array.from({ length: cols }, () => (r < 5 || r >= 11 ? '#' : '.')));
  edit(grid);
  return { id: 'test', name: 'test', speed: 320, start: { x: 2, y: 10, gravity: 1 }, tiles: grid.map(r => r.join('')), objects: [] };
}
function world(data) {
  const lv = parseLevel(data), s = initialState(lv), ev = [];
  return { lv, s, ev, run(n, press = () => false) { for (let i = 0; i < n; i++) advance(lv, s, press(i), (t, e) => ev.push({ t, ...e })); } };
}

{ // Flip across a 6-tile corridor takes ~0.29 s
  const w = world(corridor(80));
  w.run(10);
  let steps = 0;
  w.run(1, () => true);
  while (!w.s.grounded && steps < 200) { w.run(1); steps++; }
  const t = (steps + 1) / HZ;
  ok(Math.abs(t - 0.215) < 0.03 && w.s.g === -1, `corridor flip takes ${(t * 1000).toFixed(0)} ms (want ~215)`);
}

{ // Buffer: a tap 80 ms before landing flips on touchdown
  const w = world(corridor(80));
  w.run(10); w.run(1, () => true);
  let steps = 0;
  while (!w.s.grounded) { w.run(1); steps++; }
  const w2 = world(corridor(80));
  w2.run(10); w2.run(1, () => true);
  w2.run(steps - 10);                       // ~83 ms before landing
  w2.run(1, () => true);
  w2.run(20);
  ok(w2.s.g === 1 && w2.s.flips === 2, 'tap just before landing is buffered');
  const w3 = world(corridor(80));
  w3.run(10); w3.run(1, () => true);
  w3.run(2); w3.run(1, () => true); w3.run(60);
  ok(w3.s.flips === 1, 'a mid-air tap long before landing does nothing');
}

{ // Coyote: tap just after running off an edge still flips
  const data = corridor(80, g => { for (let r = 11; r < 16; r++) for (let c = 12; c < 30; c++) g[r][c] = '.'; });
  const w = world(data);
  while (w.s.grounded) w.run(1);
  w.run(4); w.run(1, () => true); w.run(60);
  ok(w.s.flips === 1 && w.s.g === -1 && w.s.deaths === 0, 'flip 40 ms after leaving the edge works');
  const w2 = world(data);
  while (w2.s.grounded) w2.run(1);
  w2.run(12); w2.run(1, () => true); w2.run(120);
  ok(w2.s.flips === 0 && w2.s.deaths === 1, 'flip 100 ms after leaving the edge is too late');
}

{ // Auto-step: 1-tile rise is climbed, 2-tile wall kills
  const step1 = corridor(80, g => { for (let c = 20; c < 80; c++) g[10][c] = '#'; });
  const w = world(step1); w.run(400);
  ok(w.s.deaths === 0 && w.ev.some(e => e.t === 'step'), '1-tile rise is auto-stepped');
  const wall2 = corridor(80, g => { for (let c = 20; c < 80; c++) { g[10][c] = '#'; g[9][c] = '#'; } });
  const w2 = world(wall2); w2.run(400);
  ok(w2.ev.some(e => e.t === 'death' && e.kind === 'wall'), '2-tile wall kills');
}

{ // Forgiving spikes: running next to a spike tile's edge doesn't kill
  const data = corridor(80, g => { g[10][20] = '^'; });
  const w = world(data); w.run(400);
  ok(w.s.deaths >= 1, 'running into floor spikes kills');
  const data2 = corridor(80, g => { g[5][20] = 'v'; });
  const w2 = world(data2); w2.run(800);
  ok(w2.s.deaths === 0, 'ceiling spikes above a floor runner are harmless');
}

{ // Every retry is identical: respawn restores the flag snapshot
  const data = corridor(120, g => { g[10][60] = '^'; });
  data.objects = [{ type: 'flag', x: 30, y: 10 }, { type: 'star', x: 45, y: 10 }];
  const w = world(data);
  w.run(2000, () => false);
  const deaths = w.ev.filter(e => e.t === 'death').length;
  ok(deaths >= 3, `keeps dying at the same spike (${deaths} deaths)`);
  const resp = [];
  const w2 = world(data);
  for (let i = 0; i < 2000; i++) { const before = w2.s.dead; w2.run(1); if (before === 1) resp.push(`${w2.s.x},${w2.s.y},${w2.s.g}`); }
  ok(resp.length >= 3 && resp.every(r => r === resp[0]), 'respawn state is the same every time');
  ok(w2.s.stars[0] === 0, 'a star grabbed after the flag goes back on death');
}

{ // Glider: hold climbs, release dives, surfaces can be slid along
  const data = corridor(120, gr => { for (let r = 1; r < 5; r++) for (let c = 10; c < 120; c++) gr[r][c] = '.'; for (let r = 11; r < 15; r++) for (let c = 10; c < 120; c++) gr[r][c] = '.'; });
  data.objects = [{ type: 'portal', x: 10, form: 'glider' }];
  const w = world(data);
  w.run(150);
  const y0 = w.s.y;
  w.run(40, () => 2);
  ok(w.s.form === 'glider' && w.s.y < y0 - 80, `holding climbs (${(y0 - w.s.y).toFixed(0)} px up)`);
  w.run(200, () => 2);
  ok(w.s.deaths === 0 && w.s.y <= 41, 'climbing into the ceiling slides along it');
  w.run(120);
  ok(w.s.y > 300 && w.s.deaths === 0, 'releasing dives');
}

{ // Twin: one press flips both, only when both have their feet down
  const data = corridor(160, gr => { for (let c = 10; c < 160; c++) { gr[5][c] = '#'; gr[1][c] = '.'; gr[2][c] = '.'; gr[3][c] = '.'; } });
  data.objects = [{ type: 'portal', x: 12, form: 'twin', lanes: [2, 8] }];
  const w = world(data);
  w.run(200);
  ok(w.s.form === 'twin' && w.s.b2 && w.s.b2.grounded, 'second runner appears standing in its lane');
  w.run(1, () => 1); w.run(60);
  ok(w.s.g === -1 && w.s.b2.g === -1 && w.s.deaths === 0, 'one press flips both twins');
}

{ // Twin: the second runner always takes the other lane, whichever one you enter
  const data = proto;
  const lv = parseLevel(data);
  for (const [label, g] of [['ceiling', -1], ['floor', 1]]) {
    const s = initialState(lv);
    s.x = 193 * 40; s.g = g; s.y = g > 0 ? 11 * 40 - 28 : 40; s.vy = 0; s.grounded = true;
    for (let i = 0; i < 200 && s.form !== 'twin'; i++) advance(lv, s, 0);
    const laneOf = y => (y + 14 < 6 * 40 ? 'top' : 'bottom');
    ok(s.b2 && laneOf(s.y) !== laneOf(s.b2.y), `entering on the ${label}: twins in different lanes (${laneOf(s.y)} / ${s.b2 && laneOf(s.b2.y)})`);
  }
}

// --- Levels: solver + recorded solutions -----------------------------------------

for (const data of [w1l01, proto]) {
  const r = solve(data);
  ok(r.ok, `${data.id} is beatable (${r.ok ? `${r.stars}/3 stars, ${r.time.toFixed(1)} s, ${r.presses.length} flips` : 'no route'})`);
  if (!r.ok) continue;
  ok(r.tightestMs >= 120, `${data.id} tightest window ${r.tightestMs} ms (min 120)`);
  const file = new URL(`../levels/solutions/${data.id}.json`, import.meta.url);
  if (WRITE) {
    writeFileSync(file, JSON.stringify(encodeRecording(data.id, 'solo', framesOf(r))) + '\n');
    console.log(`wrote ${data.id}.json`);
  }
  if (!existsSync(file)) { ok(false, `${data.id}.json missing`); continue; }
  const rec = JSON.parse(readFileSync(file, 'utf8'));
  const replay = () => {
    const lv = parseLevel(data), s = initialState(lv);
    for (const b of decodeRecording(rec)) advance(lv, s, b);
    return s;
  };
  const a = replay(), b = replay();
  ok(a.done && a.deaths === 0, `${data.id} recording reaches the goal without dying (${bankedCount(a)} stars)`);
  ok(a.step === b.step && a.x === b.x, `${data.id} replay is deterministic`);
}

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
