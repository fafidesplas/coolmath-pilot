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
    {
        id: 'hop-04', name: 'The Wall',
        size: 26,
        start: {x: -10.5, y: -4},
        solids: [
            {l: -14, r: 14, top: -4},
            {l: -5.5, r: -4.5, top: -2},     // a low wall to learn the bounce on
            {l: 2, r: 3.2, top: 0},          // the 4 u wall: too flat and it bounces you back
        ],
        flag: {x: 10, y: -4},
    },
    {
        id: 'hop-05', name: 'Thin Ice',
        size: 28,
        start: {x: -12, y: -1.5},
        solids: [
            {l: -15, r: -8, top: -1.5},
            {l: -4.5, r: 4, top: -4.5, ice: true},
            {l: 4, r: 5, top: -3.5},         // a bump that stops a slide
            {l: 5, r: 15, top: -4.5, ice: true},
        ],
        flag: {x: 11, y: -4.5},
    },
    {
        id: 'hop-06', name: 'Low Ceiling',
        size: 28,
        start: {x: -12.5, y: -4},
        solids: [
            {l: -15, r: -5.5, top: -4},
            {l: 0, r: 5, top: -4},
            {l: -9, r: -2.6, top: 20, bottom: -1.5},   // hangs from the top, 2.5 u over the gap
            {l: 8, r: 15, top: -2},
        ],
        flag: {x: 11.5, y: -2},
    },
    {
        id: 'hop-07', name: 'Grip',
        size: 26,
        start: {x: -10, y: -5},
        solids: [
            {l: -14, r: 1.5, top: -5},
            {l: -2.5, r: -1.5, top: 0, bottom: -3.3, grip: true},   // hop in under it
            {l: 1.5, r: 14, top: 0, grip: true},                    // 3 u across the shaft, 5 u up
        ],
        flag: {x: 9, y: 0},
    },
    {
        id: 'hop-08', name: 'Which Wall?',
        size: 28,
        start: {x: -12, y: -5},
        solids: [
            {l: -15, r: -8, top: -5},
            {l: -5, r: 3, top: -5},
            {l: -1, r: 0, top: 3, bottom: -1.5, grip: true},   // a grip pillar, 3 u from the cliff
            {l: 3.5, r: 15, top: 1.5},                          // the cliff
            {l: 3, r: 3.5, top: -2},                            // its foot is plain: it bounces
            {l: 3, r: 3.5, top: 1.5, bottom: -2, grip: true},   // its top half is grip: it holds
        ],
        flag: {x: 10, y: 1.5},
    },
    {
        id: 'hop-09', name: 'Slide and Climb',
        size: 30,
        start: {x: -13, y: -3},
        solids: [
            {l: -16, r: -10, top: -3},
            {l: -8, r: -0.5, top: -4.5, ice: true},   // ends at the pit
            {l: 3, r: 7, top: -4.5},
            {l: 3, r: 4, top: 1, bottom: -2.3, grip: true},
            {l: 7, r: 16, top: 1, grip: true},
        ],
        flag: {x: 11, y: 1},
    },
    {
        id: 'hop-10', name: 'The Gauntlet',
        size: 30,
        start: {x: -14, y: -2.5},
        solids: [
            {l: -16, r: -12, top: -2.5},
            {l: -9.5, r: -3, top: -4, ice: true},
            {l: -7, r: -2.6, top: 20, bottom: -1.8},
            {l: 0, r: 7.5, top: -4},
            {l: 3.5, r: 4.5, top: 2, bottom: -2, grip: true},
            {l: 7.5, r: 16, top: 1.5, grip: true},
        ],
        flag: {x: 12, y: 1.5},
    },
];
