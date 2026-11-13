/*
    HOP RACE - shared constants: palette, worlds, unlock rule.
    All game globals are prefixed hr / HR_ so they never collide with LittleJS globals.
*/

'use strict';

const hrHex = hex => new Color().setHex(hex);

// GDD §9: 7 colors in all, at most 5 on screen at once
const HR_INK    = hrHex('#1D1A22');
const HR_WHITE  = hrHex('#FFFFFF');
const HR_BLUE   = hrHex('#2E5BFF');
const HR_RED    = hrHex('#E5262B');
const HR_YELLOW = hrHex('#FFC94A');
const HR_CORAL  = hrHex('#FF8C69');
const HR_TEAL   = hrHex('#7FD1C7');

const HR_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const HR_FONT_STYLE = '800';

// GDD §11 world ids; `ready` worlds have levels in levels/<id>.js; verb goes in the start prompt ("P1: Press A to run")
// hidden worlds (GDD §13 Rejected) keep their code but have no levels anywhere
const HR_WORLDS = [
    {id: 'hop',     name: 'Hop',     verb: 'run',   ga: 'world01', bg: HR_YELLOW, hint: 'Press: jump · Hold: higher'},
    {id: 'rocket',  name: 'Rocket',  verb: 'blast', ga: 'world02', bg: HR_CORAL,  hint: 'Hold: aim · Release: blast'},
    {id: 'grapple', name: 'Grapple', verb: 'hook',  ga: 'world03', bg: HR_TEAL,   hint: 'Hold: reel in · Release: fly'},
    {id: 'phase',   name: 'Phase',   verb: 'melt',  ga: 'world04', bg: HR_YELLOW, hint: 'Press: next state', hidden: true},
    {id: 'climb',   name: 'Climb',   verb: 'swing', ga: 'world05', bg: HR_CORAL,  hint: 'Hold: swing · Release: stop'},   // grew from a Lab world
    {id: 'leap',    name: 'Leap',    verb: 'leap',  ga: 'world06', bg: HR_YELLOW, hint: 'Hold: charge · Release: leap', hidden: true},  // Hop's old charge hop (2026-11-13); hidden for now (owner, 2026-11-13)
    // Lab worlds (GDD §13.1) go here with lab: true: feel tests of new button meanings, 3 levels each
];
const HR_LEVELS_PER_WORLD = 10;

// level data files add their worlds here (HR_LEVELS.hop = [...]); a world's Versus levels, if it has its own
// (mirrored: P2 starts on the mirror side, the flag in the middle, GDD §3.1), go in HR_VERSUS.<world>
const HR_LEVELS = {};
const HR_VERSUS = {};

let   HR_PSIZE  = 1.4;   // player square size (u); let, so the debug panel (tools/debug.js) can tune it live
const HR_MARGIN = .5;    // camera margin around the level box (u)

// GDD §7: every unlock check goes through isUnlocked(); switch the rule to gate later
const HR_UNLOCK_RULE = 'all';   // 'all' | 'linear'

// levels marked draft: true, and every level of a hidden world, are hidden everywhere (level select, Play, window.game.start).
// Versus plays the world's own Versus levels when it has them, its solo levels otherwise
function hrLevelsOf(worldIndex, versus = hrVersus)
{
    const world = HR_WORLDS[worldIndex];
    return world.hidden ? [] : ((versus && HR_VERSUS[world.id]) || HR_LEVELS[world.id] || []).filter(l => !l.draft);
}
const hrHasVersusLevels = worldIndex => !!HR_VERSUS[HR_WORLDS[worldIndex].id];

// the world's number as players see it (1-based, hidden worlds skipped)
function hrWorldNumber(worldIndex) { return HR_WORLDS.slice(0, worldIndex + 1).filter(w => !w.hidden).length; }

function isUnlocked(worldIndex, levelIndex, versus = hrVersus)
{
    if (!hrLevelsOf(worldIndex, versus)[levelIndex]) return false;   // not built yet
    if (HR_UNLOCK_RULE == 'all' || versus) return true;
    if (levelIndex == 0) return true;
    return hrSaveLevel(hrLevelsOf(worldIndex)[levelIndex - 1].id).bestMs > 0;   // 'linear': finish the one before
}
