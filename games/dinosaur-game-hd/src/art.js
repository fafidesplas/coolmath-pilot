// Sprite art as cell maps (GDD 9), in the one-pager's chunky style: every
// cell is one art pixel, drawn 2×2 logical px, and sprites.js adds a 1 cell
// (2 px) Night Ink outline. No DOM, so tools/art-test.mjs can check every
// frame against the hitbox template.
// Each sprite: { rows, oy }, where oy is how far below the footprint's top
// (or the obstacle's y) the first row is drawn, in px.

export const CELL = 2;   // logical px per art pixel

// ---- T-Rex ------------------------------------------------------------------------------
// From the one-pager. Cells: S slate, s slate dark, b slate light (belly),
// w cream, k ink. Standing body, 22×19 cells; the tail rises up and back in
// one diagonal, its inner corner filled so the original's body box never
// reaches across an empty gap.
const BODY = [
  '............SSSSSSSSS.',
  '...........SSSSSSSSSSS',
  '...........SSwwSSSSSSS',
  '...........SSwkSSSSSSS',
  '...........SSSSSSSSSSS',
  '...........SSSSSSSSSSS',
  '...........SSSSSSkkkk.',
  '...........SSSSSSSSS..',
  '..........SSSSSSS.....',
  'S....SSSSSSSSSSSSS....',
  'SS....SSSSSSSSSSbSSS..',
  'SSS.SSSSSSSSSSSbbS.S..',
  'sSSSSSSSSSSSSSbbb.....',
  '.sSSSSSSSSSSSbbbb.....',
  '..ssSSSSSSSSSbbbb.....',
  '...ssSSSSSSSSbbb......',
  '....sssSSSSSSbb.......',
  '.....ssssSSSSS........',
  '......sssSSSSS........',
];
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

// Sliding on its belly (the duck), 28×10 cells: the one-pager's low duck,
// 3 cells longer, with a fuller throat and both legs laid back along the
// sand. The second frame flicks the tail tip and the toes.
const SLIDE = [[
  'S.................SSSSSSSSS.',
  'SS...............SSSSSSSSSSS',
  'SS...SSSSSSSSSSSSSSSwwSSSSSS',
  'sSSSSSSSSSSSSSSSSSSSwkSSSSSS',
  '.ssSSSSSSSSSSSSSSSSSSSSSkkkk',
  '..sssSSSSSSSSSSSSbbbbSSSSSSS',
  '...ssssSSSSSSSSSbbbbbSSSSSSS',
  '....ssssSSSSSSSSbbbb.S.S....',
  '.ss..ssssssSSSSSSS..........',
  '.sSSSSSSSSSSSSS.............',
], [
  'S.................SSSSSSSSS.',
  'SS...............SSSSSSSSSSS',
  '.S...SSSSSSSSSSSSSSSwwSSSSSS',
  'sSSSSSSSSSSSSSSSSSSSwkSSSSSS',
  '.ssSSSSSSSSSSSSSSSSSSSSSkkkk',
  '..sssSSSSSSSSSSSSbbbbSSSSSSS',
  '...ssssSSSSSSSSSbbbbbSSSSSSS',
  '....ssssSSSSSSSSbbbb.S.S....',
  'ss...ssssssSSSSSSS..........',
  'SSSSSSSSSSSSSSS.............',
]];

const set = (rows, y, x, s) => { rows[y] = rows[y].slice(0, x) + s + rows[y].slice(x + s.length); };
function face(rows, kind, eyeX, mouthY, mouthX) {
  rows = rows.slice();
  if (kind === 'dizzy') { set(rows, 2, eyeX, 'kw'); set(rows, 3, eyeX, 'wk'); set(rows, mouthY, mouthX, 'kk'); }
  if (kind === 'shut') { set(rows, 2, eyeX, 'SS'); set(rows, 3, eyeX, 'kk'); }
  return rows;
}

// Standing frames are 44×46 px in the 44×47 footprint: 1 px down, so the
// feet stand on its bottom edge. Slide frames are 56×20 px at the bottom of
// the 25 px duck footprint.
const standing = (legs, kind) => ({ rows: face([...BODY, ...LEGS[legs]], kind, 13, 7, 17), oy: 1 });
const sliding = (frame, kind) => ({ rows: face(SLIDE[frame], kind, 20, 5, 24), oy: 5 });

export const REX = {
  run: [standing('run1'), standing('run2'), standing('run1'), standing('run2')],
  jump: standing('stand'),
  crash: standing('stand', 'dizzy'),
  sleep: standing('stand', 'shut'),
  slide: [sliding(0), sliding(1)],
  slideCrash: sliding(0, 'dizzy'),
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

export const ART = {
  'cactus-small': CACTUS_SMALL,
  'cactus-large': CACTUS_LARGE,
  ptero: PTERO,
  egg: [{ rows: EGG, oy: 0 }, { rows: EGG_GLINT, oy: 0 }],   // plain, glinting
};
