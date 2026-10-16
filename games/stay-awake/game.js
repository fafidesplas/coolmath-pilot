/*
    Stay Awake — incremental clicker prototype about surviving a college lecture
    - Wes Anderson style: a dead-center, symmetrical shot of one student in a
      pastel lecture hall, framed by chapter title cards
    - The wakefulness bar drains nonstop; click (or Space) to blink yourself awake
    - Off screen, the professor drones on in gibberish (subtitled at the bottom)
    - Being awake takes notes; notes buy skills: active tricks (pinch yourself,
      tickle the roof of your mouth...) that wear off if you spam them, and
      passive habits (tap your foot, chew gum...) that keep you up on their own
    - Every lecture is more boring than the last. Pass with a C or better.
    - Layout: stats in the left column, a close-up portrait of the hero in the
      middle (classmates only peek in at the edges), the professor's subtitles
      and cold calls in the right column, skills along the bottom
    - Pixel art: the game renders at 480x270. The scene is painted at 240x108 and
      drawn 3x, cropped to the portrait. Sprites are text maps packed into one sheet.
*/

'use strict';
debugWatermark = false;

const screenW = 480, screenH = 270;
setCanvasFixedSize(vec2(screenW, screenH));
setCanvasPixelated(true);

// screen columns (screen px): stats | portrait | professor
const STATS_W = 120, PORTRAIT_W = 210;
const PORTRAIT_X = STATS_W, PORTRAIT_CX = PORTRAIT_X + PORTRAIT_W / 2;
const PROF_X = PORTRAIT_X + PORTRAIT_W, PROF_W = screenW - PROF_X;

const SC = 3;                 // scene pixel scale
const SCENE_W = 240, SCENE_H = 108;
const VIEW_W = PORTRAIT_W / SC, VIEW_H = 72; // the slice of the scene on camera (scene px)
const CAM_X = (SCENE_W - VIEW_W) / 2;        // camera top left (scene px), centered on the hero
const CAM_Y = 28;
const PANEL_Y = VIEW_H * SC;  // skill panel top (screen px)
const LECTURE_TIME = 75;      // seconds per lecture (1 second = 1 minute on the wall clock)
const FOCUS_CURVE = 4;        // how sharply note taking speeds up near full wake (higher = steeper end)

///////////////////////////////////////////////////////////////////////////////
// palette: pastel Grand Budapest family, same dark outline as the other prototypes

const pal =
{
    k:'#181425', w:'#ffffff', q:'#f7e6cf', a:'#f2b8c6', A:'#d98ea3', m:'#e9b44c', M:'#b9822e',
    g:'#9ed8be', G:'#4f9a8a', r:'#d9434b', R:'#8c2f39', E:'#5e1f2a', b:'#6c93c9', B:'#2f4a7a',
    c:'#cfeef5', C:'#8cc3d6', s:'#c0cbdc', S:'#8b9bb4', h:'#6b4226', H:'#3a2418', y:'#fee761',
    o:'#e8813a', v:'#a98bc8', e:'#262b44', t:'#f2c4a0', u:'#d79c78', n:'#b97a52', N:'#8e5638',
    d:'#6e4430', D:'#4e2e20', p:'#f48fb1', i:'#a8e6ff', l:'#c98a5a', L:'#9a5f3c',
    f:'#ec9c9c', T:'#ead4aa',
};
const colorCache = {};
const palColor = (char, a=1)=> (colorCache[char] || (colorCache[char] = new Color().setHex(pal[char]))).scale(1, a);

///////////////////////////////////////////////////////////////////////////////
// lectures, skills, professor vocabulary

const PROF = 'PROF. HUMBOLDT';
const LECTURES =
[
    {course:'ECONOMICS 101', subject:'econ',         drain:4,    words:['SUPPLY','DEMAND','MARGINAL','UTILITY','ELASTIC','CURVE','GDP']},
    {course:'INTRO TO STATISTICS', subject:'stats',   drain:6,    words:['MEAN','VARIANCE','SIGMA','REGRESSION','SAMPLE','NULL']},
    {course:'ORGANIC CHEMISTRY', subject:'chem',     drain:8,    words:['BENZENE','CARBON','ALKANE','METHYL','ISOMER','BOND']},
    {course:'MEDIEVAL TAX LAW', subject:'tax',      drain:10.5, words:['TITHE','FIEF','SERF','LEVY','BARON','DUCAT']},
    {course:'PHILOSOPHY OF BEIGE', subject:'beige',   drain:13.5, words:['BEIGE','BEING','TAUPE','ESSENCE','NEUTRAL','KANT']},
    {course:'ADVANCED SPREADSHEETS', subject:'sheets', drain:17,   words:['CELL','VLOOKUP','PIVOT','COLUMN','MACRO','ROW']},
    {course:'A HISTORY OF CARPET', subject:'carpet',   drain:21,   words:['PILE','SHAG','LOOP','BERBER','FIBER','RUG']},
    {course:'FINAL EXAM REVIEW', subject:'exam',     drain:26,   words:['EXAM','CHAPTER','REVIEW','WILL','BE','ON','IT']},
];
const CHAPTER_WORDS = ['ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT'];
const SYLLABLES = ['BLOR','MUB','FEN','WOM','GRA','DUL','NIX','PLU','TASH','VOR','SNOD','KRIM','BAL','OOM','ZEP','MOR','FLIB','DRA','QUO','PUN'];
const FILLER = ['AND','THE','SO','UHH','OF','WHICH','IS','BASICALLY','UM','THEREFORE','IN','A','HMM','RIGHT'];
const QUESTIONS = ['WHAT DO YOU THINK, BEANIE?','YOU, FRONT ROW. THOUGHTS?','AND THE ANSWER IS... YOU THERE?','AM I BORING YOU, YOUNG SCHOLAR?'];
// cold call answers: one comes from the current course, the others from anywhere else
const ANSWER_BANK =
{
    econ:   ['SUPPLY AND DEMAND','THE INVISIBLE HAND','OPPORTUNITY COST','DIMINISHING RETURNS','A PRICE CEILING'],
    stats:  ['THE STANDARD DEVIATION','A P-VALUE OF 0.05','THE BELL CURVE','THE NULL HYPOTHESIS','REGRESSION TO THE MEAN'],
    chem:   ['HYDROGEN ATOMS','A BENZENE RING','COVALENT BONDS','THE METHYL GROUP',"AVOGADRO'S NUMBER"],
    tax:    ['THE TITHE','A FEUDAL LEVY','THE DOMESDAY BOOK','SCUTAGE','TWO GOATS AND A DUCAT'],
    beige:  ['KANT','THE ESSENCE OF TAUPE','BEING AND NOTHINGNESS','NEUTRALITY',"PLATO'S CAVE"],
    sheets: ['VLOOKUP','A PIVOT TABLE','CELL B12','CONDITIONAL FORMATTING','A CIRCULAR REFERENCE'],
    carpet: ['SHAG PILE','BERBER LOOPS','WALL-TO-WALL','THE PERSIAN RUG','UNDERLAY'],
    exam:   ['IT WILL BE ON THE EXAM','CHAPTERS 1 THROUGH 9','OPEN BOOK','NO CALCULATORS','THE SYLLABUS'],
    math:   ['SQUARE ROOT OF 923','PI TO SIX DIGITS','THE QUADRATIC FORMULA','A RIGHT ANGLE'],
    history:['BENJAMIN FRANKLIN','THE BOSTON TEA PARTY','NAPOLEON','THE MAGNA CARTA'],
    bio:    ['THE MITOCHONDRIA','PHOTOSYNTHESIS',"A FROG'S PANCREAS",'MITOSIS'],
    lit:    ['MOBY DICK','IAMBIC PENTAMETER','HAMLET','THE GREAT GATSBY'],
};
const QUESTION_TIME = 5;

// type: click (blink power), active (button with tolerance), regen (wake/s), drain (% slower), notes (% more)
const SKILLS =
[
    {id:'eyes',   name:'WIDEN YOUR EYES',              type:'click',  cost:5,    growth:1.6, max:10, power:2,  icon:'iEye'},
    {id:'pinch',  name:'PINCH YOURSELF',               type:'active', cost:10,   growth:1.7, max:10, power:14, perLvl:5,  tol:.35, tolDecay:.12,  anim:'pinch',  word:'OW!',   icon:'iPinch'},
    {id:'foot',   name:'TAP YOUR FOOT',                type:'regen',  cost:25,   growth:1.6, max:10, regen:1.2, icon:'iShoe'},
    {id:'mouth',  name:'TICKLE THE ROOF OF YOUR MOUTH', type:'active', cost:45,  growth:1.7, max:10, power:24, perLvl:7,  tol:.45, tolDecay:.1,   anim:'tickle', word:'HEHEH', icon:'iTongue'},
    {id:'gum',    name:'CHEW MINT GUM',                type:'regen',  cost:90,   growth:1.6, max:10, regen:2.5, icon:'iGum'},
    {id:'posture',name:'SIT UP STRAIGHT',              type:'drain',  cost:140,  growth:1.9, max:5,  reduce:.08, icon:'iUp'},
    {id:'slap',   name:'SLAP YOUR CHEEKS',             type:'active', cost:220,  growth:1.7, max:10, power:40, perLvl:10, tol:.55, tolDecay:.08,  anim:'slap',   word:'SLAP!', icon:'iHand'},
    {id:'pens',   name:'COLOR-CODED PENS',             type:'notes',  cost:300,  growth:1.8, max:8,  mult:.5, icon:'iPens'},
    {id:'doodle', name:'DOODLE IN THE MARGINS',        type:'regen',  cost:480,  growth:1.6, max:10, regen:5, icon:'iPencil'},
    {id:'brew',   name:'SNEAK A COLD BREW',            type:'active', cost:750,  growth:1.7, max:10, power:50, perLvl:12, tol:.9,  tolDecay:.045, anim:'brew',   word:'SLURP', icon:'iCup', buff:8, buffRegen:5},
    {id:'ice',    name:'ICE CUBE DOWN YOUR SHIRT',     type:'active', cost:1200, growth:1.8, max:5,  power:100, perLvl:0, tol:1,   tolDecay:.03,  anim:'ice',    word:'BRRR!', icon:'iIce', freeze:5},
];
const ACTIVES = SKILLS.filter(s=> s.type == 'active');

const skillCost = (s)=> Math.round(s.cost * Math.pow(s.growth, levels[s.id]));
const skillPower = (s)=> s.power + (s.perLvl || 0) * (levels[s.id] - 1);

function skillDesc(s)
{
    const lv = max(1, levels[s.id]);
    if (s.type == 'click')  return 'BLINKING GIVES +' + s.power*lv + ' MORE WAKE';
    if (s.type == 'regen')  return '+' + (s.regen*lv).toFixed(1) + ' WAKE EVERY SECOND';
    if (s.type == 'drain')  return 'THE LECTURE DRAINS ' + Math.round(s.reduce*lv*100) + '% SLOWER';
    if (s.type == 'notes')  return '+' + Math.round(s.mult*lv*100) + '% NOTES TAKEN';
    let text = '+' + (levels[s.id] ? skillPower(s) : s.power) + ' WAKE';
    if (s.buff)   text += ', THEN +' + s.buffRegen + '/S FOR ' + s.buff + 'S';
    if (s.freeze) text += ', NO DRAIN FOR ' + s.freeze + 'S';
    return text + '. WEARS OFF IF SPAMMED';
}

///////////////////////////////////////////////////////////////////////////////
// sprites: small items are text maps, one character per pixel, '.' is transparent
// every map (including the procedural people below) gets a dark 1 pixel outline added automatically

const spriteMaps =
{
    cup: [
        '....r.',
        '...r..',
        'ssssss',
        '.hhhh.',
        '.hqqh.',
        '.hqqh.',
        '.hhhh.',
        '..hh..'],
    note: [
        'qqqqqq..',
        'qbbbbqq.',
        'qqqqqqqq',
        'qbbbbbbq',
        'qqqqqqqq',
        'qbbbbbbq',
        'qqqqqqqq'],
    iEye: [
        '...........',
        '...........',
        '...wwwww...',
        '..wwbbbww..',
        '.wwbBkBbww.',
        '.wwbBkBbww.',
        '..wwbbbww..',
        '...wwwww...',
        '...........',
        '...........',
        '...........'],
    iPinch: [
        '..y.....y..',
        '...y...y...',
        '...........',
        '.ttt...ttt.',
        '..ttt.ttt..',
        '...ttrttu..',
        '...utttu...',
        '....ttt....',
        '....ttt....',
        '....ttt....',
        '...........'],
    iShoe: [
        '...........',
        '...........',
        '..bbb......',
        '..bwb......',
        '..bwbbb....',
        '..bwwwbbb..',
        '.bbbbbbbbb.',
        '.bbbbbbbbbb',
        '.wwwwwwwwww',
        '...........',
        '...........'],
    iTongue: [
        '...........',
        '...........',
        '..rrrrrrr..',
        '.rwwwwwwwr.',
        '.rkkkkkkkr.',
        '.rkkpppkkr.',
        '.rkppppppr.',
        '..rpppppr..',
        '...rrrrr...',
        '...........',
        '...........'],
    iGum: [
        '...ppppp...',
        '..ppppppp..',
        '.pwwpppppp.',
        '.pwppppppp.',
        '.ppppppppp.',
        '.ppppppppp.',
        '.ppppppppp.',
        '..ppppppp..',
        '...ppppp...',
        '...........',
        '...........'],
    iUp: [
        '.....g.....',
        '....ggg....',
        '...ggggg...',
        '..ggggggg..',
        '....ggg....',
        '....ggg....',
        '....ggg....',
        '....ggg....',
        '....ggg....',
        '...........',
        '...........'],
    iHand: [
        '...t.t.t...',
        '.t.t.t.t...',
        '.t.t.t.t...',
        '.ttttttt...',
        '.ttttttt.t.',
        '.tttttttt..',
        '.ttttttt...',
        '..ttttt....',
        '..ttttt....',
        '...........',
        '...........'],
    iPens: [
        '..r..b..g..',
        '..r..b..g..',
        '..r..b..g..',
        '..r..b..g..',
        '..r..b..g..',
        '..r..b..g..',
        '..s..s..s..',
        '..k..k..k..',
        '...........',
        '...........',
        '...........'],
    iPencil: [
        '.........mm',
        '........mmm',
        '.......mmm.',
        '......mmm..',
        '.....mmm...',
        '....mmm....',
        '...mmm.....',
        '..qqq......',
        '.qqq.......',
        '.kq........',
        '...........'],
    iCup: [
        '.......r...',
        '......r....',
        '..sssssss..',
        '..shhhhhs..',
        '..shhhhhs..',
        '..sqqqqqs..',
        '..sqHHHqs..',
        '..sqqqqqs..',
        '..shhhhhs..',
        '...shhhs...',
        '...........'],
    iIce: [
        '...........',
        '..iiiiiii..',
        '.iwwiiiiii.',
        '.iwiiiiiii.',
        '.iiiiiiiCi.',
        '.iiiiiiiCi.',
        '.iiiiiiiCi.',
        '.iiiiiCCCi.',
        '..iiiiiii..',
        '.....c.....',
        '....c.c....'],
};

// people: painted procedurally onto character grids with placeholder colors
// (x/X hair, z/Z skin, j/J clothes) that every person recolors their own way

function charGrid(w, h)
{
    const g = Array.from({length: h}, ()=> Array(w).fill('.'));
    const set = (x, y, c)=> { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = c; };
    const rect = (x, y, rw, rh, c)=> { for (let j = 0; j < rh; ++j) for (let i = 0; i < rw; ++i) set(x + i, y + j, c); };
    const sym = (x, y, rw, rh, c)=> { rect(x, y, rw, rh, c); rect(w - x - rw, y, rw, rh, c); };
    const ellipse = (cx, cy, rx, ry, c, test)=>
    {
        for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x)
        {
            const dx = (x + .5 - cx) / rx, dy = (y + .5 - cy) / ry;
            if (dx*dx + dy*dy <= 1 && (!test || test(x, y))) set(x, y, c);
        }
    };
    const swap = (from, to, test)=>
    {
        for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x)
            if (g[y][x] == from && test(x, y)) g[y][x] = to;
    };
    return {set, rect, sym, ellipse, swap, map: ()=> g.map(row=> row.join(''))};
}

const HAIR_STYLES =
{
    short: (g)=>
    {
        g.ellipse(11, 9, 8.5, 8, 'x', (x, y)=> y <= 7 || ((x <= 4 || x >= 17) && y <= 11));
        for (let x = 5; x <= 16; x += 3) g.set(x, 8, 'x');
        g.rect(7, 2, 4, 1, 'X');
    },
    bob: (g)=>
    {
        g.ellipse(11, 10, 9.5, 10, 'x', (x, y)=> y <= 8 || ((x <= 4 || x >= 17) && y <= 18));
        g.swap('x', 'X', (x, y)=> y == 18 || (y < 8 && (x + y) % 5 == 0));
        g.rect(14, 5, 4, 1, 'r'); // barrette
    },
    curly: (g)=>
    {
        g.ellipse(11, 8, 9.5, 8, 'x', (x, y)=> y <= 7 || ((x <= 4 || x >= 17) && y <= 12));
        for (let x = 3; x <= 19; x += 4) g.ellipse(x, 2.5, 2.4, 2.4, 'x');
        g.swap('x', 'X', (x, y)=> (x*7 + y*5) % 6 == 0);
    },
    bun: (g)=>
    {
        HAIR_STYLES.short(g);
        g.ellipse(11, 1.5, 3.5, 2, 'x');
        g.rect(10, 1, 2, 1, 'X');
    },
    beanie: (g)=>
    {
        g.ellipse(11, 9, 8.5, 8.5, 'r', (x, y)=> y <= 7);
        g.rect(3, 6, 16, 3, 'R');
        for (let x = 4; x < 11; x += 2) g.sym(x, 7, 1, 1, 'E');
        g.sym(4, 9, 1, 3, 'x');
    },
};

// 22x24: face, ears, brows, eye whites (pupils and lids are drawn live), neck
function makeHead(hair, glasses)
{
    const g = charGrid(22, 24);
    g.rect(8, 19, 6, 5, 'Z');
    g.ellipse(11, 12, 7, 9.5, 'z');
    g.sym(2, 11, 2, 4, 'z');
    g.sym(3, 12, 1, 2, 'Z');
    g.sym(6, 9, 3, 1, 'X');
    g.sym(6, 11, 3, 2, 'w');
    g.rect(10, 15, 2, 1, 'Z');
    g.sym(5, 15, 2, 1, 'f');
    g.rect(9, 18, 4, 1, 'E');
    HAIR_STYLES[hair](g);
    if (glasses)
    {
        for (const x0 of [5, 12])
        {
            g.rect(x0, 10, 5, 1, 'H');
            g.rect(x0, 13, 5, 1, 'H');
            g.rect(x0, 10, 1, 4, 'H');
            g.rect(x0 + 4, 10, 1, 4, 'H');
        }
        g.rect(10, 11, 2, 1, 'H');
        g.sym(3, 11, 2, 1, 'H');
    }
    return g.map();
}

// 34x26: shoulders and chest (arms are drawn live as thick strokes)
function makeTorso(style)
{
    const g = charGrid(34, 26);
    g.rect(13, 0, 8, 6, 'Z');
    g.ellipse(17, 18, 17, 15, 'j', (x, y)=> y >= 4);
    g.swap('j', 'J', (x)=> x <= 2 || x >= 31);
    if (style == 'jacket') // corduroy, teal shirt, lapel pin
    {
        g.swap('j', 'J', (x, y)=> x % 3 == 0 && y >= 7);
        for (let y = 4; y < 15; ++y)
        {
            const w = Math.round(4 - (y - 4) * .4);
            if (w <= 0) break;
            g.rect(17 - w, y, w*2, 1, 'g');
            g.set(16 - w, y, 'M');
            g.set(17 + w, y, 'M');
        }
        g.set(9, 12, 'r');
        g.set(17, 19, 'k');
        g.set(17, 23, 'k');
    }
    else if (style == 'coat') // fur collar over a striped dress
    {
        g.rect(15, 8, 4, 8, 'b');
        g.swap('b', 'q', (x, y)=> y % 2 == 0);
        g.ellipse(17, 5, 10, 4.5, 'T', (x, y)=> y >= 4 && (y < 7 || x < 15 || x > 18));
        g.swap('T', 'q', (x, y)=> (x + y*2) % 3 == 0);
    }
    else if (style == 'track') // zip-up tracksuit
    {
        g.rect(12, 4, 10, 2, 'J');
        g.rect(16, 6, 2, 20, 'q');
    }
    else // crew-neck sweater with a shirt collar
    {
        g.ellipse(17, 4, 6, 2.5, 'J', (x, y)=> y >= 4);
        g.sym(12, 5, 3, 2, 'q');
    }
    return g.map();
}

const HAND_MAP = ['.zzzz.', 'zzzzzz', 'zzzzzz', 'zzzzZz', '.zZZz.'];

// layout (scene pixels): the hero sits mid-row, dead center, a row behind and a row in front
// the camera crops everyone else: the back row shows torsos, the front row the tops of heads
const BACK_Y = 6, MID_Y = 38, FRONT_Y = 90; // head tops of the back, hero's and front rows
const NEIGHBOR_GAP = 47;  // hero to neighbor, far enough that only a shoulder is on camera
const SKIN_TONES = [['t','u'], ['n','N'], ['d','D']];
const HAIR_COLORS = [['h','H'], ['H','k'], ['y','m'], ['k','e'], ['o','N'], ['M','N']];
const CLOTHES = [['g','G'], ['b','B'], ['v','e'], ['s','S'], ['o','R'], ['q','A'], ['G','e'], ['A','R']];

let decoSeed = 11;
const decoRand = ()=> (decoSeed = (decoSeed*16807) % 2147483647) / 2147483647;
const pickDeco = (list)=> list[decoRand()*list.length|0];

function makePerson(x, row, look={})
{
    const skin = look.skin || pickDeco(SKIN_TONES), hair = look.hairColor || pickDeco(HAIR_COLORS);
    const clothes = look.clothes || pickDeco(CLOTHES);
    return {x, row, baseY: row == 'back' ? BACK_Y : row == 'front' ? FRONT_Y : MID_Y, role: look.role || 'extra',
        hair: look.hair || pickDeco(['short','bob','curly','bun']), torsoStyle: look.torso || 'crew',
        glasses: look.glasses, eyeliner: look.eyeliner, stripe: look.stripe, laptop: look.laptop,
        skin: skin[0], skinShade: skin[1], sleeve: clothes[0],
        recolor: {x: hair[0], X: hair[1], z: skin[0], Z: skin[1], j: clothes[0], J: clothes[1]},
        sleepAt: .15 + decoRand()*1.3, phase: decoRand()*10,
        state: 'listen', timer: 2 + decoRand()*4, glance: 0, handL: vec2(x - 10, 86), handR: vec2(x + 10, 86)};
}

const backRow = [10, 54, 98, 142, 186, 230].map(x=> makePerson(x, 'back', {laptop: decoRand() < .3}));
const margot = makePerson(120 - NEIGHBOR_GAP, 'mid', {role:'margot', hair:'bob', torso:'coat', eyeliner:true,
    skin:['t','u'], hairColor:['y','m'], clothes:['l','L']});
const chas = makePerson(120 + NEIGHBOR_GAP, 'mid', {role:'chas', hair:'curly', torso:'track', stripe:true,
    skin:['n','N'], hairColor:['H','k'], clothes:['r','R']});
const hero = makePerson(120, 'mid', {role:'player', hair:'beanie', torso:'jacket', glasses:true,
    skin:['t','u'], hairColor:['h','H'], clothes:['m','M']});
const neighbors = [margot, chas];
const midRow = [hero, margot, chas];
// the row in front faces the professor too: just their heads and shoulders, cut off by the frame
const frontRow = [10, 54, 98, 142, 186, 230].map(x=> makePerson(x, 'front'));
const people = [...backRow, ...midRow, ...frontRow];
people.forEach((p, i)=> p.id = i);
const sprites = {}; // name -> {x, y, w, h, tileInfo}

function buildSpriteSheet()
{
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    let cx = 0, cy = 0, rowH = 0;

    const filled = (map, x, y)=> map[y] && map[y][x] && map[y][x] != '.';
    const isOutline = (map, x, y)=> !filled(map, x, y) &&
        (filled(map, x-1, y) || filled(map, x+1, y) || filled(map, x, y-1) || filled(map, x, y+1));
    const addMap = (name, map, recolor={})=>
    {
        ASSERT(map.every(row=> row.length == map[0].length), 'sprite rows must match: ' + name);
        // one pixel of padding all around for the outline
        const w = map[0].length + 2, h = map.length + 2;
        if (cx + w + 1 > size)
            cx = 0, cy += rowH + 1, rowH = 0;
        for (let y = 0; y < h; ++y)
        for (let x = 0; x < w; ++x)
        {
            const mx = x - 1, my = y - 1;
            const color = isOutline(map, mx, my) ? pal.k : filled(map, mx, my) ? pal[recolor[map[my][mx]] || map[my][mx]] : 0;
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(cx + x, cy + y, 1, 1);
        }
        sprites[name] = {x: cx, y: cy, w, h};
        cx += w + 1;
        rowH = max(rowH, h);
    };

    for (const name in spriteMaps)
        addMap(name, spriteMaps[name]);
    for (const p of people)
    {
        addMap('head' + p.id, makeHead(p.hair, p.glasses), p.recolor);
        addMap('torso' + p.id, makeTorso(p.torsoStyle), p.recolor);
        addMap('hand' + p.id, HAND_MAP, p.recolor);
    }
    return canvas.toDataURL();
}

///////////////////////////////////////////////////////////////////////////////
// static painters: the back wall, the back row's counter, and the hero's desk
// (separate layers so each row of people can sit between them)

function makePainter(w, h)
{
    const canvas = document.createElement('canvas');
    canvas.width = w, canvas.height = h;
    const ctx = canvas.getContext('2d');
    const fill = (x, y, rw, rh, c)=> { ctx.fillStyle = pal[c] || c; ctx.fillRect(x, y, rw, rh); };
    const dot = (x, y, c)=> fill(x, y, 1, 1, c);
    // mirror around the center line so the shot stays perfectly symmetrical
    const fillSym = (x, y, rw, rh, c)=> { fill(x, y, rw, rh, c); fill(w - x - rw, y, rw, rh, c); };
    return {canvas, fill, dot, fillSym};
}

function buildWall()
{
    const {canvas, fill, dot, fillSym} = makePainter(SCENE_W, SCENE_H);
    fill(0, 0, SCENE_W, SCENE_H, 'a');
    for (let x = 3; x < SCENE_W/2; x += 10)
        fillSym(x, 4, 2, 32, '#ebadbd');
    fill(0, 0, SCENE_W, 3, 'q');
    fill(0, 3, SCENE_W, 1, 'A');

    // wainscot behind the back row
    fill(0, 36, SCENE_W, 1, 'q');
    fill(0, 37, SCENE_W, 15, 'A');
    for (let x = 4; x < SCENE_W/2; x += 22)
    {
        fillSym(x, 40, 18, 10, '#c97f94');
        fillSym(x + 1, 41, 16, 8, 'A');
    }

    // sconces
    for (const sx of [76, 164])
    {
        fill(sx - 7, 13, 14, 12, '#f6c9d3');
        fill(sx - 5, 15, 10, 1, 'M');
        fill(sx - 4, 16, 8, 4, 'm');
        fill(sx - 2, 20, 4, 1, 'y');
        fill(sx - 1, 21, 2, 6, 'M');
    }

    // clock (hands are drawn live)
    for (let y = -8; y <= 8; ++y)
    for (let x = -8; x <= 8; ++x)
    {
        const d = x*x + y*y;
        if (d <= 64) dot(120 + x, 22 + y, d > 46 ? 'k' : 'q');
    }
    for (const [x, y] of [[0,-6],[6,0],[0,6],[-6,0]])
        dot(120 + x, 22 + y, 'S');
    return canvas.toDataURL();
}

function buildCounter()
{
    const {canvas, fill, fillSym} = makePainter(SCENE_W, SCENE_H);
    fill(0, 52, SCENE_W, 1, 'k');
    fill(0, 53, SCENE_W, 1, 'q');
    fill(0, 54, SCENE_W, 2, 'l');
    fill(0, 56, SCENE_W, 1, 'L');
    fill(0, 57, SCENE_W, 51, 'R');
    fill(0, 57, SCENE_W, 1, 'E');
    for (let x = 6; x < SCENE_W/2; x += 14)
        fillSym(x, 60, 1, 24, 'E');
    return canvas.toDataURL();
}

function buildDesk()
{
    const {canvas, fill, fillSym} = makePainter(SCENE_W, SCENE_H);
    fill(0, 84, SCENE_W, 1, 'k');
    fill(0, 85, SCENE_W, 4, 'l');
    fill(0, 85, SCENE_W, 1, 'q');
    fill(0, 89, SCENE_W, 1, 'L');
    fill(0, 90, SCENE_W, 18, 'R');
    for (let x = 8; x < SCENE_W/2; x += 16)
    {
        fillSym(x, 93, 12, 13, 'E');
        fillSym(x + 1, 94, 10, 11, 'R');
    }
    return canvas.toDataURL();
}

///////////////////////////////////////////////////////////////////////////////
// sound

const sndBlink   = new SoundGenerator({frequency:620, release:.04, volume:.18});
const sndPinch   = new SoundGenerator({frequency:950, slide:-1.2, release:.08, volume:.3});
const sndTickle  = new SoundGenerator({frequency:420, slide:.7, release:.12, volume:.3, repeatTime:.04});
const sndSlap    = new SoundGenerator({shape:4, bitCrush:.2, release:.09, volume:.55});
const sndSlurp   = new SoundGenerator({frequency:260, slide:.8, release:.28, noise:.3, volume:.3});
const sndIce     = new SoundGenerator({frequency:1300, slide:-1.5, release:.45, repeatTime:.05, volume:.3});
const sndBuy     = new SoundGenerator({frequency:900, release:.12, pitchJump:600, pitchJumpTime:.05, volume:.4});
const sndDeny    = new SoundGenerator({frequency:140, release:.08, volume:.25});
const sndNod     = new SoundGenerator({frequency:220, release:.1, slide:.5, volume:.25});
const sndSnore   = new SoundGenerator({frequency:70, attack:.4, release:.6, noise:.6, volume:.3});
const sndBell    = new SoundGenerator({frequency:1046, release:1.2, repeatTime:.06, volume:.3});
const sndGood    = new SoundGenerator({frequency:400, release:.3, slide:.4, repeatTime:.08, pitchJump:300, volume:.4});
const sndCaught  = new SoundGenerator({frequency:260, slide:-.5, release:.8, bitCrush:.2, volume:.45});
const sndAlert   = new SoundGenerator({frequency:700, release:.1, repeatTime:.1, pitchJump:-200, volume:.35});
// the professor: a muffled "wah" per syllable, Charlie Brown teacher style
const sndMumble  = new SoundGenerator({shape:2, frequency:150, attack:.03, release:.1, slide:-.2, filter:-700, randomness:.15, volume:.35});

///////////////////////////////////////////////////////////////////////////////
// game state

let gameState = 'title';     // title | card | class | dismissed
let notes = 0;
let levels = {};
let lectureIndex = 0;
let lectureTime = 0;
let lectureNotes = 0;
let attentiveTime = 0;
let dozeCount = 0;
let caughtCount = 0;
let wrongCount = 0;
let lastGrade = '';
let lastPassed = true;
let lastBonus = 0;
let stateTimer = 0;

let wake = 85;
let asleep = false;
let tolerance = {};          // active skill id -> 0..1
let buffTimer = 0, buffRegen = 0, freezeTimer = 0;
let nod = 0;                 // 0..1 head droop that snaps back
let blinkTimer = 2, blinkClosed = 0;
let shakeTimer = 0;
let snoreTimer = 0;
let gumTimer = 3;
let anim = {type:'', t:0, dur:1};
let floaties = [];
let zees = [];

// professor subtitles
let subWords = [], subShown = 0, subTimer = 0, subHold = 0, subColor = 'y';
let mumbleQueue = [];
let question = null;         // cold call: {lines, options, timer, picked, result}
let questionCooldown = 14;

function loadGame()
{
    const save = readSaveData('stayAwake', {notes:0, levels:{}, lecture:0});
    notes = save.notes;
    lectureIndex = save.lecture;
    for (const s of SKILLS)
        levels[s.id] = save.levels[s.id] || 0, tolerance[s.id] = 0;
}

const saveGame = ()=> writeSaveData('stayAwake', {notes, levels, lecture: lectureIndex});

function resetSave()
{
    writeSaveData('stayAwake', {notes:0, levels:{}, lecture:0});
    loadGame();
}

function currentLecture()
{
    const base = LECTURES[lectureIndex % LECTURES.length];
    const cycle = lectureIndex / LECTURES.length | 0;
    return {
        course: (cycle ? 'SUMMER SCHOOL: ' : '') + base.course,
        drain: base.drain * Math.pow(1.3, cycle),
        words: base.words,
        chapter: lectureIndex < CHAPTER_WORDS.length ? CHAPTER_WORDS[lectureIndex] : '' + (lectureIndex + 1),
    };
}

///////////////////////////////////////////////////////////////////////////////
// rates

const lectureProgress = ()=> clamp(lectureTime / LECTURE_TIME);
const blinkPower = ()=> 4 + SKILLS[0].power * levels.eyes;
const passiveRegen = ()=> SKILLS.filter(s=> s.type == 'regen').reduce((sum, s)=> sum + s.regen * levels[s.id], 0);
const drainMult = ()=> 1 - SKILLS.find(s=> s.id == 'posture').reduce * levels.posture;
const noteMult = ()=> 1 + SKILLS.find(s=> s.id == 'pens').mult * levels.pens;
// 0..1: creeps up while drowsy, then shoots up as you approach 100% awake
const focus = ()=> asleep ? 0 : (Math.exp(FOCUS_CURVE * wake / 100) - 1) / (Math.exp(FOCUS_CURVE) - 1);
const noteRate = ()=> (1 + lectureIndex * .5) * noteMult() * focus();

function currentDrain()
{
    if (freezeTimer > 0) return 0;
    return currentLecture().drain * (1 + .6 * lectureProgress()) * drainMult();
}

///////////////////////////////////////////////////////////////////////////////
// actions

function addFloaty(text, x, y, color='w', scale=1)
{
    floaties.push({text, x, y, life: 1, color, scale});
}

function addWake(amount)
{
    if (asleep)
    {
        wake = min(100, wake + amount);
        if (wake >= 25)
        {
            asleep = false;
            nod = 0;
            addFloaty('!', PORTRAIT_CX, 66, 'r', 3);
            sndNod.play();
            startleNeighbors();
        }
        return;
    }
    wake = min(100, wake + amount);
}

function blink(x, y)
{
    const amount = asleep ? 8 + blinkPower() : blinkPower();
    addWake(amount);
    addFloaty('+' + amount, x, y - 6, 'q');
    nod = max(0, nod - .35);
    blinkClosed = .08;
    shakeTimer = .06;
    if (!anim.type) anim = {type:'blink', t:0, dur:.15};
    sndBlink.play(undefined, 1, rand(.9, 1.1));
}

function useSkill(s)
{
    if (gameState != 'class' || !levels[s.id]) return;
    if (asleep)
    {
        sndDeny.play();
        addFloaty('TOO ASLEEP', PORTRAIT_CX, 100, 'S');
        return;
    }
    const eff = max(.1, 1 - tolerance[s.id]);
    const amount = Math.round(skillPower(s) * eff);
    addWake(amount);
    tolerance[s.id] = min(1, tolerance[s.id] + s.tol);
    nod = 0;
    anim = {type: s.anim, t:0, dur: s.anim == 'ice' ? 1.2 : s.anim == 'brew' ? 1 : .6};
    shakeTimer = s.anim == 'slap' || s.anim == 'ice' ? .25 : .12;
    addFloaty(s.word, PORTRAIT_CX + rand(-30, 30), 66, s.anim == 'ice' ? 'i' : 'y', 2);
    addFloaty('+' + amount + (eff < .99 ? ' (' + Math.round(eff*100) + '%)' : ''), PORTRAIT_CX, 150, 'q');
    if (s.anim != 'pinch') startleNeighbors();
    if (s.buff) buffTimer = s.buff, buffRegen = s.buffRegen;
    if (s.freeze) freezeTimer = s.freeze;
    ({pinch: sndPinch, tickle: sndTickle, slap: sndSlap, brew: sndSlurp, ice: sndIce})[s.anim].play();
}

function buySkill(s)
{
    if (levels[s.id] >= s.max) return;
    const cost = skillCost(s);
    if (notes < cost)
    {
        sndDeny.play();
        return;
    }
    notes -= cost;
    ++levels[s.id];
    sndBuy.play();
    saveGame();
}

///////////////////////////////////////////////////////////////////////////////
// professor

const pick = (list)=> list[randInt(list.length)];

function gibberish()
{
    let word = '';
    for (let n = randInt(1, 4); n--;)
        word += pick(SYLLABLES);
    return word;
}

function nextSubtitle()
{
    const lecture = currentLecture();
    const words = [];
    let length = 0;
    for (let n = randInt(4, 8); n--;)
    {
        const r = rand();
        let word = r < .3 ? pick(lecture.words) : r < .6 ? pick(FILLER) : gibberish();
        // drowsy ears: words smear and drop out
        if (wake < 40 && rand() < .4)
            word = rand() < .5 ? '...' : word.replace(/[AEIOU]/, (v)=> v + v + v);
        if (length + word.length > 50) break;
        words.push(word);
        length += word.length + 1;
    }
    if (rand() < .3) words.push('...');
    setSubtitle(words, 'y');
}

function setSubtitle(words, color)
{
    subWords = words;
    subShown = 0;
    subTimer = 0;
    subHold = 0;
    subColor = color;
}

function updateProfessor()
{
    const speed = lerp(.55, 1, wake / 100);
    if (subShown < subWords.length)
    {
        subTimer -= timeDelta * speed;
        if (subTimer <= 0)
        {
            const word = subWords[subShown++];
            subTimer = .18 + word.length * .035;
            if (word != '...')
            for (let i = 0, n = clamp(Math.round(word.length / 3), 1, 3); i < n; ++i)
                mumbleQueue.push(time + i * .1 / speed);
        }
    }
    else if ((subHold += timeDelta) > 1.1 && !(question && question.picked == null))
        nextSubtitle(); // holds the call-out while you answer

    // speak queued syllables (muffled further when sleepy)
    const volume = asleep ? .25 : lerp(.5, 1, wake / 100);
    mumbleQueue = mumbleQueue.filter(t=>
    {
        if (t > time) return true;
        sndMumble.play(undefined, volume, rand(.85, 1.2) * (asleep ? .8 : 1));
        return false;
    });

    // cold calls
    if (question)
    {
        if (question.picked == null)
        {
            if ((question.timer -= timeDelta) <= 0)
                answerQuestion(-1);
        }
        else if ((question.result -= timeDelta) <= 0)
        {
            question = null;
            questionCooldown = rand(16, 26);
        }
    }
    else if ((questionCooldown -= timeDelta) <= 0 && lectureProgress() > .1 && lectureProgress() < .92)
    {
        question = makeQuestion();
        setSubtitle(pick(QUESTIONS).split(' '), 'r');
        sndAlert.play();
    }
}

function shuffled(list)
{
    const out = [...list];
    for (let i = out.length; i-- > 1;)
    {
        const j = randInt(i + 1);
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

function wrapText(text, width)
{
    const lines = [''];
    for (const word of text.split(' '))
    {
        const line = lines[lines.length - 1];
        if (line && line.length + word.length + 1 > width)
            lines.push(word);
        else
            lines[lines.length - 1] = line ? line + ' ' + word : word;
    }
    return lines;
}

// a gibberish question with one real course word in it, and three real answers
function makeQuestion()
{
    const lecture = LECTURES[lectureIndex % LECTURES.length];
    const k = ()=> pick(lecture.words), g = ()=> gibberish();
    const templates =
    [
        ()=> 'WHAT IS THE ' + g() + ' OF ' + k() + '?',
        ()=> 'WHY DOES ' + k() + ' ' + g() + ' THE ' + g() + '?',
        ()=> 'HOW MANY ' + g() + 'S ARE IN A ' + k() + '?',
        ()=> 'WHICH ' + g() + ' ' + g() + 'S THE ' + k() + ' FIRST?',
        ()=> 'IF THE ' + k() + ' ' + g() + ', THEN WHAT ' + g() + '?',
    ];
    const others = shuffled(Object.keys(ANSWER_BANK).filter(key=> key != lecture.subject));
    const options = shuffled([
        {text: pick(ANSWER_BANK[lecture.subject]), correct: true},
        {text: pick(ANSWER_BANK[others[0]])},
        {text: pick(ANSWER_BANK[others[1]])},
    ]);
    return {lines: wrapText(pick(templates)(), PROF_CHARS).slice(0, 5), options, timer: QUESTION_TIME, picked: null, result: 0};
}

// picked: option index, or -1 when time ran out
function answerQuestion(i)
{
    if (!question || question.picked != null) return;
    question.picked = i;
    question.result = 1.5;
    if (i >= 0 && question.options[i].correct)
    {
        const bonus = Math.round(10 * (1 + lectureIndex * .5) * noteMult());
        notes += bonus, lectureNotes += bonus;
        addFloaty('+' + bonus + ' NOTES', PORTRAIT_CX, 192, 'g', 2);
        setSubtitle(['...CORRECT.', 'SOMEHOW.'], 'g');
        sndGood.play();
        for (const p of neighbors) p.glance = 1.6;
    }
    else if (i >= 0)
    {
        const lost = Math.round(lectureNotes * .1);
        notes = max(0, notes - lost), lectureNotes -= lost;
        ++wrongCount;
        for (const x of [-75, -25, 25, 75])
            addFloaty('HA', PORTRAIT_CX + x + rand(-10, 10), rand(60, 110), 'q', 2);
        if (lost) addFloaty('-' + lost + ' NOTES', PORTRAIT_CX, 192, 'r', 2);
        setSubtitle(['...NO.', 'NOT', 'EVEN', 'CLOSE.'], 'r');
        sndCaught.play();
        startleNeighbors();
    }
    else
    {
        const lost = Math.round(lectureNotes * .25);
        notes = max(0, notes - lost), lectureNotes -= lost;
        ++caughtCount;
        question.napping = asleep;
        if (lost) addFloaty('-' + lost + ' NOTES', PORTRAIT_CX, 192, 'r', 2);
        setSubtitle(['SEE', 'ME', 'AFTER', 'CLASS.'], 'r');
        sndCaught.play();
        shakeTimer = .3;
    }
}

// cold calls play out in the professor column
const PROF_CHARS = (PROF_W - 20) / 8 | 0;  // characters per line of professor text
const optionRect = (i)=> ({x: PROF_X + 10, y: 100 + i*28, w: PROF_W - 20, h: 24});

function hoveredOption()
{
    for (let i = 0; i < 3; ++i)
    {
        const r = optionRect(i);
        if (inRect(mousePosScreen, r.x, r.y, r.w, r.h))
            return i;
    }
    return -1;
}

// drowsy eyes: the answers swim, more the sleepier you are
function blurText(text, seed)
{
    const amount = clamp((35 - wake) / 35) * .6;
    if (!amount) return text;
    const frame = (time * 5 | 0) + seed * 17;
    const noise = (j, k)=> { const v = Math.sin(frame * 12.9898 + j * 78.233 + k) * 43758.5453; return v - Math.floor(v); };
    return text.split('').map((c, j)=> c != ' ' && noise(j, 0) < amount ? String.fromCharCode(65 + (noise(j, 1) * 26 | 0)) : c).join('');
}

///////////////////////////////////////////////////////////////////////////////
// lecture flow

function showChapterCard()
{
    gameState = 'card';
    stateTimer = 0;
}

function startClass()
{
    gameState = 'class';
    lectureTime = lectureNotes = attentiveTime = 0;
    dozeCount = caughtCount = wrongCount = 0;
    wake = 85;
    asleep = false;
    nod = 0;
    buffTimer = freezeTimer = 0;
    for (const s of SKILLS) tolerance[s.id] = 0;
    question = null;
    questionCooldown = 14;
    floaties = [];
    zees = [];
    mumbleQueue = [];
    setSubtitle(['GOOD', 'MORNING.', 'WHERE', 'WERE', 'WE...'], 'y');
}

const GRADES = [['A+', .95, .5], ['A', .88, .4], ['B', .75, .25], ['C', .6, .1], ['D', .45, 0], ['F', 0, 0]];

function endClass()
{
    const attention = max(0, attentiveTime / LECTURE_TIME - caughtCount * .15 - wrongCount * .08);
    const [grade, , bonusPct] = GRADES.find(g=> attention >= g[1]);
    lastGrade = grade;
    lastPassed = attention >= .6;
    lastBonus = Math.round(lectureNotes * bonusPct);
    notes += lastBonus;
    if (lastPassed) ++lectureIndex;
    saveGame();
    gameState = 'dismissed';
    stateTimer = 0;
    asleep = false;
    question = null;
    sndBell.play();
}

function updateClass()
{
    const dt = timeDelta;
    lectureTime += dt;
    if (lectureTime >= LECTURE_TIME)
    {
        endClass();
        return;
    }

    for (const s of ACTIVES)
        tolerance[s.id] = max(0, tolerance[s.id] - s.tolDecay * dt);
    buffTimer = max(0, buffTimer - dt);
    freezeTimer = max(0, freezeTimer - dt);

    if (!asleep)
    {
        const regen = passiveRegen() + (buffTimer > 0 ? buffRegen : 0);
        wake = clamp(wake + (regen - currentDrain()) * dt, 0, 100);
        if (wake >= 40) attentiveTime += dt;
        const gained = noteRate() * dt;
        notes += gained;
        lectureNotes += gained;

        // nodding off: the head sinks slowly, then jerks back up
        if (wake < 45 && !anim.type)
        {
            nod += dt * (45 - wake) / 45 * .9;
            if (nod > 1)
            {
                nod = 0;
                sndNod.play(undefined, .7);
                addFloaty('!', PORTRAIT_CX, 66, 'q', 2);
            }
        }
        else
            nod = max(0, nod - dt * 2);

        if (wake <= 0)
        {
            asleep = true;
            ++dozeCount;
            addFloaty('ZZZ...', PORTRAIT_CX, 90, 'v', 2);
            snoreTimer = .5;
        }
    }
    else if ((snoreTimer -= dt) <= 0)
    {
        sndSnore.play();
        snoreTimer = 2.2;
    }

    // floating Z's while drowsy
    if ((asleep || wake < 20) && rand() < dt * (asleep ? 2.5 : 1))
        zees.push({x: 130 + rand(-2, 2), y: asleep ? 56 : 42, life: 1});

    updateProfessor();
}

///////////////////////////////////////////////////////////////////////////////
// skill card layout

const CARD_W = 40, CARD_H = 46, CARD_GAP = 3;
const CARD_X0 = (screenW - (SKILLS.length * CARD_W + (SKILLS.length - 1) * CARD_GAP)) / 2 | 0;
const CARD_Y = PANEL_Y + 5;
const cardX = (i)=> CARD_X0 + i * (CARD_W + CARD_GAP);
const inRect = (p, x, y, w, h)=> p.x >= x && p.x < x + w && p.y >= y && p.y < y + h;

// skills unlock left to right: each owned skill reveals the next two
function cardVisible(i)
{
    let lastOwned = -1;
    SKILLS.forEach((s, j)=> levels[s.id] && (lastOwned = j));
    return i <= lastOwned + 2;
}

function hoveredCard()
{
    for (let i = 0; i < SKILLS.length; ++i)
        if (inRect(mousePosScreen, cardX(i), CARD_Y, CARD_W, CARD_H))
            return i;
    return -1;
}

function clickCard(i)
{
    if (!cardVisible(i)) return;
    const s = SKILLS[i];
    const onStrip = mousePosScreen.y >= CARD_Y + CARD_H - 13;
    if (s.type == 'active' && levels[s.id] && !onStrip)
        useSkill(s);
    else
        buySkill(s);
}

///////////////////////////////////////////////////////////////////////////////
// engine callbacks

function gameInit()
{
    loadGame();
    nextSubtitle();
}

function gameUpdate()
{
    stateTimer += timeDelta;
    const clicked = mouseWasPressed(0);
    const card = hoveredCard();

    if (clicked && card >= 0)
        clickCard(card);

    if (gameState == 'title')
    {
        if (keyWasPressed('Delete') || keyWasPressed('Backspace'))
            resetSave(), sndDeny.play();
        if ((clicked && card < 0) || keyWasPressed('Space') || keyWasPressed('Enter'))
            showChapterCard();
        updateProfessor();
    }
    else if (gameState == 'card')
    {
        if (stateTimer > .5 && ((clicked && card < 0) || keyWasPressed('Space') || keyWasPressed('Enter')))
            startClass();
    }
    else if (gameState == 'class')
    {
        if (clicked && question && !asleep && hoveredOption() >= 0)
            answerQuestion(hoveredOption());
        else if (clicked && card < 0 && mousePosScreen.y < PANEL_Y)
            blink(mousePosScreen.x, mousePosScreen.y);
        if (question && !asleep)
            ['KeyA', 'KeyB', 'KeyC'].forEach((key, i)=> keyWasPressed(key) && answerQuestion(i));
        if (keyWasPressed('Space'))
            blink(PORTRAIT_CX, 110);
        ACTIVES.forEach((s, i)=> keyWasPressed('Digit' + (i+1)) && useSkill(s));
        updateClass();
    }
    else if (gameState == 'dismissed')
    {
        if (stateTimer > .8 && ((clicked && card < 0) || keyWasPressed('Space') || keyWasPressed('Enter')))
            showChapterCard();
    }

    updateHero();

    for (const f of floaties) f.life -= timeDelta * .8, f.y -= timeDelta * 18;
    floaties = floaties.filter(f=> f.life > 0);
    for (const z of zees) z.life -= timeDelta * .4, z.y -= timeDelta * 6, z.x += timeDelta * 4;
    zees = zees.filter(z=> z.life > 0);
}

function gameUpdatePost() {}
function gameRender() {}

///////////////////////////////////////////////////////////////////////////////
// people animation

const REST_L = vec2(110, 86), REST_R = vec2(130, 86);

function updateHero()
{
    const dt = timeDelta;
    shakeTimer = max(0, shakeTimer - dt);
    blinkClosed = max(0, blinkClosed - dt);
    if ((blinkTimer -= dt) <= 0)
        blinkTimer = rand(2, 5), blinkClosed = .12;

    if (anim.type && (anim.t += dt) >= anim.dur)
        anim.type = '';

    // hand targets per gesture (scene pixels)
    let targetL = REST_L, targetR = REST_R;
    const hx = hero.x - 11, hy = MID_Y + headDrop();
    if (asleep)
        targetL = vec2(109, 85), targetR = vec2(131, 85);
    else if (anim.type == 'pinch')
        targetR = vec2(115, 82);
    else if (anim.type == 'tickle')
        targetR = vec2(120, hy + 19);
    else if (anim.type == 'slap')
    {
        const out = (anim.t * 10 | 0) % 2 ? 2 : 0;
        targetL = vec2(hx + 1 - out, hy + 15), targetR = vec2(hx + 21 + out, hy + 15);
    }
    else if (anim.type == 'brew')
        targetR = vec2(124, hy + 21);
    else if (anim.type == 'ice')
        targetL = vec2(100, 66), targetR = vec2(140, 66);
    else if (levels.doodle && gameState == 'class' && (time % 6) < 2.5)
        targetR = vec2(125 + Math.round(Math.sin(time * 14)), 86); // scribbling

    hero.handL = hero.handL.lerp(targetL, .35);
    hero.handR = hero.handR.lerp(targetR, .35);

    if (levels.gum && !asleep && (gumTimer -= dt) <= -1.2)
        gumTimer = rand(4, 8);

    for (const p of neighbors)
        updateNeighbor(p);
}

function headDrop()
{
    if (asleep) return 16;
    if (anim.type == 'blink') return -1;
    return Math.round(nod * nod * 6);
}

// the neighbors live their own lives: notes, phones, yawns, naps
const NEIGHBOR_HABITS = {margot: {phone: 4, listen: 3, notes: 1, yawn: 1}, chas: {notes: 5, listen: 3, yawn: 1}};

// neighbors sit mostly off camera, so their reactions pop up where their shoulder peeks in
const towardHero = (p)=> p.x < hero.x ? 1 : -1;
const peekX = (p)=> p.x + 16 * towardHero(p);

function updateNeighbor(p)
{
    p.glance = max(0, p.glance - timeDelta);
    if (p.state == 'sleep' && rand() < timeDelta * .6)
        zees.push({x: peekX(p) + 6, y: 52, life: 1});
    if ((p.timer -= timeDelta) > 0)
        return;

    const habits = {...NEIGHBOR_HABITS[p.role]};
    if (gameState == 'class')
        habits.sleep = lectureProgress() * (2 + lectureIndex) * (p.role == 'chas' ? 1.5 : 1);
    let r = rand(Object.values(habits).reduce((a, b)=> a + b, 0));
    let state = 'listen';
    for (const key in habits)
        if ((r -= habits[key]) < 0) { state = key; break; }
    p.state = state;
    p.timer = state == 'yawn' ? 1.4 : state == 'sleep' ? rand(6, 12) : rand(4, 9);
}

// loud skills make the neighbors stare, and wake them if they dozed off
function startleNeighbors()
{
    for (const p of neighbors)
    {
        if (p.state == 'sleep')
        {
            p.state = 'listen', p.timer = rand(3, 6);
            addFloaty('!', sceneToScreenX(peekX(p)), 66, 'q', 2);
        }
        p.glance = 1.6;
    }
}

function basePose(p)
{
    return {hdx: 0, hdy: 0, bdx: 0, bdy: 0, look: 0, mouth: '',
        eyes: (time + p.phase) % 4.5 < .13 ? 'closed' : 'open',
        handL: vec2(p.x - 10, 86), handR: vec2(p.x + 10, 86)};
}

function heroPose()
{
    const pose = basePose(hero);
    const drop = headDrop();
    let jitter = 0;
    if (anim.type == 'ice') jitter = (anim.t * 30 | 0) % 2 ? 1 : -1;
    if (anim.type == 'slap') jitter = (anim.t * 20 | 0) % 2 ? 1 : 0;
    const tap = levels.foot && gameState == 'class' && !asleep && (time * 2 | 0) % 2 ? 1 : 0;
    pose.hdx = pose.bdx = jitter;
    pose.hdy = drop + tap;
    pose.bdy = (drop > 3 ? 1 : 0) + tap;

    const inClass = gameState == 'class';
    pose.eyes = asleep || blinkClosed > 0 || (inClass && wake < 12) ? 'closed' :
        anim.type == 'ice' || anim.type == 'slap' ? 'wide' :
        inClass && wake < 35 ? 'half' : 'open';
    const yawning = inClass && !asleep && wake < 30 && (time % 7) < 1.6 && !anim.type;
    pose.mouth = anim.type == 'tickle' ? 'open' : yawning ? 'yawn' : asleep ? 'sleep' : '';
    pose.handL = hero.handL;
    pose.handR = hero.handR;
    return pose;
}

function neighborPose(p)
{
    const pose = basePose(p);
    const toward = p.x < hero.x ? 1 : -1;
    if (p.state == 'notes')
    {
        pose.eyes = pose.eyes == 'closed' ? 'closed' : 'half';
        pose.hdy = 1;
        pose.handR = vec2(p.x + 7 + Math.round(Math.sin(time * 13 + p.phase)), 86);
    }
    else if (p.state == 'phone')
    {
        pose.eyes = pose.eyes == 'closed' ? 'closed' : 'half';
        pose.hdy = 2;
        pose.handL = vec2(p.x - 5, 83), pose.handR = vec2(p.x + 5, 83);
        pose.phone = true;
    }
    else if (p.state == 'yawn')
        pose.eyes = 'closed', pose.mouth = 'yawn', pose.hdy = -1;
    else if (p.state == 'sleep')
    {
        pose.eyes = 'closed', pose.mouth = 'sleep', pose.hdy = 14;
        pose.handL = vec2(p.x - 10, 85), pose.handR = vec2(p.x + 10, 85);
    }
    if (p.glance > 0 && p.state != 'sleep')
        pose.look = toward, pose.eyes = 'open', pose.hdy = 0;

    p.handL = p.handL.lerp(pose.handL, .3);
    p.handR = p.handR.lerp(pose.handR, .3);
    pose.handL = p.handL, pose.handR = p.handR;
    return pose;
}

// background classmates nod off as the lecture drags on
function extraPose(p)
{
    const pose = basePose(p);
    const progress = gameState == 'class' ? lectureProgress() * (1 + lectureIndex * .15) : 0;
    if (!p.laptop && progress > p.sleepAt)
    {
        pose.eyes = 'closed', pose.mouth = 'sleep';
        pose.hdy = ({back: 10, mid: 14, front: 6})[p.row] + ((time + p.phase) % 3 < 1.5 ? 1 : 0);
        pose.handL = vec2(p.x - 9, 85), pose.handR = vec2(p.x + 9, 85);
    }
    else if (p.laptop && pose.eyes == 'open')
        pose.eyes = 'half';
    return pose;
}

///////////////////////////////////////////////////////////////////////////////
// drawing helpers

let sceneOffX = 0, sceneOffY = 0; // screen px: sway + shake

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
    const left = align == 'left' ? x : x - width;
    const pos = vec2(align == 'center' ? x : left + size/2, y);
    if (shadow)
        engineImageFont.drawTextScreen(text, pos.add(vec2(scale)), size, align == 'center', palColor('k', color.a));
    engineImageFont.drawTextScreen(text, pos, size, align == 'center', color);
}

// draw a sheet sprite with its top left at (x, y) in screen px
function uiSprite(name, x, y, scale=1, color=WHITE)
{
    const s = sprites[name];
    s.tileInfo ||= new TileInfo(vec2(s.x, s.y), vec2(s.w, s.h), textureInfos[0]);
    drawTile(vec2(x + s.w*scale/2, y + s.h*scale/2), vec2(s.w, s.h).scale(scale), s.tileInfo, color, 0, false, undefined, true, true);
}

// scene space: 240x108 pixels drawn at 3x, offset so the camera's top left lands on the portrait's
const sceneToScreenX = (x)=> (x - CAM_X)*SC + PORTRAIT_X + sceneOffX;
const sceneToScreenY = (y)=> (y - CAM_Y)*SC + sceneOffY;
const sRect = (x, y, w, h, c)=> uiRect(sceneToScreenX(Math.round(x)), sceneToScreenY(Math.round(y)), w*SC, h*SC, typeof c == 'string' ? palColor(c) : c);
// map sprites carry a 1 pixel outline border, so (x, y) is the top left of the map itself
const sSprite = (name, x, y, color)=> uiSprite(name, sceneToScreenX(Math.round(x) - 1), sceneToScreenY(Math.round(y) - 1), SC, color);

function sDisc(cx, cy, r, c)
{
    for (let y = -r; y <= r; ++y)
    {
        const half = Math.round(Math.sqrt(r*r - y*y));
        sRect(cx - half, cy + y, half*2 + 1, 1, c);
    }
}

// thick pixel line (arms, clock hands)
function sLine(a, b, size, c)
{
    const steps = max(1, Math.ceil(a.distance(b)));
    for (let i = 0; i <= steps; ++i)
    {
        const p = a.lerp(b, i / steps);
        sRect(Math.round(p.x - size/2), Math.round(p.y - size/2), size, size, c);
    }
}

const textures = {};
function drawLayer(index)
{
    textures[index] ||= new TileInfo(vec2(), vec2(SCENE_W, SCENE_H), textureInfos[index]);
    drawTile(vec2(sceneToScreenX(SCENE_W/2), sceneToScreenY(SCENE_H/2)), vec2(SCENE_W, SCENE_H).scale(SC),
        textures[index], WHITE, 0, false, undefined, true, true);
}

///////////////////////////////////////////////////////////////////////////////
// scene rendering

function drawScene()
{
    const drowsy = gameState == 'class' ? clamp((50 - wake) / 50) : 0;
    sceneOffX = Math.round(Math.sin(time * 1.3) * drowsy * 3);
    sceneOffY = Math.round(Math.sin(time * .9) * drowsy * 2);
    if (shakeTimer > 0)
        sceneOffX += randInt(-1, 2), sceneOffY += randInt(-1, 2);

    drawLayer(1);

    // wall clock: 9:00 to 10:15 over the lecture
    const minutes = gameState == 'class' ? lectureTime : gameState == 'dismissed' ? LECTURE_TIME : 0;
    const minuteAngle = (minutes % 60) / 60 * PI * 2, hourAngle = (9 + minutes / 60) / 12 * PI * 2;
    const clockCenter = vec2(120, 22);
    sLine(clockCenter, clockCenter.add(vec2(Math.sin(hourAngle), -Math.cos(hourAngle)).scale(4)), 1, 'k');
    sLine(clockCenter, clockCenter.add(vec2(Math.sin(minuteAngle), -Math.cos(minuteAngle)).scale(6)), 1, 'R');

    // back row, then their counter (sleepers slump behind it), then laptops on top
    for (const p of backRow)
        drawPerson(p, extraPose(p));
    drawLayer(2);
    for (const p of backRow)
    if (p.laptop)
    {
        sRect(p.x - 8, 43, 16, 10, 'k');
        sRect(p.x - 7, 44, 14, 9, 's');
        sRect(p.x - 1, 47, 2, 2, 'w');
    }

    // the hero's row
    const poses = new Map(midRow.map(p=> [p, p == hero ? heroPose() : p.role == 'extra' ? extraPose(p) : neighborPose(p)]));
    for (const p of midRow)
    {
        const head = drawPerson(p, poses.get(p));
        if (p == hero)
            drawHeroFace(head);
    }
    drawLayer(3);
    drawDeskProps(poses);
    for (const p of midRow)
        drawArms(p, poses.get(p));
    if (anim.type == 'brew')
        sSprite('cup', hero.handR.x - 3, hero.handR.y - 7);

    // what the neighbors think of you
    for (const p of neighbors)
        if (p.glance > .4 && p.state != 'sleep')
            uiText('?', sceneToScreenX(peekX(p)), sceneToScreenY(MID_Y + 4), 2, palColor('q'));

    // the row in front, between the hero's row and the camera
    for (const p of frontRow)
        drawPerson(p, extraPose(p));

    for (const z of zees)
        uiText('Z', sceneToScreenX(z.x), sceneToScreenY(z.y), z.life > .5 ? 2 : 1, palColor('v', min(1, z.life*2)));
}

function drawPerson(p, pose)
{
    sSprite('torso' + p.id, p.x - 17 + pose.bdx, p.baseY + 21 + pose.bdy);
    const hx = p.x - 11 + pose.hdx, hy = p.baseY + pose.hdy;
    sSprite('head' + p.id, hx, hy);

    // eyes: whites are in the sprite; pupils and lids go on top
    const ey = hy + 11;
    for (const ex of [hx + 6, hx + 13])
    {
        if (pose.eyes == 'closed')
        {
            sRect(ex, ey, 3, 2, p.skin);
            sRect(ex, ey + 1, 3, 1, 'H');
        }
        else if (pose.eyes == 'wide')
            sRect(ex + 1, ey, 1, 1, 'k');
        else if (pose.eyes == 'half' || p.eyeliner)
        {
            sRect(ex, ey, 3, 1, p.eyeliner ? 'k' : p.skinShade);
            sRect(ex + 1 + pose.look, ey + 1, 1, 1, 'k');
        }
        else
            sRect(ex + 1 + pose.look, ey, 1, 2, 'k');
    }
    if (p.eyeliner && pose.eyes != 'closed')
        sRect(hx + 5, ey - 1, 1, 1, 'k'), sRect(hx + 16, ey - 1, 1, 1, 'k');

    if (pose.mouth == 'yawn')
        sRect(hx + 9, hy + 17, 4, 4, 'k'), sRect(hx + 10, hy + 20, 2, 1, 'p');
    else if (pose.mouth == 'open')
        sRect(hx + 9, hy + 17, 4, 3, 'k'), sRect(hx + 10, hy + 19, 2, 1, 'p');
    else if (pose.mouth == 'sleep')
    {
        sRect(hx + 10, hy + 18, 2, 2, 'E');
        const t = (time + p.phase) % 2;
        if (t < 1.4) sRect(hx + 12, hy + 20, 1, t > .7 ? 2 : 1, 'c'); // drool
    }
    return {hx, hy};
}

function drawHeroFace({hx, hy})
{
    // gum bubble
    if (levels.gum && gumTimer < 0 && !anim.type && !asleep)
    {
        const r = Math.round(clamp(-gumTimer / 1.2) * 5);
        sDisc(hx + 11, hy + 19, r + 1, 'k');
        sDisc(hx + 11, hy + 19, r, 'p');
        if (r > 2) sRect(hx + 9, hy + 17, 1, 1, 'w');
    }
    // ice: a blue shiver tint over the face
    if (anim.type == 'ice')
        sRect(hx + 4, hy + 8, 14, 13, palColor('i', .35));
}

function drawArms(p, pose)
{
    const sy = p.baseY + 30 + pose.bdy;
    const shoulderL = vec2(p.x - 12 + pose.bdx, sy), shoulderR = vec2(p.x + 12 + pose.bdx, sy);
    const arms = [[shoulderL, pose.handL, -2], [shoulderR, pose.handR, 2]];
    for (const [s, h] of arms) sLine(s, h, 7, 'k');
    for (const [s, h] of arms) sLine(s, h, 5, p.sleeve);
    if (p.stripe)
        for (const [s, h, dx] of arms) sLine(s.add(vec2(dx, 0)), h.add(vec2(dx, -1)), 1, 'w');
    for (const [, h] of arms) sSprite('hand' + p.id, h.x - 3, h.y - 2);
}

function drawDeskProps(poses)
{
    // everyone in the row has a notebook; the hero's fills up as notes are taken
    for (const p of midRow)
    {
        if (poses.get(p).phone) continue;
        sRect(p.x - 10, 84, 20, 5, 'k');
        sRect(p.x - 9, 85, 18, 4, p == hero ? 'w' : 'q');
    }
    const lines = gameState == 'class' ? min(6, lectureNotes / 6 | 0) : 0;
    for (let i = 0; i < lines; ++i)
        sRect(112 + (i % 3) * 6, 86 + (i / 3 | 0) * 2, 4, 1, 'b');

    // phone glow
    for (const p of neighbors)
    if (poses.get(p).phone)
    {
        sRect(p.x - 4, 76, 8, 9, 'k');
        sRect(p.x - 3, 77, 6, 7, 'c');
        sRect(p.x - 2, 78, 4, 1, 'w');
    }

    // colored pens
    const penColors = ['r', 'b', 'g', 'v'];
    for (let i = 0; i < min(4, levels.pens); ++i)
        sRect(101 + i * 2, 84, 1, 4, penColors[i]), sRect(101 + i * 2, 84, 1, 1, 'k');

    // the cold brew stays on the desk while it kicks in
    if (buffTimer > 0 && anim.type != 'brew')
    {
        sSprite('cup', 133, 77);
        if ((time * 3 | 0) % 2) sRect(135, 74, 1, 1, 'w');
    }
}

function drawDrowsyOverlay()
{
    if (gameState != 'class') return;
    const dim = clamp((55 - wake) / 55);
    if (dim > 0)
        uiRect(PORTRAIT_X, 0, PORTRAIT_W, PANEL_Y, rgb(.1, .04, .16, dim * .45));
    // heavy eyelids close in from the top and bottom
    const lid = asleep ? 1 : clamp((25 - wake) / 25);
    if (lid > 0)
    {
        const h = Math.round(lid * (asleep ? 58 : 46));
        uiRect(PORTRAIT_X, 0, PORTRAIT_W, h, palColor('k'));
        uiRect(PORTRAIT_X, PANEL_Y - h, PORTRAIT_W, h, palColor('k'));
    }
}

///////////////////////////////////////////////////////////////////////////////
// ui

function uiPanel(x, y, w, h, bg='q', border='R')
{
    uiRect(x + 2, y + 2, w, h, rgb(0,0,0,.3));
    uiRect(x - 1, y - 1, w + 2, h + 2, palColor('k'));
    uiRect(x, y, w, h, palColor(border));
    uiRect(x + 1, y + 1, w - 2, h - 2, palColor(bg));
}

function uiBar(x, y, w, h, pct, color)
{
    uiRect(x - 1, y - 1, w + 2, h + 2, palColor('k'));
    uiRect(x, y, w, h, palColor('E'));
    uiRect(x, y, Math.round(w * clamp(pct)), h, color);
    uiRect(x, y, Math.round(w * clamp(pct)), 1, color.lerp(WHITE, .35));
}

const formatNumber = (n)=> n < 1e3 ? '' + (n|0) : n < 1e6 ? (n/1e3).toFixed(1) + 'K' : (n/1e6).toFixed(1) + 'M';

function wallClock(minutes)
{
    const total = 9*60 + (minutes|0);
    return (total / 60 | 0) + ':' + ('0' + total % 60).slice(-2);
}

// the side columns frame the portrait like the skill panel frames the bottom
function drawColumns()
{
    uiRect(0, 0, STATS_W, PANEL_Y, palColor('R'));
    uiRect(PROF_X, 0, PROF_W, PANEL_Y, palColor('R'));
    uiRect(PORTRAIT_X - 3, 0, 1, PANEL_Y, palColor('k'));
    uiRect(PORTRAIT_X - 2, 0, 2, PANEL_Y, palColor('q'));
    uiRect(PROF_X, 0, 2, PANEL_Y, palColor('q'));
    uiRect(PROF_X + 2, 0, 1, PANEL_Y, palColor('k'));
}

// a small label on the left and a value on the right of a stats panel row
function statRow(label, value, y, color=palColor('q'))
{
    uiText(label, 12, y, 1, palColor('A'), 'left', false);
    uiText(value, STATS_W - 12, y, 1, color, 'right', false);
}

function drawStats()
{
    if (gameState == 'title' || gameState == 'card') return;
    const x = 6, w = STATS_W - 14;
    const inClass = gameState == 'class';

    // notes
    uiPanel(x, 6, w, 44, 'e', 'M');
    uiSprite('note', 12, 11);
    uiText('NOTES', 26, 16, 1, palColor('A'), 'left', false);
    uiText(formatNumber(notes), 12, 32, 2, palColor('q'), 'left');
    if (inClass)
        uiText('+' + noteRate().toFixed(1) + '/S', STATS_W - 12, 44, 1, palColor(focus() > .5 ? 'g' : 'S'), 'right', false);

    if (!inClass) return;

    // wakefulness
    uiPanel(x, 56, w, 40, 'e', 'M');
    const low = wake < 30;
    const color = asleep ? palColor('v') : wake > 60 ? palColor('g') : !low ? palColor('m') : palColor((time*6|0) % 2 ? 'r' : 'R');
    statRow(asleep ? 'ASLEEP' : 'AWAKE', Math.round(wake) + '%', 65, color);
    uiBar(12, 73, w - 12, 6, wake / 100, color);
    if (freezeTimer > 0) uiText('FROZEN', 12, 88, 1, palColor('i'), 'left', false);
    else if (buffTimer > 0) uiText('CAFFEINATED', 12, 88, 1, palColor('m'), 'left', false);

    // lecture clock
    uiPanel(x, 102, w, 30, 'e', 'M');
    statRow('TIME', wallClock(lectureTime), 111);
    uiBar(12, 120, w - 12, 4, lectureTime / LECTURE_TIME, palColor('a'));

    // how the lecture is going
    uiPanel(x, 138, w, 46, 'e', 'M');
    statRow('DOZED', dozeCount, 148, palColor(dozeCount ? 'r' : 'q'));
    statRow('CAUGHT', caughtCount, 160, palColor(caughtCount ? 'r' : 'q'));
    statRow('WRONG', wrongCount, 172, palColor(wrongCount ? 'r' : 'q'));
}

// the professor column: subtitles while he drones on, the cold call when he calls on you
function drawProfessor()
{
    if (gameState != 'class') return;
    const x = PROF_X + 6, w = PROF_W - 12, cx = PROF_X + PROF_W/2;
    uiPanel(x, 6, w, 204, 'e', 'M');
    uiText(PROF, cx, 16, 1, palColor('a'), 'center', false);
    uiRect(x + 6, 23, w - 12, 1, palColor('M'));

    const fade = asleep ? .45 : lerp(.6, 1, wake / 100);
    const said = wrapText(subWords.slice(0, subShown).join(' '), PROF_CHARS);
    if (!question)
    {
        said.forEach((line, i)=> uiText(line, x + 6, 34 + i*11, 1, palColor(subColor, fade), 'left'));
        return;
    }

    // the call-out stays up top, the question and answers below it
    said.slice(0, 2).forEach((line, i)=> uiText(line, x + 6, 34 + i*11, 1, palColor(subColor, fade), 'left'));
    question.lines.forEach((line, i)=> uiText(line, x + 6, 58 + i*9, 1, palColor('q'), 'left', false));

    const open = question.picked == null;
    const hover = open && !asleep ? hoveredOption() : -1;
    question.options.forEach((option, i)=>
    {
        const r = optionRect(i);
        let bg = i == hover ? 'm' : 'a';
        if (!open)
            bg = option.correct ? 'g' : i == question.picked ? 'r' : 'A';
        uiRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2, palColor('k'));
        uiRect(r.x, r.y, r.w, r.h, palColor(bg));
        uiText('ABC'[i], r.x + 7, r.y + r.h/2, 1, palColor('R'), 'center', false);
        const lines = wrapText(option.text, (r.w - 18) / 8 | 0);
        lines.forEach((line, j)=> uiText(open ? blurText(line, i*2 + j) : line, r.x + 15,
            r.y + r.h/2 + (j - (lines.length - 1)/2) * 10, 1, palColor('k'), 'left', false));
    });

    if (open)
    {
        uiBar(x + 6, 188, w - 12, 4, question.timer / QUESTION_TIME, palColor(question.timer < 1.5 ? 'r' : 'm'));
        if (asleep)
            uiText('WAKE UP!', cx, 201, 1, palColor((time*3|0) % 2 ? 'r' : 'q'), 'center', false);
    }
    else
    {
        const right = question.picked >= 0 && question.options[question.picked].correct;
        const verdict = right ? 'CORRECT!' : question.picked >= 0 ? 'WRONG!' : question.napping ? 'CAUGHT NAPPING!' : 'TIME IS UP!';
        uiText(verdict, cx, 196, 1, palColor(right ? 'g' : 'r'), 'center', false);
    }
}

function drawPortraitText()
{
    if (gameState == 'class' && asleep)
    {
        const color = palColor((time*3|0) % 2 ? 'q' : 'a');
        uiText('CLICK TO', PORTRAIT_CX, 110, 2, color);
        uiText('WAKE UP!', PORTRAIT_CX, 130, 2, color);
    }
    for (const f of floaties)
        uiText(f.text, f.x, f.y, f.scale, palColor(f.color, min(1, f.life * 2)));
}

function drawSkillPanel()
{
    uiRect(0, PANEL_Y, screenW, screenH - PANEL_Y, palColor('R'));
    uiRect(0, PANEL_Y, screenW, 2, palColor('q'));
    uiRect(0, PANEL_Y + 2, screenW, 1, palColor('k'));

    const hover = hoveredCard();
    SKILLS.forEach((s, i)=>
    {
        const x = cardX(i), y = CARD_Y;
        const visible = cardVisible(i);
        const owned = levels[s.id] > 0;
        const maxed = levels[s.id] >= s.max;
        const cost = skillCost(s);
        const affordable = !maxed && notes >= cost;

        if (!visible)
        {
            uiRect(x, y, CARD_W, CARD_H, palColor('E'));
            uiText('?', x + CARD_W/2, y + CARD_H/2, 1, palColor('R'), 'center', false);
            return;
        }

        const border = i == hover ? 'y' : affordable ? ((time*2|0) % 2 ? 'm' : 'M') : 'k';
        uiRect(x - 1, y - 1, CARD_W + 2, CARD_H + 2, palColor(border));
        uiRect(x, y, CARD_W, CARD_H, palColor(owned ? 'q' : 'A'));

        // icon, dimmed until bought; tolerance darkens it from the top
        uiSprite(s.icon, x + 7, y + 8, 2, owned ? WHITE : rgb(.45, .35, .45));
        if (s.type == 'active' && owned && tolerance[s.id] > 0)
            uiRect(x + 2, y + 8, CARD_W - 4, Math.round(26 * tolerance[s.id]), rgb(.1, .05, .15, .55));

        if (s.type == 'active')
            uiText(ACTIVES.indexOf(s) + 1, x + 6, y + 6, 1, palColor(owned ? 'R' : 'E'), 'center', false);
        if (owned)
            uiText('L' + levels[s.id], x + CARD_W - 2, y + 6, 1, palColor('G'), 'right', false);

        // bottom strip: buy / upgrade price
        uiRect(x, y + CARD_H - 12, CARD_W, 12, palColor(maxed ? 'G' : affordable ? 'm' : 'E'));
        const label = maxed ? 'MAX' : (owned ? '+' : '') + formatNumber(cost);
        uiText(label, x + CARD_W/2, y + CARD_H - 6, 1, palColor(maxed || affordable ? 'k' : 'A'), 'center', false);
    });

    // tooltip
    if (hover >= 0 && cardVisible(hover))
    {
        const s = SKILLS[hover];
        const owned = levels[s.id] > 0;
        const desc = skillDesc(s);
        const how = levels[s.id] >= s.max ? 'FULLY TRAINED' :
            s.type == 'active' && owned ? 'CLICK ICON TO USE, PRICE TO UPGRADE' :
            (owned ? 'UPGRADE' : 'LEARN') + ' FOR ' + formatNumber(skillCost(s)) + ' NOTES';
        const w = max(s.name.length, desc.length, how.length) * 8 + 14;
        const x = clamp(cardX(hover) + CARD_W/2 - w/2, 4, screenW - w - 4);
        uiPanel(x, PANEL_Y - 42, w, 36, 'e', 'M');
        uiText(s.name, x + 7, PANEL_Y - 33, 1, palColor('y'), 'left');
        uiText(desc, x + 7, PANEL_Y - 23, 1, palColor('q'), 'left');
        uiText(how, x + 7, PANEL_Y - 13, 1, palColor('S'), 'left');
    }
}

// Wes Anderson chapter card: pastel field, thin double frame, everything centered
function drawTitleCard(lines)
{
    uiRect(0, 0, screenW, PANEL_Y, palColor('a'));
    uiRect(14, 12, screenW - 28, PANEL_Y - 24, palColor('q'));
    uiRect(15, 13, screenW - 30, PANEL_Y - 26, palColor('a'));
    uiRect(19, 17, screenW - 38, PANEL_Y - 34, palColor('q'));
    uiRect(20, 18, screenW - 40, PANEL_Y - 36, palColor('a'));
    for (const [text, y, scale, color] of lines)
        uiText(text, 240, y, scale, palColor(color), 'center', false);
}

function gameRenderPost()
{
    drawScene();
    drawDrowsyOverlay();
    drawColumns();
    drawStats();
    drawProfessor();

    const lecture = currentLecture();
    if (gameState == 'title')
    {
        uiRect(0, 0, screenW, PANEL_Y, rgb(.95, .72, .78, .2));
        uiPanel(40, 6, 400, 66, 'a', 'q');
        uiText('STAY AWAKE', 241, 26, 4, palColor('R'), 'center', false);
        uiText('OR, THE INTERMINABLE LECTURES OF ' + PROF, 240, 50, 1, palColor('R'), 'center', false);
        uiText((time*2|0) % 2 ? 'CLICK TO BEGIN' : '', 240, 63, 1, palColor('w'), 'center', false);
        if (lectureIndex || notes)
            uiText('DEL: ERASE SAVE', 240, 206, 1, palColor('q', .7));
    }
    else if (gameState == 'card')
    {
        const big = lecture.course.length > 17 ? 2 : 3;
        drawTitleCard([
            ['CHAPTER ' + lecture.chapter, 50, 1, 'R'],
            [lecture.course, 82, big, 'w'],
            [PROF, 118, 1, 'R'],
            ['9:00 TO 10:15 AM, HALL B', 132, 1, 'R'],
            [stateTimer > .5 && (time*2|0) % 2 ? 'CLICK TO TAKE YOUR SEAT' : '', 176, 1, 'E'],
        ]);
    }
    else if (gameState == 'dismissed')
    {
        const lines = [
            ['CLASS DISMISSED', 42, 2, 'w'],
            ['NOTES TAKEN  ' + formatNumber(lectureNotes), 72, 1, 'R'],
            ['DOZED OFF  ' + dozeCount + (dozeCount == 1 ? ' TIME' : ' TIMES'), 84, 1, 'R'],
            ['CAUGHT NAPPING  ' + caughtCount + '   WRONG ANSWERS  ' + wrongCount, 96, 1, 'R'],
            ['GRADE', 116, 1, 'R'],
            [lastGrade, 136, 3, lastPassed ? 'w' : 'r'],
            [lastBonus ? '+' + lastBonus + ' BONUS NOTES' : '', 158, 1, 'G'],
            [lastPassed ? 'NEXT: CHAPTER ' + lecture.chapter + ', ' + lecture.course : 'BELOW A C. RETAKE THE LECTURE.', 174, 1, 'E'],
            [stateTimer > .8 && (time*2|0) % 2 ? 'CLICK TO CONTINUE' : '', 190, 1, 'E'],
        ];
        drawTitleCard(lines);
    }

    drawPortraitText();
    drawSkillPanel();
}

///////////////////////////////////////////////////////////////////////////////

engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost, [buildSpriteSheet(), buildWall(), buildCounter(), buildDesk()]);
