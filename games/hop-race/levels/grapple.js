/*
    HOP RACE - World 3, Grapple (GDD §6). Coordinates are centered on the level box:
    a size 24 level spans x -12..12 and y -6.75..6.75. Solids are {l, r, top, bottom?}.
    Pillars hang from the top of the level box (top above the box, so they are drawn to the screen edge);
    they stay out of the HUD's spots (x -2.5..2.5 at the top center, and the top right).
    Where floor runs past the flag with no pillar in reach, a thin ceiling under the HUD (top 1.5 u clear) gives
    the hook something to grab, so a player who overshoots can swing back.
    par / expert are placeholders from simulated runs; set them from designer runs.
*/

'use strict';

HR_LEVELS.grapple = [
    {
        id: 'grapple-01', name: 'Swing By',
        size: 24,
        start: {x: -11, y: -4},
        solids: [
            {l: -13, r: -8.5, top: -4},
            {l: -5.5, r: 13, top: -4},
            {l: -4.5, r: -2.5, top: 9, bottom: 1},   // the pillar over the pit's far edge, left of the HUD timer
            {l: 2.5, r: 13, top: 5.25, bottom: 4.75},   // ceiling: something to hook if you end up past the flag
        ],
        flag: {x: 7, y: -4},
        prompt: 'Hold to reel in. Let go to fly.',
        promptAt: {x: 0, y: -1.5},   // under the pillar, which would hide ink text at the default height
        par: 7.0, expert: 4.0,
    },
    {
        id: 'grapple-02', name: 'Two Pillars',
        size: 26,
        start: {x: -11, y: -4},
        solids: [
            {l: -14, r: -8, top: -4},
            {l: 6, r: 14, top: -4},
            {l: -6, r: -4.5, top: 9, bottom: 1.5},
            {l: 3, r: 4.5, top: 9, bottom: 2},
        ],
        flag: {x: 10.5, y: -4},
        par: 8.0, expert: 4.5,
    },
    {
        id: 'grapple-03', name: 'Let Go',
        size: 28,
        start: {x: -12, y: -4},
        solids: [
            {l: -15, r: -9, top: -4},
            {l: -1, r: 15, top: -4},
            {l: -6.5, r: -5, top: 9, bottom: 2},
            {l: 2.5, r: 15, top: 6.375, bottom: 5.875},   // ceiling: something to hook if you end up past the flag
        ],
        flag: {x: 10, y: -4},
        par: 8.0, expert: 4.5,
    },
];
