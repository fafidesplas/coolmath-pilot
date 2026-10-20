/*
    Gambit Defense
    - A chess-piece tower defense. Creeps walk a path across the board toward
      your King; you spend gold to place white pieces on the empty squares.
    - Every tower attacks exactly the squares its chess move would reach.
      Sliding pieces (bishop/rook/queen) are blocked by other towers and can
      only hit the FIRST enemy on each line — knights jump over everything.
    - Boards can have more than one spawn, which splits your gold across two
      fronts instead of letting one wall of pawns cover everything.
    - Placed pieces are not stuck: a piece can walk to any square it attacks,
      as often as you like. That includes creep-route squares, which you can never build on — a piece standing on
      the route is trampled by the first creep to reach it.
    - Square color is live game state. Bishops and pawns only ever attack their
      OWN square's color, knights only the opposite one, rooks and queens both.
      Warded creeps (Alabaster, Obsidian) skip the other color entirely: they
      hop two squares at a time, so an Alabaster only ever stands on light and
      an Obsidian only on dark. A piece that never attacks their color never
      gets a shot at them. They can always be hit while planted, and are
      untouchable only for the arc of the jump itself.
    - Controls: 1-5 or the bottom bar picks a piece, click a square to build,
      right-click cancels. Click a tower to inspect it, then U upgrades,
      V moves it, X deletes it for a partial refund. TAB flips the bottom bar
      to the army-wide lane upgrades (upgrades.js).
      SPACE sends the next wave early for bonus gold. R restarts, M picks a board.
    - Debug builds only (not the release zip): G toggles infinite gold, N skips
      the wave. Both also have buttons under the HUD.
*/

'use strict';

///////////////////////////////////////////////////////////////////////////////
// RUN STATE

let gold          = START_GOLD;
let baseHp        = START_BASE_HP;
let wave          = 1;
let phase         = 'menu';   // 'menu' | 'prep' | 'combat' | 'over'
let prepTimer     = PREP_TIME;
let infiniteGold  = false;    // debug cheat, see updateDebugKeys
let selectedBuild = null;     // tower type key being placed
let selectedTower = null;     // tower being inspected
let moveMode      = false;    // selected tower is picking a square to walk to
let bestWaves     = MAPS.map(() => 0);

// The draft (signatures.js): after every cleared wave the phase is 'draft' while
// a free pick is open. (A board flagged `draft` also starts with picks and has
// no gold at all.) It has two stages — 'choose' shows the offers, 'place' holds the chosen piece
// until it is set down on the board.
let draftStage     = 'choose';
let draftOffers    = [];
let draftPicksLeft = 0;
let pendingPiece   = null;   // {type, signature} chosen but not yet placed

function clearSelection()
{
    selectedBuild = null;
    selectedTower = null;
    moveMode      = false;
}

function startRun()
{
    gold          = START_GOLD;
    baseHp        = START_BASE_HP;
    wave          = 1;
    phase         = 'prep';
    prepTimer     = PREP_TIME;
    clearSelection();

    resetTowers();
    resetLaneUpgrades();
    resetEnemies();
    clearParticles();

    for (const [type, row, col] of mapDef().startPieces ?? [])
        addTower(row, col, type, 0);

    if (isDraftMap())
        startDraft(DRAFT_START_PICKS);
}

function startMap(index)
{
    loadMap(index);
    startRun();
}

function openLevelSelect()
{
    phase = 'menu';
    menuScroll = 0;
    clearSelection();
    resetEnemies();
    clearParticles();
}

///////////////////////////////////////////////////////////////////////////////
// SAVE DATA
// Bests are stored per board under flat `best<index>` keys — readSaveData does
// a shallow merge, so nesting them in one object would lose the defaults.

function loadBests()
{
    const saved = readSaveData(SAVE_KEY, {});
    bestWaves = MAPS.map((map, i) => Number(saved['best' + i]) || 0);

    // carry over the single best from before the game had multiple boards
    bestWaves[0] = Math.max(bestWaves[0], Number(saved.best) || 0);
}

function saveBests()
{
    const data = {};
    bestWaves.forEach((best, i) => data['best' + i] = best);
    writeSaveData(SAVE_KEY, data);
}

///////////////////////////////////////////////////////////////////////////////
// PHASES

function beginWave()
{
    // reward whatever prep time you were willing to give up
    if (!isDraftMap())
        gold += Math.floor(prepTimer * EARLY_BONUS);
    phase = 'combat';
    startWave(wave);
}

function finishWave()
{
    // the gold-free draft board pays nothing; every other board pays as before
    if (!isDraftMap())
        gold += 12 + wave * 2;
    ++wave;

    // every cleared wave ends with a free pick (see DRAFT below)
    startDraft(1);
}

///////////////////////////////////////////////////////////////////////////////
// DRAFT

function startDraft(picks)
{
    clearSelection();
    pendingPiece = null;

    // a board with nowhere left to put a piece skips the pick rather than
    // trapping the player on a screen they cannot finish
    if (!draftCanPlace())
    {
        phase     = 'prep';
        prepTimer = PREP_TIME;
        return;
    }

    phase          = 'draft';
    draftPicksLeft = picks;
    nextDraftOffer();
}

function draftCanPlace()
{
    return buildCells().some(cell => draftPlacementKind(cell.row, cell.col));
}

function nextDraftOffer()
{
    draftStage   = 'choose';
    draftOffers  = rollOffers();
    pendingPiece = null;
}

function pickDraftOffer(index)
{
    if (!draftOffers[index])
        return;
    playUiClick();
    pendingPiece = draftOffers[index];
    draftStage   = 'place';
}

// Every build square taken: from here a new piece has to replace one.
function draftBoardFull()
{
    return buildCells().every(cell => towerAt(cell.row, cell.col));
}

// What setting the held piece on a square would do, or null if it cannot:
//   place   — the square is empty and buildable, anywhere the shop could build
// and, only on a gold-free draft board (where the build rows are cramped):
//   push    — a piece stands on the back row (just above a King) with the square
//             ahead of it free, so that piece steps forward and the new one
//             takes its place
//   replace — the board is full, so the piece there is lost
function draftPlacementKind(row, col)
{
    if (!towerAt(row, col))
        return canBuildAt(row, col) ? 'place' : null;
    if (!isDraftMap())
        return null;
    if (isBaseCell(row + 1, col) && canBuildAt(row - 1, col))
        return 'push';
    return draftBoardFull() ? 'replace' : null;
}

// Sets the held piece on a square, as draftPlacementKind describes.
function placePendingPiece(row, col)
{
    const kind = draftPlacementKind(row, col);
    if (!kind)
    {
        soundDeny.play();
        return;
    }

    const existing = towerAt(row, col);
    if (kind === 'push')
        relocateTower(existing, row - 1, col);
    else if (kind === 'replace')
    {
        const pos = getCellWorldPos(row, col);
        removeTower(existing);
        spawnDeathBurst(pos, PIECE_COLOR, .8);
        soundSell.play();
    }

    // a drafted piece is worth its base price if sold, except on the gold-free board
    const invested = isDraftMap() ? 0 : TOWER_TYPES[pendingPiece.type].cost;
    const tower    = addTower(row, col, pendingPiece.type, invested);
    applySignature(tower, pendingPiece.signature);
    pendingPiece = null;

    if (--draftPicksLeft > 0)
        nextDraftOffer();
    else
    {
        phase     = 'prep';
        prepTimer = PREP_TIME;
    }
}

function updateDraftInput()
{
    if (draftStage === 'choose')
    {
        for (let i = 0; i < draftOffers.length; ++i)
            if (keyWasPressed('Digit' + (i + 1)))
                pickDraftOffer(i);
        if (mouseWasPressed(0) && hoverDraft !== null)
            pickDraftOffer(hoverDraft);
    }
    else if (mouseWasPressed(0) && hoverCell)
        placePendingPiece(hoverCell.row, hoverCell.col);
}

function endRun()
{
    phase = 'over';
    clearSelection();
    const survived = wave - 1;
    if (survived > bestWaves[currentMap])
    {
        bestWaves[currentMap] = survived;
        saveBests();
    }
    soundOver.play();
    addScreenShake(.8, .8);
}

///////////////////////////////////////////////////////////////////////////////
// INPUT

function handleBoardClick()
{
    // a click off the board is a click on empty space: it closes the card
    if (!hoverCell)
    {
        if (!moveMode)
            selectedTower = null;
        return;
    }
    const {row, col} = hoverCell;

    // In move mode a click on an empty square is a destination. Move mode
    // sticks until the player leaves it (V, the MOVE button, Esc, right click,
    // or clicking one of their pieces, which selects that piece instead), so a
    // piece can be walked several squares in a row. It only drops on its own
    // when the piece dies on landing or is boxed in.
    if (moveMode && selectedTower && !towerAt(row, col))
    {
        if (!canMoveTo(selectedTower, row, col))
        {
            soundDeny.play();
            return;
        }
        moveTower(selectedTower, row, col);
        if (!selectedTower || !canTowerMove(selectedTower))
            moveMode = false;
        return;
    }

    if (selectedBuild && !towerAt(row, col))
    {
        buildTower(row, col, selectedBuild);
        return;
    }

    // clicking a placed piece while building or moving drops that mode and selects the piece
    selectedBuild = null;
    moveMode      = false;
    selectedTower = towerAt(row, col);
}

// Called by the V hotkey and the MOVE button under the selected piece.
function toggleMoveMode()
{
    if (!selectedTower)
        return;
    if (!moveMode && !canTowerMove(selectedTower))
    {
        soundDeny.play();
        return;
    }
    moveMode      = !moveMode;
    selectedBuild = null;
}

function sellSelectedTower()
{
    if (!selectedTower)
        return;
    sellTower(selectedTower);   // clears selectedTower via removeTower
    moveMode = false;
}

function updateMenuInput()
{
    scrollLevelSelect();
    for (let i = 0; i < MAPS.length; ++i)
        if (keyWasPressed('Digit' + (i + 1)))
            startMap(i);

    if (mouseWasPressed(0) && hoverMapCard !== null)
    {
        playUiClick();
        startMap(hoverMapCard);
    }
}

function updateInput()
{
    // Draft boards have no shop: no hotkeys to build, no selling, upgrades or
    // perks, and no lane-upgrade tab. A piece can still be selected and moved.
    const draft = isDraftMap();

    // piece hotkeys
    for (let i = 0; i < TOWER_ORDER.length && !draft; ++i)
        if (keyWasPressed('Digit' + (i + 1)))
        {
            setToolbarTab('pieces');
            selectedBuild = selectedBuild === TOWER_ORDER[i] ? null : TOWER_ORDER[i];
            selectedTower = null;
            moveMode      = false;
        }

    // Right-clicking one of your pieces sells it on the spot — except in move
    // mode, where right click only ever means "stop moving", and while a card is
    // open, where right-clicking anything but that piece just dismisses the card.
    const rightClicked = mouseWasPressed(2) && !moveMode && hoverCell
        && towerAt(hoverCell.row, hoverCell.col);
    const sellTarget   = !draft && (!selectedTower || rightClicked === selectedTower) && rightClicked;
    if (sellTarget)
        sellTower(sellTarget);   // clears selectedTower via removeTower if it was this one

    // cancel backs out of move mode first, so one press doesn't also drop the
    // selection you were about to act on again
    else if (keyWasPressed('Escape') || mouseWasPressed(2))
    {
        if (moveMode)
            moveMode = false;
        else
        {
            selectedBuild = null;
            selectedTower = null;
        }
    }

    if (selectedTower)
    {
        if (keyWasPressed('KeyV'))
            toggleMoveMode();
        if (!draft)
        {
            if (keyWasPressed('KeyU'))
                upgradeTower(selectedTower);
            for (const key of towerPerkKeys(selectedTower))
                if (keyWasPressed('Key' + PERKS[key].hotkey))
                    buyPerk(selectedTower, key);
            if (keyWasPressed('KeyX'))
                sellSelectedTower();
        }
    }

    if (keyWasPressed('Tab') && !draft)
        setToolbarTab(toolbarTab === 'pieces' ? 'upgrades' : 'pieces');

    if (phase === 'prep' && keyWasPressed('Space'))
        beginWave();

    if (mouseWasPressed(0) && !uiHandleClick())
        handleBoardClick();
}

///////////////////////////////////////////////////////////////////////////////
// GAME LOOP

function gameInit()
{
    canvasClearColor = hsl(.62, .25, .09);
    setSoundVolume(.6);

    loadBests();
    if (MAPS.length)
        loadMap(0);
    openLevelSelect();
}

function gameUpdate()
{
    updateHover();

    if (phase === 'menu')
    {
        updateMenuInput();
        fitCamera();
        return;
    }

    if (keyWasPressed('KeyM'))
    {
        openLevelSelect();
        return;
    }
    if (keyWasPressed('KeyR'))
        startRun();
    if (debug)
        updateDebugKeys();

    updateTowerFx();

    if (phase === 'over')
    {
        fitCamera();
        return;
    }

    if (phase === 'draft')
    {
        updateDraftInput();
        fitCamera();
        return;
    }

    updateInput();

    if (phase === 'prep')
    {
        prepTimer -= timeDelta;
        if (prepTimer <= 0)
        {
            prepTimer = 0;
            beginWave();
        }
    }
    else
    {
        updateEnemies();
        updateTowers();

        if (baseHp <= 0)
            endRun();
        else if (!waveInProgress())
            finishWave();
    }

    // camera is fit here rather than in gameUpdatePost so the screen-shake
    // plugin (which runs in between) doesn't get overwritten
    fitCamera();
}

// Cheats for testing, compiled out of the release build (debug is 0 there).
// Infinite gold just keeps the purse topped up, so every price check and the
// HUD work unchanged; it survives restarts and board changes.
const DEBUG_GOLD = 99999;
function updateDebugKeys()
{
    if (keyWasPressed('KeyG'))
        toggleInfiniteGold();
    if (keyWasPressed('KeyN'))
        skipWave();
    if (infiniteGold)
        gold = DEBUG_GOLD;
}

function toggleInfiniteGold()
{
    infiniteGold = !infiniteGold;
}

// Counts the current wave (or, during prep, the upcoming one) as cleared:
// every creep is removed with no kill gold, then the normal wave-clear reward
// is paid and the next prep starts.
function skipWave()
{
    if (phase !== 'prep' && phase !== 'combat')
        return;
    resetEnemies();
    finishWave();
}

function fitCamera()
{
    const boardSize = vec2(GRID_W * CELL_SIZE, GRID_H * CELL_SIZE);
    cameraFit(vec2(0, 0), boardSize, .4, {top: HUD_HEIGHT + 10, bottom: TOOLBAR_HEIGHT + 10});
}

///////////////////////////////////////////////////////////////////////////////
// RENDER

function renderBoard()
{
    for (let row = 0; row < GRID_H; ++row)
    for (let col = 0; col < GRID_W; ++col)
    {
        const isLight = (row + col) % 2 === 0;
        const onPath  = isPathCell(row, col);
        const color   = onPath ? (isLight ? PATH_LIGHT : PATH_DARK)
                               : (isLight ? LIGHT_SQUARE : DARK_SQUARE);
        drawRect(getCellWorldPos(row, col), vec2(CELL_SIZE), color);
        drawRect(getCellWorldPos(row, col), vec2(CELL_SIZE * .97), GRID_LINE);
        drawRect(getCellWorldPos(row, col), vec2(CELL_SIZE * .94), color);
        if (isBlockedCell(row, col))
            renderBlockedCell(getCellWorldPos(row, col), onPath);
        if (isWallCell(row, col))
            renderWallCell(getCellWorldPos(row, col));
    }

    renderPathArrows();
    renderSpawns();
    renderBase();
}

// Unusable square: a dark slab with an X. On a lane it is inset so the route
// color still shows around it and the lane reads as unbroken.
function renderBlockedCell(pos, onPath)
{
    const size = CELL_SIZE * (onPath ? .7 : .94);
    const arm  = size * .28;
    drawRect(pos, vec2(size), UNUSABLE_COLOR);
    drawLine(pos.add(vec2(-arm, -arm)), pos.add(vec2(arm, arm)), .07, UNUSABLE_MARK);
    drawLine(pos.add(vec2(-arm, arm)), pos.add(vec2(arm, -arm)), .07, UNUSABLE_MARK);
}

// Wall: a raised stone block with a brick seam, so it reads as solid rather
// than just unusable.
function renderWallCell(pos)
{
    const size = CELL_SIZE * .94;
    const top  = pos.add(vec2(0, CELL_SIZE * .04));
    drawRect(pos.add(vec2(0, -CELL_SIZE * .03)), vec2(size), WALL_EDGE);
    drawRect(top, vec2(size * .92), WALL_COLOR);
    const half = size * .46, line = .045;
    drawLine(top.add(vec2(-half, 0)), top.add(vec2(half, 0)), line, WALL_EDGE);
    drawLine(top.add(vec2(0, 0)), top.add(vec2(0, half)), line, WALL_EDGE);
    drawLine(top.add(vec2(-half * .5, 0)), top.add(vec2(-half * .5, -half)), line, WALL_EDGE);
    drawLine(top.add(vec2(half * .5, 0)), top.add(vec2(half * .5, -half)), line, WALL_EDGE);
}

// Faint chevrons every few cells so each route's direction is obvious.
function renderPathArrows()
{
    for (const path of PATHS)
    for (let i = 2; i < pathEnd(path) - 1; i += 3)
    {
        const from = getCellWorldPos(path[i].row, path[i].col);
        const to   = getCellWorldPos(path[i + 1].row, path[i + 1].col);
        const dir  = to.subtract(from).normalize(CELL_SIZE * .18);
        const mid  = from.lerp(to, .5);
        const wing = dir.rotate(PI / 2).scale(.7);
        drawLine(mid.subtract(dir).add(wing), mid.add(dir), .05, hsl(0, 0, 1, .18));
        drawLine(mid.subtract(dir).subtract(wing), mid.add(dir), .05, hsl(0, 0, 1, .18));
    }
}

function renderSpawns()
{
    const pulse = .8 + Math.sin(time * 3) * .1;
    for (const path of PATHS)
    {
        const pos = getCellWorldPos(path[0].row, path[0].col);
        drawCircle(pos, CELL_SIZE * .55 * pulse, CLEAR_WHITE, .06, hsl(0, .7, .6, .6));
    }
}

function renderBase()
{
    const pulse = 1 + Math.sin(time * 2) * .04;
    const hurt  = 1 - baseHp / START_BASE_HP;
    for (const cell of BASE_CELLS)
    {
        const pos = getCellWorldPos(cell.row, cell.col);
        drawCircle(pos, CELL_SIZE * .95 * pulse, hsl(lerp(.13, 0, hurt), .8, .5, .18));
        drawText('♚', pos, CELL_SIZE * .88, BASE_COLOR, CELL_SIZE * .07, PIECE_OUTLINE);
    }
}

function gameRender()
{
    if (phase === 'menu')
        return;

    renderBoard();
    renderHoverOverlays();
    renderTowers();
    renderEnemies();
    renderProjectiles();
    renderTowerHealthBars();
}

function gameRenderPost()
{
    if (phase === 'menu')
    {
        renderLevelSelect();
        return;
    }

    renderHud();
    renderDebugButtons();
    renderToolbar();
    renderTowerCards();
    if (phase === 'draft' && draftStage === 'choose')
        renderDraftCards();
    if (phase === 'over')
        renderGameOver();
}

///////////////////////////////////////////////////////////////////////////////
// boards live in levels/, which load asynchronously — start once they're in
loadLevels(() => engineInit(gameInit, gameUpdate, undefined, gameRender, gameRenderPost));
