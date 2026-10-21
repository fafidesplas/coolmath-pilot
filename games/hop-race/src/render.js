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
    for (const s of L.solids)
    {
        if (s.edge) continue;
        // solids that touch the level box edge are drawn on to the screen edge
        const l = s.l <= -hw + .01 ? s.l - far : s.l, r = s.r >= hw - .01 ? s.r + far : s.r;
        const top = s.top >= hh - .01 ? s.top + far : s.top;
        drawRect(vec2((l + r) / 2, (top + s.bottom) / 2), vec2(r - l, top - s.bottom), HR_INK);
        if (s.grip) hrDrawSawtooth(s);
    }
    hrDrawFlag();
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

function hrDrawFlag()
{
    const f = hrLevel.flag, wave = Math.sin(time * 4) * .08;
    drawRect(vec2(f.x, f.y + 1.5), vec2(.14, 3), HR_INK);
    drawPoly([vec2(0, 0), vec2(1.3, -.45 + wave), vec2(0, -.9)], HR_WHITE, 0, HR_INK, vec2(f.x + .07, f.y + 3));
}

function hrDrawPlayer(p, eyeNudge = 0)
{
    // short trail while airborne
    for (let i = 0; i < p.trail.length; i++)
    {
        const k = (i + 1) / (p.trail.length + 1);
        drawRect(p.trail[i], vec2(HR_PSIZE * k * .7), p.color.scale(1, k * .3));
    }
    const sx = 1 + p.squash + p.crouch * .6, sy = 1 - p.squash - p.crouch, size = vec2(HR_PSIZE * sx, HR_PSIZE * sy);
    const pos = vec2(p.x, p.y - (1 - sy) * HR_PSIZE / 2);
    drawRect(pos, size, p.color);
    drawText(p.letter, pos.add(vec2(-.1 * p.dir, -.1 * sy)), .42 * sy, p.letterColor, 0, BLACK, 'center', HR_FONT, HR_FONT_STYLE);
    hrDrawEye(pos.add(vec2((.2 + eyeNudge) * (p.dir || 1), size.y / 2 - .06)), p.eye);
}

// one big googly eye, sticking out past the top corner, with a loose pupil and no outline
function hrDrawEye(center, eye, d = .5)
{
    drawCircle(center, d, HR_WHITE);
    drawCircle(center.add(vec2(eye.x, eye.y).scale(d / .5)), d * .42, HR_INK);
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

// white confetti on finish
function hrConfetti(pos, color)
{
    new ParticleEmitter(pos, 0, 1, .25, 160, PI, undefined,
        HR_WHITE, color, HR_WHITE.scale(1, 0), color.scale(1, 0),
        1.1, .28, .12, .28, .15, .97, .95, .45, PI, .1, .5);
}
