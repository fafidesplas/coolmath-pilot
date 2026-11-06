'use strict';
// Lost in Parking Space: the secret space skin, in the Night Neon art family (dark navy, glowing outlines, a few
// vivid accents). Loaded after src/main.js by space/index.html only, so the harbor build never sees it.
// Pure visual reskin: physics, levels, sizes and handling are untouched. It repaints (a neon painter replaces the
// Toybox one, so every deck drawing turns into glowing line art), renames, and swaps a few sounds. Every game fix
// and new level in the harbor build shows up here for free.
// Keep collision shapes alone: anything drawn past a hull is decoration only.

// ---------------------------------------------------------------------------
// palette

function setColor(c, r, g, b, a=c.a) { c.r = r; c.g = g; c.b = b; c.a = a; }
setColor(C_WATER,  .02, .02, .06);       // the sky
setColor(C_WATER2, .55, .50, 1);         // sparks, bonus cards
setColor(C_SAND,   .55, .30, .62);       // rock (asteroid hull, ore)
setColor(C_GRASS,  .45, .30, .62);

const C_SILVER = rgb(.80, .82, .90);
const C_GLASS  = rgb(.45, .80, .96);
const C_GLOW   = rgb(.45, 1, .92);
const C_STEALTH= rgb(.42, .40, .60);
const C_SLATE  = rgb(.38, .39, .55);
const C_PANEL  = rgb(.24, .42, .78);     // solar panels
const C_FLAME  = rgb(1, .55, .2);
const C_MOON   = rgb(.72, .72, .76);
const C_LILAC  = rgb(.70, .62, .92);

// the neon lights themselves
const N_WHITE  = rgb(.88, .96, 1);
const N_DIM    = rgb(.42, .45, .85);     // what was ink: small dark details
const N_CYAN   = rgb(.25, .96, 1);
const N_PINK   = rgb(1, .25, .78);
const N_YELLOW = rgb(1, .9, .25);
const N_ORANGE = rgb(1, .55, .2);
const N_VIOLET = rgb(.62, .42, 1);
const N_LIME   = rgb(.65, 1, .3);
// dark fills: shapes hide what is behind them, so line art never turns into a tangle
const C_HULL   = rgb(.03, .035, .09);
const C_ROCK   = rgb(.07, .04, .11);
const C_DECK   = rgb(.04, .06, .13);
const C_UIBG   = rgb(.04, .04, .11, .94);

MOORED_COLORS[2] = C_LILAC;
setCanvasClearColor(C_WATER);            // gameInit may already have copied the harbor color

// any Toybox color -> its neon light: grays become white (light) or dim violet (dark), the rest full saturation
const neonCache = new Map();
function neon(c)
{
    if (!c) return C_CLEAR;
    const key = Math.round(c.r*255)*65536 + Math.round(c.g*255)*256 + Math.round(c.b*255);
    let n = neonCache.get(key);
    if (!n)
    {
        const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b), ch = max - min;
        if (ch < .16) n = max > .55 ? N_WHITE : N_DIM;
        else
        {
            let h = max == c.r ? ((c.g - c.b)/ch + 6) % 6 : max == c.g ? (c.b - c.r)/ch + 2 : (c.r - c.g)/ch + 4;
            h /= 6;
            if (h < .04 || h > .93) h = .95;                 // reds glow hot pink
            const f = m => { const k = (m + h*12) % 12; return .6 - .4*Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
            n = rgb(f(0), f(8), f(4));
        }
        neonCache.set(key, n);
    }
    return c.a < 1 ? n.scale(1, c.a) : n;
}
// the white-hot core of a neon tube
function hot(c) { return new Color(c.r + (1 - c.r)*.45, c.g + (1 - c.g)*.45, c.b + (1 - c.b)*.45, c.a); }
// panel edges: plain panels glow cyan
function edgeColor(c) { const n = neon(c); return n.r == N_WHITE.r && n.g == N_WHITE.g ? N_CYAN.scale(1, c.a) : n; }
// text: dark ink reads as white on the night sky
function textColor(c) { return !c ? c : .3*c.r + .59*c.g + .11*c.b < .35 ? N_WHITE.scale(1, c.a) : neon(c); }

// A glowing path: points relative to o (world or UI units), optional fill, then a soft additive halo and a hot core.
function neonPath(o, pts, closed, color, w, glow, fill)
{
    drawCanvas2D(o, vec2(1), 0, false, ctx =>
    {
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) i ? ctx.lineTo(pts[i].x, pts[i].y) : ctx.moveTo(pts[i].x, pts[i].y);
        if (closed) ctx.closePath();
        if (fill) { ctx.fillStyle = fill.toString(); ctx.fill(); }
        if (!w || !color || color.a <= 0) return;
        neonStroke(ctx, color, w, glow);
    });
}
// many separate segments [[a, b], ...] in one path (dashes, edges)
function neonSegs(o, segs, color, w, glow)
{
    drawCanvas2D(o, vec2(1), 0, false, ctx =>
    {
        ctx.beginPath();
        for (const [a, b] of segs) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
        neonStroke(ctx, color, w, glow);
    });
}
function neonStroke(ctx, color, w, glow)
{
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (glow)
    {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = color.scale(1, .16).toString();
        ctx.lineWidth = w*5;
        ctx.stroke();
        ctx.lineWidth = w*2.4;
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
    }
    ctx.strokeStyle = (glow ? hot(color) : color).toString();
    ctx.lineWidth = w;
    ctx.stroke();
}
const UNIT_RING = Array.from({ length: 22 }, (_, i) => [Math.cos(i/22*PI*2), Math.sin(i/22*PI*2)]);
function ringPts(r, ry=r) { return UNIT_RING.map(([u, v]) => vec2(u*r, v*ry)); }

// The neon painter: same calls as the Toybox one (render.js), so every deck drawing works unchanged.
// Outlined shapes become dark shapes with a glowing rim; small filled ones become lights; big filled ones a faint contour.
painter = function(b, ox=0, oy=0)
{
    const k = b.k || 1, c = Math.cos(b.angle), s = Math.sin(b.angle), sx = (b.sx || 1)*k, sy = (b.sy || 1)*k;
    const O = vec2(b.pos.x + ox, b.pos.y + oy);
    const L = (x, y) => vec2(x*sx*c - y*sy*s, x*sx*s + y*sy*c);
    const P = (x, y) => L(x, y).add(O);
    const fade = 1 - .72*(b.dive || 0);                     // a cloaked ship fades out
    const span = (b.type ? b.type.L : 2)*k / WU;            // on-screen size, UI units
    const glow = span > 2.5, core = Math.min(.07*WU, .06*k);
    const tint = col => { const n = neon(col); return fade < 1 ? n.scale(1, fade) : n; };
    const shape = (rel, size, color, outline) =>
    {
        if (!color || color.a <= 0) return;
        const n = tint(color);
        if (outline) neonPath(O, rel, true, n, core, glow, C_HULL.scale(1, fade*color.a));
        else if (size < .4) neonPath(O, rel, true, n, core*.5, glow, n);
        else neonPath(O, rel, true, n.scale(1, .5), core*.6, false, null);
    };
    const ell = (x, y, w, h) => UNIT_RING.map(([u, v]) => L(x + u*w/2, y + v*h/2));
    return {
        P,
        circle(x, y, d, color, outline) { shape(ell(x, y, d, d), d, color, outline); },
        ellipse(x, y, w, h, color, outline) { shape(ell(x, y, w, h), Math.max(w, h), color, outline); },
        poly(pts, color, outline)
        {
            let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
            const rel = pts.map(p =>
            {
                const x = p.x === undefined ? p[0] : p.x, y = p.x === undefined ? p[1] : p.y;
                x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
                return L(x, y);
            });
            shape(rel, Math.max(x1 - x0, y1 - y0), color, outline);
        },
        rect(cx, cy, w, h, color, outline) { this.poly([[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]], color, outline); },
        line(x1, y1, x2, y2, w, color) { if (color) neonPath(O, [L(x1, y1), L(x2, y2)], false, tint(color), Math.min(w*k, core*1.3), glow, null); },
        text(str, x, y, size, color) { drawText(str, P(x, y), size*k, tint(color), 0, C_INK, 'center', fontDefault, FONT_STYLE); },
        // a solid glowing shape (thruster flames)
        flame(pts, color) { const n = tint(color); neonPath(O, pts.map(p => L(p[0], p[1])), true, n, core*.5, glow, n.scale(1, .55)); },
    };
};

// no drop shadows at night
drawBoatShadow = function() {};
drawDockShadow = function() {};

// ---------------------------------------------------------------------------
// names, text, saves

const SHIP_NAMES =
{
    jetski:'Rocket Scooter', dinghy:'Escape Pod', swan:'Flying Saucer', speedboat:'Zoomer', minisub:'Stealth Pod',
    sailboat:'Solar Sailer', trawler:'Asteroid Miner', yacht:'Star Yacht', sub:'Stealth Cruiser', cruise:'Space Liner',
    container:'Cargo Hauler', island:'Asteroid', continent:'The Moon',
};
const SHIP_COLORS =
{
    dinghy:C_ORANGE, swan:C_SILVER, minisub:C_STEALTH, sub:C_SLATE, cruise:C_SILVER, continent:C_MOON,
};
for (const k in SHIP_NAMES) if (BOATS[k]) BOATS[k].name = SHIP_NAMES[k];
for (const k in SHIP_COLORS) if (BOATS[k]) BOATS[k].color = SHIP_COLORS[k];
if (BOATS.continent) BOATS.continent.deck = rgb(.83, .83, .86);

const LEVEL_NAMES = { 'Open Water':'Open Space', 'Marina':'Spaceport', 'Raft-Up':'Docking Ring', 'Continental Drift':'Moon Drift' };
for (const L of LEVELS) if (LEVEL_NAMES[L.name]) L.name = LEVEL_NAMES[L.name];

// every on-screen string goes through txt (buttons, HUD, popups, results), so the wording changes in one place
const TEXT_SWAPS =
[
    [/LAND HO!/g, 'TOUCHDOWN!'], [/\bDIVE\b/g, 'CLOAK'], [/\bSURFACE\b/g, 'UNCLOAK'],
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

// its own save, so harbor progress and space progress never mix
const SPACE_SAVE_KEY = 'cm_park-my-boat_space_save';
saveData = readSaveData(SPACE_SAVE_KEY, SAVE_DEFAULT);
persist = function() { writeSaveData(SPACE_SAVE_KEY, saveData); };

// sounds: horn -> synth chime, bonk -> metal clang, quack -> tiny "whoa!"
SOUNDS.horn  = new Sound([.7,0,660,.01,.2,.6,0,1,0,0,330,.1,0,0,0,0,.15,.6]);
SOUNDS.bonk  = new Sound([1,.05,260,0,.01,.3,0,1,0,0,0,0,0,0,63,0,0,.5,.08]);
SOUNDS.quack = new Sound([1,.1,500,.02,.08,.14,0,1,12,-1,0,0,0,0,0,0,0,.8]);

// ---------------------------------------------------------------------------
// the sky: a faint grid and stars, both in octaves 10x apart (like the harbor's ripples), so the zoom always shows

const STARS = [];
{
    let seed = 7;
    const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
    const tints = [N_WHITE, N_WHITE, N_CYAN, N_PINK, N_VIOLET];
    for (let i = 0; i < 50; i++) STARS.push({ x:rnd()*40, y:rnd()*22, r:.04 + rnd()*rnd()*.12, ph:rnd()*9, c:tints[i % tints.length], big:rnd() < .08 });
}

drawWater = function()
{
    const v = VIEW_RECT, cx = (v.x0 + v.x1)/2, cy = (v.y0 + v.y1)/2;
    for (let s = .01; s < 1e7; s *= 10)
    {
        const cell = 4*s, g = cell / WU;
        if (g < 1 || g > 40) continue;
        const col = N_VIOLET.scale(1, .13 * clamp((g - 1)/2, 0, 1) * clamp((40 - g)/25, 0, 1)), lw = .035*WU;
        for (let x = Math.floor(v.x0/cell)*cell; x < v.x1; x += cell) drawRect(vec2(x, cy), vec2(lw, v.y1 - v.y0), col);
        for (let y = Math.floor(v.y0/cell)*cell; y < v.y1; y += cell) drawRect(vec2(cx, y), vec2(v.x1 - v.x0, lw), col);
    }
    for (let s = .01; s < 1e7; s *= 10)
    {
        const g = .7*s / WU;
        if (g < .3 || g > 3) continue;
        const fade = clamp((g - .3)/.4, 0, 1) * clamp((3 - g)/1.5, 0, 1);
        const tw = 40*s, th = 22*s;
        for (let tx = Math.floor(v.x0/tw); tx*tw < v.x1; tx++)
        for (let ty = Math.floor(v.y0/th); ty*th < v.y1; ty++)
        for (const p of STARS)
        {
            const x = tx*tw + p.x*s, y = ty*th + p.y*s;
            if (x < v.x0 - s || x > v.x1 + s || y < v.y0 - s || y > v.y1 + s) continue;
            const a = fade*(.5 + .5*Math.sin(time*2 + p.ph)), c = p.c.scale(1, a);
            if (p.big)
            {
                const r = .3*s;
                drawRect(vec2(x, y), vec2(r*2, .04*s), c);
                drawRect(vec2(x, y), vec2(.04*s, r*2), c);
                drawCircle(vec2(x, y), p.r*s*5, p.c.scale(1, a*.15));
            }
            drawCircle(vec2(x, y), p.r*s, c);
        }
    }
};

// currents: solar-wind streams, glowing streaks drifting with the flow
drawCurrents = function()
{
    for (const c of currents)
    {
        const w = c.x1 - c.x0, h = c.y1 - c.y0, flow = vec2(c.dx, c.dy), spd = flow.length();
        drawRect(vec2(c.x0 + w/2, c.y0 + h/2), vec2(w, h), N_VIOLET.scale(1, .07));
        if (spd < 1e-6) continue;
        const dir = flow.scale(1/spd), across = Math.abs(dir.x) >= Math.abs(dir.y);
        const len = across ? w : h, span = across ? h : w, sgn = across ? Math.sign(dir.x) : Math.sign(dir.y);
        const segs = [], o = vec2(c.x0, c.y0);
        for (let v = 1; v < span; v += 1.6)
        for (let k = 0; k < len/4; k++)
        {
            const u = ((k*4 + (v*7.3 % 4) + time*spd*sgn) % len + len) % len, tail = Math.min(1.4, u);
            const at = q => across ? vec2(q, v) : vec2(v, q);
            segs.push([at(sgn > 0 ? u - tail : len - u + tail), at(sgn > 0 ? u : len - u)]);
        }
        if (segs.length) neonSegs(o, segs, N_CYAN.scale(1, .6), Math.min(.06*WU, .08), WU < 1);
    }
};

// wakes: thruster exhaust puffs, yellow-hot fading to pink, added light
drawWakes = function()
{
    if (!wakes.length) return;
    const o = wakes[wakes.length - 1].pos;
    drawCanvas2D(o, vec2(1), 0, false, ctx =>
    {
        ctx.globalCompositeOperation = 'lighter';
        for (const w of wakes)
        {
            const k = w.t / 1.2, col = k < .3 ? N_YELLOW.lerp(N_ORANGE, k/.3) : N_ORANGE.lerp(N_PINK, Math.min(1, (k - .3)/.5));
            ctx.fillStyle = col.scale(1, .3*(1 - k)).toString();
            ctx.beginPath();
            ctx.arc(w.pos.x - o.x, w.pos.y - o.y, w.size*(.3 + k*.9), 0, PI*2);
            ctx.fill();
        }
    });
};

// the hull-side trails: faint cyan ion trails
drawFoam = function()
{
    for (const trail of foams)
    {
        if (trail.length < 2 || !trail.some(p => inView(p.pos, p.w*4))) continue;
        let prev;
        for (const p of trail)
        {
            const k = p.t / FOAM_LIFE, hw = p.w*(1 + k*1.5)/2;
            const e = { l:p.pos.add(p.n.scale(hw)), r:p.pos.subtract(p.n.scale(hw)), a:p.a*.35*(1 - k) };
            if (prev) drawPoly([prev.l, e.l, e.r, prev.r], N_CYAN.scale(1, (prev.a + e.a)/2));
            prev = e;
        }
    }
};

// ---------------------------------------------------------------------------
// ships

// thruster flames, in toy coordinates: [x, y, width] at the stern
const JETS =
{
    jetski:[[-1.2, 0, .28]], dinghy:[[-1.1, 0, .3]], swan:[[-1.15, 0, .3]], speedboat:[[-1.7, .25, .22], [-1.7, -.25, .22]],
    minisub:[[-1.85, 0, .4]], sailboat:[[-2.5, 0, .3]], trawler:[[-1.65, .2, .22], [-1.65, -.2, .22]],
    yacht:[[-4, .75, .35], [-4, -.75, .35], [-4, 0, .4]], sub:[[-3.5, 0, .35]],
    cruise:[[-5, .3, .22], [-5, 0, .22], [-5, -.3, .22]], container:[[-5, .35, .3], [-5, -.35, .3]],
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
    if (!jets || !thr) return;
    if (thr > 0)
    {
        for (const [x, y, s] of jets)
        {
            const flick = 1.5 + .5*Math.sin(time*43 + b.id*3 + y*9), len = s*flick*(.5 + thr);
            d.flame([[x + .05, y + s/2], [x - len, y], [x + .05, y - s/2]], N_PINK);
            d.flame([[x + .05, y + s/4], [x - len*.55, y], [x + .05, y - s/4]], N_YELLOW);
        }
    }
    else
    {
        // reversing: retro thrusters puff from both sides of the nose
        const t = b.type, x = t.L/2*.5, y = t.W/2*.95, s = t.W*.2*(1 + .25*Math.sin(time*40 + b.id));
        for (const m of [1, -1]) d.circle(x, m*(y + s*.3), Math.min(s, .38), N_CYAN);
    }
}

drawBoat = function(b)
{
    const t = b.type, len = screenLen(b);
    // too small to read: a glowing dot in the ship's color
    if (len < .3)
    {
        const n = neon(b.color), r = Math.max(len*.6, .16)*WU;
        drawCircle(b.pos, r*2.6, n.scale(1, .2));
        drawCircle(b.pos, r, hot(n));
        return;
    }
    const d = painter(b);
    if (len >= .8) drawJets(b, d);
    d.poly(t.hullPts, b.color, true);
    d.poly(t.deckPts, t.deck || b.color);
    if (len < .8) return;
    (SHIP_DECO[t.key] || BOAT_DECO[t.key])(d, t, b);
    // cloaked: a shimmering cyan rim over the faded ship
    if (t.sub && b.dive > .02)
    {
        const rel = t.hullPts.map(p => d.P(p.x, p.y).subtract(b.pos)), shimmer = .45 + .35*Math.sin(time*9 + b.id);
        neonPath(b.pos, rel, true, N_CYAN.scale(1, shimmer*b.dive), Math.min(.07*WU, .06*(b.k || 1)), true, null);
    }
};

// a cloaked ship shows a pulsing beacon so you can still find it
drawPeriscope = function(b)
{
    if (b.dive < .5 || !inView(b.pos, b.radius*1.5)) return;
    const p = painter({ ...b, dive: 0 }).P(b.type.scope ?? 1.45, 0), k = b.k || 1;
    const pulse = (time*1.5 + b.id*.3) % 1;
    neonPath(p, ringPts((.25 + pulse*.8)*k), true, N_CYAN.scale(1, 1 - pulse), Math.min(.06*WU, .06*k), true, null);
    drawCircle(p, .3*k, hot(N_CYAN));
};

// the saucer is round (drawing only: its collision circles stay those of the pedalo it replaces)
if (BOATS.swan)
{
    const t = BOATS.swan;
    t.hullPts = Array.from({ length: 32 }, (_, i) => vec2(Math.cos(i/32*PI*2)*t.L/2, Math.sin(i/32*PI*2)*t.W/2));
    t.deckPts = t.hullPts.map(p => vec2(p.x*.74, p.y*.68));
}

// highlights belong to the flat style; neon tubes are their own highlight
const glint = () => {};

// Deck drawings, in the same painter as BOAT_DECO (x = bow, y = port, toy units)
const SHIP_DECO =
{
    jetski(d)       // Rocket Scooter
    {
        for (const s of [1, -1]) d.poly([[-.6, s*.36], [-1.12, s*.42], [-1.12, s*.18]], C_CORAL, true);   // tail fins
        d.poly([[1.1,0],[.75,.3],[.45,.32],[.45,-.32],[.75,-.3]], C_CREAM, true);                          // nose cowl
        d.circle(.95, 0, .16, C_SUNNY);                                                                    // headlight
        d.ellipse(-.35, 0, 1.1, .42, C_NAVY, true);                                                        // seat
        d.line(.35, .45, .35, -.45, .09, C_INK);                                                           // handlebars
        d.circle(.35, .45, .16, C_INK);
        d.circle(.35, -.45, .16, C_INK);
        d.rect(-1.12, 0, .16, .32, C_INK);                                                                 // nozzle
    },
    dinghy(d)       // Escape Pod
    {
        d.line(-.45, .42, -.45, -.42, .14, C_CREAM);                     // hazard band
        d.line(-.7, .38, -.7, -.38, .07, C_CREAM);
        d.circle(.2, 0, .74, C_INK, true);                               // hatch ring
        d.circle(.2, 0, .58, C_GLASS);                                   // porthole
        glint(d, .32, .12, .22, .1);
        d.rect(-1.02, 0, .16, .38, C_INK);                               // nozzle
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
    speedboat(d)    // Zoomer
    {
        for (const s of [1, -1]) d.poly([[.2, s*.3], [-.85, s*.74], [-1.2, s*.74], [-.95, s*.3]], C_CORAL, true);   // swept wings
        d.line(1.45, 0, .95, 0, .14, C_CORAL);                           // nose stripe
        d.poly([[.95,0],[.6,.28],[.12,.25],[.12,-.25],[.6,-.28]], C_GLASS, true);   // canopy
        glint(d, .55, .1, .25, .08);
        for (const s of [1, -1]) d.rect(-1.5, s*.25, .32, .22, C_INK);   // engines
    },
    minisub(d)      // Stealth Pod
    {
        const dark = C_STEALTH.lerp(C_INK, .35);
        for (const s of [1, -1])
        {
            d.ellipse(-.4, s*.6, 1.7, .4, dark, true);                  // side pods
            d.line(-1.2, s*.6, .3, s*.6, .07, C_GLOW);                   // light strips
        }
        d.ellipse(.65, 0, 1.3, .95, C_GLASS, true);                      // canopy
        glint(d, .85, .2, .38, .14);
        d.rect(-1.72, 0, .2, .6, C_INK);                                 // nozzle
    },
    sailboat(d)     // Solar Sailer: a diamond mirror sail on struts
    {
        for (const [x, y] of [[1.9, 0], [.2, .76], [-1.5, 0], [.2, -.76]]) d.line(.2, 0, x, y, .05, C_INK);
        d.poly([[1.9,0],[.2,.76],[-1.5,0],[.2,-.76]], C_SUNNY, true);   // sail
        d.poly([[1.3,0],[.2,.5],[-.9,0],[.2,-.5]], C_SUNNY.lerp(C_CREAM, .45));
        const g = ((time*.35) % 1)*3.4 - 1.5;                            // a glint sweeping down the mirror
        if (g > -1.2 && g < 1.6) d.line(g + .2, .3, g - .2, -.3, .1, C_CREAM.scale(1, .8));
        d.line(-1.5, 0, 1.9, 0, .05, C_INK);                             // struts
        d.line(.2, .76, .2, -.76, .05, C_INK);
        d.circle(.2, 0, .32, C_SILVER, true);                            // hub
        d.rect(-2.32, 0, .22, .42, C_INK);                               // nozzle
    },
    trawler(d)      // Asteroid Miner
    {
        for (const s of [1, -1])                                        // grabber arms
        {
            d.line(.85, s*.32, 1.3, s*.4, .08, C_INK);
            d.circle(1.32, s*.4, .14, C_SILVER, true);
        }
        d.rect(1.15, 0, .16, .52, C_INK);                                // drill mount
        d.poly([[1.75,0],[1.25,.24],[1.25,-.24]], C_SILVER, true);       // drill
        d.line(1.35, .16, 1.48, -.12, .04, C_INK);
        d.line(1.5, .1, 1.6, -.06, .04, C_INK);
        d.rect(.7, 0, .52, .66, C_CREAM, true);                          // cockpit
        d.rect(.87, 0, .13, .5, C_GLASS);
        d.rect(-.3, 0, .95, .78, C_WOOD2, true);                         // ore bin
        for (const [x, y, r] of [[-.55, .15, .32], [-.15, -.18, .36], [-.05, .2, .24], [-.6, -.2, .22]]) d.circle(x, y, r, C_SAND, true);
        d.rect(-1.2, 0, .32, .66, C_INK.lerp(C_SLATE, .5), true);        // engine block
    },
    yacht(d)        // Star Yacht
    {
        for (const s of [1, -1])
        {
            d.ellipse(-3.3, s*.75, 1.3, .42, C_TEAL, true);             // nacelles
            d.line(-2.4, s*.92, -3.5, s*.92, .12, C_CORAL);               // fin stripes
        }
        d.rect(-.5, 0, 4.6, 1.75, C_CREAM, true);                        // deck
        d.ellipse(1.6, 0, 2.4, 1.3, C_GLASS, true);                      // observation dome
        glint(d, 1.95, .3, .7, .22);
        d.circle(-1.95, 0, 1.05, C_TEAL, true);                          // star pool
        d.circle(-1.95, 0, .52, C_GLOW.lerp(C_GLASS, .5));
        d.circle(-.3, 0, .8, C_NAVY, true);                              // shuttle pad
        d.text('H', -.3, 0, .62, C_CREAM);
        d.rect(-3.85, 0, .22, .5, C_INK);
    },
    sub(d)          // Stealth Cruiser
    {
        const dark = C_SLATE.lerp(C_INK, .4);
        for (const s of [1, -1]) d.poly([[-2.7, s*.35], [-3.3, s*.8], [-3.55, s*.8], [-3.25, s*.35]], dark, true);   // tail fins
        d.poly([[2.6,0],[1.2,.28],[-2.6,.28],[-3.15,0],[-2.6,-.28],[1.2,-.28]], dark, true);   // armor spine
        for (const s of [1, -1]) d.line(-2.4, s*.36, 1.8, s*.36, .05, C_GLOW);   // light strips
        for (let i = 0; i < 5; i++) d.line(-.6 - i*.42, .22, -.6 - i*.42, -.22, .05, C_INK);   // plate seams
        d.poly([[1.75,0],[1.25,.18],[.75,0],[1.25,-.18]], C_GLASS, true);   // bridge
        d.rect(-3.4, 0, .18, .42, C_INK);
    },
    cruise(d)       // Space Liner
    {
        d.rect(-.5, 0, 7.6, 1.02, C_CREAM, true);                        // hull plating
        for (let i = 0; i < 8; i++)                                      // escape pods
        {
            d.ellipse(-3.8 + i*.95, .58, .55, .16, C_SUNNY, true);
            d.ellipse(-3.8 + i*.95, -.58, .55, .16, C_SUNNY, true);
        }
        for (let i = 0; i < 14; i++)                                     // cabin windows
        {
            d.rect(-3.9 + i*.5, .3, .26, .12, C_GLASS);
            d.rect(-3.9 + i*.5, -.3, .26, .12, C_GLASS);
        }
        d.rect(.3, 0, 3.2, .3, C_GLASS, true);                           // promenade
        d.ellipse(-2.6, 0, 1, .5, C_CORAL, true);                        // reactor
        d.circle(-2.6, 0, .26, C_GLOW);
        d.poly([[3.9,0],[3.4,.38],[3.05,.38],[3.05,-.38],[3.4,-.38]], C_GLASS, true);   // bridge
        for (const y of [.3, 0, -.3]) d.rect(-4.7, y, .32, .22, C_INK);
    },
    container(d, t, b)   // Cargo Hauler
    {
        const colors = [C_TEAL, C_SUNNY, C_LILAC, C_CORAL, C_CREAM];
        d.line(-4.3, 0, 2.9, 0, .2, C_INK);                              // spine
        for (let i = 0; i < 8; i++)
        for (let j = 0; j < 4; j++)
            d.rect(-3.4 + i*.82, -.57 + j*.38, .76, .34, colors[(i*3 + j*7 + (b ? b.id : 0)) % 5], true);
        d.poly([[4.4,0],[3.6,.42],[2.95,.45],[2.95,-.45],[3.6,-.42]], C_CREAM, true);   // cockpit
        d.poly([[4.1,0],[3.65,.26],[3.35,.26],[3.35,-.26],[3.65,-.26]], C_GLASS);
        for (const s of [1, -1])
        {
            d.rect(-4.3, s*.35, .6, .44, C_SILVER, true);               // engines
            d.rect(-4.7, s*.35, .2, .3, C_INK);
        }
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
    const d = painter(b), k = b.duckSize;
    if (b.leader) neonPath(b.pos, [vec2(), b.leader.pos.subtract(b.pos)], false, N_WHITE.scale(1, .45), Math.min(.04*WU, .05*k), false, null);
    d.rect(-.38*k, 0, .34*k, .62*k, C_SILVER, true);                   // backpack
    for (const s of [1, -1]) d.circle(.1*k, s*.38*k, .3*k, C_CREAM, true);   // arms
    d.ellipse(-.05*k, 0, .82*k, .7*k, C_CREAM, true);                    // suit
    d.circle(.22*k, 0, .6*k, C_CREAM, true);                             // helmet
    d.ellipse(.36*k, 0, .26*k, .42*k, C_SUNNY, true);                    // gold visor
    if (b.stunT > 0)
    {
        for (let i = 0; i < 3; i++)
        {
            const a = time*7 + i*PI*2/3;
            neonPath(d.P(.2*k + Math.cos(a)*.5*k, Math.sin(a)*.5*k), starPoints(vec2(), .16*k), true, N_YELLOW, .03*k, false, N_YELLOW.scale(1, .6));
        }
    }
};

// buoys -> little satellites with solar panels and a blinking light
drawBuoy = function(b)
{
    const r = .9*(1 + Math.sin(time*3 + b.id)*.03)*b.k;
    const d = painter({ pos:b.pos, angle:(b.angle || 0) + time*.25 + b.id, k:r });
    for (const m of [1, -1])
    {
        d.line(0, m*.25, 0, m*.4, .06, C_INK);                          // boom
        d.rect(0, m*.67, .42, .55, C_PANEL, true);                       // panel
        d.line(0, m*.4, 0, m*.95, .025, C_PANEL);
    }
    d.rect(0, 0, .5, .5, C_SUNNY, true);                                 // gold foil body
    d.circle(.12, .08, .26, C_CREAM, true);                              // dish
    if (Math.sin(time*5 + b.id) > .3) d.circle(-.14, -.12, .12, C_CORAL);   // blinker
};

// logs -> space junk: a snapped solar panel on a bent strut
drawLog = function(b)
{
    const d = painter(b);
    d.rect(-.4, 0, 1.4, .55, C_PANEL, true);
    for (const x of [-.85, -.4, .05]) d.line(x, .25, x, -.25, .03, C_PANEL);
    d.line(.3, 0, .75, .12, .1, C_SILVER);                               // bent strut
    d.poly([[.7, -.05], [1.2, .2], [1.08, .45], [.62, .22]], C_PANEL, true);   // broken piece
    d.circle(.3, 0, .16, C_SILVER, true);
};

// pilings -> mooring posts with a blinking light
drawPost = function(p)
{
    const c = vec2(p.x, p.y);
    neonPath(c, ringPts(p.r), true, N_CYAN, Math.min(.05*WU, p.r*.25), p.r/WU > .15, C_DECK);
    if (Math.sin(time*3 + p.x) > 0) drawCircle(c, p.r*.7, hot(N_CYAN));
};

// the real edges of a (possibly kilometers long) rect, cut to the view, as glowing lines
function neonRectEdges(r, color, w, glow)
{
    const c = clipRect(r, w*6);
    if (!c) return;
    const o = vec2(c.x0, c.y0), segs = [], S = (x0, y0, x1, y1) => segs.push([vec2(x0 - o.x, y0 - o.y), vec2(x1 - o.x, y1 - o.y)]);
    if (r.y0 >= c.y0) S(c.x0, r.y0, c.x1, r.y0);
    if (r.y1 <= c.y1) S(c.x0, r.y1, c.x1, r.y1);
    if (r.x0 >= c.x0) S(r.x0, c.y0, r.x0, c.y1);
    if (r.x1 <= c.x1) S(r.x1, c.y0, r.x1, c.y1);
    if (segs.length) neonSegs(o, segs, color, w, glow);
}

// docks -> station gantries outlined in cyan; `under` docks are lime arches a cloaked ship slips beneath; quays violet
drawDock = function(r)
{
    const w = r.x1 - r.x0, h = r.y1 - r.y0, short = Math.min(w, h);
    const c = fillRect(r, C_DECK);
    if (!c) return;
    const col = r.under ? N_LIME : r.quay ? N_VIOLET : N_CYAN;
    const lw = Math.min(.04*WU, short*.05), bay = r.quay ? short*2 : short;
    if (bay / WU > .3)
    {
        // a zigzag truss along the long side (panel seams on quays), only while it reads on screen
        const inset = short*.2, along = w > h;
        const a0 = along ? r.x0 : r.y0, c0 = along ? c.x0 : c.y0, c1 = along ? c.x1 : c.y1;
        const lo = (along ? r.y0 : r.x0) + inset, hi = (along ? r.y1 : r.x1) - inset;
        const pt = (u, v) => along ? vec2(u, v) : vec2(v, u), dim = col.scale(1, .35);
        let n = 0;
        for (let u = a0 + bay*Math.floor((c0 - a0)/bay); u < c1 && n < 400; u += bay, n++)
        {
            if (r.quay) { drawLine(pt(u, lo - inset), pt(u, hi + inset), lw, dim); continue; }
            drawLine(pt(u, lo), pt(u + bay/2, hi), lw, dim);
            drawLine(pt(u + bay/2, hi), pt(u + bay, lo), lw, dim);
        }
        if (!r.quay) { drawLine(pt(c0, lo), pt(c1, lo), lw, dim); drawLine(pt(c0, hi), pt(c1, hi), lw, dim); }
    }
    neonRectEdges(r, col, Math.min(.06*WU, short*.1), short/WU > .2);
};

// rock: glowing pink coastlines (drawn first, then the fills cover their inner half and every seam), faint contour
// lines, and crater rings in octaves 10x apart
drawLands = function()
{
    const shown = lands.filter(m => inView(m.pos, m.r)), w = .07*WU;
    for (const r of rects) if (r.land) neonRectEdges(r, N_PINK, w*2, true);
    for (const m of shown) neonPath(m.pos, m.pts.map(p => p.subtract(m.pos)), true, N_PINK, w*2, true, null);
    for (const r of rects) if (r.land) fillRect(r, C_ROCK);
    for (const m of shown) drawPoly(m.pts, C_ROCK);
    for (const m of shown) if (m.grass) drawPoly(m.grass, C_CLEAR, w*.5, N_PINK.scale(1, .3));
    drawCraters();
};

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
        const col = N_PINK.scale(1, .4 * clamp((g - 1.2)/1.2, 0, 1) * clamp((14 - g)/5, 0, 1));
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
                drawCircle(vec2(x, y), rr*2, C_CLEAR, Math.min(.05*WU, rr*.2), col);
            }
        }
    }
}

// parking burst: neon stars and tiny ringed planets fly out instead of fish and crabs
drawFish = function(pos, s, ang, color)
{
    const c = Math.cos(ang*.5), n = Math.sin(ang*.5);
    const pts = starPoints(vec2(), s*1.1).map(p => vec2(p.x*c - p.y*n, p.x*n + p.y*c));
    neonPath(pos, pts, true, neon(color), s*.18, false, neon(color).scale(1, .3));
};
drawCrab = function(pos, s, rot, t, color)
{
    const n = neon(color);
    neonPath(pos, ringPts(.75*s), true, n, s*.16, false, C_HULL);
    const cs = Math.cos(rot), sn = Math.sin(rot);
    neonPath(pos, ringPts(1.3*s, .35*s).map(p => vec2(p.x*cs - p.y*sn, p.x*sn + p.y*cs)), true, N_WHITE, s*.12, false, null);
};

// parked: a space anchor on a glowing tether
drawAnchorRope = function()
{
    drawRestRing();
    if (!anchor) return;
    const drop = Math.min(1, anchor.t*4), k = player.k, bow = bowPoint();
    drawCircle(anchor.pos, 1.2*drop*k, N_CYAN.scale(1, .15));
    drawAnchorGlyph(anchor.pos, .55*k, N_CYAN);
    neonPath(bow, [vec2(), anchor.pos.subtract(bow)], false, N_CYAN, Math.min(.06*WU, .06*k), true, null);
};

// the ship you drive in a crowded harbor: a white neon rim round its hull (under the ship, so only the outer glow shows;
// over a cloaked ship, just a thin line)
drawJamSelection = function(onTop = false)
{
    const b = player;
    if (!b) return;
    const P = painter({ ...b, dive: 0 }).P, rel = b.type.hullPts.map(p => P(p.x, p.y).subtract(b.pos));
    if (onTop) neonPath(b.pos, rel, true, N_WHITE.scale(1, .5), .06*cam.wu, false, null);
    else neonPath(b.pos, rel, true, N_WHITE, .2*cam.wu, true, null);
};

// slips: glowing dashes
drawDashedRect = function(c, w, h, color, width, dash=.5)
{
    const pts = [vec2(-w/2, -h/2), vec2(w/2, -h/2), vec2(w/2, h/2), vec2(-w/2, h/2)], segs = [];
    for (let i = 0; i < 4; i++)
    {
        const a = pts[i], b = pts[(i + 1) % 4], n = clamp(Math.round(a.distance(b)/dash), 1, 120);
        for (let k = 0; k < n; k += 2) segs.push([a.lerp(b, k/n), a.lerp(b, Math.min(1, (k + 1)/n))]);
    }
    neonSegs(c, segs, neon(color), width*.5, true);
};

// ---------------------------------------------------------------------------
// UI: dark glass panels with glowing rims

drawPanel = function(c, w, h, color, r=.5, shadow=true)
{
    neonPath(c, hullRoundRect(w/2, h/2, r, r), true, edgeColor(color), .07, true, C_UIBG.scale(1, color.a));
};

drawStar = function(c, r, filled)
{
    const pts = starPoints(vec2(), r);
    if (filled) neonPath(c, pts, true, N_YELLOW, .08, true, N_YELLOW.scale(1, .85));
    else neonPath(c, pts, true, N_DIM, .06, false, C_UIBG);
};

drawHud = function()
{
    const L = level, wide = viewHalfUi().x*2;
    drawRect(vec2(20, (PLAY_TOP + UI_SIZE.y)/2), vec2(wide, UI_SIZE.y - PLAY_TOP), C_UIBG);
    neonPath(vec2(20 - wide/2, PLAY_TOP), [vec2(), vec2(wide, 0)], false, N_CYAN, .05, true, null);
    txt(`${levelNumber()}. ${L.name}`, .8, 21.75, .7, C_INK, 'left');
    if (L.jam) return drawJamHud();
    let boat = player.type.name;
    boat += ` - ${fmtLen(boatSize(player))}`;
    if (fleet.length > 1) boat += `   ${boatIndex + 1}/${fleet.length}`;
    txt(boat, 10, 21.75, .55, C_TEAL, 'left');
    if (damages) txt(`Damages: ${fmtMoney(damages)}`, 26, 21.75, .55, C_CORAL);
    drawAirGauge();
    drawScaleBar();
};

// speech bubbles over bumped ships, as little neon signs
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
            neonPath(c, [vec2(-.15, -.4), vec2(.15, -.4), vec2(-.05, -.8)].map(q => q.scale(pop)), true, N_PINK.scale(1, a), .05, false, C_UIBG.scale(1, a));
            neonPath(c, hullRoundRect(w*pop/2, .85*pop/2, .3, .3), true, N_PINK.scale(1, a), .06, true, C_UIBG.scale(1, a));
            if (pop >= 1) txt(str, c.x, c.y - .05, .5, C_CORAL.scale(1, a));
        }
    }
};

drawScaleBar = function()
{
    const target = 5*cam.wu, p10 = Math.pow(10, Math.floor(Math.log10(target)));
    const m = [5, 2, 1].map(x => x*p10).find(x => x <= target), len = m / cam.wu;
    const x0 = 1, y = 19.7;
    neonSegs(vec2(x0, y), [[vec2(), vec2(len, 0)], [vec2(0, -.25), vec2(0, .25)], [vec2(len, -.25), vec2(len, .25)]], N_CYAN, .07, true);
    txt(fmtLen(m), x0 + len/2, y + .55, .5, C_TEAL);
};

// the cloak's power: a glowing bar with a lightning bolt
drawAirGauge = function()
{
    const b = player;
    if (!b?.type.sub) return;
    const x = 12.6, y = 1.6, w = 6.4, h = .7, low = b.o2 < .25, flash = low && Math.sin(time*14) > 0;
    drawPanel(vec2(x - .45, y), w + 1.4, h + .5, C_CREAM, .3);
    const bx = x - w/2 - .55, bolt = [[.12, .42], [-.18, -.02], [.02, -.02], [-.1, -.42], [.2, .06], [0, .06]];
    neonPath(vec2(bx, y), bolt.map(([u, v]) => vec2(u, v)), true, N_YELLOW, .04, true, N_YELLOW.scale(1, .7));
    drawRect(vec2(x, y), vec2(w, h), N_DIM.scale(1, .2));
    const fill = w*b.o2, col = flash || b.winded ? N_PINK : N_CYAN;
    if (fill > .01) neonPath(vec2(x - w/2, y), [vec2(0, -h/2), vec2(fill, -h/2), vec2(fill, h/2), vec2(0, h/2)], true, col, .04, true, col.scale(1, .55));
    drawRect(vec2(x - w/2 + w*SUB_DIVE_MIN, y), vec2(.08, h + .3), N_WHITE);
};

// title: a space liner cruises past behind a parade of little ships, a ringed planet glows in the corner
drawTitle = function()
{
    const pc = vec2(34.5, 18.2), tilt = .35, ring = ringPts(4.6, .8).map(p => vec2(p.x*Math.cos(tilt) - p.y*Math.sin(tilt), p.x*Math.sin(tilt) + p.y*Math.cos(tilt)));
    const back = ring.filter((p, i) => UNIT_RING[i][1] > 0), front = ring.filter((p, i) => UNIT_RING[i][1] <= 0);
    neonPath(pc, back, false, N_VIOLET, .08, true, null);
    neonPath(pc, ringPts(2.6), true, N_PINK, .09, true, C_HULL);
    neonPath(pc, ringPts(2.1, .5).map(p => p.add(vec2(0, .9))), false, N_PINK.scale(1, .4), .05, false, null);
    neonPath(pc, front, false, N_VIOLET, .08, true, null);
    const ship = { pos:vec2(((time*1.2) % 90) - 25, 2.6), angle:0, sx:1, sy:1, id:9, k:2.4, type:BOATS.cruise, color:BOATS.cruise.color, kind:'title' };
    drawBoat(ship);
    ['dinghy', 'swan', 'trawler', 'speedboat'].forEach((key, i) =>
    {
        const a = time*.4 + i*PI/2;
        drawBoat({ pos:vec2(20 + Math.cos(a)*15, 11 + Math.sin(a)*7.5), angle:a + PI/2, sx:1, sy:1, id:i, type:BOATS[key], color:BOATS[key].color, kind:'title' });
    });
    const bob = Math.sin(time*2)*.2, buzz = Math.sin(time*23) > .97 ? .6 : 1;   // a neon sign that flickers now and then
    for (const [line, y, size, col] of [['LOST IN', 16.6, 1.7, N_CYAN], ['PARKING SPACE', 14.3, 2.6, N_PINK]])
    {
        harborTxt(line, 20, y + bob, size, col.scale(1, .2*buzz), 'center', size*.3, col.scale(1, .12*buzz));
        harborTxt(line, 20, y + bob, size, hot(col).scale(1, buzz), 'center', .1, col);
    }
};

// ---------------------------------------------------------------------------
// type: a 5x7 arcade pixel font drawn in code (no font files), all caps, with a faint neon glow.
// It replaces the engine's drawText, so every label, button, popup and deck letter uses it.

const PIXEL_FONT =
{
    A:'01110 10001 10001 11111 10001 10001 10001', B:'11110 10001 10001 11110 10001 10001 11110',
    C:'01110 10001 10000 10000 10000 10001 01110', D:'11110 10001 10001 10001 10001 10001 11110',
    E:'11111 10000 10000 11110 10000 10000 11111', F:'11111 10000 10000 11110 10000 10000 10000',
    G:'01110 10001 10000 10111 10001 10001 01111', H:'10001 10001 10001 11111 10001 10001 10001',
    I:'01110 00100 00100 00100 00100 00100 01110', J:'00111 00010 00010 00010 00010 10010 01100',
    K:'10001 10010 10100 11000 10100 10010 10001', L:'10000 10000 10000 10000 10000 10000 11111',
    M:'10001 11011 10101 10101 10001 10001 10001', N:'10001 10001 11001 10101 10011 10001 10001',
    O:'01110 10001 10001 10001 10001 10001 01110', P:'11110 10001 10001 11110 10000 10000 10000',
    Q:'01110 10001 10001 10001 10101 10010 01101', R:'11110 10001 10001 11110 10100 10010 10001',
    S:'01111 10000 10000 01110 00001 00001 11110', T:'11111 00100 00100 00100 00100 00100 00100',
    U:'10001 10001 10001 10001 10001 10001 01110', V:'10001 10001 10001 10001 10001 01010 00100',
    W:'10001 10001 10001 10101 10101 10101 01010', X:'10001 10001 01010 00100 01010 10001 10001',
    Y:'10001 10001 10001 01010 00100 00100 00100', Z:'11111 00001 00010 00100 01000 10000 11111',
    0:'01110 10001 10011 10101 11001 10001 01110', 1:'00100 01100 00100 00100 00100 00100 01110',
    2:'01110 10001 00001 00010 00100 01000 11111', 3:'11111 00010 00100 00010 00001 10001 01110',
    4:'00010 00110 01010 10010 11111 00010 00010', 5:'11111 10000 11110 00001 00001 10001 01110',
    6:'00110 01000 10000 11110 10001 10001 01110', 7:'11111 00001 00010 00100 01000 01000 01000',
    8:'01110 10001 10001 01110 10001 10001 01110', 9:'01110 10001 10001 01111 00001 00010 01100',
    '!':'00100 00100 00100 00100 00100 00000 00100', '?':'01110 10001 00001 00010 00100 00000 00100',
    '.':'00000 00000 00000 00000 00000 01100 01100', ',':'00000 00000 00000 00000 01100 00100 01000',
    ':':'00000 01100 01100 00000 01100 01100 00000', ';':'00000 01100 01100 00000 01100 00100 01000',
    '-':'00000 00000 00000 11111 00000 00000 00000', '+':'00000 00100 00100 11111 00100 00100 00000',
    "'":'00100 00100 01000 00000 00000 00000 00000', '"':'01010 01010 00000 00000 00000 00000 00000',
    '$':'00100 01111 10100 01110 00101 11110 00100', '%':'11000 11001 00010 00100 01000 10011 00011',
    '/':'00000 00001 00010 00100 01000 10000 00000', '(':'00010 00100 01000 01000 01000 00100 00010',
    ')':'01000 00100 00010 00010 00010 00100 01000', '#':'01010 01010 11111 01010 11111 01010 01010',
    '=':'00000 00000 11111 00000 11111 00000 00000', '*':'00000 10101 01110 11111 01110 10101 00000',
    '<':'00010 00100 01000 10000 01000 00100 00010', '>':'01000 00100 00010 00001 00010 00100 01000',
    '_':'00000 00000 00000 00000 00000 00000 11111', ' ':'00000 00000 00000 00000 00000 00000 00000',
};
// each glyph as horizontal runs [row, column, length], row 0 at the top
const PIXEL_RUNS = {};
for (const ch in PIXEL_FONT)
{
    const runs = [];
    PIXEL_FONT[ch].split(' ').forEach((row, r) =>
    {
        for (let c = 0; c < 5; c++)
        {
            if (row[c] != '1') continue;
            let n = 1;
            while (row[c + n] == '1') n++;
            runs.push([r, c, n]);
            c += n - 1;
        }
    });
    PIXEL_RUNS[ch] = runs;
}
const PIXEL_ADVANCE = 6, PIXEL_CAP = .74;     // columns per letter; cap height as a share of the font size
const PIXEL_BOLD = .35;                       // every pixel grows this much right and down: chunkier arcade strokes

// same arguments as the engine's drawText (world or UI units); font and style are ignored
drawText = function(text, pos, size=1, color=WHITE, lineWidth=0, lineColor=BLACK, textAlign='center', font, fontStyle, maxWidth, angle=0)
{
    const lines = String(text).toUpperCase().split('\n'), px = size*PIXEL_CAP/7;
    drawCanvas2D(pos, vec2(1), angle, false, ctx =>
    {
        ctx.beginPath();
        lines.forEach((line, li) =>
        {
            const w = (line.length*PIXEL_ADVANCE - 1 + PIXEL_BOLD)*px;
            const x0 = textAlign == 'left' ? 0 : textAlign == 'right' ? -w : -w/2;
            const y0 = (3.5 + PIXEL_BOLD/2)*px - (li - (lines.length - 1)/2)*size;          // centered on pos, like the engine
            for (let i = 0; i < line.length; i++)
            {
                const runs = PIXEL_RUNS[line[i]] || PIXEL_RUNS['?'];
                for (const [r, c, n] of runs) ctx.rect(x0 + (i*PIXEL_ADVANCE + c)*px, y0 - (r + 1 + PIXEL_BOLD)*px, (n + PIXEL_BOLD)*px, (1 + PIXEL_BOLD)*px);
            }
        });
        ctx.lineJoin = 'miter';
        if (lineWidth && lineColor.a > 0) { ctx.strokeStyle = lineColor.toString(); ctx.lineWidth = lineWidth; ctx.stroke(); }
        if (color.a > .05)
        {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = color.scale(1, .2).toString();
            ctx.lineWidth = px*1.3;
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.fillStyle = color.toString();
        ctx.fill();
    });
};
