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
    lungeCrouch: .2,    // past full charge, the squash eases to this as the aim drops flat (.2: 0.64 u tall)...
    lungePitch: .6,     // past full charge, the charge ticks keep climbing to this much more pitch at the flattest aim (full charge is 2x)
    pinch:     .57,     // ...while the sides squeeze in by this much (.57 with .2: 0.44 u wide)...
    lean:      .25,     // ...how far its top leans forward, into the hop, at the flattest aim (u)...
    squint:    .35,     // ...how much the eye narrows then...
    eyeDrop:   .08,     // ...and how far it sits lower (u)
    backLean:  .25,     // charging toward a high hop, the top leans back by up to this much (u), with power times aim height
    lungeKeep: .35,     // a lunge keeps that pose for this share of the jump, then eases back to square by the end

    // auto-run (testing, 2026-10-25): the first press starts a run, then a press jumps and holding jumps higher;
    // walls (grip ones too) turn you around and ice is plain floor. false: the hold-to-charge hop above
    autoRun:   true,
    runSpeed:  6,       // run speed, on the ground and in the air (u/s)
    runJump:   20,      // jump speed straight up while held (u/s): 4.8 u high
    runCut:    6,       // letting go while rising cuts the upward speed to this (u/s): a tap is about 1.5 u high
    coyote:    .08,     // a press this soon after running off an edge still jumps (s)
    runLean:   .06,     // the top leans into the run (u)
};

if (HR_HOP.autoRun) HR_WORLDS.find(w => w.id == 'hop').hint = 'Press: jump · Hold: higher';

const HR_MODES = {};

HR_MODES.hop = {
    reset(p)
    {
        p.grounded = true;
        p.cling = 0;
        p.dir = 1;
        p.t = p.charge = p.flat = 0;
        p.running = p.rising = false;
        p.coyote = 0;
    },

    // level 1's prompt when auto-run replaces the level's own
    prompt: HR_HOP.autoRun ? 'Press A to run, press again to jump!' : undefined,

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
        if (H.autoRun) return this.run(p, input);
        const canCharge = p.grounded || p.cling;
        if (canCharge)
        {
            if (input.down && !p.down) { p.t = 0; p.charge = p.flat = 0; hrEmit('hold', p); }
            if (input.down)
            {
                const before = p.charge + p.flat;
                p.t += dt;
                p.charge = min(1, p.charge + dt / H.chargeT);
                // squash toward the floor, deeper with more power; past full charge, as the aim sweeps back down
                // toward a long flat hop, the squash turns into a squeeze from the sides
                const a = this.aim(p), flat = p.flat = p.charge < 1 ? 0 : smoothStep((H.angleHi - a.angle) / (H.angleHi - H.angleLo));
                p.crouch = H.crouch * p.charge * (1 - flat) + H.lungeCrouch * flat;
                p.pinch = H.pinch * flat;
                // high hops lean back (\), flat lunges lean forward (/); past full charge one turns into the other
                const high = p.charge * smoothStep((a.angle - H.angleLo) / (H.angleHi - H.angleLo));
                p.lean = H.lean * flat - H.backLean * high;
                p.squint = H.squint * flat;
                p.eyeDrop = H.eyeDrop * flat;
                p.look = vec2(Math.cos(a.angle) * p.dir, Math.sin(a.angle));   // the eye looks where you'll hop
                // ticks rise with power, then keep rising past full charge as the aim drops into the flat lunge
                // (and fall back when it swings up again)
                if (floor(min(before, 1.99) * 8) != floor(min(p.charge + flat, 1.99) * 8)) hrSfx.charge.play(undefined, 1, 1 + p.charge + flat * H.lungePitch);
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
                p.lunge = p.flat ? {crouch: p.crouch, pinch: p.pinch, lean: max(0, p.lean), squint: p.squint, eyeDrop: p.eyeDrop,
                    t: 0, T: max(.3, 2 * a.vy / H.gravity)} : undefined;
                if (!p.lunge) p.crouch = p.pinch = p.lean = p.squint = p.eyeDrop = 0;
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

    // auto-run: the first press only starts the run; then a press jumps (from the ground, or just after
    // running off an edge) and letting go early cuts the jump short. Walls turn you around
    run(p, input)
    {
        const H = HR_HOP, dt = timeDelta, solids = hrLevel.solids;
        const press = input.down && !p.down;   // a held button (e.g. after a fall) must be pressed again
        p.down = input.down;
        if (!p.running)
        {
            if (press) { p.running = true; p.pupilKick(-p.dir * .2, 0); hrEmit('hold', p); }
            return;
        }

        p.coyote = p.grounded ? H.coyote : max(0, p.coyote - dt);
        if (press && p.coyote > 0)
        {
            p.vy = H.runJump;
            p.rising = true;
            p.grounded = false;
            p.coyote = 0;
            p.squash = -.3;
            p.landT = -1;
            p.pupilKick(0, -.3);
            hrSfx.jump.play();
            hrEmit('jump', p);
        }
        if (p.rising && !p.down && p.vy > H.runCut) p.vy = H.runCut;   // let go early: a lower jump
        if (p.vy <= 0) p.rising = false;
        p.vx = p.dir * H.runSpeed;
        p.vy -= H.gravity * dt;
        p.lean = H.runLean;

        p.x += p.vx * dt;
        for (const s of solids)
            if (hrOverlapSolid(p.x, p.y, s, .1))   // slightly short so the floor you run on doesn't count
            {
                p.x = p.vx > 0 ? s.l - HR_PSIZE / 2 - .001 : s.r + HR_PSIZE / 2 + .001;
                p.pupilKick(p.dir * .2, 0);
                p.dir = -p.dir;
                p.vx = -p.vx;
                hrSfx.land.play(undefined, .5, 1.3);
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
                    if (!wasGrounded)
                    {
                        p.pupilKick(0, max(-.3, p.vy * .015));
                        p.land = min(.35, .12 + -p.vy * .012);
                        p.landT = 0;
                        hrSfx.land.play();
                        hrDust(p.x, p.y - HR_PSIZE / 2);
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
    },

    // the lunge pose in flight: held for lungeKeep of the airtime, then eased back to square
    easeLunge(p)
    {
        const L = p.lunge, k = 1 - smoothStep(clamp(((L.t += timeDelta) / L.T - HR_HOP.lungeKeep) / (1 - HR_HOP.lungeKeep)));
        for (const key of ['crouch', 'pinch', 'lean', 'squint', 'eyeDrop']) p[key] = L[key] * k;
        if (!k) p.lunge = undefined;
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

    // no aim arrow or power bar: the player's own squash and squeeze show the charge and the aim
    draw() {},
};
