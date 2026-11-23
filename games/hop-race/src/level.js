/*
    HOP RACE - level loading: solids (finish blocks among them), gates and buttons, start point (GDD §6 data format).
*/

'use strict';

let hrLevel = null;   // the loaded level: {def, w, h, killY, solids, gates, finishes, start}

function hrLoadLevel(def)
{
    const w = def.size, h = def.size * 9 / 16, killY = -h / 2 - 1;
    const make = d =>
    {
        const bottom = d.bottom ?? killY - 30;   // default: well below the kill line
        return {l: d.l, r: d.r, top: d.top, bottom, grip: !!d.grip, ice: !!d.ice, sticky: !!d.sticky, breakable: !!d.breakable, finish: !!d.finish,
            move: d.move && (d.move.x || d.move.y) && d.move.t > 0 ? d.move : null, home: {l: d.l, top: d.top},
            pos: vec2((d.l + d.r) / 2, (d.top + bottom) / 2), size: vec2(d.r - d.l, d.top - bottom)};
    };
    // a mirrored (Versus) level lists its left half; each solid gets a mirror copy, and one touching or
    // crossing the middle becomes one symmetric solid
    const stack = def.stack ? hrStackLanes(def.size) : null;
    let src = !def.mirror ? def.solids : def.solids.flatMap(s => s.l <= 0 && s.r >= 0
        ? [{...s, l: min(s.l, -s.r), r: max(s.r, -s.l)}]
        : [s, {...s, l: -s.r, r: -s.l, move: s.move && {...s.move, x: -s.move.x}}]);   // the mirror copy moves the mirror way
    // a stacked (Versus) level lists P1's lane, the top half; P2's lane is the same, one floor down. A solid with no
    // bottom reaches down to its lane's floor band. Ink bands close each lane above and below, so both lanes are alike
    if (stack)
    {
        const down = s => ({...s, top: s.top - stack.drop, bottom: s.bottom - stack.drop});
        src = src.map(s => ({...s, bottom: s.bottom ?? stack.bottom})).flatMap(s => [s, down(s)]);
        const wide = {l: -w / 2 - 5, r: w / 2 + 5};
        src.push({...wide, top: h / 2 + 30, bottom: h / 2 - stack.band, band: true},
            {...wide, top: stack.band / 2, bottom: -stack.band / 2, band: true},
            {...wide, top: -h / 2 + stack.band, bottom: killY - 30, band: true});
    }
    const solids = src.map(make);
    src.forEach((d, i) => { if (d.band) solids[i].band = true; });
    // GDD §3.1: the level box's left and right edges act as plain walls
    solids.push(make({l: -w / 2 - 5, r: -w / 2, top: h / 2 + 30, bottom: killY - 30}));
    solids.push(make({l: w / 2, r: w / 2 + 5, top: h / 2 + 30, bottom: killY - 30}));
    solids[solids.length - 1].edge = solids[solids.length - 2].edge = true;

    // GDD §3.3: a gate is a solid until its button is pressed, then it slides up into the ceiling
    const gateDefs = !stack ? def.gates || [] : (def.gates || []).flatMap(g => [g, {
        solid: {...g.solid, top: g.solid.top - stack.drop, bottom: g.solid.bottom - stack.drop},
        button: {x: g.button.x, y: g.button.y - stack.drop}}]);
    const gates = gateDefs.map(g =>
    {
        const solid = make(g.solid);
        solid.gate = true;
        solids.push(solid);
        return {solid, closedBottom: solid.bottom, button: g.button, open: 0, pressed: false};
    });

    hrLevel = {def, w, h, killY, solids, gates, mirror: !!def.mirror, stack, clock: 0,
        start: vec2(def.start.x, def.start.y),
        finishes: solids.filter(s => s.finish),   // GDD §3.1: touching one of these wins
    };
    for (const s of hrLevel.finishes) s.flag = hrPlaceFinishFlag(s, solids);
}

// a stacked level's lanes (GDD §6): the level box (size wide, 16:9) holds an ink band at the top, P1's lane, a band,
// P2's lane and a band at the bottom. P1's lane runs from y = bottom to top; P2's is the same, drop lower
const HR_STACK_BAND = 1;   // band thickness (u)
function hrStackLanes(size)
{
    const band = HR_STACK_BAND, h = size * 9 / 16, lane = (h - 3 * band) / 2;
    return {band, lane, bottom: band / 2, top: band / 2 + lane, drop: lane + band};
}

// how far down a player's lane is: P2's on a stacked level, 0 otherwise
function hrLaneDrop(p) { return hrLevel.stack && p.index == 1 ? hrLevel.stack.drop : 0; }

// a player falls out when their center drops under this: on a stacked level, touching the band under their lane
function hrKillY(p)
{
    const s = hrLevel.stack;
    return s ? s.bottom - hrLaneDrop(p) + HR_PSIZE / 2 + .05 : hrLevel.killY;
}

// where the finish block's flag marker stands: from the middle outward along the block, the first pole spot
// where the flag (3 u pole, 1.6 u flag) clears the walls and every other solid, pointing right if it can, else left
function hrPlaceFinishFlag(f, solids)
{
    const hw = hrLevel.w / 2, l0 = max(f.l, -hw), r0 = min(f.r, hw), mid = (l0 + r0) / 2, pole = 3, w = 1.7;
    const clear = (l, r) => solids.every(s => s == f || s.l >= r || s.r <= l || s.bottom >= f.top + pole || s.top <= f.top);
    for (const dir of [1, -1])
        for (let k = 0; ; k++)
        {
            const x = mid - dir * k * .1;
            if (x < l0 + .1 || x > r0 - .1) break;
            if (clear(dir > 0 ? x - .1 : x - w, dir > 0 ? x + w : x + .1)) return {x, dir};
        }
    return {x: mid, dir: r0 - mid > mid - l0 ? 1 : -1};
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

// a breakable solid is gone (Rocket: hit by a rocket; Grapple: its rope let go), until a fall in solo or a restart.
// Anyone standing on it falls, and a hook still stuck in it comes loose
function hrShatter(s)
{
    const i = hrLevel.solids.indexOf(s);
    if (i < 0) return;
    hrLevel.solids.splice(i, 1);
    (hrLevel.broken ||= []).push(s);
    hrBreakFx(s);
    for (const p of hrPlayers)
    {
        if (p.floor == s) { p.grounded = false; p.floor = null; }
        if (p.hook && !p.hook.fly && p.hook.s == s) p.hook = null;
    }
}

// solo: a fall brings broken solids back, so a level can't be left without a way through. In Versus they stay
// broken for the round (the other player may be past them)
function hrRestoreBroken()
{
    if (!hrVersus && hrLevel.broken?.length) { hrLevel.solids.push(...hrLevel.broken); hrLevel.broken = []; }
}

// GDD §3.1: a player box on top of a finish block: its bottom at the block's top and over its width. Touching its
// side or bumping it from below does not count. Solids push the player out, so on top means within a hair of the top
function hrTouchingFinish(x, y, size = HR_PSIZE)
{
    const e = .02, half = size / 2;
    return hrLevel.finishes.some(s => x + half > s.l && x - half < s.r && y > s.top && y - half < s.top + e);
}

// distance from a point to the nearest finish block (0 inside it), for the stuck nudge
function hrFinishDistance(x, y)
{
    let d = Infinity;
    for (const s of hrLevel.finishes)
        d = min(d, Math.hypot(max(s.l - x, 0, x - s.r), max(s.bottom - y, 0, y - s.top)));
    return d;
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
