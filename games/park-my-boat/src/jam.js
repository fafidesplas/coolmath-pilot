'use strict';
// Crowded harbors: a level with jam: true starts as a packed corner of a harbor, every boat already in the
// water and every one of them yours. Tap a boat to select it (a white outline shows which), then drive it to its own
// slip: a dashed box in free water with a ghost of that boat's hull in it. Switch boats whenever you like; the
// one you leave keeps its momentum and glides on. Rest a boat in its slip for REST_TIME and it parks and holds
// still (any boat resting in its own slip parks, driven or not). The other boats float too: you can shove them
// out of the way, but hits cost money exactly as in the other levels (onHit in main.js), so planning the order
// is the cheap way. Park every boat; stars come from the money kept (the default parking budget).
//
// level fields: jam: true, view: [x0, y0, x1, y1] (what the camera shows: the crowd and the slips; an invisible
//               `walls` in the level data close the sea round it), moored: the boats, each with a slip
//               ({ x, y, a, pad, fingers: 'none' }, as in a chain level's boats).

let jamBoats = [], jamDone = -1;

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
    // the hurt eyes and curse bubbles of bumped boats time out (stepWorld does this in the other levels)
    for (const b of bodies) { if (b.hurtT > 0) b.hurtT -= dt; if (b.swearT > 0) b.swearT -= dt; }
    // every boat floats and can be shoved; buoys, logs and ducks too
    const floaters = bodies.filter(b => b.kind == 'buoy' || b.kind == 'log' || b.kind == 'duck');
    const sub = dt / SUBSTEPS;
    updateSubs(dt);
    for (let s = 0; s < SUBSTEPS; s++)
    {
        if (player) controlPlayer(sub);
        for (const b of jamBoats)
        {
            if (b.parked) continue;
            b.integrate(sub);
            collideStatics(b, b.under ? subRects() : rects, posts, b == player ? onHit : undefined);
        }
        for (let i = 0; i < jamBoats.length; i++)
            for (let j = i + 1; j < jamBoats.length; j++)
            {
                const A = jamBoats[i], B = jamBoats[j];
                if (!A.under && !B.under) collideBodies(A, B, A == player || B == player ? onHit : undefined);
            }
        for (const f of floaters)
        {
            if (f.kind == 'duck') updateDuck(f, sub);
            f.integrate(sub);
            collideStatics(f, rects, posts);
            for (const o of jamBoats) if (!o.under) collideBodies(o, f, o == player ? onHit : undefined);
        }
        for (let i = 0; i < floaters.length; i++)
            for (let j = i + 1; j < floaters.length; j++) collideBodies(floaters[i], floaters[j]);
    }

    // a boat let go of glides on for free until it comes to rest
    for (const b of jamBoats)
        if (b.coasting && b.speed() < REST_SPEED*b.vs && Math.abs(b.angVel) < REST_SPIN/b.slowdown)
        {
            b.coasting = false;
            b.dragF = b.dragFull;
        }

    // a boat at rest with part of its hull in its own slip parks once it has stayed REST_TIME; the one you drive
    // must have no input. After a miss it has to move before the next check.
    for (const b of jamBoats)
    {
        if (b.parked) continue;
        const still = b.speed() < REST_SPEED*b.vs && Math.abs(b.angVel) < REST_SPIN/b.slowdown && (b != player || !b.throttle && !b.rudder) && !b.under && !b.wantDive;
        if (!still) { b.restT = 0; b.restArmed = true; continue; }
        if (!b.restArmed || !jamInSlip(b, false)) { b.restT = 0; continue; }
        b.restT += dt;
        if (b.restT >= REST_TIME) jamJudge(b);
    }
    // the ring follows the driven boat's timer, so it clears whenever that resets (moved, left the slip, missed)
    restT = player && !player.parked ? player.restT : 0;
    if (jamDone > 0 && (jamDone -= dt) <= 0) return showComplete();
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

// the boat being driven gets a white outline: its own hull shape, filled and stroked white under the boat,
// so only a rim shows around it
function drawJamSelection()
{
    const b = player;
    if (!b) return;
    const P = painter(b).P;
    drawPoly(b.type.hullPts.map(p => P(p.x, p.y)), WHITE, .34*cam.wu, WHITE);
}

function drawJamHud()
{
    const left = jamBoats.filter(b => !b.parked).length;
    txt(`${left} boat${left == 1 ? '' : 's'} left${player ? ' - ' + player.type.name : ''}`, 10, 21.75, .55, C_TEAL, 'left');
    if (damages) txt(`Damages: ${fmtMoney(damages)}`, 26, 21.75, .55, C_CORAL);
    drawAirGauge();
}

// debug (window.game.win): every boat parked, no bumps
function jamWin()
{
    for (const b of jamBoats) { b.parked = true; b.vel = vec2(); b.invMass = 0; b.invInertia = 0; b.pos = b.slip.pos.copy(); b.angle = b.slip.a; b.updateWorld(); }
    player = undefined; slip = undefined;
    showComplete();
}

// the selected boat's slip, dashed; it fills when the boat rests in it. The other boats' slips are not shown.
function drawJamSlips()
{
    const pulse = .5 + .5*Math.sin(time*5);
    for (const b of jamBoats)
    {
        if (b.parked || b != player) continue;      // only the selected boat's slip shows
        const s = b.slip, on = true, inside = jamInSlip(b);
        const lw = Math.min(.14*WU, s.wid*.08), a = on ? 1 : .6;
        const pts = [vec2(s.pos.x - s.w/2, s.pos.y - s.h/2), vec2(s.pos.x + s.w/2, s.pos.y - s.h/2), vec2(s.pos.x + s.w/2, s.pos.y + s.h/2), vec2(s.pos.x - s.w/2, s.pos.y + s.h/2)];
        if (inside) drawPoly(pts, C_CREAM.scale(1, .15 + .1*pulse), lw*1.15, C_CREAM);
        else drawDashedRect(s.pos, s.w, s.h, C_CREAM.scale(1, a), lw*(on ? 1.4 : 1), Math.max(.45*WU, s.wid*.15));
    }
}
