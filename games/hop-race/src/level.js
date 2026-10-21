/*
    HOP RACE - level loading: solids, flag trigger box, start point (GDD §6 data format).
*/

'use strict';

let hrLevel = null;   // the loaded level: {def, w, h, killY, solids, flag, start}

function hrLoadLevel(def)
{
    const w = def.size, h = def.size * 9 / 16, killY = -h / 2 - 1;
    const make = d =>
    {
        const bottom = d.bottom ?? killY - 30;   // default: well below the kill line
        return {l: d.l, r: d.r, top: d.top, bottom, grip: !!d.grip, ice: !!d.ice,
            pos: vec2((d.l + d.r) / 2, (d.top + bottom) / 2), size: vec2(d.r - d.l, d.top - bottom)};
    };
    const solids = def.solids.map(make);
    // GDD §3.1: the level box's left and right edges act as plain walls
    solids.push(make({l: -w / 2 - 5, r: -w / 2, top: h / 2 + 30, bottom: killY - 30}));
    solids.push(make({l: w / 2, r: w / 2 + 5, top: h / 2 + 30, bottom: killY - 30}));
    solids[solids.length - 1].edge = solids[solids.length - 2].edge = true;

    const f = def.flag;
    hrLevel = {def, w, h, killY, solids,
        start: vec2(def.start.x, def.start.y),
        flag: {x: f.x, y: f.y, hang: !!f.hang, dir: f.dir || 1},
        // GDD §3.1: trigger box from the pole to the pennant tip, 3 u tall
        flagBox: {pos: vec2(f.x + (f.dir || 1) * .65, f.hang ? f.y - 1.5 : f.y + 1.5), size: vec2(1.44, 3)},
    };
}

function hrOverlapSolid(x, y, s)
{
    const half = HR_PSIZE / 2;
    return x + half > s.l && x - half < s.r && y + half > s.bottom && y - half < s.top;
}

function hrTouchingFlag(x, y)
{
    const b = hrLevel.flagBox;
    return isOverlapping(vec2(x, y), vec2(HR_PSIZE), b.pos, b.size);
}

function hrFindLevel(id)
{
    for (let w = 0; w < HR_WORLDS.length; w++)
    {
        const i = hrLevelsOf(w).findIndex(l => l.id == id);
        if (i >= 0) return {world: w, index: i};
    }
}
