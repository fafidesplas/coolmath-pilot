'use strict';
// Levels. Units are meters (y up). A level is a list of boats parked one after the other in the
// same harbor; boats waiting their turn sit at their start, parked boats stay where they stopped.
//
// boats:   [{ boat, k?, start:{x,y,a}, slip, hint? }]   k defaults to the boat's real size (BOATS[boat].k)
// slip:    x/y center, or top/right = the pier edge it hangs from; a = heading the boat must face
//          (PI/2 = bow into a top pier; either end in is fine), pad = extra [length, width] room in
//          toy units (times k), fingers = 'both' | 'none' (short docks along the slip's long sides)
// land:    [x0, y0, x1, y1] sand;  docks: {x0, y0, x1, y1, quay?, plank?}
// moored:  boats tied up on springs; drifters: loose boats; buoys: [x, y, scale]; ducks: {x, y, kids}
// view:    fixed camera box (classic levels); otherwise the camera follows the boat and its slip

// harbor basin: sand on the sides and bottom, a concrete quay along the top edge
function basin(x0, y0, x1, top)
{
    return {
        land: [[x0-3000, y0-3000, x0, top+3000], [x1, y0-3000, x1+3000, top+3000], [x0, y0-3000, x1, y0], [x0, top+15, x1, top+3000]],
        docks: [{ x0, y0:top, x1, y1:top+15, quay:true }],
    };
}

// a boat at real size tied up nose-in under a pier edge
function tiedUp(boat, x, top) { const t = BOATS[boat]; return { boat, x, y: top - t.L*t.k/2 - .35*t.k, a: PI/2 }; }

const SCALE_LEVELS =
[
    {
        name: 'Odd Couple', ...basin(0, -20, 1400, 585),
        boats:
        [
            { boat: 'dinghy', start: { x: 452, y: 566, a: .3 }, slip: { x: 474, top: 585, a: PI/2 },
              hint: 'Hold the mouse to steer (or WASD). Stop in the box, then SPACE to drop anchor.' },
            { boat: 'cruise', start: { x: 1180, y: 470, a: PI }, slip: { x: 650, top: 585, a: 0, pad: [.6, .3], fingers: 'none' },
              hint: 'Same rules. Slightly bigger boat. Mind the rowboat.' },
        ],
        moored: [tiedUp('speedboat', 120, 585), tiedUp('sailboat', 140, 585), tiedUp('speedboat', 160, 585)],
        buoys: [[300, 380, 5], [900, 380, 5]],
        ducks: [{ x: 440, y: 572, kids: 3 }],
    },
    {
        name: 'Way Down', ...basin(0, -20, 1700, 900),
        boats:
        [
            { boat: 'container', start: { x: 1550, y: 700, a: PI }, slip: { x: 700, top: 900, a: 0, pad: [.5, .25], fingers: 'none' },
              hint: 'Four hundred meters of boat. Let off early.' },
            { boat: 'tug', start: { x: 380, y: 830, a: 0 }, slip: { x: 440, top: 900, a: PI/2, pad: [1.2, 1] },
              hint: 'Tugboats push. Shove things out of your way.' },
            { boat: 'paper', start: { x: 418, y: 898.3, a: .9 }, slip: { x: 419, top: 900, a: PI/2 },
              hint: 'Tiny boat. Same rules. The ducks are huge now.' },
        ],
        ducks: [{ x: 414, y: 896, kids: 2 }],
        buoys: [[1200, 450, 6], [1200, 800, 6]],
    },
    {
        name: 'Mixed Nuts', ...basin(0, -20, 1300, 700),
        boats:
        [
            { boat: 'yacht', start: { x: 950, y: 560, a: PI }, slip: { x: 720, top: 700, a: PI/2, pad: [1.2, 1] },
              hint: 'A mansion with a motor. Turn early.' },
            { boat: 'bathtub', start: { x: 757, y: 692, a: 1.9 }, slip: { x: 752, top: 700, a: PI/2, pad: [1.1, .9] },
              hint: 'Bathtub. Right next to the yacht. Classy.' },
            { boat: 'cruise', start: { x: 1150, y: 450, a: PI }, slip: { x: 500, top: 700, a: 0, pad: [.6, .3], fingers: 'none' },
              hint: 'Parallel park the cruise ship. Everyone is watching.' },
            { boat: 'swan', start: { x: 330, y: 692, a: 2.1 }, slip: { x: 325, top: 700, a: PI/2, pad: [1, .9] },
              hint: 'Pedal boats spin. A lot.' },
        ],
        ducks: [{ x: 765, y: 690, kids: 3 }],
        buoys: [[1000, 300, 5]],
    },
];

// ---------------------------------------------------------------------------
// classic marina: one toy-scale boat per level in a fixed 40 x 22.5 view

const PIER_TOP = 18.6;

// a boat tied up nose-in under the top pier
function docked(boat, x) { return { boat, x, y: PIER_TOP - BOATS[boat].L/2 - .35, a: PI/2 }; }

const CLASSIC_LEVELS =
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

// old format: boat, start, slip (hangs from PIER_TOP), rightPier
function classicLevel(L)
{
    const docks = [{ x0:0, y0:PIER_TOP, x1:40, y1:23 }];
    if (L.rightPier) docks.push({ x0:36.5, y0:.4, x1:40, y1:PIER_TOP });
    return {
        ...L, toy: true,
        view: { x0:0, y0:0, x1:40, y1:22.5 },
        land: [[-100, -100, .4, 100], [39.6, -100, 140, 100], [-100, -100, 140, .4], [-100, 23, 140, 100]],
        docks,
        duckBox: [3, 2, 37, PIER_TOP - 2.5],
        boats: [{ boat: L.boat, start: L.start, slip: { top: PIER_TOP, right: L.rightPier ? 36.5 : undefined, ...L.slip } }],
    };
}

const LEVELS = [...SCALE_LEVELS.map(L => ({ ...L, world: 1 })), ...CLASSIC_LEVELS.map(L => ({ ...classicLevel(L), world: 2 }))];

