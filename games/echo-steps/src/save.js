// localStorage with versioned objects (GDD 12); a broken save resets to defaults.
// (Copied from Flip Runner and adapted.)
import { SAVE_KEY, SETTINGS_KEY } from './config.js';

const SAVE_DEFAULT = () => ({ v: 1, rooms: {}, trail: 'default', tut: {} });
const SETTINGS_DEFAULT = () => ({ v: 1, music: true, sfx: true, paths: true });

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback();
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return fallback();
    return { ...fallback(), ...data };
  } catch {
    return fallback();
  }
}

function write(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* private mode or full: play on */ }
}

export const loadSave = () => {
  const s = read(SAVE_KEY, SAVE_DEFAULT);
  if (typeof s.rooms !== 'object' || s.rooms === null || typeof s.tut !== 'object' || s.tut === null) return SAVE_DEFAULT();
  return s;
};
export const storeSave = s => write(SAVE_KEY, s);
export const loadSettings = () => read(SETTINGS_KEY, SETTINGS_DEFAULT);

// ---- Room records (GDD 7, 12) ------------------------------------------------------
// A room is done once its exit star is earned; it is passed (the next room unlocks)
// when done or skipped. A skipped room has no stars until it is finished.
export const roomDone = rec => !!(rec && rec.stars && rec.stars[0]);
export const roomPassed = rec => roomDone(rec) || !!(rec && rec.skipped);

// Skip room: never overwrites a finished room.
export function markSkipped(save, id) {
  if (!roomDone(save.rooms[id])) save.rooms[id] = { stars: [0, 0, 0], skipped: true };
  return save.rooms[id];
}

// Best record after a finish (`run` = stars earned this run). Clears `skipped`.
export function mergeBest(prev, run, echoes, time) {
  const t = Math.round(time * 10) / 10;
  return {
    stars: prev && prev.stars ? prev.stars.map((v, i) => (v || run[i] ? 1 : 0)) : run.slice(),
    echoes: prev && prev.echoes !== undefined ? Math.min(prev.echoes, echoes) : echoes,
    time: prev && prev.time !== undefined ? Math.min(prev.time, t) : t,
    skipped: false,
  };
}
export const storeSettings = s => write(SETTINGS_KEY, s);
