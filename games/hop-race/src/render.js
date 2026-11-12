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

// the player's drawn body: squash, landing squeeze and crouch, its feet kept on the ground
function hrPlayerBody(p)
{
    const land = hrLandSquash(p), sx = 1 + p.squash + land + p.crouch * .6 - p.pinch, sy = 1 - hrSquashY(p);
    return {pos: vec2(p.x, p.y - (1 - sy) * HR_PSIZE / 2), size: vec2(HR_PSIZE * sx, HR_PSIZE * sy), sy};
}

// part: 'all', or just 'eye' (redrawn over the striped overlap in Versus). No letter on the body: it read as the
// character's name, not as its key; the start prompt names the key instead
function hrDrawPlayer(p, part = 'all')
{
    const {pos, size} = hrPlayerBody(p);
    // lean: the top slides toward the facing side (+, a / when facing right) or away from it (-, a \) while the bottom stays planted
    const lean = p.lean * (p.dir || 1), hx = size.x / 2, hy = size.y / 2;
    // spin (a somersault, clockwise positive) turns the body and eye together around the center
    const spin = p.spin || 0, turn = v => spin ? v.rotate(spin) : v;
    const shear = y => vec2(lean * (y + hy) / size.y, y);   // offset of a point y above the center, following the lean
    if (part == 'all')
    {
        // short trail while airborne
        for (let i = 0; i < p.trail.length; i++)
        {
            const k = (i + 1) / (p.trail.length + 1);
            drawRect(p.trail[i], vec2(HR_PSIZE * k * .7), p.color.scale(1, k * .3));
        }
        if (lean) drawPoly([vec2(-hx, -hy), vec2(hx, -hy), vec2(hx + lean, hy), vec2(-hx + lean, hy)], p.color, 0, p.color, pos, spin);
        else drawRect(pos, size, p.color, spin);
    }
    // the eye sits inside the top front corner and scales with the player (0.5 u at the 0.8 u default); it follows a forward lean only
    const k = HR_PSIZE / .8, d = .5 * k, m = .05 * k, ey = hy - m - d / 2 - p.eyeDrop * k;
    hrDrawEye(pos.add(turn((p.lean > 0 ? shear(ey) : vec2(0, ey)).add(vec2((HR_PSIZE / 2 - m - d / 2) * (p.dir || 1), 0)))), p.eye, d, hrBlinkOpen(p.blinkT) * (1 - p.squint));
}

// start prompt over each player: "P1: Press A to run" (solo: "Press A to run"), until that player's first press (GDD §3.1)
function hrDrawStartPrompts()
{
    if (window.hrEditor?.active || hrScreen != 'playing') return;
    const verb = HR_WORLDS[hrWorld].verb, size = .55, hw = hrLevel.w / 2;
    const [a, b] = hrPlayers, stacked = b && Math.abs(a.x - b.x) < 3 && Math.abs(a.y - b.y) < 1;
    for (const p of hrPlayers)
    {
        if (p.intro <= 0) continue;
        const text = `${hrVersus ? p.name + ': ' : ''}Press ${p.letter} to ${verb}`, half = text.length * size * .29;
        const x = clamp(p.x, -hw + half + .3, hw - half - .3), y = p.y + 1.3 + (stacked && !p.index ? .8 : 0);   // stacked: P1 on top
        hrWorldText(text, vec2(x, y), size, HR_INK.scale(1, p.intro));
    }
}

// Versus: where the two bodies overlap, diagonal stripes in the back player's color, so you can tell two players
// are there even on the same spot. Drawing only (players pass through each other); lean and spin are ignored
function hrDrawOverlap(front, back)
{
    const a = hrPlayerBody(front), b = hrPlayerBody(back);
    const l = max(a.pos.x - a.size.x / 2, b.pos.x - b.size.x / 2), r = min(a.pos.x + a.size.x / 2, b.pos.x + b.size.x / 2);
    const bot = max(a.pos.y - a.size.y / 2, b.pos.y - b.size.y / 2), top = min(a.pos.y + a.size.y / 2, b.pos.y + b.size.y / 2);
    if (r - l < .02 || top - bot < .02) return false;
    const c0 = worldToScreen(vec2(l, top)), c1 = worldToScreen(vec2(r, bot));
    mainContext.save();
    mainContext.beginPath();
    mainContext.rect(c0.x, c0.y, c1.x - c0.x, c1.y - c0.y);
    mainContext.clip();
    const h = top - bot;
    for (let k = -h; k < r - l; k += .22)
        drawLine(vec2(l + k, bot), vec2(l + k + h, top), .1, back.color);
    mainContext.restore();
    return true;
}

// how open the eye is during a blink: 1 open, 0 shut; t is seconds into the blink, -1 when not blinking
const HR_BLINK_T = .16;
function hrBlinkOpen(t) { return t < 0 ? 1 : clamp(Math.abs(1 - 2 * t / HR_BLINK_T)); }

// one big googly eye, inside the top front corner, with a loose pupil and no outline
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

// ice droplets: white beads flicked off the ice that arc and fall back onto it. Hand-rolled because the engine's
// particle gravity is the global one, which is zero here. Pooled, at most HR_DROPS_MAX alive
const HR_DROPS_MAX = 64, HR_DROP_GRAVITY = 35;
const hrDrops = [];
let hrDropsAlive = 0;
function hrDropAdd(x, y, vx, vy)
{
    if (hrDropsAlive >= HR_DROPS_MAX) return;
    const d = hrDrops[hrDropsAlive] || (hrDrops[hrDropsAlive] = {pos: vec2(), vel: vec2()});
    hrDropsAlive++;
    d.pos.set(x, y); d.vel.set(vx, vy);
    d.floor = y;
    d.t = 0; d.T = rand(.25, .45); d.size = rand(.07, .13);
}

// one droplet while running on ice: up and back from the foot, faster with k (0-1, share of ice speed)
function hrDroplet(x, y, dir, k) { hrDropAdd(x, y, -dir * rand(1, 2 + 3 * k), rand(2, 3.5 + 2 * k)); }

// a splash of droplets both ways on landing on ice
function hrSplash(x, y)
{
    for (let i = 6; i--;) hrDropAdd(x + rand(-.25, .25), y, rand(-4, 4), rand(2, 5));
}

function hrDropsStep()
{
    const dt = timeDelta;
    for (let i = 0; i < hrDropsAlive;)
    {
        const d = hrDrops[i];
        if ((d.t += dt) > d.T || d.pos.y < d.floor)   // gone when it lands back on the ice
        {
            // swap the dead one to the end of the live range so its object is reused
            hrDrops[i] = hrDrops[--hrDropsAlive];
            hrDrops[hrDropsAlive] = d;
            continue;
        }
        d.vel.y -= HR_DROP_GRAVITY * dt;
        d.pos.x += d.vel.x * dt; d.pos.y += d.vel.y * dt;
        i++;
    }
}

function hrDrawDrops()
{
    for (let i = 0; i < hrDropsAlive; i++)
    {
        // a bead stretched along its motion, shrinking and fading out
        const d = hrDrops[i], k = 1 - d.t / d.T, s = d.size * (.5 + .5 * k);
        drawEllipse(d.pos, vec2(s, s * 1.7), HR_WHITE.scale(1, min(1, k * 2)), d.vel.angle());
    }
}

function hrClearDrops() { hrDropsAlive = 0; }

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
