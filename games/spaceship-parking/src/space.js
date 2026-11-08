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
// - Nesting (`in: n` on the level's station, a moored boat or a chain boat's start): that part of the level stays out
//   of it until chain boat n has parked, then appears where boat n really parked (see nestLoad). With slips inside a
//   moored ship (`on: 'moored'`, a carrier's hangar) a level can nest ships one inside the other.

const STATION_SPIN_DEFAULT = 2*PI/60;     // rad/s: one turn a minute
const RCS_TURN = 2.2;                     // gravity levels: side thruster spin, times the ship's turn rate (toy units)
const BEAM_GROW = .5;                     // the docking beam reaches this many ship lengths past the slip's sides

// ---------------------------------------------------------------------------
// the station: an orbital lab after the 2000s ones, top view, in meters. x runs along the module stack (the front
// port at +x), y along the truss. Parts are rects [x0, y0, x1, y1]; each collides as a row of circles, except the solar
// wings (see wingBoxes).

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

// the solar wings collide as solid rectangles, one per pair of wings on each side of the truss, reaching in to the
// truss: as rows of circles their scalloped edges, the slot between the two wings of a pair and the slot between the
// wings and the truss caught the Escape Pod. The drawing is unchanged.
function wingBoxes(sc = 1)
{
    const groups = {}, [tx0, , tx1] = STATION.truss[0];
    for (const [x0, y0, x1, y1] of STATION.wings)
    {
        const g = groups[Math.sign(x0 + x1) + ',' + Math.sign(y0 + y1)] ||= [x0, y0, x1, y1];
        g[0] = Math.min(g[0], x0); g[1] = Math.min(g[1], y0); g[2] = Math.max(g[2], x1); g[3] = Math.max(g[3], y1);
    }
    for (const g of Object.values(groups)) if (g[0] > 0) g[0] = tx1; else g[2] = tx0;
    return Object.values(groups).map(g => g.map(v => v*sc));
}

// every docking port of a station: the two at the ends of the module stack plus the level's own (def.ports, e.g. at
// the end of a side module), in station units
function stationPorts(def) { return [...STATION.ports, ...(def.ports || [])]; }

function stationCircles(def)
{
    const S = STATION, sc = def.scale || 1, rects = [...S.truss, ...S.radiators,
        ...S.stack.map(([a, b, r]) => [a, -r, b, r]),
        ...S.side.map(([x, a, b, r]) => [x - r, Math.min(a, b), x + r, Math.max(a, b)])];
    return [...rects.flatMap(rectCircles), ...stationPorts(def).map(([x, y, f]) => ({ x: x + Math.cos(f)*.3, y: y + Math.sin(f)*.3, r: 1.3 }))]
        .map(c => ({ x: c.x*sc, y: c.y*sc, r: c.r*sc }));
}

let stations = [];

// level.station: { x, y: center of its drift circle, a: heading at the start, spin: rad/s, drift: { r: m, period: s, phase },
//                 scale?: the station this many times bigger (slips on it are still given in meters), ports?: [[x, y, facing]] more
//                 docking ports, in the station's own units (before scale) }
function stationLoad(def)
{
    const b = new Body(vec2(def.x, def.y), def.a || 0, stationCircles(def), 1, { kind: 'station', dragF: 0, dragS: 0, dragA: 0, restitution: .3, boxes: wingBoxes(def.scale || 1) });
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
        if (b.hidden) continue;
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

// a slip given in a station's coordinates (slip.on: 'station'): x, y, a in meters, or port: the number of a docking port
// (stationPorts), and the slip lies across it, broadside against it like the bar of a T
function attachSlip(slip, s)
{
    // inside a moored ship (on: 'moored', i: its place in the level's moored list, a carrier's hangar): x, y, a are given
    // in the level like any slip's, and kept in the ship's own coordinates from then on, so the slip moves with it
    if (s.on == 'moored')
    {
        const host = slip.on = mooredBoats[s.i || 0], d = slip.pos.subtract(host.pos), c = Math.cos(host.angle), n = Math.sin(host.angle);
        slip.local = { x: d.x*c + d.y*n, y: -d.x*n + d.y*c, a: s.a - host.angle };
        placeSlip(slip);
        return slip;
    }
    const st = slip.on = stations[0];
    if (s.port !== undefined)
    {
        const sc = st.def.scale || 1, [px, py, f] = stationPorts(st.def)[s.port], r = 1.6*sc + slip.wid/2;
        slip.local = { x: px*sc + Math.cos(f)*r, y: py*sc + Math.sin(f)*r, a: f + PI/2 };
    }
    else slip.local = { x: slip.pos.x, y: slip.pos.y, a: s.a };
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
    const st = slip.on, v = st.pointVel(b.pos), w = st.angVel, r = b.pos.subtract(st.pos), ac = st.def ? stationAccel(st) : vec2();
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

// a ship that waits its turn riding on a station (a boat's start: { on: 'station', x, y, a }, in meters in the station's
// coordinates): clamped to it like a docked ship (a hit on it costs money) until its turn gives it control
function rideStation(b, s)
{
    const st = stations[0];
    b.held = { on: st, x: s.x, y: s.y, a: s.a || 0, rider: [b.invMass, b.invInertia] };
    b.invMass = b.invInertia = 0;
    b.pos = st.toWorld(s.x, s.y); b.angle = st.angle + b.held.a;
    b.vel = st.pointVel(b.pos); b.angVel = st.angVel;
    b.updateWorld();
}

// a ship whose start has ground: true waits standing on the ground instead of hanging in the sky: it is moved up or
// down until its lowest point touches the highest ground or pad top under it that is not above its start y, and
// under gravity it falls like the ship you drive, so it stays down there
function groundStart(b)
{
    b.updateWorld();
    let x0 = Infinity, x1 = -Infinity, low = Infinity, top = -Infinity;
    b.world.forEach((c, i) =>
    {
        const r = b.circles[i].r;
        x0 = Math.min(x0, c.x - r); x1 = Math.max(x1, c.x + r); low = Math.min(low, c.y - r);
    });
    for (const w of rects)
        if ((w.land || w.pad) && w.x1 > x0 && w.x0 < x1 && w.y1 <= b.pos.y + 1e-6) top = Math.max(top, w.y1);
    if (top == -Infinity) return;
    b.pos.y += top - low;
    b.updateWorld();
    if (level.gravity) b.falls = true;
}

// let it go, moving with the station as it was
function releaseRider(b)
{
    const r = b.held?.rider;
    if (!r) return;
    [b.invMass, b.invInertia] = r;
    b.held = undefined;
}

// parking here holds the ship in place instead of dropping an anchor (a slip with hold: true holds too: part of the level
// is nested in that ship, see nestLoad)
function holdsInstead() { return !!(slip?.on || slip?.hold || level?.gravity); }

// ---------------------------------------------------------------------------
// nesting: the level's station, a moored boat or a chain boat's start with in: n (boats numbered from 1) is given in the
// level's coordinates as if boat n sat exactly in its slip. It stays out of the level (not drawn, nothing bumps it, the
// route guide ignores it) until boat n has parked; then it appears moved and turned with boat n, by as much as boat n
// parked off its slip (either end in, so possibly turned half round). A chain boat riding a station that waits in a boat
// waits with it. Boat n's slip should hold it (hold: true) so it stays put with all that beside it. In the level editor
// everything shows where the level puts it.
let nested = [];

function nestLoad(L)
{
    nested = [];
    if (window.pmbEditor?.active) return;
    const hide = (b, n, place) => { bodies.splice(bodies.indexOf(b), 1); nested.push({ b, n, place }); };
    const st = stations[0];
    if (st && L.station?.in) { st.hidden = true; hide(st, L.station.in, T => moveStation(st, T)); }
    mooredBoats.forEach((b, i) => { const n = L.moored[i].in; if (n) hide(b, n, T => moveBody(b, T)); });
    fleet.forEach((b, i) =>
    {
        const s = L.boats[i].start, n = s.in || (s.on && L.station?.in);
        if (n) hide(b, n, s.on ? () => followHeld(b) : T => moveBody(b, T));
    });
}

// boat n (from 1) has parked: what waits in it appears (the station first, so the ships riding it can follow it)
function nestPlace(n)
{
    const now = nested.filter(e => e.n == n);
    if (!now.length) return;
    const host = fleet[n - 1], s = slips[n - 1], da = host.angle - s.a, c = Math.cos(da), sn = Math.sin(da);
    const T = { da, at: (x, y) => { const dx = x - s.pos.x, dy = y - s.pos.y; return vec2(host.pos.x + dx*c - dy*sn, host.pos.y + dx*sn + dy*c); } };
    for (const e of now)
    {
        e.place(T);
        e.b.hidden = false;
        bodies.push(e.b);
    }
    nested = nested.filter(e => e.n != n);
}

function moveBody(b, T)
{
    b.pos = T.at(b.pos.x, b.pos.y);
    b.angle += T.da;
    b.updateWorld();
}

function moveStation(st, T)
{
    const d = st.def, c = T.at(d.x, d.y);
    st.def = { ...d, x: c.x, y: c.y, a: (d.a || 0) + T.da, drift: d.drift && { ...d.drift, phase: (d.drift.phase || 0) + T.da } };
    st.t = 0;
    st.pos = stationPos(st, 0);
    st.angle = st.def.a;
    st.updateWorld();
}

// a ship clamped to something: put it there now (stationsFollow keeps it there)
function followHeld(b)
{
    const h = b.held;
    if (!h?.on) return;
    b.pos = h.on.toWorld(h.x, h.y);
    b.angle = h.on.angle + h.a;
    b.vel = h.on.pointVel(b.pos);
    b.angVel = h.on.angVel;
    b.updateWorld();
}

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

// standing up a ship that lies on the ground (gravity levels; the side thrusters alone can't lift one end against
// gravity). Turning the ship you drive toward nose up while it touches the ground or a pad, tilted more than GROUND_TILT
// from upright, swings it round the end touching the ground at the rate it turns in the air. It slows over the last
// GROUND_TILT and stops upright. The engine does nothing during the swing; the throttle keys end it.
const GROUND_TILT = .35;          // rad (20 degrees) from upright: a turn that starts closer than that works as before
const GROUND_EPS = .02;           // a circle this close to the top of the ground or a pad (share of the ship's radius) touches it
const GROUND_LOW = .03;           // bottom points this close to the ship's lowest one (share of its radius) can be the
                                  // pivot, so a fin that swings down to the ground takes over as the pivot

// the bottom points of the ship's circles within `share` of its radius of the top of the ground or a pad
function groundContacts(b, share)
{
    const pts = [], eps = share*b.radius;
    for (let i = 0; i < b.circles.length; i++)
    {
        const c = b.world[i], r = b.circles[i].r;
        for (const w of rects)
            if ((w.land || w.pad) && c.x >= w.x0 && c.x <= w.x1 && c.y - r <= w.y1 + eps && c.y > w.y1 - r)
                pts.push(vec2(c.x, c.y - r));
    }
    return pts;
}

// after gravity, before the ships move
function groundTurn(dt)
{
    const b = player;
    if (!level?.gravity || !b || b.held || !hasControl()) return;
    const s = Math.sign(b.rudder), pv = b.pivoting;
    if (!s || (pv && pv.s != s)) { b.pivoting = null; if (!s) return; }
    // the throttle keys (W/S, arrows) end the swing and hand the ship back to its engine, so it can always take
    // off; let go of them (still turning) and it swings again. Only the keys: mouse steering always throttles a little.
    if (keyDirection().y) { b.pivoting = null; return; }
    // stood up, it stays up while the key is still held (let go and turn again to tilt it)
    if (b.pivoting?.done) { b.angVel = 0; return; }
    if (!b.pivoting)
    {
        // start only tilted, on the ground, turning toward nose up (ships stand on their fins) and lifting the ship:
        // left (counter-clockwise) round its leftmost contact, right round its rightmost
        const up = PI/2, toGo = wrapAngle(up - b.angle) * s;
        if (toGo < GROUND_TILT || !groundContacts(b, GROUND_EPS).length) return;
        const P = groundPivot(b, s);
        if (!P || (b.pos.x - P.x)*s <= 0) return;
        b.pivoting = { s, up };
    }
    // swing round the contact, slowing over the last GROUND_TILT so it sets down on its end instead of slapping
    // down past upright; once started it carries on up (past the balance point too) while the key is held
    const left = wrapAngle(b.pivoting.up - b.angle) * s;
    if (left < .02) { b.angVel = 0; b.vel.set(0, 0); b.pivoting.done = true; return; }
    const P = groundPivot(b, s);
    if (!P) { b.pivoting = null; return; }
    const w = thrusterSpin(b, b.rudder, 0) / b.dragA * clamp(left/GROUND_TILT, .25, 1);
    b.angVel = w;
    b.vel.set(-w*(b.pos.y - P.y), w*(b.pos.x - P.x));
}

// the point a turn in direction s swings the ship round: of its lowest bottom points, the leftmost (s > 0) or rightmost
function groundPivot(b, s)
{
    if (!groundContacts(b, GROUND_EPS*5).length) return null;
    const pts = b.world.map((c, i) => vec2(c.x, c.y - b.circles[i].r)), low = Math.min(...pts.map(p => p.y));
    return pts.filter(p => p.y < low + GROUND_LOW*b.radius).reduce((a, p) => (p.x - a.x)*s < 0 ? p : a);
}

// nose thrusters (levels without gravity): they turn a ship even when it is stopped. Moving, it turns as fast as the
// harbor rudder would; stopped (or slow), as fast as the gravity side thrusters. Left always turns the nose left,
// reversing too (the harbor rudder flipped like a car's).
function spinTurn(b, rudder, throttle, vf)
{
    return rudder * (b.turn*Math.max(Math.abs(vf), RCS_TURN*b.vs) + b.wash*Math.abs(throttle));
}

// ---------------------------------------------------------------------------
// drawing

function stationPainter(b, ox = 0, oy = 0) { return painter({ pos: b.pos, angle: b.angle, k: b.def.scale || 1, sx: 1, sy: 1, id: b.id }, ox, oy); }

function drawStations()
{
    for (const b of stations) if (!b.hidden && inView(b.pos, b.radius)) drawStation(b);
}

function drawStation(b)
{
    const S = STATION, sc = b.def.scale || 1, o = shadowOff(4*sc), sh = stationPainter(b, o.x, o.y), d = stationPainter(b);
    const rect = (p, [x0, y0, x1, y1], color, outline) => p.rect((x0 + x1)/2, (y0 + y1)/2, x1 - x0, y1 - y0, color, outline);
    const pod = ([a, b2, r]) => [a, -r, b2, r];
    // shadow
    for (const r of [...S.wings, ...S.radiators, ...S.truss]) rect(sh, r, C_SHADOW);
    for (const m of S.stack) rect(sh, pod(m), C_SHADOW);
    // solar wings: mustard cells on a cream mast, a beacon at each tip
    const fine = 2*sc / WU > .25;
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
    for (const [x, y, f] of stationPorts(b.def))
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
