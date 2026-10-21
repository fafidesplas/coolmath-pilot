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

// GDD §11 world ids; `ready` worlds have levels in levels/<id>.js
const HR_WORLDS = [
    {id: 'hop',     name: 'Hop',     ga: 'world01', bg: HR_YELLOW, hint: 'Hold: charge · Release: hop'},
    {id: 'rocket',  name: 'Rocket',  ga: 'world02', bg: HR_CORAL,  hint: 'Press: blast'},
    {id: 'grapple', name: 'Grapple', ga: 'world03', bg: HR_TEAL,   hint: 'Hold: reel in · Release: fly'},
    {id: 'phase',   name: 'Phase',   ga: 'world04', bg: HR_YELLOW, hint: 'Press: next state'},
];
const HR_LEVELS_PER_WORLD = 10;

// level data files add their worlds here (HR_LEVELS.hop = [...])
const HR_LEVELS = {};

const HR_PSIZE  = .8;    // player square size (u)
const HR_MARGIN = .5;    // camera margin around the level box (u)

// GDD §7: every unlock check goes through isUnlocked(); switch the rule to gate later
const HR_UNLOCK_RULE = 'all';   // 'all' | 'linear' | 'stars'

function hrLevelsOf(worldIndex) { return HR_LEVELS[HR_WORLDS[worldIndex].id] || []; }

function isUnlocked(worldIndex, levelIndex)
{
    if (!hrLevelsOf(worldIndex)[levelIndex]) return false;   // not built yet
    if (HR_UNLOCK_RULE == 'all') return true;
    if (levelIndex == 0) return true;
    const prev = hrSaveLevel(hrLevelsOf(worldIndex)[levelIndex - 1].id);
    if (HR_UNLOCK_RULE == 'linear') return prev.stars > 0;
    return hrStarTotal() >= levelIndex * 2;   // 'stars': placeholder threshold, tune if it is ever used
}
