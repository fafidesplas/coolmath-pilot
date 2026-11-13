/*
    HOP RACE - World 5, Leap (GDD §3.8). Hold to charge, release to jump: a tap is a short, low dash forward, and the
    longer you hold the higher and farther you go, up to a full leap (no aim sweep since 2026-11-13). Grew from the
    hold-to-charge hop that was Hop's rule until 2026-11-10 (Hop is an auto-runner now).
    Ported from the prototype's Classic + Wall Jump (prototype/game.js rcStep). No auto-run and no countdown in solo.
*/

'use strict';

const HR_LEAP = {
    gravity:   42,
    // power sets both speed and angle, from a tap (vMin at angleLo: a short, low dash) to full charge (vMax at
    // angleHi: the highest, farthest leap); holding past full charge keeps it there
    vMin:      10,      // jump speed with no charge (u/s)
    vMax:      21,      // jump speed at full charge (u/s)
    chargeT:   1.1,     // seconds to full power
    angleLo:   15 * PI / 180,
    angleHi:   60 * PI / 180,
    dashZone:  .4,      // below this much charge the player holds the dash pose (low and upright: no side squeeze, no lean), easing out by here
    wallBounce: .35,    // plain walls reverse horizontal speed at 35 %
    clingSlide: 3,      // top slide speed down a grip wall (u/s)
    clingAccel: 12,
    clingChargeSlide: .5,      // slower slide while you charge on a grip wall (u/s): 0 holds you still, 3 is no slower
    iceKeep:   .8,      // landing on ice keeps 80 % of your horizontal speed...
    iceMin:    2,       // ...if it was over 2 u/s; slower landings stop dead
    iceFriction: .8,    // sliding on ice slows you at this rate (1/s)
    crouch:    .45,     // how much flatter the player gets at full charge
    lungeCrouch: .2,    // in the dash pose the squash is this (.2: 0.8 of the full height, 1.12 of the width)...
    squint:    .35,     // ...how much the eye narrows then...
    eyeDrop:   .08,     // ...and how far it sits lower (u)
    backLean:  .25,     // charging toward a full leap, the top leans back by up to this much (u)
    lungeKeep: .35,     // a lunge keeps that pose for this share of the jump, then eases back to square by the end
};

HR_MODES.leap = {
    reset(p)
    {
        p.grounded = true;
        p.cling = 0;
        p.dir = 1;
        p.charge = p.flat = 0;
        p.running = false;
        p.spin = 0;
        p.lunge = undefined;
    },

    aim(p)
    {
        const H = HR_LEAP;
        const angle = lerp(H.angleLo, H.angleHi, p.charge), speed = lerp(H.vMin, H.vMax, p.charge);
        return {angle, speed, vx: Math.cos(angle) * speed * p.dir, vy: Math.sin(angle) * speed};
    },

    step(p, input)
    {
        const H = HR_LEAP, dt = timeDelta, solids = hrLevel.solids;
        const canCharge = p.grounded || p.cling;
        if (canCharge)
        {
            if (input.down && !p.down) { p.charge = p.flat = 0; hrEmit('hold', p); }
            if (input.down)
            {
                const before = p.charge;
                p.charge = min(1, p.charge + dt / H.chargeT);
                // a fresh press is a dash: a little low, upright, not squeezed from the sides. As power builds, that eases
                // into a squash toward the floor that leans back, deepest at a full leap
                const a = this.aim(p), flat = p.flat = 1 - smoothStep(clamp(p.charge / H.dashZone));
                p.crouch = H.crouch * p.charge * (1 - flat) + H.lungeCrouch * flat;
                p.lean = -H.backLean * p.charge * (1 - flat);
                p.squint = H.squint * flat;
                p.eyeDrop = H.eyeDrop * flat;
                p.look = vec2(Math.cos(a.angle) * p.dir, Math.sin(a.angle));   // the eye looks where you'll leap
                // ticks rise with power and stop at full charge
                if (floor(min(before, .99) * 8) != floor(min(p.charge, .99) * 8)) hrSfx.charge.play(undefined, 1, 1 + p.charge);
            }
            else if (p.down)
            {
                const a = this.aim(p);
                p.vx = a.vx; p.vy = a.vy;
                p.x += p.dir * .02;           // step off the wall
                p.grounded = false;
                p.cling = 0;
                p.squash = -.3 * (1 - p.flat);   // a flat lunge doesn't stretch up
                p.landT = -1;   // the launch stretch replaces any landing squeeze
                // a lunge flies in its pose, easing back over the jump's airtime (to launch height, at least .3 s)
                p.lean = 0;   // the back lean doesn't fly with you
                p.lunge = p.flat ? {crouch: p.crouch, squint: p.squint, eyeDrop: p.eyeDrop,
                    t: 0, T: max(.3, 2 * a.vy / H.gravity)} : undefined;
                if (!p.lunge) p.crouch = p.squint = p.eyeDrop = 0;
                p.pupilKick(-a.vx * .02, -a.vy * .02);
                hrSfx.jump.play(undefined, 1, 1 - p.charge * .4);
                hrEmit('jump', p);
            }
        }
        p.down = input.down && canCharge;

        if (p.grounded || p.cling) p.lunge = undefined;
        if (p.grounded) return this.slide(p);
        if (p.lunge) this.easeLunge(p);

        if (p.cling)
        {
            // slide slowly down the wall (slower while charging: the wall grips); let go if the wall ends
            p.vx = 0;
            p.vy = max(-(p.down ? H.clingChargeSlide : H.clingSlide), p.vy - H.clingAccel * dt);
            const px = p.x + p.cling * .06;
            if (!solids.some(s => hrOverlapSolid(px, p.y, s))) p.cling = 0;
        }
        else
            p.vy -= H.gravity * dt;

        p.x += p.vx * dt;
        for (const s of solids)
            if (hrOverlapSolid(p.x, p.y, s, .1))   // slightly short so the floor we take off from doesn't count
            {
                const side = p.vx > 0 ? 1 : -1;
                p.x = side > 0 ? s.l - HR_PSIZE / 2 - .001 : s.r + HR_PSIZE / 2 + .001;
                if (s.grip)
                {
                    p.cling = side;
                    p.dir = -side;          // turn to face away from the wall
                    p.vx = 0;
                    p.vy = clamp(p.vy, -H.clingSlide, 0);   // you stop: no riding up the wall on a hard launch
                    p.charge = 0;
                    p.squash = .2;
                    p.pupilKick(side * .15, 0);
                    hrSfx.land.play(undefined, .6, 1.5);
                }
                else
                {
                    p.vx *= -H.wallBounce;
                    p.pupilKick(side * .2, 0);
                }
            }

        const prevY = p.y;
        p.y += p.vy * dt;
        for (const s of solids)
            if (hrOverlapSolid(p.x, p.y, s))
            {
                if (p.vy <= 0 && prevY - HR_PSIZE / 2 >= s.top - .15)
                {
                    p.y = s.top + HR_PSIZE / 2;
                    p.grounded = true;
                    p.cling = 0;
                    // you face right on the ground, but away from a grip wall you land against, so a jump
                    // from its foot crosses the shaft instead of clinging back onto it
                    p.dir = solids.some(o => o.grip && hrOverlapSolid(p.x + .05, p.y, o, .1)) ? -1 : 1;
                    p.pupilKick(0, max(-.3, p.vy * .015));
                    p.land = min(.35, .12 + -p.vy * .012);   // harder landings squeeze more
                    p.landT = 0;
                    // GDD §3.2: you land where you aimed, except on ice, which keeps most of a fast landing
                    p.vx = s.ice && abs(p.vx) > H.iceMin ? p.vx * H.iceKeep : 0;
                    p.vy = 0;
                    p.charge = 0;
                    hrSfx.land.play();
                    hrDust(p.x, p.y - HR_PSIZE / 2);
                    hrEmit('land', p);
                }
                else if (p.vy > 0)
                {
                    p.y = s.bottom - HR_PSIZE / 2;   // bonk head on the underside
                    p.vy = 0;
                }
            }
    },

    // the lunge pose in flight: held for lungeKeep of the airtime, then eased back to square
    easeLunge(p)
    {
        const L = p.lunge, k = 1 - smoothStep(clamp(((L.t += timeDelta) / L.T - HR_LEAP.lungeKeep) / (1 - HR_LEAP.lungeKeep)));
        for (const key of ['crouch', 'squint', 'eyeDrop']) p[key] = L[key] * k;
        if (!k) p.lunge = undefined;
    },

    // grounded on ice with speed left: slide, stop at walls, drop off edges. You can charge while sliding
    slide(p)
    {
        if (!p.vx) return;
        const H = HR_LEAP, dt = timeDelta, solids = hrLevel.solids, foot = p.y - HR_PSIZE / 2;
        p.vx *= Math.exp(-H.iceFriction * dt);
        if (abs(p.vx) < .05) return p.vx = 0;
        p.x += p.vx * dt;
        for (const s of solids)
            if (hrOverlapSolid(p.x, p.y, s, .1))
            {
                p.x = p.vx > 0 ? s.l - HR_PSIZE / 2 - .001 : s.r + HR_PSIZE / 2 + .001;   // walls stop a slide
                p.pupilKick(sign(p.vx) * .2, 0);
                hrSfx.land.play(undefined, .5, 1.3);
                return p.vx = 0;
            }
        const under = solids.filter(s => p.x + HR_PSIZE / 2 > s.l && p.x - HR_PSIZE / 2 < s.r && abs(s.top - foot) < .02);
        if (!under.length) { p.grounded = false; p.vy = 0; return; }   // slid off the edge
        if (!under.some(s => s.ice)) return p.vx = 0;                  // off the ice: stop dead
        if (abs(p.vx) > 2 && rand() < .3) hrSparkle(p.x, foot);
    },

    // no aim arrow or power bar: the player's own squash and squeeze show the charge and the aim
    draw() {},
};
