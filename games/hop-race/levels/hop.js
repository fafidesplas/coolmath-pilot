/*
    HOP RACE - World 1, Hop (GDD §6). Coordinates are centered on the level box:
    a size 24 level spans x -12..12 and y -6.75..6.75. Solids are {l, r, top, bottom?, grip?, ice?}.
*/

'use strict';

HR_LEVELS.hop = [
    {
        id: 'hop-01', name: 'First Hop',
        size: 24,
        start: {x: -9, y: -3.5},
        solids: [
            {l: -13, r: -1.5, top: -3.5},
            {l: 1.5, r: 13, top: -3.5},
        ],
        flag: {x: 9, y: -3.5},
        prompt: 'Hold A then release to Jump!',
    },
    {
        id: 'hop-02', name: 'Stepping Stones',
        size: 28,
        start: {x: -12, y: -4},
        solids: [
            {l: -15, r: -9, top: -4},
            {l: -6, r: -2.5, top: -3.5},
            {l: 1.5, r: 4.5, top: -4},
            {l: 9.5, r: 15, top: -3.5},
        ],
        flag: {x: 12, y: -3.5},
    },
    {
        id: 'hop-03', name: 'Up We Go',
        size: 26,
        start: {x: -10.5, y: -5},
        solids: [
            {l: -14, r: -6.5, top: -5},
            {l: -4.5, r: -1.5, top: -2.5},
            {l: 0.5, r: 3.5, top: 0},
            {l: 6, r: 14, top: 2, bottom: 1},
        ],
        flag: {x: 10.5, y: 2},
    },
];
