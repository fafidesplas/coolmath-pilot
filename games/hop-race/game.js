/*
    HOP RACE - local 2-player jump race
    - P1 holds A, P2 holds L. Release to jump.
    - Holding charges power; the aim angle sweeps up and down while you hold.
    - First to the flag wins.
*/

'use strict';
debugWatermark = false;

const RC_GRAVITY   = 42;
const RC_V_MIN     = 9;
const RC_V_MAX     = 25;
const RC_CHARGE_T  = 1.1;      // seconds to full power
const RC_ANGLE_LO  = 18 * PI/180;
const RC_ANGLE_HI  = 80 * PI/180;
const RC_SWEEP     = 2.6;      // aim sweep speed (rad/s)
const RC_PSIZE     = .8;
const RC_VIEW_W    = 42;
const RC_VIEW_H    = 23;
const RC_KILL_Y    = -11.5;
const RC_FINISH_X  = 18.5;

// ---------------------------------------------------------------------------
// MODES - add a new entry here and it shows up in the menu automatically.
//   solids    [left, right, top, bottom?]  (bottom defaults to far below the kill line)
//   wallCling hit a wall mid-air: stick to it, turn around, jump off the other way
// ---------------------------------------------------------------------------
const RC_MODES = [
    {
        name: 'Classic',
        desc: 'Jump right. Walls just bounce you back.',
        wallCling: false,
        solids: [
            [-20, -13, -8],   // start ground
            [-10,  -5, -8],
            [ -3,   1, -5.5], // floating block
            [  3,   8, -8],
            [  5,   6, -4],   // wall to hop over
            [ 9.5, 12.5, -4], // high platform
            [ 14,  20, -8],   // finish ground
        ],
    },
    {
        name: 'Wall Jump',
        desc: 'Hit a wall to cling and turn around. Zigzag up the shaft!',
        wallCling: true,
        solids: [
            [-20,  5, -8],        // ground
            [  8, 20, -8],        // finish ground (pit between)
            [ -7, -6,  8, -5],    // hanging wall: duck under it
            [ -2, -1,  8],        // tall wall: climb it with wall jumps
        ],
    },
    {
        name: 'Rocket Jump',
        desc: 'Your launcher never stops spinning. Fire at the ground to blast yourself the other way!',
        hint: 'Press: fire a rocket     The blast pushes you away from the explosion',
        type: 'rocket',
        solids: [
            [-20, -14, -8],       // start ground
            [-11,  -8, -6],
            [ -5,  -2, -3],
            [  1,   4,  0],       // high perch
            [  7,   9, -4],
            [ 14,  20, -8],       // finish ground
            [-20,  20, 11.2, 10.2], // ceiling keeps everyone on screen
            [-21, -20, 11],       // side walls
            [ 20,  21, 11],
        ],
    },
    {
        name: 'Rocket Jump 2',
        desc: 'No pits. Shoot the ceiling button to open the gate, then drop down the shaft to the flag.',
        hint: 'Press: fire a rocket     Shoot the red button to lift the gate',
        type: 'rocket',
        solids: [
            [-20,  20, -8],            // solid floor, no drops
            [ -8,  -4, -3.5, -4.5],    // stepping-stone ledge in the start room
            [ -1,   1, -1.5],          // divider, lower half
            [ -1,   1, 10.2, 5],       // divider, upper half: the doorway is the gap between
            [  8,  20, 10.2, 6],       // stalactite ceiling over the right chamber
            [  5,  17, -3.5, -4.5],    // roof of the dead-end cellar
            [  5,   6, -3.5],          // cellar wall
            [ 14, 15.5,  6,  0],       // hanging wall: pass under it, then down the shaft
            [-20,  20, 11.2, 10.2], // ceiling keeps everyone on screen
            [-21, -20, 11],       // side walls
            [ 20,  21, 11],
        ],
        // a shot rocket that hits the button slides the gate up into the ceiling
        gates: [
            {solid: [10, 11.5, 6, -3.5], button: {x: 3.8, y: 9.7}},
        ],
    },
    {
        name: 'Orbit',
        desc: 'Always running clockwise. Hold to aim, release to jump through the exits!',
        hint: 'You run clockwise on your own     Hold: charge the jump     Release: jump',
        type: 'orbit',
        hidden: true,   // not shown in the menu; remove this line to bring it back
        solids: [],
    },
];
let rcModeIndex = 0, rcMenuIndex = 0;   // rcMenuIndex is a position in rcMenuModes()
function rcMenuModes() { return RC_MODES.map((m, i) => i).filter(i => !RC_MODES[i].hidden); }
let rcSolids = [], rcGates = [];

function rcLoadMode(i)
{
    rcModeIndex = i;
    const make = ([l, r, top, bottom = -30]) =>
        ({pos: vec2((l+r)/2, (top+bottom)/2), size: vec2(r-l, top-bottom), top, bottom, l, r});
    rcSolids = RC_MODES[i].solids.map(make);
    rcGates = (RC_MODES[i].gates || []).map(g =>
    {
        const solid = make(g.solid);
        solid.gate = true;
        rcSolids.push(solid);
        return {solid, closedBottom: solid.bottom, button: g.button, open: 0, pressed: false};
    });
}

// Slides a gate up: its bottom edge rises toward its top as open goes 0 -> 1.
function rcGatesUpdate()
{
    for (const g of rcGates)
    {
        if (!g.pressed || g.open >= 1) continue;
        g.open = min(1, g.open + timeDelta / .8);
        const s = g.solid;
        s.bottom = lerp(g.closedBottom, s.top, g.open);
        s.size.y = s.top - s.bottom;
        s.pos.y = (s.top + s.bottom) / 2;
    }
}

let rcPlayers, rcState, rcWinner, rcStateTimer, rcStars = [];
let rcSfxJump, rcSfxLand, rcSfxFall, rcSfxWin, rcSfxCharge, rcSfxFire, rcSfxBoom;

// ---------------------------------------------------------------------------
// ROCKET MODE - a launcher spins forever; press to fire, the blast shoves you away
// ---------------------------------------------------------------------------
const RC_ROCKET = {
    spin: 3,            // launcher rotation (rad/s)
    speed: 38,          // rocket speed (units/s)
    cooldown: .1,
    radius: 4,          // blast radius
    power: 30,          // blast speed at the center
    maxSpeed: 27,
    friction: 7,        // ground friction
};
let rcRockets = [];
function rcIsRocket() { return RC_MODES[rcModeIndex].type == 'rocket'; }

// ---------------------------------------------------------------------------
// ORBIT MODE - concentric grooves with rotating exits (polar physics)
//   "down" is OUTWARD: balls rest against the outer wall of their groove.
// ---------------------------------------------------------------------------
const RC_ORBIT = {
    rim: 10.5,
    ridge:      [8.5, 6.5, 4.5, 2.5],     // radius of each ridge (wall between grooves)
    half: .15,                            // ridge half-thickness
    ballR: .3,
    gapW:       [.7, .6, .5, .6],        // exit width (radians)
    gapSpeed:   [.2, .3, .4, .5],        // exit rotation (rad/s); negative = other way
    gapPhase:   [2.2, .5, 4.0, 1.4],
    run: 5,                               // run speed along the ring (units/s)
    gravity: 40,                          // outward pull
    jumpMin: 8,                           // launch speed at zero charge
    jumpMax: 24,                          // launch speed at full charge
};
let rcOrbitTime = 0;

function rcIsOrbit() { return RC_MODES[rcModeIndex].type == 'orbit'; }
function rcGapCenter(i) { return RC_ORBIT.gapPhase[i] + RC_ORBIT.gapSpeed[i] * rcOrbitTime; }
function rcAngDiff(a, b)
{
    let d = (a - b) % (2 * PI);
    if (d > PI) d -= 2 * PI;
    if (d < -PI) d += 2 * PI;
    return d;
}
function rcInGap(i, th, r)
{
    const half = RC_ORBIT.gapW[i] / 2 - RC_ORBIT.ballR / r;
    return abs(rcAngDiff(th, rcGapCenter(i))) < half;
}

function rcMakePlayer(name, key, color, lane)
{
    return {name, key, color, lane, wins: 0, down: false, x: 0, y: 0, vx: 0, vy: 0,
        grounded: true, cling: 0, dir: 1, t: 0, charge: 0, cx: 0, cy: 0, squash: 0, trail: []};
}

function rcResetPlayer(p)
{
    p.x = -18 + p.lane * 1.4;
    p.y = -8 + RC_PSIZE/2;
    p.vx = p.vy = 0;
    p.grounded = true;
    p.cling = 0;
    p.dir = 1;
    p.down = false;
    p.t = p.charge = 0;
    p.cx = p.x; p.cy = p.y;
    p.trail = [];
    p.aimA = p.lane * PI * .5;
    p.cool = 0;
    if (rcIsOrbit())
    {
        p.r = RC_ORBIT.rim - RC_ORBIT.ballR;
        p.th = -PI/2 + p.lane * .3;
        p.vr = p.vt = 0;
        p.x = p.r * Math.cos(p.th);
        p.y = p.r * Math.sin(p.th);
    }
}

function rcAim(p)
{
    const angle = RC_ANGLE_LO + (RC_ANGLE_HI - RC_ANGLE_LO) * (.5 - .5 * Math.cos(p.t * RC_SWEEP));
    const speed = RC_V_MIN + (RC_V_MAX - RC_V_MIN) * p.charge;
    return {angle, speed, vx: Math.cos(angle) * speed * p.dir, vy: Math.sin(angle) * speed};
}

///////////////////////////////////////////////////////////////////////////////
function gameInit()
{
    rcSfxJump   = new SoundGenerator({frequency:300, release:.12, slide:.3, volume:.5});
    rcSfxLand   = new SoundGenerator({frequency:120, release:.06, slide:-.2, volume:.4});
    rcSfxFall   = new SoundGenerator({frequency:400, release:.4, slide:-.8, volume:.4});
    rcSfxWin    = new SoundGenerator({frequency:600, release:.5, pitchJump:400, pitchJumpTime:.1, repeatTime:.12, volume:.5});
    rcSfxCharge = new SoundGenerator({frequency:200, release:.03, volume:.15});
    rcSfxFire   = new SoundGenerator({frequency:500, release:.15, slide:-1.5, noise:.3, volume:.4});
    rcSfxBoom   = new SoundGenerator({frequency:70, release:.35, slide:-.1, noise:20, bitCrush:.4, volume:.7});

    for (let i = 0; i < 60; i++)
        rcStars.push({pos: vec2(rand(-22, 22), rand(-12, 12)), s: rand(.05, .15)});

    rcPlayers = [
        rcMakePlayer('P1', 'KeyA', hsl(.55, .9, .6), 0),
        rcMakePlayer('P2', 'KeyL', hsl(.08, 1, .6), 1),
    ];
    rcPlayers.forEach(rcResetPlayer);
    rcState = 'menu';
    rcLoadMode(0);
    rcWinner = null;
    rcStateTimer = 0;
}

function rcOverlap(p, s)
{
    return isOverlapping(vec2(p.x, p.y), vec2(RC_PSIZE), s.pos, s.size);
}

// Aim: angle is measured from the clockwise tangent (low = long flat hop, high = straight inward)
function rcOrbitAim(p)
{
    const o = RC_ORBIT;
    const angle = RC_ANGLE_LO + (RC_ANGLE_HI - RC_ANGLE_LO) * (.5 - .5 * Math.cos(p.t * RC_SWEEP));
    const speed = o.jumpMin + (o.jumpMax - o.jumpMin) * p.charge;
    return {angle, speed, vr: -speed * Math.sin(angle), vt: o.run + speed * Math.cos(angle)};
}

// Advances {r, th, vr, vt} one step with ring collisions; returns true if resting on an outer wall.
function rcOrbitAdvance(s, dt)
{
    const o = RC_ORBIT, band = o.half + o.ballR;
    s.vr += o.gravity * dt;
    const prevR = s.r;
    s.r += s.vr * dt;
    s.th -= s.vt / s.r * dt;

    let ground = false;
    const rMax = o.rim - o.ballR;
    if (s.r > rMax) { s.r = rMax; s.vr = min(s.vr, 0); ground = true; }
    for (let i = 0; i < o.ridge.length; i++)
    {
        const R = o.ridge[i];
        if (abs(s.r - R) >= band || rcInGap(i, s.th, s.r)) continue;
        if (prevR >= R)
        {
            s.r = R + band;                     // bonk on the ridge's outer face
            if (s.vr < 0) s.vr = -s.vr * .25;
        }
        else
        {
            s.r = R - band;                     // resting on this ridge's inner face
            s.vr = min(s.vr, 0);
            ground = true;
        }
    }
    return ground;
}

function rcOrbitStep(p)
{
    const o = RC_ORBIT;
    const down = keyIsDown(p.key);

    if (p.grounded)
    {
        p.vt = o.run;                           // always running clockwise
        if (down && !p.down) { p.t = 0; p.charge = 0; }
        if (down)
        {
            const before = p.charge;
            p.t += timeDelta;
            p.charge = min(1, p.charge + timeDelta / RC_CHARGE_T);
            if (floor(before * 8) != floor(p.charge * 8)) rcSfxCharge.play(undefined, 1, 1 + p.charge);
        }
        else if (p.down)                        // released: jump along the aimed arc
        {
            const a = rcOrbitAim(p);
            p.vr = a.vr;
            p.vt = a.vt;
            p.grounded = false;
            p.squash = -.3;
            rcSfxJump.play(undefined, 1, 1 - p.charge * .4);
        }
    }

    const ground = rcOrbitAdvance(p, timeDelta);
    if (ground && !p.grounded) { rcSfxLand.play(); p.squash = .3; p.t = p.charge = 0; }
    p.grounded = ground;
    p.down = down && ground;

    p.x = p.r * Math.cos(p.th);
    p.y = p.r * Math.sin(p.th);
    p.squash *= .85;
    p.trail.push(vec2(p.x, p.y));
    if (p.trail.length > 14) p.trail.shift();
}

function rcDrawOrbitAim(p)
{
    if (!p.grounded || !p.down) return;
    const a = rcOrbitAim(p);
    const sim = {r: p.r, th: p.th, vr: a.vr, vt: a.vt};
    const dot = p.color.lerp(WHITE, .3);
    for (let i = 0; i < 90; i++)
    {
        const ground = rcOrbitAdvance(sim, timeDelta);
        if (i % 3 == 2) drawRect(rcPolar(sim.r, sim.th), vec2(.2), dot.scale(1, 1 - i / 110));
        if (ground) break;
    }
    // power bar beside the ball
    const pos = vec2(p.x, p.y), out = pos.normalize().scale(.9);
    drawRect(pos.add(out), vec2(1.2, .18), hsl(0, 0, 0, .5));
    drawRect(pos.add(out).add(vec2(-.6 + .6 * p.charge, 0)), vec2(1.2 * p.charge, .18), p.color);
}

function rcRocketDir(p) { return vec2(Math.cos(p.aimA), Math.sin(p.aimA)); }

function rcRocketStep(p)
{
    const o = RC_ROCKET;
    const down = keyIsDown(p.key);
    p.aimA += o.spin * timeDelta;
    p.cool = max(0, p.cool - timeDelta);
    if (down && !p.down && p.cool <= 0)
    {
        const d = rcRocketDir(p);
        rcRockets.push({x: p.x + d.x * .6, y: p.y + d.y * .6, vx: d.x * o.speed, vy: d.y * o.speed,
            owner: p, age: 0});
        p.cool = o.cooldown;
        rcSfxFire.play();
    }
    p.down = down;

    p.vy -= RC_GRAVITY * timeDelta;
    p.x += p.vx * timeDelta;
    for (const s of rcSolids)
        if (rcOverlap({x: p.x, y: p.y + .03}, s))
        {
            p.x = p.vx > 0 ? s.l - RC_PSIZE/2 - .001 : s.r + RC_PSIZE/2 + .001;
            p.vx *= -.3;
        }
    const prevY = p.y;
    p.y += p.vy * timeDelta;
    p.grounded = false;
    for (const s of rcSolids)
        if (rcOverlap(p, s))
        {
            if (p.vy <= 0 && prevY - RC_PSIZE/2 >= s.top - .15)
            {
                if (p.vy < -8) { rcSfxLand.play(); p.squash = .3; }
                p.y = s.top + RC_PSIZE/2;
                p.vy = 0;
                p.grounded = true;
                p.cx = p.x; p.cy = p.y;
            }
            else if (p.vy > 0)
            {
                p.y = s.bottom - RC_PSIZE/2;
                p.vy = 0;
            }
        }
    if (p.grounded) p.vx *= Math.exp(-o.friction * timeDelta);
    if (p.y < RC_KILL_Y)
    {
        rcSfxFall.play();
        p.x = p.cx; p.y = p.cy;
        p.vx = p.vy = 0;
    }
    p.squash *= .85;
    p.trail.push(vec2(p.x, p.y));
    if (p.trail.length > 14) p.trail.shift();
}

function rcExplode(x, y)
{
    const o = RC_ROCKET, c = vec2(x, y);
    for (const p of rcPlayers)
    {
        const off = vec2(p.x, p.y).subtract(c), d = off.length();
        if (d >= o.radius) continue;
        const dir = d > .01 ? off.scale(1 / d) : vec2(0, 1);
        const k = 1 - d / o.radius;
        p.vx += dir.x * o.power * k;
        p.vy += dir.y * o.power * k;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > o.maxSpeed) { p.vx *= o.maxSpeed / sp; p.vy *= o.maxSpeed / sp; }
        p.squash = -.3;
    }
    rcSfxBoom.play(c);
    addScreenShake(.25, .2);
    new ParticleEmitter(c, 0, .3, .1, 40, PI, undefined,
        hsl(.12, 1, .7), hsl(.02, 1, .5), hsl(.12, 1, .5, 0), hsl(0, 0, .2, 0),
        .5, .5, .1, .25, 0, .92, 1, 0, PI, .1, .5, false, true);
}

function rcRocketsUpdate()
{
    const o = RC_ROCKET;
    rcRockets = rcRockets.filter(r =>
    {
        r.age += timeDelta;
        if (abs(r.x) > 30 || abs(r.y) > 20) return false;   // flew off into the void
        const n = 3;
        for (let i = 0; i < n; i++)
        {
            r.x += r.vx * timeDelta / n;
            r.y += r.vy * timeDelta / n;
            const hitSolid = rcSolids.some(s => isOverlapping(vec2(r.x, r.y), vec2(.1), s.pos, s.size));
            const hitPlayer = rcPlayers.some(p => (p != r.owner || r.age > .15) &&
                isOverlapping(vec2(r.x, r.y), vec2(.2), vec2(p.x, p.y), vec2(RC_PSIZE)));
            const btn = rcGates.find(g => !g.pressed &&
                isOverlapping(vec2(r.x, r.y), vec2(.2), vec2(g.button.x, g.button.y), vec2(1.4, .9)));
            if (btn)
            {
                btn.pressed = true;
                rcSfxWin.play(undefined, .6, 1.5);
                addScreenShake(.2, .5);
            }
            if (btn || hitSolid || hitPlayer) { rcExplode(r.x, r.y); return false; }
        }
        return true;
    });
}

function rcFinished(p)
{
    if (rcIsOrbit()) return p.r < RC_ORBIT.ridge[RC_ORBIT.ridge.length - 1] - RC_ORBIT.half - RC_ORBIT.ballR;
    return p.x >= RC_FINISH_X && p.grounded;
}

function rcStep(p)
{
    if (rcIsOrbit()) return rcOrbitStep(p);
    if (rcIsRocket()) return rcRocketStep(p);
    const mode = RC_MODES[rcModeIndex];
    const canCharge = p.grounded || p.cling;
    const down = keyIsDown(p.key);
    if (canCharge)
    {
        if (down && !p.down) { p.t = 0; p.charge = 0; }
        if (down)
        {
            const before = p.charge;
            p.t += timeDelta;
            p.charge = min(1, p.charge + timeDelta / RC_CHARGE_T);
            if (floor(before * 8) != floor(p.charge * 8)) rcSfxCharge.play(undefined, 1, 1 + p.charge);
        }
        else if (p.down)
        {
            const a = rcAim(p);
            p.vx = a.vx; p.vy = a.vy;
            p.x += p.dir * .02;           // step off the wall
            p.grounded = false;
            p.cling = 0;
            p.squash = -.3;
            rcSfxJump.play(undefined, 1, 1 - p.charge * .4);
        }
    }
    p.down = down && canCharge;

    if (!p.grounded)
    {
        if (p.cling)
        {
            // slide slowly down the wall; let go if the wall ends
            p.vx = 0;
            p.vy = max(-3, p.vy - 12 * timeDelta);
            const probe = {x: p.x + p.cling * .06, y: p.y};
            if (!rcSolids.some(s => rcOverlap(probe, s))) p.cling = 0;
        }
        else
            p.vy -= RC_GRAVITY * timeDelta;

        p.x += p.vx * timeDelta;
        for (const s of rcSolids)
            if (rcOverlap(p, s))
            {
                const side = p.vx > 0 ? 1 : -1;
                p.x = side > 0 ? s.l - RC_PSIZE/2 - .001 : s.r + RC_PSIZE/2 + .001;
                if (mode.wallCling)
                {
                    p.cling = side;
                    p.dir = -side;          // turn to face away from the wall
                    p.vx = 0;
                    p.vy = max(p.vy, -3);
                    p.t = p.charge = 0;
                    p.squash = .2;
                    rcSfxLand.play(undefined, .6, 1.5);
                }
                else
                    p.vx *= -.35;
            }
        const prevY = p.y;
        p.y += p.vy * timeDelta;
        for (const s of rcSolids)
            if (rcOverlap(p, s))
            {
                if (p.vy <= 0 && prevY - RC_PSIZE/2 >= s.top - .15)
                {
                    p.y = s.top + RC_PSIZE/2;
                    p.grounded = true;
                    p.cling = 0;
                    p.dir = 1;
                    p.vx = p.vy = 0;
                    p.squash = .35;
                    p.cx = p.x; p.cy = p.y;
                    p.t = p.charge = 0;
                    rcSfxLand.play();
                    new ParticleEmitter(vec2(p.x, p.y - .4), 0, .6, .05, 30, PI, undefined,
                        hsl(0,0,1,.8), hsl(0,0,.8,.8), hsl(0,0,1,0), hsl(0,0,.8,0),
                        .4, .15, .03, .05, 0, .9, 1, .3, PI, .1, .3);
                }
                else if (p.vy > 0)
                {
                    p.y = s.bottom - RC_PSIZE/2;   // bonk head on the underside
                    p.vy = 0;
                }
            }
        if (p.y < RC_KILL_Y)
        {
            rcSfxFall.play();
            p.x = p.cx; p.y = p.cy;
            p.vx = p.vy = 0;
            p.grounded = true;
            p.cling = 0;
            p.dir = 1;
            p.down = false;
            p.t = p.charge = 0;
        }
    }
    p.squash *= .85;

    p.trail.push(vec2(p.x, p.y));
    if (p.trail.length > 14) p.trail.shift();
}

function rcStart(modeIndex = rcModeIndex)
{
    rcLoadMode(modeIndex);
    rcOrbitTime = 0;
    rcRockets = [];
    rcPlayers.forEach(rcResetPlayer);
    rcWinner = null;
    rcState = 'play';
    rcStateTimer = 0;
}

function gameUpdate()
{
    rcStateTimer += timeDelta;
    rcOrbitTime += timeDelta;

    if (rcState == 'menu')
    {
        const list = rcMenuModes(), n = list.length;
        if (keyWasPressed('ArrowUp'))   rcMenuIndex = (rcMenuIndex + n - 1) % n;
        if (keyWasPressed('ArrowDown')) rcMenuIndex = (rcMenuIndex + 1) % n;
        for (let i = 0; i < n; i++)
            if (keyWasPressed('Digit' + (i + 1))) { rcMenuIndex = i; rcStart(list[i]); return; }
        if (keyWasPressed('Enter') || keyWasPressed('Space') || keyWasPressed('KeyA') || keyWasPressed('KeyL'))
            rcStart(list[rcMenuIndex]);
        return;
    }

    // M returns to the main menu from anywhere
    if (keyWasPressed('KeyM'))
    {
        rcState = 'menu';
        rcMenuIndex = max(0, rcMenuModes().indexOf(rcModeIndex));
        rcRockets = [];
        rcPlayers.forEach(rcResetPlayer);
        return;
    }

    if (rcState == 'win')
    {
        if (rcStateTimer > 1 && (keyWasPressed('KeyA') || keyWasPressed('KeyL') || keyWasPressed('Space')))
            rcStart();
        return;
    }

    for (const p of rcPlayers)
    {
        rcStep(p);
        if (!rcWinner && rcIsRocket() && p == rcPlayers[rcPlayers.length - 1]) rcRocketsUpdate();
        if (!rcWinner && rcIsRocket() && p == rcPlayers[rcPlayers.length - 1]) rcGatesUpdate();
        if (rcFinished(p) && !rcWinner)
        {
            rcWinner = p;
            p.wins++;
            rcState = 'win';
            rcStateTimer = 0;
            rcSfxWin.play();
            addScreenShake(.3, .3);
            new ParticleEmitter(rcIsOrbit() ? vec2(0, 0) : vec2(RC_FINISH_X, -6), 0, 1, .3, 150, PI, undefined,
                p.color, hsl(.15,1,.6), p.color.scale(1,0), hsl(.15,1,.6,0),
                1, .3, .05, .3, .1, .97, .95, .5, PI, .1, .5, false, true);
        }
    }
}

function gameUpdatePost()
{
    cameraPos = vec2(0, 0);
    cameraScale = min(mainCanvasSize.x / RC_VIEW_W, mainCanvasSize.y / RC_VIEW_H);
}

///////////////////////////////////////////////////////////////////////////////
function rcDrawPlayer(p)
{
    if (p.trail.length > 1)
        for (let i = 0; i < p.trail.length; i++)
        {
            const k = i / p.trail.length;
            drawRect(p.trail[i], vec2(RC_PSIZE * k * .8), p.color.scale(1, k * .35));
        }
    if (rcIsOrbit())
    {
        const d = RC_ORBIT.ballR * 2;
        drawCircle(vec2(p.x, p.y), d * 1.5, p.color.scale(1, .25));
        drawCircle(vec2(p.x, p.y), d, p.color);
        drawCircle(vec2(p.x - .06, p.y + .08), d * .45, p.color.lerp(WHITE, .7));
        return;
    }
    const sx = 1 + p.squash, sy = 1 - p.squash;
    const pos = vec2(p.x, p.y - (1 - sy) * RC_PSIZE/2);
    drawRect(pos, vec2(RC_PSIZE * sx, RC_PSIZE * sy), p.color, 0, undefined, undefined, undefined);
    drawRect(pos, vec2(RC_PSIZE * .5 * sx, RC_PSIZE * .5 * sy), p.color.lerp(WHITE, .6));
    // eye so you can see which way they face
    drawRect(pos.add(vec2(.18 * p.dir, .1)), vec2(.12), BLACK);
}

function rcDrawAim(p)
{
    if (rcIsOrbit()) return rcDrawOrbitAim(p);
    if (rcIsRocket()) return rcDrawRocketAim(p);
    if (!(p.grounded || p.cling) || !p.down) return;
    const a = rcAim(p);
    // trajectory preview dots
    const dot = p.color.lerp(WHITE, .3);
    for (let i = 1; i < 40; i++)
    {
        const t = i * .06;
        const x = p.x + a.vx * t;
        const y = p.y + a.vy * t - .5 * RC_GRAVITY * t * t;
        if (y < RC_KILL_Y) break;
        const q = {x, y};
        if (rcSolids.some(s => rcOverlap(q, s))) break;
        drawRect(vec2(x, y), vec2(.14), dot.scale(1, 1 - i / 55));
    }
    // aiming arrow, length shows power
    const dir = vec2(Math.cos(a.angle) * p.dir, Math.sin(a.angle));
    const len = 1 + 2.5 * p.charge;
    drawLine(vec2(p.x, p.y), vec2(p.x, p.y).add(dir.scale(len)), .12, WHITE);
    drawRect(vec2(p.x, p.y).add(dir.scale(len)), vec2(.3), WHITE, a.angle);
    // power bar above the head
    drawRect(vec2(p.x, p.y + .9), vec2(1.2, .18), hsl(0, 0, 0, .5));
    drawRect(vec2(p.x - .6 + .6 * p.charge, p.y + .9), vec2(1.2 * p.charge, .18), p.color);
}

function rcDrawRocketAim(p)
{
    const d = rcRocketDir(p), pos = vec2(p.x, p.y), ready = p.cool <= 0;
    const col = ready ? p.color : p.color.scale(1, .4);
    // faint sight line up to the first thing it would hit
    for (let i = 1; i < 12; i++)
    {
        const q = pos.add(d.scale(.6 + i * .7));
        if (rcSolids.some(s => isOverlapping(q, vec2(.1), s.pos, s.size))) break;
        drawRect(q, vec2(.1), p.color.lerp(WHITE, .3).scale(1, .5 - i * .04));
    }
    drawLine(pos, pos.add(d.scale(.9)), .22, col);
    drawRect(pos.add(d.scale(.9)), vec2(.34, .34), col, p.aimA);
}

function rcPolar(r, a) { return vec2(r * Math.cos(a), r * Math.sin(a)); }

function rcDrawOrbitBoard()
{
    const o = RC_ORBIT;
    drawCircle(vec2(), (o.rim + .5) * 2, hsl(.08, .55, .38));      // wooden rim
    drawCircle(vec2(), o.rim * 2, hsl(.05, .5, .09));              // grooves
    // ridges, drawn as arcs that skip the exit
    for (let i = 0; i < o.ridge.length; i++)
    {
        const R = o.ridge[i], gc = rcGapCenter(i), half = o.gapW[i] / 2;
        const span = 2 * PI - o.gapW[i], n = ceil(span * R / .35);
        const col = hsl(.08, .55, .42 + i * .03);
        for (let k = 0; k < n; k++)
        {
            const a0 = gc + half + span * k / n, a1 = gc + half + span * (k + 1) / n;
            drawLine(rcPolar(R, a0), rcPolar(R, a1), o.half * 2, col);
        }
        // glowing exit edges
        for (const e of [gc - half, gc + half])
            drawCircle(rcPolar(R, e), o.half * 2.2, hsl(.15, 1, .6));
    }
    // goal in the center
    const goalR = o.ridge[o.ridge.length - 1] - o.half;
    drawCircle(vec2(), goalR * 2, hsl(.1, .6, .3));
    const pulse = 1 + .08 * Math.sin(time * 4);
    drawCircle(vec2(), goalR * 1.1 * pulse, hsl(.15, 1, .55));
    drawCircle(vec2(), goalR * .6 * pulse, hsl(.15, 1, .8));
}

function gameRender()
{
    drawRect(cameraPos, vec2(200), hsl(.68, .5, .13));
    for (const s of rcStars)
        drawRect(s.pos, vec2(s.s), hsl(.6, .3, .8, .5));

    if (rcIsOrbit())
    {
        rcDrawOrbitBoard();
        rcPlayers.forEach(rcDrawAim);
        rcPlayers.forEach(rcDrawPlayer);
        return;
    }

    // solids
    for (const s of rcSolids)
    {
        drawRect(s.pos, s.size, s.gate ? hsl(.97, .45, .3) : hsl(.7, .4, .22));
        if (s.size.y < .05) continue;   // fully open gate
        drawRect(vec2(s.pos.x, s.top - .08), vec2(s.size.x, .16), hsl(.5, .8, .55));
        if (RC_MODES[rcModeIndex].wallCling)
        {
            drawRect(vec2(s.l + .04, s.pos.y), vec2(.08, s.size.y), hsl(.85, .7, .5, .6));
            drawRect(vec2(s.r - .04, s.pos.y), vec2(.08, s.size.y), hsl(.85, .7, .5, .6));
        }
    }

    // finish flag
    const fx = RC_FINISH_X;
    drawRect(vec2(fx, -8 + 1.5), vec2(.12, 3), hsl(0, 0, .9));
    drawPoly([vec2(0, 0), vec2(1.4, .5), vec2(0, 1)], hsl(.15, 1, .55), 0, BLACK, vec2(fx + .06, -8 + 2));
    // checker line
    for (let i = 0; i < 6; i++)
        drawRect(vec2(fx + 1.8, -8 + .25 + i * .5), vec2(.5), (i % 2) ? WHITE : BLACK);

    // buttons
    for (const g of rcGates)
    {
        const col = g.pressed ? hsl(.38, .8, .5) : hsl(.0, .9, .55), b = vec2(g.button.x, g.button.y);
        if (!g.pressed) drawCircle(b, 2.4 + .4 * Math.sin(time * 5), col.scale(1, .18));
        drawRect(b.add(vec2(0, .25)), vec2(1.4, .3), hsl(0, 0, .3));
        drawRect(b.add(vec2(0, g.pressed ? -.1 : 0)), vec2(1.0, .35), col);
    }

    // rockets
    for (const r of rcRockets)
    {
        const a = Math.atan2(r.vy, r.vx);
        drawLine(vec2(r.x, r.y), vec2(r.x - Math.cos(a) * .9, r.y - Math.sin(a) * .9), .16, hsl(.1, 1, .6, .6));
        drawRect(vec2(r.x, r.y), vec2(.5, .22), hsl(0, 0, .95), a);
    }

    // start line label tick
    rcPlayers.forEach(rcDrawAim);
    rcPlayers.forEach(rcDrawPlayer);
}

function gameRenderPost()
{
    const W = mainCanvasSize.x, H = mainCanvasSize.y, u = H / 100;
    const white = hsl(0, 0, 1), dim = hsl(0, 0, .8);

    if (rcState != 'menu')
    {
        drawTextScreen(`${RC_MODES[rcModeIndex].name}   (M: menu)`, vec2(W/2, u * 4), u * 3, dim, u * .25);
        const hint = RC_MODES[rcModeIndex].hint;
        if (hint) drawTextScreen(hint, vec2(W/2, H - u * 3), u * 2.6, dim, u * .2);
        rcPlayers.forEach((p, i) =>
        {
            const x = i == 0 ? u * 4 : W - u * 4;
            drawTextScreen(`${p.name}: ${p.wins}`, vec2(x, u * 5), u * 4, p.color, u * .4,
                undefined, i == 0 ? 'left' : 'right');
            drawTextScreen(`${rcIsRocket() ? 'press' : 'hold'} ${p.key.slice(3)}`, vec2(x, u * 9.5), u * 2.4, dim, u * .2,
                undefined, i == 0 ? 'left' : 'right');
        });
    }

    if (rcState == 'menu')
    {
        drawRect(vec2(W/2, H/2), vec2(W, H), hsl(.68, .5, .1, .88), 0, undefined, true);
        drawTextScreen('HOP RACE', vec2(W/2, H * .17), u * 13, white, u * .8);
        drawTextScreen('Hold to charge and release to jump, or blast off with rockets!', vec2(W/2, H * .29), u * 3, dim, u * .3);
        rcMenuModes().forEach((modeIdx, i) =>
        {
            const m = RC_MODES[modeIdx];
            const y = H * (.35 + i * .105), sel = i == rcMenuIndex;
            drawTextScreen((sel ? '> ' : '') + `${i + 1}. ${m.name}`, vec2(W/2, y), u * 6, sel ? hsl(.15, 1, .6) : dim, u * .5);
            drawTextScreen(m.desc, vec2(W/2, y + u * 6), u * 2.6, sel ? white : hsl(0, 0, .55), u * .2);
        });
        drawTextScreen('P1: hold A     P2: hold L', vec2(W/2, H * .8), u * 4, white, u * .3);
        drawTextScreen('Up/Down + Enter (or A / L) to start   -   M returns here', vec2(W/2, H * .9), u * 2.6, dim, u * .2);
    }
    else if (rcState == 'win')
    {
        drawTextScreen(`${rcWinner.name} WINS!`, vec2(W/2, H * .3), u * 12, rcWinner.color, u * .8);
        if (rcStateTimer > 1)
            drawTextScreen('Press A or L to race again', vec2(W/2, H * .42), u * 4, white, u * .3);
    }
}

///////////////////////////////////////////////////////////////////////////////
engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost);
