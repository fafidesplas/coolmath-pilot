'use strict';
// Harbor Jam (prototype): a level with jam: true is a packed corner of a harbor instead of a chain of
// boats to park. Tap a boat to select it (a ring shows which), then drive it out with the usual controls.
// The other boats float too: you can shove them out of the way, but every meter a boat you aren't driving
// is moved costs money, and a hard knock costs a bump, so planning the order is the cheap way. Clear every
// boat out (shoving one out counts); stars come from the money kept. The harbor is walled where the level has sand or docks and
// open to the sea elsewhere; a boat is out once it is wholly past the level's view box.
//
// level fields: jam: true, view: [x0, y0, x1, y1] (what the camera shows, and the harbor's edge),
//               budget ($), moored: the boats in the jam. The view box's edge is drawn as a dashed
//               line over open water: a boat is out once its whole hull is past it.

const JAM_BUMP = .1;            // share of the budget one bump costs
const JAM_KNOCK = 1;            // impact (in the boat's own speed scale) from which a hit is a bump
const JAM_PUSH = 100;           // $ per meter a boat you aren't driving gets moved
let jamBoats = [], jamBumps = 0, jamPushed = 0, jamPushOwed = 0, jamPushT = 0, jamPushAt = vec2();

function jamLoad(L)
{
    jamBoats = (L.moored || []).map((m, k) =>
        makeBoat(m.boat, vec2(m.x, m.y), m.a, 'jam', MOORED_COLORS[k % MOORED_COLORS.length], boatK(L, m)));
    for (const b of jamBoats) b.lastPos = b.pos.copy();
    jamBumps = jamPushed = jamPushOwed = jamPushT = 0;
    fleet = []; slips = []; slip = undefined;
}

// the boat you tapped becomes the one you drive; the one you were driving keeps its momentum and glides
// on as if you'd let go of the throttle. Its own glide isn't charged as a push until it comes to rest.
function jamSelect(b)
{
    if (player)
    {
        player.kind = 'jam';
        player.coasting = true;
        player.dragF = player.dragFull * COAST_DRAG; player.dragA = player.dragAFull;
    }
    player = b;
    b.kind = 'player';
    b.coasting = false;
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

// out once every hull circle is wholly past the dashed line (the view box), on any side
function jamOut(b, pos = b.pos)
{
    const [x0, y0, x1, y1] = level.view, c = Math.cos(b.angle), s = Math.sin(b.angle);
    if (pos.x - b.radius > x1 || pos.x + b.radius < x0 || pos.y - b.radius > y1 || pos.y + b.radius < y0) return true;
    return b.circles.every(k =>
    {
        const x = pos.x + k.x*c - k.y*s, y = pos.y + k.x*s + k.y*c;
        return x - k.r > x1 || x + k.r < x0 || y - k.r > y1 || y + k.r < y0;
    });
}

// the way out: a dashed line along the view box's edge, drawn only where it crosses open water
function drawJamBoundary()
{
    const [x0, y0, x1, y1] = level.view, dash = .6*cam.wu, w = .14*cam.wu;
    const onLand = p => rects.some(r => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1) ||
        posts.some(q => Math.hypot(p.x - q.x, p.y - q.y) < q.r);
    for (const [a, b] of [[vec2(x0, y0), vec2(x1, y0)], [vec2(x1, y0), vec2(x1, y1)], [vec2(x1, y1), vec2(x0, y1)], [vec2(x0, y1), vec2(x0, y0)]])
    {
        const len = a.distance(b), n = Math.floor(len / (dash*2)), d = b.subtract(a).normalize();
        for (let i = 0; i < n; i++)
        {
            const p = a.add(d.scale(i*dash*2)), q = p.add(d.scale(dash));
            if (onLand(p.add(d.scale(dash/2)))) continue;
            drawLine(p, q, w*1.6, C_INK.scale(1, .35));
            drawLine(p, q, w, C_CREAM);
        }
    }
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
    // every boat floats and can be shoved; buoys, logs and ducks too
    const floaters = bodies.filter(b => b.kind == 'buoy' || b.kind == 'log' || b.kind == 'duck');
    const sub = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++)
    {
        if (player) controlPlayer(sub);
        for (const b of jamBoats)
        {
            b.integrate(sub);
            collideStatics(b, rects, posts, b == player ? jamHit : undefined);
        }
        for (let i = 0; i < jamBoats.length; i++)
            for (let j = i + 1; j < jamBoats.length; j++)
            {
                const A = jamBoats[i], B = jamBoats[j];
                collideBodies(A, B, A == player || B == player ? jamHit : undefined);
            }
        for (const f of floaters)
        {
            if (f.kind == 'duck') updateDuck(f, sub);
            f.integrate(sub);
            collideStatics(f, rects, posts);
            for (const o of jamBoats) collideBodies(o, f, jamFloaterHit);
        }
        for (let i = 0; i < floaters.length; i++)
            for (let j = i + 1; j < floaters.length; j++) collideBodies(floaters[i], floaters[j]);
    }

    // shoving costs: every meter a boat you aren't driving moves, paid as it happens
    let most = 0;
    for (const b of jamBoats)
    {
        // a boat let go of glides on for free until it comes to rest
        if (b.coasting && b.speed() < REST_SPEED*b.vs && Math.abs(b.angVel) < REST_SPIN/b.slowdown)
        {
            b.coasting = false;
            b.dragF = b.dragFull;
        }
        if (b != player && !b.coasting)
        {
            const d = b.pos.distance(b.lastPos);
            if (d > 1e-3) { jamPushed += d; jamPushOwed += d*JAM_PUSH; }
            if (d > most) { most = d; jamPushAt = b.pos.copy(); }
        }
        b.lastPos = b.pos.copy();
    }
    jamPushT -= dt;
    if (jamPushOwed >= 1 && jamPushT <= 0)
    {
        const cost = Math.round(jamPushOwed);
        damages += cost;
        jamPushOwed -= cost;
        jamPushT = .5;
        popup(`PUSH  -${fmtMoney(cost)}`, jamPushAt, C_SUNNY, .6, 1);     // over the boat being shoved
    }

    // shoved out counts too
    for (const b of [...jamBoats]) if (b != player && jamOut(b)) jamLeave(b);
    if (!player) return;

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

    if (jamOut(player)) jamLeave(player);
}

function jamLeave(b)
{
    jamBoats.splice(jamBoats.indexOf(b), 1);
    bodies.splice(bodies.indexOf(b), 1);
    if (b == player) { player = undefined; steerHeld = false; }
    sfx('horn', undefined, .5, clamp(3 / Math.pow(boatSize(b), .3), .35, 3));
    if (!jamBoats.length)
    {
        damages += Math.round(jamPushOwed);
        jamPushOwed = 0;
        showComplete();
    }
}

// a hard knock (against a boat or a wall) costs a bump, once per knock; pushes are paid by the meter
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

// the boat you drive hitting a buoy, log or duck: buoys ring and float off for free, a duck costs a
// little (1% of the budget) and spins
function jamFloaterHit(A, B, impact, p)
{
    const f = A.kind == 'jam' || A.kind == 'player' ? B : A, boat = f == A ? B : A;
    if (boat != player || impact / Math.min(boat.vs, f.vs) < .6 || f.hitCooldown > 0) return;
    f.hitCooldown = .4;
    if (f.kind == 'duck')
    {
        if (f.stunT > 0) return;
        f.stunT = 1.5;
        f.angVel += rand(-14, 14);
        ducksOffended++;
        const cost = Math.round(level.budget*.01);
        damages += cost;
        sfx('quack', p, 1, rand(.9, 1.3) / Math.sqrt(f.duckSize));
        popup(`QUACK  -${fmtMoney(cost)}`, f.pos, C_CORAL, .6, 1);
    }
    else sfx(f.kind == 'buoy' ? 'bong' : 'bonk', p, .8, rand(.9, 1.1) / Math.sqrt(f.k || 1));
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
