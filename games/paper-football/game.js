/*
    Paper Football — two-player football drawn on a coach's whiteboard
    - Everyone lines up at the line of scrimmage (LOS). The QB calls "HUT!"
      with their action key, then it's live
    - QB: scramble behind the line and don't get sacked (any X touching you
      while you hold the ball). Action = throw; the pass leads your receiver
    - Receiver (WR): shake the cornerbacks. They jam you when they touch you,
      so juke them (below) to break free and get open. A rusher in the QB's
      throwing lane can get a hand up and bat the pass down
    - Juke (WR, or the QB with the ball): push one way then the opposite way
      within .25s. You cut hard the new way, and nearby defenders slip and
      fall. It breaks ankles hardest when the defender is close, moving fast
      and running the way you faked. A juke always shakes off a WR's jammer.
      Drawing the CPU WR's route, any acute corner (a zigzag, a curl's
      turn back) is a drawn juke: the WR jukes as it makes that cut
    - Catch it and run: every defender chases the ball carrier, juke them to
      break free. Tackled (any X touching you) or out at the sideline, the LOS
      jumps to that spot, the roles swap (the catcher is the new QB) and
      everyone resets. With the ball, action = jump: hurdle a tackle (a diving
      X goes right under you). One jump every 2.5s, no steering mid-air. The
      ball carrier may stiff-arm a tackler (40%), once per first down. 4 downs to gain 10 yards: reach the
      first-down line for a fresh set, every other play (short catches included)
      burns a down. Running out of downs, or one interception, ends the drive
    - Endless: the field and its yard numbers keep going. Each catch makes the
      defense a bit faster
    - Team size (title screen, 2 to 11 a side) and receivers (1 to 5, the NFL's
      most eligible receivers): QB and WR, then an extra WR (a decoy on a deep
      route), a tight end, a running back (blocks, then flattens a tackler after
      the catch) and a slot WR. Everyone else is a lineman. The
      defense matches it body for body: one man on each receiver, the rest
      split each play between the rush and deep help, man or zone. With no
      linemen the lone rusher counts a beat before coming
    - Title screen picks 1 player (you + a CPU teammate in the P2 slot: as QB it
      scrambles and throws only when you call for it (action while no X is on you), so
      call too late and it gets sacked; as WR it runs its route from the play
      call (a random play from a small real playbook, redraw any route before
      the snap) and jukes its way free) or 2 players
    - P1 = WASD + Space/F, P2 = arrows + Enter/Shift (solo: either set). Touch:
      each player owns half the screen (solo: all of it), drag to run, quick
      tap = action. M (any time in a game) = back to the title screen
    - Art: hand-drawn marker shapes on a whiteboard (O = offense, X = defense),
      every body leaves its route behind it as a marker trail
*/

'use strict';
debugWatermark = false;
setGLEnable(false);                    // everything is canvas 2D, drawn in call order
setInputWASDEmulateDirection(false);   // WASD and arrows belong to different players
setTouchInputEnable(false);            // multitouch is handled below, one finger per player

const FIELD_HALF = 18;   // sideline x (1 world unit = 1 yard)
const VIEW_W = 40, VIEW_H = 28;
const START_LOS = 20;
const BODY_R = .6;
const JAM = false;      // a coverage defender touching the WR slows them down (and the CPU QB won't throw to them)

// marker inks
const BOARD = '#f7f7f2';
const INK = '#202028';
const INK_GREEN = '#139157';
const INK_FIRST = '#e07a10';   // first-down line
const INK_FIELD = 'rgba(40,70,120,.22)';
const PLAYER_INK = ['#1f5fd1', '#d42a2a'];
const SPOT_INK = {wr2: '#7b3fc4', te: '#0b8aa0', rb: '#c2378f', wr3: '#6b8a12'}; // the CPU receivers each get their own color
const PLAYER_NAME = ['P1', 'P2'];
const PLAYER_KEYS = ['SPACE', 'ENTER'];
const MARKER_FONT = '"Marker Felt", "Chalkboard SE", "Comic Sans MS", "Segoe Print", cursive';

// sounds
const sndHut      = new SoundGenerator({frequency:620, release:.14, pitchJump:240, pitchJumpTime:.05, volume:.5});
const sndThrow    = new SoundGenerator({frequency:300, release:.15, slide:.6, noise:.3, volume:.5});
const sndCatch    = new SoundGenerator({frequency:900, release:.12, pitchJump:600, pitchJumpTime:.05});
const sndPow      = new SoundGenerator({frequency:220, release:.18, slide:-.4, noise:.1});
const sndWhiff    = new SoundGenerator({frequency:500, release:.08, slide:-1, noise:.5, volume:.3});
const sndJuke     = new SoundGenerator({frequency:1300, release:.07, slide:.9, volume:.3}); // sneaker squeak
const sndSack     = new SoundGenerator({frequency:90, sustain:.15, release:.35, noise:5, bitCrush:.5, sustainVolume:.5, delay:.05});
const sndNope     = new SoundGenerator({frequency:200, release:.3, slide:-.5, volume:.6});
const sndHop      = new SoundGenerator({frequency:330, release:.2, slide:.5, volume:.4});
const sndPick     = new SoundGenerator({frequency:420, release:.6, slide:-.6, repeatTime:.1, volume:.6});

///////////////////////////////////////////////////////////////////////////////
// game state

let gameState = 'title';   // title, presnap, live, air, run, result, over
let stateTimer = new Timer;
let numPlayers = 2;        // 1 = P1 plus a CPU teammate in the P2 slot
let titleChoice = 0;       // highlighted title option: 0 = 1 player, 1 = 2 players
let snapTime = 0;
let los = START_LOS;       // line of scrimmage (y)
let down = 1;
let firstDown = START_LOS + 10; // the line to reach for a fresh set of downs
let completions = 0;
let qbIndex = 0;           // which player is QB this play
let furthest = 0;          // yards of the best LOS reached this drive
let plays = 0;
let resultInfo;            // {text, sub, color} for the result banner
let longPass = 0, longRec = 0; // longest completion this drive thrown / caught by a human
let newRecords = new Set;  // which saved records this drive beat
let saveData = readSaveData('chalkTalk', {best:0, longPass:0, longRec:0, teamSize:7});
const MIN_TEAM = 2, MAX_TEAM = 11;
let teamSize = clamp(saveData.teamSize, MIN_TEAM, MAX_TEAM); // players a side, see setupPlay
// receivers besides the QB. NFL max is 5: 7 must be on the line and only its 2 ends are eligible,
// plus the 4 backs, one of them the QB. Older saves had no setting: they got every spot that fit
const MAX_RECEIVERS = 5;
let receiverCount = clamp(saveData.receiverCount ?? teamSize - 1, 1, min(MAX_RECEIVERS, teamSize - 1));
let ball;                  // pass in the air
let catchY = 0;            // where the ball carrier caught it, for yards after the catch
let catchTime = 0;
const HURDLE_TIME = .5;      // seconds the ball carrier is off the ground
const HURDLE_COOLDOWN = 2.5; // seconds from one jump to the next
const TACKLE_GRACE = .5;   // a beat to tuck the ball after the catch: time to juke the closest defender
let defense = {zone: false, side: 1}; // this play's call: zone coverage or man, and the WR's side
let camY = START_LOS + 7;
let stiffArmAt = -9;       // a stiff arm buys a moment free of the pile around you
let stiffArmUsed = false;  // the stiff arm is spent until the next first down
const STIFF_ARM_CHANCE = .4; // odds a tackle gets shrugged off, while the stiff arm is unspent

let humans = [], linemen = [], rushers = [], coverage = [], decoys = [];
let formation = [];        // this play's receiving spots {key, label, pos}: you line up at one, the CPU plays the rest
let passTo;                // 1P at QB: the receiver you picked to throw to (undefined: the WR)
let effects = [];

const difficulty = () => min(1 + completions * .045, 1.6);
const qb = () => humans[qbIndex];
const wr = () => humans[1 - qbIndex];
const isLive = () => gameState == 'live' || gameState == 'air' || gameState == 'run';
const defenders = () => [...coverage, ...rushers];
const isCPU = (i) => numPlayers == 1 && i == 1;
const tightCoverage = () => !isCPU(wr().index); // a human WR draws the full defense, the CPU WR the looser one
const defenseAccel = () => tightCoverage() ? 1 : .7; // the looser defense is a step slower off the mark
const playerName = (i) => numPlayers == 1 ? ['YOU', 'CPU'][i] : PLAYER_NAME[i];
const snapper = () => numPlayers == 1 ? 0 : qbIndex; // in 1P the human always calls the snap

///////////////////////////////////////////////////////////////////////////////
// input: keys + one touch finger per player

const playerInput = [{dir:vec2(), pressed:false}, {dir:vec2(), pressed:false}];
const fingers = new Map;            // touch id (or 'mouse') -> {player, start, cur, t0}
const fingerTaps = [false, false];
let tappedX = -1;                   // where across the screen (0 to 1) the last quick tap was (menus)
let tappedPos;                      // and where on the canvas it was, for tapping a player
const flicks = [{cur: vec2(), last: vec2(), t: -9, held: -9}, {cur: vec2(), last: vec2(), t: -9, held: -9}]; // juke detection
let usedTouch = false;
const stickMode = [false, false];   // this player steers with a stick (finger or mouse), not keys

function touchToCanvas(t)
{
    const r = mainCanvas.getBoundingClientRect();
    return vec2((t.clientX - r.left) * mainCanvas.width / r.width, (t.clientY - r.top) * mainCanvas.height / r.height);
}

function onTouch(e)
{
    e.preventDefault();
    usedTouch = true;
    if (audioContext && audioContext.state != 'running')
        audioContext.resume();
    for (const t of e.changedTouches)
    {
        const p = touchToCanvas(t);
        if (e.type == 'touchstart')
            fingerDown(t.identifier, p);
        else
            fingerMove(t.identifier, p, e.type == 'touchend' || e.type == 'touchcancel');
    }
}

function fingerDown(id, p)
{
    // 2P: each player owns half the screen, 1P: any finger steers
    const half = p.x < mainCanvas.width/2 ? 0 : 1;
    const player = numPlayers == 1 ? 0 : half;
    fingers.set(id, {half, player, start:p, cur:p, t0:time});
    stickMode[player] = true;
}

// on a phone's stick, the WR (or the ball carrier) always runs: the stick only steers, and letting go is the action.
// The mouse stick on desktop runs and stops like the keys
const stickRunner = (i) => usedTouch && stickMode[i] && isLive() && humans[i] == wr();

function fingerMove(id, p, up)
{
    const f = fingers.get(id);
    if (!f) return;
    f.cur = p;
    if (!up) return;
    if (time - f.t0 < .25 && f.cur.distance(f.start) < 25)
    {
        fingerTaps[f.player] = true;
        tappedX = f.cur.x / mainCanvas.width;
        tappedPos = f.cur;
    }
    else if (stickRunner(f.player))
        fingerTaps[f.player] = true;
    fingers.delete(id);
}

// the mouse is one more finger: hold and drag for the stick, a quick click is the action
function mouseFinger()
{
    if (usedTouch) return; // a phone's synthesized mouse events would double every touch
    if (mouseWasPressed(0))
        fingerDown('mouse', mousePosScreen.copy());
    else if (fingers.has('mouse'))
        fingerMove('mouse', mousePosScreen.copy(), !mouseIsDown(0));
}
for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'])
    document.addEventListener(type, onTouch, {passive:false});

function stickRadius() { return min(mainCanvasSize.x, mainCanvasSize.y) * .09; }

function readInputs()
{
    mouseFinger();
    const keyAxis = (l, r, d, u) => vec2(keyIsDown(r) - keyIsDown(l), keyIsDown(u) - keyIsDown(d));
    const keyDirs = [keyAxis('KeyA', 'KeyD', 'KeyS', 'KeyW'), keyAxis('ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp')];
    const keyActs =
    [
        keyWasPressed('Space') || keyWasPressed('KeyF') || keyWasPressed('KeyE'),
        keyWasPressed('Enter') || keyWasPressed('ShiftRight') || keyWasPressed('Slash') || keyWasPressed('Numpad0'),
    ];
    if (numPlayers == 1)
    {
        // solo: either key set drives you, the CPU fills slot 2
        keyDirs[0] = keyDirs[0].add(keyDirs[1]).clampLength(1);
        keyActs[0] ||= keyActs[1];
    }
    for (let i = 2; i--;)
    {
        if (isCPU(i))
        {
            playerInput[i] = cpuInput(humans[i]);
            fingerTaps[i] = false;
            continue;
        }
        if (keyDirs[i].length())
            stickMode[i] = false;
        let dir = touchDir(i, keyDirs[i]);
        if (stickRunner(i))
            dir = dir.length() > .15 ? dir.normalize() : vec2(0, 1); // full speed the way you steer, upfield when let go
        const stick = [...fingers.values()].some(f => f.player == i);
        playerInput[i].dir = dir;
        playerInput[i].pressed = keyActs[i] || fingerTaps[i];
        playerInput[i].juke = detectJuke(i, dir, stick);
        fingerTaps[i] = false;
    }
}

// a finger dragged on the player's side of the screen overrides their keys
function touchDir(i, dir)
{
    for (const f of fingers.values())
    {
        if (f.player != i) continue;
        // the stick's center trails a finger dragged past its rim, so a flick back always crosses it fast
        const off = f.cur.subtract(f.start);
        if (off.length() > stickRadius())
            f.start = f.cur.subtract(off.normalize(stickRadius()));
        const d = f.cur.subtract(f.start).scale(1 / stickRadius());
        if (d.length() > .15)
            dir = vec2(d.x, -d.y).clampLength(1);
    }
    return dir.length() > 1 ? dir.normalize() : dir;
}

// a fresh push one way (snapped to 8 directions) and then the opposite way within .25s is a juke.
// On a stick (finger or mouse) a single fast flick from one way to the opposite is enough.
// Returns the direction of the cut, or undefined
function detectJuke(i, dir, stick)
{
    const f = flicks[i];
    const d8 = dir.length() > (stick ? .35 : .5) ? vec2().setAngle(round(dir.angle() / (PI / 4)) * PI / 4) : vec2();
    if (d8.distance(f.cur) < .1)
    {
        if (d8.length()) f.held = time; // last moment the stick still pointed the old way
        return;
    }
    f.cur = d8;
    if (!d8.length()) return;
    const flipped = d8.dot(f.last) < -.9;
    const juke = flipped && (time - f.t < .25 || stick && time - f.held < .15);
    f.last = d8;
    f.t = juke ? -9 : time; // a juke's cut doesn't count as the fake for another one
    f.held = time;
    return juke ? d8 : undefined;
}

///////////////////////////////////////////////////////////////////////////////
// CPU teammate (1P): fills the P2 slot by producing the same input a player would

// route waypoints in yards from the receiver's start: x > 0 is toward their sideline, y is upfield
const ROUTES =
{
    go:     [[0, 4], [.5, 28]],
    seam:   [[0, 4], [-.5, 25]],
    slant:  [[0, 3], [-9, 12], [-14, 20]],
    out:    [[0, 9], [8, 9.5]],
    curl:   [[0, 11], [-1.5, 8.5]],
    hitch:  [[0, 6], [0, 4.5]],
    post:   [[0, 8], [-9, 22]],
    corner: [[0, 8], [6, 18]],
    dig:    [[0, 10], [-14, 10.5]],
    cross:  [[0, 6], [-22, 14]],
    drag:   [[0, 2], [-16, 3.5]],
    drag2:  [[0, 3], [-16, 5.5]],   // the 2nd drag of a mesh runs just over the 1st
    flat:   [[3, 1], [9, 2.5]],
    wheel:  [[5, 1], [9, 5], [9, 22]],
};

// 1P at QB: every play comes from the playbook, each spot running its part of the concept.
// Redraw any of them before the snap. A TE or RB with no route stays in to block
const PLAYBOOK =
[
    {name: 'FOUR VERTS', wr1: 'go',    wr2: 'go',    te: 'seam',   rb: null,    wr3: 'seam'},
    {name: 'SMASH',      wr1: 'hitch', wr2: 'hitch', te: 'corner', rb: 'flat',  wr3: 'corner'},
    {name: 'MESH',       wr1: 'drag',  wr2: 'drag2', te: 'seam',   rb: 'wheel', wr3: 'dig'},
    {name: 'SLANT-FLAT', wr1: 'slant', wr2: 'slant', te: 'flat',   rb: null,    wr3: 'flat'},
    {name: 'CURL-FLAT',  wr1: 'curl',  wr2: 'curl',  te: 'flat',   rb: null,    wr3: 'flat'},
    {name: 'Y-CROSS',    wr1: 'go',    wr2: 'post',  te: 'cross',  rb: 'flat',  wr3: 'out'},
    {name: 'DAGGER',     wr1: 'dig',   wr2: 'go',    te: 'seam',   rb: null,    wr3: 'seam'},
];
let playCall;              // this play's playbook entry, when you're the QB

function makeRoute(name, start)
{
    const side = sign(start.x) || 1;
    const points = ROUTES[name].map(([x, y]) =>
        vec2(clamp(start.x + x * side, -FIELD_HALF + 1, FIELD_HALF - 1), start.y + y));
    return {name, points, next: 0};
}

// the play call hands every receiver its route
function callPlay()
{
    playCall = PLAYBOOK[randInt(PLAYBOOK.length)];
    for (const f of formation)
    {
        const b = occupant(f), name = playCall[f.key];
        if (name)
            setRoute(b, makeRoute(name, b.pos));
    }
}

// 1P with you at QB: before the snap, drag on the board (mouse or finger) to draw the CPU's route
const canDrawRoutes = () => numPlayers == 1 && !isCPU(qbIndex); // you're the QB calling the play
const canDrawRoute = () => gameState == 'presnap' && canDrawRoutes();
const ROUTE_STEP = 1.2, ROUTE_MAX_LEN = 70;
let routePen;   // what's drawing right now: a touch id or 'mouse'
let routeOwner; // whose route it is: the CPU WR, or an extra WR, TE or RB the stroke started on

// a receiver's route: the CPU WR keeps it with its AI, the other CPU receivers on themselves.
// A TE or RB with no route stays in to block
const routeOf = (b) => b.ai ? b.ai.route : b.route;
function setRoute(b, route)
{
    if (b.ai) b.ai.route = route;
    else b.route = route;
}

function drawRouteUpdate()
{
    if (!canDrawRoute())
        return routePen = undefined;

    // a finger that's dragged past tap distance becomes the pen
    let penPos;
    for (const [id, f] of fingers)
        if (routePen != id && f.cur.distance(f.start) > 25)
        {
            // the stroke draws for the receiver it starts on, or the WR when it starts in the open
            const from = screenToWorld(f.start);
            const near = receivers().filter(b => b.pos.distance(from) < 2.5).sort((a, b) => a.pos.distance(from) - b.pos.distance(from));
            startDrawnRoute(id, from, near[0] ?? humans[1]);
        }
    if (routePen != undefined)
        penPos = fingers.get(routePen) && screenToWorld(fingers.get(routePen).cur);
    if (!penPos)
        return routePen = undefined;

    const route = routeOf(routeOwner), points = route.points;
    const p = vec2(clamp(penPos.x, -FIELD_HALF + 1, FIELD_HALF - 1), penPos.y);
    if (!points.length)
        points.push(p);
    route.raw ??= [{pos: points[0], wp: 1}];
    if (p.distance(route.raw[route.raw.length - 1].pos) < .15) return;
    extendRoute(route, p);
    route.raw.push({pos: p, wp: points.length});
    findDrawnJuke(route);
}

function extendRoute(route, p)
{
    // resample at even steps so a fast swipe still leaves waypoints to follow
    const points = route.points, last = points[points.length - 1], dist = p.distance(last);
    if (dist < ROUTE_STEP || route.length >= ROUTE_MAX_LEN) return;
    const steps = min(dist / ROUTE_STEP | 0, (ROUTE_MAX_LEN - route.length) / ROUTE_STEP | 0);
    const dir = p.subtract(last).normalize(ROUTE_STEP);
    for (let i = 1; i <= steps; ++i)
        points.push(last.add(dir.scale(i)));
    route.length += steps * ROUTE_STEP;
}

// drawn jukes are read off the raw pen stroke (route.raw: samples since the leg began, each with how many
// waypoints existed then), not the waypoints, which round off a small zigzag's tip. A leg runs until the
// stroke doubles back from its tip (the sample farthest along it) or bends off its straight line.
// Once the pen is a yard past that corner, an acute angle (under 90°) is a juke
function findDrawnJuke(route)
{
    const raw = route.raw, start = raw[0].pos, pen = raw[raw.length - 1].pos;
    if (route.legFrom && pen.distance(start) >= 1)
    {
        const back = route.legFrom.subtract(start), out = pen.subtract(start);
        if (back.dot(out) > 0 && back.length() >= .6)
            addDrawnJuke(route, raw[0]);
        route.legFrom = undefined;
    }

    let tip = 0;
    raw.forEach((r, i) => { if (r.pos.distance(start) > raw[tip].pos.distance(start)) tip = i; });
    let end = tip < raw.length - 1 && pen.distance(raw[tip].pos) >= .6 ? tip : 0;
    if (!end)
    {
        const chord = pen.subtract(start).normalize();
        let most = .5;
        raw.forEach((r, i) =>
        {
            const off = abs(r.pos.subtract(start).cross(chord));
            if (off > most) { most = off; end = i; }
        });
    }
    if (end)
    {
        route.legFrom = start;
        route.raw = raw.slice(end);
    }
}

function addDrawnJuke(route, tip)
{
    // swap the waypoints laid since the tip for one right on it, mark it, then pick the stroke back up
    const points = route.points;
    points.length = tip.wp;
    if (tip.pos.distance(points[points.length - 1]) > .3)
        points.push(tip.pos.copy());
    route.jukes.add(points.length - 1);
    for (const r of route.raw)
        if (r.wp > tip.wp) r.wp = points.length;
    route.length = points.reduce((len, q, i) => i ? len + q.distance(points[i - 1]) : 0, 0);
    extendRoute(route, route.raw[route.raw.length - 1].pos);
    sndJuke.play(tip.pos);
}

function startDrawnRoute(pen, from, owner)
{
    routePen = pen;
    routeOwner = owner;
    setRoute(owner, {name: 'your route', points: from ? [vec2(clamp(from.x, -FIELD_HALF + 1, FIELD_HALF - 1), from.y)] : [], next: 0, length: 0, drawn: true,
        jukes: new Set}); // jukes: indices of the points where a drawn juke cuts
}

// plant and cut: full speed the new way, right now
function jukeCut(b, cut, qb = false)
{
    b.vel = cut.scale(qb ? 9 : 11);
    sndJuke.play(b.pos);

    // ankle-breaking hits harder the closer the defender, the faster they're moving, and the more
    // their run lines up with the cut, most of all when they bit on the fake and are running the other way
    // A receiver's jammer, in contact, always gets shaken loose
    for (const d of qb ? rushers : gameState == 'run' ? defenders() : coverage)
    {
        const dist = d.pos.distance(b.pos), speed = d.vel.length();
        if (d.stun || dist > 3 || time - d.jukedAt < 1.5) continue; // back on their feet, they won't bite again right away
        const along = speed > .5 ? d.vel.dot(cut) / speed : 0;
        let power = (1 - dist / 3) * min(1, speed / 8) * (along < 0 ? -along : along * .4);
        if (!qb && dist < BODY_R * 2 + .15)
            power = max(power, .3);
        if (power < .1) continue;
        d.vel = d.vel.scale(1.3); // committed: their momentum carries them on past, then down they go
        d.stun = .4 + 1.4 * power;
        d.jukedAt = time;
        d.spin = 0;
        d.dive = 0;
        const broke = power > .45;
        addEffect(broke ? 'ANKLES!' : 'juked!', d.pos.add(vec2(0, 1.6)), INK_GREEN, broke ? 1.4 : .9, broke);
    }
}

// a CPU body runs its route's waypoints in order, cutting hard at any juke you drew,
// then drifts upfield off the sideline
function runRoute(b, speed)
{
    const route = b.route;
    if (route.points[route.next] && b.pos.distance(route.points[route.next]) < 1.2)
    {
        const after = route.points[route.next + 1];
        if (after && route.jukes?.has(route.next))
            return jukeCut(b, after.subtract(route.points[route.next++]).normalize());
        ++route.next;
    }
    const target = route.points[route.next];
    const dir = target ? target.subtract(b.pos).normalize() : vec2(-b.pos.x / FIELD_HALF * .5, 1).normalize();
    b.steer(dir.scale(speed), 40);
}

function nearestCover(pos, countDazed = false, bodies = coverage)
{
    // countDazed: a dazed defender still counts, as far away as the ground they'd make up while recovering
    let best, bestD = 1e9;
    for (const d of bodies)
    {
        const dist = d.pos.distance(pos) + d.stun * 9;
        if ((countDazed || !d.stun) && dist < bestD) { bestD = dist; best = d; }
    }
    return {defender: best, dist: bestD};
}

function cpuInput(h)
{
    const out = {dir: vec2(), pressed: false};
    if (!h || !isLive()) return out;
    const ai = h.ai;

    if (h.isQB())
    {
        if (!h.hasBall) return out;

        // scramble: slide away from nearby rushers, otherwise settle back into the pocket
        let away = vec2();
        for (const r of rushers)
        {
            const offset = h.pos.subtract(r.pos), d = offset.length();
            if (!r.stun && r.active && d < 5)
                away = away.add(offset.normalize((5 - d) / 5));
        }
        const pocket = vec2(clamp(h.pos.x, -6, 6), los - 4.5);
        const dir = away.scale(1.6).add(pocket.subtract(h.pos).scale(.3));
        out.dir = dir.length() > .2 ? dir.clampLength(1) : vec2();

        // you call for the ball and it comes, covered or not. Call too late and it's a sack
        out.pressed = ai.called;
        return out;
    }

    if (gameState == 'air')
    {
        out.dir = ball.to.subtract(h.pos).clampLength(1);
        return out;
    }
    if (gameState == 'run')
        return cpuRun(h, out);

    // run the route, then freelance away from the nearest defender
    const route = ai.route, target = route.points[route.next];
    if (target)
    {
        if (h.pos.distance(target) < 1.2)
        {
            // reaching a drawn juke's turn: cut toward the next point
            const after = route.points[route.next + 1];
            if (after && route.jukes?.has(route.next))
                out.juke = after.subtract(target).normalize();
            ++route.next;
        }
        out.dir = target.subtract(h.pos).normalize();
    }
    else
    {
        const {defender} = nearestCover(h.pos);
        let dir = defender ? h.pos.subtract(defender.pos).normalize() : vec2();
        dir = dir.add(vec2(-h.pos.x / FIELD_HALF * .8, .3)); // keep off the sideline, drift upfield
        out.dir = dir.length() > .2 ? dir.clampLength(1) : vec2();
    }

    // juke a crowding defender after a short reaction: cut straight away from them.
    // A route you drew is the whole plan: it only jukes where you drew one
    const {defender, dist} = nearestCover(h.pos);
    ai.jukeTime = dist < 1.7 && !route.drawn ? ai.jukeTime + timeDelta : 0;
    if (ai.jukeTime > ai.reaction && !out.juke) // a drawn juke this frame takes priority
    {
        out.juke = h.pos.subtract(defender.pos).normalize();
        ai.jukeTime = 0;
        ai.reaction = rand(.15, .4);
    }
    return out;
}

// after the catch: head upfield, bend away from the closest chaser, juke one about to make the tackle
function cpuRun(h, out)
{
    const ai = h.ai, {defender, dist} = nearestCover(h.pos, false, defenders());
    let dir = vec2(-h.pos.x / FIELD_HALF * .5 - sign(h.pos.x) * max(0, abs(h.pos.x) - 12) * .4, 1); // stay off the sideline
    if (defender && dist < 6)
        dir = dir.add(h.pos.subtract(defender.pos).normalize(1.5 * (6 - dist) / 6));
    dir.y = max(dir.y, .4); // dodge sideways, never retreat
    out.dir = dir.normalize();

    // it sees about half the tacklers coming in time, so a CPU run is a decent gain, not a sure breakaway
    if (dist >= 2.2)
        ai.jukeTime = 0, ai.sees = undefined;
    else
    {
        ai.sees ??= rand() < .5;
        ai.jukeTime += timeDelta;
    }
    if (ai.sees && ai.jukeTime > ai.reaction)
    {
        // cut across the tackler's path, toward the side they're not on (or back inside, near the sideline)
        const side = abs(h.pos.x) > 12 ? -sign(h.pos.x) : sign(h.pos.x - defender.pos.x) || 1;
        if (h.canHurdle() && rand() < .4)
            out.pressed = true; // go over them instead
        else
            out.juke = vec2(side, .6).normalize();
        ai.jukeTime = 0;
        ai.reaction = rand(.2, .55); // a beat slower with the ball, so dives land sometimes
    }
    return out;
}

///////////////////////////////////////////////////////////////////////////////
// bodies

class Body extends EngineObject
{
    constructor(pos, ink)
    {
        super(pos, vec2(BODY_R * 2));
        this.vel = vec2();
        this.ink = ink;
        this.seed = rand(1000);
        this.stun = 0;
        this.jukedAt = -9;
        this.dive = 0;
        this.trail = [pos];
        this.trailTimer = 0;
        this.trailMax = 30;
    }
    update()
    {
        if (!isLive())
        {
            this.vel = vec2();
            return;
        }
        this.stun = max(0, this.stun - timeDelta);
        this.think();
        this.pos = this.pos.add(this.vel.scale(timeDelta));
        this.pos.x = clamp(this.pos.x, -FIELD_HALF + BODY_R, FIELD_HALF - BODY_R);

        if ((this.trailTimer -= timeDelta) < 0 && this.pos.distance(this.trail[this.trail.length-1]) > .3)
        {
            this.trailTimer = .07;
            this.trail.push(this.pos.copy());
            if (this.trail.length > this.trailMax)
                this.trail.shift();
        }
    }
    think() {}
    steer(desired, accel)
    {
        this.vel = this.vel.add(desired.subtract(this.vel).clampLength(accel * timeDelta));
    }
    stunned()
    {
        // stunned bodies slide to a stop
        if (this.stun <= 0) return false;
        this.steer(vec2(), 25);
        return true;
    }
    canCollideWith(other) { return true; }
    // a diving tackle: a burst one way with no steering until it's over. Miss and you eat turf
    launchDive(dir)
    {
        this.dive = .3;
        this.vel = dir.normalize(15);
    }
    diving()
    {
        if (this.dive <= 0) return false;
        if ((this.dive -= timeDelta) <= 0)
        {
            this.stun = .8;
            this.jukedAt = time;
            sndWhiff.play(this.pos);
            addEffect('whiff', this.pos.add(vec2(0, 1.4)), this.ink, .8);
        }
        return true;
    }
    // a defender closing on the ball carrier launches a diving tackle. Juke out of its way and they eat turf
    tryDive()
    {
        if (gameState != 'run' || this.stun) return false;
        if (this.diving()) return true;
        const w = wr();
        if (w.pos.distance(this.pos) > 2.4 || time - catchTime < TACKLE_GRACE) return false;
        this.launchDive(w.pos.add(w.vel.scale(.15)).subtract(this.pos));
        return true;
    }
}

class Human extends Body
{
    constructor(pos, index)
    {
        super(pos, PLAYER_INK[index]);
        this.index = index;
        this.hasBall = false;
        this.jukeCooldown = 0;
        this.jammed = false;
        this.jumpT = -1;        // time since the last hurdle, -1 before the first
        this.trailMax = 45;
    }
    isQB() { return this.index == qbIndex; }
    airborne() { return this.jumpT >= 0 && this.jumpT < HURDLE_TIME; }
    canHurdle() { return gameState == 'run' && this.hasBall && (this.jumpT < 0 || this.jumpT > HURDLE_COOLDOWN); }
    // how far off the ground: 0 standing, 1 at the top of the jump
    get up() { return this.airborne() ? Math.sin(PI * this.jumpT / HURDLE_TIME) : 0; }
    hurdle()
    {
        this.jumpT = 0;
        sndHop.play(this.pos);
        addEffect('hup!', this.pos.add(vec2(0, 1.8)), this.ink, .9);
    }
    think()
    {
        const input = playerInput[this.index];
        this.jukeCooldown -= timeDelta;
        if (this.jumpT >= 0) this.jumpT += timeDelta;
        if (this.stunned() || this.airborne()) return; // mid-air: momentum carries you over, no steering until you land
        if (input.juke && (!this.isQB() || this.hasBall))
            this.juke(input.juke);

        let speed = this.isQB() ? 8.5 : this.hasBall ? 9 : 10; // with the ball, pursuit can run you down: juke to make room
        this.jammed = JAM && !this.isQB() && coverage.some(d => !d.stun && d.pos.distance(this.pos) < BODY_R * 2 + .15);
        if (this.jammed) speed *= tightCoverage() ? .35 : .45;
        this.steer(input.dir.scale(speed), 60);

        // the QB can't cross the line while holding the ball
        if (this.hasBall && this.isQB() && this.pos.y > los - BODY_R)
        {
            this.pos.y = los - BODY_R;
            this.vel.y = min(this.vel.y, 0);
        }

        if (input.pressed)
        {
            if (this.canHurdle())
                this.hurdle();
            else if (this.hasBall && gameState == 'live')
                throwBall(this);
            else if (gameState == 'live' && isCPU(qbIndex) && qb().hasBall && !this.jammed)
                callForBall(this);
        }
    }
    juke(cut)
    {
        if (this.jukeCooldown > 0) return;
        this.jukeCooldown = .8;
        jukeCut(this, cut, this.isQB());
    }
    canCollideWith(other) { return !this.airborne(); } // up and over: nobody gets a body on you
    render()
    {
        // jumping: a shadow stays on the ground, the body lifts and swells toward the viewer
        const up = this.up;
        if (up)
            markerCircle(this.pos, BODY_R * .8, INK, .3, this.seed + 3, .15);
        const p = this.pos.add(vec2(0, up * .9));
        markerCircle(p, BODY_R * (1 + up * .4), this.ink, .17, this.seed);
        markerText(this.num ?? this.index + 1 + '', p.add(vec2(0, -.05)), .8, this.ink);
        markerText(this.isQB() ? 'QB' : this.spotLabel ?? 'WR', p.add(vec2(0, 1.15)), .85, this.ink);
        if (this.hasBall)
            drawFootball(p.add(vec2(.75, .2)), .9, 0);
        if (this.jammed && isLive())
            markerText('!!', p.add(vec2(-1, .9)), .8, INK);
        if (!this.ai && this.canHurdle())
        {
            const key = usedTouch ? 'tap' : numPlayers == 1 ? 'SPACE' : PLAYER_KEYS[this.index];
            markerText(key + ': JUMP', p.add(vec2(0, -1.2)), .7, this.ink, .6 + .4 * Math.sin(time * 10));
        }
    }
}

class Lineman extends Body
{
    constructor(pos, ink = INK, label = '')
    {
        super(pos, ink);
        this.home = pos.copy();
        this.label = label;     // the tight end and running back block like linemen
        this.trailMax = 10;
    }
    think()
    {
        if (this.stunned()) return;
        if (this.route && (gameState == 'live' || gameState == 'air'))
            return runRoute(this, 9); // a TE or RB you drew a route for goes out for a pass
        if (gameState != 'live' || !qb().hasBall)
            return this.steer(vec2(), 20);

        // step between the nearest free rusher and the QB
        let target, best = 1e9;
        for (const r of rushers)
        {
            if (!r.active) continue;
            const d = r.pos.distance(this.pos) + abs(r.pos.x - this.home.x) * .6;
            if (d < best) { best = d; target = r; }
        }
        const spot = target ?
            target.pos.add(qb().pos.subtract(target.pos).normalize(1.15)) :
            this.home.add(vec2(0, -1));
        this.steer(spot.subtract(this.pos).clampLength(1).scale(6.5), 30);
    }
    render()
    {
        markerCircle(this.pos, BODY_R, this.ink, .14, this.seed);
        if (this.num)
            markerText(this.num, this.pos.add(vec2(0, -.05)), .8, this.ink);
        if (this.label)
            markerText(this.label, this.pos.add(vec2(0, 1.05)), .75, this.ink);
    }
}

// the running back: picks up rushers beside the QB, then after the catch
// runs ahead of the ball carrier and flattens the closest tackler, once a play
class Back extends Lineman
{
    constructor(pos, ink)
    {
        super(pos, ink, 'RB');
        this.pancaked = false;
    }
    think()
    {
        if (gameState != 'run')
            return super.think();
        if (this.stunned()) return;
        const {defender: d} = nearestCover(wr().pos, false, defenders());
        if (this.pancaked || !d)
            return this.steer(vec2(), 12);
        this.steer(d.pos.subtract(this.pos).clampLength(1).scale(10), 40);
        if (d.pos.distance(this.pos) < BODY_R * 2 + .15)
        {
            this.pancaked = true;
            d.vel = d.pos.subtract(this.pos).normalize(8);
            d.stun = 1.6;
            d.dive = 0;
            d.jukedAt = time;
            sndPow.play(d.pos);
            addEffect('PANCAKE!', d.pos.add(vec2(0, 2)), INK_GREEN, 1.4, true);
        }
    }
}

class Rusher extends Body
{
    constructor(pos, delay = 0, label = '')
    {
        super(pos, INK);
        this.delay = delay;     // blitzers wait a beat before going
        this.label = label;
        this.shed = 0;
        this.shedNeed = rand(1.8, 3.6);
        this.spin = 0;          // spin move: slips through blockers
        this.trailMax = 18;
    }
    get active() { return this.delay <= 0; }
    think()
    {
        if (this.stunned() || this.tryDive()) return;
        if ((this.delay -= timeDelta) > 0)
            return this.steer(vec2(), 20);

        const diff = difficulty();
        const target = gameState == 'air' ? ball.to : gameState == 'run' ? wr().pos : qb().pos;
        const toTarget = target.subtract(this.pos);
        let dir = toTarget.normalize();
        let speed = 6 * diff;

        this.spin = max(0, this.spin - timeDelta);
        const blocker = linemen.find(l => !l.stun && l.pos.distance(this.pos) < BODY_R * 2 + .3);
        if (blocker && !this.spin)
        {
            // engaged: grind forward slowly, slide toward the outside edge
            speed = 1.4 * diff;
            const side = sign(this.pos.x - blocker.pos.x) || 1;
            dir = dir.add(vec2(side * .8, 0)).normalize();
            if ((this.shed += timeDelta * diff) > this.shedNeed)
            {
                this.spin = .55;
                this.shed = 0;
                this.shedNeed = rand(1.8, 3.6);
            }
        }
        if (this.spin)
            speed = 8 * diff;
        if (gameState == 'air')
            speed *= .5;
        this.steer(dir.scale(speed), 35 * defenseAccel());
    }
    canCollideWith(other) { return !(this.spin && other instanceof Lineman); }
    render()
    {
        const angle = this.spin ? this.spin * 20 : this.dive ? PI / 4 : this.stun ? time * 12 : 0;
        markerX(this.pos, BODY_R * .9, INK, .17, this.seed, angle);
        if (this.label)
            markerText(this.label, this.pos.add(vec2(0, 1.05)), .75, INK);
        if (this.stun)
            drawDizzy(this.pos.add(vec2(0, 1)));
        else if (!this.active && gameState == 'live')
            markerText('...', this.pos.add(vec2(0, .9)), .7, INK);
    }
}

class Cover extends Body
{
    // a defensive back: 'cb' trails the receiver, 'under' sits underneath, 'safety' stays deep
    constructor(pos, role, half = 0)
    {
        super(pos, INK);
        this.role = role;
        this.half = half;       // two-deep safeties each own one half of the field
        this.react = rand(.2, .35);
    }
    think()
    {
        if (this.stunned() || this.tryDive()) return;
        const diff = difficulty();
        const w = wr(), tight = tightCoverage();
        let target, speed = (tight ? 9.2 : 8.4) * diff;
        if (gameState == 'run')
        {
            // pursuit: take an angle on the ball carrier, aiming a little ahead of them
            // and sprint harder the further behind they are, so a breakaway ends eventually
            const dist = this.pos.distance(w.pos), lead = min(1, dist / speed);
            target = w.pos.add(w.vel.scale(lead * .6));
            speed *= 1.1 + clamp(dist - 3, 0, 10) * .025;
        }
        else if (gameState == 'air' && time - ball.thrownAt > this.react)
        {
            // ball hawk: break on the landing spot
            target = ball.to;
            speed = 9 * diff;
        }
        else if (this.mark)
        {
            // covering a CPU player (the extra WR, TE or RB): stay on top of them
            target = this.mark.pos.add(vec2(0, 2));
            speed = 8.4 * diff;
        }
        else if (this.role == 'safety')
        {
            speed = 7 * diff;
            if (this.half && sign(w.pos.x) != this.half)
                target = vec2(this.half * 5, max(w.pos.y + 4, los + 10)); // the other half's safety stays home
            else if (defense.zone && w.pos.y > los + 8)
            {
                // the short zones hand off a deep receiver: the safety takes them man to man
                target = w.pos.add(vec2(0, 1.5));
                speed = 8.4 * diff;
            }
            else
                target = vec2(lerp(w.pos.x, 0, .35), max(w.pos.y + 6, los + 9));
        }
        else if (defense.zone)
        {
            // short zones: shadow the WR while they're in it, wait on its edge when they leave
            const [x0, x1] = this.role == 'under' ? [-5, 5] : defense.side < 0 ? [-FIELD_HALF + 1, -2] : [2, FIELD_HALF - 1];
            target = vec2(clamp(w.pos.x, x0, x1), clamp(w.pos.y + 1, los + 2, los + 8));
        }
        else if (this.role == 'under')
            target = w.pos.add(vec2(0, -1.4));
        else
            target = w.pos.add(vec2(sign(-w.pos.x) * .4, 1.5));

        // before the throw, coverage stays on its side of the line: it waits for you to come out
        if (gameState == 'live')
            target = vec2(target.x, max(target.y, los + .9));

        // tight coverage sprints to recover when beaten
        const offset = target.subtract(this.pos);
        if (tight && offset.length() > 4)
            speed *= 1.15;
        this.steer(offset.clampLength(1).scale(speed * min(1, offset.length())), 26 * defenseAccel());
    }
    render()
    {
        markerX(this.pos, BODY_R * .9, this.ink, .17, this.seed, this.dive ? PI / 4 : this.stun ? time * 12 : 0);
        markerText({safety: 'S', lb: 'LB'}[this.role] ?? 'CB', this.pos.add(vec2(0, 1.05)), .75, this.ink);
        if (this.stun)
            drawDizzy(this.pos.add(vec2(0, 1.6)));
    }
}

// the extra and slot WRs: CPU receivers who run a deep route, decoys with a corner of their own
class Decoy extends Body
{
    constructor(pos, ink)
    {
        super(pos, ink);
        const deep = ['go', 'post', 'corner'][randInt(3)];
        this.route = makeRoute(deep, pos); // the play call replaces it when you're the QB
        this.trailMax = 30;
    }
    think()
    {
        if (this.stunned()) return;
        if (gameState == 'run')
            return this.steer(vec2(), 12); // the play's elsewhere now: pull up
        runRoute(this, 9.5);
    }
    render()
    {
        markerCircle(this.pos, BODY_R, this.ink, .17, this.seed);
        markerText(this.num ?? '3', this.pos.add(vec2(0, -.05)), .8, this.ink);
        markerText(this.label ?? 'WR', this.pos.add(vec2(0, 1.15)), .85, this.ink);
    }
}

function allBodies() { return [...humans, ...decoys, ...linemen, ...rushers, ...coverage]; }

function separateBodies()
{
    const bodies = allBodies();
    for (let i = bodies.length; i--;)
    for (let j = i; j--;)
    {
        const a = bodies[i], b = bodies[j];
        if (!a.canCollideWith(b) || !b.canCollideWith(a)) continue;
        const offset = a.pos.subtract(b.pos);
        const d = offset.length(), minD = BODY_R * 2;
        if (d >= minD) continue;
        const push = (d > .001 ? offset.scale(1 / d) : vec2(1, 0)).scale((minD - d) / 2);
        a.pos = a.pos.add(push);
        b.pos = b.pos.subtract(push);
    }
}

///////////////////////////////////////////////////////////////////////////////
// plays

function setupPlay()
{
    engineObjectsDestroy();
    ball = undefined;
    const side = randSign();
    const qbPlayer = new Human(vec2(0, los - 4.5), qbIndex);
    const wrPlayer = new Human(vec2(side * 12, los - .9), 1 - qbIndex);
    humans = qbIndex == 0 ? [qbPlayer, wrPlayer] : [wrPlayer, qbPlayer];
    qbPlayer.hasBall = true;

    // team size fills the receiving spots first, in this order, then the line from the center out
    const spots =
    [
        {key: 'wr1', label: 'WR', pos: vec2(side * 12, los - .9)},
        {key: 'wr2', label: 'WR', pos: vec2(-side * 13, los - .9)},
        {key: 'te',  label: 'TE', pos: vec2(-side * 5.8, los - .9)},
        {key: 'rb',  label: 'RB', pos: vec2(-side * 2, los - 4.5)},
        {key: 'wr3', label: 'WR', pos: vec2(side * 7.5, los - 1.6)},
    ];
    formation = spots.slice(0, receiverCount);
    // the rest block, from the center out. Past 5 the line squeezes in to stay clear of the TE
    const lineCount = teamSize - 1 - receiverCount, gap = lineCount > 5 ? 1.35 : 1.9;
    linemen = [...Array(lineCount)].map((_, i) => new Lineman(vec2((i % 2 ? -1 : 1) * Math.ceil(i / 2) * gap, los - .9)));
    decoys = [];
    passTo = undefined;

    callDefense(side);
    lineUp(formation[0]);

    if (numPlayers == 1)
        humans[1].ai = {route: {name: '', points: [], next: 0}, called: false, jukeTime: 0, reaction: rand(.15, .4)};
    if (canDrawRoutes())
        callPlay();

    for (const b of allBodies())
        b.trail = [b.pos.copy()];
    gameState = 'presnap';
    stateTimer.set(.4);
}

function callDefense(side)
{
    // the defense matches the offense body for body: a man on every receiving spot (see coverForSpot),
    // and one more for the QB and each lineman. The call splits those between the rush and deep help,
    // so a heavier rush always leaves fewer X's back there. With no line to block, the lone rusher
    // counts a beat before coming, like the backyard game
    const spare = teamSize - formation.length;
    const rush = spare < 2 ? 1 : randInt(max(1, Math.ceil(spare / 2)), spare);
    const deep = spare - rush;
    defense = {zone: completions >= 2 && rand() < .5, side};

    rushers = [[0], [-1.5, 1.5], [-3, 0, 3], [-4.5, -1.5, 1.5, 4.5]][min(rush, 4) - 1].map(x => new Rusher(vec2(x, los + .9), linemen.length ? 0 : 1.5));
    for (let i = 0; i < rush - 4; i++) // past 4, linebackers blitz a beat late, alternating sides
        rushers.push(new Rusher(vec2((i % 2 ? side : -side) * (3 + (i >> 1) * 2.5), los + 5), 1.2, 'LB'));

    // man vs a human WR presses: the CB lines up in the receiver's face, so they have to juke free.
    // In zone the CB bails to its spot instead
    const cbDepth = defense.zone ? 5 : tightCoverage() ? 1.1 : 3.5;
    coverage = [new Cover(vec2(side * 12, los + cbDepth), 'cb')];
    if (deep >= 3)
        coverage.push(new Cover(vec2(-6, los + 12), 'safety', -1), new Cover(vec2(6, los + 12), 'safety', 1));
    else if (deep >= 1)
        coverage.push(new Cover(vec2(side * 5, los + 12), 'safety'));
    if (deep >= 2)
        coverage.push(new Cover(vec2(side * 10, los + 2), 'under'));
    for (let i = 0; i < deep - 3; i++) // a light offense leaves more X's to sit underneath
        coverage.push(new Cover(vec2((i % 2 ? side : -side) * (6 - i * 2), los + 2), 'under'));

    // every receiving spot has its own man: the corner on WR 1, plus one per CPU receiver
    coverage[0].spotKey = 'wr1';
    for (const f of formation.slice(1))
        coverage.push(coverForSpot(f));
}

// the extra and slot WRs bring a corner with them, the TE and RB a linebacker each
function coverForSpot(f)
{
    const c = new Cover(vec2(f.pos.x, los + (f.key == 'rb' ? 4.5 : 3.5)), f.key.startsWith('wr') ? 'cb' : 'lb');
    c.spotKey = f.key;
    return c;
}

// put the receiver at one of the formation's spots, and the CPU's receivers at the others:
// a WR spot runs a deep decoy route, the TE blocks on the line, the RB blocks beside the QB
function lineUp(spot)
{
    const w = wr();
    w.pos = spot.pos.copy();
    w.spotLabel = spot.label;
    for (const b of [...decoys, ...linemen.filter(l => l.spot)])
        b.destroy();
    linemen = linemen.filter(l => !l.spot);
    decoys = [];
    for (const f of formation)
    {
        if (f == spot) continue;
        const ink = SPOT_INK[f.key] ?? PLAYER_INK[1]; // you moved off WR 1: the CPU there wears the P2 color
        const b = f.key == 'te' ? new Lineman(f.pos.copy(), ink, 'TE') : f.key == 'rb' ? new Back(f.pos.copy(), ink) : new Decoy(f.pos.copy(), ink);
        b.spot = f;
        if (f.key == 'wr3') b.num = '4';
        (b instanceof Lineman ? linemen : decoys).push(b);
    }

    // each spot's defender: the one on yours plays you (man or zone), the rest stick with their CPU player.
    // In man they line up across from their player; a back in the backfield isn't pressed, it's covered
    // from linebacker depth
    for (const c of coverage)
    {
        if (!c.spotKey) continue;
        const f = formation.find(f => f.key == c.spotKey), yours = f == spot;
        c.mark = yours ? undefined : [...decoys, ...linemen].find(b => b.spot == f);
        if (!(yours && defense.zone))
            c.pos = vec2(f.pos.x, los + (f.key == 'rb' ? 4.5 : yours && tightCoverage() ? 1.1 : 3.5));
    }
    for (const b of allBodies())
        b.trail = [b.pos.copy()];
}

// 1P at WR with an extra WR, TE or RB: before the snap, tap a player (or press their number) to line up there
const canPickSpot = () => gameState == 'presnap' && numPlayers == 1 && isCPU(qbIndex) && formation.length > 1;

function pickSpot(tapPos)
{
    if (!canPickSpot()) return false;
    let spot = formation[[1, 2, 3, 4, 5].findIndex(n => keyWasPressed('Digit' + n) || keyWasPressed('Numpad' + n))];
    if (!spot && tapPos)
    {
        const p = screenToWorld(tapPos);
        spot = formation.find(f => f.pos.distance(p) < 2);
    }
    if (!spot) return false;
    if (wr().pos.distance(spot.pos) > .1)
    {
        lineUp(spot);
        sndJuke.play(spot.pos);
    }
    playerInput[0].pressed = false; // the tap picks a spot, it doesn't snap
    return true;
}

// who's at each formation spot: the WR (on WR 1 unless you moved them) or a CPU receiver
const occupant = (f) => [...decoys, ...linemen].find(b => b.spot == f) ?? wr();
const receivers = () => formation.map(occupant);

// 1P at QB with CPU receivers out there: before the snap, tap one (or press their number) to make
// them the target, so the play's throw goes to them. A tap in the open snaps
const canPickTarget = () => canDrawRoute() && formation.length > 1;
const showTarget = () => canPickTarget() || gameState == 'live' && numPlayers == 1 && !isCPU(qbIndex) && qb().hasBall && formation.length > 1;

function pickTarget(tapPos)
{
    if (!canPickTarget()) return false;
    const all = receivers();
    let b = all[[1, 2, 3, 4, 5].findIndex(n => keyWasPressed('Digit' + n) || keyWasPressed('Numpad' + n))];
    if (!b && tapPos)
    {
        const p = screenToWorld(tapPos);
        b = all.filter(b => b.pos.distance(p) < 2.5).sort((a, c) => a.pos.distance(p) - c.pos.distance(p))[0];
    }
    return b ? markTarget(b) : false;
}

function markTarget(b)
{
    passTo = b == wr() ? undefined : b;
    playerInput[0].pressed = false; // marking isn't snapping
    sndJuke.play(b.pos);
    addEffect('target!', b.pos.add(vec2(0, 1.8)), INK_GREEN, .9);
    return true;
}

// throwing to a CPU receiver: they trade places with the CPU WR, look and all, so the WR's catch and run
// code plays them. Their defenders trade marks with them too
function swapReceiver(b)
{
    const w = wr(), route = routeOf(w);
    [w.pos, b.pos] = [b.pos, w.pos];
    [w.vel, b.vel] = [b.vel, w.vel];
    [w.trail, b.trail] = [b.trail, w.trail];
    [w.ink, b.ink] = [b.ink, w.ink];
    [w.spot, b.spot] = [b.spot, w.spot];
    const wLook = [w.num ?? w.index + 1 + '', w.spotLabel ?? 'WR'];
    [w.num, w.spotLabel] = [b.num ?? (b instanceof Decoy ? '3' : ''), b.label ?? 'WR'];
    [b.num, b.label] = wLook;
    setRoute(w, b.route ?? {name: '', points: [], next: 0});
    b.route = route;
    for (const c of coverage)
    {
        if (c.mark == b) c.mark = w;
        else if (!c.mark && c.spotKey) c.mark = b; // the man on the WR stays on the WR
    }
}

function newDrive()
{
    los = START_LOS;
    down = 1;
    firstDown = START_LOS + 10;
    completions = 0;
    qbIndex = 0;
}

function resetGame()
{
    newDrive();
    stiffArmUsed = false;
    furthest = 0;
    longPass = longRec = 0;
    newRecords = new Set;
    plays = 0;
    effects = [];
    setupPlay();
}

function startGame(choice)
{
    titleChoice = choice;
    numPlayers = choice == 1 ? 2 : 1;
    resetGame();
}

function showTitle()
{
    numPlayers = 2; // title touches split by screen half
    resetGame();
    gameState = 'title';
}

// the title's team size: remembered, and the board behind the menu redraws to match
function changeTeamSize(step)
{
    const size = clamp(teamSize + step, MIN_TEAM, MAX_TEAM);
    if (size == teamSize) return;
    teamSize = saveData.teamSize = size;
    receiverCount = saveData.receiverCount = min(receiverCount, teamSize - 1); // a smaller team sheds receivers first
    writeSaveData('chalkTalk', saveData);
    sndJuke.play();
    showTitle();
}

// the title's receiver count: more receivers than the team holds grows the team to fit
function changeReceivers(step)
{
    const count = clamp(receiverCount + step, 1, MAX_RECEIVERS);
    if (count == receiverCount) return;
    receiverCount = saveData.receiverCount = count;
    teamSize = saveData.teamSize = max(teamSize, receiverCount + 1);
    writeSaveData('chalkTalk', saveData);
    sndJuke.play();
    showTitle();
}

// stiff arm: the tackler bounces off and hits the turf, the ball carrier keeps going
function stiffArm(carrier, d)
{
    stiffArmUsed = true;
    stiffArmAt = time;
    d.vel = d.pos.subtract(carrier.pos).normalize(10);
    d.stun = 1.4;
    d.dive = 0;
    d.jukedAt = time;
    sndPow.play(d.pos);
    addScreenShake(.2, .15);
    addEffect('STIFF ARM!', carrier.pos.add(vec2(0, 2)), INK_GREEN, 1.4, true);
}

function callForBall(receiver)
{
    // 1P with you at WR: the CPU QB throws on the next frame
    qb().ai.called = true;
    addEffect('HEY!', receiver.pos.add(vec2(0, 1.6)), receiver.ink, 1.2);
}

function snap()
{
    gameState = 'live';
    snapTime = time;
    ++plays;
    sndHut.play();
    addEffect('HUT!', qb().pos.add(vec2(0, 2)), PLAYER_INK[qbIndex], 2, true);
}

const throwOrigin = (thrower) => thrower.pos.add(vec2(.5, .3));

function passTarget(thrower)
{
    // a route you drew is the play call: the ball goes to the end of it, wherever the WR is now
    const target = wr(), drawn = target.ai?.route.drawn && target.ai.route.points;
    if (drawn?.length)
        return drawn[drawn.length - 1].copy();

    // lead the receiver: aim where they'll be when the ball lands
    const from = throwOrigin(thrower);
    let to = target.pos;
    for (let i = 3; i--;)
    {
        const flight = from.distance(to) / 22 + .25;
        to = target.pos.add(target.vel.scale(flight));
    }
    return to;
}

function throwBall(thrower)
{
    if (passTo && passTo != wr())
        swapReceiver(passTo);
    passTo = undefined;
    const from = throwOrigin(thrower);
    let to = passTarget(thrower);

    // pressure makes passes wobble off target
    const pressure = rushers.reduce((p, r) => max(p, 1 - r.pos.distance(thrower.pos) / 3.5), 0);
    to = to.add(randInCircle(.3 + 2.8 * pressure));
    if (to.distance(from) > 46)
        to = from.add(to.subtract(from).normalize(46));
    to.x = clamp(to.x, -FIELD_HALF + .5, FIELD_HALF - .5);

    // a rusher standing in the throwing lane may get a hand up on it: it pops loose
    // behind them. The closer they are to the middle of the lane, the likelier the tip
    const lane = to.subtract(from).normalize();
    let batter;
    for (const r of rushers)
    {
        if (r.stun || !r.active) continue;
        const rel = r.pos.subtract(from), along = rel.dot(lane), off = abs(rel.cross(lane));
        if (along < .3 || along > 3.5 || off > 1.3) continue;
        if (rand() < .6 * (1 - off / 1.3))
        {
            batter = r;
            to = r.pos.add(lane.scale(rand(1, 2.5))).add(randInCircle(1.5));
            to.x = clamp(to.x, -FIELD_HALF + .5, FIELD_HALF - .5);
            sndPow.play(r.pos);
            addEffect('SWAT!', r.pos.add(vec2(0, 1.8)), INK, 1.4, true);
            break;
        }
    }

    const dist = from.distance(to);
    ball = batter ?
        {from, to, batted: true, thrownAt: time, duration: .6, peak: 1.4, wobble: true} : // a tip floats off end over end
        {from, to, thrownAt: time, duration: dist / 22 + .25, peak: dist * .16 + 1, wobble: pressure > .2};
    thrower.hasBall = false;
    gameState = 'air';
    sndThrow.play(thrower.pos);
    if (pressure > .4)
        addEffect('under pressure!', thrower.pos.add(vec2(0, 1.8)), INK, .8);
}

function ballPos(t)
{
    const p = clamp(t / ball.duration, 0, 1);
    return {ground: ball.from.lerp(ball.to, p), height: 4 * ball.peak * p * (1 - p)};
}

function resolvePass()
{
    if (ball.batted)
        return ball.swatted ? failedPlay('BATTED AWAY!', 'swatted in coverage') : failedPlay('BATTED DOWN!', 'tipped at the line');
    const spot = ball.to;
    const w = wr();
    const dr = w.stun ? 1e9 : w.pos.distance(spot);
    let defender, dd = 1e9;
    for (const d of [...coverage, ...rushers])
    {
        const dist = d.pos.distance(spot);
        if (!d.stun && dist < dd) { dd = dist; defender = d; }
    }

    // a defender there first usually just swats it away. A pick takes being right on the spot,
    // clearly ahead of the receiver (further still against tight coverage), and a bit of luck
    if (dd < 1.6 && dd < dr)
    {
        if (dd < .8 && dd < dr - (tightCoverage() ? 1 : .5) && rand() < .4)
            return endDrive('INTERCEPTED!', 'picked off by the ' + (defender.role == 'safety' ? 'safety' : 'defense'), sndPick, defender.pos);
        return swatAway(defender);
    }
    // tight coverage contests the catch: a defender on the receiver's hip can knock it loose
    if (tightCoverage() && dr < 1.7 && dd < 1.5 && rand() < .25 + .6 * (1.5 - dd) / 1.5)
        return failedPlay('BROKEN UP!', 'contested at the catch');
    if (dr < 1.7)
    {
        // catch: now it's a run, the play ends wherever the catcher goes down
        catchY = w.pos.y;
        catchTime = time;
        w.hasBall = true;
        ball = undefined;
        gameState = 'run';
        ++completions;
        sndCatch.play(w.pos);
        addEffect('CATCH!', w.pos.add(vec2(0, 2)), INK_GREEN, 1.8, true);
        return;
    }
    failedPlay('INCOMPLETE', 'nobody home');
}

// the ball carrier goes down: the line jumps to that spot and the roles swap
function endRun(how)
{
    const w = wr();
    w.hasBall = false;
    const gained = round(w.pos.y - los), after = round(w.pos.y - catchY);
    los = w.pos.y;
    furthest = max(furthest, round(los - START_LOS));
    if (!isCPU(qbIndex)) longPass = max(longPass, gained);
    if (!isCPU(w.index)) longRec = max(longRec, gained);
    saveRecords();
    const converted = firstDown - los < .5;
    if (converted)
    {
        down = 1;
        firstDown = los + 10;
        stiffArmUsed = false;
        addEffect('FIRST DOWN!', w.pos.add(vec2(0, 3.4)), INK_FIRST, 1.4);
    }
    else if (++down > 4)
        return endDrive('TURNOVER ON DOWNS', 'stopped ' + toGo() + ' YDS short on 4th down');
    const takes = playerName(w.index) + (numPlayers == 1 && w.index == 0 ? ' take' : ' takes') + ' over at QB';
    const yac = after > 0 ? after + ' after the catch · ' : '';
    showResult(how + '  ' + (gained >= 0 ? '+' : '') + gained + ' YDS', yac + (converted ? 'FIRST DOWN! ' : downAndDistance() + ' — ') + takes, INK_GREEN);
    qbIndex = w.index;
}

function tackle()
{
    const w = wr();
    sndPow.play(w.pos);
    addScreenShake(.3, .2);
    addEffect('TACKLE!', w.pos.add(vec2(0, 2)), INK, 1.6, true);
    endRun('TACKLED');
}

// the ball pops off the defender's hand and flutters down nearby before the play is called
function swatAway(defender)
{
    const from = ball.to;
    const to = defender.pos.add(randInCircle(2.5, 1.2));
    to.x = clamp(to.x, -FIELD_HALF + .5, FIELD_HALF - .5);
    ball = {from, to, batted: true, swatted: true, thrownAt: time, duration: .5, peak: 1.2, wobble: true};
    sndPow.play(defender.pos);
    addEffect('SWAT!', defender.pos.add(vec2(0, 1.8)), INK, 1.4, true);
}

function sack(rusher)
{
    const q = qb();
    const lost = round(los - q.pos.y);
    los = max(q.pos.y, 1); // can't be pushed off the back of the board
    sndSack.play(q.pos);
    addScreenShake(.6, .35);
    addEffect('SACK!', q.pos.add(vec2(0, 2)), INK, 2.2, true);
    q.hasBall = false;
    ball = undefined;
    failedPlay('SACKED!  -' + lost + ' YDS', 'protect the QB');
}

function failedPlay(text, sub)
{
    if (++down > 4)
        return endDrive('TURNOVER ON DOWNS', sub);
    if (!text.startsWith('SACK'))
        sndNope.play();
    showResult(text, sub + ' — ' + downAndDistance(), INK);
}

const toGo = () => max(1, round(firstDown - los));
const downAndDistance = () => ordinal(min(down, 4)) + ' & ' + toGo();

function endDrive(text, sub, sound = sndNope, pos)
{
    sound.play(pos);
    if (pos) addEffect(text, pos.add(vec2(0, 2)), INK, 1.8, true);
    gameState = 'over';
    stateTimer.set(1);
    saveRecords();
    resultInfo = {text, sub, color: INK};
}

function saveRecords()
{
    // saved as soon as they're beaten, so a record survives closing the tab mid-drive
    const run = {best: furthest, longPass, longRec};
    let changed = false;
    for (const key in run)
        if (run[key] > saveData[key])
        {
            saveData[key] = run[key];
            newRecords.add(key);
            changed = true;
        }
    if (changed)
        writeSaveData('chalkTalk', saveData);
}

function showResult(text, sub, color)
{
    gameState = 'result';
    stateTimer.set(1.7);
    resultInfo = {text, sub, color};
}

function ordinal(n) { return n + (['th', 'st', 'nd', 'rd'][n] || 'th'); }

///////////////////////////////////////////////////////////////////////////////
// effects (comic bursts and marker words)

function addEffect(text, pos, color, size, burst = false)
{
    effects.push({text, pos, color, size, burst, t: 0, seed: rand(1000)});
}

function renderEffects()
{
    effects = effects.filter(e => (e.t += timeDelta) < .9);
    for (const e of effects)
    {
        const pop = min(1, e.t * 12) * (1 + .15 * Math.sin(e.t * 20) * max(0, 1 - e.t * 3));
        const alpha = min(1, (.9 - e.t) * 5);
        const p = e.pos.add(vec2(0, e.t * .8));
        if (e.burst)
            markerBurst(p, e.size * (e.text.length * .3 + .6) * pop, e.size * 1.1 * pop, e.color, e.seed, alpha);
        markerText(e.text, p, e.size * pop, e.color, alpha);
    }
}

///////////////////////////////////////////////////////////////////////////////
// marker drawing — hand-drawn strokes straight onto the 2D canvas

let boil = 0; // the strokes re-jitter a few times a second, like a hand-drawn animation

function inkHash(n)
{
    n = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return n - Math.floor(n);
}

function ctxBegin(color, widthWorld, alpha = 1)
{
    const ctx = mainContext;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = ctx.fillStyle = color;
    ctx.lineWidth = max(1, widthWorld * cameraScale);
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.globalAlpha = alpha * .92;
    return ctx;
}

function strokeWorld(points, color, width, alpha = 1, dash)
{
    const ctx = ctxBegin(color, width, alpha);
    if (dash) ctx.setLineDash(dash.map(d => d * cameraScale));
    ctx.beginPath();
    points.forEach((p, i) =>
    {
        const s = worldToScreen(p);
        i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y);
    });
    ctx.stroke();
    ctx.restore();
}

function jitter(p, seed, amount)
{
    return p.add(vec2(inkHash(seed + boil * 1.31) - .5, inkHash(seed * 1.7 + boil * 2.03) - .5).scale(amount));
}

function markerLine(a, b, color, width, seed, alpha = 1, wobble = .1)
{
    const segs = max(2, min(12, a.distance(b) / 2 | 0));
    const points = [];
    for (let i = 0; i <= segs; ++i)
        points.push(jitter(a.lerp(b, i / segs), seed + i * 3.7, wobble));
    strokeWorld(points, color, width, alpha);
}

function markerCircle(pos, r, color, width, seed, alpha = 1)
{
    // a marker circle never quite closes: it overshoots its start a little
    const n = 18, a0 = inkHash(seed) * PI * 2, sweep = PI * 2 + .5;
    const points = [];
    for (let i = 0; i <= n; ++i)
    {
        const a = a0 + sweep * i / n;
        const rr = r * (1 + (inkHash(seed + i * .37 + boil) - .5) * .12 + i / n * .06);
        points.push(pos.add(vec2(Math.cos(a), Math.sin(a)).scale(rr)));
    }
    strokeWorld(points, color, width, alpha);
}

function markerX(pos, r, color, width, seed, angle = 0)
{
    const arm = (a) => vec2(Math.cos(a), Math.sin(a)).scale(r);
    for (let k = 0; k < 2; ++k)
    {
        const a = angle + PI / 4 + k * PI / 2;
        markerLine(jitter(pos.add(arm(a)), seed + k, .12), jitter(pos.subtract(arm(a)), seed + k + 5, .12), color, width, seed + k * 9, 1, .06);
    }
}

function markerArrowHead(tip, dir, size, color, width, alpha = 1)
{
    const back = dir.normalize().scale(-size);
    strokeWorld([tip.add(back.rotate(.5)), tip, tip.add(back.rotate(-.5))], color, width, alpha);
}

function markerBurst(pos, w, h, color, seed, alpha)
{
    // jagged comic "POW" star
    const n = 14, points = [];
    for (let i = 0; i <= n; ++i)
    {
        const a = i / n * PI * 2, r = i % 2 ? .62 : 1 + inkHash(seed + i) * .2;
        points.push(pos.add(vec2(Math.cos(a) * w * .5 * r, Math.sin(a) * h * .5 * r)));
    }
    strokeWorld(points, color, .12, alpha);
}

function markerText(text, pos, size, color, alpha = 1, angle = 0)
{
    const ctx = ctxBegin(color, 0, alpha);
    const s = worldToScreen(pos);
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);
    ctx.font = `${size * cameraScale}px ${MARKER_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    ctx.restore();
}

function screenText(text, x, y, size, color, align = 'left', alpha = 1)
{
    const ctx = ctxBegin(color, 0, alpha);
    ctx.font = `${size}px ${MARKER_FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
}

function drawFootball(pos, size, angle)
{
    const ctx = ctxBegin('#7a4520', .1);
    const s = worldToScreen(pos), px = size * cameraScale;
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, px * .5, px * .3, 0, 0, PI * 2);
    ctx.fillStyle = '#a0592b';
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = BOARD;
    ctx.lineWidth = max(1, px * .06);
    ctx.beginPath();
    ctx.moveTo(-px * .18, 0); ctx.lineTo(px * .18, 0);
    for (let i = -2; i <= 2; ++i)
    {
        ctx.moveTo(i * px * .07, -px * .07);
        ctx.lineTo(i * px * .07, px * .07);
    }
    ctx.stroke();
    ctx.restore();
}

function drawDizzy(pos)
{
    for (let i = 3; i--;)
    {
        const a = time * 6 + i * PI * 2 / 3;
        markerText('*', pos.add(vec2(Math.cos(a) * .7, Math.sin(a) * .25)), .8, INK_GREEN);
    }
}

///////////////////////////////////////////////////////////////////////////////
// the board

function drawBoard()
{
    const ctx = ctxBegin(BOARD, 0);
    ctx.globalAlpha = 1;
    ctx.fillRect(0, 0, mainCanvasSize.x, mainCanvasSize.y);
    ctx.restore();

    const halfH = mainCanvasSize.y / cameraScale / 2 + 2;
    const y0 = cameraPos.y - halfH, y1 = cameraPos.y + halfH;

    // ghosts of half-erased old plays, one sketch per 30-yard chunk
    for (let c = Math.floor(y0 / 30); c <= Math.floor(y1 / 30); ++c)
    {
        const base = vec2((inkHash(c) - .5) * 20, c * 30 + 15);
        for (let i = 0; i < 6; ++i)
        {
            const p = base.add(vec2((inkHash(c + i * 1.3) - .5) * 14, (inkHash(c * 2.1 + i) - .5) * 10));
            if (i % 2) markerCircle(p, .9, INK, .2, c + i, .045);
            else markerX(p, .9, 'rgba(32,32,40,.05)', .2, c + i);
        }
        const route = [];
        for (let i = 0; i < 5; ++i)
            route.push(base.add(vec2(i * 2.5 - 6, Math.sin(i + c) * 3)));
        strokeWorld(route, INK, .3, .045);
    }

    // sidelines, yard lines, hashes and numbers
    for (const x of [-FIELD_HALF, FIELD_HALF])
        markerLine(vec2(x, y0), vec2(x, y1), INK_FIELD, .25, x, 1, .15);
    for (let y = Math.ceil(y0 / 5) * 5; y < y1; y += 5)
    {
        markerLine(vec2(-FIELD_HALF, y), vec2(FIELD_HALF, y), INK_FIELD, y % 10 ? .08 : .14, y, 1, .12);
        if (y % 10 == 0)
            for (const x of [-12, 12])
                markerText('' + y, vec2(x, y), 2, INK_FIELD, 1, x < 0 ? -PI / 2 : PI / 2);
    }
    for (let y = Math.ceil(y0); y < y1; ++y)
    for (const x of [-4, 4])
        if (y % 5)
            markerLine(vec2(x - .4, y), vec2(x + .4, y), INK_FIELD, .08, y + x, 1, .04);
    // line of scrimmage
    strokeWorld([vec2(-FIELD_HALF, los), vec2(FIELD_HALF, los)], PLAYER_INK[0], .12, .5, [.8, .5]);
    markerText('LOS', vec2(-FIELD_HALF - 1, los), .7, PLAYER_INK[0], .7);
    // first-down line
    strokeWorld([vec2(-FIELD_HALF, firstDown), vec2(FIELD_HALF, firstDown)], INK_FIRST, .16, .7);
    markerText('1ST', vec2(-FIELD_HALF - 1, firstDown), .7, INK_FIRST, .8);

    // every body's route so far, like arrows on a play diagram
    for (const b of allBodies())
    {
        const t = b.trail;
        if (t.length < 2) continue;
        const pts = [...t, b.pos];
        const human = b instanceof Human;
        strokeWorld(pts, b.ink, human ? .13 : .08, human ? .55 : .3);
        if (b.vel.length() > 2)
            markerArrowHead(b.pos.add(b.vel.normalize(BODY_R + .4)), b.vel, .6, b.ink, human ? .13 : .08, human ? .7 : .4);
    }

    // the CPU receiver's called route, dashed ahead of them so the QB knows where they're going
    const cpu = humans[1];
    if (cpu?.ai && !cpu.isQB() && (gameState == 'presnap' || gameState == 'live'))
    {
        const route = cpu.ai.route, ahead = [cpu.pos, ...route.points.slice(route.next)];
        if (ahead.length > 1)
        {
            strokeWorld(ahead, cpu.ink, .1, .4, [.5, .4]);
            const n = ahead.length;
            markerArrowHead(ahead[n - 1], ahead[n - 1].subtract(ahead[n - 2]), .7, cpu.ink, .1, .5);
        }
        for (const i of route.jukes ?? [])
            if (i >= route.next)
                markerText('juke!', route.points[i].add(vec2(0, .9)), .6, cpu.ink, .8);
        if (canDrawRoute() && !route.points.length)
            markerText('draw my route!', cpu.pos.add(vec2(0, -1.6)), .75, cpu.ink, .6 + .4 * Math.sin(time * 6));
    }

    // the other CPU receivers' routes too, when you're the QB throwing to them
    if (cpu?.ai && !cpu.isQB() && (gameState == 'presnap' || gameState == 'live'))
        for (const b of receivers())
        {
            if (b == cpu || !b.route) continue;
            const ahead = [b.pos, ...b.route.points.slice(b.route.next)];
            if (ahead.length < 2) continue;
            strokeWorld(ahead, b.ink, .1, .4, [.5, .4]);
            const n = ahead.length;
            markerArrowHead(ahead[n - 1], ahead[n - 1].subtract(ahead[n - 2]), .7, b.ink, .1, .5);
            for (const i of b.route.jukes ?? [])
                if (i >= b.route.next)
                    markerText('juke!', b.route.points[i].add(vec2(0, .9)), .6, b.ink, .8);
        }

    // who you're throwing to: ringed, and before the snap every receiver numbered
    if (showTarget())
        receivers().forEach((b, i) =>
        {
            const picked = b == (passTo ?? wr());
            if (picked)
                markerCircle(b.pos, BODY_R * 1.6, INK_GREEN, .12, 5, .9);
            if (canPickTarget())
                markerText(i + 1 + '', b.pos.add(vec2(1.3, -1)), .65, INK_GREEN, picked ? .9 : .5);
        });
}

function drawBall()
{
    if (!ball) return;
    // dashed pass arc + where it'll come down
    const arc = [];
    for (let i = 0; i <= 16; ++i)
    {
        const b = ballPos(ball.duration * i / 16);
        arc.push(b.ground.add(vec2(0, b.height * .25)));
    }
    strokeWorld(arc, '#a0592b', .09, .5, [.4, .4]);
    markerCircle(ball.to, 1.6, INK_GREEN, .09, 7, .6);
    markerX(ball.to, .35, INK_GREEN, .09, 3);

    const b = ballPos(time - ball.thrownAt);
    const dir = ball.to.subtract(ball.from);
    const ctx = ctxBegin('rgba(0,0,0,.15)', 0);
    const s = worldToScreen(b.ground);
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, cameraScale * .45, cameraScale * .22, 0, 0, PI * 2);
    ctx.fill();
    ctx.restore();
    const spiral = ball.wobble ? Math.sin(time * 25) * .4 : 0;
    drawFootball(b.ground.add(vec2(0, b.height * .25)), .9 + b.height * .05, -Math.atan2(dir.y, dir.x) + spiral);
}

function drawHUD()
{
    const W = mainCanvasSize.x, H = mainCanvasSize.y;
    const s = min(W, H) / 22, pad = s * .8;
    const yards = round(los - START_LOS);
    screenText('YARDS ' + yards, pad, pad + s * .4, s * 1.2, INK);
    screenText('HIGH SCORE ' + max(saveData.best, furthest), pad, pad + s * 1.6, s * .75, INK, 'left', .6);
    screenText(downAndDistance(), pad, pad + s * 2.6, s * .85, INK);

    for (let i = 2; i--;)
    {
        const role = i == qbIndex ? 'QB' : 'WR';
        screenText(playerName(i) + ' ' + role, W - pad, pad + s * .4 + i * s * 1.2, s, PLAYER_INK[i], 'right');
    }
    screenText('STIFF ARM' + (stiffArmUsed ? ' (used)' : ' ' + STIFF_ARM_CHANCE * 100 + '%'), W - pad, pad + s * 2.8, s * .7, INK_GREEN, 'right', stiffArmUsed ? .45 : .85);
    screenText(teamSize + ' ON ' + teamSize, W - pad, pad + s * 3.7, s * .65, INK, 'right', .55);

    const midX = W / 2;
    const blink = .6 + .4 * Math.sin(time * 6);
    if (gameState == 'presnap')
    {
        const qbI = qbIndex, who = snapper();
        screenText(downAndDistance(), midX, H * .16, s * 1.6, INK, 'center');
        const how = usedTouch ? 'tap' : numPlayers == 1 ? 'SPACE' : PLAYER_KEYS[who];
        const prompt = numPlayers == 2 || qbI == 0 ?
            (canDrawRoute() ? playCall.name + '  ·  ' : '') + playerName(qbI) + ' (QB): ' + how + ' to call HUT!' :
            'YOU (WR): ' + how + ' to snap, ' + how + ' again to call for the ball';
        screenText(prompt, midX, H * .16 + s * 1.6, s * .9, PLAYER_INK[who], 'center', blink);
        if (canDrawRoute() && formation.length > 1)
        {
            const pick = usedTouch ? 'tap' : 'click (or press 1-' + formation.length + ')';
            screenText('drag from a player to redraw their route', midX, H * .16 + s * 2.7, s * .7, INK_GREEN, 'center', .8);
            screenText(pick + ' a receiver to throw to them', midX, H * .16 + s * 3.6, s * .7, INK_GREEN, 'center', .8);
        }
        if (canPickSpot())
        {
            // number every spot you could line up at, ringing the ones the CPU has now
            const keys = usedTouch ? 'tap' : 'click or press 1-' + formation.length + ' on';
            screenText(keys + ' a player to line up there', midX, H * .16 + s * 2.7, s * .75, INK_GREEN, 'center', .8);
            formation.forEach((f, i) =>
            {
                const yours = wr().pos.distance(f.pos) < .1;
                if (!yours)
                    markerCircle(f.pos, BODY_R * 1.5, INK_GREEN, .08, i * 7, .5 + .3 * Math.sin(time * 6));
                markerText(i + 1 + '', f.pos.add(vec2(0, -1.3)), .7, INK_GREEN, yours ? .5 : .9);
            });
        }
        if (plays == 0 && !humans[1].ai?.route.drawn) // the help card gets out of the way of a route being drawn
        {
            const lines = numPlayers == 1 ?
            [
                usedTouch ? 'drag anywhere to run, quick tap = action' : 'WASD / ARROWS or drag the mouse to run, SPACE / click = action',
                ...usedTouch ? ['WR runs upfield: drag to steer, let go = action'] : [],
                usedTouch ? 'QB: drag to draw the CPU\'s route, tap to snap' : 'QB: drag the mouse to draw the CPU\'s route',
                'zigzag in the route = a juke',
                'WR: juke the X\'s off you, call for the ball before the sack',
                'catch it, run, then the catcher plays QB',
            ] :
            usedTouch ?
            [
                'each player owns half the screen',
                'drag to run, quick tap = action',
                'WR runs upfield: drag to steer, let go = action',
            ] :
            [
                'P1: WASD to run, SPACE = action',
                'P2: ARROWS to run, ENTER = action',
            ];
            if (numPlayers == 2)
                lines.push('QB action = throw (it leads your WR)');
            lines.push(usedTouch ? 'flick back and forth = juke' : 'tap opposite directions fast = juke');
            lines.push('after the catch: action = jump a tackle');
            lines.push('don\'t get sacked, don\'t get picked');
            if (!usedTouch)
                lines.push('M = back to the menu');
            const top = H * .16 + s * 2.8;
            const card = ctxBegin(BOARD, 0);
            card.globalAlpha = .9;
            card.fillRect(midX - s * 9, top - s * .8, s * 18, lines.length * s * 1.05 + s * .6);
            card.restore();
            const lineInk = (i) => numPlayers == 1 ? (i ? INK : PLAYER_INK[0]) : i < 2 ? PLAYER_INK[i] : INK;
            lines.forEach((l, i) => screenText(l, midX, top + i * s * 1.05, s * .8, lineInk(i), 'center', .9));
        }
    }
    if ((gameState == 'result' || gameState == 'over') && resultInfo)
    {
        const big = gameState == 'over';
        screenText(resultInfo.text, midX, H * .16, s * (big ? 2.2 : 1.8), resultInfo.color, 'center');
        screenText(resultInfo.sub, midX, H * .16 + s * 1.8, s * .9, INK, 'center', .75);
        if (big)
        {
            const isNew = (key) => newRecords.has(key) ? ' NEW!' : '';
            screenText('drive: ' + furthest + ' yards   ·   ' + completions + ' catches', midX, H * .16 + s * 3.2, s, INK, 'center');
            const records = 'HIGH SCORE ' + saveData.best + isNew('best') +
                '   ·   LONGEST PASS ' + saveData.longPass + isNew('longPass') +
                '   ·   LONGEST REC ' + saveData.longRec + isNew('longRec');
            screenText(records, midX, H * .16 + s * 4.4, s * .75, newRecords.size ? INK_GREEN : INK, 'center', .8);
            if (stateTimer.elapsed())
            {
                const again = usedTouch ? 'tap left: run it back   ·   tap right: menu' : 'SPACE / ENTER: run it back   ·   M / ESC: menu';
                screenText(again, midX, H * .16 + s * 5.8, s * .9, INK_GREEN, 'center', blink);
            }
        }
    }

    if (usedTouch && numPlayers == 2 && gameState != 'title')
    {
        const ctx = ctxBegin(INK, 0, .25);
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(midX, H * .15);
        ctx.lineTo(midX, H);
        ctx.stroke();
        ctx.restore();
        screenText('P1 side', pad, H - pad, s * .7, PLAYER_INK[0], 'left', .5);
        screenText('P2 side', W - pad, H - pad, s * .7, PLAYER_INK[1], 'right', .5);
    }
}

function drawTitle()
{
    const W = mainCanvasSize.x, H = mainCanvasSize.y;
    const s = min(W, H) / 22, midX = W / 2;

    const card = ctxBegin(BOARD, 0);
    card.globalAlpha = .85;
    card.fillRect(0, 0, W, H);
    card.restore();

    screenText('PAPER FOOTBALL', midX, H * .22, s * 3.2, INK, 'center');

    // two hand-drawn option boxes, side by side so a tap on either half picks one
    const {boxW, boxH, boxY, rowY, recY} = titleLayout();
    const options = [['1 PLAYER', 'you + a CPU teammate'], ['2 PLAYERS', 'P1 WASD  ·  P2 ARROWS']];
    options.forEach(([label, sub], i) =>
    {
        const x = midX + (i ? 1 : -1) * (boxW / 2 + s * .6);
        const picked = titleChoice == i, ink = PLAYER_INK[i];
        markerBox(x, boxY, boxW, boxH, ink, picked, s, i * 9);
        screenText(label, x, boxY - s * .55, s * 1.5, ink, 'center', picked ? 1 : .55);
        screenText(sub, x, boxY + s * 1.05, s * .75, ink, 'center', picked ? .85 : .45);
    });

    // team size and receivers: - and + boxes either side, a tap on either half of a row steps it
    const stepper = (y, value, label, lo, hi, seed) =>
    {
        screenText(value, midX, y - s * .35, s * 1.4, INK, 'center');
        screenText(label, midX, y + s * .75, s * .65, INK, 'center', .6);
        [['-', lo], ['+', hi]].forEach(([mark, live], i) =>
        {
            const x = midX + (i ? 1 : -1) * s * 6.5;
            markerBox(x, y, s * 2, s * 2, INK, live, s, seed + i * 7);
            screenText(mark, x, y, s * 1.4, INK, 'center', live ? 1 : .3);
        });
    };
    stepper(rowY, teamSize + ' ON ' + teamSize, 'players per team', teamSize > MIN_TEAM, teamSize < MAX_TEAM, 20);
    stepper(recY, receiverCount + (receiverCount == 1 ? ' RECEIVER' : ' RECEIVERS'), 'besides the QB', receiverCount > 1, receiverCount < MAX_RECEIVERS, 40);

    const how = usedTouch ? 'tap a box to play   ·   tap - / + to change a setting' : '1 / 2 or ← → to pick   ·   ↑ ↓ team size   ·   Q / R receivers   ·   SPACE / ENTER to play';
    screenText(how, midX, recY + s * 2.2, s * .85, INK_GREEN, 'center', .6 + .4 * Math.sin(time * 6));
    screenText('HIGH SCORE ' + saveData.best + ' YDS   ·   LONGEST PASS ' + saveData.longPass + '   ·   LONGEST REC ' + saveData.longRec, midX, H - s * 1.5, s * .8, INK, 'center', .6);
}

// where the title's mode boxes, team size and receiver rows sit, shared by drawing and tapping
function titleLayout()
{
    const W = mainCanvasSize.x, H = mainCanvasSize.y, s = min(W, H) / 22;
    const boxH = s * 4.2, boxY = H * .44, rowY = boxY + boxH / 2 + s * 2;
    return {s, boxW: min(W * .4, s * 13), boxH, boxY, rowY, recY: rowY + s * 2.8};
}

// a hand-drawn screen-space box around (x, y), bolder when picked
function markerBox(x, y, w, h, ink, picked, s, seed)
{
    const ctx = ctxBegin(ink, 0, picked ? 1 : .45);
    ctx.lineWidth = picked ? s * .22 : s * .12;
    ctx.beginPath();
    const wob = (k) => (inkHash(k + boil + seed) - .5) * s * .25;
    const l = x - w / 2, r = x + w / 2, t = y - h / 2, b = y + h / 2;
    ctx.moveTo(l + wob(1), t + wob(2));
    ctx.lineTo(r + wob(3), t + wob(4));
    ctx.lineTo(r + wob(5), b + wob(6));
    ctx.lineTo(l + wob(7), b + wob(8));
    ctx.lineTo(l + wob(9), t + wob(10) + s * .3); // a marker box never quite closes
    ctx.stroke();
    ctx.restore();
}

// where across the screen (0 to 1) a mouse click or tap landed this frame, -1 if none
function clickedX()
{
    const x = tappedX; // mouse clicks land here too, on release like a tap
    tappedX = -1;
    return x;
}

///////////////////////////////////////////////////////////////////////////////
// engine callbacks

function gameInit()
{
    showTitle();
    cameraPos = vec2(0, camY);
}

function gameUpdate()
{
    readInputs();
    const anyPress = playerInput[0].pressed || playerInput[1].pressed;
    const tapX = clickedX(), half = tapX < 0 ? -1 : tapX < .5 ? 0 : 1;
    const tapPos = tappedPos;
    tappedPos = undefined;
    drawRouteUpdate();

    if (gameState == 'title')
    {
        if (['ArrowLeft', 'KeyA'].some(k => keyWasPressed(k))) titleChoice = 0;
        if (['ArrowRight', 'KeyD'].some(k => keyWasPressed(k))) titleChoice = 1;
        const {s, rowY, recY} = titleLayout();
        const onRow = (y) => tapPos && abs(tapPos.y - y) < s * 1.4;
        const digit = [1, 2].findIndex(n => keyWasPressed('Digit' + n) || keyWasPressed('Numpad' + n));
        if (['ArrowUp', 'KeyW', 'Equal', 'NumpadAdd'].some(k => keyWasPressed(k))) changeTeamSize(1);
        else if (['ArrowDown', 'KeyS', 'Minus', 'NumpadSubtract'].some(k => keyWasPressed(k))) changeTeamSize(-1);
        else if (keyWasPressed('KeyR')) changeReceivers(1);
        else if (keyWasPressed('KeyQ')) changeReceivers(-1);
        else if (onRow(rowY)) changeTeamSize(half ? 1 : -1);
        else if (onRow(recY)) changeReceivers(half ? 1 : -1);
        else if (digit >= 0) startGame(digit);
        else if (tapX >= 0) startGame(min(1, tapX * 2 | 0));
        else if (anyPress) startGame(titleChoice);
    }
    else if (keyWasPressed('KeyM'))
        showTitle(); // quit to the menu from anywhere, mid-play included
    else if (gameState == 'presnap' && stateTimer.elapsed() && pickSpot(tapPos)) {}
    else if (gameState == 'presnap' && stateTimer.elapsed() && pickTarget(tapPos)) {}
    else if (gameState == 'presnap' && stateTimer.elapsed() && playerInput[snapper()].pressed)
    {
        playerInput[snapper()].pressed = false; // the snap press isn't also a throw or a call for the ball
        snap();
    }
    else if (gameState == 'result' && stateTimer.elapsed())
        setupPlay();
    else if (gameState == 'over' && stateTimer.elapsed())
    {
        if (keyWasPressed('Escape') || half == 1) showTitle();
        else if (anyPress || half == 0) resetGame();
    }

    // camera eases to the line, with the LOS low on screen, and drifts up to keep deep routes in view
    let targetY = los + 6;
    if (gameState == 'live')
        targetY = max(targetY, min(wr().pos.y - 8, qb().pos.y + 9));
    if (gameState == 'air')
        targetY = max(targetY, ball.to.y - 7);
    if (gameState == 'run')
        targetY = max(targetY, wr().pos.y + 2); // keep open field ahead of the runner in view
    cameraPos = cameraPos.add(vec2(-cameraPos.x, targetY - cameraPos.y).scale(min(1, timeDelta * 4)));
}

function gameUpdatePost()
{
    setCameraScale(min(mainCanvasSize.x / VIEW_W, mainCanvasSize.y / VIEW_H));
    boil = Math.floor(time * 7);
    if (!isLive()) return;

    separateBodies();

    if (gameState == 'live' && qb().hasBall)
    {
        const r = rushers.find(r => !r.stun && r.pos.distance(qb().pos) < BODY_R * 2 + .1);
        if (r) sack(r);
    }
    else if (gameState == 'air' && time - ball.thrownAt >= ball.duration)
        resolvePass();
    else if (gameState == 'run')
    {
        const w = wr(), tucked = time - catchTime > TACKLE_GRACE && time - stiffArmAt > .4;
        const d = tucked && !w.airborne() && defenders().find(d => !d.stun && d.pos.distance(w.pos) < BODY_R * 2 + .1);
        if (d && !stiffArmUsed && rand() < STIFF_ARM_CHANCE) // every receiver has a shot at one stiff arm per first down
            stiffArm(w, d);
        else if (d) tackle();
        else if (tucked && abs(w.pos.x) > FIELD_HALF - BODY_R - .05)
        {
            addEffect('OUT!', w.pos.add(vec2(0, 2)), INK, 1.4, true);
            endRun('OUT OF BOUNDS');
        }
    }
}

function gameRender()
{
    drawBoard();
}

function gameRenderPost()
{
    drawBall();
    renderEffects();
    if (gameState == 'title')
        drawTitle();
    else
        drawHUD();
}

engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost);
