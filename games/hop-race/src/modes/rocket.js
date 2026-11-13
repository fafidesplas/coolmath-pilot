/*
    HOP RACE - World 2, Rocket (GDD §3.3). Hold to turn the launcher clockwise; release to fire (owner, 2026-11-13).
    Your blasts push only you, and rockets fly through the other player (owner, 2026-11-11). Ported from the prototype's Rocket Jump
    (prototype/game.js rcRocketStep, rcMotion, rcExplode, rcRocketsUpdate).
*/

'use strict';

const HR_ROCKET = {
    gravity:   42,
    spin:      3,       // launcher rotation while the button is held (rad/s), clockwise; it stays still otherwise
    speed:     38,      // rocket speed (u/s)
    cooldown:  .1,
    recoil:    4,       // kick opposite the firing direction (u/s)
    radius:    4,       // blast radius (u)
    switchRadius: 2.5,  // a blast this close to a button presses it
    power:     24,      // blast speed at the center (u/s); the prototype's 30 less 20 % for 24-30 u levels
    maxSpeed:  22,      // top speed after a blast; the prototype's 27 less 20 %
    friction:  7,       // ground friction (1/s)
    iceFriction: .6,
    stickyPush: .5,     // blasts push at 50 % while standing on a sticky floor
    wallBounce: .3,
    clingSlide: 3,      // top slide speed down a grip wall (u/s)
};

let hrRockets = [], hrBlasts = [];

HR_MODES.rocket = {
    reset(p)
    {
        p.grounded = true;
        p.floor = null;
        p.dir = 1;
        p.aimA = PI * 1.25;   // start pointing down-left, so the first press pushes you up and forward
        p.cool = 0;
        p.cling = 0;
        hrRockets = hrRockets.filter(r => r.owner != p);
    },

    clear() { hrRockets = []; hrBlasts = []; },

    // rockets and blasts are shared by both players: advanced once per frame
    update()
    {
        const R = HR_ROCKET, dt = timeDelta;
        hrBlasts = hrBlasts.filter(b => (b.age += dt) < .35);
        hrRockets = hrRockets.filter(r =>
        {
            const n = 3;   // substeps so a fast rocket never skips a thin solid
            for (let i = 0; i < n; i++)
            {
                r.x += r.vx * dt / n;
                r.y += r.vy * dt / n;
                if (abs(r.x) > hrLevel.w / 2 + 2 || abs(r.y) > hrLevel.h / 2 + 4) return false;   // flew off
                const btn = hrLevel.gates.find(g => !g.pressed &&
                    isOverlapping(vec2(r.x, r.y), vec2(.2), vec2(g.button.x, g.button.y), vec2(1.1)));
                // rockets fly through both players: only solids and buttons set them off
                const hit = hrLevel.solids.some(s => r.x > s.l && r.x < s.r && r.y > s.bottom && r.y < s.top);
                if (btn || hit) { this.explode(r); return false; }
            }
            return true;
        });
    },

    explode(r)
    {
        const R = HR_ROCKET, c = vec2(r.x, r.y), owner = r.owner;
        hrBlasts.push({x: r.x, y: r.y, age: 0, color: owner.color});
        for (const g of hrLevel.gates)
            if (!g.pressed && c.distance(vec2(g.button.x, g.button.y)) < R.switchRadius) hrPressGate(g);

        // GDD §3.3: the blast pushes only the player who fired it; the other player isn't affected
        for (const p of [owner])
        {
            const off = vec2(p.x, p.y).subtract(c), d = off.length();
            if (d >= R.radius || p.finished) continue;
            const dir = d > .01 ? off.scale(1 / d) : vec2(0, 1);
            const k = (1 - d / R.radius) * (p.grounded && p.floor && p.floor.sticky ? R.stickyPush : 1);
            p.vx += dir.x * R.power * k;
            p.vy += dir.y * R.power * k;
            const sp = Math.hypot(p.vx, p.vy);
            if (sp > R.maxSpeed) { p.vx *= R.maxSpeed / sp; p.vy *= R.maxSpeed / sp; }
            if (k > .05)
            {
                p.squash = -.3;
                p.landT = -1;
                p.pupilKick(-dir.x * .25, -dir.y * .25);
            }
        }
        hrSfx.boom.play(c);
        addScreenShake(.2, .2);
        hrBlastFx(c, owner.color);
    },

    step(p, input)
    {
        const R = HR_ROCKET, dt = timeDelta, solids = hrLevel.solids;
        if (input.down) p.aimA -= R.spin * dt;   // y is up, so a falling angle turns clockwise
        p.cool = max(0, p.cool - dt);
        if (input.released && p.cool <= 0)
        {
            const d = vec2(Math.cos(p.aimA), Math.sin(p.aimA));
            hrRockets.push({x: p.x + d.x * .6, y: p.y + d.y * .6, vx: d.x * R.speed, vy: d.y * R.speed, owner: p});
            p.cool = R.cooldown;
            p.vx -= d.x * R.recoil;
            p.vy -= d.y * R.recoil;
            hrSfx.fire.play();
            hrEmit('fire', p);
        }
        p.down = input.down;

        p.vy -= R.gravity * dt;

        // on a grip wall (GDD §3.3): stay on it and slide slowly down; a push away from the wall (a blast or the recoil)
        // lets go, a push up or into it does not (no riding up it, as in Hop); let go and fall if the wall ends
        if (p.cling)
        {
            if (p.vx * p.cling < 0 || !solids.some(s => s.grip && hrOverlapSolid(p.x + p.cling * .06, p.y, s))) p.cling = 0;
            else { p.vx = 0; p.vy = clamp(p.vy, -R.clingSlide, 0); }
        }

        p.x += p.vx * dt;
        for (const s of solids)
            if (hrOverlapSolid(p.x, p.y, s, .1))   // slightly short so the floor we rest on doesn't count
            {
                const side = p.vx > 0 ? 1 : -1;
                p.x = side > 0 ? s.l - HR_PSIZE / 2 - .001 : s.r + HR_PSIZE / 2 + .001;
                if (s.grip && !p.grounded)
                {
                    // a grip wall hit in the air holds you, even moving up fast
                    p.cling = side;
                    p.dir = -side;   // face away from the wall
                    p.vx = 0;
                    p.vy = clamp(p.vy, -R.clingSlide, 0);
                    p.squash = .2;
                    p.pupilKick(side * .15, 0);
                    hrSfx.land.play(undefined, .6, 1.5);
                    continue;
                }
                if (abs(p.vx) > 4) { p.pupilKick(side * .2, 0); hrSfx.land.play(undefined, .5, 1.3); }
                p.vx *= -R.wallBounce;
            }

        const prevY = p.y, wasGrounded = p.grounded;
        p.y += p.vy * dt;
        p.grounded = false;
        for (const s of solids)
            if (hrOverlapSolid(p.x, p.y, s))
            {
                if (p.vy <= 0 && prevY - HR_PSIZE / 2 >= s.top - .15)
                {
                    p.y = s.top + HR_PSIZE / 2;
                    if (!wasGrounded)
                    {
                        p.pupilKick(0, max(-.3, p.vy * .015));
                        if (p.vy < -6)
                        {
                            p.land = min(.35, .12 + -p.vy * .012);
                            p.landT = 0;
                            hrSfx.land.play();
                            hrDust(p.x, p.y - HR_PSIZE / 2);
                        }
                        if (s.sticky) { p.vx = 0; if (p.vy < -2) hrSfx.goo.play(); }   // stops you dead
                    }
                    p.vy = 0;
                    p.grounded = true;
                    p.floor = s;
                    p.cling = 0;
                }
                else if (p.vy > 0 && prevY + HR_PSIZE / 2 <= s.bottom + .15)   // bonk from below only
                {
                    p.y = s.bottom - HR_PSIZE / 2;
                    p.vy = 0;
                }
            }
        if (!p.grounded) p.floor = null;
        if (p.grounded)
        {
            const f = p.floor.sticky ? 1e3 : p.floor.ice ? R.iceFriction : R.friction;
            p.vx *= Math.exp(-f * dt);
            if (abs(p.vx) < .05) p.vx = 0;
            if (p.floor.ice && abs(p.vx) > 2 && rand() < .3) hrSparkle(p.x, p.y - HR_PSIZE / 2);
        }
        if (abs(p.vx) > 1) p.dir = sign(p.vx);
        p.crouch = p.floor && p.floor.sticky ? .25 : 0;   // flattened on sticky floors
    },

    // launcher: a white-outlined tube with a wide muzzle in the player's color, faded while cooling down, with a faint dotted
    // sight line (as in Grapple) to where the rocket would explode: the first solid or unpressed button
    draw(p)
    {
        if (p.finished) return;
        const d = vec2(Math.cos(p.aimA), Math.sin(p.aimA)), pos = vec2(p.x, p.y);
        if (p.cool <= 0)
            for (let i = 1; i < 24; i++)
            {
                const q = pos.add(d.scale(.6 + i * .7));
                if (hrLevel.solids.some(s => q.x > s.l && q.x < s.r && q.y > s.bottom && q.y < s.top)) break;
                if (hrLevel.gates.some(g => !g.pressed && isOverlapping(q, vec2(.1), vec2(g.button.x, g.button.y), vec2(1.1)))) break;
                drawRect(q, vec2(.1), HR_INK.scale(1, max(.08, .45 - i * .018)));
            }
        // a long tube with a wide muzzle, outlined in white so it reads on coral and on ink floors; the part
        // inside the square is hidden by the player, drawn on top
        const c = p.color.scale(1, p.cool > 0 ? .4 : 1), a = -p.aimA, o = .14;
        const tube = pos.add(d.scale(.85)), tubeS = vec2(1.1, .32), muz = pos.add(d.scale(1.36)), muzS = vec2(.26, .56);
        drawRect(tube, tubeS.add(vec2(o)), HR_WHITE, a);
        drawRect(muz, muzS.add(vec2(o)), HR_WHITE, a);
        drawRect(tube, tubeS, c, a);
        drawRect(muz, muzS, c, a);
    },

    drawWorld()
    {
        for (const r of hrRockets)
        {
            const a = Math.atan2(r.vy, r.vx), back = vec2(-Math.cos(a), -Math.sin(a));
            drawRect(vec2(r.x, r.y).add(back.scale(.45)), vec2(.3, .1), r.owner.color.scale(1, .5), -a);
            drawRect(vec2(r.x, r.y), vec2(.42, .2), r.owner.color, -a);
        }
        // blast: a ring in the owner's color racing out to the blast radius
        for (const b of hrBlasts)
        {
            const k = b.age / .35, e = 1 - (1 - k) * (1 - k), d = 2 * HR_ROCKET.radius * (.2 + .8 * e);
            drawCircle(vec2(b.x, b.y), d, CLEAR_WHITE, .3 * (1 - k) + .05, b.color.scale(1, 1 - k));
        }
    },
};
