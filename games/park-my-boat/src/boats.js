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

const BOATS =
{
    dinghy:    { name:'Dinghy',       L:2.2, W:1.15, mass:1,   power:6,   reverse:.6, turn:1.1, wash:1.6, dragF:1.2, dragS:3,   dragA:3,   hull:'pointy', color:C_CORAL, captainX:-.35 },
    speedboat: { name:'Zippy',        L:3.4, W:1.3,  mass:1.5, power:13,  reverse:.5, turn:.9,  wash:1.2, dragF:1,   dragS:1.4, dragA:3.2, hull:'pointy', color:C_CREAM, captainX:-.2 },
    swan:      { name:'Swan Pedalo',  L:2.4, W:1.6,  mass:1,   power:3.5, reverse:.7, turn:2.2, wash:3,   dragF:1.4, dragS:2,   dragA:1.1, hull:'swan',   color:C_CREAM, captainX:-.45 },
    pontoon:   { name:'Party Barge',  L:4.6, W:2.4,  mass:4,   power:12,  reverse:.6, turn:.55, wash:.9,  dragF:.8,  dragS:2.2, dragA:2.4, hull:'box',    color:C_SUNNY, captainX:-1.6 },
    sailboat:  { name:'Sailboat',     L:5,   W:1.6,  mass:3.5, power:7,   reverse:.5, turn:.7,  wash:.5,  dragF:.5,  dragS:6,   dragA:3,   hull:'pointy', color:C_CREAM, captainX:-1.8 },
    tug:       { name:'Tugboat',      L:3.2, W:1.9,  mass:5,   power:30,  reverse:.8, turn:.9,  wash:2,   dragF:1.5, dragS:3,   dragA:3,   hull:'tug',    color:C_CORAL, captainX:-.9 },
    bathtub:   { name:'Bathtub',      L:2.6, W:1.4,  mass:1.4, power:4,   reverse:.8, turn:1.2, wash:2,   dragF:1.3, dragS:1.3, dragA:1,   hull:'tub',    color:C_CREAM, captainX:-.1 },
    yacht:     { name:'Mega Yacht',   L:8,   W:2.6,  mass:10,  power:30,  reverse:.5, turn:.35, wash:.45, dragF:.6,  dragS:2.5, dragA:1.6, hull:'pointy', color:C_CREAM, captainX:.6 },
};

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
    if (kind == 'tug')  return hullRoundRect(l, w, w*.95, .4);
    if (kind == 'swan') return hullRoundRect(l, w, w*.95, w*.6);
    return hullRoundRect(l, w, w*.9, w*.9); // tub
}

// Collision circles along the keel
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
    t.hullPts = makeHull(t.hull, t.L, t.W);
    t.deckPts = t.hullPts.map(p=>vec2(p.x*.78, p.y*.68));
}

// Deck decorations, drawn with a local-space painter (see render.js)
const BOAT_DECO =
{
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
    tug(d, t)
    {
        for (const x of [-.9, 0, .9])
        {
            d.circle(x, .95, .38, C_INK);                          // tire bumpers
            d.circle(x, -.95, .38, C_INK);
        }
        d.rect(.15, 0, 1.2, 1.15, C_CREAM, true);                  // cabin
        d.rect(.45, 0, .3, .9, rgb(.4,.7,.8));                      // windows
        d.circle(-.55, 0, .55, C_NAVY, true);                       // smokestack
        d.circle(-.55, 0, .25, C_INK);
    },
    bathtub(d, t)
    {
        d.ellipse(0, 0, 2.1, 1.05, rgb(.75,.9,.95));               // bath water
        d.circle(.6, .25, .35, C_CREAM, true);                      // bubbles
        d.circle(.85, -.15, .28, C_CREAM, true);
        d.circle(-.6, .3, .25, C_CREAM, true);
        d.rect(-1.25, 0, .25, .45, rgb(.75,.78,.82), true);         // faucet
        d.circle(1.05, .35, .32, C_SUNNY, true);                    // rubber duck
        d.poly([[1.18,.4],[1.36,.35],[1.18,.28]], C_CORAL);
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
};
