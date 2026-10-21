/*
    HOP RACE - World 2, Rocket (GDD §3.3). A launcher spins around you; press to fire.
    The blast pushes every player in range; a rocket explodes on the other player. Ported from the prototype's Rocket Jump
    (prototype/game.js rcRocketStep, rcMotion, rcExplode, rcRocketsUpdate).
*/

'use strict';

const HR_ROCKET = {
    gravity:   42,
    spin:      3,       // launcher rotation (rad/s)
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
};

let hrRockets = [], hrBlasts = [];

HR_MODES.rocket = {
    reset(p)
    {
        p.grounded = true;
        p.floor = null;
        p.dir = 1;
        p.aimA = PI * 1.25;   // start pointing down-left, so the first press pushes you up and forward
        p.spinDir = 1;
        p.cool = 0;
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
                const hit = hrLevel.solids.some(s => r.x > s.l && r.x < s.r && r.y > s.bottom && r.y < s.top);
                // your own rocket flies through you; the other player's explodes on you
                const hitPlayer = hrPlayers.some(p => p != r.owner && !p.finished &&
                    isOverlapping(vec2(r.x, r.y), vec2(.2), vec2(p.x, p.y), vec2(HR_PSIZE)));
                if (btn || hit || hitPlayer) { this.explode(r); return false; }
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

        // GDD §3.3: the blast pushes every player in range, the one who fired it and the other one
        for (const p of hrPlayers)
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
        p.aimA += R.spin * p.spinDir * dt;
        p.cool = max(0, p.cool - dt);
        if (input.pressed && p.cool <= 0)
        {
            const d = vec2(Math.cos(p.aimA), Math.sin(p.aimA));
            hrRockets.push({x: p.x + d.x * .6, y: p.y + d.y * .6, vx: d.x * R.speed, vy: d.y * R.speed, owner: p});
            p.cool = R.cooldown;
            p.spinDir = -p.spinDir;   // each shot reverses the launcher's rotation
            p.vx -= d.x * R.recoil;
            p.vy -= d.y * R.recoil;
            hrSfx.fire.play();
            hrEmit('fire', p);
        }
        p.down = input.down;

        p.vy -= R.gravity * dt;

        p.x += p.vx * dt;
        for (const s of solids)
            if (hrOverlapSolid(p.x, p.y, s, .1))   // slightly short so the floor we rest on doesn't count
            {
                const side = p.vx > 0 ? 1 : -1;
                p.x = side > 0 ? s.l - HR_PSIZE / 2 - .001 : s.r + HR_PSIZE / 2 + .001;
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

    // launcher: a short ink barrel circling the player, faded while cooling down
    draw(p)
    {
        if (p.finished) return;
        const d = vec2(Math.cos(p.aimA), Math.sin(p.aimA)), pos = vec2(p.x, p.y);
        const c = HR_INK.scale(1, p.cool > 0 ? .4 : 1);
        drawRect(pos.add(d.scale(.78)), vec2(.5, .2), c, -p.aimA);
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
