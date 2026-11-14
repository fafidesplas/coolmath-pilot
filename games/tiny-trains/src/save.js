// localStorage save (GDD 12): { v: 1, levels: { id: { stars, bestFlips } }, settings }.
// A broken save resets to defaults, never crashes. (Adapted from Echo Steps.)
import { SAVE_KEY } from './config.js';

const DEFAULT = () => ({ v: 1, levels: {}, settings: { music: false, sfx: true } });

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return DEFAULT();
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || typeof data.levels !== 'object' || data.levels === null) return DEFAULT();
    return { ...DEFAULT(), ...data, settings: { ...DEFAULT().settings, ...(data.settings || {}) } };
  } catch {
    return DEFAULT();
  }
}

export function storeSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* private mode or full: play on */ }
}
