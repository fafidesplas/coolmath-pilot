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
export const storeSettings = s => write(SETTINGS_KEY, s);
