/*
    Fire Brigade — 2D side-scrolling firefighting platformer prototype
    - Building is a cross-section (This War of Mine style): floors, rooms, doors, ladders
    - Fires grow and spread room to room (never up a floor) if not doused
    - Water tanks run dry: refill at the fire truck or the limited standpipes
    - Hose and axe are automatic: fire in range gets sprayed, and walking into
      a door or debris chops it
    - 1P or 2P (P1 WASD, P2 arrows): move, jump and climb only
    - The truck's aerial ladder always stands against the left wall, street to
      roof, with a landing at every upper floor window. Pick where to start each
      run: front door, a window landing (chop it open), or the roof (chop the
      hatch and climb down)
    - Burning ledges 3 tiles up on random floors (a jump reaches ~2.4). Solo:
      1-2 ledges with their ladder already down. 2P: a partner's head is a
      platform (a stacked jump reaches ~3.3), and each run has 2-3 co-op spots:
      ledges (a lever up top drops the ladder) and unchoppable steel barricades
      (a lever on the far side rolls them up)
    - Pixel art: the game renders at 480x270 and is scaled up without smoothing.
      1 world unit = 8 pixels. Sprites are text maps (plus procedural flames)
      packed into one sheet at startup; the static building is painted pixel by
      pixel into a second texture and drawn as one big tile.
*/

'use strict';
debugWatermark = false;
setInputWASDEmulateDirection(false); // WASD and arrows are separate players

const screenW = 480, screenH = 270;
setCanvasFixedSize(vec2(screenW, screenH));
setCanvasPixelated(true);

const PX = 8; // pixels per world unit

///////////////////////////////////////////////////////////////////////////////
// layout constants (1 world unit = 1 tile)

const GRID_W = 112;          // whole world width
const BLD_X = 34;            // building left wall column
const BLD_W = 62;            // building width in columns (incl. both outer walls)
const FLOORS = 4;
const FLOOR_H = 6;           // 5 rows of room + 1 slab
const GRID_H = 2 + FLOORS*FLOOR_H + 6;
const BG_H = 36;             // background texture height in units (covers the view)
const TRUCK_X = 18;          // fire truck center (refill)
const SPRAY_RANGE = 6;       // tiles: fire this close turns the hose on

// fire tuning (rates are chances per second)
const FIRE_GROW = .1;          // heat gained per second
const FIRE_SPREAD_HEAT = .4;   // heat a cell needs before it spreads
const FIRE_SPREAD_RATE = .45;  // sideways, per neighbor
const FIRE_DRIP_RATE = .075;   // a raging ledge drips down onto the floor below (fire never spreads up)
const FIRE_DOOR_BURN = 9;      // closed doors burn through after this much heat-seconds

const T_SOLID = 1, T_DOOR = 2, T_DEBRIS = 3, T_PLATFORM = 4, T_RUBBLE = 5;

const floorY = (f)=> 2 + f*FLOOR_H; // floor surface y of floor f

// per-floor design: wall column (relative to BLD_X), door state, ladder up, debris, standpipe
// debris walls each standpipe in from both sides (pipe-4 and pipe+2), far enough
// out that it can't be used from the other side of the pile
const FLOOR_PLANS =
[
    { walls:[[16,'closed'],[34,'open'],[48,'closed']], ladder:42, debris:[],       pipe:0  },
    { walls:[[12,'open'],[28,'closed'],[44,'closed']], ladder:6,  debris:[16, 22], pipe:20 },
    { walls:[[18,'closed'],[36,'open'],[50,'closed']], ladder:56, debris:[],       pipe:0  },
    { walls:[[14,'closed'],[30,'closed'],[46,'open']], ladder:22, debris:[34, 40], pipe:38 }, // top ladder: roof hatch
];

///////////////////////////////////////////////////////////////////////////////
// palette (same family as Vending Machine Sim)

const pal =
{
    k:'#181425', w:'#ffffff', s:'#c0cbdc', S:'#8b9bb4', d:'#5a6988', D:'#3a4466', e:'#262b44',
    r:'#e43b44', R:'#a22633', o:'#f77622', y:'#feae34', Y:'#fee761',
    g:'#63c74d', G:'#3e8948', b:'#0099db', B:'#124e89', c:'#2ce8f5',
    p:'#b55088', P:'#68386c', n:'#b86f50', N:'#733e39', m:'#3e2731', t:'#e4a672', T:'#ead4aa',
};
const colorCache = {};
const palColor = (char, a=1)=> (colorCache[char] || (colorCache[char] = new Color().setHex(pal[char]))).scale(1, a);

// muted wallpaper tones: [base, pattern]
const WALLPAPERS =
[
    ['#6b5a4a','#5c4d40'], ['#4f5e52','#445147'], ['#4a5568','#3f495a'], ['#6a4b52','#5b4047'],
    ['#5e5a50','#514d44'], ['#56496a','#4a3f5c'], ['#6b6248','#5c543e'], ['#4b5b5e','#404e51'],
];

///////////////////////////////////////////////////////////////////////////////
// sprites: text maps, one character per pixel, '.' is transparent
// every map sprite gets a dark 1 pixel outline added automatically

const spriteMaps =
{
    idle: [
        '................',
        '................',
        '......yyyy......',
        '.....yyyyyy.....',
        '....oyyyyyyyy...',
        '......ttkt......',
        '......tttt......',
        '....SSrrrr......',
        '....SsrrrrrSdd..',
        '....SsrrRrrr....',
        '....SsYYYYYY....',
        '.....rrrrrr.....',
        '.....DDDDDD.....',
        '.....DD..DD.....',
        '.....DD..DD.....',
        '.....kk..kk.....'],
    walk: [
        '................',
        '................',
        '......yyyy......',
        '.....yyyyyy.....',
        '....oyyyyyyyy...',
        '......ttkt......',
        '......tttt......',
        '....SSrrrr......',
        '....SsrrrrrSdd..',
        '....SsrrRrrr....',
        '....SsYYYYYY....',
        '.....rrrrrr.....',
        '.....DDDDDD.....',
        '....DD...DD.....',
        '...DD.....DD....',
        '...kk.....kk....'],
    chop: [
        '................',
        '................',
        '......yyyy......',
        '.....yyyyyy.....',
        '....oyyyyyyyy...',
        '......ttkt......',
        '......tttt......',
        '....SSrrrr......',
        '....Ssrrrrr.....',
        '....SsrrRrr.....',
        '....SsYYYYYY....',
        '.....rrrrrr.....',
        '.....DDDDDD.....',
        '.....DD..DD.....',
        '....DD....DD....',
        '....kk....kk....'],
    climb: [
        '................',
        '................',
        '......yyyy......',
        '.....yyyyyy.....',
        '...r.oyyyyo.r...',
        '...rrSssssSrr...',
        '....rSssssSr....',
        '.....SssssS.....',
        '.....SssssS.....',
        '.....rSSSSr.....',
        '.....YYYYYY.....',
        '.....rrrrrr.....',
        '.....DDDDDD.....',
        '.....DD..DD.....',
        '.....DD.........',
        '.....kk.........'],
    down: [
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '..yy.rrrrrrDDDD.',
        '.yyyttrrYYrDDDDk',
        '..yy.SSSSSSDDDD.'],
    axeUp: [
        '.........sss....',
        '........sSSSs...',
        '.........ssn....',
        '...........n....',
        '...........n....',
        '...........n....',
        '...........n....',
        '..........tn....',
        '..........t.....',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '................'],
    axeDown: [
        '................',
        '................',
        '................',
        '................',
        '................',
        '................',
        '..............s.',
        '.............sSs',
        '..........tnnnSs',
        '.............sSs',
        '..............s.',
        '................',
        '................',
        '................',
        '................',
        '................'],
    door: [
        'mmmmmmmm',
        'mnnnnnnm',
        'mnNNNNnm',
        'mnNnnNnm',
        'mnNnnNnm',
        'mnNnnNnm',
        'mnNnnNnm',
        'mnNnnNnm',
        'mnNnnNnm',
        'mnNNNNnm',
        'mnnnnnnm',
        'mnnnnnym',
        'mnnnnnnm',
        'mnNNNNnm',
        'mnNnnNnm',
        'mnNnnNnm',
        'mnNnnNnm',
        'mnNnnNnm',
        'mnNnnNnm',
        'mnNnnNnm',
        'mnNNNNnm',
        'mnnnnnnm',
        'mnnnnnnm',
        'mmmmmmmm'],
    debris: [
        '.....nn.........',
        '.....nnn........',
        '......nnn.......',
        '.......nnn...N..',
        '........nnnNNN..',
        '.........NNNN...',
        '.......NNNNnn...',
        '.....NNNNnnnn...',
        '...NNNN..nnnnn..',
        '..dddd....nnnn..',
        '.dddddd....nnn..',
        '.ddDDdddSSSSS...',
        '.dDDDddSSSSSSS..',
        'ddDDDddSSdSSSSS.',
        'ddddddSSSddSSSSS',
        'dDDddnnnnnnnnSSS',
        'dDDdnnnnnnnnnnSS',
        'ddddNNNNNNNNNNdd',
        'SSSSSddddSSSSddd',
        'SSSSdddDDdSSSSdd',
        'SdSSddDDDddSSdSS',
        'SSSSSddddSSSSSSS',
        'dSSSSSSSdSSSSdSS',
        'dddSSSSSSSSdSSSS'],
    window: [
        'mmmmmmmm',
        'mNNNNNNm',
        'mNbcBBNm',
        'mNbBBBNm',
        'mNBbBBNm',
        'mNBBBBNm',
        'mNBBBbNm',
        'mNBBBBNm',
        'mNBBBBNm',
        'mNBBBBNm',
        'mNNNNNNm',
        'mNBBBBNm',
        'mNbBBBNm',
        'mNBbBBNm',
        'mNBBBBNm',
        'mNBBBBNm',
        'mNBBBbNm',
        'mNBBBBNm',
        'mNBBBBNm',
        'mNBBBBNm',
        'mNNNNNNm',
        'mmmmmmmm',
        'SSSSSSSS',
        'dddddddd'],
    hatch: [
        'dddddddd',
        'dSSSSSSd',
        'dSddddSd',
        'dSdyydSd',
        'dSdyydSd',
        'dSddddSd',
        'dSSSSSSd',
        'dddddddd'],
    waterSign: [
        'BBBBBBBBBB',
        'BbbbbbbbbB',
        'BbbbwwbbbB',
        'BbbbwwbbbB',
        'BbbwwwwbbB',
        'BbbwwwwbbB',
        'BbwwwwwwbB',
        'BbwcwwwwbB',
        'BbwcwwwwbB',
        'BbbwwwwbbB',
        'BbbbbbbbbB',
        'BBBBBBBBBB'],
    drop: [
        '...b...',
        '..bcb..',
        '.bcccb.',
        '.bcwcb.',
        '.bcccb.',
        '..bbb..'],
    rubble: [ // steel barricade, hazard stripes say the axe won't work
        'DdYYkkYYkkYYkkdD',
        'DdYkkYYkkYYkkYdD',
        'DdkkYYkkYYkkYYdD',
        'DdkYYkkYYkkYYkdD',
        'DddddddddddddddD',
        'DdSSSSSSSSSSSSdD',
        'DdssssssssssssdD',
        'DdSwSSSwSSSwSSdD',
        'DdSSSSSSSSSSSSdD',
        'DdDDDDDDDDDDDDdD',
        'DdkkYYkkYYkkYYdD',
        'DdkYYkkYYkkYYkdD',
        'DdYYkkYYkkYYkkdD',
        'DdYkkYYkkYYkkYdD',
        'DddddddddddddddD',
        'DdSSSSSSSSSSSSdD',
        'DdssssssssssssdD',
        'DdSwSSSwSSSwSSdD',
        'DdSSSSSSSSSSSSdD',
        'DdDDDDDDDDDDDDdD',
        'DdYYkkYYkkYYkkdD',
        'DdYkkYYkkYYkkYdD',
        'DdkkYYkkYYkkYYdD',
        'DDDDDDDDDDDDDDDD'],
    lever: [
        '.r.....',
        'rRr....',
        '.rd....',
        '..d....',
        '...d...',
        '...d...',
        '.SSSSS.',
        'SsssssS',
        'SSSSSSS'],
    boost: [
        '..Y..',
        '.YyY.',
        'Yy.yY',
        'y...y'],
    heart: [
        '.rr.rr.',
        'rrrrrrr',
        'rwrrrrr',
        'rrrrrrr',
        '.rrrrr.',
        '..rrr..',
        '...r...'],
    flame: [
        '...o...',
        '..oo...',
        '..ooo..',
        '.oyyo..',
        '.oyYyo.',
        'ooyYyoo',
        '.oyyyo.'],
};

const sprites = {}; // name -> {x, y, w, h, tileInfo}

function buildSpriteSheet()
{
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    let cx = 0, cy = 0, rowH = 0;

    const addSprite = (name, w, h, pixelFn) =>
    {
        if (cx + w + 1 > size)
            cx = 0, cy += rowH + 1, rowH = 0;
        for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x)
        {
            const color = pixelFn(x, y);
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(cx + x, cy + y, 1, 1);
        }
        sprites[name] = {x: cx, y: cy, w, h};
        cx += w + 1;
        rowH = max(rowH, h);
    };

    const filled = (map, x, y)=> map[y] && map[y][x] && map[y][x] != '.';
    const isOutline = (map, x, y)=> !filled(map, x, y) &&
        (filled(map, x-1, y) || filled(map, x+1, y) || filled(map, x, y-1) || filled(map, x, y+1));
    const addMap = (name, map, recolor={})=>
    {
        ASSERT(map.every(row=> row.length == map[0].length), 'sprite rows must match: ' + name);
        addSprite(name, map[0].length, map.length, (x, y)=>
            isOutline(map, x, y) ? pal.k : filled(map, x, y) ? pal[recolor[map[y][x]] || map[y][x]] : 0);
    };

    // firefighters: P1 red coat, P2 blue coat (palette swap)
    const coats = [{}, {r:'b', R:'B'}];
    for (const pose of ['idle','walk','chop','climb','down'])
        coats.forEach((recolor, i)=> addMap('p' + i + '_' + pose, spriteMaps[pose], recolor));
    for (const name of ['axeUp','axeDown','door','debris','window','hatch','waterSign','drop','heart','flame','rubble','lever','boost'])
        addMap(name, spriteMaps[name]);
    addMap('leverOn', spriteMaps.lever, {r:'g', R:'G'});
    addMap('waterSignLit', spriteMaps.waterSign, {B:'c'});

    // procedural flames: 3 sizes x 3 animation frames, 16 wide x 24 tall
    let seed = 3;
    const rng = ()=> (seed = (seed*16807) % 2147483647) / 2147483647;
    [9, 15, 23].forEach((maxH, sizeIndex)=>
    {
        for (let frameIndex = 0; frameIndex < 3; ++frameIndex)
        {
            const heights = [];
            for (let x = 0; x < 16; ++x)
            {
                const prof = Math.pow(max(0, 1 - abs(x - 7.5) / 8), .7);
                heights.push(maxH * prof * (.55 + .45 * rng()) * (x % 3 == frameIndex ? 1.15 : 1));
            }
            addSprite('fire' + sizeIndex + '_' + frameIndex, 16, 24, (x, y)=>
            {
                const fromBottom = 23 - y, h = heights[x];
                if (fromBottom >= h) return 0;
                const t = fromBottom / h + (rng() - .5) * .15;
                const core = abs(x - 7.5) < 3.5 * (1 - fromBottom / maxH);
                return t > .85 ? pal.R : t > .62 ? pal.r : t > .38 ? pal.o : core ? (t < .2 ? pal.w : pal.Y) : pal.y;
            });
        }
    });

    return canvas.toDataURL();
}

// draw a sprite from the sheet with its bottom center at pos (world units)
function drawSprite(name, pos, mirror=false, color=WHITE, additiveColor)
{
    const s = sprites[name];
    s.tileInfo ||= new TileInfo(vec2(s.x, s.y), vec2(s.w, s.h), textureInfos[0]);
    const x = Math.round(pos.x * PX) / PX, y = Math.round(pos.y * PX) / PX;
    drawTile(vec2(x, y + s.h / PX / 2), vec2(s.w, s.h).scale(1/PX), s.tileInfo, color, 0, mirror, additiveColor);
}

///////////////////////////////////////////////////////////////////////////////
// static building layout + decoration (computed at load, before the engine starts)

let decoSeed = 7;
const decoRand = ()=> (decoSeed = (decoSeed*16807) % 2147483647) / 2147483647;

const rooms = []; // [floor] -> [{x0, x1, paper, pattern, furniture, windows, pictures}]
const ladderSpots = [];
const pipeSpots = [];

for (let f = 0; f < FLOORS; ++f)
{
    const plan = FLOOR_PLANS[f];
    const edges = [0, ...plan.walls.map(w=> w[0]), BLD_W-1];
    const floorRooms = [];
    for (let i = 0; i < edges.length-1; ++i)
    {
        const x0 = BLD_X + edges[i] + 1, x1 = BLD_X + edges[i+1];
        const w = x1 - x0;
        const room = {x0, x1, paper: WALLPAPERS[(f*3 + i) % WALLPAPERS.length], pattern: (f + i*2) % 4,
            furniture: [], windows: [], pictures: []};
        for (let wx = x0 + 2; wx < x1 - 3; wx += 6)
            decoRand() < .55 ? room.windows.push(wx + (decoRand()*2|0)) : room.pictures.push(wx + 1);
        const kinds = ['bed','sofa','table','shelf','fridge','desk','lamp','tv','plant'];
        const count = 1 + (w/5|0);
        for (let k = 0; k < count; ++k)
            room.furniture.push({kind: kinds[decoRand()*kinds.length|0], x: x0 + 1.5 + decoRand()*(w-3), color: decoRand()});
        floorRooms.push(room);
    }
    rooms.push(floorRooms);
    ladderSpots.push({x: BLD_X + plan.ladder, y0: floorY(f), y1: floorY(f+1)});
    if (plan.pipe)
        pipeSpots.push({x: BLD_X + plan.pipe + .5, y: floorY(f)});
}

///////////////////////////////////////////////////////////////////////////////
// background painter: the whole static world as one pixel-art texture

function buildBackground()
{
    const W = GRID_W * PX, H = BG_H * PX;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    decoSeed = 99;

    // fill in world pixels, y up from the bottom of the world
    const fill = (x, y, w, h, c)=> { ctx.fillStyle = c; ctx.fillRect(x|0, H - (y|0) - (h|0), w|0, h|0); };
    const dot = (x, y, c)=> fill(x, y, 1, 1, c);

    // sky bands with a dithered seam, warm glow near the horizon
    const sky = ['#4f2b3f','#3b2440','#2a1f3d','#1e1a36','#16132b','#100e22','#0b0a18'];
    const bandH = 40;
    sky.forEach((c, i)=>
    {
        fill(0, 16 + i*bandH, W, bandH, c);
        if (i)
            for (let x = 0; x < W; x += 2)
                dot(x + (i % 2), 16 + i*bandH, sky[i-1]), dot(x + 1 - (i % 2), 16 + i*bandH + 1, sky[i-1]);
    });
    fill(0, 16 + sky.length*bandH, W, H, sky[sky.length-1]);
    for (let i = 0; i < 120; ++i)
        dot(decoRand()*W, 140 + decoRand()*(H-140), decoRand() < .3 ? pal.s : pal.D);

    // moon
    const mx = 70, my = 250;
    for (let y = -7; y <= 7; ++y)
    for (let x = -7; x <= 7; ++x)
        if (x*x + y*y < 50) dot(mx + x, my + y, x*x + y*y > 36 ? pal.S : (x - y) % 5 == 0 && x > -2 ? pal.s : pal.T);

    // distant skyline, two layers
    for (const [color, lit, minH, maxH] of [['#1d1a33', '#5a4a3a', 40, 120], ['#141226', '#7a6038', 20, 80]])
    for (let x = -10; x < W; )
    {
        const w = 20 + decoRand()*40|0, h = minH + decoRand()*(maxH-minH)|0;
        fill(x, 16, w, h, color);
        if (decoRand() < .4) fill(x + w/2 - 1, 16 + h, 2, 6, color); // antenna
        for (let wy = 22; wy < 16 + h - 6; wy += 6)
        for (let wx = x + 3; wx < x + w - 3; wx += 5)
            decoRand() < .18 && fill(wx, wy, 2, 3, lit);
        x += w + (decoRand()*8|0);
    }

    // street + sidewalk
    fill(0, 0, W, 16, pal.e);
    fill(0, 12, W, 4, pal.d);
    fill(0, 15, W, 1, pal.S);
    fill(0, 12, W, 1, pal.D);
    for (let x = 4; x < W; x += 24) fill(x, 5, 10, 1, '#8a6a30');
    for (let x = 0; x < W; x += 16) dot(x, 13, pal.D);

    // street lamps
    for (const lx of [40, 240, 820])
    {
        fill(lx, 16, 2, 40, pal.D);
        fill(lx, 54, 8, 2, pal.D);
        fill(lx + 5, 52, 4, 2, pal.Y);
        for (let i = 0; i < 18; ++i)
        for (let x = -i/2; x < i/2; ++x)
            (x + i) % 2 == 0 && dot(lx + 7 + x, 51 - i*2, 'rgba(254,231,97,.18)');
    }

    paintTruck(fill, dot);
    paintBuilding(fill, dot);
    return canvas.toDataURL();
}

function paintTruck(fill, dot)
{
    const x = TRUCK_X * PX, g = 16; // center x, ground y
    // body + cab
    fill(x - 34, g + 7, 50, 17, pal.r);
    fill(x - 34, g + 7, 50, 3, pal.R);
    fill(x - 34, g + 14, 50, 1, pal.T);
    fill(x + 16, g + 7, 16, 23, pal.r);
    fill(x + 16, g + 7, 16, 3, pal.R);
    fill(x + 19, g + 19, 11, 8, pal.B);
    fill(x + 20, g + 24, 3, 2, pal.b);
    fill(x + 31, g + 7, 3, 6, pal.S);
    // roller-door compartments
    for (let i = 0; i < 3; ++i)
    {
        fill(x - 31 + i*15, g + 16, 12, 7, pal.R);
        for (let y = g + 17; y < g + 23; y += 2) fill(x - 30 + i*15, y, 10, 1, pal.r);
    }
    // ladder on top
    fill(x - 36, g + 25, 52, 1, pal.s);
    fill(x - 36, g + 28, 52, 1, pal.s);
    for (let lx = x - 35; lx < x + 16; lx += 4) fill(lx, g + 25, 1, 4, pal.S);
    // light bar base
    fill(x + 18, g + 30, 12, 1, pal.k);
    // wheels
    for (const wx of [x - 24, x - 4, x + 24])
    for (let yy = -5; yy <= 5; ++yy)
    for (let xx = -5; xx <= 5; ++xx)
    {
        const d = xx*xx + yy*yy;
        d < 30 && dot(wx + xx, g + 5 + yy, d < 6 ? pal.S : d < 12 ? pal.d : pal.k);
    }
    // hose reel
    for (let yy = -5; yy <= 5; ++yy)
    for (let xx = -5; xx <= 5; ++xx)
    {
        const d = xx*xx + yy*yy;
        d < 30 && dot(x - 38 + xx, g + 15 + yy, d < 6 ? pal.N : (xx + yy) % 2 ? pal.y : pal.o);
    }
    // hydrant
    const hx = x + 46;
    fill(hx, g, 6, 9, pal.r); fill(hx - 1, g + 9, 8, 2, pal.R); fill(hx + 1, g + 11, 4, 2, pal.r);
    fill(hx - 2, g + 4, 2, 3, pal.R); fill(hx + 6, g + 4, 2, 3, pal.R);
}

function paintBuilding(fill, dot)
{
    const bx = BLD_X * PX, bw = BLD_W * PX;
    const concrete = '#4b4552', concreteDark = '#2e2a35', concreteLite = '#5d5664';

    // rooms
    for (let f = 0; f < FLOORS; ++f)
    {
        const y0 = floorY(f) * PX, h = (FLOOR_H-1) * PX;
        for (const room of rooms[f])
        {
            const x0 = room.x0 * PX, w = (room.x1 - room.x0) * PX;
            const [base, accent] = room.paper;
            fill(x0, y0, w, h, base);
            // wallpaper pattern
            if (room.pattern == 0)
                for (let x = x0 + 2; x < x0 + w; x += 4) fill(x, y0, 1, h, accent);
            else if (room.pattern == 1)
                for (let y = y0 + 4; y < y0 + h; y += 4)
                for (let x = x0 + (y % 8 ? 2 : 0); x < x0 + w; x += 4) dot(x, y, accent);
            else if (room.pattern == 2)
            {
                fill(x0, y0, w, 14, accent);
                fill(x0, y0 + 14, w, 1, '#2e2a35');
            }
            else
                for (let y = y0; y < y0 + 16; y += 4)
                for (let x = x0; x < x0 + w; x += 4) fill(x, y, 4, 1, accent), fill(x, y, 1, 4, accent);
            fill(x0, y0, w, 2, '#2e2a35');                // baseboard
            fill(x0, y0 + h - 2, w, 2, 'rgba(0,0,0,.35)'); // ceiling shadow

            for (const wx of room.windows)
            {
                const px = wx * PX, py = y0 + 14;
                fill(px - 1, py - 1, 14, 16, pal.m);
                fill(px, py, 12, 14, '#141a33');
                fill(px, py, 12, 4, '#1d2545');
                for (let i = 0; i < 4; ++i) dot(px + 7 + i, py + 9 + i, '#3a4a70');
                fill(px + 5, py, 2, 14, pal.m);
                fill(px, py + 6, 12, 2, pal.m);
                fill(px - 2, py - 2, 16, 1, pal.N);
            }
            for (const px of room.pictures)
            {
                const p = px * PX, py = y0 + 20, colors = [pal.G, pal.B, pal.P, pal.n];
                fill(p - 1, py - 1, 9, 8, pal.N);
                fill(p, py, 7, 6, colors[(p/8|0) % 4]);
                fill(p + 1, py, 5, 2, pal.T);
            }
            // ceiling light
            const lx = (x0 + w/2)|0;
            fill(lx, y0 + h - 5, 1, 4, pal.k);
            fill(lx - 3, y0 + h - 7, 7, 2, pal.N);
            for (let i = 1; i < 10; ++i)
            for (let xx = -i; xx <= i; xx += 2)
                dot(lx + xx + (i % 2), y0 + h - 7 - i, 'rgba(254,231,97,.07)');

            for (const item of room.furniture)
                paintFurniture(fill, dot, item, y0);
        }
    }

    // ladders through the slabs
    for (const l of ladderSpots)
    {
        const lx = l.x * PX, ya = l.y0 * PX, yb = (l.y1 + 1) * PX;
        fill(lx, (l.y1 - 1) * PX, 8, 8, pal.k); // hole in the slab
        fill(lx + 1, ya, 1, yb - ya, pal.S);
        fill(lx + 6, ya, 1, yb - ya, pal.S);
        for (let y = ya + 3; y < yb; y += 4) fill(lx + 2, y, 4, 1, pal.d);
    }

    // floor slabs + roof
    for (let f = 1; f <= FLOORS; ++f)
    {
        const y = (floorY(f) - 1) * PX;
        for (let x = bx; x < bx + bw; ++x)
        {
            const isHole = ladderSpots.some(l=> l.y1 == floorY(f) && x >= l.x*PX && x < l.x*PX + 8);
            if (isHole) continue;
            fill(x, y + 1, 1, 6, concrete);
            fill(x, y, 1, 1, concreteDark);
            fill(x, y + 7, 1, 1, pal.N);
            x % 7 == 0 && dot(x, y + 2 + (x*3 % 4), concreteLite);
            x % 5 == 0 && dot(x, y + 4 + (x % 2), concreteDark);
        }
    }

    // outer brick walls
    const wallTop = floorY(FLOORS) * PX;
    for (const wx of [bx, bx + bw - PX])
    {
        fill(wx, 16, 8, wallTop - 16, '#4a2a26');
        for (let y = 16; y < wallTop; y += 3)
        for (let x = wx - ((y/3|0) % 2 ? 2 : 0); x < wx + 8; x += 4)
            fill(max(x, wx), y, min(3, x + 3 - max(x, wx)), 2, '#7a3b2e');
    }

    // interior walls: plaster above a dark doorway with a frame
    for (let f = 0; f < FLOORS; ++f)
    {
        const y0 = floorY(f) * PX;
        for (const [wx] of FLOOR_PLANS[f].walls)
        {
            const x = (BLD_X + wx) * PX;
            fill(x, y0 + 24, 8, 16, '#3f3a46');
            fill(x + 1, y0 + 24, 6, 16, '#4f4858');
            fill(x, y0, 8, 24, '#14121c');
            fill(x - 1, y0, 1, 25, pal.m);
            fill(x + 8, y0, 1, 25, pal.m);
            fill(x - 1, y0 + 24, 10, 1, pal.N);
        }
    }
    // front doorway + upper floor window openings
    for (let f = 0; f < FLOORS; ++f)
        fill(bx, floorY(f) * PX, 8, 24, '#14121c');

    // roof clutter: parapet, water tower, AC unit, antenna
    fill(bx - 2, wallTop, bw + 4, 3, concreteDark);
    fill(bx - 2, wallTop + 3, bw + 4, 1, concreteLite);
    const tx = bx + 64;
    for (const lx of [tx, tx + 18]) fill(lx, wallTop + 4, 2, 14, pal.k);
    fill(tx - 2, wallTop + 10, 24, 1, pal.k);
    fill(tx - 2, wallTop + 18, 24, 18, pal.N);
    for (let x = tx; x < tx + 20; x += 3) fill(x, wallTop + 18, 1, 18, pal.m);
    fill(tx - 2, wallTop + 22, 24, 1, pal.k);
    fill(tx - 2, wallTop + 31, 24, 1, pal.k);
    for (let i = 0; i < 6; ++i) fill(tx - 2 + i*2, wallTop + 36 + i, 24 - i*4, 1, pal.m);
    const ax = bx + 230;
    fill(ax, wallTop + 4, 26, 13, pal.d);
    fill(ax + 1, wallTop + 5, 24, 11, pal.S);
    for (let y = wallTop + 6; y < wallTop + 15; y += 2) fill(ax + 3, y, 12, 1, pal.d);
    fill(ax + 17, wallTop + 7, 6, 6, pal.d);
    const nx = bx + 380;
    fill(nx, wallTop + 4, 1, 36, pal.D);
    fill(nx - 6, wallTop + 30, 13, 1, pal.D);
    fill(nx - 4, wallTop + 22, 9, 1, pal.D);

    // standpipes
    for (const p of pipeSpots)
    {
        const x = p.x * PX, y = p.y * PX;
        fill(x - 1, y, 3, 30, pal.R);
        fill(x, y, 1, 30, pal.r);
        fill(x - 4, y + 12, 9, 1, pal.R);
        fill(x, y + 8, 1, 9, pal.R);
        for (const [dx, dy] of [[-3,0],[3,0],[0,-3],[0,3]]) dot(x + dx, y + 12 + dy, pal.r);
        fill(x - 4, y + 22, 9, 6, pal.r);
        fill(x - 3, y + 23, 7, 4, pal.w);
        fill(x - 1, y + 23, 3, 4, pal.r);
        fill(x - 3, y + 24, 7, 2, pal.r);
    }
}

function paintFurniture(fill, dot, item, floorPy)
{
    const x = item.x * PX | 0, y = floorPy;
    const fabric = [pal.B, pal.G, pal.P, pal.R, pal.d][item.color * 5 | 0];
    switch (item.kind)
    {
        case 'bed':
            fill(x - 12, y, 2, 11, pal.m); fill(x + 10, y, 2, 7, pal.m);
            fill(x - 10, y + 2, 20, 3, pal.N);
            fill(x - 10, y + 5, 20, 2, pal.T);
            fill(x - 3, y + 5, 13, 3, fabric);
            fill(x - 9, y + 7, 5, 2, pal.w);
            break;
        case 'sofa':
            fill(x - 10, y, 2, 1, pal.k); fill(x + 8, y, 2, 1, pal.k);
            fill(x - 11, y + 1, 22, 5, fabric);
            fill(x - 10, y + 6, 20, 5, fabric);
            fill(x - 10, y + 6, 20, 1, pal.k);
            fill(x - 12, y + 1, 3, 7, pal.k); fill(x + 9, y + 1, 3, 7, pal.k);
            fill(x - 11, y + 2, 1, 5, fabric); fill(x + 10, y + 2, 1, 5, fabric);
            break;
        case 'table':
            fill(x - 9, y + 7, 18, 2, pal.n); fill(x - 9, y + 6, 18, 1, pal.N);
            fill(x - 8, y, 1, 6, pal.N); fill(x + 7, y, 1, 6, pal.N);
            fill(x - 1, y + 9, 3, 4, pal.p); dot(x, y + 13, pal.G);
            break;
        case 'shelf':
            fill(x - 7, y, 14, 24, pal.m);
            fill(x - 6, y + 1, 12, 22, '#2a1d24');
            for (let sy = y + 6; sy < y + 24; sy += 6) fill(x - 6, sy, 12, 1, pal.N);
            for (let sy = y + 1; sy < y + 22; sy += 6)
            for (let bx = x - 6; bx < x + 5; bx += 2)
                decoRand() < .75 && fill(bx, sy, 1, 3 + (decoRand()*2|0), [pal.r, pal.b, pal.g, pal.y, pal.T][decoRand()*5|0]);
            break;
        case 'fridge':
            fill(x - 5, y, 10, 20, pal.S);
            fill(x - 4, y, 8, 19, pal.s);
            fill(x - 4, y + 12, 8, 1, pal.S);
            fill(x + 2, y + 14, 1, 3, pal.d); fill(x + 2, y + 6, 1, 4, pal.d);
            break;
        case 'desk':
            fill(x - 9, y + 8, 18, 2, pal.n); fill(x - 9, y + 7, 18, 1, pal.N);
            fill(x - 9, y, 6, 7, pal.N); fill(x - 8, y + 4, 4, 1, pal.y);
            fill(x + 7, y, 1, 7, pal.N);
            fill(x + 1, y + 10, 1, 2, pal.k);
            fill(x - 3, y + 12, 9, 6, pal.k);
            fill(x - 2, y + 13, 7, 4, '#1f5a63');
            break;
        case 'lamp':
            fill(x - 2, y, 5, 1, pal.d);
            fill(x, y, 1, 17, pal.d);
            fill(x - 3, y + 17, 7, 4, pal.T);
            fill(x - 2, y + 21, 5, 1, pal.T);
            break;
        case 'tv':
            fill(x - 8, y, 16, 6, pal.N); fill(x - 7, y + 2, 6, 3, pal.m); fill(x + 1, y + 2, 6, 3, pal.m);
            fill(x - 6, y + 6, 12, 9, pal.k);
            fill(x - 5, y + 7, 10, 7, '#2b3a55');
            dot(x + 3, y + 12, pal.s);
            break;
        case 'plant':
            fill(x - 2, y, 5, 4, pal.n); fill(x - 3, y + 4, 7, 1, pal.N);
            for (let i = 0; i < 14; ++i)
                dot(x - 3 + (decoRand()*7|0), y + 5 + (decoRand()*7|0), decoRand() < .5 ? pal.G : pal.g);
            break;
    }
}

///////////////////////////////////////////////////////////////////////////////
// sounds

const sndSpray   = new SoundGenerator({shape:4, frequency:1800, attack:.02, release:.1, volume:.08});
const sndChop    = new SoundGenerator({frequency:180, release:.12, slide:-.5, noise:.4, volume:.6});
const sndBreak   = new SoundGenerator({shape:4, bitCrush:.5, sustain:.1, release:.35, sustainVolume:.5, volume:.6});
const sndSizzle  = new SoundGenerator({shape:4, frequency:2500, slide:-2, release:.3, volume:.25});
const sndRefill  = new SoundGenerator({frequency:300, slide:.4, release:.08, volume:.18});
const sndHurt    = new SoundGenerator({frequency:220, release:.18, slide:-.4, noise:.1, volume:.5});
const sndIgnite  = new SoundGenerator({frequency:90, sustain:.1, release:.4, noise:4, bitCrush:.3, volume:.3});
const sndEmpty   = new SoundGenerator({frequency:140, release:.08, volume:.3, shapeCurve:0});
const sndWin     = new SoundGenerator({frequency:440, release:.4, slide:.3, repeatTime:.1, pitchJump:220, volume:.5});
const sndLever   = new SoundGenerator({frequency:520, release:.12, slide:-.6, noise:.1, volume:.5});
const sndLose    = new SoundGenerator({frequency:260, slide:-.5, release:.8, bitCrush:.2, volume:.5});

///////////////////////////////////////////////////////////////////////////////
// game state

let gameState = 'title';     // title | entry | play | won | lost
let playerCount = 1;
let entryFloor = 0;          // chosen way in: 0 front door, 1..FLOORS-1 window, FLOORS roof
let players = [];
let collisionLayer;
let breakables = [];         // doors + debris
let ladders = [];
let standpipes = [];
let ledges = [];             // burning shelves 3 tiles up {f, c0, c1, y, cells}
let rubbles = [];            // 2P: steel barricades 3 tiles tall {f, x, y, far, burn, opening, open}
let levers = [];             // 2P: {x, y, f, boostX, ledge|rubble, pulled}
let fireGrid = [];           // [floor][col] -> cell
let playTime = 0;
let endTimer = 0;
let camX = BLD_X + BLD_W/2;
let backgroundTile;

///////////////////////////////////////////////////////////////////////////////
// controls

const CONTROLS_SOLO =
{
    label: 'P1',
    dir:   ()=> keyDirection('KeyW','KeyS','KeyA','KeyD').add(keyDirection()).clampLength(),
    jump:  ['KeyW','ArrowUp','Space'],
};
const CONTROLS_P1 =
{
    label: 'P1',
    dir:   ()=> keyDirection('KeyW','KeyS','KeyA','KeyD'),
    jump:  ['KeyW'],
};
const CONTROLS_P2 =
{
    label: 'P2',
    dir:   ()=> keyDirection(),
    jump:  ['ArrowUp'],
};
const anyPressed = (keys)=> keys.some(k=> keyWasPressed(k));

///////////////////////////////////////////////////////////////////////////////
// building construction (collision + dynamic parts)

function setTile(x, y, data) { collisionLayer.setCollisionData(vec2(x, y), data); }
function getTile(x, y) { return collisionLayer.getCollisionData(vec2(x, y)); }

function buildWorld()
{
    collisionLayer = new TileCollisionLayer(vec2(), vec2(GRID_W, GRID_H), null);
    collisionLayer.render = ()=> {}; // the background texture draws the building
    breakables = [];
    fireGrid = [];
    ledges = [];
    rubbles = [];
    levers = [];
    ladders = [...ladderSpots];
    standpipes = pipeSpots.map(p=> ({...p, reserve: 180, max: 180}));

    // ground + world edges
    for (let x = 0; x < GRID_W; ++x)
        setTile(x, 0, T_SOLID), setTile(x, 1, T_SOLID);
    for (let y = 0; y < GRID_H; ++y)
        setTile(0, y, T_SOLID), setTile(GRID_W-1, y, T_SOLID);

    // floor slabs (floors 1+) and roof
    for (let f = 1; f <= FLOORS; ++f)
    for (let x = BLD_X; x < BLD_X + BLD_W; ++x)
        setTile(x, floorY(f)-1, T_SOLID);

    // outer walls
    for (let y = 2; y < floorY(FLOORS); ++y)
    {
        setTile(BLD_X, y, T_SOLID);
        setTile(BLD_X + BLD_W - 1, y, T_SOLID);
    }

    // front door on the ground floor
    addBreakable('door', BLD_X, floorY(0), 1, 3, 4);

    // upper floor windows on the same wall (aerial ladder entries) + roof hatch
    for (let f = 1; f < FLOORS; ++f)
        addBreakable('window', BLD_X, floorY(f), 1, 3, 2);
    const hatch = ladderSpots[FLOORS-1];
    addBreakable('hatch', hatch.x, hatch.y1, 1, 1, 2);

    // the truck's aerial ladder: street to roof, a 2 tile landing at every
    // upper floor window and at the roof edge
    const aerial = {x: BLD_X - 2, y0: floorY(0), y1: floorY(FLOORS), outside: true};
    ladders.push(aerial);
    for (let f = 1; f <= FLOORS; ++f)
        setTile(aerial.x, floorY(f) - 1, T_PLATFORM), setTile(aerial.x + 1, floorY(f) - 1, T_PLATFORM);

    for (let f = 0; f < FLOORS; ++f)
    {
        const plan = FLOOR_PLANS[f];
        const y0 = floorY(f);

        const row = [];
        for (let c = 0; c < BLD_W; ++c)
            row.push({heat:0, burnt:0, wall: c == 0 || c == BLD_W-1, emitter:undefined});
        fireGrid.push(row);

        // interior walls with doors / open doorways
        for (const [wx, state] of plan.walls)
        {
            const x = BLD_X + wx;
            row[wx].wall = true;
            for (let y = y0 + 3; y < y0 + FLOOR_H - 1; ++y)
                setTile(x, y, T_SOLID);
            if (state == 'closed')
                addBreakable('door', x, y0, 1, 3, 3);
        }

        for (const dx of plan.debris)
            addBreakable('debris', BLD_X + dx, y0, 2, 3, 2);
    }

    // ladder tops are one-way platforms
    for (const l of ladders)
        setTile(l.x, l.y1 - 1, T_PLATFORM);

    placeCoopSpots();
}

///////////////////////////////////////////////////////////////////////////////
// co-op spots: everything sits 3 tiles up, out of reach of a solo jump (~2.4)
// but not of a jump off a partner's head (~3.3, capped by the ceiling)

const shuffled = (a)=> a.map(v=> [rand(), v]).sort((p, q)=> p[0] - q[0]).map(p=> p[1]);

// columns (relative to BLD_X) on floor f that co-op spots must stay clear of
function coopBlocked(f)
{
    const plan = FLOOR_PLANS[f];
    const out = new Set([0, 1, 2, BLD_W-1]); // entry door/window and outer walls
    const mark = (c, r)=> { for (let i = -r; i <= r; ++i) out.add(c + i); };
    for (const [wx] of plan.walls) mark(wx, 0);
    mark(plan.ladder, 1);
    f && mark(FLOOR_PLANS[f-1].ladder, 1);
    plan.pipe && mark(plan.pipe, 3);
    for (const dx of plan.debris) mark(dx, 1), mark(dx + 1, 1);
    return out;
}

function placeCoopSpots()
{
    const floors = shuffled([0, 1, 2, 3]);
    if (playerCount == 1)
    {
        // solo: 1 or 2 ledges with their ladders already down, no barricades
        let count = rand() < .5 ? 2 : 1;
        for (const f of floors)
            count && placeLedge(f) && --count;
        return;
    }

    // 2P: 2 or 3 spots on different floors, at least one of each kind;
    // each spot takes the first free floor it fits on
    const kinds = shuffled(['ledge', 'rubble']);
    rand() < .5 && kinds.push(rand() < .5 ? 'ledge' : 'rubble');
    for (const kind of kinds)
    {
        const f = floors.find(f=> (kind == 'ledge' ? placeLedge : placeRubble)(f));
        f !== undefined && floors.splice(floors.indexOf(f), 1);
    }
}

// a shelf against one wall of a room; in 2P the lever at the wall end drops a
// ladder down the open end, solo starts with that ladder down
function placeLedge(f)
{
    const W = 7, blocked = coopBlocked(f), options = [];
    for (const room of rooms[f])
    {
        const r0 = room.x0 - BLD_X, r1 = room.x1 - BLD_X;
        if (r1 - r0 < W + 4) continue;
        options.push({c0: r0, c1: r0 + W, lever: r0, ladder: r0 + W - 1, boost: r0 + W});
        options.push({c0: r1 - W, c1: r1, lever: r1 - 1, ladder: r1 - W, boost: r1 - W - 1});
    }
    const valid = options.filter(o=> ![...Array(o.c1 - o.c0 + 1)].some((_, i)=> blocked.has(min(o.c0, o.boost) + i)));
    if (!valid.length) return false;
    const o = valid[randInt(valid.length)];

    const y = floorY(f) + 3;
    const ledge = {f, c0: o.c0, c1: o.c1, y, ladderX: BLD_X + o.ladder,
        cells: [...Array(BLD_W)].map((_, c)=> ({heat:0, burnt:0, wall: c < o.c0 || c >= o.c1, emitter:undefined}))};
    for (let c = o.c0; c < o.c1; ++c)
        setTile(BLD_X + c, y - 1, T_SOLID);
    ledges.push(ledge);
    if (playerCount == 1)
        dropLedgeLadder(ledge);
    else
        levers.push({x: BLD_X + o.lever + .5, y, f, boostX: BLD_X + o.boost + .5, ledge, pulled: false});
    return true;
}

// a 2 wide steel barricade between where you arrive on the floor and the far
// side, where its lever is
function placeRubble(f)
{
    const blocked = coopBlocked(f), options = [];
    const arrive = f ? FLOOR_PLANS[f-1].ladder : 1;
    for (let rc = 3; rc < BLD_W - 5; ++rc)
    {
        if (abs(rc - arrive) < 5) continue;
        const far = rc > arrive ? 1 : -1;
        if (!roomsBehind(fireRooms(f), BLD_X + rc, far).length) continue; // a fire must be able to start behind it
        let clear = true;
        for (let c = rc - 2; c <= rc + 3; ++c)
            clear &&= !blocked.has(c);
        clear && options.push({rc, far});
    }
    if (!options.length) return false;
    const {rc, far} = options[randInt(options.length)];

    const y = floorY(f);
    const rubble = {f, x: BLD_X + rc, y, far, burn: 0, opening: 0, open: false};
    for (let c = rc; c < rc + 2; ++c)
    {
        for (let j = 0; j < 3; ++j)
            setTile(BLD_X + c, y + j, T_RUBBLE);
        fireGrid[f][c].wall = true;
        fireGrid[f][c].rubble = rubble;
    }
    rubbles.push(rubble);
    levers.push({x: BLD_X + (far > 0 ? rc + 3 : rc - 2) + .5, y, f,
        boostX: BLD_X + (far > 0 ? rc - 1 : rc + 2) + .5, rubble, pulled: false});
    return true;
}

function pullLever(lever)
{
    lever.pulled = true;
    sndLever.play(vec2(lever.x, lever.y));
    addScreenShake(.1, .15);
    if (lever.ledge)
        dropLedgeLadder(lever.ledge);
    else
        lever.rubble.opening = .5; // rattles, then rolls up
}

// a ladder down the open end of the shelf
function dropLedgeLadder(l)
{
    setTile(l.ladderX, l.y - 1, T_PLATFORM);
    ladders = [...ladders, {x: l.ladderX, y0: floorY(l.f), y1: l.y, dropped: true}];
}

function updateCoopSpots()
{
    for (const r of rubbles)
    {
        if (r.opening <= 0 || (r.opening -= timeDelta) > 0) continue;
        r.open = true;
        for (let c = 0; c < 2; ++c)
        {
            for (let j = 0; j < 3; ++j)
                setTile(r.x + c, r.y + j, 0);
            const cell = fireGrid[r.f][r.x + c - BLD_X];
            cell.wall = false;
            cell.rubble = undefined;
        }
        sndBreak.play(vec2(r.x + 1, r.y));
        breakBurst(vec2(r.x + 1, r.y + 1.5), vec2(2, 3), palColor('y'));
    }
}

function addBreakable(type, x, y, w, h, hp)
{
    const b = {type, x, y, w, h, hp, maxHp: hp, burn: 0, shake: 0,
        pos: vec2(x + w/2, y + h/2), size: vec2(w, h)};
    for (let i = 0; i < w; ++i)
    for (let j = 0; j < h; ++j)
        setTile(x+i, y+j, type == 'door' ? T_DOOR : T_DEBRIS);
    breakables.push(b);
}

function breakBreakable(b)
{
    for (let i = 0; i < b.w; ++i)
    for (let j = 0; j < b.h; ++j)
        setTile(b.x+i, b.y+j, 0);
    breakables.splice(breakables.indexOf(b), 1);
    sndBreak.play(b.pos);
    breakBurst(b.pos, b.size, b.type == 'door' ? palColor('n') : palColor('S'));
}

function breakBurst(pos, size, a)
{
    addScreenShake(.25, .25);
    const c = palColor('N');
    new ParticleEmitter(pos, 0, size, .1, 200, PI, undefined,
        a, c, a.scale(1,0), c.scale(1,0),
        .8, .25, .25, .15, 0, .97, 1, 1, PI, .1, .5, true);
}

const breakableAt = (x, y)=> breakables.find(b=> x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h);

///////////////////////////////////////////////////////////////////////////////
// fire simulation

// fire cell at a world position; base is the surface it burns on
function cellAt(pos)
{
    const c = floor(pos.x) - BLD_X;
    for (const ledge of ledges)
        if (c >= ledge.c0 && c < ledge.c1 && pos.y >= ledge.y - .2 && pos.y < ledge.y + 2)
            return {cell: ledge.cells[c], f: ledge.f, c, ledge, base: ledge.y};
    const f = floor((pos.y - 2) / FLOOR_H);
    if (f < 0 || f >= FLOORS || c < 0 || c >= BLD_W) return;
    return {cell: fireGrid[f][c], f, c, base: floorY(f)};
}

function ignite(f, c, heat=.12, ledge)
{
    const cell = (ledge ? ledge.cells : fireGrid[f])?.[c];
    if (!cell || cell.wall || cell.heat > 0) return false;
    cell.heat = heat;
    const pos = vec2(BLD_X + c + .5, ledge ? ledge.y + 1.2 : floorY(f) + 2);
    cell.emitter = new ParticleEmitter(pos, 0, vec2(.8, .6), 0, 4, .4, undefined,
        palColor('D', .8), palColor('e', .8), palColor('k', 0), palColor('D', 0),
        1.4, .4, 1, .03, 0, .99, 1, -.08, 0, .3, .3);
    cell.emitter.renderOrder = 12;
    return true;
}

function extinguish(cell)
{
    cell.heat = 0;
    if (cell.emitter)
    {
        cell.emitter.destroy(); // existing smoke drifts away first
        cell.emitter = undefined;
    }
}

// can fire pass between column c and c+dir on floor f? handles walls + doors
function fireNeighbor(f, c, dir, heat)
{
    let n = c + dir;
    const row = fireGrid[f];
    if (n <= 0 || n >= BLD_W-1) return;
    const rubble = row[n].rubble;
    if (rubble)
    {
        // steel barricades slowly let fire through to the other side
        rubble.burn += heat * timeDelta;
        if (rubble.burn < FIRE_DOOR_BURN * .6) return;
        rubble.burn = 0;
        while (row[n].rubble) n += dir;
        return row[n].wall ? undefined : n;
    }
    if (!row[n].wall) return n;

    // interior wall column: check doorway at floor level
    const x = BLD_X + n, y = floorY(f);
    const door = breakableAt(x, y);
    if (door)
    {
        // closed doors slowly burn through
        door.burn += heat * timeDelta;
        if (door.burn > FIRE_DOOR_BURN)
            breakBreakable(door);
        return;
    }
    if (getTile(x, y)) return; // solid wall
    return n + dir;            // open doorway
}

// heat up and char a burning cell; fires never burn out, the char is only damage
function burnCell(cell)
{
    cell.heat = min(1, cell.heat + timeDelta * FIRE_GROW);
    cell.burnt = min(1, cell.burnt + cell.heat * timeDelta / 50);
    if (cell.emitter)
        cell.emitter.emitRate = 2 + cell.heat * 6;
}

function updateFire()
{
    for (let f = 0; f < FLOORS; ++f)
    for (let c = 0; c < BLD_W; ++c)
    {
        const cell = fireGrid[f][c];
        if (cell.heat <= 0) continue;
        burnCell(cell);

        // spread sideways
        if (cell.heat > FIRE_SPREAD_HEAT)
        for (const dir of [-1, 1])
        {
            const n = fireNeighbor(f, c, dir, cell.heat);
            if (n !== undefined && rand() < FIRE_SPREAD_RATE * timeDelta)
                ignite(f, n);
        }
    }

    // ledges: spread along the shelf and drip down onto the floor
    for (const ledge of ledges)
    for (let c = ledge.c0; c < ledge.c1; ++c)
    {
        const cell = ledge.cells[c];
        if (cell.heat <= 0) continue;
        burnCell(cell);
        if (cell.heat > FIRE_SPREAD_HEAT)
        for (const dir of [-1, 1])
            rand() < FIRE_SPREAD_RATE * timeDelta && ignite(ledge.f, c + dir, .12, ledge);
        if (cell.heat > .8 && rand() < FIRE_DRIP_RATE * timeDelta)
            ignite(ledge.f, c) && sndIgnite.play(vec2(BLD_X + c, floorY(ledge.f)));
    }
}

function fireStats()
{
    let burning = 0, burnt = 0, total = 0;
    for (const row of [...fireGrid, ...ledges.map(l=> l.cells)])
    for (const cell of row)
    {
        if (cell.wall) continue;
        ++total;
        burnt += cell.burnt;
        cell.heat > 0 && ++burning;
    }
    return {burning, integrity: 1 - burnt / total};
}

// rooms a floor's fire can start in: never the entry room or a standpipe's walled in room
function fireRooms(f)
{
    const pipe = pipeSpots.find(p=> p.y == floorY(f));
    return rooms[f].slice(1).filter(r=> !pipe || pipe.x < r.x0 || pipe.x >= r.x1);
}

// rooms on the far side of a 2 wide barricade at x
const roomsBehind = (floorRooms, x, far)=> floorRooms.filter(r=> far > 0 ? r.x0 > x + 2 : r.x1 <= x);

function startFires()
{
    // one fire per floor, upper floors bigger
    for (let f = 0; f < FLOORS; ++f)
    {
        let floorRooms = fireRooms(f);
        // a floor with a barricade starts burning behind it
        const rubble = rubbles.find(r=> r.f == f);
        if (rubble)
            floorRooms = roomsBehind(floorRooms, rubble.x, rubble.far);
        const room = floorRooms[randInt(floorRooms.length)];
        const c = (room.x0 + room.x1) / 2 - BLD_X | 0;
        const size = 2 + f;
        for (let i = 0; i < size; ++i)
        {
            const col = c + i - (size>>1);
            breakableAt(BLD_X + col, floorY(f)) || ignite(f, col, rand(.3, .7)); // debris starts clear of fire
        }
    }

    // every ledge starts with a fire on it
    for (const ledge of ledges)
    {
        const c = (ledge.c0 + ledge.c1) / 2 | 0;
        for (let i = -1; i <= 1; ++i)
            ignite(ledge.f, c + i, rand(.3, .6), ledge);
    }
}

///////////////////////////////////////////////////////////////////////////////
// water drop

class Drop extends EngineObject
{
    constructor(pos, velocity)
    {
        super(pos, vec2(.18));
        this.velocity = velocity;
        this.gravityScale = .45;
        this.collideTiles = true;
        this.life = 1.4;
        this.hit = false;
        this.renderOrder = 6;
    }

    collideWithTile(data, pos)
    {
        if (data == T_PLATFORM) return false;
        this.hit = true;
        return true;
    }

    update()
    {
        // douse fire this drop is passing through
        const at = cellAt(this.pos);
        if (at && at.cell.heat > 0)
        {
            const flameTop = at.base + .6 + at.cell.heat * 2.8;
            if (this.pos.y < flameTop)
            {
                douse(at.f, at.c, .08, at.ledge);
                douse(at.f, at.c - 1, .025, at.ledge);
                douse(at.f, at.c + 1, .025, at.ledge);
                this.splash(palColor('s', .8));
                return this.destroy();
            }
        }

        this.life -= timeDelta;
        if (this.hit || this.life < 0)
        {
            this.splash(palColor('b', .9));
            this.destroy();
        }
    }

    splash(color)
    {
        if (rand() < .3)
        new ParticleEmitter(this.pos, 0, .2, .05, 60, PI, undefined,
            color, color, color.scale(1,0), color.scale(1,0),
            .35, .13, .13, .06, 0, .95, 1, 1);
    }

    render()
    {
        const p = vec2(Math.round(this.pos.x * PX), Math.round(this.pos.y * PX)).scale(1/PX);
        drawRect(p, vec2(3, 2).scale(1/PX), palColor('b'));
        drawRect(p.add(vec2(0, .5/PX)), vec2(2, 1).scale(1/PX), palColor((this.spawnTime * 60 | 0) % 2 ? 'c' : 'w'));
    }
}

function douse(f, c, amount, ledge)
{
    const cell = (ledge ? ledge.cells : fireGrid[f])?.[c];
    if (!cell || cell.heat <= 0) return;
    cell.heat -= amount;
    if (cell.heat <= 0)
    {
        extinguish(cell);
        sndSizzle.play(vec2(BLD_X + c, ledge ? ledge.y : floorY(f)));
    }
}

///////////////////////////////////////////////////////////////////////////////
// firefighter

class Firefighter extends EngineObject
{
    constructor(pos, controls, index)
    {
        super(pos, vec2(.8, 1.7));
        this.controls = controls;
        this.index = index;
        this.coatColor = palColor(index ? 'b' : 'r');
        this.collideTiles = true;
        this.renderOrder = 5;
        this.water = 100;
        this.hp = 100;
        this.facing = 1;
        this.climbing = false;
        this.sprayTimer = 0;
        this.hissTimer = 0;
        this.axeCooldown = 0;
        this.swingTime = 0;
        this.downTimer = 0;
        this.hurtFlash = 0;
        this.refilling = false;
        this.refillFrom = vec2();
        this.refillGlow = 0;
        this.refillDrops = []; // stream particles flying from the refill source to the body
        this.prevBottom = this.pos.y - this.size.y/2;
        this.walkCycle = 0;
        this.standingOn = undefined; // partner whose head this one stands on
        this.onGround = false;
    }

    collideWithTile(data, pos)
    {
        if (data == T_PLATFORM)
            return !this.climbing && this.prevBottom >= pos.y + 1 - .02;
        return data > 0;
    }

    ladderHere()
    {
        const bottom = this.pos.y - this.size.y/2;
        return ladders.find(l=> abs(this.pos.x - (l.x + .5)) < .6 && bottom >= l.y0 - .05 && bottom <= l.y1 + .1);
    }

    // stacking (2P): a partner's head is a one-way platform, landing on it from
    // above stands there; nobody gets carried, so walk away and the rider drops
    standOnPartner()
    {
        const bottom = this.pos.y - this.size.y/2;
        this.standingOn = this.downTimer > 0 || this.climbing || this.velocity.y > 0 ? undefined :
            players.find(o=> o != this && o.downTimer <= 0 && !o.climbing && abs(this.pos.x - o.pos.x) < .7 &&
                this.prevBottom >= o.pos.y + o.size.y/2 - .1 && bottom < o.pos.y + o.size.y/2 + .05);
        if (this.standingOn)
        {
            this.pos.y = this.standingOn.pos.y + this.standingOn.size.y/2 + this.size.y/2;
            this.velocity.y = 0;
        }
        this.onGround = !!(this.groundObject || this.standingOn);
    }

    // direction (+1/-1) of a burning tile within hose range on this floor (or
    // ledge), 0 if none; walking only checks ahead, standing still also checks behind
    fireInRange(moveX)
    {
        const bottom = this.pos.y - this.size.y/2;
        const c = floor(this.pos.x) - BLD_X;
        const dirs = moveX ? [Math.sign(moveX)] : [this.facing, -this.facing];
        const scan = (row, tileY, stopAtWall)=>
        {
            for (const dir of dirs)
            for (let d = 0; d <= SPRAY_RANGE; ++d)
            {
                const col = c + d*dir;
                if (col < 0 || col >= BLD_W) break;
                const tile = getTile(BLD_X + col, tileY);
                if (d && (tile && tile != T_PLATFORM || stopAtWall && row[col].wall)) break; // walls, doors, debris and ledge ends block the hose
                if (row[col].heat > 0) return dir;
            }
            return 0;
        };

        const ledge = ledges.find(l=> c >= l.c0 && c < l.c1 && bottom >= l.y - .1 && bottom - l.y < 1.5);
        if (ledge)
            return scan(ledge.cells, ledge.y + 1, true);

        // jumping up beside a ledge (only a boost off a partner's head gets this
        // high) sprinkles the near edge before committing to land in the fire
        if (!this.onGround && !this.climbing)
        for (const l of ledges)
        {
            if (bottom < l.y - .5 || bottom > l.y + 1.5) continue;
            const dir = scan(l.cells, l.y + 1, false);
            if (dir) return dir;
        }

        const f = floor((bottom + .1 - 2) / FLOOR_H);
        if (f < 0 || f >= FLOORS || bottom - floorY(f) > (this.standingOn ? 1.8 : 1.5)) return 0;
        return scan(fireGrid[f], floorY(f) + 1, false);
    }

    update()
    {
        this.standOnPartner();
        this.prevBottom = this.pos.y - this.size.y/2;
        this.hurtFlash = max(0, this.hurtFlash - timeDelta);
        this.swingTime = max(0, this.swingTime - timeDelta);
        this.axeCooldown = max(0, this.axeCooldown - timeDelta);

        // refill stream + glow (keeps animating while knocked out or after the round)
        this.refillGlow = clamp(this.refillGlow + (this.refilling ? 5 : -3) * timeDelta);
        for (const d of this.refillDrops) d.t += d.speed * timeDelta;
        this.refillDrops = this.refillDrops.filter(d=> d.t < 1);
        this.refilling = false;

        if (this.downTimer > 0)
        {
            // knocked out: wait, then respawn at the truck
            this.velocity = vec2();
            this.gravityScale = 0;
            this.downTimer -= timeDelta;
            if (this.downTimer <= 0)
            {
                this.pos = vec2(TRUCK_X + 4, 3);
                this.hp = 100;
                this.gravityScale = 1;
            }
            return;
        }

        if (gameState != 'play')
        {
            this.velocity.x *= .8;
            return;
        }

        const ctl = this.controls;
        const dir = ctl.dir();
        if (dir.x) this.facing = Math.sign(dir.x);

        // ladders
        const ladder = this.ladderHere();
        if (!this.climbing && ladder && dir.y)
        {
            // grab on when pressing up from below, or down from the top
            const bottom = this.pos.y - this.size.y/2;
            if (dir.y > 0 && bottom < ladder.y1 - .2 || dir.y < 0)
                this.climbing = true;
        }
        if (this.climbing && (!ladder || dir.x && !dir.y))
            this.climbing = false;

        if (this.climbing)
        {
            this.gravityScale = 0;
            this.velocity = vec2((ladder.x + .5 - this.pos.x) * .3, dir.y * .11);
            this.walkCycle += abs(dir.y) * .25;
        }
        else
        {
            this.gravityScale = 1;
            const target = dir.x * .13;
            this.velocity.x = lerp(this.velocity.x, target, this.onGround ? .35 : .12);
            // whoever has a partner on their head stays planted
            const carrying = players.some(p=> p.standingOn == this);
            if (this.onGround && !carrying && anyPressed(ctl.jump))
                this.velocity.y = .3;
            if (this.onGround)
                this.walkCycle += abs(this.velocity.x) * 1.4;
        }

        // walk into a lever to pull it
        const lever = !this.climbing && levers.find(l=> !l.pulled &&
            abs(this.pos.x - l.x) < .7 && abs(this.pos.y - this.size.y/2 - l.y) < .6);
        lever && pullLever(lever);

        // auto chop: pressing up against a door or debris swings the axe
        if (!this.climbing && this.axeCooldown <= 0)
        {
            const touchPos = this.pos.add(vec2(this.facing * (this.size.x/2 + .15), 0));
            const target = breakables.find(b=> isOverlapping(touchPos, vec2(.3, 1.2), b.pos, b.size));
            if (target)
            {
                this.axeCooldown = .38;
                this.swingTime = .22;
                sndChop.play(target.pos);
                target.shake = .2;
                addScreenShake(.08, .1);
                if (--target.hp <= 0)
                    breakBreakable(target);
            }
        }

        // auto spray: fire in range on this floor turns the hose on
        const fireDir = this.swingTime > 0 || this.climbing ? 0 : this.fireInRange(dir.x);
        if (fireDir)
        {
            this.facing = fireDir;
            if (this.water > 0)
            {
                this.sprayTimer -= timeDelta;
                while (this.sprayTimer < 0)
                {
                    this.sprayTimer += 1/30;
                    // random power: weak drops dip down onto fires right in front,
                    // strong ones arc out to full range
                    const nozzle = this.pos.add(vec2(this.facing * .75, .1));
                    const power = rand();
                    new Drop(nozzle, vec2(this.facing * lerp(.16, .46, power) + this.velocity.x * .5,
                        lerp(-.05, .08, power) + rand(-.02, .02)));
                }
                this.water = max(0, this.water - 7 * timeDelta);
                if ((this.hissTimer -= timeDelta) < 0)
                    this.hissTimer = .12, sndSpray.play(this.pos);
            }
            else if ((this.hissTimer -= timeDelta) < 0)
                this.hissTimer = .6, sndEmpty.play(this.pos);
        }

        // refill at truck or standpipe
        if (this.water < 100)
        {
            if (abs(this.pos.x - TRUCK_X) < 5 && this.pos.y < 4)
            {
                this.water = min(100, this.water + 45 * timeDelta);
                this.refilling = true;
                this.refillFrom = vec2(TRUCK_X - 3.5, 5.2); // the tank, under the sign mast
            }
            else
            {
                const pipe = standpipes.find(p=> p.reserve > 0 && abs(this.pos.x - p.x) < 3 && abs(this.pos.y - this.size.y/2 - p.y) < .5);
                if (pipe)
                {
                    const amount = min(35 * timeDelta, 100 - this.water, pipe.reserve);
                    this.water += amount;
                    pipe.reserve -= amount;
                    this.refilling = true;
                    this.refillFrom = vec2(pipe.x, pipe.y + 1.5); // the valve
                }
            }
            if (this.refilling && frame % 8 == 0)
                sndRefill.play(this.pos, .5, 1 + this.water/100);
            if (this.refilling && rand() < .6)
                this.refillDrops.push({from: this.refillFrom, t: 0, wobble: rand(-.4, .4), speed: rand(2, 3)});
        }

        // fire hurts
        let burning = 0;
        for (const dx of [-.3, .3])
        {
            const at = cellAt(vec2(this.pos.x + dx, this.pos.y - .5));
            if (at && at.cell.heat > .35 && this.pos.y - this.size.y/2 < at.base + at.cell.heat * 2.5)
                burning = max(burning, at.cell.heat);
        }
        if (burning)
        {
            this.hp -= burning * 30 * timeDelta;
            if (this.hurtFlash <= 0)
                this.hurtFlash = .25, sndHurt.play(this.pos);
            if (this.hp <= 0)
            {
                this.hp = 0;
                this.downTimer = 3;
                this.climbing = false;
                addScreenShake(.3, .3);
            }
        }
        else
            this.hp = min(100, this.hp + 5 * timeDelta);
    }

    render()
    {
        const p = 'p' + this.index + '_';
        const feet = vec2(this.pos.x, this.pos.y - this.size.y/2);
        const mirror = this.facing < 0;
        const tint = this.hurtFlash > 0 && (time*20|0) % 2 ? rgb(1,.5,.4) : WHITE;
        // pulsing blue glow while refilling (additive, so alpha stays 0)
        const glow = this.refillGlow > 0 ? rgb(.1,.3,.6,0).scale(this.refillGlow * (.75 + .25*Math.sin(time*14)), 0) : undefined;

        if (this.downTimer > 0)
            return drawSprite(p + 'down', feet, mirror);

        if (this.climbing)
            drawSprite(p + 'climb', feet, (this.walkCycle|0) % 2 == 1, tint, glow);
        else if (this.swingTime > 0)
        {
            drawSprite(p + 'chop', feet, mirror, tint, glow);
            drawSprite(this.swingTime > .11 ? 'axeUp' : 'axeDown', feet, mirror);
        }
        else
        {
            const walking = !this.onGround || abs(this.velocity.x) > .02 && (this.walkCycle|0) % 2;
            drawSprite(p + (walking ? 'walk' : 'idle'), feet, mirror, tint, glow);
        }

        // refill stream: each drop arcs from the source into the body
        const body = this.pos.add(vec2(0, .1));
        for (const d of this.refillDrops)
        {
            const a = d.from, t = d.t;
            const mid = a.add(body).scale(.5).add(vec2(d.wobble, 1 + a.distance(body) * .15));
            const pos = a.scale((1-t)*(1-t)).add(mid.scale(2*(1-t)*t)).add(body.scale(t*t));
            const snapped = vec2(Math.round(pos.x * PX), Math.round(pos.y * PX)).scale(1/PX);
            drawRect(snapped, vec2(2/PX), palColor(t > .75 ? 'w' : d.speed > 2.5 ? 'c' : 'b'));
        }
    }
}

///////////////////////////////////////////////////////////////////////////////
// fire layer (drawn above the player so they appear engulfed)

class FireLayer extends EngineObject
{
    constructor()
    {
        super(vec2(GRID_W/2, GRID_H/2), vec2());
        this.mass = 0;
        this.renderOrder = 10;
    }

    render()
    {
        const rows = [...fireGrid.map((cells, f)=> ({cells, base: floorY(f)})), ...ledges.map(l=> ({cells: l.cells, base: l.y}))];
        for (const {cells, base} of rows)
        for (let c = 0; c < BLD_W; ++c)
        {
            const cell = cells[c];
            if (cell.heat <= 0) continue;
            const x = BLD_X + c + .5;
            const size = cell.heat < .35 ? 0 : cell.heat < .7 ? 1 : 2;
            const anim = (time * 9 + c * 7) % 3 | 0;
            drawSprite('fire' + size + '_' + anim, vec2(x, base), c % 2 == 1);

            // embers rising off big fires
            if (cell.heat > .6)
            {
                const t = (time*.7 + c*.37) % 1;
                const ex = Math.round((x + Math.sin(c + time*3)*.4) * PX) / PX;
                const ey = Math.round((base + 2.8 + t*1.6) * PX) / PX;
                drawRect(vec2(ex, ey), vec2(1/PX), palColor(t < .5 ? 'Y' : 'o', 1-t));
            }
        }
    }
}

///////////////////////////////////////////////////////////////////////////////
// game flow

function startGame(count)
{
    engineObjectsDestroy();
    playerCount = count;
    buildWorld();
    new FireLayer();
    startFires();
    players = [];
    playTime = 0;
    endTimer = 0;
    gameState = 'entry'; // fires wait while the player picks a way in
}

const entryName = (f)=> f == 0 ? 'GROUND FLOOR' : f == FLOORS ? 'ROOF' : (f+1) + ['ST','ND','RD','TH'][min(f, 3)] + ' FLOOR';
const entryInfo = (f)=> f == 0 ? 'FRONT DOOR, NEXT TO THE TRUCK' : f == FLOORS ? 'DROP ON THE ROOF, CHOP THE HATCH' :
    'AERIAL LADDER TO A WINDOW, CHOP IT OPEN';

function enterBuilding(f)
{
    let pos = vec2(TRUCK_X + 4, 3);
    if (f == FLOORS)
        pos = vec2(BLD_X + 4, floorY(f) + 3); // dropped onto the roof
    else if (f > 0)
        pos = vec2(BLD_X - 1.5, floorY(f) + 1); // on the aerial ladder's landing
    players = playerCount == 1 ?
        [new Firefighter(pos, CONTROLS_SOLO, 0)] :
        [new Firefighter(pos.add(vec2(-.5, 0)), CONTROLS_P1, 0),
         new Firefighter(pos.add(vec2(.5, 0)), CONTROLS_P2, 1)];
    gameState = 'play';
}

function gameInit()
{
    setGravity(vec2(0, -.018));
    setCameraScale(PX);
    backgroundTile = new TileInfo(vec2(), vec2(GRID_W, BG_H).scale(PX), textureInfos[1]);
    buildWorld();
    new FireLayer();
    startFires();
}

function gameUpdate()
{
    if (gameState == 'title')
    {
        if (keyWasPressed('Digit1') || keyWasPressed('Numpad1')) startGame(1);
        if (keyWasPressed('Digit2') || keyWasPressed('Numpad2')) startGame(2);
        updateFire(); // the building smoulders behind the title
        return;
    }

    if (keyWasPressed('Escape'))
    {
        gameState = 'title';
        players = [];
        return;
    }

    if (gameState == 'entry')
    {
        if (keyWasPressed('KeyW') || keyWasPressed('ArrowUp'))
            entryFloor = min(FLOORS, entryFloor + 1);
        if (keyWasPressed('KeyS') || keyWasPressed('ArrowDown'))
            entryFloor = max(0, entryFloor - 1);
        if (keyWasPressed('Enter') || keyWasPressed('Space'))
            enterBuilding(entryFloor);
    }
    else if (gameState == 'play')
    {
        playTime += timeDelta;
        updateFire();
        updateCoopSpots();
        const stats = fireStats();
        if (stats.burning == 0)
            gameState = 'won', sndWin.play();
        else if (stats.integrity < .001) // lost only once the whole building is charred
            gameState = 'lost', sndLose.play();
    }
    else
    {
        endTimer += timeDelta;
        if (endTimer > .6 && (keyWasPressed('KeyR') || keyWasPressed('Space') || keyWasPressed('Enter')))
            startGame(playerCount);
    }
}

function gameUpdatePost()
{
    // fixed pixel scale; the camera only scrolls sideways
    setCameraScale(PX);
    const viewW = screenW / PX, viewH = screenH / PX;
    let target = BLD_X + BLD_W/2;
    if (players.length)
        target = players.reduce((sum, p)=> sum + p.pos.x, 0) / players.length;
    camX = lerp(camX, clamp(target, viewW/2, GRID_W - viewW/2), .1);

    // two players share one screen: nobody can walk off the edge
    if (players.length > 1)
    for (const p of players)
    {
        const lo = camX - viewW/2 + .6, hi = camX + viewW/2 - .6;
        if (p.pos.x < lo || p.pos.x > hi)
            p.pos.x = clamp(p.pos.x, lo, hi), p.velocity.x = 0;
    }

    const snapped = vec2(Math.round(camX * PX) / PX, viewH / 2);
    setCameraPos(snapped.add(_shakeOffset)); // keep gameFx screen shake
}

///////////////////////////////////////////////////////////////////////////////
// rendering

function gameRender()
{
    // sky above the background texture
    drawRect(vec2(GRID_W/2, BG_H + 10), vec2(GRID_W + 40, 20), palColor('k'));
    drawTile(vec2(GRID_W/2, BG_H/2), vec2(GRID_W, BG_H), backgroundTile);

    // charring + fire glow on the back walls
    for (let f = 0; f < FLOORS; ++f)
    {
        const y0 = floorY(f), h = FLOOR_H - 1;
        for (let c = 1; c < BLD_W-1; ++c)
        {
            const cell = fireGrid[f][c];
            if (cell.wall) continue;
            const pos = vec2(BLD_X + c + .5, y0 + h/2);
            if (cell.burnt > 0)
                drawRect(pos, vec2(1, h), palColor('k', min(.85, cell.burnt * .9)));
            if (cell.heat > 0)
                drawRect(pos, vec2(1, h), palColor('o', cell.heat * .14));
        }
    }

    // ledges: charring above the shelf, hanger rods, then the wooden shelf
    for (const l of ledges)
    {
        for (let c = l.c0; c < l.c1; ++c)
        {
            const cell = l.cells[c], pos = vec2(BLD_X + c + .5, l.y + 1);
            cell.burnt > 0 && drawRect(pos, vec2(1, 2), palColor('k', min(.85, cell.burnt * .9)));
            cell.heat > 0 && drawRect(pos, vec2(1, 2), palColor('o', cell.heat * .14));
        }
        const w = l.c1 - l.c0, mid = BLD_X + l.c0 + w/2;
        for (let c = l.c0 + 1; c < l.c1; c += 3)
            drawRect(vec2(BLD_X + c + .5, l.y + 1), vec2(1/PX, 2), palColor('D'));
        drawRect(vec2(mid, l.y - .5), vec2(w, 1), palColor('N'));
        drawRect(vec2(mid, l.y - 1.5/PX), vec2(w, 3/PX), palColor('n'));
        drawRect(vec2(mid, l.y - 1 + .5/PX), vec2(w, 1/PX), palColor('m'));
        for (let c = l.c0 + 2; c < l.c1; c += 2)
            drawRect(vec2(BLD_X + c, l.y - .5), vec2(1/PX, 1), palColor('m'));
    }

    // 2P steel barricades; once open, only the rolled up drum under the ceiling is left
    for (const r of rubbles)
    {
        if (r.open)
        {
            drawRect(vec2(r.x + 1, r.y + 4.65), vec2(2, .7), palColor('m'));
            drawRect(vec2(r.x + 1, r.y + 4.65), vec2(2 - 2/PX, .7 - 2/PX), palColor('S'));
            drawRect(vec2(r.x + 1, r.y + 4.6), vec2(2 - 2/PX, 1/PX), palColor('d'));
            continue;
        }
        const jitter = r.opening > 0 ? ((time*60|0) % 2 ? 1 : -1) / PX : 0;
        drawSprite('rubble', vec2(r.x + 1 + jitter, r.y));
    }

    // 2P levers, plus a blinking boost marker while a partner is close by
    for (const l of levers)
    {
        drawSprite(l.pulled ? 'leverOn' : 'lever', vec2(l.x, l.y), l.pulled);
        const near = players.some(p=> abs(p.pos.x - l.boostX) < 8 && abs(p.pos.y - p.size.y/2 - floorY(l.f)) < 2);
        if (!l.pulled && near && (time*3|0) % 2)
            drawSprite('boost', vec2(l.boostX, floorY(l.f) + 2.3 + (time*3 % 1) * .25));
    }

    // truck light bar
    const on = (time*4|0) % 2;
    drawRect(vec2(TRUCK_X + 2.6, 5.9), vec2(.5, .25), palColor(on ? 'r' : 'R'));
    drawRect(vec2(TRUCK_X + 3.4, 5.9), vec2(.5, .25), palColor(on ? 'B' : 'b'));
    // roof antenna beacon
    (time*1.5|0) % 2 && drawRect(vec2(BLD_X + 380/PX + 1/16, floorY(FLOORS) + 5.1), vec2(.25), palColor('r'));

    // standpipe gauges
    for (const p of standpipes)
    {
        const pct = p.reserve / p.max;
        drawRect(vec2(p.x + .75, p.y + 1.6), vec2(3, 18).scale(1/PX), palColor('k'));
        pct > 0 && drawRect(vec2(p.x + .75, p.y + 1.6 - (1 - pct) * 8/PX), vec2(1/PX, 16*pct/PX), palColor('c'));
    }

    // aerial ladder with its landings, and ladders dropped from ledges
    for (const l of ladders)
    {
        if (!l.outside && !l.dropped) continue;
        const h = l.y1 + 1 - l.y0;
        for (const dx of [1, 6])
            drawRect(vec2(l.x + (dx + .5)/PX, l.y0 + h/2), vec2(1/PX, h), palColor('s'));
        for (let y = l.y0 + 3/PX; y < l.y1 + 1; y += 4/PX)
            drawRect(vec2(l.x + .5, y + .5/PX), vec2(4/PX, 1/PX), palColor('S'));
        if (!l.outside) continue;
        for (let f = 1; f <= FLOORS; ++f)
        {
            drawRect(vec2(l.x + 1, floorY(f) - 1.5/PX), vec2(2, 3/PX), palColor('d'));
            drawRect(vec2(l.x + 1, floorY(f) - .5/PX), vec2(2, 1/PX), palColor('S'));
        }
    }

    // doors, windows, debris, roof hatch
    for (const b of breakables)
    {
        b.shake = max(0, b.shake - timeDelta);
        const jitter = b.shake > 0 ? ((time*60|0) % 2 ? 1 : -1) / PX : 0;
        const burn = clamp(b.burn / FIRE_DOOR_BURN);
        const tint = WHITE.lerp(rgb(.3,.2,.2), burn);
        const pos = vec2(b.x + b.w/2 + jitter, b.y);
        drawSprite(b.type, pos, false, tint);
        // axe damage: dark notches
        if (b.h == 3)
        for (let i = 0; i < b.maxHp - b.hp; ++i)
        for (let j = 0; j < 3; ++j)
            drawRect(vec2(pos.x - 2/PX + j/PX + i*2/PX, b.y + (14 - i*5 - j) / PX), vec2(1/PX), palColor('k'));
    }

    // refill signs: water drop plates, lit up while anyone runs low on water
    const thirsty = players.some(p=> p.water < 30 && p.downTimer <= 0) && (time*4|0) % 2;
    const sign = thirsty ? 'waterSignLit' : 'waterSign';
    drawRect(vec2(TRUCK_X - 3.5 + .5/PX, 5.6), vec2(1/PX, 1.2), palColor('S')); // mast on the truck
    drawSprite(sign, vec2(TRUCK_X - 3.5, 6.1));
    for (const p of standpipes) // wall plate beside the pipe, unlit once it runs dry
        p.reserve > 0 ?
            drawSprite(sign, vec2(p.x - 1.4, p.y + 2.2)) :
            drawSprite('waterSign', vec2(p.x - 1.4, p.y + 2.2), false, rgb(.4,.4,.45));
}

///////////////////////////////////////////////////////////////////////////////
// pixel ui (screen pixels, top left origin)

function uiRect(x, y, w, h, color)
{
    drawRect(vec2(x + w/2, y + h/2), vec2(w, h), color, 0, true, true);
}

// 8x8 pixel font text, y is the vertical center
function uiText(text, x, y, scale=1, color=WHITE, align='center', shadow=true)
{
    text += '';
    const size = 8 * scale;
    const width = text.length * size;
    const left = align == 'left' ? x : align == 'right' ? x - width : 0;
    const pos = vec2(align == 'center' ? x : left + size/2, y);
    if (shadow)
        engineImageFont.drawTextScreen(text, pos.add(vec2(scale)), size, align == 'center', palColor('k', color.a));
    engineImageFont.drawTextScreen(text, pos, size, align == 'center', color);
}

function uiPanel(x, y, w, h)
{
    uiRect(x + 2, y + 2, w, h, rgb(0,0,0,.35));
    uiRect(x - 1, y - 1, w + 2, h + 2, palColor('k'));
    uiRect(x, y, w, h, palColor('e'));
}

function uiBar(x, y, w, pct, color)
{
    uiRect(x - 1, y - 1, w + 2, 6, palColor('k'));
    uiRect(x, y, w, 4, palColor('D'));
    uiRect(x, y, Math.round(w * clamp(pct)), 4, color);
    uiRect(x, y, Math.round(w * clamp(pct)), 1, color.lerp(WHITE, .35));
}

function uiIcon(name, x, y)
{
    const s = sprites[name];
    s.tileInfo ||= new TileInfo(vec2(s.x, s.y), vec2(s.w, s.h), textureInfos[0]);
    drawTile(vec2(x + s.w/2, y + s.h/2), vec2(s.w, s.h), s.tileInfo, WHITE, 0, false, undefined, true, true);
}

function gameRenderPost()
{
    const W = screenW, H = screenH;
    const stats = fireStats();

    if (gameState == 'title')
    {
        uiRect(0, 0, W, H, rgb(.05,.04,.09,.72));
        uiText('FIRE BRIGADE', W/2 + 1, 52, 3, palColor('o'));
        uiText('PUT OUT EVERY FIRE BEFORE THE BUILDING BURNS DOWN', W/2, 80, 1, palColor('T'));
        uiPanel(W/2 - 130, 100, 260, 34);
        uiText('1  SOLO', W/2 - 60, 117, 1, palColor('Y'));
        uiText('2  TWO PLAYERS', W/2 + 50, 117, 1, palColor('Y'));
        uiText('P1  WASD      P2  ARROWS', W/2, 156, 1, palColor('T'));
        uiText('UP TO JUMP OR CLIMB LADDERS', W/2, 170, 1, palColor('T'));
        uiText('GET CLOSE TO FIRE AND THE HOSE SPRAYS', W/2, 194, 1, palColor('S'));
        uiText('WALK INTO DOORS + DEBRIS TO CHOP THEM', W/2, 208, 1, palColor('S'));
        uiText('REFILL AT THE TRUCK OR WALL STANDPIPES', W/2, 222, 1, palColor('S'));
        uiText('2P: STAND ON EACH OTHER TO REACH HIGH SPOTS', W/2, 236, 1, palColor('S'));
        return;
    }

    if (gameState == 'entry')
    {
        drawEntryScreen();
        return;
    }

    // player panels
    players.forEach((p, i)=>
    {
        const x = i == 0 ? 6 : W - 106;
        uiPanel(x, 6, 100, 30);
        uiText(p.controls.label, x + 4, 13, 1, p.coatColor.lerp(WHITE, .3), 'left');
        if (p.downTimer > 0)
            uiText('DOWN!', x + 30, 13, 1, palColor('r'), 'left');
        else if (p.water < 15)
            (time*4|0) % 2 && uiText('REFILL', x + 30, 13, 1, palColor('c'), 'left');
        uiIcon('drop', x + 3, 19);
        uiBar(x + 13, 21, 82, p.water / 100, palColor('b'));
        uiIcon('heart', x + 3, 27);
        uiBar(x + 13, 29, 82, p.hp / 100, palColor('r'));
    });

    // building status
    uiPanel(W/2 - 60, 6, 120, 30);
    uiIcon('flame', W/2 - 56, 9);
    uiText(stats.burning, W/2 - 44, 13, 1, palColor('o'), 'left');
    uiText((playTime|0) + 'S', W/2 + 56, 13, 1, palColor('T'), 'right');
    const integ = stats.integrity;
    uiBar(W/2 - 55, 25, 110, integ, integ > .5 ? palColor('g') : palColor('o'));

    drawMinimap();

    if (gameState == 'won' || gameState == 'lost')
    {
        const won = gameState == 'won';
        uiRect(0, 0, W, H, rgb(.05,.04,.09,.6));
        uiText(won ? 'ALL FIRES OUT!' : 'THE BUILDING IS LOST', W/2 + 1, 100, 2, won ? palColor('g') : palColor('r'));
        uiText('BUILDING SAVED ' + (stats.integrity*100|0) + '%   TIME ' + (playTime|0) + 'S', W/2, 130, 1, WHITE);
        uiText('R  PLAY AGAIN     ESC  TITLE', W/2, 150, 1, palColor('S'));
    }
}

function drawEntryScreen()
{
    const W = screenW, H = screenH;
    uiRect(0, 0, W, H, rgb(.05,.04,.09,.6));
    uiText('CHOOSE YOUR WAY IN', W/2 + 1, 34, 2, palColor('o'));

    // big minimap with the options lined up beside their floors
    const s = 3, mx = W/2 - 30, my = 84, mh = FLOORS * FLOOR_H * s;
    drawMinimap(s, mx, my);
    const surface = (f)=> my + (FLOORS - f) * FLOOR_H * s - s; // floor surface (FLOORS = roof)
    const roofY = my - 3 - s;
    uiRect(mx - 3, roofY, BLD_W * s + 6, s, palColor('S'));

    const blink = (time*4|0) % 2;
    uiRect(mx - 3 - 2*s, roofY, s, surface(0) - roofY, palColor('s')); // aerial ladder, street to roof
    for (let f = 0; f <= FLOORS; ++f)
    {
        const selected = f == entryFloor;
        const y = f == FLOORS ? roofY - 6 : surface(f) - 7;
        uiText((selected ? '> ' : '') + entryName(f), mx - 16, y, 1, palColor(selected ? 'Y' : 'S'), 'right');
    }

    // highlight the entry point
    const f = entryFloor;
    if (f == FLOORS)
        blink && uiRect(mx + (ladderSpots[FLOORS-1].x - BLD_X) * s, roofY - s, s, s, palColor('Y'));
    else
    {
        blink && uiRect(mx, surface(f) - 3*s, s, 3*s, palColor('Y'));
    }

    uiRect(mx + BLD_W * s - 58, my + mh + 6, 2*s, 2*s, palColor('c'));
    uiText('REFILL', mx + BLD_W * s, my + mh + 9, 1, palColor('S'), 'right');
    uiText(entryInfo(f), W/2, my + mh + 22, 1, palColor('T'));
    uiText('UP DOWN  CHOOSE     ENTER  GO     ESC  BACK', W/2, my + mh + 42, 1, palColor('S'));
}

// s pixels per column, s*FLOOR_H pixels per floor; defaults to the corner HUD map
function drawMinimap(s=1, ox=screenW - BLD_W - 8, oy=screenH - FLOORS*FLOOR_H - 8)
{
    const mw = BLD_W, mh = FLOORS * FLOOR_H;
    uiPanel(ox - 2, oy - 2, mw*s + 4, mh*s + 4);
    for (let f = 0; f < FLOORS; ++f)
    {
        const fy = oy + (mh - (f+1) * FLOOR_H) * s;
        uiRect(ox, fy + (FLOOR_H - 1) * s, mw * s, s, palColor('d'));
        for (let c = 0; c < BLD_W; ++c)
        {
            const cell = fireGrid[f][c];
            if (cell.rubble)
                uiRect(ox + c*s, fy + 2*s, s, 3*s, palColor('n'));
            else if (cell.wall)
                uiRect(ox + c*s, fy, s, (FLOOR_H - 1) * s, palColor('S'));
            else if (cell.heat > 0)
            {
                const h = max(1, Math.round((FLOOR_H - 1) * cell.heat));
                uiRect(ox + c*s, fy + (FLOOR_H - 1 - h) * s, s, h*s, palColor(cell.heat > .6 ? 'Y' : 'o'));
            }
            else if (cell.burnt > .3)
                uiRect(ox + c*s, fy + (FLOOR_H - 2) * s, s, s, palColor('N'));
        }
    }
    for (const l of ledges)
    {
        const fy = oy + (mh - (l.f+1) * FLOOR_H) * s;
        uiRect(ox + l.c0*s, fy + 2*s, (l.c1 - l.c0) * s, s, palColor('n'));
        for (let c = l.c0; c < l.c1; ++c)
        {
            const cell = l.cells[c];
            if (cell.heat <= 0) continue;
            const h = max(1, Math.round(2 * cell.heat));
            uiRect(ox + c*s, fy + (2 - h) * s, s, h*s, palColor(cell.heat > .6 ? 'Y' : 'o'));
        }
    }
    for (const p of standpipes)
    {
        const f = (p.y - 2) / FLOOR_H, c = floor(p.x) - BLD_X;
        const fy = oy + (mh - (f+1) * FLOOR_H) * s;
        uiRect(ox + c*s, fy + (FLOOR_H - 3) * s, s, 2*s, palColor(p.reserve > 0 ? 'c' : 'd'));
    }
    for (const p of players)
    {
        if (p.downTimer > 0) continue;
        const px = Math.round(p.pos.x - BLD_X), py = Math.round(oy + (mh - (p.pos.y - 2)) * s);
        if (px >= 0 && px < mw && py >= oy && py < oy + mh*s)
            uiRect(ox + (px - 1) * s, py - 2*s, 2*s, 2*s, p.coatColor.lerp(WHITE, .4));
    }
}

///////////////////////////////////////////////////////////////////////////////
engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost, [buildSpriteSheet(), buildBackground()]);
