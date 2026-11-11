/*
    HOP RACE - World 1, Hop (GDD §3.2). Auto-run: after a 3-2-1 countdown a press starts the run, then a press
    jumps at once and holding jumps higher. Walls turn you around, except a grip wall hit in the air, which you
    cling to and jump off; ice speeds you up. (The prototype's hold-to-charge hop was replaced on 2026-11-10;
    it is in git history before that date.)
*/

'use strict';

const HR_HOP = {
    gravity:   42,
    clingSlide: 3,      // top slide speed down a grip wall (u/s)
    clingAccel: 12,
    runSpeed:  6,       // run speed (u/s); in the air you keep the speed you took off with
    iceSpeed:  15,      // on ice the run speeds up to this (u/s)...
    iceAccel:  9,       // ...at this rate (u/s²)
    groundBrake: 10,    // off the ice, a faster run slows back to runSpeed at this rate (u/s²)
    dashCost:  .35,     // at full ice speed the takeoff is this much weaker: a long, low dash
    runJump:   12,      // takeoff speed straight up (u/s): a tap is about 1.7 u high
    holdGravity: 12,    // lighter gravity while you hold and rise, for up to holdTime: held all the way, about 4.5 u high
    holdTime:  .4,      // (s)
    coyote:    .08,     // a press this soon after running off an edge still jumps (s)
    runLean:   .15,     // on the ground the top leans into the run (u), more the faster you go...
    maxLean:   .26,     // ...up to this (u)
    iceLean:   .42,     // on ice the lean grows past maxLean to this at full ice speed (u)...
    iceCrouch: .2,      // ...and the runner squashes this much flatter, low to the ground
    flipTime:  .4,      // a hold that lasts the whole holdTime ends in a forward somersault this long (s)
    landSquash: .2,     // landing squeeze: this much flatter, plus more for a harder landing (up to .4)
};

const HR_MODES = {};

HR_MODES.hop = {
    reset(p)
    {
        p.grounded = true;
        p.cling = 0;
        p.dir = 1;
        p.running = p.rising = false;
        p.coyote = p.spin = 0;
        p.speed = HR_HOP.runSpeed;
        p.onIce = false;
        p.flipT = -1;   // somersault time, -1 when not flipping
    },

    countdown: true,   // 3-2-1-GO before every solo level too, then a press starts the run

    // after GO a press starts the run (so Versus starts aren't in sync); then a press jumps at once (on the ground, or just after
    // running off an edge) and holding keeps rising higher, up to holdTime. Walls turn you around
    step(p, input)
    {
        const H = HR_HOP, dt = timeDelta, solids = hrLevel.solids;
        const press = input.down && !p.down;   // a held button (e.g. after a fall) must be pressed again
        p.down = input.down;
        if (!p.running)
        {
            if (hrCountdown > 0 || !press) return;   // waiting for GO (main.js), then for a press, after a fall too
            p.running = true;
            p.pupilKick(-p.dir * .2, 0);
            return;   // the starting press doesn't also jump
        }

        p.coyote = p.grounded ? H.coyote : max(0, p.coyote - dt);
        if (press && (p.coyote > 0 || p.cling))
        {
            if (p.cling) p.x += p.dir * .02;   // a wall jump: step off the wall, already facing away from it
            p.cling = 0;
            // the faster you run, the weaker the takeoff: speed from the ice turns a jump into a long, low dash
            p.vy = H.runJump * (1 - H.dashCost * clamp((p.speed - H.runSpeed) / (H.iceSpeed - H.runSpeed)));
            p.rising = true;
            p.holdT = 0;
            p.grounded = false;
            p.coyote = 0;
            p.squash = -.3;   // launch stretch
            p.landT = -1;
            p.pupilKick(-p.dir * .1, -.3);
            hrSfx.jump.play();
            hrEmit('hold', p);
            hrEmit('jump', p);
        }
        // holding keeps gravity light for a while, so the jump floats higher; letting go ends it for this jump.
        // Holding all the way through holdTime throws a forward somersault
        if (p.rising && p.down && (p.holdT += dt) >= H.holdTime && p.flipT < 0) { p.flipT = 0; p.flipDir = p.dir; }
        if (!p.down || p.vy <= 0 || p.holdT >= H.holdTime) p.rising = false;
        if (p.grounded)
            p.speed = p.onIce ? min(H.iceSpeed, p.speed + H.iceAccel * dt) : max(H.runSpeed, p.speed - H.groundBrake * dt);
        if (p.cling)
        {
            // on a grip wall: slide slowly down it; let go and fall if it ends
            p.vx = 0;
            p.vy = max(-H.clingSlide, p.vy - H.clingAccel * dt);
            if (!solids.some(s => hrOverlapSolid(p.x + p.cling * .06, p.y, s))) p.cling = 0;
        }
        else
        {
            p.vx = p.dir * p.speed;
            p.vy -= (p.rising ? H.holdGravity : H.gravity) * dt;
        }

        p.x += p.vx * dt;
        for (const s of solids)
            if (hrOverlapSolid(p.x, p.y, s, .1))   // slightly short so the floor you run on doesn't count
            {
                const side = p.vx > 0 ? 1 : -1;
                p.x = side > 0 ? s.l - HR_PSIZE / 2 - .001 : s.r + HR_PSIZE / 2 + .001;
                p.dir = -side;          // turn around (or, clinging, face away from the wall)
                p.speed = H.runSpeed;   // a bump costs the ice speed
                if (s.grip && !p.grounded)
                {
                    // a grip wall hit in the air holds you: no riding up it, and a press jumps you off
                    p.cling = side;
                    p.vx = 0;
                    p.vy = clamp(p.vy, -H.clingSlide, 0);
                    p.rising = false;
                    p.squash = .2;
                    p.pupilKick(side * .15, 0);
                    hrSfx.land.play(undefined, .6, 1.5);
                }
                else
                {
                    p.vx = p.dir * p.speed;
                    p.pupilKick(side * .2, 0);
                    hrSfx.land.play(undefined, .5, 1.3);
                }
            }

        const prevY = p.y, wasGrounded = p.grounded;
        p.grounded = false;
        p.y += p.vy * dt;
        for (const s of solids)
            if (hrOverlapSolid(p.x, p.y, s))
            {
                if (p.vy <= 0 && prevY - HR_PSIZE / 2 >= s.top - .15)
                {
                    p.y = s.top + HR_PSIZE / 2;
                    p.grounded = true;
                    p.cling = 0;
                    p.onIce = s.ice;
                    if (!wasGrounded)
                    {
                        p.pupilKick(0, max(-.3, p.vy * .015));
                        p.land = min(.4, H.landSquash + -p.vy * .015);
                        p.landT = 0;
                        hrSfx.land.play();
                        hrDust(p.x, p.y - HR_PSIZE / 2);
                        if (s.ice) hrSplash(p.x, p.y - HR_PSIZE / 2);
                        hrEmit('land', p);
                    }
                    p.vy = 0;
                }
                else if (p.vy > 0)
                {
                    p.y = s.bottom - HR_PSIZE / 2;   // bonk head on the underside
                    p.vy = 0;
                }
            }

        // somersault: a full turn forward (clockwise when facing right), eased; landing mid-flip rolls the rest quickly
        if (p.flipT >= 0)
        {
            p.flipT += dt * (p.grounded || p.cling ? 4 : 1);
            const k = min(1, p.flipT / H.flipTime);
            p.spin = k < 1 ? smoothStep(k) * 2 * PI * p.flipDir : 0;
            if (k >= 1) p.flipT = -1;
        }
        // lean into the run on the ground (more the faster you go), straighten up in the air.
        // On ice the ice speed pushes the lean further and squashes the runner low to the ground
        const upright = p.grounded && p.flipT < 0, ice = upright && p.onIce ? clamp((p.speed - H.runSpeed) / (H.iceSpeed - H.runSpeed)) : 0;
        const lean = min(H.maxLean, H.runLean * p.speed / H.runSpeed);
        p.lean += ((upright ? lerp(lean, H.iceLean, ice) : 0) - p.lean) * min(1, dt * 12);
        p.crouch += (H.iceCrouch * ice - p.crouch) * min(1, dt * 12);
        if (p.grounded && p.onIce && p.speed > H.runSpeed + 1 && rand() < .3) hrSparkle(p.x, p.y - HR_PSIZE / 2);
        // droplets flicked up and back from the foot on the ice, more the faster you go
        if (p.grounded && p.onIce && rand() < .25 + .6 * ice) hrDroplet(p.x - p.dir * HR_PSIZE * .3, p.y - HR_PSIZE / 2, p.dir, ice);
    },

    draw() {},
};
