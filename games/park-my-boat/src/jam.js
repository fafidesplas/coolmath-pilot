'use strict';
// Crowded harbors: a level with jam: true starts as a packed corner of a harbor, every boat already in the
// water and every one of them yours. Tap a boat to select it (a ring shows which), then drive it to its own
// slip: a dashed box in free water with a ghost of that boat's hull in it. Switch boats whenever you like; the
// one you leave keeps its momentum and glides on. Rest a boat in its slip for REST_TIME and it parks and holds
// still (any boat resting in its own slip parks, driven or not). The other boats float too: you can shove them
// out of the way, but every meter a boat you aren't driving is moved costs money, and a hard knock costs a
// bump, so planning the order is the cheap way. Park every boat; stars come from the money kept.
//
// level fields: jam: true, view: [x0, y0, x1, y1] (what the camera shows: the crowd and the slips; an invisible
//               wall closes the sea round it), budget ($), moored: the boats, each with a slip
//               ({ x, y, a, pad, fingers: 'none' }, as in a chain level's boats).

const JAM_BUMP = .1;            // share of the budget one bump costs
const JAM_KNOCK = 1;            // impact (in the boat's own speed scale) from which a hit is a bump
const JAM_PUSH = 100;           // $ per meter a boat you aren't driving gets moved
let jamBoats = [], jamBumps = 0, jamPushed = 0, jamPushOwed = 0, jamPushT = 0, jamPushAt = vec2(), jamDone = -1;

function jamLoad(L)
{
    jamBoats = (L.moored || []).map((m, k) =>
    {
        const b = makeBoat(m.boat, vec2(m.x, m.y), m.a, 'jam', MOORED_COLORS[k % MOORED_COLORS.length], boatK(L, m));
        b.slip = makeSlip(m, b.k);
        b.parked = false; b.restT = 0; b.restArmed = true;
        b.lastPos = b.pos.copy();
        return b;
    });
    // the sea round the view box is closed by invisible walls, so a boat can't leave the harbor
    const [x0, y0, x1, y1] = L.view, t = 100;
    for (const r of [[x0 - t, y0 - t, x0, y1 + t], [x1, y0 - t, x1 + t, y1 + t], [x0 - t, y0 - t, x1 + t, y0], [x0 - t, y1, x1 + t, y1 + t]])
        rects.push({ x0:r[0], y0:r[1], x1:r[2], y1:r[3], wall:true });
    jamBumps = jamPushed = jamPushOwed = jamPushT = 0;
    jamDone = -1;
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
    slip = b.slip;
    restT = 0; restArmed = true;
    b.kind = 'player';
    b.coasting = false;
    sfx('click', b.pos, 1, 1.2);
    if (!attempts++) track('design', 'tutorial:step01');
}

// which jam boat is under a world point
function jamPick(p)
{
    for (const b of jamBoats)
        if (!b.parked) for (let i = 0; i < b.circles.length; i++)
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
            if (b.parked) continue;
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
        if (b != player && !b.coasting && !b.parked)
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

    // a boat at rest with part of its hull in its own slip parks once it has stayed REST_TIME; the one you drive
    // must have no input. After a miss it has to move before the next check.
    for (const b of jamBoats)
    {
        if (b.parked) continue;
        const still = b.speed() < REST_SPEED*b.vs && Math.abs(b.angVel) < REST_SPIN/b.slowdown && (b != player || !b.throttle && !b.rudder);
        if (!still) { b.restT = 0; b.restArmed = true; continue; }
        if (!b.restArmed || !jamInSlip(b, false)) { b.restT = 0; continue; }
        b.restT += dt;
        if (b == player) restT = b.restT;
        if (b.restT >= REST_TIME) jamJudge(b);
    }
    if (jamDone > 0 && (jamDone -= dt) <= 0) { damages += Math.round(jamPushOwed); jamPushOwed = 0; return showComplete(); }
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
}

// every hull circle of b inside its slip (all), or any of them (!all), with a small tolerance
function jamInSlip(b, all = true)
{
    const sl = b.slip, c = Math.cos(sl.a), sn = Math.sin(sl.a), tol = .15*b.k;
    for (let i = 0; i < b.circles.length; i++)
    {
        const p = b.world[i], r = b.circles[i].r, dx = p.x - sl.pos.x, dy = p.y - sl.pos.y;
        const lx = dx*c + dy*sn, ly = -dx*sn + dy*c;
        const inside = Math.abs(lx) + r <= sl.len/2 + tol && Math.abs(ly) + r <= sl.wid/2 + tol;
        if (inside != all) return !all;
    }
    return all;
}

// the check after REST_TIME: all the way in parks the boat for good (it holds still, a wall to the rest);
// part way in is a miss, and the boat must move before it is checked again
function jamJudge(b)
{
    b.restT = 0; b.restArmed = false;
    if (b == player) restT = 0;
    if (!jamInSlip(b))
    {
        sfx('fail');
        return;
    }
    b.parked = true;
    b.vel = vec2(); b.angVel = 0; b.invMass = 0; b.invInertia = 0; b.coasting = false;
    b.kind = 'jam';
    sfx('win');
    confetti(b.pos, b.k);
    popup(rand() < .5 ? 'DOCKED!' : 'LAND HO!', b.pos, C_SUNNY, 1.2, 1.6);
    if (b == player) { player = undefined; slip = undefined; steerHeld = false; }
    if (jamBoats.every(o => o.parked)) jamDone = 1.4;
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
    const left = jamBoats.filter(b => !b.parked).length;
    txt(`${left} boat${left == 1 ? '' : 's'} left${player ? ' · ' + player.type.name : ''}`, 10, 21.75, .55, C_TEAL, 'left');
    txt(`Money: ${fmtMoney(Math.max(0, L.budget - damages))}`, 26, 21.75, .55, damages ? C_CORAL : C_INK);
}

// debug (window.game.win): every boat parked, no bumps
function jamWin()
{
    for (const b of jamBoats) { b.parked = true; b.vel = vec2(); b.invMass = 0; b.invInertia = 0; b.pos = b.slip.pos.copy(); b.angle = b.slip.a; b.updateWorld(); }
    player = undefined; slip = undefined;
    showComplete();
}

// every slip: the unparked boats' own, dashed in the boat's color with a ghost of its hull in it; the selected
// boat's slip is brighter and pulses. A boat resting in its slip fills it.
function drawJamSlips()
{
    const pulse = .5 + .5*Math.sin(time*5);
    for (const b of jamBoats)
    {
        if (b.parked) continue;
        const s = b.slip, on = b == player, inside = jamInSlip(b);
        const lw = Math.min(.14*WU, s.wid*.08), a = on ? 1 : .6;
        drawEllipse(s.pos, vec2(b.type.L*b.k, b.type.W*b.k), b.color.scale(1, on ? .5 : .3), -s.a, .08*cam.wu, b.color.scale(1, .8));
        const pts = [vec2(s.pos.x - s.w/2, s.pos.y - s.h/2), vec2(s.pos.x + s.w/2, s.pos.y - s.h/2), vec2(s.pos.x + s.w/2, s.pos.y + s.h/2), vec2(s.pos.x - s.w/2, s.pos.y + s.h/2)];
        if (inside) drawPoly(pts, C_CREAM.scale(1, .15 + .1*pulse), lw*1.15, C_CREAM);
        else drawDashedRect(s.pos, s.w, s.h, C_CREAM.scale(1, a), lw*(on ? 1.4 : 1), Math.max(.45*WU, s.wid*.15));
    }
}
