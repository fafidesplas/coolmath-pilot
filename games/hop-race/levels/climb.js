/*
    HOP RACE - Lab world, Climb (GDD §3.7, §6, §13.1). Coordinates are centered on the level box:
    a size 24 level spans x -12..12 and y -6.75..6.75. Solids are {l, r, top, bottom?}.
    A feel test to find out whether turning the arm is fun, not a finished world.
*/

'use strict';

// teeth on a wall face: ledges of varied size from a fixed seed, so the level is the same every attempt
// (best times, the ghost and Versus all need that). face: the wall's x; side: -1 sticks out to the left.
function hrClimbTeeth(seed, face, side, from, to, opt = {})
{
    const {depth = [.5, 1.1], tall = [.3, .6], gap = [2, 3.2]} = opt;
    const call = {seed, face, side, from, to, opt};
    const rnd = (a, b) => a + (b - a) * ((seed = seed * 16807 % 2147483647) / 2147483647);
    const teeth = [];
    for (let y = from + rnd(...gap) * .5; y < to; y += rnd(...gap))
    {
        const d = rnd(...depth), t = rnd(...tall);
        teeth.push(side < 0 ? {l: face - d, r: face, top: y, bottom: y - t} : {l: face, r: face + d, top: y, bottom: y - t});
    }
    // hidden marker so the level editor (tools/editor.js) writes this call back instead of the teeth
    call.n = teeth.length;
    teeth.forEach(t => Object.defineProperty(t, '_teeth', {value: call, writable: true}));
    return teeth;
}

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
        prompt: 'Hold to swing. Let go to stop.',
    },
    {
        id: 'climb-02', name: 'Boulders',
        size: 26,
        start: {x: -11, y: -5},
        solids: [
            {l: -14, r: -5, top: -5},
            {l: -1.5, r: 0.5, top: -4},   // past a 3.5 u pit (too wide to roll across: holding falls in), the rocks step up
            {l: 0.5, r: 3.5, top: -2.5},
            {l: 3.5, r: 6, top: -1},
            {l: 6, r: 14, top: .5},
        ],
        flag: {x: 10, y: .5},
    },
    {
        id: 'climb-03', name: 'The Wall',
        size: 28,
        start: {x: -12, y: -6},
        solids: [
            {l: -15, r: -2.5, top: -6},   // ends 3.5 u short of the wall: blind swinging off the teeth drops you in
            {l: 1, r: 15, top: 1},   // a 7 u wall: strike a tooth to pop up, or stick to the face and whip
            {l: 0.248, r: 1, top: -5.017, bottom: -5.407},   // teeth: 0.75 × 0.4 at y -5, 1.0 × 0.35 at -1.7
            {l: 0.027, r: 1, top: -1.73, bottom: -2.088},
        ],
        flag: {x: 12, y: 1},
    },
];
