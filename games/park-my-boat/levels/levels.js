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

// harbor basin: a concrete quay along the top edge, sand on the sides down to y0, and open sea to the
// south of that (no level is a closed pool). The strips overlap instead of meeting edge to edge, which
// would leave a hairline seam.
function basin(x0, y0, x1, top)
{
    return {
        land: [[x0-3000, y0, x0, top+3000], [x1, y0, x1+3000, top+3000], [x0-3000, top+15, x1+3000, top+3000]],
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

// a row of boats tied up side by side along a pier edge at y = edge, from x0 east to x1: under it bow
// up (dir -1) or on top of it bow down (dir 1). pattern: [[boat, k], ...] repeated, gap meters between
// hulls; free: [[x, width], ...] open water left in the row (the player's slips)
function berths(x0, x1, edge, dir, gap, pattern, free = [])
{
    const out = [];
    for (let x = x0, i = 0; ; i++)
    {
        const [boat, k] = pattern[i % pattern.length], t = BOATS[boat], w = t.W*k;
        const f = free.find(([fx, fw]) => x < fx + fw/2 && x + w > fx - fw/2);
        if (f) { x = f[0] + f[1]/2; i--; continue; }
        if (x + w > x1) return out;
        out.push({ boat, k, x: +(x + w/2).toFixed(1), y: +(edge + dir*(t.L*k/2 + .35*k)).toFixed(1), a: -dir*PI/2 });
        x += w + gap;
    }
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
            { boat: 'dinghy', start: { x: 483, y: 579, a: PI }, slip: { x: 474, top: 585, a: PI/2 },
              hint: 'Hold the mouse to steer (or WASD). Stop in the box and let go.' },
            { boat: 'cruise', start: { x: 466, y: 394.5, a: PI/2 }, slip: { x: 720, top: 585, a: 0, pad: [0.6, 0.3], fingers: 'none' },
              hint: 'Park the cruise ship along the quay. Avoid the rowboat.' },
        ],
        moored:
        [
            tiedUp('speedboat', 40, 585), tiedUp('sailboat', 60, 585), tiedUp('speedboat', 80, 585),
            // small boats tied up on both sides of the rowboat's slip, so it parks in a gap in the row
            tiedUp('sailboat', 461, 585), tiedUp('speedboat', 464.8, 585), tiedUp('swan', 467.4, 585), tiedUp('dinghy', 469.4, 585), tiedUp('jetski', 471, 585),
            tiedUp('jetski', 477, 585), tiedUp('dinghy', 478.6, 585), tiedUp('swan', 480.6, 585), tiedUp('dinghy', 482.6, 585), tiedUp('jetski', 484.4, 585), tiedUp('speedboat', 487, 585),
        ],
        buoys: [[300, 380, 5], [900, 380, 5]],
        ducks: [{ x: 486, y: 566, kids: 3 }],
        // two lanes of small boats along the bottom edge of the rowboat's view (it ends at about y 572.6),
        // during its turn only: jet skis in full view, swans half out of it
        traffic:
        [
            { boat: 'jetski', path: [[468, 573.5], [530, 573.5]], end: 'back', speed: .15, during: [1] },
            { boat: 'swan', path: [[515, 571.4], [470, 571.4]], end: 'back', speed: .6, during: [1] },
        ],
    },
    {
        name: 'Way Down', ...basin(0, -20, 1700, 900),
        boats:
        [
            { boat: 'container', start: { x: 1250, y: 780, a: PI }, slip: { x: 620, top: 900, a: -PI/2, pad: [0.5, 0.25], fingers: 'none' },
              hint: 'Big ships take a long time to stop. Slow down early.' },
            { boat: 'trawler', start: { x: 400, y: 850, a: 0 }, slip: { x: 440, top: 900, a: PI/2, pad: [.6, .3], fingers: 'none' },
              hint: 'Squeeze between the two yachts. Line up before you go in.' },
            { boat: 'jetski', start: { x: 480, y: 893, a: 0 }, slip: { x: 475, top: 900, a: PI/2, pad: [1.4, 1] },
              hint: '' },
        ],
        // the trawler's tight squeeze: two 40 m yachts nose-in to the quay leave a 13 m alley for a 9.6 m boat
        moored: [{ boat: 'yacht', k: 5, x: 427, y: 878.25, a: PI/2 }, { boat: 'yacht', k: 5, x: 453, y: 878.25, a: PI/2 }],
        ducks: [{ x: 414, y: 896, kids: 2 }],
        traffic:
        [
            { boat: 'dinghy', path: [[300, 830], [360, 830], [1320, 460], [1060, 380], [560, 380], [950.2, 700]], end: 'back', speed: 0.6 },
            { boat: 'yacht', path: [[1160, 620], [1015, 755], [1020, 885]], end: 'back', speed: 0.8, during: [1] },
            { boat: 'pontoon', path: [[170, 786], [219.6, 747]], end: 'back', speed: 0.6 },
            { boat: 'sailboat', path: [[240, 706], [188, 700], [104, 724], [76, 786], [146, 846], [260, 832], [272, 748], [240, 704]], end: 'back', speed: 0.6 },
        ],
    },
    {
        name: 'Mixed Nuts', ...basin(0, -20, 1300, 700),
        boats:
        [
            { boat: 'yacht', start: { x: 964, y: 656, a: 0 }, slip: { x: 735, top: 700, a: PI/2, pad: [1.2, 1] },
              hint: 'Start turning early.' },
            { boat: 'cruise', start: { x: 796, y: 546, a: -PI/2 }, slip: { x: 522, top: 700, a: 0, pad: [0.6, 0.3], fingers: 'none' },
              hint: 'Park the cruise ship along the quay.' },
            { boat: 'swan', start: { x: 316.8, y: 690.4, a: PI }, slip: { x: 309, top: 700, a: PI/2, pad: [1, 0.9] },
              hint: 'The swan pedalo turns very quickly.' },
        ],
        ducks: [{ x: 780, y: 690, kids: 3 }, { x: 300.7, y: 694, kids: 3 }],
        buoys: [[1000, 300, 5]],
    },
    {
        // a short channel east to the slip, crossed by three narrow canals of looping traffic, faster each
        // time; all of it fits in the jet ski's view. The 3.5 m of sand between canals is where you wait for
        // a gap. The loops turn round in lagoons just off screen to the north and south, which run out to sea.
        name: 'Rush Hour',
        land: sandAround([-100, -100, 130, 100],
        [
            [-6, -4, 1.5, 4], [-6, -2.5, 30.5, 2.5], [26.5, -4, 30.5, 4],     // start pool, channel, slip pool
            [1.5, -18, 7.5, 18], [11, -18, 17, 18], [20.5, -18, 26.5, 18],    // the three canals
            [-6, 18, 36, 100], [-6, -100, 36, -18],                           // lagoons at both ends, open to the sea
        ]),
        docks: [{ x0: 30.5, y0: -6, x1: 32, y1: 6, quay: true }],
        boats:
        [
            { boat: 'jetski', start: { x: -1, y: 0, a: 0 }, slip: { right: 30.5, y: 0, a: 0, pad: [1.4, 1] },
              hint: 'Stop between the canals and wait for a gap.' },
        ],
        traffic:
        [
            ...loopLane(4.5, 1.9, 24, false, 2.2, Array(5).fill([['dinghy', .25], ['swan', .55]]).flat()),
            ...loopLane(14, 1.9, 24, true, 3, Array(5).fill([['jetski', .2], ['dinghy', .33]]).flat()),
            ...loopLane(23.5, 1.9, 24, false, 4, Array(10).fill(['jetski', .27])),
        ],
    },
    {
        // a crowded yacht marina: big yachts along the quay, two piers packed on both sides, open water
        // round the west end of the lower pier and the east end of the upper one. Each boat has one free
        // slip between the moored boats; tenders, jet skis and speedboats cruise the fairways.
        name: 'Marina', land: basin(0, 0, 380, 350).land,
        docks:
        [
            { x0: 0, y0: 350, x1: 380, y1: 365, quay: true },
            { x0: -5, y0: 200, x1: 270, y1: 206 },     // upper pier, from the west wall
            { x0: 100, y0: 70, x1: 385, y1: 76 },      // lower pier, from the east wall
        ],
        boats:
        [
            { boat: 'jetski', start: { x: 215, y: 91, a: 0 }, slip: { x: 230, y: 77.9, a: PI/2, pad: [1.4, .8], fingers: 'none' },
              hint: 'Find the free spot on the lower pier.' },
            { boat: 'sailboat', start: { x: 255, y: 93, a: 0 }, slip: { x: 290, y: 83.2, a: PI/2, pad: [.8, .5], fingers: 'none' },
              hint: 'Your berth is on the lower pier too.' },
            { boat: 'yacht', k: 6, start: { x: 280, y: 110, a: PI }, slip: { x: 150, y: 173.5, a: PI/2, pad: [.8, .6], fingers: 'none' },
              hint: 'Squeeze the yacht in under the upper pier. Watch for the tenders.' },
        ],
        moored:
        [
            ...berths(3, 377, 350, -1, 2, [['yacht', 5.5], ['yacht', 6.5], ['yacht', 5], ['yacht', 6]]),
            ...berths(3, 266, 206, 1, 1.5, [['sailboat', 2.4], ['speedboat', 2], ['sailboat', 2.4], ['pontoon', 2], ['sailboat', 2.4]]),
            ...berths(3, 266, 200, -1, 2, [['yacht', 4], ['yacht', 3.5], ['yacht', 4.5]], [[150, 20]]),
            ...berths(104, 377, 76, 1, 1.2, [['speedboat', 2], ['dinghy', 1.3], ['jetski', 1], ['pontoon', 2], ['speedboat', 2], ['sailboat', 2.4], ['dinghy', 1.3], ['jetski', 1]], [[230, 4.2], [290, 7.5]]),
            ...berths(104, 377, 70, -1, 1.5, [['sailboat', 2.4], ['speedboat', 2], ['sailboat', 2.4], ['pontoon', 2]]),
        ],
        traffic:
        [
            { boat: 'dinghy', path: [[110, 148], [280, 148]], end: 'back', speed: .33 },
            { boat: 'speedboat', path: [[280, 136], [110, 136]], end: 'back', speed: .15 },
            { boat: 'jetski', path: [[320, 125], [365, 125], [365, 190], [320, 190]], end: 'loop', speed: .22 },
            { boat: 'pontoon', path: [[30, 257], [260, 257]], end: 'back', speed: .33 },
            { boat: 'speedboat', path: [[360, 278], [40, 278]], end: 'back', speed: .15 },
            { boat: 'dinghy', path: [[110, 42], [370, 42]], end: 'back', speed: .33 },
        ],
    },
    {
        // a harbor jam (src/jam.js): clear every boat out of a packed corner. Quay along the top, sand to
        // the west and along the bottom up to the harbor mouth (x 30-44); open sea to the east.
        name: 'Marina Jam', jam: true, budget: 10000, view: [-2, -2, 46, 26], boats: [],
        land: [[-50, -50, 0, 60], [-50, -50, 30, 0], [-50, 27, 60, 60]],
        docks: [{ x0: -1, y0: 24, x1: 44, y1: 27, quay: true }],
        moored:
        [
            { boat: 'trawler', x: 14.2, y: 5.3, a: 0 },
            { boat: 'sailboat', x: 33, y: 7.2, a: PI/2 },
            { boat: 'jetski', x: 38, y: 3.2, a: -PI/2 },
            { boat: 'pontoon', x: 38, y: 11.5, a: PI/2 },
            { boat: 'speedboat', x: 42, y: 18.4, a: -PI/2 },
            { boat: 'swan', x: 33, y: 19.5, a: PI/2 },
            { boat: 'yacht', k: 2, x: 12, y: 18.5, a: 0 },
            { boat: 'speedboat', x: 8, y: 12.5, a: PI },
        ],
        hint: 'Tap a boat to send it out: tap its front to go ahead, its back to reverse.',
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
