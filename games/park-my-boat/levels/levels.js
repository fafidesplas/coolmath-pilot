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
// traffic: boats that drive a path on their own {boat, k?, path: [[x, y], ...], end?: 'back' | 'loop' | 'stop',
//          speed?: share of top speed (default .6), during?: [boat numbers, from 1] (default: every turn),
//          pace?: m/s, loops only: keeps to a timetable so boats sharing a loop stay evenly spaced}
// the camera follows the boat and its slip

// harbor basin: sand on the sides and bottom, a concrete quay along the top edge. The strips overlap
// instead of meeting edge to edge, which would leave a hairline seam.
function basin(x0, y0, x1, top)
{
    return {
        land: [[x0-3000, y0-3000, x0, top+3000], [x1, y0-3000, x1+3000, top+3000], [x0-3000, y0-3000, x1+3000, y0], [x0-3000, top+15, x1+3000, top+3000]],
        docks: [{ x0, y0:top, x1, y1:top+15, quay:true }],
    };
}

// the same harbor (water x 0..1400, quay at y 585) cut into the south coast of a grassy island,
// open to the sea: straight sand jetties either side, round lobes of land around them
function harborIsland()
{
    return {
        land: [[-700, -600, 0, 1250], [1400, -600, 2100, 1250], [-700, 600, 2100, 1300]],
        docks: [{ x0: 0, y0: 585, x1: 1400, y1: 600, quay: true }],
        lands:
        [
            { x: 700, y: 2600, k: 1000, grass: true, circles: [[0, 0, 1.9], [-1.6, .7, 1.3], [1.7, .9, 1.2], [-.6, 1.8, 1.1], [1, 1.7, .9]] },
            { x: -1300, y: 1200, k: 1000, grass: true, circles: [[0, 0, 1.25], [-.7, .9, .8], [.1, -.9, .7]] },
            { x: 2750, y: 1250, k: 1000, grass: true, circles: [[0, 0, 1.3], [.8, .7, .8], [-.1, -.9, .75]] },
            { x: -350, y: -600, k: 350, circles: [[0, 0, 1]] },        // round jetty tips
            { x: 1750, y: -600, k: 350, circles: [[0, 0, 1]] },
        ],
    };
}
const HARBOR_ISLAND = harborIsland();

// a boat at real size tied up nose-in under a pier edge
function tiedUp(boat, x, top) { const t = BOATS[boat]; return { boat, x, y: top - t.L*t.k/2 - .35*t.k, a: PI/2 }; }

// sand everywhere in the box [x0, y0, x1, y1] except the water rects [x0, y0, x1, y1]: columns of
// sand, each one 1 m wider where its neighbor is sand too, so they overlap with no seam
function sandAround(box, water)
{
    const xs = [...new Set([box[0], box[2], ...water.flatMap(w => [w[0], w[2]])])].sort((a, b) => a - b);
    const cols = [];
    for (let i = 0; i < xs.length - 1; i++)
    {
        const m = (xs[i] + xs[i + 1])/2, sand = [];
        let y = box[1];
        for (const [lo, hi] of water.filter(w => w[0] < m && m < w[2]).map(w => [w[1], w[3]]).sort((a, b) => a[0] - b[0]))
        {
            if (lo > y) sand.push([y, lo]);
            y = Math.max(y, hi);
        }
        if (y < box[3]) sand.push([y, box[3]]);
        cols.push({ x0: xs[i], x1: xs[i + 1], sand });
    }
    const sandAt = (c, y0, y1) => c && c.sand.some(([lo, hi]) => lo <= y0 && y1 <= hi);
    return cols.flatMap((c, i) => c.sand.map(([y0, y1]) =>
        [sandAt(cols[i - 1], y0, y1) ? c.x0 - 1 : c.x0, y0, sandAt(cols[i + 1], y0, y1) ? c.x1 + 1 : c.x1, y1]));
}

// traffic on one loop across a canal at x: north up the leg at x - d, south down the leg at x + d
// (flip swaps them), turning around at y = +-Y, at pace m/s. boats: [[boat, speed], ...] spaced evenly
// around the loop; speed is the share of each boat's top speed that comes closest to the pace.
function loopLane(x, d, Y, flip, pace, boats)
{
    const T = 4*Y + 2*PI*d, n = boats.length, m = n*Math.ceil(T/(d/2)/n);
    const at = s =>
    {
        let px, py;
        if (s < 2*Y) { px = x - d; py = -Y + s; }
        else if ((s -= 2*Y) < PI*d) { const a = PI - s/d; px = x + d*Math.cos(a); py = Y + d*Math.sin(a); }
        else if ((s -= PI*d) < 2*Y) { px = x + d; py = Y - s; }
        else { s -= 2*Y; const a = -s/d; px = x + d*Math.cos(a); py = -Y + d*Math.sin(a); }
        return [+(flip ? 2*x - px : px).toFixed(1), +py.toFixed(1)];
    };
    const pts = Array.from({ length: m }, (_, i) => at(T*i/m));
    return boats.map(([boat, speed], i) =>
        ({ boat, path: [...pts.slice(i*m/n), ...pts.slice(0, i*m/n)], end: 'loop', speed, pace }));
}

const SCALE_LEVELS =
[
    {
        name: 'Odd Couple',
        land: [[-3000, -3020, 0, 3585], [1400, -3020, 4400, 3585], [-3000, 600, 4400, 3585]],
        docks: [{ x0: 0, y0: 585, x1: 1400, y1: 600, quay: true }],
        boats:
        [
            { boat: 'dinghy', start: { x: 452, y: 566, a: .3 }, slip: { x: 474, top: 585, a: PI/2 },
              hint: 'Hold the mouse to steer (or WASD). Stop in the box, then SPACE to drop anchor.' },
            { boat: 'cruise', start: { x: 225, y: 210, a: PI*5/12 }, slip: { x: 680, top: 585, a: 0, pad: [0.6, 0.3], fingers: 'none' },
              hint: 'Park the cruise ship along the quay. Avoid the rowboat.' },
        ],
        moored: [tiedUp('speedboat', 120, 585), tiedUp('sailboat', 140, 585), tiedUp('speedboat', 160, 585)],
        buoys: [[300, 380, 5], [900, 380, 5]],
        ducks: [{ x: 440, y: 572, kids: 3 }],
    },
    {
        name: 'Way Down', ...basin(0, -20, 1700, 900),
        boats:
        [
            { boat: 'container', start: { x: 1450, y: 700, a: PI }, slip: { x: 700, top: 900, a: 0, pad: [.5, .25], fingers: 'none' },
              hint: 'Big ships take a long time to stop. Slow down early.' },
            { boat: 'tug', start: { x: 382, y: 832, a: 0 }, slip: { x: 440, top: 900, a: PI/2, pad: [1.2, 1] },
              hint: 'The tugboat can push other boats out of the way.' },
            { boat: 'jetski', start: { x: 93.5, y: 616, a: PI/2 }, slip: { x: 291, y: 898, a: PI/2, pad: [1.4, 1] },
              hint: '' },
        ],
        ducks: [{ x: 414, y: 896, kids: 2 }],
        traffic:
        [
            { boat: 'dinghy', path: [[400, 844], [416, 844], [1320, 460], [1060, 380], [560, 380], [950.2, 700]], end: 'back', speed: 0.6 },
            { boat: 'yacht', path: [[1160, 620], [1015, 755], [1020, 885]], end: 'back', speed: 0.8, during: [1] },
            { boat: 'pontoon', path: [[170, 786], [219.6, 747]], end: 'back', speed: 0.6 },
            { boat: 'sailboat', path: [[240, 706], [188, 700], [104, 724], [76, 786], [146, 846], [260, 832], [272, 748], [240, 704]], end: 'back', speed: 0.6 },
        ],
    },
    {
        name: 'Mixed Nuts', ...basin(0, -20, 1300, 700),
        boats:
        [
            { boat: 'yacht', start: { x: 950, y: 560, a: PI }, slip: { x: 735, top: 700, a: PI/2, pad: [1.2, 1] },
              hint: 'Start turning early.' },
            { boat: 'cruise', start: { x: 1150, y: 450, a: PI }, slip: { x: 510, top: 700, a: 0, pad: [.6, .3], fingers: 'none' },
              hint: 'Park the cruise ship along the quay.' },
            { boat: 'swan', start: { x: 305, y: 692, a: 2.1 }, slip: { x: 300, top: 700, a: PI/2, pad: [1, .9] },
              hint: 'The swan pedalo turns very quickly.' },
        ],
        ducks: [{ x: 780, y: 690, kids: 3 }],
        buoys: [[1000, 300, 5]],
    },
    {
        // a channel east to the slip, crossed by three canals of looping traffic, bigger boats each time;
        // sand between the canals is where you stop and wait for a gap. The yachts turn in wide lagoons.
        name: 'Rush Hour',
        land: sandAround([-1000, -1000, 2000, 1000],
        [
            [-25, -25, 20, 25], [-25, -15, 290, 15], [270, -30, 290, 30],    // start pool, channel, slip pool
            [20, -80, 50, 80], [70, -115, 110, 115], [130, -380, 270, 380],  // the three canals
            [118, -380, 360, -90], [118, 90, 360, 380],                      // lagoons at the ends of the third,
            [40, -380, 360, -150], [40, 150, 360, 380],                      // wider past the second
        ]),
        docks: [{ x0: 290, y0: -40, x1: 305, y1: 40, quay: true }],
        boats:
        [
            { boat: 'jetski', start: { x: -10, y: 0, a: 0 }, slip: { right: 290, y: 0, a: 0, pad: [1.4, 1] },
              hint: 'Stop between the canals and wait for a gap.' },
        ],
        traffic:
        [
            ...loopLane(35, 8, 60, false, 3, Array(6).fill([['dinghy', .33], ['swan', .75]]).flat()),
            ...loopLane(90, 12, 90, true, 4, Array(3).fill([['pontoon', .44], ['sailboat', .35], ['speedboat', .19]]).flat()),
            ...loopLane(200, 40, 250, false, 7, Array(5).fill([['yacht', .12], ['tug', .18]]).flat()),
        ],
    },
    {
        // bonus: each boat 100x the last: the harbor is cut into a small island, the island parks in a
        // bay next to it, the continent closes the gap in Pangaea thousands of km away
        name: 'Continental Drift', bonus: true, land: HARBOR_ISLAND.land, docks: HARBOR_ISLAND.docks,
        boats:
        [
            { boat: 'dinghy', start: { x: 452, y: 566, a: .3 }, slip: { x: 474, top: 585, a: PI/2 },
              hint: 'Park the rowboat.' },
            { boat: 'cruise', start: { x: 1180, y: 470, a: PI }, slip: { x: 680, top: 585, a: 0, pad: [.6, .3], fingers: 'none' },
              hint: 'Park the cruise ship along the quay.' },
            { boat: 'island', start: { x: 95000, y: 1500, a: PI }, slip: { x: 36000, y: 0, a: 0, pad: [1.2, 1], fingers: 'none' },
              hint: 'Park the island in the bay.' },
            { boat: 'continent', start: { x: -.5e6, y: 3.5e6, a: 0 }, slip: { x: 5e6, y: 3.5e6, a: 0, pad: [1.2, 1], fingers: 'none' },
              hint: 'Park the continent in the gap.' },
        ],
        lands:
        [
            ...HARBOR_ISLAND.lands,
            // islets around the island's bay (k = 3 km), open to the east
            { x: 39000, y: 20400, k: 3000, grass: true, circles: [[0, 0, 2.4], [-4, -.4, 2], [3.5, -.8, 1.8], [6.2, -.6, 1.7]] },
            { x: 37500, y: -21000, k: 3000, grass: true, circles: [[0, 0, 2.6], [-3.6, .6, 2], [3.6, .9, 1.9], [6.5, 1.2, 1.6]] },
            // Pangaea around the continent's slot (k = 300 km), open to the west
            { x: 5.3e6, y: 6.11e6, k: 3e5, grass: true, circles: [[0, 0, 3.5], [-4, -.5, 3], [4, -1, 2.6], [7.5, -2.5, 2.5], [-7.5, -2, 2]] },
            { x: 8.09e6, y: 3.5e6, k: 3e5, grass: true, circles: [[0, 0, 3], [0, -2.8, 2.6], [-.8, 3.4, 1.8]] },
            { x: 5.3e6, y: .83e6, k: 3e5, grass: true, circles: [[0, 0, 3.6], [-4, .6, 3], [4, 1.2, 2.6], [7.5, 2.7, 2.5], [-7.5, 2.2, 2]] },
        ],
        moored: [tiedUp('speedboat', 120, 585), tiedUp('sailboat', 140, 585), tiedUp('speedboat', 160, 585)],
        buoys: [[300, 380, 5], [900, 380, 5]],
        ducks: [{ x: 440, y: 572, kids: 3 }],
    },
];

// bonus levels are hidden for now; ?bonus shows them after the regular ones
const SHOW_BONUS = new URLSearchParams(location.search).has('bonus');
const LEVELS = [...SCALE_LEVELS.filter(L => !L.bonus), ...(SHOW_BONUS ? SCALE_LEVELS.filter(L => L.bonus) : [])].map(L => ({ ...L, world: 1 }));
