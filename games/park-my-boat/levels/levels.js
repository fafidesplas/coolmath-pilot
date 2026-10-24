'use strict';
// Levels. Units are meters (y up). A level is a list of boats parked one after the other in the
// same harbor; boats waiting their turn sit at their start, parked boats stay where they stopped.
//
// boats:   [{ boat, k?, start:{x,y,a}, slip, hint? }]   k defaults to the boat's real size (BOATS[boat].k)
// slip:    x/y center, or top/right = the pier edge it hangs from; a = heading the boat must face
//          (PI/2 = bow into a top pier; either end in is fine), pad = extra [length, width] room in
//          toy units (times k), fingers = 'both' | 'none' (short docks along the slip's long sides)
// land:    [x0, y0, x1, y1] sand;  docks: {x0, y0, x1, y1, quay?, plank?}
// lands:   blob landmasses {x, y, k, circles: [[x, y, r]] in units of k (first one on the center), grass?}
// moored:  boats tied up on springs; drifters: loose boats; buoys: [x, y, scale]; ducks: {x, y, kids}
// the camera follows the boat and its slip

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
    {
        // each boat 100x the last: the harbor sits on a small island, the island parks in a bay
        // next to it, the continent closes the gap in Pangaea thousands of km away
        name: 'Continental Drift', ...basin(0, -20, 1400, 585),
        boats:
        [
            { boat: 'dinghy', start: { x: 452, y: 566, a: .3 }, slip: { x: 474, top: 585, a: PI/2 },
              hint: 'Rowboat first. Then things get bigger.' },
            { boat: 'cruise', start: { x: 1180, y: 470, a: PI }, slip: { x: 650, top: 585, a: 0, pad: [.6, .3], fingers: 'none' },
              hint: 'Cruise ship. You have done this before.' },
            { boat: 'island', start: { x: 95000, y: 1500, a: PI }, slip: { x: 36000, y: 0, a: 0, pad: [1.2, 1], fingers: 'none' },
              hint: 'Islands float now. Just go with it.' },
            { boat: 'continent', start: { x: -.5e6, y: 3.5e6, a: 0 }, slip: { x: 5e6, y: 3.5e6, a: 0, pad: [1.2, 1], fingers: 'none' },
              hint: 'Pangaea is missing a piece.' },
        ],
        lands:
        [
            // round off the corners and sides of the harbor's square of sand
            ...[[-3000, -3020, 1800], [4400, -3020, 1800], [-3000, 3585, 1800], [4400, 3585, 1800],
                [700, -3020, 2000], [700, 3585, 2200], [-3000, 280, 1900], [4400, 280, 2000]]
                .map(([x, y, r]) => ({ x, y, k: r, circles: [[0, 0, 1]] })),
            // islets around the island's bay (k = 3 km), open to the east
            { x: 39000, y: 18600, k: 3000, grass: true, circles: [[0, 0, 2.4], [-4, -.4, 2], [3.5, -.8, 1.8], [6.2, -.6, 1.7]] },
            { x: 37500, y: -19200, k: 3000, grass: true, circles: [[0, 0, 2.6], [-3.6, .6, 2], [3.6, .9, 1.9], [6.5, 1.2, 1.6]] },
            // Pangaea around the continent's slot (k = 300 km), open to the west
            { x: 5.3e6, y: 5.9e6, k: 3e5, grass: true, circles: [[0, 0, 3.5], [-4, -.5, 3], [4, -1, 2.6], [7.5, -2.5, 2.5], [-7.5, -2, 2]] },
            { x: 7.94e6, y: 3.5e6, k: 3e5, grass: true, circles: [[0, 0, 3], [0, -2.8, 2.6], [-.8, 3.4, 1.8]] },
            { x: 5.3e6, y: 1.04e6, k: 3e5, grass: true, circles: [[0, 0, 3.6], [-4, .6, 3], [4, 1.2, 2.6], [7.5, 2.7, 2.5], [-7.5, 2.2, 2]] },
        ],
        moored: [tiedUp('speedboat', 120, 585), tiedUp('sailboat', 140, 585), tiedUp('speedboat', 160, 585)],
        buoys: [[300, 380, 5], [900, 380, 5]],
        ducks: [{ x: 440, y: 572, kids: 3 }],
    },
];

const LEVELS = SCALE_LEVELS.map(L => ({ ...L, world: 1 }));
