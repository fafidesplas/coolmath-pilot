/*
    Creeps and the wave scheduler.

    Enemies are plain objects walking a float index `t` along one of the map's
    routes. They never leave that route, which is what lets towers treat "the
    cell an enemy is on" as a simple grid lookup.

    Every creep moves like a chess piece moved by hand: planted on a square,
    then lifted, carried and set down on the next one. Warded creeps advance on
    the same `t` at the same average speed, but they carry two squares at a
    time: planted on one square, then lifted over the next one and down onto
    the one after. Two squares is
    what keeps them color-locked, since the board alternates every square — they
    never once stand on the other color, so half the board's pieces can never
    reach them, and they are untouchable for the arc in between.
    `t` stays the schedule; `enemyPos`/`enemyCell` turn it into a one-square
    step or a two-square hop, and everything else goes through those two.
*/

'use strict';

let enemies    = [];
let spawnQueue = [];   // {type, time, hpScale, lane} sorted by time
let waveClock  = 0;    // seconds since the current wave started
let enemyGrid  = new Map();

function resetEnemies()
{
    enemies    = [];
    spawnQueue = [];
    waveClock  = 0;
    enemyGrid.clear();
}

///////////////////////////////////////////////////////////////////////////////
// WAVE BUILDING

// Waves past the scripted list keep escalating: tougher mixes, more health,
// and a Titan every fifth wave.
function proceduralWave(wave)
{
    const over   = wave - WAVES.length;
    const groups = [
        {type:'grunt',  count: 12 + over * 2, gap:.35},
        {type:'runner', count: 8  + over * 2, gap:.3,  delay:2},
        {type:'brute',  count: 5  + over,     gap:1.1, delay:4},
        {type:'shield', count: 5  + over,     gap:.9,  delay:6},
        {type:'ravager', count: 2 + Math.floor(over / 3), gap:3.5, delay:3},
        // both wards forever after, so a board can never settle on one color
        {type:'alabaster', count: 3 + Math.floor(over / 2), gap:.8, delay:5},
        {type:'obsidian',  count: 3 + Math.floor(over / 2), gap:.8, delay:7},
    ];
    if (wave % 5 === 0)
        groups.push({type:'boss', count: 1 + Math.floor(over / 10), gap:3, delay:1});
    // Couriers only matter on boards with diag lanes; startWave skips them elsewhere.
    if (mapHasRoute('diag'))
        groups.push({type:'courier', count: 6 + over, gap:.4, delay:3});
    return groups;
}

// True when this map tags at least one path with the given route kind.
function mapHasRoute(route)
{
    const routes = mapDef().pathRoutes;
    return !!routes && routes.includes(route);
}

// Paths this creep type may walk. Untagged maps: ordinary creeps use every
// path, route-locked types (Courier) are skipped. Tagged maps: route-locked
// creeps stay on matching tags; everyone else may use any path (so a
// diag-only board still carries grunts and runners).
function eligibleLanes(type)
{
    const routes = mapDef().pathRoutes;
    const want   = ENEMY_TYPES[type].route;
    if (!routes)
        return want ? [] : PATHS.map((_, i) => i);
    if (!want)
        return PATHS.map((_, i) => i);
    const lanes = [];
    for (let i = 0; i < routes.length; ++i)
        if (routes[i] === want)
            lanes.push(i);
    return lanes;
}

// Endless waves for the ward lab. Both colors from here on, in equal number, so
// no amount of leaning on one color carries a board past the scripted list.
function proceduralWardWave(wave)
{
    const over = wave - WARD_WAVES.length;
    return [
        {type:'alabaster', count: 9 + over * 2, gap:.55},
        {type:'obsidian',  count: 9 + over * 2, gap:.55, delay:.3},
    ];
}

// A board can carry its own wave list — the ward lab sends nothing but the
// warded pair. Everything downstream reads the table through here, so the two
// lists stay independent right through to how fast health scales past the end.
function waveTable()
{
    return mapDef().wardsOnly ? WARD_WAVES : WAVES;
}

function waveGroups(wave)
{
    const table = waveTable();
    if (wave <= table.length)
        return table[wave - 1];
    return mapDef().wardsOnly ? proceduralWardWave(wave) : proceduralWave(wave);
}

// Rank-and-file creeps need to scale fast enough to threaten a filled board on
// their own — otherwise the only thing that ever kills you is a boss.
function waveHpScale(wave)
{
    const scripted = waveTable().length;
    const base = wave <= scripted ? 1 : 1 + (wave - scripted) * .55;
    return base * mapDef().hpMul;
}

function startWave(wave)
{
    waveClock  = 0;
    spawnQueue = [];
    const hpScale  = waveHpScale(wave);
    // Diag boards coin-flip each spawn onto a Courier so the bishop roads are
    // busy from wave 1 — easy to test coverage without waiting on the script.
    const diagTest = mapHasRoute('diag');
    for (const group of waveGroups(wave))
    {
        const delay = group.delay || 0;
        // Alternate lanes within a group so both routes stay under pressure
        // instead of one wave arriving entirely from the north.
        for (let i = 0; i < group.count; ++i)
        {
            let type = group.type;
            if (diagTest && type !== 'boss')
            {
                if (rand() < .5)
                    type = 'courier';
                else if (type === 'courier')
                    type = 'grunt';
            }
            const lanes = eligibleLanes(type);
            if (!lanes.length)
                continue;
            spawnQueue.push({type, time: delay + i * group.gap, hpScale, lane: lanes[i % lanes.length]});
        }
    }
    spawnQueue.sort((a, b) => a.time - b.time);
    soundWave.play();
}

function spawnEnemy(type, hpScale, lane)
{
    const def  = ENEMY_TYPES[type];
    const hp   = Math.round(def.hp * hpScale);
    const path = PATHS[lane];
    // A hopper's landings are every HOP_STRIDE squares from its phase, so the
    // phase is what pins them to its ward color: 0 if the route's first square
    // is already the right one, 1 if it has to skip a square to get there.
    const phase = def.ward ? (isLightSquare(path[0].row, path[0].col) === (def.ward === 'light') ? 0 : 1) : 0;
    const enemy = {
        type, def, path,
        t: phase,
        hopPhase: phase,
        hp, maxHp: hp,
        flash: 0,
        landTime: -9,
        slowTimer: new Timer(),
    };
    enemy.landings = enemyLandings(enemy);
    enemies.push(enemy);
}

function waveInProgress()
{
    return spawnQueue.length > 0 || enemies.length > 0;
}

///////////////////////////////////////////////////////////////////////////////
// MOVEMENT
// Warded creeps hop two squares and are untouchable in the hand; everything
// else steps one square and stays hittable. Both share `t`, so speed, wave
// pacing and leak timing are identical either way.

function enemyHops(enemy)
{
    return !!enemy.def.ward;
}

// 0 while the creep is planted on its square, then 0..1 across the arc to the
// landing square. The airborne slice sits at the END of each jump, so a hop
// always finishes by landing exactly on a square center.
function hopAir(frac)
{
    return clamp((frac - (1 - HOP_AIR_TIME)) / HOP_AIR_TIME);
}

// Which jump a hopper is on: the path indices it left from and is heading to,
// and how far through it is. Landings are `hopPhase`, +HOP_STRIDE, +2*STRIDE...
// which is what holds the creep on one square color. The final jump is clamped
// to the King's square, so a route whose length does not divide evenly ends on
// a short hop rather than overshooting the board.
function enemyHopStep(enemy)
{
    const end   = pathEnd(enemy.path);
    const t     = clamp(enemy.t, enemy.hopPhase, end);
    const jumps = (t - enemy.hopPhase) / HOP_STRIDE;
    const index = Math.floor(jumps);
    return {
        from: Math.min(enemy.hopPhase + index * HOP_STRIDE, end),
        to:   Math.min(enemy.hopPhase + (index + 1) * HOP_STRIDE, end),
        frac: jumps - index,
    };
}

// The square a creep counts as standing on, for wards and for tower targeting.
// A hopper keeps its launch square for the whole jump and takes the landing one
// the instant it touches down — it is never counted as standing on the square
// it arcs over, which is the one square of the wrong color it ever crosses.
function enemyCell(enemy)
{
    if (!enemyHops(enemy))
        return pathCell(enemy.path, enemy.t);
    return enemy.path[enemyHopStep(enemy).from];
}

// Fraction of a one-square step spent lifted. It is held to a fixed real time
// so a slow Brute is not carried in slow motion: it sits longer, then moves as
// briskly as anything else, like a hand that does not dawdle.
function stepAirFrac(enemy)
{
    return Math.min(STEP_AIR_SECONDS * enemy.def.speed, STEP_AIR_MAX);
}

// The move a creep is part-way through: the path indices it is carried from and
// to, and `air` 0..1 through the lift (0 = planted on `from`). A one-square
// step's lift is centered on the half-square mark, which is exactly where
// `pathCell` switches squares, so a piece changes cells in the hand, never
// while visibly sitting on a square.
function enemyMove(enemy)
{
    if (enemyHops(enemy))
    {
        const {from, to, frac} = enemyHopStep(enemy);
        return {from, to, air: from < to ? hopAir(frac) : 0};
    }

    const end  = pathEnd(enemy.path);
    const t    = clamp(enemy.t, 0, end);
    const a    = stepAirFrac(enemy);
    const from = Math.floor(t);
    const to   = Math.min(from + 1, end);
    return {from, to, air: from < to ? clamp((t - from - (.5 - a / 2)) / a) : 0};
}

// Counts set-downs so far; it ticks up on the frame a piece touches down.
function enemyLandings(enemy)
{
    if (enemyHops(enemy))
        return Math.floor((enemy.t - enemy.hopPhase) / HOP_STRIDE);
    return Math.floor(enemy.t - .5 - stepAirFrac(enemy) / 2);
}

// Height and travel across a lift, both 0..1. It rises fast and hangs, and only
// starts across once it is clear of the board, then eases in: picked up,
// carried, set down, rather than thrown.
function liftCurve(air)  { return Math.sin(air * PI) ** .5; }
function carryCurve(air) { return smoothStep(clamp((air - .15) / .7)); }

// Everything the renderer needs about where a piece is: `ground` is the spot on
// the board under it (the shadow), `lift` 0..1 how far off the board it is,
// `pos` where the piece itself is drawn.
function enemyPose(enemy)
{
    const {from, to, air} = enemyMove(enemy);
    const start  = pathPos(enemy.path, from);
    const ground = air > 0 ? start.lerp(pathPos(enemy.path, to), carryCurve(air)) : start;
    const lift   = air > 0 ? liftCurve(air) : 0;
    const height = (enemyHops(enemy) ? HOP_HEIGHT : STEP_HEIGHT) * CELL_SIZE;
    return {ground, lift, pos: ground.add(vec2(0, lift * height))};
}

function enemyPos(enemy)
{
    return enemyPose(enemy).pos;
}

// Squash on set-down, settling out over SET_DOWN_TIME, so each landing has a
// visible impact on the square it lands on.
function enemySquash(enemy)
{
    const squash = HOP_SQUASH * (1 - clamp((time - enemy.landTime) / SET_DOWN_TIME));
    return vec2(1 + squash * .5, 1 - squash);
}

///////////////////////////////////////////////////////////////////////////////
// UPDATE

// A warded creep is untouchable exactly while it is off the ground, and open
// the whole time it is planted. That needs no explanation on the HUD: the creep
// is visibly in the air, mid-arc over the square it refuses to stand on.
// Nothing about the square it launched from is consulted — where it CAN be is
// the color lock, and being airborne is the timing window.
function enemyIsAirborne(enemy)
{
    return enemyHops(enemy) && hopAir(enemyHopStep(enemy).frac) > 0;
}

// Which warded types are on the board or still queued, for the HUD legend.
function activeWardDefs()
{
    const defs = [];
    for (const enemy of enemies)
        if (enemy.def.ward && !defs.includes(enemy.def))
            defs.push(enemy.def);
    for (const queued of spawnQueue)
    {
        const def = ENEMY_TYPES[queued.type];
        if (def.ward && !defs.includes(def))
            defs.push(def);
    }
    return defs;
}

function damageEnemy(enemy, damage)
{
    // towers already avoid targeting a creep in mid-air; this is the backstop
    // for one that launches between being picked as a target and being shot
    if (enemyIsAirborne(enemy))
        return false;

    const dealt = Math.max(1, damage - enemy.def.armor);
    enemy.hp -= dealt;
    enemy.flash = .12;
    if (enemy.hp > 0)
        return false;

    gold += enemy.def.gold;
    const pos = enemyPos(enemy);
    spawnDeathBurst(pos, enemy.def.color, enemy.def.size);
    soundKill.play(pos, .5);
    return true;
}

function updateEnemies()
{
    waveClock += timeDelta;

    // release anything whose spawn time has come
    while (spawnQueue.length && spawnQueue[0].time <= waveClock)
    {
        const next = spawnQueue.shift();
        spawnEnemy(next.type, next.hpScale, next.lane);
    }

    for (let i = enemies.length - 1; i >= 0; --i)
    {
        const enemy = enemies[i];
        enemy.flash = Math.max(0, enemy.flash - timeDelta);
        const slow = enemy.slowTimer.active() ? LANE_SLOW_SCALE : 1;
        enemy.t += enemy.def.speed * slow * timeDelta;

        const landings = enemyLandings(enemy);
        if (landings > enemy.landings)
        {
            enemy.landings = landings;
            enemy.landTime = time;
            playStep(enemy);
            if (enemy.def.smash)
                smashAround(enemy);
        }

        if (enemy.hp <= 0)
        {
            enemies.splice(i, 1);
            continue;
        }

        if (enemy.t >= pathEnd(enemy.path))
        {
            leakEnemy(enemy);
            enemies.splice(i, 1);
        }
    }

    rebuildEnemyGrid();
}

// Ravager set-down: every piece on the four squares orthogonally beside its
// new square takes the blow — a rook's step, never a diagonal. The square it stands on is not included — a piece there is
// trampled by the usual lane hazard.
function smashAround(enemy)
{
    const cell = enemyCell(enemy);
    const pos  = getCellWorldPos(cell.row, cell.col);
    let hit = false;
    for (const [dr, dc] of ROOK_DIRS)
    {
        const tower = towerAt(cell.row + dr, cell.col + dc);
        if (!tower)
            continue;
        damageTower(tower, enemy.def.smash);
        hit = true;
    }
    spawnSmashBurst(pos);
    if (hit)
    {
        soundSmash.play(pos);
        addScreenShake(.2, .15);
    }
}

// A recorded boot step as a piece lands on its next tile, one random take.
// Bigger pieces sound lower. Steps are spaced out so a packed wave is a
// march rather than a buzz.
let lastStepTime = -9;
function playStep(enemy)
{
    if (time - lastStepTime < STEP_SPACING)
        return;
    lastStepTime = time;
    const take = soundSteps[randInt(soundSteps.length)];
    take.play(pathPos(enemy.path, enemyMove(enemy).from), .175, clamp(.55 / enemy.def.size, .6, 1.4));
}

function leakEnemy(enemy)
{
    baseHp -= enemy.def.leak;
    const king = enemy.path[pathEnd(enemy.path)];
    spawnLeakBurst(getCellWorldPos(king.row, king.col));
    // judged on the HP left after this hit: at or above 20% plays the regular
    // explosion, below 20% the low-health one. Compared as a ratio so the
    // edge is exact (4/20 == .2, where 20*.2 can round off for other maxes).
    if (baseHp / START_BASE_HP >= KING_HIT_FRAC)
        playKingHitSound();
    else
        playKingLowHitSound();
    addScreenShake(.35 + enemy.def.leak * .06, .3);
}

// Cell -> enemies standing on it, rebuilt once per frame so tower targeting
// (and line-of-sight occlusion) is a cheap lookup instead of a scan.
function rebuildEnemyGrid()
{
    enemyGrid.clear();
    for (const enemy of enemies)
    {
        const cell = enemyCell(enemy);
        const key  = cell.row * GRID_W + cell.col;
        const list = enemyGrid.get(key);
        if (list)
            list.push(enemy);
        else
            enemyGrid.set(key, [enemy]);
    }
}

// How close to the King this creep is, 0..1. Routes on a multi-lane map have
// different lengths, so raw `t` can't be compared across lanes — this can.
function enemyProgress(enemy)
{
    return enemy.t / pathEnd(enemy.path);
}

// The most advanced (closest to the base) enemy on a cell, or null.
function leadEnemyAt(row, col)
{
    const list = enemyGrid.get(row * GRID_W + col);
    if (!list)
        return null;
    let best = null;
    for (const enemy of list)
        if (enemy.hp > 0 && (!best || enemyProgress(enemy) > enemyProgress(best)))
            best = enemy;
    return best;
}

///////////////////////////////////////////////////////////////////////////////
// RENDER

function renderEnemies()
{
    // killed this frame but not yet reaped by updateEnemies
    const posed = [];
    for (const enemy of enemies)
        if (enemy.hp > 0)
            posed.push({enemy, ...enemyPose(enemy)});

    // Shadows first, all of them, so no piece is drawn under another's shadow.
    // A planted piece has a tight contact shadow; lifting it spreads and fades
    // the shadow while the piece rises and grows toward the camera.
    for (const {enemy, ground, lift} of posed)
    {
        if (enemy.def.smash)
            renderSmashZone(enemy);
        const size = enemy.def.size * CELL_SIZE;
        drawEllipse(ground.add(vec2(0, -size * (.08 + lift * .1))),
            vec2(size * (1.02 + lift * .15), size * (.75 + lift * .1)),
            rgb(0, 0, 0, .3 - lift * .15));
    }

    // pieces in the hand draw over the ones sitting on the board
    posed.sort((a, b) => a.lift - b.lift);
    for (const {enemy, pos, lift} of posed)
    {
        const def   = enemy.def;
        const size  = def.size * CELL_SIZE * (1 + lift * LIFT_SCALE);
        const color = enemy.flash > 0 ? WHITE : def.color;

        // Planted pieces sit still, like pieces on a board. Polygons hold their
        // facing while planted and only turn a little in the hand.
        const shape = vec2(size).multiply(enemySquash(enemy));
        if (def.sides === 0)
            drawEllipse(pos, shape, color, 0, size * .1, PIECE_OUTLINE);
        else
            drawRegularPoly(pos, shape, def.sides, color, size * .1, PIECE_OUTLINE, lift * .25);

        // armored enemies get a ring so their tier is readable at a glance
        if (def.armor > 0)
            drawCircle(pos, size * 1.25, CLEAR_WHITE, size * .06, hsl(.58, .8, .8, .7));

        if (def.ward)
            renderWard(enemy, pos, size);

        if (enemy.slowTimer.active())
            renderSlow(enemy, pos, size);

        renderHealthBar(pos, enemy);
    }
}

// A faint ring in the ward's color at all times so the type is identifiable,
// snapping to a bright spinning diamond while the creep is in the air and
// cannot be hurt. The arc and the shadow already say "off the ground"; this
// says the thing that follows from it, in the same place the player is looking.
function renderWard(enemy, drawPos, size)
{
    const wardColor = enemy.def.ward === 'light' ? WARD_LIGHT_COLOR : WARD_DARK_COLOR;
    const airborne  = enemyIsAirborne(enemy);

    drawCircle(drawPos, size * 1.4, CLEAR_WHITE, size * .08,
        rgb(wardColor.r, wardColor.g, wardColor.b, airborne ? .95 : .3));

    if (!airborne)
        return;

    // kept under a cell wide so a packed lane does not turn into a mesh of
    // overlapping diamonds
    const pulse = 1 + Math.sin(time * 8) * .06;
    drawRegularPoly(drawPos, vec2(size * 1.55 * pulse), 4, CLEAR_WHITE, size * .06,
        rgb(wardColor.r, wardColor.g, wardColor.b, .9), time * 1.2);
}

// The plus-shaped block a Ravager will hit on its next set-down, outlined on the
// square it is heading for so the player can see which pieces are next. It
// brightens as the piece comes down.
function renderSmashZone(enemy)
{
    const {from, to, air} = enemyMove(enemy);
    const pos   = pathPos(enemy.path, air > 0 ? to : from);
    const alpha = .12 + air * .35;
    const c     = SMASH_COLOR;
    const fill  = rgb(c.r, c.g, c.b, alpha * .35);
    const s     = CELL_SIZE * .5;   // half a square
    const a     = CELL_SIZE * 1.5;  // tip of each arm
    // the across bar, then the up and down arms, so no square is tinted twice
    drawRect(pos, vec2(a * 2, s * 2), fill);
    drawRect(pos.add(vec2(0,  CELL_SIZE)), vec2(CELL_SIZE), fill);
    drawRect(pos.add(vec2(0, -CELL_SIZE)), vec2(CELL_SIZE), fill);
    drawLineList([
        vec2(-s,  a), vec2( s,  a), vec2( s,  s), vec2( a,  s),
        vec2( a, -s), vec2( s, -s), vec2( s, -a), vec2(-s, -a),
        vec2(-s, -s), vec2(-a, -s), vec2(-a,  s), vec2(-s,  s),
    ], CELL_SIZE * .05, rgb(c.r, c.g, c.b, alpha + .1), true, pos);
}

// An icy ring that shrinks as the slow wears off, so the player can see how
// much time the lost piece bought.
function renderSlow(enemy, drawPos, size)
{
    const left = 1 - enemy.slowTimer.getPercent();
    drawCircle(drawPos, size * (1.2 + left * .5), CLEAR_WHITE, size * .1,
        rgb(SLOW_COLOR.r, SLOW_COLOR.g, SLOW_COLOR.b, .4 + left * .5));
}

// Shared by creeps and pieces; only drawn once the unit has taken damage.
function renderHealthBar(pos, enemy, width = CELL_SIZE * .7)
{
    if (enemy.hp >= enemy.maxHp)
        return;
    const height = CELL_SIZE * .09;
    const barPos = pos.add(vec2(0, CELL_SIZE * .38));
    const fill   = clamp(enemy.hp / enemy.maxHp);
    drawRect(barPos, vec2(width, height), hsl(0, 0, 0, .6));
    drawRect(barPos.add(vec2(-width * (1 - fill) / 2, 0)), vec2(width * fill, height),
        hsl(lerp(0, .33, fill), .8, .5));
}
