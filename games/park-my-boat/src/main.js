'use strict';
// Dock All The Boats: park a chain of boats of wildly different sizes in one harbor. Prototype.
// World units are meters; the camera zooms from a 2.4 m jet ski to a 3000 km continent.
// The UI (HUD, buttons, cards) is laid out in a fixed 40 x 22.5 box, drawn with its own camera.

const UI_SIZE = vec2(40, 22.5);
const UI_CENTER = UI_SIZE.scale(.5);
const PLAY_TOP = 21;                  // HUD bar above this line (UI units)
const SAVE_KEY = 'cm_park-my-boat_save';
const SUBSTEPS = 2;
// slowdown: how many times slower a boat reacts than its toy version (speeding up, turning, stopping).
// A boat k times bigger is k^SLOWDOWN_CURVE times slower, but never more than MAX_SLOWDOWN, so big
// ships still feel heavy without dragging. Try other caps in the URL, e.g. ?slowdown=2
const SLOWDOWN_CURVE = .3;
const MAX_SLOWDOWN = +new URLSearchParams(location.search).get('slowdown') || 1.25;
// with no throttle the player's forward drag drops to this fraction, so boats coast a long way and
// stopping (reverse or anchor) is the skill. 1 = no extra drift. Try others with ?coast=.6
const COAST_DRAG = +new URLSearchParams(location.search).get('coast') || .3;
// every boat's engine power is multiplied by this, which raises top speed by the same factor.
// 1 = the speeds in boats.js. Try others with ?speed=1.2
const SPEED = +new URLSearchParams(location.search).get('speed') || 1.5;
// boats at least this long (meters) get a slip this much bigger and this much more heading leeway
const BIG_SHIP_LENGTH = 50;
const BIG_SHIP_LEEWAY = 1.15;
// the camera shows this many boat lengths across for big ships (smaller boats see more, see cameraGoal)
const BIG_SHIP_VIEW = +new URLSearchParams(location.search).get('shipview') || 3.5;
// no anchor: a boat is parked once it rests (under REST_SPEED toy units/s and REST_SPIN rad/s, no input) for
// REST_TIME seconds with part of its hull in the slip. Below SETTLE_SPEED with no throttle the coast ends:
// full forward drag and SETTLE_SPIN times the spin drag, so a nearly stopped ship doesn't creep for ages
const REST_SPEED = .25, REST_SPIN = .25, REST_TIME = .5;
const SETTLE_SPEED = +new URLSearchParams(location.search).get('settle') || 1, SETTLE_SPIN = 2;
// each boat's turn opens on its slip for this many seconds (camera travel included), then the camera
// glides back to the boat at SLIP_GLIDE of its normal speed; the boat takes control when the camera is
// nearly there (at most SLIP_MAX seconds later), and the camera eases back to full speed as the intro
// fades out; a click, Space or Enter cuts to the glide
const SLIP_SHOW = 3, SLIP_GLIDE = .4, SLIP_MAX = 6;
// a cheat so buoys stay visible next to big ships: each buoy is at least this share of the current
// boat's length (wide), growing or shrinking smoothly when the next boat starts. Try others with ?buoy=.05
const BUOY_SHARE = +new URLSearchParams(location.search).get('buoy') || 1/12;
const DUCK_SLEEP_WU = 4;              // zoomed out past this (meters per UI unit) ducks are specks: freeze them
const MOORED_COLORS = [C_TEAL, C_SUNNY, C_NAVY, C_CORAL, C_CREAM];

const SOUNDS =
{
    bonk:  new Sound([1.2,.05,140,0,.03,.12,1,2,-6,0,0,0,0,0,0,0,0,.7,.03]),
    quack: new Sound([1.4,.1,480,.01,.05,.1,2,1.6,-14,0,0,0,0,.3,24]),
    bong:  new Sound([1,.05,330,0,.02,.6,0,1,0,0,0,0,0,0,0,0,0,.5,.1]),
    splash:new Sound([.8,.2,300,0,.05,.25,4,1,0,0,0,0,0,9]),
    chain: new Sound([.7,.1,900,0,.01,.03,4,1,0,0,0,0,.04,3,0,0,0,.6,.25]),
    win:   new Sound([1,0,520,.02,.15,.3,0,1,0,0,260,.08,.1]),
    fail:  new Sound([1,0,220,.02,.15,.45,1,1,-4,0,0,0,0,0,0,0,0,.6,.1]),
    click: new Sound([.6,0,800,0,0,.03,0,1]),
    putt:  new Sound([.35,.1,70,0,.02,.05,1,2,0,0,0,0,0,3]),
    horn:  new Sound([.8,0,98,.08,.7,.35,2,1.5,0,0,0,0,0,0,0,0,0,.8,.1,.1]),
};

// ---------------------------------------------------------------------------
// save

const SAVE_DEFAULT = { v:1, stars:[], best:[], sound:true };
let saveData = readSaveData(SAVE_KEY, SAVE_DEFAULT);
if (saveData.v !== 1 || !Array.isArray(saveData.stars) || !Array.isArray(saveData.best))
    saveData = { ...SAVE_DEFAULT, stars:[], best:[] };
function persist() { writeSaveData(SAVE_KEY, saveData); }

function sfx(name, pos, volume=1, pitch=1)
{
    // silent while the level editor is open: it reloads the level (and its horn) on every drag
    if (window.pmbEditor?.active) return;
    if (saveData.sound) SOUNDS[name].play(undefined, volume, pitch);
}

function track(...args) { console.log('[GA]', ...args); }   // GameAnalytics stand-in for the prototype

// ---------------------------------------------------------------------------
// state

let gameScreen = 'title', screenTime = 0, levelIndex = 0, level, isPaused = false;
// two modes, chosen on the title: Parking (chains of boats to park) and Unparking (harbor jams to
// clear, src/jam.js). Each has its own level list; a level's index stays its place in LEVELS (saves).
let gameMode = 'park';
const modeOf = L => L.jam ? 'unpark' : 'park';
const modeLevels = (m = gameMode) => LEVELS.map((L, i) => i).filter(i => modeOf(LEVELS[i]) == m);
// a level's number within its mode, from 1
const levelNumber = (i = levelIndex) => modeLevels(modeOf(LEVELS[i])).indexOf(i) + 1;
let player, bodies = [], rects = [], posts = [], lands = [], currents = [], slip;
let fleet = [], slips = [], boatIndex = 0, accs = [], intro;
let anchor, judge, result, restT = 0, restArmed = true;
let attempts = 0, damages = 0, ducksOffended = 0, levelTime = 0, boatTime = 0;
let popups = [], drops = [], wakes = [], foams = [];
let shakeAmt = 0, steerHeld = false, motorTimer = 0, wakeTimer = 0;
let buttons = [], hoverId;

// camera: pos in meters, wu = meters per UI unit
const cam = { pos: UI_CENTER.copy(), wu: 1 };


function setScreen(s)
{
    gameScreen = s;
    screenTime = 0;
    isPaused = false;
}

function fmtLen(m)
{
    if (m >= 1000) return `${+(m/1000).toPrecision(2)} km`;
    if (m >= 1) return `${+m.toPrecision(m >= 10 ? 3 : 2)} m`;
    return `${Math.round(m*100)} cm`;
}

function fmtMoney(n) { return '$' + n.toLocaleString('en-US'); }

// ---------------------------------------------------------------------------
// level setup

function boatSize(b) { return b.type.L * b.k; }

// k scales lengths; masses go with k^3 so big ships shrug off small ones. Time stretches by
// slowdown = k^SLOWDOWN_CURVE (capped), so every rate and force below is the toy-scale value converted to that size.
function makeBoat(key, pos, angle, kind, color, k=1)
{
    const t = BOATS[key], slowdown = Math.min(Math.pow(k, SLOWDOWN_CURVE), MAX_SLOWDOWN), k3 = k*k*k;
    const b = new Body(pos, angle, hullCircles(t, k), t.mass*k3,
        { dragF:t.dragF/slowdown, dragS:t.dragS/slowdown, dragA:t.dragA/slowdown, kind, inertiaScale:k3*k*k });
    b.type = t;
    b.k = k; b.slowdown = slowdown; b.vs = k/slowdown;
    b.power = SPEED * t.power * k3*k / (slowdown*slowdown);
    b.turn = t.turn / (k*slowdown);
    b.wash = t.wash / (slowdown*slowdown);
    b.color = color || t.color;
    b.hurtT = 0;
    b.dragFull = b.dragF;          // forward drag under power; controlPlayer lowers it while coasting
    b.dragAFull = b.dragA;         // spin drag; controlPlayer raises it while settling
    bodies.push(b);
    return b;
}

// size (k), mass, spin and drag of a buoy; called again as it grows with the current boat
function sizeBuoy(b, s)
{
    const slowdown = Math.pow(s, SLOWDOWN_CURVE);
    b.k = s; b.slowdown = slowdown; b.vs = s/slowdown;
    b.circles[0].r = b.radius = .45*s;
    b.mass = .7*s*s*s; b.invMass = 1/b.mass;
    b.inertia = Math.max(.05*s**5, b.mass*b.radius*b.radius/2); b.invInertia = 1/b.inertia;
    b.dragA = .6/slowdown;
}

function growBuoys(dt)
{
    const goal = boatSize(player) * BUOY_SHARE / .9;
    for (const b of bodies)
    {
        if (b.kind != 'buoy') continue;
        const g = Math.max(b.baseK, goal);
        if (Math.abs(b.k/g - 1) < 1e-3) continue;
        sizeBuoy(b, Math.exp(Math.log(b.k) + (Math.log(g) - Math.log(b.k)) * Math.min(1, dt*2.2)));
    }
}

function boatK(L, e) { return e.k ?? BOATS[e.boat].k; }

function makeSlip(e, k)
{
    const t = BOATS[e.boat], s = e.slip, pad = s.pad || [1.4, 1];
    const leeway = t.L*k >= BIG_SHIP_LENGTH ? BIG_SHIP_LEEWAY : 1;
    const len = (t.L + pad[0])*k*leeway, wid = (t.W + pad[1])*k*leeway;
    const vertical = Math.abs(Math.sin(s.a)) > .5;
    const w = vertical ? wid : len, h = vertical ? len : wid;
    const x = s.x ?? s.right - w/2, y = s.y ?? s.top - h/2;
    if (s.fingers != 'none')
    {
        const ft = .5*k, pr = .32*k;
        if (vertical)
        {
            const yo = y - Math.sign(Math.sin(s.a)) * len/2;
            rects.push({ x0:x-wid/2-ft, y0:y-len/2, x1:x-wid/2, y1:y+len/2, dock:true, plank:.7*k });
            rects.push({ x0:x+wid/2, y0:y-len/2, x1:x+wid/2+ft, y1:y+len/2, dock:true, plank:.7*k });
            posts.push({ x:x-wid/2-ft/2, y:yo, r:pr }, { x:x+wid/2+ft/2, y:yo, r:pr });
        }
        else
        {
            const xo = x - Math.sign(Math.cos(s.a)) * len/2;
            rects.push({ x0:x-len/2, y0:y-wid/2-ft, x1:x+len/2, y1:y-wid/2, dock:true, plank:.7*k });
            rects.push({ x0:x-len/2, y0:y+wid/2, x1:x+len/2, y1:y+wid/2+ft, dock:true, plank:.7*k });
            posts.push({ x:xo, y:y-wid/2-ft/2, r:pr }, { x:xo, y:y+wid/2+ft/2, r:pr });
        }
    }
    return { pos:vec2(x, y), a:s.a, len, wid, w, h, k, leeway };
}

// static landmass: circles [x, y, r] around (x, y), scaled by k; collides as round posts
function addLand(m)
{
    const k = m.k, at = p => vec2(m.x + p.x*k, m.y + p.y*k);
    for (const [x, y, r] of m.circles) posts.push({ x:m.x + x*k, y:m.y + y*k, r:r*k, land:true });
    const outline = blobOutline(m.circles);
    const pts = outline.map(at), r = Math.max(...outline.map(p => p.length()))*k;
    lands.push({ pos:vec2(m.x, m.y), r, pts, grass: m.grass && outline.map(p => at(p.scale(.8))) });
}

function loadLevel(i)
{
    levelIndex = i;
    const L = level = LEVELS[i];
    gameMode = modeOf(L);
    bodies = []; rects = []; posts = []; lands = []; currents = L.currents || [];
    popups.length = drops.length = wakes.length = foams.length = 0;
    anchor = judge = result = intro = player = undefined;
    attempts = damages = ducksOffended = levelTime = 0;
    accs = [];
    steerHeld = false;

    for (const r of L.land) rects.push({ x0:r[0], y0:r[1], x1:r[2], y1:r[3], land:true });
    for (const d of L.docks) rects.push({ ...d, dock:true });
    for (const m of L.lands || []) addLand(m);

    // a harbor jam (src/jam.js) has no chain of boats to park, only the boats to clear out
    if (L.jam)
    {
        jamLoad(L);
        setScreen('playing');
        updateCamera(0, true);
        if (!window.pmbEditor?.active) track('progression', 'Start', levelId());
        return;
    }

    // every boat of the level waits at its start until its turn; a bump moves it, and its turn starts from there
    slips = L.boats.map(e => makeSlip(e, boatK(L, e)));
    fleet = L.boats.map(e => makeBoat(e.boat, vec2(e.start.x, e.start.y), e.start.a, 'moored', undefined, boatK(L, e)));

    (L.moored || []).forEach((m, k) =>
        makeBoat(m.boat, vec2(m.x, m.y), m.a, 'moored', MOORED_COLORS[(k + i) % MOORED_COLORS.length], boatK(L, m)));
    for (const m of L.drifters || [])
        makeBoat(m.boat, vec2(m.x, m.y), m.a, 'drifter', C_TEAL, boatK(L, m));
    (L.traffic || []).forEach((t, n) => makeTraffic(t, n));
    for (const [bx, by, s=1] of L.buoys || [])
    {
        const b = new Body(vec2(bx, by), 0, [{ x:0, y:0, r:.45*s }], 1, { kind:'buoy', restitution:.8 });
        b.baseK = s;
        sizeBuoy(b, s);
        bodies.push(b);
    }
    for (const [lx, ly, la] of L.logs || [])
        bodies.push(new Body(vec2(lx, ly), la, makeCircles(2.4, .55), .9, { kind:'log', dragF:.4, dragS:1.2, dragA:1.2 }));
    for (const f of L.ducks || [])
    {
        const box = [f.x - 8, f.y - 5, f.x + 8, f.y + 5];
        let leader;
        for (let k = 0; k <= f.kids; k++)
        {
            const size = k ? .55 : 1;
            const d = new Body(vec2(f.x - k*.8, f.y), 0, [{ x:0, y:0, r:.34*size }], k ? .06 : .15, { kind:'duck', restitution:.6, dragA:3 });
            d.duckSize = size;
            d.leader = leader;
            d.stunT = 0;
            d.wanderT = 0;
            d.target = d.pos.copy();
            d.box = box;
            bodies.push(d);
            leader = d;
        }
    }

    startBoat(0);
    growBuoys(Infinity);
    setScreen('playing');
    updateCamera(0, true);
    if (!window.pmbEditor?.active) track('progression', 'Start', levelId());
}

// hand control to the next boat in the fleet; the one just parked stays where it stopped
function startBoat(n)
{
    const prev = player;
    if (prev)
    {
        prev.kind = 'moored';
        prev.dragF = prev.dragFull;
        prev.dragA = prev.dragAFull;
    }
    player = fleet[n];
    player.kind = 'player';
    slip = slips[n];
    boatIndex = n;
    anchor = judge = undefined;
    restT = 0; restArmed = true;
    boatTime = 0;
    intro = { t:0, prev, dur: SLIP_SHOW + SLIP_MAX };
    if (fleet.length > 1) sfx('horn', undefined, .7, clamp(3 / Math.pow(boatSize(player), .3), .35, 3));
}

function levelId()
{
    const n = LEVELS.slice(0, levelIndex).filter(l => l.world == level.world && !l.bonus == !level.bonus && !l.jam == !level.jam).length + 1;
    const group = level.jam ? 'unpark' : level.bonus ? 'bonus' : 'world' + String(level.world).padStart(2, '0');
    return `${group}:level${String(n).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// camera

function uiScale() { return Math.min(mainCanvasSize.x / UI_SIZE.x, mainCanvasSize.y / UI_SIZE.y); }

function worldToUi(p) { return UI_CENTER.add(p.subtract(cam.pos).scale(1/cam.wu)); }
function uiToWorld(p) { return cam.pos.add(p.subtract(UI_CENTER).scale(cam.wu)); }

function boxAround(p, r) { return { x0:p.x - r, y0:p.y - r, x1:p.x + r, y1:p.y + r }; }

// follow the boat a little ahead of where it is going, a set number of boat lengths across
// (more for small, quick boats); the slip may be off screen, an arrow at the edge points to it
function cameraGoal()
{
    // a jam's camera holds still on the whole harbor corner
    if (level?.jam)
    {
        const [x0, y0, x1, y1] = level.view, wu = Math.max((x1 - x0) / UI_SIZE.x, (y1 - y0) / (PLAY_TOP - 3));
        return { pos:vec2((x0 + x1)/2, (y0 + y1)/2 + (UI_CENTER.y - PLAY_TOP/2)*wu), wu };
    }
    const lens = (boatSize(player) >= BIG_SHIP_LENGTH ? BIG_SHIP_VIEW : 3 + 6/player.slowdown) * (player.type.view || 1);
    const minW = boatSize(player) * lens, pad = player.radius*.8;
    const ahead = player.vel.scale(.8), max = minW*.25;
    let box = boxAround(player.pos.add(ahead.length() > max ? ahead.normalize(max) : ahead), player.radius);
    // a new boat's turn opens on its slip, at the boat's own framing
    if (intro && intro.t < SLIP_SHOW) box = boxAround(slip.pos, Math.max(slip.w, slip.h)/2);
    const w = Math.max(box.x1 - box.x0 + pad*2, minW), h = Math.max(box.y1 - box.y0 + pad*2, minW*.45);
    const wu = Math.max(w / UI_SIZE.x, h / (PLAY_TOP - 3));
    // centered in the play area below the HUD bar
    return { pos:vec2((box.x0 + box.x1)/2, (box.y0 + box.y1)/2 + (UI_CENTER.y - PLAY_TOP/2)*wu), wu };
}

function updateCamera(dt, snap)
{
    const g = cameraGoal();
    if (snap) { cam.pos = g.pos; cam.wu = g.wu; return; }
    const gliding = intro && intro.t >= SLIP_SHOW && intro.t < intro.dur;
    if (intro && intro.t >= SLIP_SHOW) dt *= lerp(SLIP_GLIDE, 1, clamp((intro.t - intro.dur)/.4, 0, 1));
    // while the goal is far, stay zoomed out enough to see it: big moves read as zoom out, pan, zoom in
    const dist = cam.pos.distance(g.pos);
    const wuGoal = Math.max(g.wu, dist / 14);
    const lw = Math.log(cam.wu);
    cam.wu = Math.exp(lw + (Math.log(wuGoal) - lw) * Math.min(1, dt*2.2));
    // panning speed is relative to the zoom
    const step = Math.min(dist * Math.min(1, dt*3), 30 * cam.wu * dt);
    if (dist > 1e-9) cam.pos = cam.pos.add(g.pos.subtract(cam.pos).scale(step/dist));
    // back at the boat: the intro ends and the boat takes control
    if (gliding && cam.pos.distance(g.pos) < .1*g.wu*UI_SIZE.x && Math.abs(Math.log(cam.wu/g.wu)) < .2) intro.dur = intro.t;
}

function viewHalfUi() { return vec2(mainCanvasSize.x, mainCanvasSize.y).scale(.5 / uiScale()); }

function useWorldCamera()
{
    WU = cam.wu;
    LINE_W = .1*WU;
    const shake = shakeAmt > 0 ? vec2(rand(-1, 1), rand(-1, 1)).scale(shakeAmt*WU) : vec2();
    setCameraScale(uiScale() / WU);
    setCameraPos(cam.pos.add(shake));
    const h = viewHalfUi().scale(WU);
    VIEW_RECT = { x0:cam.pos.x - h.x, y0:cam.pos.y - h.y, x1:cam.pos.x + h.x, y1:cam.pos.y + h.y };
}

function useUiCamera()
{
    WU = 1;
    LINE_W = .1;
    setCameraScale(uiScale());
    setCameraPos(UI_CENTER);
    VIEW_RECT = { x0:-1e9, y0:-1e9, x1:1e9, y1:1e9 };
}

function inView(p, r)
{
    const v = VIEW_RECT;
    return p.x + r > v.x0 && p.x - r < v.x1 && p.y + r > v.y0 && p.y - r < v.y1;
}

// ---------------------------------------------------------------------------
// effects

// pos in meters; lift and size in UI units so popups read the same at any zoom
function popup(text, pos, color=C_CREAM, size=.9, lift=.8)
{
    popups.push({ text, pos:pos.copy(), t:0, color, size, lift });
    if (popups.length > 12) popups.shift();
}

function splash(pos, n, speed=4, s=1)
{
    for (let i = 0; i < n; i++)
    {
        const a = rand(PI*2), v = rand(.3, 1)*speed*s;
        drops.push({ pos:pos.copy(), vel:vec2(Math.cos(a)*v, Math.sin(a)*v), t:0, life:rand(.3, .6), size:rand(.15, .35)*s, color: i%3 ? C_CREAM : C_WATER2 });
    }
    if (drops.length > 160) drops.splice(0, drops.length - 160);
}

function confetti(pos, s=1)
{
    const colors = [C_CORAL, C_SUNNY, C_TEAL, C_CREAM];
    for (let i = 0; i < 50; i++)
    {
        const a = rand(PI*2), v = rand(3, 9)*s;
        drops.push({ pos:pos.copy(), vel:vec2(Math.cos(a)*v, Math.sin(a)*v), t:0, life:rand(.8, 1.4), size:rand(.2, .4)*s, color:colors[i%4], square:true });
    }
}

// mass at toy scale, so a cruise ship wobbles like the toy it is drawn as
function toyMass(b) { return b.mass / (b.k*b.k*b.k); }

function onHit(A, B, impact, p)
{
    // impact speeds are judged relative to the size of what got hit
    const vs = B ? Math.min(A.vs, B.vs) : A.vs;
    if (impact / vs < .6) return;
    const isPlayer = A == player || B == player;
    const other = A == player ? B : A;
    for (const b of [A, B])
        if (b) b.squashVel += Math.min(4, impact / b.vs) * (b == player ? 1.2 : 2) / Math.sqrt(toyMass(b));

    const rel = impact / vs;
    const kind = !other ? 'dock' : other.kind;
    if (kind == 'duck')
    {
        const duck = other.kind == 'duck' ? other : (A.kind == 'duck' ? A : B);
        if (duck.stunT <= 0 && (isPlayer || rel > 1.2))
        {
            duck.stunT = 1.5;
            duck.angVel += rand(-14, 14);
            sfx('quack', p, 1, rand(.9, 1.3) / Math.sqrt(duck.duckSize));
            if (isPlayer) { ducksOffended++; damages += 5; }
        }
        return;
    }
    if (!isPlayer && rel < 1.5) return;

    const cool = isPlayer ? player : A;
    splash(p, Math.min(14, rel*3), Math.min(rel, 4)*1.2, B ? Math.max(A.k, B.k) : A.k);
    if (cool.hitCooldown > 0) return;
    cool.hitCooldown = .35;

    if (isPlayer)
    {
        const mine = impact / player.vs;
        shakeAmt = Math.max(shakeAmt, Math.min(.5, mine*.07*Math.sqrt(player.type.mass)));
        if (mine > 1.4) player.hurtT = .8;
    }
    if (kind == 'buoy')
    {
        sfx('bong', p, 1, rand(.9, 1.1) / Math.sqrt(other.k));
        if (isPlayer) damages += 20 * Math.round(other.baseK*other.baseK);
    }
    else if (kind == 'moored' || kind == 'drifter' || kind == 'traffic' || kind == 'player')
    {
        sfx('bonk', p, 1, .8);
        if (other && other.hurtT !== undefined) other.hurtT = .8;
        if (isPlayer) damages += Math.round(impact * 60 * Math.sqrt(other.mass)) * 5;
    }
    else if (kind == 'log')
    {
        sfx('bonk', p, 1, .6);
        if (isPlayer) damages += 10;
    }
    else
    {
        sfx('bonk', p, Math.min(1, rel/3), 1.2 - Math.min(.5, toyMass(cool)*.05));
        if (isPlayer) damages += Math.max(1, Math.round(rel * 8 * Math.sqrt(player.mass))) * 5;
    }
}

// ---------------------------------------------------------------------------
// player, resting and parking

function controlPlayer(dt)
{
    const t = player.type, k = player.k;
    let throttle = 0, rudder = 0;
    const kd = keyDirection();
    if (kd.x || kd.y)
    {
        throttle = kd.y;
        rudder = -kd.x;
    }
    else if (steerHeld && mouseIsDown(0))
    {
        // steer toward the cursor; if it is behind the boat, back up toward it
        const m = uiToWorld(mousePos);
        const tx = m.x - player.pos.x, ty = m.y - player.pos.y, dist = Math.hypot(tx, ty);
        if (dist > t.W*k*.6)
        {
            const want = Math.atan2(ty, tx), diff = wrapAngle(want - player.angle);
            const power = clamp(dist/(2.7*t.L*k), .3, 1);
            if (Math.abs(diff) < PI*.6)
            {
                throttle = power * clamp(1.5 - Math.abs(diff), .35, 1);
                rudder = clamp(diff*2.5, -1, 1);
            }
            else
            {
                throttle = -power;
                rudder = -clamp(wrapAngle(want - player.angle - PI)*2.5, -1, 1);
            }
        }
    }
    if (anchor || (intro && intro.t < intro.dur)) throttle = rudder = 0;
    player.throttle = throttle;
    player.rudder = rudder;
    const settling = !throttle && player.speed() < SETTLE_SPEED*player.vs;
    player.dragF = player.dragFull * (throttle || settling ? 1 : COAST_DRAG);
    player.dragA = player.dragAFull * (settling && !rudder ? SETTLE_SPIN : 1);
    driveBoat(player, throttle, rudder, dt);
}

// engine and rudder: the rudder turns the boat more the faster it goes, plus a little prop wash
function driveBoat(b, throttle, rudder, dt)
{
    const f = b.forward();
    const thrust = throttle * b.power * (throttle < 0 ? b.type.reverse : 1) * b.invMass;
    b.vel.x += f.x * thrust * dt;
    b.vel.y += f.y * thrust * dt;
    const vf = b.vel.x*f.x + b.vel.y*f.y;
    b.angVel += rudder * (b.turn*vf + b.wash*throttle) * dt;
}

// ---------------------------------------------------------------------------
// traffic: boats that drive a path on their own (traffic in levels.js). They are ordinary
// bodies with an engine, so they can be shoved off course and steer back to the path.

// a smooth curve through the points (Catmull-Rom), as a polyline with the distance along it
function makeRoute(points, loop)
{
    const P = points.map(([x, y]) => vec2(x, y)), n = P.length;
    const at = i => loop ? P[(i + n) % n] : P[clamp(i, 0, n - 1)];
    const pts = [];
    for (let i = 0; i < (loop ? n : n - 1); i++)
    {
        const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
        const cr = (a, b, c, d, t) => .5*(2*b + (c - a)*t + (2*a - 5*b + 4*c - d)*t*t + (3*b - a - 3*c + d)*t*t*t);
        for (let k = 0; k < 8; k++)
            pts.push(vec2(cr(p0.x, p1.x, p2.x, p3.x, k/8), cr(p0.y, p1.y, p2.y, p3.y, k/8)));
    }
    pts.push(loop ? pts[0].copy() : P[n - 1].copy());
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distance(pts[i - 1]));
    return { pts, cum, total: cum[cum.length - 1] || 1e-9, loop };
}

function routePoint(r, s)
{
    s = r.loop ? ((s % r.total) + r.total) % r.total : clamp(s, 0, r.total);
    let lo = 0, hi = r.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.cum[m] <= s) lo = m; else hi = m; }
    return r.pts[lo].lerp(r.pts[hi], (s - r.cum[lo]) / (r.cum[hi] - r.cum[lo] || 1));
}

// distance along the route of its closest point to p, looking only within `reach` of s
function routeProgress(r, p, s, reach)
{
    let best = s, bestD = Infinity;
    for (let i = 0; i < r.pts.length - 1; i++)
    {
        let ds = Math.abs((r.cum[i] + r.cum[i + 1])/2 - s);
        if (r.loop) ds = Math.min(ds, r.total - ds);
        if (ds > reach) continue;
        const a = r.pts[i], ab = r.pts[i + 1].subtract(a);
        const t = clamp(p.subtract(a).dot(ab) / (ab.lengthSquared() || 1), 0, 1);
        const d = p.distance(a.add(ab.scale(t)));
        if (d < bestD) { bestD = d; best = r.cum[i] + t*(r.cum[i + 1] - r.cum[i]); }
    }
    return best;
}

function makeTraffic(t, n)
{
    const route = makeRoute(t.path, t.end == 'loop'), p = route.pts[0], q = route.pts[1];
    const b = makeBoat(t.boat, p, Math.atan2(q.y - p.y, q.x - p.x), 'traffic', MOORED_COLORS[(n + 2) % MOORED_COLORS.length], boatK(level, t));
    b.route = route;
    b.s = 0; b.dir = 1; b.done = false; b.wakeT = 0;
    b.cruise = t.speed ?? .6;
    b.pace = t.pace; b.clock = 0;
    b.end = t.end || 'back';
    b.during = t.during;
}

// aim at a point a little way ahead on the route; slow down for sharp turns. Outside its turns
// (during) a boat cuts the engine and coasts to a stop where it is.
function driveTraffic(b, dt)
{
    const r = b.route, L = boatSize(b);
    let throttle = 0, rudder = 0;
    if (!b.done && (!b.during || b.during.includes(boatIndex + 1)))
    {
        b.s = routeProgress(r, b.pos, b.s, 3*L);
        if (!r.loop)
        {
            if (b.dir > 0 && b.s > r.total - .6*L) { if (b.end == 'stop') b.done = true; else b.dir = -1; }
            else if (b.dir < 0 && b.s < .6*L) b.dir = 1;
        }
        // on a loop with a pace (m/s), keep to a timetable: speed up when behind it, ease off when
        // ahead, so boats sharing a loop stay evenly spaced instead of bunching up over time
        let keep = 1;
        if (b.pace && r.loop)
        {
            b.clock += dt;
            const late = ((b.clock*b.pace - b.s) % r.total + 1.5*r.total) % r.total - r.total/2;
            keep = clamp(1 + late/(10 + L), .5, 3);
        }
        if (!b.done)
        {
            const target = routePoint(r, b.s + b.dir*1.5*L);
            const diff = wrapAngle(Math.atan2(target.y - b.pos.y, target.x - b.pos.x) - b.angle);
            throttle = Math.min(1, b.cruise * keep * clamp(1.5 - Math.abs(diff), .35, 1));
            rudder = clamp(diff*2.5, -1, 1);
        }
    }
    b.throttle = throttle;
    driveBoat(b, throttle, rudder, dt);
}

function bowPoint() { return player.toWorld((player.type.L/2 - .25)*player.k, 0); }

// the anchor only drops once the boat is parked: a splash, and it holds the boat still for the celebration
function dropAnchor()
{
    const k = player.k;
    anchor = { pos: bowPoint(), len: .5*k, t: 0 };
    sfx('chain', anchor.pos);
    sfx('splash', anchor.pos, .8);
    splash(anchor.pos, 12, 3, k);
}

function anchorForce(dt)
{
    if (!anchor) return;
    anchor.t += dt;
    const slowdown = player.slowdown;
    const bow = bowPoint(), dx = bow.x - anchor.pos.x, dy = bow.y - anchor.pos.y, d = Math.hypot(dx, dy);
    if (d > anchor.len)
    {
        const nx = dx/d, ny = dy/d, bv = player.pointVel(bow);
        const vn = bv.x*nx + bv.y*ny, m = player.mass;
        const f = -(d - anchor.len)*30/(slowdown*slowdown)*m - vn*3/slowdown*m;
        player.applyForce(nx*f, ny*f, bow, dt);
    }
    // the anchor drags on the bottom
    player.vel = player.vel.scale(Math.max(0, 1 - .8/slowdown*dt));
    player.angVel *= Math.max(0, 1 - .9/slowdown*dt);
}

// hull circle i in slip-local coordinates, tested against the slip (small tolerance); all: every circle inside, else any
function boatInSlip(all = true)
{
    const c = Math.cos(slip.a), s = Math.sin(slip.a), tol = .15*player.k;
    for (let i = 0; i < player.circles.length; i++)
    {
        const p = player.world[i], r = player.circles[i].r;
        const dx = p.x - slip.pos.x, dy = p.y - slip.pos.y;
        const lx = dx*c + dy*s, ly = -dx*s + dy*c;
        const inside = Math.abs(lx) + r <= slip.len/2 + tol && Math.abs(ly) + r <= slip.wid/2 + tol;
        if (inside != all) return !all;
    }
    return all;
}

function parkingScore()
{
    const posErr = player.pos.distance(slip.pos);
    const diff = Math.abs(wrapAngle(player.angle - slip.a));
    const angErr = Math.min(diff, PI - diff);       // nose in or stern in, both fine
    return clamp(1 - .6*Math.min(1, posErr/(.8*player.k)) - .4*Math.min(1, angErr/(.35*slip.leeway)), 0, 1);
}

function isResting()
{
    return player.speed() < REST_SPEED*player.vs && Math.abs(player.angVel) < REST_SPIN/player.slowdown
        && !player.throttle && !player.rudder;
}

// no anchor: the boat is checked once it has rested for REST_TIME with part of its hull in the slip.
// Resting anywhere else is never judged, and after a miss the boat must move again before the next check.
function updateJudge(dt)
{
    if (judge)
    {
        judge.t += dt;
        if (judge.result == 'win' && judge.t > 1.4)
            boatIndex < fleet.length - 1 ? startBoat(boatIndex + 1) : showComplete();
        else if (judge.result == 'fail' && judge.t > 1.8) judge = undefined;
        if (judge) return;
    }
    if (intro && intro.t < intro.dur) return;
    if (!isResting()) { restT = 0; restArmed = true; return; }
    if (!restArmed || !boatInSlip(false)) { restT = 0; return; }
    restT += dt;
    if (restT >= REST_TIME) judgeBoat();
}

function judgeBoat()
{
    judge = { t:0 };
    restT = 0; restArmed = false;
    attempts++;
    if (boatInSlip())
    {
        const acc = parkingScore();
        accs.push(acc);
        judge.result = 'win';
        dropAnchor();
        sfx('win');
        confetti(player.pos, player.k);
        popup('PARKED!', player.pos, C_SUNNY, 1.6, 2);
    }
    else
    {
        judge.result = 'fail';
        sfx('fail');
        popup('Not in the slip. Try again.', player.pos, C_CREAM, .8, 2);
        track('progression', 'Fail', levelId());
    }
}

function showComplete()
{
    const i = levelIndex, acc = accs.reduce((a, b) => a + b, 0) / accs.length;
    const stars = acc >= .85 ? 3 : acc >= .6 ? 2 : 1;
    result = level.jam ? jamResult() : { acc, stars };
    result.isBest = result.stars > (saveData.stars[i] || 0) || result.acc > (saveData.best[i] || 0);
    // the level editor's test runs don't count
    if (!window.pmbEditor?.testing)
    {
        saveData.stars[i] = Math.max(saveData.stars[i] || 0, result.stars);
        saveData.best[i] = Math.max(saveData.best[i] || 0, result.acc);
        persist();
        track('progression', 'Complete', levelId(), Math.round(result.acc*100));
    }
    setScreen('complete');
}

// ---------------------------------------------------------------------------
// ducks

function updateDuck(d, dt)
{
    if (d.stunT > 0) { d.stunT -= dt; return; }
    if (d.leader)
    {
        // trail on a rope: aim for the point behind the leader on the line toward this duckling, so
        // an idle leader turning in place never swings the target through its own body
        const gap = .75 * d.leader.duckSize + .2, back = d.pos.subtract(d.leader.pos);
        d.target = d.leader.pos.add(back.length() > 1e-3 ? back.normalize(gap) : d.leader.forward().scale(-gap));
    }
    else
    {
        d.wanderT -= dt;
        const away = d.pos.subtract(player.pos);
        if (away.length() < 2.4 + player.radius)
            d.target = d.pos.add(away.normalize(3));       // paddle away from the boat
        else if (d.wanderT <= 0)
        {
            const b = d.box;
            d.wanderT = rand(3, 6);
            d.target = vec2(clamp(d.pos.x + rand(-8, 8), b[0], b[2]), clamp(d.pos.y + rand(-5, 5), b[1], b[3]));
        }
    }
    const tx = d.target.x - d.pos.x, ty = d.target.y - d.pos.y, dist = Math.hypot(tx, ty);
    if (dist < .3) return;
    const diff = wrapAngle(Math.atan2(ty, tx) - d.angle);
    d.angVel += clamp(diff*6 - d.angVel, -12, 12) * dt * 4;
    const f = d.forward(), push = (d.leader ? 4 : 2.4) * clamp(dist, 0, 1.5) * Math.max(0, Math.cos(diff));
    d.vel.x += f.x*push*dt;
    d.vel.y += f.y*push*dt;
}

// ---------------------------------------------------------------------------
// simulation

function currentAt(p)
{
    for (const c of currents)
        if (p.x > c.x0 && p.x < c.x1 && p.y > c.y0 && p.y < c.y1) return c;
}

function stepWorld()
{
    const dt = timeDelta / SUBSTEPS;
    // ducks too small to see sleep: no AI, no physics, no quacks over a cruise ship
    const ducksAsleep = cam.wu > DUCK_SLEEP_WU;
    for (const b of bodies) b.asleep = ducksAsleep && b.kind == 'duck';
    growBuoys(timeDelta);
    for (let s = 0; s < SUBSTEPS; s++)
    {
        controlPlayer(dt);
        anchorForce(dt);
        for (const b of bodies) if (b.kind == 'traffic') driveTraffic(b, dt);
        for (const b of bodies)
        {
            if (b.asleep) { b.vel.set(0, 0); b.angVel = b.stunT = 0; continue; }
            if (b.kind == 'duck') updateDuck(b, dt);
            const c = currentAt(b.pos);
            b.integrate(dt, c ? c.dx : 0, c ? c.dy : 0);
        }
        for (let i = 0; i < bodies.length; i++)
        {
            if (bodies[i].asleep) continue;
            for (let k = i+1; k < bodies.length; k++)
                if (!bodies[k].asleep) collideBodies(bodies[i], bodies[k], onHit);
            collideStatics(bodies[i], rects, posts, onHit);
        }
    }
    for (const b of bodies) if (b.hurtT > 0) b.hurtT -= timeDelta;

    // motor putts (deeper for bigger boats) and wake
    const t = player.type, thr = Math.abs(player.throttle);
    motorTimer -= timeDelta;
    if (thr > .1 && motorTimer <= 0)
    {
        motorTimer = (.13 - .06*thr) * player.slowdown;
        sfx('putt', player.pos, .5 + thr*.5, Math.max(.25, 1.6 / Math.pow(boatSize(player), .25)) + thr*.3);
    }
    wakeTimer -= timeDelta;
    if (player.speed() > .7*player.vs && wakeTimer <= 0)
    {
        wakeTimer = .07;
        const stern = player.toWorld(-t.L/2*player.k, 0);
        wakes.push({ pos:stern, t:0, size:t.W*.7*player.k });
    }
    for (const b of bodies)
    {
        if (b.kind != 'traffic' || (b.wakeT -= timeDelta) > 0 || b.speed() < .7*b.vs) continue;
        b.wakeT = .1;
        wakes.push({ pos:b.toWorld(-b.type.L/2*b.k, 0), t:0, size:b.type.W*.7*b.k });
    }
    if (wakes.length > 120) wakes.splice(0, wakes.length - 120);
    for (const b of bodies) if (b.type && !b.asleep) emitFoam(b);
}

// Foam streaks along both sides of a moving boat, like tire tracks: each side lays a trail of points
// that drift outward and fade. Sliding sideways piles foam and spray on the side pushing the water.
const FOAM_EVERY = .035, FOAM_LIFE = 2.2;
function emitFoam(b)
{
    if ((b.foamT = (b.foamT || 0) - timeDelta) > 0) return;
    b.foamT = FOAM_EVERY;
    const c = currentAt(b.pos), f = b.forward();
    const rx = b.vel.x - (c ? c.dx : 0), ry = b.vel.y - (c ? c.dy : 0);
    const top = b.power * b.invMass / b.dragFull, sp = Math.hypot(rx, ry);
    const side = (-rx*f.y + ry*f.x) / top;                    // sideways speed, + to port
    const run = clamp((sp/top - .2) / .6, 0, 1), slide = clamp(Math.abs(side) / .3, 0, 1);
    const L = b.type.L*b.k, W = b.type.W*b.k;
    b.trails ||= [];
    for (const s of [1, -1])
    {
        const leading = Math.sign(side) == s;
        const a = Math.min(1, run*.6 + slide*(leading ? 1 : .25));
        if (a < .06) { b.trails[s] = undefined; continue; }
        if (!b.trails[s]) foams.push(b.trails[s] = []);
        const n = vec2(-f.y*s, f.x*s), out = sp*(.12 + (leading ? slide*.18 : 0));
        b.trails[s].push({ pos:b.toWorld(-L*.18, s*W*.5), vel:n.scale(out), n, t:0,
            w:W*.16*(.5 + a)*rand(.75, 1.25), a });
        // spray flung off the side when sliding hard
        if (leading && slide > .35 && rand() < slide)
            for (let i = rand(1, 3)|0; i--;)
            {
                const v = n.scale(sp*rand(.3, .8)).add(vec2(rx, ry).scale(rand(.2, .6)));
                drops.push({ pos:b.toWorld(rand(-L*.4, L*.2), s*W*.55), vel:v, t:0, life:rand(.4, .9),
                    size:W*rand(.06, .14), color:C_CREAM.scale(1, .8) });
            }
    }
}

function updateEffects()
{
    const dt = timeDelta;
    for (const p of popups) p.t += dt;
    popups = popups.filter(p => p.t < 1.3);
    for (const d of drops)
    {
        d.t += dt;
        d.pos.x += d.vel.x*dt; d.pos.y += d.vel.y*dt;
        d.vel = d.vel.scale(.93);
    }
    drops = drops.filter(d => d.t < d.life);
    for (const w of wakes) w.t += dt;
    wakes = wakes.filter(w => w.t < 1.2);
    const slow = Math.exp(-dt*1.6);
    for (const trail of foams)
        for (const p of trail)
        {
            p.t += dt;
            p.pos.x += p.vel.x*dt; p.pos.y += p.vel.y*dt;
            p.vel = p.vel.scale(slow);
        }
    for (const trail of foams) while (trail.length && trail[0].t > FOAM_LIFE) trail.shift();
    foams = foams.filter(trail => trail.length || bodies.some(b => b.trails?.includes(trail)));
    shakeAmt = Math.max(0, shakeAmt - dt*1.5);
}

// ---------------------------------------------------------------------------
// buttons (laid out in UI units, the 40 x 22.5 box)

function button(id, label, x, y, w, h, opts={}) { buttons.push({ id, label, x, y, w, h, ...opts }); }

function layoutButtons()
{
    buttons = [];
    if (gameScreen == 'title')
    {
        button('park', 'PARKING', 20, 9, 10, 2.4, { big:true });
        button('unpark', 'UNPARKING', 20, 6, 10, 2.4, { big:true });
        button('sound', saveData.sound ? 'SOUND: ON' : 'SOUND: OFF', 20, 2.8, 7, 1.5, { small:true });
    }
    else if (gameScreen == 'levels')
    {
        modeLevels().forEach((i, n) => button('level' + i, LEVELS[i].bonus ? 'BONUS' : String(n + 1), 8 + (n%5)*6, 15.4 - Math.floor(n/5)*4.8, 5.2, 4.3, { card:i }));
        button('back', 'BACK', 20, 1.6, 6, 1.4, { small:true });
    }
    else if (gameScreen == 'playing')
    {
        button('pause', 'II', 37.6, 21.75, 2.2, 1.2, { small:true });
        button('restart', 'RESTART', 33.6, 21.75, 4.8, 1.2, { small:true });
        if (isPaused)
        {
            button('resume', 'RESUME', 20, 13, 8, 2.2, { big:true });
            button('restart', 'RESTART', 20, 10, 7, 1.8);
            button('menu', 'MENU', 20, 7.4, 7, 1.8);
        }
    }
    else if (gameScreen == 'complete')
    {
        const next = nextInMode(), last = next === undefined, toBonus = !last && !level.bonus && LEVELS[next].bonus;
        button('next', last ? 'THE END' : toBonus ? 'BONUS' : 'NEXT', 24.5, 6, 7, 2.2, { big:true });
        button('retry', 'RETRY', 16, 6, 6, 2.2);
        button('menu', 'MENU', 20, 4, 4.5, 1.2, { small:true });
    }
}

function buttonAt(p)
{
    for (const b of buttons)
    {
        if (Math.abs(p.x - b.x) < b.w/2 && Math.abs(p.y - b.y) < b.h/2)
            return b;
    }
}

// the first level of the mode without stars (bonus levels aside), else its first
function nextLevelIndex(m = gameMode)
{
    const list = modeLevels(m);
    return list.find(i => !saveData.stars[i] && !LEVELS[i].bonus) ?? list[0];
}

// the level after this one in its mode
function nextInMode() { const list = modeLevels(modeOf(level)); return list[list.indexOf(levelIndex) + 1]; }

function pressButton(id)
{
    sfx('click');
    if (id == 'park' || id == 'unpark') { gameMode = id; setScreen('levels'); }
    else if (id == 'sound') { saveData.sound = !saveData.sound; persist(); if (!saveData.sound) track('design', 'settings:sfx:off'); }
    else if (id == 'back') setScreen('title');
    else if (id == 'menu') setScreen('levels');
    else if (id.startsWith('level')) loadLevel(+id.slice(5));
    else if (id == 'pause') isPaused = !isPaused;
    else if (id == 'resume') isPaused = false;
    else if (id == 'restart' || id == 'retry') { track('design', 'ui:restart'); loadLevel(levelIndex); }
    else if (id == 'next') nextInMode() === undefined ? setScreen('levels') : loadLevel(nextInMode());
}

// ---------------------------------------------------------------------------
// engine callbacks

function gameInit()
{
    setCanvasClearColor(C_WATER);
    setFontDefault("'Arial Rounded MT Bold', 'Trebuchet MS', 'Segoe UI', sans-serif");
    for (let i = 0; i < 46; i++)
        ripples.push(vec2(rand(1, 39), rand(1, 21)));
}

const ripples = [];

function gameUpdate()
{
    // the level editor (tools/editor.js, debug only) freezes the level and takes the input
    if (window.pmbEditor?.update()) return;
    screenTime += timeDelta;
    layoutButtons();
    const hovered = buttonAt(mousePos);
    hoverId = hovered && hovered.id;

    if (mouseWasPressed(0))
    {
        if (hovered) pressButton(hovered.id);
        else if (gameScreen == 'playing' && !isPaused) steerHeld = true;
    }
    if (!mouseIsDown(0)) steerHeld = false;

    if (gameScreen == 'title' && (keyWasPressed('Enter') || keyWasPressed('Space'))) pressButton('park');
    if (gameScreen == 'complete')
    {
        if (keyWasPressed('Enter') || keyWasPressed('Space')) pressButton('next');
        if (keyWasPressed('KeyR')) pressButton('retry');
    }
    if (gameScreen == 'playing')
    {
        if (keyWasPressed('KeyP') || keyWasPressed('Escape')) isPaused = !isPaused;
        if (keyWasPressed('KeyR')) pressButton('restart');
        if (!isPaused)
        {
            levelTime += timeDelta;
            if (level.jam) jamUpdate(timeDelta);
            else
            {
            if (intro && intro.t < SLIP_SHOW && (mouseWasPressed(0) || keyWasPressed('Space') || keyWasPressed('Enter')))
                intro.t = SLIP_SHOW;
            if (intro)
            {
                intro.t += timeDelta;
                if (intro.t > intro.dur + .4) intro = undefined;
            }
            else boatTime += timeDelta;
            stepWorld();
            updateJudge(timeDelta);
            }
        }
    }
    if (gameScreen == 'playing' || gameScreen == 'complete')
        updateCamera(timeDelta);
    else { cam.pos = UI_CENTER.copy(); cam.wu = 1; }
    updateEffects();
}

function gameUpdatePost() { useUiCamera(); }

// ---------------------------------------------------------------------------
// rendering (world)

// ripples come in octaves 10x apart, each visible while its glyphs are a readable size on screen,
// so the water keeps its texture and shows the zoom at any scale
function drawWater()
{
    const v = VIEW_RECT;
    for (let s = .01; s < 1e7; s *= 10)
    {
        const g = .7*s / WU;
        if (g < .3 || g > 3) continue;
        const color = C_WATER2.scale(1, clamp((g - .3)/.4, 0, 1) * clamp((3 - g)/1.5, 0, 1));
        const tw = 40*s, th = 22*s, w = .08*s;
        for (let tx = Math.floor(v.x0/tw); tx*tw < v.x1; tx++)
        for (let ty = Math.floor(v.y0/th); ty*th < v.y1; ty++)
        for (let i = 0; i < ripples.length; i++)
        {
            const p = ripples[i], x = tx*tw + (p.x + Math.sin(time*.5 + i)*.4)*s, y = ty*th + p.y*s;
            if (x < v.x0 - s || x > v.x1 + s || y < v.y0 - s || y > v.y1 + s) continue;
            drawLine(vec2(x - .35*s, y), vec2(x, y - .12*s), w, color);
            drawLine(vec2(x, y - .12*s), vec2(x + .35*s, y), w, color);
        }
    }
}

function drawCurrents()
{
    for (const c of currents)
    {
        const w = c.x1 - c.x0, h = c.y1 - c.y0, dir = vec2(c.dx, c.dy).normalize(), spd = vec2(c.dx, c.dy).length();
        drawRect(vec2(c.x0 + w/2, c.y0 + h/2), vec2(w, h), C_WATER2.scale(1, .45));
        // chevrons drifting with the flow
        for (let y = c.y0 + 1; y < c.y1; y += 2)
        for (let k = 0; k < w/3; k++)
        {
            let x = c.x0 + ((k*3 + time*spd*dir.x) % w + w) % w;
            const tip = vec2(x + dir.x*.3, y), back = -.4*dir.x;
            drawLine(vec2(x + back, y + .35), tip, .12, C_CREAM.scale(1, .6));
            drawLine(vec2(x + back, y - .35), tip, .12, C_CREAM.scale(1, .6));
        }
    }
}

function drawSlip()
{
    if (!slip) return;
    const inside = boatInSlip(), pulse = .5 + .5*Math.sin(time*5);
    const lw = Math.min(.14*WU, slip.wid*.08);
    if (inside)
    {
        drawPoly([vec2(slip.pos.x-slip.w/2, slip.pos.y-slip.h/2), vec2(slip.pos.x+slip.w/2, slip.pos.y-slip.h/2),
            vec2(slip.pos.x+slip.w/2, slip.pos.y+slip.h/2), vec2(slip.pos.x-slip.w/2, slip.pos.y+slip.h/2)],
            C_CREAM.scale(1, .15 + .1*pulse), lw*1.15, C_CREAM);
    }
    else
        drawDashedRect(slip.pos, slip.w, slip.h, C_CREAM, lw, Math.max(.45*WU, slip.wid*.15));
}

// each trail as a ribbon of quads: a faint wide band under a brighter core, both widening and fading with age
function drawFoam()
{
    for (const trail of foams)
    {
        if (trail.length < 2 || !trail.some(p => inView(p.pos, p.w*4))) continue;
        for (const [wide, alpha] of [[2.4, .3], [1, .85]])
        {
            let prev;
            for (const p of trail)
            {
                const k = p.t / FOAM_LIFE, hw = p.w*wide*(1 + k*1.5)/2;
                const e = { l:p.pos.add(p.n.scale(hw)), r:p.pos.subtract(p.n.scale(hw)), a:p.a*alpha*(1 - k) };
                if (prev) drawPoly([prev.l, e.l, e.r, prev.r], C_CREAM.scale(1, (prev.a + e.a)/2));
                prev = e;
            }
        }
    }
}

function drawWakes()
{
    for (const w of wakes)
    {
        const k = w.t / 1.2;
        drawEllipse(w.pos, vec2(w.size*(1 + k*2.5)), C_CLEAR, 0, Math.min(.09*WU, w.size*.12)*(1 - k), C_CREAM.scale(1, .7*(1 - k)));
    }
}

function drawAnchorRope()
{
    drawRestRing();
    if (!anchor) return;
    const drop = Math.min(1, anchor.t*4), k = player.k;
    drawCircle(anchor.pos, 1.2*drop*k, C_WATER2.scale(1, .6));
    drawAnchorGlyph(anchor.pos, .55*k, C_INK.scale(1, .5));
    drawLine(bowPoint(), anchor.pos, Math.min(.08*WU, .08*k), C_INK);
}

// fills around the boat while it rests in the slip, so the player sees the park coming
function drawRestRing()
{
    if (!restT || judge) return;
    const p = Math.min(1, restT/REST_TIME), r = player.radius*1.15, n = 40, w = .14*cam.wu;
    drawCircle(player.pos, r*2, C_CLEAR, w, C_INK.scale(1, .2));
    for (let i = 0; i < n*p; i++)
    {
        const a0 = PI/2 - i/n*2*PI, a1 = PI/2 - Math.min(i + 1, n*p)/n*2*PI;
        drawLine(player.pos.add(vec2(Math.cos(a0), Math.sin(a0)).scale(r)), player.pos.add(vec2(Math.cos(a1), Math.sin(a1)).scale(r)), w, C_SUNNY);
    }
}

function drawBodies()
{
    drawLands();
    for (const r of rects) if (r.dock) drawDockShadow(r);
    for (const b of bodies) if (b.type && inView(b.pos, b.radius*1.2)) drawBoatShadow(b);
    for (const r of rects) if (r.dock) drawDock(r);
    for (const p of posts) if (!p.land && inView(vec2(p.x, p.y), p.r*2)) drawPost(p);
    drawSlip();     // over the finger docks, so its dashed sides show
    if (level?.jam) drawJamSelection();
    for (const b of bodies)
    {
        if (!inView(b.pos, b.radius*1.5)) continue;
        if (b.kind == 'duck') { if (!b.asleep) drawDuck(b); }
        else if (b.kind == 'buoy') drawBuoy(b);
        else if (b.kind == 'log') drawLog(b);
    }
    for (const b of bodies) if (b.type && b != player && inView(b.pos, b.radius*1.2)) drawBoat(b);
    if (player) drawBoat(player);
}

// sand rects and landmass blobs drawn as one shape: every outline first, then every fill on top,
// so overlapping pieces never show a seam
function drawLands()
{
    const shown = lands.filter(m => inView(m.pos, m.r));
    for (const r of rects) if (r.land) fillRect(r, C_INK, undefined, LINE_W);
    for (const m of shown) drawPoly(m.pts, C_INK, LINE_W*2, C_INK);
    for (const r of rects) if (r.land) fillRect(r, C_SAND);
    for (const m of shown) drawPoly(m.pts, C_SAND);
    for (const m of shown) if (m.grass) drawPoly(m.grass, C_GRASS);
}

function drawDrops()
{
    for (const d of drops)
    {
        const k = 1 - d.t / d.life;
        if (d.square) drawRect(d.pos, vec2(d.size*k + .05*WU), d.color, d.t*8);
        else drawCircle(d.pos, d.size*k + .05*WU, d.color);
    }
}

// ---------------------------------------------------------------------------
// rendering (UI)

function drawPopups()
{
    for (const p of popups)
    {
        const pop = Math.min(1, p.t*8), s = p.size * (pop < 1 ? pop*1.3 : 1 + Math.max(0, .3 - (p.t - .12)*2));
        const a = clamp((1.3 - p.t)*3, 0, 1), u = worldToUi(p.pos);
        // long messages stay on screen when the boat is near the edge
        const half = viewHalfUi().x - p.text.length*s*.3 - .5;
        u.x = half > 0 ? clamp(u.x, 20 - half, 20 + half) : 20;
        txt(p.text, u.x, u.y + p.lift + p.t*.8, s, p.color.scale(1, a), 'center', .14*s, C_INK.scale(1, a));
    }
}

function drawButton(b)
{
    const hover = hoverId == b.id, lift = hover ? .12 : 0;
    if (b.card !== undefined) return drawLevelCard(b, hover);
    const c = vec2(b.x, b.y + lift);
    drawPanel(c, b.w, b.h, b.big ? C_CORAL : C_CREAM, Math.min(.6, b.h*.35));
    txt(b.label, c.x, c.y - (b.small ? .02 : .05), b.big ? 1.25 : b.small ? .6 : .85, b.big ? C_CREAM : C_INK);
}

function drawLevelCard(b, hover)
{
    const i = b.card, L = LEVELS[i], stars = saveData.stars[i] || 0, isNext = i == nextLevelIndex();
    const c = vec2(b.x, b.y + (hover ? .15 : 0));
    drawPanel(c, b.w, b.h, isNext ? C_SUNNY : L.bonus ? C_WATER2 : C_CREAM, .5);
    txt(b.label, c.x, c.y + 1.15, L.bonus ? .8 : 1.2, C_INK);
    txt(L.name, c.x, c.y + .1, .48, C_INK);
    txt(L.jam ? 'Harbor jam' : L.boats.length > 1 ? `${L.boats.length} boats` : BOATS[L.boats[0].boat].name, c.x, c.y - .55, .4, L.world == 1 ? C_CORAL : C_TEAL);
    for (let s = 0; s < 3; s++) drawStar(vec2(c.x - 1.15 + s*1.15, c.y - 1.45), .42, s < stars);
}

// map-style scale bar: a round length about 5 UI units long
function drawScaleBar()
{
    const target = 5*cam.wu, p10 = Math.pow(10, Math.floor(Math.log10(target)));
    const m = [5, 2, 1].map(x => x*p10).find(x => x <= target), len = m / cam.wu;
    const x0 = 1, y = 19.7;
    drawLine(vec2(x0, y), vec2(x0 + len, y), .14, C_INK);
    drawLine(vec2(x0, y - .25), vec2(x0, y + .25), .14, C_INK);
    drawLine(vec2(x0 + len, y - .25), vec2(x0 + len, y + .25), .14, C_INK);
    txt(fmtLen(m), x0 + len/2, y + .55, .5, C_INK);
}

// when the slip is off screen: an arrow at the edge of the play area pointing to it, with the distance
function drawSlipArrow()
{
    if (gameScreen != 'playing' || !slip) return;
    // shown until the middle of the slip is on screen
    const half = viewHalfUi(), u = worldToUi(slip.pos);
    const x0 = 20 - half.x, x1 = 20 + half.x, y0 = UI_CENTER.y - half.y, y1 = PLAY_TOP;
    if (u.x > x0 && u.x < x1 && u.y > y0 && u.y < y1) return;
    // where the line from the view center to the slip leaves the inset box
    // (more room at the top, below the scale bar)
    const m = 1.6, c = vec2(20, (y0 + y1)/2), d = u.subtract(c);
    const t = Math.min((d.x > 0 ? x1 - m - c.x : c.x - x0 - m) / Math.abs(d.x || 1e-9),
                       (d.y > 0 ? y1 - 3.4 - c.y : c.y - y0 - m) / Math.abs(d.y || 1e-9));
    const a = Math.atan2(d.y, d.x), p = c.add(d.scale(t)).add(vec2(Math.cos(a), Math.sin(a)).scale(Math.sin(time*5)*.15));
    const pt = (f, s) => p.add(vec2(Math.cos(a)*f - Math.sin(a)*s, Math.sin(a)*f + Math.cos(a)*s));
    drawPoly([pt(1.1, 0), pt(-.7, .9), pt(-.35, 0), pt(-.7, -.9)], C_SUNNY, .14, C_INK);
    const q = pt(-1.8, 0).subtract(vec2(0, .2));
    txt(fmtLen(slip.pos.distance(player.pos)), q.x, q.y, .5, C_CREAM, 'center', .1, C_INK);
}

// a ring around the player when the boat is too small to spot
function drawPlayerMarker()
{
    if (!player) return;
    const len = boatSize(player) / cam.wu;
    if (len > 1.2) return;
    const u = worldToUi(player.pos), r = 1.1 + Math.sin(time*6)*.12;
    drawCircle(u, r*2, C_CLEAR, .14, C_CORAL);
    txt('YOU', u.x, u.y + r + .45, .5, C_CORAL, 'center', .08, C_INK);
}

function drawIntro()
{
    if (!intro) return;
    if (fleet.length < 2) return;
    const t = intro.t, out = intro.dur + .4;
    const k = Math.min(1, t*4) * clamp((out - t)*4, 0, 1);
    if (k <= 0) return;
    // at the bottom: piers and the boat just parked are usually up top
    const y = 3.2 - (1 - k)*5;
    drawPanel(vec2(20, y), 17, 3.6, C_CREAM.scale(1, k), .6);
    const ink = C_INK.scale(1, k), size = boatSize(player);
    txt(`BOAT ${boatIndex + 1} OF ${fleet.length}`, 20, y + 1.05, .5, C_TEAL.scale(1, k));
    txt(player.type.name.toUpperCase(), 20, y - .05, 1.3, C_CORAL.scale(1, k), 'center', .12, ink);
    let line = fmtLen(size);
    if (intro.prev)
    {
        const r = size / boatSize(intro.prev);
        if (r >= 1.5) line += ` · ${Math.round(r)}x BIGGER`;
        else if (r <= 1/1.5) line += ` · ${Math.round(1/r)}x SMALLER`;
    }
    txt(line, 20, y - 1.15, .6, ink);
}

function drawHud()
{
    const L = level, wide = viewHalfUi().x*2;
    drawRect(vec2(20, (PLAY_TOP + UI_SIZE.y)/2), vec2(wide, UI_SIZE.y - PLAY_TOP), C_CREAM);
    drawLine(vec2(20 - wide/2, PLAY_TOP), vec2(20 + wide/2, PLAY_TOP), LINE_W, C_INK);
    txt(`${levelNumber()}. ${L.name}`, .8, 21.75, .7, C_INK, 'left');
    // a jam's hint stays up until the first tap
    if (L.jam) { drawJamHud(); drawHint(L.hint, attempts || gameScreen != 'playing' ? 0 : 1); return; }
    let boat = player.type.name;
    boat += ` · ${fmtLen(boatSize(player))}`;
    if (fleet.length > 1) boat += `   ${boatIndex + 1}/${fleet.length}`;
    txt(boat, 10, 21.75, .55, C_TEAL, 'left');
    if (damages) txt(`Damages: ${fmtMoney(damages)}`, 26, 21.75, .55, C_CORAL);
    drawScaleBar();

    // hint fades after a few seconds
    drawHint(L.boats[boatIndex].hint, intro || gameScreen != 'playing' ? 0 : clamp(6 - boatTime, 0, 1));
}

function drawHint(hint, a)
{
    if (!(a > 0 && hint)) return;
    drawPanel(vec2(20, 1.6), Math.min(36, hint.length*.33 + 2), 1.5, C_CREAM.scale(1, a), .5, false);
    txt(hint, 20, 1.6, .58, C_INK.scale(1, a));
}

function drawTitle()
{
    // a cruise ship drifts past behind a little parade of boats doing donuts
    const ship = { pos:vec2(((time*1.2) % 90) - 25, 2.6), angle:0, sx:1, sy:1, id:9, k:2.4, type:BOATS.cruise, color:BOATS.cruise.color, kind:'title' };
    drawBoatShadow(ship);
    drawBoat(ship);
    ['dinghy', 'swan', 'trawler', 'speedboat'].forEach((key, i) =>
    {
        const a = time*.4 + i*PI/2;
        const b = { pos:vec2(20 + Math.cos(a)*15, 11 + Math.sin(a)*7.5), angle:a + PI/2, sx:1, sy:1, id:i, type:BOATS[key], color:BOATS[key].color, kind:'title' };
        drawBoatShadow(b);
        drawBoat(b);
    });
    const bob = Math.sin(time*2)*.2;
    txt('DOCK ALL THE BOATS', 20.2, 15.1 + bob, 2.8, C_INK);
    txt('DOCK ALL THE BOATS', 20, 15.4 + bob, 2.8, C_SUNNY, 'center', .25, C_INK);
    txt('Park boats of every size. Or get them all out.', 20, 12.7, .8, C_INK);
}

function drawComplete()
{
    drawRect(UI_CENTER, UI_SIZE.scale(3), C_INK.scale(1, .35));
    const t = screenTime, k = Math.min(1, t*3), ease = 1 + 2.7*Math.pow(k - 1, 3) + 1.7*Math.pow(k - 1, 2);
    const c = vec2(20, 11.5);
    drawPanel(c.add(vec2(0, (1 - ease)*-12)), 24, 17, C_CREAM, .8);
    if (k < 1) return;
    txt(level.jam ? 'ALL CLEAR!' : 'PARKED!', 20, 17.6, 2, C_CORAL, 'center', .16, C_INK);
    for (let s = 0; s < 3; s++)
    {
        const st = clamp((t - .35 - s*.25)*5, 0, 1);
        const sz = st < 1 ? st*1.3 : 1;
        if (st > 0 && st < .25 && s < result.stars && !result['sfx' + s]) { result['sfx' + s] = 1; sfx('click', undefined, 1, 1 + s*.25); }
        drawStar(vec2(16 + s*4, 14.4), 1.4*Math.max(.01, s < result.stars ? sz : 1), s < result.stars && st > 0);
    }
    const shown = Math.round(result.acc*100 * clamp((t - .5)*1.5, 0, 1));
    if (level.jam)
    {
        txt(`Money kept ${fmtMoney(Math.round(level.budget*shown/100))}`, 20, 11.6, 1, C_INK);
        txt(`Bumps: ${jamBumps}    Boats picked: ${attempts}`, 20, 10.3, .55, C_TEAL);
        if (result.isBest) txt('NEW BEST!', 28.5, 16.2, .7, C_CORAL, 'center', 0);
        return;
    }
    txt(`Accuracy ${shown}%`, 20, 11.6, 1, C_INK);
    txt(`Tries: ${attempts}    Damages: ${fmtMoney(damages)}    Ducks hit: ${ducksOffended}`, 20, 10.3, .55, C_TEAL);
    if (accs.length > 1)
        txt(level.boats.map((e, i) => `${BOATS[e.boat].name} ${Math.round(accs[i]*100)}%`).join('    '), 20, 9.3, .5, C_INK);
    if (result.isBest) txt('NEW BEST!', 28.5, 16.2, .7, C_CORAL, 'center', 0);
}

function gameRender()
{
    useWorldCamera();
    drawWater();
    if (gameScreen == 'title' || gameScreen == 'levels')
    {
        useUiCamera();
        if (gameScreen == 'title') drawTitle();
        else txt(gameMode == 'unpark' ? 'UNPARKING' : 'PARKING', 20, 19.6, 2, C_SUNNY, 'center', .16, C_INK);
        return;
    }
    drawCurrents();
    drawFoam();
    drawWakes();
    drawBodies();
    drawAnchorRope();
    drawDrops();
    const editing = window.pmbEditor?.active;
    if (editing) pmbEditor.renderWorld();

    useUiCamera();
    if (editing) return pmbEditor.renderUi();
    drawPopups();
    drawPlayerMarker();
    drawSlipArrow();
    drawHud();
    drawIntro();
    if (gameScreen == 'complete') drawComplete();
    if (isPaused)
    {
        drawRect(UI_CENTER, UI_SIZE.scale(3), C_INK.scale(1, .35));
        txt('PAUSED', 20, 16.4, 2, C_CREAM, 'center', .16, C_INK);
    }
}

function gameRenderPost()
{
    for (const b of buttons) drawButton(b);
}

// testing hook (STANDARDS.md)
window.game =
{
    get screen() { return gameScreen; },
    get level() { return levelIndex; },
    get boat() { return boatIndex; },
    get score() { return result ? Math.round(result.acc*100) : 0; },
    get player() { return player; },
    get camera() { return { x:cam.pos.x, y:cam.pos.y, metersPerUi:cam.wu }; },
    start() { loadLevel(nextLevelIndex()); },
    restart() { loadLevel(levelIndex); },
    load(i) { loadLevel(i); },
    // debug: park the current boat perfectly
    win()
    {
        if (level.jam) return jamWin();
        if (intro) intro.t = intro.dur;
        player.pos = slip.pos.copy(); player.angle = slip.a; player.vel = vec2(); player.angVel = 0;
        player.updateWorld();
        if (!judge) judgeBoat();
    },
};

setGLEnable(false);
setDebugWatermark(false);
engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost);
