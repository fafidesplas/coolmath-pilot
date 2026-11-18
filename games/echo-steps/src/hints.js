// Hints and skip (GDD 7). Hint paths are never drawn by hand: the room's reference
// solution (levels/solutions/<id>.json) is replayed through the real sim, and the
// echo-only forecast of its final loop gives each echo's whole path, rests and
// drops included. Hint k (1-based) shows echo k; the last hint shows the live
// route of the winning loop. No DOM, so tools/simtest.mjs uses the same code.
import { HZ } from './config.js';
import { parseLevel } from './level.js';
import { Sim } from './sim.js';
import { Forecast } from './forecast.js';
import { decodeRecording } from './record.js';

export const HINT_RULES = {
  time: 60,        // s of room time before the 💡 appears
  loops: 8,        // or this many loops played
  skipTime: 180,   // s of room time before Skip room is offered
};

// st = { steps, loops, shown, demo }: room-time steps and loops played in this room
// (counted across restarts), hints shown so far, ?hints=now demo flag.
export const hintsUnlocked = st => !!st.demo || st.steps >= HINT_RULES.time * HZ || st.loops >= HINT_RULES.loops;
export const skipUnlocked = (st, total) => !!st.demo || st.steps >= HINT_RULES.skipTime * HZ || (total > 0 && st.shown >= total);

// Last index where a path still moves (so a ghost can stop once its echo has
// come to rest, including a drop after a mid-air rest).
function settle(x, y, len) {
  let last = 0;
  for (let c = 1; c < len; c++) if (x[c] !== x[c - 1] || y[c] !== y[c - 1]) last = c;
  return last;
}

// Returns { echoes: [{ x, y, hold, tapeLen, end, early }], live: { x, y, len }, total }
// for one room. x / y are Float32Arrays of body top-left positions per loop step.
export function buildHints(data, rec) {
  const lv = parseLevel(data);
  const sim = new Sim(lv, { events: false });
  for (const bits of decodeRecording(rec)) { sim.step(bits); if (sim.s.done) break; }
  if (!sim.s.done) throw new Error(`${data.id}: reference solution does not reach the exit`);
  const fc = new Forecast(sim).run();
  const L = lv.loopSteps, echoes = [];
  for (let k = 0; k < sim.s.count; k++) {
    const p = fc.paths[k], tapeLen = sim.tapes[k].len;
    const x = p.x.slice(0, L), y = p.y.slice(0, L);
    echoes.push({ x, y, hold: p.hold.slice(0, L), tapeLen, end: Math.max(tapeLen - 1, settle(x, y, L)), early: tapeLen < L });
  }
  const last = sim.last, n = last.len;
  const live = { x: last.live.x.slice(0, n), y: last.live.y.slice(0, n), len: n };
  return { id: data.id, echoes, live, total: echoes.length + 1 };
}
