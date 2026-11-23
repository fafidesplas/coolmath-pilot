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
            {l: 1.5, r: 12, top: -3.5},
            {l: 9.5, r: 12.25, top: -3.5, bottom: -5, finish: true},
        ],
        prompt: 'Press A to run, press again to jump!',
    },
    {
        id: 'hop-02', name: 'Stepping Stones',
        size: 28,
        start: {x: -12, y: -4},
        solids: [
            {l: -15, r: -9, top: -4},
            {l: -6, r: -2.5, top: -3.5},
            {l: 1.5, r: 4.5, top: -4},
            {l: 10.5, r: 14, top: -4, bottom: -9.5, finish: true},
        ],
    },
    {
        id: 'hop-03', name: 'Up We Go',
        size: 26,
        start: {x: -10.5, y: -5},
        solids: [
            {l: -14, r: -6.5, top: -5},
            {l: -4.5, r: -1.5, top: -2.5},
            {l: 2.5, r: 5.5, top: 0},
            {l: 9, r: 13, top: 2.5, bottom: 1.25, finish: true},
        ],
    },
    {
        id: 'hop-04', name: 'The Wall',
        size: 26,
        start: {x: -10.5, y: -4},
        solids: [
            {l: -14, r: 8.75, top: -4},
            {l: -0.75, r: 8.75, top: 3.5},     // the big block: 7.5 u tall, the finish past it
            {l: -15.25, r: -10, top: -0.25, bottom: -1.25},
            {l: -7, r: -4.25, top: 3.5, bottom: 2.5},
            {l: 8.5, r: 13.25, top: -4, bottom: -9.25, finish: true},
        ],
    },
    {
        id: 'hop-05', name: 'Thin Ice',
        size: 28,
        start: {x: -12, y: -1.5},
        solids: [
            {l: -15, r: -8, top: -1.5},
            {l: -4.5, r: 4, top: -4.5, ice: true},
            {l: 4, r: 5, top: -3.5},         // a bump that stops a slide
            {l: 5, r: 10.25, top: -4.5, ice: true},
            {l: 10.25, r: 15, top: -4.5, finish: true},
        ],
    },
    {
        id: 'hop-06', name: 'Ice Ice Jumpy',
        size: 28,
        start: {x: -12.5, y: -4},
        solids: [
            {l: -15, r: -7.25, top: -4, ice: true},
            {l: 0.5, r: 3.75, top: -4.25, ice: true},
            {l: 12, r: 19, top: -4, finish: true},
        ],
    },
    {
        id: 'hop-07', name: 'Grip',
        size: 26,
        start: {x: -10, y: -5},
        solids: [
            {l: -14, r: 1.5, top: -5},
            {l: -2.5, r: -1.5, top: 0, bottom: -3.3, grip: true},   // hop in under it
            {l: 1.5, r: 8.25, top: 0, grip: true},                    // 3 u across the shaft, 5 u up
            {l: 8.25, r: 14, top: 0, finish: true},
        ],
    },
    {
        id: 'hop-08', name: 'Which Wall?',
        size: 29,
        start: {x: -12, y: -5},
        solids: [
            {l: -15, r: -8, top: -5},
            {l: -5, r: 3.75, top: -5},
            {l: 3.5, r: 4.5, top: 5.5, bottom: -5.25, grip: true},   // a grip pillar, 3 u from the cliff
            {l: 3.5, r: 9.25, top: 1.5},                          // the cliff
            {l: -9.75, r: 8.75, top: 6, bottom: 5},
            {l: 3.5, r: 8.75, top: 5.25, bottom: 0.25},
            {l: -4, r: -2, top: 1, bottom: 0, ice: true},
            {l: -9.75, r: -7.75, top: 2, bottom: 1},
            {l: -14.5, r: -12, top: 4, bottom: 3},
            {l: 9.25, r: 15, top: 1.5, finish: true},
        ],
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
            {l: 7, r: 10.25, top: 1, grip: true},
            {l: 10.25, r: 16, top: 1, finish: true},
        ],
    },
    {
        id: 'hop-10', name: 'The Gauntlet',
        size: 30,
        start: {x: -14, y: -2.5},
        solids: [
            {l: -16, r: -12, top: -2.5},
            {l: -10, r: -3, top: -4, ice: true},
            {l: -7, r: -2.6, top: 20, bottom: -1.8},
            {l: 0, r: 7.5, top: -4},
            {l: 3.5, r: 4.5, top: 2, bottom: -2, grip: true},
            {l: 7.5, r: 11.25, top: 1.5, grip: true},
            {l: 11.25, r: 16, top: 1.5, finish: true},
        ],
    },
];

// Versus (GDD §6, a test since 2026-11-10): mirrored levels (mirror: true) list their left half; the game adds the
// mirror copy, P2 starts on the mirror side facing left, and the finish block sits in the middle. The stacked level
// (stack: true) lists P1's lane, the top half of the level box (y 0.5 to 10.25 at size 40); P2 races it one floor down
HR_VERSUS.hop = [
    {
        id: 'hop-vs-01', name: 'Face Off',
        mirror: true,
        size: 28,
        start: {x: -12, y: -4},
        solids: [
            {l: -15, r: -8.5, top: -4},
            {l: -6, r: -1.25, top: -4},
            {l: -3.5, r: -2.5, top: -2.5},     // a low block before the finish: tap and you bounce back
            {l: -1.25, r: 0, top: -4, finish: true},
        ],
    },
    {
        id: 'hop-vs-02', name: 'Climb the Middle',
        mirror: true,
        size: 28,
        start: {x: -3.5, y: -5},           // next to the tower: bump it, run out to the wall and climb back
        solids: [
            {l: -15, r: 0, top: -5},
            {l: -1, r: 0, top: -1},            // the middle tower, 5 u: too tall to jump
            {l: -10.5, r: -8.5, top: -3},
            {l: -5, r: -3, top: -1, bottom: -2},
            {l: -1, r: 0, top: 0, bottom: -1, finish: true},   // the tower's top 1 u: bumping its side doesn't finish
        ],
    },
    {
        id: 'hop-vs-03', name: 'Out and Back',
        mirror: true,
        size: 28,
        start: {x: -12, y: -5},
        solids: [
            {l: -15, r: 0, top: -5},
            {l: -1.5, r: 0, top: 1},           // the middle tower: run into it to turn back
            {l: -7, r: -3.5, top: -2.5, bottom: -3.5},
            {l: -15, r: -9, top: 0, bottom: -1},     // the high ledge: turn at the wall up here
            {l: -5.5, r: -2.5, top: 3.5, bottom: 2.5},     // run off its end onto the tower
            {l: -1.5, r: 0, top: 2, bottom: 1, finish: true},   // the tower's top 1 u
        ],
    },    {
        id: 'hop-vs-04', name: 'Chimney Drop',
        mirror: true,
        size: 32,
        start: {x: -14, y: -7},
        solids: [
            {l: -17, r: -1.5, top: -7},
            {l: -5, r: -4.5, top: 5, grip: true},     // the tower's outer face: wall-jump up between it and the pillar
            {l: -4.5, r: -1.5, top: 5},        // the tower: plain inside, so the drop down the shaft doesn't cling
            {l: -9, r: -8, top: 4, bottom: -3, grip: true},     // the floating pillar: run under it into the chimney
            {l: -1.5, r: 0, top: -7, finish: true},   // the shaft's floor
        ],
    },
    {
        id: 'hop-vs-05', name: 'Two Floors',
        stack: true,
        size: 40,
        start: {x: -17, y: 2},
        solids: [
            {l: -21, r: -11, top: 2},
            {l: -8, r: -1, top: 2},
            {l: -5, r: -4, top: 3},            // a low block: a tap is too short, hold a little
            {l: 2, r: 6, top: 4},
            {l: 9, r: 12, top: 6},
            {l: 12, r: 16, top: 2},
            {l: 16, r: 21, top: 2, finish: true},
        ],
    },
];
