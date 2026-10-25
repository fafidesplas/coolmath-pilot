'use strict';
// Harbor Jam (prototype): a level with jam: true is a packed corner of a harbor instead of a chain of
// boats to park. Tap a boat to select it (a ring shows which), then drive it out with the usual controls.
// Every other boat is fixed in place, so the one you drive bounces off and never shoves the jam around:
// it's solved by planning the order. A real knock costs a bump; a gentle scrape is free. Clear every
// boat out; stars come from the money kept. The harbor is walled where the level has sand or docks and
// open to the sea elsewhere; a boat is out once it is wholly past the level's view box.
//
// level fields: jam: true, view: [x0, y0, x1, y1] (what the camera shows, and the harbor's edge),
//               budget ($), moored: the boats in the jam, hint

const JAM_BUMP = .1;            // share of the budget one bump costs
const JAM_KNOCK = 1;            // impact (in the boat's own speed scale) below which a touch is free
let jamBoats = [], jamBumps = 0;

function jamLoad(L)
{
    jamBoats = (L.moored || []).map((m, k) =>
        makeBoat(m.boat, vec2(m.x, m.y), m.a, 'jam', MOORED_COLORS[k % MOORED_COLORS.length], boatK(L, m)));
    for (const b of jamBoats) jamFix(b, true);
    jamBumps = 0;
    fleet = []; slips = []; slip = undefined;
}

// a boat that isn't selected can't be moved: collisions only push the one being driven
function jamFix(b, fixed)
{
    b.invMass = fixed ? 0 : 1/b.mass;
    b.invInertia = fixed ? 0 : 1/b.inertia;
}

// the boat you tapped becomes the one you drive; the one you were driving stops where it is
function jamSelect(b)
{
    if (player)
    {
        player.kind = 'jam';
        player.vel.set(0, 0); player.angVel = 0;
        player.dragF = player.dragFull; player.dragA = player.dragAFull;
        jamFix(player, true);
    }
    player = b;
    b.kind = 'player';
    jamFix(b, false);
    sfx('click', b.pos, 1, 1.2);
    if (!attempts++) track('design', 'tutorial:step01');
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

// which jam boat is under a world point
function jamPick(p)
{
    for (const b of jamBoats)
        for (let i = 0; i < b.circles.length; i++)
            if (p.distance(b.world[i]) < b.circles[i].r + .3*cam.wu) return b;
}

function jamUpdate(dt)
{
    // a tap on a boat selects it; a press on open water steers the selected one (controlPlayer)
    if (mouseWasPressed(0) && !buttonAt(mousePos))
    {
        const b = jamPick(uiToWorld(mousePos));
        if (b) { steerHeld = false; if (b != player) jamSelect(b); }
    }
    for (const b of jamBoats) if (b != player) { b.vel.set(0, 0); b.angVel = 0; b.integrate(dt); }    // squash wobble only
    if (!player) return;

    const sub = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++)
    {
        controlPlayer(sub);
        player.integrate(sub);
        collideStatics(player, rects, posts, jamHit);
        for (const o of jamBoats) if (o != player) collideBodies(player, o, jamHit);
    }

    // motor putts and wake, as in stepWorld
    const thr = Math.abs(player.throttle);
    motorTimer -= dt;
    if (thr > .1 && motorTimer <= 0)
    {
        motorTimer = (.13 - .06*thr) * player.slowdown;
        sfx('putt', player.pos, .5 + thr*.5, Math.max(.25, 1.6 / Math.pow(boatSize(player), .25)) + thr*.3);
    }
    wakeTimer -= dt;
    if (player.speed() > .7*player.vs && wakeTimer <= 0)
    {
        wakeTimer = .07;
        wakes.push({ pos: player.toWorld(-player.type.L/2*player.k, 0), t: 0, size: player.type.W*.7*player.k });
    }

    if (jamOut(player))
    {
        const b = player;
        jamBoats.splice(jamBoats.indexOf(b), 1);
        bodies.splice(bodies.indexOf(b), 1);
        player = undefined;
        steerHeld = false;
        sfx('horn', undefined, .5, clamp(3 / Math.pow(boatSize(b), .3), .35, 3));
        if (!jamBoats.length) showComplete();
    }
}

// a real knock costs a bump (once per knock); scrapes and gentle touches are free
function jamHit(A, B, impact, p)
{
    const other = A == player ? B : A;
    if (impact / player.vs < JAM_KNOCK || player.hitCooldown > 0) return;
    player.hitCooldown = .6;
    const cost = Math.round(level.budget*JAM_BUMP);
    jamBumps++;
    damages += cost;
    player.squashVel += 3;
    if (other) other.squashVel += 3;
    shakeAmt = Math.max(shakeAmt, .25);
    sfx('bonk', p, 1, .8);
    splash(p, 8, 3, player.k);
    popup(`BUMP  -${fmtMoney(cost)}`, player.pos, C_CORAL, .8, 1.2);
}

// RTS-style selection ring around the boat being driven, under its hull
function drawJamSelection()
{
    const b = player;
    if (!b) return;
    const pulse = 1 + .04*Math.sin(time*6), size = vec2(b.type.L*b.k*1.25 + 1.2, b.type.W*b.k*1.25 + 1.2).scale(pulse);
    drawEllipse(b.pos, size, C_SUNNY.scale(1, .18), -b.angle, .26*cam.wu, C_INK.scale(1, .5));
    drawEllipse(b.pos, size, C_CLEAR, -b.angle, .15*cam.wu, C_SUNNY);
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
    txt(`${jamBoats.length} boat${jamBoats.length == 1 ? '' : 's'} left${player ? ' · ' + player.type.name : ''}`, 10, 21.75, .55, C_TEAL, 'left');
    txt(`Money: ${fmtMoney(Math.max(0, L.budget - damages))}`, 26, 21.75, .55, damages ? C_CORAL : C_INK);
}

// debug (window.game.win): every boat out, no bumps
function jamWin()
{
    for (const b of jamBoats) bodies.splice(bodies.indexOf(b), 1);
    jamBoats = []; player = undefined;
    showComplete();
}

// can the jam be cleared without a bump, driving each boat straight out (ahead or astern)? Steering can
// do more, so this is a floor: if it finds a way, there is one. A boat that can leave now can still
// leave later (leaving only frees water), so taking any free boat out, again and again, finds the way.
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
