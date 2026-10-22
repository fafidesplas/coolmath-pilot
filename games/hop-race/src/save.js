/*
    HOP RACE - saving (GDD §12, STANDARDS.md). One save object plus one ghost per level.
    A broken or foreign save resets to defaults and never crashes.
*/

'use strict';

const HR_SAVE_KEY = 'cm_hop-race_save';
const HR_GHOST_KEY = 'cm_hop-race_ghost_';
const hrSaveDefaults = () => ({v: 1, levels: {}, last: null, hats: {p1: null, p2: null},
    settings: {sfx: true, music: false, ghost: true}});

let hrSave = hrSaveDefaults();

function hrSaveLoad()
{
    const d = hrSaveDefaults(), s = readSaveData(HR_SAVE_KEY, d);
    const ok = s.v == 1 && s.levels && typeof s.levels == 'object' && s.settings && typeof s.settings == 'object';
    hrSave = ok ? {...d, ...s, settings: {...d.settings, ...s.settings}, hats: {...d.hats, ...s.hats}} : d;
}

function hrSaveWrite() { writeSaveData(HR_SAVE_KEY, hrSave); }

// the last level started, solo or versus, where Play 1P / 2P go back to
function hrSaveLast(id)
{
    if (hrSave.last == id) return;
    hrSave.last = id;
    hrSaveWrite();
}

function hrSaveLevel(id)
{
    const l = hrSave.levels[id];
    return {stars: l && l.stars > 0 ? min(3, l.stars | 0) : 0, bestMs: l && l.bestMs > 0 ? l.bestMs : 0};
}

function hrStarTotal()
{
    let n = 0;
    for (const id in hrSave.levels) n += hrSaveLevel(id).stars;
    return n;
}

// returns true if this is a new best time
function hrSaveResult(id, stars, ms)
{
    const old = hrSaveLevel(id), best = !old.bestMs || ms < old.bestMs;
    hrSave.levels[id] = {stars: max(old.stars, stars), bestMs: best ? ms : old.bestMs};
    hrSaveWrite();
    return best;
}

// ghosts: Int16 samples stored as base64
function hrGhostRead(id)
{
    try
    {
        const s = localStorage[HR_GHOST_KEY + id];
        if (!s) return null;
        const bytes = Uint8Array.from(atob(s), c => c.charCodeAt(0));
        return bytes.length % 4 ? null : new Int16Array(bytes.buffer);
    }
    catch { return null; }
}

function hrGhostWrite(id, samples)
{
    try
    {
        const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
        let s = '';
        for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        localStorage[HR_GHOST_KEY + id] = btoa(s);
    }
    catch {}
}
