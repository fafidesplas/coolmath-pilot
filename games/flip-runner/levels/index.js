// World list for the level select. World 1 (Crystal Cave) is complete; the other
// worlds are still empty and show as locked.
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
import proto from './proto.js';

export const WORLDS = [
  { name: 'Crystal Cave', levels: [w1l01, w1l02, w1l03, w1l04, w1l05, w1l06, w1l07, w1l08, w1l09, w1l10] },
  { name: 'Bell Tower', levels: [] },
  { name: 'Firefly Forest', levels: [] },
  { name: 'Night Fair', levels: [] },
];

export const LEVELS_PER_WORLD = 10;

// Reachable only with ?level=<id> (debug): the forms prototype (Flip → Glider → Twin).
export const DEBUG_LEVELS = { proto };

export function findLevel(id) {
  for (const w of WORLDS) for (const l of w.levels) if (l.id === id) return l;
  return DEBUG_LEVELS[id] || null;
}

// A level is open when it is the first of the game, or the one before it is done.
export function isOpen(level, done) {
  for (let w = 0; w < WORLDS.length; w++) {
    const i = WORLDS[w].levels.indexOf(level);
    if (i < 0) continue;
    if (i > 0) return !!done[WORLDS[w].levels[i - 1].id];
    if (w === 0) return true;
    const prev = WORLDS[w - 1].levels;
    return prev.length > 0 && !!done[prev[prev.length - 1].id];
  }
  return true;     // debug levels
}
