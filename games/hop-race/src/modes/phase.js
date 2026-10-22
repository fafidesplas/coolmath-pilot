/*
    HOP RACE - World 4, Phase (GDD §3.5). You are a block of 7 x 7 = 49 drops.
    Each press switches to the next state, always in the same order: solid -> liquid -> gas -> solid.
    Ported from the prototype's Flow and Flow 2 (prototype/game.js rcFlowStep), with the press cycle
    in place of hold to crumble / release to pack, and no fire pits.

    p.x / p.y is the square's center while solid, or the drops' center of mass while liquid or gas.
    Level pieces are oriented boxes: the level's tilted slabs plus its plain solids (and the side walls).
*/

'use strict';

const HR_PHASE = {
    n:          7,      // the square is n x n drops
    gravity:    30,     // for the square and for liquid drops (the prototype's value)
    sub:        2,      // physics substeps per frame
    slabThick:  .5,     // slabs are this thick under their top surface (u)
    sqFric:     .9,     // a solid square sticks to slopes under about 42°
    liqFric:    .12,    // liquid slides on slabs...
    dropDamp:   .35,    // ...but drags on itself, so it heaps up
    gasLift:    20,     // gas accelerates up at this rate instead of falling
    gasDrag:    1,      // gas loses its speed at this rate (1/s), so it drifts
    gasFric:    .03,    // gas barely drags on a ceiling, so it slides along it
    maxV:       22,
    pressGap:   .15,    // presses closer than this (s) are ignored, so a double tap never skips a state
    condenseT:  .5,     // gas -> solid: the rings pull together for this long (s), then pack into a square
    condensePull: 30,   // how hard the rings pull together while condensing
    winDrops:   40,     // drops that must touch the flag (49 to start)
    minDrops:   12,     // fewer than this and you go back to the start
    gasTop:     1,      // gas whose center floats this far above the level box has escaped (u)
    eyeNear:    3,      // the eye sits at the center of the drops this close to its own drop (in drop sizes)
};
const HR_DROP_D = HR_PSIZE / HR_PHASE.n;   // drop diameter = grid spacing in the square

// the square's sample points (in half sizes) pushed out of the level: corners, edge middles, center
const HR_PHASE_SQ = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0], [0, 0]];

let hrPhaseBoxes = [], hrPhaseBoxesOf = null;

// oriented box from the left and right ends of its top surface, T thick below it
function hrPhaseBox(x0, y0, x1, y1, T)
{
    const L = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
    return {x0, y0, x1, y1, L, T, ang, c: Math.cos(ang), s: Math.sin(ang)};
}

function hrPhaseBuild()
{
    if (hrPhaseBoxesOf == hrLevel) return;
    hrPhaseBoxesOf = hrLevel;
    hrPhaseBoxes = hrLevel.solids.map(s => hrPhaseBox(s.l, s.top, s.r, s.top, s.top - s.bottom));
    for (const [x0, y0, x1, y1] of hrLevel.def.slabs || [])
        hrPhaseBoxes.push(hrPhaseBox(x0, y0, x1, y1, HR_PHASE.slabThick));
}

// if a ball of radius r at (px, py) overlaps the box, how to get out: {nx, ny, d}
function hrPhasePush(b, px, py, r)
{
    const dx = px - b.x0, dy = py - b.y0;
    const u = dx * b.c + dy * b.s, v = -dx * b.s + dy * b.c;
    if (u <= -r || u >= b.L + r || v >= r || v <= -b.T - r) return null;
    const top = r - v, bottom = v + b.T + r, left = u + r, right = b.L + r - u;
    const m = min(top, bottom, left, right);
    let lx = 0, ly = 0;
    if (m == top) ly = 1; else if (m == bottom) ly = -1; else if (m == left) lx = -1; else lx = 1;
    return {nx: lx * b.c - ly * b.s, ny: lx * b.s + ly * b.c, d: m};
}

// push one drop out of the level, with Coulomb friction along the surface
function hrPhaseDropOut(q, fric)
{
    const r = HR_DROP_D / 2;
    for (const b of hrPhaseBoxes)
    {
        const hit = hrPhasePush(b, q.x, q.y, r);
        if (!hit) continue;
        q.x += hit.nx * hit.d; q.y += hit.ny * hit.d;
        const vn = q.vx * hit.nx + q.vy * hit.ny;
        if (vn >= 0) continue;
        q.vx -= vn * hit.nx; q.vy -= vn * hit.ny;   // inelastic: just stop going in
        const tx = -hit.ny, ty = hit.nx, vt = q.vx * tx + q.vy * ty;
        const cut = sign(vt) * min(abs(vt), fric * -vn);
        q.vx -= cut * tx; q.vy -= cut * ty;
    }
}

// where the eye floats while liquid or gas: it rides one drop (the square's middle one, or the nearest
// one if that drop is lost) at the center of its near neighbors. The center of all the drops would jump
// through a slab when the drops split around it; a drop can't pass through a slab, so the eye can't either.
function hrPhaseEye(p)
{
    const parts = p.parts, R = HR_PHASE.eyeNear * HR_DROP_D;
    if (!parts.includes(p.eyeQ))
    {
        let best = Infinity;
        for (const q of parts)
        {
            const d = (q.x - p.ex) ** 2 + (q.y - p.ey) ** 2;
            if (d < best) { best = d; p.eyeQ = q; }
        }
    }
    const a = p.eyeQ;
    let x = 0, y = 0, n = 0;
    for (const q of parts)
        if ((q.x - a.x) ** 2 + (q.y - a.y) ** 2 < R * R) { x += q.x; y += q.y; n++; }
    p.ex = x / n; p.ey = y / n;
}

function hrPhaseSize(p) { return Math.sqrt(p.drops) * HR_DROP_D; }   // the square shrinks as drops are lost

function hrPhaseSquareHits(p)
{
    const ca = Math.cos(p.ang), sa = Math.sin(p.ang), h = hrPhaseSize(p) / 2;
    return hrPhaseBoxes.some(b => HR_PHASE_SQ.some(([ox, oy]) =>
        hrPhasePush(b, p.x + (ox * ca - oy * sa) * h, p.y + (ox * sa + oy * ca) * h, 0)));
}

// how many of the player's drops touch the flag (a square touching it counts all of its drops).
// The flag's box reaches 1 u below the pole's foot, since a flag on a slope has drops pooled lower than its foot
function hrPhaseFlagCount(p)
{
    const f = hrLevel.flagBox, r = p.state == 'solid' ? hrPhaseSize(p) / 2 : HR_DROP_D / 2;
    const below = hrLevel.flag.hang ? 0 : 1, cy = f.pos.y - below / 2, hy = (f.size.y + below) / 2;
    const near = (x, y) => abs(x - f.pos.x) < f.size.x / 2 + r && abs(y - cy) < hy + r;
    if (p.state == 'solid') return near(p.x, p.y) ? p.drops : 0;
    return p.parts.filter(q => near(q.x, q.y)).length;
}

HR_MODES.phase = {
    reset(p)
    {
        hrPhaseBuild();
        this.warp(p);
        p.pressT = 1;
        // settle onto the slope under the start point
        p.y += .5;
        for (let i = 0; i < 120 && !p.asleep; i++) this.square(p, 1 / 60, true);
        p.vx = p.vy = 0;
        p.squash = 0;
    },

    // become a whole, resting square of 49 drops where p.x / p.y already is (also used by window.game.win)
    warp(p)
    {
        p.state = 'solid';
        p.parts = [];
        p.drops = HR_PHASE.n ** 2;
        p.ang = 0;
        p.asleep = false;
        p.condT = -1;
        p.eyeQ = null;
        p.grounded = true;
        p.dir = 1;
    },

    step(p, input)
    {
        const P = HR_PHASE, dt = timeDelta;
        hrPhaseBuild();
        p.down = input.down;
        p.pressT += dt;
        if (input.pressed && p.pressT >= P.pressGap && p.condT < 0)
        {
            p.pressT = 0;
            this.next(p);
        }

        if (p.state == 'solid')
        {
            for (let i = 0; i < P.sub; i++) this.square(p, dt / P.sub);
        }
        else
        {
            if (p.condT >= 0)
            {
                p.condT += dt;
                if (p.condT >= P.condenseT) { this.pack(p); return; }
                this.condense(p, dt);
            }
            this.drops(p, dt);
            const n = p.parts.length;
            p.drops = n;
            if (n < P.minDrops) return hrRespawn(p, input.down);
            let x = 0, y = 0, vx = 0, vy = 0;
            for (const q of p.parts) { x += q.x; y += q.y; vx += q.vx; vy += q.vy; }
            p.x = x / n; p.y = y / n; p.vx = vx / n; p.vy = vy / n;
            hrPhaseEye(p);
            if (p.state == 'gas' && p.y > hrLevel.h / 2 + P.gasTop) return hrRespawn(p, input.down);   // drifted off into the sky
        }
        // reached the flag with too few drops to ever finish
        if (p.drops < P.winDrops && hrPhaseFlagCount(p) > 0) hrRespawn(p, input.down);
    },

    finished(p) { return hrPhaseFlagCount(p) >= HR_PHASE.winDrops; },

    // one press: solid -> liquid -> gas -> (condense) -> solid
    next(p)
    {
        const pos = vec2(p.x, p.y);
        if (p.state == 'solid')
        {
            // melt at once: the drops keep the square's speed
            const cols = Math.ceil(Math.sqrt(p.drops)), rows = Math.ceil(p.drops / cols);
            const ca = Math.cos(p.ang), sa = Math.sin(p.ang);
            p.parts = [];
            for (let k = 0; k < p.drops; k++)
            {
                const ox = (k % cols - (cols - 1) / 2) * HR_DROP_D, oy = (floor(k / cols) - (rows - 1) / 2) * HR_DROP_D;
                p.parts.push({x: p.x + ox * ca - oy * sa, y: p.y + ox * sa + oy * ca,
                    vx: p.vx + rand(-.4, .4), vy: p.vy + rand(-.2, .2)});
            }
            p.eyeQ = p.parts[floor(p.drops / 2)];   // the eye rides the middle drop
            hrPhaseEye(p);
            p.state = 'liquid';
            p.asleep = false;
            hrSfx.melt.play(pos);
            hrPhaseSplash(pos, p.color);
            p.pupilKick(0, -.2);
            hrEmit('fire', p);   // the first melt fades the tutorial prompt
        }
        else if (p.state == 'liquid')
        {
            // evaporate at once: the drops become rings and start to rise
            p.state = 'gas';
            for (const q of p.parts) q.vy += rand(1, 2.5);
            hrSfx.evaporate.play(pos);
            hrPhasePuff(pos, p.color);
            p.pupilKick(0, .2);
        }
        else
        {
            // condense: the rings pull together, then pack into a square (more presses are ignored meanwhile)
            p.condT = 0;
            hrSfx.charge.play(pos, 1, 1.4);
        }
    },

    condense(p, dt)
    {
        const P = HR_PHASE, n = p.parts.length, damp = Math.exp(-6 * dt);
        const mx = p.ex, my = p.ey;
        let vx = 0, vy = 0;
        for (const q of p.parts) { vx += q.vx / n; vy += q.vy / n; }
        for (const q of p.parts)
        {
            // keep the common motion, lose the spread, pull toward the eye (never across a slab)
            q.vx = vx + (q.vx - vx) * damp + (mx - q.x) * P.condensePull * dt;
            q.vy = vy + (q.vy - vy) * damp + (my - q.y) * P.condensePull * dt;
        }
    },

    // the rings pack into a square at the eye, which then falls
    pack(p)
    {
        const n = p.parts.length;
        p.x = p.ex; p.y = p.ey; p.vx = p.vy = 0;
        for (const q of p.parts) { p.vx += q.vx / n; p.vy += q.vy / n; }
        p.vx *= .5; p.vy = min(0, p.vy * .5);
        p.drops = n;
        p.parts = [];
        p.state = 'solid';
        p.condT = -1;
        p.eyeQ = null;
        p.asleep = false;
        p.ang = 0;
        p.squash = -.25;
        hrSfx.freeze.play(vec2(p.x, p.y));
        p.pupilKick(0, .25);
        // packed against a ceiling or a wall, the square would start inside it: move it out. First as a ball
        // from the eye, which is never inside the level, so a square under a slab moves down, not up through it
        const h = hrPhaseSize(p) / 2;
        for (let i = 0; i < 4; i++)
            for (const b of hrPhaseBoxes)
            {
                const hit = hrPhasePush(b, p.x, p.y, h);
                if (hit) { p.x += hit.nx * hit.d; p.y += hit.ny * hit.d; }
            }
        for (let i = 0; i < 40 && hrPhaseSquareHits(p); i++) this.square(p, 0, true);
    },

    // the rigid square: its sample points are pushed out of the level
    square(p, dt, quiet = false)
    {
        const P = HR_PHASE;
        if (p.asleep) return;   // settled on a slope it can grip: stay put
        p.vy -= P.gravity * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        let ground = null;
        const ca = Math.cos(p.ang), sa = Math.sin(p.ang), h = hrPhaseSize(p) / 2;
        for (let it = 0; it < 3; it++)
        {
            let best = null, bestBox = null;
            for (const b of hrPhaseBoxes)
                for (const [ox, oy] of HR_PHASE_SQ)
                {
                    const hit = hrPhasePush(b, p.x + (ox * ca - oy * sa) * h, p.y + (ox * sa + oy * ca) * h, 0);
                    if (hit && (!best || hit.d > best.d)) { best = hit; bestBox = b; }
                }
            if (!best) break;
            p.x += best.nx * best.d; p.y += best.ny * best.d;
            const vn = p.vx * best.nx + p.vy * best.ny;
            if (vn < 0)
            {
                p.vx -= vn * best.nx; p.vy -= vn * best.ny;
                if (vn < -6 && !quiet)
                {
                    p.squash = min(.35, -vn * .025);
                    hrSfx.land.play();
                    hrDust(p.x, p.y - h);
                    p.pupilKick(0, vn * .02);
                }
            }
            if (best.ny > .5) ground = {nx: best.nx, ny: best.ny, ang: bestBox.ang};
        }
        p.grounded = !!ground;
        if (!dt) return;
        if (ground)
        {
            const tx = -ground.ny, ty = ground.nx, vt = p.vx * tx + p.vy * ty;
            const cut = sign(vt) * min(abs(vt), P.sqFric * P.gravity * ground.ny * dt);
            p.vx -= cut * tx; p.vy -= cut * ty;
            p.ang += (ground.ang - p.ang) * min(1, dt * 14);   // lie flat on the slope
            if (abs(p.vx) + abs(p.vy) < 1 && abs(p.ang - ground.ang) < .02 &&
                ground.ny * P.sqFric > Math.sqrt(1 - ground.ny * ground.ny)) { p.vx = p.vy = 0; p.asleep = true; }
        }
        else p.ang *= Math.exp(-3 * dt);
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > P.maxV) { p.vx *= P.maxV / sp; p.vy *= P.maxV / sp; }
    },

    // liquid drops or gas rings: each one moves on its own, and they push apart through a spatial hash
    drops(p, dt)
    {
        const P = HR_PHASE, gas = p.state == 'gas', fric = gas ? P.gasFric : P.liqFric, parts = p.parts, D = HR_DROP_D;
        for (let s = 0; s < P.sub; s++)
        {
            const h = dt / P.sub;
            for (const q of parts)
            {
                if (gas) { q.vy += P.gasLift * h; q.vx *= Math.exp(-P.gasDrag * h); q.vy *= Math.exp(-P.gasDrag * h); }
                else q.vy -= P.gravity * h;
                const sp = Math.hypot(q.vx, q.vy);
                if (sp > P.maxV) { q.vx *= P.maxV / sp; q.vy *= P.maxV / sp; }
                q.x += q.vx * h; q.y += q.vy * h;
                hrPhaseDropOut(q, fric);
            }
            const grid = new Map();
            parts.forEach((q, i) =>
            {
                const key = floor(q.x / D) * 4096 + floor(q.y / D), cell = grid.get(key);
                if (cell) cell.push(i); else grid.set(key, [i]);
            });
            parts.forEach((q, i) =>
            {
                const cx = floor(q.x / D), cy = floor(q.y / D);
                for (let gx = cx - 1; gx <= cx + 1; gx++)
                for (let gy = cy - 1; gy <= cy + 1; gy++)
                {
                    const cell = grid.get(gx * 4096 + gy);
                    if (!cell) continue;
                    for (const j of cell)
                    {
                        if (j <= i) continue;
                        const b = parts[j], dx = q.x - b.x, dy = q.y - b.y, d2 = dx * dx + dy * dy;
                        if (d2 >= D * D) continue;
                        const dist = Math.sqrt(d2) || .001, nx = dx / dist, ny = dy / dist, push = (D - dist) / 2;
                        q.x += nx * push; q.y += ny * push; b.x -= nx * push; b.y -= ny * push;
                        const vrel = (q.vx - b.vx) * nx + (q.vy - b.vy) * ny;
                        if (vrel < 0) { q.vx -= nx * vrel / 2; q.vy -= ny * vrel / 2; b.vx += nx * vrel / 2; b.vy += ny * vrel / 2; }
                        const tx = -ny, ty = nx, k = ((q.vx - b.vx) * tx + (q.vy - b.vy) * ty) * P.dropDamp / 2;
                        q.vx -= tx * k; q.vy -= ty * k; b.vx += tx * k; b.vy += ty * k;
                    }
                }
            });
            for (const q of parts) hrPhaseDropOut(q, fric);
        }
        // GDD §3.5: liquid drops that fall off are gone (gas is on its way up, so it isn't lost here)
        if (!gas) p.parts = parts.filter(q => q.y > hrLevel.killY);
    },

    // the level's tilted slabs, as solid ink bars (plain solids are drawn by hrDrawLevel)
    drawWorld()
    {
        hrPhaseBuild();
        for (const [x0, y0, x1, y1] of hrLevel.def.slabs || [])
        {
            const b = hrPhaseBox(x0, y0, x1, y1, HR_PHASE.slabThick), n = vec2(-b.s, b.c).scale(b.T);
            const a = vec2(x0, y0), e = vec2(x1, y1);
            drawPoly([a, e, e.subtract(n), a.subtract(n)], HR_INK);
        }
    },

    draw() {},

    // drawn instead of hrDrawPlayer: a tilted square while solid, drops while liquid, hollow rings while gas
    drawPlayer(p, eyeNudge = 0)
    {
        const D = HR_DROP_D, c = vec2(p.x, p.y), open = hrBlinkOpen(p.blinkT);
        if (p.state != 'solid')
        {
            const k = p.condT >= 0 ? p.condT / HR_PHASE.condenseT : 0, e = vec2(p.ex, p.ey);
            for (const q of p.parts)
                if (p.state == 'gas') drawCircle(vec2(q.x, q.y), D * lerp(2.2, 1.2, k), p.color.scale(1, 0), .045, p.color);
                else drawCircle(vec2(q.x, q.y), D * 1.6, p.color);
            if (k > 0) hrPhaseQuad(e, vec2(1, 0), vec2(0, 1), hrPhaseSize(p) * k, hrPhaseSize(p) * k, p.color.scale(1, k * .8));
            // the eye floats above a puddle, but not up into the ceiling a gas presses against
            hrDrawEye(e.add(vec2(eyeNudge, p.state == 'gas' ? -.05 : .25)), p.eye, .4, open);
            return;
        }
        const size = hrPhaseSize(p), sx = 1 + p.squash, sy = 1 - p.squash;
        const t = vec2(Math.cos(p.ang), Math.sin(p.ang)), n = vec2(-t.y, t.x);
        const body = c.subtract(n.scale((1 - sy) * size / 2));
        hrPhaseQuad(body, t, n, size * sx, size * sy, p.color);
        const scale = size / HR_PSIZE;
        drawText(p.letter, body.add(t.scale(-.1 * scale)).add(n.scale(-.1 * scale * sy)), .42 * scale * sy, p.letterColor,
            0, BLACK, 'center', HR_FONT, HR_FONT_STYLE, undefined, -p.ang);
        hrDrawEye(body.add(t.scale((.2 + eyeNudge) * scale)).add(n.scale(size * sy / 2 - .06)), p.eye, .5 * max(.6, scale), open);
    },
};

// a rectangle along tangent t and normal n (avoids guessing the engine's angle direction)
function hrPhaseQuad(center, t, n, w, h, color)
{
    const a = t.scale(w / 2), b = n.scale(h / 2);
    drawPoly([center.subtract(a).subtract(b), center.add(a).subtract(b), center.add(a).add(b), center.subtract(a).add(b)], color);
}

// melt: a splash of drops in the player's color
function hrPhaseSplash(pos, color)
{
    new ParticleEmitter(pos, 0, .5, .08, 200, PI, undefined, color, color, color.scale(1, 0), color.scale(1, 0),
        .4, .14, .05, .12, 0, .9, 1, .4, PI, .1, .3);
}

// evaporate: a puff of hollow-looking light rings rising
function hrPhasePuff(pos, color)
{
    const c = color.lerp(HR_WHITE, .5);
    new ParticleEmitter(pos, 0, .6, .08, 120, PI, undefined, c, c, c.scale(1, 0), c.scale(1, 0),
        .6, .2, .4, .05, 0, .95, 1, -.1, PI, .1, .3);
}
