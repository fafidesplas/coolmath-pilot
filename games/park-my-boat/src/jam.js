'use strict';
// Harbor Jam (prototype): a level with jam: true is a packed corner of a harbor instead of a chain of
// boats to park. Click a boat to send it straight ahead (click its front half) or astern (its back
// half). It goes until it leaves the harbor or touches something; a touch stops it right there (no
// shoving, so a jam is solved by planning, not physics) and costs a bump. Clear every boat out; stars
// come from the money kept. The harbor is walled where the level has sand or docks and open to the sea
// elsewhere; a boat is out once it is wholly past the level's view box.
//
// level fields: jam: true, view: [x0, y0, x1, y1] (what the camera shows, and the harbor's edge),
//               budget ($), moored: the boats in the jam, hint

const JAM_BUMP = .1;            // share of the budget one bump costs
const JAM_ACCEL = 3;            // a boat gets to full speed in about 1/JAM_ACCEL seconds
let jamBoats = [], jamMoving = null, jamBumps = 0;

// full speed in m/s: a few boat lengths a second for small boats, less for big ones
const jamSpeed = b => 3 + .5*boatSize(b);

function jamLoad(L)
{
    jamBoats = (L.moored || []).map((m, k) =>
        makeBoat(m.boat, vec2(m.x, m.y), m.a, 'jam', MOORED_COLORS[k % MOORED_COLORS.length], boatK(L, m)));
    jamMoving = null;
    jamBumps = 0;
    fleet = []; slips = []; slip = undefined;
}

// the boat's circles if it stood at pos: do they touch the walls or another boat in the jam?
function jamBlocked(b, pos)
{
    const c = Math.cos(b.angle), s = Math.sin(b.angle), eps = .02;
    for (const k of b.circles)
    {
        const x = pos.x + k.x*c - k.y*s, y = pos.y + k.x*s + k.y*c, r = k.r - eps;
        for (const w of rects)
            if (Math.hypot(x - clamp(x, w.x0, w.x1), y - clamp(y, w.y0, w.y1)) < r) return true;
        for (const p of posts)
            if (Math.hypot(x - p.x, y - p.y) < r + p.r) return true;
        for (const o of jamBoats)
        {
            if (o == b || o.pos.distance(pos) > o.radius + b.radius) continue;
            for (let j = 0; j < o.circles.length; j++)
                if (Math.hypot(x - o.world[j].x, y - o.world[j].y) < r + o.circles[j].r) return true;
        }
    }
    return false;
}

function jamOut(b, pos = b.pos)
{
    const [x0, y0, x1, y1] = level.view, r = b.radius;
    return pos.x - r > x1 || pos.x + r < x0 || pos.y - r > y1 || pos.y + r < y0;
}

// which jam boat is under a world point, and which way it goes: front half ahead, back half astern
function jamPick(p)
{
    for (const b of jamBoats)
        for (let i = 0; i < b.circles.length; i++)
            if (p.distance(b.world[i]) < b.circles[i].r + .3*cam.wu)
            {
                const f = b.forward();
                return { b, dir: (p.x - b.pos.x)*f.x + (p.y - b.pos.y)*f.y >= 0 ? 1 : -1 };
            }
}

function jamUpdate(dt)
{
    if (mouseWasPressed(0) && !buttonAt(mousePos) && !jamMoving)
    {
        const pick = jamPick(uiToWorld(mousePos));
        if (pick)
        {
            jamMoving = { ...pick, v: 0 };
            sfx('putt', pick.b.pos, 1, Math.max(.25, 1.6 / Math.pow(boatSize(pick.b), .25)));
            if (!attempts++) track('design', 'tutorial:step01');
        }
    }
    for (const b of jamBoats) { b.vel.set(0, 0); b.angVel = 0; b.integrate(dt); }     // squash wobble only
    const m = jamMoving;
    if (!m) return;
    const b = m.b, top = jamSpeed(b);
    m.v = Math.min(top, m.v + top*JAM_ACCEL*dt);
    // move in small steps so a fast boat can't skip through a thin one
    const f = b.forward().scale(m.dir), dist = m.v*dt, n = Math.max(1, Math.ceil(dist / (.1*b.type.W*b.k)));
    for (let i = 0; i < n; i++)
    {
        const next = b.pos.add(f.scale(dist/n));
        if (jamBlocked(b, next)) return jamBump(b, f);
        b.pos = next;
        b.updateWorld();
    }
    if ((m.wakeT = (m.wakeT || 0) - dt) <= 0)
    {
        m.wakeT = .07;
        wakes.push({ pos: b.toWorld(-m.dir*b.type.L/2*b.k, 0), t: 0, size: b.type.W*.7*b.k });
    }
    if (jamOut(b))
    {
        jamBoats.splice(jamBoats.indexOf(b), 1);
        bodies.splice(bodies.indexOf(b), 1);
        jamMoving = null;
        sfx('horn', undefined, .5, clamp(3 / Math.pow(boatSize(b), .3), .35, 3));
        if (!jamBoats.length) showComplete();
    }
}

function jamBump(b, f)
{
    const cost = Math.round(level.budget*JAM_BUMP), p = b.pos.add(f.scale(b.radius*.9));
    jamBumps++;
    damages += cost;
    jamMoving = null;
    b.squashVel += 3;
    shakeAmt = Math.max(shakeAmt, .25);
    sfx('bonk', p, 1, .8);
    splash(p, 8, 3, b.k);
    popup(`BUMP  -${fmtMoney(cost)}`, b.pos, C_CORAL, .8, 1.2);
}

// share of the budget kept, and the stars for it
function jamResult()
{
    const kept = Math.max(0, level.budget - damages) / level.budget;
    return { acc: kept, stars: kept >= .9 ? 3 : kept >= .6 ? 2 : 1, jam: true };
}

function drawJamHud()
{
    const L = level;
    txt(`${jamBoats.length} boat${jamBoats.length == 1 ? '' : 's'} left`, 10, 21.75, .55, C_TEAL, 'left');
    txt(`Money: ${fmtMoney(Math.max(0, L.budget - damages))}`, 26, 21.75, .55, damages ? C_CORAL : C_INK);
}

// debug (window.game.win): every boat out, no bumps
function jamWin()
{
    for (const b of jamBoats) bodies.splice(bodies.indexOf(b), 1);
    jamBoats = []; jamMoving = null;
    showComplete();
}

// can the jam be cleared without a bump? A boat that can leave now can still leave later (leaving
// only frees water), so taking any free boat out, again and again, finds the way if there is one.
// Returns the rounds: which boats can leave together at each step.
function jamSolve()
{
    const saved = jamBoats.map(b => [b, b.pos.copy()]), rounds = [];
    const name = b => `${b.type.name}@${Math.round(b.pos.x)},${Math.round(b.pos.y)}`;
    const leaves = (b, dir) =>
    {
        const f = b.forward().scale(dir*.1*b.type.W*b.k);
        for (let p = b.pos.copy(), i = 0; i < 20000; i++)
        {
            p = p.add(f);
            if (jamBlocked(b, p)) return false;
            if (jamOut(b, p)) return true;
        }
        return false;
    };
    let left = [...jamBoats];
    while (left.length)
    {
        const free = left.filter(b => leaves(b, 1) || leaves(b, -1));
        if (!free.length) break;
        rounds.push(free.map(b => name(b) + (leaves(b, 1) ? ' ahead' : ' astern')));
        jamBoats = left = left.filter(b => !free.includes(b));
    }
    const stuck = left.map(name);
    jamBoats = saved.map(([b]) => b);
    return { solvable: !stuck.length, rounds, stuck };
}
