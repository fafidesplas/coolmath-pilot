// World list for the level select. The vertical slice has levels 1–3 of the
// Notebook; the other tiles and worlds show as locked.
import w1l01 from './w1l01.js';
import w1l02 from './w1l02.js';
import w1l03 from './w1l03.js';

export const WORLDS = [
  { name: 'Notebook', levels: [w1l01, w1l02, w1l03] },
  { name: 'Kitchen', levels: [] },
  { name: 'Garden', levels: [] },
  { name: 'Space', levels: [] },
];

export const LEVELS_PER_WORLD = 10;
export const LEVELS = WORLDS.flatMap(w => w.levels);

export function findLevel(id) {
  return LEVELS.find(l => l.id === id) || null;
}
