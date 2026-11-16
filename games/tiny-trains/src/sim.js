// The deterministic tick simulation (GDD 3.2, 3.3, 3.9, 3.10, 12).
// No DOM, no randomness, integers only. Shared by the game and tools/simtest.mjs.
//
// One tick: every running train advances one cell (all at once), then trains whose
// departure tick has come appear on their depot cell, then crashes are checked.
// Crash order is fixed (per-train derail / wrong station in train-id order, then
// head-on swaps, then same-cell collisions), so a setup always gives the same result.
import { DX, DY, opp, tileEdges, exitEdge } from './track.js';

export const cellKey = (x, y) => `${x},${y}`;
export const DEFAULT_TICK_LIMIT = 60;

export function buildBoard(level) {
  const board = new Map();
  for (const t of level.tiles) board.set(cellKey(t.x, t.y), t);
  return board;
}

export function switchTiles(level) {
  return level.tiles.filter(t => t.t === 'switch').sort((a, b) => a.y - b.y || a.x - b.x);
}

// Setup = the player's switch settings, { switches: { "x,y": 0|1 } }.
export function defaultSetup(level) {
  const switches = {};
  for (const t of switchTiles(level)) switches[cellKey(t.x, t.y)] = t.set | 0;
  return { switches };
}

// Flip count = switches whose setting differs from the level's start (net changes, GDD 3.5).
// The Ticket star (GDD 3.12): a winning run that collects the ticket, or any win on a
// level without one.
export const ticketStar = (level, res) => res.result === 'win' && (!level.ticket || res.ticket);

export function flipCount(level, setup) {
  let n = 0;
  for (const t of switchTiles(level)) if ((setup.switches[cellKey(t.x, t.y)] | 0) !== (t.set | 0)) n++;
  return n;
}

export function createSim(level, setup) {
  const s = {
    level,
    board: buildBoard(level),
    sw: { ...setup.switches },
    tick: 0,
    tickLimit: level.tickLimit || DEFAULT_TICK_LIMIT,
    trains: level.trains.map(tr => ({
      id: tr.id, color: tr.color, depart: tr.depart, depot: tr.depot,
      state: 'wait',          // wait | run | home | crash
      x: -1, y: -1, inE: 0, dir: 0,
      px: -1, py: -1, moved: false, cause: null,
    })),
    events: [],
    crash: null,
    ticket: null,             // { id, tick } of the train that collected the golden ticket (GDD 3.11)
    done: false,
    result: null,             // 'win' | 'crash'
  };
  spawn(s);
  return s;
}

function spawn(s) {
  for (const tr of s.trains) {
    if (tr.state !== 'wait' || tr.depart !== s.tick) continue;
    const d = s.board.get(cellKey(tr.depot[0], tr.depot[1]));
    tr.state = 'run';
    tr.x = tr.px = d.x; tr.y = tr.py = d.y;
    tr.dir = d.rot & 3; tr.inE = opp(tr.dir);
    s.events.push({ type: 'depart', id: tr.id });
  }
}

export function step(s) {
  if (s.done) return s;
  s.tick++;
  s.events = [];
  const crashes = [];
  for (const tr of s.trains) { tr.px = tr.x; tr.py = tr.y; tr.moved = false; }

  for (const tr of s.trains) {
    if (tr.state !== 'run') continue;
    const nx = tr.x + DX[tr.dir], ny = tr.y + DY[tr.dir], inE = opp(tr.dir);
    const t = s.board.get(cellKey(nx, ny));
    if (!t || !tileEdges(t).includes(inE) || t.t === 'buffer' || t.t === 'depot') {
      tr.state = 'crash'; tr.cause = 'derail';
      crashes.push({ cause: 'derail', x: nx, y: ny, ids: [tr.id] });
      continue;
    }
    tr.x = nx; tr.y = ny; tr.inE = inE; tr.moved = true;
    // Golden ticket (GDD 3.11): the first train through its cell collects it.
    const tk = s.level.ticket;
    if (tk && !s.ticket && tk[0] === nx && tk[1] === ny) {
      s.ticket = { id: tr.id, tick: s.tick };
      s.events.push({ type: 'ticket', id: tr.id, x: nx, y: ny });
    }
    if (t.t === 'station') {
      tr.dir = opp(inE);
      if (t.color === tr.color) {
        tr.state = 'home';
        s.events.push({ type: 'arrive', id: tr.id, x: nx, y: ny });
      } else {
        tr.state = 'crash'; tr.cause = 'wrong_station';
        crashes.push({ cause: 'wrong_station', x: nx, y: ny, ids: [tr.id] });
      }
      continue;
    }
    tr.dir = exitEdge(t, inE, s.sw[cellKey(nx, ny)] | 0);
  }

  spawn(s);

  // Head-on swap: two trains trade cells in one tick.
  const movers = s.trains.filter(tr => tr.moved);
  for (let i = 0; i < movers.length; i++) {
    for (let j = i + 1; j < movers.length; j++) {
      const a = movers[i], b = movers[j];
      if (a.x === b.px && a.y === b.py && b.x === a.px && b.y === a.py) {
        for (const tr of [a, b]) { tr.state = 'crash'; tr.cause = tr.cause || 'swap'; }
        crashes.push({ cause: 'swap', x: a.x, y: a.y, x2: b.x, y2: b.y, ids: [a.id, b.id] });
      }
    }
  }

  // Same cell: every train on the board this tick (running, just arrived, just crashed).
  // (A derailed train stays on its last cell; crashes only happen this tick, since a crash ends the run.)
  const onBoard = s.trains.filter(tr => tr.state === 'run' || tr.state === 'crash' || (tr.state === 'home' && tr.moved));
  const seen = new Map();
  for (const tr of onBoard) {
    const k = cellKey(tr.x, tr.y);
    const other = seen.get(k);
    if (other) {
      for (const t2 of [other, tr]) { if (t2.state !== 'crash') { t2.state = 'crash'; t2.cause = 'collision'; } }
      crashes.push({ cause: 'collision', x: tr.x, y: tr.y, ids: [other.id, tr.id] });
    } else seen.set(k, tr);
  }

  if (crashes.length) {
    s.crash = { ...crashes[0], tick: s.tick };
    s.done = true; s.result = 'crash';   // a crash freezes every train where it is
    return s;
  }
  if (s.trains.every(tr => tr.state === 'home')) {
    s.done = true; s.result = 'win';
    return s;
  }
  if (s.tick >= s.tickLimit) {
    const tr = s.trains.find(t => t.state === 'run') || s.trains[0];
    s.crash = { cause: 'lost', x: tr.x, y: tr.y, ids: s.trains.filter(t => t.state === 'run').map(t => t.id), tick: s.tick };
    s.done = true; s.result = 'crash';
  }
  return s;
}

function snapshot(s) {
  return {
    tick: s.tick,
    trains: s.trains.map(tr => ({ id: tr.id, state: tr.state, x: tr.x, y: tr.y, px: tr.px, py: tr.py, inE: tr.inE, dir: tr.dir, moved: tr.moved, cause: tr.cause })),
    events: s.events.slice(),
    crash: s.crash,
    ticket: s.ticket ? s.ticket.id : -1,
  };
}

// Plays a whole run. `frames[k]` is the board at tick k; the renderer interpolates
// between frames[k] and frames[k + 1].
export function run(level, setup) {
  const s = createSim(level, setup);
  const frames = [snapshot(s)];
  while (!s.done) { step(s); frames.push(snapshot(s)); }
  return {
    result: s.result,
    cause: s.crash ? s.crash.cause : null,
    tick: s.tick,
    crash: s.crash,
    ticket: !!s.ticket,       // the ticket was collected during this run
    frames,
  };
}
