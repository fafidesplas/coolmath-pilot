/*
    HOP RACE - built-in ghost generator (debug tool, not loaded by the game). GDD §12 "Built-in ghost".
    For every solo level of Hop and Leap it finds the bot's fastest route, replays it with the real game code
    (hrPlayerStep), and records it the way the game records a run (every 2nd frame, 0.01 u, from the first frame
    of the timer). The ghost stands still for HR_GHOST_HEADSTART first, so it finishes that much behind the bot.
    - Hop: tools/hop-bot.js finds the route. The ghost presses to start running 2 s after GO.
    - Leap: a fastest-route search here: from every spot you can stand or cling, every hold length (1 to 70 frames),
      released at once, followed until you land, cling, fall or finish. Spots are merged on a 0.25 u grid.

    Use: serve the game over HTTP, open it, then in the console
        await import('./tools/ghost-gen.js')
        await hrMakeGhosts()          // all of Hop and Leap; or hrMakeGhosts(['leap'])
    It logs each level's bot time and ghost time, copies the new levels/ghosts.js to the clipboard and returns it.
    Paste it over levels/ghosts.js. Run it again whenever a level or a mode's physics change. Reload afterwards.
*/

const HR_GHOST_HEADSTART = 120;   // frames the ghost waits before it starts (2 s)

window.hrMakeGhosts = async function (worlds = ['hop', 'leap'])
{
    if (!window.hopBot) await import('./hop-bot.js');
    const out = {}, log = [];
    for (const w of worlds)
    {
        const wi = HR_WORLDS.findIndex(x => x.id == w);
        for (const def of hrLevelsOf(wi, false))
        {
            const g = w == 'hop' ? hopGhost(def.id) : w == 'leap' ? leapGhost(def.id) : null;
            if (!g) { log.push(`${def.id}: NO ROUTE, no ghost`); continue; }
            out[def.id] = g;
            log.push(`${def.id}: bot ${(g.botFrames / 60).toFixed(2)} s, ghost ${(g.ms / 1000).toFixed(2)} s`);
        }
    }
    hrGo('title');
    console.log(log.join('\n'));
    const text = fileText(out);
    try { await navigator.clipboard.writeText(text); } catch {}
    return text;
};

// a quiet, hand-stepped player on a level (the engine stops stepping players on the title screen)
function ghostSetup(id)
{
    window.game.start(id, false);
    hrGo('title');
    hrCountdown = 0;
    const p = hrPlayers[0];
    hrResetPlayer(p);
    p.intro = 0;
    return p;
}
function quiet(fn)
{
    const saved = {hrEmit, hrDust, hrSparkle, hrDroplet, hrSplash};
    hrEmit = hrDust = hrSparkle = hrDroplet = hrSplash = () => {};
    setSoundEnable(false);
    try { return fn(); }
    finally { ({hrEmit, hrDust, hrSparkle, hrDroplet, hrSplash} = saved); setSoundEnable(true); }
}

// records a run: positions every 2nd frame from frame 0, after a head start standing still at the start
function recorder(p)
{
    const rec = [];
    let frame = 0;
    const sample = () => { if (frame % 2 == 0) rec.push(Math.round(p.x * 100), Math.round(p.y * 100)); frame++; };
    for (let i = 0; i < HR_GHOST_HEADSTART; i++) sample();
    // one game frame: step, then record unless that step finished the level (the game stops recording there)
    const step = down =>
    {
        hrPlayerStep(p, {down, pressed: down && !p.down, released: !down && p.down});
        if (!p.finished) sample();
    };
    return {step, done: () => ({frames: frame, data: Int16Array.from(rec)})};
}

function ghostResult(r, botFrames)
{
    const bytes = new Uint8Array(r.data.buffer);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return {ms: Math.round(r.frames * 1000 / 60), botFrames, data: btoa(bin)};
}

///////////////////////////////////////////////////////////////////////////////
// Hop: replay hopBot's route

function hopGhost(id)
{
    const bot = hopBot(id);
    if (!bot.finishable) return null;
    return quiet(() =>
    {
        const p = ghostSetup(id), r = recorder(p);
        const air = () => !p.grounded && !p.cling, settled = a => a && (p.cling || p.grounded);
        r.step(true); r.step(false);   // the starting press
        for (const m of bot.inputs)
        {
            if (m.hold)
            {
                for (let i = 0; i < m.wait; i++) r.step(false);
                let a = false;
                for (let i = 0; i < m.hold + 600 && !p.finished; i++)
                {
                    r.step(i < m.hold);
                    a ||= air();
                    if (i >= 1 && settled(a)) break;
                }
            }
            else
            {
                let a = false;
                for (let i = 0; i < 600 && !p.finished; i++) { r.step(false); a ||= air(); if (settled(a)) break; }
            }
            if (p.finished) break;
        }
        if (!p.finished || p.falls) { console.warn(id, 'replay missed the flag'); return null; }
        return ghostResult(r.done(), Math.round(bot.bestTime * 60));
    });
}

///////////////////////////////////////////////////////////////////////////////
// Leap: fastest route by hold lengths, then replay it

function leapGhost(id)
{
    return quiet(() =>
    {
        const p = ghostSetup(id);
        const snap = () => Object.fromEntries(Object.entries(p).filter(([, v]) => v === undefined || typeof v != 'object' && typeof v != 'function'));
        const load = s => { Object.assign(p, s); p.trail = []; };
        const step = down => hrPlayerStep(p, {down, pressed: down && !p.down, released: !down && p.down});
        const key = s => [s.grounded ? 'g' : 'c' + s.cling, Math.round(s.x * 4), Math.round(s.y * 4), s.dir, Math.round(s.vx)].join();

        // one jump: hold `hold` frames, release, follow until settled; returns {frames, node | finish}
        function jump(s, hold)
        {
            load(s);
            const f0 = p.falls;
            let frames = 0, a = false;
            for (let i = 0; i < hold + 600; i++)
            {
                step(i < hold);
                frames++;
                if (p.finished) return {frames, finish: true};
                if (p.falls > f0) return null;
                a ||= !p.grounded && !p.cling;
                if (a && (p.grounded && !p.vx || p.cling)) return {frames, node: snap()};
            }
            return null;
        }

        const start = snap(), nodes = new Map([['start', {s: start, dist: 0, prev: null}]]);
        const queue = ['start'];
        let best = null;
        while (queue.length)
        {
            queue.sort((a, b) => nodes.get(a).dist - nodes.get(b).dist);
            const k = queue.shift(), n = nodes.get(k);
            if (n.done) continue;
            n.done = true;
            if (best && n.dist >= best.dist) break;
            for (let hold = 1; hold <= 70; hold++)
            {
                const m = jump(n.s, hold);
                if (!m) continue;
                const d = n.dist + m.frames;
                if (m.finish) { if (!best || d < best.dist) best = {dist: d, from: k, hold}; continue; }
                const to = key(m.node), o = nodes.get(to);
                if (!o) { nodes.set(to, {s: m.node, dist: d, prev: {k, hold}}); queue.push(to); }
                else if (d < o.dist && !o.done) Object.assign(o, {s: m.node, dist: d, prev: {k, hold}});
            }
        }
        if (!best) return null;
        const holds = [best.hold];
        for (let n = nodes.get(best.from); n.prev; n = nodes.get(n.prev.k)) holds.unshift(n.prev.hold);

        // replay from the start with the recorder
        const q = ghostSetup(id), r = recorder(q);
        for (const hold of holds)
        {
            let a = false;
            for (let i = 0; i < hold + 600 && !q.finished; i++)
            {
                r.step(i < hold);
                a ||= !q.grounded && !q.cling;
                if (a && (q.grounded && !q.vx || q.cling)) break;
            }
        }
        if (!q.finished || q.falls) { console.warn(id, 'replay missed the flag'); return null; }
        return ghostResult(r.done(), best.dist);
    });
}

///////////////////////////////////////////////////////////////////////////////

function fileText(ghosts)
{
    const lines = Object.entries(ghosts).map(([id, g]) =>
        `    '${id}': {ms: ${g.ms}, data: '${g.data}'},   // bot ${(g.botFrames / 60).toFixed(2)} s`);
    return `/*
    HOP RACE - built-in ghosts (GDD §12). Made by tools/ghost-gen.js: the bot's fastest route on each level, recorded
    like a player's run (base64 Int16 x, y pairs every 2nd frame, in 0.01 u), standing still for 2 s first, so it
    finishes 2 s behind the bot. A level shows its built-in ghost until you set your own best. Don't edit by hand:
    run the generator again when a level or a mode's physics change.
*/

'use strict';

const HR_GHOSTS = {
${lines.join('\n')}
};
`;
}
