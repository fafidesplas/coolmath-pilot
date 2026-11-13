/*
    HOP RACE - level loading: solids, gates and buttons, flag trigger box, start point (GDD §6 data format).
*/

'use strict';

let hrLevel = null;   // the loaded level: {def, w, h, killY, solids, gates, flag, start}

function hrLoadLevel(def)
{
    const w = def.size, h = def.size * 9 / 16, killY = -h / 2 - 1;
    const make = d =>
    {
        const bottom = d.bottom ?? killY - 30;   // default: well below the kill line
        return {l: d.l, r: d.r, top: d.top, bottom, grip: !!d.grip, ice: !!d.ice, sticky: !!d.sticky, breakable: !!d.breakable,
            move: d.move && (d.move.x || d.move.y) && d.move.t > 0 ? d.move : null, home: {l: d.l, top: d.top},
            pos: vec2((d.l + d.r) / 2, (d.top + bottom) / 2), size: vec2(d.r - d.l, d.top - bottom)};
    };
    // a mirrored (Versus) level lists its left half; each solid gets a mirror copy, and one touching or
    // crossing the middle becomes one symmetric solid
    const src = !def.mirror ? def.solids : def.solids.flatMap(s => s.l <= 0 && s.r >= 0
        ? [{...s, l: min(s.l, -s.r), r: max(s.r, -s.l)}]
        : [s, {...s, l: -s.r, r: -s.l, move: s.move && {...s.move, x: -s.move.x}}]);   // the mirror copy moves the mirror way
    const solids = src.map(make);
    // GDD §3.1: the level box's left and right edges act as plain walls
    solids.push(make({l: -w / 2 - 5, r: -w / 2, top: h / 2 + 30, bottom: killY - 30}));
    solids.push(make({l: w / 2, r: w / 2 + 5, top: h / 2 + 30, bottom: killY - 30}));
    solids[solids.length - 1].edge = solids[solids.length - 2].edge = true;

    // GDD §3.3: a gate is a solid until its button is pressed, then it slides up into the ceiling
    const gates = (def.gates || []).map(g =>
    {
        const solid = make(g.solid);
        solid.gate = true;
        solids.push(solid);
        return {solid, closedBottom: solid.bottom, button: g.button, open: 0, pressed: false};
    });

    // a mirrored level's flag stands in the middle, its trigger box centered on the pole so both sides reach it alike
    const f = def.mirror ? {...def.flag, x: 0} : def.flag, boxX = def.mirror ? 0 : f.x + (f.dir || 1) * .65;
    hrLevel = {def, w, h, killY, solids, gates, mirror: !!def.mirror, clock: 0,
        start: vec2(def.start.x, def.start.y),
        flag: {x: f.x, y: f.y, hang: !!f.hang, dir: f.dir || 1},
        // GDD §3.1: trigger box from the pole to the pennant tip, 3 u tall
        flagBox: {pos: vec2(boxX, f.hang ? f.y - 1.5 : f.y + 1.5), size: vec2(1.44, 3)},
    };
}

// shrinkY makes the box a little shorter, so a floor or ceiling you rest against doesn't count as a wall
function hrOverlapSolid(x, y, s, shrinkY = 0)
{
    const half = HR_PSIZE / 2, hy = half - shrinkY / 2;
    return x + half > s.l && x - half < s.r && y + hy > s.bottom && y - hy < s.top;
}

function hrPressGate(g)
{
    g.pressed = true;
    hrSfx.click.play(undefined, 1, .7);
    hrSfx.star.play(undefined, .6, .8);
    addScreenShake(.15, .4);
}

function hrGatesUpdate()
{
    for (const g of hrLevel.gates)
    {
        if (!g.pressed || g.open >= 1) continue;
        g.open = min(1, g.open + timeDelta / .8);
        const s = g.solid, e = 1 - (1 - g.open) ** 2;
        s.bottom = lerp(g.closedBottom, s.top, e);
        s.size.y = s.top - s.bottom;
        s.pos.y = (s.top + s.bottom) / 2;
    }
}

// moving solids (every mode): a solid with move: {x, y, t} glides from where it is placed to (x, y) u away
// and back, t s each way, eased at both ends. The clock runs only while the race is on (main.js), from the
// first input in solo, so a ghost meets the solids where its run met them
function hrMoversStep()
{
    const L = hrLevel;
    L.clock += timeDelta;
    for (const s of L.solids)
    {
        if (!s.move) continue;
        const k = (1 - Math.cos(PI * L.clock / s.move.t)) / 2;
        const dx = s.home.l + s.move.x * k - s.l, dy = s.home.top + s.move.y * k - s.top;
        if (dx || dy) hrMoveSolid(s, dx, dy);
    }
}

function hrMoveSolid(s, dx, dy)
{
    const half = HR_PSIZE / 2, e = .06;
    // riders, found before it moves: standing on its top, or clinging to one of its sides
    const riders = hrPlayers.filter(p =>
        (p.x + half > s.l && p.x - half < s.r && abs(p.y - half - s.top) < e && p.vy <= .01) ||
        (p.cling && p.y + half > s.bottom && p.y - half < s.top &&
            abs(p.cling > 0 ? p.x + half - s.l : s.r - (p.x - half)) < e));
    s.l += dx; s.r += dx; s.top += dy; s.bottom += dy;
    s.pos.x += dx; s.pos.y += dy;
    for (const p of hrPlayers)
    {
        // a grapple hook or a Climb suction cup stuck in it goes along (and the body hanging from the cup)
        if (p.hook && !p.hook.fly && p.hook.s == s) { p.hook.x += dx; p.hook.y += dy; }
        if (p.pin?.s == s) { p.pin.x += dx; p.pin.y += dy; p.pin.sx += dx; p.pin.sy += dy; if (!riders.includes(p)) riders.push(p); }
        if (riders.includes(p)) { p.x += dx; p.y += dy; continue; }
        if (p.finished || !hrOverlapSolid(p.x, p.y, s)) continue;
        // anyone else it runs into is shoved out the shortest way
        const out = [[s.top - (p.y - half), 0, 1], [p.y + half - s.bottom, 0, -1], [p.x + half - s.l, -1, 0], [s.r - (p.x - half), 1, 0]]
            .reduce((a, b) => b[0] < a[0] ? b : a);
        p.x += out[1] * out[0]; p.y += out[2] * out[0];
        if (out[2] > 0 && p.vy < 0) p.vy = 0;   // scooped up from below: it lands on it next step
        if (out[2] < 0 && p.vy > 0) p.vy = 0;
    }
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
        const i = hrLevelsOf(w, false).findIndex(l => l.id == id);
        if (i >= 0) return {world: w, index: i, versus: false};
        const v = hrLevelsOf(w, true).findIndex(l => l.id == id);
        if (v >= 0 && hrHasVersusLevels(w)) return {world: w, index: v, versus: true};
    }
}
