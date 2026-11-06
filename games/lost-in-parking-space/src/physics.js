'use strict';
// Top-down rigid bodies built from circles, with water drag and impulse collisions.
// Body angle is counter-clockwise (math style, 0 = facing +x); render code flips it for LittleJS.

let nextBodyId = 0;

class Body
{
    constructor(pos, angle, circles, mass, opts={})
    {
        this.id = nextBodyId++;
        this.pos = pos.copy();
        this.angle = angle;
        this.vel = vec2();
        this.angVel = 0;
        this.circles = circles;
        this.world = circles.map(()=>vec2());
        this.mass = mass;
        this.invMass = 1/mass;
        // mass spread over the circles by area, so small tip circles don't count as much as big ones
        let inertia = 0, area = 0, radius = 0;
        for (const c of circles)
        {
            const a = c.r*c.r;
            inertia += a*(c.x*c.x + c.y*c.y + c.r*c.r/2);
            area += a;
            radius = Math.max(radius, Math.hypot(c.x, c.y) + c.r);
        }
        // floor keeps tiny round things (ducks, buoys) from spinning wildly; boats scale it with their size
        this.inertia = Math.max(.05 * (opts.inertiaScale ?? 1), inertia * mass / area);
        this.invInertia = 1/this.inertia;
        this.radius = radius;
        this.restitution = opts.restitution ?? .35;
        this.dragF = opts.dragF ?? 1.5;
        this.dragS = opts.dragS ?? 1.5;
        this.dragA = opts.dragA ?? 2;
        this.kind = opts.kind || 'thing';
        this.k = 1;                    // size scale (boats set these; see makeBoat in main.js)
        this.slowdown = 1;             // bigger things react more slowly (see makeBoat in main.js)
        this.vs = 1;                   // speed scale, k / slowdown
        this.squash = 0;               // impact wobble, decays
        this.squashVel = 0;
        this.hitCooldown = 0;
        this.sx = this.sy = 1;
        this.updateWorld();
    }

    forward() { return vec2(Math.cos(this.angle), Math.sin(this.angle)); }

    toWorld(x, y)
    {
        const c = Math.cos(this.angle), s = Math.sin(this.angle);
        return vec2(this.pos.x + x*c - y*s, this.pos.y + x*s + y*c);
    }

    updateWorld()
    {
        const c = Math.cos(this.angle), s = Math.sin(this.angle);
        for (let i = 0; i < this.circles.length; i++)
        {
            const k = this.circles[i];
            this.world[i].set(this.pos.x + k.x*c - k.y*s, this.pos.y + k.x*s + k.y*c);
        }
    }

    pointVel(p)
    {
        const rx = p.x - this.pos.x, ry = p.y - this.pos.y;
        return vec2(this.vel.x - this.angVel*ry, this.vel.y + this.angVel*rx);
    }

    applyImpulse(jx, jy, p)
    {
        const rx = p.x - this.pos.x, ry = p.y - this.pos.y;
        this.vel.x += jx * this.invMass;
        this.vel.y += jy * this.invMass;
        this.angVel += (rx*jy - ry*jx) * this.invInertia;
    }

    // force over dt applied at a world point
    applyForce(fx, fy, p, dt) { this.applyImpulse(fx*dt, fy*dt, p); }

    // wx, wy: water current velocity at this body
    integrate(dt, wx=0, wy=0)
    {
        // water drag relative to the water: slides easily along the keel, resists going sideways
        const f = this.forward(), rx = this.vel.x - wx, ry = this.vel.y - wy;
        let vf = rx*f.x + ry*f.y;
        let vs = -rx*f.y + ry*f.x;
        vf *= Math.max(0, 1 - this.dragF*dt);
        vs *= Math.max(0, 1 - this.dragS*dt);
        this.vel.set(wx + f.x*vf - f.y*vs, wy + f.y*vf + f.x*vs);
        this.angVel *= Math.max(0, 1 - this.dragA*dt);

        this.pos.x += this.vel.x*dt;
        this.pos.y += this.vel.y*dt;
        this.angle += this.angVel*dt;
        this.updateWorld();

        // springy squash after a hit
        this.squashVel += (-this.squash*220 - this.squashVel*12) * dt;
        this.squash += this.squashVel*dt;
        // grinding against a dock adds a kick every frame; cap it so the hull never flips inside out
        if (Math.abs(this.squash) > 2.5) { this.squash = clamp(this.squash, -2.5, 2.5); this.squashVel = 0; }
        this.sx = 1 - this.squash*.12;
        this.sy = 1 + this.squash*.12;
        this.hitCooldown -= dt;
    }

    speed() { return this.vel.length(); }
}

function wrapAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

// Impulse along normal n (A to B) at contact p. B may be a static (null). Returns impact speed.
function resolveContact(A, B, nx, ny, p, pen, friction=.25)
{
    const iA = A ? A.invMass : 0, iB = B ? B.invMass : 0;
    const total = iA + iB;
    if (!total) return 0;

    // push apart
    const push = pen * .8 / total;
    if (A) { A.pos.x -= nx*push*iA; A.pos.y -= ny*push*iA; }
    if (B) { B.pos.x += nx*push*iB; B.pos.y += ny*push*iB; }

    const vA = A ? A.pointVel(p) : vec2(), vB = B ? B.pointVel(p) : vec2();
    const rvx = vB.x - vA.x, rvy = vB.y - vA.y;
    const vn = rvx*nx + rvy*ny;
    if (vn >= 0) return 0;

    const rAn = A ? (p.x-A.pos.x)*ny - (p.y-A.pos.y)*nx : 0;
    const rBn = B ? (p.x-B.pos.x)*ny - (p.y-B.pos.y)*nx : 0;
    const denom = iA + iB + (A ? rAn*rAn*A.invInertia : 0) + (B ? rBn*rBn*B.invInertia : 0);
    const e = Math.max(A ? A.restitution : 0, B ? B.restitution : 0);
    const j = -(1 + e) * vn / denom;
    if (A) A.applyImpulse(-nx*j, -ny*j, p);
    if (B) B.applyImpulse(nx*j, ny*j, p);

    // friction along the contact makes glancing hits spin things
    const tx = -ny, ty = nx;
    const vt = rvx*tx + rvy*ty;
    const rAt = A ? (p.x-A.pos.x)*ty - (p.y-A.pos.y)*tx : 0;
    const rBt = B ? (p.x-B.pos.x)*ty - (p.y-B.pos.y)*tx : 0;
    const denomT = iA + iB + (A ? rAt*rAt*A.invInertia : 0) + (B ? rBt*rBt*B.invInertia : 0);
    const jt = clamp(-vt / denomT, -friction*j, friction*j);
    if (A) A.applyImpulse(-tx*jt, -ty*jt, p);
    if (B) B.applyImpulse(tx*jt, ty*jt, p);
    return -vn;
}

// Body vs body; calls onHit(A, B, impactSpeed, point) for the strongest contact
function collideBodies(A, B, onHit)
{
    const dx = B.pos.x - A.pos.x, dy = B.pos.y - A.pos.y, rr = A.radius + B.radius;
    if (dx*dx + dy*dy > rr*rr) return;
    let best = 0, bestP;
    for (let i = 0; i < A.circles.length; i++)
    for (let k = 0; k < B.circles.length; k++)
    {
        const a = A.world[i], b = B.world[k];
        const ra = A.circles[i].r, rb = B.circles[k].r;
        const ex = b.x - a.x, ey = b.y - a.y, d2 = ex*ex + ey*ey;
        if (d2 >= (ra+rb)*(ra+rb)) continue;
        const d = Math.sqrt(d2) || 1e-4;
        const nx = ex/d, ny = ey/d;
        const p = vec2(a.x + nx*ra, a.y + ny*ra);
        const impact = resolveContact(A, B, nx, ny, p, ra+rb-d);
        if (impact > best) { best = impact; bestP = p; }
    }
    A.updateWorld(); B.updateWorld();
    if (best && onHit) onHit(A, B, best, bestP);
}

// Body vs static rectangles {x0,y0,x1,y1} and static circles {x,y,r}
function collideStatics(B, rects, posts, onHit)
{
    let best = 0, bestP;
    for (let i = 0; i < B.circles.length; i++)
    {
        const c = B.world[i], r = B.circles[i].r;
        for (const w of rects)
        {
            if (c.x < w.x0 - r || c.x > w.x1 + r || c.y < w.y0 - r || c.y > w.y1 + r) continue;
            const qx = clamp(c.x, w.x0, w.x1), qy = clamp(c.y, w.y0, w.y1);
            let nx = c.x - qx, ny = c.y - qy, d = Math.hypot(nx, ny), pen;
            if (d > 1e-5)
            {
                if (d >= r) continue;
                nx /= d; ny /= d; pen = r - d;
            }
            else
            {
                // center inside: push out the shortest way
                const opts = [[c.x-w.x0,-1,0],[w.x1-c.x,1,0],[c.y-w.y0,0,-1],[w.y1-c.y,0,1]];
                opts.sort((a,b)=>a[0]-b[0]);
                nx = opts[0][1]; ny = opts[0][2]; pen = opts[0][0] + r;
            }
            const impact = resolveContact(null, B, nx, ny, vec2(c.x - nx*r, c.y - ny*r), pen);
            if (impact > best) { best = impact; bestP = vec2(c.x - nx*r, c.y - ny*r); }
            B.updateWorld();
        }
        for (const s of posts)
        {
            const ex = c.x - s.x, ey = c.y - s.y, d = Math.hypot(ex, ey);
            if (d >= r + s.r || d < 1e-5) continue;
            const nx = ex/d, ny = ey/d;
            const p = vec2(c.x - nx*r, c.y - ny*r);
            const impact = resolveContact(null, B, nx, ny, p, r + s.r - d);
            if (impact > best) { best = impact; bestP = p; }
            B.updateWorld();
        }
    }
    if (best && onHit) onHit(B, null, best, bestP);
}
