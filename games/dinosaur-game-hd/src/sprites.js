// Placeholder sprites drawn in code (GDD 9): the T-Rex, the cacti and the
// pterodactyl, flat shapes with a 1 px Night Ink outline, each drawn over its
// collision boxes (GDD 3.4). The final art replaces them with a sprite sheet.
// Every sprite canvas has a 1 px margin for the outline: draw it at (x - 1, y - 1).

export const PAL = {
  ink: '#1B2340', sand: '#F2C879', orange: '#F08A24', green: '#3FA34D', slate: '#5A6B7D', cream: '#FFF6E0',
};
const C = {
  ...PAL,
  slateDark: '#46546A',
  greenDark: '#2C7D3A', greenLight: '#6CC46F',
  ptero: '#C8662A', pteroDark: '#9E4F22',
  white: '#FFFFFF',
};

// shape: [x, y, w, h, color] rects, outlined together; details: drawn on top, inside the shape.
function sprite(w, h, shape, details = []) {
  const fill = document.createElement('canvas');
  fill.width = w + 2; fill.height = h + 2;
  const f = fill.getContext('2d');
  for (const [x, y, rw, rh, c] of shape) { f.fillStyle = C[c]; f.fillRect(x + 1, y + 1, rw, rh); }
  const out = document.createElement('canvas');
  out.width = w + 2; out.height = h + 2;
  const o = out.getContext('2d');
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) o.drawImage(fill, dx, dy);
  o.globalCompositeOperation = 'source-in';
  o.fillStyle = C.ink;
  o.fillRect(0, 0, out.width, out.height);
  o.globalCompositeOperation = 'source-over';
  o.drawImage(fill, 0, 0);
  for (const [x, y, rw, rh, c] of details) { o.fillStyle = C[c]; o.fillRect(x + 1, y + 1, rw, rh); }
  return out;
}

// ---- T-Rex, 44×47 standing (faces right) ------------------------------------------------
const TREX = [
  [25, 0, 17, 1, 'slate'], [24, 1, 20, 9, 'slate'], [24, 10, 16, 4, 'slate'],   // head, jaw
  [20, 12, 10, 8, 'slate'],                                                      // neck
  [8, 17, 22, 17, 'slate'],                                                      // body
  [1, 18, 8, 8, 'slate'], [4, 26, 5, 3, 'slate'],                                // tail
  [30, 21, 5, 2, 'slate'], [33, 23, 2, 2, 'slate'],                              // arm
];
const BODY_MARKS = [[10, 17, 16, 2, 'slateDark'], [17, 23, 11, 10, 'cream'], [42, 3, 1, 1, 'ink']];
const EYE_OPEN = [[28, 3, 4, 4, 'cream'], [30, 4, 2, 2, 'ink']];
const EYE_SHUT = [[28, 5, 4, 1, 'ink']];
const EYE_DIZZY = [[28, 3, 4, 4, 'cream'], [28, 3, 1, 1, 'ink'], [31, 3, 1, 1, 'ink'], [29, 4, 2, 2, 'ink'], [28, 6, 1, 1, 'ink'], [31, 6, 1, 1, 'ink']];
const MOUTH = [[33, 10, 7, 1, 'ink']];
const MOUTH_OPEN = [[33, 10, 7, 2, 'ink'], [35, 10, 1, 1, 'cream'], [38, 10, 1, 1, 'cream']];

const leg = (x, c) => [[x, 31, 6, 6, c], [x + 1, 37, 4, 7, c], [x + 1, 44, 7, 3, c]];
const legUp = (x, c) => [[x, 31, 6, 5, c], [x + 2, 36, 4, 4, c], [x + 2, 40, 7, 2, c]];
const trex = (legs, face) => sprite(44, 47, [...legs, ...TREX], [...BODY_MARKS, ...face]);

// The jump: legs stretched long with the toes pointing down, the tail
// drooping to a point down and back. Same outline over the hitbox template.
const legLong = (x, c) => [[x, 31, 6, 6, c], [x + 1, 37, 4, 8, c], [x + 2, 45, 3, 2, c]];
const TAIL_DOWN = [];
for (let y = 18; y <= 41; y++) {   // a rounded root on the back, tapering down to the tip
  const t = Math.max(0, y - 24) / 17, left = y < 20 ? 21 - y : Math.round(1 + t * 1.5), right = Math.round(9 - t * 6);
  TAIL_DOWN.push([left, y, right - left + 1, 1, 'slate']);
}
const TREX_JUMP = TREX.filter(r => r[0] > 4);   // the standing tail out, the drooping one in
// The back slopes in one line from the neck down to the tail tip (Pao's
// paint-over): [y, first x] per row, everything left of it cut away.
const JUMP_BACK = new Map([[16, 14], [17, 13], [18, 12], [19, 9], [20, 8], [21, 7], [22, 6], [23, 5], [24, 4],
  [25, 4], [26, 4], [27, 3], [28, 3], [29, 3], [30, 2], [31, 2], [32, 1]]);
function clipBack(rects) {
  const out = [];
  for (const [x, y, w, h, c] of rects) for (let j = 0; j < h; j++) {
    const x0 = Math.max(x, JUMP_BACK.get(y + j) ?? 0);
    if (x0 < x + w) out.push([x0, y + j, x + w - x0, 1, c]);
  }
  return out;
}
const jumpPose = face => sprite(44, 47,
  clipBack([...legLong(9, 'slateDark'), ...legLong(19, 'slate'), ...TAIL_DOWN, ...TREX_JUMP]),
  [...clipBack(BODY_MARKS), ...face]);

// ---- T-Rex sliding on its belly (the duck), 59×25 -------------------------------------------
// Same footprint and hitbox as the original's duck; only the pose changes.
// Head raised and leading, belly on the sand, both back legs stretched out
// with toes up, a slim tail tapering to a point up and back; the two frames
// flick the tail tip. Drawn as pixel maps from Pao's paint-overs:
// b slate, c slate dark, d cream, a ink, '.' empty.
const SLIDE_MAPS = [[
  '...........................................................',
  '...........................................................',
  '...........................................................',
  '.bb......................................bbbbbbbbbbbbbbbb..',
  '..bbb....................................bbbbbbbbbbbbbbbb..',
  '...bbbb..................................bbbdddbbbbbbbbab..',
  '....bbbb.................................bbbdaabbbbbbbbbb..',
  '.....bbbb................................bbbdaabbbbbbbbbb..',
  '......bbbbb..............................bbbbbbbbbbbbbbbb..',
  '......cbbbbbb.......................bbbbbbbbbbbbbbbbbbbbb..',
  '.......ccbbbbb......................bbbbbbbbbbbbbbbbbbbbb..',
  '........ccbbbbbbb...................bbbbbbbbbbbaaaaaa......',
  '.........ccbbbbbbbbb................bbbbbbbbbbbbbbbbb......',
  '.........ccccbbbbbbbcccccccccccccccccbbbbbbbbbbbbbbbb......',
  '..........cccccbbbbbcccccccccccccccccbbbbbb................',
  '...........cccccbbbbbbbbbbbbbbbbbbbbbbbbbbb................',
  '...cc.......cccccbbbbbbbbbbbbbbbbbbbbbbbbbb................',
  '...cc........cccccbbbbbbbbbbbbbbbbbbbbbbbbb................',
  '...ccccccccccccbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.............',
  '....cbbccccccccbbbbbbbddddddddddddddddddbbbbbbb............',
  '.....bbaaaaaaaabbbbbbbddddddddddddddddddbbb..bb............',
  '.....bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb..................',
  '......bbbbbbbbbbb...bbbbbbbbbbbbbbbbbbbbb..................',
  '...........................................................',
  '...........................................................',
], [
  '...........................................................',
  '...........................................................',
  '.bb........................................................',
  '.bbb.....................................bbbbbbbbbbbbbbbb..',
  '..bbb....................................bbbbbbbbbbbbbbbb..',
  '...bbbb..................................bbbdddbbbbbbbbab..',
  '....bbbb.................................bbbdaabbbbbbbbbb..',
  '.....bbbbb...............................bbbdaabbbbbbbbbb..',
  '......bbbbb..............................bbbbbbbbbbbbbbbb..',
  '.......bbbbbb.......................bbbbbbbbbbbbbbbbbbbbb..',
  '.......ccbbbbbb.....................bbbbbbbbbbbbbbbbbbbbb..',
  '........ccbbbbbbb...................bbbbbbbbbbbaaaaaa......',
  '.........ccbbbbbbbbb................bbbbbbbbbbbbbbbbb......',
  '..........ccbbbbbbbbcccccccccccccccccbbbbbbbbbbbbbbbb......',
  '...........cccbbbbbbcccccccccccccccccbbbbbb................',
  '...........ccccbbbbbbbbbbbbbbbbbbbbbbbbbbbb................',
  '....cc......ccccbbbbbbbbbbbbbbbbbbbbbbbbbbb................',
  '....cc.......ccccbbbbbbbbbbbbbbbbbbbbbbbbbb................',
  '....cccccccccccbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.............',
  '....bbcccccccccbbbbbbbddddddddddddddddddbbbbbbb............',
  '....bb.aaaaaaaabbbbbbbddddddddddddddddddbbb..bb............',
  '....bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb..................',
  '.....bbbbbbbbbbb....bbbbbbbbbbbbbbbbbbbbb..................',
  '...........................................................',
  '...........................................................',
]];
const SLIDE_COLOR = { a: 'ink', b: 'slate', c: 'slateDark', d: 'cream' };
// One rect per run of same-colored pixels.
function mapRects(rows) {
  const out = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const v = row[x];
      let n = 1;
      while (row[x + n] === v) n++;
      if (v !== '.') out.push([x, y, n, 1, SLIDE_COLOR[v]]);
      x += n;
    }
  });
  return out;
}
const SLIDE_DIZZY = [[44, 5, 3, 3, 'cream'], [44, 5, 1, 1, 'ink'], [46, 5, 1, 1, 'ink'], [45, 6, 1, 1, 'ink'], [44, 7, 1, 1, 'ink'], [46, 7, 1, 1, 'ink']];
const slide = (frame, eye = []) => sprite(59, 25, mapRects(SLIDE_MAPS[frame]), eye);

// ---- Cacti ------------------------------------------------------------------------------
const CACTUS_SMALL = sprite(17, 35, [
  [5, 1, 7, 34, 'green'], [6, 0, 5, 1, 'green'],      // trunk
  [0, 8, 4, 13, 'green'], [0, 18, 6, 3, 'green'],     // left arm
  [1, 27, 4, 8, 'green'],                             // shoot at the base
  [13, 4, 4, 10, 'green'], [10, 11, 7, 3, 'green'],   // right arm
], [[7, 2, 1, 31, 'greenLight'], [10, 3, 1, 30, 'greenDark'], [1, 9, 1, 9, 'greenLight']]);

const CACTUS_LARGE = sprite(25, 50, [
  [8, 1, 9, 49, 'green'], [9, 0, 7, 1, 'green'],
  [0, 12, 5, 16, 'green'], [0, 25, 9, 4, 'green'],
  [1, 38, 6, 12, 'green'],
  [20, 8, 5, 16, 'green'], [16, 20, 9, 4, 'green'],
  [18, 40, 5, 10, 'green'],
], [[10, 2, 1, 46, 'greenLight'], [15, 3, 1, 45, 'greenDark'], [1, 13, 1, 12, 'greenLight'], [21, 9, 1, 12, 'greenLight']]);

// ---- Pterodactyl, 46×40 (faces left), wings up and down -----------------------------------
const PTERO = [
  [0, 14, 9, 3, 'sand'],                             // beak
  [8, 9, 9, 9, 'ptero'], [15, 6, 9, 4, 'ptero'],     // head, crest
  [15, 15, 18, 7, 'ptero'], [18, 20, 24, 7, 'ptero'], [41, 22, 5, 3, 'ptero'],
];
const PTERO_MARKS = [[10, 11, 2, 2, 'cream'], [10, 12, 1, 1, 'ink'], [20, 24, 18, 2, 'sand']];
const WING_UP = [[20, 4, 11, 12, 'pteroDark'], [22, 0, 7, 4, 'pteroDark']];
const WING_DOWN = [[20, 26, 11, 8, 'pteroDark'], [22, 34, 7, 6, 'pteroDark']];

// ---- Egg, 10×13: cream with orange speckles and a glint ------------------------------------
const EGG = [
  [3, 0, 4, 1, 'cream'], [2, 1, 6, 1, 'cream'], [1, 2, 8, 3, 'cream'], [0, 5, 10, 6, 'cream'],
  [1, 11, 8, 1, 'cream'], [2, 12, 6, 1, 'cream'],
];
const EGG_MARKS = [[7, 3, 1, 1, 'orange'], [3, 5, 1, 1, 'orange'], [6, 6, 2, 1, 'orange'], [2, 8, 1, 1, 'orange'], [5, 9, 2, 1, 'orange'], [7, 9, 1, 1, 'orange'], [6, 10, 3, 1, 'sand'], [3, 11, 4, 1, 'sand']];
const GLINT = [[2, 3, 1, 2, 'white']];

export const SPR = {
  trex: {
    run: [
      trex([...leg(10, 'slateDark'), ...legUp(20, 'slate')], [...EYE_OPEN, ...MOUTH]),
      trex([...leg(11, 'slateDark'), ...leg(18, 'slate')], [...EYE_OPEN, ...MOUTH]),
      trex([...legUp(10, 'slateDark'), ...leg(20, 'slate')], [...EYE_OPEN, ...MOUTH]),
      trex([...leg(13, 'slateDark'), ...leg(16, 'slate')], [...EYE_OPEN, ...MOUTH]),
    ],
    jump: jumpPose([...EYE_OPEN, ...MOUTH]),
    crash: trex([...leg(10, 'slateDark'), ...leg(20, 'slate')], [...EYE_DIZZY, ...MOUTH_OPEN]),
    sleep: trex([...leg(10, 'slateDark'), ...leg(20, 'slate')], [...EYE_SHUT, ...MOUTH]),
    slide: [slide(0), slide(1)],
    slideCrash: slide(0, SLIDE_DIZZY),
  },
  'cactus-small': CACTUS_SMALL,
  'cactus-large': CACTUS_LARGE,
  ptero: [sprite(46, 40, [...WING_UP, ...PTERO], PTERO_MARKS), sprite(46, 40, [...WING_DOWN, ...PTERO], PTERO_MARKS)],
  egg: [sprite(10, 13, EGG, EGG_MARKS), sprite(10, 13, EGG, [...EGG_MARKS, ...GLINT])],   // plain, glinting
};
