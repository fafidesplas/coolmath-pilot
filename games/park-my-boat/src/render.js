'use strict';
// Toybox Flat drawing: flat fills, thick ink outlines, soft drop shadows.

const LINE_W = .1;
const SHADOW_OFF = vec2(.18, -.24);
const FONT_STYLE = 'bold';
const C_CLEAR = rgb(0, 0, 0, 0);

// Paints in a body's local space (x = bow, y = port), following its squash
function painter(b, ox=0, oy=0)
{
    const c = Math.cos(b.angle), s = Math.sin(b.angle), sx = b.sx || 1, sy = b.sy || 1;
    const px = b.pos.x + ox, py = b.pos.y + oy, ang = -b.angle;
    const P = (x, y) => vec2(px + x*sx*c - y*sy*s, py + x*sx*s + y*sy*c);
    const lw = outline => outline ? LINE_W : 0;
    return {
        P,
        circle(x, y, d, color, outline) { drawCircle(P(x, y), d*sx, color, lw(outline), C_INK); },
        ellipse(x, y, w, h, color, outline) { drawEllipse(P(x, y), vec2(w*sx, h*sy), color, ang, lw(outline), C_INK); },
        poly(pts, color, outline) { drawPoly(pts.map(p => p.x === undefined ? P(p[0], p[1]) : P(p.x, p.y)), color || C_CLEAR, lw(outline), C_INK); },
        rect(cx, cy, w, h, color, outline) { this.poly([[cx-w/2,cy-h/2],[cx+w/2,cy-h/2],[cx+w/2,cy+h/2],[cx-w/2,cy+h/2]], color, outline); },
        line(x1, y1, x2, y2, w, color) { drawLine(P(x1, y1), P(x2, y2), w, color); },
        text(str, x, y, size, color) { drawText(str, P(x, y), size, color, 0, C_INK, 'center', fontDefault, FONT_STYLE); },
    };
}

function txt(str, x, y, size, color=C_INK, align='center', outline=0, outlineColor=C_INK)
{
    drawText(str, vec2(x, y), size, color, outline, outlineColor, align, fontDefault, FONT_STYLE);
}

function drawBoatShadow(b)
{
    painter(b, SHADOW_OFF.x, SHADOW_OFF.y).poly(b.type.hullPts, C_SHADOW);
}

function drawBoat(b)
{
    const t = b.type, d = painter(b);
    d.poly(t.hullPts, b.color, true);
    d.poly(t.deckPts, b.color.lerp(C_CREAM, .45));
    BOAT_DECO[t.key](d, t, b);
    if (b.kind == 'player' || b.kind == 'moored')
        drawCaptain(d, t.captainX, b);
}

// Captain seen from above: cap, plus eyes looking toward the bow (wide when bonked)
function drawCaptain(d, x, b)
{
    const hurt = b.hurtT > 0;
    d.circle(x, 0, .62, C_SKIN, true);
    d.circle(x - .08, 0, .42, b.kind == 'player' ? C_CREAM : C_NAVY, true);
    d.line(x + .14, .2, x + .14, -.2, .1, C_INK);                 // cap brim
    const e = hurt ? .17 : .1;
    d.circle(x + .26, .13, e, hurt ? C_CREAM : C_INK, hurt);
    d.circle(x + .26, -.13, e, hurt ? C_CREAM : C_INK, hurt);
}

function drawDuck(b)
{
    const d = painter(b), k = b.duckSize;
    painter(b, SHADOW_OFF.x*.6, SHADOW_OFF.y*.6).ellipse(0, 0, 1.1*k, .8*k, C_SHADOW);
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
    const bob = 1 + Math.sin(time*3 + b.id)*.05, r = .9*bob;
    drawCircle(b.pos.add(SHADOW_OFF), r, C_SHADOW);
    drawCircle(b.pos, r, C_CORAL, LINE_W, C_INK);
    drawCircle(b.pos, r*.62, C_CREAM, LINE_W, C_INK);
    drawCircle(b.pos, r*.28, C_CORAL, LINE_W, C_INK);
}

function drawLog(b)
{
    const d = painter(b), l = 1.2, w = .55;
    painter(b, SHADOW_OFF.x, SHADOW_OFF.y).poly(hullRoundRect(l, w/2, w/2, w/2), C_SHADOW);
    d.poly(hullRoundRect(l, w/2, w/2, w/2), C_WOOD2, true);
    d.line(-.6, .08, .5, .08, .06, C_INK.scale(1, .3));
    d.ellipse(l - w/2, 0, w*.7, w*.8, C_WOOD, true);
}

function drawDock(r)
{
    const w = r.x1 - r.x0, h = r.y1 - r.y0, c = vec2(r.x0 + w/2, r.y0 + h/2);
    drawRect(c, vec2(w, h), C_WOOD);
    // planks run across the long side
    if (w > h) for (let x = r.x0 + .7; x < r.x1; x += .7) drawLine(vec2(x, r.y0), vec2(x, r.y1), .05, C_WOOD2);
    else       for (let y = r.y0 + .7; y < r.y1; y += .7) drawLine(vec2(r.x0, y), vec2(r.x1, y), .05, C_WOOD2);
    drawPoly([vec2(r.x0,r.y0), vec2(r.x1,r.y0), vec2(r.x1,r.y1), vec2(r.x0,r.y1)], C_CLEAR, LINE_W, C_INK);
}

function drawDockShadow(r)
{
    const w = r.x1 - r.x0, h = r.y1 - r.y0;
    drawRect(vec2(r.x0 + w/2, r.y0 + h/2).add(SHADOW_OFF), vec2(w, h), C_SHADOW);
}

function drawPost(p)
{
    drawCircle(vec2(p.x, p.y).add(SHADOW_OFF), p.r*2, C_SHADOW);
    drawCircle(vec2(p.x, p.y), p.r*2, C_WOOD2, LINE_W, C_INK);
    drawCircle(vec2(p.x, p.y), p.r, C_WOOD, 0);
}

function drawDashedRect(c, w, h, color, width, dash=.5)
{
    const pts = [vec2(c.x-w/2,c.y-h/2), vec2(c.x+w/2,c.y-h/2), vec2(c.x+w/2,c.y+h/2), vec2(c.x-w/2,c.y+h/2)];
    for (let i = 0; i < 4; i++)
    {
        const a = pts[i], b = pts[(i+1)%4], len = a.distance(b), n = Math.max(1, Math.round(len/dash));
        for (let k = 0; k < n; k += 2)
            drawLine(a.lerp(b, k/n), a.lerp(b, Math.min(1, (k+1)/n)), width, color);
    }
}

function drawAnchorGlyph(pos, s, color)
{
    const L = (x1, y1, x2, y2) => drawLine(vec2(pos.x+x1*s, pos.y+y1*s), vec2(pos.x+x2*s, pos.y+y2*s), .13*s, color);
    drawCircle(vec2(pos.x, pos.y + .5*s), .3*s, C_CLEAR, .12*s, color);
    L(0, .35, 0, -.55);
    L(-.28, .2, .28, .2);
    L(-.48, -.12, -.3, -.42); L(-.3, -.42, 0, -.55); L(0, -.55, .3, -.42); L(.3, -.42, .48, -.12);
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
