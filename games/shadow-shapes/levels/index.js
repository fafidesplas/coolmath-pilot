// Rooms for the book (GDD 6). The vertical slice has Attic levels 1–3; the other
// frames and rooms show as locked.
import w1l01 from './w1l01.js';
import w1l02 from './w1l02.js';
import w1l03 from './w1l03.js';

export const ROOMS = [
  { name: 'Attic', levels: [w1l01, w1l02, w1l03] },
  { name: 'Museum', levels: [] },
  { name: 'Theater', levels: [] },
  { name: 'Observatory', levels: [] },
];

export const LEVELS_PER_ROOM = 10;
export const LEVELS = ROOMS.flatMap(r => r.levels);
export const findLevel = id => LEVELS.find(l => l.id === id) || null;
