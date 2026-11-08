'use strict';
// Spaceship Parking: the space look, in a 1960s space-age poster style (flat rounded shapes with a soft
// shaded edge, teal, mustard, brick and cream on near-black navy, glowing stars with four-point flares, film grain,
// Righteous type). Loaded last by index.html, after the game code in src/ (forked from Park My Boat's harbor game).
// It repaints that code: a poster painter replaces the Toybox one, so every deck drawing turns flat and shaded with
// no per-ship rewrite. Each ship's collision circles are rebuilt from its poster outline (see coverCircles).

// ---------------------------------------------------------------------------
// palette: a handful of poster inks; every Toybox color is mapped onto them

const P_SPACE  = rgb(.027, .035, .11);   // #07091C the sky: near-black navy, so space never reads as water
const P_VOID   = rgb(.008, .008, .035);  // #020209 shadows, darker than the sky
const P_INDIGO = rgb(.114, .106, .31);   // #1D1B4F
const P_DEEP   = rgb(.078, .071, .227);  // #14123A darks, bars
const P_TEAL   = rgb(.165, .616, .561);  // #2A9D8F
const P_MUSTARD= rgb(.914, .725, .286);  // #E9B949
const P_BRICK  = rgb(.784, .333, .239);  // #C8553D
const P_CREAM  = rgb(.953, .902, .8);    // #F3E6CC
const P_GLASS  = rgb(.561, .827, .812);  // #8FD3CF
const P_ORANGE = rgb(.878, .478, .227);  // #E07A3A
const P_LILAC  = rgb(.608, .557, .769);  // #9B8EC4
const P_SLATE  = rgb(.239, .353, .502);  // #3D5A80
const P_SAND   = rgb(.851, .78, .627);   // #D9C7A0
const P_DUSK   = rgb(.427, .416, .6);    // #6D6A99
const P_ROCK   = rgb(.549, .29, .235);   // #8C4A3C asteroid rock
const P_ROCK2  = rgb(.651, .353, .275);  // #A65A46 its lit top
const P_ROCKDK = rgb(.369, .184, .165);  // #5E2F2A its shadow side
// the ground of each planet type (gravity.planet in the level, PLANETS in levels.js): [rock, lit top, shadow side]
const ROCK_INKS =
{
    rocky: [P_ROCK, P_ROCK2, P_ROCKDK],
    moon:  [rgb(.49, .478, .455), rgb(.6, .584, .553), rgb(.29, .282, .275)],        // #7D7A74 grey
    heavy: [rgb(.6, .463, .204), rgb(.702, .553, .259), rgb(.369, .282, .125)],      // #997634 ochre
};
const rockInks = () => ROCK_INKS[level?.gravity?.planet] || ROCK_INKS.rocky;

function setColor(c, d, a=c.a) { c.r = d.r; c.g = d.g; c.b = d.b; c.a = a; }
setColor(C_WATER, P_SPACE);
setColor(C_WATER2, P_GLASS);             // sparks, bonus cards
setColor(C_SAND, P_ROCK);                // asteroid hull, ore
setColor(C_GRASS, P_ROCK2);
setColor(C_SHADOW, P_VOID, .6);          // hard poster shadows

const C_SILVER = rgb(.80, .82, .90);
const C_GLASS  = rgb(.45, .80, .96);
const C_GLOW   = rgb(.45, 1, .92);
const C_STEALTH= rgb(.42, .40, .60);
const C_SLATE  = rgb(.38, .39, .55);
const C_PANEL  = rgb(.24, .42, .78);
const C_FLAME  = rgb(1, .55, .2);
const C_MOON   = rgb(.72, .72, .76);
const C_LILAC  = rgb(.70, .62, .92);

MOORED_COLORS[2] = C_LILAC;
setCanvasClearColor(C_WATER);            // gameInit may already have copied the harbor color

const PALETTE = [P_INDIGO, P_DEEP, P_TEAL, P_MUSTARD, P_BRICK, P_CREAM, P_GLASS, P_ORANGE, P_LILAC, P_SLATE, P_SAND, P_DUSK, P_ROCK, P_ROCK2, P_ROCKDK];
const colorKey = c => Math.round(c.r*255)*65536 + Math.round(c.g*255)*256 + Math.round(c.b*255);
const posterCache = new Map(PALETTE.map(p => [colorKey(p), p]));
// any color -> its poster ink (palette inks map to themselves); alpha is kept
function poster(c)
{
    if (!c) return C_CLEAR;
    if (c.raw) return c;
    const key = colorKey(c);
    let p = posterCache.get(key);
    if (!p)
    {
        const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b), ch = max - min;
        if (ch < .16) p = max > .85 ? P_CREAM : max > .6 ? P_SAND : max > .4 ? P_DUSK : P_DEEP;
        else
        {
            let h = max == c.r ? ((c.g - c.b)/ch + 6) % 6 : max == c.g ? (c.b - c.r)/ch + 2 : (c.r - c.g)/ch + 4;
            h /= 6;
            p = h < .04 || h >= .9 ? P_BRICK : h < .1 ? P_ORANGE : h < .18 ? P_MUSTARD : h < .53 ? (max > .9 ? P_GLASS : P_TEAL)
              : h < .68 ? (max > .85 ? P_GLASS : P_SLATE) : P_LILAC;
        }
        posterCache.set(key, p);
    }
    return c.a < 1 ? p.scale(1, c.a) : p;
}
function raw(c) { c.raw = true; return c; }
// text keeps the poster inks too: ink -> deep indigo, cream -> cream, coral -> brick...
const textColor = poster;

// A flat poster shape: points relative to o. Shaded shapes get a darker crescent on the lower right, as if lit
// from the upper left (d is how far the light side is pushed).
function posterShape(o, pts, color, d)
{
    drawCanvas2D(o, vec2(1), 0, false, ctx =>
    {
        const trace = (dx, dy) => { ctx.beginPath(); for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i].x + dx, pts[i].y + dy) : ctx.moveTo(pts[i].x + dx, pts[i].y + dy); ctx.closePath(); };
        trace(0, 0);
        ctx.fillStyle = color.toString();
        ctx.fill();
        if (!d) return;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
        ctx.save();
        ctx.clip();
        ctx.fillStyle = `rgba(10,8,40,${.32*color.a})`;
        ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
        trace(-d, d);
        ctx.fillStyle = color.toString();
        ctx.fill();
        ctx.restore();
    });
}
// round-capped strokes, one path for many segments
function posterSegs(o, segs, color, w, dash)
{
    drawCanvas2D(o, vec2(1), 0, false, ctx =>
    {
        ctx.beginPath();
        for (const [a, b] of segs) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (dash) ctx.setLineDash(dash);
        ctx.strokeStyle = color.toString();
        ctx.lineWidth = w;
        ctx.stroke();
    });
}
const UNIT_RING = Array.from({ length: 24 }, (_, i) => [Math.cos(i/24*PI*2), Math.sin(i/24*PI*2)]);
function ringPts(r, ry=r) { return UNIT_RING.map(([u, v]) => vec2(u*r, v*ry)); }

// The poster painter: same calls as the Toybox one (render.js), so every deck drawing works unchanged.
// Outlined shapes become flat shaded shapes, filled ones flat color, lines round-capped strokes.
painter = function(b, ox=0, oy=0)
{
    const k = b.k || 1, c = Math.cos(b.angle), s = Math.sin(b.angle), sx = (b.sx || 1)*k, sy = (b.sy || 1)*k;
    const O = vec2(b.pos.x + ox, b.pos.y + oy);
    const L = (x, y) => vec2(x*sx*c - y*sy*s, x*sx*s + y*sy*c);
    const P = (x, y) => L(x, y).add(O);
    const fade = 1 - .72*(b.dive || 0);                     // a cloaked ship fades out
    const tint = col => { const p = poster(col); return fade < 1 ? p.scale(1, fade) : p; };
    const shape = (rel, size, color, outline) =>
    {
        if (!color || color.a <= 0) return;
        posterShape(O, rel, tint(color), outline ? Math.min(.1*WU, size*k*.1) : 0);
    };
    const ell = (x, y, w, h) => UNIT_RING.map(([u, v]) => L(x + u*w/2, y + v*h/2));
    return {
        P,
        circle(x, y, d, color, outline) { shape(ell(x, y, d, d), d, color, outline); },
        ellipse(x, y, w, h, color, outline) { shape(ell(x, y, w, h), Math.min(w, h), color, outline); },
        poly(pts, color, outline)
        {
            let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
            const rel = pts.map(p =>
            {
                const x = p.x === undefined ? p[0] : p.x, y = p.x === undefined ? p[1] : p.y;
                x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
                return L(x, y);
            });
            shape(rel, Math.min(x1 - x0, y1 - y0), color, outline);
        },
        rect(cx, cy, w, h, color, outline) { this.poly([[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]], color, outline); },
        line(x1, y1, x2, y2, w, color) { if (color) posterSegs(O, [[L(x1, y1), L(x2, y2)]], tint(color), w*k); },
        text(str, x, y, size, color) { drawText(str, P(x, y), size*k, tint(color), 0, C_INK, 'center'); },
        flame(pts, color) { posterShape(O, pts.map(p => L(p[0], p[1])), tint(color), 0); },
    };
};

// ---------------------------------------------------------------------------
// names, text, saves

const SHIP_NAMES =
{
    jetski:'Rocket Scooter', dinghy:'Escape Pod', swan:'Flying Saucer', speedboat:'Zoomer', minisub:'Stealth Pod',
    sailboat:'Solar Sailer', trawler:'Asteroid Miner', yacht:'Star Yacht', sub:'Stealth Cruiser', cruise:'Space Liner',
    container:'Classic Frigate', island:'Asteroid', continent:'The Moon',
};
const SHIP_COLORS =
{
    dinghy:C_ORANGE, speedboat:C_CORAL, swan:C_SILVER, minisub:C_STEALTH, sub:C_SLATE, cruise:C_SILVER, continent:C_MOON,
};
for (const k in SHIP_NAMES) if (BOATS[k]) BOATS[k].name = SHIP_NAMES[k];
for (const k in SHIP_COLORS) if (BOATS[k]) BOATS[k].color = SHIP_COLORS[k];
if (BOATS.continent) BOATS.continent.deck = rgb(.83, .83, .86);

// every on-screen string goes through txt (buttons, HUD, popups, results), so the wording changes in one place
const TEXT_SWAPS =
[
    [/LAND HO!/g, 'PREP THE AIRLOCK!'], [/\bDIVE\b/g, 'CLOAK'], [/\bSURFACE\b/g, 'UNCLOAK'],
    [/\bBOATS\b/g, 'SHIPS'], [/\bBOAT\b/g, 'SHIP'], [/\bboats\b/g, 'ships'], [/\bboat\b/g, 'ship'],
    [/ · /g, ' - '],
];
const textCache = new Map();
function spaceText(s)
{
    s = String(s);
    let out = textCache.get(s);
    if (out === undefined)
    {
        out = TEXT_SWAPS.reduce((t, [re, to]) => t.replace(re, to), s);
        if (textCache.size > 500) textCache.clear();
        textCache.set(s, out);
    }
    return out;
}
const harborTxt = txt;
txt = function(str, x, y, size, color=C_INK, align='center', outline=0, outlineColor=C_INK)
{
    return harborTxt(spaceText(str), x, y, size, textColor(color), align, outline, outlineColor);
};

// sounds: horn -> synth chime, bonk -> metal clang, quack -> tiny "whoa!"
SOUNDS.horn  = new Sound([.7,0,660,.01,.2,.6,0,1,0,0,330,.1,0,0,0,0,.15,.6]);
SOUNDS.bonk  = new Sound([1,.05,260,0,.01,.3,0,1,0,0,0,0,0,0,63,0,0,.5,.08]);
SOUNDS.quack = new Sound([1,.1,500,.02,.08,.14,0,1,12,-1,0,0,0,0,0,0,0,.8]);

// ---------------------------------------------------------------------------
// the sky: soft glowing cream and mustard stars with the odd four-point flare, in octaves 10x apart (like the
// harbor's ripples) so the zoom always shows, then film grain over the whole screen

const STARS = [];
{
    let seed = 7;
    const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) STARS.push({ x:rnd()*40, y:rnd()*22, d:.5 + rnd()*rnd()*.9, ph:rnd()*9, gold:rnd() < .2, flare:rnd() < .06 });
}

// star sprites, drawn once: a glow dot (solid core, soft halo) and a flare (glow dot with long thin rays, up and across)
function starSprite(col, flare)
{
    const n = flare ? 128 : 64, m = n/2, c = document.createElement('canvas'), g = c.getContext('2d');
    c.width = c.height = n;
    const rgba = a => `rgba(${col.r*255|0},${col.g*255|0},${col.b*255|0},${a})`;
    const glow = (r, a) =>
    {
        const gr = g.createRadialGradient(m, m, 0, m, m, r);
        gr.addColorStop(0, rgba(a));
        gr.addColorStop(1, rgba(0));
        g.fillStyle = gr;
        g.fillRect(0, 0, n, n);
    };
    if (flare)
    {
        for (const [dx, dy] of [[1, 0], [0, 1]])
        {
            const gr = g.createLinearGradient(m - dx*m, m - dy*m, m + dx*m, m + dy*m), w = n*.016;
            gr.addColorStop(0, rgba(0));
            gr.addColorStop(.5, rgba(1));
            gr.addColorStop(1, rgba(0));
            g.fillStyle = gr;
            g.beginPath();
            g.moveTo(m - dx*m, m - dy*m); g.lineTo(m + dy*w, m + dx*w); g.lineTo(m + dx*m, m + dy*m); g.lineTo(m - dy*w, m - dx*w);
            g.fill();
        }
        glow(m*.3, .5);
        glow(m*.1, 1);
    }
    else
    {
        glow(m, .3);
        glow(m*.5, .7);
        glow(m*.25, 1);
    }
    g.fillStyle = 'rgba(255,252,236,1)';
    g.beginPath();
    g.arc(m, m, flare ? n*.035 : n*.12, 0, PI*2);
    g.fill();
    return c;
}
const STAR_DOT = starSprite(P_CREAM), STAR_GOLD = starSprite(P_MUSTARD), STAR_FLARE = starSprite(P_CREAM, true);
const FLARE_SIZE = 2.4;   // a flare's ray span, in star-layer units (a dot is .5-1.4)

// film grain: a small speckle tile, filled over the screen as a pattern (one call, no per-frame gradients)
let grainPattern;
function drawGrain(alpha)
{
    if (!grainPattern)
    {
        const c = document.createElement('canvas');
        c.width = c.height = 160;
        const g = c.getContext('2d');
        for (let i = 0; i < 1500; i++)
        {
            g.fillStyle = i % 2 ? 'rgba(255,240,210,.09)' : 'rgba(0,0,20,.14)';
            g.fillRect(Math.random()*160, Math.random()*160, 1 + (i % 3 == 0), 1);
        }
        grainPattern = mainContext.createPattern(c, 'repeat');
    }
    mainContext.save();
    mainContext.setTransform(1, 0, 0, 1, 0, 0);
    mainContext.globalAlpha = alpha;
    mainContext.fillStyle = grainPattern;
    mainContext.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
    mainContext.restore();
}

// parallax: how fast a star scrolls, as a share of the world's speed. The smallest stars are the farthest and
// scroll at 15%, the biggest at 100% (with the ships); flares sit in the middle
function starDepth(p) { return p.flare ? .6 : .15 + .85*clamp((p.d - .5)/.9, 0, 1); }

drawWater = function()
{
    if (level?.interior) return drawDeck();
    const v = VIEW_RECT, o = vec2(v.x0, v.y0);
    // one canvas call for the whole sky; inside it, 1 unit = 1 meter measured from the view's corner
    drawCanvas2D(o, vec2(1), 0, false, ctx =>
    {
        for (let s = .01; s < 1e7; s *= 10)
        {
            const g = .7*s / WU;
            if (g < .3 || g > 3) continue;
            const fade = clamp((g - .3)/.4, 0, 1) * clamp((3 - g)/1.5, 0, 1);
            // spacing follows the zoom, but size only half as much, so stars never shrink to specks
            const tw = 40*s, th = 22*s, ds = s*Math.sqrt(.7/g);
            for (const p of STARS)
            {
            // parallax: each star's tiling is shifted along with the camera, so it scrolls at starDepth(p) of the world's speed
            const sx = cam.pos.x*(1 - starDepth(p)), sy = cam.pos.y*(1 - starDepth(p));
            for (let tx = Math.floor((v.x0 - sx)/tw); tx*tw + sx < v.x1; tx++)
            for (let ty = Math.floor((v.y0 - sy)/th); ty*th + sy < v.y1; ty++)
            {
                const x = tx*tw + p.x*s + sx, y = ty*th + p.y*s + sy, d = (p.flare ? FLARE_SIZE : p.d)*ds;
                if (x < v.x0 - d || x > v.x1 + d || y < v.y0 - d || y > v.y1 + d) continue;
                ctx.globalAlpha = fade*(p.flare ? .6 + .4*Math.sin(time*1.1 + p.ph) : .7 + .3*Math.sin(time*1.5 + p.ph));
                ctx.drawImage(p.flare ? STAR_FLARE : p.gold ? STAR_GOLD : STAR_DOT, x - o.x - d/2, y - o.y - d/2, d, d);
            }
            }
        }
    });
    drawGrain(1);
};

// currents: solar-wind streams, soft mustard bands with cream streaks drifting along
drawCurrents = function()
{
    for (const c of currents)
    {
        const w = c.x1 - c.x0, h = c.y1 - c.y0, flow = vec2(c.dx, c.dy), spd = flow.length();
        drawRect(vec2(c.x0 + w/2, c.y0 + h/2), vec2(w, h), P_MUSTARD.scale(1, .09));
        if (spd < 1e-6) continue;
        const dir = flow.scale(1/spd), across = Math.abs(dir.x) >= Math.abs(dir.y);
        const len = across ? w : h, span = across ? h : w, sgn = across ? Math.sign(dir.x) : Math.sign(dir.y);
        const segs = [];
        for (let v = 1; v < span; v += 1.6)
        for (let k = 0; k < len/4; k++)
        {
            const u = ((k*4 + (v*7.3 % 4) + time*spd*sgn) % len + len) % len, tail = Math.min(1.4, u);
            const at = q => across ? vec2(q, v) : vec2(v, q);
            segs.push([at(sgn > 0 ? u - tail : len - u + tail), at(sgn > 0 ? u : len - u)]);
        }
        if (segs.length) posterSegs(vec2(c.x0, c.y0), segs, P_CREAM.scale(1, .4), .14);
    }
};

// wakes: round exhaust puffs, warm then smoky
drawWakes = function()
{
    for (const w of wakes)
    {
        const k = w.t / 1.2, col = k < .3 ? P_MUSTARD.lerp(P_ORANGE, k/.3) : P_SAND.lerp(P_DUSK, Math.min(1, (k - .3)/.6));
        drawCircle(w.pos, w.size*(.5 + k*1.4), col.scale(1, .55*(1 - k)));
    }
};

// the hull-side trails: faint cream contrails
drawFoam = function()
{
    for (const trail of foams)
    {
        if (trail.length < 2 || !trail.some(p => inView(p.pos, p.w*4))) continue;
        let prev;
        for (const p of trail)
        {
            const k = p.t / FOAM_LIFE, hw = p.w*(1 + k*1.5)/2;
            const e = { l:p.pos.add(p.n.scale(hw)), r:p.pos.subtract(p.n.scale(hw)), a:p.a*.3*(1 - k) };
            if (prev) drawPoly([prev.l, e.l, e.r, prev.r], P_CREAM.scale(1, (prev.a + e.a)/2));
            prev = e;
        }
    }
};

// a lighter grain over the finished world too, so ships look printed
const harborDrawDrops = drawDrops;
drawDrops = function() { harborDrawDrops(); drawDust(); drawGrain(.55); };

// ---------------------------------------------------------------------------
// ships

// thruster flames, in toy coordinates: [x, y, width] at the stern
const JETS =
{
    jetski:[[-1.14, 0, .26]], dinghy:[[-1.0, 0, .28]], swan:[[-1.15, 0, .3]], speedboat:[[-1.6, 0, .26]],
    minisub:[[-1.7, 0, .34], [-1.62, .72, .16], [-1.62, -.72, .16]], sailboat:[[-2.32, 0, .26]], trawler:[[-1.46, .1, .18], [-1.46, -.1, .18]],
    yacht:[[-3.82, 0, .48], [-4.06, 1.15, .18], [-4.06, -1.15, .18]], sub:[[-3.4, 0, .3]],
    cruise:[[-4.9, .28, .2], [-4.9, 0, .2], [-4.9, -.28, .2]], container:[[-5.05, .38, .34], [-5.05, 0, .34], [-5.05, -.38, .34]],
};

function shipThrottle(b)
{
    if (b.kind == 'title') return .8;
    if (b.throttle) return b.throttle;
    if (b.kind == 'traffic' && b.vs && b.speed() > .3*b.vs) return .7;
    return 0;
}

function drawJets(b, d)
{
    const jets = JETS[b.type.key], thr = shipThrottle(b);
    if (jets && thr > 0)
    {
        for (const [x, y, s] of jets)
        {
            const flick = 1.5 + .5*Math.sin(time*43 + b.id*3 + y*9), len = s*flick*(.5 + thr);
            // a rounded teardrop of flame: brick outside, mustard inside
            const drop = (w, l) => [[x + .05, y + w/2], [x - l*.45, y + w*.42], [x - l, y], [x - l*.45, y - w*.42], [x + .05, y - w/2]];
            d.flame(drop(s, len), P_BRICK);
            d.flame(drop(s*.55, len*.6), P_MUSTARD);
        }
    }
    // the retro thrusters on both sides of the nose fire forward and out: both while reversing (the main engine is off),
    // one while turning (retroFire)
    const r = b.type.retro;
    if (!r) return;
    for (const m of [1, -1])
    {
        const fire = retroFire(b, m);
        if (!fire) continue;
        const flick = 1.5 + .5*Math.sin(time*43 + b.id*3 + m), len = r.s*flick*(.6 + fire)*1.3;
        const dx = RETRO_DIR.x, dy = m*RETRO_DIR.y, x = r.x, y = m*r.y;
        // the same teardrop of flame as the main engine, pointing along (dx, dy)
        const drop = (w, l) => [[x - dx*.03 - dy*w/2, y - dy*.03 + dx*w/2], [x + dx*l*.45 - dy*w*.42, y + dy*l*.45 + dx*w*.42],
            [x + dx*l, y + dy*l], [x + dx*l*.45 + dy*w*.42, y + dy*l*.45 - dx*w*.42], [x - dx*.03 + dy*w/2, y - dy*.03 - dx*w/2]];
        d.flame(drop(r.s, len), P_BRICK);
        d.flame(drop(r.s*.55, len*.6), P_MUSTARD);
    }
}

// how hard the retro thruster on side m (1 port, -1 starboard) fires, 0-1: both fire while reversing; turning fires
// the one on the outside of the turn, which pushes the nose round (turning left fires the starboard one). Only the
// ship you drive turns this way (others keep the rudder they had when you left them).
const RETRO_TURN = .7, RETRO_TURN_MIN = .15;      // a turn's flame, as a share of a full reverse; smallest rudder that fires
function retroFire(b, m)
{
    const thr = shipThrottle(b), rud = b == player ? b.rudder || 0 : 0;
    const turn = Math.abs(rud) > RETRO_TURN_MIN && Math.sign(rud) == -m ? Math.abs(rud)*RETRO_TURN : 0;
    return Math.max(thr < 0 ? -thr : 0, turn);
}

// exhaust puffs, called every frame for the player (main.js, jam.js): from the stern while it runs forward, from each
// retro port while it fires (they drift away ahead of the ship), none while it backs up coasting
let puffTimer = 0;
function puffExhaust(b, dt)
{
    kickDust(b, dt);
    if ((puffTimer -= dt) > 0) return;
    const t = b.type, r = t.retro, f = b.forward(), vf = b.vel.x*f.x + b.vel.y*f.y;
    if (r)
        for (const m of [1, -1])
        {
            const fire = retroFire(b, m), out = r.s*1.6;
            if (!fire) continue;
            puffTimer = .07;
            wakes.push({ pos: b.toWorld((r.x + RETRO_DIR.x*out)*b.k, m*(r.y + RETRO_DIR.y*out)*b.k), t: 0, size: r.s*(.7 + .7*fire)*b.k });
        }
    if (b.throttle >= 0 && vf > .7*b.vs)
    {
        puffTimer = .07;
        wakes.push({ pos: b.toWorld(-t.L/2*b.k, 0), t: 0, size: t.W*.7*b.k });
    }
}

// ---------------------------------------------------------------------------
// dust: on a planet (gravity levels) a flame that reaches the ground or a pad kicks up dust where it hits. Each firing
// nozzle of the ship you drive (main engines and retro thrusters) is traced along its flame to the ground. The dust
// grows with how hard it fires, how close the nozzle is (none from DUST_REACH ship lengths out, the most at the nozzle)
// and how squarely the flame meets the ground (straight down the most, sideways none). It flies off along the ground
// away from the hit, more to the side the flame leans to, rises a little and fades. Colored like the planet's rock.
const DUST_REACH = 1.5;         // ship lengths: a flame raises dust up to this far from its nozzle
const DUST_RATE = 45;           // puffs a second from a nozzle firing full, straight down, right at the ground
const DUST_LIFE = 1.6;          // s
const DUST_DRAG = 1.8;          // per second: how fast a puff slows
const DUST_MAX = 320;
let dusts = [], dustFor = null;

// every firing nozzle: { o: world point, d: unit direction of the flame, w: flame width (m), p: how hard it fires 0-1 }
function nozzles(b)
{
    const out = [], t = b.type, k = b.k || 1, f = b.forward(), thr = shipThrottle(b);
    const turn = (x, y) => vec2(x*f.x - y*f.y, x*f.y + y*f.x);          // ship to world direction
    if (JETS[t.key] && thr > 0)
        for (const [x, y, w] of JETS[t.key]) out.push({ o: b.toWorld(x*k, y*k), d: turn(-1, 0), w: w*k, p: thr });
    if (t.retro)
        for (const m of [1, -1])
        {
            const fire = retroFire(b, m);
            if (fire) out.push({ o: b.toWorld(t.retro.x*k, m*t.retro.y*k), d: turn(RETRO_DIR.x, m*RETRO_DIR.y), w: t.retro.s*k, p: fire });
        }
    return out;
}

// where a flame from o along d first meets the top of the ground or a pad below it: { at, dist }
function flameHit(o, d)
{
    if (d.y > -.05) return null;
    let best = null;
    for (const r of rects)
    {
        if (!(r.land || r.pad) || r.y1 > o.y) continue;
        const dist = (o.y - r.y1) / -d.y, x = o.x + d.x*dist;
        if (x >= r.x0 && x <= r.x1 && (!best || dist < best.dist)) best = { at: vec2(x, r.y1), dist };
    }
    return best;
}

function kickDust(b, dt)
{
    if (dustFor != level) { dusts = []; dustFor = level; }
    for (const p of dusts)
    {
        p.t += dt;
        const slow = Math.exp(-DUST_DRAG*dt);
        p.vel.x *= slow; p.vel.y *= slow;
        p.pos.x += p.vel.x*dt; p.pos.y += p.vel.y*dt;
    }
    dusts = dusts.filter(p => p.t < p.life);
    if (!level?.gravity || !b?.type || b.held) return;
    const reach = DUST_REACH * b.type.L * (b.k || 1), vs = b.vs || 1;
    for (const n of nozzles(b))
    {
        const hit = flameHit(n.o, n.d);
        if (!hit || hit.dist > reach) continue;
        const power = n.p * (1 - hit.dist/reach) * -n.d.y;
        // a random count with the right average, so a weak flame still puffs now and then
        let count = DUST_RATE * power * dt;
        count = Math.floor(count) + (Math.random() < count % 1 ? 1 : 0);
        for (let i = 0; i < count; i++)
        {
            const side = Math.random() < (1 + n.d.x)/2 ? 1 : -1, sp = vs * (2 + 7*power) * rand(.35, 1);
            dusts.push({ pos: vec2(hit.at.x + side*rand(0, n.w), hit.at.y + rand(0, n.w*.3)), t: 0, life: DUST_LIFE*rand(.7, 1.2),
                vel: vec2(side*sp, vs*rand(.2, 1.4)*(.4 + power)), size: n.w*rand(.9, 1.7)*(.7 + power), shade: rand(0, 1) });
        }
    }
    if (dusts.length > DUST_MAX) dusts.splice(0, dusts.length - DUST_MAX);
}

function drawDust()
{
    if (!dusts.length) return;
    const ink = rockInks(), light = ink[1].lerp(P_CREAM, .35), dark = ink[0];
    for (const p of dusts)
    {
        const k = p.t / p.life, size = p.size*(.5 + k*1.8);
        if (!inView(p.pos, size)) continue;
        drawCircle(p.pos, size, dark.lerp(light, p.shade).scale(1, .5*(1 - k)*Math.min(1, p.t*8)));
    }
}

drawBoat = function(b)
{
    const t = b.type, len = screenLen(b);
    // too small to read: a dot in the ship's color
    if (len < .3)
    {
        drawCircle(b.pos, Math.max(len*.6, .16)*WU, poster(b.color));
        return;
    }
    const d = painter(b), hull = poster(b.color);
    if (len >= .8)
    {
        drawJets(b, d);
        SHIP_UNDER[t.key]?.(d, t, b, hull);                   // fins and boosters, under the body
    }
    d.poly(t.hullPts, hull, true);
    if (t.deckPts) d.poly(t.deckPts, raw(t.deck ? poster(t.deck) : hull.lerp(hull == P_CREAM ? P_SAND : P_CREAM, .22)));
    if (len < .8) return;
    (SHIP_DECO[t.key] || BOAT_DECO[t.key])(d, t, b);
    // cloaked: a dotted cream rim over the faded ship
    if (t.sub && b.dive > .02)
    {
        const rel = t.hullPts.map(p => d.P(p.x, p.y).subtract(b.pos));
        const segs = rel.map((p, i) => [p, rel[(i + 1) % rel.length]]), w = Math.min(.07*WU, .06*(b.k || 1));
        posterSegs(b.pos, segs, P_CREAM.scale(1, (.5 + .3*Math.sin(time*6 + b.id))*b.dive), w, [w*.1, w*2.2]);
    }
};

// a cloaked ship shows a pulsing beacon so you can still find it
drawPeriscope = function(b)
{
    if (b.dive < .5 || !inView(b.pos, b.radius*1.5)) return;
    const p = painter({ ...b, dive: 0 }).P(b.type.scope ?? 1.45, 0), k = b.k || 1;
    const pulse = (time*1.5 + b.id*.3) % 1, ring = ringPts((.25 + pulse*.8)*k);
    posterSegs(p, ring.map((q, i) => [q, ring[(i + 1) % ring.length]]), P_MUSTARD.scale(1, 1 - pulse), Math.min(.07*WU, .07*k));
    drawCircle(p, .34*k, P_MUSTARD);
};

// the saucer is round (its collision circles follow, see the hitboxes below)
if (BOATS.swan)
{
    const t = BOATS.swan;
    t.hullPts = Array.from({ length: 32 }, (_, i) => vec2(Math.cos(i/32*PI*2)*t.L/2, Math.sin(i/32*PI*2)*t.W/2));
    t.deckPts = t.hullPts.map(p => vec2(p.x*.74, p.y*.68));
}

// the classic frigate is a moon rocket: its outline follows the stages
const ROCKET_BODY = [[-4.6, .62], [1.75, .62], [2.25, .43], [3.5, .43], [3.5, -.43], [2.25, -.43], [1.75, -.62], [-4.6, -.62]];
if (BOATS.container)
{
    const t = BOATS.container;
    t.hullPts = [[-4.6, .62], [1.75, .62], [2.25, .43], [3.5, .43], [4.05, .28], [4.3, .28], [4.62, .07],
                 [4.62, -.07], [4.3, -.28], [4.05, -.28], [3.5, -.43], [2.25, -.43], [1.75, -.62], [-4.6, -.62]].map(([x, y]) => vec2(x, y));
    t.deckPts = t.hullPts;
}

// ---------------------------------------------------------------------------
// poster rockets: every other ship is a 1950s poster rocket seen from the side, lying on the sky (bow = nose):
// an ogive body in the ship's color, swept fins and boosters drawn under it, an engine bell, a nose cone and bands
// in a trim color, portholes. The body replaces the boat hull outline; the hitboxes below follow body, fins and boosters.

// A rocket body from tail x0 to nose x1, radius r: an ogive nose over the front `nose` share, a rounded taper over
// the back `tail` share down to tailR*r where the engine bell sits. dy shifts it sideways (boosters).
function rocketPts(x0, x1, r, nose=.4, tail=.15, tailR=.75, dy=0)
{
    const len = x1 - x0, xn = x1 - len*nose, xt = x0 + len*tail, top = [[x0, r*tailR]];
    for (let i = 1; i <= 4; i++) top.push([x0 + (xt - x0)*i/4, r*(tailR + (1 - tailR)*Math.sin(i/4*PI/2))]);
    for (let i = 0; i <= 10; i++) top.push([xn + (x1 - xn)*i/10, r*Math.cos(i/10*PI/2)**.75]);
    const pts = top.map(([x, y]) => vec2(x, dy + y));
    for (let i = top.length - 2; i >= 0; i--) pts.push(vec2(top[i][0], dy - top[i][1]));
    return pts;
}
// the part of a shape between xa and xb (nose cones, bands)
function clipX(pts, xa, xb)
{
    const clip = (poly, keep, edge) =>
    {
        const out = [];
        for (let i = 0; i < poly.length; i++)
        {
            const a = poly[i], b = poly[(i + 1) % poly.length], ina = keep(a), inb = keep(b);
            if (ina) out.push(a);
            if (ina != inb) out.push(vec2(edge, a.y + (b.y - a.y)*(edge - a.x)/(b.x - a.x)));
        }
        return out;
    };
    return clip(clip(pts, p => p.x >= xa, xa), p => p.x <= xb, xb);
}
// a port-side shape and its starboard mirror
const sides = pts => [pts.map(([x, y]) => vec2(x, y)), pts.map(([x, y]) => vec2(x, -y))];
// an engine bell: flares from r0 at x0 to r1 at x1
const bell = (x0, x1, r0, r1, dy=0) => [[x0, dy + r0], [x1, dy + r1], [x1, dy - r1], [x0, dy - r0]].map(([x, y]) => vec2(x, y));
// fins in brick (teal on a brick or orange ship), trim in cream (brick on a cream ship), so moored colors still work
const finOf = (hull, pref=P_BRICK) => hull == pref || (hull == P_ORANGE && pref == P_BRICK) ? (pref == P_TEAL ? P_BRICK : P_TEAL) : pref;
const trimOf = hull => hull == P_CREAM || hull == P_SAND ? P_BRICK : P_CREAM;
const shipHull = (t, b) => poster(b ? b.color : t.color);

// the shapes, built once (toy units, like BOAT_DECO)
const RK =
{
    jetski:     // Rocket Scooter: a little one-seat rocket with a bubble canopy and swoopy fins
    {
        body: rocketPts(-.98, 1.2, .3, .42, .15, .75),
        fins: sides([[-.22, .26], [-.7, .4], [-1.05, .55], [-1.2, .55], [-.95, .2]]),
        bell: bell(-.95, -1.14, .17, .24),
    },
    dinghy:     // Escape Pod: a fat egg rocket with a big porthole and stubby fins
    {
        body: rocketPts(-.85, 1.1, .45, .55, .35, .42),
        fins: sides([[-.2, .4], [-.66, .55], [-1.02, .58], [-.98, .4], [-.8, .2]]),
        bell: bell(-.83, -1.0, .15, .22),
    },
    speedboat:  // Zoomer: a rocket plane, needle nose and delta wings with wingtip pods
    {
        body: rocketPts(-1.45, 1.7, .21, .45, .08, .85),
        fins: sides([[.35, .15], [-1.1, .62], [-1.38, .62], [-1.22, .15]]),
        canards: sides([[1.0, .12], [.72, .32], [.6, .32], [.64, .12]]),
        bell: bell(-1.42, -1.6, .15, .19),
    },
    minisub:    // Stealth Pod: a rocket between two boosters on swept pylons
    {
        body: rocketPts(-1.5, 1.85, .4, .45, .14, .75),
        fins: sides([[.25, .3], [-.2, .72], [-1.05, .72], [-1.05, .3]]),
        boosters: [rocketPts(-1.5, .55, .17, .4, .1, .8, .72), rocketPts(-1.5, .55, .17, .4, .1, .8, -.72)],
        bell: bell(-1.47, -1.7, .26, .33),
        bells: [bell(-1.48, -1.62, .12, .15, .72), bell(-1.48, -1.62, .12, .15, -.72)],
    },
    sailboat:   // Solar Sailer: a slim rocket under a diamond mirror sail
    {
        body: rocketPts(-2.15, 2.5, .26, .3, .1, .8),
        fins: sides([[-1.35, .22], [-1.95, .5], [-2.42, .6], [-2.15, .2]]),
        bell: bell(-2.12, -2.32, .18, .23),
    },
    trawler:    // Asteroid Miner: a stubby work rocket with a drill nose, grabber arms and an ore bay
    {
        body: rocketPts(-1.3, 1.2, .42, .26, .3, .5),
        fins: sides([[-.35, .4], [-.85, .56], [-1.38, .62], [-1.5, .58], [-1.2, .24]]),
        bells: [bell(-1.28, -1.46, .09, .12, .1), bell(-1.28, -1.46, .09, .12, -.1)],
    },
    yacht:      // Star Yacht: a long cream rocket with big swept fins, a booster on each fin tip and a glass dome
    {
        body: rocketPts(-3.55, 4, .58, .38, .12, .78),
        fins: sides([[-.7, .5], [-1.9, .88], [-3.0, 1.15], [-3.7, 1.2], [-3.45, .85], [-3.2, .42]]),
        boosters: [rocketPts(-3.95, -1.85, .18, .38, .1, .8, 1.15), rocketPts(-3.95, -1.85, .18, .38, .1, .8, -1.15)],
        bell: bell(-3.52, -3.82, .4, .48),
        bells: [bell(-3.93, -4.06, .12, .16, 1.15), bell(-3.93, -4.06, .12, .16, -1.15)],
    },
    sub:        // Stealth Cruiser: a long dark needle rocket with canards
    {
        body: rocketPts(-3.2, 3.5, .4, .35, .1, .8),
        fins: sides([[-1.75, .36], [-2.9, .82], [-3.45, .86], [-3.15, .3]]),
        canards: sides([[1.45, .3], [1.0, .6], [.82, .6], [.9, .3]]),
        bell: bell(-3.17, -3.4, .26, .31),
    },
    cruise:     // Space Liner: a long porthole rocket with three engines
    {
        body: rocketPts(-4.7, 5, .6, .28, .08, .8),
        fins: sides([[-2.7, .55], [-3.9, .92], [-4.95, 1.0], [-4.62, .45]]),
        bells: [.28, 0, -.28].map(y => bell(-4.66, -4.9, .1, .13, y)),
    },
};
// nose: where the trim-colored nose cone starts; bands: [from, to] stripes round the body
const RK_TRIM =
{
    jetski:    { nose: .62,  bands: [[-.62, -.5]] },
    dinghy:    { nose: .82,  bands: [[-.5, -.38]] },
    speedboat: { nose: 1.3,  bands: [] },
    minisub:   { nose: 1.5,  bands: [[-.78, -.64]] },
    sailboat:  { nose: 1.95, bands: [] },
    trawler:   { nose: 9,    bands: [[-.95, -.82]] },
    yacht:     { nose: 3.35, bands: [[-1.55, -1.35]] },
    sub:       { nose: 2.95, bands: [] },
    cruise:    { nose: 4.4,  bands: [[-3.78, -3.58], [3.12, 3.28]] },
};
for (const key in RK)
{
    const r = RK[key], trim = RK_TRIM[key];
    r.nose = clipX(r.body, trim.nose, 99);
    r.bands = trim.bands.map(([a, b]) => clipX(r.body, a, b));
    if (r.boosters) r.boosterNoses = r.boosters.map(p => clipX(p, p[5].x + .25*(p[15].x - p[5].x), 99));
    if (!BOATS[key]) continue;
    BOATS[key].hullPts = r.body;                                     // the outline drawn (and shadowed, and outlined when picked)
    BOATS[key].deckPts = null;
}
// ---------------------------------------------------------------------------
// hitboxes: every ship collides where it is drawn. The boat code gives each type a row of circles along the keel of
// its old boat hull; here they are rebuilt from the ship's poster outline: body, fins, boosters, wings, sail, drill.
// Thin details (canards, engine bells, flames) stay decoration. Slips grow to fit the new outline (hitL, hitW: see makeSlip).

const SAIL_PTS = [[1.45, 0], [.15, .78], [-1.15, 0], [.15, -.78]];                              // Solar Sailer's mirror
const DRILL_PTS = [[1.68, 0], [1.08, .3], [1.08, -.3]];                                        // Asteroid Miner's drill
const FRIGATE_FINS = sides([[-3.8, .6], [-4.45, 1.05], [-4.95, 1.05], [-4.6, .6]]);               // Classic Frigate's fins
const FRIGATE_BELLS = [.38, 0, -.38].map(y => [[-4.55, y + .11], [-5.05, y + .2], [-5.05, y - .2], [-4.55, y - .11]]);
const toVecs = pts => pts.map(p => p.x === undefined ? vec2(p[0], p[1]) : p);

// the outline each ship collides with: a list of polygons in toy units (x = bow, y = port)
function shipHitShapes(key)
{
    const t = BOATS[key], r = RK[key];
    if (key == 'swan') return [t.hullPts];
    if (key == 'container') return [t.hullPts, ...FRIGATE_FINS];
    if (!r) return null;
    const shapes = [r.body, ...r.fins, ...(r.boosters || [])];
    if (key == 'sailboat') shapes.push(toVecs(SAIL_PTS));
    if (key == 'trawler') shapes.push(toVecs(DRILL_PTS), ...[1, -1].map(s => ringPts(.12).map(p => p.add(vec2(1.08, s*.56)))));
    return shapes;
}

// distance from (x, y) to the outline of a polygon
function edgeDist(pts, x, y)
{
    let best = Infinity;
    for (let i = 0; i < pts.length; i++)
    {
        const a = pts[i], b = pts[(i + 1) % pts.length], dx = b.x - a.x, dy = b.y - a.y;
        const u = clamp(((x - a.x)*dx + (y - a.y)*dy) / (dx*dx + dy*dy || 1), 0, 1);
        best = Math.min(best, Math.hypot(a.x + u*dx - x, a.y + u*dy - y));
    }
    return best;
}

// Circles covering a ship's outline, mirrored across the keel. The body (shapes[0]) gets a row along the keel, each circle
// as big as fits (a bit over), shrinking toward the tips so the nose and tail collide where they are drawn. Then each other
// shape (fins, boosters, sail...) is sampled on a grid, and circles that fit inside it are added greedily, each the one
// covering the most samples nothing covers yet, until all but `left` of its samples are covered (at most `max` per shape).
function coverCircles(shapes, max = 3, left = .12)
{
    const [body, ...parts] = shapes;
    let x0 = Infinity, x1 = -Infinity, ym = 0;
    for (const q of body) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); ym = Math.max(ym, Math.abs(q.y)); }
    // never smaller than rMin, so a needle nose doesn't take a dozen tiny circles (it sticks out a hair instead)
    const over = .06*ym, rMin = .4*ym, r = x => Math.max(rMin, (inPoly(body, x, 0) ? edgeDist(body, x, 0) : 0) + over);
    // the circle whose edge just reaches the tip: x + r(x) grows toward the nose, x - r(x) shrinks toward the tail
    const reach = (f, lo, hi) => { for (let i = 0; i < 40; i++) { const m = (lo + hi)/2; f(m) ? lo = m : hi = m; } return lo; };
    const mid = (x0 + x1)/2, nose = reach(x => x + r(x) < x1, mid, x1), tail = reach(x => x - r(x) > x0, mid, x0);
    const circles = [];
    for (let x = nose; x > tail; )
    {
        circles.push({ x, y: 0, r: r(x) });
        const step = .8*r(x);
        x -= Math.min(step, .8*r(x - step));
    }
    circles.push({ x: tail, y: 0, r: r(tail) });
    const covers = (x, y) => circles.some(c => (c.x - x)**2 + (c.y - y)**2 <= c.r*c.r);
    for (const p of parts)
    {
        if (!p.some(q => q.y > 1e-6) && p.some(q => q.y < -1e-6)) continue;       // starboard copies come from the mirror
        let px0 = Infinity, px1 = -Infinity, py0 = Infinity, py1 = -Infinity;
        for (const q of p) { px0 = Math.min(px0, q.x); px1 = Math.max(px1, q.x); py0 = Math.min(py0, q.y); py1 = Math.max(py1, q.y); }
        const h = Math.max(px1 - px0, py1 - py0) / 40, samples = [];
        for (let x = px0 + h/2; x < px1; x += h)
            for (let y = py0 + h/2; y < py1; y += h)
                if (inPoly(p, x, y) && !covers(x, y)) samples.push({ x, y, r: edgeDist(p, x, y) + over*.5 });
        const total = samples.length;
        for (let n = 0; n < max && samples.length > left*total; n++)
        {
            let best, bestN = 0;
            for (const c of samples)
            {
                let k = 0;
                for (const s of samples) if ((s.x - c.x)**2 + (s.y - c.y)**2 <= c.r*c.r) k++;
                if (k > bestN) { bestN = k; best = c; }
            }
            if (!best) break;
            const keel = Math.abs(best.y) < h, y = keel ? 0 : best.y;
            circles.push({ x: best.x, y, r: best.r });
            if (!keel) circles.push({ x: best.x, y: -y, r: best.r });
            for (let k = samples.length - 1; k >= 0; k--)
                if ((samples[k].x - best.x)**2 + (samples[k].y - y)**2 <= best.r*best.r) samples.splice(k, 1);
        }
    }
    return circles.sort((a, b) => b.x - a.x);
}

// the side trails (emitFoam in main.js) start TRAIL_AT ship lengths behind the middle, at the edge of the ship's outline there
// (trailW: body, fins, boosters, sail, so they hug the ship as drawn, not the boat hull it replaced)
const TRAIL_AT = .18;
function outlineHalfWidth(shapes, x)
{
    let w = 0;
    for (const p of shapes)
        for (let i = 0; i < p.length; i++)
        {
            const a = p[i], b = p[(i + 1) % p.length];
            if ((a.x - x)*(b.x - x) > 0 || a.x == b.x) continue;
            w = Math.max(w, Math.abs(a.y + (b.y - a.y)*(x - a.x)/(b.x - a.x)));
        }
    return w;
}

for (const key in BOATS)
{
    const shapes = shipHitShapes(key), t = BOATS[key];
    if (!shapes) continue;
    t.circles = coverCircles(shapes);
    t.hitL = 2*Math.max(...t.circles.map(c => Math.abs(c.x) + c.r));
    t.hitW = 2*Math.max(...t.circles.map(c => Math.abs(c.y) + c.r));
    t.trailW = 2*outlineHalfWidth(shapes, -TRAIL_AT*t.L);
    t.selShapes = shapes;                       // the selection rim goes round all of them (drawJamSelection)
}

// Retro thrusters: a port on each side of the nose, where the hull has narrowed to RETRO_AT of its widest, firing forward
// and RETRO_ANGLE out from the keel. Each type gets retro: { x, y (port side), s (flame width) } in toy units.
const RETRO_AT = .6, RETRO_ANGLE = .6, RETRO_DIR = vec2(Math.cos(RETRO_ANGLE), Math.sin(RETRO_ANGLE));
for (const key in JETS)
{
    const t = BOATS[key], hull = t.hullPts;
    if (!hull) continue;
    let x1 = -Infinity, wMax = 0;
    for (const q of hull) { x1 = Math.max(x1, q.x); wMax = Math.max(wMax, Math.abs(q.y)); }
    let x = x1;
    while (x > 0 && outlineHalfWidth([hull], x) < RETRO_AT*wMax) x -= .01;
    t.retro = { x, y: outlineHalfWidth([hull], x), s: .6*JETS[key][0][2] };
}

// nose cone and bands in the trim color
function trimBody(d, key, color)
{
    const r = RK[key];
    for (const p of r.bands) d.poly(p, color);
    if (r.nose.length) d.poly(r.nose, color, true);
}

// a soft highlight on glass, the way a poster painter would add one
const glint = (d, x, y, w, h) => d.ellipse(x, y, w, h, P_CREAM.scale(1, .55));
// a porthole: trim ring, glass, glint
function porthole(d, x, y, r, ring)
{
    d.circle(x, y, r*2, ring, true);
    d.circle(x, y, r*1.45, P_GLASS);
    glint(d, x + r*.2, y + r*.22, r*.6, r*.28);
}

// drawn before the body: fins, wings, boosters, engine bells
const SHIP_UNDER =
{
    jetski(d, t, b, hull)
    {
        const r = RK.jetski, fin = finOf(hull);
        for (const f of r.fins) d.poly(f, fin, true);
        d.poly(r.bell, P_DEEP);
    },
    dinghy(d, t, b, hull)
    {
        const r = RK.dinghy, fin = finOf(hull, P_TEAL);
        for (const f of r.fins) d.poly(f, fin, true);
        d.poly(r.bell, P_DEEP);
    },
    speedboat(d, t, b, hull)
    {
        const r = RK.speedboat;
        for (const f of r.fins) d.poly(f, hull, true);
        for (const f of r.canards) d.poly(f, hull, true);
        d.poly(r.bell, P_DEEP);
    },
    minisub(d, t, b, hull)
    {
        const r = RK.minisub;
        for (const f of r.fins) d.poly(f, P_DUSK, true);
        for (const p of r.bells) d.poly(p, P_DEEP);
        for (const p of r.boosters) d.poly(p, hull, true);
        for (const p of r.boosterNoses) d.poly(p, P_DUSK);
        d.poly(r.bell, P_DEEP);
    },
    sailboat(d, t, b, hull)
    {
        const r = RK.sailboat, fin = finOf(hull);
        for (const f of r.fins) d.poly(f, fin, true);
        d.poly(r.bell, P_DEEP);
    },
    trawler(d, t, b, hull)
    {
        const r = RK.trawler;
        for (const f of r.fins) d.poly(f, trimOf(hull), true);
        for (const p of r.bells) d.poly(p, P_DEEP);
        for (const s of [1, -1])                                       // grabber arms
        {
            d.line(.3, s*.36, 1.05, s*.56, .12, P_SLATE);
            d.circle(1.08, s*.56, .24, P_SAND, true);
        }
    },
    yacht(d, t, b, hull)
    {
        const r = RK.yacht, fin = finOf(hull, P_TEAL);
        for (const f of r.fins) d.poly(f, fin, true);
        for (const p of r.bells) d.poly(p, P_DEEP);
        for (const p of r.boosters) d.poly(p, hull, true);
        for (const p of r.boosterNoses) d.poly(p, trimOf(hull));
        d.poly(r.bell, P_DEEP);
    },
    sub(d, t, b, hull)
    {
        const r = RK.sub;
        for (const f of r.fins) d.poly(f, P_DUSK, true);
        for (const f of r.canards) d.poly(f, P_DUSK, true);
        d.poly(r.bell, P_DEEP);
    },
    cruise(d, t, b, hull)
    {
        const r = RK.cruise, fin = finOf(hull);
        for (const f of r.fins) d.poly(f, fin, true);
        for (const p of r.bells) d.poly(p, P_DEEP);
    },
};

// Deck drawings, in the same painter as BOAT_DECO (x = bow, y = port, toy units)
const SHIP_DECO =
{
    jetski(d, t, b)     // Rocket Scooter
    {
        const hull = shipHull(t, b);
        trimBody(d, 'jetski', trimOf(hull));
        d.line(-.35, 0, -1.12, 0, .1, finOf(hull));                                  // top fin, edge on
        d.ellipse(.2, 0, .56, .36, P_GLASS, true);                                    // bubble canopy
        glint(d, .3, .08, .2, .08);
    },
    dinghy(d, t, b)     // Escape Pod
    {
        const hull = shipHull(t, b);
        trimBody(d, 'dinghy', trimOf(hull));
        d.line(-.38, 0, -.8, 0, .13, finOf(hull, P_TEAL));                            // top fin, edge on
        porthole(d, .22, 0, .32, trimOf(hull));
    },
    swan(d)         // Flying Saucer
    {
        for (let i = 0; i < 10; i++)                                     // rim lights, chasing
        {
            const a = i/10*PI*2, on = (Math.floor(time*6) + i) % 3 == 0;
            d.circle(Math.cos(a)*1, Math.sin(a)*.66, .17, on ? C_SUNNY : C_CORAL.lerp(C_INK, .3));
        }
        d.circle(1.02, 0, .24, C_CREAM, true);                           // nose light, so you can tell which way is forward
        d.circle(-.05, 0, 1, C_GLOW.lerp(C_GLASS, .4), true);             // dome
        glint(d, .15, .2, .36, .16);
    },
    speedboat(d, t, b)  // Zoomer
    {
        const hull = shipHull(t, b), trim = trimOf(hull);
        for (const s of [1, -1])
        {
            d.line(.1, s*.24, -.98, s*.56, .07, trim);                                // wing stripes
            d.ellipse(-1.12, s*.62, .62, .13, trim, true);                            // wingtip pods
        }
        trimBody(d, 'speedboat', trim);
        d.line(-.7, 0, -1.5, 0, .08, P_DEEP);                                         // top fin, edge on
        d.ellipse(.62, 0, .64, .26, P_GLASS, true);                                   // canopy
        glint(d, .72, .06, .24, .07);
    },
    minisub(d, t, b)    // Stealth Pod
    {
        trimBody(d, 'minisub', P_DUSK);
        for (const s of [1, -1]) d.line(-1.2, s*.72, .2, s*.72, .06, P_GLASS);        // booster light strips
        d.line(-.95, 0, -1.6, 0, .1, P_DUSK);                                          // top fin, edge on
        d.ellipse(.72, 0, .95, .52, P_GLASS, true);                                    // canopy
        glint(d, .88, .12, .32, .12);
    },
    sailboat(d, t, b)   // Solar Sailer: a diamond mirror sail on struts
    {
        const hull = shipHull(t, b);
        trimBody(d, 'sailboat', trimOf(hull));
        d.line(-1.5, 0, -2.35, 0, .1, finOf(hull));                                   // top fin, edge on
        for (const [x, y] of [[1.45, 0], [.15, .78], [-1.15, 0], [.15, -.78]]) d.line(.15, 0, x, y, .05, C_INK);
        d.poly(SAIL_PTS, C_SUNNY, true);                                                // sail
        d.poly([[1.0,0],[.15,.5],[-.7,0],[.15,-.5]], C_SUNNY.lerp(C_CREAM, .45));
        const g = ((time*.35) % 1)*2.6 - 1.15;                                         // a glint sweeping down the mirror
        if (g > -.9 && g < 1.2) d.line(g + .2, .3, g - .2, -.3, .1, C_CREAM.scale(1, .8));
        d.line(-1.15, 0, 1.45, 0, .05, C_INK);                                         // struts
        d.line(.15, .78, .15, -.78, .05, C_INK);
        d.circle(.15, 0, .3, C_SILVER, true);                                          // hub
    },
    trawler(d, t, b)    // Asteroid Miner
    {
        const hull = shipHull(t, b);
        trimBody(d, 'trawler', trimOf(hull));
        d.ellipse(-.2, 0, 1.05, .6, P_DEEP);                                           // ore bay
        for (const [x, y, r] of [[-.5, .08, .28], [-.16, -.1, .32], [.04, .14, .2], [.14, -.1, .16]]) d.circle(x, y, r, P_ROCK2, true);
        d.ellipse(.62, 0, .34, .48, P_GLASS, true);                                    // cockpit
        glint(d, .68, .1, .12, .1);
        d.rect(1.02, 0, .16, .72, P_DEEP, true);                                       // drill collar
        d.poly(DRILL_PTS, P_SAND, true);                                               // drill
        const turn = (time*3) % 1*.2;                                                  // its thread, turning
        for (let i = 0; i < 3; i++)
        {
            const x = 1.12 + turn + i*.18, w = .24*(1.68 - x)/.6;
            if (x < 1.6) d.line(x, w, x + .1, -w, .04, P_DEEP);
        }
    },
    yacht(d, t, b)      // Star Yacht
    {
        const hull = shipHull(t, b), trim = trimOf(hull);
        trimBody(d, 'yacht', trim);
        d.line(-1.7, 0, -3.78, 0, .24, finOf(hull, P_TEAL));                          // top fin, edge on
        for (const x of [1.0, .15, -.7]) porthole(d, x, 0, .17, P_DEEP);
        d.ellipse(2.35, 0, 1.6, .78, P_GLASS, true);                                   // observation dome
        glint(d, 2.65, .15, .55, .18);
    },
    sub(d, t, b)        // Stealth Cruiser
    {
        d.poly([[2.6,0],[1.6,.15],[-2.7,.15],[-3.1,0],[-2.7,-.15],[1.6,-.15]], P_DUSK);   // armor spine
        for (const s of [1, -1]) d.line(-2.4, s*.27, 1.7, s*.27, .05, P_GLASS);       // light strips
        for (let i = 0; i < 5; i++) d.line(-.6 - i*.42, .14, -.6 - i*.42, -.14, .05, P_DEEP);   // plate seams
        trimBody(d, 'sub', P_DUSK);
        d.poly([[2.2,0],[1.7,.17],[1.2,0],[1.7,-.17]], P_GLASS, true);                // bridge
    },
    cruise(d, t, b)     // Space Liner
    {
        const hull = shipHull(t, b), trim = trimOf(hull);
        trimBody(d, 'cruise', trim);
        d.rect(-.25, 0, 6.3, .16, P_TEAL);                                              // promenade deck
        for (let i = 0; i < 13; i++)                                                   // cabin portholes
            for (const y of [.34, -.34]) d.circle(-3.2 + i*.5, y, .2, (i*3 + (y > 0)) % 5 ? P_GLASS : P_MUSTARD);
        d.line(-3.3, 0, -4.9, 0, .22, finOf(hull));                                    // top fin, edge on
        d.ellipse(3.72, 0, .95, .5, P_GLASS, true);                                    // bridge dome
        glint(d, 3.9, .1, .32, .1);
    },
    container(d, t, b)   // Classic Frigate: a Saturn V-style moon rocket lying on its side (bow = nose)
    {
        const fin = b ? b.color : t.color;
        for (const f of FRIGATE_FINS) d.poly(f, fin, true);                                         // fins
        for (const s of [1, -1]) d.poly([[-4.1, s*.6], [-4.6, s*.72], [-4.6, s*.6]], P_DEEP);     // engine fairings
        for (const p of FRIGATE_BELLS) d.poly(p, P_SLATE, true);                                    // engine bells
        d.poly(ROCKET_BODY, P_CREAM, true);                                                       // the stages
        d.rect(-4.05, .31, 1.1, .62, P_DEEP);                                                     // first stage roll pattern
        d.rect(-4.05, -.31, 1.1, .62, P_CREAM);
        d.rect(-1.25, 0, .55, 1.24, P_DEEP);                                                      // first stage top band
        d.line(-.72, .62, -.72, -.62, .05, P_DEEP);                                               // stage joint
        d.line(1.35, .62, 1.35, -.62, .05, P_DEEP);
        d.rect(2.5, .215, .5, .43, P_DEEP);                                                       // third stage roll pattern
        d.line(3.45, .43, 3.45, -.43, .1, P_SAND);                                                // instrument ring
        d.poly([[3.5, .43], [4.05, .28], [4.05, -.28], [3.5, -.43]], P_SAND, true);              // lander fairing
        d.rect(4.17, 0, .25, .56, P_SAND);                                                        // service module
        d.poly([[4.3, .28], [4.62, .07], [4.62, -.07], [4.3, -.28]], P_CREAM, true);             // capsule
        d.line(4.62, 0, 4.82, 0, .05, P_DEEP);                                                    // escape tower
        for (const s of [1, -1]) d.line(4.62, s*.06, 4.8, 0, .03, P_DEEP);
        d.poly([[5.02, 0], [4.92, .06], [4.8, .06], [4.8, -.06], [4.92, -.06]], P_BRICK);        // escape rocket
    },
    island(d, t)    // Asteroid
    {
        const pit = C_GRASS.lerp(C_INK, .3), rim = C_GRASS.lerp(C_CREAM, .35);
        for (const [x, y, r] of [[-.4, .3, 2.2], [2.7, .7, 1.3], [-2.8, -.6, 1.5], [1, -1.5, .9], [-1, 1.8, .8], [3.9, 1, .5], [-3.9, -.1, .6]])
        {
            d.circle(x + r*.06, y - r*.06, r, rim);                     // lit rim
            d.circle(x, y, r*.88, pit, true);                            // crater
        }
        for (const [x, y] of [[1.6, .1], [-1.9, 1.1], [.3, -2.1], [3.2, -.3]]) d.circle(x, y, .45, C_SAND, true);   // boulders
    },
    continent(d, t)   // The Moon
    {
        const mare = C_MOON.lerp(C_INK, .25), pit = C_MOON.lerp(C_INK, .15), ray = C_CREAM.scale(1, .5);
        for (const [x, y, r] of [[-1.6, .5, 2.6], [-.2, 1.3, 1.9], [1.8, -.6, 2.2], [-2.6, -1.4, 1.4], [3.2, 1.2, 1.2]])
            d.circle(x, y, r, mare);                                     // dark seas
        for (let i = 0; i < 10; i++)                                     // the big crater's rays
        {
            const a = i/10*PI*2 + .2;
            d.line(1.3, 1.3, 1.3 + Math.cos(a)*1.5, 1.3 + Math.sin(a)*1.3, .12, ray);
        }
        for (const [x, y, r] of [[1.3, 1.3, .8], [-3.4, 1.0, .7], [-.6, -2.3, .9], [3.9, -.8, .55], [-1.1, 2.6, .45], [.6, -.2, .5]])
        {
            d.circle(x + r*.06, y - r*.06, r, C_CREAM.scale(1, .55));
            d.circle(x, y, r*.85, pit, true);
        }
    },
};

// ---------------------------------------------------------------------------
// the world's small things

// ducks -> tiny astronauts: mom leads, the kids follow on a tether, a hit makes them see stars
drawDuck = function(b)
{
    const d = painter(b), k = b.duckSize, o = shadowOff(.6*k);
    if (b.leader) posterSegs(b.pos, [[vec2(), b.leader.pos.subtract(b.pos)]], P_CREAM.scale(1, .7), Math.min(.05*WU, .06*k), [.01, .14*k]);
    painter(b, o.x, o.y).ellipse(0, 0, 1.1*k, .9*k, C_SHADOW);
    d.rect(-.38*k, 0, .34*k, .62*k, P_TEAL, true);                      // backpack
    for (const s of [1, -1]) d.circle(.1*k, s*.38*k, .3*k, P_CREAM, true);   // arms
    d.ellipse(-.05*k, 0, .82*k, .7*k, P_CREAM, true);                    // suit
    d.circle(.22*k, 0, .6*k, P_CREAM, true);                             // helmet
    d.ellipse(.36*k, 0, .26*k, .42*k, P_MUSTARD, true);                  // gold visor
    if (b.stunT > 0)
    {
        for (let i = 0; i < 3; i++)
        {
            const a = time*7 + i*PI*2/3;
            posterShape(d.P(.2*k + Math.cos(a)*.5*k, Math.sin(a)*.5*k), sparkle(.18*k), P_MUSTARD, 0);
        }
    }
    else glint(d, .4*k, .1*k, .08*k, .14*k);
};

// a four-pointed poster sparkle, points relative to its center
function sparkle(r) { return Array.from({ length: 8 }, (_, i) => { const a = i/8*PI*2, rr = i % 2 ? r*.28 : r; return vec2(Math.cos(a)*rr, Math.sin(a)*rr); }); }

// buoys -> little satellites with solar panels and a blinking light
drawBuoy = function(b)
{
    const r = .9*(1 + Math.sin(time*3 + b.id)*.03)*b.k;
    const s = { pos:b.pos, angle:(b.angle || 0) + time*.25 + b.id, k:r }, d = painter(s), o = shadowOff(r);
    painter(s, o.x, o.y).rect(0, 0, .5, 1.9, C_SHADOW);
    for (const m of [1, -1])
    {
        d.line(0, m*.25, 0, m*.4, .07, P_CREAM);                        // boom
        d.rect(0, m*.67, .42, .55, P_TEAL, true);                        // panel
        d.line(0, m*.42, 0, m*.93, .03, P_DEEP);
    }
    d.rect(0, 0, .5, .5, P_MUSTARD, true);                               // gold foil body
    d.circle(.12, .08, .26, P_CREAM, true);                              // dish
    if (Math.sin(time*5 + b.id) > .3) d.circle(-.14, -.12, .12, P_BRICK);   // blinker
};

// logs -> space junk: a snapped solar panel on a bent strut
drawLog = function(b)
{
    const d = painter(b), o = shadowOff(.55);
    painter(b, o.x, o.y).poly(hullRoundRect(1.2, .275, .1, .1), C_SHADOW);
    d.rect(-.4, 0, 1.4, .55, P_TEAL, true);
    for (const x of [-.85, -.4, .05]) d.line(x, .25, x, -.25, .03, P_DEEP);
    d.line(.3, 0, .75, .12, .1, P_SAND);                                 // bent strut
    d.poly([[.7, -.05], [1.2, .2], [1.08, .45], [.62, .22]], P_TEAL, true);   // broken piece
    d.circle(.3, 0, .16, P_SAND, true);
};

// pilings -> round docking hatches: a cream ring, a dark seal and a blinking beacon
drawPost = function(p)
{
    const c = vec2(p.x, p.y), r = p.r;
    drawCircle(c.add(shadowOff(r*2)), r*2, C_SHADOW);
    drawCircle(c, r*2, P_CREAM);
    drawCircle(c.add(vec2(r*.12, -r*.12)), r*1.7, P_SAND);
    drawCircle(c, r*1.45, P_DEEP);
    drawCircle(c, r*1.1, P_SLATE);
    drawCircle(c, r*.55, Math.sin(time*3 + p.x) > 0 ? P_MUSTARD : P_BRICK);
};

// Docks -> space station modules, after the 1950s wheel station and the retro probes: cream hulls with panel seams,
// rows of dark windows (a few lit), and a round docking port at every module joint, with a shaded lower edge so
// they read as cylinders. Quays are the station's main hull (two rows of windows, more plating); `under` docks are
// open girders a cloaked ship slips under. Everything is measured from the dock's short side, so a 2 m finger and
// an 80 m breakwater look alike.
drawDock = function(r)
{
    if (r.hull) return;                              // battle station walls are drawn together (drawHulls)
    if (r.pad) return drawPad(r);                    // a landing pad (src/space.js)
    const w = r.x1 - r.x0, h = r.y1 - r.y0, short = Math.min(w, h), along = w > h;
    const c = fillRect(r, r.under ? P_DEEP.scale(1, .55) : P_CREAM);
    if (!c) return;
    const px = short / WU;                           // the dock's width on screen, in UI units
    if (px < .12) return;
    const o = vec2(c.x0, c.y0), cw = c.x1 - c.x0, ch = c.y1 - c.y0;
    const a0 = along ? r.x0 - c.x0 : r.y0 - c.y0, len = along ? cw : ch, lo = along ? r.y0 - c.y0 : r.x0 - c.x0;
    drawCanvas2D(o, vec2(1), 0, false, ctx =>
    {
        ctx.beginPath();
        ctx.rect(0, 0, cw, ch);
        ctx.clip();
        // u runs along the dock (canvas units), v across it (0 = the shaded lower or right edge, 1 = the far edge)
        const X = (u, v) => along ? u : lo + (1 - v)*short, Y = (u, v) => along ? lo + v*short : u;
        const box = (u, size, v, thick, col) => { ctx.fillStyle = col; along ? ctx.fillRect(u, lo + v*short, size, thick*short) : ctx.fillRect(lo + (1 - v - thick)*short, u, thick*short, size); };
        const disc = (u, v, d, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(u, v), Y(u, v), d*short/2, 0, PI*2); ctx.fill(); };
        const each = (step, f) => { const n0 = Math.floor(-a0/step) - 1; for (let n = n0, i = 0; a0 + n*step < len + step && i < 300; n++, i++) f(a0 + n*step, n); };
        const deep = P_DEEP.toString(), sand = P_SAND.toString(), cream = P_CREAM.toString(), shade = 'rgba(10,8,40,.22)';
        if (r.under)
        {
            // an open girder: two cream rails and zigzag struts
            box(-1, len + 2, .08, .14, cream);
            box(-1, len + 2, .78, .14, cream);
            if (px < .3) return;
            ctx.strokeStyle = sand;
            ctx.lineWidth = short*.07;
            ctx.beginPath();
            const step = short*.8;
            each(step, u => { ctx.moveTo(X(u, .15), Y(u, .15)); ctx.lineTo(X(u + step/2, .85), Y(u + step/2, .85)); ctx.lineTo(X(u + step, .15), Y(u + step, .15)); });
            ctx.stroke();
            return;
        }
        box(-1, len + 2, 0, .18, shade);                                           // shaded lower edge
        if (px < .3) return;
        const rows = r.quay ? [.3, .62] : [.42];                                   // window rows (v of each row's lower edge)
        for (const v of [.2, .82]) box(-1, len + 2, v, .03, shade);              // panel seams along the hull
        const bay = short*(r.quay ? 1.4 : 2.2);
        each(bay, (u, n) =>
        {
            box(u - short*.09, short*.18, 0, 1, sand);                             // module collar
            box(u + short*.09, short*.03, 0, 1, shade);
            if (px < .55) return;
            for (const v of rows)                                                 // windows, a few lit
                for (let k = 0; k < 4; k++)
                {
                    const wu0 = u + bay*(.2 + k*.17), lit = (k*3 + n*5) % 7 < 2;
                    box(wu0, bay*.1, v, .16, deep);
                    if (lit) box(wu0 + bay*.02, bay*.06, v + .03, .1, (k + n) % 2 ? P_MUSTARD.toString() : P_GLASS.toString());
                }
            if (r.quay || n % 2) return;
            // a docking port on every other joint: a cream ring, a dark seal and a beacon
            disc(u, .5, .62, cream);
            disc(u + short*.03, .47, .5, sand);
            disc(u, .5, .4, deep);
            disc(u, .5, .26, P_SLATE.toString());
            disc(u, .5, .12, Math.sin(time*3 + n) > 0 ? P_MUSTARD.toString() : P_BRICK.toString());
        });
    });
};

{ const shadow0 = drawDockShadow; drawDockShadow = r => { if (!r.hull) shadow0(r); }; }

// Battle station walls: docks with hull: true are the inside of a planet-sized station. All of them are drawn as one
// shape, so the pieces show no seams where they meet: a hard shadow on the deck, grey plating with panel seams and
// shaded panels in octaves 10x apart (so it reads at any zoom), then along every edge that faces open space a cream
// rim with a row of amber lights. Overlapping or touching pieces hide each other's edges (hullParts).
const HULL_INKS = { base: P_DUSK, light: P_DUSK.lerp(P_CREAM, .18), dark: P_DUSK.lerp(P_INDIGO, .45), seam: P_INDIGO.lerp(P_DUSK, .25) };
let hullCache = null;
function hullParts()
{
    if (hullCache?.rects === rects) return hullCache;
    const hs = rects.filter(r => r.dock && r.hull), edges = [];
    // what is left of [lo, hi] once the covered stretches are taken out
    const left = (lo, hi, cover) =>
    {
        let segs = [[lo, hi]];
        for (const [a, b] of cover) segs = segs.flatMap(([p, q]) => b <= p || a >= q ? [[p, q]] : [...(a > p ? [[p, a]] : []), ...(b < q ? [[b, q]] : [])]);
        return segs.filter(([p, q]) => q - p > 1e-3);
    };
    for (const r of hs)
    {
        // each side, with the stretches of it that another piece reaches past (so it is inside the wall)
        const past = (o, axis, at, out) => out > 0 ? o[axis + '0'] <= at + 1e-6 && o[axis + '1'] > at + 1e-3 : o[axis + '1'] >= at - 1e-6 && o[axis + '0'] < at - 1e-3;
        const others = hs.filter(o => o != r);
        for (const [n, at, axis, lo, hi] of [[[0, 1], r.y1, 'y', r.x0, r.x1], [[0, -1], r.y0, 'y', r.x0, r.x1], [[1, 0], r.x1, 'x', r.y0, r.y1], [[-1, 0], r.x0, 'x', r.y0, r.y1]])
        {
            const along = axis == 'y' ? 'x' : 'y', out = n[0] + n[1];
            const cover = others.filter(o => past(o, axis, at, out)).map(o => [o[along + '0'], o[along + '1']]);
            for (const [a, b] of left(lo, hi, cover)) edges.push({ n, at, a, b });
        }
    }
    return hullCache = { rects, hs, edges };
}

function drawHulls()
{
    const H = hullParts();
    if (!H.hs.length) return;
    const d = .14*WU, shown = H.hs.map(r => clipRect(r, d*3)).filter(Boolean);
    if (!shown.length) return;
    const v = VIEW_RECT, o = vec2(v.x0, v.y0), vw = v.x1 - v.x0, vh = v.y1 - v.y0;
    const rim = Math.max(.6, .12*WU), gap = Math.max(6, 1.5*WU);
    drawCanvas2D(o, vec2(1), 0, false, ctx =>
    {
        // canvas units are meters from the view's lower left corner, y up
        const trace = (dx, dy) => { ctx.beginPath(); for (const c of shown) ctx.rect(c.x0 - o.x + dx, c.y0 - o.y + dy, c.x1 - c.x0, c.y1 - c.y0); };
        trace(d, -d); ctx.fillStyle = C_SHADOW.toString(); ctx.fill();
        trace(0, 0); ctx.fillStyle = HULL_INKS.base.toString(); ctx.fill();
        ctx.save();
        ctx.clip();
        // plating: panels a few UI units across at each octave, some lighter or darker, with seams between them
        for (let s = .1; s < 1e7; s *= 10)
        {
            const g = s / WU;
            if (g < .6 || g > 60) continue;
            const fade = clamp((g - .6)/1.4, 0, 1) * clamp((60 - g)/30, 0, 1);
            const i0 = Math.floor(v.x0/s), i1 = Math.ceil(v.x1/s), j0 = Math.floor(v.y0/s), j1 = Math.ceil(v.y1/s);
            ctx.globalAlpha = fade;
            for (let i = i0; i < i1; i++)
                for (let j = j0; j < j1; j++)
                {
                    const h = craterHash(i, j, s);
                    if (h > .34) continue;
                    // a lighter or darker panel, sometimes only half of the cell
                    ctx.fillStyle = (h < .17 ? HULL_INKS.light : HULL_INKS.dark).toString();
                    const half = h % .17 < .06, x = i*s - o.x + s*.06, y = j*s - o.y + s*.06;
                    ctx.fillRect(x, y, half ? s*.42 : s*.88, s*.88);
                }
            ctx.strokeStyle = HULL_INKS.seam.toString();
            ctx.lineWidth = Math.max(.02*s, .04*WU);
            ctx.beginPath();
            for (let i = i0; i <= i1; i++) { ctx.moveTo(i*s - o.x, 0); ctx.lineTo(i*s - o.x, vh); }
            for (let j = j0; j <= j1; j++) { ctx.moveTo(0, j*s - o.y); ctx.lineTo(vw, j*s - o.y); }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
        // the rims along the open edges, inside the wall: cream, a dark line behind it, amber lights along it
        for (const e of H.edges)
        {
            const [nx, ny] = e.n, horiz = ny != 0;
            if (horiz ? e.b < v.x0 || e.a > v.x1 || e.at < v.y0 - rim || e.at > v.y1 + rim : e.b < v.y0 || e.a > v.y1 || e.at < v.x0 - rim || e.at > v.x1 + rim) continue;
            const band = (w, off, col) =>
            {
                ctx.fillStyle = col;
                const inner = e.at - (nx + ny)*(off + w), outer = e.at - (nx + ny)*off, lo = Math.min(inner, outer), len = e.b - e.a;
                if (horiz) ctx.fillRect(e.a - o.x, lo - o.y, len, w); else ctx.fillRect(lo - o.x, e.a - o.y, w, len);
            };
            band(rim*.35, rim, HULL_INKS.dark.toString());
            band(rim, 0, P_CREAM.toString());
            const n = Math.floor((e.b - e.a)/gap);
            for (let k = 0; k < n; k++)
            {
                const u = e.a + (k + .5)*(e.b - e.a)/n, w = e.at - (nx + ny)*rim*.5;
                const x = horiz ? u : w, y = horiz ? w : u;
                if (x < v.x0 - rim || x > v.x1 + rim || y < v.y0 - rim || y > v.y1 + rim) continue;
                const on = Math.sin(time*2 + u*.37) > -.6;
                ctx.fillStyle = (k % 5 == 2 ? P_BRICK : on ? P_MUSTARD : P_ORANGE.lerp(P_DEEP, .5)).toString();
                ctx.beginPath(); ctx.arc(x - o.x, y - o.y, rim*.32, 0, PI*2); ctx.fill();
            }
        }
    });
}

// the deck floor of a level inside a station (interior: true), instead of the starfield: dark plates in octaves 10x
// apart, a few shaded, and faint seams
const P_DECK = P_DEEP.lerp(P_INDIGO, .35);
function drawDeck()
{
    const v = VIEW_RECT, o = vec2(v.x0, v.y0), vw = v.x1 - v.x0, vh = v.y1 - v.y0;
    drawCanvas2D(o, vec2(1), 0, false, ctx =>
    {
        ctx.fillStyle = P_DECK.toString();
        ctx.fillRect(0, 0, vw, vh);
        for (let s = .1; s < 1e7; s *= 10)
        {
            const g = s / WU;
            if (g < .8 || g > 60) continue;
            const fade = clamp((g - .8)/1.6, 0, 1) * clamp((60 - g)/30, 0, 1);
            const i0 = Math.floor(v.x0/s), i1 = Math.ceil(v.x1/s), j0 = Math.floor(v.y0/s), j1 = Math.ceil(v.y1/s);
            ctx.globalAlpha = fade;
            ctx.fillStyle = P_INDIGO.lerp(P_DUSK, .12).toString();
            for (let i = i0; i < i1; i++)
                for (let j = j0; j < j1; j++)
                    if (craterHash(i, j, s + 3) < .22) ctx.fillRect(i*s - o.x + s*.05, j*s - o.y + s*.05, s*.9, s*.9);
            ctx.strokeStyle = P_INDIGO.lerp(P_DUSK, .3).toString();
            ctx.lineWidth = Math.max(.015*s, .03*WU);
            ctx.beginPath();
            for (let i = i0; i <= i1; i++) { ctx.moveTo(i*s - o.x, 0); ctx.lineTo(i*s - o.x, vh); }
            for (let j = j0; j <= j1; j++) { ctx.moveTo(0, j*s - o.y); ctx.lineTo(vw, j*s - o.y); }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    });
    drawGrain(1);
}

// rock: one shape made of every sand rect and landmass, with a hard shadow, a dark side and a lit side (so overlapping
// pieces show no seams), lighter interiors, and craters in octaves 10x apart
drawLands = function()
{
    const shown = lands.filter(m => inView(m.pos, m.r)), o = cam.pos, d = .14*WU, shapes = [];
    const add = pts =>
    {
        let area = 0;
        for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a.x*b.y - b.x*a.y; }
        shapes.push(area < 0 ? pts.slice().reverse() : pts);          // same winding everywhere, so they merge
    };
    for (const r of rects) if (r.land) { const c = clipRect(r, d*3); if (c) add([vec2(c.x0, c.y0), vec2(c.x1, c.y0), vec2(c.x1, c.y1), vec2(c.x0, c.y1)].map(p => p.subtract(o))); }
    for (const m of shown) add(m.pts.map(p => p.subtract(o)));
    if (!shapes.length) return;
    const ink = rockInks();
    drawCanvas2D(o, vec2(1), 0, false, ctx =>
    {
        const trace = (dx, dy) => { ctx.beginPath(); for (const s of shapes) { s.forEach((p, i) => i ? ctx.lineTo(p.x + dx, p.y + dy) : ctx.moveTo(p.x + dx, p.y + dy)); ctx.closePath(); } };
        trace(d, -d); ctx.fillStyle = C_SHADOW.toString(); ctx.fill();
        trace(0, 0); ctx.fillStyle = ink[2].toString(); ctx.fill();
        ctx.save(); ctx.clip(); trace(-d*.8, d*.8); ctx.fillStyle = ink[0].toString(); ctx.fill(); ctx.restore();
    });
    for (const m of shown) if (m.grass) drawPoly(m.grass, ink[1]);
    drawCraters();
};

// battle station walls go over the rock
{ const lands0 = drawLands; drawLands = function() { lands0(); drawHulls(); }; }

function craterHash(x, y, o) { const s = Math.sin(x*127.1 + y*311.7 + o*74.7)*43758.5453; return s - Math.floor(s); }
function inPoly(pts, x, y)
{
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++)
    {
        const a = pts[i], b = pts[j];
        if ((a.y > y) != (b.y > y) && x < (b.x - a.x)*(y - a.y)/(b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
}
function drawCraters()
{
    const v = VIEW_RECT, shapes = [];
    for (const r of rects) if (r.land) shapes.push({ x0:r.x0, y0:r.y0, x1:r.x1, y1:r.y1 });
    for (const m of lands) if (inView(m.pos, m.r)) shapes.push({ x0:m.pos.x - m.r, y0:m.pos.y - m.r, x1:m.pos.x + m.r, y1:m.pos.y + m.r, pts:m.pts });
    if (!shapes.length) return;
    let budget = 600;
    for (let s = .1, o = 0; s < 1e7; s *= 10, o++)
    {
        const g = s / WU;
        if (g < 1.2 || g > 14) continue;
        const a = clamp((g - 1.2)/1.2, 0, 1) * clamp((14 - g)/5, 0, 1);
        const pit = rockInks()[2].scale(1, .75*a), lit = P_CREAM.scale(1, .16*a);
        for (const sh of shapes)
        {
            const x0 = Math.max(sh.x0, v.x0), y0 = Math.max(sh.y0, v.y0), x1 = Math.min(sh.x1, v.x1), y1 = Math.min(sh.y1, v.y1);
            if (x0 >= x1 || y0 >= y1) continue;
            for (let ix = Math.floor(x0/s); ix*s < x1; ix++)
            for (let iy = Math.floor(y0/s); iy*s < y1; iy++)
            {
                const h = craterHash(ix, iy, o);
                if (h > .45) continue;
                const rr = (.1 + h*.5)*s, x = (ix + .2 + craterHash(iy, ix, o)*.6)*s, y = (iy + .2 + craterHash(ix + 9, iy, o)*.6)*s;
                if (x - rr < sh.x0 || x + rr > sh.x1 || y - rr < sh.y0 || y + rr > sh.y1) continue;
                if (sh.pts && !inPoly(sh.pts, x, y)) continue;
                if (--budget < 0) return;
                drawEllipse(vec2(x, y), vec2(rr*2, rr*1.55), pit);
                drawEllipse(vec2(x - rr*.22, y + rr*.2), vec2(rr*1.1, rr*.7), lit);
            }
        }
    }
}

// parking burst: poster sparkles and tiny ringed planets fly out instead of fish and crabs
drawFish = function(pos, s, ang, color)
{
    const c = Math.cos(ang*.5), n = Math.sin(ang*.5);
    posterShape(pos, sparkle(s*1.3).map(p => vec2(p.x*c - p.y*n, p.x*n + p.y*c)), poster(color), 0);
};
drawCrab = function(pos, s, rot, t, color)
{
    posterShape(pos, ringPts(.75*s), poster(color), s*.15);
    const cs = Math.cos(rot), sn = Math.sin(rot), ring = ringPts(1.35*s, .32*s).map(p => vec2(p.x*cs - p.y*sn, p.x*sn + p.y*cs));
    posterSegs(pos, ring.map((p, i) => [p, ring[(i + 1) % ring.length]]), P_CREAM, s*.16);
};

// parked: a space anchor on a cream tether
drawAnchorRope = function()
{
    drawRestRing();
    if (!anchor) return;
    const drop = Math.min(1, anchor.t*4), k = player.k, bow = bowPoint();
    drawCircle(anchor.pos, 1.2*drop*k, P_CREAM.scale(1, .18));
    drawAnchorGlyph(anchor.pos, .55*k, P_CREAM);
    posterSegs(bow, [[vec2(), anchor.pos.subtract(bow)]], P_CREAM, Math.min(.07*WU, .07*k));
};

// the ship you drive in a crowded harbor: a cream rim round its whole outline, fins, boosters and sail included
// (selShapes), drawn under the ship so only the outer half of the stroke shows. All the shapes go in one path and one
// stroke, so the rim is see-through evenly with no darker spots where shapes meet. Over a cloaked ship the rim is
// drawn offscreen with the ship's outline cut out of it, so it still only shows outside the ship.
const SELECT_W = .17, SELECT_ALPHA = .8;      // stroke width (UI units; half of it shows) and opacity
let selCanvas;
drawJamSelection = function(onTop = false)
{
    const b = player;
    if (!b) return;
    const P = painter({ ...b, dive: 0 }).P, o = b.pos;
    const shapes = (b.type.selShapes || [b.type.hullPts]).map(s => s.map(p => P(p.x, p.y).subtract(o)));
    const rim = g =>
    {
        g.beginPath();
        for (const s of shapes) { s.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); }
        g.lineJoin = 'round';
        g.lineWidth = SELECT_W*cam.wu;
        g.strokeStyle = P_CREAM.scale(1, SELECT_ALPHA).toString();
        g.stroke();
    };
    drawCanvas2D(o, vec2(1), 0, false, ctx =>
    {
        if (!onTop) return rim(ctx);
        selCanvas ||= document.createElement('canvas');
        if (selCanvas.width != ctx.canvas.width || selCanvas.height != ctx.canvas.height)
            { selCanvas.width = ctx.canvas.width; selCanvas.height = ctx.canvas.height; }
        const g = selCanvas.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, selCanvas.width, selCanvas.height);
        g.setTransform(ctx.getTransform());
        rim(g);
        g.globalCompositeOperation = 'destination-out';
        g.fill();
        g.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(selCanvas, 0, 0);
        ctx.restore();
    });
};

// slips: round cream dashes
drawDashedRect = function(c, w, h, color, width, dash=.5, angle=0)
{
    const cs = Math.cos(angle), sn = Math.sin(angle), segs = [];
    const pts = [[-w/2, -h/2], [w/2, -h/2], [w/2, h/2], [-w/2, h/2]].map(([x, y]) => vec2(x*cs - y*sn, x*sn + y*cs));
    for (let i = 0; i < 4; i++)
    {
        const a = pts[i], b = pts[(i + 1) % 4], n = clamp(Math.round(a.distance(b)/dash), 1, 120);
        for (let k = 0; k < n; k += 2) segs.push([a.lerp(b, k/n), a.lerp(b, Math.min(1, (k + 1)/n))]);
    }
    posterSegs(c, segs, poster(color), width*.85);
};

// ---------------------------------------------------------------------------
// UI: cream cards with hard indigo shadows, Righteous type

const UI_SHADOW = vec2(.16, -.22);
drawPanel = function(c, w, h, color, r=.5, shadow=true)
{
    const pts = hullRoundRect(w/2, h/2, r, r);
    if (shadow) posterShape(c.add(UI_SHADOW), pts, P_DEEP.scale(1, .6*color.a), 0);
    posterShape(c, pts, poster(color), 0);
};

// buttons: the main one brick, the rest teal, both with cream type, so they stand out on cream cards and on the sky
drawButton = function(b)
{
    const hover = hoverId == b.id, lift = hover ? .12 : 0;
    if (b.card !== undefined) return drawLevelCard(b, hover);
    const c = vec2(b.x, b.y + lift);
    drawPanel(c, b.w, b.h, b.big ? P_BRICK : P_TEAL, Math.min(.6, b.h*.35));
    txt(b.label, c.x, c.y - (b.small ? .02 : .05), b.big ? 1.25 : b.small ? .6 : .85, P_CREAM);
};

drawStar = function(c, r, filled)
{
    const pts = starPoints(vec2(), r);
    if (filled) { posterShape(c.add(vec2(.1, -.14)), pts, P_DEEP.scale(1, .45), 0); posterShape(c, pts, P_MUSTARD, r*.12); }
    else posterShape(c, pts, P_DEEP.scale(1, .16), 0);
};

// crowded levels: until a ship is picked, a line at the bottom says what to do (plain text with a drop shadow)
function drawPickHint()
{
    if (level.test || player || gameScreen != 'playing' || !jamBoats.some(b => !b.parked)) return;
    const a = .75 + .25*Math.sin(time*3);
    harborTxt('Click the ship you want to park first', 20.08, 1.62, .85, P_VOID.scale(1, a));
    harborTxt('Click the ship you want to park first', 20, 1.7, .85, P_CREAM.scale(1, a));
}

drawHud = function()
{
    const L = level, wide = viewHalfUi().x*2;
    drawRect(vec2(20, (PLAY_TOP + UI_SIZE.y)/2), vec2(wide, UI_SIZE.y - PLAY_TOP), P_DEEP);
    drawRect(vec2(20, PLAY_TOP - .05), vec2(wide, .1), P_MUSTARD);
    txt(`${levelNumber()}. ${L.name}`, .8, 21.75, .7, P_MUSTARD, 'left');
    if (L.jam) { drawPickHint(); return drawJamHud(); }
    let boat = player.type.name;
    boat += ` - ${fmtLen(boatSize(player))}`;
    if (fleet.length > 1) boat += `   ${boatIndex + 1}/${fleet.length}`;
    txt(boat, 10, 21.75, .55, P_CREAM, 'left');
    if (damages) txt(`Damages: ${fmtMoney(damages)}`, 26, 21.75, .55, P_ORANGE);
    drawAirGauge();
    drawScaleBar();
};

// speech bubbles over bumped ships: cream cards with a hard shadow
drawSwearing = function()
{
    for (const b of bodies)
    {
        if (!(b.swearT > 0) || !b.type || !inView(b.pos, b.radius*1.5)) continue;
        const len = screenLen(b);
        if (len < .5) continue;
        const n = clamp(Math.round(len/3), 1, 6), a = clamp(b.swearT*4, 0, 1);
        const pop = clamp((SWEAR_TIME - b.swearT)*8, 0, 1);
        for (let i = 0; i < n; i++)
        {
            const x = n == 1 ? 0 : (i/(n - 1) - .5) * b.type.L * b.k * .7;
            const u = worldToUi(b.toWorld(x, 0));
            const str = swearText(b.swearSeed + i*7), w = str.length*.42 + .6, c = vec2(u.x, u.y + 1.1 + pop*.2);
            posterShape(c, [vec2(-.15, -.4), vec2(.15, -.4), vec2(-.05, -.8)].map(q => q.scale(pop)), P_CREAM.scale(1, a), 0);
            drawPanel(c, w*pop, .85*pop, P_CREAM.scale(1, a), .3);
            if (pop >= 1) txt(str, c.x, c.y - .05, .5, P_BRICK.scale(1, a));
        }
    }
};

drawScaleBar = function()
{
    const target = 5*cam.wu, p10 = Math.pow(10, Math.floor(Math.log10(target)));
    const m = [5, 2, 1].map(x => x*p10).find(x => x <= target), len = m / cam.wu;
    const x0 = 1, y = 19.7;
    posterSegs(vec2(x0, y), [[vec2(), vec2(len, 0)], [vec2(0, -.25), vec2(0, .25)], [vec2(len, -.25), vec2(len, .25)]], P_CREAM, .14);
    txt(fmtLen(m), x0 + len/2, y + .55, .5, P_CREAM, 'center', .08, P_DEEP);
};

// the cloak's power: a bar with a lightning bolt
drawAirGauge = function()
{
    const b = player;
    if (!b?.type.sub) return;
    const x = 12.6, y = 1.6, w = 6.4, h = .7, low = b.o2 < .25, flash = low && Math.sin(time*14) > 0;
    drawPanel(vec2(x - .45, y), w + 1.4, h + .5, P_CREAM, .3);
    const bx = x - w/2 - .55, bolt = [[.12, .42], [-.18, -.02], [.02, -.02], [-.1, -.42], [.2, .06], [0, .06]];
    posterShape(vec2(bx, y), bolt.map(([u, v]) => vec2(u, v)), P_MUSTARD, 0);
    drawRect(vec2(x, y), vec2(w, h), P_DEEP.scale(1, .15));
    const fill = w*b.o2;
    if (fill > .01) drawRect(vec2(x - w/2 + fill/2, y), vec2(fill, h), flash || b.winded ? P_BRICK : P_TEAL);
    drawRect(vec2(x - w/2 + w*SUB_DIVE_MIN, y), vec2(.08, h + .3), P_DEEP);
};

// title: a big ringed planet rises behind a space liner and a parade of little ships, under a poster headline
drawTitle = function()
{
    const pc = vec2(33.5, 19.5), tilt = .3, rot = p => vec2(p.x*Math.cos(tilt) - p.y*Math.sin(tilt), p.x*Math.sin(tilt) + p.y*Math.cos(tilt));
    const ring = ringPts(7.4, 1.5).map(rot), back = [], front = [];
    ring.forEach((p, i) => (UNIT_RING[i][1] > 0 ? back : front).push([p, ring[(i + 1) % ring.length]]));
    posterSegs(pc, back, P_MUSTARD, .42);
    posterShape(pc, ringPts(4.2), P_BRICK, .5);
    posterShape(pc, ringPts(3.1, .55).map(p => p.add(vec2(.4, 1.4))), P_ROCK2, 0);       // a band
    posterSegs(pc, front, P_MUSTARD, .42);
    for (const [x, y, s] of [[6, 18.5, 1], [15.5, 20.8, .6], [36.5, 6.5, .8], [3.5, 5, .5]])
        drawCanvas2D(vec2(x, y), vec2(3.6*s), 0, false, ctx => ctx.drawImage(STAR_FLARE, -.5, -.5, 1, 1));
    const ship = { pos:vec2(((time*1.2) % 90) - 25, 2.6), angle:0, sx:1, sy:1, id:9, k:2.4, type:BOATS.cruise, color:BOATS.cruise.color, kind:'title' };
    drawBoatShadow(ship);
    drawBoat(ship);
    ['dinghy', 'swan', 'trawler', 'speedboat'].forEach((key, i) =>
    {
        const a = time*.4 + i*PI/2;
        const b = { pos:vec2(20 + Math.cos(a)*15, 11 + Math.sin(a)*7.5), angle:a + PI/2, sx:1, sy:1, id:i, type:BOATS[key], color:BOATS[key].color, kind:'title' };
        drawBoatShadow(b);
        drawBoat(b);
    });
    const bob = Math.sin(time*2)*.2;
    harborTxt('Spaceship', 20, 17.3 + bob, 1.9, P_MUSTARD);
    harborTxt('Parking', 20.25, 14.4 + bob, 3.6, P_BRICK);
    harborTxt('Parking', 20, 14.7 + bob, 3.6, P_CREAM);
};

// ---------------------------------------------------------------------------
// type: Righteous, bundled in fonts/ (SIL Open Font License, see fonts/OFL.txt) and declared in index.html.
// Every text draw goes through the engine's drawText, so this one swap covers labels, buttons, popups and decks.

const POSTER_FONT = "'Righteous', 'Trebuchet MS', 'Arial Rounded MT Bold', sans-serif";
const harborDrawText = drawText;
drawText = function(text, pos, size, color, lineWidth, lineColor, textAlign, font, fontStyle, maxWidth, angle, context)
{
    return harborDrawText(text, pos, size, color, lineWidth, lineColor, textAlign, POSTER_FONT, '', maxWidth, angle, context);
};
document.fonts?.load("20px 'Righteous'");
