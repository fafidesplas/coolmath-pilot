// Headless checks of the track tables and the tick sim against GDD.md, then every
// level: track joins up, the reference solution arrives and replays identically,
// the start setting does not win, and brute force over all switch setups agrees
// with the level's par.
//   node tools/simtest.mjs
import { tileEdges, exitEdge, switchArms, DX, DY, opp } from '../src/track.js';
import { run, ticketStar, defaultSetup, flipCount, switchTiles, cellKey, buildBoard } from '../src/sim.js';
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

{ // Golden ticket (GDD 3.11, 3.12): the first train through the cell collects it; it
  // only earns the Ticket star in a winning run.
  const l = lv([T(0, 0, 'depot', 1), T(1, 0, 'straight', 1), T(2, 0, 'straight', 1), T(3, 0, 'station', 3, { color: 'red' })],
    [{ id: 0, color: 'red', depot: [0, 0], depart: 0 }, { id: 1, color: 'red', depot: [0, 0], depart: 2 }], { ticket: [1, 0] });
  const r = run(l, NOSW);
  const ev = r.frames.flatMap(f => f.events).filter(e => e.type === 'ticket');
  ok(r.result === 'win' && r.ticket && ev.length === 1 && ev[0].id === 0, 'the first train through the ticket cell collects it, once');
  ok(r.frames[0].ticket === -1 && r.frames[1].ticket === 0, 'frames record when the ticket is collected');
  ok(ticketStar(l, r) && !ticketStar({ ...l, ticket: [5, 5] }, run({ ...l, ticket: [5, 5] }, NOSW)), 'Ticket star needs the ticket when the level has one');
  ok(ticketStar({ ...l, ticket: undefined }, run({ ...l, ticket: undefined }, NOSW)), 'Ticket star comes with the solve on a level without a ticket');
  const lb = { ...l, tiles: [...l.tiles.slice(0, 3), T(3, 0, 'buffer', 3)] };
  ok(!ticketStar(lb, run(lb, NOSW)), 'collecting the ticket in a run that crashes earns nothing');
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

  if (level.ticket) {
    const tt = board.get(cellKey(level.ticket[0], level.ticket[1]));
    ok(!!tt && !['station', 'depot', 'buffer'].includes(tt.t), `${tag}: golden ticket sits on a track cell (${level.ticket})`);
  }
  ok(ticketStar(level, r1), `${tag}: reference solution earns the Ticket star${level.ticket ? ' (collects the ticket)' : ' (no ticket on this level)'}`);

  const d = run(level, defaultSetup(level));
  ok(d.result !== 'win', `${tag}: start setting does not win (${d.cause} at tick ${d.tick})`);

  // Par (GDD 3.12) = minimum flip count over the wins that also earn the Ticket star.
  const all = allSetups(level).map(s => ({ s, r: run(level, s) }));
  const wins = all.filter(o => o.r.result === 'win');
  const tWins = wins.filter(o => ticketStar(level, o.r));
  const minFlips = Math.min(...tWins.map(o => flipCount(level, o.s)));
  ok(tWins.length > 0 && minFlips === level.par,
    `${tag}: brute force ${wins.length}/${all.length} setups win, ${tWins.length} with the ticket, min flips ${minFlips} = par ${level.par}`);
}

// Design intent per level (GDD 6).
{
  const L6 = findLevel('1-6');
  if (L6) {
    const set = sw => ({ switches: { ...defaultSetup(L6).switches, ...sw } });
    const bothLong = run(L6, set({ '1,1': 1, '4,2': 0, '4,3': 1, '2,2': 1 }));
    ok(bothLong.cause === 'collision' || bothLong.cause === 'swap', `1-6: both trains on the long way crash head-on (${bothLong.cause})`);
    const redShort = run(L6, set({ '1,1': 0 }));
    ok(redShort.result === 'win' && !redShort.ticket && flipCount(L6, set({ '1,1': 0 })) === 1, '1-6: red on the short way wins in 1 flip but misses the ticket');
    const scenic = run(L6, set(L6.solution.switches));
    ok(scenic.ticket && scenic.frames.flatMap(f => f.events).find(e => e.type === 'ticket').id === 0, '1-6: red collects the ticket on the scenic route');
  }
  const L8 = findLevel('1-8');
  if (L8) {
    const r = run(L8, { switches: { ...defaultSetup(L8).switches, '2,2': 1 } });
    ok(r.cause === 'swap', `1-8: red straight on along blue's line meets blue head-on (${r.cause})`);
  }
  const L9 = findLevel('1-9');
  if (L9) {
    const set = sw => ({ switches: { ...defaultSetup(L9).switches, ...sw } });
    const d = run(L9, defaultSetup(L9));
    const last = d.frames[d.frames.length - 1].trains;
    ok(d.cause === 'lost' && d.tick === L9.tickLimit && last.every(t => t.state === 'run'),
      `1-9: the start setting sends both trains round the ring until the tick limit (${d.cause} at ${d.tick})`);
    // A train on the ring keeps coming back to the same cell: red passes (2,1) every 8 ticks.
    const redAt21 = d.frames.filter(f => f.trains[0].x === 2 && f.trains[0].y === 1).map(f => f.tick);
    ok(redAt21.length >= 3 && redAt21.every((t, i) => !i || t - redAt21[i - 1] === 8), `1-9: red laps the 8-cell ring (at (2,1) on ticks ${redAt21.join(', ')})`);
    ok(run(L9, set({ '5,0': 0 })).cause === 'lost', '1-9: fixing blue alone leaves red lost on the ring');
    ok(run(L9, set({ '5,2': 0 })).cause === 'wrong_station', '1-9: opening the ring with blue on it sends blue to the red station');
    const short = run(L9, set({ '5,0': 0, '2,3': 0 }));
    ok(short.result === 'win' && !short.ticket, '1-9: red can skip the ring (2 flips, no ticket)');
    ok(['2,2', '5,1', '5,3'].every(k => { const s = set({ ...L9.solution.switches, [k]: 1 - (defaultSetup(L9).switches[k]) }); return run(L9, s).result === 'win'; }),
      '1-9: the trailed ring switches (2,2), (5,1), (5,3) never change the result');
  }
  const L10 = findLevel('1-10');
  if (L10) {
    const set = sw => ({ switches: { ...defaultSetup(L10).switches, ...sw } });
    const reds = L10.trains.filter(t => t.color === 'red');
    ok(reds.length === 2 && L10.tiles.filter(t => t.t === 'station' && t.color === 'red').length === 1, '1-10: two red trains, one red station');
    const blueOnly = run(L10, set({ '7,4': 0 }));
    const homes = blueOnly.frames.flatMap(f => f.events.filter(e => e.type === 'arrive').map(e => ({ ...e, tick: f.tick })));
    ok(blueOnly.result === 'win' && !blueOnly.ticket && homes.filter(e => e.x === 8 && e.y === 2).length === 2,
      '1-10: both reds arrive at the shared station (fix blue: 1 flip, no ticket)');
    const r1Long = run(L10, set({ '7,4': 0, '1,1': 1 }));
    ok(r1Long.cause === 'collision' && r1Long.crash.x === 7 && r1Long.crash.y === 2, `1-10: both reds on their detours meet at the merge (${r1Long.cause} at ${r1Long.crash.x},${r1Long.crash.y})`);
    const bothShort = run(L10, set({ '7,4': 0, '1,2': 0 }));
    ok(bothShort.cause === 'collision' && bothShort.crash.x === 7, '1-10: both reds on their short lines meet at the merge too');
  }
}

ok(['1-6', '1-7', '1-8', '1-9'].every((r, i) => findLevel(r) === ALL_LEVELS[5 + i] && findLevel(`world01:level0${6 + i}`) === ALL_LEVELS[5 + i]),
  '?level= opens 1-6 to 1-9 by label and by id');
ok(findLevel('1-10') === ALL_LEVELS[9] && findLevel('world01:level10') === ALL_LEVELS[9] && findLevel('10') === ALL_LEVELS[9],
  '?level= opens 1-10 by label, id and index');
ok(findLevel('1-3') === ALL_LEVELS[2] && findLevel('world01:level05') === ALL_LEVELS[4] && findLevel('2') === ALL_LEVELS[1], '?level= accepts "1-3", ids and indexes');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
