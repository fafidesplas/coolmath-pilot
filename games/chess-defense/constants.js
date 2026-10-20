/*
    Gambit Defense — tuning tables and shared constants.

    The whole game hangs off one idea: a chess piece's move generation IS its
    attack range. Towers shoot whatever stands on a square their pattern
    reaches, and sliding pieces are blocked by anything in the way — which is
    what makes placement a real puzzle.

    A consequence of that, straight out of the geometry and true in real chess:
    a bishop's and a pawn's attacks never leave their OWN square color, and a
    knight's attacks always land on the OPPOSITE color. Rooks and queens hit
    both. Warded creeps (below) turn that fact into the central decision — they
    skip the other color entirely, so half your board simply cannot reach them.
*/

'use strict';

///////////////////////////////////////////////////////////////////////////////
// BOARD

const CELL_SIZE = 1.6;

// Each map (one file in levels/) is a board size, a King cell, and one or
// more creep routes. A route is a list of corners walked in order: creeps enter at the first waypoint and
// every route has to end on the King's cell.
//
// `hpMul` is the per-map difficulty knob (enemy health multiplier). A two-lane
// map halves the traffic per route, but it also halves how much of your board
// can reach any given creep, so shape alone already makes more lanes harder.
// `wardsOnly` swaps in WARD_WAVES; `pathRoutes` tags lanes (e.g. 'diag' for
// Couriers, which only walk tagged lanes).
//
// Filled at startup from levels/levelNN.js — see levels.js, and editor.html
// to make new ones.
const MAPS = [];

///////////////////////////////////////////////////////////////////////////////
// COLORS

const LIGHT_SQUARE  = hsl(.11, .18, .70);
const DARK_SQUARE   = hsl(.09, .16, .58);
const PATH_LIGHT    = hsl(.62, .25, .26);
const PATH_DARK     = hsl(.62, .28, .20);
const GRID_LINE     = hsl(0, 0, 0, .15);
const UNUSABLE_COLOR = hsl(.62, .12, .13);   // unusable squares (level `blocked`)
const UNUSABLE_MARK  = hsl(.62, .1, .3);
const WALL_COLOR     = hsl(.08, .1, .42);    // slider-blocking walls (level `walls`)
const WALL_EDGE      = hsl(.08, .12, .24);

const PIECE_COLOR   = hsl(0, 0, .96);
const PIECE_OUTLINE = hsl(0, 0, .08);
const BASE_COLOR    = hsl(.13, .9, .6);

const RANGE_COLOR   = hsl(.33, .8, .55, .28);
const BLOCKED_COLOR = hsl(0, .8, .5, .25);
const GHOST_OK      = hsl(.33, .8, .55, .45);
const GHOST_BAD     = hsl(0, .8, .5, .45);
const HUD_COLOR     = hsl(0, 0, .95);

// Move destinations are blue. Creep-route squares (build ghost and move
// targets alike) are amber, not red: red means "can't", and the lane is a
// legal gamble — ×2 damage, but a creep that reaches the piece kills it.
const MOVE_COLOR        = hsl(.55, .9, .6,  .34);
const LANE_RISK_COLOR   = hsl(.1,  .95, .55, .42);
const LANE_DAMAGE_COLOR = hsl(.1,  .95, .65);
const DANGER_COLOR      = hsl(.02, .9, .6,  .8);
const SLOW_COLOR        = hsl(.55, .9, .75);
const PIERCE_COLOR      = hsl(.5,  .9, .6);    // arrow badge on pierced pieces
const RAPID_COLOR       = hsl(.16, 1,  .62);   // bolt badge on rapid pieces

const WARD_LIGHT_COLOR = hsl(.13, .35, .92);   // Alabaster's ring
const WARD_DARK_COLOR  = hsl(.73, .60, .38);   // Obsidian's ring
const SMASH_COLOR      = hsl(.07, .9,  .55);   // Ravager's reach and impact

///////////////////////////////////////////////////////////////////////////////
// MOVE PATTERNS
// `dirs` slide until blocked, `steps` are single jumps that ignore blockers.

const BISHOP_DIRS  = [[-1,-1], [-1,1], [1,-1], [1,1]];
const ROOK_DIRS    = [[-1,0], [1,0], [0,-1], [0,1]];
const QUEEN_DIRS   = [...BISHOP_DIRS, ...ROOK_DIRS];
const KNIGHT_STEPS = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const PAWN_STEPS   = [[-1,-1], [-1,1]];   // white pawns, so always up-board

///////////////////////////////////////////////////////////////////////////////
// TOWERS
// The Pawn is the cheapest damage per gold in the game but covers only two
// squares; the Queen is the worst value per gold and covers half the board.

// `hint` calls out each piece's square-color behaviour, because that is what
// decides whether it can touch a warded creep at all — a ward never leaves its
// own color, so a piece that never attacks that color never gets a shot.
// `hp` only matters against Ravagers, the one creep that hits pieces beside
// its route; everything else either ignores a piece or tramples it outright.
const TOWER_TYPES = {
    pawn:   {name:'PAWN',   glyph:'♟', cost:12,  damage:5,  rate:.40, hp:20, steps: PAWN_STEPS,   slow:1.5, hint:'Two forward diagonals — hits its own square color'},
    knight: {name:'KNIGHT', glyph:'♞', cost:28,  damage:11, rate:.75, hp:45, steps: KNIGHT_STEPS, slow:3,   hint:'8 L-squares, jumps blockers — always the opposite color'},
    bishop: {name:'BISHOP', glyph:'♝', cost:34,  damage:9,  rate:.55, hp:45, dirs:  BISHOP_DIRS,  slow:3.5, hint:'Diagonal lines — locked to its own square color forever'},
    rook:   {name:'ROOK',   glyph:'♜', cost:46,  damage:22, rate:.85, hp:70, dirs:  ROOK_DIRS,    slow:5,   hint:'Ranks and files — hits both colors'},
    queen:  {name:'QUEEN',  glyph:'♛', cost:100, damage:26, rate:.60, hp:90, dirs:  QUEEN_DIRS,   slow:8,   hint:'All eight directions — hits both colors'},
};

const TOWER_ORDER  = ['pawn', 'knight', 'bishop', 'rook', 'queen'];
const SELL_REFUND  = .6;

// Upgrades are the gold sink. Without them the board saturates around wave 20
// and income has nowhere to go, so leveling deep has to stay competitive with
// building wide — hence a steep cost curve against a strong damage gain.
const MAX_LEVEL      = 8;
const UPGRADE_COST   = 1.7;   // cost multiplier per level
const UPGRADE_DAMAGE = .55;   // damage added per level, as a fraction of base
const UPGRADE_HP     = .25;   // piece HP added per level, as a fraction of base

// Perks are upgrades bought per piece, on top of levels, one tier at a time.
// Each lists the piece types that can take it; a tier's cost is a multiple of
// that piece's price. Each perk gets its own button on the card, with `hotkey`
// as its shortcut.
//   pierce I:     sliders shoot through your own pieces (movement is still
//                 blocked), so a rook can sit behind a pawn and hit past it
//   pierce II-V:  the shot also runs on through enemies, one more per tier,
//                 damaging each one in the line. Pierce is bought apart from
//                 the U levels, so gold goes to damage OR reach. Each tier
//                 costs double the last, so reach grows with the log of the
//                 gold spent on it.
//   rapid I-IV:   any piece fires RAPID_RATE faster per tier (shots per
//                 second, stacked additively). Separate from U levels, so
//                 gold goes to harder hits OR more of them.
const PERKS = {
    pierce: {hotkey:'P', types:['bishop', 'rook', 'queen'], tiers:[
        {name:'PIERCE',     costMult:1.2, hint:'Shoots through your own pieces'},
        {name:'PIERCE II',  costMult:2,   hint:'Also shoots through 1 enemy'},
        {name:'PIERCE III', costMult:4,   hint:'Shoots through 2 enemies'},
        {name:'PIERCE IV',  costMult:8,   hint:'Shoots through 3 enemies'},
        {name:'PIERCE V',   costMult:16,  hint:'Shoots through 4 enemies'},
    ]},
    rapid: {hotkey:'F', types:['pawn', 'knight', 'bishop', 'rook', 'queen'], tiers:[
        {name:'RAPID',      costMult:1,   hint:'Fires 25% faster'},
        {name:'RAPID II',   costMult:2,   hint:'Fires 50% faster'},
        {name:'RAPID III',  costMult:4,   hint:'Fires 75% faster'},
        {name:'RAPID IV',   costMult:8,   hint:'Fires twice as fast'},
    ]},
};
const RAPID_RATE = .25;   // shots per second added per RAPID tier, as a fraction of base

// Each enemy down a pierced line takes PIERCE_FALLOFF of the damage the one
// before it took. An enemy in mid-hop takes nothing but still uses up a slot,
// so hoppers stay real cover.
const PIERCE_FALLOFF = .75;

// A piece standing on the creep route hits this much harder. A creep that lands
// on its square still kills it, so the bonus is the pay for that risk.
const LANE_DAMAGE_MULT = 2;

// ...and a lane piece that dies still buys time: the creep that tramples it is
// bogged down, so the wave behind it bunches up in range. How long depends on
// the piece — each type's `slow` seconds (a Queen holds far longer than a
// Pawn), plus a bonus per upgrade level.
const LANE_SLOW_SCALE = .35;  // speed multiplier while slowed
const LANE_SLOW_LEVEL = .15;  // slow time added per level, as a fraction of base

///////////////////////////////////////////////////////////////////////////////
// ENEMIES
// Abstract shapes: `sides` 0 draws a circle, otherwise a regular polygon.
// `armor` is flat damage reduction (a hit always does at least 1).
//
// `ward` makes a creep a COLOR-LOCKED piece, the mirror of a bishop: it SKIPS
// every square of the other color. Warded creeps hop two squares at a time
// rather than gliding, and since the board alternates color square by square, a
// two-square jump always lands on the color it left. An Alabaster is a light-
// square creature for its whole run and an Obsidian a dark-square one.
//
// There is no damage rule attached to the color. The lock does its work through
// geometry alone: a piece that never attacks light squares — a dark bishop, a
// dark pawn, a light knight — never gets a shot at an Alabaster, no matter how
// much damage it does or how close it is. The `◻/◼` coverage readout on the
// build ghost is therefore the whole answer to "can this piece fight that".
//
// The one timing element is the jump itself: a creep in mid-air takes no damage
// and lands dead on the next square's center. That window needs no explanation
// on the HUD, because the creep is visibly off the ground while it lasts.
const HOP_STRIDE   = 2;     // squares crossed per jump; 2 is what preserves color
const HOP_AIR_TIME = .38;   // fraction of each jump spent airborne — the invincible slice
const HOP_HEIGHT   = .3;    // lift peak, in cell widths
const HOP_SQUASH   = .22;   // landing squash depth, decaying over SET_DOWN_TIME

// Every creep moves like a piece picked up by hand: planted, then lifted, carried
// and set down on the next square. STEP_* is the one-square version for creeps
// without a ward; the lift is centered on the half-square mark so `t` rounds to
// the same cell as before and targeting is unchanged.
const STEP_AIR_SECONDS = .2;   // real time a hand takes to carry a piece one square
const STEP_AIR_MAX     = .7;   // cap as a fraction of the step, so Runners still touch down
const STEP_HEIGHT      = .16;  // lift peak, in cell widths
const LIFT_SCALE       = .2;   // how much bigger a piece looks at the top of its lift
const SET_DOWN_TIME    = .14;  // seconds the landing squash takes to settle
const STEP_SPACING     = .05;  // min seconds between enemy footsteps, so a wave is not noise
const HIT_SPACING      = .06;  // min seconds between impact sounds per piece type

const ENEMY_TYPES = {
    grunt:  {name:'Grunt',   hp:22,  speed:.85,  armor:0, gold:3,  leak:1,  size:.52, sides:0, color:hsl(.47, .65, .55)},
    runner: {name:'Runner',  hp:16,  speed:1.7,  armor:0, gold:4,  leak:1,  size:.42, sides:3, color:hsl(.15, .9,  .58)},
    // Bishop-road creep: only maps with `pathRoutes: 'diag'` send these, and
    // they never share a lane with rank-and-file traffic.
    courier:{name:'Courier', hp:18,  speed:1.3,  armor:0, gold:5,  leak:1,  size:.46, sides:4, color:hsl(.55, .75, .58),
             route:'diag'},
    brute:  {name:'Brute',   hp:95,  speed:.525, armor:1, gold:9,  leak:3,  size:.70, sides:4, color:hsl(.05, .8,  .55)},
    shield: {name:'Bulwark', hp:70,  speed:.675, armor:4, gold:10, leak:2,  size:.60, sides:6, color:hsl(.75, .55, .65)},

    // Warded pair. Same stats, opposite colors, so a board that answers one is
    // by construction the wrong shape for the other: every bishop and pawn that
    // covers the light squares an Alabaster walks is a bishop or pawn an
    // Obsidian strolls past. The wave that sends both is the real exam.
    alabaster: {name:'Alabaster', hp:55, speed:.75, armor:0, gold:8, leak:2, size:.58, sides:5,
                color:hsl(.13, .30, .88), ward:'light'},
    obsidian:  {name:'Obsidian',  hp:55, speed:.75, armor:0, gold:8, leak:2, size:.58, sides:5,
                color:hsl(.73, .50, .46), ward:'dark'},

    // Ravager: the one creep that fights back. Every time it sets down it
    // smashes the four squares beside the one it landed on (no diagonals) for
    // `smash`, so pieces hugging the route take hits. Very slow, so a piece that can take
    // two or three blows usually outlasts it — pawns do not. Damage to pieces
    // is never healed.
    ravager:{name:'Ravager', hp:150, speed:.25,   armor:2, gold:14, leak:3,  size:.76, sides:7, color:hsl(.09, .45, .38),
             smash:20},

    // A Titan leak used to cost 10 of 20 base HP, which made every run a
    // coin-flip on one enemy. 6 still stings without being half the game.
    boss:   {name:'Titan',   hp:500, speed:.425,  armor:6, gold:70, leak:6,  size:.95, sides:8, color:hsl(.98, .8,  .55)},
};

///////////////////////////////////////////////////////////////////////////////
// WAVES
// Each wave is a list of groups: `count` enemies of `type`, `gap` seconds
// apart, starting `delay` seconds into the wave. Past the scripted waves the
// generator below keeps going forever with scaled health.

const WAVES = [
    [{type:'grunt',  count:6,  gap:.9}],
    [{type:'grunt',  count:10, gap:.7}],
    // Courier packs are skipped on boards with no diag lanes.
    [{type:'runner', count:8,  gap:.6}, {type:'courier', count:5, gap:.7, delay:1.5}],
    [{type:'grunt',  count:12, gap:.55}, {type:'runner', count:5,  gap:.5, delay:2}],
    [{type:'brute',  count:4,  gap:1.6}, {type:'ravager', count:1, gap:1, delay:3}],
    [{type:'runner', count:14, gap:.35}, {type:'courier', count:8, gap:.45, delay:2}],
    // First ward wave: one color, nothing else in it, so the lesson lands
    // clean — whatever you built that cannot touch these is now obvious.
    [{type:'alabaster', count:5, gap:1.3}],
    [{type:'shield', count:6,  gap:1.2}],
    [{type:'grunt',  count:18, gap:.4},  {type:'brute',  count:4,  gap:2,  delay:3},
     {type:'ravager', count:2, gap:4, delay:1}],
    [{type:'obsidian', count:6, gap:1.1}, {type:'runner', count:8, gap:.5, delay:3},
     {type:'courier', count:10, gap:.4, delay:5}],
    [{type:'shield', count:8,  gap:.9},  {type:'runner', count:10, gap:.4, delay:4}],
    [{type:'brute',  count:10, gap:1.1}, {type:'ravager', count:3, gap:3.5, delay:2}],
    // Both colors at once — no single bishop can answer this wave alone.
    [{type:'alabaster', count:6, gap:.9}, {type:'obsidian', count:6, gap:.9, delay:1.5},
     {type:'courier', count:8, gap:.5, delay:3}],
    [{type:'shield', count:10, gap:.8},  {type:'brute',  count:8,  gap:1.2, delay:2}],
    [{type:'boss',   count:1,  gap:1},   {type:'grunt',  count:20, gap:.3, delay:2}],
];

// The ward-lab table, used by any map flagged `wardsOnly`. Single color first
// so a board that cannot touch it fails visibly and immediately, then the
// mirror, then both at once — which is the only case where covering one color
// well is provably not enough. No grunts to chip in and no Titan to blame.
const WARD_WAVES = [
    [{type:'alabaster', count:4, gap:1.4}],
    [{type:'obsidian',  count:4, gap:1.4}],
    [{type:'alabaster', count:6, gap:1},   {type:'obsidian', count:6, gap:1,  delay:.5}],
    [{type:'obsidian',  count:9, gap:.7}],
    [{type:'alabaster', count:9, gap:.7}],
    [{type:'alabaster', count:9, gap:.6}, {type:'obsidian', count:9, gap:.6, delay:.3}],
];

///////////////////////////////////////////////////////////////////////////////
// ECONOMY & PACING

const START_GOLD     = 90;
const START_BASE_HP  = 20;
const KING_HIT_FRAC  = .2;    // at/above this share of max HP a king hit plays the regular explosion, below it the low-health one
const PREP_TIME      = 20;    // seconds of build time between waves
const EARLY_BONUS    = 2;     // gold per second of prep skipped
const SAVE_KEY       = 'chessDefenseBest';

///////////////////////////////////////////////////////////////////////////////
// LEVEL SELECT

const MENU_CARD_W   = 460;
const MENU_CARD_H   = 132;
const MENU_CARD_GAP = 18;
const MENU_TOP      = 140;   // first card row starts below the title
const MENU_BOTTOM   = 44;   // room kept for the hint line
const MENU_TWO_COLUMN_MIN_W = 820;   // narrower windows get one column
