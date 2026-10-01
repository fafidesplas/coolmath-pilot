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
        name: 'Rocket Jump (pits)',
        desc: 'Your launcher never stops spinning. Fire at the ground to blast yourself the other way!',
        hint: 'Press: fire a rocket     The blast pushes you away from the explosion',
        type: 'rocket',
        hidden: true,   // not shown in the menu; remove this line to bring it back
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
        name: 'Rocket Jump',
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
        name: 'Grappling Hook',
        desc: 'Press to fire a hook, hold to reel in, release to cut loose and keep your speed!',
        hint: 'Press: fire the hook     Hold: reel in     Release: let go (you keep your momentum)',
        type: 'grapple',
        solids: [
            [-20, -14, -8],        // start ground
            [-12, -9.5, -5],       // stepping platform
            [ -4,  -1, -1.5],      // floating platform
            [  4, 6.5, -4],
            [ 10, 11.5, 1.5],      // pillar rising out of the pit
            [ 14,  20, -8],        // finish ground
            [-10, -8.5, 10.2, 4],  // pillars hanging from the ceiling: grab these
            [ -2,  -.5, 10.2, 5],
            [  6, 7.5, 10.2, 3],
            [ 12.5, 14, 10.2, 5],
            [-20,  20, 11.2, 10.2], // ceiling keeps everyone on screen
            [-21, -20, 11],        // side walls
            [ 20,  21, 11],
        ],
    },
    {
        name: 'Flow',
        desc: 'Hold to crumble into sand and pour down the slopes. Let go to pack back into a square.',
        hint: 'Hold: turn to sand and flow downhill     Release: pack back into a square where the sand lies',
        type: 'flow',
        solids: [],
        // suspended slabs as [x0, y0, x1, y1] = the left and right ends of the top surface
        slabs: [
            [-20.5, 10.1, -10.0,  6.4],   // start slope, ~20 degrees
            [-13.0,  1.4,  -2.5,  4.4],   // slopes back left (ends listed left to right, like the rest)
            [-17.0, -0.6,  -1.0, -4.5],   // and right again
            [ -3.0, -5.9,  20.5, -10.4],  // long run-out to the flag, ~11 degrees (starts under the end of the slab above)
        ],
    },
    {
        name: 'Flow 2',
        desc: 'The flag hangs high. Drop into the fire pit, turn to gas, and drift along the ceiling to it.',
        hint: 'Hold: sand     Release: pack     Fire: gas rises on its own     Press while gas: condense and fall',
        type: 'flow',
        solids: [],
        slabs: [
            [-20.5,  0.4, -12.0, -2.4],   // start slope, ~18 degrees
            [-13.0,  2.0,  21.0, 10.5],   // the ceiling: gas rises to its underside and slides up it to the flag (keep it last)
        ],
        fire: {x0: -12.5, x1: 8, y: -8.5},   // touching this evaporates you
        flag: {x: 20.6, dir: -1},            // hangs from the ceiling's underside, pennant pointing left
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
    rcSlabs = rcMakeSlabs(RC_MODES[i].slabs || []);
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
    recoil: 4,          // small kick opposite the firing direction (speed)
    radius: 4,          // blast radius
    switchRadius: 2.5,  // a blast this close to a button presses it
    power: 30,          // blast speed at the center
    maxSpeed: 27,
    friction: 7,        // ground friction
};
let rcRockets = [], rcBlasts = [];   // rcBlasts: expanding ring visuals
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
    p.down = false; p.gathering = false; p.asleep = false; p.gas = false;
    p.t = p.charge = 0;
    p.cx = p.x; p.cy = p.y;
    p.trail = [];
    p.aimA = p.lane * PI * .5;
    p.cool = 0;
    p.hook = null;
    p.spinDir = 1;
    p.parts = [];
    p.grains = RC_SAND.n * RC_SAND.n;
    p.ang = p.cAng = 0;
    if (rcIsFlow())
    {
        const sl = rcSlabs[0], x = -18.5 + p.lane * 1.4;
        p.x = x; p.y = sl.y0 + (x - sl.x0) * Math.tan(sl.ang) + 1;
        for (let i = 0; i < 90; i++) rcSquareStep(p, 1/60);   // settle onto the slope
        p.vx = p.vy = 0;
        p.cx = p.x; p.cy = p.y; p.cAng = p.ang;
        p.trail = [];
    }
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
    p.aimA += o.spin * p.spinDir * timeDelta;
    p.cool = max(0, p.cool - timeDelta);
    if (down && !p.down && p.cool <= 0)
    {
        const d = rcRocketDir(p);
        rcRockets.push({x: p.x + d.x * .6, y: p.y + d.y * .6, vx: d.x * o.speed, vy: d.y * o.speed,
            owner: p, age: 0});
        p.cool = o.cooldown;
        p.spinDir = -p.spinDir;         // each shot reverses the launcher's rotation
        p.vx -= d.x * o.recoil;
        p.vy -= d.y * o.recoil;
        rcSfxFire.play();
    }
    p.down = down;

    p.vy -= RC_GRAVITY * timeDelta;
    rcMotion(p, -.3, o.friction);
}

// Shared platformer motion: integrate, collide against rcSolids, ground friction, pit respawn.
function rcMotion(p, bounce, friction)
{
    let respawned = false;
    p.x += p.vx * timeDelta;
    for (const s of rcSolids)
        if (isOverlapping(vec2(p.x, p.y), vec2(RC_PSIZE, RC_PSIZE - .1), s.pos, s.size))   // slightly short so floors/ceilings we rest against don't count
        {
            p.x = p.vx > 0 ? s.l - RC_PSIZE/2 - .001 : s.r + RC_PSIZE/2 + .001;
            p.vx *= bounce;
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
            else if (p.vy > 0 && prevY + RC_PSIZE/2 <= s.bottom + .15)   // only when we came from below
            {
                p.y = s.bottom - RC_PSIZE/2;
                p.vy = 0;
            }
        }
    if (p.grounded) p.vx *= Math.exp(-friction * timeDelta);
    if (p.y < RC_KILL_Y)
    {
        rcSfxFall.play();
        p.x = p.cx; p.y = p.cy;
        p.vx = p.vy = 0;
        respawned = true;
    }
    p.squash *= .85;
    p.trail.push(vec2(p.x, p.y));
    if (p.trail.length > 14) p.trail.shift();
    return respawned;
}

// ---------------------------------------------------------------------------
// GRAPPLE MODE - the same spinning launcher fires a hook. Hold to reel in, release to cut loose.
//   The pull only ADDS velocity toward the anchor, so whatever speed you had is kept on release.
// ---------------------------------------------------------------------------
const RC_GRAPPLE = {
    spin: 3,            // launcher rotation (rad/s)
    speed: 55,          // hook flight speed (units/s)
    cooldown: .12,
    missCooldown: .3,
    pullAccel: 95,      // reel-in acceleration (gravity is 42, so upward pulls win)
    pullMax: 26,        // reel-in speed along the rope (extra speed from before is kept)
    maxSpeed: 32,
    swingDamp: 1.2,     // bleeds sideways speed so you don't orbit the anchor
    brakeR: 4,          // start easing in this close to the anchor
    brake: 9,
    arrive: 1.1,        // this close to the anchor you latch on and hang
    friction: 7,
};
function rcIsGrapple() { return RC_MODES[rcModeIndex].type == 'grapple'; }

function rcGrappleStep(p)
{
    const o = RC_GRAPPLE, dt = timeDelta;
    const down = keyIsDown(p.key);
    if (!p.hook) p.aimA += o.spin * p.spinDir * dt;      // launcher freezes while the hook is out
    p.cool = max(0, p.cool - dt);

    if (!down && p.hook) p.hook = null;                  // release cuts the rope
    if (down && !p.down && !p.hook && p.cool <= 0)
    {
        const d = rcRocketDir(p);
        p.hook = {fly: true, x: p.x, y: p.y, dx: d.x, dy: d.y, len: 0};
        p.cool = o.cooldown;
        rcSfxFire.play();
    }
    p.down = down;

    let hang = false;
    const h = p.hook;
    if (h && h.fly)
    {
        const n = 3, step = o.speed * dt / n;
        for (let i = 0; i < n && h.fly; i++)
        {
            const nx = h.x + h.dx * step, ny = h.y + h.dy * step;
            if (rcSolids.some(s => isOverlapping(vec2(nx, ny), vec2(.1), s.pos, s.size)))
            {
                h.fly = false;                           // stuck: h.x/h.y stay on the last free point
                h.pull = 0;
                rcSfxLand.play(vec2(h.x, h.y), .8, 1.6);
                addScreenShake(.08, .1);
            }
            else { h.x = nx; h.y = ny; h.len += step; }
        }
        if (h.fly && (abs(h.x) > 30 || h.y < -20))   // no range limit; only gives up once it leaves the world (e.g. down a pit)
        {
            p.hook = null;
            p.cool = o.missCooldown;
        }
    }
    else if (h)
    {
        const ox = h.x - p.x, oy = h.y - p.y, dist = Math.hypot(ox, oy);
        if (dist > o.arrive)
        {
            const ux = ox / dist, uy = oy / dist;
            const along = p.vx * ux + p.vy * uy;
            const gain = clamp(o.pullMax - along, 0, o.pullAccel * dt);
            p.vx += ux * gain; p.vy += uy * gain;
            const side = Math.exp(-o.swingDamp * dt);         // damp only the sideways part
            const px = p.vx - ux * (p.vx * ux + p.vy * uy), py = p.vy - uy * (p.vx * ux + p.vy * uy);
            p.vx += px * (side - 1); p.vy += py * (side - 1);
            if (dist < o.brakeR)                         // ease in near the anchor so you don't overshoot it
            {
                const b = Math.exp(-o.brake * (1 - dist / o.brakeR) * dt);
                p.vx *= b; p.vy *= b;
            }
        }
        else
        {
            hang = true;                                 // latched on: float at the anchor
            const k = Math.exp(-10 * dt);
            p.vx *= k; p.vy *= k;
        }
    }
    if (!hang) p.vy -= RC_GRAVITY * dt;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > o.maxSpeed) { p.vx *= o.maxSpeed / sp; p.vy *= o.maxSpeed / sp; }

    if (rcMotion(p, 0, p.hook ? 0 : o.friction)) p.hook = null;
}

// ---------------------------------------------------------------------------
// FLOW MODE - suspended slabs. Hold to crumble into sand grains that pour downhill; release to
//   pack the surviving grains back into a square at their center.
//   p.x / p.y is the square's center, or the sand's center of mass while crumbled.
// ---------------------------------------------------------------------------
const RC_SAND = {
    n: 7,              // the square is n x n grains
    gravity: 30,
    sub: 2,            // physics substeps per frame
    slabThick: .6,
    platFric: .12,     // grains slide on the slabs...
    grainDamp: .35,    // ...but drag on each other, so they heap up
    sqFric: .9,        // a solid square sticks to anything under ~42 degrees
    maxV: 22,
    wall: 20.8,
    winGrains: 40,     // you need at least this many grains touching the flag (49 to start)
    minGrains: 12,     // fewer than this and you are put back on your last footing
    pull: 55,          // on release, grains accelerate toward the pile's center of mass
    pullDamp: 3,       // ...with drag, so they settle instead of orbiting it
    packFrac: .85,     // pack into a square once this share of grains is gathered
    packRadius: .75,   // gathered = within this many half-square-widths of the center
    airTime: .12,      // a grain this long off the ground (or off other grounded grains) is no longer pulled
    gasLift: 20,       // gas accelerates up at this rate instead of falling
    gasFric: .03,      // gas barely drags on the ceiling, so it slides up the slope
    gasDrag: 1,
    gasTop: 12,        // gas that floats above this has escaped: respawn
    debug: true,       // print each player's grain count above them
    packTimeout: 2.5,  // seconds; then pack with whatever has gathered
};
const RC_SAND_D = RC_PSIZE / RC_SAND.n;       // grain diameter = grid spacing
function rcSqSize(p) { return Math.sqrt(p.grains) * RC_SAND_D; }   // the square shrinks as grains are lost
let rcSlabs = [];
const RC_SQ_OFFS = [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0], [0, 0]];   // x h
function rcIsFlow() { return RC_MODES[rcModeIndex].type == 'flow'; }
function rcSandForm(p) { return p.down || p.gathering || p.gas; }   // drawn and simulated as grains

function rcMakeSlabs(list)
{
    return list.map(([x0, y0, x1, y1]) =>
    {
        const L = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
        return {x0, y0, x1, y1, L, ang, c: Math.cos(ang), s: Math.sin(ang), T: RC_SAND.slabThick};
    });
}

// If a ball of radius r at (px, py) overlaps the slab, how to get out: {nx, ny, d}
function rcSlabPush(sl, px, py, r)
{
    const dx = px - sl.x0, dy = py - sl.y0;
    const u = dx * sl.c + dy * sl.s, v = -dx * sl.s + dy * sl.c;
    if (u <= -r || u >= sl.L + r || v >= r || v <= -sl.T - r) return null;
    const top = r - v, bottom = v + sl.T + r, left = u + r, right = sl.L + r - u;
    const m = Math.min(top, bottom, left, right);
    let lx = 0, ly = 0;
    if (m == top) ly = 1; else if (m == bottom) ly = -1; else if (m == left) lx = -1; else lx = 1;
    return {nx: lx * sl.c - ly * sl.s, ny: lx * sl.s + ly * sl.c, d: m};
}

function rcSandSlabs(q, r, fric = RC_SAND.platFric)
{
    for (const sl of rcSlabs)
    {
        const hit = rcSlabPush(sl, q.x, q.y, r);
        if (!hit) continue;
        if (hit.ny > .5) q.air = 0;
        q.x += hit.nx * hit.d; q.y += hit.ny * hit.d;
        const vn = q.vx * hit.nx + q.vy * hit.ny;
        if (vn >= 0) continue;
        q.vx -= vn * hit.nx; q.vy -= vn * hit.ny;              // inelastic: just stop going in
        const tx = -hit.ny, ty = hit.nx, vt = q.vx * tx + q.vy * ty;
        const cut = Math.sign(vt) * Math.min(Math.abs(vt), fric * -vn);   // Coulomb friction
        q.vx -= cut * tx; q.vy -= cut * ty;
    }
}

function rcCrumble(p)
{
    const cols = ceil(Math.sqrt(p.grains)), rows = ceil(p.grains / cols), ca = Math.cos(p.ang), sa = Math.sin(p.ang);
    p.parts = [];
    for (let k = 0; k < p.grains; k++)
    {
        const ox = (k % cols - (cols - 1) / 2) * RC_SAND_D, oy = (floor(k / cols) - (rows - 1) / 2) * RC_SAND_D;
        p.parts.push({x: p.x + ox * ca - oy * sa, y: p.y + ox * sa + oy * ca,
            vx: p.vx + rand(-.4, .4), vy: p.vy + rand(-.2, .2), shade: rand(0, .35), air: 0});
    }
}

function rcPackUp(p)
{
    const k = p.parts.length;
    p.x = p.y = p.vx = p.vy = 0;
    for (const q of p.parts) { p.x += q.x / k; p.y += q.y / k; p.vx += q.vx / k; p.vy += q.vy / k; }
    p.vx *= .5; p.vy *= .5;
    p.grains = k;
    p.parts = [];
    p.asleep = false;
    p.squash = -.2;
    p.ang = 0;
    // the pile's center of mass sits low, so the square would overlap the slab it lies on:
    // lie along that slab and lift out of it
    let under = null, bestV = 1e9;
    for (const sl of rcSlabs)
    {
        const dx = p.x - sl.x0, dy = p.y - sl.y0, u = dx * sl.c + dy * sl.s, v = -dx * sl.s + dy * sl.c;
        if (u > -.3 && u < sl.L + .3 && v > -sl.T && v < 1.5 && v < bestV) { under = sl; bestV = v; }
    }
    if (!under) return;
    p.ang = under.ang;
    for (let i = 0; i < 80 && rcSquareOverlaps(p); i++)
    {
        p.x -= under.s * .05;
        p.y += under.c * .05;
    }
}

function rcSquareOverlaps(p)
{
    const ca = Math.cos(p.ang), sa = Math.sin(p.ang), h = rcSqSize(p) / 2;
    return rcSlabs.some(sl => RC_SQ_OFFS.some(([ox, oy]) =>
        rcSlabPush(sl, p.x + ox * h * ca - oy * h * sa, p.y + ox * h * sa + oy * h * ca, 0)));
}

function rcSandRespawn(p)
{
    rcSfxFall.play();
    p.parts = [];
    p.asleep = false;
    p.gas = false;
    p.grains = RC_SAND.n * RC_SAND.n;
    p.x = p.cx; p.y = p.cy; p.vx = p.vy = 0; p.ang = p.cAng;
    p.trail = [];
}

// the rigid square: eight sample points are pushed out of the slabs
function rcSquareStep(p, dt)
{
    const o = RC_SAND;
    if (p.asleep) return;                       // settled on a slope it can grip: stay put
    p.vy -= o.gravity * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    let ground = null;
    const ca = Math.cos(p.ang), sa = Math.sin(p.ang), h = rcSqSize(p) / 2;
    const offs = RC_SQ_OFFS.map(([x, y]) => [x * h, y * h]);
    for (let it = 0; it < 3; it++)
    {
        let best = null, bestSl = null;
        for (const sl of rcSlabs)
            for (const [ox, oy] of offs)
            {
                const hit = rcSlabPush(sl, p.x + ox * ca - oy * sa, p.y + ox * sa + oy * ca, 0);
                if (hit && (!best || hit.d > best.d)) { best = hit; bestSl = sl; }
            }
        if (!best) break;
        p.x += best.nx * best.d; p.y += best.ny * best.d;
        const vn = p.vx * best.nx + p.vy * best.ny;
        if (vn < 0) { p.vx -= vn * best.nx; p.vy -= vn * best.ny; if (vn < -6) { rcSfxLand.play(); p.squash = .3; } }
        if (best.ny > .5) ground = {nx: best.nx, ny: best.ny, ang: bestSl.ang};
    }
    if (ground)
    {
        const tx = -ground.ny, ty = ground.nx, vt = p.vx * tx + p.vy * ty;
        const cut = Math.sign(vt) * Math.min(Math.abs(vt), o.sqFric * o.gravity * ground.ny * dt);
        p.vx -= cut * tx; p.vy -= cut * ty;
        p.ang += (ground.ang - p.ang) * min(1, dt * 14);          // lie flat on the slope
        if (Math.abs(p.vx) + Math.abs(p.vy) < 1 && Math.abs(p.ang - ground.ang) < .02 &&
            ground.ny * o.sqFric > Math.sqrt(1 - ground.ny * ground.ny)) { p.vx = p.vy = 0; p.asleep = true; }
    }
    else p.ang *= Math.exp(-3 * dt);
    p.x = clamp(p.x, -o.wall, o.wall);
}

function rcSandStep(p, dt, tx, ty)
{
    const o = RC_SAND, r = RC_SAND_D / 2, parts = p.parts, fric = p.gas ? o.gasFric : o.platFric;
    for (let s = 0; s < o.sub; s++)
    {
        const h = dt / o.sub;
        for (const q of parts)
        {
            if (p.gas) { q.vy += o.gasLift * h; q.vx *= Math.exp(-o.gasDrag * h); q.vy *= Math.exp(-o.gasDrag * h); }
            else q.vy -= o.gravity * h;
            q.air += h;
            if (tx !== undefined && q.air < o.airTime)
            {
                const dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy) || 1, damp = Math.exp(-o.pullDamp * h);
                q.vx = q.vx * damp + dx / d * o.pull * h;
                q.vy = q.vy * damp + dy / d * o.pull * h;
            }
            const sp = Math.hypot(q.vx, q.vy);
            if (sp > o.maxV) { q.vx *= o.maxV / sp; q.vy *= o.maxV / sp; }
            q.x += q.vx * h; q.y += q.vy * h;
            rcSandSlabs(q, r, fric);
        }
        // grain-on-grain contacts through a spatial hash
        const grid = new Map(), D = RC_SAND_D;
        parts.forEach((q, i) =>
        {
            const key = floor(q.x / D) * 4096 + floor(q.y / D);
            const cell = grid.get(key);
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
                        if (ny > .5 && b.air < o.airTime) q.air = 0;        // resting on a grounded grain
                        else if (ny < -.5 && q.air < o.airTime) b.air = 0;
                        const tx = -ny, ty = nx, vt = (q.vx - b.vx) * tx + (q.vy - b.vy) * ty, k = vt * o.grainDamp / 2;
                        q.vx -= tx * k; q.vy -= ty * k; b.vx += tx * k; b.vy += ty * k;
                    }
                }
        });
        for (const q of parts)
        {
            rcSandSlabs(q, r, fric);
            if (abs(q.x) > o.wall) { q.x = Math.sign(q.x) * o.wall; q.vx = 0; }
        }
    }
    if (!p.gas) p.parts = parts.filter(q => q.y > RC_KILL_Y);     // gas can't be lost: it is on its way back up
}

// the fire pit: any part of you in it evaporates you into gas
function rcFireCheck(p)
{
    const f = RC_MODES[rcModeIndex].fire;
    if (!f || p.gas) return;
    const sand = p.down || p.gathering, r = RC_SAND_D / 2;
    const hit = sand ? p.parts.some(q => q.x > f.x0 && q.x < f.x1 && q.y - r < f.y)
                     : p.x > f.x0 && p.x < f.x1 && p.y - rcSqSize(p) / 2 < f.y;
    if (!hit) return;
    if (!sand) rcCrumble(p);
    p.gas = true;
    p.gathering = false;
    p.asleep = false;
    rcSfxFall.play(undefined, .6, 2);
}

function rcFlowStep(p)
{
    const o = RC_SAND, dt = timeDelta, down = keyIsDown(p.key);
    if (down != p.down)
    {
        rcSfxCharge.play(undefined, 1, down ? .6 : 1.6);
        if (p.gas) { if (down) p.gas = false; }                              // press while gas: condense and fall as sand
        else if (down) { if (!p.gathering) rcCrumble(p); p.gathering = false; }   // re-press mid-gather: flow on
        else if (p.parts.length >= o.minGrains) { p.gathering = true; p.gT = 0; }
        else rcSandRespawn(p);
    }
    p.down = down;

    rcFireCheck(p);
    if (down || p.gathering || p.gas)
    {
        if (p.gathering) rcSandStep(p, dt, p.x, p.y); else rcSandStep(p, dt);
        if (p.gas && p.y > o.gasTop) rcSandRespawn(p);                       // drifted off into the sky
        if (p.gathering)
        {
            p.gT += dt;
            const rad = o.packRadius * rcSqSize(p), live = p.parts.filter(q => q.air < o.airTime);
            const near = live.filter(q => Math.hypot(q.x - p.x, q.y - p.y) < rad);
            if (near.length >= o.packFrac * live.length || p.gT > o.packTimeout)
            {
                p.gathering = false;
                rcPackUp(p);                                                 // stragglers are absorbed, not lost
                p.squash *= .85;
                return;
            }
        }
        if (p.parts.length < o.minGrains && !rcFinished(p)) { p.gathering = false; rcSandRespawn(p); }   // not enough grains left to go on
        else
        {
            const k = p.parts.length;
            p.grains = k;
            p.x = p.y = 0;
            for (const q of p.parts) { p.x += q.x / k; p.y += q.y / k; }
        }
    }
    else
    {
        rcSquareStep(p, dt);
        if (p.y < RC_KILL_Y) rcSandRespawn(p);
    }
    if (p.grains < o.winGrains && rcFlagTouching(p) > 0) rcSandRespawn(p);   // reached the flag with too little sand
    p.squash *= .85;
    p.trail.push(vec2(p.x, p.y));
    if (p.trail.length > 14) p.trail.shift();
}

function rcPressGate(g)
{
    if (g.pressed) return;
    g.pressed = true;
    rcSfxWin.play(undefined, .6, 1.5);
    addScreenShake(.2, .5);
}

function rcExplode(x, y)
{
    const o = RC_ROCKET, c = vec2(x, y);
    rcBlasts.push({x, y, age: 0});
    for (const g of rcGates)
        if (c.distance(vec2(g.button.x, g.button.y)) < o.switchRadius) rcPressGate(g);
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
            if (btn) rcPressGate(btn);
            if (btn || hitSolid || hitPlayer) { rcExplode(r.x, r.y); return false; }
        }
        return true;
    });
}

// the flag: x of the pole, y of its end, and the box it fills. It stands on the last slab, or (flag.hang)
// hangs from the underside of the last slab with its pennant pointing flag.dir.
function rcFlowFlag()
{
    const sl = rcSlabs[rcSlabs.length - 1], cfg = RC_MODES[rcModeIndex].flag, x = cfg ? cfg.x : 18;
    const line = sl.y0 + (x - sl.x0) * Math.tan(sl.ang);
    if (!cfg) return {x, y: line, hang: false, dir: 1};
    return {x, y: line - sl.T / sl.c, hang: true, dir: cfg.dir || 1};
}

// how many of the player's grains overlap the flag? (a square touching it counts all of its grains)
function rcFlagTouching(p)
{
    const f = rcFlowFlag(), len = f.hang ? 2.4 : 1.5;
    const x0 = f.dir > 0 ? f.x - .1 : f.x - len, x1 = f.dir > 0 ? f.x + len : f.x + .1;
    const y0 = f.hang ? f.y - 3 : f.y, y1 = f.hang ? f.y : f.y + 3;
    const near = (x, y, r) => x > x0 - r && x < x1 + r && y > y0 - r && y < y1 + r;
    if (rcSandForm(p)) return p.parts.filter(q => near(q.x, q.y, RC_SAND_D / 2)).length;
    return near(p.x, p.y, rcSqSize(p) / 2) ? p.grains : 0;
}

function rcFinished(p)
{
    if (rcIsOrbit()) return p.r < RC_ORBIT.ridge[RC_ORBIT.ridge.length - 1] - RC_ORBIT.half - RC_ORBIT.ballR;
    if (rcIsFlow()) return rcFlagTouching(p) >= RC_SAND.winGrains;
    if (rcIsRocket() || rcIsGrapple()) return p.x >= RC_FINISH_X - 2 && p.y <= -4.5;   // generous: anywhere near the flag, no need to be grounded
    return p.x >= RC_FINISH_X && p.grounded;
}

function rcStep(p)
{
    if (rcIsOrbit()) return rcOrbitStep(p);
    if (rcIsRocket()) return rcRocketStep(p);
    if (rcIsGrapple()) return rcGrappleStep(p);
    if (rcIsFlow()) return rcFlowStep(p);
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
    rcRockets = []; rcBlasts = [];
    rcPlayers.forEach(rcResetPlayer);
    rcWinner = null;
    rcState = 'play';
    rcStateTimer = 0;
}

function gameUpdate()
{
    rcStateTimer += timeDelta;
    rcOrbitTime += timeDelta;
    for (const b of rcBlasts) b.age += timeDelta;
    rcBlasts = rcBlasts.filter(b => b.age < .35);

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
        rcRockets = []; rcBlasts = [];
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
    const sandy = rcIsFlow() && rcSandForm(p);   // as sand, only the eye is left of the square
    if (p.trail.length > 1 && !sandy)
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
    if (rcIsFlow()) return rcDrawFlowPlayer(p);
    const sx = 1 + p.squash, sy = 1 - p.squash;
    const pos = vec2(p.x, p.y - (1 - sy) * RC_PSIZE/2);
    drawRect(pos, vec2(RC_PSIZE * sx, RC_PSIZE * sy), p.color, 0, undefined, undefined, undefined);
    drawRect(pos, vec2(RC_PSIZE * .5 * sx, RC_PSIZE * .5 * sy), p.color.lerp(WHITE, .6));
    // eye so you can see which way they face
    drawRect(pos.add(vec2(.18 * p.dir, .1)), vec2(.12), BLACK);
}

// rotated rectangle from explicit points (avoids guessing the engine's angle direction)
function rcTiltRect(center, tangent, w, h, color)
{
    const t = tangent.scale(w / 2), n = vec2(-tangent.y, tangent.x).scale(h / 2);
    drawPoly([center.subtract(t).subtract(n), center.add(t).subtract(n), center.add(t).add(n), center.subtract(t).add(n)], color);
}

function rcDrawFlowPlayer(p)
{
    const t = vec2(Math.cos(p.ang), Math.sin(p.ang)), n = vec2(-t.y, t.x), c = vec2(p.x, p.y);
    if (RC_SAND.debug) drawText(`${p.grains}`, c.add(vec2(0, 1.4)), .9, WHITE, .08, BLACK);   // grains left
    if (rcSandForm(p))
    {
        for (const q of p.parts)
            if (p.gas) drawCircle(vec2(q.x, q.y), RC_SAND_D * 2.2, p.color.lerp(WHITE, .5 + q.shade).scale(1, .5));   // translucent gas
            else drawCircle(vec2(q.x, q.y), RC_SAND_D * 1.6, p.color.lerp(WHITE, q.shade));
        rcTiltRect(c, t, rcSqSize(p) * .5, rcSqSize(p) * .5, p.color.lerp(WHITE, .6));   // the eye's white
        drawRect(c.add(t.scale(.18)).add(n.scale(.1)), vec2(.12), BLACK);                  // and its iris
        return;
    }
    const sz = rcSqSize(p), sx = 1 + p.squash, sy = 1 - p.squash;
    rcTiltRect(c.subtract(n.scale((1 - sy) * sz / 2)), t, sz * sx, sz * sy, p.color);
    rcTiltRect(c, t, sz * .5, sz * .5, p.color.lerp(WHITE, .6));
    drawRect(c.add(t.scale(.18)).add(n.scale(.1)), vec2(.12), BLACK);
}

function rcDrawAim(p)
{
    if (rcIsOrbit()) return rcDrawOrbitAim(p);
    if (rcIsFlow()) return;
    if (rcIsRocket() || rcIsGrapple()) return rcDrawRocketAim(p);
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
    const n = rcIsGrapple() ? 24 : 12;
    if (!p.hook) for (let i = 1; i < n; i++)
    {
        const q = pos.add(d.scale(.6 + i * .7));
        if (rcSolids.some(s => isOverlapping(q, vec2(.1), s.pos, s.size))) break;
        drawRect(q, vec2(.1), p.color.lerp(WHITE, .3).scale(1, max(.08, .5 - i * 12 / n * .04)));
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

function rcDrawFlowBoard()
{
    for (const sl of rcSlabs)
    {
        const nx = -sl.s * sl.T, ny = sl.c * sl.T, a = vec2(sl.x0, sl.y0), b = vec2(sl.x1, sl.y1);
        drawPoly([a, b, b.subtract(vec2(nx, ny)), a.subtract(vec2(nx, ny))], hsl(.7, .4, .22));
        drawLine(a, b, .14, hsl(.5, .8, .55));
    }
    // finish flag on the last slab
    const {x: fx, y: fy, hang, dir} = rcFlowFlag();
    if (hang)
    {
        drawRect(vec2(fx, fy - 1.5), vec2(.12, 3), hsl(0, 0, .9));
        drawPoly([vec2(0, 0), vec2(2.2 * dir, .5), vec2(0, 1)], hsl(.15, 1, .55), 0, BLACK, vec2(fx + .06 * dir, fy - 3));
    }
    else
    {
        drawRect(vec2(fx, fy + 1.5), vec2(.12, 3), hsl(0, 0, .9));
        drawPoly([vec2(0, 0), vec2(1.4, .5), vec2(0, 1)], hsl(.15, 1, .55), 0, BLACK, vec2(fx + .06, fy + 2));
    }
    rcDrawFire();
}

function rcDrawFire()
{
    const f = RC_MODES[rcModeIndex].fire;
    if (!f) return;
    drawRect(vec2((f.x0 + f.x1) / 2, (f.y + RC_KILL_Y) / 2 - .6), vec2(f.x1 - f.x0, f.y - RC_KILL_Y + 1.2), hsl(.03, .9, .3));
    for (let x = f.x0; x < f.x1; x += .7)
    {
        const flick = Math.sin(time * 7 + x * 2.3) * .5 + Math.sin(time * 11 + x * 5.1) * .3;
        const h = 1.6 + flick, hue = .04 + .05 * (Math.sin(x * 3.7) * .5 + .5);
        drawPoly([vec2(-.4, 0), vec2(.4, 0), vec2(flick * .25, h)], hsl(hue, 1, .5), 0, BLACK, vec2(x, f.y - .3));
        drawPoly([vec2(-.2, 0), vec2(.2, 0), vec2(flick * .15, h * .55)], hsl(.13, 1, .62), 0, BLACK, vec2(x, f.y - .3));
    }
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

    if (rcIsFlow())
    {
        rcDrawFlowBoard();
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

    // grappling ropes
    for (const p of rcPlayers)
    {
        const h = p.hook;
        if (!h) continue;
        const tip = vec2(h.x, h.y), from = vec2(p.x, p.y);
        drawLine(from, tip, .09, hsl(.1, .5, .8));
        drawCircle(tip, .45, hsl(0, 0, .15));
        drawCircle(tip, .3, h.fly ? p.color : WHITE);
    }

    // start line label tick
    rcPlayers.forEach(rcDrawAim);
    rcPlayers.forEach(rcDrawPlayer);

    // explosions: a hot disc that grows to the blast radius while a ring races outward
    for (const b of rcBlasts)
    {
        const k = b.age / .35, e = 1 - (1 - k) * (1 - k), d = 2 * RC_ROCKET.radius * (.15 + .85 * e);
        drawCircle(vec2(b.x, b.y), d, hsl(.08, 1, .6, .35 * (1 - k)));
        drawCircle(vec2(b.x, b.y), d * .55, hsl(.13, 1, .8, .6 * (1 - k)));
        drawCircle(vec2(b.x, b.y), d, hsl(0, 0, 0, 0), .25 * (1 - k) + .05, hsl(.1, 1, .75, 1 - k));
    }
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
