'use strict';
// Levels. Units are meters (y up). A level is a list of boats parked one after the other in the
// same harbor; boats waiting their turn sit at their start, parked boats stay where they stopped.
//
// boats:   [{ boat, k?, start:{x,y,a}, slip }]   k defaults to the boat's real size (BOATS[boat].k); start: {on: 'station', x, y, a}
//          waits riding on the station (in its coordinates) until its turn
// slip:    x/y center, or top/right = the pier edge it hangs from; a = heading the boat must face
//          (PI/2 = bow into a top pier; either end in is fine), pad = extra [length, width] room in
//          toy units (times k), fingers = 'both' | 'none' (short docks along the slip's long sides)
// land:    [x0, y0, x1, y1] sand;  docks: {x0, y0, x1, y1, quay?, plank?}
// walls:   invisible colliders {x0, y0, x1, y1}: boats and floaters bump into them, nothing is drawn (the editor shows them)
// lands:   blob landmasses {x, y, k, circles: [[x, y, r]] in units of k (first one on the center), grass?, detail?: outline points}
// pads:    a dock with pad: true is a landing pad; a slip with bottom: y stands on it (gravity levels)
// station: a spinning space station {x, y (center of its drift), a, spin: rad/s, drift: {r, period, phase}}; a slip with
//          on: 'station' is given in the station's coordinates and moves with it (src/space.js)
// gravity: {share: of each ship's full thrust, dir?: angle (default down), planet?: a PLANETS type (its ground colors)}
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

// a docking bay inside a station: the inner box [x0, y0, x1, y1] walled by the station's main hull, t thick, plus spur
// modules [x0, y0, x1, y1] (one end in a wall) so it reads as a network of modules. Outside the hull, modules reach out
// from the top and side walls at a third and two thirds of their length, a crossbar module at each end: the rest of the
// station, out of the ships' reach (none below, where the pick hint is written). The hull strips overlap at the corners.
function bay(x0, y0, x1, y1, t, spurs = [])
{
    const out = [], arm = 16, w = t*.75, bar = 14;
    for (const f of [1/3, 2/3])
    {
        const x = x0 + (x1 - x0)*f, y = y0 + (y1 - y0)*f;
        out.push({ x0: x - w/2, y0: y1 + t, x1: x + w/2, y1: y1 + t + arm }, { x0: x - bar/2, y0: y1 + t + arm, x1: x + bar/2, y1: y1 + t + arm + w });
        out.push({ x0: x1 + t, y0: y - w/2, x1: x1 + t + arm, y1: y + w/2 }, { x0: x1 + t + arm, y0: y - bar/2, x1: x1 + t + arm + w, y1: y + bar/2 });
        out.push({ x0: x0 - t - arm, y0: y - w/2, x1: x0 - t, y1: y + w/2 }, { x0: x0 - t - arm - w, y0: y - bar/2, x1: x0 - t - arm, y1: y + bar/2 });
    }
    return [
        ...out,
        { x0: x0 - t, y0: y0 - t, x1: x1 + t, y1: y0, quay: true },
        { x0: x0 - t, y0: y1, x1: x1 + t, y1: y1 + t, quay: true },
        { x0: x0 - t, y0: y0 - .5, x1: x0, y1: y1 + .5, quay: true },
        { x0: x1, y0: y0 - .5, x1: x1 + t, y1: y1 + .5, quay: true },
        ...spurs.map(([a, b, c, d]) => ({ x0: a, y0: b, x1: c, y1: d })),
    ];
}

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

// planet types for the gravity levels: how hard they pull (share of each ship's own full thrust, so it feels the same in
// every ship: a ship hovers at that throttle) and, by name, the colors of their ground (ROCK_INKS in src/skin.js)
const PLANETS =
{
    moon:  { planet: 'moon',  share: .17 },     // grey: a light pull, ships drift down slowly and hover on a whisper of thrust
    rocky: { planet: 'rocky', share: .35 },     // brick red
    heavy: { planet: 'heavy', share: .55 },     // ochre: hovering takes over half the thrust, and a fall builds speed fast
};

// gravity levels: flat ground with its top at y = 0 (a round planet let a winged ship lie stuck on its side on the
// slope), walled by invisible walls `size` m out. Each ship lands upright on its own pad: pad: [x, width, lift?] (lift:
// the deck stands that many meters above the ground, a tower), room: the slip's extra [length, width] in toy units
// (see slip above). planet: a PLANETS type
function landing(name, planet, size, ships)
{
    const docks = [];
    const boats = ships.map(({ pad: [x, w, lift = 0], room = [.6, .8], ...ship }) =>
    {
        const t = clamp(w*.04, .5, 1.5), y1 = +(t + lift).toFixed(2);
        docks.push({ x0: x - w/2, y0: -3*t, x1: x + w/2, y1, pad: true });
        return { ...ship, slip: { x, bottom: y1, a: PI/2, pad: room, fingers: 'none' } };
    });
    return {
        name, gravity: { ...PLANETS[planet] }, land: [[-size - 100, -size, size + 100, 0]], docks, boats,
        walls: [{ x0: -size - 100, y0: -size, x1: -size, y1: size + 100 }, { x0: size, y0: -size, x1: size + 100, y1: size + 100 }, { x0: -size - 100, y0: size, x1: size + 100, y1: size + 100 }],
    };
}

const SCALE_LEVELS =
[
    {
        // a space station drifting round a slow circle and turning once a minute, solar wings sweeping round it. Ships dock
        // across the end of the module stack, broadside to its port like the bar of a T: the pod at the front end, then
        // a 28 m yacht at the aft end. Only the gaps between the wings lead in.
        name: 'Spin Dock', land: [], docks: [],
        walls: [{ x0: -280, y0: -280, x1: -250, y1: 280 }, { x0: 250, y0: -280, x1: 280, y1: 280 }, { x0: -280, y0: -280, x1: 280, y1: -250 }, { x0: -280, y0: 250, x1: 280, y1: 280 }],
        station: { x: 0, y: 0, a: .4, spin: 2*PI/60, drift: { r: 10, period: 140, phase: 0 } },
        boats:
        [
            { boat: 'dinghy', view: 4, start: { x: 37.8, y: -12, a: PI/2 }, slip: { on: 'station', x: 29.01, y: 0, a: PI/2, pad: [1.4, 1], fingers: 'none' } },
            { boat: 'yacht', k: 3.5, start: { x: 170, y: 40, a: PI }, slip: { on: 'station', x: -39.37, y: 0, a: PI/2, pad: [.8, .6], fingers: 'none' } },
        ],
        buoys: [[60, -75, 1.2], [-75, 55, 1.2]],
    },
    {
        // gravity: land on a pad on a planet, standing up. Largest first: a space liner on the big pad, then a star yacht
        // on the pad next door, then the pod on the small pad beside it.
        name: 'Touchdown', gravity: { ...PLANETS.rocky }, land: [[-1600, -1500, 1600, 0]],
        docks: [{ x0: -4, y0: -3, x1: 4, y1: .5, pad: true }, { x0: 14, y0: -3, x1: 34, y1: .8, pad: true }, { x0: 45, y0: -12, x1: 145, y1: 1, pad: true }],
        walls: [{ x0: -1600, y0: -1500, x1: -1500, y1: 1600 }, { x0: 1500, y0: -1500, x1: 1600, y1: 1600 }, { x0: -1600, y0: 1500, x1: 1600, y1: 1600 }],
        boats:
        [
            { boat: 'cruise', start: { x: -350, y: 560, a: PI/2 }, slip: { x: 95, bottom: 1, a: PI/2, pad: [.6, .6], fingers: 'none' } },
            { boat: 'yacht', k: 3.5, start: { x: -100, y: 85, a: PI/2 }, slip: { x: 24, bottom: .8, a: PI/2, pad: [.6, .9], fingers: 'none' } },
            { boat: 'dinghy', view: 1.6, start: { x: -22, y: 38, a: PI/2 }, slip: { x: 0, bottom: .5, a: PI/2, pad: [.6, 1.2], fingers: 'none' } },
        ],
    },
    // a small moon (flat ground): a 26 m asteroid miner, a 12 m solar sailer, then a 2.6 m flying saucer. The saucer starts on the far
    // side of the sailer's pad.
    landing('Moon Hop', 'moon', 600,
    [
        { boat: 'trawler', start: { x: -200, y: 160, a: PI/2 }, pad: [60, 24] },
        { boat: 'sailboat', start: { x: 150, y: 70, a: PI/2 }, pad: [0, 9] },
        { boat: 'swan', view: 2, start: { x: -70, y: 30, a: PI/2 }, pad: [-30, 5] },
    ]),
    {
        // the Spin Dock station seven times bigger (868 m), turning once every five minutes, with two more ports at the
        // ends of its side modules. A 300 m space liner docks at the aft end, a 26 m asteroid miner at the front end, then
        // a 6.8 m zoomer and a 2.4 m rocket scooter at the side modules, each in the gap between the stack and the wings.
        // The zoomer and the scooter wait their turn riding on the station, between the radiators and the wings.
        name: 'Grand Station', land: [], docks: [],
        walls: [{ x0: -1100, y0: -1100, x1: -1000, y1: 1100 }, { x0: 1000, y0: -1100, x1: 1100, y1: 1100 }, { x0: -1100, y0: -1100, x1: 1100, y1: -1000 }, { x0: -1100, y0: 1000, x1: 1100, y1: 1100 }],
        station: { x: 0, y: 0, a: .4, scale: 7, spin: 2*PI/300, drift: { r: 20, period: 300, phase: 0 }, ports: [[23, 15, PI/2], [23, -11, -PI/2]] },
        boats:
        [
            { boat: 'cruise', start: { x: -800, y: -300, a: 0 }, slip: { on: 'station', port: 1, pad: [.6, .6], fingers: 'none' } },
            { boat: 'trawler', start: { x: 650, y: 250, a: PI }, slip: { on: 'station', port: 0, pad: [.8, .6], fingers: 'none' } },
            { boat: 'speedboat', view: 2, start: { on: 'station', x: 100, y: 160, a: 0 }, slip: { on: 'station', port: 2, pad: [.8, .6], fingers: 'none' } },
            { boat: 'jetski', view: 2, start: { on: 'station', x: 100, y: -150, a: 0 }, slip: { on: 'station', port: 3, pad: [.8, .6], fingers: 'none' } },
        ],
    },
    // pads on towers: an 80 m star yacht on the ground, then a 6.8 m zoomer on a 30 m tower and a 2.4 m rocket scooter on
    // a 55 m one, beside the yacht
    landing('Pad Towers', 'rocky', 800,
    [
        { boat: 'yacht', start: { x: -300, y: 250, a: PI/2 }, pad: [-60, 50] },
        { boat: 'speedboat', view: 1.6, start: { x: 120, y: 90, a: PI/2 }, pad: [0, 8, 30] },
        { boat: 'jetski', start: { x: 90, y: 115, a: PI/2 }, pad: [25, 4, 55] },
    ]),
    // a big planet (flat ground): a 400 m classic frigate, a 112 m stealth cruiser, then a 2.6 m flying saucer between them
    landing('Heavy Lift', 'heavy', 2500,
    [
        { boat: 'container', start: { x: -900, y: 700, a: PI/2 }, pad: [300, 150], room: [.6, .6] },
        { boat: 'sub', start: { x: -350, y: 150, a: PI/2 }, pad: [-50, 55], room: [.6, .6] },
        { boat: 'swan', view: 2, start: { x: 60, y: 30, a: PI/2 }, pad: [10, 5] },
    ]),
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
