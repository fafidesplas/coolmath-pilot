/*
    Ragdoll Couture — fashion photography, but the model is a ragdoll
    - Grab the model and fling her (or press Space for a toss), then click to
      snap the photo while she flies. The viewfinder follows the mouse
    - The editors grade every photo F to A and pay by the grade. They want the
      "broken doll" look: sideways or upside down, all elbows and knees, caught
      in the air near the top of the toss where she's barely moving (less blur)
    - Score: framing 25, pose 45, airtime 10, sharpness 20, plus style points
      from the outfit, backdrop, lights and props
    - The shop: wardrobe (style and pay), models (bendier and better paid),
      camera (shutter, burst, slow-mo, autofocus) and studio (backdrops, lights,
      props she can drape over, a fan that blows her around, a trampoline)
    - The floor is lined with cushions, so landings are soft pomf, not crunch
    - Art: a vector stickman ragdoll in round, outlined canvas strokes (no pixel
      art). The canvas is 1280x720: the stage is the left 960px, the shop the rest
*/

'use strict';
debugWatermark = false;

const SCREEN_W = 1280, SCREEN_H = 720;
setCanvasFixedSize(vec2(SCREEN_W, SCREEN_H));
setGLEnable(false); // everything is canvas 2D, drawn in call order

const STAGE_W = 960;          // screen px; the shop column fills the rest
const PX = 40;                // screen px per world unit on the stage
const FLOOR_Y = 2.6;          // world units, y up
const CUSHION_Y = FLOOR_Y + .6; // where she lands on the floor cushions (sinking in a little)
// trampoline: a damped spring holds her up on the mat; a fast landing launches her whole body
// back up at restitution x the impact speed, after a short dip
const TRAMP = {x: 12, w: 4.4, y: FLOOR_Y + 1.4, bottom: FLOOR_Y + .25, k: 2500, damping: 40, restitution: .88, dip: .08};
const FAN = {pos: vec2(2.2, FLOOR_Y + 2.2), dir: vec2(1, .45).normalize(), force: 12}; // blows up and right
const WALL_L = .5, WALL_R = STAGE_W / PX - .5;
const SUB_DT = 1/120;         // physics substep (slow-mo just runs fewer of them)
const RAG_GRAVITY = -24;
const FRAME_W = 5.6, FRAME_H = 7.2; // viewfinder, world units (portrait)

const SERIF = '"Didot","Bodoni 72","Bodoni MT","Playfair Display",Georgia,serif';
const SANS = '"Helvetica Neue",Helvetica,Arial,sans-serif';
const INK = '#1d1b22';

const colorCache = {};
function hexColor(hex, a=1)
{
    const c = (colorCache[hex] ||= new Color().setHex(hex));
    return new Color(c.r, c.g, c.b, a);
}

///////////////////////////////////////////////////////////////////////////////
// shop data

// one outfit at a time: style adds points to every photo, pay multiplies the fee
const OUTFITS =
[
    {id:'tee',    name:'TEE & JEANS',       cost:0,    style:0,  pay:1,   desc:'A CLASSIC. A BORING CLASSIC.',
        top:'#f4f1ea', sleeve:'short', bottom:'#4a6fa5', legs:'pants', shoe:'#2b2b2b'},
    {id:'trench', name:'TRENCH COAT',       cost:120,  style:3,  pay:1.2, desc:'MYSTERIOUS. BELTED.',
        top:'#2b2b2b', sleeve:'long', bottom:'#2b2b2b', legs:'pants', shoe:'#5a3a22', coat:'#c8a46a'},
    {id:'sequin', name:'SEQUIN MINI DRESS', cost:450,  style:5,  pay:1.5, desc:'CATCHES EVERY LIGHT.',
        top:'#d4af37', sleeve:'none', bottom:'#d4af37', legs:'skirt', shoe:'#d4af37', sparkle:true},
    {id:'puffer', name:'PUFFER SET',        cost:1200, style:7,  pay:1.8, desc:'BIG. COZY. EDITORIAL.',
        top:'#ff6b35', sleeve:'long', bottom:'#ff6b35', legs:'pants', shoe:'#f4f1ea', puffy:true},
    {id:'tulle',  name:'TULLE COUTURE',     cost:3200, style:9,  pay:2.2, desc:'A THOUSAND LAYERS OF PINK.',
        top:'#f7b2c4', sleeve:'none', bottom:'#f7b2c4', legs:'tulle', shoe:'#f7b2c4'},
    {id:'latex',  name:'LATEX & PLATFORMS', cost:8000, style:12, pay:2.8, desc:'SQUEAKS WHEN SHE LANDS.',
        top:'#151515', sleeve:'long', bottom:'#151515', legs:'pants', shoe:'#e0115f', platforms:true, shine:true},
];

// flex lets joints fold further (the "broken doll" look) and makes tosses wilder
const MODELS =
[
    {id:'intern', name:'THE INTERN',  cost:0,     flex:0,   pay:1,   desc:'STIFF AS A BOARD.',        skin:'#f1c9a5', hair:'#5a3a22', hairStyle:'short'},
    {id:'bex',    name:'BEX',         cost:300,   flex:.3,  pay:1.4, desc:'RUNWAY ROOKIE. BENDY-ISH.', skin:'#e0ac69', hair:'#f2d16b', hairStyle:'pony'},
    {id:'juno',   name:'JUNO',        cost:1200,  flex:.55, pay:2,   desc:'IT GIRL. ALL ELBOWS.',      skin:'#8d5524', hair:'#ff7eb6', hairStyle:'bob'},
    {id:'odette', name:'ODETTE',      cost:4000,  flex:.8,  pay:3,   desc:'SUPERMODEL. NO SPINE.',     skin:'#c68642', hair:'#151515', hairStyle:'long'},
    {id:'plie',   name:'MADAME PLIÉ', cost:12000, flex:1,   pay:5,   desc:'A LEGEND. FOLDS IN FOUR.',  skin:'#f6dcc8', hair:'#d9d9d9', hairStyle:'bun'},
];

// leveled upgrades: values[level]
const CAMERA =
[
    {id:'shutter',   name:'FAST SHUTTER', costs:[150, 500, 1500],  values:[1, .7, .5, .32], desc:'LESS MOTION BLUR'},
    {id:'burst',     name:'BURST MODE',   costs:[250, 900, 2800],  values:[1, 2, 3, 4],     desc:'MORE SHOTS PER TOSS. THEY BUY THE BEST'},
    {id:'slowmo',    name:'SLOW-MO RIG',  costs:[400, 1400, 4000], values:[1, .8, .65, .5], desc:'TIME SLOWS WHILE SHE FLIES'},
    {id:'autofocus', name:'AUTOFOCUS',    costs:[200, 700, 2200],  values:[0, .25, .45, .6], desc:'THE FRAME PULLS TOWARD HER'},
];

// backdrops: one at a time. Lights and props stack once bought
const STUDIO =
[
    {id:'grey',   kind:'backdrop', name:'GREY PAPER',     cost:0,    style:0,  desc:'THE DEFAULT.', colors:['#dcd8d1', '#b9b3aa']},
    {id:'blush',  kind:'backdrop', name:'BLUSH BACKDROP', cost:150,  style:4,  desc:'SOFT. PINK. FLATTERING.', colors:['#f8d3d8', '#e3a1ac']},
    {id:'ring',   kind:'light',    name:'RING LIGHT',     cost:350,  style:3,  desc:'MORE LIGHT, SHARPER PHOTOS'},
    {id:'cube',   kind:'prop',     name:'ACRYLIC CUBE',   cost:600,  style:4,  desc:'SOMETHING TO DRAPE OVER', box:{x:17.6, w:2.4, h:2.2}},
    {id:'fan',    kind:'prop',     name:'STUDIO FAN',     cost:1000, style:3,  desc:'BLOWS HER AROUND. HAIR FLIES'},
    {id:'trampoline', kind:'prop', name:'TRAMPOLINE',     cost:1400, style:2,  desc:'SHE BOUNCES BACK UP'},
    {id:'chaise', kind:'prop',     name:'VELVET CHAISE',  cost:1800, style:5,  desc:'FAINTING COUCH, LITERALLY', box:{x:5.4, w:4, h:1.3}},
    {id:'gold',   kind:'backdrop', name:'GOLD LAMÉ',      cost:3500, style:7,  desc:'EXPENSIVE-LOOKING', colors:['#f1d58a', '#b8860b']},
    {id:'disco',  kind:'light',    name:'DISCO BALL',     cost:6000, style:6,  desc:'SPARKLE ON EVERYTHING'},
    {id:'neon',   kind:'backdrop', name:'NEON GRADIENT',  cost:9000, style:10, desc:'VERY NOW', colors:['#ff2e93', '#3a0ca3']},
];

const TABS = ['WARDROBE', 'MODELS', 'CAMERA', 'STUDIO'];
const GRADES = [['A', 85, 200, '#e9c46a'], ['B', 70, 90, '#8ecae6'], ['C', 55, 40, '#f4f1ea'], ['D', 40, 15, '#f4a261'], ['F', 0, 3, '#e63946']];
const EDITOR = 'VALENTINA PRUNE, EDITOR-IN-CHIEF';
const STYLE_WEIGHT = .6;       // style points per point of item style

///////////////////////////////////////////////////////////////////////////////
// save data and derived stats

const SAVE_KEY = 'ragdollCouture';
let save;

function loadGame()
{
    save = readSaveData(SAVE_KEY, {money:0, owned:{tee:1, intern:1, grey:1}, levels:{},
        equip:{outfit:'tee', model:'intern', backdrop:'grey'}, photos:0, best:''});
}
const saveGame = ()=> writeSaveData(SAVE_KEY, save);

const findItem = (list, id)=> list.find(item=> item.id == id);
const camLevel = (id)=> save.levels[id] || 0;
const camValue = (id)=> { const c = findItem(CAMERA, id); return c.values[camLevel(id)]; };
const studioOn = (id)=> { const s = findItem(STUDIO, id); return s.kind == 'backdrop' ? save.equip.backdrop == id : !!save.owned[id]; };

// everything the photo needs to redraw the studio as it was
function currentLook()
{
    const look = {outfit: findItem(OUTFITS, save.equip.outfit), model: findItem(MODELS, save.equip.model),
        backdrop: findItem(STUDIO, save.equip.backdrop)};
    for (const s of STUDIO)
        if (s.kind != 'backdrop') look[s.id] = studioOn(s.id);
    return look;
}

function styleBonus(look)
{
    let style = look.outfit.style + look.backdrop.style;
    for (const s of STUDIO)
        if (s.kind != 'backdrop' && look[s.id]) style += s.style;
    return style;
}

const onTrampoline = (x, look)=> look.trampoline && Math.abs(x - TRAMP.x) < TRAMP.w / 2;
// hard ground: over the trampoline she sinks into the mat (a spring) and only stops near the floor
const groundAt = (x, look)=> onTrampoline(x, look) ? TRAMP.bottom : CUSHION_Y;
// what counts as resting on something, for judging
const surfaceAt = (x, look)=> onTrampoline(x, look) ? TRAMP.y : CUSHION_Y;

// the fan's air: strongest close to it and along its aim, gusty, and a little
// different for every joint so her limbs flutter
function fanForce(pos, i, t)
{
    const r = pos.subtract(FAN.pos);
    const along = r.dot(FAN.dir);
    if (along < 0) return vec2();
    const perp = r.cross(FAN.dir);
    const gust = .75 + .25 * Math.sin(t * 2.3) + .3 * Math.sin(t * 9 + i * 1.7);
    return FAN.dir.scale(FAN.force * gust * Math.exp(-along / 16) * Math.exp(-perp * perp / 18));
}

// soft spots where she hit the cushions or the trampoline: {x, amount, bouncy}
let dents = [];
const dentAt = (x, bouncy)=> Math.min(.7, dents.reduce((sum, d)=> d.bouncy == bouncy ? sum + d.amount * Math.exp(-(((x - d.x) / 1.2) ** 2)) : sum, 0));

function propBoxes(look)
{
    return STUDIO.filter(s=> s.box && look[s.id]).map(s=>
        ({x0: s.box.x - s.box.w/2, x1: s.box.x + s.box.w/2, y0: FLOOR_Y, y1: FLOOR_Y + s.box.h}));
}

///////////////////////////////////////////////////////////////////////////////
// ragdoll: verlet points joined by rigid bones

const J = {head:0, neck:1, pelvis:2, lElbow:3, lHand:4, rElbow:5, rHand:6, lKnee:7, lFoot:8, rKnee:9, rFoot:10};
// standing pose relative to the pelvis
const REST_POSE = [vec2(0, 2.05), vec2(0, 1.5), vec2(0, 0), vec2(-.38, .78), vec2(-.5, .05), vec2(.38, .78), vec2(.5, .05),
    vec2(-.2, -1), vec2(-.26, -2), vec2(.2, -1), vec2(.26, -2)];
const JOINT_R = [.36, .12, .16, .1, .12, .1, .12, .12, .14, .12, .14];
const BONES = [[0,1], [1,2], [1,3], [3,4], [1,5], [5,6], [2,7], [7,8], [2,9], [9,10]]
    .map(([a, b])=> ({a, b, len: REST_POSE[a].distance(REST_POSE[b])}));
// joints can't fold all the way: [a, b, closest at flex 0, closest at flex 1]
const LIMITS = [[0, 2, 2, 1.45], [4, 1, 1.25, .25], [6, 1, 1.25, .25], [8, 2, 1.65, .4], [10, 2, 1.65, .4], [7, 1, 2.15, .55], [9, 1, 2.15, .55]];
const MAX_SPEED = 30;         // world units per second, so flings stay on the stage

class Ragdoll
{
    constructor(x)
    {
        this.pts = REST_POSE.map((o, i)=>
        {
            const pos = o.add(vec2(x, TRAMP.y + 2.2)); // just above the trampoline mat, so she drops onto whatever is there
            return {pos, prev: pos.copy(), r: JOINT_R[i], touch: false};
        });
        this.grab = -1;
        this.grabTarget = vec2();
        this.thudCooldown = 0;
        this.bounce = null;   // pending trampoline launch: {timer, speed}
    }

    vel(i) { const p = this.pts[i]; return p.pos.subtract(p.prev).scale(1 / SUB_DT); }
    center() { return this.pts.reduce((sum, p)=> sum.add(p.pos), vec2()).scale(1 / this.pts.length); }
    maxSpeed() { return Math.max(...this.pts.map((p, i)=> this.vel(i).length())); }
    touching() { return this.pts.some(p=> p.touch); }

    nearest(pos, range)
    {
        let best = -1, bestDist = range;
        this.pts.forEach((p, i)=>
        {
            const d = p.pos.distance(pos) - p.r;
            if (d < bestDist) best = i, bestDist = d;
        });
        return best;
    }

    // throw her straight up with a spin and some flailing
    toss(flex)
    {
        const c = this.center();
        const spin = rand(2.5, 4.5) * (1 + flex * .6) * (rand() < .5 ? -1 : 1);
        const lift = vec2(rand(-2.5, 2.5), rand(15.5, 18.5));
        for (const p of this.pts)
        {
            const r = p.pos.subtract(c);
            const v = lift.add(vec2(-r.y, r.x).scale(spin)).add(randInCircle(3 + flex * 4));
            p.prev = p.pos.subtract(v.scale(SUB_DT));
        }
    }

    capSpeed()
    {
        for (const p of this.pts)
        {
            const v = p.pos.subtract(p.prev);
            if (v.length() > MAX_SPEED * SUB_DT)
                p.prev = p.pos.subtract(v.normalize(MAX_SPEED * SUB_DT));
        }
    }

    step(flex, look, boxes, t)
    {
        this.pts.forEach((p, i)=>
        {
            let accel = look.fan ? fanForce(p.pos, i, t).add(vec2(0, RAG_GRAVITY)) : vec2(0, RAG_GRAVITY);
            const v = p.pos.subtract(p.prev);
            p.touch = false;

            // the trampoline mat pushes back the deeper she sinks, and throws her up again
            const depth = onTrampoline(p.pos.x, look) ? TRAMP.y + p.r - p.pos.y : 0;
            if (depth > 0)
            {
                const vy = v.y / SUB_DT;
                const fall = -this.pts.reduce((sum, q)=> sum + q.pos.y - q.prev.y, 0) / this.pts.length / SUB_DT;
                if (!this.bounce && fall > 6)
                {
                    this.bounce = {timer: TRAMP.dip, speed: fall * TRAMP.restitution};
                    dents.push({x: p.pos.x, amount: clamp(fall / 25, .15, .6), bouncy: true});
                    sndBoing.play(undefined, clamp(fall / 20, .3, 1), rand(.9, 1.1));
                }
                // damped only while sinking, so tosses off the mat aren't held back
                accel = accel.add(vec2(0, TRAMP.k * depth - TRAMP.damping * Math.min(vy, 0)));
                p.touch = true, p.normal = vec2(0, 1), p.bouncy = true;
            }

            p.prev = p.pos.copy();
            p.pos = p.pos.add(v.scale(.998)).add(accel.scale(SUB_DT * SUB_DT));
        });
        if (this.grab >= 0)
        {
            const p = this.pts[this.grab];
            p.pos = p.pos.lerp(this.grabTarget, .35);
        }
        if (this.bounce && (this.bounce.timer -= SUB_DT) <= 0)
        {
            // the mat springs back: everyone goes up together, limbs flung a bit
            const spin = rand(-2, 2), c = this.center();
            for (const p of this.pts)
            {
                const r = p.pos.subtract(c);
                const v = vec2((p.pos.x - p.prev.x) / SUB_DT, this.bounce.speed).add(vec2(-r.y, r.x).scale(spin)).add(randInCircle(1.2));
                p.prev = p.pos.subtract(v.scale(SUB_DT));
            }
            this.bounce = null;
        }

        const limits = LIMITS.map(([a, b, stiff, loose])=> [a, b, lerp(stiff, loose, flex)]);
        for (let iter = 0; iter < 10; ++iter)
        {
            for (const {a, b, len} of BONES)
                this.solve(a, b, len, false);
            for (const [a, b, len] of limits)
                this.solve(a, b, len, true);
            for (const p of this.pts)
                this.collide(p, boxes, look);
        }

        // bounce and friction once per substep, for whatever ended up touching
        for (const p of this.pts)
        {
            if (!p.touch || p.bouncy) continue;
            const v = p.pos.subtract(p.prev);
            const n = p.normal;
            const vn = v.dot(n);
            if (vn < 0)
            {
                const speed = -vn / SUB_DT;
                if (speed > 5 && p.ground)
                    dents.push({x: p.pos.x, amount: clamp(speed / 25, .1, .5), bouncy: false});
                if (speed > 7 && this.thudCooldown <= 0)
                {
                    sndPoof.play(undefined, clamp(speed / 20, .2, 1), rand(.9, 1.1));
                    this.thudCooldown = .15;
                }
                // the cushions swallow the landing
                const tangent = v.subtract(n.scale(vn));
                p.prev = p.pos.subtract(tangent.scale(.85).add(n.scale(-vn * .1)));
            }
        }
        this.thudCooldown -= SUB_DT;
    }

    // keep two points len apart (or at least len apart, for joint limits)
    solve(a, b, len, minOnly)
    {
        const pa = this.pts[a], pb = this.pts[b];
        const delta = pb.pos.subtract(pa.pos);
        const d = delta.length() || .001;
        if (minOnly && d >= len) return;
        const wa = a == this.grab ? 0 : 1, wb = b == this.grab ? 0 : 1;
        if (!wa && !wb) return;
        const push = delta.scale((d - len) / d / (wa + wb));
        pa.pos = pa.pos.add(push.scale(wa));
        pb.pos = pb.pos.subtract(push.scale(wb));
    }

    collide(p, boxes, look)
    {
        const hit = (normal, ground=false)=> { p.touch = true; p.normal = normal; p.ground = ground; p.bouncy = false; };
        const ground = groundAt(p.pos.x, look);
        if (p.pos.y < ground + p.r) p.pos.y = ground + p.r, hit(vec2(0, 1), true);
        if (p.pos.x < WALL_L + p.r) p.pos.x = WALL_L + p.r, hit(vec2(1, 0));
        if (p.pos.x > WALL_R - p.r) p.pos.x = WALL_R - p.r, hit(vec2(-1, 0));
        for (const b of boxes)
        {
            const x0 = b.x0 - p.r, x1 = b.x1 + p.r, y1 = b.y1 + p.r;
            if (p.pos.x <= x0 || p.pos.x >= x1 || p.pos.y >= y1) continue;
            // out through the nearest face (never the bottom, that's the floor)
            const left = p.pos.x - x0, right = x1 - p.pos.x, top = y1 - p.pos.y;
            if (top <= left && top <= right) p.pos.y = y1, hit(vec2(0, 1));
            else if (left < right) p.pos.x = x0, hit(vec2(-1, 0));
            else p.pos.x = x1, hit(vec2(1, 0));
        }
    }
}

///////////////////////////////////////////////////////////////////////////////
// judging

function boundsOf(pts, padded)
{
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts)
    {
        const r = padded ? p.r : 0;
        x0 = Math.min(x0, p.pos.x - r), x1 = Math.max(x1, p.pos.x + r);
        y0 = Math.min(y0, p.pos.y - r), y1 = Math.max(y1, p.pos.y + r);
    }
    return {x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, center: vec2((x0 + x1) / 2, (y0 + y1) / 2)};
}

const inRect = (pos, r)=> Math.abs(pos.x - r.pos.x) <= r.w / 2 && Math.abs(pos.y - r.pos.y) <= r.h / 2;

// angle at joint j between the bones to a and b (PI = straight)
function jointAngle(pts, a, j, b)
{
    const u = pts[a].pos.subtract(pts[j].pos), v = pts[b].pos.subtract(pts[j].pos);
    return Math.acos(clamp(u.dot(v) / (u.length() * v.length() || 1), -1, 1));
}

const pick = (list)=> list[randInt(list.length)];
const PRAISE =
{
    A: ['ICONIC. COVER. TODAY.', 'SHE LOOKS DESTROYED. I LOVE IT.', 'BROKEN, BUT MAKE IT FASHION.', 'I FELT THAT IN MY KNEES.'],
    B: ['ALMOST THERE. ALMOST.', 'THE ELBOWS ARE WORKING.', 'GIVE ME MORE ANGLES, DARLING.', 'NICE. NOT ICONIC. NICE.'],
    C: ['FINE. JUST FINE.', 'I HAVE SEEN THIS BEFORE.', 'IT IS... A PHOTO.'],
    D: ['WHY DID YOU SHOW ME THIS?', 'DO BETTER.'],
    F: ['NO.', 'I WILL PRETEND I NEVER SAW THIS.'],
};

function judge(shot)
{
    const {pts, frame, look} = shot;

    // framing: is she in it, big enough, and centered
    let inside = 0, total = 0;
    pts.forEach((p, i)=>
    {
        const w = i == J.head ? 3 : 1;
        total += w;
        if (inRect(p.pos, frame)) inside += w;
    });
    const inFrac = inside / total;
    const headIn = inRect(pts[J.head].pos, frame);
    const b = boundsOf(pts, true);
    const fill = Math.max(b.w / frame.w, b.h / frame.h);
    const fillScore = fill > 1 ? Math.max(0, 1 - (fill - 1) * 3) : fill >= .55 ? 1 : Math.max(0, 1 - (.55 - fill) * 2.5);
    const off = b.center.subtract(frame.pos);
    const centerScore = clamp(1 - (Math.abs(off.x) / frame.w + Math.abs(off.y) / frame.h) * 2.5);
    const framing = inFrac * inFrac * (.5 + .25 * fillScore + .25 * centerScore) * (headIn ? 1 : .4);

    // pose: bent joints, spread out, tipped over, lopsided
    const bendAt = (a, j, c, full)=> clamp((PI - jointAngle(pts, a, j, c)) / full);
    const B = PI * 2/3; // a 120 degree fold counts as fully bent
    const bends = [bendAt(1, 3, 4, B), bendAt(1, 5, 6, B), bendAt(2, 7, 8, B), bendAt(2, 9, 10, B),
        bendAt(0, 1, 2, PI/3), bendAt(1, 2, 7, B), bendAt(1, 2, 9, B)];
    const bend = bends.reduce((s, v)=> s + v, 0) / bends.length;
    const raw = boundsOf(pts, false);
    const spread = clamp((raw.w * raw.h - 5) / 12);
    const torso = pts[J.neck].pos.subtract(pts[J.pelvis].pos);
    const tilt = clamp(Math.acos(clamp(torso.y / torso.length(), -1, 1)) / (PI * .55));
    const P = (i)=> pts[i].pos;
    const asym = clamp((Math.abs(P(J.lHand).y - P(J.rHand).y) + Math.abs(P(J.lFoot).y - P(J.rFoot).y)) / 4);
    // bent joints are the broken-doll signature; the rest only shades it
    const pose = Math.pow(bend, .8) * (.6 + .4 * (spread + tilt + asym) / 3);

    // airtime: floating beats draped over a prop beats lying on the floor
    const onFloor = pts.some(p=> p.pos.y - p.r < surfaceAt(p.pos.x, look) + .06);
    const boxes = propBoxes(look);
    const draped = !onFloor && pts.some(p=> boxes.some(bx=>
        p.pos.x > bx.x0 - p.r - .06 && p.pos.x < bx.x1 + p.r + .06 && p.pos.y - p.r < bx.y1 + .06));
    const air = onFloor ? 0 : draped ? .6 : 1;

    // sharpness: fast limbs blur; a faster shutter and more light help
    const speed = pts.reduce((s, p)=> s + p.vel.length(), 0) / pts.length;
    const blur = speed * camValue('shutter') * (look.ring ? .8 : 1);
    const sharp = clamp(1 - (blur - 2.5) / 9);

    const style = styleBonus(look) * STYLE_WEIGHT * inFrac;
    const parts = {framing, pose, air, sharp};
    const score = inFrac ? Math.min(100, Math.round(framing * 25 + pose * 45 + air * 10 + sharp * 20 + style)) : 0;
    const [grade, , basePay, color] = GRADES.find(g=> score >= g[1]);
    const pay = Math.round(basePay * look.model.pay * look.outfit.pay);

    let comment =
        !inFrac ? 'A STUNNING PHOTO OF THE BACKDROP.' :
        !headIn ? 'WHERE IS HER HEAD? I NEED THE HEAD.' :
        inFrac < .8 ? 'YOU CROPPED HER. AMATEUR.' :
        fill < .4 ? "SHE'S A SPECK. GET CLOSER." :
        sharp < .35 ? 'SO BLURRY. IS SHE A GHOST?' :
        onFloor ? "SHE'S JUST LYING THERE." :
        pose < .35 ? 'TOO STIFF. SHE LOOKS LIKE A PLANK.' : '';
    if (!comment)
        comment = draped && score >= 70 ? 'DRAPED. DEVASTATED. DIVINE.' : pick(PRAISE[grade]);
    return {score, grade, color, pay, comment, parts, style};
}

///////////////////////////////////////////////////////////////////////////////
// sound

const sndWhoosh  = new SoundGenerator({frequency:260, slide:.6, noise:.8, release:.25, volume:.25});
const sndShutter = new SoundGenerator({shape:4, frequency:2000, release:.04, volume:.35});
const sndPoof    = new SoundGenerator({frequency:110, slide:-.3, noise:.9, release:.15, volume:.3});
const sndBoing   = new SoundGenerator({frequency:180, slide:1.2, release:.25, volume:.3});
const sndCash    = new SoundGenerator({frequency:1200, pitchJump:500, pitchJumpTime:.05, release:.25, volume:.35});
const sndGood    = new SoundGenerator({frequency:520, slide:.3, repeatTime:.08, pitchJump:250, release:.4, volume:.4});
const sndBad     = new SoundGenerator({frequency:200, slide:-.6, release:.5, volume:.35});
const sndBuy     = new SoundGenerator({frequency:900, release:.12, pitchJump:600, pitchJumpTime:.05, volume:.4});
const sndDeny    = new SoundGenerator({frequency:140, release:.08, volume:.25});
const sndClick   = new SoundGenerator({frequency:700, release:.03, volume:.2});

///////////////////////////////////////////////////////////////////////////////
// game state

let gameState = 'title';      // title | ready | grab | air | review
let doll;
let physAcc = 0;
let shots = [];               // photos from the current toss
let shotsLeft = 0;
let airTimer = 0, settleTimer = 0, lastShotTimer = 0;
let grabTimer = 0, grabTravel = 0;
let reviewShot = null, reviewTimer = 0, shownMoney = 0;
let flashTimer = 0, hitstopTimer = 0;
let toastText = '', toastTimer = 0;
let shopTab = 0;
let lastMouseWorld = vec2();

const mouseWorld = ()=> vec2(mousePosScreen.x / PX, (SCREEN_H - mousePosScreen.y) / PX);
const onStage = ()=> mousePosScreen.x < STAGE_W;

function toast(text) { toastText = text; toastTimer = 2; }

function frameRect()
{
    const center = mouseWorld().lerp(boundsOf(doll.pts, true).center, camValue('autofocus'));
    center.x = clamp(center.x, FRAME_W / 2, STAGE_W / PX - FRAME_W / 2);
    center.y = clamp(center.y, FRAME_H / 2, SCREEN_H / PX - FRAME_H / 2);
    return {pos: center, w: FRAME_W, h: FRAME_H};
}

function launch()
{
    gameState = 'air';
    shots = [];
    shotsLeft = camValue('burst');
    airTimer = settleTimer = 0;
    lastShotTimer = 99;
    sndWhoosh.play(undefined, 1, rand(.9, 1.1));
}

function release()
{
    doll.grab = -1;
    doll.capSpeed();
    // a quick click without dragging is a toss; a real drag is a fling
    if (grabTravel < .4 && grabTimer < .3)
        doll.toss(currentLook().model.flex);
    if (doll.maxSpeed() < 7)
    {
        gameState = 'ready';
        toast('THROW HER HARDER');
        return;
    }
    launch();
}

function snap()
{
    const shot = {
        pts: doll.pts.map((p, i)=> ({pos: p.pos.copy(), vel: doll.vel(i), r: p.r})),
        frame: frameRect(), look: currentLook(), time: time};
    shot.result = judge(shot);
    shots.push(shot);
    --shotsLeft;
    lastShotTimer = 0;
    flashTimer = .25;
    hitstopTimer = .1;
    sndShutter.play(undefined, 1, rand(.95, 1.05));
}

function endToss()
{
    if (!shots.length)
    {
        gameState = 'ready';
        toast('YOU MISSED THE SHOT');
        return;
    }
    reviewShot = shots.reduce((best, s)=> s.result.score > best.result.score ? s : best);
    const r = reviewShot.result;
    shownMoney = save.money;
    save.money += r.pay;
    ++save.photos;
    if (!save.best || 'ABCDF'.indexOf(r.grade) < 'ABCDF'.indexOf(save.best)) save.best = r.grade;
    saveGame();
    gameState = 'review';
    reviewTimer = 0;
    (r.grade == 'A' || r.grade == 'B' ? sndGood : r.grade == 'F' ? sndBad : sndClick).play();
}

///////////////////////////////////////////////////////////////////////////////
// engine callbacks

function gameInit()
{
    loadGame();
    doll = new Ragdoll(12);
    shownMoney = save.money;
}

function gameUpdate()
{
    const dt = timeDelta;
    const mw = mouseWorld();
    const clicked = mouseWasPressed(0);
    const space = keyWasPressed('Space');
    const look = currentLook();

    if (clicked && !onStage())
        shopClick();

    if (gameState == 'title')
    {
        if ((clicked && onStage()) || space || keyWasPressed('Enter'))
            gameState = 'ready', sndClick.play();
    }
    else if (gameState == 'ready')
    {
        const i = clicked && onStage() ? doll.nearest(mw, .8) : -1;
        if (i >= 0)
        {
            gameState = 'grab';
            doll.grab = i;
            grabTimer = grabTravel = 0;
        }
        else if (space)
            doll.toss(look.model.flex), launch();
    }
    else if (gameState == 'grab')
    {
        grabTimer += dt;
        grabTravel += mw.distance(lastMouseWorld);
        doll.grabTarget = vec2(clamp(mw.x, WALL_L + .5, WALL_R - .5), Math.max(mw.y, CUSHION_Y + .4));
        if (!mouseIsDown(0))
            release();
    }
    else if (gameState == 'air')
    {
        airTimer += dt;
        lastShotTimer += dt;
        if (shotsLeft && ((clicked && onStage()) || space))
            snap();
        settleTimer = doll.touching() && doll.maxSpeed() < 1.2 ? settleTimer + dt : 0;
        if (settleTimer > .4 || airTimer > 8 || (!shotsLeft && lastShotTimer > .7))
            endToss();
    }
    else if (gameState == 'review')
    {
        reviewTimer += dt;
        shownMoney = Math.min(save.money, shownMoney + Math.max(1, (save.money - shownMoney) * dt * 6));
        if (reviewTimer > .4 && ((clicked && onStage()) || space))
            gameState = 'ready', sndClick.play();
    }
    if (gameState != 'review') shownMoney = save.money;
    lastMouseWorld = mw;

    // physics: slow-mo runs fewer substeps while she's in the air
    if (hitstopTimer > 0)
        hitstopTimer -= dt;
    else
    {
        physAcc += dt * (gameState == 'air' ? camValue('slowmo') : 1);
        const boxes = propBoxes(look);
        for (; physAcc >= SUB_DT; physAcc -= SUB_DT)
            doll.step(look.model.flex, look, boxes, time);
    }
    for (const d of dents) d.amount -= dt * .8;
    dents = dents.filter(d=> d.amount > 0);
    flashTimer = Math.max(0, flashTimer - dt);
    toastTimer = Math.max(0, toastTimer - dt);
}

function gameUpdatePost() {}
function gameRender() {}

///////////////////////////////////////////////////////////////////////////////
// canvas 2D drawing through a view: world units in, screen px out

// a view maps world (wx, wy) to screen (ox, oy) at s px per unit, y up
const stageView = ()=> ({wx: 0, wy: 0, s: PX, ox: -_shakeOffset.x * PX, oy: SCREEN_H + _shakeOffset.y * PX}); // gameFx shake nudges the camera
const toScreen = (v, p)=> vec2(v.ox + (p.x - v.wx) * v.s, v.oy - (p.y - v.wy) * v.s);

const ctx = ()=> mainContext;

function vLine(v, a, b, width, color)
{
    const c = ctx(), A = toScreen(v, a), B = toScreen(v, b);
    c.beginPath();
    c.moveTo(A.x, A.y);
    c.lineTo(B.x, B.y);
    c.lineWidth = width * v.s;
    c.strokeStyle = color;
    c.lineCap = 'round';
    c.stroke();
}

function vCircle(v, p, r, fill, outline)
{
    const c = ctx(), P = toScreen(v, p);
    c.beginPath();
    c.arc(P.x, P.y, r * v.s, 0, PI * 2);
    c.fillStyle = fill;
    c.fill();
    if (outline) { c.lineWidth = outline * v.s; c.strokeStyle = INK; c.stroke(); }
}

function vPoly(v, points, fill, outline)
{
    const c = ctx();
    c.beginPath();
    points.forEach((p, i)=> { const P = toScreen(v, p); i ? c.lineTo(P.x, P.y) : c.moveTo(P.x, P.y); });
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (outline) { c.lineWidth = outline * v.s; c.lineJoin = 'round'; c.strokeStyle = INK; c.stroke(); }
}

// world rect by its bottom left corner
function vRect(v, x, y, w, h, fill)
{
    const P = toScreen(v, vec2(x, y + h));
    ctx().fillStyle = fill;
    ctx().fillRect(P.x, P.y, w * v.s, h * v.s);
}

function vGradient(v, x, y, w, h, top, bottom)
{
    const c = ctx(), P = toScreen(v, vec2(x, y + h));
    const g = c.createLinearGradient(0, P.y, 0, P.y + h * v.s);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    c.fillStyle = g;
    c.fillRect(P.x, P.y, w * v.s, h * v.s);
}

// an outlined limb: ink stroke first, color on top
function limb(v, a, b, width, color)
{
    vLine(v, a, b, width + .1, INK);
    vLine(v, a, b, width, color);
}

///////////////////////////////////////////////////////////////////////////////
// the studio

function drawStudio(v, look, t)
{
    const [top, bottom] = look.backdrop.colors;
    vRect(v, -5, -5, 40, 40, '#2a2830');                     // the room behind the paper
    vGradient(v, 1, FLOOR_Y, 22, 15, top, bottom);           // backdrop paper
    vRect(v, 1, 0, 22, FLOOR_Y, bottom);                     // it sweeps onto the floor
    vGradient(v, 1, 0, 22, FLOOR_Y, '#00000000', '#00000040');
    vRect(v, 0, 0, 1, FLOOR_Y, '#232129');
    vRect(v, 23, 0, 1, FLOOR_Y, '#232129');
    vRect(v, .8, 17.3, 22.4, .5, '#3a3742');                  // the roll
    if (look.backdrop.id == 'gold')
        for (let x = 1.5; x < 23; x += 1.1)
            vRect(v, x + Math.sin(t + x) * .1, FLOOR_Y, .25, 15, '#ffffff22');

    // softboxes on stands, one each side
    for (const [x, dir] of [[1.6, 1], [22.4, -1]])
    {
        vLine(v, vec2(x, 0), vec2(x, 9), .08, '#111');
        vPoly(v, [vec2(x - dir * .3, 10.1), vec2(x + dir * 1.1, 11.1), vec2(x + dir * 1.1, 7.7), vec2(x - dir * .3, 8.7)], '#f7f5ef', .05);
    }

    if (look.disco)
    {
        vLine(v, vec2(12, 17.3), vec2(12, 15.8), .04, '#222');
        vCircle(v, vec2(12, 15.2), .6, '#cfd3da', .05);
        for (let i = 0; i < 6; ++i)
            vRect(v, 11.55 + (i % 3) * .3, 14.9 + (i / 3 | 0) * .35, .22, .22, (i + (t * 4 | 0)) % 2 ? '#ffffff' : '#9aa1ad');
        // light flecks wander over the paper
        for (let i = 0; i < 18; ++i)
        {
            const a = t * .4 + i * 2.4;
            const p = vec2(12 + Math.cos(a) * (4 + i % 5 * 2), 10 + Math.sin(a * 1.3) * (2 + i % 4 * 1.5));
            if (p.x > 1.2 && p.x < 22.8)
                vCircle(v, p, .07 + (i % 3) * .03, '#ffffffcc');
        }
    }

    if (look.ring)
    {
        vLine(v, vec2(20.6, 0), vec2(20.6, 5.4), .07, '#111');
        const c = ctx(), P = toScreen(v, vec2(20.6, 6.2));
        c.beginPath();
        c.arc(P.x, P.y, .7 * v.s, 0, PI * 2);
        c.lineWidth = .22 * v.s;
        c.strokeStyle = '#fffbe8';
        c.shadowColor = '#fffbe8';
        c.shadowBlur = 20;
        c.stroke();
        c.shadowBlur = 0;
    }

    if (look.fan)
    {
        // air streaks along the fan's aim, fading with distance
        const side = vec2(-FAN.dir.y, FAN.dir.x);
        for (let i = 0; i < 12; ++i)
        {
            const along = 1.6 + (t * 9 + i * 2.7) % 14, across = ((i * 1.37) % 3) - 1.5;
            const p = FAN.pos.add(FAN.dir.scale(along)).add(side.scale(across * (1 + along * .12)));
            const c = ctx();
            c.globalAlpha = clamp(1 - along / 14) * .5;
            vLine(v, p, p.add(FAN.dir.scale(1.1)), .05, '#ffffff');
            c.globalAlpha = 1;
        }
        vLine(v, vec2(FAN.pos.x, FLOOR_Y), FAN.pos, .14, '#2b2b2b');
        vRect(v, FAN.pos.x - .6, FLOOR_Y, 1.2, .2, '#2b2b2b');
        vCircle(v, FAN.pos, 1.1, '#3a3a40', .07);
        for (let i = 0; i < 4; ++i)
        {
            const a = t * 16 + i * PI / 2;
            const tip = FAN.pos.add(vec2(Math.cos(a), Math.sin(a)).scale(.85));
            vLine(v, FAN.pos, tip, .32, '#cfd3da');
        }
        // the cage
        const c = ctx(), P = toScreen(v, FAN.pos);
        c.strokeStyle = '#8a8f99';
        c.lineWidth = .04 * v.s;
        for (const r of [.4, .75, 1.05]) { c.beginPath(); c.arc(P.x, P.y, r * v.s, 0, PI * 2); c.stroke(); }
        vCircle(v, FAN.pos, .16, '#e9c46a', .05);
    }

    if (look.chaise)
    {
        const {x, w, h} = findItem(STUDIO, 'chaise').box, x0 = x - w / 2;
        vPoly(v, [vec2(x0, FLOOR_Y), vec2(x0 + w, FLOOR_Y), vec2(x0 + w, FLOOR_Y + h), vec2(x0, FLOOR_Y + h)], '#7a1f3d', .06);
        vPoly(v, [vec2(x0 - .1, FLOOR_Y + h - .2), vec2(x0 + .2, FLOOR_Y + h + 1.1), vec2(x0 + .9, FLOOR_Y + h + .2)], '#8e2748', .06);
        vRect(v, x0 + .1, FLOOR_Y + h - .2, w - .2, .12, '#a33a5c');
    }

    if (look.cube)
    {
        const {x, w, h} = findItem(STUDIO, 'cube').box;
        vPoly(v, [vec2(x - w/2, FLOOR_Y), vec2(x + w/2, FLOOR_Y), vec2(x + w/2, FLOOR_Y + h), vec2(x - w/2, FLOOR_Y + h)], '#d8f3ff66', .05);
        vLine(v, vec2(x - w/2 + .3, FLOOR_Y + h - .3), vec2(x - w/2 + .3, FLOOR_Y + .4), .08, '#ffffffaa');
    }

    drawCushions(v);
    if (look.trampoline)
        drawTrampoline(v);
}

const CUSHION_COLORS = ['#f4c7d0', '#c9e4de', '#f6e7b0', '#cdd5f3', '#f9d9c4'];

// a row of plump pillows along the floor; they squash where she lands
function drawCushions(v)
{
    const c = ctx();
    for (let i = 0, x = 1.5; x < 23; ++i, x += 1.9)
    {
        const h = .95 * (1 - dentAt(x, false) * .6);
        const center = vec2(x, FLOOR_Y + h / 2 - .1);
        const P = toScreen(v, center);
        c.beginPath();
        c.ellipse(P.x, P.y, 1.2 * v.s, h / 2 * v.s, 0, 0, PI * 2);
        c.fillStyle = CUSHION_COLORS[i % CUSHION_COLORS.length];
        c.fill();
        c.lineWidth = .06 * v.s;
        c.strokeStyle = INK;
        c.stroke();
        // soft sheen on top and a tuft button in the middle
        c.beginPath();
        c.ellipse(P.x - .2 * v.s, P.y - h * .18 * v.s, .65 * v.s, h * .14 * v.s, 0, 0, PI * 2);
        c.fillStyle = '#ffffff55';
        c.fill();
        vCircle(v, center, .07, '#00000030');
    }
}

function drawTrampoline(v)
{
    const x0 = TRAMP.x - TRAMP.w / 2, x1 = TRAMP.x + TRAMP.w / 2;
    for (const x of [x0 + .3, x1 - .3, TRAMP.x])
        vLine(v, vec2(x, FLOOR_Y), vec2(x, TRAMP.y), .12, '#2b2b2b');
    // the mat sags where she lands
    const points = [];
    for (let i = 0; i <= 12; ++i)
    {
        const x = lerp(x0 + .1, x1 - .1, i / 12);
        points.push(vec2(x, TRAMP.y - dentAt(x, true) * .9 * Math.sin(i / 12 * PI)));
    }
    const c = ctx();
    c.beginPath();
    points.forEach((p, i)=> { const P = toScreen(v, p); i ? c.lineTo(P.x, P.y) : c.moveTo(P.x, P.y); });
    c.lineWidth = .16 * v.s;
    c.lineCap = 'round';
    c.strokeStyle = '#151515';
    c.stroke();
    // springs to the blue rim
    for (const x of [x0, x1])
        vLine(v, vec2(x, TRAMP.y), vec2(x + (x == x0 ? .2 : -.2), TRAMP.y), .1, '#9aa1ad');
    vLine(v, vec2(x0, TRAMP.y), vec2(x0, TRAMP.y + .05), .22, '#4a6fa5');
    vLine(v, vec2(x1, TRAMP.y), vec2(x1, TRAMP.y + .05), .22, '#4a6fa5');
}

///////////////////////////////////////////////////////////////////////////////
// the doll

function drawDoll(v, pts, look, alpha=1, dizzy=false)
{
    const c = ctx();
    c.globalAlpha = alpha;
    const {outfit, model} = look;
    const P = (i)=> pts[i].pos;
    const skin = model.skin;
    const puffy = outfit.puffy ? 1.6 : 1;
    const sleeveUpper = outfit.sleeve == 'none' ? skin : outfit.coat || outfit.top;
    const sleeveLower = outfit.sleeve == 'long' ? outfit.coat || outfit.top : skin;
    const bare = outfit.legs == 'skirt' || outfit.legs == 'tulle';
    const thigh = bare ? skin : outfit.bottom, shin = bare ? skin : outfit.bottom;

    const axis = P(J.neck).subtract(P(J.pelvis)).normalize();
    const side = vec2(axis.y, -axis.x);
    const headUp = P(J.head).subtract(P(J.neck)).normalize();
    const headSide = vec2(headUp.y, -headUp.x);

    const arm = (elbow, hand, back)=>
    {
        limb(v, P(J.neck).add(side.scale(back ? .26 : -.26)), P(elbow), .2 * puffy, sleeveUpper);
        limb(v, P(elbow), P(hand), .17 * (outfit.sleeve == 'long' ? puffy : 1), sleeveLower);
        vCircle(v, P(hand), .13, skin, .05);
    };
    const leg = (knee, foot, back)=>
    {
        const hip = P(J.pelvis).add(side.scale(back ? .14 : -.14));
        limb(v, hip, P(knee), .27, thigh);
        limb(v, P(knee), P(foot), .21, shin);
        // shoe points off the shin, toward her front
        const shinDir = P(foot).subtract(P(knee)).normalize();
        const toe = vec2(-shinDir.y, shinDir.x).scale(.24);
        const sole = outfit.platforms ? .22 : .15;
        limb(v, P(foot), P(foot).add(toe), sole, outfit.shoe);
    };

    // long hair hangs behind everything
    if (model.hairStyle == 'long')
        vPoly(v, [P(J.head).add(headSide.scale(.4)).add(headUp.scale(.15)), P(J.head).subtract(headSide.scale(.4)).add(headUp.scale(.15)),
            P(J.head).subtract(headSide.scale(.5)).subtract(headUp.scale(1.1)), P(J.head).add(headSide.scale(.5)).subtract(headUp.scale(1.1))], model.hair, .06);

    arm(J.rElbow, J.rHand, true);
    leg(J.rKnee, J.rFoot, true);
    leg(J.lKnee, J.lFoot, false);

    // skirts hang off the hips
    const hipL = P(J.pelvis).add(side.scale(.3)), hipR = P(J.pelvis).subtract(side.scale(.3));
    if (outfit.legs == 'skirt')
        vPoly(v, [hipL.add(axis.scale(.15)), hipR.add(axis.scale(.15)), hipR.subtract(axis.scale(.75)).subtract(side.scale(.25)),
            hipL.subtract(axis.scale(.75)).add(side.scale(.25))], outfit.bottom, .06);
    if (outfit.legs == 'tulle')
    {
        const ruffle = [];
        for (let i = 0; i <= 16; ++i)
        {
            const a = i / 16 * PI;
            const r = .95 + (i % 2) * .12;
            ruffle.push(P(J.pelvis).subtract(axis.scale(.25)).add(side.scale(Math.cos(a) * r * 1.1)).subtract(axis.scale(Math.sin(a) * r * .8)));
        }
        ruffle.push(hipR.add(axis.scale(.1)), hipL.add(axis.scale(.1)));
        vPoly(v, ruffle, outfit.bottom, .06);
    }

    // torso: shoulders down to the hips
    const neck = P(J.neck).subtract(axis.scale(.06)), waist = P(J.pelvis).add(axis.scale(.75));
    const torso = [neck.add(side.scale(.3 * puffy)), waist.add(side.scale(.22 * puffy)), P(J.pelvis).add(side.scale(.27)),
        P(J.pelvis).subtract(side.scale(.27)), waist.subtract(side.scale(.22 * puffy)), neck.subtract(side.scale(.3 * puffy))];
    vPoly(v, torso, outfit.top, .07);
    if (outfit.coat) // trench: a long coat over the torso and down past the hips, with a belt
    {
        vPoly(v, [neck.add(side.scale(.34)), P(J.pelvis).add(side.scale(.42)).subtract(axis.scale(1)),
            P(J.pelvis).subtract(side.scale(.42)).subtract(axis.scale(1)), neck.subtract(side.scale(.34))], outfit.coat, .07);
        vLine(v, waist.add(side.scale(.3)).subtract(axis.scale(.25)), waist.subtract(side.scale(.3)).subtract(axis.scale(.25)), .1, '#5a3a22');
        vLine(v, neck, P(J.pelvis).subtract(axis.scale(.9)), .03, INK);
    }
    if (outfit.sparkle)
        for (let i = 0; i < 6; ++i)
        {
            const p = P(J.pelvis).add(axis.scale(.25 + (i * .37) % 1.1)).add(side.scale(((i * .53) % .4) - .2));
            if ((time * 5 + i) % 3 < 1) vCircle(v, p, .05, '#ffffff');
        }
    if (outfit.shine)
        vLine(v, neck.add(side.scale(.15)), waist.add(side.scale(.1)), .05, '#ffffff66');

    // head
    vLine(v, P(J.neck), P(J.head), .16, skin);
    vCircle(v, P(J.head), .36, skin, .07);
    const face = P(J.head).subtract(headUp.scale(.03));
    for (const s of [-1, 1])
    {
        const eye = face.add(headSide.scale(.13 * s));
        if (dizzy)
        {
            const d = .06;
            vLine(v, eye.add(vec2(-d, -d)), eye.add(vec2(d, d)), .035, INK);
            vLine(v, eye.add(vec2(-d, d)), eye.add(vec2(d, -d)), .035, INK);
        }
        else
            vCircle(v, eye, .045, INK);
        vCircle(v, face.subtract(headUp.scale(.09)).add(headSide.scale(.21 * s)), .05, '#ff8fa333');
    }
    vLine(v, face.subtract(headUp.scale(.15)).add(headSide.scale(.05)), face.subtract(headUp.scale(.15)).subtract(headSide.scale(.05)), .03, INK);

    // hair on top
    const hc = toScreen(v, P(J.head)), up = toScreen(v, P(J.head).add(headUp)).subtract(hc);
    const angle = Math.atan2(up.y, up.x);
    c.beginPath();
    c.arc(hc.x, hc.y, .39 * v.s, angle - PI / 2 - .25, angle + PI / 2 + .25);
    c.closePath();
    c.fillStyle = model.hair;
    c.fill();
    c.lineWidth = .06 * v.s;
    c.strokeStyle = INK;
    c.stroke();
    if (model.hairStyle == 'bob')
        for (const s of [-1, 1])
            vPoly(v, [P(J.head).add(headSide.scale(.38 * s)), P(J.head).add(headSide.scale(.25 * s)),
                P(J.head).add(headSide.scale(.3 * s)).subtract(headUp.scale(.35)), P(J.head).add(headSide.scale(.44 * s)).subtract(headUp.scale(.35))], model.hair, .05);
    if (model.hairStyle == 'pony')
    {
        const root = P(J.head).add(headUp.scale(.2)).add(headSide.scale(-.3));
        limb(v, root, root.add(headSide.scale(-.35)).add(vec2(0, -.45)), .18, model.hair);
    }
    if (model.hairStyle == 'bun')
        vCircle(v, P(J.head).add(headUp.scale(.44)), .17, model.hair, .05);

    arm(J.lElbow, J.lHand, false);
    c.globalAlpha = 1;
}

///////////////////////////////////////////////////////////////////////////////
// overlays: viewfinder, flash, hints

function drawViewfinder()
{
    if (gameState != 'air' || !onStage()) return;
    const f = frameRect(), v = stageView();
    const tl = toScreen(v, f.pos.add(vec2(-f.w / 2, f.h / 2))), w = f.w * PX, h = f.h * PX;
    const c = ctx();
    c.strokeStyle = shotsLeft ? '#ffffff' : '#ffffff55';
    c.lineWidth = 3;
    const arm = 24;
    for (const [x, y, dx, dy] of [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]])
    {
        c.beginPath();
        c.moveTo(tl.x + x + dx * arm, tl.y + y);
        c.lineTo(tl.x + x, tl.y + y);
        c.lineTo(tl.x + x, tl.y + y + dy * arm);
        c.stroke();
    }
    // rule of thirds and a center mark
    c.lineWidth = 1;
    c.strokeStyle = '#ffffff33';
    for (let i = 1; i < 3; ++i)
    {
        c.beginPath(); c.moveTo(tl.x + w * i / 3, tl.y); c.lineTo(tl.x + w * i / 3, tl.y + h); c.stroke();
        c.beginPath(); c.moveTo(tl.x, tl.y + h * i / 3); c.lineTo(tl.x + w, tl.y + h * i / 3); c.stroke();
    }
    const cx = tl.x + w / 2, cy = tl.y + h / 2;
    c.strokeStyle = '#ffffff99';
    c.beginPath(); c.moveTo(cx - 8, cy); c.lineTo(cx + 8, cy); c.moveTo(cx, cy - 8); c.lineTo(cx, cy + 8); c.stroke();

    // shots left
    for (let i = 0; i < camValue('burst'); ++i)
    {
        c.beginPath();
        c.arc(tl.x + 14 + i * 16, tl.y + h - 14, 5, 0, PI * 2);
        c.fillStyle = i < shotsLeft ? '#ff3b3b' : '#ffffff33';
        c.fill();
    }
}

function drawStageText()
{
    const hints =
    {
        ready: 'GRAB HER AND THROW · OR CLICK HER / PRESS SPACE TO TOSS',
        grab: 'LET GO TO THROW',
        air: shotsLeft ? 'CLICK TO SNAP' + (shotsLeft > 1 ? ' · ' + shotsLeft + ' SHOTS LEFT' : '') : 'THE EDITORS ARE LOOKING...',
    };
    if (hints[gameState])
        drawTextScreen(hints[gameState], vec2(STAGE_W / 2, SCREEN_H - 22), 16, hexColor('#ffffff', .8), 3, hexColor('#000000', .4), 'center', SANS, 'bold');
    if (toastTimer > 0)
        drawTextScreen(toastText, vec2(STAGE_W / 2, 60), 30, hexColor('#ffffff', Math.min(1, toastTimer * 2)), 5,
            hexColor('#000000', Math.min(.6, toastTimer)), 'center', SERIF, 'bold');
}

///////////////////////////////////////////////////////////////////////////////
// the editors' review

function drawPhoto(shot, x, y, w, h)
{
    const c = ctx();
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    const f = shot.frame;
    const v = {wx: f.pos.x - f.w / 2, wy: f.pos.y - f.h / 2, s: w / f.w, ox: x, oy: y + h};
    drawStudio(v, shot.look, shot.time);
    // motion blur: ghosts trail behind fast limbs
    const ghosts = clamp((1 - shot.result.parts.sharp) * 4, 0, 3) | 0;
    for (let g = ghosts; g > 0; --g)
    {
        const trail = shot.pts.map(p=> ({pos: p.pos.subtract(p.vel.scale(g * .018)), r: p.r}));
        drawDoll(v, trail, shot.look, .22, true);
    }
    drawDoll(v, shot.pts, shot.look, 1, !shot.pts.some(p=> p.pos.y - p.r < surfaceAt(p.pos.x, shot.look) + .06));
    c.restore();
}

function drawReview()
{
    if (gameState != 'review') return;
    const shot = reviewShot, r = shot.result;
    const appear = clamp(reviewTimer * 4);
    const c = ctx();
    c.fillStyle = `rgba(10,8,14,${.65 * appear})`;
    c.fillRect(0, 0, STAGE_W, SCREEN_H);
    c.globalAlpha = appear;
    const dy = (1 - appear) * 40;

    // the print, slightly tilted like it was tossed on the desk
    c.save();
    c.translate(275, 360 + dy);
    c.rotate(-.035);
    c.fillStyle = '#00000066';
    c.fillRect(-182, -248, 380, 520);
    c.fillStyle = '#fbfaf6';
    c.fillRect(-190, -260, 380, 520);
    drawPhoto(shot, -170, -240, 340, 437);
    if (r.grade == 'A') // cover shot: masthead over the photo
    {
        drawTextScreen('LIMP', vec2(0, -195), 72, hexColor('#ffffff'), 4, hexColor('#000000', .35), 'center', SERIF, 'bold');
        drawTextScreen('THE BROKEN DOLL ISSUE', vec2(0, -150), 13, hexColor('#ffffff'), 3, hexColor('#000000', .4), 'center', SANS, 'bold');
    }
    drawTextScreen(shot.look.model.name + ' IN ' + shot.look.outfit.name, vec2(0, 228), 15, hexColor('#3a3742'), 0, BLACK, 'center', SERIF, 'italic');
    c.restore();

    // the verdict
    const x = 500;
    drawTextScreen('THE EDITORS SAY', vec2(x, 110 + dy), 14, hexColor('#ffffff', .6), 0, BLACK, 'left', SANS, 'bold');
    drawTextScreen(r.grade, vec2(x, 185 + dy), 120, hexColor(r.color), 0, BLACK, 'left', SERIF, 'bold');
    drawTextScreen('+$' + r.pay.toLocaleString(), vec2(x + 120, 175 + dy), 40, hexColor('#7ee081'), 0, BLACK, 'left', SERIF, 'bold');
    drawTextScreen(r.score + ' / 100' + (shots.length > 1 ? ' · BEST OF ' + shots.length : ''), vec2(x + 122, 210 + dy), 14,
        hexColor('#ffffff', .6), 0, BLACK, 'left', SANS, 'bold');

    const bars = [['FRAMING', r.parts.framing], ['POSE', r.parts.pose], ['AIRTIME', r.parts.air], ['SHARPNESS', r.parts.sharp]];
    bars.forEach(([label, value], i)=>
    {
        const y = 270 + i * 34 + dy;
        drawTextScreen(label, vec2(x, y), 13, hexColor('#ffffff', .75), 0, BLACK, 'left', SANS, 'bold');
        c.fillStyle = '#ffffff22';
        c.fillRect(x + 110, y - 6, 250, 12);
        c.fillStyle = value > .7 ? '#7ee081' : value > .4 ? '#e9c46a' : '#e63946';
        c.fillRect(x + 110, y - 6, 250 * clamp(value * Math.min(1, reviewTimer * 2)), 12);
    });
    drawTextScreen('STYLE', vec2(x, 270 + 4 * 34 + dy), 13, hexColor('#ffffff', .75), 0, BLACK, 'left', SANS, 'bold');
    drawTextScreen('+' + Math.round(r.style), vec2(x + 110, 270 + 4 * 34 + dy), 15, hexColor('#f7b2c4'), 0, BLACK, 'left', SANS, 'bold');

    // the quote, with a tiny stick-figure editor in sunglasses
    const qy = 500 + dy;
    const ev = {wx: 0, wy: 0, s: 40, ox: x + 18, oy: qy + 44};
    vCircle(ev, vec2(0, .9), .45, '#f1c9a5', .07);
    vPoly(ev, [vec2(-.5, 1.1), vec2(.5, 1.1), vec2(.55, .4), vec2(.35, .45), vec2(.3, .95), vec2(-.3, .95), vec2(-.35, .45), vec2(-.55, .4)], '#151515');
    vRect(ev, -.38, .85, .76, .16, '#151515');
    drawTextScreen('"' + r.comment + '"', vec2(x + 50, qy), 21, hexColor('#ffffff'), 0, BLACK, 'left', SERIF, 'italic', 360);
    drawTextScreen('— ' + EDITOR, vec2(x + 50, qy + 32), 11, hexColor('#ffffff', .55), 0, BLACK, 'left', SANS, 'bold');
    if (reviewTimer > .6)
        drawTextScreen('CLICK TO SHOOT AGAIN', vec2(STAGE_W / 2, SCREEN_H - 30), 15, hexColor('#ffffff', .5 + .3 * Math.sin(time * 5)), 0, BLACK, 'center', SANS, 'bold');
    c.globalAlpha = 1;
}

function drawTitle()
{
    if (gameState != 'title') return;
    const c = ctx();
    c.fillStyle = 'rgba(10,8,14,.72)';
    c.fillRect(0, 0, STAGE_W, SCREEN_H);
    drawTextScreen('RAGDOLL', vec2(STAGE_W / 2, 200), 96, hexColor('#ffffff'), 0, BLACK, 'center', SERIF, 'bold');
    drawTextScreen('COUTURE', vec2(STAGE_W / 2, 290), 96, hexColor('#f7b2c4'), 0, BLACK, 'center', SERIF, 'italic');
    const lines = ['TOSS THE MODEL. SNAP HER MID-AIR.', 'THE EDITORS PAY FOR BROKEN-DOLL GLAMOUR:', 'TWISTED, UPSIDE DOWN, AND SHARP AT THE TOP OF THE THROW.'];
    lines.forEach((line, i)=> drawTextScreen(line, vec2(STAGE_W / 2, 390 + i * 28), 17, hexColor('#ffffff', .8), 0, BLACK, 'center', SANS, 'bold'));
    drawTextScreen('CLICK TO OPEN THE STUDIO', vec2(STAGE_W / 2, 520), 20, hexColor('#e9c46a', .6 + .4 * Math.sin(time * 4)), 0, BLACK, 'center', SANS, 'bold');
}

///////////////////////////////////////////////////////////////////////////////
// shop column

const SHOP_X = STAGE_W, SHOP_W = SCREEN_W - STAGE_W;
const CARD_Y0 = 188, CARD_H = 48, CARD_GAP = 4;
const tabRect = (i)=> ({x: SHOP_X + 12 + i * 75, y: 150, w: 71, h: 26});
const cardRect = (i)=> ({x: SHOP_X + 12, y: CARD_Y0 + i * (CARD_H + CARD_GAP), w: SHOP_W - 24, h: CARD_H});
const hit = (r)=> mousePosScreen.x >= r.x && mousePosScreen.x < r.x + r.w && mousePosScreen.y >= r.y && mousePosScreen.y < r.y + r.h;

// one row per item: {name, desc, label, state: equipped|owned|buy|max, cost, pips, action}
function shopRows()
{
    const tab = TABS[shopTab];
    const equipRow = (item, slot)=>
    {
        const owned = !!save.owned[item.id], equipped = save.equip[slot] == item.id;
        const perks = [item.style && '+' + item.style + ' STYLE', item.pay > 1 && 'x' + item.pay + ' PAY', item.flex && 'FLEX ' + Math.round(item.flex * 100) + '%']
            .filter(Boolean).join(' · ');
        return {name: item.name, desc: perks || item.desc, sub: item.desc, cost: item.cost,
            state: equipped ? 'equipped' : owned ? 'owned' : 'buy',
            action: ()=> owned ? equip(slot, item) : buy(item, ()=> equip(slot, item))};
    };
    if (tab == 'WARDROBE') return OUTFITS.map(o=> equipRow(o, 'outfit'));
    if (tab == 'MODELS') return MODELS.map(m=> equipRow(m, 'model'));
    if (tab == 'CAMERA') return CAMERA.map(cam=>
    {
        const lv = camLevel(cam.id), maxed = lv >= cam.costs.length;
        return {name: cam.name, desc: cam.desc, cost: maxed ? 0 : cam.costs[lv], state: maxed ? 'max' : 'buy',
            pips: [lv, cam.costs.length], action: ()=> !maxed && buy({cost: cam.costs[lv], id: cam.id, level: true}, ()=> 0)};
    });
    return STUDIO.map(s=>
    {
        if (s.kind == 'backdrop') return equipRow(s, 'backdrop');
        const owned = !!save.owned[s.id];
        return {name: s.name, desc: '+' + s.style + ' STYLE · ' + s.desc, cost: s.cost, state: owned ? 'equipped' : 'buy', onLabel: 'OWNED',
            action: ()=> !owned && buy(s, ()=> 0)};
    });
}

function equip(slot, item)
{
    if (save.equip[slot] == item.id) return;
    save.equip[slot] = item.id;
    sndClick.play();
    saveGame();
}

function buy(item, then)
{
    if (save.money < item.cost)
    {
        sndDeny.play();
        return;
    }
    save.money -= item.cost;
    if (item.level) save.levels[item.id] = camLevel(item.id) + 1;
    else save.owned[item.id] = 1;
    then();
    sndBuy.play();
    saveGame();
}

function shopClick()
{
    TABS.forEach((t, i)=> hit(tabRect(i)) && (shopTab = i, sndClick.play()));
    shopRows().forEach((row, i)=> hit(cardRect(i)) && row.action());
}

function drawShop()
{
    const c = ctx();
    c.fillStyle = '#151419';
    c.fillRect(SHOP_X, 0, SHOP_W, SCREEN_H);
    c.fillStyle = '#e9c46a';
    c.fillRect(SHOP_X, 0, 3, SCREEN_H);

    drawTextScreen('RAGDOLL', vec2(SHOP_X + 20, 34), 25, hexColor('#ffffff'), 0, BLACK, 'left', SERIF, 'bold');
    c.font = 'bold 25px ' + SERIF;
    drawTextScreen('COUTURE', vec2(SHOP_X + 28 + c.measureText('RAGDOLL').width, 34), 25, hexColor('#f7b2c4'), 0, BLACK, 'left', SERIF, 'italic');
    drawTextScreen('$' + Math.floor(shownMoney).toLocaleString(), vec2(SHOP_X + 20, 88), 44, hexColor('#7ee081'), 0, BLACK, 'left', SERIF, 'bold');
    drawTextScreen('PHOTOS SOLD ' + save.photos + (save.best ? '  ·  BEST GRADE ' + save.best : ''), vec2(SHOP_X + 20, 126), 12,
        hexColor('#ffffff', .55), 0, BLACK, 'left', SANS, 'bold');

    TABS.forEach((t, i)=>
    {
        const r = tabRect(i), active = i == shopTab;
        c.fillStyle = active ? '#e9c46a' : hit(r) ? '#2e2c36' : '#211f27';
        c.fillRect(r.x, r.y, r.w, r.h);
        drawTextScreen(t, vec2(r.x + r.w / 2, r.y + r.h / 2 + 1), 11, hexColor(active ? '#151419' : '#ffffff', active ? 1 : .7), 0, BLACK, 'center', SANS, 'bold');
    });

    shopRows().forEach((row, i)=>
    {
        const r = cardRect(i);
        const affordable = row.state == 'buy' && save.money >= row.cost;
        c.fillStyle = hit(r) ? '#2a2832' : '#1f1d25';
        c.fillRect(r.x, r.y, r.w, r.h);
        if (row.state == 'equipped')
        {
            c.strokeStyle = '#e9c46a';
            c.lineWidth = 2;
            c.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
        }
        drawTextScreen(row.name, vec2(r.x + 12, r.y + 16), 14, hexColor('#ffffff'), 0, BLACK, 'left', SANS, 'bold');
        drawTextScreen(row.desc, vec2(r.x + 12, r.y + 34), 10, hexColor('#ffffff', .55), 0, BLACK, 'left', SANS, 'bold', 190);
        if (row.pips)
            for (let p = 0; p < row.pips[1]; ++p)
            {
                c.fillStyle = p < row.pips[0] ? '#e9c46a' : '#ffffff22';
                c.fillRect(r.x + 150 + p * 14, r.y + 11, 10, 10);
            }

        const label = row.state == 'equipped' ? row.onLabel || 'IN USE' :
            row.state == 'owned' ? 'USE' : row.state == 'max' ? 'MAX' : row.cost ? '$' + row.cost.toLocaleString() : 'FREE';
        const color = row.state == 'equipped' ? '#e9c46a' : row.state == 'owned' ? '#ffffff' : row.state == 'max' ? '#7ee081' :
            affordable ? '#7ee081' : '#ffffff';
        drawTextScreen(label, vec2(r.x + r.w - 12, r.y + r.h / 2), 15, hexColor(color, row.state == 'buy' && !affordable ? .35 : 1),
            0, BLACK, 'right', SANS, 'bold');
    });
}

///////////////////////////////////////////////////////////////////////////////

function gameRenderPost()
{
    const c = ctx();
    c.save();
    c.beginPath();
    c.rect(0, 0, STAGE_W, SCREEN_H);
    c.clip();
    const v = stageView();
    drawStudio(v, currentLook(), time);
    drawDoll(v, doll.pts, currentLook(), 1, gameState == 'air' && !doll.touching() && doll.maxSpeed() > 6);
    drawViewfinder();
    if (flashTimer > 0)
    {
        c.fillStyle = `rgba(255,255,255,${flashTimer / .25})`;
        c.fillRect(0, 0, STAGE_W, SCREEN_H);
    }
    drawStageText();
    drawReview();
    drawTitle();
    c.restore();
    drawShop();
}

engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost);
