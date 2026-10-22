/*
    HOP RACE - Lab world, Climb (GDD §3.7). A stiff arm with a round head sticks out of the player.
    Hold to turn it clockwise, let go to stop it. The head sticks to whatever it touches, so turning the
    arm while the head is stuck levers the body around it: on flat ground that rolls you along like a
    wheel, against a wall it walks you up. Inspired by Getting Over It.

    Two states:
    - free: the body falls and collides as usual and the arm turns around it (fast). When the head
      runs into a solid it sticks there.
    - stuck: the head is a fixed point and the body sits at arm's length from it. Turning the arm moves
      the body around the head (slower, it's doing work); letting go holds you still (or, with
      HR_CLIMB.letGo, lets go of the head so you fly on). If the body would run into a solid, the head
      lets go and you are free again.
*/

'use strict';

const HR_CLIMB = {
    gravity:    42,
    arm:        2,      // body center to head center (u)
    headR:      .24,    // head radius (u)
    spinFree:   8,      // arm turn speed with the head free (rad/s)
    spinStuck:  4,      // arm turn speed with the head stuck, levering the body (rad/s)
    maxSpeed:   16,     // speed cap for the body (u/s)
    friction:   8,      // ground friction (1/s)
    wallSlide:  2.5,    // the body grips walls: top slide speed down one (u/s); 0 turns it off
    wallAccel:  10,
    letGo:      false,  // false: letting go while stuck holds you still; true: it lets go of the head and you fly on
};

// closest point on a solid to (x, y); inside the solid it is the nearest edge point instead
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

// how far the head at (x, y) must move to be clear of every solid (0 if it already is)
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

function hrClimbBodyHits(x, y)
{
    return hrLevel.solids.some(s => hrOverlapSolid(x, y, s, .002));
}

HR_MODES.climb = {
    reset(p)
    {
        p.grounded = true;
        p.dir = 1;
        p.aimA = PI * .6;   // arm up and a little back
        p.head = null;      // {x, y} while the head is stuck
        p.ghost = false;    // after the head lets go it can't stick again until it is clear of solids
        p.cling = 0;
    },

    step(p, input)
    {
        const C = HR_CLIMB, dt = timeDelta;
        p.down = input.down;
        const turning = input.down;
        const dir = () => vec2(Math.cos(p.aimA), Math.sin(p.aimA));

        if (p.head)
        {
            // stuck: the body moves around the head
            if (!turning && !C.letGo) { p.vx = p.vy = 0; return; }
            const a = p.aimA - C.spinStuck * dt;
            const bx = p.head.x - C.arm * Math.cos(a), by = p.head.y - C.arm * Math.sin(a);
            if (!turning)
            {
                // let go: keep the speed the lever gave you
                p.head = null;
                p.ghost = true;
            }
            else if (hrClimbBodyHits(bx, by))
            {
                // the body is blocked: the head lets go and the arm turns on freely
                p.head = null;
                p.ghost = true;
                hrSfx.land.play(undefined, .4, 1.6);
            }
            else
            {
                p.vx = (bx - p.x) / dt; p.vy = (by - p.y) / dt;
                p.x = bx; p.y = by;
                p.aimA = a;
                p.grounded = false;
                p.cling = 0;
                return;
            }
        }

        // free: gravity, collisions, the arm turns around the body
        if (turning) p.aimA -= C.spinFree * dt;
        if (p.cling) p.vy = max(-C.wallSlide, p.vy - C.wallAccel * dt);
        else p.vy -= C.gravity * dt;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > C.maxSpeed) { p.vx *= C.maxSpeed / sp; p.vy *= C.maxSpeed / sp; }

        p.x += p.vx * dt;
        let wall = 0;
        for (const s of hrLevel.solids)
            if (hrOverlapSolid(p.x, p.y, s, .1))
            {
                const side = p.vx > 0 ? 1 : -1;
                p.x = side > 0 ? s.l - HR_PSIZE / 2 - .001 : s.r + HR_PSIZE / 2 + .001;
                p.vx = 0;
                wall = side;
            }

        const prevY = p.y, wasGrounded = p.grounded;
        p.y += p.vy * dt;
        p.grounded = false;
        for (const s of hrLevel.solids)
            if (hrOverlapSolid(p.x, p.y, s))
            {
                if (p.vy <= 0 && prevY - HR_PSIZE / 2 >= s.top - .2)
                {
                    p.y = s.top + HR_PSIZE / 2;
                    if (!wasGrounded && p.vy < -6)
                    {
                        p.land = min(.3, .1 + -p.vy * .012);
                        p.landT = 0;
                        hrSfx.land.play();
                        hrDust(p.x, p.y - HR_PSIZE / 2);
                    }
                    p.vy = 0;
                    p.grounded = true;
                }
                else if (p.vy > 0 && prevY + HR_PSIZE / 2 <= s.bottom + .2)
                {
                    p.y = s.bottom - HR_PSIZE / 2;
                    p.vy = 0;
                }
            }
        if (p.grounded)
        {
            p.vx *= Math.exp(-C.friction * dt);
            if (abs(p.vx) < .05) p.vx = 0;
        }

        // the body grips a wall it touches in the air and slides down it slowly
        if (C.wallSlide && !p.grounded)
        {
            const touching = side => hrLevel.solids.some(s => hrOverlapSolid(p.x + side * .03, p.y, s, .1));
            const was = p.cling;
            p.cling = wall || (p.cling && touching(p.cling) ? p.cling : touching(1) ? 1 : touching(-1) ? -1 : 0);
            if (p.cling && !was) { p.vx = 0; p.vy = max(p.vy, -C.wallSlide); }
        }
        else p.cling = 0;

        // the head: stick where it runs into a solid
        const d = dir(), hx = p.x + d.x * C.arm, hy = p.y + d.y * C.arm;
        const out = hrClimbHeadOut(hx, hy);
        const inside = out.x || out.y;
        if (p.ghost)
        {
            if (hrLevel.solids.every(s => hrClimbPush(hx, hy, s).d > C.headR + .05)) p.ghost = false;
        }
        else if (inside)
        {
            // the body takes the push, so the head stays on the surface
            const bx = p.x + out.x, by = p.y + out.y;
            if (hrClimbBodyHits(bx, by)) p.ghost = true;
            else
            {
                p.x = bx; p.y = by;
                p.head = {x: hx + out.x, y: hy + out.y};
                p.vx = p.vy = 0;
                p.grounded = false;
                p.cling = 0;
                hrSfx.click.play(vec2(p.head.x, p.head.y), 1, .8);
                p.pupilKick(d.x * .15, d.y * .15);
                hrEmit('fire', p);
            }
        }
        if (abs(p.vx) > 1) p.dir = sign(p.vx);
    },

    // the arm: an ink bar from the body to a round ink head; a white dot on the head while it is stuck
    draw(p)
    {
        if (p.finished) return;
        const C = HR_CLIMB, pos = vec2(p.x, p.y);
        const tip = p.head ? vec2(p.head.x, p.head.y) : pos.add(vec2(Math.cos(p.aimA), Math.sin(p.aimA)).scale(C.arm));
        drawLine(pos, tip, .14, HR_INK);
        drawCircle(tip, C.headR * 2, HR_INK);
        if (p.head) drawCircle(tip, C.headR * .8, HR_WHITE);
    },
};
