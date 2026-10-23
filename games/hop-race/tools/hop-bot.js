/*
    HOP RACE - Hop level bot (debug tool, not loaded by the game). GDD §6 "No dead ends".
    From every spot a player can stand or cling, tries every hold length (after a few waits, for ice
    slides and grip-wall slides), then follows the jump until the player lands, clings, falls or
    finishes. Reports the fastest route (each hop costs a 0.5 s pause, so it doesn't win by tapping),
    how many hold lengths make each hop on it ("[38/163]": 38 of 163 land on the same platform), and
    dead ends: spots that can reach neither the flag nor a pit.

    Use: serve the game over HTTP, open it, then in the console
        await import('./tools/hop-bot.js')   // or paste this file
        hopBot('hop-08')
    It leaves the game on the title screen; reload afterwards.
*/
window.hopBot = function (levelId, opts = {})
{
    const HOLD = opts.holdMax ?? 170, MIN = opts.holdMin ?? 8, WAITS = opts.waits ?? [0, 12, 30, 60];
    const THINK = opts.think ?? 30;   // a person pauses about 0.5 s before each hop: route cost, not time
    window.game.start(levelId, false);
    hrGo('title');   // the engine stops stepping players; we step them ourselves
    const saved = {hrEmit, hrDust, hrSparkle};
    hrEmit = () => {}; hrDust = () => {}; hrSparkle = () => {};
    setSoundEnable(false);
    const p = hrPlayers[0];
    hrResetPlayer(p);
    const F = ['x', 'y', 'vx', 'vy', 'grounded', 'cling', 'dir', 't', 'charge', 'down', 'finished', 'falls', 'crouch', 'squash', 'landT', 'land'];
    const snap = () => Object.fromEntries(F.map(k => [k, p[k]]));
    const load = s => Object.assign(p, s);
    const step = (down, pressed = false, released = false) => hrPlayerStep(p, {down, pressed, released});
    const key = s => `${s.grounded ? 'g' : 'c' + s.cling}:${Math.round(s.x * 4)}:${Math.round(s.y * 4)}:${Math.round(s.vx)}`;

    // which solid a standing or clinging state is on, so hops can be judged by platform, not exact spot
    const solidOf = st =>
    {
        const foot = st.y - HR_PSIZE / 2, h = HR_PSIZE / 2;
        const i = hrLevel.solids.findIndex(o => st.grounded
            ? Math.abs(o.top - foot) < .03 && st.x + h > o.l && st.x - h < o.r
            : Math.abs((st.cling > 0 ? o.l : o.r) - (st.x + st.cling * (h + .001))) < .03 && st.y + h > o.bottom && st.y - h < o.top);
        return (st.grounded ? 's' : 'w') + i;
    };

    function act(s, wait, hold)
    {
        load(s);
        const f0 = p.falls;
        let frames = 0;
        const out = () => p.finished ? {finish: true, frames} : p.falls > f0 ? {dead: true, frames} : null;
        for (let i = 0; i < wait; i++) { step(false); frames++; const o = out(); if (o) return o; }
        if (!p.grounded && !p.cling) return null;
        for (let i = 0; i < hold; i++) { step(true, i == 0); frames++; const o = out(); if (o) return o; }
        step(false, false, true); frames++;
        { const o = out(); if (o) return o; }
        if (p.grounded) return null;   // no jump happened (a jump into a grip wall clings again: that counts)
        for (let i = 0; i < 600; i++)
        {
            step(false); frames++;
            const o = out(); if (o) return o;
            if (p.grounded || p.cling) return {node: snap(), frames};
        }
        return {stuck: true, frames};
    }

    const start = snap(), nodes = new Map([[key(start), {s: start, dist: 0, prev: null, edges: []}]]);
    const queue = [key(start)];
    let best = null;
    while (queue.length)
    {
        queue.sort((a, b) => nodes.get(a).dist - nodes.get(b).dist);
        const k = queue.shift(), n = nodes.get(k);
        if (n.done) continue;
        n.done = true;
        for (const wait of (k == key(start) ? [0] : WAITS))
            for (let hold = MIN; hold <= HOLD; hold++)
            {
                const r = act(n.s, wait, hold);
                if (!r) continue;
                n.edges.push({wait, hold, ...r, to: r.node && key(r.node)});
                const d = n.dist + r.frames + THINK;
                if (r.finish && (!best || d < best.dist)) best = {dist: d, from: k, wait, hold};
                if (r.finish || r.dead) continue;
                if (r.node)
                {
                    const k2 = key(r.node);
                    const m = nodes.get(k2);
                    if (!m) { nodes.set(k2, {s: r.node, dist: d, prev: {k, wait, hold}, edges: []}); queue.push(k2); }
                    else if (d < m.dist && !m.done) { m.dist = d; m.s = r.node; m.prev = {k, wait, hold}; }
                }
            }
    }

    // dead ends: nodes that can reach neither the flag nor a fall
    const good = new Set();
    let changed = true;
    while (changed)
    {
        changed = false;
        for (const [k, n] of nodes)
            if (!good.has(k) && n.edges.some(e => e.finish || e.dead || (e.to && good.has(e.to)))) { good.add(k); changed = true; }
    }
    const deadEnds = [...nodes].filter(([k]) => !good.has(k)).map(([, n]) => `(${n.s.x.toFixed(1)}, ${n.s.y.toFixed(1)}${n.s.cling ? ' cling' : ''})`);

    // fastest route, with how many hold lengths (of HOLD) make each hop
    const route = [];
    if (best)
    {
        let cur = {k: best.from, wait: best.wait, hold: best.hold, to: 'FLAG'};
        while (cur)
        {
            const n = nodes.get(cur.k);
            const target = cur.to != 'FLAG' && solidOf(nodes.get(cur.to).s);
            const window = n.edges.filter(e => e.wait == cur.wait && (cur.to == 'FLAG' ? e.finish : e.node && solidOf(e.node) == target)).length;
            const to = cur.to == 'FLAG' ? 'flag' : (t => `(${t.x.toFixed(1)}, ${t.y.toFixed(1)}${t.cling ? ' cling' : ''})`)(nodes.get(cur.to).s);
            route.unshift(`${cur.wait ? 'wait ' + cur.wait + ' ' : ''}hold ${cur.hold} → ${to} [${window}/${HOLD - MIN + 1}]`);
            cur = n.prev && {k: n.prev.k, wait: n.prev.wait, hold: n.prev.hold, to: cur.k};
        }
    }
    const startEdges = nodes.get(key(start)).edges;
    hrEmit = saved.hrEmit; hrDust = saved.hrDust; hrSparkle = saved.hrSparkle;
    setSoundEnable(true);
    return {
        level: levelId,
        nodes: nodes.size,
        finishable: !!best,
        hops: route.length,
        bestTime: best && +((best.dist - THINK * route.length) / 60).toFixed(2),   // pure play time, no pauses
        deadEnds,
        startHolds: {total: startEdges.length, dead: startEdges.filter(e => e.dead).length},
        route,
    };
};
