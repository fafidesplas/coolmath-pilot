// The T-Rex's pixel maps (GDD 9), from the one-pager's art sample: drawn
// there at 2 px per cell, here scaled up with Scale2x, so the diagonals become
// clean 1 px steps. No DOM, so tools/rex-test.mjs can check every frame
// against the hitbox template. sprites.js adds the 1 px Night Ink outline.
// Cells: S slate, s slate dark, b slate light (belly), w cream, k ink, '.' empty.

// Standing body, 22×23 cells (44×46 px). The tail rises up and back in one
// diagonal; the inner corner between the tail and the body is filled, so the
// original's body box never reaches across an empty gap.
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
  'S.....SSSSSSSSSSSS....',
  'SS.SSSSSSSSSSSSSbSSS..',
  'SSSSSSSSSSSSSSSbbS.S..',
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

// Sliding on its belly (the duck), 28×10 cells (56×20 px): the one-pager's
// low duck, 3 cells longer, with both legs laid back along the sand. The
// second frame flicks the tail tip and the toes.
const SLIDE = [[
  '..................SSSSSSSSS.',
  'S................SSSSSSSSSSS',
  'SS....SSSSSSSSSSSSSSwwSSSSSS',
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
  '.S....SSSSSSSSSSSSSSwwSSSSSS',
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

// Scale2x (EPX): each cell becomes 2×2 px, and a corner takes its neighbours'
// color where two of them agree, which smooths stair steps into 1 px diagonals.
export function scale2x(rows) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w) ? '.' : rows[y][x] || '.';
  const out = Array.from({ length: h * 2 }, () => []);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    out[2 * y][2 * x] = C === A && C !== D && A !== B ? A : P;
    out[2 * y][2 * x + 1] = A === B && A !== C && B !== D ? B : P;
    out[2 * y + 1][2 * x] = D === C && D !== B && C !== A ? C : P;
    out[2 * y + 1][2 * x + 1] = B === D && B !== A && D !== C ? D : P;
  }
  return out.map(r => r.join(''));
}

// Standing frames are 44×47 px: one empty row on top, so the feet stand on
// the footprint's bottom edge.
const standing = (legs, kind) => ['.'.repeat(44), ...scale2x(face([...BODY, ...LEGS[legs]], kind, 13, 7, 17))];
// Slide frames fill the 25 px tall duck footprint from the bottom: 5 empty
// rows, then the 56×20 px slide.
const sliding = (frame, kind) => [...Array(5).fill('.'.repeat(56)), ...scale2x(face(SLIDE[frame], kind, 20, 5, 24))];

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
