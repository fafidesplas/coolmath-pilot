// Room list for the room select (GDD 6). The vertical slice has rooms 1–3 of the Lab.
import w1l01 from './w1l01.js';
import w1l02 from './w1l02.js';
import w1l03 from './w1l03.js';

export const WORLDS = [
  { name: 'Lab', rooms: [w1l01, w1l02, w1l03] },
  { name: 'Archive', rooms: [] },
  { name: 'Core', rooms: [] },
];

export function findRoom(id) {
  for (const w of WORLDS) for (const r of w.rooms) if (r.id === id) return r;
  return null;
}

// Place of a room in its world: room 15 is world 2, level 3 (GDD 11).
export function roomPos(id) {
  for (let w = 0; w < WORLDS.length; w++) {
    const i = WORLDS[w].rooms.findIndex(r => r.id === id);
    if (i >= 0) return { world: w + 1, level: i + 1 };
  }
  return { world: 1, level: 0 };
}
