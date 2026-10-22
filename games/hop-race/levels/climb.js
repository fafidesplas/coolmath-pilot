/*
    HOP RACE - Lab world, Climb (GDD §3.7, §6, §13.1). Coordinates are centered on the level box:
    a size 24 level spans x -12..12 and y -6.75..6.75. Solids are {l, r, top, bottom?}.
    A feel test: three levels to find out whether turning the arm is fun, not a finished world.
    par / expert are placeholders from simulated runs; set them from designer runs.
*/

'use strict';

HR_LEVELS.climb = [
    {
        id: 'climb-01', name: 'Roll Along',
        size: 24,
        start: {x: -10, y: -4},
        solids: [
            {l: -13, r: 13, top: -4},
            {l: -3, r: 13, top: -3},   // a low step
            {l: 4, r: 13, top: -1.5},  // a higher one
        ],
        flag: {x: 9, y: -1.5},
        prompt: 'Hold to turn your arm.',
        par: 12.0, expert: 7.0,
    },
    {
        id: 'climb-02', name: 'Boulders',
        size: 26,
        start: {x: -11, y: -5},
        solids: [
            {l: -14, r: -5, top: -5},
            {l: -2.5, r: 0.5, top: -4},   // past a 2.5 u pit, the rocks step up
            {l: 0.5, r: 3.5, top: -2.5},
            {l: 3.5, r: 6, top: -1},
            {l: 6, r: 14, top: .5},
        ],
        flag: {x: 10, y: .5},
        par: 14.0, expert: 8.0,
    },
    {
        id: 'climb-03', name: 'The Wall',
        size: 28,
        start: {x: -12, y: -6},
        solids: [
            {l: -15, r: 15, top: -6},
            {l: 1, r: 15, top: 3},   // a sheer 9 u wall: stick the head high, lever up, grip, repeat
        ],
        flag: {x: 8, y: 3},
        par: 16.0, expert: 10.0,
    },
];
