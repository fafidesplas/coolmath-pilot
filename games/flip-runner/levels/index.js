// World list for the level select. The vertical slice has one real level;
// the other slots show as locked.
import w1l01 from './w1l01.js';
import proto from './proto.js';

export const WORLDS = [
  { name: 'Crystal Cave', levels: [w1l01, proto] },   // proto: forms prototype, not a final level
  { name: 'Bell Tower', levels: [] },
  { name: 'Firefly Forest', levels: [] },
  { name: 'Night Fair', levels: [] },
];

export const LEVELS_PER_WORLD = 10;

export function findLevel(id) {
  for (const w of WORLDS) for (const l of w.levels) if (l.id === id) return l;
  return null;
}
