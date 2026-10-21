/*
    HOP RACE - shared player state and rules for every mode (GDD §3.1):
    start point, kill line, finish, trail and the loose googly-eye pupil.
*/

'use strict';

let hrPlayers = [];

function hrMakePlayer(index)
{
    const p = {index, letter: index ? 'L' : 'A',
        color: index ? HR_WHITE : HR_BLUE, letterColor: index ? HR_INK : HR_WHITE,
        x: 0, y: 0, vx: 0, vy: 0, down: false, squash: 0, trail: [],
        eye: {x: 0, y: 0, vx: 0, vy: 0},   // pupil offset from the eye center, on a spring
        falls: 0, finished: false};
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
    p.squash = 0;
    p.trail = [];
    p.eye.x = p.eye.y = p.eye.vx = p.eye.vy = 0;
    hrMode().reset(p);
}

// one fixed step for one player; input is {down, pressed, released}
function hrPlayerStep(p, input)
{
    if (!p.finished)
    {
        hrMode().step(p, input);

        // GDD §3.1: falling sends you back to the start with zero speed, the timer keeps running
        if (p.y < hrLevel.killY)
        {
            hrSfx.fall.play();
            p.falls++;
            hrResetPlayer(p);
            p.down = input.down;   // a held button must be released and pressed again
            hrEmit('fall', p);
        }
        else if (hrTouchingFlag(p.x, p.y))
        {
            p.finished = true;
            p.down = false;
            hrEmit('finish', p);
        }
    }
    p.squash *= .85;

    // trail while airborne
    if (!p.grounded && !p.cling && !p.finished) p.trail.push(vec2(p.x, p.y));
    else if (p.trail.length) p.trail.shift();
    if (p.trail.length > 8) p.trail.shift();

    // pupil: lags behind motion and swings back, which carries most of the character
    const e = p.eye, dt = timeDelta;
    const tx = clamp(-p.vx * .006, -.12, .12) + (p.dir || 1) * .04;
    const ty = clamp(-p.vy * .006, -.12, .12) - (p.down ? .03 : 0);
    e.vx += ((tx - e.x) * 260 - e.vx * 9) * dt;
    e.vy += ((ty - e.y) * 260 - e.vy * 9) * dt;
    e.x += e.vx * dt; e.y += e.vy * dt;
    const r = Math.hypot(e.x, e.y), maxR = .13;
    if (r > maxR) { e.x *= maxR / r; e.y *= maxR / r; }
}

// distance used by the stuck nudge (GDD §3.1)
function hrFlagDistance(p) { return Math.hypot(p.x - hrLevel.flag.x, p.y - hrLevel.flag.y); }
