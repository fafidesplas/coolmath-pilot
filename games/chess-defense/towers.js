/*
    Towers.

    A tower's attack range is literally its chess move generation. Sliding
    pieces walk rays outward and stop at the first blocker, so towers occlude
    each other's lines — and on a live ray, the first enemy in the way is the
    only one that can be hit. Knights ignore blockers, as they should.

    That same pattern is also how a piece relocates: a placed tower can walk to
    any square it currently attacks, as often as you like. Creep-route squares are legal move
    targets even though you can never BUILD on one — a piece standing on the
    route gets trampled by the first creep to reach it, which is the whole point.

    Because rays are the move pattern, square color falls out for free: bishop
    and pawn rays never leave their own color, knight rays always land on the
    other one. `coverageByColor` reports it over the creep route only — squares
    no creep ever walks are not coverage — and warded creeps make it matter,
    because they only ever stand on one color. A piece reading 0 on that color
    cannot touch them at all, however much damage it does.
*/

'use strict';

let towers    = [];
let towerGrid = [];    // towerGrid[row][col] = tower | null
let projectiles = [];  // shots in flight; damage lands on arrival

function resetTowers()
{
    towers = [];
    clearProjectiles();
    towerGrid = [];
    for (let row = 0; row < GRID_H; ++row)
        towerGrid[row] = new Array(GRID_W).fill(null);
}

function towerAt(row, col)
{
    return isInBounds(row, col) ? towerGrid[row][col] : null;
}

// Route squares are buildable too — same bet as moving onto one (see
// checkTowerHazard) — but not the King's square, and not under a creep, where
// the piece would die the frame it was paid for.
function canBuildAt(row, col)
{
    if (!isInBounds(row, col) || towerGrid[row][col])
        return false;
    if (isBaseCell(row, col) || !isStandableCell(row, col))
        return false;
    return !isPathCell(row, col) || !leadEnemyAt(row, col);
}

///////////////////////////////////////////////////////////////////////////////
// RANGE
// Rays are ordered nearest-first so "the first enemy along this line" is just
// the first hit while walking the array.

// `pierce` lets slider rays run on past friendly pieces (for shooting only —
// the move rays are always built without it).
function computeRays(row, col, type, pierce=false)
{
    const def  = TOWER_TYPES[type];
    const rays = [];

    if (def.steps)
        for (const [dr, dc] of def.steps)
        {
            const r = row + dr, c = col + dc;
            if (isInBounds(r, c) && !isWallCell(r, c))   // jumps over walls, never onto one
                rays.push([{row: r, col: c}]);
        }

    if (def.dirs)
        for (const [dr, dc] of def.dirs)
        {
            const ray = [];
            let r = row + dr, c = col + dc;
            while (isInBounds(r, c) && !isWallCell(r, c) && (pierce || !towerGrid[r][c]))
            {
                ray.push({row: r, col: c});
                r += dr; c += dc;
            }
            if (ray.length)
                rays.push(ray);
        }

    return rays;
}

// Placing or selling a tower changes what every sliding piece can see.
// `rays` are what a piece shoots along; `moveRays` are where it can go.
function rebuildAllRays()
{
    for (const tower of towers)
    {
        tower.moveRays = computeRays(tower.row, tower.col, tower.type);
        tower.rays     = hasPerk(tower, 'pierce')
            ? computeRays(tower.row, tower.col, tower.type, true)
            : tower.moveRays;
    }
}

function previewRays(row, col, type)
{
    return computeRays(row, col, type);
}

///////////////////////////////////////////////////////////////////////////////
// BUILD & SELL

function buildTower(row, col, type)
{
    const def = TOWER_TYPES[type];
    if (!canBuildAt(row, col) || gold < def.cost)
    {
        soundDeny.play();
        return false;
    }

    gold -= def.cost;
    addTower(row, col, type, def.cost);
    return true;
}

// The piece itself, with no price attached: the shop pays first, a draft pick is free.
function addTower(row, col, type, invested)
{
    const def = TOWER_TYPES[type];
    const tower = {
        row, col, type, def,
        cooldown: new Timer(),
        sigTimer: new Timer(),
        signature: null,
        rays: [],
        moveRays: [],
        perks: {},
        recoil: 0,
        level: 1,
        invested,
        hp: def.hp, maxHp: def.hp,
        flash: 0,
    };
    towers.push(tower);
    towerGrid[row][col] = tower;
    rebuildAllRays();

    const pos = getCellWorldPos(row, col);
    spawnBuildPuff(pos);
    playPlaceSound(type, pos);
    return tower;
}

// Seconds a lane piece's killer stays slowed (see LANE_SLOW_* and LAST STAND).
function towerSlowTime(tower)
{
    return tower.def.slow * (1 + LANE_SLOW_LEVEL * (tower.level - 1)) * laneSlowMult();
}

function towerMaxHp(tower)
{
    return Math.round(tower.def.hp * (1 + UPGRADE_HP * (tower.level - 1)));
}

// A Ravager's smash. Pieces only ever take damage from that, and it is never
// healed, so every hit a piece takes stays with it for the rest of the run.
function damageTower(tower, damage)
{
    tower.hp   -= damage;
    tower.flash = .15;
    const pos   = getCellWorldPos(tower.row, tower.col);
    spawnHitSpark(pos, SMASH_COLOR);
    if (tower.hp > 0)
        return false;

    removeTower(tower);
    spawnDeathBurst(pos, SMASH_COLOR, .6);
    spawnDeathBurst(pos, PIECE_COLOR, 1);
    soundPieceLost.play(pos);
    return true;
}

function towerDamage(tower)
{
    const onLane = isPathCell(tower.row, tower.col) ? laneDamageMult() : 1;
    return tower.def.damage * (1 + UPGRADE_DAMAGE * (tower.level - 1)) * onLane * bannerMult(tower);
}

// Seconds between shots; the RAPID perk shortens it, and LANE TEMPO does too
// for pieces on the route.
function towerFireDelay(tower)
{
    const onLane = isPathCell(tower.row, tower.col) ? laneRateMult() : 1;
    const rapid  = 1 + RAPID_RATE * perkTier(tower, 'rapid');
    return tower.def.rate / (onLane * rapid);
}

function upgradeCost(tower)
{
    return Math.round(tower.def.cost * Math.pow(UPGRADE_COST, tower.level - 1));
}

function upgradeTower(tower)
{
    const cost = upgradeCost(tower);
    if (tower.level >= MAX_LEVEL || gold < cost)
    {
        soundDeny.play();
        return false;
    }

    gold -= cost;
    tower.invested += cost;
    ++tower.level;
    // the new level's extra HP arrives healthy; existing damage stays
    const maxHp = towerMaxHp(tower);
    tower.hp   += maxHp - tower.maxHp;
    tower.maxHp = maxHp;
    spawnBuildPuff(getCellWorldPos(tower.row, tower.col));
    soundBuild.play();
    return true;
}

///////////////////////////////////////////////////////////////////////////////
// PERKS

// How many tiers of a perk this piece owns (0 = none).
function perkTier(tower, key)
{
    return tower.perks[key] || 0;
}

function hasPerk(tower, key)
{
    return perkTier(tower, key) > 0;
}

function perkMaxed(tower, key)
{
    return perkTier(tower, key) >= PERKS[key].tiers.length;
}

// The next tier up for sale, or undefined once maxed.
function nextPerkTier(tower, key)
{
    return PERKS[key].tiers[perkTier(tower, key)];
}

// Perk keys this piece's type can ever take, in PERKS order.
function towerPerkKeys(tower)
{
    return Object.keys(PERKS).filter(key => PERKS[key].types.includes(tower.type));
}

// Price of the next tier.
function perkCost(tower, key)
{
    return Math.round(tower.def.cost * nextPerkTier(tower, key).costMult);
}

function buyPerk(tower, key)
{
    if (!PERKS[key].types.includes(tower.type) || perkMaxed(tower, key) || gold < perkCost(tower, key))
    {
        soundDeny.play();
        return false;
    }

    const cost = perkCost(tower, key);
    gold -= cost;
    tower.invested += cost;
    tower.perks[key] = perkTier(tower, key) + 1;
    rebuildAllRays();
    spawnBuildPuff(getCellWorldPos(tower.row, tower.col));
    soundBuild.play();
    return true;
}

// Pull a piece off the board. Every removal path goes through here so the
// occupancy grid and everyone's sight lines stay in sync.
function removeTower(tower)
{
    towerGrid[tower.row][tower.col] = null;
    towers.splice(towers.indexOf(tower), 1);
    if (selectedTower === tower)
        selectedTower = null;
    rebuildAllRays();
}

function sellRefund(tower)
{
    return Math.floor(tower.invested * SELL_REFUND);
}

function sellTower(tower)
{
    const refund = sellRefund(tower);
    const pos    = getCellWorldPos(tower.row, tower.col);
    gold += refund;
    removeTower(tower);

    spawnBuildPuff(pos);
    soundSell.play();
    return refund;
}

///////////////////////////////////////////////////////////////////////////////
// MOVEMENT

// A piece's legal squares are its live rays, minus anything already occupied
// (knight jumps can land on a friend; slider rays already stop short of one)
// and minus the King's square and unusable squares, which are never yours to
// stand on (a slider still moves across them; walls already cut its rays).
function moveDestinations(tower)
{
    const cells = [];
    for (const ray of tower.moveRays)
        for (const cell of ray)
        {
            if (!towerGrid[cell.row][cell.col] && !isBaseCell(cell.row, cell.col) && isStandableCell(cell.row, cell.col))
                cells.push(cell);
        }
    return cells;
}

function canTowerMove(tower)
{
    return moveDestinations(tower).length > 0;
}

function canMoveTo(tower, row, col)
{
    return moveDestinations(tower).some(cell => cell.row === row && cell.col === col);
}

// How many CREEP-ROUTE squares a piece covers, split light vs dark. Empty board
// squares in range are ignored: they are never where a creep can be shot, so
// counting them only inflates the number. A bishop still reads 0 on one color,
// which is the whole point — that is the half a warded creep walks untouched.
function coverageByColor(rays)
{
    let light = 0, dark = 0;
    for (const ray of rays)
        for (const cell of ray)
            if (isPathCell(cell.row, cell.col))
                isLightSquare(cell.row, cell.col) ? ++light : ++dark;
    return {light, dark};
}

function moveTower(tower, row, col)
{
    if (!canMoveTo(tower, row, col))
    {
        soundDeny.play();
        return false;
    }

    relocateTower(tower, row, col);
    return true;
}

// Puts a piece on another square, no questions asked: moveTower checks the
// piece's own move pattern first, the draft's push-forward does not.
function relocateTower(tower, row, col)
{
    const from = getCellWorldPos(tower.row, tower.col);
    towerGrid[tower.row][tower.col] = null;
    tower.row = row;
    tower.col = col;
    towerGrid[row][col] = tower;
    rebuildAllRays();

    const to = getCellWorldPos(row, col);
    spawnMoveTrail(from, to);
    soundMove.play(to, .6);

    // landing on a creep already standing there is the same trample as walking
    // into one a second later — both go through the hazard check
    checkTowerHazard(tower);
}

// A piece parked on a creep route dies to the first creep that reaches its
// square. Run every frame, not just on landing, so route squares stay a bet on
// clearing the lane rather than free real estate you sidestep onto during prep.
function checkTowerHazard(tower)
{
    const killer = isPathCell(tower.row, tower.col) && leadEnemyAt(tower.row, tower.col);
    if (!killer)
        return false;

    // the piece goes down fighting: its killer is bogged down, longer for
    // stronger pieces — but never cut short by a weaker piece dying after it
    const slowTime = towerSlowTime(tower);
    if (!killer.slowTimer.active() || -killer.slowTimer.get() < slowTime)
        killer.slowTimer.set(slowTime);

    const pos  = getCellWorldPos(tower.row, tower.col);
    const mine = martyrBlast(tower) ?? laneMine(tower);   // read before removal: both use the piece's lane damage
    removeTower(tower);
    if (mine)
        detonateMine(pos, mine);
    spawnDeathBurst(pos, SLOW_COLOR, .6);
    spawnDeathBurst(pos, PIECE_COLOR, 1);
    soundPieceLost.play(pos);
    addScreenShake(.35, .3);
    return true;
}

// LAST STAND II+: every planted creep within the radius takes the blast.
// Creeps in mid-jump are over it, same as they are over a shot.
function detonateMine(pos, mine)
{
    for (const enemy of enemies)
        if (enemy.hp > 0 && enemyPos(enemy).distance(pos) <= mine.radius)
            damageEnemy(enemy, mine.damage);

    spawnDeathBurst(pos, LANE_UPGRADES.stand.color, mine.radius / CELL_SIZE * .8);
    addScreenShake(.5, .35);
}

///////////////////////////////////////////////////////////////////////////////
// TARGETING & FIRING

// Enemies a shot passes through before it stops: one per Pierce tier past the
// first (Pierce I only passes your own pieces). Independent of the piece's level.
function pierceCount(tower)
{
    return Math.max(0, perkTier(tower, 'pierce') - 1);
}

// Walk every ray and collect the enemies it can reach, nearest first: the
// first one normally, up to 1 + pierceCount with Pierce II+. Each ray that has
// a shootable creep gives one target: its most advanced creep (`lead`) and the
// `line` the shot would hit. Returned most advanced first, so [0] is where a
// piece normally shoots and Fork takes the next one too.
function rayTargets(tower)
{
    const reach = 1 + pierceCount(tower);
    const found = [];
    for (const ray of tower.rays)
    {
        const line = [];
        let lead = null;
        for (const cell of ray)
        {
            const enemy = leadEnemyAt(cell.row, cell.col);
            if (!enemy)
                continue;
            // a creep in mid-jump is untouchable but still occludes (and uses
            // up a pierce): it shields whatever is behind it, so a wave of
            // them is real cover
            line.push(enemy);
            if (!enemyIsAirborne(enemy) && (!lead || enemyProgress(enemy) > enemyProgress(lead)))
                lead = enemy;
            if (line.length >= reach)
                break;  // this ray is occluded past here
        }
        if (lead)
            found.push({lead, line});
    }
    return found.sort((a, b) => enemyProgress(b.lead) - enemyProgress(a.lead));
}

// `lines` is one enemy line per shot, nearest first within each. A shot flies
// at the last creep of its line and hits the whole line when it lands (see
// landProjectile). Only Fork fires more than one.
function fireTower(tower, lines)
{
    tower.cooldown.set(towerFireDelay(tower));
    tower.recoil = 1;

    const from = getCellWorldPos(tower.row, tower.col);
    for (const line of lines)
        launchProjectile(tower, from, line);
    soundShoot[tower.type].play(from, .6);
}

function launchProjectile(tower, from, line)
{
    const style  = PROJECTILE_STYLES[tower.type];
    const target = line[line.length - 1];
    const to     = enemyPos(target);
    const projectile = {
        type: tower.type, style, from, to, pos: from, dir: to.subtract(from).normalize(),
        target, line, damage: towerDamage(tower),
        // signatures that act on landing travel with the shot, so a piece that
        // is trampled while it is in flight still delivers them
        splash: hasSignature(tower, 'splash'), sticky: hasSignature(tower, 'sticky'),
        elapsed: 0, duration: Math.max(.08, from.distance(to) / style.speed),
    };
    if (style.kind === 'fire')
        projectile.trail = spawnFireTrail(from);
    projectiles.push(projectile);
}

// Each creep down the line takes PIERCE_FALLOFF of the damage the one before
// it took. A creep that is airborne when the shot lands takes none (it hopped
// over it) but still counts toward the falloff; one that died or left the
// board in the meantime is skipped.
function landProjectile(projectile)
{
    const color = TOWER_SHOT_COLOR[projectile.type];
    let damage   = projectile.damage;
    let hitSound = false;
    for (const enemy of projectile.line)
    {
        if (enemy.hp > 0 && enemies.includes(enemy) && !enemyIsAirborne(enemy))
        {
            spawnHitSpark(enemyPos(enemy), color);
            if (!hitSound)   // one impact per shot, even when it pierces
                playHitSound(projectile.type, enemyPos(enemy));
            hitSound = true;
            damageEnemy(enemy, damage);
            if (projectile.sticky && enemy.hp > 0)
                slowEnemy(enemy, STICKY_TIME);
        }
        damage *= PIERCE_FALLOFF;
    }
    if (!hitSound)   // target gone or hopped clear: just a puff where it landed
        spawnHitSpark(projectile.pos, color);
    if (projectile.splash && hitSound)
        splashShot(projectile);
    projectile.trail?.destroy();   // lets the embers already shed burn out
}

// Homes on its target so it cannot visibly miss a creep that stepped on; once
// the target is gone it finishes the trip to where the creep last stood.
function updateProjectiles()
{
    for (let i = projectiles.length - 1; i >= 0; --i)
    {
        const projectile = projectiles[i];
        const target = projectile.target;
        if (target.hp > 0 && enemies.includes(target))
            projectile.to = enemyPos(target);

        projectile.elapsed += timeDelta;
        const percent = clamp(projectile.elapsed / projectile.duration);
        const ground  = projectile.from.lerp(projectile.to, percent);
        const arc     = projectile.style.arc * projectile.from.distance(projectile.to);
        const pos     = ground.add(vec2(0, Math.sin(percent * PI) * arc));
        if (pos.distance(projectile.pos) > 1e-4)
            projectile.dir = pos.subtract(projectile.pos).normalize();
        projectile.pos = pos;
        if (projectile.trail)
            projectile.trail.pos = pos;

        if (percent >= 1)
        {
            landProjectile(projectile);
            projectiles.splice(i, 1);
        }
    }
}

function clearProjectiles()
{
    for (const projectile of projectiles)
        projectile.trail?.destroy();
    projectiles = [];
}

// How each piece's shot looks and flies. Speed is world units per second;
// arc is the peak height as a fraction of the distance flown.
const PROJECTILE_STYLES = {
    pawn:   {kind:'arrow',  speed:26, arc:.06, length:.5},
    knight: {kind:'arrow',  speed:26, arc:.06, length:.5},
    bishop: {kind:'arrow',  speed:28, arc:.04, length:.55},
    rook:   {kind:'cannon', speed:17, arc:.18, size:.26},
    queen:  {kind:'fire',   speed:20, arc:0,   size:.34},
};

const TOWER_SHOT_COLOR = {
    pawn:   hsl(.13, .9, .7),
    knight: hsl(.55, .9, .7),
    bishop: hsl(.78, .9, .75),
    rook:   hsl(.03, .9, .65),
    queen:  hsl(.33, .9, .7),
};

function updateTowers()
{
    // backwards: a trampled piece is spliced out mid-loop
    for (let i = towers.length - 1; i >= 0; --i)
    {
        const tower = towers[i];
        if (checkTowerHazard(tower))
            continue;

        updateCleric(tower);
        if (tower.cooldown.active())
            continue;
        const targets = rayTargets(tower);
        if (!targets.length)
            continue;

        // Fork hits a second creep too, never the same one twice
        const lines = [targets[0].line];
        if (hasSignature(tower, 'fork'))
            for (const target of targets.slice(1))
                if (lines.length < FORK_SHOTS && target.lead !== targets[0].lead)
                    lines.push(target.line);
        fireTower(tower, lines);
    }
}

// Shots in flight, recoil and smash flash keep going in every phase, not just
// combat, so a shot fired as the last creep dies (or the king falls) still lands.
function updateTowerFx()
{
    for (const tower of towers)
    {
        tower.recoil = Math.max(0, tower.recoil - timeDelta * 6);
        tower.flash  = Math.max(0, tower.flash - timeDelta);
    }

    updateProjectiles();
}

///////////////////////////////////////////////////////////////////////////////
// RENDER

function renderTowers()
{
    for (const tower of towers)
    {
        const pos  = getCellWorldPos(tower.row, tower.col);
        const size = CELL_SIZE * (.82 - tower.recoil * .08);

        // a piece out on the route is one creep away from dying — pulse it red
        if (isPathCell(tower.row, tower.col))
        {
            const pulse = .5 + Math.sin(time * 7) * .2;
            drawRect(pos, vec2(CELL_SIZE * .9), rgb(DANGER_COLOR.r, DANGER_COLOR.g, DANGER_COLOR.b, pulse * .45));
        }

        const color = tower.flash > 0 ? SMASH_COLOR : PIECE_COLOR;
        drawText(tower.def.glyph, pos, size, color, size * .07, PIECE_OUTLINE);
        renderLevelPips(tower, pos);
        renderPerkBadges(tower, pos);
        renderSignatureBadge(tower, pos);
    }
}

// HP bars for pieces a Ravager has hit, drawn after the creeps so a big one
// standing next door cannot hide it. Narrow enough to sit between the perk
// badges in the top corners.
function renderTowerHealthBars()
{
    for (const tower of towers)
        renderHealthBar(getCellWorldPos(tower.row, tower.col), tower, CELL_SIZE * .4);
}

// Each perk has a tiny icon, drawn on the board in the square's top corners
// and on the tower card beside the perk: an up-right arrow for Pierce, a
// lightning bolt for Rapid.
const PERK_BADGES = {
    pierce: {color:PIERCE_COLOR, corner:vec2( 1, 1)},
    rapid:  {color:RAPID_COLOR,  corner:vec2(-1, 1)},
};

// Convex pieces of each icon in units of its size `s`, y up. Kept convex so
// the WebGL fill stays correct.
function perkIconShapes(key)
{
    if (key === 'pierce')
    {
        const shaft = [vec2(-1.1, -.2), vec2(.2, -.2), vec2(.2, .2), vec2(-1.1, .2)];
        const head  = [vec2(1.1, 0), vec2(-.1, .75), vec2(-.1, -.75)];
        return [shaft, head].map(shape => shape.map(p => p.rotate(-PI / 4)));   // point up-right
    }
    return [
        [vec2( .6,  1.1), vec2(-.55, -.1), vec2( .15,  .1)],
        [vec2(-.6, -1.1), vec2( .55,  .1), vec2(-.15, -.1)],
    ];
}

// `screen` draws on the 2D canvas in pixels (for the card, which is drawn
// there); otherwise it is world space. The outline pass goes first and the
// fill covers it, so the seams between pieces do not show.
function drawPerkIcon(key, center, s, screen=false)
{
    const color  = PERK_BADGES[key].color;
    const shapes = perkIconShapes(key).map(shape => shape.map(p => p.scale(s)));
    const webGL  = screen ? false : glEnable;
    for (const shape of shapes)
        drawPoly(shape, color, s * .2, PIECE_OUTLINE, center, 0, webGL, screen);
    for (const shape of shapes)
        drawPoly(shape, color, 0, PIECE_OUTLINE, center, 0, webGL, screen);
}

// Owned perks show as icons in the square's top corners; from tier II on,
// the tier shows beside the icon, toward the middle of the square.
function renderPerkBadges(tower, pos)
{
    const s = CELL_SIZE * .09;
    for (const key in PERK_BADGES)
    {
        const tier = perkTier(tower, key);
        if (!tier)
            continue;
        const corner = PERK_BADGES[key].corner;
        const center = pos.add(corner.scale(CELL_SIZE * .33));
        drawPerkIcon(key, center, s);
        if (tier >= 2)
            drawText(tier, center.add(vec2(-corner.x * s * .6, -s * 1.3)), s * 1.6,
                PERK_BADGES[key].color, s * .25, PIECE_OUTLINE);
    }
}

// A drafted piece's signature, as a small icon in the bottom-left corner.
// Pierce and Rapid already show their perk badge up top, so they skip this.
function renderSignatureBadge(tower, pos)
{
    const sig = tower.signature && SIGNATURES[tower.signature];
    if (!sig || sig.perks)
        return;
    drawText(sig.icon, pos.add(vec2(-CELL_SIZE * .33, -CELL_SIZE * .3)), CELL_SIZE * .3,
        sig.color, CELL_SIZE * .05, PIECE_OUTLINE);
}

// Small gold pips along the bottom of the square show the upgrade level.
function renderLevelPips(tower, pos)
{
    if (tower.level < 2)
        return;
    const pipSize = CELL_SIZE * .09;
    const spacing = CELL_SIZE * .12;
    const startX  = -spacing * (tower.level - 1) / 2;
    for (let i = 0; i < tower.level; ++i)
        drawCircle(pos.add(vec2(startX + i * spacing, -CELL_SIZE * .38)), pipSize,
            BASE_COLOR, pipSize * .25, PIECE_OUTLINE);
}

const ARROW_SHAFT_COLOR = hsl(.08, .45, .35);
const CANNONBALL_COLOR  = hsl(0, 0, .16);

function renderProjectiles()
{
    for (const projectile of projectiles)
    {
        const {style, pos, dir} = projectile;
        const color = TOWER_SHOT_COLOR[projectile.type];
        if (style.kind === 'arrow')
            renderArrow(pos, dir, style.length, color);
        else if (style.kind === 'cannon')
        {
            drawCircle(pos, style.size, CANNONBALL_COLOR, .04, BLACK);
            drawCircle(pos.add(vec2(-.04, .04)), style.size * .3, hsl(0, 0, .45));
        }
        else
        {
            drawCircleGradient(pos, style.size * 2.2, rgb(1, .55, .1, .6), rgb(1, .2, 0, 0));
            drawCircle(pos, style.size, hsl(.08, 1, .55));
            drawCircle(pos, style.size * .55, hsl(.14, 1, .85));
        }
    }
}

// Shaft, a head in the piece's shot color, and two fletching strokes at the tail.
function renderArrow(pos, dir, length, color)
{
    const side = vec2(-dir.y, dir.x);
    const tip  = pos.add(dir.scale(length * .5));
    const tail = pos.subtract(dir.scale(length * .5));
    drawLine(tail, tip, .05, ARROW_SHAFT_COLOR);
    drawPoly([tip.add(dir.scale(.14)), tip.add(side.scale(.07)), tip.subtract(side.scale(.07))], color);
    for (const s of [1, -1])
        drawLine(tail, tail.subtract(dir.scale(.12)).add(side.scale(.07 * s)), .04, color);
}

// Highlight the squares a tower (real or previewed) covers.
function renderRangeOverlay(rays, color)
{
    for (const ray of rays)
        for (const cell of ray)
            drawRect(getCellWorldPos(cell.row, cell.col), vec2(CELL_SIZE * .86), color);
}
