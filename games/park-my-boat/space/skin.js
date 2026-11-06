'use strict';
// Lost in Parking Space: the secret space skin. Loaded after src/main.js by space/index.html only, so the
// harbor build never sees it. Pure visual reskin: physics, levels, sizes and handling are untouched. It only
// repaints (shared colors changed in place, drawing functions and boat decks replaced), renames, and swaps a
// few sounds. Every game fix and new level in the harbor build shows up here for free.
// Keep collision shapes alone: anything drawn past a hull is decoration only.

// ---------------------------------------------------------------------------
// palette: the shared colors are objects, so changing them here changes them everywhere they are used

function setColor(c, r, g, b, a=c.a) { c.r = r; c.g = g; c.b = b; c.a = a; }
setColor(C_WATER,  .09, .10, .20);       // #171A33 deep space
setColor(C_WATER2, .33, .37, .62);       // periwinkle: sparks, highlights, bonus cards
setColor(C_SAND,   .55, .48, .52);       // asteroid rock
setColor(C_GRASS,  .67, .62, .64);       // regolith
setColor(C_WOOD,   .72, .76, .84);       // station steel
setColor(C_WOOD2,  .48, .53, .65);       // dark steel
setColor(C_STONE,  .60, .64, .73);       // heavy station plating
setColor(C_SHADOW, .02, .02, .07, .38);  // shadows read on a dark sky

const C_SILVER = rgb(.80, .82, .90);
const C_GLASS  = rgb(.45, .80, .96);
const C_GLOW   = rgb(.45, 1, .92);       // cloak shimmer, light strips
const C_STEALTH= rgb(.42, .40, .60);
const C_SLATE  = rgb(.38, .39, .55);
const C_PANEL  = rgb(.24, .42, .78);     // solar panels
const C_FLAME  = rgb(1, .55, .2);
const C_MOON   = rgb(.72, .72, .76);
const C_LILAC  = rgb(.70, .62, .92);

MOORED_COLORS[2] = C_LILAC;              // navy hulls vanish against space
setCanvasClearColor(C_WATER);            // gameInit may already have copied the harbor color

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
txt = function(str, ...rest) { return harborTxt(spaceText(str), ...rest); };

// its own save, so harbor progress and space progress never mix
const SPACE_SAVE_KEY = 'cm_park-my-boat_space_save';
saveData = readSaveData(SPACE_SAVE_KEY, SAVE_DEFAULT);
persist = function() { writeSaveData(SPACE_SAVE_KEY, saveData); };

// sounds: horn -> synth chime, bonk -> metal clang, quack -> tiny "whoa!"
SOUNDS.horn  = new Sound([.7,0,660,.01,.2,.6,0,1,0,0,330,.1,0,0,0,0,.15,.6]);
SOUNDS.bonk  = new Sound([1,.05,260,0,.01,.3,0,1,0,0,0,0,0,0,63,0,0,.5,.08]);
SOUNDS.quack = new Sound([1,.1,500,.02,.08,.14,0,1,12,-1,0,0,0,0,0,0,0,.8]);

// ---------------------------------------------------------------------------
// the sky: stars in octaves 10x apart (like the harbor's ripples), so space keeps its texture at every zoom

const STARS = [];
{
    let seed = 7;
    const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) STARS.push({ x:rnd()*40, y:rnd()*22, r:.05 + rnd()*rnd()*.16, ph:rnd()*9, big:rnd() < .08 });
}

drawWater = function()
{
    const v = VIEW_RECT;
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
            const tw8 = .55 + .45*Math.sin(time*2 + p.ph), c = C_CREAM.scale(1, fade*tw8);
            if (p.big)
            {
                const r = (.22 + .08*tw8)*s;
                drawLine(vec2(x - r, y), vec2(x + r, y), .05*s, c);
                drawLine(vec2(x, y - r), vec2(x, y + r), .05*s, c);
            }
            drawCircle(vec2(x, y), p.r*s, c);
        }
    }
};

// currents: glowing solar-wind streams, streaks drifting with the flow
drawCurrents = function()
{
    for (const c of currents)
    {
        const w = c.x1 - c.x0, h = c.y1 - c.y0, flow = vec2(c.dx, c.dy), spd = flow.length();
        drawRect(vec2(c.x0 + w/2, c.y0 + h/2), vec2(w, h), C_LILAC.scale(1, .16));
        if (spd < 1e-6) continue;
        const dir = flow.scale(1/spd), across = Math.abs(dir.x) >= Math.abs(dir.y);
        const len = across ? w : h, span = across ? h : w, sgn = across ? Math.sign(dir.x) : Math.sign(dir.y);
        for (let v = 1; v < span; v += 1.6)
        for (let k = 0; k < len/4; k++)
        {
            const u = ((k*4 + (v*7.3 % 4) + time*spd*sgn) % len + len) % len, tail = Math.min(1.4, u);
            const at = q => across ? vec2(c.x0 + q, c.y0 + v) : vec2(c.x0 + v, c.y0 + q);
            const head = at(sgn > 0 ? u : len - u), back = at(sgn > 0 ? u - tail : len - u + tail);
            drawLine(back, head, .1, C_GLOW.scale(1, .35));
            drawCircle(head, .16, C_CREAM.scale(1, .55));
        }
    }
};

// wakes: thruster exhaust puffs, hot then smoky
drawWakes = function()
{
    for (const w of wakes)
    {
        const k = w.t / 1.2, color = k < .25 ? C_SUNNY.lerp(C_FLAME, k*4) : C_FLAME.lerp(C_WATER2, Math.min(1, (k - .25)*2));
        drawCircle(w.pos, w.size*(.5 + k*1.6), color.scale(1, .45*(1 - k)));
    }
};

// the hull-side trails: faint ion trails instead of foam
drawFoam = function()
{
    for (const trail of foams)
    {
        if (trail.length < 2 || !trail.some(p => inView(p.pos, p.w*4))) continue;
        for (const [wide, alpha] of [[2.4, .2], [1, .55]])
        {
            let prev;
            for (const p of trail)
            {
                const k = p.t / FOAM_LIFE, hw = p.w*wide*(1 + k*1.5)/2;
                const e = { l:p.pos.add(p.n.scale(hw)), r:p.pos.subtract(p.n.scale(hw)), a:p.a*alpha*(1 - k) };
                if (prev) drawPoly([prev.l, e.l, e.r, prev.r], C_GLASS.scale(1, (prev.a + e.a)/2));
                prev = e;
            }
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
            d.poly([[x + .05, y + s/2], [x - len, y], [x + .05, y - s/2]], C_FLAME);
            d.poly([[x + .05, y + s/4], [x - len*.55, y], [x + .05, y - s/4]], C_SUNNY);
        }
    }
    else
    {
        // reversing: retro thrusters puff from both sides of the nose
        const t = b.type, x = t.L/2*.5, y = t.W/2*.95, s = t.W*.22*(1 + .25*Math.sin(time*40 + b.id));
        for (const m of [1, -1]) d.circle(x, m*(y + s*.3), s, C_CREAM.scale(1, .8));
    }
}

drawBoat = function(b)
{
    const t = b.type, len = screenLen(b);
    // too small to read: a dot in the ship's color
    if (len < .3)
    {
        drawCircle(b.pos, Math.max(len*.6, .16)*WU, b.color, .05*WU, C_INK);
        return;
    }
    const d = painter(b);
    if (len >= .8) drawJets(b, d);
    d.poly(t.hullPts, b.color, true);
    d.poly(t.deckPts, t.deck || b.color.lerp(C_CREAM, .45));
    if (len < .8) return;
    (SHIP_DECO[t.key] || BOAT_DECO[t.key])(d, t, b);
    // cloaked: the ship fades into space under a shimmering outline
    if (t.sub && b.dive > .02)
    {
        const pts = t.hullPts.map(p => d.P(p.x, p.y)), film = C_WATER.scale(1, .7*b.dive);
        drawPoly(pts, film, 0);
        for (const part of t.film || []) drawPoly(part.map(p => d.P(p[0], p[1])), film, 0);
        const glint = .45 + .35*Math.sin(time*9 + b.id);
        drawPoly(pts, C_CLEAR, Math.min(LINE_W*.7, .07*(b.k || 1)), C_GLOW.scale(1, glint*b.dive));
    }
};

// a cloaked ship shows a pulsing beacon so you can still find it
drawPeriscope = function(b)
{
    if (b.dive < .5 || !inView(b.pos, b.radius*1.5)) return;
    const d = painter({ ...b, dive: 0 }), p = d.P(b.type.scope ?? 1.45, 0), k = b.k || 1;
    const pulse = (time*1.5 + b.id*.3) % 1;
    drawCircle(p, (.5 + pulse*1.6)*k, C_CLEAR, Math.min(LINE_W, .1*k)*(1 - pulse), C_GLOW.scale(1, 1 - pulse));
    drawCircle(p, .38*k, C_GLOW, Math.min(LINE_W, .08*k), C_INK);
};

// the saucer is round (drawing only: its collision circles stay those of the pedalo it replaces)
if (BOATS.swan)
{
    const t = BOATS.swan;
    t.hullPts = Array.from({ length: 32 }, (_, i) => vec2(Math.cos(i/32*PI*2)*t.L/2, Math.sin(i/32*PI*2)*t.W/2));
    t.deckPts = t.hullPts.map(p => vec2(p.x*.74, p.y*.68));
}
// the stealth cruiser's tail fins stick out past the hull, so the cloak film covers them too
if (BOATS.sub) BOATS.sub.film = [1, -1].map(s => [[-2.7, s*.35], [-3.3, s*.8], [-3.55, s*.8], [-3.25, s*.35]]);

const glint = (d, x, y, w, h) => d.ellipse(x, y, w, h, C_CREAM.scale(1, .8));

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

// ducks -> tiny astronauts: mom leads, the kids follow on a tether, a hit sends them tumbling
drawDuck = function(b)
{
    const d = painter(b), k = b.duckSize, o = shadowOff(.6*k);
    if (b.leader) drawLine(b.pos, b.leader.pos, Math.min(.05*WU, .06*k), C_SILVER.scale(1, .7));   // tether
    painter(b, o.x, o.y).ellipse(0, 0, 1.1*k, .9*k, C_SHADOW);
    d.rect(-.38*k, 0, .34*k, .62*k, C_SILVER.lerp(C_INK, .25), true);   // backpack
    for (const s of [1, -1]) d.circle(.1*k, s*.38*k, .3*k, C_CREAM, true);   // arms
    d.ellipse(-.05*k, 0, .82*k, .7*k, C_CREAM, true);                    // suit
    d.circle(.22*k, 0, .6*k, C_CREAM, true);                             // helmet
    d.ellipse(.36*k, 0, .26*k, .42*k, C_SUNNY, true);                    // gold visor
    if (b.stunT > 0)
    {
        // seeing stars
        for (let i = 0; i < 3; i++)
        {
            const a = time*7 + i*PI*2/3, c = d.P(.2*k + Math.cos(a)*.5*k, Math.sin(a)*.5*k);
            drawPoly(starPoints(c, .16*k), C_SUNNY, Math.min(LINE_W, .03*k), C_INK);
        }
    }
    else glint(d, .4*k, .1*k, .1*k, .14*k);
};

// buoys -> little satellites with solar panels and a blinking light
drawBuoy = function(b)
{
    const r = .9*(1 + Math.sin(time*3 + b.id)*.03)*b.k;
    const s = { pos:b.pos, angle:(b.angle || 0) + time*.25 + b.id, k:r }, d = painter(s);
    const o = shadowOff(r);
    painter(s, o.x, o.y).rect(0, 0, .5, 1.9, C_SHADOW);
    for (const m of [1, -1])
    {
        d.line(0, m*.25, 0, m*.4, .06, C_INK);                          // boom
        d.rect(0, m*.67, .42, .55, C_PANEL, true);                       // panel
        d.line(0, m*.4, 0, m*.95, .025, C_INK.scale(1, .5));
    }
    d.rect(0, 0, .5, .5, C_SUNNY, true);                                 // gold foil body
    d.circle(.12, .08, .26, C_CREAM, true);                              // dish
    if (Math.sin(time*5 + b.id) > .3) d.circle(-.14, -.12, .12, C_CORAL);   // blinker
};

// logs -> space junk: a snapped solar panel on a bent strut
drawLog = function(b)
{
    const d = painter(b), o = shadowOff(.55);
    painter(b, o.x, o.y).poly(hullRoundRect(1.2, .275, .1, .1), C_SHADOW);
    d.rect(-.4, 0, 1.4, .55, C_PANEL, true);
    for (const x of [-.85, -.4, .05]) d.line(x, .25, x, -.25, .03, C_INK.scale(1, .5));
    d.line(.3, 0, .75, .12, .1, C_WOOD2);                                // bent strut
    d.poly([[.7, -.05], [1.2, .2], [1.08, .45], [.62, .22]], C_PANEL.lerp(C_INK, .2), true);   // broken piece
    d.circle(.3, 0, .16, C_SILVER, true);
};

// pilings -> mooring posts with a light
drawPost = function(p)
{
    const c = vec2(p.x, p.y);
    drawCircle(c.add(shadowOff(p.r*2)), p.r*2, C_SHADOW);
    drawCircle(c, p.r*2, C_WOOD2, Math.min(LINE_W, p.r*.3), C_INK);
    drawCircle(c, p.r*.8, Math.sin(time*3 + p.x) > 0 ? C_GLOW : C_WOOD, 0);
};

// docks -> station gantries: steel trusses; `under` docks are open arches a cloaked ship slips beneath
drawDock = function(r)
{
    const w = r.x1 - r.x0, h = r.y1 - r.y0, short = Math.min(w, h);
    const c = fillRect(r, r.under ? C_WOOD2 : r.quay ? C_STONE : C_WOOD);
    if (!c) return;
    const lw = Math.min(.05*WU, short*.05), bay = r.quay ? short*2 : short;
    if (bay / WU > .3)
    {
        // a zigzag truss along the long side (panel seams on quays), only while it reads on screen
        const inset = short*.18, along = w > h;
        const a0 = along ? r.x0 : r.y0, c0 = along ? c.x0 : c.y0, c1 = along ? c.x1 : c.y1;
        const lo = (along ? r.y0 : r.x0) + inset, hi = (along ? r.y1 : r.x1) - inset;
        const pt = (u, v) => along ? vec2(u, v) : vec2(v, u);
        const col = r.quay ? C_WOOD2 : C_WOOD2.lerp(C_INK, .2);
        let n = 0;
        for (let u = a0 + bay*Math.floor((c0 - a0)/bay); u < c1 && n < 400; u += bay, n++)
        {
            if (r.quay) { drawLine(pt(u, lo - inset), pt(u, hi + inset), lw, col); continue; }
            drawLine(pt(u, lo), pt(u + bay/2, hi), lw, col);
            drawLine(pt(u + bay/2, hi), pt(u + bay, lo), lw, col);
        }
        if (!r.quay) { drawLine(pt(c0, lo), pt(c1, lo), lw, col); drawLine(pt(c0, hi), pt(c1, hi), lw, col); }
    }
    outlineRect(r, Math.min(LINE_W, short*.2), C_INK);
    if (r.under)
    {
        // arches: cross beams with a glowing edge
        const glw = Math.min(.06*WU, short*.08), inset = short*.12;
        if (w > h) { drawLine(vec2(r.x0, r.y0 + inset), vec2(r.x1, r.y0 + inset), glw, C_GLOW); drawLine(vec2(r.x0, r.y1 - inset), vec2(r.x1, r.y1 - inset), glw, C_GLOW); }
        else       { drawLine(vec2(r.x0 + inset, r.y0), vec2(r.x0 + inset, r.y1), glw, C_GLOW); drawLine(vec2(r.x1 - inset, r.y0), vec2(r.x1 - inset, r.y1), glw, C_GLOW); }
    }
};

// rock: craters in octaves 10x apart over every sand rect and landmass
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
    const pit = C_SAND.lerp(C_INK, .3), rim = C_SAND.lerp(C_CREAM, .3);
    let budget = 600;
    for (let s = .1, o = 0; s < 1e7; s *= 10, o++)
    {
        const g = s / WU;
        if (g < 1.2 || g > 14) continue;
        const a = clamp((g - 1.2)/1.2, 0, 1) * clamp((14 - g)/5, 0, 1);
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
                drawCircle(vec2(x + rr*.08, y - rr*.08), rr*2, rim.scale(1, a));
                drawCircle(vec2(x, y), rr*1.75, pit.scale(1, a));
            }
        }
    }
}
const harborDrawLands = drawLands;
drawLands = function() { harborDrawLands(); drawCraters(); };

// parking burst: stars and tiny ringed planets fly out instead of fish and crabs
drawFish = function(pos, s, ang, color)
{
    const pts = starPoints(pos, s*1.1), c = Math.cos(ang*.5), n = Math.sin(ang*.5);
    drawPoly(pts.map(p => vec2(pos.x + (p.x - pos.x)*c - (p.y - pos.y)*n, pos.y + (p.x - pos.x)*n + (p.y - pos.y)*c)), color, .1*s, C_INK);
};
drawCrab = function(pos, s, rot, t, color)
{
    drawCircle(pos, 1.5*s, color, .1*s, C_INK);
    drawEllipse(pos, vec2(2.6*s, .7*s), C_CLEAR, -rot, .14*s, C_CREAM);
};

// parked: a space anchor on a glowing tether
drawAnchorRope = function()
{
    drawRestRing();
    if (!anchor) return;
    const drop = Math.min(1, anchor.t*4), k = player.k;
    drawCircle(anchor.pos, 1.2*drop*k, C_GLOW.scale(1, .25));
    drawAnchorGlyph(anchor.pos, .55*k, C_CREAM.scale(1, .8));
    drawLine(bowPoint(), anchor.pos, Math.min(.08*WU, .08*k), C_GLOW.scale(1, .8));
};

// ---------------------------------------------------------------------------
// UI on a dark sky

drawScaleBar = function()
{
    const target = 5*cam.wu, p10 = Math.pow(10, Math.floor(Math.log10(target)));
    const m = [5, 2, 1].map(x => x*p10).find(x => x <= target), len = m / cam.wu;
    const x0 = 1, y = 19.7;
    drawLine(vec2(x0, y), vec2(x0 + len, y), .14, C_CREAM);
    drawLine(vec2(x0, y - .25), vec2(x0, y + .25), .14, C_CREAM);
    drawLine(vec2(x0 + len, y - .25), vec2(x0 + len, y + .25), .14, C_CREAM);
    txt(fmtLen(m), x0 + len/2, y + .55, .5, C_CREAM, 'center', .08, C_INK);
};

// the cloak's power: the air bar, with a lightning bolt
drawAirGauge = function()
{
    const b = player;
    if (!b?.type.sub) return;
    const x = 12.6, y = 1.6, w = 6.4, h = .7, low = b.o2 < .25, flash = low && Math.sin(time*14) > 0;
    drawPanel(vec2(x - .45, y), w + 1.4, h + .5, C_CREAM, .3, false);
    const bx = x - w/2 - .55, bolt = [[.12, .42], [-.18, -.02], [.02, -.02], [-.1, -.42], [.2, .06], [0, .06]];
    drawPoly(bolt.map(([u, v]) => vec2(bx + u, y + v)), C_SUNNY, .06, C_INK);
    drawRect(vec2(x, y), vec2(w, h), C_INK.scale(1, .15));
    const fill = w*b.o2;
    if (fill > .01) drawRect(vec2(x - w/2 + fill/2, y), vec2(fill, h), flash || b.winded ? C_CORAL : C_GLOW.lerp(C_TEAL, .4));
    drawRect(vec2(x - w/2 + w*SUB_DIVE_MIN, y), vec2(.08, h + .3), C_INK);
};

// title: a space liner cruises past behind a parade of little ships, with a ringed planet in the corner
drawTitle = function()
{
    const pc = vec2(34.5, 18.2);
    drawCircle(pc, 5.2, C_CORAL.lerp(C_SUNNY, .35), LINE_W, C_INK);
    drawEllipse(pc.add(vec2(.5, .6)), vec2(1.6, .9), C_CORAL.lerp(C_INK, .1));
    drawEllipse(pc, vec2(9, 1.6), C_CLEAR, -.35, .3, C_CREAM);
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
    for (const [line, y, size] of [['LOST IN', 16.6, 1.7], ['PARKING SPACE', 14.3, 2.6]])
    {
        harborTxt(line, 20.2, y - .3 + bob, size, C_INK);
        harborTxt(line, 20, y + bob, size, C_SUNNY, 'center', .22, C_INK);
    }
};
