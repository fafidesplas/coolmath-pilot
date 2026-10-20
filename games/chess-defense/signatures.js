/*
    The between-waves draft — signatures and the draft itself.

    After every cleared wave, on every board, the player is offered a few pieces
    and keeps one for free, on top of whatever the gold shop sells. Each offered
    piece is an ordinary chess piece plus one random SIGNATURE: a special ability
    that piece carries for the rest of the run. Shop pieces have none.

    PARKED: a board flagged `draft: true` (see levels/level08.js) goes further —
    no gold at all, 5 picks before wave 1, and only `buildRows: [..]` can hold
    pieces. Once every square there is taken, a new piece has to replace one
    already placed.

    Signatures are small hooks that towers.js calls at the moments that matter:
    when damage is worked out (banner), when a shot is fired (fork), when it
    lands (splash, sticky), when the piece is trampled (martyr) and once a
    frame (cleric). Pierce and Rapid reuse the perk tiers the main game sells.

    The pool is much bigger on paper — see notes/vertical-waves-ideas.md.
*/

'use strict';

const DRAFT_OFFERS      = 3;   // pieces shown per pick
const DRAFT_START_PICKS = 5;   // picks before wave 1, so the first wave has something to face

// Chance of each piece type being offered, and how it is labeled on the card.
const DRAFT_WEIGHTS = {pawn:40, knight:25, bishop:20, rook:10, queen:5};
const DRAFT_RARITY  = {
    pawn:   {label:'COMMON',   color:hsl(0,   0,  .7)},
    knight: {label:'UNCOMMON', color:hsl(.33, .6, .6)},
    bishop: {label:'UNCOMMON', color:hsl(.33, .6, .6)},
    rook:   {label:'RARE',     color:hsl(.58, .8, .66)},
    queen:  {label:'EPIC',     color:hsl(.8,  .7, .7)},
};

const SPLASH_RADIUS = 1.5;   // cells; reaches the 8 squares around the target
const SPLASH_FRAC   = .5;    // of the shot's damage
const STICKY_TIME   = 2;     // seconds a hit creep stays slowed
const MARTYR_MULT   = 8;     // blast damage, as a multiple of the piece's own hit
const MARTYR_RADIUS = 2.5;   // cells
const CLERIC_PERIOD = 4;     // seconds between heals
const CLERIC_HEAL   = 10;    // HP restored per pulse
const CLERIC_RANGE  = 2;     // squares, in every direction
const BANNER_BONUS  = .2;    // damage added per adjacent Banner piece
const FORK_SHOTS    = 2;     // targets hit per volley

const ALL_PIECES = ['pawn', 'knight', 'bishop', 'rook', 'queen'];

// `icon` is the small badge on the piece's square. `perks` are applied to the
// piece as if bought, which is how Pierce and Rapid come for free.
const SIGNATURES = {
    pierce: {name:'PIERCE',  icon:'↗', color:PIERCE_COLOR,    types:['bishop', 'rook', 'queen'],
             perks:{pierce:3}, text:'Shoots through your pieces and 2 enemies'},
    rapid:  {name:'RAPID',   icon:'ϟ', color:RAPID_COLOR,     types:ALL_PIECES,
             perks:{rapid:2},  text:'Fires 50% faster'},
    splash: {name:'SPLASH',  icon:'✸', color:hsl(.06, .9, .6), types:ALL_PIECES,
             text:'Hits also hurt the squares around the target for half damage'},
    sticky: {name:'STICKY',  icon:'❋', color:hsl(.55, .8, .7), types:ALL_PIECES,
             text:`Hits slow an enemy for ${STICKY_TIME} seconds`},
    fork:   {name:'FORK',    icon:'Ψ', color:hsl(.75, .7, .72), types:ALL_PIECES,
             text:`Every volley hits ${FORK_SHOTS} different enemies`},
    martyr: {name:'MARTYR',  icon:'☠', color:hsl(0,   .8, .62), types:ALL_PIECES,
             text:`When trampled it explodes: ${MARTYR_MULT}× its hit, 2 squares wide`},
    cleric: {name:'CLERIC',  icon:'✚', color:hsl(.33, .8, .62), types:ALL_PIECES,
             text:`Heals pieces within ${CLERIC_RANGE} squares for ${CLERIC_HEAL} HP every ${CLERIC_PERIOD}s`},
    banner: {name:'BANNER',  icon:'⚑', color:hsl(.13, .9, .65), types:ALL_PIECES,
             text:`Adjacent pieces deal +${Math.round(BANNER_BONUS * 100)}% damage`},
};
const SIGNATURE_ORDER = Object.keys(SIGNATURES);

function hasSignature(tower, key)
{
    return tower.signature === key;
}

// Called once, right after a drafted piece is placed.
function applySignature(tower, key)
{
    tower.signature = key;
    const perks = SIGNATURES[key].perks;
    if (perks)
        Object.assign(tower.perks, perks);
    rebuildAllRays();
}

///////////////////////////////////////////////////////////////////////////////
// OFFERS

function pickWeightedType()
{
    let roll = rand(0, ALL_PIECES.reduce((sum, type) => sum + DRAFT_WEIGHTS[type], 0));
    for (const type of ALL_PIECES)
    {
        roll -= DRAFT_WEIGHTS[type];
        if (roll < 0)
            return type;
    }
    return ALL_PIECES[0];
}

// DRAFT_OFFERS pieces, never two identical (same type and signature) at once.
function rollOffers()
{
    const offers = [];
    for (let tries = 0; offers.length < DRAFT_OFFERS && tries < 200; ++tries)
    {
        const type = pickWeightedType();
        const keys = SIGNATURE_ORDER.filter(key => SIGNATURES[key].types.includes(type));
        const key  = keys[randInt(keys.length)];
        if (!offers.some(offer => offer.type === type && offer.signature === key))
            offers.push({type, signature:key});
    }
    return offers;
}

///////////////////////////////////////////////////////////////////////////////
// SIGNATURE EFFECTS — read by towers.js

// Banner: 8 neighbours, each Banner piece adds BANNER_BONUS.
function bannerMult(tower)
{
    let mult = 1;
    for (let dr = -1; dr <= 1; ++dr)
    for (let dc = -1; dc <= 1; ++dc)
    {
        const near = (dr || dc) && towerAt(tower.row + dr, tower.col + dc);
        if (near && hasSignature(near, 'banner'))
            mult += BANNER_BONUS;
    }
    return mult;
}

// A slow never cuts short a longer one already running.
function slowEnemy(enemy, seconds)
{
    if (!enemy.slowTimer.active() || -enemy.slowTimer.get() < seconds)
        enemy.slowTimer.set(seconds);
}

// Martyr's blast, or null. Same shape as the lane upgrade's mine.
function martyrBlast(tower)
{
    if (!hasSignature(tower, 'martyr'))
        return null;
    return {damage: towerDamage(tower) * MARTYR_MULT, radius: MARTYR_RADIUS * CELL_SIZE};
}

// Splash: a shot that lands hurts every other planted creep near the target.
function splashShot(projectile)
{
    const radius = SPLASH_RADIUS * CELL_SIZE;
    for (const enemy of enemies)
        if (enemy.hp > 0 && !projectile.line.includes(enemy) && enemyPos(enemy).distance(projectile.to) <= radius)
        {
            spawnHitSpark(enemyPos(enemy), SIGNATURES.splash.color);
            damageEnemy(enemy, projectile.damage * SPLASH_FRAC);
        }
    spawnDeathBurst(projectile.to, SIGNATURES.splash.color, .5);
}

// Cleric: heals every piece in range that is actually hurt, once per period.
function updateCleric(tower)
{
    if (!hasSignature(tower, 'cleric') || tower.sigTimer.active())
        return;

    let healed = false;
    for (const other of towers)
    {
        const near = Math.abs(other.row - tower.row) <= CLERIC_RANGE
            && Math.abs(other.col - tower.col) <= CLERIC_RANGE;
        if (!near || other.hp >= other.maxHp)
            continue;
        other.hp = Math.min(other.maxHp, other.hp + CLERIC_HEAL);
        spawnBuildPuff(getCellWorldPos(other.row, other.col));
        healed = true;
    }
    // only start the wait once a pulse did something, so a lone hurt piece
    // is healed the moment it needs it rather than up to a period later
    if (healed)
        tower.sigTimer.set(CLERIC_PERIOD);
}
