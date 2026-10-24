'use strict';
// Levels: one boat, one slip. Play area is 40 x 21 world units, the top pier starts at PIER_TOP.
// slip: x/y center (y defaults to hanging from the top pier), a = heading the boat must face
//       (PI/2 = bow into the top pier; either end in is fine), pad = extra [length, width] room,
//       fingers = 'both' | 'none' (short docks along the slip's long sides)
// moored: boats tied up on springs; drifters: loose boats; ducks: {x, y, kids}; currents: push zones

const PIER_TOP = 18.6;

// a boat tied up nose-in under the top pier
function docked(boat, x) { return { boat, x, y: PIER_TOP - BOATS[boat].L/2 - .35, a: PI/2 }; }

const LEVELS =
[
    {
        name: 'Baby Steps', boat: 'dinghy',
        start: { x: 8, y: 6, a: 0 },
        slip: { x: 28, a: PI/2, pad: [1.6, 1.3] },
        hint: 'Hold the mouse to steer (or WASD). Stop in the box and press SPACE to drop anchor.',
    },
    {
        name: 'Buoy Oh Buoy', boat: 'dinghy',
        start: { x: 20, y: 3, a: PI/2 },
        slip: { x: 20, a: PI/2, pad: [1.4, 1.1] },
        buoys: [[14,8],[17,8],[20,8],[23,8],[26,8],[15.5,12],[18.5,12],[21.5,12],[24.5,12]],
        hint: 'Buoys bounce. So do you.',
    },
    {
        name: 'Zippy', boat: 'speedboat',
        start: { x: 4, y: 4, a: 0 },
        slip: { x: 30, a: PI/2, pad: [1.4, 1] },
        moored: [docked('dinghy', 27.2), docked('dinghy', 32.8), docked('speedboat', 12)],
        ducks: [{ x: 18, y: 10, kids: 3 }],
        hint: 'Fast boats slide. Let off early.',
    },
    {
        name: 'Swan Song', boat: 'swan',
        start: { x: 22, y: 3, a: PI/2 },
        slip: { x: 22, a: PI/2, pad: [1, .9] },
        moored: [docked('speedboat', 19), docked('pontoon', 15.4), docked('dinghy', 25), docked('sailboat', 27.6)],
        ducks: [{ x: 10, y: 8, kids: 2 }, { x: 32, y: 9, kids: 3 }],
        hint: 'Pedal boats spin. A lot.',
    },
    {
        name: 'Party Barge', boat: 'pontoon',
        start: { x: 5, y: 10, a: 0 },
        rightPier: true,
        slip: { y: 9.5, a: 0, pad: [1.2, 1.1] },
        buoys: [[15,6],[15,14],[22,10],[28,4.5],[28,15.5]],
        ducks: [{ x: 20, y: 16, kids: 4 }],
        hint: 'Wide load. Heavy load. Party load.',
    },
    {
        name: 'Long Story', boat: 'sailboat',
        start: { x: 30, y: 4, a: PI },
        slip: { x: 8, a: PI/2, pad: [1.2, 1] },
        moored: [docked('dinghy', 11.3), docked('speedboat', 4.6)],
        currents: [{ x0: 0, y0: 7, x1: 40, y1: 11, dx: -1.6, dy: 0 }],
        logs: [[25,9,.3],[15,8,-.2],[30,13,1.2],[18,14,.5]],
        hint: 'The current pushes left. Everything goes with it.',
    },
    {
        name: 'Tug Life', boat: 'tug',
        start: { x: 20, y: 4, a: PI/2 },
        slip: { x: 20, a: PI/2, pad: [1.2, 1] },
        drifters: [{ boat: 'dinghy', x: 19.8, y: 16.6, a: .5 }, { boat: 'swan', x: 14, y: 11, a: 2 }],
        logs: [[20.4,14.2,.15]],
        moored: [docked('speedboat', 16.2), docked('dinghy', 23.6)],
        hint: 'Something is in your spot. Good thing you are a tugboat.',
    },
    {
        name: 'Rip Current', boat: 'speedboat',
        start: { x: 30, y: 4, a: PI/2 },
        slip: { x: 8, a: PI/2, pad: [1.3, .9] },
        moored: [docked('dinghy', 5), docked('pontoon', 12.3)],
        currents: [{ x0: 0, y0: 10, x1: 40, y1: 14, dx: 3.2, dy: 0 }],
        buoys: [[6,9.4],[14,9.4],[22,9.4],[30,9.4]],
        hint: 'Strong current. Aim upstream.',
    },
    {
        name: 'Rubber Ducky', boat: 'bathtub',
        start: { x: 8, y: 4, a: 0 },
        slip: { x: 30, a: PI/2, pad: [1.1, .9] },
        moored: [docked('dinghy', 27.2), docked('swan', 33)],
        ducks: [{ x: 15, y: 8, kids: 4 }, { x: 25, y: 6, kids: 3 }, { x: 22, y: 13, kids: 5 }, { x: 33, y: 10, kids: 2 }],
        hint: 'You are in a bathtub. The ducks are not impressed.',
    },
    {
        name: 'Mega Yacht', boat: 'yacht',
        start: { x: 5, y: 5, a: 0 },
        slip: { x: 20, y: PIER_TOP - 1.7, a: 0, pad: [1.6, .8], fingers: 'none' },
        moored: [{ boat: 'speedboat', x: 13.2, y: PIER_TOP - 1.05, a: 0 }, { boat: 'pontoon', x: 27.5, y: PIER_TOP - 1.6, a: PI }],
        buoys: [[12,7],[28,7]],
        ducks: [{ x: 20, y: 9, kids: 3 }],
        hint: 'Parallel parking. In a mansion. On water.',
    },
];
