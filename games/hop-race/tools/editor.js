/*
    HOP RACE - level editor (debug tool). index.html loads it after main.js; build.json leaves it out,
    so release builds never have it, and every hook in the game is a no-op without it (window.hrEditor?.).

    E on any screen opens the level you are on (or the first level of the menu's world); E again plays it
    from its start (Shift+E: from the mouse), and E comes back. ?edit or ?edit=hop-07 in the URL opens it
    on load. Save writes levels/<world>.js in place (Chrome's file access: pick the game or levels folder
    once): only the edited levels' entries change, their comments are kept, and Climb's seeded teeth stay
    one hrClimbTeeth(...) line unless a tooth was edited.

    Mouse: click to select, drag to move, drag an edge of the selected solid to resize, drag on empty
    space to draw a new solid. Alt: no snapping (0.25 u grid). Keys are listed in the panel.
*/

'use strict';

window.hrEditor = (() =>
{
    const PANEL = 300;      // panel width in CSS px
    const HERE = document.currentScript.src;   // tools/ (the bot is loaded from next to this file)
    const ED = {active: false, testing: false};
    let world = 0, def = null, sel = null, hover = null, drag = null;
    let undo = [], redo = [];
    const dirty = new Set();        // level defs changed since the last save
    const fileId = new WeakMap();   // def -> its id in the file (missing: a new level, appended on save)
    const groups = new WeakMap();   // def -> solid index -> line in the file's solids block, as of the last load/save
    let bot = null, status = '', dirHandle = null, finishMs = -1;

    const levelsOf = w => HR_LEVELS[HR_WORLDS[w].id];
    const worlds = () => HR_WORLDS.map((w, i) => i).filter(i => !HR_WORLDS[i].hidden && HR_LEVELS[HR_WORLDS[i].id]);
    const hide = (o, k, v) => (Object.defineProperty(o, k, {value: v, writable: true, configurable: true}), o);
    const box = () => ({hw: hrLevel.w / 2, hh: hrLevel.h / 2});

    ///////////////////////////////////////////////////////////////////////////
    // snapshots (undo) keep the hidden markers: _o (index in the file) and _teeth (Climb's seeded teeth)

    const cloneSolid = s => hide(hide({...s}, '_o', s._o), '_teeth', s._teeth);
    function cloneDef(d)
    {
        const c = {...d, start: {...d.start}, flag: {...d.flag}, solids: d.solids.map(cloneSolid)};
        if (d.gates) c.gates = d.gates.map(g => hide({solid: cloneSolid(g.solid), button: {...g.button}}, '_o', g._o));
        if (d.promptAt) c.promptAt = {...d.promptAt};
        return c;
    }
    function restore(snap)
    {
        for (const k of Object.keys(def)) delete def[k];
        Object.assign(def, cloneDef(snap));
    }
    function snapshot() { undo.push(cloneDef(def)); if (undo.length > 200) undo.shift(); redo = []; }
    function changed() { dirty.add(def); status = ''; reload(); refreshPanel(); }
    // a tooth that is edited is no longer part of its hrClimbTeeth(...) call
    const touch = s => { if (s && s._teeth) s._teeth = null; };

    ///////////////////////////////////////////////////////////////////////////
    // open, play, close

    function open(w, index)
    {
        world = w;
        def = levelsOf(w)[index];
        if (!fileId.has(def) && !def._new) fileId.set(def, def.id);
        if (!groups.has(def)) markLoaded(def);
        sel = hover = drag = null;
        undo = []; redo = []; bot = null; finishMs = -1;
        ED.active = true; ED.testing = false;
        start();
        panel.style.display = 'block';
        refreshPanel();
    }

    // load the level into the game and stop it there: the editor draws over the real level
    function start()
    {
        hrEditDef = def;
        hrStartLevel(world, levelsOf(world).indexOf(def), false);
    }
    function reload() { hrLoadLevel(def); hrPlayers.forEach(hrResetPlayer); }

    function play(fromMouse)
    {
        ED.active = false; ED.testing = true; finishMs = -1;
        drag = null;
        start();
        if (fromMouse)
        {
            const p = hrPlayers[0];
            p.x = mousePos.x; p.y = mousePos.y;
            p.grounded = false; p.cling = 0;
        }
        hrCameraReset();
        refreshPanel();
    }

    function backToEdit()
    {
        ED.testing = false; ED.active = true;
        start();
        refreshPanel();
    }

    function close()
    {
        ED.active = ED.testing = false;
        hrEditDef = null;
        panel.style.display = 'none';
        hrCameraReset();
        hrGo('title');
    }

    function toggle(shift)
    {
        if (ED.testing) return backToEdit();
        if (ED.active) return play(shift);
        // open on the level you are on, or the first level of the menu's world
        if (hrInWorld()) open(hrWorld, levelsOf(hrWorld).indexOf(hrLevelDef()));
        else open(HR_WORLDS[hrMenuWorld].hidden ? 0 : hrMenuWorld, 0);
    }

    ///////////////////////////////////////////////////////////////////////////
    // the frame: hooks from main.js and camera.js

    ED.update = () =>
    {
        if (ED.testing)
        {
            if (!HR_WORLD_SCREENS.includes(hrScreen)) { ED.testing = false; hrEditDef = null; panel.style.display = 'none'; }
            else if (hrFinishT >= .4) { backToEdit(); status = `Finished in ${hrFmt(finishMs)} s`; refreshPanel(); }
            return false;
        }
        if (!ED.active) return false;
        hrPointerQueue = [];   // clicks in the editor never reach the game
        mouse();
        return true;
    };

    ED.finished = (p, ms) =>
    {
        hrRun.started = false;
        finishMs = ms;
        hrFinishFx(p);
    };

    // fit the level box (plus a little room around it) into the canvas left of the panel
    ED.fitCamera = () =>
    {
        if (!ED.active) return false;
        const pw = PANEL * mainCanvasSize.x / innerWidth;
        cameraScale = min((mainCanvasSize.x - pw) / (hrLevel.w + 3), mainCanvasSize.y / (hrLevel.h + 3));
        cameraPos = vec2(pw / 2 / cameraScale, 0);
        return true;
    };

    ///////////////////////////////////////////////////////////////////////////
    // picking and dragging

    const snap = v => keyIsDown('AltLeft') || keyIsDown('AltRight') ? Math.round(v * 20) / 20 : Math.round(v * 4) / 4;
    const overPanel = () => mousePosScreen.x > mainCanvasSize.x - PANEL * mainCanvasSize.x / innerWidth;

    // the part of a solid you can see (deep floors and hanging blocks run off the level box)
    function vis(s)
    {
        const {hh} = box();
        return {l: s.l, r: s.r, top: min(s.top, hh + HR_MARGIN), bottom: max(s.bottom ?? -1e9, hrLevel.killY - .5)};
    }
    const inside = (v, p, pad = 0) => p.x > v.l - pad && p.x < v.r + pad && p.y > v.bottom - pad && p.y < v.top + pad;
    const promptPos = () => def.promptAt ? vec2(def.promptAt.x, def.promptAt.y) : vec2(0, def.start.y + 6);

    function pick(p)
    {
        const near = (x, y, r) => Math.hypot(p.x - x, p.y - y) < r;
        if (near(def.start.x, def.start.y + .4, .6)) return {type: 'start'};
        if (inside({l: def.flag.x - .2, r: def.flag.x + 1.5, bottom: def.flag.y, top: def.flag.y + 3}, p)) return {type: 'flag'};
        if (def.prompt && near(promptPos().x, promptPos().y, .7)) return {type: 'prompt'};
        for (let i = (def.gates || []).length; i--;)
        {
            const g = def.gates[i];
            if (near(g.button.x, g.button.y, .7)) return {type: 'button', i};
            if (inside(vis(g.solid), p)) return {type: 'gate', i};
        }
        for (let i = def.solids.length; i--;)
            if (inside(vis(def.solids[i]), p)) return {type: 'solid', i};
        return null;
    }

    const selSolid = () => sel?.type == 'solid' ? def.solids[sel.i] : sel?.type == 'gate' ? def.gates[sel.i].solid : null;

    // which edges of the selected solid the mouse is on (to resize)
    function edgesAt(p)
    {
        const s = selSolid();
        if (!s) return null;
        const v = vis(s), {hh} = box(), d = .2, e = {};
        if (!inside(v, p, d)) return null;
        if (Math.abs(p.x - s.l) < d) e.l = 1;
        if (Math.abs(p.x - s.r) < d) e.r = 1;
        if (Math.abs(p.y - s.top) < d && s.top < hh) e.top = 1;
        if (s.bottom !== undefined && Math.abs(p.y - s.bottom) < d && s.bottom > hrLevel.killY) e.bottom = 1;
        return Object.keys(e).length ? e : null;
    }

    function mouse()
    {
        const p = mousePos;
        if (!drag) hover = overPanel() ? null : pick(p);
        if (mouseWasPressed(0) && !overPanel())
        {
            const edges = edgesAt(p);
            if (edges) drag = {mode: 'edge', edges, snapped: false};
            else
            {
                sel = pick(p);
                drag = sel ? {mode: 'move', from: vec2(snap(p.x), snap(p.y)), snapped: false}
                    : {mode: 'new', from: vec2(snap(p.x), snap(p.y))};
            }
            refreshPanel();
        }
        if (drag && mouseIsDown(0)) dragTo(vec2(snap(p.x), snap(p.y)));
        if (drag && mouseWasReleased(0))
        {
            if (drag.mode == 'new') addSolid(drag.from, vec2(snap(p.x), snap(p.y)));
            else if (drag.snapped && (sel.type == 'start' || sel.type == 'flag')) dropToFloor(sel.type == 'start' ? def.start : def.flag);
            drag = null;
            refreshPanel();
        }
    }

    function dragTo(q)
    {
        if (drag.mode == 'new') { drag.to = q; return; }
        if (drag.mode == 'move')
        {
            const d = q.subtract(drag.from);
            if (!d.x && !d.y) return;
            if (!drag.snapped) { snapshot(); drag.snapped = true; }
            drag.from = q;
            move(d.x, d.y);
            return changed();
        }
        // resize one or two edges, keeping at least a quarter unit
        const s = selSolid();
        if (!drag.snapped) { snapshot(); drag.snapped = true; touch(s); }
        const e = drag.edges;
        if (e.l) s.l = min(q.x, s.r - .25);
        if (e.r) s.r = max(q.x, s.l + .25);
        if (e.top) s.top = max(q.y, (s.bottom ?? -1e9) + .25);
        if (e.bottom) s.bottom = min(q.y, s.top - .25);
        changed();
    }

    // move the selection; a hanging block moves its bottom, a floor its top, so they stay attached
    function move(dx, dy)
    {
        const {hh} = box();
        const moveSolid = s =>
        {
            touch(s);
            s.l += dx; s.r += dx;
            if (s.top >= hh - .01 && s.bottom !== undefined) s.bottom = min(s.bottom + dy, s.top - .25);
            else { s.top += dy; if (s.bottom !== undefined) s.bottom += dy; }
        };
        const shift = o => { o.x += dx; o.y += dy; };
        if (sel.type == 'solid') moveSolid(def.solids[sel.i]);
        else if (sel.type == 'gate') { moveSolid(def.gates[sel.i].solid); shift(def.gates[sel.i].button); }
        else if (sel.type == 'button') shift(def.gates[sel.i].button);
        else if (sel.type == 'start') shift(def.start);
        else if (sel.type == 'flag') shift(def.flag);
        else if (sel.type == 'prompt') { const p = promptPos(); def.promptAt = {x: p.x, y: p.y}; shift(def.promptAt); }
    }

    // the start and the flag's pole foot sit on the highest floor under them (within half a unit above)
    function dropToFloor(o)
    {
        const under = def.solids.filter(s => o.x > s.l && o.x < s.r && s.top <= o.y + .5).map(s => s.top);
        if (under.length) { o.y = max(...under); changed(); }
    }

    // a new solid from a drag; one reaching the bottom of the box is a floor, one reaching the top hangs
    function addSolid(a, b)
    {
        const l = min(a.x, b.x), r = max(a.x, b.x), bottom = min(a.y, b.y), top = max(a.y, b.y);
        if (r - l < .25 || top - bottom < .25) { sel = null; return; }
        const {hh} = box(), s = {l, r, top};
        if (top >= hh - .01) s.top = Math.ceil(hh) + 3;
        if (bottom > -hh + .01) s.bottom = bottom;
        snapshot();
        def.solids.push(s);
        sel = {type: 'solid', i: def.solids.length - 1};
        changed();
    }

    ///////////////////////////////////////////////////////////////////////////
    // keys (a DOM listener, so Cmd+S and Cmd+Z work and nothing fires while typing in the panel)

    function key(e)
    {
        const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
        const cmd = e.metaKey || e.ctrlKey;
        if (cmd && e.code == 'KeyS' && (ED.active || ED.testing)) { e.preventDefault(); return save(); }
        if (typing) return;
        if (e.code == 'KeyE' && !cmd && !e.repeat) { e.preventDefault(); return toggle(e.shiftKey); }
        if (!ED.active) return;
        if (cmd && e.code == 'KeyZ') { e.preventDefault(); return e.shiftKey ? doRedo() : doUndo(); }
        if (cmd) return;
        const s = selSolid(), flagKeys = {KeyG: 'grip', KeyI: 'ice', KeyK: 'sticky', KeyN: 'nogrip'};
        if (flagKeys[e.code] && s) { snapshot(); touch(s); s[flagKeys[e.code]] ? delete s[flagKeys[e.code]] : s[flagKeys[e.code]] = true; return changed(); }
        const nudge = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1]}[e.code];
        if (nudge && sel) { e.preventDefault(); const k = e.shiftKey ? 1 : .25; snapshot(); move(nudge[0] * k, nudge[1] * k); return changed(); }
        switch (e.code)
        {
            case 'Backspace': case 'Delete': return remove();
            case 'Escape': sel = null; return refreshPanel();
            case 'KeyD': return duplicate();
            case 'KeyF': return s && setFloating(s, s.bottom === undefined);
            case 'KeyH': return s && setHanging(s, s.top < box().hh);
            case 'KeyT': return gateToggle();
            case 'BracketLeft': return setSize(def.size - 1);
            case 'BracketRight': return setSize(def.size + 1);
            case 'Comma': return step(-1);
            case 'Period': return step(1);
        }
    }

    function remove()
    {
        if (sel?.type == 'solid') { snapshot(); def.solids.splice(sel.i, 1); }
        else if (sel?.type == 'gate' || sel?.type == 'button') { snapshot(); def.gates.splice(sel.i, 1); if (!def.gates.length) delete def.gates; }
        else if (sel?.type == 'prompt') { snapshot(); delete def.promptAt; }
        else return;
        sel = null;
        changed();
    }

    function duplicate()
    {
        const s = selSolid();
        if (!s || sel.type != 'solid') return;
        snapshot();
        const c = {...s, l: s.l + 1, r: s.r + 1};
        def.solids.push(c);
        sel = {type: 'solid', i: def.solids.length - 1};
        changed();
    }

    // F: a floor runs down off the level; floating gives it a bottom 1 u under its top
    function setFloating(s, on)
    {
        snapshot(); touch(s);
        if (on) s.bottom = max(s.top - 1, box().hh * -1 - .5); else delete s.bottom;
        changed();
    }
    // H: hanging blocks run up off the top of the level box
    function setHanging(s, on)
    {
        snapshot(); touch(s);
        if (on) { if (s.bottom === undefined) s.bottom = s.top - 1; s.top = Math.ceil(box().hh) + 3; }
        else s.top = (s.bottom ?? 0) + 1;
        changed();
    }
    // T (Rocket): a selected solid becomes a gate with a button 3 u to its left, and back
    function gateToggle()
    {
        if (HR_WORLDS[world].id != 'rocket') return;
        snapshot();
        if (sel?.type == 'solid')
        {
            const s = def.solids.splice(sel.i, 1)[0];
            if (s.bottom === undefined) s.bottom = s.top - 3;
            (def.gates = def.gates || []).push({solid: s, button: {x: s.l - 3, y: s.top - 1}});
            sel = {type: 'gate', i: def.gates.length - 1};
        }
        else if (sel?.type == 'gate')
        {
            def.solids.push(def.gates.splice(sel.i, 1)[0].solid);
            if (!def.gates.length) delete def.gates;
            sel = {type: 'solid', i: def.solids.length - 1};
        }
        else return void undo.pop();
        changed();
    }
    function setSize(n)
    {
        n = clamp(n, 16, 40);
        if (n == def.size) return;
        snapshot(); def.size = n; changed();
    }
    function step(d)
    {
        const list = levelsOf(world), i = list.indexOf(def) + d;
        if (i >= 0 && i < list.length) open(world, i);
    }
    function doUndo() { if (!undo.length) return; redo.push(cloneDef(def)); restore(undo.pop()); sel = null; changed(); }
    function doRedo() { if (!redo.length) return; undo.push(cloneDef(def)); restore(redo.pop()); sel = null; changed(); }

    function newLevel(copy)
    {
        const w = HR_WORLDS[world].id, list = levelsOf(world);
        let n = list.length + 1, id;
        while (list.some(l => l.id == (id = `${w}-${String(n).padStart(2, '0')}`))) n++;
        const d = copy ? cloneDef(def) : {size: 26, start: {x: -10, y: -4}, solids: [{l: -14, r: 14, top: -4}], flag: {x: 10, y: -4}};
        Object.assign(d, {id, name: copy ? def.name + ' copy' : 'New Level'});
        d.solids.forEach(s => hide(s, '_o', undefined));
        hide(d, '_new', true);
        list.push(d);
        groups.set(d, []);
        dirty.add(d);
        open(world, list.length - 1);
    }

    ///////////////////////////////////////////////////////////////////////////
    // bot check (Hop only): tools/hop-bot.js from every standable spot

    async function runBot()
    {
        if (HR_WORLDS[world].id != 'hop') return;
        status = 'Checking…'; refreshPanel();
        if (!window.hopBot) await import(new URL('hop-bot.js', HERE));
        await new Promise(r => setTimeout(r, 30));   // let the panel show "Checking…"
        const r = hopBot(def.id, {started: true});
        start();   // the bot leaves the game on the title screen
        bot = r;
        status = !r.finishable ? 'Bot: can\'t reach the flag' :
            `Bot: ${r.bestTime} s, ${r.hops} hops, tightest ${Math.min(...r.routeSpots.slice(0, -1).map(s => s.holds), 163)}/163 ` +
            `(not counting the leap at the flag), ${r.deadEnds.length} dead end${r.deadEnds.length == 1 ? '' : 's'}`;
        refreshPanel();
    }

    ///////////////////////////////////////////////////////////////////////////
    // saving: write the changed levels into levels/<world>.js

    const num = n => String(Math.round(n * 1000) / 1000 || 0);
    const str = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`;
    function lit(v)
    {
        if (typeof v == 'number') return num(v);
        if (typeof v == 'string') return str(v);
        if (Array.isArray(v)) return `[${v.map(lit).join(', ')}]`;
        if (v && typeof v == 'object') return `{${Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${k}: ${lit(x)}`).join(', ')}}`;
        return String(v);
    }
    // solids keep the files' order: l, r, top, bottom, then the flags
    function solidLit(s)
    {
        const keys = ['l', 'r', 'top', 'bottom', 'grip', 'ice', 'sticky', 'nogrip'];
        const o = {};
        for (const k of keys) if (s[k] !== undefined && s[k] !== false) o[k] = s[k];
        for (const k of Object.keys(s)) if (!keys.includes(k)) o[k] = s[k];
        return lit(o);
    }
    const teethCall = c => `...hrClimbTeeth(${[c.seed, c.face, c.side, c.from, c.to].map(num).join(', ')}${c.opt && Object.keys(c.opt).length ? ', ' + lit(c.opt) : ''})`;
    const withComment = (code, c) => c ? code + c : code;   // c keeps the spaces it had before the //

    // the solids' lines as of the last load/save: Climb's teeth from one call share one line
    function markLoaded(d)
    {
        const g = [];
        let line = -1;
        d.solids.forEach((s, i) => { if (!(s._teeth && i && d.solids[i - 1]._teeth == s._teeth)) line++; g.push(line); hide(s, '_o', i); });
        (d.gates || []).forEach((gt, i) => hide(gt, '_o', i));
        groups.set(d, g);
    }

    // comments in a level's source, by field and by solid/gate line
    function parseComments(body)
    {
        const fields = {}, solids = [], gates = [];
        let block = null;
        for (const line of body.split('\n'))
        {
            const m = line.match(/^(.*?\S)(\s*\/\/.*)$/), code = m ? m[1] : line, comment = m ? m[2] : '';
            if (/^ {8}solids: \[/.test(code)) { block = solids; continue; }
            if (/^ {8}gates: \[/.test(code)) { block = gates; continue; }
            if (block && /^ {8}\]/.test(code)) { block = null; continue; }
            if (block) { if (/^ {12}(\{|\.\.\.)/.test(code)) block.push(comment); continue; }
            const f = code.match(/^ {8}(\w+):/);
            if (f) fields[f[1]] = comment;
        }
        return {fields, solids, gates};
    }

    function levelSource(d, old)
    {
        const c = old ? parseComments(old) : {fields: {}, solids: [], gates: []};
        const g = groups.get(d) || [];
        const lineCount = g.length ? g[g.length - 1] + 1 : 0;
        // each old line's comment goes on the first solid that came from it (expanded teeth share one line)
        const used = new Set();
        const solidComment = s =>
        {
            if (s._o === undefined || c.solids.length != lineCount || used.has(g[s._o])) return '';
            used.add(g[s._o]);
            return c.solids[g[s._o]] || '';
        };
        const out = ['    {'];
        const put = (k, code) => out.push(withComment('        ' + code, c.fields[k]));
        if (d.draft) put('draft', 'draft: true,');
        out.push(withComment(`        id: ${str(d.id)}, name: ${str(d.name)},`, c.fields.id));
        put('size', `size: ${num(d.size)},`);
        put('start', `start: ${lit(d.start)},`);
        put('solids', 'solids: [');
        for (let i = 0; i < d.solids.length;)
        {
            const s = d.solids[i];
            if (s._teeth)
            {
                let j = i;
                while (j < d.solids.length && d.solids[j]._teeth == s._teeth) j++;
                if (j - i == s._teeth.n) { out.push(withComment('            ' + teethCall(s._teeth) + ',', solidComment(s))); i = j; continue; }
            }
            out.push(withComment('            ' + solidLit(s) + ',', solidComment(s)));
            i++;
        }
        out.push('        ],');
        if (d.gates?.length)
        {
            put('gates', 'gates: [');
            for (const gt of d.gates)
                out.push(withComment(`            {solid: ${solidLit(gt.solid)}, button: ${lit(gt.button)}},`, gt._o !== undefined ? c.gates[gt._o] || '' : ''));
            out.push('        ],');
        }
        const known = ['draft', 'id', 'name', 'size', 'start', 'solids', 'gates', 'flag', 'prompt', 'promptAt'];
        for (const k of Object.keys(d)) if (!known.includes(k) && d[k] !== undefined) put(k, `${k}: ${lit(d[k])},`);
        put('flag', `flag: ${lit(d.flag)},`);
        if (d.prompt) put('prompt', `prompt: ${str(d.prompt)},`);
        if (d.promptAt) put('promptAt', `promptAt: ${lit(d.promptAt)},`);
        out.push('    },');
        return out.join('\n') + '\n';
    }

    // the span of one level's object in a file, from its "    {" line to after its "},"
    function findLevel(text, id)
    {
        const at = text.indexOf(`id: ${str(id)}`);
        if (at < 0) return null;
        const start = text.lastIndexOf('\n    {\n', at) + 1;
        const end = matchClose(text, text.indexOf('{', start), '{', '}');
        let e = end + 1;
        if (text[e] == ',') e++;
        if (text[e] == '\n') e++;
        return {start, end: e, body: text.slice(start, e)};
    }
    // index of the bracket that closes the one at i, skipping strings and // comments
    function matchClose(text, i, open, closeCh)
    {
        let depth = 0, q = null;
        for (; i < text.length; i++)
        {
            const ch = text[i];
            if (q) { if (ch == '\\') i++; else if (ch == q) q = null; continue; }
            if (ch == '\'' || ch == '"' || ch == '`') { q = ch; continue; }
            if (ch == '/' && text[i + 1] == '/') { i = text.indexOf('\n', i); continue; }
            if (ch == open) depth++;
            else if (ch == closeCh && --depth == 0) return i;
        }
        throw new Error('unbalanced ' + open);
    }

    // the levels folder: asked for once (the game folder or levels/ itself), remembered in IndexedDB
    const idb = (mode, fn) => new Promise((ok, fail) =>
    {
        const req = indexedDB.open('hop-race-editor', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () =>
        {
            try { const r = fn(req.result.transaction('kv', mode).objectStore('kv')); r.onsuccess = () => ok(r.result); r.onerror = fail; }
            catch (e) { fail(e); }   // e.g. a handle that can't be stored: the save goes on, it just asks again next time
        };
        req.onerror = fail;
    });
    async function levelsDir()
    {
        if (!window.showDirectoryPicker) throw new Error('Saving needs Chrome or Edge (file access)');
        if (!dirHandle) dirHandle = await idb('readonly', s => s.get('dir')).catch(() => null);
        // a remembered folder that was moved or lost its permission is forgotten, and you are asked again
        if (dirHandle) try { if (await dirHandle.requestPermission({mode: 'readwrite'}) != 'granted') dirHandle = null; } catch { dirHandle = null; }
        if (!dirHandle)
        {
            dirHandle = await showDirectoryPicker({id: 'hop-race-levels', mode: 'readwrite'});
            await idb('readwrite', s => s.put(dirHandle, 'dir')).catch(() => {});
        }
        if (dirHandle.name == 'levels') return dirHandle;
        try { return await dirHandle.getDirectoryHandle('levels'); }
        catch { dirHandle = null; throw new Error('Pick the hop-race folder or its levels folder'); }
    }

    async function save()
    {
        if (!dirty.size) { status = 'Nothing to save'; return refreshPanel(); }
        try
        {
            const dir = await levelsDir();
            for (const w of worlds())
            {
                const id = HR_WORLDS[w].id, defs = levelsOf(w).filter(d => dirty.has(d));
                if (!defs.length) continue;
                const fh = await dir.getFileHandle(id + '.js');
                let text = await (await fh.getFile()).text();
                for (const d of defs)
                {
                    const span = fileId.has(d) && findLevel(text, fileId.get(d));
                    if (span) text = text.slice(0, span.start) + levelSource(d, span.body) + text.slice(span.end);
                    else
                    {
                        // a new level goes at the end of HR_LEVELS.<world>
                        const head = text.indexOf(`HR_LEVELS.${id} = [`);
                        const close = matchClose(text, text.indexOf('[', head), '[', ']');
                        const at = text.lastIndexOf('\n', close) + 1;
                        text = text.slice(0, at) + levelSource(d) + text.slice(at);
                    }
                }
                const out = await fh.createWritable();
                await out.write(text);
                await out.close();
                for (const d of defs) { fileId.set(d, d.id); markLoaded(d); dirty.delete(d); delete d._new; }
            }
            status = 'Saved';
        }
        catch (e) { status = e.name == 'AbortError' ? 'Save cancelled' : 'Save failed: ' + e.message; }
        refreshPanel();
    }

    ///////////////////////////////////////////////////////////////////////////
    // drawing over the level (world space)

    function outline(v, w, c)
    {
        drawLine(vec2(v.l, v.bottom), vec2(v.r, v.bottom), w, c);
        drawLine(vec2(v.r, v.bottom), vec2(v.r, v.top), w, c);
        drawLine(vec2(v.r, v.top), vec2(v.l, v.top), w, c);
        drawLine(vec2(v.l, v.top), vec2(v.l, v.bottom), w, c);
    }
    function boundsOf(s)
    {
        if (!s) return null;
        if (s.type == 'solid') return vis(def.solids[s.i]);
        if (s.type == 'gate') return vis(def.gates[s.i].solid);
        if (s.type == 'button') { const b = def.gates[s.i].button; return {l: b.x - .55, r: b.x + .55, bottom: b.y - .55, top: b.y + .55}; }
        if (s.type == 'start') return {l: def.start.x - .4, r: def.start.x + .4, bottom: def.start.y, top: def.start.y + .8};
        if (s.type == 'flag') return {l: def.flag.x - .1, r: def.flag.x + 1.4, bottom: def.flag.y, top: def.flag.y + 3};
        if (s.type == 'prompt') { const p = promptPos(); return {l: p.x - .7, r: p.x + .7, bottom: p.y - .45, top: p.y + .45}; }
    }

    ED.render = () =>
    {
        if (!ED.active) return;
        const {hw, hh} = box(), ink = HR_INK, faint = ink.scale(1, .08);
        for (let x = Math.ceil(-hw); x <= hw; x++) drawLine(vec2(x, -hh), vec2(x, hh), x ? .02 : .05, faint);
        for (let y = Math.ceil(-hh); y <= hh; y++) drawLine(vec2(-hw, y), vec2(hw, y), y ? .02 : .05, faint);
        outline({l: -hw, r: hw, bottom: -hh, top: hh}, .06, ink.scale(1, .5));
        // the HUD's spots: keep the top 1.5 u clear near the center and the right edge (GDD §6)
        const hud = HR_RED.scale(1, .14);
        drawRect(vec2(0, hh - .75), vec2(5, 1.5), hud);
        drawRect(vec2(hw - 2.5, hh - .75), vec2(5, 1.5), hud);
        // kill line
        for (let x = -hw; x < hw; x += .6) drawLine(vec2(x, hrLevel.killY), vec2(x + .3, hrLevel.killY), .05, HR_RED.scale(1, .6));
        // start (players are drawn there anyway), flag box and prompt spot
        outline(boundsOf({type: 'start'}), .05, ink.scale(1, .6));
        if (def.prompt)
        {
            const p = promptPos();
            outline(boundsOf({type: 'prompt'}), .04, ink.scale(1, .4));
            if (!hrRun.prompt) drawText(def.prompt, p, .9, ink.scale(1, .45), 0, BLACK, 'center', HR_FONT, HR_FONT_STYLE);
        }
        const b = hrLevel.flagBox;
        outline({l: b.pos.x - b.size.x / 2, r: b.pos.x + b.size.x / 2, bottom: b.pos.y - b.size.y / 2, top: b.pos.y + b.size.y / 2}, .04, ink.scale(1, .3));
        // Climb's seeded teeth get a dotted outline, so you can tell them from hand-placed solids
        for (const s of def.solids) if (s._teeth) outline(vis(s), .03, HR_WHITE.scale(1, .6));
        // hover and selection, with resize handles on the selected solid's edges
        if (hover && !(sel && hover.type == sel.type && hover.i == sel.i)) outline(boundsOf(hover), .06, HR_BLUE.scale(1, .45));
        if (sel)
        {
            const v = boundsOf(sel);
            outline(v, .1, HR_BLUE);
            if (selSolid())
            {
                const s = selSolid(), hs = vec2(.22);
                drawRect(vec2(s.l, (v.top + v.bottom) / 2), hs, HR_BLUE);
                drawRect(vec2(s.r, (v.top + v.bottom) / 2), hs, HR_BLUE);
                if (s.top < hh) drawRect(vec2((s.l + s.r) / 2, s.top), hs, HR_BLUE);
                if (s.bottom !== undefined && s.bottom > hrLevel.killY) drawRect(vec2((s.l + s.r) / 2, s.bottom), hs, HR_BLUE);
            }
        }
        if (drag?.mode == 'new' && drag.to)
        {
            const a = drag.from, c = drag.to;
            outline({l: min(a.x, c.x), r: max(a.x, c.x), bottom: min(a.y, c.y), top: max(a.y, c.y)}, .07, HR_BLUE);
        }
        // the bot's fastest route (numbered hops) and any dead ends
        if (bot)
        {
            bot.routeSpots.forEach((s, i) =>
            {
                drawCircle(vec2(s.x, s.y), .55, HR_WHITE);
                drawText(String(i + 1), vec2(s.x, s.y - .02), .4, ink, 0, BLACK, 'center', HR_FONT, HR_FONT_STYLE);
            });
            for (const s of bot.deadSpots)
            {
                drawLine(vec2(s.x - .3, s.y - .3), vec2(s.x + .3, s.y + .3), .12, HR_RED);
                drawLine(vec2(s.x - .3, s.y + .3), vec2(s.x + .3, s.y - .3), .12, HR_RED);
            }
        }
        // cursor position
        if (!overPanel())
            drawText(`${num(snap(mousePos.x))}, ${num(snap(mousePos.y))}`, mousePos.add(vec2(.3, .5)), .4, ink.scale(1, .6), 0, BLACK, 'left');
    };

    ///////////////////////////////////////////////////////////////////////////
    // the panel (DOM, right side)

    const panel = document.createElement('div');
    panel.style.cssText = `position:fixed;top:0;right:0;width:${PANEL}px;height:100%;overflow-y:auto;box-sizing:border-box;
        padding:14px;background:#1D1A22;color:#EDEAF2;font:13px/1.4 system-ui,sans-serif;display:none;z-index:10`;
    // LittleJS cancels every mousedown on the page, which would stop the fields from taking focus
    for (const ev of ['mousedown', 'wheel']) panel.addEventListener(ev, e => e.stopPropagation());
    document.body.appendChild(panel);
    const css = document.createElement('style');
    css.textContent = `
        .hred h2{font-size:15px;margin:0 0 10px;display:flex;justify-content:space-between}
        .hred h3{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#FFC94A;margin:16px 0 6px}
        .hred label{display:flex;align-items:center;gap:8px;margin:4px 0}
        .hred label span{width:62px;color:#A9A4B0}
        .hred input[type=text],.hred input[type=number],.hred select{flex:1;min-width:0;width:100%;background:#2C2833;color:#fff;border:1px solid #4A4552;padding:4px 6px;font:inherit}
        .hred .row{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
        .hred button{background:#2C2833;color:#fff;border:1px solid #4A4552;padding:5px 9px;font:inherit;cursor:pointer}
        .hred button.go{background:#FFC94A;color:#1D1A22;border-color:#FFC94A;font-weight:700}
        .hred button:disabled{opacity:.4;cursor:default}
        .hred .status{margin-top:10px;padding:6px 8px;background:#2C2833;min-height:18px}
        .hred .keys{color:#A9A4B0;font-size:12px}
        .hred .keys b{color:#EDEAF2;font-weight:600}
        .hred input[type=checkbox]{width:auto;margin:0}
        .hred .grid4{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 10px}
        .hred .grid4 label span{width:auto;min-width:40px}`;
    document.head.appendChild(css);
    panel.className = 'hred';

    const el = (tag, attrs = {}, kids = []) =>
    {
        const e = Object.assign(document.createElement(tag), attrs);
        for (const k of [].concat(kids)) e.append(k);
        return e;
    };
    const field = (label, input) => el('label', {}, [el('span', {textContent: label}), input]);
    const button = (text, fn, cls = '') => el('button', {textContent: text, className: cls, onclick: fn});

    // a text or number field bound to a getter/setter; edits are one undo step each
    function input(type, get, set, attrs = {})
    {
        const i = el('input', {type, value: get() === undefined ? '' : type == 'number' ? num(get()) : get(), ...attrs});
        i.onchange = () =>
        {
            const v = type == 'number' ? parseFloat(i.value) : i.value;
            if (type == 'number' && !isFinite(v)) return refreshPanel();
            snapshot(); set(v); changed();
        };
        return i;
    }
    function checkbox(label, get, set)
    {
        const c = el('input', {type: 'checkbox', checked: !!get()});
        c.onchange = () => { snapshot(); set(c.checked); changed(); };
        return el('label', {}, [c, label]);
    }

    function refreshPanel()
    {
        if (!def) return;
        panel.replaceChildren();
        const unsaved = [...dirty].map(d => d.id);
        panel.append(el('h2', {}, [el('span', {textContent: 'Level editor'}), button('Close', close)]));

        // level list: every world's levels, drafts included
        const pickLevel = el('select', {onchange: e => { const [w, i] = e.target.value.split(':').map(Number); open(w, i); }});
        for (const w of worlds())
            levelsOf(w).forEach((d, i) => pickLevel.append(el('option', {value: `${w}:${i}`, selected: d == def,
                textContent: `${HR_WORLDS[w].name} ${i + 1}: ${d.name}${d.draft ? ' (draft)' : ''}${dirty.has(d) ? ' •' : ''}`})));
        panel.append(pickLevel);

        panel.append(el('h3', {textContent: 'Level'}),
            field('id', input('text', () => def.id, v => { def.id = v.trim(); })),
            field('name', input('text', () => def.name, v => { def.name = v; })),
            field('size', input('number', () => def.size, v => { def.size = clamp(v, 16, 40); }, {step: 1, min: 16, max: 40})),
            field('prompt', input('text', () => def.prompt, v => { v ? def.prompt = v : delete def.prompt; })),
            checkbox('draft (hidden in the game)', () => def.draft, v => { v ? def.draft = true : delete def.draft; }));

        const botButton = button('Check (bot)', runBot);
        botButton.disabled = HR_WORLDS[world].id != 'hop' || ED.testing;
        botButton.title = 'Hop levels only: tries every hold from every spot you can stand on';
        panel.append(el('div', {className: 'row'}, [
            button(ED.testing ? 'Edit (E)' : 'Play (E)', () => toggle(false), 'go'), botButton,
            button('Undo', doUndo), button('Redo', doRedo)]));
        panel.append(el('div', {className: 'row'}, [
            button(`Save (⌘S)${unsaved.length ? ' •' : ''}`, save, unsaved.length ? 'go' : ''),
            button('New level', () => newLevel(false)), button('Duplicate', () => newLevel(true))]));
        panel.append(el('div', {className: 'status', textContent: status || (unsaved.length ? 'Unsaved: ' + unsaved.join(', ') : 'No unsaved changes')}));

        // the selection
        panel.append(el('h3', {textContent: sel ? {solid: 'Solid', gate: 'Gate', button: 'Gate button', start: 'Start', flag: 'Flag', prompt: 'Prompt position'}[sel.type] : 'Selection'}));
        const s = selSolid();
        if (s)
        {
            const n = k => input('number', () => s[k], v => { touch(s); s[k] = v; }, {step: .25});
            panel.append(el('div', {className: 'grid4'}, [field('left', n('l')), field('right', n('r')), field('top', n('top')),
                s.bottom === undefined ? el('label', {}, [el('span', {textContent: 'bottom'}), 'floor (F)']) : field('bottom', n('bottom'))]));
            const flags = [['grip', 'grip wall (G)'], ['ice', 'ice (I)'], ['sticky', 'sticky (K)'], ['nogrip', 'no-grip (N)']];
            for (const [k, label] of flags) panel.append(checkbox(label, () => s[k], v => { touch(s); v ? s[k] = true : delete s[k]; }));
            if (s._teeth) panel.append(el('div', {className: 'keys', textContent: 'A seeded tooth (hrClimbTeeth). Editing it writes all the teeth out as numbers.'}));
        }
        else if (sel && sel.type != 'gate')
        {
            const o = sel.type == 'start' ? def.start : sel.type == 'flag' ? def.flag : sel.type == 'button' ? def.gates[sel.i].button : null;
            if (o) panel.append(el('div', {className: 'grid4'}, [
                field('x', input('number', () => o.x, v => { o.x = v; }, {step: .25})),
                field('y', input('number', () => o.y, v => { o.y = v; }, {step: .25}))]));
            if (sel.type == 'prompt') panel.append(button('Default position', () => { snapshot(); delete def.promptAt; changed(); }));
        }
        else panel.append(el('div', {className: 'keys', textContent: 'Click a solid, the start, the flag or the prompt.'}));

        panel.append(el('h3', {textContent: 'Keys'}), el('div', {className: 'keys', innerHTML: `
            <b>E</b> play / edit · <b>Shift+E</b> play from the mouse<br>
            <b>drag</b> move · <b>drag an edge</b> resize · <b>drag empty space</b> new solid<br>
            <b>Alt</b> no snap · <b>arrows</b> nudge (Shift: 1 u)<br>
            <b>G I K N</b> grip, ice, sticky, no-grip<br>
            <b>F</b> floor / floating · <b>H</b> hanging from the top<br>
            <b>T</b> solid ↔ gate (Rocket) · <b>D</b> duplicate · <b>Delete</b> remove<br>
            <b>[ ]</b> level size · <b>, .</b> previous / next level<br>
            <b>⌘Z</b> undo · <b>⇧⌘Z</b> redo · <b>⌘S</b> save · <b>Esc</b> deselect`}));
    }

    // self-test (console, over HTTP): rewriting every unedited level must reproduce its file exactly
    ED.selfTest = async () =>
    {
        const diffs = [];
        let n = 0;
        for (const w of worlds())
        {
            const id = HR_WORLDS[w].id;
            const text = await (await fetch(new URL(`../levels/${id}.js`, HERE), {cache: 'no-store'})).text();
            for (const d of levelsOf(w))
            {
                const span = findLevel(text, d.id);
                if (!span) { diffs.push(`${d.id}: not in ${id}.js`); continue; }
                if (!groups.has(d)) markLoaded(d);
                const out = levelSource(d, span.body).split('\n'), was = span.body.split('\n');
                n++;
                for (let i = 0; i < max(out.length, was.length); i++)
                    if (out[i] !== was[i]) { diffs.push(`${d.id} line ${i + 1}:\n  file: ${was[i]}\n  ours: ${out[i]}`); break; }
            }
        }
        return `${n} levels, ${diffs.length} differ` + (diffs.length ? '\n' + diffs.join('\n') : '');
    };

    addEventListener('keydown', key);
    // ?edit or ?edit=<level id> opens the editor once the game is running
    const want = new URLSearchParams(location.search).get('edit');
    if (want !== null)
        setTimeout(() =>
        {
            for (const w of worlds())
            {
                const i = levelsOf(w).findIndex(d => d.id == want);
                if (i >= 0) return open(w, i);
            }
            open(0, 0);
        }, 300);
    addEventListener('beforeunload', e => { if (dirty.size) e.preventDefault(); });

    return ED;
})();
