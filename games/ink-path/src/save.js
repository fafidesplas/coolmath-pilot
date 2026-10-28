// localStorage with versioned objects; a broken save resets to defaults (GDD 12).
// (Copied from Flip Runner and adapted.)
import { SAVE_KEY, SETTINGS_KEY } from './config.js';

const SAVE_DEFAULT = () => ({ v: 1, levels: {}, pen: { color: 'blue', style: 'marker' }, tut: {} });
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
  if (!s.levels || typeof s.levels !== 'object' || !s.tut || typeof s.tut !== 'object') return SAVE_DEFAULT();
  return s;
};
export const storeSave = s => write(SAVE_KEY, s);
export const loadSettings = () => {
  const s = read(SETTINGS_KEY, SETTINGS_DEFAULT);
  return { v: 1, music: s.music !== false, sfx: s.sfx !== false };
};
export const storeSettings = s => write(SETTINGS_KEY, s);
