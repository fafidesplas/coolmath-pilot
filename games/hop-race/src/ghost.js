/*
    HOP RACE - ghost of your best run (GDD §12). Recording and replay both start at the first input,
    with the timer. Position every 2nd frame, quantized to 0.01 u; replay interpolates.
    Until you have a best run, a level with a built-in ghost (levels/ghosts.js, from tools/ghost-gen.js) replays that.
*/

'use strict';

const HR_GHOST_MAX = 60 * 60;   // samples kept: 2 minutes at 30 per second

let hrGhostRec = [];       // this attempt's samples (x, y pairs)
let hrGhostPlay = null;    // Int16Array of the saved best run, or null
let hrGhostBuiltInMs = 0;  // when the built-in ghost is playing: its time (ms), else 0

function hrGhostLoad(id)
{
    hrGhostRec = [];
    hrGhostBuiltInMs = 0;
    hrGhostPlay = hrGhostRead(id);
    const b = HR_GHOSTS[id];
    if (hrGhostPlay || !b || hrSaveLevel(id).bestMs) return;
    const bytes = Uint8Array.from(atob(b.data), c => c.charCodeAt(0));
    hrGhostPlay = new Int16Array(bytes.buffer);
    hrGhostBuiltInMs = b.ms;
}

// call every fixed frame while the timer runs; frame counts from the first input
function hrGhostRecord(p, frame)
{
    if (frame % 2 || hrGhostRec.length >= HR_GHOST_MAX * 2) return;
    hrGhostRec.push(Math.round(p.x * 100), Math.round(p.y * 100));
}

function hrGhostSave(id) { hrGhostWrite(id, Int16Array.from(hrGhostRec)); }

// ghost position at a frame count since the first input, or null if there is none
function hrGhostPos(frame)
{
    const g = hrGhostPlay;
    if (!g || g.length < 2) return null;
    const n = g.length / 2, f = clamp(frame / 2, 0, n - 1), i = floor(f), k = f - i, j = min(i + 1, n - 1);
    return vec2(lerp(g[i * 2], g[j * 2], k), lerp(g[i * 2 + 1], g[j * 2 + 1], k)).scale(.01);
}
