/*
    DOCK ALL THE BOATS - boat model editor (debug tool). Open tools/boat-editor.html in Chrome.

    It loads the game's own src/boats.js and src/render.js, so a boat looks here exactly as in the game.
    Left: the boat types, then the selected boat's deck shapes in draw order (top of the list is drawn first).
    Middle: the boat at toy size (1 grid square = 1 toy unit; real size is toy size times k), with its
    collision circles, and the same boat at three in-game sizes along the bottom. Right: the boat's numbers
    (size, handling, hull, colors) and the selected shape's fields.

    Each boat's deck drawing (BOAT_DECO in boats.js) is code. The editor runs it once with a recording
    painter, so it becomes a list of shapes you can drag and edit. Save (Cmd+S) writes src/boats.js in
    place through Chrome's file access (pick the park-my-boat or src folder once): only the boats you
    changed are rewritten; a changed deck becomes plain d.circle(...) / d.poly(...) calls with numbers
    (loops unrolled), changed numbers become one BOATS line. Everything else in the file keeps its text.
    Decks that animate in code (the sailboat's sail, the container ship's colors) turn into a still
    drawing once edited; the inspector warns about it.

    Console check (over HTTP): await boatEditor.selfTest() writes every boat out in full and checks the
    result loads back to the same numbers and shapes.
*/

'use strict';

window.boatEditor = (() =>
{
    const LEFT = 250, RIGHT = 330;                    // panel widths in CSS px (match boat-editor.html)
    const SNAP = .05;
    const C_SEL = rgb(.25, .53, 1);
    const NAMED = ['C_INK','C_CREAM','C_WATER','C_WATER2','C_WOOD','C_WOOD2','C_CORAL','C_SUNNY','C_TEAL','C_NAVY','C_ORANGE','C_SAND','C_STONE','C_GRASS','C_SHADOW','C_CLEAR'];
    const NAMED_COLOR = {};
    for (const n of NAMED) try { NAMED_COLOR[n] = Function(`return ${n}`)(); } catch {}
    const DERIVED = new Set(['key', 'hullPts', 'deckPts', 'circles', 'film']);
    const COLOR_FIELDS = new Set(['color', 'deck']);
    const HULLS = ['pointy', 'box', 'capsule', 'swan'];
    const FIELDS =
    [
        ['name', 'text', 'Name shown in the game'],
        ['L', 'num', 'Toy length along the bow (grid units)'],
        ['W', 'num', 'Toy width across'],
        ['k', 'num', 'Scale to real size: real length in meters = L x k'],
        ['mass', 'num', 'Toy mass; the game scales it by k cubed'],
        ['power', 'num', 'Engine power'],
        ['reverse', 'num', 'Reverse power as a share of forward'],
        ['turn', 'num', 'Rudder strength'],
        ['wash', 'num', 'Prop wash turning at low speed'],
        ['dragF', 'num', 'Water drag along the keel'],
        ['dragS', 'num', 'Water drag sideways (keel grip)'],
        ['dragA', 'num', 'Spin drag'],
        ['hull', 'hull', 'Hull outline shape'],
        ['color', 'color', 'Hull color'],
        ['deck', 'color?', 'Deck color (empty: hull color mixed with cream)'],
        ['view', 'num?', 'Camera shows this many times more around the boat'],
        ['sub', 'bool?', 'Dives like a submarine'],
        ['scope', 'num?', 'Mini sub: where the periscope nub sits'],
        ['blob', 'blob', 'Landmass circles [x, y, r], the first on the origin'],
    ];

    ///////////////////////////////////////////////////////////////////////////
    // colors are kept as source text (C_TEAL, rgb(.4, .7, .8)) so shapes can be cloned and written back

    const fmt = n => { let s = String(Math.round(n*1000)/1000); if (s == '-0') s = '0'; return s.replace(/^(-?)0\./, '$1.'); };
    const colorCache = new Map();
    function colorOf(expr)
    {
        if (NAMED_COLOR[expr]) return NAMED_COLOR[expr];
        let c = colorCache.get(expr);
        if (!c)
        {
            const m = /^rgb\(([^)]*)\)$/.exec(expr), v = m ? m[1].split(',').map(Number) : [1, 0, 1];
            c = rgb(v[0], v[1], v[2], v.length > 3 ? v[3] : 1);
            colorCache.set(expr, c);
        }
        return c;
    }
    function exprOf(c)
    {
        if (!c) return 'C_CLEAR';
        for (const n of NAMED) { const k = NAMED_COLOR[n]; if (k && Math.abs(k.r - c.r) + Math.abs(k.g - c.g) + Math.abs(k.b - c.b) + Math.abs(k.a - c.a) < 1e-4) return n; }
        return `rgb(${fmt(c.r)}, ${fmt(c.g)}, ${fmt(c.b)}${c.a < 1 ? ', ' + fmt(c.a) : ''})`;
    }
    const cssOf = expr => { const c = colorOf(expr); return `rgba(${c.r*255|0},${c.g*255|0},${c.b*255|0},${c.a})`; };
    const hexOf = expr => { const c = colorOf(expr); return '#' + [c.r, c.g, c.b].map(v => Math.round(clamp(v, 0, 1)*255).toString(16).padStart(2, '0')).join(''); };

    ///////////////////////////////////////////////////////////////////////////
    // model: every boat's numbers and deck shapes

    const ORIG_DECO = { ...BOAT_DECO };
    const M = {};                       // key -> { stats, shapes, dynamic, statsEdited, decoEdited, isNew, base }

    // run a deck function with a painter that writes down every call
    function record(fn, t)
    {
        const shapes = [];
        const rec =
        {
            P: (x, y) => vec2(x, y),
            circle(x, y, d, color, outline) { shapes.push({ kind:'circle', x, y, d, color:exprOf(color), outline:!!outline }); },
            ellipse(x, y, w, h, color, outline) { shapes.push({ kind:'ellipse', x, y, w, h, color:exprOf(color), outline:!!outline }); },
            rect(x, y, w, h, color, outline) { shapes.push({ kind:'rect', x, y, w, h, color:exprOf(color), outline:!!outline }); },
            poly(pts, color, outline) { shapes.push({ kind:'poly', pts:pts.map(p => p.x === undefined ? [p[0], p[1]] : [p.x, p.y]), color:exprOf(color), outline:!!outline }); },
            line(x1, y1, x2, y2, w, color) { shapes.push({ kind:'line', x1, y1, x2, y2, w, color:exprOf(color) }); },
            text(str, x, y, size, color) { shapes.push({ kind:'text', str:String(str), x, y, size, color:exprOf(color) }); },
        };
        fn(rec, t, undefined);
        return shapes;
    }

    // a deck function without loops: the comment on each call's line becomes that shape's label
    function labels(fn, shapes)
    {
        const lines = fn.toString().split('\n'), calls = /\bd\.(circle|ellipse|poly|rect|line|text)\(/g;
        const found = [];
        for (const line of lines)
        {
            const n = (line.match(calls) || []).length, c = line.indexOf('//');
            for (let i = 0; i < n; i++) found.push(i == 0 && c >= 0 ? line.slice(c + 2).trim() : '');
        }
        if (found.length == shapes.length) shapes.forEach((s, i) => { if (found[i]) s.label = found[i]; });
    }

    function statsOf(t)
    {
        const st = {};
        for (const f of Object.keys(t))
        {
            if (DERIVED.has(f)) continue;
            const v = t[f];
            st[f] = COLOR_FIELDS.has(f) ? exprOf(v) : v && typeof v == 'object' ? structuredClone(v) : v;
        }
        return st;
    }

    for (const key in BOATS)
    {
        const t = BOATS[key], fn = ORIG_DECO[key];
        const shapes = fn ? record(fn, t) : [];
        if (fn) labels(fn, shapes);
        const body = fn ? fn.toString().replace(/^[^{]*/, '') : '';
        M[key] = { stats: statsOf(t), shapes, dynamic: /\btime\b|\bb\s*\?|\bb\./.test(body), statsEdited: false, decoEdited: false, isNew: false };
        M[key].base = structuredClone({ stats: M[key].stats, shapes });
    }

    function drawShapes(d, shapes)
    {
        for (const s of shapes)
        {
            const c = colorOf(s.color);
            if (s.kind == 'circle') d.circle(s.x, s.y, s.d, c, s.outline);
            else if (s.kind == 'ellipse') d.ellipse(s.x, s.y, s.w, s.h, c, s.outline);
            else if (s.kind == 'rect') d.rect(s.x, s.y, s.w, s.h, c, s.outline);
            else if (s.kind == 'poly') d.poly(s.pts, c, s.outline);
            else if (s.kind == 'line') d.line(s.x1, s.y1, s.x2, s.y2, s.w, c);
            else if (s.kind == 'text') d.text(s.str, s.x, s.y, s.size, c);
        }
    }
    function hookDeco(key)
    {
        BOAT_DECO[key] = (d, t, b) => { const m = M[key]; m.dynamic && !m.decoEdited && ORIG_DECO[key] ? ORIG_DECO[key](d, t, b) : drawShapes(d, m.shapes); };
    }
    for (const key in M) hookDeco(key);

    // put a boat's numbers back on its BOATS type and rebuild its hull and collision circles (as boats.js does)
    function applyStats(key)
    {
        const t = BOATS[key], st = M[key].stats;
        for (const f of Object.keys(t)) if (!DERIVED.has(f)) delete t[f];
        for (const f of Object.keys(st)) t[f] = COLOR_FIELDS.has(f) ? colorOf(st[f]) : structuredClone(st[f]);
        t.key = key;
        t.hullPts = t.blob ? blobOutline(t.blob) : makeHull(t.hull, t.L, t.W);
        t.deckPts = t.hullPts.map(p => t.blob ? p.scale(.8) : vec2(p.x*.78, p.y*.68));
        t.circles = t.blob ? t.blob.map(([x, y, r]) => ({ x, y, r })) :
            t.hull == 'pointy' ? fitCircles(t.hullPts, t.L, t.W) : makeCircles(t.L, t.W);
    }

    ///////////////////////////////////////////////////////////////////////////
    // editor state, undo

    let key = M.jetski ? 'jetski' : Object.keys(M)[0];
    let sel = [];                   // selected shape indices
    let vtx = -1;                   // selected poly vertex (single poly selected)
    let showCircles = true, showGrid = true, status = '';
    const cam = { pos: vec2(), scale: 100, fitted: '' };
    let undo = [], redo = [], lastTag = null;

    const cur = () => M[key];
    const snap = () => ({ key, stats: structuredClone(cur().stats), shapes: structuredClone(cur().shapes), statsEdited: cur().statsEdited, decoEdited: cur().decoEdited });
    function pushUndo(tag)
    {
        if (tag && tag === lastTag) return;
        lastTag = tag || null;
        undo.push(snap());
        if (undo.length > 200) undo.shift();
        redo = [];
    }
    function restore(s)
    {
        const m = M[s.key];
        if (!m) return;
        Object.assign(m, { stats: s.stats, shapes: s.shapes, statsEdited: s.statsEdited, decoEdited: s.decoEdited });
        applyStats(s.key);
        if (key != s.key) { key = s.key; cam.fitted = ''; }
        sel = sel.filter(i => i < m.shapes.length); vtx = -1;
        lastTag = null;
        refresh();
    }
    function doUndo() { const s = undo.pop(); if (!s) return; redo.push(snapOf(s.key)); restore(s); }
    function doRedo() { const s = redo.pop(); if (!s) return; undo.push(snapOf(s.key)); restore(s); }
    function snapOf(k) { const m = M[k]; return { key: k, stats: structuredClone(m.stats), shapes: structuredClone(m.shapes), statsEdited: m.statsEdited, decoEdited: m.decoEdited }; }

    const editDeco = () => { cur().decoEdited = true; };
    const editStats = () => { cur().statsEdited = true; applyStats(key); };

    ///////////////////////////////////////////////////////////////////////////
    // shape geometry: move, mirror, hit test, handles

    function move(s, dx, dy)
    {
        if (s.kind == 'line') { s.x1 += dx; s.x2 += dx; s.y1 += dy; s.y2 += dy; }
        else if (s.kind == 'poly') s.pts = s.pts.map(([x, y]) => [x + dx, y + dy]);
        else { s.x += dx; s.y += dy; }
    }
    function mirror(s)
    {
        if (s.kind == 'line') { s.y1 = -s.y1; s.y2 = -s.y2; }
        else if (s.kind == 'poly') s.pts = s.pts.map(([x, y]) => [x, -y]);
        else s.y = -s.y;
    }
    function roundShape(s)
    {
        const r = v => Math.round(v*1000)/1000;
        for (const f of ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'd', 'w', 'h', 'size']) if (typeof s[f] == 'number') s[f] = r(s[f]);
        if (s.pts) s.pts = s.pts.map(([x, y]) => [r(x), r(y)]);
    }
    function bounds(s)
    {
        if (s.kind == 'circle') return [s.x - s.d/2, s.y - s.d/2, s.x + s.d/2, s.y + s.d/2];
        if (s.kind == 'ellipse' || s.kind == 'rect') return [s.x - s.w/2, s.y - s.h/2, s.x + s.w/2, s.y + s.h/2];
        if (s.kind == 'line') return [Math.min(s.x1, s.x2) - s.w/2, Math.min(s.y1, s.y2) - s.w/2, Math.max(s.x1, s.x2) + s.w/2, Math.max(s.y1, s.y2) + s.w/2];
        if (s.kind == 'text') { const hw = s.size*.32*Math.max(1, s.str.length), hh = s.size*.5; return [s.x - hw, s.y - hh, s.x + hw, s.y + hh]; }
        const xs = s.pts.map(p => p[0]), ys = s.pts.map(p => p[1]);
        return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
    function segDist(p, ax, ay, bx, by)
    {
        const dx = bx - ax, dy = by - ay, u = clamp(((p.x - ax)*dx + (p.y - ay)*dy) / (dx*dx + dy*dy || 1), 0, 1);
        return Math.hypot(ax + u*dx - p.x, ay + u*dy - p.y);
    }
    function hit(s, p, slop)
    {
        if (s.kind == 'circle') return Math.hypot(p.x - s.x, p.y - s.y) <= s.d/2 + slop;
        if (s.kind == 'ellipse') return ((p.x - s.x)/(s.w/2 + slop))**2 + ((p.y - s.y)/(s.h/2 + slop))**2 <= 1;
        if (s.kind == 'line') return segDist(p, s.x1, s.y1, s.x2, s.y2) <= s.w/2 + slop;
        if (s.kind == 'poly')
        {
            let inside = false;
            for (let i = 0, j = s.pts.length - 1; i < s.pts.length; j = i++)
            {
                const [xi, yi] = s.pts[i], [xj, yj] = s.pts[j];
                if ((yi > p.y) != (yj > p.y) && p.x < (xj - xi)*(p.y - yi)/(yj - yi) + xi) inside = !inside;
            }
            if (inside) return true;
            return s.pts.some((a, i) => { const b = s.pts[(i + 1) % s.pts.length]; return segDist(p, a[0], a[1], b[0], b[1]) <= slop; });
        }
        const [x0, y0, x1, y1] = bounds(s);
        return p.x >= x0 - slop && p.x <= x1 + slop && p.y >= y0 - slop && p.y <= y1 + slop;
    }
    // drag handles of one shape: where they are and what dragging them to p does
    function handles(s)
    {
        if (s.kind == 'circle') return [{ x: s.x + s.d/2, y: s.y, set: p => { s.d = Math.max(.02, 2*Math.hypot(p.x - s.x, p.y - s.y)); } }];
        if (s.kind == 'ellipse' || s.kind == 'rect') return [
            { x: s.x + s.w/2, y: s.y, set: p => { s.w = Math.max(.02, 2*Math.abs(p.x - s.x)); } },
            { x: s.x, y: s.y + s.h/2, set: p => { s.h = Math.max(.02, 2*Math.abs(p.y - s.y)); } },
            { x: s.x + s.w/2, y: s.y + s.h/2, set: p => { s.w = Math.max(.02, 2*Math.abs(p.x - s.x)); s.h = Math.max(.02, 2*Math.abs(p.y - s.y)); } }];
        if (s.kind == 'line') return [
            { x: s.x1, y: s.y1, set: p => { s.x1 = p.x; s.y1 = p.y; } },
            { x: s.x2, y: s.y2, set: p => { s.x2 = p.x; s.y2 = p.y; } }];
        if (s.kind == 'poly') return s.pts.map((q, i) => ({ x: q[0], y: q[1], vtx: i, set: p => { s.pts[i] = [p.x, p.y]; } }));
        return [];
    }

    ///////////////////////////////////////////////////////////////////////////
    // camera and mouse

    const px = () => mainCanvasSize.x / innerWidth;                 // canvas pixels per CSS pixel
    const freeCenterCss = () => vec2((LEFT + innerWidth - RIGHT)/2, innerHeight*.42);
    function fit()
    {
        const t = BOATS[key], [x0, y0, x1, y1] = cur().shapes.reduce((b, s) => { const r = bounds(s); return [Math.min(b[0], r[0]), Math.min(b[1], r[1]), Math.max(b[2], r[2]), Math.max(b[3], r[3])]; }, [-t.L/2, -t.W/2, t.L/2, t.W/2]);
        const w = (innerWidth - LEFT - RIGHT)*px(), h = innerHeight*.62*px();
        cam.scale = Math.min(w*.8/(x1 - x0 + .6), h*.8/(y1 - y0 + 1.2));
        cam.pos = vec2((x0 + x1)/2, (y0 + y1)/2);
        cam.fitted = key;
    }
    function applyCamera()
    {
        if (cam.fitted != key) fit();
        const off = freeCenterCss().subtract(vec2(innerWidth/2, innerHeight/2)).scale(px());
        setCameraScale(cam.scale);
        setCameraPos(cam.pos.subtract(vec2(off.x, -off.y).scale(1/cam.scale)));
        const ui = Math.min(mainCanvasSize.x/40, mainCanvasSize.y/22.5);
        WU = ui / cam.scale;
        LINE_W = .1*WU;
    }
    const toCanvas = e => { const r = mainCanvas.getBoundingClientRect(); return vec2((e.clientX - r.left)*mainCanvasSize.x/r.width, (e.clientY - r.top)*mainCanvasSize.y/r.height); };
    const worldAt = e => screenToWorld(toCanvas(e));
    const snapV = (v, free) => free ? v : Math.round(v/SNAP)*SNAP;

    let drag = null;
    function pointerDown(e)
    {
        if (document.activeElement && document.activeElement != document.body) document.activeElement.blur();
        const p = worldAt(e), slop = 6*px()/cam.scale, shapes = cur().shapes;
        if (e.button != 0) { drag = { pan: true, last: toCanvas(e) }; return; }
        // a handle of the single selected shape
        if (sel.length == 1)
            for (const h of handles(shapes[sel[0]]))
                if (Math.hypot(p.x - h.x, p.y - h.y) <= slop*1.4)
                {
                    pushUndo(); editDeco();
                    if (h.vtx !== undefined) vtx = h.vtx;
                    drag = { handle: h, shape: shapes[sel[0]] };
                    refresh();
                    return;
                }
        let i = shapes.length;
        while (i--) if (hit(shapes[i], p, slop)) break;
        if (i < 0)
        {
            if (!e.shiftKey) { sel = []; vtx = -1; refresh(); }
            drag = { pan: true, last: toCanvas(e) };
            return;
        }
        if (e.shiftKey || e.metaKey || e.ctrlKey)
        {
            sel = sel.includes(i) ? sel.filter(j => j != i) : [...sel, i];
            vtx = -1; refresh();
            if (!sel.includes(i)) return;
        }
        else if (!sel.includes(i)) { sel = [i]; vtx = -1; refresh(); }
        drag = { start: p, orig: sel.map(j => structuredClone(shapes[j])), moved: false };
    }
    function pointerMove(e)
    {
        if (!drag) return;
        if (drag.pan)
        {
            const c = toCanvas(e), d = c.subtract(drag.last);
            cam.pos = cam.pos.add(vec2(-d.x, d.y).scale(1/cam.scale));
            drag.last = c;
            return;
        }
        const p = worldAt(e);
        if (drag.handle)
        {
            drag.handle.set(vec2(snapV(p.x, e.altKey), snapV(p.y, e.altKey)));
            roundShape(drag.shape);
            refreshInspector();
            return;
        }
        let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        if (!drag.moved && Math.hypot(dx, dy)*cam.scale < 3*px()) return;
        if (!drag.moved) { pushUndo(); editDeco(); drag.moved = true; }
        if (!e.altKey) { dx = snapV(dx); dy = snapV(dy); }
        if (e.shiftKey) Math.abs(dx) > Math.abs(dy) ? dy = 0 : dx = 0;
        const shapes = cur().shapes;
        sel.forEach((j, n) => { const s = structuredClone(drag.orig[n]); move(s, dx, dy); roundShape(s); shapes[j] = s; });
        refreshInspector();
    }
    function pointerUp() { if (drag && (drag.moved || drag.handle)) refresh(); drag = null; }
    function wheel(e)
    {
        e.preventDefault();
        const before = worldAt(e);
        cam.scale = clamp(cam.scale * Math.exp(-e.deltaY*.0015), 2, 5000);
        applyCamera();
        const after = worldAt(e);
        cam.pos = cam.pos.add(before.subtract(after));
    }

    ///////////////////////////////////////////////////////////////////////////
    // shape commands

    function addShape(kind)
    {
        pushUndo(); editDeco();
        const c = cam.fitted == key ? cam.pos : vec2(), x = snapV(c.x), y = snapV(c.y), shapes = cur().shapes;
        const s =
            kind == 'circle' ? { kind, x, y, d: .6, color: 'C_CREAM', outline: true } :
            kind == 'ellipse' ? { kind, x, y, w: .9, h: .5, color: 'C_CREAM', outline: true } :
            kind == 'rect' ? { kind, x, y, w: .8, h: .5, color: 'C_CREAM', outline: true } :
            kind == 'line' ? { kind, x1: x - .4, y1: y, x2: x + .4, y2: y, w: .1, color: 'C_INK' } :
            kind == 'poly' ? { kind, pts: [[x + .4, y], [x - .3, y + .35], [x - .3, y - .35]], color: 'C_SUNNY', outline: true } :
            { kind: 'text', str: 'A', x, y, size: .6, color: 'C_INK' };
        roundShape(s);
        shapes.push(s);
        sel = [shapes.length - 1]; vtx = -1;
        refresh();
    }
    function deleteSel()
    {
        const shapes = cur().shapes;
        if (sel.length == 1 && vtx >= 0 && shapes[sel[0]].kind == 'poly' && shapes[sel[0]].pts.length > 3)
        {
            pushUndo(); editDeco();
            shapes[sel[0]].pts.splice(vtx, 1); vtx = -1;
            return refresh();
        }
        if (!sel.length) return;
        pushUndo(); editDeco();
        cur().shapes = shapes.filter((s, i) => !sel.includes(i));
        sel = []; vtx = -1;
        refresh();
    }
    function duplicateSel(mirrored)
    {
        if (!sel.length) return;
        pushUndo(); editDeco();
        const shapes = cur().shapes, order = [...sel].sort((a, b) => a - b), added = [];
        let shift = 0;
        for (const i of order)
        {
            const s = structuredClone(shapes[i + shift]);
            if (mirrored) mirror(s); else move(s, .1, -.1);
            roundShape(s);
            shapes.splice(i + shift + 1, 0, s);
            added.push(i + shift + 1);
            shift++;
        }
        sel = added; vtx = -1;
        refresh();
    }
    function flipSel()
    {
        if (!sel.length) return;
        pushUndo(); editDeco();
        for (const i of sel) { mirror(cur().shapes[i]); roundShape(cur().shapes[i]); }
        refresh();
    }
    function nudge(dx, dy)
    {
        if (!sel.length) return;
        pushUndo('nudge'); editDeco();
        for (const i of sel) { move(cur().shapes[i], dx, dy); roundShape(cur().shapes[i]); }
        refresh();
    }
    // move the selection one step earlier (drawn below) or later (drawn on top)
    function reorder(dir)
    {
        const shapes = cur().shapes;
        if (!sel.length) return;
        const order = [...sel].sort((a, b) => dir < 0 ? a - b : b - a);
        if (dir < 0 ? order[0] == 0 : order[0] == shapes.length - 1) return;
        pushUndo(); editDeco();
        const moved = [];
        for (const i of order) { const j = i + dir; [shapes[i], shapes[j]] = [shapes[j], shapes[i]]; moved.push(j); }
        sel = moved;
        refresh();
    }
    function insertVertex()
    {
        const s = cur().shapes[sel[0]];
        if (sel.length != 1 || s.kind != 'poly') return;
        pushUndo(); editDeco();
        const i = vtx >= 0 ? vtx : s.pts.length - 1, a = s.pts[i], b = s.pts[(i + 1) % s.pts.length];
        s.pts.splice(i + 1, 0, [(a[0] + b[0])/2, (a[1] + b[1])/2]);
        roundShape(s);
        vtx = i + 1;
        refresh();
    }

    ///////////////////////////////////////////////////////////////////////////
    // boat commands

    function selectBoat(k) { if (k == key) return; key = k; sel = []; vtx = -1; cam.fitted = ''; lastTag = null; refresh(); }
    function newBoat()
    {
        const input = document.getElementById('be-newkey'), k = input.value.trim();
        if (!/^[a-z][a-zA-Z0-9]*$/.test(k)) { status = 'Key: a lowercase letter, then letters or digits (like "tugboat")'; return refresh(); }
        if (BOATS[k] || M[k]) { status = `There is already a boat called ${k}`; return refresh(); }
        const from = cur();
        BOATS[k] = {};
        M[k] = { stats: structuredClone(from.stats), shapes: structuredClone(from.shapes), dynamic: false, statsEdited: true, decoEdited: true, isNew: true };
        M[k].stats.name = (from.stats.name || k) + ' Copy';
        M[k].base = null;
        applyStats(k);
        hookDeco(k);
        status = `New boat ${k}, copied from ${key}. Save to add it to boats.js`;
        key = k; sel = []; vtx = -1; cam.fitted = '';
        refresh();
    }
    function revertBoat()
    {
        const m = cur();
        if (m.isNew)
        {
            delete M[key]; delete BOATS[key]; delete BOAT_DECO[key];
            undo = undo.filter(s => s.key != key); redo = redo.filter(s => s.key != key);
            status = `Dropped the new boat ${key}`;
            key = Object.keys(M)[0]; sel = []; cam.fitted = '';
            return refresh();
        }
        pushUndo();
        m.stats = structuredClone(m.base.stats); m.shapes = structuredClone(m.base.shapes);
        m.statsEdited = m.decoEdited = false;
        applyStats(key);
        sel = []; vtx = -1;
        status = `${key} is back as it is in the file`;
        refresh();
    }

    ///////////////////////////////////////////////////////////////////////////
    // writing src/boats.js

    const quote = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    function valText(f, v)
    {
        if (COLOR_FIELDS.has(f)) return v;
        if (typeof v == 'number') return fmt(v);
        if (typeof v == 'string') return quote(v);
        if (Array.isArray(v)) return '[' + v.map(x => Array.isArray(x) ? '[' + x.map(fmt).join(',') + ']' : typeof x == 'number' ? fmt(x) : JSON.stringify(x)).join(',') + ']';
        return JSON.stringify(v);
    }
    function entryText(k)
    {
        const st = M[k].stats, parts = [];
        for (const f of Object.keys(st)) if (f != 'blob' && st[f] !== undefined) parts.push(`${f}:${valText(f, st[f])}`);
        let s = `    ${(k + ':').padEnd(11)}{ ${parts.join(', ')}`;
        if (st.blob) s += `,\n                 blob:${valText('blob', st.blob)}`;
        return s + ' },';
    }
    function callText(s)
    {
        const o = s.outline ? ', true' : '', c = s.color, n = fmt;
        if (s.kind == 'circle') return `d.circle(${n(s.x)}, ${n(s.y)}, ${n(s.d)}, ${c}${o});`;
        if (s.kind == 'ellipse') return `d.ellipse(${n(s.x)}, ${n(s.y)}, ${n(s.w)}, ${n(s.h)}, ${c}${o});`;
        if (s.kind == 'rect') return `d.rect(${n(s.x)}, ${n(s.y)}, ${n(s.w)}, ${n(s.h)}, ${c}${o});`;
        if (s.kind == 'poly') return `d.poly([${s.pts.map(p => `[${n(p[0])},${n(p[1])}]`).join(',')}], ${c}${o});`;
        if (s.kind == 'line') return `d.line(${n(s.x1)}, ${n(s.y1)}, ${n(s.x2)}, ${n(s.y2)}, ${n(s.w)}, ${c});`;
        return `d.text(${quote(s.str)}, ${n(s.x)}, ${n(s.y)}, ${n(s.size)}, ${c});`;
    }
    function decoText(k)
    {
        const calls = M[k].shapes.map(s => '        ' + callText(s));
        const w = Math.max(0, ...calls.map(c => c.length)) + 3;
        const lines = M[k].shapes.map((s, i) => s.label ? calls[i].padEnd(w) + '// ' + s.label.replace(/\n/g, ' ') : calls[i]);
        return [`    ${k}(d, t, b)`, '    {', ...lines, '    },'].join('\n');
    }

    // index of the brace that closes the one at `open`, skipping strings and comments
    function closeOf(text, open)
    {
        let depth = 0;
        for (let i = open; i < text.length; i++)
        {
            const ch = text[i];
            if (ch == '/' && text[i + 1] == '/') { i = text.indexOf('\n', i); if (i < 0) break; continue; }
            if (ch == '/' && text[i + 1] == '*') { i = text.indexOf('*/', i) + 1; continue; }
            if (ch == "'" || ch == '"' || ch == '`') { for (i++; i < text.length && text[i] != ch; i++) if (text[i] == '\\') i++; continue; }
            if (ch == '{') depth++;
            else if (ch == '}' && --depth == 0) return i;
        }
        throw new Error('Unbalanced braces in boats.js');
    }
    function section(text, decl)
    {
        const at = text.indexOf(decl);
        if (at < 0) throw new Error(`boats.js has no "${decl}"`);
        const open = text.indexOf('{', at);
        return [open, closeOf(text, open)];
    }
    // replace the block that starts at a line matching `head` inside [from, to]: up to its closing brace and comma
    function replaceBlock(text, from, to, head, out)
    {
        head.lastIndex = from;
        const m = head.exec(text);
        if (!m || m.index > to) return null;
        let end = closeOf(text, text.indexOf('{', m.index + m[0].length - 1)) + 1;
        if (text[end] == ',') end++;
        return text.slice(0, m.index) + out + text.slice(end);
    }
    function insertBefore(text, close, out)
    {
        const lineStart = text.lastIndexOf('\n', close) + 1;
        return text.slice(0, lineStart) + out + '\n' + text.slice(lineStart);
    }
    function sourceWith(text, keys)
    {
        for (const k of keys)
        {
            const m = M[k];
            if (m.isNew || m.statsEdited)
            {
                const [o, c] = section(text, 'const BOATS');
                const r = m.isNew ? null : replaceBlock(text, o, c, new RegExp(`^    ${k}:\\s*\\{`, 'gm'), entryText(k));
                text = r ?? insertBefore(text, c, entryText(k));
            }
            if (m.isNew || m.decoEdited)
            {
                const [o, c] = section(text, 'const BOAT_DECO');
                const r = m.isNew ? null : replaceBlock(text, o, c, new RegExp(`^    ${k}\\s*\\(d\\b[^)]*\\)\\s*\\{`, 'gm'), decoText(k));
                text = r ?? insertBefore(text, c, decoText(k));
            }
        }
        return text;
    }

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
    async function boatsFile(dir)
    {
        try { return await dir.getFileHandle('boats.js'); } catch {}
        try { return await (await dir.getDirectoryHandle('src')).getFileHandle('boats.js'); } catch {}
        return null;
    }
    let fileHandle = null;
    async function boatsHandle()
    {
        if (!window.showDirectoryPicker) throw new Error('Saving needs Chrome or Edge (file access)');
        if (!fileHandle)
            for (const k of ['boatdir', 'dir'])         // 'dir': the folder the level editor was given, if it was park-my-boat
            {
                const dir = await idb('readonly', s => s.get(k)).catch(() => null);
                if (!dir) continue;
                try { if (await dir.requestPermission({ mode: 'readwrite' }) != 'granted') continue; } catch { continue; }
                fileHandle = await boatsFile(dir);
                if (fileHandle) break;
            }
        if (!fileHandle)
        {
            const dir = await showDirectoryPicker({ id: 'park-my-boat-src', mode: 'readwrite' });
            fileHandle = await boatsFile(dir);
            if (!fileHandle) throw new Error('Pick the park-my-boat folder or its src folder');
            await idb('readwrite', s => s.put(dir, 'boatdir')).catch(() => {});
        }
        return fileHandle;
    }
    const editedKeys = () => Object.keys(M).filter(k => M[k].isNew || M[k].statsEdited || M[k].decoEdited);
    async function save()
    {
        const keys = editedKeys();
        if (!keys.length) { status = 'Nothing to save'; return refresh(); }
        try
        {
            const fh = await boatsHandle();
            const text = sourceWith(await (await fh.getFile()).text(), keys);
            new Function(text);             // syntax check before writing
            const w = await fh.createWritable();
            await w.write(text);
            await w.close();
            for (const k of keys) { const m = M[k]; m.isNew = m.statsEdited = m.decoEdited = false; m.base = structuredClone({ stats: m.stats, shapes: m.shapes }); }
            status = `Saved ${keys.join(', ')} to src/boats.js`;
        }
        catch (e) { status = e.name == 'AbortError' ? 'Save cancelled' : 'Save failed: ' + e.message; console.error(e); }
        refresh();
    }

    // console, over HTTP: every boat written out in full must load back to the same numbers and shapes
    async function selfTest()
    {
        const text = await (await fetch(new URL('../src/boats.js', location.href), { cache: 'no-store' })).text();
        const keys = Object.keys(M).filter(k => !M[k].isNew);
        const saved = keys.map(k => [M[k].statsEdited, M[k].decoEdited]);
        keys.forEach(k => { M[k].statsEdited = true; M[k].decoEdited = !M[k].dynamic; });
        let out;
        try { out = sourceWith(text, keys); }
        finally { keys.forEach((k, i) => { [M[k].statsEdited, M[k].decoEdited] = saved[i]; }); }
        const got = new Function(out + '\nreturn { BOATS, BOAT_DECO };')();
        const fails = [];
        const near = (a, b) => JSON.stringify(a, (k, v) => typeof v == 'number' ? Math.round(v*1000)/1000 : v) == JSON.stringify(b, (k, v) => typeof v == 'number' ? Math.round(v*1000)/1000 : v);
        for (const k of keys)
        {
            const t = got.BOATS[k];
            if (!t) { fails.push(`${k}: missing`); continue; }
            if (!near(statsOf(t), M[k].stats)) fails.push(`${k}: numbers differ`);
            if (!M[k].dynamic && !near(record(got.BOAT_DECO[k], t).map(s => ({ ...s, label: undefined })), M[k].shapes.map(s => ({ ...s, label: undefined })))) fails.push(`${k}: deck differs`);
        }
        const unchanged = sourceWith(text, []) == text;
        if (!unchanged) fails.push('saving nothing changed the file');
        console.log(fails.length ? 'boat editor self-test FAILED\n' + fails.join('\n') : `boat editor self-test passed (${keys.length} boats)`);
        return { fails, out };
    }

    ///////////////////////////////////////////////////////////////////////////
    // panels

    const left = document.createElement('div'), right = document.createElement('div');
    left.id = 'be-left'; right.id = 'be-right';
    left.className = right.className = 'be-panel';
    document.body.append(left, right);
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

    function shapeName(s)
    {
        if (s.label) return s.label;
        if (s.kind == 'text') return `text "${s.str}"`;
        if (s.kind == 'poly') return `poly (${s.pts.length})`;
        return s.kind;
    }
    function refreshLeft()
    {
        const m = cur();
        let h = `<h2>Boats</h2>`;
        for (const k of Object.keys(M))
        {
            const b = M[k], dirtyDot = b.isNew || b.statsEdited || b.decoEdited ? '<span class="be-dot" title="Not saved"></span>' : '';
            h += `<div class="be-row${k == key ? ' on' : ''}" data-boat="${k}"><span class="be-sw" style="background:${cssOf(b.stats.color)}"></span><span class="lbl">${esc(b.stats.name || k)}</span>${dirtyDot}<span class="k">${k}</span></div>`;
        }
        h += `<div class="be-btns" style="margin-top:8px"><input id="be-newkey" type="text" placeholder="new key, like tugboat" style="flex:1;min-width:0;font-size:12px;padding:2px 4px;border:1px solid #b9b3a5;border-radius:4px"><button data-cmd="newboat" title="Copy the selected boat into a new boat type">New from this</button></div>`;
        h += `<h2>Deck shapes (${m.shapes.length})</h2>`;
        h += `<div class="be-btns">${['circle', 'ellipse', 'rect', 'line', 'poly', 'text'].map(k => `<button data-add="${k}">+ ${k}</button>`).join('')}</div>`;
        h += `<div style="font-size:11px;opacity:.6;margin:2px 0 4px">Top of the list is drawn first (under the rest).</div>`;
        m.shapes.forEach((s, i) =>
        {
            h += `<div class="be-row${sel.includes(i) ? ' on' : ''}" data-shape="${i}"><span class="be-sw" style="background:${cssOf(s.color)}"></span><span class="lbl">${esc(shapeName(s))}</span><span class="k">${s.kind}</span></div>`;
        });
        left.innerHTML = h;
    }

    function num(id, v, step=.05, attrs='') { return `<input type="number" step="${step}" data-f="${id}" value="${v === undefined ? '' : fmt(v)}" ${attrs}>`; }
    function palette(id, expr, optional)
    {
        let h = `<div class="be-pal" data-pal="${id}">`;
        if (optional) h += `<button data-color="" data-for="${id}" style="padding:0 5px;font-size:11px"${expr ? '' : ' class="primary"'}>none</button>`;
        for (const n of NAMED) if (n != 'C_CLEAR' && n != 'C_SHADOW') h += `<span class="be-sw${n == expr ? ' on' : ''}" title="${n}" data-color="${n}" data-for="${id}" style="background:${cssOf(n)}"></span>`;
        h += `<input type="color" data-colorpick="${id}" value="${expr ? hexOf(expr) : '#ffffff'}" title="Custom color">`;
        h += `<span style="font-size:11px;opacity:.7">${expr ? esc(expr) : ''}</span></div>`;
        return h;
    }
    function refreshInspector()
    {
        const m = cur(), t = BOATS[key], st = m.stats;
        let h = `<h2>${esc(st.name || key)} <span style="text-transform:none;letter-spacing:0">(${key})</span></h2>`;
        h += `<div style="font-size:12px;margin-bottom:6px">Real size ${fmt(t.L*t.k)} m x ${fmt(t.W*t.k)} m, ${t.circles.length} collision circles</div>`;
        for (const [f, kind, tip] of FIELDS)
        {
            if (f == 'blob' && !st.blob) continue;
            const v = st[f];
            let input;
            if (kind == 'text') input = `<input type="text" data-f="${f}" value="${esc(v ?? '')}">`;
            else if (kind.startsWith('num')) input = num(f, v, f == 'k' || f == 'L' || f == 'W' ? .1 : .05, kind.endsWith('?') ? 'placeholder="none"' : '');
            else if (kind == 'hull') input = st.blob ? `<span style="font-size:12px">blob (landmass)</span>` : `<select data-f="hull">${HULLS.map(x => `<option${x == v ? ' selected' : ''}>${x}</option>`).join('')}</select>`;
            else if (kind.startsWith('color')) input = palette(f, v, kind.endsWith('?'));
            else if (kind == 'bool?') input = `<input type="checkbox" data-f="${f}"${v ? ' checked' : ''}>`;
            else if (kind == 'blob') input = `<textarea data-f="blob">${esc(JSON.stringify(v))}</textarea>`;
            h += `<div class="be-f" title="${esc(tip)}"><label>${f}</label>${input}</div>`;
        }
        const extra = Object.keys(st).filter(f => !FIELDS.some(x => x[0] == f));
        if (extra.length) h += `<div style="font-size:11px;opacity:.7">Also kept as is: ${extra.join(', ')}</div>`;
        h += `<div class="be-btns" style="margin-top:6px"><button class="primary" data-cmd="save" title="Cmd+S">Save boats.js</button><button data-cmd="revert">${m.isNew ? 'Drop new boat' : 'Revert boat'}</button><button data-cmd="game">Open Test Map</button></div>`;
        h += `<div class="be-status">${esc(status)}</div>`;
        if (m.dynamic) h += `<div class="be-note">${m.decoEdited ? 'Edited: this deck was animated in code and is now a still drawing. Revert boat brings the animation back.' : 'This deck is animated in code (it moves or changes per boat). The shapes show its still pose; editing them turns it into a still drawing.'}</div>`;

        h += `<h2>Shape</h2>`;
        if (!sel.length) h += `<div style="font-size:12px;opacity:.7">Click a shape on the boat or in the list.</div>`;
        else if (sel.length > 1)
        {
            const shared = sel.every(i => m.shapes[i].color == m.shapes[sel[0]].color) ? m.shapes[sel[0]].color : '';
            h += `<div style="font-size:12px">${sel.length} shapes selected</div><div class="be-f"><label>color</label>${palette('s.color', shared)}</div>`;
            h += `<div class="be-f"><label>outline</label><input type="checkbox" data-f="s.outline"${sel.every(i => m.shapes[i].outline) ? ' checked' : ''}></div>`;
        }
        else
        {
            const s = m.shapes[sel[0]];
            h += `<div class="be-f"><label>label</label><input type="text" data-f="s.label" value="${esc(s.label || '')}" placeholder="comment in boats.js"></div>`;
            const pair = (a, b, la, lb) => `<div class="be-f"><label>${la}</label><div class="be-pair">${num('s.' + a, s[a])}${num('s.' + b, s[b])}</div></div>`;
            const one = (a, la) => `<div class="be-f"><label>${la}</label>${num('s.' + a, s[a])}</div>`;
            if (s.kind == 'text') h += `<div class="be-f"><label>text</label><input type="text" data-f="s.str" value="${esc(s.str)}"></div>`;
            if (s.kind == 'line') h += pair('x1', 'y1', 'from x, y') + pair('x2', 'y2', 'to x, y') + one('w', 'width');
            else if (s.kind == 'poly') h += `<div class="be-f"><label>points<br><span style="font-size:10px">x, y per line</span></label><textarea data-f="s.pts">${s.pts.map(p => fmt(p[0]) + ', ' + fmt(p[1])).join('\n')}</textarea></div>`;
            else h += pair('x', 'y', 'center x, y');
            if (s.kind == 'circle') h += one('d', 'diameter');
            if (s.kind == 'ellipse' || s.kind == 'rect') h += pair('w', 'h', 'width, height');
            if (s.kind == 'text') h += one('size', 'size');
            h += `<div class="be-f"><label>color</label>${palette('s.color', s.color)}</div>`;
            if (s.kind != 'line' && s.kind != 'text') h += `<div class="be-f"><label>outline</label><input type="checkbox" data-f="s.outline"${s.outline ? ' checked' : ''}></div>`;
        }
        if (sel.length) h += `<div class="be-btns"><button data-cmd="dup">Duplicate</button><button data-cmd="mirror">Mirror copy</button><button data-cmd="flip">Flip</button><button data-cmd="down">Down</button><button data-cmd="up">Up</button><button data-cmd="del">Delete</button></div>`;

        h += `<h2>Keys</h2><div class="be-keys">
            <div><b>Drag</b> move shape (snaps to ${SNAP}; Alt free, Shift one axis)</div>
            <div><b>Drag empty</b> pan; wheel zoom</div>
            <div><b>Shift/Cmd+click</b> add to selection</div>
            <div><b>Arrows</b> nudge ${SNAP} (Shift ${SNAP*5})</div>
            <div><b>D</b> duplicate</div>
            <div><b>M</b> mirror copy across the keel</div>
            <div><b>Shift+M</b> flip across the keel</div>
            <div><b>[ ]</b> draw earlier / later</div>
            <div><b>I</b> poly: insert point after the selected one</div>
            <div><b>Delete</b> shape, or the selected poly point</div>
            <div><b>Cmd+A</b> select all; <b style="min-width:0">Esc</b> none</div>
            <div><b>F</b> frame the boat</div>
            <div><b>C / G</b> collision circles / grid</div>
            <div><b>Cmd+Z</b> undo, <b style="min-width:0">Shift+Cmd+Z</b> redo</div>
            <div><b>Cmd+S</b> save src/boats.js</div></div>`;
        const scroll = right.scrollTop, focused = document.activeElement?.dataset?.f;
        right.innerHTML = h;
        right.scrollTop = scroll;
        if (focused) right.querySelector(`[data-f="${focused}"]`)?.focus();
    }
    function refresh() { refreshLeft(); refreshInspector(); }

    // a field changed in the inspector
    function setField(f, el, final)
    {
        const m = cur();
        if (f.startsWith('s.'))
        {
            const p = f.slice(2);
            if (!sel.length) return;
            pushUndo('f:' + key + sel.join() + p); editDeco();
            for (const i of sel)
            {
                const s = m.shapes[i];
                if (p == 'outline') s.outline = el.checked;
                else if (p == 'label') { if (el.value.trim()) s.label = el.value.trim(); else delete s.label; }
                else if (p == 'str') s.str = el.value;
                else if (p == 'pts')
                {
                    const pts = el.value.split('\n').map(l => l.split(/[ ,]+/).filter(Boolean).map(Number)).filter(q => q.length == 2 && q.every(isFinite));
                    if (pts.length >= 3) s.pts = pts;
                }
                else { const v = parseFloat(el.value); if (isFinite(v)) s[p] = v; }
            }
            refreshLeft();
            if (final || p == 'outline') refreshInspector();
            return;
        }
        pushUndo('f:' + key + f);
        const st = m.stats;
        if (f == 'sub') { if (el.checked) st.sub = true; else delete st.sub; }
        else if (f == 'name' || f == 'hull') st[f] = el.value;
        else if (f == 'blob') { try { const v = JSON.parse(el.value); if (Array.isArray(v) && v.length && v.every(c => c.length == 3 && c.every(isFinite))) st.blob = v; else return; } catch { return; } }
        else
        {
            const v = parseFloat(el.value);
            if (el.value.trim() == '' && FIELDS.find(x => x[0] == f)?.[1].endsWith('?')) delete st[f];
            else if (isFinite(v) && (v > 0 || !['L', 'W', 'k', 'mass'].includes(f))) st[f] = v;
            else return;
        }
        editStats();
        refreshLeft();
        if (final || f == 'sub' || f == 'hull') refreshInspector();
    }
    function setColor(target, expr)
    {
        const m = cur();
        if (target.startsWith('s.'))
        {
            if (!sel.length) return;
            pushUndo('c:' + key + sel.join()); editDeco();
            for (const i of sel) m.shapes[i].color = expr || 'C_CREAM';
        }
        else
        {
            pushUndo('c:' + key + target);
            if (expr) m.stats[target] = expr; else delete m.stats[target];
            editStats();
        }
    }

    left.addEventListener('click', e =>
    {
        const el = e.target.closest('[data-boat],[data-shape],[data-add],[data-cmd]');
        if (!el) return;
        if (el.dataset.boat) return selectBoat(el.dataset.boat);
        if (el.dataset.add) return addShape(el.dataset.add);
        if (el.dataset.cmd == 'newboat') return newBoat();
        const i = +el.dataset.shape, shapes = cur().shapes;
        if (e.metaKey || e.ctrlKey) sel = sel.includes(i) ? sel.filter(j => j != i) : [...sel, i];
        else if (e.shiftKey && sel.length) { const a = sel[sel.length - 1], lo = Math.min(a, i), hi = Math.max(a, i); sel = [...new Set([...sel, ...Array.from({ length: hi - lo + 1 }, (_, n) => lo + n)])]; }
        else sel = [i];
        vtx = -1;
        if (sel.length == 1 && shapes[i]) { const [x0, y0, x1, y1] = bounds(shapes[i]); const c = vec2((x0 + x1)/2, (y0 + y1)/2); if (!onScreen(c)) cam.pos = c; }
        refresh();
    });
    left.addEventListener('keydown', e => { if (e.target.id == 'be-newkey' && e.key == 'Enter') newBoat(); });
    right.addEventListener('click', e =>
    {
        const el = e.target.closest('[data-cmd],[data-color]');
        if (!el) return;
        if (el.dataset.color !== undefined) { setColor(el.dataset.for, el.dataset.color); lastTag = null; return refresh(); }
        const c = el.dataset.cmd;
        if (c == 'save') save();
        else if (c == 'revert') revertBoat();
        else if (c == 'game') window.open('../index.html?test', 'pmb-game');
        else if (c == 'dup') duplicateSel(false);
        else if (c == 'mirror') duplicateSel(true);
        else if (c == 'flip') flipSel();
        else if (c == 'up') reorder(1);
        else if (c == 'down') reorder(-1);
        else if (c == 'del') deleteSel();
    });
    right.addEventListener('input', e =>
    {
        const el = e.target;
        if (el.dataset.colorpick) { const v = el.value, c = [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)/255); setColor(el.dataset.colorpick, exprOf(rgb(c[0], c[1], c[2]))); refreshLeft(); return; }
        if (el.dataset.f && el.type != 'checkbox') setField(el.dataset.f, el, false);
    });
    right.addEventListener('change', e =>
    {
        const el = e.target;
        if (el.dataset.colorpick) { lastTag = null; return refreshInspector(); }
        if (el.dataset.f) { setField(el.dataset.f, el, true); lastTag = null; }
    });

    function onScreen(p) { const s = worldToScreen(p); return s.x > LEFT*px() && s.x < (innerWidth - RIGHT)*px() && s.y > 0 && s.y < mainCanvasSize.y; }

    addEventListener('keydown', e =>
    {
        const typing = e.target.closest?.('input, textarea, select');
        const cmd = e.metaKey || e.ctrlKey;
        if (cmd && e.code == 'KeyS') { e.preventDefault(); save(); return; }
        if (typing) return;
        if (cmd && e.code == 'KeyZ') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); return; }
        if (cmd && e.code == 'KeyA') { e.preventDefault(); sel = cur().shapes.map((s, i) => i); vtx = -1; return refresh(); }
        if (cmd) return;
        const step = e.shiftKey ? SNAP*5 : SNAP;
        switch (e.code)
        {
            case 'Delete': case 'Backspace': e.preventDefault(); deleteSel(); break;
            case 'KeyD': duplicateSel(false); break;
            case 'KeyM': e.shiftKey ? flipSel() : duplicateSel(true); break;
            case 'BracketLeft': reorder(-1); break;
            case 'BracketRight': reorder(1); break;
            case 'KeyI': insertVertex(); break;
            case 'KeyF': cam.fitted = ''; break;
            case 'KeyC': showCircles = !showCircles; break;
            case 'KeyG': showGrid = !showGrid; break;
            case 'Escape': sel = []; vtx = -1; refresh(); break;
            case 'ArrowLeft': e.preventDefault(); nudge(-step, 0); break;
            case 'ArrowRight': e.preventDefault(); nudge(step, 0); break;
            case 'ArrowUp': e.preventDefault(); nudge(0, step); break;
            case 'ArrowDown': e.preventDefault(); nudge(0, -step); break;
        }
    }, true);
    addEventListener('beforeunload', e => { if (editedKeys().length) e.preventDefault(); });

    ///////////////////////////////////////////////////////////////////////////
    // drawing

    function boatAt(k, pos, scale)
    {
        const t = BOATS[k];
        return { type: t, pos, angle: 0, k: scale, color: t.color, id: 0, dive: 0 };
    }
    function drawGrid()
    {
        const a = screenToWorld(vec2(0, mainCanvasSize.y)), b = screenToWorld(vec2(mainCanvasSize.x, 0)), lw = 1/cam.scale;
        const step = cam.scale > 120 ? .25 : cam.scale > 30 ? 1 : 5;
        if (showGrid)
            for (let x = Math.ceil(a.x/step)*step; x < b.x; x += step)
                drawLine(vec2(x, a.y), vec2(x, b.y), lw, rgb(1, 1, 1, Math.abs(x % 1) < 1e-6 ? .45 : .2));
        if (showGrid)
            for (let y = Math.ceil(a.y/step)*step; y < b.y; y += step)
                drawLine(vec2(a.x, y), vec2(b.x, y), lw, rgb(1, 1, 1, Math.abs(y % 1) < 1e-6 ? .45 : .2));
        drawLine(vec2(a.x, 0), vec2(b.x, 0), 1.5*lw, rgb(1, 1, 1, .7));
        drawLine(vec2(0, a.y), vec2(0, b.y), 1.5*lw, rgb(1, 1, 1, .7));
    }
    function drawOverlay()
    {
        const t = BOATS[key], lw = 1.5/cam.scale, shapes = cur().shapes, hs = 9*px()/cam.scale;
        const label = (s, p) => drawText(s, p, 13*px()/cam.scale, C_INK, 0, C_INK, 'center', fontDefault, 'bold');
        label('BOW', vec2(t.L/2 + 40*px()/cam.scale, 0));
        label('PORT (+y)', vec2(0, t.W/2 + 22*px()/cam.scale));
        label('STARBOARD', vec2(0, -t.W/2 - 22*px()/cam.scale));
        if (showCircles)
            for (const c of t.circles) drawCircle(vec2(c.x, c.y), c.r*2, C_CLEAR, lw, rgb(.95, .2, .2, .75));
        for (const i of sel)
        {
            const s = shapes[i];
            if (!s) continue;
            const [x0, y0, x1, y1] = bounds(s), g = 3*px()/cam.scale;
            drawPoly([vec2(x0 - g, y0 - g), vec2(x1 + g, y0 - g), vec2(x1 + g, y1 + g), vec2(x0 - g, y1 + g)], C_CLEAR, lw, C_SEL);
            if (s.kind == 'poly') drawPoly(s.pts.map(p => vec2(p[0], p[1])), C_CLEAR, lw, C_SEL);
            if (s.kind == 'line') drawLine(vec2(s.x1, s.y1), vec2(s.x2, s.y2), lw, C_SEL);
        }
        if (sel.length == 1 && shapes[sel[0]])
            for (const h of handles(shapes[sel[0]]))
            {
                const on = h.vtx !== undefined && h.vtx == vtx;
                drawRect(vec2(h.x, h.y), vec2(hs), on ? C_SEL : WHITE);
                drawPoly([vec2(h.x - hs/2, h.y - hs/2), vec2(h.x + hs/2, h.y - hs/2), vec2(h.x + hs/2, h.y + hs/2), vec2(h.x - hs/2, h.y + hs/2)], C_CLEAR, lw, C_SEL);
            }
    }
    // the boat at a few in-game sizes along the bottom of the view
    function drawInGame()
    {
        const t = BOATS[key], u = WU, sizes = [1, 2.5, 5], ui = Math.min(mainCanvasSize.x/40, mainCanvasSize.y/22.5);
        const cx = (LEFT + innerWidth - RIGHT)/2*px(), y = mainCanvasSize.y - 2.4*ui;
        const c = screenToWorld(vec2(cx, y)), total = (sizes.reduce((a, b) => a + b, 0) + 6)*u;
        drawRect(c, vec2(total + 2*u, 4.2*u), rgb(1, 1, 1, .25));
        drawText('in game', c.add(vec2(-total/2 + .2*u, 1.6*u)), .5*u, C_INK, 0, C_INK, 'left', fontDefault, 'bold');
        let x = c.x - total/2 + 1.5*u;
        for (const s of sizes)
        {
            const b = boatAt(key, vec2(x + s*u/2, c.y - .2*u), s*u/t.L);
            drawBoatShadow(b);
            drawBoat(b);
            x += (s + 2)*u;
        }
    }

    function gameInit()
    {
        setCanvasClearColor(C_WATER);
        setFontDefault("'Arial Rounded MT Bold', 'Trebuchet MS', 'Segoe UI', sans-serif");
        mainCanvas.addEventListener('pointerdown', pointerDown);
        addEventListener('pointermove', pointerMove);
        addEventListener('pointerup', pointerUp);
        mainCanvas.addEventListener('wheel', wheel, { passive: false });
        mainCanvas.addEventListener('contextmenu', e => e.preventDefault());
        refresh();
    }
    function gameRender()
    {
        applyCamera();
        drawGrid();
        const b = boatAt(key, vec2(), 1);
        drawBoatShadow(b);
        drawBoat(b);
        drawOverlay();
        drawInGame();
    }

    setGLEnable(false);
    setShowSplashScreen(false);
    engineInit(gameInit, () => {}, () => {}, gameRender, () => {});

    return { M, save, selfTest, sourceWith, refresh };
})();
