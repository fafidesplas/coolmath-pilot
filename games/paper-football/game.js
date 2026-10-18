/*
    Chalk Talk — endless two-player football drawn on a coach's whiteboard
    - Everyone lines up at the line of scrimmage (LOS). The QB calls "HUT!"
      with their action key, then it's live
    - QB: scramble behind the line and don't get sacked (any X touching you
      while you hold the ball). Action = throw; the pass leads your receiver
    - Receiver (WR): shake the cornerbacks. They jam you when they touch you,
      so shove them off (action, beat-em-up style) and get open
    - Catch it and the LOS jumps to the catch spot, the roles swap (the catcher
      is the new QB) and everyone resets. Sacks and incompletions burn a down;
      4 downs without a catch, or one interception, ends the drive
    - Endless: the field and its yard numbers keep going. Each catch makes the
      defense a bit faster and adds bodies (4th rusher, bracket CB, blitzer)
    - Title screen picks 1 player (you + a CPU teammate in the P2 slot: as QB it
      scrambles, throws when you're open and throws it away when you're not, as WR it runs a random route drawn
      dashed on the board and shoves its way free) or 2 players
    - P1 = WASD + Space/F, P2 = arrows + Enter/Shift (solo: either set). Touch:
      each player owns half the screen (solo: all of it), drag to run, quick
      tap = action
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

// marker inks
const BOARD = '#f7f7f2';
const INK = '#202028';
const INK_GREEN = '#139157';
const INK_FIELD = 'rgba(40,70,120,.22)';
const PLAYER_INK = ['#1f5fd1', '#d42a2a'];
const PLAYER_NAME = ['P1', 'P2'];
const PLAYER_KEYS = ['SPACE', 'ENTER'];
const MARKER_FONT = '"Marker Felt", "Chalkboard SE", "Comic Sans MS", "Segoe Print", cursive';

// sounds
const sndHut      = new SoundGenerator({frequency:620, release:.14, pitchJump:240, pitchJumpTime:.05, volume:.5});
const sndThrow    = new SoundGenerator({frequency:300, release:.15, slide:.6, noise:.3, volume:.5});
const sndCatch    = new SoundGenerator({frequency:900, release:.12, pitchJump:600, pitchJumpTime:.05});
const sndPow      = new SoundGenerator({frequency:220, release:.18, slide:-.4, noise:.1});
const sndWhiff    = new SoundGenerator({frequency:500, release:.08, slide:-1, noise:.5, volume:.3});
const sndSack     = new SoundGenerator({frequency:90, sustain:.15, release:.35, noise:5, bitCrush:.5, sustainVolume:.5, delay:.05});
const sndNope     = new SoundGenerator({frequency:200, release:.3, slide:-.5, volume:.6});
const sndPick     = new SoundGenerator({frequency:420, release:.6, slide:-.6, repeatTime:.1, volume:.6});

///////////////////////////////////////////////////////////////////////////////
// game state

let gameState = 'title';   // title, presnap, live, air, result, over
let stateTimer = new Timer;
let numPlayers = 2;        // 1 = P1 plus a CPU teammate in the P2 slot
let titleChoice = 0;       // highlighted title option: 0 = 1 player, 1 = 2 players
let snapTime = 0;
let los = START_LOS;       // line of scrimmage (y)
let down = 1;
let completions = 0;
let qbIndex = 0;           // which player is QB this play
let furthest = 0;          // yards of the best LOS reached this drive
let plays = 0;
let resultInfo;            // {text, sub, color} for the result banner
let saveData = readSaveData('chalkTalk', {best:0});
let ball;                  // pass in the air
let camY = START_LOS + 7;

let humans = [], linemen = [], rushers = [], coverage = [];
let effects = [];

const difficulty = () => min(1 + completions * .045, 1.6);
const qb = () => humans[qbIndex];
const wr = () => humans[1 - qbIndex];
const isLive = () => gameState == 'live' || gameState == 'air';
const isCPU = (i) => numPlayers == 1 && i == 1;
const tightCoverage = () => !isCPU(wr().index); // a human WR draws the full defense, the CPU WR the looser one
const playerName = (i) => numPlayers == 1 ? ['YOU', 'CPU'][i] : PLAYER_NAME[i];
const snapper = () => numPlayers == 1 ? 0 : qbIndex; // in 1P the human always calls the snap

///////////////////////////////////////////////////////////////////////////////
// input: keys + one touch finger per player

const playerInput = [{dir:vec2(), pressed:false}, {dir:vec2(), pressed:false}];
const fingers = new Map;            // touch id -> {player, start, cur, t0}
const fingerTaps = [false, false];
let tappedHalf = -1;                // screen half of the last quick tap (menus)
let usedTouch = false;

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
        {
            // 2P: each player owns half the screen, 1P: any finger steers
            const half = p.x < mainCanvas.width/2 ? 0 : 1;
            fingers.set(t.identifier, {half, player: numPlayers == 1 ? 0 : half, start:p, cur:p, t0:time});
        }
        else
        {
            const f = fingers.get(t.identifier);
            if (!f) continue;
            f.cur = p;
            if (e.type == 'touchend' || e.type == 'touchcancel')
            {
                if (time - f.t0 < .25 && f.cur.distance(f.start) < 25)
                {
                    fingerTaps[f.player] = true;
                    tappedHalf = f.half;
                }
                fingers.delete(t.identifier);
            }
        }
    }
}
for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'])
    document.addEventListener(type, onTouch, {passive:false});

function stickRadius() { return min(mainCanvasSize.x, mainCanvasSize.y) * .09; }

function readInputs()
{
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
        let dir = keyDirs[i];
        for (const f of fingers.values())
        {
            if (f.player != i) continue;
            const d = f.cur.subtract(f.start).scale(1 / stickRadius());
            if (d.length() > .15)
                dir = vec2(d.x, -d.y).clampLength(1);
        }
        playerInput[i].dir = dir.length() > 1 ? dir.normalize() : dir;
        playerInput[i].pressed = keyActs[i] || fingerTaps[i];
        fingerTaps[i] = false;
    }
}

///////////////////////////////////////////////////////////////////////////////
// CPU teammate (1P): fills the P2 slot by producing the same input a player would

// route waypoints in yards from the WR's start: x > 0 is toward their sideline, y is upfield
const ROUTES =
{
    go:     [[0, 4], [.5, 28]],
    slant:  [[0, 3], [-9, 12], [-14, 20]],
    out:    [[0, 9], [8, 9.5]],
    curl:   [[0, 11], [-1.5, 8.5]],
    post:   [[0, 8], [-9, 22]],
    corner: [[0, 8], [6, 18]],
    dig:    [[0, 10], [-14, 10.5]],
};

function makeRoute(start)
{
    const names = Object.keys(ROUTES), name = names[randInt(names.length)];
    const side = sign(start.x) || 1;
    const points = ROUTES[name].map(([x, y]) =>
        vec2(clamp(start.x + x * side, -FIELD_HALF + 1, FIELD_HALF - 1), start.y + y));
    return {name, points, next: 0};
}

// 1P with you at QB: before the snap, drag on the board (mouse or finger) to draw the CPU's route
const canDrawRoute = () => gameState == 'presnap' && isCPU(1) && !humans[1].isQB();
const ROUTE_STEP = 1.2, ROUTE_MAX_LEN = 70;
let routePen;   // what's drawing right now: 'mouse' or a touch id

function drawRouteUpdate()
{
    if (!canDrawRoute())
        return routePen = undefined;

    // a finger that's dragged past tap distance becomes the pen
    let penPos;
    if (mouseWasPressed(0))
        startDrawnRoute('mouse');
    for (const [id, f] of fingers)
        if (routePen != id && f.cur.distance(f.start) > 25)
            startDrawnRoute(id, screenToWorld(f.start));
    if (routePen == 'mouse')
        penPos = mouseIsDown(0) ? mousePos : undefined;
    else if (routePen != undefined)
        penPos = fingers.get(routePen) && screenToWorld(fingers.get(routePen).cur);
    if (!penPos)
        return routePen = undefined;

    const route = humans[1].ai.route, points = route.points, last = points[points.length - 1];
    const p = vec2(clamp(penPos.x, -FIELD_HALF + 1, FIELD_HALF - 1), penPos.y);
    if (!last)
        points.push(p);
    else if (p.distance(last) >= ROUTE_STEP && route.length < ROUTE_MAX_LEN)
    {
        // resample at even steps so a fast swipe still leaves waypoints to follow
        const steps = min(p.distance(last) / ROUTE_STEP | 0, (ROUTE_MAX_LEN - route.length) / ROUTE_STEP | 0);
        const dir = p.subtract(last).normalize(ROUTE_STEP);
        for (let i = 1; i <= steps; ++i)
            points.push(last.add(dir.scale(i)));
        route.length += steps * ROUTE_STEP;
    }
}

function startDrawnRoute(pen, from)
{
    routePen = pen;
    humans[1].ai.route = {name: 'your route', points: from ? [vec2(clamp(from.x, -FIELD_HALF + 1, FIELD_HALF - 1), from.y)] : [], next: 0, length: 0, drawn: true};
}

function nearestCover(pos, countDazed = false)
{
    // countDazed: a dazed defender still counts, as far away as the ground they'd make up while recovering
    let best, bestD = 1e9;
    for (const d of coverage)
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
    const playTime = time - snapTime;

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

        // read the receiver: throw once they (and where the ball would land) are clear of coverage
        // against tight coverage, also check nobody can run to the spot while the ball's in the air
        const spot = passTarget(h), tight = tightCoverage();
        const flight = throwOrigin(h).distance(spot) / 22 + .25;
        const cushion = tight ? max(2.6, 1.6 + 9 * difficulty() * (flight - .3)) : 2.6;
        const open = playTime > (tight ? 1.2 : .7) && nearestCover(wr().pos, tight).dist > (tight ? 2.6 + 1.5 * flight : 2.6) && nearestCover(spot, tight).dist > cushion;
        ai.openTime = open ? ai.openTime + timeDelta : 0;
        const pressure = rushers.some(r => !r.stun && r.pos.distance(h.pos) < 1.9);
        out.pressed = ai.openTime > .2 || (pressure && playTime > 1.2) || playTime > 5;
        out.throwAway = tight && !open; // covered: sail it out of bounds rather than force it
        return out;
    }

    if (gameState == 'air')
    {
        out.dir = ball.to.subtract(h.pos).clampLength(1);
        return out;
    }

    // run the route, then freelance away from the nearest defender
    const route = ai.route, target = route.points[route.next];
    if (target)
    {
        if (h.pos.distance(target) < 1.2)
            ++route.next;
        out.dir = target.subtract(h.pos).normalize();
    }
    else
    {
        const {defender} = nearestCover(h.pos);
        let dir = defender ? h.pos.subtract(defender.pos).normalize() : vec2();
        dir = dir.add(vec2(-h.pos.x / FIELD_HALF * .8, .3)); // keep off the sideline, drift upfield
        out.dir = dir.length() > .2 ? dir.clampLength(1) : vec2();
    }

    // shove a defender off after a short reaction
    const crowded = nearestCover(h.pos).dist < 1.7;
    ai.shoveTime = crowded ? ai.shoveTime + timeDelta : 0;
    if (ai.shoveTime > ai.reaction)
    {
        out.pressed = true;
        ai.shoveTime = 0;
        ai.reaction = rand(.15, .4);
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
        // stunned bodies slide to a stop. Against the CPU WR the brake stays on every frame,
        // which is what keeps that defense slow off the mark; tight coverage gets full acceleration
        if (this.stun <= 0 && tightCoverage()) return false;
        this.steer(vec2(), 25);
        return this.stun > 0;
    }
    canCollideWith(other) { return true; }
}

class Human extends Body
{
    constructor(pos, index)
    {
        super(pos, PLAYER_INK[index]);
        this.index = index;
        this.hasBall = false;
        this.shoveCooldown = 0;
        this.jammed = false;
        this.trailMax = 45;
    }
    isQB() { return this.index == qbIndex; }
    think()
    {
        const input = playerInput[this.index];
        this.shoveCooldown -= timeDelta;
        if (this.stunned()) return;

        let speed = this.isQB() ? 8.5 : 10;
        this.jammed = !this.isQB() && coverage.some(d => !d.stun && d.pos.distance(this.pos) < BODY_R * 2 + .15);
        if (this.jammed) speed *= tightCoverage() ? .35 : .45;
        this.steer(input.dir.scale(speed), 60);

        // the QB can't cross the line while holding the ball
        if (this.hasBall && this.pos.y > los - BODY_R)
        {
            this.pos.y = los - BODY_R;
            this.vel.y = min(this.vel.y, 0);
        }

        if (input.pressed)
        {
            if (this.hasBall && gameState == 'live')
                throwBall(this, input.throwAway);
            else if (!this.hasBall && !(gameState == 'air' && tightCoverage())) // no push-offs with the ball in the air
                this.shove();
        }
    }
    shove()
    {
        if (this.shoveCooldown > 0) return;
        const tight = tightCoverage();
        this.shoveCooldown = tight ? 1.3 : .8;
        const reach = tight ? 2 : 2.5;
        let hit = 0;
        for (const d of [...rushers, ...coverage])
        {
            const offset = d.pos.subtract(this.pos);
            if (offset.length() > reach) continue;
            const push = offset.length() > .01 ? offset.normalize() : vec2(0, 1);
            d.vel = push.scale(tight ? 9 : 15);
            // tight coverage: each shove this play wears off quicker, they brace for the next one
            d.stun = tight ? [.6, .35, .2][min(d.shoved = (d.shoved || 0) + 1, 3) - 1] : 1.1;
            d.spin = 0;
            ++hit;
        }
        const fxPos = this.pos.add(this.vel.clampLength(1));
        if (hit)
        {
            sndPow.play(this.pos);
            addScreenShake(.25, .2);
            addEffect(['POW!', 'BAM!', 'WHAM!', 'OOF!'][randInt(4)], fxPos.add(vec2(0, 1.4)), INK_GREEN, 1.5, true);
        }
        else
        {
            sndWhiff.play(this.pos);
            addEffect('swish', fxPos.add(vec2(0, 1.2)), this.ink, .9);
        }
        this.shoveFx = .18;
    }
    render()
    {
        const p = this.pos;
        if (this.shoveFx > 0)
        {
            this.shoveFx -= timeDelta;
            markerCircle(p, 2.5, this.ink, .08, this.seed + 9, .35);
        }
        markerCircle(p, BODY_R, this.ink, .17, this.seed);
        markerText(this.index + 1 + '', p.add(vec2(0, -.05)), .8, this.ink);
        markerText(this.isQB() ? 'QB' : 'WR', p.add(vec2(0, 1.15)), .85, this.ink);
        if (this.hasBall)
            drawFootball(p.add(vec2(.75, .2)), .9, 0);
        if (this.jammed && isLive())
            markerText('!!', p.add(vec2(-1, .9)), .8, INK);
    }
}

class Lineman extends Body
{
    constructor(pos)
    {
        super(pos, INK);
        this.home = pos.copy();
        this.trailMax = 10;
    }
    think()
    {
        if (this.stunned()) return;
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
        markerCircle(this.pos, BODY_R, INK, .14, this.seed);
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
        if (this.stunned()) return;
        if ((this.delay -= timeDelta) > 0)
            return this.steer(vec2(), 20);

        const diff = difficulty();
        const target = gameState == 'air' ? ball.to : qb().pos;
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
        this.steer(dir.scale(speed), 35);
    }
    canCollideWith(other) { return !(this.spin && other instanceof Lineman); }
    render()
    {
        const angle = this.spin ? this.spin * 20 : this.stun ? time * 12 : 0;
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
    constructor(pos, role)
    {
        super(pos, INK);
        this.role = role;
        this.react = rand(.2, .35);
    }
    think()
    {
        if (this.stunned()) return;
        const diff = difficulty();
        const w = wr(), tight = tightCoverage();
        let target, speed = (tight ? 9.2 : 8.4) * diff;
        if (gameState == 'air' && time - ball.thrownAt > this.react)
        {
            // ball hawk: break on the landing spot
            target = ball.to;
            speed = 9 * diff;
        }
        else if (this.role == 'safety')
        {
            target = vec2(lerp(w.pos.x, 0, .35), max(w.pos.y + 6, los + 9));
            speed = 7 * diff;
        }
        else if (this.role == 'under')
            target = w.pos.add(vec2(0, -1.4));
        else
            target = w.pos.add(vec2(sign(-w.pos.x) * .4, 1.5));

        // tight coverage sprints to recover when beaten
        const offset = target.subtract(this.pos);
        if (tight && offset.length() > 4)
            speed *= 1.15;
        this.steer(offset.clampLength(1).scale(speed * min(1, offset.length())), 26);
    }
    render()
    {
        markerX(this.pos, BODY_R * .9, INK, .17, this.seed, this.stun ? time * 12 : 0);
        markerText(this.role == 'safety' ? 'S' : 'CB', this.pos.add(vec2(0, 1.05)), .75, INK);
        if (this.stun)
            drawDizzy(this.pos.add(vec2(0, 1.6)));
    }
}

function allBodies() { return [...humans, ...linemen, ...rushers, ...coverage]; }

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

    linemen = [-4, -2, 0, 2, 4].map(x => new Lineman(vec2(x * .95, los - .9)));

    const rushXs = completions >= 2 ? [-4.5, -1.5, 1.5, 4.5] : [-3, 0, 3];
    rushers = rushXs.map(x => new Rusher(vec2(x, los + .9)));
    if (completions >= 6)
        rushers.push(new Rusher(vec2(-side * 3, los + 5), 1.2, 'LB'));

    // tight coverage presses: the CB lines up in the receiver's face, so they have to shove free
    coverage = [new Cover(vec2(side * 12, los + (tightCoverage() ? 1.1 : 3.5)), 'cb'), new Cover(vec2(side * 5, los + 12), 'safety')];
    if (completions >= 4)
        coverage.push(new Cover(vec2(side * 10, los + 2), 'under'));

    if (numPlayers == 1)
        humans[1].ai = {route: makeRoute(humans[1].pos), openTime: 0, shoveTime: 0, reaction: rand(.15, .4)};

    for (const b of allBodies())
        b.trail = [b.pos.copy()];
    gameState = 'presnap';
    stateTimer.set(.4);
}

function resetGame()
{
    los = START_LOS;
    down = 1;
    completions = 0;
    qbIndex = 0;
    furthest = 0;
    plays = 0;
    effects = [];
    setupPlay();
}

function startGame(players)
{
    numPlayers = players;
    titleChoice = players - 1;
    resetGame();
}

function showTitle()
{
    numPlayers = 2; // title touches split by screen half
    resetGame();
    gameState = 'title';
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
    // lead the receiver: aim where they'll be when the ball lands
    const target = wr(), from = throwOrigin(thrower);
    let to = target.pos;
    for (let i = 3; i--;)
    {
        const flight = from.distance(to) / 22 + .25;
        to = target.pos.add(target.vel.scale(flight));
    }
    return to;
}

function throwBall(thrower, away = false)
{
    const from = throwOrigin(thrower);
    let to = passTarget(thrower);

    // pressure makes passes wobble off target
    const pressure = rushers.reduce((p, r) => max(p, 1 - r.pos.distance(thrower.pos) / 3.5), 0);
    to = to.add(randInCircle(.3 + 2.8 * pressure));
    if (to.distance(from) > 46)
        to = from.add(to.subtract(from).normalize(46));
    to.x = clamp(to.x, -FIELD_HALF + .5, FIELD_HALF - .5);
    if (away)
        to = vec2((sign(to.x) || 1) * (FIELD_HALF + 3), from.y + 6); // over the sideline, out of everyone's reach

    const dist = from.distance(to);
    ball = {from, to, away, thrownAt: time, duration: dist / 22 + .25, peak: dist * .16 + 1, wobble: pressure > .2};
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
    if (ball.away)
        return failedPlay('THROWN AWAY', 'nobody open');
    const spot = ball.to;
    const w = wr();
    const dr = w.stun ? 1e9 : w.pos.distance(spot);
    let defender, dd = 1e9;
    for (const d of [...coverage, ...rushers])
    {
        const dist = d.pos.distance(spot);
        if (!d.stun && dist < dd) { dd = dist; defender = d; }
    }

    // tight coverage: a defender has to clearly beat the receiver to it for a pick, a tie is a breakup
    if (dd < 1 && dd < dr - (tightCoverage() ? .5 : 0))
        return endDrive('INTERCEPTED!', 'picked off by the ' + (defender.role == 'safety' ? 'safety' : 'defense'), sndPick, defender.pos);
    if (dd < 1.6 && dd < dr)
        return failedPlay('BROKEN UP!', 'pass defended');
    // tight coverage contests the catch: a defender on the receiver's hip can knock it loose
    if (tightCoverage() && dr < 1.7 && dd < 1.5 && rand() < .25 + .6 * (1.5 - dd) / 1.5)
        return failedPlay('BROKEN UP!', 'contested at the catch');
    if (dr < 1.7)
    {
        // catch: the line jumps to the catch spot and the roles swap
        const gained = round(w.pos.y - los);
        los = w.pos.y;
        furthest = max(furthest, round(los - START_LOS));
        down = 1;
        ++completions;
        sndCatch.play(w.pos);
        addEffect('CATCH!', w.pos.add(vec2(0, 2)), INK_GREEN, 1.8, true);
        showResult('CATCH!  ' + (gained >= 0 ? '+' : '') + gained + ' YDS', playerName(w.index) + (numPlayers == 1 && w.index == 0 ? ' take' : ' takes') + ' over at QB', INK_GREEN);
        qbIndex = w.index;
        return;
    }
    failedPlay('INCOMPLETE', 'nobody home');
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
    showResult(text, sub + ' — ' + ordinal(down) + ' down', INK);
}

function endDrive(text, sub, sound = sndNope, pos)
{
    sound.play(pos);
    if (pos) addEffect(text, pos.add(vec2(0, 2)), INK, 1.8, true);
    gameState = 'over';
    stateTimer.set(1);
    if (furthest > saveData.best)
    {
        saveData.best = furthest;
        writeSaveData('chalkTalk', saveData);
    }
    resultInfo = {text, sub, color: INK};
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
        if (gameState == 'presnap' && !route.drawn)
            markerText(route.name, route.points[0].add(vec2(sign(cpu.pos.x) * 2.2, 0)), .8, cpu.ink, .7);
        if (canDrawRoute() && !route.drawn)
            markerText('draw my route!', cpu.pos.add(vec2(0, -1.6)), .75, cpu.ink, .6 + .4 * Math.sin(time * 6));
    }
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
    screenText('BEST ' + max(saveData.best, furthest), pad, pad + s * 1.6, s * .75, INK, 'left', .6);
    screenText(ordinal(min(down, 4)) + ' DOWN', pad, pad + s * 2.6, s * .85, INK);

    for (let i = 2; i--;)
    {
        const role = i == qbIndex ? 'QB' : 'WR';
        screenText(playerName(i) + ' ' + role, W - pad, pad + s * .4 + i * s * 1.2, s, PLAYER_INK[i], 'right');
    }

    const midX = W / 2;
    const blink = .6 + .4 * Math.sin(time * 6);
    if (gameState == 'presnap')
    {
        const qbI = qbIndex, who = snapper();
        screenText(ordinal(down) + ' & GO', midX, H * .16, s * 1.6, INK, 'center');
        const how = usedTouch ? 'tap' : numPlayers == 1 ? 'SPACE' : PLAYER_KEYS[who];
        const prompt = numPlayers == 2 || qbI == 0 ?
            playerName(qbI) + ' (QB): ' + how + ' to call HUT!' :
            'YOU (WR): ' + how + ' to snap. CPU throws when you\'re open';
        screenText(prompt, midX, H * .16 + s * 1.6, s * .9, PLAYER_INK[who], 'center', blink);
        if (plays == 0 && !humans[1].ai?.route.drawn) // the card gets out of the way of a route being drawn
        {
            const lines = numPlayers == 1 ?
            [
                usedTouch ? 'drag anywhere to run, quick tap = action' : 'WASD / ARROWS to run, SPACE / ENTER = action',
                usedTouch ? 'QB: drag to draw the CPU\'s route, tap to snap' : 'QB: drag the mouse to draw the CPU\'s route',
                'WR: shove the X\'s off you and get open',
                'catch it and you swap: catcher plays QB',
            ] :
            usedTouch ?
            [
                'each player owns half the screen',
                'drag to run, quick tap = action',
            ] :
            [
                'P1: WASD to run, SPACE = action',
                'P2: ARROWS to run, ENTER = action',
            ];
            if (numPlayers == 2)
                lines.push('QB action = throw (it leads your WR)', 'WR action = shove the X\'s off you');
            lines.push('don\'t get sacked, don\'t get picked');
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
            screenText('drive: ' + furthest + ' yards   ·   ' + completions + ' catches', midX, H * .16 + s * 3.2, s, INK, 'center');
            if (stateTimer.elapsed())
            {
                const again = usedTouch ? 'tap left: run it back   ·   tap right: menu' : 'SPACE / ENTER: run it back   ·   ESC: menu';
                screenText(again, midX, H * .16 + s * 4.6, s * .9, INK_GREEN, 'center', blink);
            }
        }
    }

    // touch sticks
    if (usedTouch && gameState != 'title')
    {
        for (const f of fingers.values())
        {
            const c = ctxBegin(PLAYER_INK[f.player], 0, .5);
            c.lineWidth = 3;
            c.beginPath();
            c.arc(f.start.x, f.start.y, stickRadius(), 0, PI * 2);
            c.stroke();
            const knob = f.cur.subtract(f.start).clampLength(stickRadius()).add(f.start);
            c.beginPath();
            c.arc(knob.x, knob.y, stickRadius() * .35, 0, PI * 2);
            c.fill();
            c.restore();
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

    screenText('CHALK TALK', midX, H * .22, s * 3.2, INK, 'center');
    screenText('endless football, drawn on the whiteboard', midX, H * .22 + s * 2.4, s * .95, INK, 'center', .7);

    // two hand-drawn option boxes, side by side so a tap on either half picks one
    const options = [['1 PLAYER', 'you + a CPU teammate'], ['2 PLAYERS', 'P1 WASD  ·  P2 ARROWS']];
    const boxW = min(W * .4, s * 13), boxH = s * 4.2, boxY = H * .55;
    options.forEach(([label, sub], i) =>
    {
        const x = midX + (i ? 1 : -1) * (boxW / 2 + s * .6);
        const picked = titleChoice == i, ink = PLAYER_INK[i];
        const ctx = ctxBegin(ink, 0, picked ? 1 : .45);
        ctx.lineWidth = picked ? s * .22 : s * .12;
        ctx.beginPath();
        const wob = (k) => (inkHash(k + boil + i * 9) - .5) * s * .25;
        const l = x - boxW / 2, r = x + boxW / 2, t = boxY - boxH / 2, b = boxY + boxH / 2;
        ctx.moveTo(l + wob(1), t + wob(2));
        ctx.lineTo(r + wob(3), t + wob(4));
        ctx.lineTo(r + wob(5), b + wob(6));
        ctx.lineTo(l + wob(7), b + wob(8));
        ctx.lineTo(l + wob(9), t + wob(10) + s * .3); // a marker box never quite closes
        ctx.stroke();
        ctx.restore();
        screenText(label, x, boxY - s * .55, s * 1.5, ink, 'center', picked ? 1 : .55);
        screenText(sub, x, boxY + s * 1.05, s * .75, ink, 'center', picked ? .85 : .45);
    });

    const how = usedTouch ? 'tap a box to play' : '1 / 2 or ← → to pick   ·   SPACE / ENTER to play';
    screenText(how, midX, boxY + boxH / 2 + s * 1.6, s * .85, INK_GREEN, 'center', .6 + .4 * Math.sin(time * 6));
    screenText('BEST DRIVE ' + saveData.best + ' YDS', midX, H - s * 1.5, s * .8, INK, 'center', .6);
}

// a mouse click or tap on the left or right half of the screen, -1 if none
function clickedHalf()
{
    let half = tappedHalf;
    tappedHalf = -1;
    if (mouseWasPressed(0))
        half = mousePosScreen.x < mainCanvasSize.x / 2 ? 0 : 1;
    return half;
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
    const half = clickedHalf();
    drawRouteUpdate();

    if (gameState == 'title')
    {
        if (['ArrowLeft', 'ArrowUp', 'KeyA', 'KeyW'].some(k => keyWasPressed(k))) titleChoice = 0;
        if (['ArrowRight', 'ArrowDown', 'KeyD', 'KeyS'].some(k => keyWasPressed(k))) titleChoice = 1;
        if (keyWasPressed('Digit1') || keyWasPressed('Numpad1')) startGame(1);
        else if (keyWasPressed('Digit2') || keyWasPressed('Numpad2')) startGame(2);
        else if (half >= 0) startGame(half + 1);
        else if (anyPress) startGame(titleChoice + 1);
    }
    else if (gameState == 'presnap' && stateTimer.elapsed() && playerInput[snapper()].pressed)
    {
        playerInput[snapper()].pressed = false; // the snap press isn't also a throw or shove
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
