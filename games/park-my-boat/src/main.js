'use strict';
// Park My Boat: steer one boat into its slip, stop, drop anchor. Prototype.

const VIEW_SIZE = vec2(40, 22.5);
const VIEW_CENTER = VIEW_SIZE.scale(.5);
const PLAY_TOP = 21;                  // HUD bar above this line
const RIGHT_PIER_X = 36.5;
const SAVE_KEY = 'cm_park-my-boat_save';
const SUBSTEPS = 2;
const MOORED_COLORS = [C_TEAL, C_SUNNY, C_NAVY, C_CORAL, C_CREAM];

const QUIPS =
{
    dock:   ['BONK!', 'Oops!', 'My paint!', 'Insurance!', 'Ow.', 'That was the dock.'],
    duck:   ['QUACK!', 'QUACK?!', 'Rude.', 'quack.', 'Watch it!'],
    buoy:   ['BONG!', 'DONG!', 'BOING!'],
    boat:   ['HEY!', 'My boat!', 'Watch it!', 'I just waxed that!', 'Sorry!'],
    log:    ['THUNK.', 'Log!', 'Bonk.'],
    fast:   ['SKRRRT!', 'WHOA!', 'Hold on!'],
    fail:   ["That's not parking, that's littering.", 'Close! In a different zip code.', 'The boat is parked. Just not here.', 'Bold. Wrong, but bold.'],
    star3:  ['Textbook!', 'The ducks are impressed.', 'Not a single wobble.'],
    star2:  ['Solid parking.', 'Nobody saw that wobble.'],
    star1:  ['Technically parked.', 'It counts. Barely.'],
};

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
    if (saveData.sound) SOUNDS[name].play(pos, volume, pitch);
}

function track(...args) { console.log('[GA]', ...args); }   // GameAnalytics stand-in for the prototype

// ---------------------------------------------------------------------------
// state

let gameScreen = 'title', screenTime = 0, levelIndex = 0, isPaused = false;
let player, bodies = [], rects = [], posts = [], currents = [], slip;
let anchor, judge, result;
let attempts = 0, damages = 0, ducksOffended = 0, levelTime = 0;
let popups = [], drops = [], wakes = [];
let shakeAmt = 0, steerHeld = false, motorTimer = 0, wakeTimer = 0;
let buttons = [], hoverId;

function pick(list) { return list[randInt(list.length)]; }

function setScreen(s)
{
    gameScreen = s;
    screenTime = 0;
    isPaused = false;
}

// ---------------------------------------------------------------------------
// level setup

function makeBoat(key, pos, angle, kind, color)
{
    const t = BOATS[key];
    const b = new Body(pos, angle, makeCircles(t.L, t.W), t.mass, { dragF:t.dragF, dragS:t.dragS, dragA:t.dragA, kind });
    b.type = t;
    b.color = color || t.color;
    b.hurtT = 0;
    bodies.push(b);
    return b;
}

function loadLevel(i)
{
    levelIndex = i;
    const L = LEVELS[i], t = BOATS[L.boat];
    bodies = []; rects = []; posts = []; currents = L.currents || [];
    popups.length = drops.length = wakes.length = 0;
    anchor = judge = result = undefined;
    attempts = damages = ducksOffended = levelTime = 0;
    steerHeld = false;

    // shore all around, pier along the top
    rects.push({ x0:-5, y0:-5, x1:.4, y1:30 }, { x0:39.6, y0:-5, x1:45, y1:30 }, { x0:-5, y0:-5, x1:45, y1:.4 });
    rects.push({ x0:0, y0:PIER_TOP, x1:40, y1:PLAY_TOP + 2, dock:true });
    if (L.rightPier)
        rects.push({ x0:RIGHT_PIER_X, y0:.4, x1:40, y1:PIER_TOP, dock:true });

    // the slip and its finger docks
    const s = L.slip, pad = s.pad || [1.4, 1];
    const len = t.L + pad[0], wid = t.W + pad[1];
    const vertical = Math.abs(Math.sin(s.a)) > .5;
    const x = s.x ?? RIGHT_PIER_X - len/2, y = s.y ?? PIER_TOP - len/2;
    slip = { pos:vec2(x, y), a:s.a, len, wid, w: vertical ? wid : len, h: vertical ? len : wid };
    if (s.fingers != 'none')
    {
        const ft = .5;
        if (vertical)
        {
            const yo = y - Math.sign(Math.sin(s.a)) * len/2;
            rects.push({ x0:x-wid/2-ft, y0:y-len/2, x1:x-wid/2, y1:y+len/2, dock:true });
            rects.push({ x0:x+wid/2, y0:y-len/2, x1:x+wid/2+ft, y1:y+len/2, dock:true });
            posts.push({ x:x-wid/2-ft/2, y:yo, r:.32 }, { x:x+wid/2+ft/2, y:yo, r:.32 });
        }
        else
        {
            const xo = x - Math.sign(Math.cos(s.a)) * len/2;
            rects.push({ x0:x-len/2, y0:y-wid/2-ft, x1:x+len/2, y1:y-wid/2, dock:true });
            rects.push({ x0:x-len/2, y0:y+wid/2, x1:x+len/2, y1:y+wid/2+ft, dock:true });
            posts.push({ x:xo, y:y-wid/2-ft/2, r:.32 }, { x:xo, y:y+wid/2+ft/2, r:.32 });
        }
    }

    player = makeBoat(L.boat, vec2(L.start.x, L.start.y), L.start.a, 'player');

    (L.moored || []).forEach((m, k) =>
    {
        const b = makeBoat(m.boat, vec2(m.x, m.y), m.a, 'moored', MOORED_COLORS[(k + i) % MOORED_COLORS.length]);
        b.home = { pos:vec2(m.x, m.y), angle:m.a, k:3, kA:3 };
    });
    for (const m of L.drifters || [])
        makeBoat(m.boat, vec2(m.x, m.y), m.a, 'drifter', C_TEAL);
    for (const [bx, by] of L.buoys || [])
    {
        const b = new Body(vec2(bx, by), 0, [{ x:0, y:0, r:.45 }], .7, { kind:'buoy', restitution:.8, dragA:.6 });
        b.home = { pos:vec2(bx, by), angle:0, k:6, kA:0 };
        bodies.push(b);
    }
    for (const [lx, ly, la] of L.logs || [])
        bodies.push(new Body(vec2(lx, ly), la, makeCircles(2.4, .55), .9, { kind:'log', dragF:.4, dragS:1.2, dragA:1.2 }));
    for (const f of L.ducks || [])
    {
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
            bodies.push(d);
            leader = d;
        }
    }

    setScreen('playing');
    track('progression', 'Start', levelId());
}

function levelId() { return `world01:level${String(levelIndex + 1).padStart(2, '0')}`; }

// ---------------------------------------------------------------------------
// effects

function popup(text, pos, color=C_CREAM, size=.9)
{
    popups.push({ text, pos:pos.copy(), t:0, color, size });
    if (popups.length > 12) popups.shift();
}

function splash(pos, n, speed=4)
{
    for (let i = 0; i < n; i++)
    {
        const a = rand(PI*2), v = rand(.3, 1)*speed;
        drops.push({ pos:pos.copy(), vel:vec2(Math.cos(a)*v, Math.sin(a)*v), t:0, life:rand(.3, .6), size:rand(.15, .35), color: i%3 ? C_CREAM : C_WATER2 });
    }
    if (drops.length > 160) drops.splice(0, drops.length - 160);
}

function confetti(pos)
{
    const colors = [C_CORAL, C_SUNNY, C_TEAL, C_CREAM];
    for (let i = 0; i < 50; i++)
    {
        const a = rand(PI*2), v = rand(3, 9);
        drops.push({ pos:pos.copy(), vel:vec2(Math.cos(a)*v, Math.sin(a)*v), t:0, life:rand(.8, 1.4), size:rand(.2, .4), color:colors[i%4], square:true });
    }
}

function onHit(A, B, impact, p)
{
    if (impact < .6) return;
    const isPlayer = A == player || B == player;
    const other = A == player ? B : A;
    for (const b of [A, B])
        if (b) b.squashVel += impact * (b == player ? 1.2 : 2) / Math.sqrt(b.mass);

    const kind = !other ? 'dock' : other.kind;
    if (kind == 'duck')
    {
        const duck = other.kind == 'duck' ? other : (A.kind == 'duck' ? A : B);
        if (duck.stunT <= 0 && (isPlayer || impact > 1.2))
        {
            duck.stunT = 1.5;
            duck.angVel += rand(-14, 14);
            sfx('quack', p, 1, rand(.9, 1.3) / Math.sqrt(duck.duckSize));
            popup(pick(QUIPS.duck), p.add(vec2(0, .8)), C_SUNNY, .8);
            if (isPlayer) { ducksOffended++; damages += 5; }
        }
        return;
    }
    if (!isPlayer && impact < 1.5) return;

    const cool = isPlayer ? player : A;
    splash(p, Math.min(14, impact*3), impact*1.2);
    if (cool.hitCooldown > 0) return;
    cool.hitCooldown = .35;

    if (isPlayer)
    {
        shakeAmt = Math.max(shakeAmt, Math.min(.5, impact*.07*Math.sqrt(player.mass)));
        if (impact > 1.4) player.hurtT = .8;
    }
    if (kind == 'buoy')
    {
        sfx('bong', p, 1, rand(.9, 1.1));
        popup(pick(QUIPS.buoy), p.add(vec2(0, .8)));
        if (isPlayer) damages += 20;
    }
    else if (kind == 'moored' || kind == 'drifter' || kind == 'player')
    {
        sfx('bonk', p, 1, .8);
        if (other && other.hurtT !== undefined) other.hurtT = .8;
        popup(pick(QUIPS.boat), (other || A).pos.add(vec2(0, 1.4)), C_CORAL);
        if (isPlayer) damages += Math.round(impact * 60 * Math.sqrt(other.mass)) * 5;
    }
    else if (kind == 'log')
    {
        sfx('bonk', p, 1, .6);
        popup(pick(QUIPS.log), p.add(vec2(0, .8)), C_WOOD);
        if (isPlayer) damages += 10;
    }
    else
    {
        sfx('bonk', p, Math.min(1, impact/3), 1.2 - Math.min(.5, player.mass*.05));
        if (impact > 1) popup(pick(QUIPS.dock), p.add(vec2(0, .8)));
        if (isPlayer) damages += Math.round(impact * 8) * 5;
    }
}

// ---------------------------------------------------------------------------
// player and anchor

function controlPlayer(dt)
{
    const t = player.type;
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
        const tx = mousePos.x - player.pos.x, ty = mousePos.y - player.pos.y, dist = Math.hypot(tx, ty);
        if (dist > t.W*.6)
        {
            const want = Math.atan2(ty, tx), diff = wrapAngle(want - player.angle);
            const power = clamp(dist/6, .3, 1);
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
    if (anchor) throttle = 0;
    player.throttle = throttle;
    player.rudder = rudder;

    const f = player.forward();
    const thrust = throttle * t.power * (throttle < 0 ? t.reverse : 1) * player.invMass;
    player.vel.x += f.x * thrust * dt;
    player.vel.y += f.y * thrust * dt;
    const vf = player.vel.x*f.x + player.vel.y*f.y;
    player.angVel += rudder * (t.turn*vf + t.wash*throttle) * dt;
}

function bowPoint() { return player.toWorld(player.type.L/2 - .25, 0); }

function toggleAnchor()
{
    if (judge && judge.result) return;
    if (anchor)
    {
        anchor = judge = undefined;
        sfx('chain', player.pos, 1, 1.3);
        popup('Anchor up', player.pos.add(vec2(0, 1.5)), C_CREAM, .7);
        return;
    }
    const spd = player.speed();
    // lands right at the bow, a hair off-center, so a boat still moving fast whips around it
    anchor = { pos: bowPoint().add(player.forward().rotate(PI/2).scale(rand(-.15, .15))), len: .5, t: 0 };
    judge = { t:0, settle:0 };
    attempts++;
    sfx('chain', anchor.pos);
    sfx('splash', anchor.pos, .8);
    splash(anchor.pos, 12, 3);
    if (spd > 2.5)
    {
        popup(pick(QUIPS.fast), player.pos.add(vec2(0, 1.6)), C_SUNNY, 1.1);
        shakeAmt = Math.max(shakeAmt, .25);
        player.hurtT = 1;
        player.angVel += (rand() < .5 ? -1 : 1) * spd * 2;     // spin-out
    }
}

function anchorForce(dt)
{
    if (!anchor) return;
    anchor.t += dt;
    const bow = bowPoint(), dx = bow.x - anchor.pos.x, dy = bow.y - anchor.pos.y, d = Math.hypot(dx, dy);
    if (d > anchor.len)
    {
        const nx = dx/d, ny = dy/d, bv = player.pointVel(bow);
        const vn = bv.x*nx + bv.y*ny, m = player.mass;
        const f = -(d - anchor.len)*30*m - vn*3*m;
        player.applyForce(nx*f, ny*f, bow, dt);
    }
    // the anchor drags on the bottom
    player.vel = player.vel.scale(Math.max(0, 1 - .8*dt));
    player.angVel *= Math.max(0, 1 - .9*dt);
}

// fraction-free test: every hull circle inside the slip (small tolerance)
function boatInSlip()
{
    const c = Math.cos(slip.a), s = Math.sin(slip.a), tol = .15;
    for (let i = 0; i < player.circles.length; i++)
    {
        const p = player.world[i], r = player.circles[i].r;
        const dx = p.x - slip.pos.x, dy = p.y - slip.pos.y;
        const lx = dx*c + dy*s, ly = -dx*s + dy*c;
        if (Math.abs(lx) + r > slip.len/2 + tol || Math.abs(ly) + r > slip.wid/2 + tol)
            return false;
    }
    return true;
}

function parkingScore()
{
    const posErr = player.pos.distance(slip.pos);
    const diff = Math.abs(wrapAngle(player.angle - slip.a));
    const angErr = Math.min(diff, PI - diff);       // nose in or stern in, both fine
    return clamp(1 - .6*Math.min(1, posErr/.8) - .4*Math.min(1, angErr/.35), 0, 1);
}

function updateJudge(dt)
{
    if (!judge) return;
    judge.t += dt;
    if (judge.result)
    {
        if (judge.result == 'win' && judge.t > 1.4) showComplete();
        if (judge.result == 'fail' && judge.t > 1.8) { anchor = judge = undefined; }
        return;
    }
    if (player.speed() < .25 && Math.abs(player.angVel) < .25) judge.settle += dt;
    else judge.settle = 0;
    if (judge.settle < .5 && judge.t < 3.5) return;

    judge.t = 0;
    if (boatInSlip())
    {
        const acc = parkingScore();
        const stars = acc >= .85 ? 3 : acc >= .6 ? 2 : 1;
        judge.result = 'win';
        result = { acc, stars, quip: pick(QUIPS['star' + stars]) };
        sfx('win');
        confetti(player.pos);
        popup('PARKED!', player.pos.add(vec2(0, 2)), C_SUNNY, 1.6);
    }
    else
    {
        judge.result = 'fail';
        sfx('fail');
        popup(pick(QUIPS.fail), player.pos.add(vec2(0, 2)), C_CREAM, .8);
        track('progression', 'Fail', levelId());
    }
}

function showComplete()
{
    const i = levelIndex;
    result.isBest = result.stars > (saveData.stars[i] || 0) || result.acc > (saveData.best[i] || 0);
    saveData.stars[i] = Math.max(saveData.stars[i] || 0, result.stars);
    saveData.best[i] = Math.max(saveData.best[i] || 0, result.acc);
    persist();
    track('progression', 'Complete', levelId(), Math.round(result.acc*100));
    setScreen('complete');
}

// ---------------------------------------------------------------------------
// ducks

function updateDuck(d, dt)
{
    if (d.stunT > 0) { d.stunT -= dt; return; }
    if (d.leader)
    {
        const f = d.leader.forward();
        d.target = d.leader.pos.subtract(f.scale(.75 * d.leader.duckSize + .2));
    }
    else
    {
        d.wanderT -= dt;
        const away = d.pos.subtract(player.pos);
        if (away.length() < 3.5)
            d.target = d.pos.add(away.normalize(3));       // paddle away from the boat
        else if (d.wanderT <= 0)
        {
            d.wanderT = rand(3, 6);
            d.target = vec2(clamp(d.pos.x + rand(-8, 8), 3, 37), clamp(d.pos.y + rand(-5, 5), 2, PIER_TOP - 2.5));
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
    for (let s = 0; s < SUBSTEPS; s++)
    {
        controlPlayer(dt);
        anchorForce(dt);
        for (const b of bodies)
        {
            if (b.kind == 'duck') updateDuck(b, dt);
            const c = currentAt(b.pos);
            b.integrate(dt, c ? c.dx : 0, c ? c.dy : 0);
        }
        for (let i = 0; i < bodies.length; i++)
        {
            for (let k = i+1; k < bodies.length; k++)
                collideBodies(bodies[i], bodies[k], onHit);
            collideStatics(bodies[i], rects, posts, onHit);
        }
    }
    for (const b of bodies) if (b.hurtT > 0) b.hurtT -= timeDelta;

    // motor putts and wake
    const t = player.type, thr = Math.abs(player.throttle);
    motorTimer -= timeDelta;
    if (thr > .1 && motorTimer <= 0)
    {
        motorTimer = .13 - .06*thr;
        sfx('putt', player.pos, .5 + thr*.5, 1.4 / Math.sqrt(t.mass) + thr*.3);
    }
    wakeTimer -= timeDelta;
    if (player.speed() > .7 && wakeTimer <= 0)
    {
        wakeTimer = .07;
        const stern = player.toWorld(-t.L/2, 0);
        wakes.push({ pos:stern, t:0, size:t.W*.7 });
        if (wakes.length > 70) wakes.shift();
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
    shakeAmt = Math.max(0, shakeAmt - dt*1.5);
}

// ---------------------------------------------------------------------------
// buttons (laid out in world units, the view is always 40 x 22.5)

function button(id, label, x, y, w, h, opts={}) { buttons.push({ id, label, x, y, w, h, ...opts }); }

function layoutButtons()
{
    buttons = [];
    if (gameScreen == 'title')
    {
        button('play', 'PLAY', 20, 8.6, 9, 2.6, { big:true });
        button('levels', 'LEVELS', 20, 5.4, 7, 1.9);
        button('sound', saveData.sound ? 'SOUND: ON' : 'SOUND: OFF', 20, 2.8, 7, 1.5, { small:true });
    }
    else if (gameScreen == 'levels')
    {
        LEVELS.forEach((L, i) => button('level' + i, String(i+1), 8 + (i%5)*6, 13.6 - Math.floor(i/5)*6.4, 5.2, 5.4, { card:i }));
        button('back', 'BACK', 20, 2.2, 6, 1.6, { small:true });
    }
    else if (gameScreen == 'playing')
    {
        button('pause', 'II', 37.6, 21.75, 2.2, 1.2, { small:true });
        button('restart', 'RESTART', 33.6, 21.75, 4.8, 1.2, { small:true });
        if (!isPaused)
            button('anchor', '', 37.4, 3, 3.6, 3.6, { round:true });
        else
        {
            button('resume', 'RESUME', 20, 13, 8, 2.2, { big:true });
            button('restart', 'RESTART', 20, 10, 7, 1.8);
            button('menu', 'MENU', 20, 7.4, 7, 1.8);
        }
    }
    else if (gameScreen == 'complete')
    {
        const last = levelIndex >= LEVELS.length - 1;
        button('next', last ? 'THE END' : 'NEXT', 24.5, 6, 7, 2.2, { big:true });
        button('retry', 'RETRY', 16, 6, 6, 2.2);
        button('menu', 'MENU', 20, 4, 4.5, 1.2, { small:true });
    }
}

function buttonAt(p)
{
    for (const b of buttons)
    {
        if (b.round ? p.distance(vec2(b.x, b.y)) < b.w/2 : Math.abs(p.x - b.x) < b.w/2 && Math.abs(p.y - b.y) < b.h/2)
            return b;
    }
}

function nextLevelIndex()
{
    for (let i = 0; i < LEVELS.length; i++) if (!saveData.stars[i]) return i;
    return 0;
}

function pressButton(id)
{
    sfx('click');
    if (id == 'play') loadLevel(nextLevelIndex());
    else if (id == 'levels') setScreen('levels');
    else if (id == 'sound') { saveData.sound = !saveData.sound; persist(); if (!saveData.sound) track('design', 'settings:sfx:off'); }
    else if (id == 'back' || id == 'menu') setScreen('title');
    else if (id.startsWith('level')) loadLevel(+id.slice(5));
    else if (id == 'pause') isPaused = !isPaused;
    else if (id == 'resume') isPaused = false;
    else if (id == 'restart' || id == 'retry') { track('design', 'ui:restart'); loadLevel(levelIndex); }
    else if (id == 'anchor') toggleAnchor();
    else if (id == 'next') levelIndex >= LEVELS.length - 1 ? setScreen('title') : loadLevel(levelIndex + 1);
}

// ---------------------------------------------------------------------------
// engine callbacks

function gameInit()
{
    setCanvasClearColor(C_SAND);
    setFontDefault("'Arial Rounded MT Bold', 'Trebuchet MS', 'Segoe UI', sans-serif");
    for (let i = 0; i < 46; i++)
        ripples.push(vec2(rand(1, 39), rand(1, 20)));
}

const ripples = [];

function gameUpdate()
{
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

    if (gameScreen == 'title' && (keyWasPressed('Enter') || keyWasPressed('Space'))) pressButton('play');
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
            if (keyWasPressed('Space') || keyWasPressed('Enter')) toggleAnchor();
            levelTime += timeDelta;
            stepWorld();
            updateJudge(timeDelta);
        }
    }
    updateEffects();
}

function gameUpdatePost()
{
    setCameraScale(Math.min(mainCanvasSize.x / VIEW_SIZE.x, mainCanvasSize.y / VIEW_SIZE.y));
    const shake = shakeAmt > 0 ? vec2(rand(-1, 1), rand(-1, 1)).scale(shakeAmt) : vec2();
    setCameraPos(VIEW_CENTER.add(shake));
}

// ---------------------------------------------------------------------------
// rendering

function drawWater()
{
    drawRect(VIEW_CENTER, VIEW_SIZE, C_WATER);
    for (let i = 0; i < ripples.length; i++)
    {
        const p = ripples[i], x = p.x + Math.sin(time*.5 + i)*.4;
        drawLine(vec2(x - .35, p.y), vec2(x, p.y - .12), .08, C_WATER2);
        drawLine(vec2(x, p.y - .12), vec2(x + .35, p.y), .08, C_WATER2);
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
    const inside = boatInSlip(), pulse = .5 + .5*Math.sin(time*5);
    // ghost of the boat where it should end up
    const ghost = { pos:slip.pos, angle:slip.a, sx:1, sy:1 };
    painter(ghost).poly(player.type.hullPts, C_CREAM.scale(1, .22));
    if (inside)
    {
        drawPoly([vec2(slip.pos.x-slip.w/2, slip.pos.y-slip.h/2), vec2(slip.pos.x+slip.w/2, slip.pos.y-slip.h/2),
            vec2(slip.pos.x+slip.w/2, slip.pos.y+slip.h/2), vec2(slip.pos.x-slip.w/2, slip.pos.y+slip.h/2)],
            C_CREAM.scale(1, .15 + .1*pulse), .16, C_CREAM);
    }
    else
        drawDashedRect(slip.pos, slip.w, slip.h, C_CREAM, .14, .45);
}

function drawWakes()
{
    for (const w of wakes)
    {
        const k = w.t / 1.2;
        drawEllipse(w.pos, vec2(w.size*(1 + k*2.5)), C_CLEAR, 0, .09*(1 - k), C_CREAM.scale(1, .7*(1 - k)));
    }
}

function drawAnchorRope()
{
    if (!anchor) return;
    const drop = Math.min(1, anchor.t*4);
    drawCircle(anchor.pos, 1.2*drop, C_WATER2.scale(1, .6));
    drawAnchorGlyph(anchor.pos, .55, C_INK.scale(1, .5));
    drawLine(bowPoint(), anchor.pos, .08, C_INK);
}

function drawBodies()
{
    for (const r of rects) if (r.dock) drawDockShadow(r);
    for (const b of bodies) if (b.type) drawBoatShadow(b);
    for (const r of rects) if (r.dock) drawDock(r);
    for (const p of posts) drawPost(p);
    for (const b of bodies)
    {
        if (b.kind == 'duck') drawDuck(b);
        else if (b.kind == 'buoy') drawBuoy(b);
        else if (b.kind == 'log') drawLog(b);
    }
    for (const b of bodies) if (b.type && b != player) drawBoat(b);
    drawBoat(player);
}

function drawShore()
{
    const s = .4, c = C_SAND;
    drawRect(vec2(20, s/2), vec2(40, s), c);
    drawRect(vec2(s/2, 11), vec2(s, 22), c);
    drawRect(vec2(40 - s/2, 11), vec2(s, 22), c);
    drawLine(vec2(s, s), vec2(40 - s, s), LINE_W, C_INK);
    drawLine(vec2(s, s), vec2(s, PIER_TOP), LINE_W, C_INK);
    drawLine(vec2(40 - s, s), vec2(40 - s, PIER_TOP), LINE_W, C_INK);
}

function drawDrops()
{
    for (const d of drops)
    {
        const k = 1 - d.t / d.life;
        if (d.square) drawRect(d.pos, vec2(d.size*k + .05), d.color, d.t*8);
        else drawCircle(d.pos, d.size*k + .05, d.color);
    }
}

function drawPopups()
{
    for (const p of popups)
    {
        const pop = Math.min(1, p.t*8), s = p.size * (pop < 1 ? pop*1.3 : 1 + Math.max(0, .3 - (p.t - .12)*2));
        const a = clamp((1.3 - p.t)*3, 0, 1);
        txt(p.text, p.pos.x, p.pos.y + p.t*.8, s, p.color.scale(1, a), 'center', .14*s, C_INK.scale(1, a));
    }
}

function drawButton(b)
{
    const hover = hoverId == b.id, lift = hover ? .12 : 0;
    if (b.round)
    {
        const inSlip = boatInSlip() && player.speed() < 1;
        const pulse = !anchor && inSlip ? 1 + Math.sin(time*8)*.06 : 1;
        const c = vec2(b.x, b.y + lift), d = b.w*pulse;
        drawCircle(c.add(vec2(.16, -.22)), d, C_SHADOW);
        drawCircle(c, d, anchor ? C_TEAL : C_CORAL, LINE_W*1.4, C_INK);
        drawAnchorGlyph(c.add(vec2(0, .2)), 1.25*pulse, C_CREAM);
        txt(anchor ? 'RAISE' : 'SPACE', b.x, b.y - b.h/2 - .55, .55, C_INK);
        return;
    }
    if (b.card !== undefined) return drawLevelCard(b, hover);
    const c = vec2(b.x, b.y + lift);
    drawPanel(c, b.w, b.h, b.big ? C_CORAL : C_CREAM, Math.min(.6, b.h*.35));
    txt(b.label, c.x, c.y - (b.small ? .02 : .05), b.big ? 1.25 : b.small ? .6 : .85, b.big ? C_CREAM : C_INK);
}

function drawLevelCard(b, hover)
{
    const i = b.card, L = LEVELS[i], stars = saveData.stars[i] || 0, isNext = i == nextLevelIndex();
    const c = vec2(b.x, b.y + (hover ? .15 : 0));
    drawPanel(c, b.w, b.h, isNext ? C_SUNNY : C_CREAM, .5);
    txt(b.label, c.x, c.y + 1.4, 1.5, C_INK);
    txt(L.name, c.x, c.y + .1, .5, C_INK);
    txt(BOATS[L.boat].name, c.x, c.y - .6, .42, C_TEAL);
    for (let s = 0; s < 3; s++) drawStar(vec2(c.x - 1.3 + s*1.3, c.y - 1.8), .5, s < stars);
}

function drawHud()
{
    const L = LEVELS[levelIndex];
    drawRect(vec2(20, (PLAY_TOP + VIEW_SIZE.y)/2), vec2(40, VIEW_SIZE.y - PLAY_TOP), C_CREAM);
    drawLine(vec2(0, PLAY_TOP), vec2(40, PLAY_TOP), LINE_W, C_INK);
    txt(`${levelIndex + 1}. ${L.name}`, .8, 21.75, .7, C_INK, 'left');
    txt(BOATS[L.boat].name, 10.5, 21.75, .55, C_TEAL, 'left');
    if (damages) txt(`Damages: $${damages}`, 22, 21.75, .55, C_CORAL);

    // hint fades after a few seconds, comes back while idle
    const a = clamp(6 - levelTime, 0, 1);
    if (a > 0 && L.hint)
    {
        drawPanel(vec2(20, 1.6), Math.min(36, L.hint.length*.33 + 2), 1.5, C_CREAM.scale(1, a), .5, false);
        txt(L.hint, 20, 1.6, .58, C_INK.scale(1, a));
    }
}

function drawTitle()
{
    drawWater();
    // a little parade of boats doing donuts
    ['dinghy', 'swan', 'tug', 'bathtub'].forEach((key, i) =>
    {
        const a = time*.4 + i*PI/2;
        const b = { pos:vec2(20 + Math.cos(a)*15, 11 + Math.sin(a)*7.5), angle:a + PI/2, sx:1, sy:1, id:i, type:BOATS[key], color:BOATS[key].color, kind:'title' };
        drawBoatShadow(b);
        drawBoat(b);
    });
    const bob = Math.sin(time*2)*.2;
    txt('PARK MY BOAT', 20.2, 15.1 + bob, 3.6, C_INK);
    txt('PARK MY BOAT', 20, 15.4 + bob, 3.6, C_SUNNY, 'center', .25, C_INK);
    txt('One boat. One spot. Zero brakes.', 20, 12.7, .8, C_INK);
}

function drawComplete()
{
    drawRect(VIEW_CENTER, VIEW_SIZE, C_INK.scale(1, .35));
    const t = screenTime, k = Math.min(1, t*3), ease = 1 + 2.7*Math.pow(k - 1, 3) + 1.7*Math.pow(k - 1, 2);
    const c = vec2(20, 11.5);
    drawPanel(c.add(vec2(0, (1 - ease)*-12)), 22, 17, C_CREAM, .8);
    if (k < 1) return;
    txt('PARKED!', 20, 17.6, 2, C_CORAL, 'center', .16, C_INK);
    for (let s = 0; s < 3; s++)
    {
        const st = clamp((t - .35 - s*.25)*5, 0, 1);
        const sz = st < 1 ? st*1.3 : 1;
        if (st > 0 && st < .25 && s < result.stars && !result['sfx' + s]) { result['sfx' + s] = 1; sfx('click', undefined, 1, 1 + s*.25); }
        drawStar(vec2(16 + s*4, 14.4), 1.4*Math.max(.01, s < result.stars ? sz : 1), s < result.stars && st > 0);
    }
    const shown = Math.round(result.acc*100 * clamp((t - .5)*1.5, 0, 1));
    txt(`Accuracy ${shown}%`, 20, 11.6, 1, C_INK);
    txt(`Anchor drops: ${attempts}    Damages: $${damages}    Ducks offended: ${ducksOffended}`, 20, 10.1, .55, C_TEAL);
    txt(`"${result.quip}"`, 20, 8.6, .75, C_INK);
    if (result.isBest) txt('NEW BEST!', 27.5, 16.2, .7, C_CORAL, 'center', 0);
}

function gameRender()
{
    if (gameScreen == 'title') { drawTitle(); return; }
    if (gameScreen == 'levels')
    {
        drawWater();
        txt('PICK A BOAT', 20, 19.4, 2, C_SUNNY, 'center', .16, C_INK);
        return;
    }
    drawWater();
    drawCurrents();
    drawSlip();
    drawWakes();
    drawBodies();
    drawAnchorRope();
    drawShore();
    drawDrops();
    drawPopups();
    drawHud();
    if (gameScreen == 'complete') drawComplete();
    if (isPaused)
    {
        drawRect(VIEW_CENTER, VIEW_SIZE, C_INK.scale(1, .35));
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
    get score() { return result ? Math.round(result.acc*100) : 0; },
    get player() { return player; },
    start() { loadLevel(nextLevelIndex()); },
    restart() { loadLevel(levelIndex); },
    win()
    {
        player.pos = slip.pos.copy(); player.angle = slip.a; player.vel = vec2(); player.angVel = 0;
        player.updateWorld();
        if (!anchor) toggleAnchor();
    },
};

setGLEnable(false);
setDebugWatermark(false);
engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost);
