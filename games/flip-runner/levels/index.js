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
import w2l01 from './w2l01.js';
import w2l02 from './w2l02.js';
import w2l03 from './w2l03.js';
import w2l04 from './w2l04.js';
import w2l05 from './w2l05.js';
import w2l06 from './w2l06.js';
import w2l07 from './w2l07.js';
import w2l08 from './w2l08.js';
import w2l09 from './w2l09.js';
import w2l10 from './w2l10.js';
import w3l01 from './w3l01.js';
import w3l02 from './w3l02.js';
import w3l03 from './w3l03.js';
import w3l04 from './w3l04.js';
import w3l05 from './w3l05.js';
import w3l06 from './w3l06.js';
import w3l07 from './w3l07.js';
import w3l08 from './w3l08.js';
import w3l09 from './w3l09.js';
import w3l10 from './w3l10.js';
import w4l01 from './w4l01.js';
import w4l02 from './w4l02.js';
import w4l03 from './w4l03.js';
import w4l04 from './w4l04.js';
import w4l05 from './w4l05.js';
import w4l06 from './w4l06.js';
import w4l07 from './w4l07.js';
import w4l08 from './w4l08.js';
import w4l09 from './w4l09.js';
import w4l10 from './w4l10.js';
import proto from './proto.js';

export const WORLDS = [
  { name: 'Crystal Cave', levels: [w1l01, w1l02, w1l03, w1l04, w1l05, w1l06, w1l07, w1l08, w1l09, w1l10] },
  { name: 'Bell Tower', levels: [w2l01, w2l02, w2l03, w2l04, w2l05, w2l06, w2l07, w2l08, w2l09, w2l10] },
  { name: 'Firefly Forest', levels: [w3l01, w3l02, w3l03, w3l04, w3l05, w3l06, w3l07, w3l08, w3l09, w3l10] },
  { name: 'Night Fair', levels: [w4l01, w4l02, w4l03, w4l04, w4l05, w4l06, w4l07, w4l08, w4l09, w4l10] },
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
