'use strict';
// The route guide: a dashed line from the ship you drive to its slip, along a way it can really fly. It is found with
// A* on a grid laid over the stretch of the level around the ship and the slip. Walls, docks, sand, landmasses,
// stations and ships waiting or parked are obstacles, grown by half the ship's width (plus a little) so the route keeps
// clear of them; traffic is not (it moves on). A ship that can cloak may pass under `under` docks. The route is found
// again every GUIDE_EVERY seconds, as stations turn and ships get bumped. The edge arrow (drawSlipArrow in main.js)
// points where the route leaves the screen, and its number is how long the route still is.

const GUIDE_EVERY = .4;         // s between route searches
const GUIDE_CELLS = 90000;      // most grid cells one search may use
const GUIDE_CLEAR = 1.15;       // obstacles grow by this many half widths of the ship
let guide = null;               // { player, t, path: [vec2], len, direct }

// after the camera moves (main.js): find the route again when it is due
function guideUpdate(dt)
{
    if (!player || !slip || level?.jam || gameScreen != 'playing' || !hasControl()) { guide = null; return; }
    if (guide && guide.player == player && (guide.t += dt) < GUIDE_EVERY) return;
    guide = { player, t: 0, ...findRoute(player, slip) };
}

// the route from ship b to slip s: { path: [vec2, ...] from b to the slip's middle, len, direct: true when no way was
// found }. When there is none with the full clearance, it tries again keeping less clear of things.
function findRoute(b, s)
{
    for (const share of [GUIDE_CLEAR, .6, .25])
    {
        const r = routeWith(b, s, share);
        if (!r.direct) return r;
    }
    return { path: [b.pos.copy(), s.pos.copy()], len: b.pos.distance(s.pos), direct: true };
}

function routeWith(b, s, share)
{
    const A = b.pos, B = s.pos, dist = A.distance(B);
    const halfW = Math.max(b.type.W, b.type.hitW || 0) * b.k / 2, clear = halfW*share;
    // the grid: round the ship and the slip with room to go round things, cells no smaller than the ship is wide
    const pad = Math.max(dist*.6, 40*clear, s.len);
    const gx0 = Math.min(A.x, B.x) - pad, gy0 = Math.min(A.y, B.y) - pad, gx1 = Math.max(A.x, B.x) + pad, gy1 = Math.max(A.y, B.y) + pad;
    const cell = Math.max(halfW*1.2, Math.sqrt((gx1 - gx0)*(gy1 - gy0)/GUIDE_CELLS));
    const nx = Math.ceil((gx1 - gx0)/cell), ny = Math.ceil((gy1 - gy0)/cell);
    const blocked = new Uint8Array(nx*ny);
    const cx = i => gx0 + (i + .5)*cell, cy = j => gy0 + (j + .5)*cell;
    const span = (lo, hi, o, n) => [Math.max(0, Math.ceil((lo - o)/cell - .5)), Math.min(n - 1, Math.floor((hi - o)/cell - .5))];
    const markRect = (x0, y0, x1, y1, v = 1) =>
    {
        const [i0, i1] = span(x0, x1, gx0, nx), [j0, j1] = span(y0, y1, gy0, ny);
        if (i0 > i1) return;            // off the grid (fill would read a negative end as counted from the back)
        for (let j = j0; j <= j1; j++) blocked.fill(v, j*nx + i0, j*nx + i1 + 1);
    };
    const markCircle = (x, y, r) =>
    {
        const [i0, i1] = span(x - r, x + r, gx0, nx), [j0, j1] = span(y - r, y + r, gy0, ny);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if ((cx(i) - x)**2 + (cy(j) - y)**2 <= r*r) blocked[j*nx + i] = 1;
    };
    // a box [x0, y0, x1, y1] in a body's own coordinates (a station's solar wings), grown by g
    const markBox = (o, [x0, y0, x1, y1], g, v = 1, out = 0) =>
    {
        const c = Math.cos(o.angle), sn = Math.sin(o.angle), R = Math.hypot(Math.max(-x0, x1), Math.max(-y0, y1)) + g;
        const [i0, i1] = span(o.pos.x - R, o.pos.x + R, gx0, nx), [j0, j1] = span(o.pos.y - R, o.pos.y + R, gy0, ny);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++)
        {
            const dx = cx(i) - o.pos.x, dy = cy(j) - o.pos.y, u = dx*c + dy*sn, w = -dx*sn + dy*c;
            if (u > x0 - g && u < x1 + g && w > y0 - g && w < y1 + g) blocked[j*nx + i] = v;
        }
    };
    for (const r of b.type.sub ? subRects() : rects) markRect(r.x0 - clear, r.y0 - clear, r.x1 + clear, r.y1 + clear);
    for (const p of posts) markCircle(p.x, p.y, p.r + clear);
    for (const o of bodies)
    {
        if (o == b || (o.kind != 'station' && (!o.type || o.kind == 'traffic'))) continue;
        o.circles.forEach((k, n) => markCircle(o.world[n].x, o.world[n].y, k.r + clear));
        for (const box of o.boxes) markBox(o, box, clear);
    }
    // the slip itself is always open (its finger docks and pad lie right along it), and so is a lane out of its mouth
    // when it has finger docks: their posts narrow the way in (the open end is behind the heading, see makeSlip)
    const fingers = !s.on && level.boats?.[boatIndex]?.slip.fingers != 'none';
    markBox({ pos: s.pos, angle: s.a }, [-s.len/2 - (fingers ? s.len : 0), -s.wid/2, s.len/2, s.wid/2], 0, 0);

    const at = p => clamp(Math.floor((p.x - gx0)/cell), 0, nx - 1) + clamp(Math.floor((p.y - gy0)/cell), 0, ny - 1)*nx;
    const start = nearestOpen(blocked, nx, ny, at(A)), goal = at(B);
    const cells = start < 0 ? null : aStar(blocked, nx, ny, start, goal);
    if (!cells) return { direct: true };
    // string pulling: from each corner, go straight to the farthest cell of the route in clear sight
    const pt = c => vec2(cx(c % nx), cy(Math.floor(c / nx)));
    const sight = (p, q) =>
    {
        const n = Math.ceil(p.distance(q) / (cell*.5));
        for (let k = 1; k < n; k++) if (blocked[at(p.lerp(q, k/n))]) return false;
        return true;
    };
    const path = [A.copy()];
    let i = 0;
    while (i < cells.length - 1)
    {
        let j = cells.length - 1;
        while (j > i + 1 && !sight(i ? pt(cells[i]) : A, j == cells.length - 1 ? B : pt(cells[j]))) j--;
        path.push(j == cells.length - 1 ? B.copy() : pt(cells[j]));
        i = j;
    }
    if (path.length < 2 || path[path.length - 1].distance(B) > 1e-6) path.push(B.copy());
    let len = 0;
    for (let k = 1; k < path.length; k++) len += path[k].distance(path[k - 1]);
    return { path, len, direct: false };
}

// the open cell nearest to cell c (it may sit inside a grown obstacle, e.g. a ship resting on the ground), or -1
function nearestOpen(blocked, nx, ny, c)
{
    if (!blocked[c]) return c;
    const seen = new Uint8Array(nx*ny), queue = [c];
    seen[c] = 1;
    for (let q = 0; q < queue.length && q < 40000; q++)
    {
        const k = queue[q], i = k % nx, j = (k - i)/nx;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        {
            const a = i + di, b = j + dj, n = b*nx + a;
            if (a < 0 || b < 0 || a >= nx || b >= ny || seen[n]) continue;
            if (!blocked[n]) return n;
            seen[n] = 1; queue.push(n);
        }
    }
    return -1;
}

// A* over the grid, 8 ways (no cutting a blocked corner), octile distance. The cells from start to goal, or null.
function aStar(blocked, nx, ny, start, goal)
{
    const N = nx*ny, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    const gi = goal % nx, gj = (goal - gi)/nx, D2 = Math.SQRT2;
    const h = k => { const i = k % nx, j = (k - i)/nx, dx = Math.abs(i - gi), dy = Math.abs(j - gj); return dx + dy + (D2 - 2)*Math.min(dx, dy); };
    // a binary heap of cells by f
    const heap = [], f = new Float32Array(N);
    const push = k => { heap.push(k); let n = heap.length - 1; while (n) { const p = (n - 1) >> 1; if (f[heap[p]] <= f[k]) break; heap[n] = heap[p]; n = p; } heap[n] = k; };
    const pop = () =>
    {
        const top = heap[0], last = heap.pop();
        if (heap.length)
        {
            let n = 0;
            for (;;)
            {
                const a = 2*n + 1, b = a + 1;
                let m = n, fm = f[last];
                if (a < heap.length && f[heap[a]] < fm) { m = a; fm = f[heap[a]]; }
                if (b < heap.length && f[heap[b]] < fm) m = b;
                if (m == n) break;
                heap[n] = heap[m]; n = m;
            }
            heap[n] = last;
        }
        return top;
    };
    g[start] = 0; f[start] = h(start); push(start);
    const steps = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, D2], [1, -1, D2], [-1, 1, D2], [-1, -1, D2]];
    while (heap.length)
    {
        const k = pop();
        if (done[k]) continue;
        if (k == goal) break;
        done[k] = 1;
        const i = k % nx, j = (k - i)/nx;
        for (const [di, dj, cost] of steps)
        {
            const a = i + di, b = j + dj;
            if (a < 0 || b < 0 || a >= nx || b >= ny) continue;
            const n = b*nx + a;
            if (blocked[n] || done[n]) continue;
            if (di && dj && (blocked[j*nx + a] || blocked[b*nx + i])) continue;
            const ng = g[k] + cost;
            if (ng < g[n]) { g[n] = ng; from[n] = k; f[n] = ng + h(n); push(n); }
        }
    }
    if (from[goal] < 0 && goal != start) return null;
    const out = [];
    for (let k = goal; k >= 0; k = from[k]) out.push(k);
    return out.reverse();
}

// the route, drawn under the ships: mustard dashes flowing toward the slip, from the ship to the slip's middle. Hidden
// once the ship is in its slip.
function drawGuide()
{
    if (!guide || guide.player != player || !slip || window.pmbEditor?.active) return;
    const d = player.pos.subtract(slip.pos), c = Math.cos(slip.a), s = Math.sin(slip.a);
    if (Math.abs(d.x*c + d.y*s) < slip.len/2 && Math.abs(-d.x*s + d.y*c) < slip.wid/2) return;
    const pts = [player.pos, ...guide.path.slice(1)];
    const W = cam.wu, dash = .55*W, period = .95*W, width = .14*W, flow = (time*2.2*W) % period;
    // dashes start at flow + n*period along the whole route, so they flow toward the slip
    let s0 = 0;
    for (let k = 1; k < pts.length; k++)
    {
        const a = pts[k - 1], b = pts[k], len = a.distance(b);
        if (len > 1e-9 && inView(a.lerp(b, .5), len/2 + W))
            for (let u = Math.floor((s0 - flow)/period)*period + flow - s0; u < len; u += period)
            {
                const u0 = Math.max(0, u), u1 = Math.min(len, u + dash);
                if (u1 > u0) drawLine(a.lerp(b, u0/len), a.lerp(b, u1/len), width, C_SUNNY.scale(1, .85));
            }
        s0 += len;
    }
}

// where the route leaves the play area, in UI units (for the edge arrow), or null when it never does
function guideExit(x0, y0, x1, y1)
{
    if (!guide || guide.player != player) return null;
    const pts = [player.pos, ...guide.path.slice(1)].map(worldToUi);
    for (let k = 1; k < pts.length; k++)
    {
        const a = pts[k - 1], b = pts[k], n = Math.max(1, Math.ceil(a.distance(b)/.5));
        for (let m = 1; m <= n; m++)
        {
            const p = a.lerp(b, m/n);
            if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) return p;
        }
    }
    return null;
}

// how much of the route is left, from where the ship is now
function guideLeft()
{
    if (!guide || guide.player != player) return null;
    const p = guide.path;
    let len = p.length > 1 ? player.pos.distance(p[1]) : 0;
    for (let k = 2; k < p.length; k++) len += p[k].distance(p[k - 1]);
    return len;
}
