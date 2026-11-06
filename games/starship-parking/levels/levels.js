'use strict';
// Levels. Units are meters (y up). A level is a list of boats parked one after the other in the
// same harbor; boats waiting their turn sit at their start, parked boats stay where they stopped.
//
// boats:   [{ boat, k?, start:{x,y,a}, slip }]   k defaults to the boat's real size (BOATS[boat].k)
// slip:    x/y center, or top/right = the pier edge it hangs from; a = heading the boat must face
//          (PI/2 = bow into a top pier; either end in is fine), pad = extra [length, width] room in
//          toy units (times k), fingers = 'both' | 'none' (short docks along the slip's long sides)
// land:    [x0, y0, x1, y1] sand;  docks: {x0, y0, x1, y1, quay?, plank?}
// walls:   invisible colliders {x0, y0, x1, y1}: boats and floaters bump into them, nothing is drawn (the editor shows them)
// lands:   blob landmasses {x, y, k, circles: [[x, y, r]] in units of k (first one on the center), grass?, detail?: outline points}
// pads:    a dock with pad: true is a landing pad; a slip with bottom: y stands on it (gravity levels)
// station: a spinning space station {x, y (center of its drift), a, spin: rad/s, drift: {r, period, phase}}; a slip with
//          on: 'station' is given in the station's coordinates and moves with it (src/space.js)
// gravity: {share: of each ship's full thrust, dir?: angle (default down)}
// a chain boat may set view: the camera shows that many times more around it than its type does
// moored:  boats tied up on springs; drifters: loose boats; buoys: [x, y, scale]; ducks: {x, y, kids}
// traffic: boats that drive a path on their own {boat, k?, path: [[x, y], ...], end?: 'back' | 'loop' | 'stop',
//          speed?: share of top speed (default .6), during?: [boat numbers, from 1] (default: every turn),
//          pace?: m/s, loops only: keeps to a timetable so boats sharing a loop stay evenly spaced,
//          after?: {boat: n, point: j} (from 1, n = place in this list): waits at its start until traffic boat n reaches
//          its path point j, then moves for good; a boat still waiting doesn't count, so boats chain}
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
        docks: [{ x0: 0, y0: 585, x1: 1400, y1: 600, quay: true }, { x0: 526.8, y0: 546, x1: 529.6, y1: 584.9 }],
        boats:
        [
            { boat: 'dinghy', start: { x: 492.2, y: 560.4, a: PI/2 }, slip: { x: 474, top: 585, a: PI/2 } },
            { boat: 'sailboat', start: { x: 455.4, y: 578, a: -PI/2 }, slip: { x: 519.2, y: 550.9, a: 0, pad: [1.4, 1] } },
        ],
        moored:
        [
            tiedUp('speedboat', 40, 585), tiedUp('sailboat', 60, 585), tiedUp('speedboat', 80, 585),
            // small boats tied up on both sides of the rowboat's slip, so it parks in a gap in the row
            { boat: 'sailboat', x: 520, y: 557.66, a: -PI }, { boat: 'speedboat', x: 464.8, y: 580.9, a: -PI/2 }, tiedUp('swan', 467.4, 585), tiedUp('dinghy', 469.4, 585), tiedUp('jetski', 471, 585),
            tiedUp('jetski', 477, 585), tiedUp('dinghy', 478.6, 585), { boat: 'swan', x: 524.6, y: 561.295, a: PI }, tiedUp('dinghy', 482.6, 585), tiedUp('jetski', 484.4, 585), tiedUp('speedboat', 487, 585),
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
        name: 'Way Down',
        land: [[-3000, -110, 320, 3900], [900, -130, 3990, 3920], [-3000, 915, 4700, 3900]],
        docks:
        [
            { x0: 320, y0: 900, x1: 1470, y1: 915, quay: true },
            { x0: -20, y0: -180, x1: 1770, y1: -100 },
            { x0: 506, y0: 891.5, x1: 547.5, y1: 900 },
            { x0: 505.8, y0: 885.4, x1: 508, y1: 891.8 },
            { x0: 518.4, y0: 885.2, x1: 520.6, y1: 891.6 },
            { x0: 534.4, y0: 885.2, x1: 536.6, y1: 891.6 },
            { x0: 545.4, y0: 885.2, x1: 547.6, y1: 891.6 },
            { x0: 304, y0: 786, x1: 602, y1: 800 },
        ],
        boats:
        [
            { boat: 'trawler', start: { x: 350, y: 873, a: 0 }, slip: { x: 455, top: 900, a: PI/2, pad: [1.2, 1] } },
            { boat: 'jetski', start: { x: 480, y: 893, a: 0 }, slip: { x: 571.5, top: 900, a: PI/2, pad: [1.4, 1] } },
            { boat: 'container', start: { x: 640, y: 698, a: -PI/2 }, slip: { x: 636, y: 166, a: -PI/2, pad: [1.4, 1] } },
        ],
        // the trawler's tight squeeze on the way to its slip: two 40 m yachts in a line west of it, one
        // nose-in to the quay, leave a 13 m gap (y 845-858) for a 9.6 m boat
        moored: [{ boat: 'yacht', k: 5, x: 419, y: 841.25, a: PI*11/12 }, { boat: 'yacht', k: 5, x: 410, y: 812.25, a: PI/12 }, { boat: 'yacht', k: 5, x: 353, y: 762.25, a: -PI/2 }, { boat: 'yacht', k: 5, x: 423, y: 857.25, a: PI*11/12 }, { boat: 'yacht', k: 5, x: 335, y: 762.25, a: -PI/2 }, { boat: 'yacht', k: 5, x: 371, y: 762.25, a: -PI/2 }, { boat: 'yacht', k: 5, x: 412, y: 762.25, a: -PI/2 }],
        ducks: [{ x: 466, y: 868, kids: 2 }],
        traffic:
        [
            { boat: 'speedboat', path: [[510, 879.4], [501.4, 882.6], [498.6, 898.2]], end: 'back', speed: 0.6, during: [2] },
            { boat: 'trawler', path: [[570.5, 820.5], [589, 838], [598, 856], [600, 878], [588, 890], [572, 888], [560, 870], [554, 858], [556, 840]], end: 'loop', speed: 0.6, during: [2] },
            { boat: 'sailboat', path: [[541, 869.5], [530.5, 855.5], [502.5, 872], [501.5, 881.5], [512.5, 877.5], [519.5, 869.5], [526.5, 863.5], [534.5, 868.5], [540.5, 869.5]], end: 'back', speed: 0.6, during: [2] },
        ],
    },
    {
        // a short channel east to the slip, crossed by three narrow canals of looping traffic, faster each
        // time; all of it fits in the jet ski's view. The 3.5 m of sand between canals is where you wait for
        // a gap. The loops turn round in lagoons just off screen to the north and south, which run out to sea.
        name: 'Rush Hour',
        land: [[-100, -100, -6, 100], [-7, -18, 1.5, -4], [-7, 4, 1.5, 18], [7.5, -28, 11, 33.5], [17, -36.8, 20.5, -2.5], [17, 2.5, 20.5, 33.5], [26.5, -18, 31.5, -4], [26.5, 4, 31.5, 18], [30.5, -18, 37, 18], [32.5, -100, 130, 100]],
        docks: [{ x0: 30.5, y0: -6, x1: 32, y1: 6, quay: true }, { x0: -7.5, y0: 32.5, x1: 37.5, y1: 34.5 }, { x0: -8.1, y0: -42.9, x1: 38.6, y1: -34.4 }],
        boats:
        [
            { boat: 'jetski', start: { x: -2, y: 0, a: 0 }, slip: { right: 30.5, y: 0, a: 0, pad: [1.4, 1] } },
        ],
        traffic:
        [
            ...loopLane(4.5, 1.9, 24, false, 2.2, Array(5).fill([['dinghy', .25], ['swan', .55]]).flat()),
            ...loopLane(14, 1.9, 24, true, 3, Array(5).fill([['jetski', .2], ['dinghy', .33]]).flat()),
            ...loopLane(23.5, 1.9, 24, false, 4, Array(10).fill(['jetski', .27])),
        ],
    },
    {
        // jam in open water: no walls, the way out is all round. A nested box rafted up 0.6-0.7 m apart,
        // too tight to steer: the trawler and container ship go first, then the side sailboats, the cross
        // sailboats, the rowboats, and the swan in the middle.
        name: 'Open Water', jam: true, view: [-24, -7, 84, 52], boats: [], land: [], docks: [],
        walls: [{ x0: -108, y0: -91, x1: -78, y1: 136 }, { x0: 138, y0: -91, x1: 168, y1: 136 }, { x0: -108, y0: -91, x1: 168, y1: -61 }, { x0: -108, y0: 106, x1: 168, y1: 136 }],  // closes the sea round the view; delete one to open that side
        moored:
        [
            { boat: 'trawler', x: 30, y: 31.8, a: 0, slip: { x: 63.2, y: 32, a: 0, pad: [1, .8], fingers: 'none' } },
            { boat: 'yacht', k: 1.6, x: 21.1, y: 11.05, a: PI, slip: { x: 2.5, y: 2.45, a: 0, pad: [1, .8], fingers: 'none' } },
            { boat: 'speedboat', k: 2.6, x: 32.5, y: 11.05, a: PI, slip: { x: 15.8, y: 2.45, a: 0, pad: [1, .8], fingers: 'none' } },
            { boat: 'sailboat', k: 1.5, x: 41.24, y: 11.05, a: PI, slip: { x: 26.5, y: 2.45, a: 0, pad: [1, .8], fingers: 'none' } },
            { boat: 'sailboat', x: 21.4, y: 20, a: PI/2, slip: { x: 10.88, y: 31.2, a: PI/2, pad: [1, .8], fingers: 'none' } },
            { boat: 'sailboat', x: 38.6, y: 20, a: -PI/2, slip: { x: 50.88, y: 10.2, a: PI/2, pad: [1, .8], fingers: 'none' } },
            { boat: 'sailboat', x: 30, y: 24.02, a: 0, slip: { x: 19.2, y: 43.88, a: 0, pad: [1, .8], fingers: 'none' } },
            { boat: 'sailboat', x: 30, y: 15.98, a: PI, slip: { x: 40.2, y: -2.12, a: 0, pad: [1, .8], fingers: 'none' } },
            { boat: 'dinghy', x: 27.2, y: 20, a: PI/2, slip: { x: 35.08, y: 4.2675, a: 0, pad: [1, .8], fingers: 'none' } },
            { boat: 'dinghy', x: 32.8, y: 20, a: -PI/2, slip: { x: 42.08, y: 4.2675, a: 0, pad: [1, .8], fingers: 'none' } },
            { boat: 'swan', x: 30, y: 20, a: 0, slip: { x: 10.32, y: 14.87, a: PI/2, pad: [1, .8], fingers: 'none' } },
        ],
        buoys: [[14.5, 37.5, 1.5]],
        ducks: [{ x: 44, y: 6.5, kids: 2 }],
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
            { boat: 'jetski', start: { x: 215, y: 91, a: 0 }, slip: { x: 230, y: 77.9, a: PI/2, pad: [1.4, .8], fingers: 'none' } },
            { boat: 'sailboat', start: { x: 255, y: 93, a: 0 }, slip: { x: 290, y: 83.2, a: PI/2, pad: [.8, .5], fingers: 'none' } },
            { boat: 'yacht', k: 6, start: { x: 280, y: 110, a: PI }, slip: { x: 150, y: 173.5, a: PI/2, pad: [.8, .5], fingers: 'none' } },
        ],
        moored:
        [
            ...berths(3, 377, 350, -1, 2, [['yacht', 5.5], ['yacht', 6.5], ['yacht', 5], ['yacht', 6]]),
            ...berths(3, 266, 206, 1, 1.5, [['sailboat', 2.4], ['speedboat', 2], ['sailboat', 2.4], ['speedboat', 2], ['sailboat', 2.4]]),
            ...berths(3, 266, 200, -1, 2, [['yacht', 4], ['yacht', 3.5], ['yacht', 4.5]], [[150, 20]]),
            ...berths(104, 377, 76, 1, 1.2, [['speedboat', 2], ['dinghy', 1.3], ['jetski', 1], ['speedboat', 2], ['speedboat', 2], ['sailboat', 2.4], ['dinghy', 1.3], ['jetski', 1]], [[230, 4.2], [290, 7.5]]),
            ...berths(104, 377, 70, -1, 1.5, [['sailboat', 2.4], ['speedboat', 2], ['sailboat', 2.4], ['speedboat', 2]]),
        ],
        traffic:
        [
            { boat: 'dinghy', path: [[110, 148], [280, 148]], end: 'back', speed: .33 },
            { boat: 'speedboat', path: [[280, 136], [110, 136]], end: 'back', speed: .15 },
            { boat: 'jetski', path: [[320, 125], [365, 125], [365, 190], [320, 190]], end: 'loop', speed: .22 },
            { boat: 'sailboat', path: [[30, 257], [260, 257]], end: 'back', speed: .33 },
            { boat: 'speedboat', path: [[360, 278], [40, 278]], end: 'back', speed: .15 },
            { boat: 'dinghy', path: [[110, 42], [370, 42]], end: 'back', speed: .33 },
        ],
    },
    {
        // jam in open water, turned 45 degrees: a jet ski in the middle of swans, speedboats,
        // a 20 m yacht and the trawler, with small boats pinning the outer pair's ends. 6 rounds.
        name: 'Raft-Up', jam: true, view: [-5, 3, 73, 57], boats: [], land: [], docks: [],
        walls: [{ x0: -74, y0: -66, x1: -44, y1: 126 }, { x0: 112, y0: -66, x1: 142, y1: 126 }, { x0: -74, y0: -66, x1: 142, y1: -36 }, { x0: -74, y0: 96, x1: 142, y1: 126 }],  // closes the sea round the view; delete one to open that side
        moored:
        [
            { boat: 'jetski', x: 32.00, y: 32.00, a: PI/4, slip: { x: 16.7, y: 39.95, a: 0, pad: [1, .8], fingers: 'none' } },
            { boat: 'swan', x: 30.03, y: 30.03, a: 3*PI/4, slip: { x: 16.32, y: 23.87, a: PI/2, pad: [1, .8], fingers: 'none' } },
            { boat: 'swan', x: 33.97, y: 33.97, a: -PI/4, slip: { x: 31.87, y: 52.32, a: 0, pad: [1, .8], fingers: 'none' } },
            { boat: 'speedboat', x: 29.65, y: 34.35, a: PI/4, slip: { x: 24.1, y: 51.4, a: PI/2, pad: [1, .8], fingers: 'none' } },
            { boat: 'speedboat', x: 34.35, y: 29.65, a: -3*PI/4, slip: { x: 40.4, y: 51.1, a: 0, pad: [1, .8], fingers: 'none' } },
            { boat: 'speedboat', k: 2.7, x: 27.40, y: 27.40, a: -PI/4, slip: { x: 21.6, y: 8.2, a: 0, pad: [1, .8], fingers: 'none' } },
            { boat: 'speedboat', k: 2.7, x: 36.60, y: 36.60, a: 3*PI/4, slip: { x: 42.6, y: 8.2, a: 0, pad: [1, .8], fingers: 'none' } },
            { boat: 'yacht', k: 2.5, x: 25.94, y: 38.06, a: -3*PI/4, slip: { x: 8.25, y: 35.25, a: PI/2, pad: [1, .8], fingers: 'none' } },
            { boat: 'trawler', x: 39.16, y: 24.84, a: PI/4, slip: { x: 64, y: 30.2, a: PI/2, pad: [1, .8], fingers: 'none' } },
            { boat: 'jetski', x: 17.99, y: 30.10, a: 3*PI/4, slip: { x: 10.7, y: 20.95, a: 0, pad: [1, .8], fingers: 'none' } },
            { boat: 'jetski', x: 33.90, y: 46.01, a: -PI/4, slip: { x: 18.95, y: 52.7, a: PI/2, pad: [1, .8], fingers: 'none' } },
            { boat: 'dinghy', x: 28.80, y: 14.48, a: -PI/4, slip: { x: 31.2675, y: 7.08, a: PI/2, pad: [1, .8], fingers: 'none' } },
            { boat: 'dinghy', x: 49.52, y: 35.20, a: 3*PI/4, slip: { x: 52.2675, y: 41.08, a: PI/2, pad: [1, .8], fingers: 'none' } },
        ],
        buoys: [[18, 46, 2], [48, 16, 2]],
        ducks: [{ x: 46, y: 46, kids: 3 }],
    },
    {
        // a space station drifting round a slow circle and turning once a minute, solar wings sweeping round it. Ships dock
        // across the module stack: the pod on the lab's port side, then a 28 m yacht on the aft module's starboard side.
        // Only the gaps between the wings lead in.
        name: 'Spin Dock', land: [], docks: [],
        walls: [{ x0: -280, y0: -280, x1: -250, y1: 280 }, { x0: 250, y0: -280, x1: 280, y1: 280 }, { x0: -280, y0: -280, x1: 280, y1: -250 }, { x0: -280, y0: 250, x1: 280, y1: 280 }],
        station: { x: 0, y: 0, a: .4, spin: 2*PI/60, drift: { r: 10, period: 140, phase: 0 } },
        boats:
        [
            { boat: 'dinghy', view: 4, start: { x: 0, y: -82, a: PI/2 }, slip: { on: 'station', x: 17, y: 6.24, a: PI/2, pad: [1.4, 1], fingers: 'none' } },
            { boat: 'yacht', k: 3.5, start: { x: 170, y: 40, a: PI }, slip: { on: 'station', x: -21, y: -19.3, a: PI/2, pad: [.8, .6], fingers: 'none' } },
        ],
        buoys: [[60, -75, 1.2], [-75, 55, 1.2]],
    },
    {
        // gravity: land on a pad on a planet, standing up. The pod first, then a space liner on the big pad next door.
        name: 'Touchdown', gravity: { share: .35 }, land: [],
        docks: [{ x0: -4, y0: -3, x1: 4, y1: .5, pad: true }, { x0: 45, y0: -12, x1: 145, y1: 1, pad: true }],
        lands: [{ x: 0, y: -1200, k: 1200, circles: [[0, 0, 1]], detail: 512 }],
        walls: [{ x0: -1600, y0: -1300, x1: -1500, y1: 1600 }, { x0: 1500, y0: -1300, x1: 1600, y1: 1600 }, { x0: -1600, y0: 1500, x1: 1600, y1: 1600 }],
        boats:
        [
            { boat: 'dinghy', view: 1.6, start: { x: -22, y: 38, a: PI/2 }, slip: { x: 0, bottom: .5, a: PI/2, pad: [.6, 1.2], fingers: 'none' } },
            { boat: 'cruise', start: { x: -350, y: 560, a: PI/2 }, slip: { x: 95, bottom: 1, a: PI/2, pad: [.6, .6], fingers: 'none' } },
        ],
    },
    {
        // bonus: each boat 100x the last: the harbor is cut into a small island, the island parks in a
        // bay next to it, the continent closes the gap in Pangaea thousands of km away
        name: 'Continental Drift', bonus: true, land: HARBOR_ISLAND.land, docks: HARBOR_ISLAND.docks,
        boats:
        [
            { boat: 'dinghy', start: { x: 452, y: 566, a: .3 }, slip: { x: 474, top: 585, a: PI/2 } },
            { boat: 'cruise', start: { x: 1180, y: 470, a: PI }, slip: { x: 680, top: 585, a: 0, pad: [.6, .3], fingers: 'none' } },
            { boat: 'island', start: { x: 95000, y: 1500, a: PI }, slip: { x: 36000, y: 0, a: 0, pad: [1.2, 1], fingers: 'none' } },
            { boat: 'continent', start: { x: -.5e6, y: 3.5e6, a: 0 }, slip: { x: 5e6, y: 3.5e6, a: 0, pad: [1.2, 1], fingers: 'none' } },
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
    {
        // sandbox, only with ?test: open water with a beach, piers, an islet, a current,
        // buoys, ducks and a few boats to bump. The buttons on the left spawn any boat type next to the one you drive.
        // No slips and no stars. Boats are real size, so the Island and Continent are huge: use RESTART to start over.
        name: 'Test Map', test: true, jam: true, view: [-130, -100, 130, 130], boats: [],
        land: [[-3000, 100, 3000, 3000]],
        docks:
        [
            { x0: -60, y0: 96, x1: 60, y1: 100, quay: true },
            { x0: -40, y0: 70, x1: -34, y1: 100 },
            { x0: -90, y0: 40, x1: -60, y1: 46 },
        ],
        lands: [{ x: -90, y: -50, k: 6, circles: [[0, 0, 3], [2.5, .5, 2], [-2.4, -.3, 2.2]], grass: true }],
        currents: [{ x0: -125, y0: -100, x1: -60, y1: -80, dx: 2, dy: 0 }],
        moored:
        [
            { boat: 'sailboat', x: 0, y: -30, a: PI/2 },
            { boat: 'speedboat', x: 20, y: -30, a: 0 },
            { boat: 'trawler', x: -40, y: -60, a: PI },
            { boat: 'yacht', x: 60, y: -70, a: 0 },
        ],
        buoys: [[-20, 0, 1], [20, 10, 1.5], [60, 20, 1]],
        ducks: [{ x: -30, y: 20, kids: 3 }],
    },
];

// bonus levels are hidden for now; ?bonus shows them after the regular ones. ?test adds the Test Map (a sandbox)
const SHOW_BONUS = new URLSearchParams(location.search).has('bonus');
const SHOW_TEST = new URLSearchParams(location.search).has('test');
const LEVELS = [...SCALE_LEVELS.filter(L => !L.bonus && !L.test), ...(SHOW_BONUS ? SCALE_LEVELS.filter(L => L.bonus) : []), ...(SHOW_TEST ? SCALE_LEVELS.filter(L => L.test) : [])].map(L => ({ ...L, world: 1 }));
