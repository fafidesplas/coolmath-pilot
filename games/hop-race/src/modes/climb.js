/*
    HOP RACE - Lab world, Climb (GDD §3.7). A stiff arm with a round head sticks out of the player.
    Hold to whip it around clockwise, let go to stop it where it is. Inspired by Getting Over It.

    The arm is always solid: the head never passes through anything. Wherever the arm would push the
    head into a solid, the body is pushed the other way instead, so a fast strike on the ground pops you
    up and forward (the head's friction on the surface turns the swing into a shove).
    Let go and the arm freezes at its angle; if the head is touching a surface (or touches one later),
    it grips it, so you can perch on the arm or hang from a wall. It lets go when you hold again, or
    when gravity pulls it away from the surface (hanging under a ceiling).
*/

'use strict';

const HR_CLIMB = {
    gravity:    42,
    arm:        2,      // body center to head center (u)
    headR:      .24,    // head radius (u)
    spin:       10,     // arm turn speed while held (rad/s); the head moves at spin × arm u/s
    friction:   100,    // head friction on surfaces while turning (high: the head never slips, so a strike levers the body)
    maxSpeed:   20,     // speed cap for the body (u/s)
    ground:     8,      // ground friction for the body (1/s)
    substeps:   4,      // so a fast head never skips a thin solid
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
        p.pin = null;       // {x, y, nx, ny}: where the head grips a surface while the arm is frozen
        p.strikeT = 0;
    },

    head(p) { return {x: p.x + Math.cos(p.aimA) * HR_CLIMB.arm, y: p.y + Math.sin(p.aimA) * HR_CLIMB.arm}; },

    step(p, input)
    {
        const C = HR_CLIMB, h = timeDelta / C.substeps, vy0 = p.vy;
        p.down = input.down;
        if (p.down) p.pin = null;
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
        if (turning) p.aimA -= C.spin * h;

        let grounded = this.solve(p, turning, head0);
        if (turning && this.jammed(p))
        {
            // the arm is wedged: it can't turn this substep
            p.x = x0 + p.vx * h; p.y = y0 + p.vy * h; p.aimA = a0;
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
                // gripping: the head stays put unless the body pulls it off the surface
                const dx = hd.x - p.pin.x, dy = hd.y - p.pin.y;
                if (dx * p.pin.nx + dy * p.pin.ny > .02) p.pin = null;
                else { p.x -= dx; p.y -= dy; }
            }
            else
            {
                const out = hrClimbHeadOut(hd.x, hd.y), pen = Math.hypot(out.x, out.y);
                if (pen > 0)
                {
                    const nx = out.x / pen, ny = out.y / pen;
                    p.x += out.x; p.y += out.y;
                    if (turning)
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
                    else if (!p.down) p.pin = {x: hd.x + out.x, y: hd.y + out.y, nx, ny};   // the arm is frozen: the head grips here
                }
            }
            grounded = hrClimbBodyOut(p) || grounded;
        }
        return grounded;
    },

    jammed(p)
    {
        const hd = this.head(p), out = hrClimbHeadOut(hd.x, hd.y);
        return Math.hypot(out.x, out.y) > .02 || hrLevel.solids.some(s => hrOverlapSolid(p.x, p.y, s, .02));
    },

    // the arm: an ink bar from the body to a round ink head; a white dot on the head while it grips
    draw(p)
    {
        if (p.finished) return;
        const C = HR_CLIMB, pos = vec2(p.x, p.y), hd = this.head(p), tip = vec2(hd.x, hd.y);
        drawLine(pos, tip, .14, HR_INK);
        drawCircle(tip, C.headR * 2, HR_INK);
        if (p.pin) drawCircle(tip, C.headR * .8, HR_WHITE);
    },
};
