/*
    HOP RACE - shared player state and rules for every mode (GDD §3.1):
    start point, kill line, finish, trail and the loose googly-eye pupil.
*/

'use strict';

let hrPlayers = [];

// landing squeeze: flattens on impact, springs back past square into a small stretch, then settles
const HR_LAND_T = .36;
function hrLandSquash(p)
{
    if (p.landT < 0) return 0;
    const k = p.landT / HR_LAND_T, hold = .35;   // first 35 %: hold flat and ease back up
    return p.land * (k < hold ? 1 - (k / hold) ** 2 : -.25 * Math.sin(PI * (k - hold) / (1 - hold)));
}

// total vertical squash (0 square, + flatter, - taller)
function hrSquashY(p) { return min(.6, p.squash + hrLandSquash(p) + p.crouch); }

// idle glance: after 5 s standing still the pupil darts left and right, holds, then rests in the middle
const HR_IDLE_T = 5;
const HR_GLANCES = [[-1, .7], [1, .7], [-1, .35], [1, .35], [0, 1.4]];   // [screen side, seconds held]
function hrGlance(t)
{
    t %= HR_GLANCES.reduce((sum, g) => sum + g[1], 0);
    for (const [side, hold] of HR_GLANCES)
        if ((t -= hold) < 0) return side;
    return 0;
}

function hrMakePlayer(index)
{
    const p = {index, letter: index ? 'L' : 'A',
        color: index ? HR_RED : HR_BLUE, letterColor: HR_WHITE,
        x: 0, y: 0, vx: 0, vy: 0, down: false, squash: 0, crouch: 0, pinch: 0, lean: 0, squint: 0, eyeDrop: 0, land: 0, landT: -1, idleT: 0, trail: [],
        eye: {x: 0, y: 0, vx: 0, vy: 0},   // pupil offset from the eye center, on a spring
        falls: 0, finished: false, blinkIn: rand(1, 4), blinkT: -1};
    p.pupilKick = (vx, vy) => { p.eye.vx += vx * 8; p.eye.vy += vy * 8; };
    return p;
}

function hrMode() { return HR_MODES[HR_WORLDS[hrWorld].id]; }

function hrResetPlayer(p)
{
    p.x = hrLevel.start.x;
    p.y = hrLevel.start.y + HR_PSIZE / 2;
    p.vx = p.vy = 0;
    p.down = false;
    p.squash = p.crouch = p.pinch = p.lean = p.squint = p.eyeDrop = 0;
    p.look = p.lunge = undefined;
    p.landT = -1;
    p.idleT = 0;
    p.trail = [];
    p.eye.x = p.eye.y = p.eye.vx = p.eye.vy = 0;
    hrMode().reset(p);
}

// back to the start with zero speed (also used by modes with their own ways to lose, like Phase)
function hrRespawn(p, down)
{
    hrSfx.fall.play();
    p.falls++;
    hrResetPlayer(p);
    p.down = down;   // a held button must be released and pressed again
    hrEmit('fall', p);
}

// one fixed step for one player; input is {down, pressed, released}
function hrPlayerStep(p, input)
{
    if (!p.finished)
    {
        hrMode().step(p, input);

        // GDD §3.1: falling sends you back to the start with zero speed, the timer keeps running
        if (p.y < hrLevel.killY) hrRespawn(p, input.down);
        else if (hrMode().finished ? hrMode().finished(p) : hrTouchingFlag(p.x, p.y))
        {
            p.finished = true;
            p.lunge = undefined;   // let a mid-air lunge pose ease out
            p.down = false;
            hrEmit('finish', p);
        }
    }
    p.squash *= .85;
    if (p.landT >= 0 && (p.landT += timeDelta) > HR_LAND_T) p.landT = -1;
    if (!p.down && !p.lunge) { p.crouch *= .7; p.pinch *= .7; p.lean *= .7; p.squint *= .7; p.eyeDrop *= .7; }

    // trail while airborne
    if (!p.grounded && !p.cling && !p.finished) p.trail.push(vec2(p.x, p.y));
    else if (p.trail.length) p.trail.shift();
    if (p.trail.length > 8) p.trail.shift();

    // blink every 2.5-5 s, now and then twice in a row
    if ((p.blinkIn -= timeDelta) <= 0)
    {
        p.blinkT = 0;
        p.blinkIn = rand() < .2 ? .3 : rand(2.5, 5);
    }
    if (p.blinkT >= 0 && (p.blinkT += timeDelta) > HR_BLINK_T) p.blinkT = -1;

    const still = (p.grounded || p.cling) && !p.down && !p.finished && !p.vx && !p.vy;
    p.idleT = still ? p.idleT + timeDelta : 0;

    // pupil: lags behind motion and swings back, which carries most of the character
    const e = p.eye, dt = timeDelta;
    let tx = clamp(-p.vx * .006, -.12, .12) + (p.dir || 1) * .04;
    let ty = clamp(-p.vy * .006, -.12, .12) - (p.down ? .03 : 0);
    if (p.down && p.look) { tx = p.look.x * .13; ty = p.look.y * .13; }   // a mode can aim the eye while you hold
    if (p.idleT > HR_IDLE_T)
    {
        const side = hrGlance(p.idleT - HR_IDLE_T);
        if (side) { tx = side * .13; ty = -.03; }   // a little low, which reads as shifty
    }
    e.vx += ((tx - e.x) * 260 - e.vx * 9) * dt;
    e.vy += ((ty - e.y) * 260 - e.vy * 9) * dt;
    e.x += e.vx * dt; e.y += e.vy * dt;
    const r = Math.hypot(e.x, e.y), maxR = .13;
    if (r > maxR) { e.x *= maxR / r; e.y *= maxR / r; }
}

// distance used by the stuck nudge (GDD §3.1)
function hrFlagDistance(p) { return Math.hypot(p.x - hrLevel.flag.x, p.y - hrLevel.flag.y); }
