/*
    Jumping Jeepney — side-scrolling endless runner
    - The jeepney always drives right, slowly speeding up with distance
    - One button (space, up, W, click or tap): jump, press again in the air to
      double jump, hold for a higher jump. Boosters under the chassis do the work
    - Drive into waving passengers to pick them up (8 seats). A passenger's shirt
      color is their stop: land on the rooftop with the matching sign to drop
      them off. Pass their stop and they bail out, fare lost
    - Fall into a canal and the run is over
    - Rooftops, billboards and the LRT deck are one-way platforms: jump up
      through them, land on top. Buildings stand behind the road, so the
      jeepney drives in front of them
    - Pixel art: renders at 240x135 and is scaled up without smoothing (twice
      as chunky as Fire Brigade). 1 world unit = 8 pixels. Every pixel is fully
      opaque: no alpha, no antialiasing, no fades (things blink out instead)
*/

'use strict';
debugWatermark = false;
glSetAntialias(false);

const screenW = 240, screenH = 135;
setCanvasFixedSize(vec2(screenW, screenH));
setCanvasPixelated(true);

const PX = 8; // pixels per world unit
const viewW = screenW / PX, viewH = screenH / PX;

///////////////////////////////////////////////////////////////////////////////
// tuning (world units and seconds)

const JEEP_GRAVITY = 60;
const JUMP_SPEED = 21;          // a single jump peaks ~3.7 up
const DOUBLE_JUMP_SPEED = 22;   // jump + double jump peaks ~7.7 up
const JUMP_CUT_GRAVITY = 3;     // gravity multiplier while rising with the button let go
const MAX_FALL = 30;
const START_SPEED = 10, TOP_SPEED = 18;
const RAMP_DIST = 3000;         // distance until top speed and the hardest layouts
const SEATS = 8;
const WHEELBASE = 1.3;          // half width of the jeepney's footing
const DEATH_Y = -1.6;           // sunk in the canal
const GEN_AHEAD = 200;          // the world is generated this far past the camera
const BASE_FARE = 10;

///////////////////////////////////////////////////////////////////////////////
// palette

const pal =
{
    k:'#181425', w:'#ffffff', s:'#c0cbdc', S:'#8b9bb4', d:'#5a6988', D:'#3a4466', e:'#262b44',
    r:'#e43b44', R:'#a22633', o:'#f77622', y:'#feae34', Y:'#fee761',
    g:'#63c74d', G:'#3e8948', b:'#0099db', B:'#124e89', c:'#2ce8f5',
    p:'#b55088', P:'#68386c', n:'#b86f50', N:'#733e39', m:'#3e2731', t:'#e4a672', T:'#ead4aa',
};
const colorCache = {};
const hexColor = (hex)=> colorCache[hex] ||= new Color().setHex(hex);
const palColor = (char)=> hexColor(pal[char]);

const SKY_BANDS = ['#3b7dd8', '#4a8fe0', '#5ea3e8', '#76b8ee', '#93ccf2', '#b4def5'];
const FAR_CITY = ['#9cc4e8', '#b0d2ee'];  // [silhouette, windows]
const MID_CITY = ['#7aa3cf', '#93b8dc'];

// rooftop platforms: [wall, trim]
const BUILDING_COLORS =
[
    ['#d77643', '#a85032'], ['#c0cbdc', '#8b9bb4'], ['#e8b796', '#be7f5e'], ['#5a6988', '#3a4466'],
    ['#ead4aa', '#c4a57a'], ['#63a35c', '#3e7044'], ['#c27ba0', '#8c4f72'], ['#b86f50', '#733e39'],
];
// made-up brands for the billboards: food shot on a sunburst with a price sticker, logo plate
const ADS =
[
    {lines:['HALO','HALO!'],     icon:'halo',     bg:'c', ray:'b', plate:'w', ink:'P', ink2:'p', sticker:'NEW'},
    {lines:['PANCIT','KING'],    icon:'pancit',   bg:'r', ray:'R', plate:'Y', ink:'R', ink2:'r', sticker:'$45'},
    {lines:['SIOPAO','EXPRESS'], icon:'siopao',   bg:'Y', ray:'y', plate:'R', ink:'Y', ink2:'w'},
    {lines:['TAHO','SARAP'],     icon:'taho',     bg:'n', ray:'N', plate:'T', ink:'N', ink2:'n', sticker:'$15'},
    {lines:['MANGO','COLA'],     icon:'cola',     bg:'o', ray:'y', plate:'w', ink:'o', ink2:'R'},
    {lines:['LOAD','MO NA!'],    icon:'phone',    bg:'p', ray:'P', plate:'Y', ink:'P', ink2:'p', icon2:'bolt'},
    {lines:['BIBINGKA'],         icon:'bibingka', bg:'G', ray:'g', plate:'T', ink:'G', ink2:'N', sticker:'HOT'},
    {lines:['MANOK','ATBP'],     icon:'chicken',  bg:'R', ray:'r', plate:'Y', ink:'R', ink2:'o', sticker:'$99'},
    {lines:['BULA','SOAP'],      icon:'soap',     bg:'b', ray:'B', plate:'w', ink:'B', ink2:'b'},
    {lines:['ISAW','GRILL'],     icon:'isaw',     bg:'e', ray:'m', plate:'o', ink:'k', ink2:'R', sticker:'$10'},
];
const AD_W = 9; // billboard platform width in units (72 pixel panel)

// each stop has a name and a strong color; passengers wear their stop's color
const STOPS =
[
    {name:'BINONDO',   c:'r', ink:'w'},
    {name:'DIVISORIA', c:'o', ink:'k'},
    {name:'QUIAPO',    c:'Y', ink:'k'},
    {name:'LUNETA',    c:'g', ink:'k'},
    {name:'ERMITA',    c:'c', ink:'k'},
    {name:'MALATE',    c:'p', ink:'w'},
];

///////////////////////////////////////////////////////////////////////////////
// sprites: text maps, one character per pixel, '.' is empty
// every map gets a dark 1 pixel outline (and a 1 pixel border to hold it)

const spriteMaps =
{
    jeep: [
        '...YYYYYYYYYYYYYYYY.........',
        '.wwwwwwwwwwwwwwwwwwwww......',
        '.rrrrrrrrrrrrrrrrrrrrr......',
        '.seeeseeeseeeseeesccs....S..',
        '.seeeseeeseeeseeesccs...SS..',
        '.sssssssssssssssssssswwwwSw.',
        '.bbbbbbbbbbbbbbbbbbbbbbbbbbS',
        '.YYYYYYYYYYYYYYYYYYYYYYYYYwS',
        '.wwwwwwwwwwwwwwwwwwwwwwwwwwS',
        '.rrrrrrrrrrrrrrrrrrrrrrrrrrS',
        'SSSSDDDSSSSSSSSSSSSSSDDDSSSS',
        '...DDSDD...dDDDDd...DDSDD...',
        '...DDSDD....d..d....DDSDD...',
        '....DDD..............DDD....'],
    stand: [
        '.......',
        '..hhh..',
        '..htt..',
        '..ttt..',
        '.xxxxx.',
        '.xxxxx.',
        '.txxxt.',
        '..jjj..',
        '..j.j..',
        '..j.j..',
        '..k.k..'],
    wave0: [
        '......t',
        '..hhh.x',
        '..htt.x',
        '..ttt.x',
        '.xxxxxx',
        '.xxxxx.',
        '.txxx..',
        '..jjj..',
        '..j.j..',
        '..j.j..',
        '..k.k..'],
    wave1: [
        '.......',
        '..hhh..',
        '..htt.t',
        '..ttt.x',
        '.xxxxxx',
        '.xxxxx.',
        '.txxx..',
        '..jjj..',
        '..j.j..',
        '..j.j..',
        '..k.k..'],
    cheer: [
        't.....t',
        'x.hhh.x',
        'x.htt.x',
        '.xtttx.',
        '..xxx..',
        '..xxx..',
        '..xxx..',
        '..jjj..',
        '.j...j.',
        '.j...j.',
        '.k...k.'],
    // ad food shots
    halo: [
        '.....r.....',
        '....rrr....',
        '..ppp.YYY..',
        '.pppppYYYY.',
        '.pppwwwYYY.',
        'swwwwwwwwws',
        'swpwwwwwgws',
        '.spppppppS.',
        '.sTTwTTwTS.',
        '.sRgRgRgRS.',
        '..spppppS..',
        '..sTTTTTS..',
        '...sssSS...',
        '....sSs....',
        '...sssss...'],
    pancit: [
        '.....g.....gG...',
        '...YyYYgYy.gg...',
        '..YyYoYYyYYyY...',
        '.YyYYyYwwYoYYy..',
        'YyYoYYyYwYYyYYg.',
        'wwwwwwwwwwwwwwww',
        'swwwwwwwwwwwwwws',
        '.sswwwwwwwwwwss.',
        '...ssssssssss...'],
    siopao: [
        '...w...w....',
        '....w...w...',
        '...w...w....',
        '....wwrw....',
        '..wwwwwwww..',
        '.wwwwwwwwww.',
        'wwwwwwwwwwws',
        'wwwwwwwwwwss',
        '.swwwwwwwss.',
        'TTTTTTTTTTTT',
        '.TTTTTTTTTT.'],
    taho: [
        '......S..',
        '.....S...',
        'sssssssss',
        'sTTTTTTTs',
        'sTmTTmTTs',
        'snnnnnnns',
        'snmnnmnns',
        '.sTTTTTs.',
        '.sTTmTTs.',
        '.sTTTTTs.',
        '.snnnnns.',
        '..sssss..'],
    cola: [
        '..RR..',
        '..oo..',
        '..oo..',
        '.oooo.',
        'oooooo',
        'oYYYYo',
        'oYgYYo',
        'oYYYyo',
        'oYYyyo',
        'oooooo',
        'oowooo',
        'oowooo',
        'oooooo',
        '.RRRR.'],
    phone: [
        'DDDDDDD',
        'DcccccD',
        'DccccBD',
        'DcccBBD',
        'DccBBBD',
        'DcBBBBD',
        'DcccccD',
        'DDDDDDD',
        'DsDsDsD',
        'DDDDDDD',
        'DsDsDsD',
        'DDDDDDD',
        'DsDsDsD',
        'DDDDDDD'],
    bolt: [
        '..YY',
        '.YY.',
        'YYYY',
        '.YY.',
        'YY..',
        'Y...'],
    bibingka: [
        '...yyyyyyyy...',
        '..yynyyyynyy..',
        '.yyyyrryyyyyy.',
        'yyyyyrryyynyyy',
        'nnnnnnnnnnnnnn',
        'GgGgGgGgGgGgGg',
        '.GGGGGGGGGGGG.'],
    chicken: [
        '...nnnn.....',
        '..nooonn....',
        '.noooyoon...',
        '.nooyooooo..',
        '.noooooooN..',
        '..nooooooN..',
        '...nNooNN...',
        '......Nww...',
        '.......ww...',
        '........ww..',
        '.......wwww.',
        '........www.'],
    soap: [
        '.......w..w.',
        '..w...w.w...',
        '.....w......',
        '..cccccccc..',
        '.cwwcccccccb',
        '.ccccccccccb',
        '.ccccccccccb',
        '..bbbbbbbbbb'],
    isaw: [
        'TT.NnNnNnNnN..',
        '...nNnNnNnNn..',
        '..............',
        'TT.RnRnRnRnR..',
        '...nRnRnRnRn..',
        '..............',
        'DDDDDDDDDDDDDD',
        '.o.r.o.r.o.r..'],
};

// jeepney map landmarks (map columns and rows)
const SEAT_COLS = [16, 14, 12, 10, 8, 6, 4, 2]; // window seats, front to back
const NOZZLE_COLS = [12, 15];

// 3x5 pixel font
const FONT =
{
    A:'.#. #.# ### #.# #.#', B:'##. #.# ##. #.# ##.', C:'.## #.. #.. #.. .##', D:'##. #.# #.# #.# ##.',
    E:'### #.. ##. #.. ###', F:'### #.. ##. #.. #..', G:'.## #.. #.# #.# .##', H:'#.# #.# ### #.# #.#',
    I:'### .#. .#. .#. ###', J:'..# ..# ..# #.# .#.', K:'#.# #.# ##. #.# #.#', L:'#.. #.. #.. #.. ###',
    M:'#.# ### ### #.# #.#', N:'##. #.# #.# #.# #.#', O:'.#. #.# #.# #.# .#.', P:'##. #.# ##. #.. #..',
    Q:'.#. #.# #.# ##. .##', R:'##. #.# ##. #.# #.#', S:'.## #.. .#. ..# ##.', T:'### .#. .#. .#. .#.',
    U:'#.# #.# #.# #.# ###', V:'#.# #.# #.# #.# .#.', W:'#.# #.# ### ### #.#', X:'#.# #.# .#. #.# #.#',
    Y:'#.# #.# .#. .#. .#.', Z:'### ..# .#. #.. ###',
    0:'### #.# #.# #.# ###', 1:'.#. ##. .#. .#. ###', 2:'##. ..# .#. #.. ###', 3:'##. ..# .#. ..# ##.',
    4:'#.# #.# ### ..# ..#', 5:'### #.. ##. ..# ##.', 6:'.## #.. ### #.# ###', 7:'### ..# .#. .#. .#.',
    8:'### #.# ### #.# ###', 9:'### #.# ### ..# ##.',
    '!':'.#. .#. .#. ... .#.', '.':'... ... ... ... .#.', '+':'... .#. ### .#. ...', '-':'... ... ### ... ...',
    ':':'... .#. ... .#. ...', '/':'..# ..# .#. #.. #..', '?':'##. ..# .#. ... .#.', "'":'.#. .#. ... ... ...',
    '$':'##. ### ##. #.. #..',
};

const sprites = {}; // name -> {x, y, w, h, pad}

function buildSpriteSheet()
{
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    let cx = 0, cy = 0, rowH = 0;

    const addSprite = (name, w, h, pad, pixelFn) =>
    {
        if (cx + w + 1 > size)
            cx = 0, cy += rowH + 1, rowH = 0;
        ASSERT(cy + h <= size, 'sprite sheet is full');
        for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x)
        {
            const color = pixelFn(x, y);
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(cx + x, cy + y, 1, 1);
        }
        sprites[name] = {x: cx, y: cy, w, h, pad};
        cx += w + 1;
        rowH = max(rowH, h);
    };

    // sprites are painted into grids of hex colors (0 is empty), then packed
    const newGrid = (w, h)=> [...Array(h)].map(()=> Array(w).fill(0));
    const addGrid = (name, grid, pad=0)=> addSprite(name, grid[0].length, grid.length, pad, (x, y)=> grid[y][x]);
    const fill = (grid, x, y, w, h, c)=>
    {
        ASSERT(pal[c], 'missing color ' + c);
        for (let j = max(y, 0); j < min(y + h, grid.length); ++j)
        for (let i = max(x, 0); i < min(x + w, grid[0].length); ++i)
            grid[j][i] = pal[c];
    };

    // a text map with its dark outline, (x, y) is the outline's top left
    const filled = (map, x, y)=> map[y] && map[y][x] && map[y][x] != '.';
    const isOutline = (map, x, y)=> !filled(map, x, y) &&
        (filled(map, x-1, y) || filled(map, x+1, y) || filled(map, x, y-1) || filled(map, x, y+1));
    const stamp = (grid, map, x, y, recolor={})=>
    {
        ASSERT(map.every(row=> row.length == map[0].length), 'sprite rows must match');
        for (let j = -1; j <= map.length; ++j)
        for (let i = -1; i <= map[0].length; ++i)
        {
            const c = isOutline(map, i, j) ? 'k' : filled(map, i, j) ? recolor[map[j][i]] || map[j][i] : 0;
            if (c)
                fill(grid, x + 1 + i, y + 1 + j, 1, 1, c);
        }
    };
    const mapSize = (map)=> vec2(map[0].length + 2, map.length + 2);
    const addMap = (name, map, recolor={})=>
    {
        const grid = newGrid(map[0].length + 2, map.length + 2);
        stamp(grid, map, 0, 0, recolor);
        addGrid(name, grid, 1);
    };

    // 3x5 font into a grid, x is the left edge or the center
    const write = (grid, text, x, y, c, scale=1, center=true)=>
    {
        if (center)
            x -= textWidth(text, scale) >> 1;
        for (let i = 0; i < text.length; ++i)
        {
            const bits = glyphBits(text[i]);
            for (let j = 0; bits && j < 15; ++j)
                if (bits[j] == '#')
                    fill(grid, x + (i*4 + j%3) * scale, y + Math.floor(j/3) * scale, scale, scale, c);
        }
    };
    const disc = (grid, x, y, r, c)=>
    {
        for (let j = -r; j <= r; ++j)
        for (let i = -r; i <= r; ++i)
            if (i*i + j*j <= r*r + r)
                fill(grid, x + i, y + j, 1, 1, c);
    };

    addMap('jeep', spriteMaps.jeep);

    // passengers: shirt is their stop color ('S' while they have no stop yet)
    for (const shirt of [...STOPS.map(s=> s.c), 'S'])
    for (const skin of ['t', 'n'])
    for (const pose of ['stand', 'wave0', 'wave1', 'cheer'])
        addMap(personSprite(pose, shirt, skin), spriteMaps[pose], {h:'m', j:'B', x:shirt, t:skin});

    // ad billboards, 72x26
    ADS.forEach((ad, adIndex)=>
    {
        const w = AD_W * PX, h = 26, grid = newGrid(w, h);
        fill(grid, 0, 0, w, h, 'k');
        fill(grid, 1, 1, w - 2, h - 2, 's');
        const sunX = 14, sunY = 13;
        for (let y = 2; y < h - 2; ++y)
        for (let x = 2; x < w - 2; ++x)
        {
            const sector = Math.floor((Math.atan2(y - sunY, x - sunX) + PI) / (PI / 8));
            fill(grid, x, y, 1, 1, sector % 2 ? ad.bg : ad.ray);
        }

        const icon = spriteMaps[ad.icon], size = mapSize(icon);
        const iconX = sunX - (size.x >> 1) - (ad.icon2 ? 2 : 0) + (ad.sticker ? 3 : 0), iconY = sunY - (size.y >> 1);
        stamp(grid, icon, iconX, iconY);
        if (ad.icon2)
            stamp(grid, spriteMaps[ad.icon2], iconX + size.x - 2, iconY);

        // logo plate
        fill(grid, 28, 3, 40, 20, 'k');
        fill(grid, 29, 4, 38, 18, ad.plate);
        const [line1, line2] = ad.lines, big = textWidth(line1, 2) <= 36;
        if (!line2)
            write(grid, line1, 48, 11, ad.ink);
        else if (big)
            write(grid, line1, 48, 5, ad.ink, 2), write(grid, line2, 48, 16, ad.ink2);
        else
            write(grid, line1, 48, 7, ad.ink), write(grid, line2, 48, 14, ad.ink2);

        if (ad.sticker)
        {
            disc(grid, 9, 8, 6, 'k');
            disc(grid, 9, 8, 5, 'Y');
            write(grid, ad.sticker, 9, 6, 'r');
        }
        addGrid('ad' + adIndex, grid);
    });

    return canvas.toDataURL();
}

const personSprite = (pose, shirt, skin)=> pose + shirt + skin;

function spriteTile(name)
{
    const s = sprites[name];
    return s.tileInfo ||= new TileInfo(vec2(s.x, s.y), vec2(s.w, s.h), textureInfos[0]);
}

///////////////////////////////////////////////////////////////////////////////
// pixel-exact drawing

const snap = (v)=> Math.round(v * PX) / PX;

// world sprite; pos is the bottom center of the map (outline border hangs below)
function drawSprite(name, pos, mirror=false)
{
    const s = sprites[name];
    const left = Math.round(pos.x * PX - s.w/2), bottom = Math.round(pos.y * PX) - s.pad;
    drawTile(vec2(left + s.w/2, bottom + s.h/2).scale(1/PX), vec2(s.w, s.h).scale(1/PX), spriteTile(name), WHITE, 0, mirror);
}

// world rect from its bottom left corner, snapped to the pixel grid
function wRect(x, y, w, h, color)
{
    const x0 = snap(x), y0 = snap(y), x1 = snap(x + w), y1 = snap(y + h);
    if (x1 > x0 && y1 > y0)
        drawRect(vec2((x0 + x1)/2, (y0 + y1)/2), vec2(x1 - x0, y1 - y0), color);
}

// screen rect from its top left corner, in canvas pixels
function sRect(x, y, w, h, color)
{
    drawRect(vec2(x + w/2, y + h/2), vec2(w, h), color, 0, true, true);
}

const toScreenX = (x)=> Math.round((x - cameraPos.x) * PX + screenW/2);
const toScreenY = (y)=> Math.round(screenH/2 - (y - cameraPos.y) * PX);

const glyphCache = {};
function glyphBits(ch)
{
    if (!FONT[ch]) return;
    const bits = glyphCache[ch] ||= FONT[ch].replaceAll(' ', '');
    ASSERT(bits.length == 15, 'glyph must be 3x5: ' + ch);
    return bits;
}

const textWidth = (text, scale=1)=> ((text + '').length * 4 - 1) * scale;

// 3x5 font text in screen pixels, (x, y) is the top left (or top center/right)
function sText(text, x, y, color='w', scale=1, align='left', shadow='k')
{
    text = (text + '').toUpperCase();
    const w = textWidth(text, scale);
    x = Math.round(align == 'center' ? x - w/2 : align == 'right' ? x - w : x);
    y = Math.round(y);
    const passes = shadow ? [[max(1, scale >> 1), shadow], [0, color]] : [[0, color]];
    for (const [offset, c] of passes)
    for (let i = 0; i < text.length; ++i)
    {
        const bits = glyphBits(text[i]);
        if (!bits) continue;
        // one rect per lit glyph pixel: always exact, no texture sampling
        for (let j = 0; j < 15; ++j)
            if (bits[j] == '#')
                sRect(x + offset + (i*4 + j%3) * scale, y + offset + Math.floor(j/3) * scale, scale, scale, palColor(c));
    }
}

function sPanel(x, y, w, h)
{
    sRect(x - 1, y - 1, w + 2, h + 2, palColor('k'));
    sRect(x, y, w, h, palColor('e'));
    sRect(x, y, w, 1, palColor('D'));
}

// deterministic 0-1 noise for the scenery
const hash = (i)=> { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

///////////////////////////////////////////////////////////////////////////////
// sounds

const sndHornA   = new SoundGenerator({frequency:370, volume:.45, sustain:.22, release:.06, shape:2});
const sndHornB   = new SoundGenerator({frequency:466, volume:.35, sustain:.22, release:.06, shape:2});
const sndJump    = new SoundGenerator({frequency:300, release:.12, slide:.3, volume:.4});
const sndDouble  = new SoundGenerator({frequency:460, release:.16, slide:.6, volume:.4});
const sndLand    = new SoundGenerator({frequency:120, release:.08, slide:-.3, noise:.2, volume:.3});
const sndBoard   = new SoundGenerator({frequency:900, release:.12, pitchJump:600, pitchJumpTime:.05, volume:.5});
const sndDeliver = new SoundGenerator({frequency:400, release:.3, slide:.4, repeatTime:.08, pitchJump:300, volume:.6});
const sndMiss    = new SoundGenerator({frequency:260, release:.25, slide:-.6, volume:.5});
const sndFull    = new SoundGenerator({frequency:140, release:.08, shapeCurve:0, volume:.3});
const sndSplash  = new SoundGenerator({shape:4, bitCrush:.5, sustain:.15, release:.4, sustainVolume:.5, volume:.7});

function honk()
{
    sndHornA.play();
    sndHornB.play();
}

///////////////////////////////////////////////////////////////////////////////
// input: one button

const jumpPressed = ()=> keyWasPressed('Space') || keyWasPressed('ArrowUp') || keyWasPressed('KeyW') ||
    mouseWasPressed(0) || gamepadWasPressed(0);
const jumpHeld = ()=> keyIsDown('Space') || keyIsDown('ArrowUp') || keyIsDown('KeyW') ||
    mouseIsDown(0) || gamepadIsDown(0);

///////////////////////////////////////////////////////////////////////////////
// game state

let gameState = 'title'; // title, play, over
let stateTimer = 0;
let jeep;
let riders;              // {dest, skin}
let platforms;           // one-way surfaces {kind: road|roof|board|deck, x0, x1, y, ...}
let roads;               // road platforms, in order; the gaps between them are canals
let stops;               // {type, x0, x1, y, passed}
let people;              // waiting, arrived and bailing passengers
let decos;               // street lamps and palm trees
let particles, popups;
let fares, delivered, missed;
let camX, camY, shakeTime;
let genX, openRoad, lastStopX, stopGap, lastStopType, lastPitEnd;
let save = readSaveData('jumpingJeepney', {best: 0, bestDist: 0});

const JEEP_START_X = 0;
const distance = ()=> Math.max(0, Math.floor(jeep.x - JEEP_START_X));
const progress = ()=> clamp(genX / RAMP_DIST);
const runSpeed = ()=> lerp(START_SPEED, TOP_SPEED, distance() / RAMP_DIST);
const minCamY = viewH/2 - 3.5; // road surface sits 3.5 units above the bottom of the screen

function newRun()
{
    jeep = {x: JEEP_START_X, y: 0, vy: 0, ground: null, jumps: 2, boost: 0};
    riders = [];
    platforms = [], roads = [], stops = [], people = [], decos = [];
    particles = [], popups = [];
    fares = delivered = missed = 0;
    shakeTime = 0;

    // a calm stretch of road with two easy pickups to start
    genX = -40;
    openRoadAt(genX);
    lastStopX = 0, stopGap = 30, lastStopType = -1, lastPitEnd = 0;
    genFlat(55, [14, 24]);
    generate(JEEP_START_X + GEN_AHEAD);

    jeep.ground = openRoad;
    camX = jeep.x + viewW/2 - 7, camY = minCamY;
}

///////////////////////////////////////////////////////////////////////////////
// world generation: features are laid out left to right from genX

function openRoadAt(x)
{
    openRoad = {kind:'road', x0:x, x1:x, y:0};
    platforms.push(openRoad);
    roads.push(openRoad);
}

function spawnPerson(x, y)
{
    people.push({x, y, state:'wait', dest:null, skin: rand() < .5 ? 't' : 'n', t: rand(9), vx:0, vy:0});
}

function addBuilding(x, w, h)
{
    const [wall, trim] = BUILDING_COLORS[randInt(BUILDING_COLORS.length)];
    const p = {kind:'roof', x0:x, x1:x + w, y:h, wall, trim, windows: randInt(3), tank: rand() < .3};
    platforms.push(p);
    return p;
}

// floating billboard, its top edge is the platform
function addBoard(x, h)
{
    const p = {kind:'board', x0:x, x1:x + AD_W, y:h, ad: randInt(ADS.length)};
    platforms.push(p);
    return p;
}

function genFlat(len, pickups=[])
{
    for (const x of pickups)
        spawnPerson(genX + x, 0);
    for (let x = genX + randInt(2, 6); x < genX + len - 2; x += randInt(7, 13))
        decos.push({x, type: rand() < .5 ? 'lamp' : 'palm'});
    genX += len;
}

function genBlock()
{
    let x = genX + randInt(1, 4);
    const count = randInt(1, 4);
    for (let i = 0; i < count; ++i)
    {
        const w = randInt(4, 9), h = randInt(3, 12) / 2;
        addBuilding(x, w, h);
        if (rand() < .35)
            spawnPerson(x + rand(1, w - 1), h);
        x += w + (rand() < .5 ? 0 : randInt(1, 4));
    }
    if (rand() < .5)
        spawnPerson(rand(genX + 1, x), 0);
    genX = x + randInt(2, 5);
}

function genPit()
{
    const w = randInt(3, 6 + Math.round(4 * progress()));
    openRoad.x1 = genX;
    if (w >= 7 && rand() < .6)
        addBoard(genX + w/2 - AD_W/2, randInt(4, 6));
    genX += w;
    openRoadAt(genX);
    lastPitEnd = genX;
    genX += randInt(6, 10); // room to land
}

function genLRT()
{
    const len = randInt(16, 31), h = randInt(9, 13) / 2;
    platforms.push({kind:'deck', x0:genX, x1:genX + len, y:h});
    for (let i = randInt(1, 3); i--;)
        spawnPerson(genX + rand(2, len - 2), h);

    // a canal under the tracks
    if (progress() > .15 && rand() < .5)
    {
        const pitX = genX + randInt(5, len - 10);
        openRoad.x1 = pitX;
        openRoadAt(pitX + randInt(3, 6));
        lastPitEnd = openRoad.x0;
    }
    genX += len + randInt(2, 5);
}

function genStop()
{
    let type;
    do type = randInt(STOPS.length); while (type == lastStopType);
    lastStopType = type;

    const high = rand() < .25 + .35 * progress();
    const h = high ? randInt(16, 27) / 2 : randInt(4, 14) / 2;
    let x = genX + randInt(3, 7);
    if (high)
    {
        // a billboard halfway up to step from
        addBoard(x, Math.round(h) / 2);
        x += AD_W + randInt(3, 6);
    }
    const w = randInt(9, 13);
    const roof = addBuilding(x, w, h);
    const stop = {type, x0:x, x1:x + w, y:h, passed:false};
    roof.stop = stop;
    stops.push(stop);
    if (rand() < .5)
        spawnPerson(x + w - 1.5, h); // someone here wants to ride on

    genX = x + w + randInt(3, 7);
    lastStopX = genX;
    stopGap = randInt(30, 50);
}

function generate(toX)
{
    while (genX < toX)
    {
        const r = rand();
        if (genX - lastStopX > stopGap)
            genStop();
        else if (r < .3 && genX > 60 && genX - lastPitEnd > 10)
            genPit();
        else if (r < .55)
            genBlock();
        else if (r < .7)
            genLRT();
        else
            genFlat(randInt(6, 15), rand() < .6 ? [rand(1, 5)] : []);
        openRoad.x1 = max(openRoad.x1, genX);
    }
}

function pruneWorld()
{
    const left = camX - viewW/2 - 12;
    const keep = (o)=> (o.x1 ?? o.x) > left;
    platforms = platforms.filter(keep);
    roads = roads.filter(keep);
    stops = stops.filter(keep);
    decos = decos.filter(keep);
    people = people.filter(p=> p.x > left && p.y > -12);
}

///////////////////////////////////////////////////////////////////////////////
// update

function gameInit()
{
    newRun();
}

function gameUpdate()
{
    stateTimer += timeDelta;
    if (gameState == 'title')
    {
        if (jumpPressed())
            gameState = 'play', stateTimer = 0, honk();
    }
    else if (gameState == 'play')
    {
        updateJeep();
        updatePeople();
        generate(camX + GEN_AHEAD);
        pruneWorld();
    }
    else if (gameState == 'over')
    {
        updatePeople();
        if (stateTimer > 1 && jumpPressed())
        {
            newRun();
            gameState = 'play', stateTimer = 0, honk();
        }
    }
    updateParticles();
}

function updateJeep()
{
    jeep.x += runSpeed() * timeDelta;

    // jump and double jump; walking off a ledge keeps both jumps
    if (jumpPressed() && jeep.jumps > 0)
    {
        const first = jeep.jumps == 2;
        jeep.vy = first ? JUMP_SPEED : DOUBLE_JUMP_SPEED;
        jeep.jumps--;
        jeep.ground = null;
        jeep.boost = first ? .18 : .3;
        (first ? sndJump : sndDouble).play();
        for (let i = first ? 6 : 14; i--;)
            boosterParticle(rand(-3, 3), rand(-12, -4));
    }

    const gravityScale = jeep.vy > 0 && !jumpHeld() ? JUMP_CUT_GRAVITY : 1;
    jeep.vy = max(jeep.vy - JEEP_GRAVITY * gravityScale * timeDelta, -MAX_FALL);
    const prevY = jeep.y;
    jeep.y += jeep.vy * timeDelta;
    jeep.boost -= timeDelta;

    // one-way platforms: only land on them from above
    let landing = null;
    if (jeep.vy <= 0)
    for (const p of platforms)
        if (p.x0 < jeep.x + WHEELBASE && p.x1 > jeep.x - WHEELBASE &&
            prevY >= p.y - .001 && jeep.y <= p.y && (!landing || p.y > landing.y))
            landing = p;

    if (landing)
    {
        if (!jeep.ground)
        {
            const impact = -jeep.vy;
            if (impact > 12)
            {
                sndLand.play();
                for (let i = 8; i--;)
                    addParticle(jeep.x + rand(-2, 2), landing.y, rand(-3, 3), rand(1, 4), rand(.2, .4), ['s', 'S', 'd'], 20);
            }
        }
        jeep.y = landing.y;
        jeep.vy = 0;
        jeep.jumps = 2;
        jeep.ground = landing;
    }
    else
        jeep.ground = null;

    // exhaust puffs while driving
    if (jeep.ground && rand() < .15)
        addParticle(jeep.x - 1.8, jeep.y + .4, rand(-4, -2), rand(.5, 1.5), rand(.3, .5), ['s', 'S'], 0);
    if (jeep.boost > 0)
        boosterParticle(rand(-1, 1), rand(-10, -6));

    // drop off at the stop under the wheels
    const stop = jeep.ground?.stop;
    if (stop)
    {
        // they line up behind the jeepney, kept on the roof: the jeepney can land
        // with only its front wheels on, so its center may be off the edge
        const count = riders.filter(r=> r.dest == stop).length;
        const first = clamp(jeep.x - 2.2, stop.x0 + .5 + (count - 1) * .9, stop.x1 - .5);
        let n = 0;
        riders = riders.filter(r=>
        {
            if (r.dest != stop) return true;
            const fare = BASE_FARE + Math.floor(stop.y) * 2;
            fares += fare;
            ++delivered;
            people.push({x: first - n*.9, y: stop.y, state:'arrived', dest:stop, skin:r.skin, t:rand(9), vx:0, vy:0});
            addPopup('+$' + fare, jeep.x, jeep.y + 3 + n * .9, STOPS[stop.type].c);
            ++n;
            return false;
        });
        if (n)
        {
            sndDeliver.play();
            for (let i = 20; i--;)
                addParticle(jeep.x + rand(-2, 2), jeep.y + rand(1, 2), rand(-5, 5), rand(4, 9), rand(.4, .8), [STOPS[stop.type].c, 'w'], 20);
        }
    }

    // passed stops: anyone still aboard for them bails out
    for (const s of stops)
    {
        if (s.passed || s.x1 > jeep.x - WHEELBASE) continue;
        s.passed = true;
        let n = 0;
        riders = riders.filter(r=>
        {
            if (r.dest != s) return true;
            ++missed;
            people.push({x: jeep.x - 1, y: jeep.y + 1, state:'bail', dest:s, skin:r.skin, t:0, vx: rand(-6, -3), vy: rand(6, 10)});
            ++n;
            return false;
        });
        if (n)
        {
            sndMiss.play();
            addPopup('MISSED ' + STOPS[s.type].name, jeep.x, jeep.y + 3, 'r');
        }
    }

    // fell in a canal
    if (jeep.y < DEATH_Y)
    {
        gameState = 'over', stateTimer = 0;
        shakeTime = .4;
        sndSplash.play();
        for (let i = 40; i--;)
            addParticle(jeep.x + rand(-2, 2), -1.5, rand(-5, 5), rand(5, 14), rand(.5, 1), ['w', 'c', 'b'], 30);
        if (fares > save.best || distance() > save.bestDist)
        {
            save = {best: max(save.best, fares), bestDist: max(save.bestDist, distance())};
            writeSaveData('jumpingJeepney', save);
        }
    }
}

function updatePeople()
{
    for (const p of people)
    {
        p.t += timeDelta;
        if (p.state == 'bail')
        {
            p.vy -= JEEP_GRAVITY * .5 * timeDelta;
            p.x += p.vx * timeDelta;
            p.y += p.vy * timeDelta;
            continue;
        }
        if (p.state != 'wait' || gameState != 'play') continue;

        // pick a stop once they're close (still off screen)
        if (!p.dest && p.x < camX + viewW/2 + 25)
        {
            const ahead = stops.filter(s=> !s.passed && s.x0 > p.x + 14).slice(0, 3);
            if (ahead.length)
                p.dest = ahead[randInt(ahead.length)];
        }

        // board when the jeepney drives into them
        const touching = abs(p.x - jeep.x) < 1.7 && p.y > jeep.y - .5 && p.y < jeep.y + 1.6;
        if (!touching || !p.dest) continue;
        if (riders.length < SEATS)
        {
            riders.push({dest: p.dest, skin: p.skin});
            p.state = 'gone';
            sndBoard.play();
            for (let i = 6; i--;)
                addParticle(p.x, p.y + .8, rand(-3, 3), rand(2, 6), rand(.2, .4), ['Y', 'w'], 20);
        }
        else if (!p.full)
        {
            p.full = true;
            sndFull.play();
            addPopup('FULL!', p.x, p.y + 2.5, 'w');
        }
    }
    people = people.filter(p=> p.state != 'gone');
}

function addParticle(x, y, vx, vy, life, colors, gravity)
{
    particles.push({x, y, vx, vy, life, age:0, colors, gravity});
}

function boosterParticle(vx, vy)
{
    const nozzle = NOZZLE_COLS[randInt(2)];
    addParticle(jeep.x + (nozzle - 13) / PX, jeep.y - .1, vx, vy, rand(.15, .35), ['w', 'Y', 'o', 'r', 'd'], 0);
}

function addPopup(text, x, y, color)
{
    popups.push({text, x, y, color, age:0});
}

function updateParticles()
{
    for (const p of particles)
    {
        p.age += timeDelta;
        p.vy -= p.gravity * timeDelta;
        p.x += p.vx * timeDelta;
        p.y += p.vy * timeDelta;
    }
    particles = particles.filter(p=> p.age < p.life);
    for (const p of popups)
        p.age += timeDelta, p.y += 1.5 * timeDelta;
    popups = popups.filter(p=> p.age < 1.2);
    shakeTime -= timeDelta;
}

function gameUpdatePost()
{
    setCameraScale(PX);
    if (gameState != 'over')
    {
        camX = snap(jeep.x + viewW/2 - 7);
        camY = snap(lerp(camY, max(minCamY, jeep.y + 1), .12));
    }
    // whole-pixel shake; the extra half pixel keeps world pixels on canvas pixels
    const shake = shakeTime > 0 ? vec2(randInt(-2, 3), randInt(-2, 3)).scale(1/PX) : vec2();
    setCameraPos(vec2(camX, camY + .5/PX).add(shake));
}

///////////////////////////////////////////////////////////////////////////////
// render

function gameRender()
{
    drawSky();
    drawCity(.25, FAR_CITY, 14, 105, 30);
    drawCity(.5, MID_CITY, 18, 112, 22);

    const left = cameraPos.x - viewW/2 - 2, right = cameraPos.x + viewW/2 + 2;
    const onScreen = (o)=> o.x1 > left && o.x0 < right;
    for (const p of platforms)
        if (onScreen(p) && p.kind != 'road')
            p.kind == 'roof' ? drawBuilding(p) : p.kind == 'deck' ? drawDeck(p) : drawBoard(p);
    for (const d of decos)
        if (d.x > left && d.x < right)
            drawDeco(d);
    for (const p of people)
        if (p.x > left && p.x < right)
            drawPerson(p);
    if (!(gameState == 'over' && jeep.y < DEATH_Y))
        drawJeep();
    drawRoad(left, right);
    for (const p of particles)
        wRect(p.x, p.y, 1/PX, 1/PX, palColor(p.colors[Math.floor(p.age / p.life * p.colors.length)]));
}

function drawSky()
{
    const bandH = 12;
    SKY_BANDS.forEach((c, i)=>
        sRect(0, i * bandH, screenW, i == SKY_BANDS.length - 1 ? screenH : bandH, hexColor(c)));

    // sun
    const cx = 196, cy = 24, r = 9;
    for (let dy = -r; dy <= r; ++dy)
    {
        const half = Math.floor(Math.sqrt(r*r - dy*dy));
        sRect(cx - half, cy + dy, half*2 + 1, 1, palColor(abs(dy) > r - 3 || half < 3 ? 'y' : 'Y'));
    }

    // clouds
    const offset = Math.floor(cameraPos.x * PX * .1);
    for (let i = Math.floor(offset / 70); i * 70 - offset < screenW; ++i)
    {
        const x = i * 70 - offset + Math.floor(hash(i) * 30), y = 10 + Math.floor(hash(i + 50) * 30);
        const w = 16 + Math.floor(hash(i + 99) * 16);
        sRect(x + 4, y, w - 8, 3, palColor('w'));
        sRect(x, y + 3, w, 4, palColor('w'));
        sRect(x + 2, y + 7, w - 4, 1, palColor('s'));
    }
}

// a parallax skyline row of blocky towers, in screen pixels
function drawCity(factor, [color, windowColor], colW, baseY, maxH)
{
    const groundY = toScreenY(0);
    const base = Math.round(lerp(baseY, groundY, factor * .6));
    const offset = Math.floor(cameraPos.x * PX * factor);
    for (let i = Math.floor(offset / colW); i * colW - offset < screenW; ++i)
    {
        const x = i * colW - offset, h = 8 + Math.floor(hash(i * 7 + colW) * maxH);
        const w = colW - 1 - Math.floor(hash(i * 3 + colW) * 4);
        sRect(x, base - h, w, screenH, hexColor(color));
        for (let wy = base - h + 3; wy < base - 2; wy += 4)
        for (let wx = x + 2; wx < x + w - 2; wx += 3)
            sRect(wx, wy, 1, 2, hexColor(windowColor));
        if (hash(i * 11 + colW) < .2) // antenna
            sRect(x + 3, base - h - 4, 1, 4, hexColor(color));
    }
    sRect(0, base, screenW, screenH, hexColor(color));
}

function drawBuilding(b)
{
    const wall = hexColor(b.wall), trim = hexColor(b.trim), w = b.x1 - b.x0, u = 1/PX;
    wRect(b.x0, -1, w, b.y + 1, wall);
    wRect(b.x1 - u, -1, u, b.y + 1, trim); // shaded side

    // windows
    const glass = palColor('D'), shine = palColor('d');
    if (b.windows == 0)
    {
        for (let y = b.y - 1.25; y > .9; y -= 1.5)
        for (let x = b.x0 + .75; x + .75 < b.x1 - .25; x += 1.5)
            wRect(x, y - .75, .75, .75, glass), wRect(x, y - u, u * 2, u, shine);
    }
    else if (b.windows == 1)
    {
        for (let y = b.y - 1; y > .9; y -= 1.25)
            wRect(b.x0 + .5, y - .5, w - 1, .5, glass), wRect(b.x0 + .5, y - u, w - 1, u, shine);
    }
    else // shuttered shop rows
    {
        for (let y = b.y - 1.25; y > .9; y -= 2)
        for (let x = b.x0 + .5; x + 1.5 < b.x1; x += 2)
        {
            wRect(x, y - 1, 1.25, 1, trim);
            for (let line = 1; line < 8; line += 2)
                wRect(x, y - 1 + line * u, 1.25, u, glass);
        }
    }

    // parapet
    const stop = b.stop && STOPS[b.stop.type];
    if (stop)
    {
        for (let x = b.x0; x < b.x1; x += .5)
            wRect(x, b.y - .375, .5, .375, palColor((x - b.x0) * 2 % 2 ? 'w' : stop.c));
    }
    else
        wRect(b.x0, b.y - .375, w, .375, trim);
    wRect(b.x0 - u, b.y - u, w + u * 2, u, palColor('s'));

    // rooftop clutter
    if (b.tank && !stop)
    {
        const x = b.x0 + 1;
        wRect(x + .125, b.y, u, .5, palColor('D'));
        wRect(x + .75, b.y, u, .5, palColor('D'));
        wRect(x, b.y + .5, 1, 1, palColor('b'));
        wRect(x, b.y + 1.375, 1, u, palColor('B'));
    }
    if (stop)
        drawStopProps(b, b.stop);
}

// what a rider calls out from the window when their stop is coming up
const PARA_PO = 'PARA PO!';
const PARA_PO_RANGE = 14; // units before the stop

// jeepney pictogram on stop signs
const JEEP_PICTO = ['.#######.', '#.#.#.##.', '#########', '.#.....#.'];

// world rect in whole world pixels from its bottom left
const pRect = (x, y, w, h, char)=> wRect(x / PX, y / PX, w / PX, h / PX, palColor(char));

// a plain transit stop: waiting shed and a sign on a pole
function drawStopProps(b, stop)
{
    const info = STOPS[stop.type];
    const x0 = Math.round(b.x0 * PX), x1 = Math.round(b.x1 * PX), roof = Math.round(b.y * PX);

    // shed: posts, a canopy in the stop's color, a bench
    const shed = x0 + 4, shedW = 28;
    for (const x of [shed + 3, shed + shedW - 4])
        pRect(x - 1, roof, 3, 13, 'k'), pRect(x, roof, 1, 13, 'S');
    pRect(shed - 1, roof + 12, shedW + 2, 6, 'k');
    pRect(shed, roof + 13, shedW, 4, info.c);
    pRect(shed, roof + 16, shedW, 1, 'w');
    pRect(shed + 7, roof + 3, shedW - 14, 2, 'n');
    pRect(shed + 8, roof, 1, 3, 'N'), pRect(shed + shedW - 9, roof, 1, 3, 'N');

    // sign: jeepney pictogram over the stop name
    const signW = textWidth(info.name) + 6, pole = x1 - (signW >> 1) - 4;
    const left = pole - (signW >> 1), base = roof + 20; // clears the canopy
    pRect(pole - 1, roof, 3, 20, 'k'), pRect(pole, roof, 1, 20, 'S');
    pRect(left - 1, base - 1, signW + 2, 19, 'k');
    pRect(left, base, signW, 9, info.c);
    pRect(left, base + 9, signW, 8, 'w');
    JEEP_PICTO.forEach((row, r)=> [...row].forEach((c, i)=>
        c == '#' && pRect(pole - 4 + i, base + 14 - r, 1, 1, 'k')));
    sText(info.name, toScreenX(left / PX) + 3, toScreenY((base + 9) / PX) + 2, info.ink, 1, 'left', false);

    // bouncing arrow when someone aboard is getting off here
    if (riders.some(r=> r.dest == stop) && Math.floor(time * 4) % 2)
    {
        const ay = base + 26;
        pRect(pole - 6, ay + 1, 13, 1, 'k');
        for (let i = 0; i < 6; ++i)
            pRect(pole - 5 + i, ay - i, 11 - i*2, 1, i == 5 ? 'k' : info.c);
    }
}

function drawBoard(b)
{
    const u = 1/PX, w = b.x1 - b.x0, cx = (b.x0 + b.x1) / 2, panel = sprites['ad' + b.ad];
    // pole down into the ground (the road covers the bottom)
    wRect(cx - .25, -2, .5, b.y, palColor('S'));
    wRect(cx - .25, -2, u, b.y, palColor('s'));
    // the ad panel hangs under the walkable top beam
    drawSprite('ad' + b.ad, vec2(cx, b.y - .25 - panel.h / PX));
    wRect(b.x0 - u, b.y - .25, w + u*2, .25, palColor('D'));
    wRect(b.x0 - u, b.y - u, w + u*2, u, palColor('s'));
}

function drawDeck(d)
{
    const u = 1/PX, w = d.x1 - d.x0;
    for (let x = d.x0 + 2; x < d.x1 - 1; x += 8)
    {
        wRect(x, -2, 1, d.y - .75 + 2, palColor('S'));
        wRect(x, -2, u, d.y - .75 + 2, palColor('s'));
        wRect(x - .25, d.y - 1, 1.5, .25, palColor('S'));
    }
    wRect(d.x0, d.y - .75, w, .75, palColor('s'));
    wRect(d.x0, d.y - .75, w, u, palColor('d'));
    wRect(d.x0, d.y - .375, w, u, palColor('S'));
    // rail ties
    for (let x = d.x0; x < d.x1; x += .5)
        wRect(x, d.y - u, u * 2, u, palColor('N'));
}

function drawDeco(d)
{
    const u = 1/PX;
    if (d.type == 'lamp')
    {
        wRect(d.x, 0, u, 2.5, palColor('D'));
        wRect(d.x, 2.5 - u, .5, u, palColor('D'));
        wRect(d.x + .375, 2.25, .25, .25, palColor('Y'));
    }
    else
    {
        for (let i = 0; i < 6; ++i) // leaning trunk
            wRect(d.x + Math.floor(i / 2) * u, i * .5, .25, .5, palColor(i % 2 ? 'N' : 'n'));
        const top = vec2(d.x + 3*u, 3);
        wRect(top.x - 1, top.y - .125, 2.25, .25, palColor('G'));
        wRect(top.x - .75, top.y + .125, 1.75, .25, palColor('g'));
        wRect(top.x - 1.25, top.y - .375, .375, .25, palColor('G'));
        wRect(top.x + 1, top.y - .375, .375, .25, palColor('G'));
    }
}

function drawPerson(p)
{
    const shirt = p.dest ? STOPS[p.dest.type].c : 'S';
    let pose = 'stand';
    if (p.state == 'wait')
        pose = p.full ? 'stand' : Math.floor(p.t * 4) % 2 ? 'wave0' : 'wave1';
    else if (p.state == 'arrived')
        pose = Math.floor(p.t * 3) % 2 ? 'cheer' : 'stand';
    else if (p.state == 'bail')
        pose = 'cheer';
    const hop = p.state == 'arrived' && pose == 'cheer' ? 2/PX : 0;
    drawSprite(personSprite(pose, shirt, p.skin), vec2(p.x, p.y + hop), p.state == 'wait');
}

function drawJeep()
{
    const s = sprites.jeep;
    drawSprite('jeep', vec2(jeep.x, jeep.y));

    // map pixel (col, row) of the jeepney sprite, h rows tall going down
    const left = Math.round(jeep.x * PX - s.w/2) + 1, top = Math.round(jeep.y * PX) + 13;
    const px = (col, row, h, char)=> wRect((left + col) / PX, (top - row - h + 1) / PX, 1/PX, h/PX, palColor(char));

    // riders in the windows: head over a shirt in their stop's color
    riders.forEach((r, i)=>
    {
        px(SEAT_COLS[i], 3, 1, r.skin);
        px(SEAT_COLS[i], 4, 1, STOPS[r.dest.type].c);
    });

    // a rider whose stop is coming up calls out from their window
    const caller = riders.findIndex(r=> !r.dest.passed && r.dest.x0 - jeep.x < PARA_PO_RANGE);
    if (caller >= 0)
    {
        const w = textWidth(PARA_PO) + 4, h = 9, seat = left + SEAT_COLS[caller];
        const bx = clamp(seat - 8, left - 6, left + s.w - w), by = top + 6;
        pRect(seat - 1, top + 2, 3, by - top - 2, 'k');
        pRect(bx - 1, by - 1, w + 2, h + 2, 'k');
        pRect(bx, by, w, h, 'w');
        pRect(seat, top + 3, 1, by - top - 2, 'w');
        pRect(bx + 2, by + 1, w - 4, 1, STOPS[riders[caller].dest.type].c);
        sText(PARA_PO, toScreenX((bx + 2) / PX), toScreenY((by + h) / PX) + 2, 'k', 1, 'left', false);
    }

    // booster flames
    if (jeep.boost > 0)
    for (const col of NOZZLE_COLS)
    {
        const len = randInt(3, 7);
        px(col, 13, len, 'o');
        px(col, 13, len - 1, 'Y');
        px(col, 13, 1, 'w');
        px(col - 1, 13, len >> 1, 'r');
        px(col + 1, 13, len >> 1, 'r');
    }
}

function drawRoad(left, right)
{
    const u = 1/PX, bottom = cameraPos.y - viewH/2 - 1;

    // canal: dark trench walls, then water
    wRect(left, -1.5, right - left, 1.5, palColor('e'));
    wRect(left, bottom, right - left, -1.5 - bottom, palColor('B'));
    wRect(left, -1.75, right - left, .25, palColor('b'));
    const wave = Math.floor(time * 8);
    for (let x = Math.floor(left); x < right; x += 1)
        wRect(x + ((x + wave) % 4) * u * 2, -1.5 - u, .5, u, palColor('c'));

    for (const r of roads)
    {
        if (r.x1 < left || r.x0 > right) continue;
        const x0 = max(r.x0, left), x1 = min(r.x1, right), w = x1 - x0;
        // earth wall with bricks
        wRect(x0, bottom, w, -1.25 - bottom, palColor('N'));
        for (let row = 0, y = -2.25; y > bottom - 1; y -= 1, ++row)
        {
            wRect(x0, y + 1 - u, w, u, palColor('m'));
            for (let x = Math.floor(x0) + (row % 2); x < x1; x += 2)
                if (x > r.x0)
                    wRect(x, y, u, 1, palColor('m'));
        }
        // asphalt with lane dashes
        wRect(x0, -1.25, w, 1, palColor('D'));
        for (let x = Math.ceil(r.x0 / 3) * 3; x < r.x1; x += 3)
            if (x + 1.25 > x0 && x < x1)
                wRect(max(x, x0), -.75, min(1.25, x1 - max(x, x0)), u, palColor('Y'));
        // curb
        wRect(x0, -.25, w, .25, palColor('S'));
        wRect(x0, -u, w, u, palColor('s'));
        // canal edges
        if (r.x0 > left)
            wRect(r.x0, bottom, u * 2, -bottom, palColor('S'));
        if (r.x1 < right)
            wRect(r.x1 - u * 2, bottom, u * 2, -bottom, palColor('S'));
    }
}

function gameRenderPost()
{
    // popups blink out at the end instead of fading
    for (const p of popups)
        if (p.age < .9 || Math.floor(p.age * 16) % 2)
            sText(p.text, toScreenX(p.x), toScreenY(p.y), p.color, 1, 'center');

    if (gameState != 'title')
        drawStopMarkers();
    drawHud();

    if (gameState == 'title')
        drawTitle();
    else if (gameState == 'over' && stateTimer > .5)
        drawGameOver();
}

// a riders' stop that is off screen gets a marker at the edge pointing at it
function drawStopMarkers()
{
    const seen = new Set;
    for (const r of riders)
    {
        const s = r.dest;
        if (seen.has(s)) continue;
        seen.add(s);
        // off screen once the whole roof is past the right edge or above the hud
        const sx = toScreenX((s.x0 + s.x1) / 2), sy = toScreenY(s.y);
        const offRight = toScreenX(s.x0) > screenW, offTop = sy < 16;
        if (!offRight && !offTop) continue;
        const x = Math.min(sx, screenW - 12), y = clamp(sy, 20, screenH - 12);
        const c = palColor(STOPS[s.type].c), k = palColor('k');
        sRect(x - 1, y - 1, 11, 11, k);
        sRect(x, y, 9, 9, c);
        // solid triangle pointing at the stop
        for (let i = 0; i < 4; ++i)
            offTop && !offRight ?
                sRect(x + 4 - i, y + 2 + i, i*2 + 1, 1, k) :
                sRect(x + 5 - i, y + 4 - i, 1, i*2 + 1, k);
    }
}

function drawHud()
{
    if (gameState == 'title') return;
    sText('$' + fares, 4, 4, 'Y', 2);
    sText(distance() + 'M', screenW - 4, 4, 'w', 2, 'right');

    // seats
    const x0 = Math.round(screenW/2 - SEATS * 4);
    sRect(x0 - 2, 2, SEATS * 8 + 3, 11, palColor('k'));
    for (let i = 0; i < SEATS; ++i)
    {
        const r = riders[i];
        sRect(x0 + i * 8, 4, 7, 7, palColor(r ? STOPS[r.dest.type].c : 'e'));
        if (r)
            sRect(x0 + i * 8 + 2, 5, 3, 2, palColor(r.skin));
    }
}

function drawTitle()
{
    const blink = Math.floor(time * 2) % 2;
    sText('JUMPING', screenW/2, 14, 'Y', 4, 'center');
    sText('JEEPNEY', screenW/2, 38, 'r', 4, 'center');
    sPanel(40, 64, 160, 30);
    sText('TAP OR SPACE TO JUMP', screenW/2, 68, 'w', 1, 'center', false);
    sText('TAP AGAIN IN THE AIR TO DOUBLE JUMP', screenW/2, 76, 's', 1, 'center', false);
    sText('LAND ON THE STOP THAT MATCHES THE SHIRT', screenW/2, 84, 's', 1, 'center', false);
    if (save.best)
        sText('BEST $' + save.best + '  ' + save.bestDist + 'M', screenW/2, 100, 'Y', 1, 'center');
    if (blink)
        sText('PRESS TO DRIVE', screenW/2, 112, 'w', 2, 'center');
}

function drawGameOver()
{
    sPanel(60, 30, 120, 74);
    sText('SPLASH!', screenW/2, 36, 'c', 3, 'center');
    sText('FARES', 72, 58, 's');
    sText('$' + fares, 168, 58, 'Y', 1, 'right');
    sText('DISTANCE', 72, 66, 's');
    sText(distance() + 'M', 168, 66, 'w', 1, 'right');
    sText('DELIVERED', 72, 74, 's');
    sText(delivered + '', 168, 74, 'g', 1, 'right');
    sText('BEST', 72, 82, 's');
    sText('$' + save.best + ' ' + save.bestDist + 'M', 168, 82, 'Y', 1, 'right');
    if (stateTimer > 1 && Math.floor(time * 2) % 2)
        sText('PRESS TO DRIVE AGAIN', screenW/2, 94, 'w', 1, 'center');
}

///////////////////////////////////////////////////////////////////////////////
engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost, [buildSpriteSheet()]);
