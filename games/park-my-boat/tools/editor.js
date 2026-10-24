/*
    PARK MY BOAT - level editor (debug tool). index.html loads it after main.js; every hook in the game
    is a window.pmbEditor?. call, so without this file they do nothing.

    E on any screen opens the level you are on (or level 1); E again play-tests it from the first boat
    (Shift+E: from the selected boat, earlier boats parked for you), and E comes back. ?edit or ?edit=2
    in the URL opens it on load (level number). Save (Cmd+S) writes levels/levels.js in place through
    Chrome's file access (pick the park-my-boat or levels folder once). Only edited levels change; in
    them, every part you didn't touch keeps its exact text (comments, ...basin(...), tiedUp(...)), and
    the parts you did touch are written out as numbers.

    Mouse: drag empty space to pan, wheel to zoom, click to select, drag to move, drag an edge of a
    selected sand / dock / current rect to resize, Shift+drag on empty space for new sand. Keys are
    listed in the panel.
*/

'use strict';

window.pmbEditor = (() =>
{
    const PANEL = 320;          // panel width in CSS px
    const HERE = document.currentScript.src;
    const ED = { active: false, testing: false };
    const C_ED = rgb(.25, .55, 1);
    let li = 0, def = null, sel = null, hover = null, drag = null, status = '', dirHandle = null;
    let undo = [], redo = [];
    const dirty = new Set();            // levels changed since the last save
    // a level's fields can be shared with levels.js's helpers (land: HARBOR_ISLAND.land): the editor
    // works on its own copies, so an edit never changes the helper (or what Save compares against)
    const owned = new WeakSet();
    function own(d) { if (owned.has(d)) return; for (const k of Object.keys(d)) if (d[k] && typeof d[k] == 'object') d[k] = structuredClone(d[k]); owned.add(d); }
    const fileName = new WeakMap();     // level -> its name in the file (missing: a new level, appended on save)
    const ARRAYS = ['moored', 'drifters', 'buoys', 'logs', 'ducks', 'lands', 'currents'];

    ///////////////////////////////////////////////////////////////////////////
    // undo snapshots: the level's data without the 'world' the game adds

    const cloneDef = d => { const c = structuredClone(d); delete c.world; return c; };
    function restore(snap)
    {
        for (const k of Object.keys(def)) if (k != 'world') delete def[k];
        Object.assign(def, structuredClone(snap));
    }
    function snapshot() { undo.push(cloneDef(def)); if (undo.length > 200) undo.shift(); redo = []; }
    function changed() { dirty.add(def); status = ''; load(); refreshPanel(); }
    function doUndo() { if (!undo.length) return; redo.push(cloneDef(def)); restore(undo.pop()); sel = null; changed(); }
    function doRedo() { if (!redo.length) return; undo.push(cloneDef(def)); restore(redo.pop()); sel = null; changed(); }

    ///////////////////////////////////////////////////////////////////////////
    // open, play, close

    function open(i)
    {
        li = clamp(i, 0, LEVELS.length - 1);
        def = LEVELS[li];
        own(def);
        if (!fileName.has(def) && !def._new) fileName.set(def, def.name);
        sel = hover = drag = null;
        undo = []; redo = [];
        ED.active = true; ED.testing = false;
        load();
        frameBoat(0);
        panel.style.display = 'block'; testTag.style.display = 'none';
        refreshPanel();
    }

    // load the level into the game and freeze it there; the editor draws over the real level
    function load()
    {
        const keep = { pos: cam.pos.copy(), wu: cam.wu };
        try { loadLevel(li); }
        catch (e) { status = 'Level error: ' + e.message; console.error(e); }
        intro = undefined;
        cam.pos = keep.pos; cam.wu = keep.wu;
    }

    function play(fromSel)
    {
        const from = fromSel && sel?.kind == 'start' ? sel.i : 0;
        ED.active = false; ED.testing = true; drag = null;
        loadLevel(li);
        // earlier boats are parked in their slips for you
        for (let n = 0; n < from; n++)
        {
            fleet[n].pos = slips[n].pos.copy(); fleet[n].angle = slips[n].a; fleet[n].updateWorld();
            startBoat(n + 1);
        }
        updateCamera(0, true);
        panel.style.display = 'none'; testTag.style.display = 'block';
    }

    function backToEdit(msg)
    {
        ED.testing = false; ED.active = true;
        load();
        status = msg || '';
        panel.style.display = 'block'; testTag.style.display = 'none';
        refreshPanel();
    }

    function close()
    {
        ED.active = ED.testing = false;
        panel.style.display = testTag.style.display = 'none';
        setScreen('title');
    }

    function toggle(shift)
    {
        if (ED.testing) return backToEdit();
        if (ED.active) return play(shift);
        open(gameScreen == 'playing' || gameScreen == 'complete' ? levelIndex : 0);
    }

    ///////////////////////////////////////////////////////////////////////////
    // camera: pan, zoom, framing (the canvas left of the panel)

    const panelUi = () => panel.style.display == 'none' ? 0 : PANEL * mainCanvasSize.x / innerWidth / uiScale();
    const overPanel = () => panel.style.display != 'none' && mousePosScreen.x > mainCanvasSize.x - PANEL * mainCanvasSize.x / innerWidth;
    const viewCenter = () => cam.pos.subtract(vec2(panelUi()/2*cam.wu, 0));
    const mouseWorld = () => uiToWorld(mousePos);

    function frame(b)
    {
        const availW = (mainCanvasSize.x / uiScale()) - panelUi(), availH = mainCanvasSize.y / uiScale();
        const w = Math.max(b.x1 - b.x0, 1e-3), h = Math.max(b.y1 - b.y0, 1e-3);
        cam.wu = Math.max(w / availW, h / availH) * 1.25;
        cam.pos = vec2((b.x0 + b.x1)/2 + panelUi()/2*cam.wu, (b.y0 + b.y1)/2);
    }
    const slipBox = n => { const s = slips[n]; return { x0: s.pos.x - s.w/2, y0: s.pos.y - s.h/2, x1: s.pos.x + s.w/2, y1: s.pos.y + s.h/2 }; };
    function frameBoat(n)
    {
        if (!slips[n]) return;
        const e = def.boats[n], r = BOATS[e.boat].L * boatK(def, e);
        frame(boxUnion(slipBox(n), boxAround(vec2(e.start.x, e.start.y), r)));
    }
    function frameAll()
    {
        let b;
        def.boats.forEach((e, n) => { const r = BOATS[e.boat].L * boatK(def, e); const u = boxUnion(slipBox(n), boxAround(vec2(e.start.x, e.start.y), r)); b = b ? boxUnion(b, u) : u; });
        for (const m of def.lands || []) b = boxUnion(b, boxAround(vec2(m.x, m.y), blobRadius(m)));
        frame(b);
    }
    function frameSel()
    {
        if (!sel) return frameAll();
        const s = shapeOf(sel), b = boundsOf(s);
        const big = Math.max(b.x1 - b.x0, b.y1 - b.y0);
        frame(boxUnion(b, boxAround(vec2((b.x0 + b.x1)/2, (b.y0 + b.y1)/2), big*2)));
    }

    // grid step: a round number about a quarter UI unit long at this zoom
    function niceStep(x)
    {
        const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p;
        return (m < 2 ? 1 : m < 5 ? 2 : 5) * p;
    }
    const step = () => niceStep(.25 * cam.wu);
    const noSnap = () => keyIsDown('AltLeft') || keyIsDown('AltRight');
    const snap = v => { const s = noSnap() ? step()/20 : step(); return Math.round(v / s) * s; };

    ///////////////////////////////////////////////////////////////////////////
    // shapes of the level's things, for picking and outlines

    const blobRadius = m => Math.max(...m.circles.map(([x, y, r]) => Math.hypot(x, y) + r)) * m.k;
    function orientedRect(x, y, a, L, W)
    {
        const c = Math.cos(a), s = Math.sin(a), hl = L/2, hw = W/2;
        return { type: 'poly', c: vec2(x, y), r: Math.hypot(hl, hw), pts: [[hl, hw], [-hl, hw], [-hl, -hw], [hl, -hw]].map(([u, v]) => vec2(x + u*c - v*s, y + u*s + v*c)) };
    }
    function boatShape(key, k, x, y, a) { const t = BOATS[key]; return orientedRect(x, y, a, t.L*k, t.W*k); }
    const rectShape = (x0, y0, x1, y1) => ({ type: 'rect', x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) });

    function shapeOf(it)
    {
        const i = it.i;
        switch (it.kind)
        {
            case 'start':   { const e = def.boats[i]; return boatShape(e.boat, boatK(def, e), e.start.x, e.start.y, e.start.a); }
            case 'slip':    { const b = slipBox(i); return rectShape(b.x0, b.y0, b.x1, b.y1); }
            case 'moored': case 'drifters': { const m = def[it.kind][i]; return boatShape(m.boat, boatK(def, m), m.x, m.y, m.a); }
            case 'buoys':   { const b = def.buoys[i]; return { type: 'circle', c: vec2(b[0], b[1]), r: .45*(b[2] ?? 1) }; }
            case 'logs':    { const l = def.logs[i]; return orientedRect(l[0], l[1], l[2] || 0, 2.4, .55); }
            case 'ducks':   { const f = def.ducks[i]; return { type: 'circle', c: vec2(f.x - f.kids*.4, f.y), r: (f.kids + 1)*.4 + .4 }; }
            case 'lands':   { const m = def.lands[i]; return { type: 'blob', c: vec2(m.x, m.y), r: blobRadius(m), circles: m.circles.map(([x, y, r]) => ({ c: vec2(m.x + x*m.k, m.y + y*m.k), r: r*m.k })) }; }
            case 'land':    { const r = def.land[i]; return rectShape(r[0], r[1], r[2], r[3]); }
            case 'docks': case 'currents': { const r = def[it.kind][i]; return rectShape(r.x0, r.y0, r.x1, r.y1); }
        }
    }
    function boundsOf(s)
    {
        if (s.type == 'rect') return s;
        return boxAround(s.c, s.r);
    }
    // tiny things stay clickable: everything is at least a quarter UI unit around
    function hit(s, p)
    {
        const pad = .25*cam.wu;
        if (s.type == 'rect')
        {
            const gx = Math.max(0, pad - (s.x1 - s.x0)/2), gy = Math.max(0, pad - (s.y1 - s.y0)/2);
            return p.x > s.x0 - gx && p.x < s.x1 + gx && p.y > s.y0 - gy && p.y < s.y1 + gy;
        }
        const d = p.distance(s.c);
        if (s.type == 'circle') return d < Math.max(pad, s.r);
        if (d < pad) return true;
        if (s.type == 'blob') return s.circles.some(c => p.distance(c.c) < c.r);
        // point in polygon
        let inside = false;
        for (let a = 0, b = s.pts.length - 1; a < s.pts.length; b = a++)
        {
            const A = s.pts[a], B = s.pts[b];
            if ((A.y > p.y) != (B.y > p.y) && p.x < (B.x - A.x)*(p.y - A.y)/(B.y - A.y) + A.x) inside = !inside;
        }
        return inside;
    }

    // small things first, so they can be picked off the big things they sit on
    const PICK_ORDER = ['start', 'moored', 'drifters', 'buoys', 'logs', 'ducks', 'slip', 'currents', 'docks', 'lands', 'land'];
    function count(kind) { return kind == 'start' || kind == 'slip' ? def.boats.length : (def[kind] || []).length; }
    function pick(p)
    {
        for (const kind of PICK_ORDER)
            for (let i = count(kind); i--;)
                if (hit(shapeOf({ kind, i }), p)) return { kind, i };
        return null;
    }
    const same = (a, b) => a && b && a.kind == b.kind && a.i == b.i;
    const isRect = it => it && ['land', 'docks', 'currents'].includes(it.kind);

    ///////////////////////////////////////////////////////////////////////////
    // mouse

    function edgesAt(p)
    {
        if (!isRect(sel)) return null;
        const s = shapeOf(sel), d = .3*cam.wu, e = {};
        if (p.x < s.x0 - d || p.x > s.x1 + d || p.y < s.y0 - d || p.y > s.y1 + d) return null;
        if (Math.abs(p.x - s.x0) < d) e.x0 = 1;
        if (Math.abs(p.x - s.x1) < d) e.x1 = 1;
        if (Math.abs(p.y - s.y0) < d) e.y0 = 1;
        if (Math.abs(p.y - s.y1) < d) e.y1 = 1;
        return Object.keys(e).length ? e : null;
    }

    function mouse()
    {
        const p = mouseWorld();
        if (!drag) hover = overPanel() ? null : pick(p);
        if (mouseWheel && !overPanel())
        {
            // zoom around the cursor
            const f = Math.pow(1.25, mouseWheel);
            cam.wu = clamp(cam.wu * f, 1e-3, 1e6);
            cam.pos = p.subtract(mousePos.subtract(UI_CENTER).scale(cam.wu));
        }
        if (mouseWasPressed(0) && !overPanel())
        {
            const edges = edgesAt(p), shift = keyIsDown('ShiftLeft') || keyIsDown('ShiftRight');
            if (edges) drag = { mode: 'edge', edges, snapped: false };
            else
            {
                const it = pick(p);
                if (it) { sel = it; drag = { mode: 'move', from: vec2(snap(p.x), snap(p.y)), snapped: false }; }
                else if (shift) drag = { mode: 'new', from: vec2(snap(p.x), snap(p.y)) };
                else drag = { mode: 'pan', mouse: mousePos.copy(), cam: cam.pos.copy(), moved: false };
            }
            refreshPanel();
        }
        if (drag && mouseIsDown(0)) dragTo(p);
        if (drag && mouseWasReleased(0))
        {
            if (drag.mode == 'new') addRect(drag.from, vec2(snap(p.x), snap(p.y)));
            if (drag.mode == 'pan' && !drag.moved) { sel = null; refreshPanel(); }   // a click on empty space deselects
            drag = null;
        }
    }

    function dragTo(p)
    {
        if (drag.mode == 'pan')
        {
            const d = mousePos.subtract(drag.mouse);
            if (d.length() > .1) drag.moved = true;
            cam.pos = drag.cam.subtract(d.scale(cam.wu));
            return;
        }
        const q = vec2(snap(p.x), snap(p.y));
        if (drag.mode == 'new') { drag.to = q; return; }
        if (drag.mode == 'move')
        {
            const d = q.subtract(drag.from);
            if (!d.x && !d.y) return;
            if (!drag.snapped) { snapshot(); drag.snapped = true; }
            drag.from = q;
            move(sel, d.x, d.y);
            return changed();
        }
        // resize a rect by one or two edges
        if (!drag.snapped) { snapshot(); drag.snapped = true; }
        const s = shapeOf(sel), e = drag.edges, min = step();
        const b = { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 };
        if (e.x0) b.x0 = Math.min(q.x, b.x1 - min);
        if (e.x1) b.x1 = Math.max(q.x, b.x0 + min);
        if (e.y0) b.y0 = Math.min(q.y, b.y1 - min);
        if (e.y1) b.y1 = Math.max(q.y, b.y0 + min);
        setRect(sel, b);
        changed();
    }

    function setRect(it, b)
    {
        if (it.kind == 'land') def.land[it.i] = [b.x0, b.y0, b.x1, b.y1];
        else Object.assign(def[it.kind][it.i], { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
    }

    // a slip hanging from a pier edge (top or right) slides along it; Shift moves it off the pier too
    function move(it, dx, dy)
    {
        const shift = keyIsDown('ShiftLeft') || keyIsDown('ShiftRight');
        switch (it.kind)
        {
            case 'start': { const s = def.boats[it.i].start; s.x += dx; s.y += dy; break; }
            case 'slip':
            {
                const s = def.boats[it.i].slip;
                if (s.x !== undefined) s.x += dx; else if (shift) s.right += dx;
                if (s.y !== undefined) s.y += dy; else if (shift) s.top += dy;
                break;
            }
            case 'buoys': case 'logs': { const a = def[it.kind][it.i]; a[0] += dx; a[1] += dy; break; }
            case 'land': { const r = def.land[it.i]; r[0] += dx; r[2] += dx; r[1] += dy; r[3] += dy; break; }
            case 'docks': case 'currents': { const r = def[it.kind][it.i]; r.x0 += dx; r.x1 += dx; r.y0 += dy; r.y1 += dy; break; }
            default: { const o = def[it.kind][it.i]; o.x += dx; o.y += dy; }
        }
    }

    function rotate(it, da)
    {
        const wrap = a => { a = wrapAngle(a); return Math.abs(a) < 1e-9 ? 0 : a; };
        if (it.kind == 'start') { const s = def.boats[it.i].start; s.a = wrap(s.a + da); }
        else if (it.kind == 'slip') { const s = def.boats[it.i].slip; s.a = wrap(s.a + Math.sign(da)*PI/2); }
        else if (it.kind == 'moored' || it.kind == 'drifters') { const m = def[it.kind][it.i]; m.a = wrap(m.a + da); }
        else if (it.kind == 'logs') { const l = def.logs[it.i]; l[2] = wrap((l[2] || 0) + da); }
        else return false;
        return true;
    }

    // Shift+drag on empty space: new sand
    function addRect(a, b)
    {
        const r = rectShape(a.x, a.y, b.x, b.y);
        if (r.x1 - r.x0 < step() || r.y1 - r.y0 < step()) return;
        snapshot();
        def.land.push([r.x0, r.y0, r.x1, r.y1]);
        sel = { kind: 'land', i: def.land.length - 1 };
        changed();
    }

    ///////////////////////////////////////////////////////////////////////////
    // adding, duplicating, removing

    function add(kind, boat)
    {
        const c = viewCenter(), w = cam.wu, q = v => Math.round(v / step()) * step();
        const x = q(c.x), y = q(c.y);
        snapshot();
        if (kind == 'start')
        {
            const k = BOATS[boat].k, L = BOATS[boat].L*k;
            def.boats.push({ boat, start: { x: q(x - L*2), y, a: 0 }, slip: { x, y, a: 0, pad: [1.4, 1] }, hint: '' });
            sel = { kind: 'start', i: def.boats.length - 1 };
            return changed();
        }
        const list = def[kind] = def[kind] || [];
        if (kind == 'moored' || kind == 'drifters') list.push({ boat, x, y, a: 0 });
        else if (kind == 'buoys') list.push([x, y, Math.max(1, niceStep(w))]);
        else if (kind == 'logs') list.push([x, y, 0]);
        else if (kind == 'ducks') list.push({ x, y, kids: 3 });
        else if (kind == 'land') list.push([q(x - 2*w), q(y - w), q(x + 2*w), q(y + w)]);
        else if (kind == 'docks') list.push({ x0: q(x - 2*w), y0: q(y - .3*w), x1: q(x + 2*w), y1: q(y + .3*w) });
        else if (kind == 'currents') list.push({ x0: q(x - 3*w), y0: q(y - w), x1: q(x + 3*w), y1: q(y + w), dx: 1, dy: 0 });
        else if (kind == 'lands') list.push({ x, y, k: niceStep(2*w), grass: true, circles: [[0, 0, 1], [1.2, .3, .7], [-1.1, -.2, .8]] });
        sel = { kind, i: list.length - 1 };
        changed();
    }

    function duplicate()
    {
        if (!sel || sel.kind == 'start' || sel.kind == 'slip') return;
        snapshot();
        const list = def[sel.kind], c = structuredClone(list[sel.i]), d = 4*step();
        list.push(c);
        sel = { kind: sel.kind, i: list.length - 1 };
        move(sel, d, -d);
        changed();
    }

    function remove()
    {
        if (!sel) return;
        if (sel.kind == 'slip') { status = 'A slip belongs to its boat: delete the boat (its start) instead'; return refreshPanel(); }
        if (sel.kind == 'start')
        {
            if (def.boats.length < 2) { status = 'A level needs at least one boat'; return refreshPanel(); }
            snapshot(); def.boats.splice(sel.i, 1);
        }
        else
        {
            snapshot(); def[sel.kind].splice(sel.i, 1);
            if (!def[sel.kind].length && ARRAYS.includes(sel.kind)) delete def[sel.kind];
        }
        sel = null;
        changed();
    }

    // T: sand -> dock -> quay -> sand
    function cycleRect()
    {
        if (!['land', 'docks'].includes(sel?.kind)) return;
        snapshot();
        const b = shapeOf(sel);
        if (sel.kind == 'land') { def.land.splice(sel.i, 1); def.docks.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }); sel = { kind: 'docks', i: def.docks.length - 1 }; }
        else
        {
            const d = def.docks[sel.i];
            if (!d.quay) d.quay = true;
            else { def.docks.splice(sel.i, 1); def.land.push([b.x0, b.y0, b.x1, b.y1]); sel = { kind: 'land', i: def.land.length - 1 }; }
        }
        changed();
    }

    function moveBoat(n, d)
    {
        const m = n + d;
        if (m < 0 || m >= def.boats.length) return;
        snapshot();
        [def.boats[n], def.boats[m]] = [def.boats[m], def.boats[n]];
        if (sel?.kind == 'start' || sel?.kind == 'slip') sel = { kind: sel.kind, i: m };
        changed();
    }

    function newLevel(copy)
    {
        const d = copy ? cloneDef(def) : {
            name: 'New Level',
            land: [[-3000, -3020, 0, 3585], [1400, -3020, 4400, 3585], [-3000, -3020, 4400, -20], [-3000, 600, 4400, 3585]],
            docks: [{ x0: 0, y0: 585, x1: 1400, y1: 600, quay: true }],
            boats: [{ boat: 'dinghy', start: { x: 400, y: 300, a: 0 }, slip: { x: 700, top: 585, a: PI/2 }, hint: '' }],
        };
        let name = copy ? def.name + ' copy' : 'New Level', n = 2;
        while (LEVELS.some(L => L.name == name)) name = (copy ? def.name + ' copy ' : 'New Level ') + n++;
        d.name = name;
        d.world = 1;
        Object.defineProperty(d, '_new', { value: true, writable: true, configurable: true });
        LEVELS.push(d);
        dirty.add(d);
        open(LEVELS.length - 1);
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
        const nudge = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.code];
        if (nudge && sel) { e.preventDefault(); const k = step() * (e.shiftKey ? 10 : 1); snapshot(); move(sel, nudge[0]*k, nudge[1]*k); return changed(); }
        if ((e.code == 'BracketLeft' || e.code == 'BracketRight') && sel)
        {
            const da = (e.code == 'BracketLeft' ? 1 : -1) * (e.shiftKey ? PI/2 : PI/12);
            snapshot();
            if (rotate(sel, da)) changed(); else undo.pop();
            return;
        }
        const digit = e.code.match(/^Digit([1-9])$/);
        if (digit && +digit[1] <= def.boats.length) { sel = { kind: 'start', i: +digit[1] - 1 }; frameBoat(sel.i); return refreshPanel(); }
        switch (e.code)
        {
            case 'Backspace': case 'Delete': return remove();
            case 'Escape': sel = null; return refreshPanel();
            case 'KeyD': return duplicate();
            case 'KeyT': return cycleRect();
            case 'KeyF': return e.shiftKey ? frameAll() : frameSel();
            case 'Comma': return li > 0 && open(li - 1);
            case 'Period': return li < LEVELS.length - 1 && open(li + 1);
        }
    }

    ///////////////////////////////////////////////////////////////////////////
    // the frame: hooks from main.js

    ED.update = () =>
    {
        if (ED.testing)
        {
            if (gameScreen == 'title' || gameScreen == 'levels') { ED.testing = false; testTag.style.display = 'none'; }
            else if (gameScreen == 'complete' && screenTime > 1.5) backToEdit(`Parked: accuracy ${Math.round(result.acc*100)}%, ${result.stars} star${result.stars == 1 ? '' : 's'}`);
            return false;
        }
        if (!ED.active) return false;
        buttons = [];
        mouse();
        return true;
    };

    function outline(s, w, color)
    {
        if (s.type == 'rect') drawPoly([vec2(s.x0, s.y0), vec2(s.x1, s.y0), vec2(s.x1, s.y1), vec2(s.x0, s.y1)], C_CLEAR, w, color);
        else if (s.type == 'poly') drawPoly(s.pts, C_CLEAR, w, color);
        else if (s.type == 'circle') drawCircle(s.c, Math.max(s.r, .25*cam.wu)*2, C_CLEAR, w, color);
        else for (const c of s.circles) drawCircle(c.c, c.r*2, C_CLEAR, w, color);
    }

    ED.renderWorld = () =>
    {
        if (!ED.active) return;
        const W = cam.wu;
        // every slip, and a faint line from each boat's start to its slip
        def.boats.forEach((e, n) =>
        {
            const s = slips[n];
            if (!s) return;
            drawDashedRect(s.pos, s.w, s.h, C_CREAM.scale(1, .9), .06*W, Math.max(.4*W, s.wid*.12));
            drawLine(vec2(e.start.x, e.start.y), s.pos, .03*W, C_INK.scale(1, .25));
            // heading arrow on the start
            const f = vec2(Math.cos(e.start.a), Math.sin(e.start.a)), L = Math.max(BOATS[e.boat].L*boatK(def, e)*.6, .8*W);
            const tip = vec2(e.start.x, e.start.y).add(f.scale(L));
            drawLine(vec2(e.start.x, e.start.y), tip, .06*W, C_ED);
            drawLine(tip, tip.add(f.rotate(2.5).scale(.3*W)), .06*W, C_ED);
            drawLine(tip, tip.add(f.rotate(-2.5).scale(.3*W)), .06*W, C_ED);
        });
        for (const c of def.currents || []) drawPoly([vec2(c.x0, c.y0), vec2(c.x1, c.y0), vec2(c.x1, c.y1), vec2(c.x0, c.y1)], C_CLEAR, .04*W, C_TEAL);
        if (hover && !same(hover, sel)) outline(shapeOf(hover), .06*W, C_ED.scale(1, .5));
        if (sel)
        {
            const s = shapeOf(sel);
            outline(s, .1*W, C_ED);
            if (isRect(sel))
            {
                const hs = vec2(.25*W), mx = (s.x0 + s.x1)/2, my = (s.y0 + s.y1)/2;
                for (const p of [vec2(s.x0, my), vec2(s.x1, my), vec2(mx, s.y0), vec2(mx, s.y1)]) drawRect(p, hs, C_ED);
            }
        }
        if (drag?.mode == 'new' && drag.to) outline(rectShape(drag.from.x, drag.from.y, drag.to.x, drag.to.y), .08*W, C_ED);
    };

    ED.renderUi = () =>
    {
        if (!ED.active) return;
        // numbers on each start and slip, the same on both
        def.boats.forEach((e, n) =>
        {
            const a = worldToUi(vec2(e.start.x, e.start.y)), s = slips[n] && worldToUi(slips[n].pos);
            txt(String(n + 1), a.x, a.y + .7, .7, C_ED, 'center', .1, C_CREAM);
            if (s) txt(String(n + 1), s.x, s.y, .9, C_CREAM, 'center', .12, C_INK);
        });
        const left = UI_CENTER.x - viewHalfUi().x + .5;
        txt(`EDITOR · ${li + 1}. ${def.name} · grid ${fmtLen(step())}${noSnap() ? ' (no snap)' : ''}`, left, 21.75, .55, C_INK, 'left');
        if (!overPanel())
        {
            const p = mouseWorld();
            txt(`${num(snap(p.x))}, ${num(snap(p.y))}`, mousePos.x + .4, mousePos.y - .6, .45, C_INK.scale(1, .7), 'left');
        }
    };

    ///////////////////////////////////////////////////////////////////////////
    // writing values the way levels.js does: { k: v }, angles as PI fractions, big numbers as 3.5e6

    function num(n)
    {
        n = Math.round(n * 1000) / 1000 || 0;
        if (Math.abs(n) >= 1e5)
        {
            const [m, x] = n.toExponential().split('e');
            if (m.replace('-', '').length <= 5) return m + 'e' + (+x);
        }
        return String(n);
    }
    function angle(a)
    {
        const m = a / (PI/12), r = Math.round(m);
        if (Math.abs(m - r) > 1e-6) return String(Math.round(a * 1e4) / 1e4 || 0);
        if (!r) return '0';
        const gcd = (p, q) => q ? gcd(q, p % q) : p, g = gcd(Math.abs(r), 12), n = Math.abs(r)/g, d = 12/g;
        return (r < 0 ? '-' : '') + 'PI' + (n != 1 ? '*' + n : '') + (d != 1 ? '/' + d : '');
    }
    const str = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, '\\\'')}'`;
    function lit(v, key)
    {
        if (typeof v == 'number') return key == 'a' ? angle(v) : num(v);
        if (typeof v == 'string') return str(v);
        if (Array.isArray(v)) return `[${v.map(x => lit(x)).join(', ')}]`;
        if (v && typeof v == 'object')
        {
            const e = Object.entries(v).filter(([, x]) => x !== undefined);
            return e.length ? `{ ${e.map(([k, x]) => `${k}: ${lit(x, k)}`).join(', ')} }` : '{}';
        }
        return String(v);
    }

    // one element of a list, one per line; a chain boat's hint goes on a second line, like the file
    function entry(v, indent)
    {
        if (!v || typeof v != 'object' || Array.isArray(v) || v.hint === undefined) return lit(v);
        const { hint, ...rest } = v;
        return lit(rest).replace(/ \}$/, `,\n${indent}  hint: ${str(hint)} }`);
    }

    // tol: how far numbers may be apart (the self-test allows for the rounding Save does)
    function deepEqual(a, b, tol = 0)
    {
        if (a === b) return true;
        if (typeof a == 'number' && typeof b == 'number') return Math.abs(a - b) <= tol * Math.max(1, Math.abs(a)) || (isNaN(a) && isNaN(b));
        if (!a || !b || typeof a != 'object' || typeof b != 'object' || Array.isArray(a) != Array.isArray(b)) return false;
        const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
        return ka.length == kb.length && ka.every(k => deepEqual(a[k], b[k], tol));
    }

    // levels.js's own helpers (basin, tiedUp, HARBOR_ISLAND...) are globals, so its code evaluates here
    const evalCode = code => Function(`'use strict'; return (\n${code}\n);`)();

    ///////////////////////////////////////////////////////////////////////////
    // source surgery: split a bracket's inside into top-level pieces (lead + code + tail), keep the
    // text of every piece whose value didn't change, write the rest

    function matchClose(text, i)
    {
        const open = text[i], close = { '{': '}', '[': ']', '(': ')' }[open];
        let depth = 0, q = null;
        for (; i < text.length; i++)
        {
            const ch = text[i];
            if (q) { if (ch == '\\') i++; else if (ch == q) q = null; continue; }
            if (ch == '\'' || ch == '"' || ch == '`') { q = ch; continue; }
            if (ch == '/' && text[i + 1] == '/') { const e = text.indexOf('\n', i); i = e < 0 ? text.length : e - 1; continue; }
            if (ch == open) depth++;
            else if (ch == close && --depth == 0) return i;
        }
        throw new Error('unbalanced ' + open);
    }

    // pieces join back to exactly the text; a piece takes its comma and the rest of its line when
    // that is only spaces and a comment
    function splitTop(text)
    {
        const raw = [];
        let depth = 0, q = null, start = 0;
        for (let i = 0; i < text.length; i++)
        {
            const ch = text[i];
            if (q) { if (ch == '\\') i++; else if (ch == q) q = null; continue; }
            if (ch == '\'' || ch == '"' || ch == '`') { q = ch; continue; }
            if (ch == '/' && text[i + 1] == '/') { const e = text.indexOf('\n', i); i = e < 0 ? text.length : e - 1; continue; }
            if ('([{'.includes(ch)) depth++;
            else if (')]}'.includes(ch)) depth--;
            else if (ch == ',' && !depth)
            {
                let e = i + 1;
                const nl = text.indexOf('\n', e), rest = text.slice(e, nl < 0 ? text.length : nl);
                if (/^[ \t]*(\/\/.*)?$/.test(rest)) e = nl < 0 ? text.length : nl + 1;
                raw.push({ text: text.slice(start, e), comma: i - start });
                start = e; i = e - 1;
            }
        }
        raw.push({ text: text.slice(start), comma: -1 });
        return raw.map(({ text: t, comma }) =>
        {
            const lead = t.match(/^(\s|\/\/[^\n]*)*/)[0];
            const end = comma >= 0 ? comma : t.length;
            const code = t.slice(lead.length, end).trimEnd();
            return { lead, code, tail: t.slice(lead.length + code.length) };
        });
    }
    const join = pieces => pieces.map(p => p.lead + p.code + p.tail).join('');
    const indentOf = pieces => { const p = pieces.find(p => p.code); return p ? p.lead.slice(p.lead.lastIndexOf('\n') + 1).replace(/\S.*$/s, '') : ''; };

    // an array literal's text, rewritten for its current values: pieces still holding the same values
    // stay as they are (spreads like ...HARBOR_ISLAND.lands included), changed ones are written out
    function rebuildArray(text, cur)
    {
        const open = text.indexOf('['), close = matchClose(text, open);
        const inner = text.slice(open + 1, close), pieces = splitTop(inner), multi = inner.includes('\n');
        const real = pieces.filter(p => p.code), filler = pieces.filter(p => !p.code);
        for (const p of real) p.vals = evalCode('[' + p.code + ']');
        const runAt = (vals, j) => vals.length > 0 && j + vals.length <= cur.length && vals.every((v, k) => deepEqual(v, cur[j + k]));
        const indent = indentOf(pieces) || '            ';
        const out = [];
        let j = 0, carry = '';
        const fresh = v => ({ lead: multi ? indent : '', code: multi ? entry(v, indent) : lit(v), tail: multi ? ',\n' : '', fresh: true });
        // a removed or rewritten spread's comment moves onto whatever comes next (its lead ends with the indent)
        const withCarry = q => { if (carry) { q.lead = carry + q.lead.replace(/^[ \t]*/, ''); carry = ''; } return q; };
        real.forEach((p, n) =>
        {
            if (runAt(p.vals, j)) { out.push(withCarry({ ...p })); j += p.vals.length; return; }
            // values added before this piece
            for (let k = j + 1; k <= cur.length - p.vals.length; k++)
                if (runAt(p.vals, k)) { while (j < k) out.push(withCarry(fresh(cur[j++]))); out.push({ ...p }); j += p.vals.length; return; }
            // this piece was removed (the next piece's values are here already) or edited
            const next = real[n + 1];
            if (next && runAt(next.vals, j)) { carry = carry || p.lead; return; }
            if (p.vals.length == 1 && j < cur.length) { out.push(withCarry({ lead: p.lead, code: entry(cur[j++], indent), tail: p.tail })); return; }
            carry = carry || p.lead;
        });
        while (j < cur.length) out.push(withCarry(fresh(cur[j++])));
        let body;
        if (multi)
        {
            // every element but the last keeps a comma
            out.forEach((p, n) =>
            {
                if (!p.tail.trimStart().startsWith(',')) p.tail = ',' + p.tail;
                if (p.fresh && n && !out[n - 1].tail.includes('\n')) p.lead = '\n' + p.lead;
            });
            body = join(out) + join(filler);
            if (!out.length) body = '\n' + join(filler).replace(/^\n/, '');
        }
        else body = out.map(p => p.code).join(', ');
        return text.slice(0, open + 1) + body + text.slice(close);
    }

    // the inside of a level's { ... }, rewritten for the level's current data
    function rebuildLevel(inner, d)
    {
        const pieces = splitTop(inner), out = [], done = new Set(['world']);
        const indent = indentOf(pieces) || '        ';
        const field = (k, lead, tail) => ({ lead, code: k + ':' + fieldCode(k, d[k]).replace(/^(?!\n)/, ' '), tail });
        for (const p of pieces)
        {
            if (!p.code) { out.push(p); continue; }
            if (p.code.startsWith('...'))
            {
                // a spread like ...basin(...): kept while every field it gives is unchanged
                const given = evalCode(p.code.slice(3)), keys = Object.keys(given);
                keys.forEach(k => done.add(k));
                if (keys.every(k => deepEqual(given[k], d[k]))) { out.push(p); continue; }
                const live = keys.filter(k => d[k] !== undefined);
                live.forEach((k, n) => out.push(field(k, n ? indent : p.lead.includes('\n') ? p.lead : '\n' + indent, n == live.length - 1 ? p.tail : ',\n')));
                if (!live.length) out.push({ lead: '', code: '', tail: p.tail.replace(/^,/, '') });
                continue;
            }
            const m = p.code.match(/^(\w+)(\s*:\s*)([\s\S]*)$/);
            if (!m) { out.push(p); continue; }
            const [, k, colon, valueText] = m;
            done.add(k);
            if (d[k] === undefined) continue;
            const was = evalCode(valueText);
            if (deepEqual(was, d[k])) { out.push(p); continue; }
            const code = valueText.trimStart().startsWith('[') && Array.isArray(d[k])
                ? k + colon + rebuildArray(valueText, d[k]) : k + ':' + fieldCode(k, d[k]).replace(/^(?!\n)/, ' ');
            out.push({ lead: p.lead, code, tail: p.tail });
        }
        // fields that are new to this level go before the closing brace
        const extra = Object.keys(d).filter(k => !done.has(k) && d[k] !== undefined);
        if (extra.length)
        {
            const last = out.length && !out[out.length - 1].code ? out.pop() : { lead: '', code: '', tail: '    ' };
            const prev = [...out].reverse().find(p => p.code);
            if (prev && !prev.tail.trimStart().startsWith(',')) prev.tail = ',' + prev.tail;
            if (prev && !prev.tail.includes('\n')) prev.tail += '\n';
            for (const k of extra) out.push(field(k, indent, ',\n'));
            out.push(last);
        }
        return join(out);
    }

    // a field written from scratch: lists of objects one per line, like the file
    function fieldCode(k, v)
    {
        if (Array.isArray(v) && (v.length > 1 || k == 'boats') && v.length && v.every(x => x && typeof x == 'object' && !Array.isArray(x)))
            return `\n        [\n${v.map(x => '            ' + entry(x, '            ') + ',').join('\n')}\n        ]`;
        return lit(v);
    }

    function newLevelSource(d)
    {
        const order = ['name', 'land', 'docks', 'boats', 'lands', 'moored', 'drifters', 'buoys', 'logs', 'ducks', 'currents'];
        const keys = [...order.filter(k => d[k] !== undefined), ...Object.keys(d).filter(k => !order.includes(k) && k != 'world' && d[k] !== undefined)];
        return '    {\n' + keys.map(k => `        ${k}:${fieldCode(k, d[k]).replace(/^(?!\n)/, ' ')},\n`).join('') + '    },\n';
    }

    // the span of a level's object in the file: from its "    {" line to after its "},"
    function findLevel(text, name)
    {
        const at = text.indexOf(`name: ${str(name)}`);
        if (at < 0) return null;
        const start = text.lastIndexOf('\n    {', at) + 1;
        const open = text.indexOf('{', start), close = matchClose(text, open);
        return { open, close };
    }

    function sourceWith(text, d)
    {
        const span = fileName.has(d) && findLevel(text, fileName.get(d));
        if (span) return text.slice(0, span.open + 1) + rebuildLevel(text.slice(span.open + 1, span.close), d) + text.slice(span.close);
        // a new level goes at the end of SCALE_LEVELS
        const head = text.indexOf('const SCALE_LEVELS =');
        const close = matchClose(text, text.indexOf('[', head));
        const at = text.lastIndexOf('\n', close) + 1;
        return text.slice(0, at) + newLevelSource(d) + text.slice(at);
    }

    ///////////////////////////////////////////////////////////////////////////
    // saving: Chrome's file access, the folder remembered in IndexedDB

    const idb = (mode, fn) => new Promise((ok, fail) =>
    {
        const req = indexedDB.open('park-my-boat-editor', 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () =>
        {
            try { const r = fn(req.result.transaction('kv', mode).objectStore('kv')); r.onsuccess = () => ok(r.result); r.onerror = fail; }
            catch (e) { fail(e); }
        };
        req.onerror = fail;
    });
    async function levelsDir()
    {
        if (!window.showDirectoryPicker) throw new Error('Saving needs Chrome or Edge (file access)');
        if (!dirHandle) dirHandle = await idb('readonly', s => s.get('dir')).catch(() => null);
        if (dirHandle) try { if (await dirHandle.requestPermission({ mode: 'readwrite' }) != 'granted') dirHandle = null; } catch { dirHandle = null; }
        if (!dirHandle)
        {
            dirHandle = await showDirectoryPicker({ id: 'park-my-boat-levels', mode: 'readwrite' });
            await idb('readwrite', s => s.put(dirHandle, 'dir')).catch(() => {});
        }
        if (dirHandle.name == 'levels') return dirHandle;
        try { return await dirHandle.getDirectoryHandle('levels'); }
        catch { dirHandle = null; throw new Error('Pick the park-my-boat folder or its levels folder'); }
    }

    async function save()
    {
        if (!dirty.size) { status = 'Nothing to save'; return refreshPanel(); }
        const names = LEVELS.map(L => L.name);
        if (new Set(names).size != names.length) { status = 'Two levels have the same name; rename one first'; return refreshPanel(); }
        try
        {
            const dir = await levelsDir(), fh = await dir.getFileHandle('levels.js');
            let text = await (await fh.getFile()).text();
            const defs = LEVELS.filter(d => dirty.has(d));
            for (const d of defs) text = sourceWith(text, d);
            const w = await fh.createWritable();
            await w.write(text);
            await w.close();
            for (const d of defs) { fileName.set(d, d.name); dirty.delete(d); delete d._new; }
            status = `Saved ${defs.length} level${defs.length == 1 ? '' : 's'} to levels/levels.js`;
        }
        catch (e) { status = e.name == 'AbortError' ? 'Save cancelled' : 'Save failed: ' + e.message; console.error(e); }
        refreshPanel();
    }

    // console, over HTTP: unedited levels must rewrite to exactly the file, and every level written
    // out in full must load back to the same data
    ED.selfTest = async () =>
    {
        const text = await (await fetch(new URL('../levels/levels.js', HERE), { cache: 'no-store' })).text();
        const fails = [];
        for (const d of LEVELS)
        {
            if (!fileName.has(d) && !d._new) fileName.set(d, d.name);
            const span = findLevel(text, fileName.get(d));
            if (!span) { fails.push(`${d.name}: not in the file`); continue; }
            const inner = text.slice(span.open + 1, span.close);
            if (!dirty.has(d) && rebuildLevel(inner, d) !== inner) fails.push(`${d.name}: unedited rewrite differs`);
            const full = newLevelSource(d).trim().replace(/,$/, '');
            if (!deepEqual(evalCode(full), cloneDef(d), 1e-3)) fails.push(`${d.name}: full rewrite loads back different`);
        }
        return `${LEVELS.length} levels, ${fails.length} problem${fails.length == 1 ? '' : 's'}` + (fails.length ? '\n' + fails.join('\n') : '');
    };

    ///////////////////////////////////////////////////////////////////////////
    // the panel (DOM, right side)

    const panel = document.createElement('div');
    panel.style.cssText = `position:fixed;top:0;right:0;width:${PANEL}px;height:100%;overflow-y:auto;box-sizing:border-box;
        padding:14px;background:#1E2433;color:#EEF1F6;font:13px/1.4 system-ui,sans-serif;display:none;z-index:10`;
    // LittleJS cancels every mousedown on the page, which would stop the fields from taking focus
    for (const ev of ['mousedown', 'wheel']) panel.addEventListener(ev, e => e.stopPropagation());
    document.body.appendChild(panel);
    const testTag = document.createElement('div');
    testTag.textContent = 'TEST PLAY · E to edit';
    testTag.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);padding:4px 10px;background:#1E2433;color:#FFCC47;font:600 12px system-ui,sans-serif;border-radius:4px;display:none;z-index:10;pointer-events:none';
    document.body.appendChild(testTag);
    const css = document.createElement('style');
    css.textContent = `
        .pmbed h2{font-size:15px;margin:0 0 10px;display:flex;justify-content:space-between;align-items:center}
        .pmbed h3{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#FFCC47;margin:16px 0 6px}
        .pmbed label{display:flex;align-items:center;gap:8px;margin:4px 0}
        .pmbed label span{width:58px;flex:none;color:#A8B0C0}
        .pmbed input,.pmbed select,.pmbed textarea{flex:1;min-width:0;width:100%;box-sizing:border-box;background:#2B3346;color:#fff;border:1px solid #47506A;padding:4px 6px;font:inherit}
        .pmbed textarea{font:12px ui-monospace,monospace;height:70px}
        .pmbed input[type=checkbox]{width:auto;flex:none;margin:0}
        .pmbed .row{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
        .pmbed button{background:#2B3346;color:#fff;border:1px solid #47506A;padding:4px 8px;font:inherit;cursor:pointer}
        .pmbed button.go{background:#FFCC47;color:#1E2433;border-color:#FFCC47;font-weight:700}
        .pmbed button.on{border-color:#4A8CFF;background:#26406E}
        .pmbed .status{margin-top:10px;padding:6px 8px;background:#2B3346;min-height:18px}
        .pmbed .keys{color:#A8B0C0;font-size:12px}
        .pmbed .keys b{color:#EEF1F6;font-weight:600}
        .pmbed .grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 10px}
        .pmbed .grid2 label span{width:auto;min-width:34px}
        .pmbed .boat{display:flex;gap:4px;align-items:center;margin:3px 0}
        .pmbed .boat button:first-child{flex:1;text-align:left}`;
    document.head.appendChild(css);
    panel.className = 'pmbed';

    const el = (tag, attrs = {}, kids = []) =>
    {
        const e = Object.assign(document.createElement(tag), attrs);
        for (const k of [].concat(kids)) e.append(k);
        return e;
    };
    const field = (label, input) => el('label', {}, [el('span', { textContent: label }), input]);
    const button = (text, fn, cls = '') => el('button', { textContent: text, className: cls, onclick: fn });

    // inputs bound to a getter/setter; each change is one undo step
    function input(type, get, set, attrs = {})
    {
        const v = get();
        const i = el('input', { type, value: v === undefined ? '' : type == 'number' ? num(v) : v, ...attrs });
        i.onchange = () =>
        {
            const raw = i.value.trim();
            const val = type == 'number' ? (raw === '' ? undefined : parseFloat(raw)) : i.value;
            if (type == 'number' && val !== undefined && !isFinite(val)) return refreshPanel();
            snapshot(); set(val); changed();
        };
        return i;
    }
    const numIn = (obj, k, attrs) => input('number', () => obj[k], v => { if (v === undefined) delete obj[k]; else obj[k] = v; }, attrs);
    const degIn = (get, set) => input('number', () => Math.round(get()*180/PI*100)/100, v => set((v || 0)*PI/180), { step: 15 });
    function select(options, get, set)
    {
        const s = el('select', { onchange: () => { snapshot(); set(s.value); changed(); } });
        for (const [value, text] of options) s.append(el('option', { value, textContent: text, selected: String(get()) == String(value) }));
        return s;
    }
    const boatOptions = () => Object.values(BOATS).map(t => [t.key, `${t.name} (${fmtLen(t.L*t.k)})`]);
    let addBoatType = 'dinghy';

    function refreshPanel()
    {
        if (!def) return;
        panel.replaceChildren();
        const unsaved = LEVELS.filter(d => dirty.has(d)).map(d => d.name);
        panel.append(el('h2', {}, [el('span', { textContent: 'Level editor' }), button('Close', close)]));

        const pickLevel = el('select', { onchange: e => open(+e.target.value) });
        LEVELS.forEach((d, i) => pickLevel.append(el('option', { value: i, selected: i == li, textContent: `${i + 1}. ${d.name}${dirty.has(d) ? ' •' : ''}` })));
        panel.append(pickLevel);
        panel.append(field('name', input('text', () => def.name, v => { def.name = v.trim() || def.name; })));

        panel.append(el('div', { className: 'row' }, [
            button('Play (E)', () => play(false), 'go'), button('Undo', doUndo), button('Redo', doRedo), button('Frame all', frameAll)]));
        panel.append(el('div', { className: 'row' }, [
            button(`Save (⌘S)${unsaved.length ? ' •' : ''}`, save, unsaved.length ? 'go' : ''),
            button('New level', () => newLevel(false)), button('Duplicate level', () => newLevel(true))]));
        panel.append(el('div', { className: 'status', textContent: status || (unsaved.length ? 'Unsaved: ' + unsaved.join(', ') : 'No unsaved changes') }));

        // the chain of boats, in parking order
        panel.append(el('h3', { textContent: 'Boats (parking order)' }));
        def.boats.forEach((e, n) =>
        {
            const t = BOATS[e.boat], on = (sel?.kind == 'start' || sel?.kind == 'slip') && sel.i == n;
            panel.append(el('div', { className: 'boat' }, [
                button(`${n + 1}. ${t.name} · ${fmtLen(t.L*boatK(def, e))}`, () => { sel = { kind: 'start', i: n }; frameBoat(n); refreshPanel(); }, on ? 'on' : ''),
                button('↑', () => moveBoat(n, -1)), button('↓', () => moveBoat(n, 1))]));
        });
        const typeSel = el('select', { onchange: () => { addBoatType = typeSel.value; } });
        for (const [v, text] of boatOptions()) typeSel.append(el('option', { value: v, textContent: text, selected: v == addBoatType }));
        panel.append(field('type', typeSel), el('div', { className: 'row' }, [
            button('Add to chain', () => add('start', addBoatType)), button('Add moored', () => add('moored', addBoatType)),
            button('Add loose', () => add('drifters', addBoatType))]));
        panel.append(el('h3', { textContent: 'Add' }), el('div', { className: 'row' }, [
            button('Buoy', () => add('buoys')), button('Log', () => add('logs')), button('Ducks', () => add('ducks')),
            button('Sand', () => add('land')), button('Dock', () => add('docks')), button('Landmass', () => add('lands')), button('Current', () => add('currents'))]));

        panel.append(el('h3', { textContent: sel ? selTitle() : 'Selection' }));
        selectionFields();

        panel.append(el('h3', { textContent: 'Keys' }), el('div', { className: 'keys', innerHTML: `
            <b>E</b> play / edit · <b>Shift+E</b> play from the selected boat<br>
            <b>drag empty</b> pan · <b>wheel</b> zoom · <b>click</b> select · <b>drag</b> move<br>
            <b>drag an edge</b> resize sand, dock, current · <b>Shift+drag empty</b> new sand<br>
            Slips under a pier slide along it; <b>Shift</b> moves them off it<br>
            <b>Alt</b> no snap · <b>arrows</b> nudge (Shift: ×10) · <b>[ ]</b> rotate 15° (Shift: 90°)<br>
            <b>1–9</b> select boat · <b>F</b> frame selection · <b>Shift+F</b> frame all<br>
            <b>D</b> duplicate · <b>Delete</b> remove · <b>T</b> sand → dock → quay<br>
            <b>, .</b> previous / next level · <b>⌘Z</b> undo · <b>⇧⌘Z</b> redo · <b>⌘S</b> save · <b>Esc</b> deselect` }));
    }

    function selTitle()
    {
        const n = sel.i + 1;
        return {
            start: `Boat ${n}: start`, slip: `Boat ${n}: slip`, moored: 'Moored boat', drifters: 'Loose boat', buoys: 'Buoy', logs: 'Log',
            ducks: 'Duck family', lands: 'Landmass', land: 'Sand', docks: def.docks[sel.i]?.quay ? 'Quay' : 'Dock', currents: 'Current',
        }[sel.kind];
    }

    function selectionFields()
    {
        const grid = kids => el('div', { className: 'grid2' }, kids);
        if (!sel) return panel.append(el('div', { className: 'keys', textContent: 'Click something in the level, or a boat in the list.' }));
        const i = sel.i;
        if (sel.kind == 'start' || sel.kind == 'slip')
        {
            const e = def.boats[i], t = BOATS[e.boat];
            panel.append(el('div', { className: 'row' }, [
                button('Start', () => { sel = { kind: 'start', i }; refreshPanel(); }, sel.kind == 'start' ? 'on' : ''),
                button('Slip', () => { sel = { kind: 'slip', i }; refreshPanel(); }, sel.kind == 'slip' ? 'on' : ''),
                button('Frame (F)', frameSel), button('Play from here', () => { sel = { kind: 'start', i }; play(true); })]));
            panel.append(field('boat', select(boatOptions(), () => e.boat, v => { e.boat = v; })));
            panel.append(field('size k', input('number', () => e.k, v => { if (v === undefined) delete e.k; else e.k = v; }, { placeholder: `real size (${t.k})`, step: 'any' })));
            panel.append(field('hint', input('text', () => e.hint, v => { if (v) e.hint = v; else delete e.hint; })));
            if (sel.kind == 'start')
                panel.append(grid([field('x', numIn(e.start, 'x', { step: 'any' })), field('y', numIn(e.start, 'y', { step: 'any' }))]),
                    field('heading°', degIn(() => e.start.a, v => { e.start.a = v; })));
            else slipFields(e.slip, i);
            return;
        }
        if (sel.kind == 'moored' || sel.kind == 'drifters')
        {
            const m = def[sel.kind][i];
            panel.append(field('boat', select(boatOptions(), () => m.boat, v => { m.boat = v; })),
                field('size k', input('number', () => m.k, v => { if (v === undefined) delete m.k; else m.k = v; }, { placeholder: `real size (${BOATS[m.boat].k})`, step: 'any' })),
                grid([field('x', numIn(m, 'x', { step: 'any' })), field('y', numIn(m, 'y', { step: 'any' }))]),
                field('heading°', degIn(() => m.a, v => { m.a = v; })));
            return;
        }
        if (sel.kind == 'buoys' || sel.kind == 'logs')
        {
            const a = def[sel.kind][i], at = (k, set) => input('number', () => a[k], set || (v => { a[k] = v ?? 0; }), { step: 'any' });
            panel.append(grid([field('x', at(0)), field('y', at(1))]));
            if (sel.kind == 'buoys') panel.append(field('scale', at(2, v => { a[2] = v ?? 1; })));
            else panel.append(field('heading°', degIn(() => a[2] || 0, v => { a[2] = v; })));
            return;
        }
        if (sel.kind == 'ducks')
        {
            const f = def.ducks[i];
            panel.append(grid([field('x', numIn(f, 'x', { step: 'any' })), field('y', numIn(f, 'y', { step: 'any' }))]), field('ducklings', numIn(f, 'kids', { step: 1, min: 0, max: 8 })));
            return;
        }
        if (sel.kind == 'lands')
        {
            const m = def.lands[i];
            const area = el('textarea', { value: JSON.stringify(m.circles) });
            area.onchange = () =>
            {
                try { const c = JSON.parse(area.value); if (!Array.isArray(c) || !c.length || !c.every(x => Array.isArray(x) && x.length == 3 && x.every(isFinite))) throw 0; snapshot(); m.circles = c; changed(); }
                catch { status = 'Circles must look like [[0, 0, 1], [1.2, 0.3, 0.7]]'; refreshPanel(); }
            };
            panel.append(grid([field('x', numIn(m, 'x', { step: 'any' })), field('y', numIn(m, 'y', { step: 'any' }))]),
                field('scale k', numIn(m, 'k', { step: 'any' })),
                el('label', {}, [el('input', { type: 'checkbox', checked: !!m.grass, onchange: e => { snapshot(); if (e.target.checked) m.grass = true; else delete m.grass; changed(); } }), 'grass']),
                el('div', { className: 'keys', textContent: 'Circles [x, y, r] in units of k; the first one sits on the center.' }), area);
            return;
        }
        // rects: sand, docks, currents
        const r = sel.kind == 'land' ? def.land[i] : def[sel.kind][i];
        const side = (label, k, n) => field(label, sel.kind == 'land' ? input('number', () => r[n], v => { r[n] = v ?? 0; }, { step: 'any' }) : numIn(r, k, { step: 'any' }));
        panel.append(grid([side('left', 'x0', 0), side('right', 'x1', 2), side('bottom', 'y0', 1), side('top', 'y1', 3)]));
        if (sel.kind == 'currents') panel.append(grid([field('flow x', numIn(r, 'dx', { step: 'any' })), field('flow y', numIn(r, 'dy', { step: 'any' }))]));
        if (sel.kind != 'currents') panel.append(el('div', { className: 'keys', textContent: 'T: sand → dock → quay → sand' }));
    }

    function slipFields(s, n)
    {
        const grid = kids => el('div', { className: 'grid2' }, kids);
        const mode = s.top !== undefined ? 'top' : s.right !== undefined ? 'right' : 'center';
        // switching how the slip is placed keeps it where it is
        const setMode = m =>
        {
            const g = slips[n], x = g.pos.x, y = g.pos.y;
            delete s.x; delete s.y; delete s.top; delete s.right;
            if (m == 'top') Object.assign(s, { x, top: y + g.h/2 });
            else if (m == 'right') Object.assign(s, { right: x + g.w/2, y });
            else Object.assign(s, { x, y });
        };
        panel.append(field('placed', select([['center', 'by its center'], ['top', 'under a pier edge (top)'], ['right', 'left of a pier edge (right)']], () => mode, setMode)));
        if (mode == 'right') panel.append(grid([field('right', numIn(s, 'right', { step: 'any' })), field('y', numIn(s, 'y', { step: 'any' }))]));
        else panel.append(grid([field('x', numIn(s, 'x', { step: 'any' })), mode == 'top' ? field('top', numIn(s, 'top', { step: 'any' })) : field('y', numIn(s, 'y', { step: 'any' }))]));
        const headings = [[0, '0° (along x)'], [angle(PI/2), '90° (bow up)'], [angle(PI), '180°'], [angle(-PI/2), '-90° (bow down)']];
        panel.append(field('heading', select(headings, () => angle(s.a), v => { s.a = evalCode(v); })));
        const pad = s.pad || [1.4, 1];
        panel.append(grid([
            field('room L', input('number', () => pad[0], v => { s.pad = [v ?? 1.4, pad[1]]; }, { step: .1 })),
            field('room W', input('number', () => pad[1], v => { s.pad = [pad[0], v ?? 1]; }, { step: .1 }))]));
        panel.append(field('fingers', select([['both', 'short docks both sides'], ['none', 'none']], () => s.fingers || 'both', v => { if (v == 'none') s.fingers = 'none'; else delete s.fingers; })));
        panel.append(el('div', { className: 'keys', textContent: 'Room is extra length and width in toy units, times the boat size. Boats 50 m and longer get 15% on top.' }));
    }

    addEventListener('keydown', key);
    // ?edit or ?edit=<level number> opens the editor once the game is running
    const want = new URLSearchParams(location.search).get('edit');
    if (want !== null) setTimeout(() => open(want ? +want - 1 : 0), 300);
    addEventListener('beforeunload', e => { if (dirty.size) e.preventDefault(); });

    return ED;
})();
