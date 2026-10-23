/*
    HOP RACE - World 3, Grapple (GDD §3.4). The same spinning launcher fires a hook: press to fire,
    hold to reel in, release to cut the rope and keep your speed. Ported from the prototype's
    Grappling Hook (prototype/game.js rcGrappleStep).
*/

'use strict';

const HR_GRAPPLE = {
    gravity:   42,
    spin:      3,       // launcher rotation (rad/s), clockwise as in Rocket; it freezes while the hook is out
    reverseSpin: false, // true: each shot reverses the spin (tried 2026-10-22; off by owner decision)
    speed:     55,      // hook flight speed (u/s), no range limit
    cooldown:  .12,
    missCooldown: .3,   // after a hook leaves the level
    pullAccel: 95,      // reel-in acceleration (gravity is 42, so upward pulls win)
    pullMax:   26,      // reel-in speed along the rope; speed you already had is kept
    maxSpeed:  32,
    swingDamp: 1.2,     // bleeds sideways speed so you don't orbit the anchor
    brakeR:    4,       // start easing in this close to the anchor
    brake:     9,
    arrive:    1.1,     // this close to the anchor you hang there
    friction:  7,       // ground friction (1/s)
};

HR_MODES.grapple = {
    reset(p)
    {
        p.grounded = true;
        p.dir = 1;
        p.aimA = PI * .25;   // start pointing up and forward
        p.spinDir = 1;
        p.cool = 0;
        p.hook = null;
    },

    step(p, input)
    {
        const G = HR_GRAPPLE, dt = timeDelta, solids = hrLevel.solids;
        if (!p.hook) p.aimA -= G.spin * p.spinDir * dt;   // y is up, so a falling angle turns clockwise
        p.cool = max(0, p.cool - dt);

        if (!input.down && p.hook)
        {
            // release cuts the rope; the first release after a pull fades the tutorial prompt
            if (!p.hook.fly) hrEmit('fire', p);
            p.hook = null;
        }
        if (input.pressed && !p.hook && p.cool <= 0)
        {
            const d = vec2(Math.cos(p.aimA), Math.sin(p.aimA));
            p.hook = {fly: true, x: p.x, y: p.y, dx: d.x, dy: d.y};
            p.cool = G.cooldown;
            if (G.reverseSpin) p.spinDir = -p.spinDir;
            hrSfx.fire.play();
        }
        p.down = input.down;

        let hang = false;
        const h = p.hook;
        if (h && h.fly)
        {
            const n = 3, step = G.speed * dt / n;   // substeps so the hook never skips a thin solid
            for (let i = 0; i < n && h.fly; i++)
            {
                const nx = h.x + h.dx * step, ny = h.y + h.dy * step;
                if (abs(nx) > hrLevel.w / 2 + 1 || ny > hrLevel.h / 2 || ny < hrLevel.killY)
                {
                    // left the level: the hook is lost
                    p.hook = null;
                    p.cool = G.missCooldown;
                    break;
                }
                if (solids.some(s => nx > s.l && nx < s.r && ny > s.bottom && ny < s.top))
                {
                    h.fly = false;   // stuck: h.x / h.y stay on the last free point
                    hrSfx.click.play(vec2(h.x, h.y), 1, .8);
                    addScreenShake(.08, .1);
                    p.pupilKick(h.dx * .15, h.dy * .15);
                }
                else { h.x = nx; h.y = ny; }
            }
        }
        else if (h)
        {
            const ox = h.x - p.x, oy = h.y - p.y, dist = Math.hypot(ox, oy);
            if (dist > G.arrive)
            {
                const ux = ox / dist, uy = oy / dist, along = p.vx * ux + p.vy * uy;
                const gain = clamp(G.pullMax - along, 0, G.pullAccel * dt);
                p.vx += ux * gain; p.vy += uy * gain;
                // damp only the sideways part
                const side = Math.exp(-G.swingDamp * dt) - 1, a = p.vx * ux + p.vy * uy;
                p.vx += (p.vx - ux * a) * side; p.vy += (p.vy - uy * a) * side;
                if (dist < G.brakeR)   // ease in near the anchor so you don't overshoot it
                {
                    const b = Math.exp(-G.brake * (1 - dist / G.brakeR) * dt);
                    p.vx *= b; p.vy *= b;
                }
            }
            else
            {
                hang = true;   // hang at the anchor
                const k = Math.exp(-10 * dt);
                p.vx *= k; p.vy *= k;
            }
        }
        if (!hang) p.vy -= G.gravity * dt;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > G.maxSpeed) { p.vx *= G.maxSpeed / sp; p.vy *= G.maxSpeed / sp; }

        // walls stop you dead (no bounce)
        p.x += p.vx * dt;
        for (const s of solids)
            if (hrOverlapSolid(p.x, p.y, s, .1))   // slightly short so the floor we rest on doesn't count
            {
                const side = p.vx > 0 ? 1 : -1;
                p.x = side > 0 ? s.l - HR_PSIZE / 2 - .001 : s.r + HR_PSIZE / 2 + .001;
                if (abs(p.vx) > 4) { p.pupilKick(side * .2, 0); hrSfx.land.play(undefined, .5, 1.3); p.squash = -.2; }
                p.vx = 0;
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
                    }
                    p.vy = 0;
                    p.grounded = true;
                }
                else if (p.vy > 0 && prevY + HR_PSIZE / 2 <= s.bottom + .15)   // bonk from below only
                {
                    p.y = s.bottom - HR_PSIZE / 2;
                    p.vy = 0;
                }
            }
        // the top of the level box is closed, so a hard swing never flies off the screen
        const roof = hrLevel.h / 2 - HR_PSIZE / 2;
        if (p.y > roof) { p.y = roof; p.vy = min(p.vy, 0); }
        if (p.grounded && !p.hook)
        {
            p.vx *= Math.exp(-G.friction * dt);
            if (abs(p.vx) < .05) p.vx = 0;
        }
        if (abs(p.vx) > 1) p.dir = sign(p.vx);
    },

    // launcher: a short barrel circling the player, with a faint dotted sight line up to the first
    // solid while the hook is ready; the rope is a line with a small white hook tip. Barrel, rope and
    // hook take the player's color, so they show against ink floors and pillars
    draw(p)
    {
        if (p.finished) return;
        const pos = vec2(p.x, p.y), d = vec2(Math.cos(p.aimA), Math.sin(p.aimA));
        if (p.hook)
        {
            const tip = vec2(p.hook.x, p.hook.y);
            drawLine(pos, tip, .09, p.color);
            drawCircle(tip, .32, p.color);
            drawCircle(tip, .18, HR_WHITE);
        }
        else if (p.cool <= 0)
            for (let i = 1; i < 24; i++)
            {
                const q = pos.add(d.scale(.6 + i * .7));
                if (hrLevel.solids.some(s => q.x > s.l && q.x < s.r && q.y > s.bottom && q.y < s.top)) break;
                drawRect(q, vec2(.1), HR_INK.scale(1, max(.08, .45 - i * .018)));
            }
        const c = p.color.scale(1, p.cool > 0 && !p.hook ? .4 : 1);
        drawRect(pos.add(d.scale(.78)), vec2(.5, .2), c, -p.aimA);
    },
};
