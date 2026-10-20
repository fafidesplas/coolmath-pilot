/*
    Lane doctrine — universal upgrades.

    Per-piece levels and perks make one piece better. These make EVERY piece
    that stands on the creep route better, bought once for the whole army from
    the UPGRADES tab of the bottom bar. They are priced well above any single
    piece, so they are a late-run gold sink that rewards committing to lane
    play rather than something you pick up on wave 3.

    Three independent paths, each bought one tier at a time:
      FURY      — lane damage multiplier (the base ×2 goes up)
      TEMPO     — lane pieces fire faster
      LAST STAND — what a trampled lane piece does as it dies: a longer slow on
                   its killer first, then a landmine blast that hits every
                   creep near the square.
    The run starts with none of them; they reset with the run.
*/

'use strict';

// Each tier lists its price, the short effect line for the button, and the
// numbers it sets. A tier's values replace the previous tier's, they do not stack.
const LANE_UPGRADES = {
    fury: {name:'LANE FURY', color:hsl(.02, .85, .62), tiers:[
        {cost:160,  text:'Lane damage ×2.5', mult:2.5},
        {cost:420,  text:'Lane damage ×3',   mult:3},
        {cost:1000, text:'Lane damage ×4',   mult:4},
    ]},
    tempo: {name:'LANE TEMPO', color:hsl(.55, .85, .65), tiers:[
        {cost:160,  text:'Lane fire rate +20%', rate:1.2},
        {cost:420,  text:'Lane fire rate +45%', rate:1.45},
        {cost:1000, text:'Lane fire rate +80%', rate:1.8},
    ]},
    // `mine` is the blast damage as a multiple of the dying piece's own hit
    // (lane bonus included), `radius` is in cells from its square.
    stand: {name:'LAST STAND', color:hsl(.13, .9, .62), tiers:[
        {cost:160,  text:'Slow on death +60%',        slow:1.6, mine:0, radius:0},
        {cost:420,  text:'Death blast: 3× hit, 1 sq', slow:1.6, mine:3, radius:1.5},
        {cost:1000, text:'Blast 6×, 2 sq, slow +120%', slow:2.2, mine:6, radius:2.5},
    ]},
};

const LANE_UPGRADE_ORDER = ['fury', 'tempo', 'stand'];

let laneTiers = {};   // path key -> tiers owned (0 = none)

function resetLaneUpgrades()
{
    laneTiers = {};
    for (const key of LANE_UPGRADE_ORDER)
        laneTiers[key] = 0;
}
resetLaneUpgrades();

// The owned tier's entry for a path, or undefined if none is owned.
function laneTier(key)
{
    return LANE_UPGRADES[key].tiers[laneTiers[key] - 1];
}

function laneUpgradeMaxed(key)
{
    return laneTiers[key] >= LANE_UPGRADES[key].tiers.length;
}

function nextLaneTier(key)
{
    return LANE_UPGRADES[key].tiers[laneTiers[key]];
}

function buyLaneUpgrade(key)
{
    const next = nextLaneTier(key);
    if (!next || gold < next.cost)
    {
        soundDeny.play();
        return false;
    }

    gold -= next.cost;
    ++laneTiers[key];
    // every piece already on the route gets it, so show it landing on them
    for (const tower of towers)
        if (isPathCell(tower.row, tower.col))
            spawnBuildPuff(getCellWorldPos(tower.row, tower.col));
    soundBuild.play();
    return true;
}

///////////////////////////////////////////////////////////////////////////////
// EFFECTS — read by towers.js

function laneDamageMult()
{
    return laneTier('fury')?.mult ?? LANE_DAMAGE_MULT;
}

function laneRateMult()
{
    return laneTier('tempo')?.rate ?? 1;
}

function laneSlowMult()
{
    return laneTier('stand')?.slow ?? 1;
}

// {damage, radius} of the landmine a trampled piece sets off, or null.
function laneMine(tower)
{
    const tier = laneTier('stand');
    if (!tier || !tier.mine)
        return null;
    return {damage: towerDamage(tower) * tier.mine, radius: tier.radius * CELL_SIZE};
}

// "×2.5" — trims the trailing .0 so the base reads ×2.
function laneMultLabel()
{
    return `×${+laneDamageMult().toFixed(1)}`;
}
