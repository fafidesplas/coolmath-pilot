/*
    HOP RACE - Lab world, Climb (GDD §3.7). A stiff arm with a round head sticks out of the player.
    Hold to whip it around clockwise, let go and it coasts to a stop. Inspired by Getting Over It.

    The arm is always solid: the head never passes through anything. Wherever the arm would push the
    head into a solid, the body is pushed the other way instead, so a fast strike on the ground pops you
    up and forward (the head's friction on the surface turns the swing into a shove).
    Let go and the arm coasts to a stop (or stops on the first surface it touches), and the head becomes
    a suction cup: as soon as it touches
    any surface (floor, wall or ceiling) it sticks and holds your whole weight, so you can perch on the
    arm, hang from a wall or dangle under a ceiling. Pressing while stuck to a wall turns the arm slowly around
    the cup, levering the body (taps inch you along); only a hold longer than peelTime pulls the cup off.
*/

'use strict';

const HR_CLIMB = {
    gravity:    42,
    arm:        2,      // body center to head center (u)
    headR:      .24,    // head radius (u)
    spin:       10,     // arm turn speed while held (rad/s); the head moves at spin × arm u/s
    coastTime:  .3,     // after letting go, the arm slows from full spin to a stop in this time (s); 0: it stops dead
    friction:   100,    // head friction on surfaces while turning (high: the head never slips, so a strike levers the body)
    maxSpeed:   20,     // speed cap for the body (u/s)
    ground:     8,      // ground friction for the body (1/s)
    substeps:   4,      // so a fast head never skips a thin solid
    suction:    true,   // true: a stopped head sticks on touch and never peels off; false: it peels off when pulled away (2026-10-22 grip)
    suckReach:  .05,    // a stopped head this close to a surface (u) counts as touching it
    cupR:       .34,    // radius of the suction cup drawn while stuck (u)
    peelTime:   .2,     // while stuck to a wall, a press shorter than this keeps the cup on; holding longer peels it off (s); 0: any press peels
    creep:      2,      // while stuck to a wall and held, the arm turns this slowly around the cup, levering the body (rad/s); 0: it holds still
};

// push-out from one solid for a circle at (x, y): {d, nx, ny}, d < 0 inside the solid
function hrClimbPush(x, y, s)
{
    const cx = clamp(x, s.l, s.r), cy = clamp(y, s.bottom, s.top);
    if (cx != x || cy != y)
    {
        const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
        return {d, nx: dx / d, ny: dy / d};
    }
    // inside: leave through the nearest side
    const sides = [[x - s.l, -1, 0], [s.r - x, 1, 0], [y - s.bottom, 0, -1], [s.top - y, 0, 1]];
    const [depth, nx, ny] = sides.reduce((a, b) => b[0] < a[0] ? b : a);
    return {d: -depth, nx, ny};
}

// how far the head at (x, y) must move to be clear of every solid ({x: 0, y: 0} if it is)
function hrClimbHeadOut(x, y)
{
    const r = HR_CLIMB.headR;
    let ox = 0, oy = 0;
    for (const s of hrLevel.solids)
    {
        const c = hrClimbPush(x + ox, y + oy, s);
        if (c.d < r) { ox += c.nx * (r - c.d); oy += c.ny * (r - c.d); }
    }
    return {x: ox, y: oy};
}

function hrClimbTouching(x, y)
{
    const r = HR_CLIMB.headR + HR_CLIMB.suckReach;
    return hrLevel.solids.some(s => hrClimbPush(x, y, s).d < r);
}

// push the body square out of every solid; returns true if a solid pushed it up (it stands on it)
function hrClimbBodyOut(p)
{
    const h = HR_PSIZE / 2;
    let up = false;
    for (const s of hrLevel.solids)
    {
        if (!hrOverlapSolid(p.x, p.y, s)) continue;
        const ox = min(p.x + h - s.l, s.r - (p.x - h)), oy = min(p.y + h - s.bottom, s.top - (p.y - h));
        if (ox < oy) p.x += p.x < (s.l + s.r) / 2 ? -ox : ox;
        else if (p.y > (s.top + s.bottom) / 2) { p.y += oy; up = true; }
        else p.y -= oy;
    }
    return up;
}

HR_MODES.climb = {
    reset(p)
    {
        p.grounded = true;
        p.dir = 1;
        p.aimA = PI * .6;   // arm up and a little back
        p.pin = null;       // {x, y, nx, ny}: where the head sticks to a surface while the arm is frozen
        p.armW = 0;         // arm turn speed (rad/s): spin while held, slowing to 0 after letting go
        p.strikeT = 0;
    },

    head(p) { return {x: p.x + Math.cos(p.aimA) * HR_CLIMB.arm, y: p.y + Math.sin(p.aimA) * HR_CLIMB.arm}; },

    step(p, input)
    {
        const C = HR_CLIMB, h = timeDelta / C.substeps, vy0 = p.vy;
        p.down = input.down;
        if (p.pin)
        {
            // on a wall a soft press creeps on the cup and only a hold past peelTime pulls it off;
            // on a floor or ceiling any press pulls it off (taps there would lock you in place)
            p.pin.age += timeDelta;
            p.pin.held = p.down ? p.pin.held + timeDelta : 0;
            if (p.pin.held > (p.pin.nx ? C.peelTime : 0)) p.pin = null;
        }
        p.strikeT = max(0, p.strikeT - timeDelta);
        let grounded = false;
        for (let i = 0; i < C.substeps; i++) grounded = this.sub(p, input.down, h) || grounded;
        if (grounded && !p.grounded && vy0 < -6)
        {
            p.land = min(.3, .1 + -vy0 * .012);
            p.landT = 0;
            hrSfx.land.play();
            hrDust(p.x, p.y - HR_PSIZE / 2);
        }
        p.grounded = grounded;
        if (abs(p.vx) > 1) p.dir = sign(p.vx);
    },

    // one substep; returns true if the body stands on something
    sub(p, turning, h)
    {
        const C = HR_CLIMB, x0 = p.x, y0 = p.y, a0 = p.aimA, head0 = this.head(p);
        p.vy -= C.gravity * h;
        p.x += p.vx * h; p.y += p.vy * h;
        if (p.pin) p.armW = turning ? C.creep : 0;
        else if (turning) p.armW = C.spin;
        else p.armW = C.coastTime > 0 ? max(0, p.armW - C.spin / C.coastTime * h) : 0;
        const moving = p.armW > 0;
        p.aimA -= p.armW * h;

        let grounded = this.solve(p, moving, head0);
        if (p.pin && moving && this.jammed(p))
        {
            // creeping would push the body into a solid: the arm holds where it was
            p.x = x0; p.y = y0; p.vx = p.vy = 0; p.aimA = a0;
            grounded = this.solve(p, false, head0);
        }
        else if (moving && !p.pin && this.jammed(p))
        {
            // the arm is wedged: it can't turn this substep (a coasting arm stops for good)
            p.x = x0 + p.vx * h; p.y = y0 + p.vy * h; p.aimA = a0;
            if (!turning) p.armW = 0;
            grounded = this.solve(p, false, head0);
        }

        p.vx = (p.x - x0) / h; p.vy = (p.y - y0) / h;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > C.maxSpeed) { p.vx *= C.maxSpeed / sp; p.vy *= C.maxSpeed / sp; }
        if (grounded && !p.pin)
        {
            p.vx *= Math.exp(-C.ground * h);
            if (abs(p.vx) < .05) p.vx = 0;
        }
        return grounded;
    },

    // move the body until the head and the body are both out of every solid
    solve(p, turning, head0)
    {
        const C = HR_CLIMB;
        let grounded = false;
        for (let it = 0; it < 4; it++)
        {
            const hd = this.head(p);
            if (p.pin)
            {
                // stuck: the head stays put (without suction it peels off when pulled away from the surface)
                const dx = hd.x - p.pin.x, dy = hd.y - p.pin.y;
                if (!C.suction && dx * p.pin.nx + dy * p.pin.ny > .02) p.pin = null;
                else { p.x -= dx; p.y -= dy; }
            }
            else
            {
                const out = hrClimbHeadOut(hd.x, hd.y), pen = Math.hypot(out.x, out.y);
                if (pen > 0)
                {
                    const nx = out.x / pen, ny = out.y / pen;
                    p.x += out.x; p.y += out.y;
                    if (turning && p.down)
                    {
                        // friction: the head's slide along the surface shoves the body the other way
                        let tx = hd.x + out.x - head0.x, ty = hd.y + out.y - head0.y;
                        const tn = tx * nx + ty * ny;
                        tx -= nx * tn; ty -= ny * tn;
                        const t = Math.hypot(tx, ty), cancel = min(t, C.friction * pen);
                        if (t > 0) { p.x -= tx / t * cancel; p.y -= ty / t * cancel; }
                        if (pen > .05 && !p.strikeT)
                        {
                            p.strikeT = .15;
                            hrSfx.click.play(vec2(hd.x, hd.y), 1, .8);
                            p.pupilKick(-nx * .2, -ny * .2);
                            hrEmit('fire', p);
                        }
                    }
                    else if (!p.down) this.stick(p, hd.x + out.x, hd.y + out.y);   // stopped or coasting: the head sticks here
                }
                else if (!p.down && C.suction && hrClimbTouching(hd.x, hd.y)) this.stick(p, hd.x, hd.y);
            }
            grounded = hrClimbBodyOut(p) || grounded;
        }
        return grounded;
    },

    // the head sticks at (x, y): remember the face under it (of the nearest solid) so the cup can sit flush
    // on it; on a corner it takes the face it is more over, so the cup never sits at a slant
    stick(p, x, y)
    {
        const s = hrLevel.solids.reduce((a, b) => hrClimbPush(x, y, b).d < hrClimbPush(x, y, a).d ? b : a);
        const c = hrClimbPush(x, y, s), side = abs(c.nx) > abs(c.ny);
        const nx = side ? sign(c.nx) : 0, ny = side ? 0 : sign(c.ny);
        const sx = side ? (nx > 0 ? s.r : s.l) : clamp(x, s.l, s.r), sy = side ? clamp(y, s.bottom, s.top) : (ny > 0 ? s.top : s.bottom);
        p.pin = {x, y, nx, ny, sx, sy, age: 0, held: 0};
        p.armW = 0;
        hrSfx.click.play(vec2(x, y), .7, .5);   // a low thwop
        p.pupilKick(0, -.1);
    },

    jammed(p)
    {
        const hd = this.head(p), out = hrClimbHeadOut(hd.x, hd.y);
        return Math.hypot(out.x, out.y) > .02 || hrLevel.solids.some(s => hrOverlapSolid(p.x, p.y, s, .02));
    },

    // the arm: an ink bar from the body to a round ink head. While stuck, the head becomes a suction cup:
    // an ink half disc with its flat side flush on the surface and a white lip, landing with a quick squash
    draw(p)
    {
        if (p.finished) return;
        const C = HR_CLIMB, pos = vec2(p.x, p.y), hd = this.head(p);
        if (!p.pin)
        {
            drawLine(pos, vec2(hd.x, hd.y), .14, HR_INK);
            drawCircle(vec2(hd.x, hd.y), C.headR * 2, HR_INK);
            return;
        }
        const pin = p.pin, k = min(1, pin.age / .15), wide = 1 + .35 * (1 - k), deep = 1 - .45 * (1 - k);
        const base = vec2(pin.sx, pin.sy), n = vec2(pin.nx, pin.ny), t = vec2(-pin.ny, pin.nx);
        const points = [];
        for (let i = 0; i <= 12; i++)
        {
            const a = PI * i / 12;
            points.push(t.scale(Math.cos(a) * C.cupR * wide).add(n.scale(Math.sin(a) * C.cupR * deep)));
        }
        drawLine(pos, base.add(n.scale(C.cupR * deep)), .14, HR_INK);
        drawPoly(points, HR_INK, 0, HR_INK, base);
        // white lip along the flat side, so the seal reads against an ink surface
        drawRect(base.add(n.scale(.05)), vec2(C.cupR * 2 * wide, .07), HR_WHITE, -Math.atan2(t.y, t.x));
    },
};
