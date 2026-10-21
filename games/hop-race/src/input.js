/*
    HOP RACE - the one button (GDD §4). Keys and Pointer Events (one code path for mouse and touch)
    become one {down, pressed, released} per player, read once per frame. Modes never read devices.
    Pointer presses that land on a UI button go to the UI instead (hrTaps), never to the game.
*/

'use strict';

const hrButtons = [0, 1].map(() => ({down: false, pressed: false, released: false, tap: false}));
const hrHeld = new Map();   // pointerId -> player index, while held in the play area
let hrTaps = [];            // pointer presses this frame, in canvas pixels: {pos, id, used}
let hrPointerQueue = [];    // raw events since the last frame

function hrInputInit()
{
    const queue = type => e =>
    {
        if (type == 'down' && e.button > 0) return;   // no right-click actions
        hrPointerQueue.push({type, id: e.pointerId, pos: hrCanvasPos(e)});
    };
    addEventListener('pointerdown', queue('down'));
    addEventListener('pointerup', queue('up'));
    addEventListener('pointercancel', queue('up'));
    addEventListener('contextmenu', e => e.preventDefault());
}

function hrCanvasPos(e)
{
    const r = mainCanvas.getBoundingClientRect();
    return vec2((e.clientX - r.left) * mainCanvas.width / r.width, (e.clientY - r.top) * mainCanvas.height / r.height);
}

// call at the start of gameUpdate: collects this frame's pointer presses for the UI
function hrInputBegin()
{
    hrTaps = [];
    for (const ev of hrPointerQueue)
        if (ev.type == 'down') hrTaps.push({pos: ev.pos, id: ev.id, used: false});
}

// call after the UI has claimed its taps: builds each player's button state
function hrInputEnd(playing, versus)
{
    // presses not claimed by the UI become held buttons in the play area
    for (const ev of hrPointerQueue)
    {
        if (ev.type == 'down')
        {
            const tap = hrTaps.find(t => t.id == ev.id && t.pos == ev.pos);
            if (!playing || tap.used) continue;
            const who = versus && ev.pos.x > mainCanvasSize.x / 2 ? 1 : 0;
            hrHeld.set(ev.id, who);
            hrButtons[who].tap = true;   // counts even if released within the same frame
        }
        else
            hrHeld.delete(ev.id);
    }
    hrPointerQueue = [];
    if (!playing) hrHeld.clear();

    const keys = versus ? [['KeyA'], ['KeyL']] : [['Space', 'KeyA', 'KeyL'], []];
    hrButtons.forEach((b, i) =>
    {
        let down = b.tap || keys[i].some(k => keyIsDown(k));
        for (const who of hrHeld.values()) if (who == i) down = true;
        b.pressed = down && !b.down;
        b.released = !down && b.down;
        b.down = down;
        b.tap = false;
    });
}

// any fresh press this frame from any player (results screens)
function hrAnyPressed() { return hrButtons[0].pressed || hrButtons[1].pressed; }
