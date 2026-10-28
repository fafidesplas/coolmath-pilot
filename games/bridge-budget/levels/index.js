// World list for the level select. The vertical slice has River levels 1–4;
// the other tiles and worlds show as locked.
import w1l01 from './w1l01.js';
import w1l02 from './w1l02.js';
import w1l03 from './w1l03.js';
import w1l04 from './w1l04.js';

export const WORLDS = [
  { name: 'River', levels: [w1l01, w1l02, w1l03, w1l04] },
  { name: 'Canyon', levels: [] },
  { name: 'Harbor', levels: [] },
];

export const LEVELS_PER_WORLD = 10;
export const LEVELS = WORLDS.flatMap(w => w.levels);

export function findLevel(id) {
  return LEVELS.find(l => l.id === id) || null;
}
