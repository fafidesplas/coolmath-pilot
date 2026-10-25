'use strict';
// Boat types: size (L along the bow, W across), handling, hull shape and deck decorations.
// Local coordinates: +x is the bow, +y is port (left). Units are world units (1 = 32 px at 1280x720).

const C_INK    = rgb(.17, .18, .26);       // #2B2D42 outlines
const C_WATER  = rgb(.55, .84, .82);       // #8CD6D1
const C_WATER2 = rgb(.66, .89, .86);       // ripple highlights
const C_WOOD   = rgb(.91, .72, .45);       // #E8B873
const C_WOOD2  = rgb(.78, .56, .30);
const C_CORAL  = rgb(.95, .39, .37);       // #F2635F
const C_SUNNY  = rgb(1, .80, .28);         // #FFCC47
const C_CREAM  = rgb(1, .97, .90);         // #FFF7E5
const C_TEAL   = rgb(.20, .58, .62);       // #33949E
const C_SAND   = rgb(.98, .88, .66);
const C_SHADOW = rgb(.17, .18, .26, .18);
const C_SKIN   = rgb(.95, .76, .60);
const C_NAVY   = rgb(.22, .29, .45);

const C_STONE  = rgb(.85, .83, .78);       // concrete quays
const C_GRASS  = rgb(.60, .80, .45);       // island and continent interiors

// Hulls and decorations are drawn at toy size (L, W). k scales a boat to real size in meters,
// so a cruise ship (k 30) is 300 m long and a swan pedalo (k 1.1) is 2.6 m. Handling stays the
// same relative to the boat, then gets slower the bigger it is (see boatScale in main.js).
// view (optional): the camera shows this many times more around the boat (see cameraGoal in main.js).
const BOATS =
{
    jetski:    { name:'Jet Ski',      L:2.4, W:1.1,  k:1,   mass:.8,  power:7,   reverse:.3, turn:1.5, wash:2.6, dragF:.9,  dragS:1.2, dragA:2,   hull:'pointy', color:C_TEAL,  captainX:-.15, view:3 },
    dinghy:    { name:'Rowboat',      L:2.2, W:1.15, k:1.3, mass:1,   power:6,   reverse:.6, turn:1.1, wash:1.6, dragF:1.2, dragS:3,   dragA:3,   hull:'pointy', color:C_CORAL, captainX:-.35 },
    speedboat: { name:'Zippy',        L:3.4, W:1.3,  k:2,   mass:1.5, power:13,  reverse:.5, turn:.9,  wash:1.2, dragF:1,   dragS:1.4, dragA:3.2, hull:'pointy', color:C_CREAM, captainX:-.2 },
    swan:      { name:'Swan Pedalo',  L:2.4, W:1.6,  k:1.1, mass:1,   power:3.5, reverse:.7, turn:2.2, wash:3,   dragF:1.4, dragS:2,   dragA:1.1, hull:'swan',   color:C_CREAM, captainX:-.45 },
    pontoon:   { name:'Party Barge',  L:4.6, W:2.4,  k:2,   mass:4,   power:12,  reverse:.6, turn:.55, wash:.9,  dragF:.8,  dragS:2.2, dragA:2.4, hull:'box',    color:C_SUNNY, captainX:-1.6 },
    sailboat:  { name:'Sailboat',     L:5,   W:1.6,  k:2.4, mass:3.5, power:7,   reverse:.5, turn:.7,  wash:.5,  dragF:.5,  dragS:6,   dragA:3,   hull:'pointy', color:C_CREAM, captainX:-1.8 },
    trawler:   { name:'Trawler',      L:3.3, W:1.2,  k:8,   mass:5,   power:30,  reverse:.8, turn:.9,  wash:2,   dragF:1.5, dragS:3,   dragA:3,   hull:'pointy', color:C_CORAL, captainX:.55 },
    yacht:     { name:'Mega Yacht',   L:8,   W:2.6,  k:10,  mass:10,  power:30,  reverse:.5, turn:.35, wash:.45, dragF:.6,  dragS:2.5, dragA:1.6, hull:'pointy', color:C_CREAM, captainX:.6 },
    cruise:    { name:'Cruise Ship',  L:10,  W:1.3,  k:30,  mass:12,  power:34,  reverse:.5, turn:.32, wash:.6,  dragF:.5,  dragS:2.6, dragA:1.6, hull:'pointy', color:C_NAVY,  captainX:3.3 },
    container: { name:'Container Ship', L:10, W:1.5, k:40,  mass:14,  power:34,  reverse:.45,turn:.28, wash:.4,  dragF:.45, dragS:3,   dragA:1.8, hull:'pointy', color:C_CORAL, captainX:-4.1 },
    // landmasses: blob hulls made of circles [x, y, r], no keel to speak of
    island:    { name:'Island',       L:10,  W:6,    k:3000, mass:14, power:36, reverse:.5, turn:.3,  wash:.6,  dragF:.6,  dragS:1.1, dragA:1.5, hull:'blob', color:C_SAND, deck:C_GRASS,
                 blob:[[0,0,2.6],[2.6,.6,1.9],[-2.7,-.5,2],[4,1.1,1],[-3.9,-.2,1.1],[.9,-1.5,1.4],[-1,1.7,1.3]] },
    continent: { name:'Continent',    L:10,  W:7,    k:3e5,  mass:16, power:36, reverse:.5, turn:.28, wash:.5,  dragF:.6,  dragS:1.1, dragA:1.6, hull:'blob', color:C_SAND, deck:C_GRASS,
                 blob:[[0,0,3],[2.8,1,2.2],[-2.6,-.8,2.4],[4.2,-.6,.8],[-4.1,1,.9],[1.5,-2.2,1.3],[-1.2,2.3,1.2],[-2,-2.6,.8]] },
};

// Outline of a union of circles [x, y, r] seen from the origin: along each ray, the farthest
// circle edge. The first circle must sit on the origin so every ray hits something.
function blobOutline(circles, n=64)
{
    const pts = [];
    for (let i = 0; i < n; i++)
    {
        const a = i/n*PI*2, dx = Math.cos(a), dy = Math.sin(a);
        let far = 0;
        for (const [x, y, r] of circles)
        {
            const b = x*dx + y*dy, disc = b*b - (x*x + y*y - r*r);
            if (disc >= 0) far = Math.max(far, b + Math.sqrt(disc));
        }
        pts.push(vec2(dx*far, dy*far));
    }
    return pts;
}

// Rounded rectangle hull, front and back corner radii separate
function hullRoundRect(l, w, rf, rb)
{
    const pts = [], arc = (cx, cy, r, a0) =>
    {
        for (let i = 0; i <= 5; i++)
        {
            const a = a0 + i/5*PI/2;
            pts.push(vec2(cx + Math.cos(a)*r, cy + Math.sin(a)*r));
        }
    };
    arc(l-rf,  w-rf, rf, 0);
    arc(-l+rb, w-rb, rb, PI/2);
    arc(-l+rb, -w+rb, rb, PI);
    arc(l-rf,  -w+rf, rf, PI*1.5);
    return pts;
}

function makeHull(kind, L, W)
{
    const l = L/2, w = W/2;
    if (kind == 'pointy')
    {
        const half = [[l,0],[l*.8,w*.5],[l*.55,w*.85],[l*.2,w],[-l*.8,w*.97],[-l,w*.75]];
        const pts = half.map(p=>vec2(p[0], p[1]));
        for (let i = half.length-1; i > 0; i--)
            pts.push(vec2(half[i][0], -half[i][1]));
        return pts;
    }
    if (kind == 'box')  return hullRoundRect(l, w, .35, .35);
    return hullRoundRect(l, w, w*.95, w*.6); // swan
}

// Collision circles along the keel (or a landmass's blob), scaled by k
function hullCircles(t, k)
{
    return t.circles.map(c => ({ x:c.x*k, y:c.y*k, r:c.r*k }));
}

// distance from (x, 0) on the keel to the nearest hull edge
function keelClearance(pts, x)
{
    let best = Infinity;
    for (let i = 0; i < pts.length; i++)
    {
        const a = pts[i], b = pts[(i+1) % pts.length], dx = b.x - a.x, dy = b.y - a.y;
        const u = clamp(((x - a.x)*dx - a.y*dy) / (dx*dx + dy*dy), 0, 1);
        best = Math.min(best, Math.hypot(a.x + u*dx - x, a.y + u*dy));
    }
    return best;
}

// Circles along the keel of a tapered hull: each as big as fits inside the hull (plus 5% of the
// half-width), shrinking toward the bow and stern so the tips collide where they are drawn
function fitCircles(pts, L, W)
{
    const l = L/2, over = .05*W/2, r = x => keelClearance(pts, x) + over;
    // x + r(x) only grows toward the bow, so bisect for the circle that just reaches the tip
    const reach = f => { let lo = 0, hi = l; for (let i = 0; i < 40; i++) { const m = (lo + hi)/2; f(m) < l ? lo = m : hi = m; } return lo; };
    const bow = reach(x => x + r(x)), stern = -reach(x => x + r(-x));
    const circles = [];
    for (let x = bow; x > stern; )
    {
        circles.push({ x, y:0, r:r(x) });
        const step = .8*r(x);
        x -= Math.min(step, .8*r(x - step));
    }
    circles.push({ x:stern, y:0, r:r(stern) });
    return circles;
}

function makeCircles(L, W)
{
    const r = W/2, span = Math.max(0, L - W);
    const n = Math.max(1, Math.ceil(span / (r*.8)) + 1);
    const circles = [];
    for (let i = 0; i < n; i++)
        circles.push({ x: n == 1 ? 0 : -span/2 + span*i/(n-1), y:0, r });
    return circles;
}

for (const key in BOATS)
{
    const t = BOATS[key];
    t.key = key;
    t.hullPts = t.blob ? blobOutline(t.blob) : makeHull(t.hull, t.L, t.W);
    t.deckPts = t.hullPts.map(p => t.blob ? p.scale(.8) : vec2(p.x*.78, p.y*.68));
    t.circles = t.blob ? t.blob.map(([x, y, r]) => ({ x, y, r })) :
        t.hull == 'pointy' ? fitCircles(t.hullPts, t.L, t.W) : makeCircles(t.L, t.W);
}

// Deck decorations, drawn with a local-space painter (see render.js)
const BOAT_DECO =
{
    jetski(d, t)
    {
        d.poly([[1.1,0],[.75,.3],[.45,.32],[.45,-.32],[.75,-.3]], C_CREAM, true);   // nose cowl
        d.ellipse(-.4, 0, 1.2, .44, C_NAVY, true);                                  // seat
        d.line(.35, .45, .35, -.45, .09, C_INK);                                     // handlebars
        d.circle(.35, .45, .16, C_INK);
        d.circle(.35, -.45, .16, C_INK);
        d.rect(-1.15, 0, .16, .3, C_INK);                                           // jet nozzle
    },
    dinghy(d, t)
    {
        d.line(.15, .45, .15, -.45, .1, C_WOOD2);               // bench
        d.line(.1, .45, -.25, .85, .12, C_WOOD2);                 // oars
        d.line(.1, -.45, -.25, -.85, .12, C_WOOD2);
        d.ellipse(-.32, .9, .4, .18, C_WOOD, true);
        d.ellipse(-.32, -.9, .4, .18, C_WOOD, true);
    },
    speedboat(d, t)
    {
        d.poly([[.75,.45],[.95,0],[.75,-.45],[.45,-.5],[.45,.5]], rgb(.4,.7,.8), true); // windshield
        d.line(1.2, .62, -1.6, .62, .12, C_CORAL);               // racing stripes
        d.line(1.2, -.62, -1.6, -.62, .12, C_CORAL);
        d.rect(-1.6, 0, .25, .5, C_INK);                          // outboard
    },
    swan(d, t)
    {
        d.ellipse(-.1, .62, 1.3, .35, C_CREAM, true);             // wings
        d.ellipse(-.1, -.62, 1.3, .35, C_CREAM, true);
        d.line(.6, 0, 1.05, 0, .36, C_INK);                        // neck
        d.line(.6, 0, 1.05, 0, .2, C_CREAM);
        d.circle(1.1, 0, .7, C_CREAM, true);                       // head
        d.poly([[1.4,.16],[1.85,0],[1.4,-.16]], C_SUNNY, true);    // beak
        d.circle(1.18, .2, .12, C_INK);
        d.circle(1.18, -.2, .12, C_INK);
        d.circle(.15, .3, .3, C_SKIN, true);                       // passenger
    },
    pontoon(d, t)
    {
        d.rect(.2, 0, 3, 2, C_CORAL, true);                        // striped canopy
        for (let i = 0; i < 3; i++)
            d.rect(-1 + i*1.2, 0, .45, 2, C_CREAM);
        d.rect(.2, 0, 3, 2, undefined, true);
        d.circle(1.95, .7, .5, C_TEAL, true);                      // balloons
        d.circle(2.05, .2, .45, C_SUNNY, true);
        d.circle(1.95, -.6, .5, C_CORAL, true);
    },
    sailboat(d, t, b)
    {
        d.circle(.6, 0, .3, C_WOOD2, true);                        // mast
        const swing = b ? Math.sin(time*.8 + b.id)*.25 : 0;
        d.poly([[.6,0],[-1.2,.8+swing],[-2,.15+swing*.5]], C_CREAM, true); // sail
        d.line(.6, 0, -2, .15+swing*.5, .1, C_WOOD2);              // boom
    },
    trawler(d, t)
    {
        d.line(.15, 0, -.45, .72, .07, C_INK);                     // outrigger booms, just past the rail
        d.line(.15, 0, -.45, -.72, .07, C_INK);
        d.circle(-.45, .72, .14, C_CORAL);
        d.circle(-.45, -.72, .14, C_CORAL);
        d.rect(.6, 0, .75, .62, C_CREAM, true);                    // wheelhouse, forward
        d.rect(.88, 0, .14, .5, rgb(.4,.7,.8));                     // windows
        d.circle(.15, 0, .2, C_WOOD2, true);                        // mast
        d.rect(-.25, .16, .26, .2, C_SUNNY, true);                  // fish crates
        d.rect(-.25, -.12, .26, .2, C_TEAL, true);
        d.rect(-.55, .02, .26, .2, C_SUNNY, true);
        d.rect(-1.1, 0, .32, .66, C_WOOD2, true);                   // net drum at the stern
        for (const y of [-.2, 0, .2]) d.line(-1.24, y, -.96, y, .04, C_INK);
    },
    yacht(d, t)
    {
        d.rect(-.4, 0, 4.8, 1.75, C_CREAM, true);                   // lower deck
        d.rect(.5, 0, 2.2, 1.3, rgb(.4,.7,.8), true);               // tinted glass
        d.rect(-.6, 0, 1.8, 1.2, C_CREAM, true);                     // upper deck
        d.circle(-2.4, 0, 1.05, C_TEAL, true);                       // hot tub
        d.circle(-2.4, 0, .5, rgb(.6,.9,.95));
        d.circle(2.7, 0, .85, C_NAVY, true);                         // helipad
        d.text('H', 2.7, 0, .7, C_CREAM);
    },
    cruise(d, t, b)
    {
        d.rect(-.5, 0, 7.6, 1.02, C_CREAM, true);                  // decks
        for (let i = 0; i < 8; i++)                                  // lifeboats
        {
            d.ellipse(-3.8 + i*.95, .58, .55, .16, C_SUNNY, true);
            d.ellipse(-3.8 + i*.95, -.58, .55, .16, C_SUNNY, true);
        }
        d.rect(-.6, 0, 1.6, .55, rgb(.4,.75,.9), true);             // pool
        d.line(.3, .2, 1.2, .35, .1, C_CORAL);                       // waterslide
        d.line(1.2, .35, 1.6, -.1, .1, C_CORAL);
        d.ellipse(-2.6, 0, 1, .5, C_CORAL, true);                    // funnel
        d.ellipse(-2.75, 0, .45, .24, C_INK);
        d.rect(3.25, 0, .3, .95, rgb(.4,.7,.8), true);               // bridge windows
    },
    container(d, t, b)
    {
        const colors = [C_TEAL, C_SUNNY, C_NAVY, C_CORAL, C_CREAM];
        for (let i = 0; i < 9; i++)
        for (let j = 0; j < 4; j++)
            d.rect(-3.3 + i*.82, -.57 + j*.38, .76, .34, colors[(i*3 + j*7 + (b ? b.id : 0)) % 5], true);
        d.rect(-4.15, 0, .55, 1.3, C_CREAM, true);                  // bridge
        d.rect(-3.98, 0, .14, 1.1, rgb(.4,.7,.8));
        d.circle(-4.55, 0, .3, C_NAVY, true);                        // funnel
    },
    island(d, t, b)
    {
        d.circle(-.3, .2, 2.6, C_WOOD2, true);                       // volcano
        d.circle(-.3, .2, 1, C_CORAL, true);
        d.circle(-.3, .2, .45, C_SUNNY);
        for (const [x, y] of [[2.6, .9], [3.4, -.2], [-2.8, -1.2], [-3.6, .3], [1.2, -1.6], [-1.2, 2]])
        {
            d.circle(x, y, 1.1, C_TEAL, true);                       // palm trees from above
            d.circle(x, y, .3, C_WOOD2);
        }
        d.rect(2.3, 1.9, .7, .55, C_CORAL, true);                    // beach hut
    },
    continent(d, t, b)
    {
        for (const [x, y, s] of [[-1.8, .6, 1.4], [-.6, 1.4, 1.1], [-2.8, -.4, 1]])
        {
            d.poly([[x - s*.8, y - s*.5], [x + s*.8, y - s*.5], [x, y + s*.7]], C_WOOD2, true);    // mountains
            d.poly([[x - s*.3, y + s*.29], [x + s*.3, y + s*.29], [x, y + s*.7]], C_CREAM);        // snowcaps
        }
        for (const [x, y, r] of [[2.4, 1.6, 1.4], [3.6, .4, 1], [-3.4, 1.6, .9], [1.4, -1.9, 1.1]])
            d.circle(x, y, r, C_TEAL, true);                         // forests
        d.circle(.9, .1, 1.2, C_WATER, true);                        // big lake
        for (let i = 0; i < 4; i++)
            d.rect(-1 + (i%2)*.42, -1.6 + Math.floor(i/2)*.42, .34, .34, C_CREAM, true);    // a city
    },
};
