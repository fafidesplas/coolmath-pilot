// Headless checks of the track tables and the tick sim against GDD.md, then every
// level: track joins up, the reference solution arrives and replays identically,
// the start setting does not win, and brute force over all switch setups agrees
// with the level's par.
//   node tools/simtest.mjs
import { tileEdges, exitEdge, switchArms, DX, DY, opp } from '../src/track.js';
import { run, defaultSetup, flipCount, switchTiles, cellKey, buildBoard } from '../src/sim.js';
import { ALL_LEVELS, findLevel } from '../levels/index.js';

let passed = 0, failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };

// ---- Track tables (GDD 3.4, 3.5) ---------------------------------------------------
{
  const sw = { t: 'switch', rot: 1, mirror: false };
  const a = switchArms(sw);
  ok(a.trunk === 3 && a.straight === 1 && a.curved === 2, 'switch rot 1: trunk W, straight E, curved S');
  ok(switchArms({ ...sw, mirror: true }).curved === 0, 'mirrored switch curves the other way (N)');
  ok(exitEdge(sw, 3, 0) === 1 && exitEdge(sw, 3, 1) === 2, 'facing move takes the set branch');
  ok(exitEdge(sw, 1, 0) === 3 && exitEdge(sw, 1, 1) === 3 && exitEdge(sw, 2, 0) === 3 && exitEdge(sw, 2, 1) === 3,
    'trailing move always goes to the trunk, whatever the setting');
  ok(exitEdge(sw, 0, 0) === -1, 'switch has no track on its fourth edge');
  let curvesOk = true;
  for (let r = 0; r < 4; r++) {
    const c = { t: 'curve', rot: r };
    const [e1, e2] = tileEdges(c);
    if (exitEdge(c, e1, 0) !== e2 || exitEdge(c, e2, 0) !== e1 || ((e2 - e1 + 4) & 3) !== 1) curvesOk = false;
  }
  ok(curvesOk, 'curves join two adjacent edges both ways in all 4 rotations');
  ok(exitEdge({ t: 'straight', rot: 1 }, 3, 0) === 1 && exitEdge({ t: 'straight', rot: 1 }, 0, 0) === -1, 'straight E–W');
}

// ---- Sim rules on tiny boards (GDD 3.2, 3.10) ---------------------------------------
const lv = (tiles, trains, extra = {}) => ({ id: 'test', w: 8, h: 4, tiles, trains, tickLimit: 30, ...extra });
const T = (x, y, t, rot, more = {}) => ({ x, y, t, rot, ...more });
const NOSW = { switches: {} };
{
  const l = lv([T(0, 0, 'depot', 1), T(1, 0, 'straight', 1), T(2, 0, 'station', 3, { color: 'red' })],
    [{ id: 0, color: 'red', depot: [0, 0], depart: 0 }]);
  const r = run(l, NOSW);
  ok(r.result === 'win' && r.tick === 2, `one cell per tick: 2 cells to the station in ${r.tick} ticks`);
  const l2 = { ...l, trains: [{ id: 0, color: 'red', depot: [0, 0], depart: 3 }] };
  ok(run(l2, NOSW).tick === 5, 'departure tick delays the train');
  const l3 = { ...l, tiles: [...l.tiles.slice(0, 2), T(2, 0, 'station', 3, { color: 'blue' })] };
  ok(run(l3, NOSW).cause === 'wrong_station', 'wrong color station crashes (wrong_station)');
  const l4 = { ...l, tiles: [...l.tiles.slice(0, 2), T(2, 0, 'buffer', 3)] };
  ok(run(l4, NOSW).cause === 'derail', 'buffer stop derails');
  const l5 = { ...l, tiles: l.tiles.slice(0, 2) };
  ok(run(l5, NOSW).cause === 'derail', 'running off the track derails');
  const l6 = { ...l, tiles: [...l.tiles.slice(0, 2), T(2, 0, 'straight', 0)] };
  ok(run(l6, NOSW).cause === 'derail', 'a tile that does not join the heading derails');
}
{ // Head-on: two depots facing each other with an even gap swap cells; odd gap collide.
  const swapL = lv([T(0, 0, 'depot', 1), T(1, 0, 'straight', 1), T(2, 0, 'straight', 1), T(3, 0, 'depot', 3)],
    [{ id: 0, color: 'red', depot: [0, 0], depart: 0 }, { id: 1, color: 'blue', depot: [3, 0], depart: 0 }]);
  const r = run(swapL, NOSW);
  ok(r.cause === 'swap' && r.tick === 2, `head-on swap detected at tick ${r.tick}`);
  const colL = lv([T(0, 0, 'depot', 1), T(1, 0, 'straight', 1), T(2, 0, 'straight', 1), T(3, 0, 'straight', 1), T(4, 0, 'depot', 3)],
    [{ id: 0, color: 'red', depot: [0, 0], depart: 0 }, { id: 1, color: 'blue', depot: [4, 0], depart: 0 }]);
  const r2 = run(colL, NOSW);
  ok(r2.cause === 'collision' && r2.crash.x === 2, `same-cell collision at (${r2.crash.x},${r2.crash.y}) tick ${r2.tick}`);
}
{ // Loop (GDD 3.10 lost): the train enters a ring through a switch's straight branch,
  // trails to the trunk, goes round and trails back in through the curved branch, forever.
  const ring = lv([
    T(0, 1, 'depot', 1), T(1, 1, 'switch', 3, { mirror: false, set: 0 }), T(2, 1, 'curve', 3),
    T(1, 0, 'curve', 1), T(2, 0, 'curve', 2),
  ], [{ id: 0, color: 'red', depot: [0, 1], depart: 0 }], { tickLimit: 12 });
  const r = run(ring, NOSW);
  ok(r.cause === 'lost' && r.tick === 12, `endless loop is lost at the tick limit (${r.cause} at ${r.tick})`);
  ok(run(ring, { switches: { '1,1': 1 } }).cause === 'lost', 'the ring switch is only ever trailed, so its setting does not matter');
}

// ---- Levels (GDD 6) ---------------------------------------------------------------
const sameRun = (a, b) => JSON.stringify(a.frames) === JSON.stringify(b.frames);

function allSetups(level) {
  const sws = switchTiles(level);
  const out = [];
  for (let m = 0; m < 1 << sws.length; m++) {
    const switches = {};
    sws.forEach((t, i) => { switches[cellKey(t.x, t.y)] = (m >> i) & 1; });
    out.push({ switches });
  }
  return out;
}

for (const level of ALL_LEVELS) {
  const tag = `${level.id} ${level.name}`;
  // Track joins up: every edge of every tile meets a neighbour with the matching edge.
  const board = buildBoard(level);
  const loose = [];
  for (const t of level.tiles) {
    if (t.x < 0 || t.y < 0 || t.x >= level.w || t.y >= level.h) loose.push(`${t.x},${t.y} off board`);
    for (const e of tileEdges(t)) {
      const n = board.get(cellKey(t.x + DX[e], t.y + DY[e]));
      if (!n || !tileEdges(n).includes(opp(e))) loose.push(`${t.x},${t.y} edge ${e}`);
    }
  }
  ok(loose.length === 0, `${tag}: all track joins up${loose.length ? ' — loose: ' + loose.join(' ') : ''}`);

  const depots = new Set(level.tiles.filter(t => t.t === 'depot').map(t => cellKey(t.x, t.y)));
  ok(level.trains.every(tr => depots.has(cellKey(tr.depot[0], tr.depot[1]))), `${tag}: every train starts in a depot`);
  for (const tr of level.trains) {
    ok(level.tiles.some(t => t.t === 'station' && t.color === tr.color), `${tag}: ${tr.color} train has a ${tr.color} station`);
  }

  const sol = { switches: { ...defaultSetup(level).switches, ...level.solution.switches } };
  const r1 = run(level, sol), r2 = run(level, sol);
  ok(r1.result === 'win', `${tag}: reference solution arrives (tick ${r1.tick}${r1.cause ? ', ' + r1.cause : ''})`);
  ok(sameRun(r1, r2), `${tag}: reference solution replays identically`);
  ok(r1.tick < level.tickLimit, `${tag}: solution length ${r1.tick} is under the tick limit ${level.tickLimit}`);
  ok(flipCount(level, sol) === level.par, `${tag}: reference solution uses par flips (${flipCount(level, sol)} = ${level.par})`);

  const d = run(level, defaultSetup(level));
  ok(d.result !== 'win', `${tag}: start setting does not win (${d.cause} at tick ${d.tick})`);

  const wins = allSetups(level).filter(s => run(level, s).result === 'win');
  const minFlips = Math.min(...wins.map(s => flipCount(level, s)));
  ok(wins.length > 0 && minFlips === level.par, `${tag}: brute force ${wins.length}/${allSetups(level).length} setups win, min flips ${minFlips} = par ${level.par}`);
}

ok(findLevel('1-3') === ALL_LEVELS[2] && findLevel('world01:level05') === ALL_LEVELS[4] && findLevel('2') === ALL_LEVELS[1], '?level= accepts "1-3", ids and indexes');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
