/*
    HOP RACE - world drawing (GDD §9): one flat background color, solid ink level pieces,
    players as flat squares with one big googly eye. No outlines, shading or textures.
*/

'use strict';

let hrPulse = 0;   // the one soft background pulse on finish, 1 -> 0

function hrWorldBg() { return HR_WORLDS[hrWorld].bg; }

function hrDrawBackground()
{
    const bg = hrScreenBg().lerp(HR_WHITE, .35 * hrPulse);
    drawRect(cameraPos, vec2(1e4), bg);
}

function hrDrawLevel()
{
    const L = hrLevel, hw = L.w / 2, hh = L.h / 2, far = 60;
    for (const g of L.gates) hrDrawGate(g);
    for (const s of L.solids)
    {
        if (s.gate) continue;
        if (s.edge)
        {
            // the level box's side walls, as thick as the camera margin, so on wide screens the HUD
            // buttons beyond them stay on the background
            const l = s.l < 0 ? s.r - HR_MARGIN : s.l, r = s.r > 0 ? s.l + HR_MARGIN : s.r;
            drawRect(vec2((l + r) / 2, 0), vec2(r - l, 2 * (hh + far)), HR_INK);
            continue;
        }
        // solids that touch the level box edge are drawn on to the screen edge; floating ones (ceilings)
        // stop at the side wall's outer face instead of crossing it
        const side = s.bottom < -hh ? far : HR_MARGIN;
        const l = s.l <= -hw + .01 ? -hw - side : s.l, r = s.r >= hw - .01 ? hw + side : s.r;
        const top = s.top >= hh - .01 ? s.top + far : s.top;
        drawRect(vec2((l + r) / 2, (top + s.bottom) / 2), vec2(r - l, top - s.bottom), HR_INK);
        if (s.grip) hrDrawSawtooth(s);
        if (s.ice) hrDrawIce(s);
        if (s.sticky) hrDrawSticky(s);
    }
    hrDrawFlag();
}

// icy floor: a white hatched stripe along the top
function hrDrawIce(s)
{
    const y = s.top - .2, h = .16, step = .45, lean = .16;
    for (let x = s.l + .12; x + .2 + lean < s.r; x += step)
        drawPoly([vec2(x, -h / 2), vec2(x + .2, -h / 2), vec2(x + .2 + lean, h / 2), vec2(x + lean, h / 2)],
            HR_WHITE, 0, HR_WHITE, vec2(0, y));
}

// sticky floor: a bumpy, rounded top edge
function hrDrawSticky(s)
{
    const n = max(2, Math.round((s.r - s.l) / .5)), step = (s.r - s.l) / n;
    for (let i = 0; i < n; i++)
        drawCircle(vec2(s.l + step * (i + .5), s.top), step * 1.1, HR_INK);
}

// gate: dark bars with the background between, a dotted line to its button; button: a white target
// on a dark mount that becomes a white check mark once pressed
function hrDrawGate(g)
{
    const s = g.solid, b = g.button, top = min(s.top, hrLevel.h / 2 + 30);
    if (s.top - s.bottom > .05)
    {
        const h = top - s.bottom, n = max(2, Math.round((s.r - s.l) / .35));
        for (let i = 0; i < n; i++)
        {
            const x = s.l + (s.r - s.l) * (i + .5) / n;
            drawRect(vec2(x, s.bottom + h / 2), vec2(.16, h), HR_INK);
        }
        drawRect(vec2((s.l + s.r) / 2, s.bottom + .12), vec2(s.r - s.l, .24), HR_INK);
        // dotted link from the button to the gate's foot
        const from = vec2(b.x, b.y), to = vec2((s.l + s.r) / 2, s.bottom + .3), d = to.distance(from);
        for (let t = .9; t < d - .3; t += .45)
            drawRect(from.lerp(to, t / d), vec2(.1), HR_INK.scale(1, .45));
    }
    drawRect(vec2(b.x, b.y), vec2(1.1), HR_INK);
    if (!g.pressed)
    {
        const pulse = 1 + .06 * Math.sin(time * 6);
        drawCircle(vec2(b.x, b.y), .8 * pulse, HR_WHITE);
        drawCircle(vec2(b.x, b.y), .5 * pulse, HR_INK);
        drawCircle(vec2(b.x, b.y), .24 * pulse, HR_WHITE);
    }
    else
    {
        drawLine(vec2(b.x - .3, b.y), vec2(b.x - .08, b.y - .24), .15, HR_WHITE);
        drawLine(vec2(b.x - .08, b.y - .24), vec2(b.x + .3, b.y + .26), .15, HR_WHITE);
    }
}

// grip walls: a sawtooth face on both sides
function hrDrawSawtooth(s)
{
    const tooth = .4, bottom = max(s.bottom, hrLevel.killY - 1);
    for (let y = s.top - tooth / 2; y > bottom; y -= tooth)
        for (const side of [-1, 1])
        {
            const x = side < 0 ? s.l : s.r;
            drawPoly([vec2(0, tooth / 2), vec2(side * .22, 0), vec2(0, -tooth / 2)], HR_INK, 0, HR_INK, vec2(x, y));
        }
}

// checkered finish flag: 6 x 4 cells, waving more toward the free end
function hrDrawFlag()
{
    const f = hrLevel.flag, w = 1.3, h = .88, cols = 6, rows = 4, cw = w / cols, ch = h / rows;
    const corner = (x, y) => vec2(x, y + Math.sin(time * 4 - x * 2.5) * .1 * x / w);
    const cell = (x0, x1, y0, y1) => [corner(x0, y0), corner(x1, y0), corner(x1, y1), corner(x0, y1)];
    const pos = vec2(f.x + .07, f.y + 3);
    drawRect(vec2(f.x, f.y + 1.5), vec2(.14, 3), HR_INK);
    for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++)
    {
        const c = (i + j) % 2 ? HR_INK : HR_WHITE;
        drawPoly(cell(i * cw, (i + 1) * cw, -j * ch, -(j + 1) * ch), c, 0, c, pos);
    }
}

function hrDrawPlayer(p, eyeNudge = 0)
{
    // short trail while airborne
    for (let i = 0; i < p.trail.length; i++)
    {
        const k = (i + 1) / (p.trail.length + 1);
        drawRect(p.trail[i], vec2(HR_PSIZE * k * .7), p.color.scale(1, k * .3));
    }
    const land = hrLandSquash(p), sx = 1 + p.squash + land + p.crouch * .6, sy = 1 - hrSquashY(p), size = vec2(HR_PSIZE * sx, HR_PSIZE * sy);
    const pos = vec2(p.x, p.y - (1 - sy) * HR_PSIZE / 2);
    drawRect(pos, size, p.color);
    drawText(p.letter, pos.add(vec2(-.1 * p.dir, -.1 * sy)), .42 * sy, p.letterColor, 0, BLACK, 'center', HR_FONT, HR_FONT_STYLE);
    hrDrawEye(pos.add(vec2((.2 + eyeNudge) * (p.dir || 1), size.y / 2 - .06)), p.eye, .5, hrBlinkOpen(p.blinkT));
}

// how open the eye is during a blink: 1 open, 0 shut; t is seconds into the blink, -1 when not blinking
const HR_BLINK_T = .16;
function hrBlinkOpen(t) { return t < 0 ? 1 : clamp(Math.abs(1 - 2 * t / HR_BLINK_T)); }

// one big googly eye, sticking out past the top corner, with a loose pupil and no outline
function hrDrawEye(center, eye, d = .5, open = 1)
{
    drawEllipse(center, vec2(d, d * max(open, .12)), HR_WHITE);
    if (open > .5)
        drawEllipse(center.add(vec2(eye.x, eye.y * open).scale(d / .5)), vec2(d * .42, d * .42 * open), HR_INK);
    else
        drawRect(center, vec2(d * .7, d * .1), HR_INK);   // shut: a thin ink lid line
}

function hrDrawGhost(pos)
{
    if (!pos) return;
    const c = HR_INK.scale(1, .4), s = HR_PSIZE, t = .07;
    drawRect(pos.add(vec2(0, (s - t) / 2)), vec2(s, t), c);
    drawRect(pos.add(vec2(0, -(s - t) / 2)), vec2(s, t), c);
    drawRect(pos.add(vec2((s - t) / 2, 0)), vec2(t, s - 2 * t), c);
    drawRect(pos.add(vec2(-(s - t) / 2, 0)), vec2(t, s - 2 * t), c);
}

// ink dust puff on landing
function hrDust(x, y)
{
    const c = HR_INK.scale(1, .7), e = HR_INK.scale(1, 0);
    new ParticleEmitter(vec2(x, y), 0, .6, .05, 30, PI, undefined, c, c, e, e,
        .35, .16, .04, .06, 0, .9, 1, .2, PI, .1, .3);
}

// white sparkle while sliding on ice
function hrSparkle(x, y)
{
    new ParticleEmitter(vec2(x, y), 0, .6, .05, 40, PI, undefined,
        HR_WHITE, HR_WHITE, HR_WHITE.scale(1, 0), HR_WHITE.scale(1, 0), .3, .14, .02, .02, 0, .9, 1, 0, PI, .1, .5);
}

// rocket blast: a splash in the owner's color
function hrBlastFx(pos, color)
{
    new ParticleEmitter(pos, 0, .4, .1, 300, PI, undefined, color, color, color.scale(1, 0), color.scale(1, 0),
        .45, .22, .06, .3, 0, .9, 1, .1, PI, .1, .4);
}

// white confetti on finish
function hrConfetti(pos, color)
{
    new ParticleEmitter(pos, 0, 1, .25, 160, PI, undefined,
        HR_WHITE, color, HR_WHITE.scale(1, 0), color.scale(1, 0),
        1.1, .28, .12, .28, .15, .97, .95, .45, PI, .1, .5);
}
