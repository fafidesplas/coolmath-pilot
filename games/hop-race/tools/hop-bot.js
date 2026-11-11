/*
    HOP RACE - Hop level bot (debug tool, not loaded by the game). GDD §6 "No dead ends".
    Plays the auto-run: from every platform or grip wall a player can reach, it runs on for every wait
    (0 to 2.5 s, frame by frame), then presses and holds for one of a few hold lengths, and follows the
    jump until the player lands, clings, falls or finishes. Landing spots are merged by platform, facing,
    speed and a 1 u grid, keeping the earliest arrival. Reports the fastest route, the timing window of each jump on
    it ("[7 f]": 7 different press frames reach the same platform), and dead ends: spots that can reach
    neither the flag nor a pit.

    Use: serve the game over HTTP, open it, then in the console
        await import('./tools/hop-bot.js')   // or paste this file
        hopBot('hop-08')
    It leaves the game on the title screen; reload afterwards. The level editor (tools/editor.js) runs it
    from its Check button and marks the route and any dead ends on the level.
*/
window.hopBot = function (levelId, opts = {})
{
    const WAIT = opts.waitMax ?? 150, HOLDS = opts.holds ?? [1, 2, 4, 6, 9, 12, 16, 20, 24], FOLLOW = 600;
    if (!opts.started) window.game.start(levelId, false);   // the level editor starts its own level first
    hrGo('title');   // the engine stops stepping players; we step them ourselves
    hrCountdown = 0;
    const saved = {hrEmit, hrDust, hrSparkle, hrDroplet, hrSplash};
    hrEmit = hrDust = hrSparkle = hrDroplet = hrSplash = () => {};
    setSoundEnable(false);
    const p = hrPlayers[0];
    hrResetPlayer(p);
    // a state is every plain value on the player (position, speed, run and jump timers, pose)
    const snap = () => Object.fromEntries(Object.entries(p).filter(([, v]) => v === undefined || typeof v != 'object' && typeof v != 'function'));
    const load = s => { Object.assign(p, s); p.trail = []; };
    const step = down => hrPlayerStep(p, {down, pressed: down && !p.down, released: !down && p.down});

    // which solid a standing or clinging state is on
    const solidOf = st =>
    {
        const foot = st.y - HR_PSIZE / 2, h = HR_PSIZE / 2;
        return hrLevel.solids.findIndex(o => st.grounded
            ? Math.abs(o.top - foot) < .03 && st.x + h > o.l && st.x - h < o.r
            : Math.abs((st.cling > 0 ? o.l : o.r) - (st.x + st.cling * (h + .001))) < .03 && st.y + h > o.bottom && st.y - h < o.top);
    };
    // landing spots are merged per platform, facing, speed (3 u/s steps) and a 1 u grid: on a small ledge where you
    // land matters, so a coarser merge loses routes (8 and 9 need the grid)
    const GRID = opts.grid ?? 1;
    const key = s => `${s.grounded ? 's' : 'w'}${solidOf(s)}:${s.dir}:${Math.round(s.speed / 3)}:${Math.round(s.x / GRID)}:${Math.round(s.y / GRID)}`;
    const spot = s => `(${s.x.toFixed(1)}, ${s.y.toFixed(1)}${s.cling ? ' cling' : ''})`;
    const settled = air => (p.cling && air) || (p.grounded && air);   // landed or grabbed a wall after being in the air

    // every move from a state: run on for `wait` frames, then press and hold `hold` frames (hold 0: no press)
    function moves(s)
    {
        const out = [];
        load(s);
        const f0 = p.falls, end = () => p.finished ? 'finish' : p.falls > f0 ? 'dead' : null;
        let air = false;
        for (let wait = 0; wait <= WAIT; wait++)
        {
            // try each jump from here
            if (p.coyote > 0 || p.cling || p.grounded)
            {
                const here = snap();
                for (const hold of HOLDS)
                {
                    load(here);
                    let frames = wait, r = null, a = false;
                    for (let i = 0; i < hold + FOLLOW && !r; i++)
                    {
                        step(i < hold);
                        frames++;
                        a ||= !p.grounded && !p.cling;
                        const e = end();
                        if (e) r = {[e]: true, frames};
                        else if (i >= 1 && settled(a)) r = {node: snap(), frames};
                    }
                    if (r) out.push({wait, hold, ...r});
                }
                load(here);
            }
            // then run on one more frame without pressing: a drop off an edge or a run into the flag is a move too
            step(false);
            air ||= !p.grounded && !p.cling;
            const e = end();
            if (e) { out.push({wait, hold: 0, [e]: true, frames: wait + 1}); break; }
            if (settled(air)) { out.push({wait, hold: 0, node: snap(), frames: wait + 1}); break; }
        }
        return out;
    }

    // the starting press only starts the run; the button has to come up before the first jump
    step(true); step(false);
    const start = snap(), startKey = 'start';
    const nodes = new Map([[startKey, {s: start, dist: 2, prev: null, edges: []}]]);
    const queue = [startKey];
    let best = null;
    while (queue.length)
    {
        queue.sort((a, b) => nodes.get(a).dist - nodes.get(b).dist);
        const k = queue.shift(), n = nodes.get(k);
        if (n.done) continue;
        n.done = true;
        for (const m of moves(n.s))
        {
            const to = m.node && key(m.node);
            n.edges.push({...m, to});
            const d = n.dist + m.frames;
            if (m.finish && (!best || d < best.dist)) best = {dist: d, from: k, wait: m.wait, hold: m.hold};
            if (!to) continue;
            const o = nodes.get(to);
            if (!o) { nodes.set(to, {s: m.node, dist: d, prev: {k, wait: m.wait, hold: m.hold}, edges: []}); queue.push(to); }
            else if (d < o.dist && !o.done) { o.dist = d; o.s = m.node; o.prev = {k, wait: m.wait, hold: m.hold}; }
        }
    }

    // dead ends: spots that can reach neither the flag nor a fall
    const good = new Set();
    let changed = true;
    while (changed)
    {
        changed = false;
        for (const [k, n] of nodes)
            if (!good.has(k) && n.edges.some(e => e.finish || e.dead || (e.to && good.has(e.to)))) { good.add(k); changed = true; }
    }
    const deadNodes = [...nodes].filter(([k]) => !good.has(k)).map(([, n]) => n.s);

    // fastest route, with each jump's timing window: how many press frames (with any hold) get to the same place
    const route = [], routeSpots = [];
    if (best)
    {
        let cur = {k: best.from, wait: best.wait, hold: best.hold, to: 'FLAG'};
        while (cur)
        {
            const n = nodes.get(cur.k);
            const window = new Set(n.edges.filter(e => cur.to == 'FLAG' ? e.finish : e.to == cur.to).map(e => e.wait)).size;
            const what = cur.hold ? `wait ${cur.wait} f, hold ${cur.hold} f` : `run ${cur.wait} f`;
            route.unshift(`${what} → ${cur.to == 'FLAG' ? 'flag' : spot(nodes.get(cur.to).s)} [${window} f]`);
            routeSpots.unshift({x: n.s.x, y: n.s.y, window});
            cur = n.prev && {k: n.prev.k, wait: n.prev.wait, hold: n.prev.hold, to: cur.k};
        }
    }
    hrEmit = saved.hrEmit; hrDust = saved.hrDust; hrSparkle = saved.hrSparkle; hrDroplet = saved.hrDroplet; hrSplash = saved.hrSplash;
    setSoundEnable(true);
    return {
        level: levelId,
        nodes: nodes.size,
        finishable: !!best,
        moves: route.length,
        bestTime: best && +(best.dist / 60).toFixed(2),
        deadEnds: deadNodes.map(spot),
        route,
        routeSpots,                                         // where each move on the route starts
        deadSpots: deadNodes.map(s => ({x: s.x, y: s.y})),
    };
};
