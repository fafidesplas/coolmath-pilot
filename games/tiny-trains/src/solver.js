// Runtime solver helpers (GDD 3.13 hints, 12 solver). No DOM; shared by the game and
// tools/simtest.mjs. World 1 levels have at most 5 switches, so brute force over every
// switch setup (2^n runs) is instant.
import { run, ticketStar, defaultSetup, flipCount, switchTiles, cellKey } from './sim.js';

export function allSetups(level) {
  const sws = switchTiles(level);
  const out = [];
  for (let m = 0; m < 1 << sws.length; m++) {
    const switches = {};
    sws.forEach((t, i) => { switches[cellKey(t.x, t.y)] = (m >> i) & 1; });
    out.push({ switches });
  }
  return out;
}

// Every setup that wins and earns the Ticket star: the solutions par is measured on.
const cache = new WeakMap();
export function ticketSolutions(level) {
  if (!cache.has(level)) {
    cache.set(level, allSetups(level).filter(s => ticketStar(level, run(level, s))));
  }
  return cache.get(level);
}

const distance = (a, b) => {
  let d = 0;
  for (const k in a.switches) if ((a.switches[k] | 0) !== (b.switches[k] | 0)) d++;
  return d;
};

// One hint (GDD 3.13): take the ticket solution closest to the player's setup that keeps
// every switch already locked by a hint, then reveal the one wrong switch that a train
// reaches first in that solution's run. Ties go to fewer flips, then the reference
// solution. Returns { key, value, solution } or null when the setup already solves the
// level with the ticket (nothing to reveal).
export function pickHint(level, setup, locked = {}) {
  const ref = { switches: { ...defaultSetup(level).switches, ...level.solution.switches } };
  let best = null, bestScore = null;
  for (const s of ticketSolutions(level)) {
    if (Object.keys(locked).some(k => (s.switches[k] | 0) !== (locked[k] | 0))) continue;
    const score = [distance(s, setup), flipCount(level, s), distance(s, ref)];
    const i = bestScore ? score.findIndex((v, j) => v !== bestScore[j]) : 0;
    if (!bestScore || (i >= 0 && score[i] < bestScore[i])) { best = s; bestScore = score; }
  }
  if (!best || bestScore[0] === 0) return null;
  // First tick a train enters each switch cell in the solution's run.
  const first = {};
  const r = run(level, best);
  for (const f of r.frames) {
    for (const tr of f.trains) {
      if (!tr.moved) continue;
      const k = cellKey(tr.x, tr.y);
      if (k in best.switches && !(k in first)) first[k] = f.tick;
    }
  }
  const wrong = switchTiles(level).map(t => cellKey(t.x, t.y)).filter(k => (best.switches[k] | 0) !== (setup.switches[k] | 0));
  wrong.sort((a, b) => (first[a] ?? 1e9) - (first[b] ?? 1e9));
  return { key: wrong[0], value: best.switches[wrong[0]] | 0, solution: best };
}

// Loop detection for the run's playback: the first tick at which the whole board
// (every train's state, cell and heading) repeats an earlier tick with no train left in
// its depot. From then on the run can only go round until the tick limit ("lost"), so
// the game may fast-forward it. Returns -1 when the board never repeats. The sim and the
// result are untouched; this only reads the frames.
export function loopTick(res) {
  const seen = new Set();
  for (const f of res.frames) {
    if (f.trains.some(t => t.state === 'wait')) continue;
    const key = f.trains.map(t => `${t.state}:${t.x},${t.y}:${t.inE}>${t.dir}`).join('|');
    if (seen.has(key)) return f.tick;
    seen.add(key);
  }
  return -1;
}
