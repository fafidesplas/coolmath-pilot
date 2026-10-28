// localStorage with versioned objects; a broken save resets to defaults (GDD 12).
// (Copied from Ink Path and adapted.)
import { SAVE_KEY, SETTINGS_KEY } from './config.js';

const SAVE_DEFAULT = () => ({
  v: 1,
  levels: {},
  daily: { last: 0, streak: 0, max: 0, days: {} },
  tut: { turn: false, tip: false, spin: false, parts: false, lights: false },
});
const SETTINGS_DEFAULT = () => ({ v: 1, music: true, sfx: true });

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || data.v !== 1) return fallback();
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
  const obj = o => o && typeof o === 'object' && !Array.isArray(o);
  if (!obj(s.levels) || !obj(s.tut) || !obj(s.daily)) return SAVE_DEFAULT();
  for (const id in s.levels) {
    const r = s.levels[id];
    if (!obj(r) || typeof r.stars !== 'number' || typeof r.best !== 'number') delete s.levels[id];
  }
  return s;
};
export const storeSave = s => write(SAVE_KEY, s);
export const loadSettings = () => {
  const s = read(SETTINGS_KEY, SETTINGS_DEFAULT);
  return { v: 1, music: s.music !== false, sfx: s.sfx !== false };
};
export const storeSettings = s => write(SETTINGS_KEY, s);
