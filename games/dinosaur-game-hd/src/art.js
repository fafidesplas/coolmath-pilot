// Sprite art as cell maps (GDD 9), in the one-pager's chunky style: every
// cell is one art pixel, drawn 2×2 logical px, and sprites.js adds a 1 cell
// (2 px) Night Ink outline. No DOM, so tools/art-test.mjs can check every
// frame against the hitbox template.
// Each sprite: { rows, oy }, where oy is how far below the footprint's top
// (or the obstacle's y) the first row is drawn, in px.

export const CELL = 2;   // logical px per art pixel

// ---- Runners (GDD 7.1) ----------------------------------------------------------------------
// Cosmetic only: every runner keeps the T-Rex's silhouette closely enough to
// cover the same hitboxes. Cells: S main, s dark, b light (belly), a and d
// accents, w cream, k ink, each runner with its own colors. Standing body,
// 22×19 cells, on 4 rows of legs; slide, 28×10 cells.
const set = (rows, y, x, s) => { rows[y] = rows[y].slice(0, x) + s + rows[y].slice(x + s.length); };
function face(rows, kind, [eyeX, eyeY], [mouthX, mouthY]) {
  rows = rows.slice();
  if (kind === 'dizzy') { set(rows, eyeY, eyeX, 'kw'); set(rows, eyeY + 1, eyeX, 'wk'); set(rows, mouthY, mouthX, 'kk'); }
  if (kind === 'shut') { set(rows, eyeY, eyeX, 'SS'); set(rows, eyeY + 1, eyeX, 'kk'); }
  return rows;
}

// Standing frames are 44×46 px in the 44×47 footprint: 1 px down, so the
// feet stand on its bottom edge. Slide frames are 56×20 px at the bottom of
// the 25 px duck footprint. Run is 2 leg poses alternating; jump uses the
// standing pose; crash has dizzy eyes; sleep shuts them.
function runner({ colors, body, legs, slide, eye, mouth, slideEye, slideMouth }) {
  const standing = (pose, kind) => ({ rows: face([...body, ...legs[pose]], kind, eye, mouth), oy: 1 });
  const sliding = (frame, kind) => ({ rows: face(slide[frame], kind, slideEye, slideMouth), oy: 5 });
  return {
    colors,
    run: [standing('run1'), standing('run2'), standing('run1'), standing('run2')],
    jump: standing('stand'),
    crash: standing('stand', 'dizzy'),
    sleep: standing('stand', 'shut'),
    slide: [sliding(0), sliding(1)],
    slideCrash: sliding(0, 'dizzy'),
  };
}

const LEGS = {
  stand: [
    '......SS...SS.........',
    '......SS...SS.........',
    '......SS...SS.........',
    '......SSS..SSS........',
  ],
  run1: [   // back leg up, front foot down
    '......SS...SS.........',
    '.......SSS.SS.........',
    '...........SS.........',
    '...........SSS........',
  ],
  run2: [   // front leg up, back foot down
    '......SS...SS.........',
    '......SS..SSS.........',
    '......SS..............',
    '......SSS.............',
  ],
};
// The slide's legs laid back along the sand; the second frame flicks the toes.
const SLIDE_LEGS = [[
  '....ssssSSSSSSSSbbbb.S.S....',
  '.ss..ssssssSSSSSSS..........',
  '.sSSSSSSSSSSSSS.............',
], [
  '....ssssSSSSSSSSbbbb.S.S....',
  'ss...ssssssSSSSSSS..........',
  'SSSSSSSSSSSSSSS.............',
]];

// ---- T-Rex: from the one-pager. The tail rises up and back in one diagonal,
// with the one-pager's notch between the tail and the back. The original's
// body box reaches up to 4 px into that notch (GDD 3.4).
const TREX = {
  colors: { S: '#5A6B7D', s: '#46546A', b: '#9AA9B8' },
  body: [
    '............SSSSSSSSS.',
    '...........SSSSSSSSSSS',
    '...........SSwwSSSSSSS',
    '...........SSwkSSSSSSS',
    '...........SSSSSSSSSSS',
    '...........SSSSSSSSSSS',
    '...........SSSSSSkkkk.',
    '...........SSSSSSSSS..',
    '..........SSSSSSS.....',
    'S........SSSSSSSSS....',
    'SS......SSSSSSSSbSSS..',
    'SSS....SSSSSSSSbbS.S..',
    'sSSS..SSSSSSSSbbb.....',
    '.sSSSSSSSSSSSbbbb.....',
    '..ssSSSSSSSSSbbbb.....',
    '...ssSSSSSSSSbbb......',
    '....sssSSSSSSbb.......',
    '.....ssssSSSSS........',
    '......sssSSSSS........',
  ],
  legs: LEGS,
  // The one-pager's low duck, 3 cells longer, with a fuller throat.
  slide: [[
    'S.................SSSSSSSSS.',
    'SS...............SSSSSSSSSSS',
    'SS...SSSSSSSSSSSSSSSwwSSSSSS',
    'sSSSSSSSSSSSSSSSSSSSwkSSSSSS',
    '.ssSSSSSSSSSSSSSSSSSSSSSkkkk',
    '..sssSSSSSSSSSSSSbbbbSSSSSSS',
    '...ssssSSSSSSSSSbbbbbSSSSSSS',
  ], [
    'S.................SSSSSSSSS.',
    'SS...............SSSSSSSSSSS',
    '.S...SSSSSSSSSSSSSSSwwSSSSSS',
    'sSSSSSSSSSSSSSSSSSSSwkSSSSSS',
    '.ssSSSSSSSSSSSSSSSSSSSSSkkkk',
    '..sssSSSSSSSSSSSSbbbbSSSSSSS',
    '...ssssSSSSSSSSSbbbbbSSSSSSS',
  ]],
  eye: [13, 2], mouth: [17, 7], slideEye: [20, 2], slideMouth: [24, 5],
};

// ---- Velociraptor: rust brown with dark feather bands, a long flat snout
// with teeth, a feather tuft behind the head, a long stiff tail held straight
// back, longer clawed arms and a raised sickle claw on each foot.
const RAPTOR_LEGS = {
  stand: [
    '......SS...SS.........',
    '......SS...SS.........',
    '......SSw..SSw........',
    '......SSS..SSS........',
  ],
  run1: [
    '......SS...SS.........',
    '.......SSS.SS.........',
    '.........w.SSw........',
    '...........SSS........',
  ],
  run2: [
    '......SS...SS.........',
    '......SS..SSS.........',
    '......SSw.....w.......',
    '......SSS.............',
  ],
};
const RAPTOR = {
  colors: { S: '#B4552B', s: '#7E3A1F', b: '#EBC08E', a: '#5C2A16' },
  body: [
    '...........a.SSSSS....',
    '..........aaSSSSSSSSS.',
    '...........SSwwSSSSSSS',
    '...........SSwkSSSSSSS',
    '...........SSSSSSSSSSS',
    '...........SSSSSSkwkwk',
    '...........SSSSSSSSSS.',
    '...........aSSSSS.....',
    '..........aSSSSSS.....',
    'a........aSSSSSSSS....',
    'aSSaSSaSaSSSSSSSbSSS..',
    'SSSSSSSSSSSSSSSbbS.S..',
    'ssssSSSSSSSSSSbbb..S..',
    '.sssSSSSSSSSSbbbb..k..',
    '..ssSSSSSSSSSbbbb.....',
    '...ssSSSSSSSSbbb......',
    '....sssSSSSSSbb.......',
    '.....ssssSSSSS........',
    '......sssSSSSS........',
  ],
  legs: RAPTOR_LEGS,
  // Low and flat: the tail straight back along the sand line.
  slide: [[
    '..................SSSSSSS...',
    'a................SSSSSSSSSS.',
    'aSSaSSaSaSSSSSSSSSSSwwSSSSSS',
    'SSSSSSSSSSSSSSSSSSSSwkSSSSSS',
    'ssssSSSSSSSSSSSSSSSSSSSkwkwk',
    '..sssSSSSSSSSSSSSbbbbSSSSSSS',
    '...ssssSSSSSSSSSbbbbbSSSSSSS',
  ], [
    '..................SSSSSSS...',
    '.................SSSSSSSSSS.',
    'aSSaSSaSaSSSSSSSSSSSwwSSSSSS',
    'aSSSSSSSSSSSSSSSSSSSwkSSSSSS',
    'ssssSSSSSSSSSSSSSSSSSSSkwkwk',
    '..sssSSSSSSSSSSSSbbbbSSSSSSS',
    '...ssssSSSSSSSSSbbbbbSSSSSSS',
  ]],
  eye: [13, 2], mouth: [17, 6], slideEye: [20, 2], slideMouth: [24, 5],
};

// ---- Pachycephalosaurus: dusty rose, with a thick bone dome ringed by
// knobs and a short beak; it slides with the dome forward, like a ram.
const PACHY = {
  colors: { S: '#B4677A', s: '#86475A', b: '#EBC3B5', a: '#F0DDB8', d: '#C9A77A' },
  body: [
    '............aaaaaa....',
    '..........daaaaaaaaa..',
    '..........daaaaaaaaaa.',
    '...........dSwwSdSSSSS',
    '...........SSwkSSSSSSS',
    '...........SSSSSSSSSSS',
    '...........SSSSSSSkkk.',
    '...........SSSSSSSSS..',
    '..........SSSSSSS.....',
    'S........SSSSSSSSS....',
    'SS......SSSSSSSSbSSS..',
    'SSS....SSSSSSSSbbS.S..',
    'sSSS..SSSSSSSSbbb.....',
    '.sSSSSSSSSSSSbbbb.....',
    '..ssSSSSSSSSSbbbb.....',
    '...ssSSSSSSSSbbb......',
    '....sssSSSSSSbb.......',
    '.....ssssSSSSS........',
    '......sssSSSSS........',
  ],
  legs: LEGS,
  slide: [[
    'S..................SSSSdaaa.',
    'SS...............SSSSSSdaaaa',
    'SS...SSSSSSSSSSSSSSwwSSdaaaa',
    'sSSSSSSSSSSSSSSSSSSwkSSdaaaa',
    '.ssSSSSSSSSSSSSSSSSSSSSSdaaa',
    '..sssSSSSSSSSSSSSbbbbSSSSSSS',
    '...ssssSSSSSSSSSbbbbbSSSSkkS',
  ], [
    'S..................SSSSdaaa.',
    'SS...............SSSSSSdaaaa',
    '.S...SSSSSSSSSSSSSSwwSSdaaaa',
    'sSSSSSSSSSSSSSSSSSSwkSSdaaaa',
    '.ssSSSSSSSSSSSSSSSSSSSSSdaaa',
    '..sssSSSSSSSSSSSSbbbbSSSSSSS',
    '...ssssSSSSSSSSSbbbbbSSSSkkS',
  ]],
  eye: [13, 3], mouth: [17, 7], slideEye: [19, 2], slideMouth: [21, 5],
};

// ---- Parasaurolophus: teal, with a long orange tube crest swept back from
// the head and a broad cream duck bill; it slides with the crest flat along its back.
const PARA = {
  colors: { S: '#2F8F8A', s: '#1F6663', b: '#BFE3D2', a: '#F08A3A', d: '#B85A24' },
  body: [
    '..aaaaaaaaa...........',
    '.aaaaaaaaaaSSSSSSS....',
    '..ddddddddSSSSSSSSSS..',
    '..........SSSwwSSSSSS.',
    '...........SSwkSSSSSSS',
    '...........SSSSSSSbbbb',
    '...........SSSSSSkbbbb',
    '...........SSSSSSSbbb.',
    '..........SSSSSSS.....',
    'S........SSSSSSSSS....',
    'SS......SSSSSSSSbSSS..',
    'SSS....SSSSSSSSbbS.S..',
    'sSSS..SSSSSSSSbbb.....',
    '.sSSSSSSSSSSSbbbb.....',
    '..ssSSSSSSSSSbbbb.....',
    '...ssSSSSSSSSbbb......',
    '....sssSSSSSSbb.......',
    '.....ssssSSSSS........',
    '......sssSSSSS........',
  ],
  legs: LEGS,
  slide: [[
    'S....aaaaaaaaaaaSSSSSSSS....',
    'SS..aaaaaaaaaaaSSSSSSSSSSSS.',
    'SS...ddddddddSSSSSSSwwSSSSSS',
    'sSSSSSSSSSSSSSSSSSSSwkSSSSSS',
    '.ssSSSSSSSSSSSSSSSSSSSSkbbbb',
    '..sssSSSSSSSSSSSSbbbbSSSSbbb',
    '...ssssSSSSSSSSSbbbbbSSSSSSS',
  ], [
    'S....aaaaaaaaaaaSSSSSSSS....',
    'SS..aaaaaaaaaaaSSSSSSSSSSSS.',
    '.S...ddddddddSSSSSSSwwSSSSSS',
    'sSSSSSSSSSSSSSSSSSSSwkSSSSSS',
    '.ssSSSSSSSSSSSSSSSSSSSSkbbbb',
    '..sssSSSSSSSSSSSSbbbbSSSSbbb',
    '...ssssSSSSSSSSSbbbbbSSSSSSS',
  ]],
  eye: [13, 3], mouth: [16, 7], slideEye: [20, 2], slideMouth: [22, 5],
};

// Each slide gets the legs laid back under it (frames 0 and 1).
for (const r of [TREX, RAPTOR, PACHY, PARA]) r.slide = r.slide.map((rows, i) => [...rows, ...SLIDE_LEGS[i]]);

export const RUNNERS = {
  trex: runner(TREX),
  velociraptor: runner(RAPTOR),
  pachycephalosaurus: runner(PACHY),
  parasaurolophus: runner(PARA),
};
// Where each run frame's planted foot is, from the runner's x (footfall dust).
export const FOOTFALL_X = [23, 13, 23, 13];

// ---- Cacti: g green, l light, G dark ------------------------------------------------------
// Small: 8×18 cells (16×36 px) over the 17×35 box, 1 px up so the base sits on the ground.
const CACTUS_SMALL = { oy: -1, rows: [
  '..ggg...',
  '..lgG...',
  '..lgG.gg',
  '..lgG.lG',
  'g.lgG.lG',
  'g.lgG.lG',
  'g.lgG.lG',
  'g.lgG.lG',
  'g.lgGglG',
  'gglgG...',
  'gglgG...',
  'g.lgG...',
  'g.lgG...',
  'g.lgG...',
  'gglgG...',
  'gglgG...',
  '..lgG...',
  '..lgG...',
] };
// Large: 12×25 cells (24×50 px) over the 25×50 box.
const CACTUS_LARGE = { oy: 0, rows: [
  '.....gg.....',
  '....glgG....',
  '....glgG....',
  '....glgG....',
  '....glgG..g.',
  '....glgG.lG.',
  'gg..glgG.lG.',
  'lG..glgG.lG.',
  'lG..glgG.lG.',
  'lG..glgG.lG.',
  'lG..glgG.lG.',
  'lG..glgGglG.',
  'lG..glgGggG.',
  'lGggglgG....',
  'lgggglgG....',
  'lG..glgG.lG.',
  'lG..glgG.lG.',
  'lG..glgG.lG.',
  'lG..glgG.lG.',
  'lG..glgG.lG.',
  'lGg.glgG.lG.',
  'lGggglgGglG.',
  '.GggglgGggG.',
  '....glgG....',
  '....glgG....',
] };

// ---- Pterodactyl, 23×20 cells (46×40 px), faces left: P body, D wing, f beak and belly
const PTERO = [{ oy: 0, rows: [   // wings up
  '..........DD...........',
  '..........DDD..........',
  '..........DDDD.........',
  '......PP..DDDDD........',
  '.....PPPP.DDDDDD.......',
  '....PPPPP.DDDDDDD......',
  '...PPwwPPPDDDDDDDD.....',
  'fffPPwkPPPPPPPPPPPP....',
  'fffPPPPPPPPPPPPPPPPPPPP',
  '...PPPPPPPPPffffffPPPPP',
  '.........PPPffffffPPP..',
  '..........PPPPPPPPPPP..',
  '.......................',
  '.......................',
  '.......................',
  '.......................',
  '.......................',
  '.......................',
  '.......................',
  '.......................',
] }, { oy: 0, rows: [   // wings down
  '.......................',
  '.......................',
  '.......................',
  '......PP...............',
  '.....PPPP..............',
  '....PPPPP..............',
  '...PPwwPPP.............',
  'fffPPwkPPPPPPPPPPPP....',
  'fffPPPPPPPPPPPPPPPPPPPP',
  '...PPPPPPPPPffffffPPPPP',
  '.........PPPffffffPPP..',
  '..........PPPPPPPPPPP..',
  '..........DDDDDDDD.....',
  '..........DDDDDDD......',
  '..........DDDDDD.......',
  '..........DDDDD........',
  '..........DDDD.........',
  '..........DDD..........',
  '..........DD...........',
  '.......................',
] }];

// ---- Egg, 5×7 cells (10×14 px): c cream, o orange speckle, f sand shade, W white glint
const EGG = ['.ccc.', 'ccccc', 'cccoc', 'ccccc', 'coccc', 'cccff', '.fff.'];
const EGG_GLINT = EGG.map((r, i) => i === 1 ? 'cWccc' : i === 2 ? 'cWcoc' : r);

// ---- Hatch egg (GDD 7.1), 22×28 cells, about a runner's size: the egg
// wobbles, cracks in 3 steps along a zigzag, and the top flies off in two
// halves. Built from its outline: narrower at the top, shaded bottom right.
const EGG_W = 22, EGG_H = 28;
const SPECKLES = ['8,4', '13,6', '5,9', '16,11', '10,12', '4,16', '14,17', '9,20', '17,21', '6,23', '12,25'];
function inEgg(x, y) {
  const t = (y + 0.5) / EGG_H, k = (t - 0.58) / (t < 0.58 ? 0.58 : 0.42);
  return t > 0 && t < 1 && Math.abs(x + 0.5 - EGG_W / 2) <= EGG_W / 2 * Math.sqrt(Math.max(0, 1 - k * k));
}
const HATCH_EGG = Array.from({ length: EGG_H }, (_, y) => Array.from({ length: EGG_W }, (_, x) =>
  !inEgg(x, y) ? '.' : !inEgg(x + 2, y + 2) ? 'f' : SPECKLES.includes(`${x},${y}`) ? 'o' : 'c').join(''));
const CRACK_Y = Array.from({ length: EGG_W }, (_, x) => 13 + [0, -1, 0, 1][x % 4]);   // the zigzag's row in each column
const CRACK_COLS = [[8, 13], [4, 17], [0, 21]];                                          // columns cracked at each step
const cracked = step => HATCH_EGG.map((row, y) => [...row].map((c, x) => {
  const [x0, x1] = CRACK_COLS[step - 1] || [1, 0];
  return c !== '.' && x >= x0 && x <= x1 && y === CRACK_Y[x] ? 'k' : c;
}).join(''));
// The shell above the crack (split into left and right halves) and below it.
const part = keep => HATCH_EGG.map((row, y) => [...row].map((c, x) => keep(x, y) ? c : '.').join(''));

export const ART = {
  hatchEgg: {
    stages: [0, 1, 2, 3].map(i => ({ rows: cracked(i), oy: 0 })),
    left: { rows: part((x, y) => x < EGG_W / 2 && y < CRACK_Y[x]), oy: 0 },
    right: { rows: part((x, y) => x >= EGG_W / 2 && y < CRACK_Y[x]), oy: 0 },
    bottom: { rows: part((x, y) => y > CRACK_Y[x]), oy: 0 },
  },
  'cactus-small': CACTUS_SMALL,
  'cactus-large': CACTUS_LARGE,
  ptero: PTERO,
  egg: [{ rows: EGG, oy: 0 }, { rows: EGG_GLINT, oy: 0 }],   // plain, glinting
};
