/*
    HOP RACE - World 4, Phase (GDD §3.5, §6). Coordinates are centered on the level box:
    a size 24 level spans x -12..12 and y -6.75..6.75. Solids are {l, r, top, bottom?}.
    Slabs are tilted bars [x0, y0, x1, y1]: the left and right ends of the top surface, 0.5 u thick.
    The finish block sits in the low corner; hrSlabY gives the slab's top at x, so it rests on the slab.
*/

'use strict';

function hrSlabY([x0, y0, x1, y1], x) { return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }

const HR_PHASE_SLABS = {
    melt:   [[-12, 2.5, 12, -4.5]],
    switch: [[-13, 6.5, -3, 3.5], [-10, -.5, 4, 3], [-13, -1.6, 13, -6.6]],
    spill:  [[-14, 3.5, -1, 0], [2.5, -2, 14, -4]],
};

HR_LEVELS.phase = [
    {
        id: 'phase-01', name: 'Melt',
        size: 24,
        start: {x: -9.5, y: hrSlabY(HR_PHASE_SLABS.melt[0], -9.5)},
        solids: [{l: 9.8, r: 12, top: hrSlabY(HR_PHASE_SLABS.melt[0], 10.55) + .5, bottom: hrSlabY(HR_PHASE_SLABS.melt[0], 10.55) - 1.5, finish: true}],   // the corner where the drops pool
        slabs: HR_PHASE_SLABS.melt,   // one gentle slope from wall to wall: nothing can spill
        prompt: 'Press to melt.',
        promptAt: {x: -4, y: 4},
    },
    {
        id: 'phase-02', name: 'Switchback',
        size: 26,
        start: {x: -11, y: hrSlabY(HR_PHASE_SLABS.switch[0], -11)},
        solids: [{l: 10.8, r: 13, top: hrSlabY(HR_PHASE_SLABS.switch[2], 11.55) + .5, bottom: hrSlabY(HR_PHASE_SLABS.switch[2], 11.55) - 1.5, finish: true}],   // the corner where the drops pool
        slabs: HR_PHASE_SLABS.switch,
    },
    {
        id: 'phase-03', name: 'Spill',
        size: 28,
        start: {x: -12, y: hrSlabY(HR_PHASE_SLABS.spill[0], -12)},
        solids: [{l: 11.8, r: 14, top: hrSlabY(HR_PHASE_SLABS.spill[1], 12.55) + .5, bottom: hrSlabY(HR_PHASE_SLABS.spill[1], 12.55) - 1.5, finish: true}],   // the corner where the drops pool
        slabs: HR_PHASE_SLABS.spill,
    },
];
