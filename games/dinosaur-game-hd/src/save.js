// The save, one localStorage key (GDD 12). A broken or old save resets to the
// defaults, field by field, and never crashes the game.
import { RUNNER_IDS } from './config.js';

const KEY = 'cm_dinosaur-game-hd_save';

export const defaults = () => ({
  v: 1, best: 0, eggs: 0, flights: 0, totalEggs: 0, totalDistance: 0, totalNights: 0, versusWins: 0,
  unlocked: ['trex'], equipped: 'trex', p2Runner: 'trex',
  daily: { lastDate: null, streak: 0, best: 0, bestEggs: 0 },
  firstRunDone: false,
  tutorial: { jump: false, duck: false, done: false },
  settings: { sfx: true },
});

// Keep each saved field only if it has the default's type.
function merge(def, saved) {
  if (!saved || typeof saved !== 'object') return def;
  for (const k of Object.keys(def)) {
    const d = def[k], s = saved[k];
    if (d && typeof d === 'object' && !Array.isArray(d)) def[k] = merge(d, s);
    else if (Array.isArray(d) ? Array.isArray(s) : (d === null || typeof s === typeof d)) {
      if (s !== undefined) def[k] = s;
    }
  }
  return def;
}

// Only known runners stay unlocked, the T-Rex always is, and the equipped
// runner must be an unlocked one.
function check(data) {
  data.unlocked = ['trex', ...new Set(data.unlocked.filter(id => id !== 'trex' && RUNNER_IDS.includes(id)))];
  if (!data.unlocked.includes(data.equipped)) data.equipped = 'trex';
  if (!data.unlocked.includes(data.p2Runner)) data.p2Runner = 'trex';
  return data;
}

export function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved && saved.v === 1 ? check(merge(defaults(), saved)) : defaults();
  } catch {
    return defaults();
  }
}

export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* private mode or full: play on */ }
}
