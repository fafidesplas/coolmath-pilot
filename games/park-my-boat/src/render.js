'use strict';
// Toybox Flat drawing: flat fills, thick ink outlines, soft drop shadows.

// Sizes that should look the same on screen at any zoom are in UI units (the 40 x 22.5 view).
// WU is world units per UI unit; main.js sets it (and LINE_W) before drawing the world or the UI.
let WU = 1, LINE_W = .1;
const SHADOW_OFF = vec2(.18, -.24);
const FONT_STYLE = 'bold';
const C_CLEAR = rgb(0, 0, 0, 0);

// shadow offset for something of world size `size`: constant on screen, but never bigger than the thing
function shadowOff(size) { return SHADOW_OFF.scale(Math.min(WU, size)); }

// Paints in a body's local space (x = bow, y = port) at the body's scale k, following its squash
function painter(b, ox=0, oy=0)
{
    const k = b.k || 1, c = Math.cos(b.angle), s = Math.sin(b.angle), sx = (b.sx || 1)*k, sy = (b.sy || 1)*k;
    const px = b.pos.x + ox, py = b.pos.y + oy, ang = -b.angle;
    const P = (x, y) => vec2(px + x*sx*c - y*sy*s, py + x*sx*s + y*sy*c);
    const lw = outline => outline ? Math.min(LINE_W, .1*k) : 0;
    // a submerged submarine keeps its solid colors, a little cooler; drawBoat lays a film of water over it
    const g = b.dive || 0, tc = c => g > .02 && c ? c.lerp(C_TEAL, .3*g) : c, ink = tc(C_INK);
    return {
        P,
        circle(x, y, d, color, outline) { drawCircle(P(x, y), d*sx, tc(color), lw(outline), ink); },
        ellipse(x, y, w, h, color, outline) { drawEllipse(P(x, y), vec2(w*sx, h*sy), tc(color), ang, lw(outline), ink); },
        poly(pts, color, outline) { drawPoly(pts.map(p => p.x === undefined ? P(p[0], p[1]) : P(p.x, p.y)), tc(color || C_CLEAR), lw(outline), ink); },
        rect(cx, cy, w, h, color, outline) { this.poly([[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]], color, outline); },
        line(x1, y1, x2, y2, w, color) { drawLine(P(x1, y1), P(x2, y2), w*k, tc(color)); },
        text(str, x, y, size, color) { drawText(str, P(x, y), size*k, tc(color), 0, ink, 'center', fontDefault, FONT_STYLE); },
    };
}

// on-screen length of a boat in UI units
function screenLen(b) { return b.type.L * (b.k || 1) / WU; }

function txt(str, x, y, size, color=C_INK, align='center', outline=0, outlineColor=C_INK)
{
    drawText(str, vec2(x, y), size, color, outline, outlineColor, align, fontDefault, FONT_STYLE);
}

function drawBoatShadow(b)
{
    if (screenLen(b) < .3 || b.under) return;
    const o = shadowOff(b.type.W * (b.k || 1));
    painter(b, o.x, o.y).poly(b.type.hullPts, C_SHADOW);
}

function drawBoat(b)
{
    const t = b.type, len = screenLen(b);
    // too small to read: a dot in the boat's color, so a parked rowboat stays visible next to a cruise ship
    if (len < .3)
    {
        drawCircle(b.pos, Math.max(len*.6, .16)*WU, b.color, .05*WU, C_INK);
        return;
    }
    const d = painter(b);
    d.poly(t.hullPts, b.color, true);
    d.poly(t.deckPts, t.deck || b.color.lerp(C_CREAM, .45));
    if (len < .8) return;
    BOAT_DECO[t.key](d, t, b);
    if (!t.blob && !t.sub && (b.kind == 'player' || b.kind == 'moored' || b.kind == 'traffic'))
        drawCaptain(d, t.captainX, b, Math.min(1, 2.5 / (b.k || 1)));
    // submerged: a semi-transparent film of water over the whole hull, with a faint ripple line round it
    if (t.sub && b.dive > .02)
    {
        const pts = t.hullPts.map(p => d.P(p.x, p.y));
        drawPoly(pts, C_WATER.lerp(C_TEAL, .25).scale(1, .62*b.dive), 0);
        drawPoly(pts, C_CLEAR, Math.min(LINE_W*.5, .05*(b.k || 1)), C_WATER2.scale(1, .7*b.dive));
    }
}

// Captain seen from above: cap, plus eyes looking toward the bow (wide when bonked).
// s shrinks the captain on big ships so they stay person-sized.
function drawCaptain(d, x, b, s=1)
{
    const hurt = b.hurtT > 0;
    d.circle(x, 0, .62*s, C_SKIN, true);
    d.circle(x - .08*s, 0, .42*s, b.kind == 'player' ? C_CREAM : C_NAVY, true);
    d.line(x + .14*s, .2*s, x + .14*s, -.2*s, .1*s, C_INK);       // cap brim
    const e = (hurt ? .17 : .1)*s;
    d.circle(x + .26*s, .13*s, e, hurt ? C_CREAM : C_INK, hurt);
    d.circle(x + .26*s, -.13*s, e, hurt ? C_CREAM : C_INK, hurt);
}

function drawDuck(b)
{
    const d = painter(b), k = b.duckSize;
    const o = shadowOff(.6*k);
    painter(b, o.x, o.y).ellipse(0, 0, 1.1*k, .8*k, C_SHADOW);
    d.ellipse(0, 0, 1.1*k, .8*k, C_SUNNY, true);
    d.poly([[-.55*k,.18*k],[-.8*k,0],[-.55*k,-.18*k]], C_SUNNY, true);    // tail
    d.circle(.42*k, 0, .55*k, C_SUNNY, true);                               // head
    d.poly([[.62*k,.12*k],[.92*k,0],[.62*k,-.12*k]], C_CORAL, true);       // beak
    if (b.stunT > 0)
    {
        // dizzy X eyes
        for (const s of [1, -1])
        {
            d.line(.4*k, (s*.15-.05)*k, .5*k, (s*.15+.05)*k, .05, C_INK);
            d.line(.4*k, (s*.15+.05)*k, .5*k, (s*.15-.05)*k, .05, C_INK);
        }
    }
    else
    {
        d.circle(.5*k, .14*k, .1*k, C_INK);
        d.circle(.5*k, -.14*k, .1*k, C_INK);
    }
}

function drawBuoy(b)
{
    const bob = 1 + Math.sin(time*3 + b.id)*.05, r = .9*bob*b.k, lw = Math.min(LINE_W, .1*b.k);
    drawCircle(b.pos.add(shadowOff(r)), r, C_SHADOW);
    drawCircle(b.pos, r, C_CORAL, lw, C_INK);
    drawCircle(b.pos, r*.62, C_CREAM, lw, C_INK);
    drawCircle(b.pos, r*.28, C_CORAL, lw, C_INK);
}

function drawLog(b)
{
    const d = painter(b), l = 1.2, w = .55, o = shadowOff(w);
    painter(b, o.x, o.y).poly(hullRoundRect(l, w/2, w/2, w/2), C_SHADOW);
    d.poly(hullRoundRect(l, w/2, w/2, w/2), C_WOOD2, true);
    d.line(-.6, .08, .5, .08, .06, C_INK.scale(1, .3));
    d.ellipse(l - w/2, 0, w*.7, w*.8, C_WOOD, true);
}

// Rects can be kilometers wide while the camera looks at a rowboat, so they are cut to the
// view (VIEW_RECT, set by main.js) before drawing; outlines are drawn only on the real edges.
let VIEW_RECT = { x0:-1e9, y0:-1e9, x1:1e9, y1:1e9 };

function clipRect(r, grow=0)
{
    const v = VIEW_RECT;
    const x0 = Math.max(r.x0, v.x0 - grow), y0 = Math.max(r.y0, v.y0 - grow);
    const x1 = Math.min(r.x1, v.x1 + grow), y1 = Math.min(r.y1, v.y1 + grow);
    if (x0 >= x1 || y0 >= y1) return;
    return { x0, y0, x1, y1 };
}

// offset shifts the rect, grow pads it on every side
function fillRect(r, color, offset, grow=0)
{
    const o = offset || vec2();
    const c = clipRect({ x0:r.x0 + o.x - grow, y0:r.y0 + o.y - grow, x1:r.x1 + o.x + grow, y1:r.y1 + o.y + grow });
    if (c) drawRect(vec2((c.x0 + c.x1)/2, (c.y0 + c.y1)/2), vec2(c.x1 - c.x0, c.y1 - c.y0), color);
    return c;
}

function outlineRect(r, width, color)
{
    const c = clipRect(r, width);
    if (!c) return;
    if (r.y0 >= c.y0) drawLine(vec2(c.x0, r.y0), vec2(c.x1, r.y0), width, color);
    if (r.y1 <= c.y1) drawLine(vec2(c.x0, r.y1), vec2(c.x1, r.y1), width, color);
    if (r.x0 >= c.x0) drawLine(vec2(r.x0, c.y0), vec2(r.x0, c.y1), width, color);
    if (r.x1 <= c.x1) drawLine(vec2(r.x1, c.y0), vec2(r.x1, c.y1), width, color);
}

function drawDock(r)
{
    const w = r.x1 - r.x0, h = r.y1 - r.y0, plank = r.plank || .7;
    const c = fillRect(r, r.under ? C_WOOD2.lerp(C_CREAM, .3) : r.quay ? C_STONE : C_WOOD);
    if (!c) return;
    // planks run across the long side, only while they are far enough apart to see
    if (!r.quay && plank / WU > .15)
    {
        if (w > h) for (let x = r.x0 + plank*Math.ceil((c.x0 - r.x0)/plank + 1e-6); x < c.x1; x += plank) drawLine(vec2(x, r.y0), vec2(x, r.y1), Math.min(.05*WU, plank*.08), C_WOOD2);
        else       for (let y = r.y0 + plank*Math.ceil((c.y0 - r.y0)/plank + 1e-6); y < c.y1; y += plank) drawLine(vec2(r.x0, y), vec2(r.x1, y), Math.min(.05*WU, plank*.08), C_WOOD2);
    }
    outlineRect(r, Math.min(LINE_W, Math.min(w, h)*.2), C_INK);
    // a pier a submarine can pass under: two rails along its long sides, like a bridge
    if (r.under)
    {
        const inset = Math.min(w, h)*.18, lw = Math.min(.06*WU, Math.min(w, h)*.08);
        if (w > h) { drawLine(vec2(r.x0, r.y0 + inset), vec2(r.x1, r.y0 + inset), lw, C_INK); drawLine(vec2(r.x0, r.y1 - inset), vec2(r.x1, r.y1 - inset), lw, C_INK); }
        else       { drawLine(vec2(r.x0 + inset, r.y0), vec2(r.x0 + inset, r.y1), lw, C_INK); drawLine(vec2(r.x1 - inset, r.y0), vec2(r.x1 - inset, r.y1), lw, C_INK); }
    }
}

function drawDockShadow(r)
{
    fillRect(r, C_SHADOW, shadowOff(Math.min(r.x1 - r.x0, r.y1 - r.y0)));
}

function drawPost(p)
{
    drawCircle(vec2(p.x, p.y).add(shadowOff(p.r*2)), p.r*2, C_SHADOW);
    drawCircle(vec2(p.x, p.y), p.r*2, C_WOOD2, Math.min(LINE_W, p.r*.3), C_INK);
    drawCircle(vec2(p.x, p.y), p.r, C_WOOD, 0);
}

function drawDashedRect(c, w, h, color, width, dash=.5)
{
    const pts = [vec2(c.x-w/2,c.y-h/2), vec2(c.x+w/2,c.y-h/2), vec2(c.x+w/2,c.y+h/2), vec2(c.x-w/2,c.y+h/2)];
    for (let i = 0; i < 4; i++)
    {
        const a = pts[i], b = pts[(i+1)%4], len = a.distance(b), n = clamp(Math.round(len/dash), 1, 120);
        for (let k = 0; k < n; k += 2)
            drawLine(a.lerp(b, k/n), a.lerp(b, Math.min(1, (k+1)/n)), width, color);
    }
}

function drawAnchorGlyph(pos, s, color, rot=0)
{
    const cs = Math.cos(rot), sn = Math.sin(rot), at = (x, y) => vec2(pos.x + (x*cs - y*sn)*s, pos.y + (x*sn + y*cs)*s);
    const L = (x1, y1, x2, y2) => drawLine(at(x1, y1), at(x2, y2), .13*s, color);
    drawCircle(at(0, .5), .3*s, C_CLEAR, .12*s, color);
    L(0, .35, 0, -.55);
    L(-.28, .2, .28, .2);
    L(-.48, -.12, -.3, -.42); L(-.3, -.42, 0, -.55); L(0, -.55, .3, -.42); L(.3, -.42, .48, -.12);
}

// a little fish seen from the side, nose toward angle ang; s is half its length
function drawFish(pos, s, ang, color)
{
    const cs = Math.cos(ang), sn = Math.sin(ang), at = (x, y) => vec2(pos.x + (x*cs - y*sn)*s, pos.y + (x*sn + y*cs)*s);
    const pts = [at(1, 0), at(.5, .45), at(-.2, .5), at(-.7, .1), at(-1.1, .55), at(-1.1, -.55), at(-.7, -.1), at(-.2, -.5), at(.5, -.45)];
    drawPoly(pts, color, .1*s, C_INK);
    drawCircle(at(.55, .12), .16*s, C_INK);
}

// a little crab seen from above, scuttling: s is its half width, rot tilts it, t drives the claw and leg wiggle
function drawCrab(pos, s, rot, t, color)
{
    const cs = Math.cos(rot), sn = Math.sin(rot), at = (x, y) => vec2(pos.x + (x*cs - y*sn)*s, pos.y + (x*sn + y*cs)*s);
    const wig = Math.sin(t*22);
    for (const m of [1, -1])
    {
        for (let i = 0; i < 3; i++)                 // legs
            drawLine(at(m*.5, -.15 - i*.22), at(m*(1.05 + wig*.08*(i%2 ? 1 : -1)), -.4 - i*.3), .13*s, C_INK);
        const up = .95 + wig*.12*m;                 // arm and claw
        drawLine(at(m*.5, .25), at(m*.95, up*.7), .15*s, C_INK);
        drawCircle(at(m*1.05, up), .38*s, color, .1*s, C_INK);
    }
    drawCircle(at(0, 0), 1.3*s, color, .1*s, C_INK);
    for (const m of [1, -1]) { drawLine(at(m*.28, .5), at(m*.28, .8), .08*s, C_INK); drawCircle(at(m*.28, .85), .2*s, C_CREAM, .06*s, C_INK); }
}

function starPoints(c, r)
{
    const pts = [];
    for (let i = 0; i < 10; i++)
    {
        const a = PI/2 + i*PI/5, rr = i % 2 ? r*.45 : r;
        pts.push(vec2(c.x + Math.cos(a)*rr, c.y + Math.sin(a)*rr));
    }
    return pts;
}

function drawStar(c, r, filled)
{
    drawPoly(starPoints(c.add(vec2(.1, -.14)), r), C_SHADOW);
    drawPoly(starPoints(c, r), filled ? C_SUNNY : C_CREAM, LINE_W, C_INK);
}

// Rounded panel with ink outline and drop shadow
function drawPanel(c, w, h, color, r=.5, shadow=true)
{
    const pts = hullRoundRect(w/2, h/2, r, r).map(p => p.add(c));
    if (shadow) drawPoly(pts.map(p => p.add(vec2(.16, -.22))), C_SHADOW);
    drawPoly(pts, color, LINE_W, C_INK);
}
