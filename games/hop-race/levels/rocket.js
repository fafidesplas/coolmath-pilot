/*
    HOP RACE - World 2, Rocket (GDD §6). Coordinates are centered on the level box:
    a size 24 level spans x -12..12 and y -6.75..6.75. Solids are {l, r, top, bottom?, ice?, sticky?}.
    Gates are {solid: {l, r, top, bottom}, button: {x, y}}. Gate levels have a thin ceiling just under
    the HUD (top 1.5 u stays clear), so the only way past a gate is its button.
    Levels 4-10 are drafts (draft: true): hidden until 1-3 have been played and the mode is tuned.
*/

'use strict';

HR_LEVELS.rocket = [
    {
        id: 'rocket-01', name: 'Blast Off',
        size: 24,
        start: {x: -9, y: -4},
        solids: [
            {l: -13, r: 13, top: -4},
            {l: -1, r: 1, top: -1},
        ],
        flag: {x: 10.25, y: -4},
        prompt: 'Press to blast.',
    },
    {
        id: 'rocket-02', name: 'Step Up',
        size: 26,
        start: {x: -10.5, y: -4},
        solids: [
            {l: -14, r: -5, top: -4},
            {l: -5, r: 1, top: -1.5},
            {l: 1, r: 14, top: 1},
        ],
        flag: {x: 10, y: 1},
    },
    {
        id: 'rocket-03', name: 'Knock Knock',
        size: 26,
        start: {x: -10.5, y: -4},
        solids: [
            {l: -14, r: 5, top: -4},
            {l: 8, r: 14, top: -4},
            {l: -14, r: 14, top: 5.4, bottom: 5},
        ],
        gates: [
            {solid: {l: 3, r: 4, top: 5, bottom: -4}, button: {x: -10.5, y: 4.5}},
        ],
        flag: {x: 11, y: -4},
    },
    {
        draft: true,   // hidden until 2-1 to 2-3 feel right
        id: 'rocket-04', name: 'Glide',
        size: 28,
        start: {x: -12, y: -4},
        solids: [
            {l: -15, r: -8, top: -4},
            {l: -8, r: 4, top: -4, ice: true},
            {l: -2, r: -1, top: -2.5},
            {l: 7.5, r: 15, top: -3},
        ],
        flag: {x: 12, y: -3},
    },
    {
        draft: true,   // hidden until 2-1 to 2-3 feel right
        id: 'rocket-05', name: 'Around the Corner',
        size: 26,
        start: {x: -10.5, y: -4},
        solids: [
            {l: -14, r: 14, top: -4},
            {l: -6, r: -4, top: -2},
            {l: 2, r: 14, top: 5.4, bottom: 2.5},
            {l: -14, r: 2, top: 5.4, bottom: 5},
            {l: 6, r: 7, top: 2.5, bottom: -.5},
        ],
        gates: [
            {solid: {l: 2, r: 3, top: 2.5, bottom: -4}, button: {x: 3.9, y: 1.8}},
        ],
        flag: {x: 11, y: -4},
    },
    {
        draft: true,   // hidden until 2-1 to 2-3 feel right
        id: 'rocket-06', name: 'Mind the Gap',
        size: 28,
        start: {x: -12, y: -4},
        solids: [
            {l: -15, r: -9, top: -4},
            {l: -6, r: -4, top: -3},
            {l: -1, r: 1, top: -2},
            {l: 4, r: 6, top: -3},
            {l: 9, r: 15, top: -4},
        ],
        flag: {x: 12, y: -4},
    },
    {
        draft: true,   // hidden until 2-1 to 2-3 feel right
        id: 'rocket-07', name: 'Sticky Situation',
        size: 28,
        start: {x: -12, y: -4},
        solids: [
            {l: -15, r: -9, top: -4},
            {l: -9, r: 1, top: -4, sticky: true},
            {l: 1, r: 5, top: -1.5},
            {l: 8.5, r: 15, top: -1.5},
            {l: 5, r: 8.5, top: -5, sticky: true},
        ],
        flag: {x: 12, y: -1.5},
    },
    {
        draft: true,   // hidden until 2-1 to 2-3 feel right
        id: 'rocket-08', name: 'Gatehouse',
        size: 28,
        start: {x: -12, y: -4},
        solids: [
            {l: -15, r: 4, top: -4, ice: true},
            {l: -7, r: -6, top: -2.5},
            {l: 7.5, r: 9.5, top: -3},
            {l: 12, r: 15, top: -2},
            {l: -15, r: 15, top: 5.4, bottom: 5},
        ],
        gates: [
            {solid: {l: 3, r: 4, top: 5, bottom: -4}, button: {x: -1, y: 3}},
        ],
        flag: {x: 13, y: -2},
    },
    {
        draft: true,   // hidden until 2-1 to 2-3 feel right
        id: 'rocket-09', name: 'Goo Hop',
        size: 30,
        start: {x: -13, y: -4},
        solids: [
            {l: -16, r: -10, top: -4},
            {l: -7, r: -3, top: -4, sticky: true},
            {l: 0, r: 3, top: -2, sticky: true},
            {l: 6, r: 8, top: 0},
            {l: 11, r: 16, top: 1},
        ],
        flag: {x: 13.5, y: 1},
    },
    {
        draft: true,   // hidden until 2-1 to 2-3 feel right
        id: 'rocket-10', name: 'The Works',
        size: 30,
        start: {x: -13, y: -4},
        solids: [
            {l: -16, r: -9, top: -4},
            {l: -9, r: 2, top: -4, ice: true},
            {l: -4, r: -3, top: -2.5},
            {l: 2, r: 16, top: 5.4, bottom: 2.5},
            {l: -16, r: 2, top: 5.4, bottom: 5},
            {l: 2, r: 6, top: -4, sticky: true},
            {l: 9, r: 11, top: -3},
            {l: 13, r: 16, top: -2},
        ],
        gates: [
            {solid: {l: 2, r: 3, top: 2.5, bottom: -4}, button: {x: 3.9, y: 1.8}},
        ],
        flag: {x: 14.3, y: -2},
    },
];
