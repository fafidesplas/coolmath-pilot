/*
    HOP RACE - World 1, Hop (GDD §3.2). Hold to charge and sweep the aim, release to jump.
    Ported from the prototype's Classic + Wall Jump (prototype/game.js rcStep).
*/

'use strict';

const HR_HOP = {
    gravity:   42,
    vMin:      9,       // jump speed with no charge (u/s)
    vMax:      20,      // jump speed at full charge (u/s); the prototype's 25 less 20 % for 24-30 u levels
    chargeT:   1.1,     // seconds to full power
    angleLo:   18 * PI / 180,
    angleHi:   80 * PI / 180,
    sweep:     2.6,     // aim sweep speed (rad/s)
    wallBounce: .35,    // plain walls reverse horizontal speed at 35 %
    clingSlide: 3,      // top slide speed down a grip wall (u/s)
    clingAccel: 12,
    clingChargeSlide: .5,      // slower slide while you charge on a grip wall (u/s): 0 holds you still, 3 is no slower
    iceKeep:   .8,      // landing on ice keeps 80 % of your horizontal speed...
    iceMin:    2,       // ...if it was over 2 u/s; slower landings stop dead
    iceFriction: .8,    // sliding on ice slows you at this rate (1/s)
    crouch:    .45,     // how much flatter the player gets at full charge
};

const HR_MODES = {};

HR_MODES.hop = {
    reset(p)
    {
        p.grounded = true;
        p.cling = 0;
        p.dir = 1;
        p.t = p.charge = 0;
    },

    aim(p)
    {
        const H = HR_HOP;
        const angle = H.angleLo + (H.angleHi - H.angleLo) * (.5 - .5 * Math.cos(p.t * H.sweep));
        const speed = H.vMin + (H.vMax - H.vMin) * p.charge;
        return {angle, speed, vx: Math.cos(angle) * speed * p.dir, vy: Math.sin(angle) * speed};
    },

    step(p, input)
    {
        const H = HR_HOP, dt = timeDelta, solids = hrLevel.solids;
        const canCharge = p.grounded || p.cling;
        if (canCharge)
        {
            if (input.down && !p.down) { p.t = 0; p.charge = 0; hrEmit('hold', p); }
            if (input.down)
            {
                const before = p.charge;
                p.t += dt;
                p.charge = min(1, p.charge + dt / H.chargeT);
                p.crouch = H.crouch * p.charge;   // squash toward the floor, deeper with more power
                if (floor(before * 8) != floor(p.charge * 8)) hrSfx.charge.play(undefined, 1, 1 + p.charge);
            }
            else if (p.down)
            {
                const a = this.aim(p);
                p.vx = a.vx; p.vy = a.vy;
                p.x += p.dir * .02;           // step off the wall
                p.grounded = false;
                p.cling = 0;
                p.squash = -.3;
                p.landT = -1;   // the launch stretch replaces any landing squeeze
                p.crouch = 0;
                p.pupilKick(-a.vx * .02, -a.vy * .02);
                hrSfx.jump.play(undefined, 1, 1 - p.charge * .4);
                hrEmit('jump', p);
            }
        }
        p.down = input.down && canCharge;

        if (p.grounded) return this.slide(p);

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
                    p.t = p.charge = 0;
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
                    p.t = p.charge = 0;
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

    // grounded on ice with speed left: slide, stop at walls, drop off edges. You can charge while sliding
    slide(p)
    {
        if (!p.vx) return;
        const H = HR_HOP, dt = timeDelta, solids = hrLevel.solids, foot = p.y - HR_PSIZE / 2;
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

    draw(p)
    {
        if (!(p.grounded || p.cling) || !p.down) return;
        const a = this.aim(p);
        // launch arrow: a short ink arrow off the player along the launch direction, a little longer with power.
        // Only the direction shows, not the arc, so where you land stays a surprise. It starts 1.3 u out so
        // it clears the power bar at every aim angle
        const d = vec2(a.vx, a.vy).normalize(), n = vec2(-d.y, d.x);
        const tail = vec2(p.x, p.y).add(d.scale(1.3));
        const tip = tail.add(d.scale(.5 + .4 * p.charge)), neck = tip.subtract(d.scale(.3));
        drawLine(tail, neck, .14, HR_INK);
        drawPoly([tip, neck.add(n.scale(.2)), neck.subtract(n.scale(.2))], HR_INK);
        // power bar: thin ink outline above the player, filling with ink
        const top = p.y + HR_PSIZE * (.5 - hrSquashY(p));   // follows the squashed top
        const bar = vec2(p.x, top + .65), w = 1.1;
        drawRect(bar, vec2(w + .1, .26), HR_INK);
        drawRect(bar, vec2(w, .16), hrWorldBg());
        drawRect(vec2(bar.x - w / 2 + w * p.charge / 2, bar.y), vec2(w * p.charge, .16), HR_INK);
    },
};
