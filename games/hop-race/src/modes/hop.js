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

        if (p.grounded) return;

        if (p.cling)
        {
            // slide slowly down the wall; let go if the wall ends
            p.vx = 0;
            p.vy = max(-H.clingSlide, p.vy - H.clingAccel * dt);
            const px = p.x + p.cling * .06;
            if (!solids.some(s => hrOverlapSolid(px, p.y, s))) p.cling = 0;
        }
        else
            p.vy -= H.gravity * dt;

        p.x += p.vx * dt;
        for (const s of solids)
            if (hrOverlapSolid(p.x, p.y, s))
            {
                const side = p.vx > 0 ? 1 : -1;
                p.x = side > 0 ? s.l - HR_PSIZE / 2 - .001 : s.r + HR_PSIZE / 2 + .001;
                if (s.grip)
                {
                    p.cling = side;
                    p.dir = -side;          // turn to face away from the wall
                    p.vx = 0;
                    p.vy = max(p.vy, -H.clingSlide);
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
                    p.dir = 1;
                    p.pupilKick(0, max(-.3, p.vy * .015));
                    p.land = min(.35, .12 + -p.vy * .012);   // harder landings squeeze more
                    p.landT = 0;
                    p.vx = p.vy = 0;
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

    draw(p)
    {
        if (!(p.grounded || p.cling) || !p.down) return;
        const a = this.aim(p);
        // trajectory preview: small ink squares fading along the arc
        for (let i = 1; i < 40; i++)
        {
            const t = i * .06;
            const x = p.x + a.vx * t;
            const y = p.y + a.vy * t - .5 * HR_HOP.gravity * t * t;
            if (y < hrLevel.killY) break;
            if (hrLevel.solids.some(s => hrOverlapSolid(x, y, s))) break;
            drawRect(vec2(x, y), vec2(.16), HR_INK.scale(1, 1 - i / 45));
        }
        // power bar: thin ink outline above the player, filling with ink
        const top = p.y + HR_PSIZE * (.5 - hrSquashY(p));   // follows the squashed top
        const bar = vec2(p.x, top + .65), w = 1.1;
        drawRect(bar, vec2(w + .1, .26), HR_INK);
        drawRect(bar, vec2(w, .16), hrWorldBg());
        drawRect(vec2(bar.x - w / 2 + w * p.charge / 2, bar.y), vec2(w * p.charge, .16), HR_INK);
    },
};
