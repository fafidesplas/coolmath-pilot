'use strict';
// Space-only mechanics, on top of the harbor game code (main.js calls into this file at a few hooks):
//
// - A space station (level `station`): a big rigid body that nothing can push. It drifts round a slow circle and
//   spins, carrying its docking ports with it. A slip with `on: 'station'` is given in the station's own coordinates
//   and moves with its port. Inside it a docking beam carries a ship along with the port (its drag pulls toward the
//   port's motion instead of toward still space), so letting go in the slip means resting next to the port. Resting
//   is measured against the port's motion, and a ship that docks is clamped to the station from then on.
// - Gravity (level `gravity`): a steady pull, `share` of each ship's own full thrust (so it feels the same in every
//   ship), toward `dir` (default down). A ship falls once it has control; ones waiting their turn hang in the sky.
//   Under gravity the side thrusters turn a ship with no speed (A/D or the mouse), and a ship that parks is set down
//   for good instead of dropping an anchor. A falling ship has no keel: its drag is the same in every direction (air,
//   not water), so it falls straight down whichever way it points.
// - Landing pads: docks with `pad: true`, drawn as a landing pad.

const STATION_SPIN_DEFAULT = 2*PI/60;     // rad/s: one turn a minute
const RCS_TURN = 2.2;                     // gravity levels: side thruster spin, times the ship's turn rate (toy units)
const BEAM_GROW = .5;                     // the docking beam reaches this many ship lengths past the slip's sides

// ---------------------------------------------------------------------------
// the station: an orbital lab after the 2000s ones, top view, in meters. x runs along the module stack (the front
// port at +x), y along the truss. Parts are rects [x0, y0, x1, y1]; each collides as a row of circles.

const STATION =
{
    truss: [[-2.2, -55, 2.2, 55]],
    wings: [34, 47, -34, -47].flatMap(y => [[4, y - 5, 36, y + 5], [-36, y - 5, -4, y + 5]]),
    radiators: [16, -16].flatMap(y => [[3, y - 3, 14, y + 3], [-14, y - 3, -3, y + 3]]),
    // the module stack, from the aft port to the front port: [x0, x1, radius]
    stack: [[-32, -28, 1.6], [-28, -12, 2.2], [-12, 4, 2.1], [4, 10, 2.3], [10, 20, 2.2], [20, 26, 2.3]],
    // side modules off the nodes: [x, y0, y1, radius]
    side: [[23, 2.3, 15, 2.1], [23, -2.3, -11, 2.1], [7, 2.3, 9, 1.8], [7, -2.3, -10, 1.9]],
    // docking ports at the two ends of the module stack: [x, y, facing]. Ships dock across the stack, lying broadside
    // against the port like the bar of a T
    ports: [[26, 0, 0], [-32, 0, PI]],
};

// a rect [x0, y0, x1, y1] as a row of circles along its long side
function rectCircles([x0, y0, x1, y1])
{
    const w = x1 - x0, h = y1 - y0, r = Math.min(w, h)/2, along = w >= h, len = Math.max(w, h);
    const n = Math.max(1, Math.ceil((len - 2*r) / (1.4*r)) + 1), out = [];
    for (let i = 0; i < n; i++)
    {
        const u = n == 1 ? len/2 : r + (len - 2*r)*i/(n - 1);
        out.push(along ? { x: x0 + u, y: (y0 + y1)/2, r } : { x: (x0 + x1)/2, y: y0 + u, r });
    }
    return out;
}

function stationCircles()
{
    const S = STATION, rects = [...S.truss, ...S.wings, ...S.radiators,
        ...S.stack.map(([a, b, r]) => [a, -r, b, r]),
        ...S.side.map(([x, a, b, r]) => [x - r, Math.min(a, b), x + r, Math.max(a, b)])];
    return [...rects.flatMap(rectCircles), ...S.ports.map(([x, y, f]) => ({ x: x + Math.cos(f)*.3, y: y + Math.sin(f)*.3, r: 1.3 }))];
}

let stations = [];

// level.station: { x, y: center of its drift circle, a: heading at the start, spin: rad/s, drift: { r: m, period: s, phase } }
function stationLoad(def)
{
    const b = new Body(vec2(def.x, def.y), def.a || 0, stationCircles(), 1, { kind: 'station', dragF: 0, dragS: 0, dragA: 0, restitution: .3 });
    b.invMass = b.invInertia = 0;           // nothing pushes it around
    b.mass = 1e12;
    b.def = def; b.t = 0;
    b.spin = def.spin ?? STATION_SPIN_DEFAULT;
    b.pos = stationPos(b, 0);
    b.updateWorld();
    bodies.push(b);
    stations.push(b);
    return b;
}

function stationPos(b, t)
{
    const d = b.def.drift;
    if (!d) return vec2(b.def.x, b.def.y);
    const a = (d.phase || 0) + 2*PI*t/d.period;
    return vec2(b.def.x + d.r*Math.cos(a), b.def.y + d.r*Math.sin(a));
}

// before the bodies move: set each station's velocity so this step lands it exactly where its path says
function stationsDrive(dt)
{
    for (const b of stations)
    {
        b.t += dt;
        const p = stationPos(b, b.t);
        b.vel = p.subtract(b.pos).scale(1/dt);
        b.angVel = b.spin;
        b.squash = b.squashVel = 0;
    }
}

// after the bodies move: ships docked to a station ride along, and slips on a station follow their port
function stationsFollow()
{
    for (const b of bodies)
    {
        const h = b.held;
        if (!h?.on) continue;
        b.pos = h.on.toWorld(h.x, h.y);
        b.angle = h.on.angle + h.a;
        b.vel = h.on.pointVel(b.pos);
        b.angVel = h.on.angVel;
        b.updateWorld();
    }
    for (const s of slips) if (s.on) placeSlip(s);
}

// a slip given in a station's coordinates (slip.on: 'station')
function attachSlip(slip, s)
{
    slip.on = stations[0];
    slip.local = { x: slip.pos.x, y: slip.pos.y, a: s.a };
    placeSlip(slip);
    return slip;
}

function placeSlip(slip)
{
    const st = slip.on, l = slip.local;
    slip.pos = st.toWorld(l.x, l.y);
    slip.a = st.angle + l.a;
}

// the motion of the space around a ship: a docking beam moves with its port, anywhere else space is still.
// x, y, a: its velocity and spin there; ax, ay: its acceleration there (the turn pulls toward the station's center, the
// drift bends round its circle), which the beam gives the ship too, or it would always lag a little behind the port
function mediumAt(b)
{
    if (b != player || !slip?.on || b.held) return null;
    const c = Math.cos(slip.a), s = Math.sin(slip.a), d = b.pos.subtract(slip.pos), grow = BEAM_GROW*boatSize(b);
    if (Math.abs(d.x*c + d.y*s) > slip.len/2 + grow || Math.abs(-d.x*s + d.y*c) > slip.wid/2 + grow) return null;
    const st = slip.on, v = st.pointVel(b.pos), w = st.angVel, r = b.pos.subtract(st.pos), ac = stationAccel(st);
    return { x: v.x, y: v.y, a: w, ax: ac.x - w*w*r.x, ay: ac.y - w*w*r.y };
}

// the acceleration of a station's center along its drift circle
function stationAccel(b)
{
    const d = b.def.drift;
    if (!d) return vec2();
    const w = 2*PI/d.period;
    return vec2(b.def.x - b.pos.x, b.def.y - b.pos.y).scale(w*w);
}

// speed and spin of a ship against the space around it (what resting and settling look at)
function relSpeed(b) { const m = mediumAt(b); return m ? Math.hypot(b.vel.x - m.x, b.vel.y - m.y) : b.speed(); }
function relSpin(b) { const m = mediumAt(b); return Math.abs(b.angVel - (m ? m.a : 0)); }

// a ship that parks on a station is clamped to it; under gravity it is set down for good
function holdShip(b)
{
    b.vel = vec2(); b.angVel = 0;
    b.invMass = b.invInertia = 0;
    b.falls = false;
    const st = slip?.on;
    if (st)
    {
        const d = b.pos.subtract(st.pos), c = Math.cos(st.angle), s = Math.sin(st.angle);
        b.held = { on: st, x: d.x*c + d.y*s, y: -d.x*s + d.y*c, a: b.angle - st.angle };
    }
    else b.held = {};
    sfx('chain', b.pos, .6, 1.6);
}

// parking here holds the ship in place instead of dropping an anchor
function holdsInstead() { return !!(slip?.on || level?.gravity); }

// ---------------------------------------------------------------------------
// gravity

function gravityPull(b)
{
    const g = level.gravity, a = g.dir ?? -PI/2, acc = g.share * b.power * b.invMass;
    return vec2(Math.cos(a)*acc, Math.sin(a)*acc);
}

function applyGravity(dt)
{
    if (!level?.gravity) return;
    if (player && hasControl() && !player.held) player.falls = true;
    for (const b of bodies)
    {
        if (!b.falls || !b.invMass) continue;
        const g = gravityPull(b);
        b.dragS = b.dragF;          // no keel: the boat drag would steer the fall along the hull
        b.vel.x += g.x*dt;
        b.vel.y += g.y*dt;
    }
}

// side thrusters: under gravity the ship turns with no speed (the harbor rudder needs the ship to move, and turns
// the wrong way when it falls backward)
function thrusterSpin(b, rudder, throttle)
{
    return rudder * (RCS_TURN*b.type.turn + b.type.wash*Math.abs(throttle)) / (b.slowdown*b.slowdown);
}

// ---------------------------------------------------------------------------
// drawing

function stationPainter(b, ox = 0, oy = 0) { return painter({ pos: b.pos, angle: b.angle, k: 1, sx: 1, sy: 1, id: b.id }, ox, oy); }

function drawStations()
{
    for (const b of stations) if (inView(b.pos, b.radius)) drawStation(b);
}

function drawStation(b)
{
    const S = STATION, o = shadowOff(4), sh = stationPainter(b, o.x, o.y), d = stationPainter(b);
    const rect = (p, [x0, y0, x1, y1], color, outline) => p.rect((x0 + x1)/2, (y0 + y1)/2, x1 - x0, y1 - y0, color, outline);
    const pod = ([a, b2, r]) => [a, -r, b2, r];
    // shadow
    for (const r of [...S.wings, ...S.radiators, ...S.truss]) rect(sh, r, C_SHADOW);
    for (const m of S.stack) rect(sh, pod(m), C_SHADOW);
    // solar wings: mustard cells on a cream mast, a beacon at each tip
    const fine = 2 / WU > .25;
    for (const w of S.wings)
    {
        const [x0, y0, x1, y1] = w, cy = (y0 + y1)/2;
        rect(d, w, P_MUSTARD, true);
        if (fine)
        {
            for (let x = x0 + 4; x < x1 - 1; x += 4) d.line(x, y0 + .5, x, y1 - .5, .22, P_ORANGE);
            d.line(x0, cy, x1, cy, .7, P_CREAM);
        }
        const tip = Math.abs(x0) > Math.abs(x1) ? x0 : x1;
        if (Math.sin(time*3 + cy) > .4) d.circle(tip, cy, 1.4, P_BRICK);
    }
    // radiators: cream fins with ribs
    for (const r of S.radiators)
    {
        rect(d, r, P_CREAM, true);
        if (fine) for (let x = Math.min(r[0], r[2]) + 1.5; x < Math.max(r[0], r[2]); x += 1.5) d.line(x, r[1] + .4, x, r[3] - .4, .18, P_SAND);
    }
    // the truss: a sand girder with a zigzag lattice
    const T = S.truss[0];
    rect(d, T, P_SAND, true);
    if (fine)
    {
        for (let y = T[1]; y < T[3] - 2; y += 4) { d.line(T[0] + .4, y, T[2] - .4, y + 2, .3, P_DEEP); d.line(T[2] - .4, y + 2, T[0] + .4, y + 4, .3, P_DEEP); }
    }
    // modules: cream cylinders with sand collars at the joints, a few portholes
    for (const [x, y0, y1, r] of S.side) rect(d, [x - r, Math.min(y0, y1), x + r, Math.max(y0, y1)], P_CREAM, true);
    for (const m of S.stack) rect(d, pod(m), P_CREAM, true);
    for (const [a, b2, r] of S.stack) { d.rect(a + .35, 0, .7, 2*r + .4, P_SAND, true); d.rect(b2 - .35, 0, .7, 2*r + .4, P_SAND, true); }
    if (fine)
    {
        for (const x of [-25, -21, -17, 13, 16]) d.circle(x, 0, 1, P_DEEP);
        for (const x of [-21, 16]) d.circle(x, 0, .6, P_GLASS);
    }
    d.circle(7, -10.5, 3, P_CREAM, true);                     // the cupola: a glass dome
    d.circle(7, -10.5, 2, P_GLASS, true);
    // docking ports: a cream ring, a dark seal, a blinking light
    for (const [x, y, f] of S.ports)
    {
        const px = x + Math.cos(f)*.3, py = y + Math.sin(f)*.3;
        d.circle(px, py, 2.6, P_CREAM, true);
        d.circle(px, py, 1.75, P_DEEP);
        d.circle(px, py, .8, Math.sin(time*4 + x) > 0 ? P_MUSTARD : P_BRICK);
    }
}

// a landing pad, seen from the side: a concrete slab sunk in the rock, hazard stripes along its deck, a light at each end
function drawPad(r)
{
    const w = r.x1 - r.x0, h = r.y1 - r.y0, top = Math.min(h*.35, w*.06);
    const c = fillRect(r, P_SAND);
    if (!c) return;
    fillRect({ x0: r.x0 + top*.5, y0: r.y0, x1: r.x1 - top*.5, y1: r.y1 - top*1.6 }, P_DUSK.scale(1, .35));
    fillRect({ x0: r.x0, y0: r.y1 - top, x1: r.x1, y1: r.y1 }, P_MUSTARD);
    const stripe = top*1.6;
    if (stripe / WU > .12)
    {
        const segs = [];
        for (let x = r.x0 + stripe*.5; x < r.x1 - stripe*.5; x += stripe*2) segs.push([vec2(x - r.x0, top*.15), vec2(x - r.x0 + stripe*.6, top*.85)]);
        posterSegs(vec2(r.x0, r.y1 - top), segs, P_DEEP, stripe*.45);
    }
    const on = Math.sin(time*4) > 0, lr = Math.max(top*.7, .06*WU);
    for (const x of [r.x0 + lr, r.x1 - lr]) drawCircle(vec2(x, r.y1 + lr*.8), lr*2, on ? P_BRICK : P_MUSTARD);
}

// a slip on a station turns with it: dashed (or lit when the ship is in it), and the docking beam glows faintly
function drawMovingSlip(inside)
{
    const s = slip, c = Math.cos(s.a), n = Math.sin(s.a), lw = Math.min(.14*WU, s.wid*.08);
    const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => vec2(s.pos.x + u*s.len/2*c - v*s.wid/2*n, s.pos.y + u*s.len/2*n + v*s.wid/2*c));
    const pulse = .5 + .5*Math.sin(time*5);
    if (inside) drawPoly(pts, P_CREAM.scale(1, .15 + .1*pulse), lw*1.15, P_CREAM);
    else
    {
        drawPoly(pts, P_GLASS.scale(1, .06 + .04*pulse));
        drawDashedRect(s.pos, s.len, s.wid, C_CREAM, lw, Math.max(.45*WU, s.wid*.15), s.a);
    }
}
