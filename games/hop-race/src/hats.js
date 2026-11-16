/*
    HOP RACE - hat art (GDD §7). Each hat is a few flat shapes drawn in code, in two tones: a main color and an
    accent (in a level: ink with white; on a store tile: the tile's text color with ink).
    Hat space: the origin is the middle of the player's top edge, 1 unit is the player's width, y is up and
    +x is the way the player faces (below 0 is over and around the body: the helmet, the pilot's flap, the moustache). A hat is a list of [points, accent, front] polygons, points as [x, y]; front ones are drawn over the eye (the
    football helmet's bar, the racing helmet's visor).
*/

'use strict';

// an ellipse, or an arc of one closed by its chord (a0 = 0, a1 = PI is a dome)
function hrHatArc(cx, cy, rx, ry, a0 = 0, a1 = 2 * Math.PI, n = 18)
{
    const pts = [];
    for (let i = 0; i <= n; i++)
    {
        const a = a0 + (a1 - a0) * i / n;
        pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return pts;
}

const hrHatBox = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

// a straight bar from (x0, y0) to (x1, y1), w thick
function hrHatBar(x0, y0, x1, y1, w = .05)
{
    const l = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / l * w / 2, ny = (x1 - x0) / l * w / 2;
    return [[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]];
}

// points turned by a radians (counterclockwise) around (cx, cy)
function hrHatTurn(pts, cx, cy, a)
{
    const c = Math.cos(a), n = Math.sin(a);
    return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * n, cy + (x - cx) * n + (y - cy) * c]);
}

// a hat's brim: a strip that lies flat on the head out to flat on each side, then curls up toward both ends and
// thins out there
function hrHatBrim(w, lift, thick, flat = 0, n = 20)
{
    const a = [], b = [];
    for (let i = 0; i <= n; i++)
    {
        const k = i / n * 2 - 1, c = Math.max(0, (Math.abs(k) * w - flat) / (w - flat)), y = lift * c * c;
        a.push([k * w, y]);
        b.unshift([k * w, y + thick * (1 - k * k * k * k) + .015]);
    }
    return a.concat(b);
}

// a five-point star
function hrHatStar(cx, cy, r)
{
    const pts = [];
    for (let i = 0; i < 10; i++)
        pts.push([cx + Math.sin(i * Math.PI / 5) * (i % 2 ? r * .45 : r), cy + Math.cos(i * Math.PI / 5) * (i % 2 ? r * .45 : r)]);
    return pts;
}

// a curved lobe that tapers to a point: from (x0, y0), bent toward (x1, y1), to its tip (x2, y2); w is the half
// width at the start
function hrHatTaper(x0, y0, x1, y1, x2, y2, w, n = 10)
{
    const a = [], b = [];
    for (let i = 0; i <= n; i++)
    {
        const t = i / n, k = 1 - t;
        const x = k * k * x0 + 2 * k * t * x1 + t * t * x2, y = k * k * y0 + 2 * k * t * y1 + t * t * y2;
        const dx = 2 * k * (x1 - x0) + 2 * t * (x2 - x1), dy = 2 * k * (y1 - y0) + 2 * t * (y2 - y1), l = Math.hypot(dx, dy) || 1;
        a.push([x - dy / l * w * k, y + dx / l * w * k]);
        b.unshift([x + dy / l * w * k, y - dx / l * w * k]);
    }
    return a.concat(b);
}

// a horn: a curve from the helmet's side out and up to a point; side is 1 (front) or -1 (back)
function hrHatHorn(side)
{
    const a = [], b = [], n = 10;
    for (let i = 0; i <= n; i++)
    {
        const t = i / n, s = 1 - t;
        // quadratic curve (.33, .12) -> (.7, .1) -> (.6, .56), and its direction
        const x = s * s * .33 + 2 * s * t * .7 + t * t * .6, y = s * s * .12 + 2 * s * t * .1 + t * t * .56;
        const dx = 2 * s * (.7 - .33) + 2 * t * (.6 - .7), dy = 2 * s * (.1 - .12) + 2 * t * (.56 - .1);
        const l = Math.hypot(dx, dy), w = .085 * s;
        a.push([side * (x - dy / l * w), y + dx / l * w]);
        b.unshift([side * (x + dy / l * w), y - dx / l * w]);
    }
    return a.concat(b);
}

// a flat band inside a triangle of half width w0 at the base and height h, from height y0 to y1
function hrHatStripe(w0, h, y0, y1, inset = .035)
{
    const w = y => w0 * (1 - y / h) - inset;
    return [[-w(y0), y0], [w(y0), y0], [w(y1), y1], [-w(y1), y1]];
}

// t is seconds, for the hats that move (halo)
const HR_HATS =
{
    // baseball cap: a dome, a brim out the front, a button on top
    cap: () => [
        [hrHatArc(-.04, 0, .43, .36, 0, Math.PI)],
        [hrHatBox(.2, 0, .74, .085)],
        [hrHatArc(-.04, .36, .06, .05)],
        [hrHatArc(-.04, 0, .3, .25, .25, 1.15, 8).concat(hrHatArc(-.04, 0, .36, .3, 1.15, .25, 8)), 1],   // a shine
    ],
    // beanie: a tall dome, a ribbed cuff, a pompom
    beanie: () => [
        [hrHatArc(0, .1, .45, .38, 0, Math.PI)],
        [hrHatBox(-.5, 0, .5, .17)],
        ...[-.3, -.1, .1, .3].map(x => [hrHatBox(x - .025, .035, x + .025, .135), 1]),
        [hrHatArc(0, .55, .11, .11)],
    ],
    // party hat: a striped cone with a pompom
    party: () => [
        [[[-.3, 0], [.3, 0], [0, .66]]],
        [hrHatStripe(.3, .66, .1, .2), 1],
        [hrHatStripe(.3, .66, .32, .42), 1],
        [hrHatArc(0, .68, .085, .085)],
    ],
    // american football helmet: a shell over the top, the back and the jaw, open at the face (the eye shows through),
    // with a stripe, an ear hole and a face mask of bars out in front; its middle bar runs back to the shell across
    // the lower half of the eye
    football: () => [
        [hrHatArc(-.02, 0, .58, .46, 0, Math.PI).concat([[-.6, -.55], [-.54, -.76], [-.4, -.86], [.3, -.86], [.42, -.79],
            [.4, -.73], [-.08, -.73], [-.2, -.62], [-.25, -.3], [-.22, 0]])],
        [hrHatArc(-.02, 0, .5, .39, .55, 2.6, 12).concat(hrHatArc(-.02, 0, .43, .32, 2.6, .55, 12)), 1],
        [hrHatArc(-.41, -.4, .06, .06, 0, 2 * Math.PI, 10), 1],
        [hrHatBar(.5, -.03, .8, -.12, .06)],
        [hrHatBar(.79, -.1, .75, -.78, .06)],
        [hrHatBar(-.23, -.53, .77, -.5, .07), 0, 1],
        [hrHatBar(.38, -.79, .76, -.76, .06)],
    ],
    // chef's hat: a pleated band under a puffy top
    chef: () => [
        [hrHatBox(-.3, 0, .3, .3)],
        [hrHatArc(-.25, .43, .2, .19)],
        [hrHatArc(0, .5, .25, .22)],
        [hrHatArc(.25, .43, .2, .19)],
        ...[-.15, 0, .15].map(x => [hrHatBox(x - .02, .04, x + .02, .2), 1]),
    ],
    // cowboy hat: a wide brim that sits flat on the head and curls up past its sides, a pinched crown, a band
    cowboy: () => [
        [hrHatBrim(.92, .2, .09, .5)],
        [[[-.4, .05], [-.34, .5], [-.15, .6], [0, .51], [.15, .6], [.34, .5], [.4, .05]]],
        [hrHatBox(-.385, .12, .385, .2), 1],
    ],
    // bunny ears on a headband, the back one tilted further
    bunny: () => [
        [hrHatBox(-.4, 0, .4, .06)],
        [hrHatTurn(hrHatArc(-.2, .36, .12, .36), -.2, 0, .3)],
        [hrHatTurn(hrHatArc(-.2, .36, .055, .24), -.2, 0, .3), 1],
        [hrHatTurn(hrHatArc(.16, .36, .12, .36), .16, 0, .06)],
        [hrHatTurn(hrHatArc(.16, .36, .055, .24), .16, 0, .06), 1],
    ],
    // wizard hat: a round brim, a cone with its tip bent back, a star
    wizard: () => [
        [hrHatArc(0, .045, .58, .055)],
        [[[-.36, .05], [-.16, .48], [-.3, .78], [.02, .58], [.36, .05]]],
        [hrHatStar(.02, .26, .1), 1],
    ],
    // WW1 pilot's cap: a snug leather dome with a flap down the back and a loose strap, big two-lens goggles pushed up on the forehead
    pilot: () => [
        [hrHatArc(-.02, 0, .54, .4, 0, Math.PI).concat([[-.56, -.5], [-.46, -.62], [-.32, -.62], [-.25, -.45], [-.25, 0]])],
        [hrHatBar(-.4, -.6, -.36, -.84, .07)],
        [hrHatBar(-.5, .13, -.1, .2, .06), 1],
        ...[-.03, .37].map(x => [hrHatArc(x, .22, .215, .215)]),
        ...[-.03, .37].map(x => [hrHatArc(x, .22, .145, .145, 0, 2 * Math.PI, 16), 1]),
    ],
    // Dali-like moustache: under the eye, two long thin tips that sweep out and curl straight up, one in front of the
    // face and one up the cheek behind the eye
    mustache: () => [
        [hrHatTaper(.22, -.8, .95, -.95, .84, -.2, .075, 14)],
        [hrHatTaper(.3, -.8, -.43, -.95, -.32, -.2, .075, 14)],
        [hrHatArc(.26, -.8, .1, .075, 0, 2 * Math.PI, 12)],
    ],
    // jester's hat: three floppy points with a bell on each, diamonds on the band
    jester: () => [
        [hrHatTaper(-.2, .1, -.3, .62, -.68, .36, .21)],
        [hrHatTaper(.2, .1, .3, .62, .68, .36, .21)],
        [hrHatTaper(0, .1, -.02, .5, .12, .74, .21)],
        [hrHatBox(-.42, 0, .42, .15)],
        ...[[-.68, .34], [.68, .34], [.13, .75]].map(([x, y]) => [hrHatArc(x, y, .07, .07, 0, 2 * Math.PI, 12)]),
        ...[-.26, 0, .26].map(x => [[[x, .025], [x + .05, .075], [x, .125], [x - .05, .075]], 1]),
    ],
    // salakot (Filipino): a wide low dome with a rim, a decorated band and a knob on top
    salakot: () => [
        [hrHatArc(0, .03, .68, .34, 0, Math.PI)],
        [hrHatBox(-.72, 0, .72, .055)],
        [hrHatArc(0, .03, .57, .25, .3, Math.PI - .3, 14).concat(hrHatArc(0, .03, .5, .2, Math.PI - .3, .3, 14)), 1],
        [hrHatBox(-.03, .36, .03, .45)],
        [hrHatArc(0, .47, .055, .055, 0, 2 * Math.PI, 10)],
    ],
    // top hat: a brim, a tall crown, a band
    tophat: () => [
        [hrHatBox(-.48, 0, .48, .085)],
        [hrHatBox(-.3, .085, .3, .6)],
        [hrHatBox(-.3, .15, .3, .25), 1],
    ],
    // bowler hat: a round crown, a short brim that curls up at the ends, a band
    bowler: () => [
        [hrHatBrim(.56, .06, .075, .42)],
        [hrHatArc(0, .06, .36, .4, 0, Math.PI)],
        [hrHatBox(-.345, .09, .345, .17), 1],
    ],
    // French beret: a wide soft disc that flops over the back, a thin band, a little stalk on top
    beret: () => [
        [hrHatTurn(hrHatArc(-.1, .19, .56, .19, 0, 2 * Math.PI, 24), -.1, .19, .14)],
        [hrHatBox(-.32, 0, .34, .07)],
        [hrHatBar(-.07, .36, -.03, .47, .05)],
        [hrHatBox(-.3, .015, .32, .045), 1],
    ],
    // racecar driver's helmet: a full shell over the top, the back and the chin, a glass visor (a white block that
    // hides the eye) with a rim down the front, a stripe, a hinge and chin vents
    racer: () => [
        [hrHatArc(-.02, 0, .6, .46, 0, Math.PI).concat([[-.62, -.6], [-.56, -.82], [-.4, -.93], [.42, -.93], [.58, -.87],
            [.64, -.76], [.6, -.72], [-.1, -.72], [-.22, -.6], [-.25, -.3], [-.22, 0]])],
        [hrHatBar(.57, .02, .615, -.74, .045)],
        [[[-.22, 0], [.555, 0], [.598, -.72], [-.1, -.72], [-.22, -.6], [-.25, -.3]], 1, 1],
        [hrHatBox(-.53, .07, .5, .16), 1],
        [hrHatArc(-.4, -.2, .065, .065, 0, 2 * Math.PI, 10), 1],
        ...[.2, .32, .44].map(x => [hrHatBar(x, -.79, x - .03, -.87, .04), 1]),
    ],
    // ninja mask: a hood over the whole head with a slit for the eye, a forehead plate, the knot's two tails out the back
    ninja: () => [
        [hrHatArc(0, 0, .53, .13, 0, Math.PI).concat([[-.53, -1], [.53, -1], [.53, -.73], [-.2, -.73], [-.2, -.05], [.53, -.05]])],
        [hrHatTaper(-.5, -.1, -.82, -.02, -1.02, -.2, .07)],
        [hrHatTaper(-.5, -.18, -.78, -.3, -.9, -.6, .07)],
        [hrHatArc(-.55, -.14, .08, .08, 0, 2 * Math.PI, 10)],
        [hrHatBox(-.14, .025, .24, .085), 1],
    ],
    // spartan helmet: a dome with a neck and cheek guard and a nose guard around the eye, a tall crest from the brow
    // over the top and down the back
    spartan: () => [
        [hrHatArc(0, 0, .72, .74, .5, Math.PI, 16).concat([[-.8, -.34], [-.64, -.4], [-.58, 0]], hrHatArc(0, 0, .5, .36, Math.PI, .5, 16))],
        [hrHatArc(0, 0, .56, .4, 0, Math.PI).concat([[-.56, -.62], [-.46, -.9], [.12, -.9], [.34, -.77], [-.1, -.72], [-.24, -.58], [-.24, 0]])],
        [hrHatBox(.46, -.44, .56, 0)],
        [hrHatBox(-.5, .025, .5, .075), 1],
        ...[.8, 1.25, 1.7, 2.15, 2.6, 3.05].map(a => [hrHatBar(Math.cos(a) * .6, Math.sin(a) * .5, Math.cos(a) * .69, Math.sin(a) * .7, .025), 1]),
    ],
    // viking helmet: a dome with a riveted band and two horns
    viking: () => [
        [hrHatHorn(1)],
        [hrHatHorn(-1)],
        [hrHatArc(0, .04, .4, .32, 0, Math.PI)],
        [hrHatBox(-.43, 0, .43, .12)],
        ...[-.28, 0, .28].map(x => [hrHatArc(x, .06, .032, .032, 0, 2 * Math.PI, 10), 1]),
    ],
    // crown: three points with a ball on each, jewels on the band
    crown: () => [
        [[[-.38, 0], [.38, 0], [.38, .46], [.19, .24], [0, .5], [-.19, .24], [-.38, .46]]],
        ...[-.38, 0, .38].map(x => [hrHatArc(x, x ? .47 : .51, .055, .055, 0, 2 * Math.PI, 10)]),
        [[[0, .05], [.055, .11], [0, .17], [-.055, .11]], 1],
        ...[-.22, .22].map(x => [hrHatArc(x, .11, .04, .04, 0, 2 * Math.PI, 10), 1]),
    ],
    // halo: a ring that floats over the head and bobs
    halo: t =>
    {
        const y = .3 + Math.sin(t * 3) * .03;
        return [[hrHatArc(0, y, .4, .13, 0, 2 * Math.PI, 28).concat(hrHatArc(0, y, .3, .07, 2 * Math.PI, 0, 28))]];
    },
};

// draws a hat around pos; place(x, y) turns a hat-space point into an offset from pos (a vec2, y up; on screen too:
// screen-space polygons are y up). layer: 0 is only what goes under the eye, 1 only what goes over it, none is all
function hrDrawHat(id, pos, place, main, accent, t = 0, angle = 0, screenSpace = false, layer)
{
    const hat = HR_HATS[id];
    if (!hat) return;
    for (const [pts, isAccent, front] of hat(t))
        if (layer == undefined || layer == (front ? 1 : 0))
            drawPoly(pts.map(([x, y]) => place(x, y)), isAccent ? accent : main, 0, undefined, pos, angle, false, screenSpace);
}

// a hat on screen, for menus, centered on x with its lowest point at y; s is the pixels per hat unit, less for a
// hat taller than maxH pixels (the helmet)
function hrDrawHatIcon(id, x, y, s, maxH, main, accent)
{
    const hat = HR_HATS[id];
    if (!hat) return;
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const [pts] of hat(0))
        for (const [px, py] of pts) x0 = Math.min(x0, px), x1 = Math.max(x1, px), y0 = Math.min(y0, py), y1 = Math.max(y1, py);
    s = Math.min(s, maxH / (y1 - y0));
    hrDrawHat(id, vec2(x - (x0 + x1) / 2 * s, y + y0 * s), (hx, hy) => vec2(hx * s, hy * s), main, accent, timeReal, 0, true);
}

// the hat a player wears (the store's pick; P2 has none until there is a P2 pick)
function hrPlayerHat(p) { return hrSave.hats[p.index ? 'p2' : 'p1']; }
