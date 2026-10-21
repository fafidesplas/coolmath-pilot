// World list for the level select. The vertical slice has one real level;
// the other slots show as locked.
import w1l01 from './w1l01.js';
import sandbox from './sandbox.js';

export const WORLDS = [
  { name: 'Workshop', levels: [w1l01] },
  { name: 'Scrapyard', levels: [] },
  { name: 'Power Plant', levels: [] },
];

export const LEVELS_PER_WORLD = 10;
export const DEBUG_LEVELS = { sandbox };

export function findLevel(id) {
  for (const w of WORLDS) for (const l of w.levels) if (l.id === id) return l;
  return DEBUG_LEVELS[id] || null;
}
