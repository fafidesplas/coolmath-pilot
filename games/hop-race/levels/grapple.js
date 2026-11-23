/*
    HOP RACE - World 3, Grapple (GDD §6). Coordinates are centered on the level box:
    a size 24 level spans x -12..12 and y -6.75..6.75. Solids are {l, r, top, bottom?}.
    Pillars hang from the top of the level box (top above the box, so they are drawn to the screen edge);
    they stay out of the HUD's spots (x -2.5..2.5 at the top center, and the top right).
    Where floor runs past the finish with no pillar in reach, a thin ceiling under the HUD (top 1.5 u clear) gives
    the hook something to grab, so a player who overshoots can swing back.
*/

'use strict';

HR_LEVELS.grapple = [
    {
        id: 'grapple-01', name: 'Swing By',
        size: 24,
        start: {x: -11, y: -4},
        solids: [
            {l: -13, r: -8.5, top: -4},
            {l: -5.5, r: 6.25, top: -4},
            {l: -4.5, r: -2.5, top: 9, bottom: 1},   // the pillar over the pit's far edge, left of the HUD timer
            {l: 2.5, r: 13, top: 5.25, bottom: 4.75},   // ceiling: something to hook if you end up past the finish
            {l: 6.25, r: 13, top: -4, finish: true},
        ],
        prompt: 'Hold to reel in. Let go to fly.',
        promptAt: {x: 0, y: -1.5},   // under the pillar, which would hide ink text at the default height
    },
    {
        id: 'grapple-02', name: 'Two Pillars',
        size: 26,
        start: {x: -11, y: -4},
        solids: [
            {l: -14, r: -8, top: -4},
            {l: 6, r: 9.75, top: -4},
            {l: -6, r: -4.5, top: 9, bottom: 1.5},
            {l: 3, r: 4.5, top: 9, bottom: 2},
            {l: 9.75, r: 14, top: -4, finish: true},
        ],
    },
    {
        id: 'grapple-03', name: 'Let Go',
        size: 28,
        start: {x: -12, y: -4},
        solids: [
            {l: -15, r: -9, top: -4},
            {l: -1, r: 9.25, top: -4},
            {l: -6.5, r: -5, top: 9, bottom: 2},
            {l: -5, r: 14.5, top: 7.875, bottom: 7.125},   // ceiling: something to hook if you end up past the finish
            {l: 9.25, r: 15, top: -4, finish: true},
        ],
    },
];

// Versus, stacked (GDD §6; owner, 2026-11-23): solids are P1's lane, the top half of the level box (y 0.5 to 9.125 at
// size 36); P2 races the same lane one floor down. Both start on the left and finish on the right
HR_VERSUS.grapple = [
    {
        id: 'grapple-vs-01', name: 'Bunk Beds',
        stack: true,
        size: 36,
        start: {x: -15.5, y: 2},
        solids: [
            {l: -19, r: -12, top: 2},
            {l: -5, r: 1, top: 2},
            {l: 8, r: 12, top: 2},
            {l: -9.5, r: -8, top: 9.125, bottom: 5.5},   // pillars over the pits; the lane's ceiling holds a hook too
            {l: 4, r: 5.5, top: 9.125, bottom: 5.5},
            {l: 12, r: 19, top: 2, finish: true},
        ],
    },
];
