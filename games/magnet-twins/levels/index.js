// World list for the level select. The vertical slice has one real level;
// the other slots show as locked.
import w1l01 from './w1l01.js';
import w1l02 from './w1l02.js';
import w1l03 from './w1l03.js';
import w1l04 from './w1l04.js';
import w1l05 from './w1l05.js';
import w1l06 from './w1l06.js';
import w1l07 from './w1l07.js';
import w1l08 from './w1l08.js';
import w1l09 from './w1l09.js';
import w1l10 from './w1l10.js';
import sandbox from './sandbox.js';

export const WORLDS = [
  { name: 'Workshop', levels: [w1l01, w1l02, w1l03, w1l04, w1l05, w1l06, w1l07, w1l08, w1l09, w1l10] },   // the other levels are being added
  { name: 'Scrapyard', levels: [] },
  { name: 'Power Plant', levels: [] },
];

export const LEVELS_PER_WORLD = 10;
export const DEBUG_LEVELS = { sandbox };

export function findLevel(id) {
  for (const w of WORLDS) for (const l of w.levels) if (l.id === id) return l;
  return DEBUG_LEVELS[id] || null;
}
