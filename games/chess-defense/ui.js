/*
    HUD, build toolbar and hover previews.

    The toolbar is drawn in screen space along the bottom; cameraFit reserves
    room for it so the board never sits underneath.
*/

'use strict';

// The extra row over the old 76 carries the ward legend bottom-center;
// cameraFit reserves it, so the board just shrinks.
const HUD_HEIGHT     = 96;
const TOOLBAR_HEIGHT = 108;
const BUTTON_GAP     = 8;
const BUTTON_MARGIN  = 14;
const TAB_W          = 104;   // PIECES / UPGRADES tabs stacked at the bar's left end

// Upgrade / perk / move / delete buttons along the bottom of the selected piece's card.
const ACTION_W   = 126;
const ACTION_H   = 32;
const ACTION_GAP = 6;

// The stats card that pops up over a selected or hovered piece.
const CARD_PAD     = 10;
const CARD_STATS_H = 58;   // name/level row plus damage row
const CARD_HP_H    = 25;   // HP row, selected card only
const CARD_PERK_H  = 22;   // extra row spelling out owned perks, selected card only
const CARD_POINTER = 10;   // gap between piece and card, filled by the pointer
const CARD_PREVIEW_W = 270;  // hover cards have no action row, so they stay narrow
const CARD_SIG_W   = 340;  // draft boards: wide enough to spell a signature out in two lines
const CARD_SIG_H   = 40;   // the signature text, two lines, on a draft card

// Draft pick cards, shown while a pick is open (see signatures.js).
const DRAFT_CARD_W   = 230;
const DRAFT_CARD_H   = 330;
const DRAFT_CARD_GAP = 22;

let hoverCell    = null;   // {row, col} under the mouse, or null
let hoverButton  = null;   // toolbar piece key under the mouse, or null
let hoverTab     = null;   // toolbar tab key under the mouse, or null
let hoverUpgrade = null;   // LANE_UPGRADES key under the mouse, or null
let toolbarTab   = 'pieces';   // 'pieces' | 'upgrades'
let hoverAction  = null;   // selected-piece action key under the mouse, or null
let hoverCard    = false;  // mouse is over the selected piece's card
let hoverMapCard = null;   // level-select card index under the mouse, or null
let hoverDebug   = null;   // debug button key under the mouse, or null
let hoverDraft   = null;   // draft offer index under the mouse, or null

///////////////////////////////////////////////////////////////////////////////
// LAYOUT

function getToolbarTabRects()
{
    if (isDraftMap())
        return [];
    const height = (TOOLBAR_HEIGHT - BUTTON_MARGIN * 2 - BUTTON_GAP / 2) / 2;
    const top    = mainCanvasSize.y - TOOLBAR_HEIGHT + BUTTON_MARGIN;
    return ['pieces', 'upgrades'].map((key, i) => ({
        key, width: TAB_W, height,
        x: BUTTON_MARGIN,
        y: top + i * (height + BUTTON_GAP / 2),
    }));
}

// Lays `keys` out as a centered row in the space right of the tabs.
function layoutToolbarRow(keys, maxWidth)
{
    const count  = keys.length;
    const left   = BUTTON_MARGIN + TAB_W + BUTTON_GAP * 2;
    const space  = mainCanvasSize.x - left - BUTTON_MARGIN;
    const width  = Math.min(maxWidth, (space - BUTTON_GAP * (count - 1)) / count);
    const height = TOOLBAR_HEIGHT - BUTTON_MARGIN * 2;
    const totalW = width * count + BUTTON_GAP * (count - 1);
    const startX = left + (space - totalW) / 2;
    const y      = mainCanvasSize.y - TOOLBAR_HEIGHT + BUTTON_MARGIN;

    return keys.map((key, i) => ({
        key, width, height,
        x: startX + i * (width + BUTTON_GAP),
        y,
    }));
}

// Piece buttons; empty while the UPGRADES tab is showing.
function getToolbarRects()
{
    return toolbarTab === 'pieces' && !isDraftMap() ? layoutToolbarRow(TOWER_ORDER, 124) : [];
}

function getUpgradeRects()
{
    return toolbarTab === 'upgrades' && !isDraftMap() ? layoutToolbarRow(LANE_UPGRADE_ORDER, 250) : [];
}

function setToolbarTab(tab)
{
    toolbarTab = tab;
    // the build ghost belongs to the piece row; don't leave it armed behind the upgrades
    if (tab !== 'pieces')
        selectedBuild = null;
}

// The card floats above its piece with a pointer down to it, and flips below
// when a piece near the top rank would push it under the HUD. It is clamped
// sideways into the window. A selected piece's card carries the action row
// along its bottom; a hovered piece's card is stats only.
// One button per perk the piece's type can take, between upgrade and move.
function towerActionKeys(tower)
{
    // nothing is bought or sold on a draft board; a piece can only walk
    return isDraftMap() ? ['move'] : ['upgrade', ...towerPerkKeys(tower), 'move', 'sell'];
}

// The extra row on a selected card: owned perks in the shop game, the signature
// spelled out on a draft board.
function cardExtraHeight(tower)
{
    if (isDraftMap())
        return tower.signature ? CARD_SIG_H : 0;
    return (ownedPerkKeys(tower).length ? CARD_PERK_H : 0) + (cardShowsSignature(tower) ? CARD_PERK_H : 0);
}

// A drafted piece's signature gets its own line on a normal board. Pierce and
// Rapid skip it: they are perks, and the perk row already spells them out.
function cardShowsSignature(tower)
{
    return !isDraftMap() && !!tower.signature && !SIGNATURES[tower.signature].perks;
}

// Splits text into lines no wider than `width` pixels at font `size`.
function wrapTextScreen(text, size, width)
{
    const lines = [];
    let line = '';
    for (const word of text.split(' '))
    {
        const next = line ? line + ' ' + word : word;
        if (line && textWidthScreen(next, size) > width)
        {
            lines.push(line);
            line = word;
        }
        else
            line = next;
    }
    if (line)
        lines.push(line);
    return lines;
}

function ownedPerkKeys(tower)
{
    return towerPerkKeys(tower).filter(key => hasPerk(tower, key));
}

// "PIERCE IV: through your pieces and 3 enemies" — the owned tier.
function perkCardText(tower, key)
{
    const tier = PERKS[key].tiers[perkTier(tower, key) - 1];
    if (key === 'pierce' && perkTier(tower, key) >= 2)
    {
        const n = pierceCount(tower);
        return `${tier.name}: through your pieces and ${n} ${n === 1 ? 'enemy' : 'enemies'}`;
    }
    return `${tier.name}: ${tier.hint.toLowerCase()}`;
}

function getTowerCardRect(tower, withActions)
{
    const actions = towerActionKeys(tower).length;
    const width   = isDraftMap() ? CARD_SIG_W
        : withActions
        ? actions * ACTION_W + (actions - 1) * ACTION_GAP + CARD_PAD * 2
        : CARD_PREVIEW_W;
    const height = CARD_PAD * 2 + CARD_STATS_H
        + (withActions ? CARD_HP_H : 0)
        + (withActions ? cardExtraHeight(tower) : (cardShowsSignature(tower) ? CARD_PERK_H : 0))
        + (withActions ? ACTION_GAP + ACTION_H : 0);
    const anchor = worldToScreen(getCellWorldPos(tower.row, tower.col));
    const offset = cameraScale * CELL_SIZE * .5 + CARD_POINTER;
    const minY   = HUD_HEIGHT + BUTTON_MARGIN;

    let y = anchor.y - offset - height;
    const below = y < minY;
    if (below)
        y = anchor.y + offset;

    const x = clamp(anchor.x - width / 2, BUTTON_MARGIN, Math.max(BUTTON_MARGIN, mainCanvasSize.x - width - BUTTON_MARGIN));
    return {x, y, width, height, below, anchorX: anchor.x};
}

// No card for the selection while a move is being picked: it would sit on top
// of the destination squares, and any board click leaves move mode anyway.
function getSelectedCardRect()
{
    if (!selectedTower || moveMode || phase === 'menu' || phase === 'over' || phase === 'draft')
        return null;
    return getTowerCardRect(selectedTower, true);
}

function getTowerActionRects()
{
    const card = getSelectedCardRect();
    if (!card)
        return [];

    const y = card.y + card.height - CARD_PAD - ACTION_H;
    return towerActionKeys(selectedTower).map((key, i) => ({
        key, width: ACTION_W, height: ACTION_H,
        x: card.x + CARD_PAD + i * (ACTION_W + ACTION_GAP), y,
    }));
}

// A piece under the mouse that is not the selection gets a stats-only card, so
// pieces can be compared without clicking. Not while building (the placement
// ghost owns the hover) or picking a move square.
function getHoverCardTower()
{
    if (!hoverCell || selectedBuild || moveMode || phase === 'menu' || phase === 'over' || phase === 'draft')
        return null;
    const tower = towerAt(hoverCell.row, hoverCell.col);
    return tower !== selectedTower ? tower : null;
}

// Label, whether it is usable, and whether it is the active mode.
function towerActionState(key, tower)
{
    if (key === 'upgrade')
        return tower.level >= MAX_LEVEL
            ? {label: 'MAX LEVEL', enabled: false}
            : {label: `U  UPGRADE ${upgradeCost(tower)}`, enabled: gold >= upgradeCost(tower)};

    if (key === 'move')
        return {label: 'V  MOVE', enabled: canTowerMove(tower), active: moveMode};

    const perk = PERKS[key];
    if (perk)
    {
        if (perkMaxed(tower, key))
            return {label: `${perk.tiers[perk.tiers.length - 1].name} ✓`, enabled: false, owned: true};
        const cost = perkCost(tower, key);
        return {label: `${perk.hotkey}  ${nextPerkTier(tower, key).name} ${cost}`, enabled: gold >= cost};
    }

    return {label: `X  DELETE +${sellRefund(tower)}`, enabled: true};
}

// Cards lay out two to a row (one on a narrow window), reading left to right.
// A list too tall for the window scrolls with the mouse wheel; `menuScroll` is
// how many pixels it has moved up.
let menuScroll = 0;

function menuColumns()
{
    return mainCanvasSize.x >= MENU_TWO_COLUMN_MIN_W ? Math.min(2, MAPS.length) : 1;
}

function menuLayout()
{
    const cols     = menuColumns();
    const rows     = Math.ceil(MAPS.length / cols);
    const width    = Math.min(MENU_CARD_W, (mainCanvasSize.x - 48 - MENU_CARD_GAP * (cols - 1)) / cols);
    const totalH   = rows * MENU_CARD_H + (rows - 1) * MENU_CARD_GAP;
    const startY   = Math.max(MENU_TOP, mainCanvasSize.y / 2 - totalH / 2 + 40);
    const maxScroll = Math.max(0, startY + totalH - (mainCanvasSize.y - MENU_BOTTOM));
    return {cols, width, startY, maxScroll,
        left: (mainCanvasSize.x - (width * cols + MENU_CARD_GAP * (cols - 1))) / 2};
}

function scrollLevelSelect()
{
    menuScroll = clamp(menuScroll + mouseWheel * 48, 0, menuLayout().maxScroll);
}

function getMapCardRects()
{
    const {cols, width, startY, left, maxScroll} = menuLayout();
    menuScroll = clamp(menuScroll, 0, maxScroll);
    return MAPS.map((map, index) => ({
        index, map, width, height: MENU_CARD_H,
        x: left + (index % cols) * (width + MENU_CARD_GAP),
        y: startY + Math.floor(index / cols) * (MENU_CARD_H + MENU_CARD_GAP) - menuScroll,
    }));
}

// Debug-only cheat buttons in a row just under the HUD, left side. Empty in
// the release build and once the run is over. Actions are wrapped because
// game.js (which defines them) loads after this file.
const DEBUG_BUTTONS = {
    gold: {label: () => infiniteGold ? 'G  ∞ GOLD: ON' : 'G  ∞ GOLD: OFF', action: () => toggleInfiniteGold()},
    skip: {label: () => 'N  SKIP WAVE',                                    action: () => skipWave()},
};
const DEBUG_BUTTON_W = 150;
const DEBUG_BUTTON_H = 28;

function getDebugButtonRects()
{
    if (!debug || (phase !== 'prep' && phase !== 'combat'))
        return [];
    const keys = Object.keys(DEBUG_BUTTONS).filter(key => !(isDraftMap() && key === 'gold'));
    return keys.map((key, i) => ({key,
        x: BUTTON_MARGIN + i * (DEBUG_BUTTON_W + BUTTON_GAP), y: HUD_HEIGHT + BUTTON_GAP,
        width: DEBUG_BUTTON_W, height: DEBUG_BUTTON_H}));
}

function renderDebugButtons()
{
    for (const rect of getDebugButtonRects())
    {
        const hovered = hoverDebug === rect.key;
        const on      = rect.key === 'gold' && infiniteGold;
        const center  = drawToolbarFrame(rect, hovered ? hsl(.83, .3, .3) : hsl(.83, .3, .16),
            on ? hsl(.83, .8, .65) : hsl(.83, .4, .45));
        drawTextScreen(DEBUG_BUTTONS[rect.key].label(), vec2(center.x, center.y + 1), 14,
            on ? HUD_COLOR : hsl(0, 0, .75), 3, BLACK);
    }
}

function rectContains(rect, pos)
{
    return pos.x >= rect.x && pos.x <= rect.x + rect.width
        && pos.y >= rect.y && pos.y <= rect.y + rect.height;
}

function updateHover()
{
    hoverButton  = null;
    hoverTab     = null;
    hoverUpgrade = null;
    hoverAction  = null;
    hoverMapCard = null;
    hoverDebug   = null;
    hoverDraft   = null;
    hoverCell    = null;

    if (phase === 'draft' && draftStage === 'choose')
    {
        for (const rect of getDraftCardRects())
            if (rectContains(rect, mousePosScreen))
                hoverDraft = rect.index;
        return;
    }

    if (phase === 'menu')
    {
        if (mousePosScreen.y > MENU_TOP - 10 && mousePosScreen.y < mainCanvasSize.y - MENU_BOTTOM + 10)
            for (const rect of getMapCardRects())
                if (rectContains(rect, mousePosScreen))
                    hoverMapCard = rect.index;
        return;
    }

    for (const rect of getToolbarRects())
        if (rectContains(rect, mousePosScreen))
            hoverButton = rect.key;
    for (const rect of getToolbarTabRects())
        if (rectContains(rect, mousePosScreen))
            hoverTab = rect.key;
    for (const rect of getUpgradeRects())
        if (rectContains(rect, mousePosScreen))
            hoverUpgrade = rect.key;
    for (const rect of getDebugButtonRects())
        if (rectContains(rect, mousePosScreen))
            hoverDebug = rect.key;
    const onToolbar = hoverButton || hoverTab || hoverUpgrade || hoverDebug;

    // the card overlays the board, so it and its buttons win over the square beneath
    const card = getSelectedCardRect();
    hoverCard  = !!card && rectContains(card, mousePosScreen);
    for (const rect of getTowerActionRects())
        if (rectContains(rect, mousePosScreen))
            hoverAction = rect.key;

    hoverCell = (onToolbar || hoverCard) ? null : worldPosToCell(mousePos);
}

// Returns true if a screen-space widget swallowed the click.
function uiHandleClick()
{
    // a click on the card body is not a click on the board under it
    if (hoverCard && !hoverAction)
        return true;

    if (hoverAction && selectedTower)
    {
        playUiClick();
        const {enabled, owned} = towerActionState(hoverAction, selectedTower);
        if (!enabled && hoverAction !== 'move')
        {
            if (!owned)
                soundDeny.play();
        }
        else if (hoverAction === 'upgrade')
            upgradeTower(selectedTower);
        else if (PERKS[hoverAction])
            buyPerk(selectedTower, hoverAction);
        else if (hoverAction === 'move')
            toggleMoveMode();
        else
            sellSelectedTower();
        return true;
    }

    if (hoverDebug)
    {
        playUiClick();
        DEBUG_BUTTONS[hoverDebug].action();
        return true;
    }

    if (hoverTab)
    {
        playUiClick();
        setToolbarTab(hoverTab);
        return true;
    }

    if (hoverUpgrade)
    {
        playUiClick();
        buyLaneUpgrade(hoverUpgrade);
        return true;
    }

    if (!hoverButton)
        return false;
    playUiClick();
    selectedBuild = selectedBuild === hoverButton ? null : hoverButton;
    selectedTower = null;
    moveMode      = false;
    return true;
}

///////////////////////////////////////////////////////////////////////////////
// WORLD-SPACE OVERLAYS

// On a normal board a drafted piece placed on the creep route is the same bet as
// a bought one — amber, with the lane bonus shown. On a draft board every square
// is a route square, so the color would say nothing and stays plain.
function draftLaneRisk(row, col)
{
    return !isDraftMap() && isPathCell(row, col);
}

// A drafted piece waiting for a square: every square it may take is lit, and
// the one under the mouse previews its range. Once the board is full the lit
// squares are the pieces to replace, in amber.
function renderDraftPlacement()
{
    const kindColor = {place: GHOST_OK, push: MOVE_COLOR, replace: LANE_RISK_COLOR};
    for (const cell of buildCells())
    {
        const kind = draftPlacementKind(cell.row, cell.col);
        if (!kind)
            continue;
        const cellPos = getCellWorldPos(cell.row, cell.col);
        drawRect(cellPos, vec2(CELL_SIZE * .9), draftLaneRisk(cell.row, cell.col) ? LANE_RISK_COLOR : kindColor[kind]);
        // the arrow is text, so it stays readable over the red lane pulse on the piece
        if (kind === 'push')
            drawText('▲', cellPos.add(vec2(0, CELL_SIZE * .33)), CELL_SIZE * .32,
                SLOW_COLOR, CELL_SIZE * .05, PIECE_OUTLINE);
    }

    if (!hoverCell || !pendingPiece)
        return;
    const {row, col} = hoverCell;
    const pos        = getCellWorldPos(row, col);
    const kind       = draftPlacementKind(row, col);
    if (!kind)
        return;

    const rays = previewRays(row, col, pendingPiece.type);
    renderRangeOverlay(rays, RANGE_COLOR);
    drawText(coverageLabel(rays), pos.add(vec2(0, CELL_SIZE * .66)), CELL_SIZE * .3,
        HUD_COLOR, CELL_SIZE * .05, PIECE_OUTLINE);
    drawRect(pos, vec2(CELL_SIZE), kind === 'replace' ? DANGER_COLOR
        : draftLaneRisk(row, col) ? LANE_RISK_COLOR : GHOST_OK);
    drawText(TOWER_TYPES[pendingPiece.type].glyph, pos, CELL_SIZE * .82,
        hsl(0, 0, 1, .7), CELL_SIZE * .05, hsl(0, 0, 0, .5));
    if (draftLaneRisk(row, col))
        drawText(laneMultLabel(), pos.add(vec2(CELL_SIZE * .3, CELL_SIZE * .3)),
            CELL_SIZE * .3, LANE_DAMAGE_COLOR, CELL_SIZE * .05, PIECE_OUTLINE);

    // a push shows where the piece already here will step to
    if (kind === 'push')
    {
        const ahead = getCellWorldPos(row - 1, col);
        drawRect(ahead, vec2(CELL_SIZE), MOVE_COLOR);
        drawText(towerAt(row, col).def.glyph, ahead, CELL_SIZE * .82,
            hsl(0, 0, 1, .6), CELL_SIZE * .05, hsl(0, 0, 0, .5));
    }
}

function renderHoverOverlays()
{
    if (phase === 'draft')
    {
        if (draftStage === 'place')
            renderDraftPlacement();
        return;
    }

    // an existing selection always shows its coverage
    if (selectedTower)
    {
        // in move mode the destinations replace the range overlay — they are
        // the same squares, and two colors stacked on them reads as mud
        if (moveMode)
            renderMoveDestinations(selectedTower);
        else
            renderRangeOverlay(selectedTower.rays, RANGE_COLOR);

        drawRect(getCellWorldPos(selectedTower.row, selectedTower.col),
            vec2(CELL_SIZE), hsl(.13, .9, .6, .3));
    }

    if (!hoverCell)
        return;

    const {row, col} = hoverCell;

    if (moveMode && selectedTower)
    {
        const ok = canMoveTo(selectedTower, row, col);
        drawRect(getCellWorldPos(row, col), vec2(CELL_SIZE), ok ? GHOST_OK : GHOST_BAD);
        if (ok)
            drawText(selectedTower.def.glyph, getCellWorldPos(row, col), CELL_SIZE * .82,
                hsl(0, 0, 1, .6), CELL_SIZE * .05, hsl(0, 0, 0, .5));
        return;
    }

    if (selectedBuild)
    {
        const buildable = canBuildAt(row, col);
        const ok        = buildable && gold >= TOWER_TYPES[selectedBuild].cost;
        const pos       = getCellWorldPos(row, col);

        if (buildable)
        {
            const rays = previewRays(row, col, selectedBuild);
            renderRangeOverlay(rays, RANGE_COLOR);
            // the light/dark split of the creep-route squares this cell would
            // cover, shown before you pay — 0/0 means it shoots nothing at all
            drawText(coverageLabel(rays), pos.add(vec2(0, CELL_SIZE * .66)), CELL_SIZE * .3,
                HUD_COLOR, CELL_SIZE * .05, PIECE_OUTLINE);
        }

        // route squares get the same amber as risky move targets, plus a ×2
        // badge so the square reads as an offer rather than a refusal
        const onPath = isPathCell(row, col);
        drawRect(pos, vec2(CELL_SIZE), !ok ? GHOST_BAD : onPath ? LANE_RISK_COLOR : GHOST_OK);
        if (ok)
            drawText(TOWER_TYPES[selectedBuild].glyph, pos, CELL_SIZE * .82,
                hsl(0, 0, 1, .6), CELL_SIZE * .05, hsl(0, 0, 0, .5));
        if (ok && onPath)
            drawText(laneMultLabel(), pos.add(vec2(CELL_SIZE * .3, CELL_SIZE * .3)),
                CELL_SIZE * .3, LANE_DAMAGE_COLOR, CELL_SIZE * .05, PIECE_OUTLINE);
        return;
    }

    // no build selected: peek at whatever tower is under the cursor
    const tower = towerAt(row, col);
    if (tower && tower !== selectedTower)
        renderRangeOverlay(tower.rays, hsl(.55, .8, .6, .18));
}

function renderMoveDestinations(tower)
{
    for (const cell of moveDestinations(tower))
    {
        const onPath = isPathCell(cell.row, cell.col);
        drawRect(getCellWorldPos(cell.row, cell.col), vec2(CELL_SIZE * .86),
            onPath ? LANE_RISK_COLOR : MOVE_COLOR);
        // a skull on route squares: legal, but a creep landing there kills you
        if (onPath)
            drawText('☠', getCellWorldPos(cell.row, cell.col), CELL_SIZE * .5,
                hsl(0, 0, 1, .55), CELL_SIZE * .04, hsl(0, 0, 0, .5));
    }
}

///////////////////////////////////////////////////////////////////////////////
// SCREEN-SPACE HUD

// "◻6 ◼0" — the squares this piece covers, split by color. A bishop reading
// zero on one side is the player seeing why it cannot touch a given ward.
function coverageLabel(rays)
{
    const {light, dark} = coverageByColor(rays);
    return `◻${light} ◼${dark}`;
}

// The stats live on the card now; the HUD line only speaks up while a move is
// being picked, which is exactly when the card is hidden.
function towerHint(tower)
{
    return moveMode
        ? `Moving the ${tower.def.name} — click a blue square, V or Esc when done. Amber is the creep route: ${laneMultLabel()} damage, but a creep there kills it (and is slowed).`
        : '';
}

// Names the warded types in play and the only color each ever stands on, in the
// same symbols as the coverage readout above — so "◻6 ◼0" on a bishop and
// "Obsidian only stands on ◼" add up to "that bishop is useless here".
function wardLegend()
{
    const defs = activeWardDefs();
    if (!defs.length)
        return '';
    return defs.map(def =>
        `${def.name} only stands on ${def.ward === 'light' ? '◻' : '◼'} (untouchable mid-jump)`).join('   ');
}

function renderHud()
{
    const pad = 18;
    const y   = 30;

    drawRect(vec2(mainCanvasSize.x / 2, HUD_HEIGHT / 2), vec2(mainCanvasSize.x, HUD_HEIGHT),
        hsl(0, 0, 0, .55), 0, undefined, true);

    drawTextScreen(`WAVE ${wave}`, vec2(pad, y), 26, HUD_COLOR, 4, BLACK, 'left');
    if (isDraftMap())
        drawTextScreen(`♟ ${towers.length}/${buildCells().length}`, vec2(pad, y + 30), 24, hsl(.13, .9, .65), 4, BLACK, 'left');
    else
        drawTextScreen(infiniteGold ? '♛ ∞' : `♛ ${gold}`, vec2(pad, y + 30), 24, hsl(.13, .9, .65), 4, BLACK, 'left');

    const hpColor = baseHp > START_BASE_HP * .35 ? hsl(.33, .7, .6) : hsl(0, .8, .6);
    drawTextScreen(`♚ ${Math.max(0, baseHp)}`, vec2(mainCanvasSize.x - pad, y), 26, hpColor, 4, BLACK, 'right');

    const best  = bestWaves[currentMap];
    const label = best > 0 ? `${mapDef().name}  —  BEST ${best}` : mapDef().name;
    drawTextScreen(label, vec2(mainCanvasSize.x - pad, y + 30), 18, hsl(0, 0, .7), 4, BLACK, 'right');

    let banner;
    if (phase === 'draft')
        banner = draftStage === 'choose'
            ? (wave === 1 ? 'DRAFT YOUR FIRST PIECES' : `WAVE ${wave - 1} CLEARED`)
              + (draftPicksLeft > 1 ? `  —  ${draftPicksLeft} picks left` : '')
            : `PLACE YOUR ${TOWER_TYPES[pendingPiece.type].name} (${SIGNATURES[pendingPiece.signature].name})`;
    else if (phase === 'prep')
        banner = isDraftMap()
            ? `NEXT WAVE IN ${Math.ceil(prepTimer)}s  —  SPACE to send early`
            : `NEXT WAVE IN ${Math.ceil(prepTimer)}s  —  SPACE to send early (+${Math.floor(prepTimer * EARLY_BONUS)}♛)`;
    else
        banner = `${enemies.length + spawnQueue.length} LEFT`;
    drawTextScreen(banner, vec2(mainCanvasSize.x / 2, y), 22, HUD_COLOR, 4, BLACK);

    // the ward legend only earns its row while warded creeps are actually in
    // play; otherwise the row stays empty rather than showing dead text
    const legend = wardLegend();
    if (legend)
        drawTextScreen(legend, vec2(mainCanvasSize.x / 2, 86), 17, hsl(0, 0, .8), 4, BLACK,
            'center', fontDefault, '', Math.max(200, mainCanvasSize.x - 440));

    // Build-selection piece blurbs are omitted — the ghost + toolbar already say
    // enough. Keep hints for a selected tower and the idle how-to line.
    const draftHint = phase === 'draft'
        ? (draftStage === 'choose'
            ? 'Click a card or press 1-3 to take that piece'
            : !isDraftMap()
                ? `Click any open square — amber ones are on the creep route (${laneMultLabel()} damage, but a creep there kills it)`
            : draftBoardFull()
                ? 'Your board is full — click one of your pieces to replace it'
                : 'Click an open square — or a blue back-row piece, to push it one square forward')
        : isDraftMap() && !selectedTower
            ? 'Click a piece to see its signature or move it  —  M for boards'
            : '';
    const hint = phase === 'draft' || (isDraftMap() && !selectedTower) ? draftHint
               : hoverUpgrade ? laneUpgradeHint(hoverUpgrade)
               : selectedTower ? towerHint(selectedTower)
               : selectedBuild && hoverCell && isPathCell(hoverCell.row, hoverCell.col)
                 ? `Building on the creep route: ${laneMultLabel()} damage, but a creep that reaches it kills it (and is slowed).`
               : selectedBuild ? ''
               : toolbarTab === 'upgrades' ? 'Army-wide upgrades for every piece standing on the creep route  —  TAB for pieces'
               : 'Pick a piece below (1-5) to build  —  click a piece to upgrade, move or delete it  —  TAB for lane upgrades  —  M for boards';

    if (hint)
    {
        // the centered hint shares its row with the wave/best labels on both sides,
        // so cap its width instead of letting a long one run underneath them
        drawTextScreen(hint, vec2(mainCanvasSize.x / 2, y + 28), 18, hsl(0, 0, .75), 4, BLACK,
            'center', fontDefault, '', Math.max(200, mainCanvasSize.x - 440));
    }
}

// Card rects go to the 2D canvas (useWebGL false) so they stack in draw order
// with the piece glyphs, which are text: a WebGL rect would sit under every
// glyph on the board and let the pieces behind the card show through it.
function drawCardRect(center, size, color, angle=0)
{
    drawRect(center, size, color, angle, false, true);
}

// Name and level pips on top, damage and level under it; a selected piece's card also has HP, perks and its
// action row below (drawn by renderTowerActions). The pointer is a diamond half
// tucked under the card edge, aimed at the piece.
function renderTowerCard(tower, card, preview)
{
    const edge = preview ? hsl(0, 0, .38) : hsl(0, 0, .62);
    const bg   = preview ? hsl(0, 0, .13) : hsl(0, 0, .1);

    const pointerX = clamp(card.anchorX, card.x + 18, card.x + card.width - 18);
    const pointerY = card.below ? card.y : card.y + card.height;
    const pointer  = vec2(pointerX, pointerY);
    const diamond  = CARD_POINTER * 1.41;
    drawCardRect(pointer, vec2(diamond), edge, PI / 4);
    drawCardRect(vec2(card.x + card.width / 2, card.y + card.height / 2), vec2(card.width, card.height), edge);
    drawCardRect(vec2(card.x + card.width / 2, card.y + card.height / 2), vec2(card.width - 4, card.height - 4), bg);
    drawCardRect(pointer, vec2(diamond - 5.5), bg, PI / 4);

    const left  = card.x + CARD_PAD;
    const right = card.x + card.width - CARD_PAD;
    const row1  = card.y + CARD_PAD + 15;
    const row2  = card.y + CARD_PAD + 44;

    drawTextScreen(tower.def.glyph, vec2(left + 13, row1), 28, PIECE_COLOR, 3, BLACK);
    drawTextScreen(tower.def.name, vec2(left + 32, row1 + 1), 19, HUD_COLOR, 3, BLACK, 'left');

    const gold   = hsl(.13, .9, .65);
    const maxed  = tower.level >= MAX_LEVEL;
    const pips   = '●'.repeat(tower.level) + '○'.repeat(MAX_LEVEL - tower.level);
    const sig    = tower.signature && SIGNATURES[tower.signature];
    // levels do not exist on a draft board: the signature takes their place
    if (isDraftMap())
    {
        if (sig)
            drawTextScreen(`${sig.icon} ${sig.name}`, vec2(right, row1 + 1), 17, sig.color, 3, BLACK, 'right');
    }
    else
        drawTextScreen(pips, vec2(right, row1 + 1), 17, gold, 2, BLACK, 'right');

    drawTextScreen('DAMAGE', vec2(left + 2, row2), 15, hsl(0, 0, .6), 3, BLACK, 'left');
    const onLane = isPathCell(tower.row, tower.col);
    drawTextScreen(`${Math.round(towerDamage(tower))}`, vec2(left + 74, row2), 19,
        onLane ? LANE_DAMAGE_COLOR : HUD_COLOR, 3, BLACK, 'left');
    if (onLane)
        drawTextScreen(laneMultLabel(), vec2(left + 118, row2), 15, LANE_DAMAGE_COLOR, 3, BLACK, 'left');
    if (!isDraftMap())
        drawTextScreen(maxed ? 'MAX LEVEL' : `LEVEL ${tower.level}`, vec2(right, row2), 16,
            maxed ? gold : HUD_COLOR, 3, BLACK, 'right');

    // a hover card keeps it short: just the perk icons, beside the name; the
    // selected card adds HP and spells each perk out, with its icon in front
    if (preview)
    {
        if (!isDraftMap())
            renderCardPerks(tower, left + 38 + textWidthScreen(tower.def.name, 19), row1 + 1, false);
        if (cardShowsSignature(tower))
            drawTextScreen(`${sig.icon} ${sig.name}`, vec2(left + 2, row2 + 25), 14, sig.color, 3, BLACK, 'left');
        return;
    }

    // colored like the board bar, so a hurt piece reads the same in both places
    const row3 = row2 + CARD_HP_H;
    const fill = clamp(tower.hp / tower.maxHp);
    drawTextScreen('HP', vec2(left + 2, row3), 15, hsl(0, 0, .6), 3, BLACK, 'left');
    drawTextScreen(`${Math.ceil(tower.hp)}/${tower.maxHp}`, vec2(left + 74, row3), 19,
        fill < 1 ? hsl(lerp(0, .33, fill), .8, .6) : HUD_COLOR, 3, BLACK, 'left');
    if (!isDraftMap())
    {
        const perkRows = ownedPerkKeys(tower).length;
        renderCardPerks(tower, left + 2, row3 + 25, true);
        if (cardShowsSignature(tower))
            drawTextScreen(`${sig.icon} ${sig.name}: ${sig.text.toLowerCase()}`,
                vec2(left + 2, row3 + 25 + (perkRows ? CARD_PERK_H : 0)), 13, sig.color, 3, BLACK, 'left');
        return;
    }
    if (sig)
        wrapTextScreen(sig.text, 13, card.width - CARD_PAD * 2 - 4).slice(0, 2).forEach((line, i) =>
            drawTextScreen(line, vec2(left + 2, row3 + 25 + i * 16), 13, sig.color, 3, BLACK, 'left'));
}

// Owned perks in a row from `x`, each as its board icon followed by either
// its full card text or, when short, just the tier from II on.
function renderCardPerks(tower, x, y, full)
{
    const gold = hsl(.13, .9, .65);
    const s    = 7;
    for (const key of ownedPerkKeys(tower))
    {
        drawPerkIcon(key, vec2(x + s, y), s, true);
        x += s * 2.4;

        const tier = perkTier(tower, key);
        const text = full ? perkCardText(tower, key) : tier >= 2 ? `${tier}` : '';
        const size = full ? 13 : 12;
        const color = full ? gold : PERK_BADGES[key].color;
        if (text)
        {
            drawTextScreen(text, vec2(x, y), size, color, 3, BLACK, 'left');
            x += textWidthScreen(text, size);
        }
        x += full ? 18 : 8;
    }
}

// Pixel width of a line drawn with drawTextScreen at `size`.
function textWidthScreen(text, size)
{
    drawContext.save();
    drawContext.font = ' ' + size + 'px ' + fontDefault;
    const width = drawContext.measureText(text).width;
    drawContext.restore();
    return width;
}

function renderTowerCards()
{
    const card = getSelectedCardRect();
    if (card)
        renderTowerCard(selectedTower, card, false);
    renderTowerActions();

    // on top: the mouse is on that piece, so it is what the player is asking
    // about, and moving onto the selected card clears the hover anyway
    const hovered = getHoverCardTower();
    if (hovered)
        renderTowerCard(hovered, getTowerCardRect(hovered, false), true);
}

function renderTowerActions()
{
    for (const rect of getTowerActionRects())
    {
        const state   = towerActionState(rect.key, selectedTower);
        const hovered = hoverAction === rect.key;
        const center  = vec2(rect.x + rect.width / 2, rect.y + rect.height / 2);

        const bg = state.active           ? hsl(.55, .5, .3)
                 : hovered && state.enabled ? hsl(0, 0, .3)
                 : hsl(0, 0, .14);
        const edge = state.active  ? hsl(.55, .9, .65)
                   : state.owned   ? hsl(.13, .9, .55)
                   : !state.enabled ? hsl(0, 0, .28)
                   : rect.key === 'sell' ? hsl(.02, .7, .5)
                   : hsl(0, 0, .45);

        drawCardRect(center, vec2(rect.width, rect.height), edge);
        drawCardRect(center, vec2(rect.width - 3, rect.height - 3), bg);
        drawTextScreen(state.label, vec2(center.x, center.y + 1), 14,
            state.owned ? hsl(.13, .9, .65) : state.enabled ? HUD_COLOR : hsl(0, 0, .45), 3, BLACK,
            'center', fontDefault, '', rect.width - 8);
    }
}

// The full story of a path for the HUD line while its button is hovered.
function laneUpgradeHint(key)
{
    const blurb = {
        fury:  'Every piece on the creep route hits harder.',
        tempo: 'Every piece on the creep route shoots faster.',
        stand: 'When a creep tramples a lane piece: its killer stays slowed longer, then the piece goes off like a landmine.',
    }[key];
    const next = nextLaneTier(key);
    return `${LANE_UPGRADES[key].name}: ${blurb}  —  ${next ? `next: ${next.text}` : 'fully upgraded'}`;
}

// A toolbar button's frame: outer edge, inner border, fill.
function drawToolbarFrame(rect, bg, border)
{
    const center = vec2(rect.x + rect.width / 2, rect.y + rect.height / 2);
    drawRect(center, vec2(rect.width, rect.height), bg, 0, undefined, true);
    drawRect(center, vec2(rect.width - 3, rect.height - 3), border, 0, undefined, true);
    drawRect(center, vec2(rect.width - 6, rect.height - 6), bg, 0, undefined, true);
    return center;
}

function renderToolbarTabs()
{
    for (const rect of getToolbarTabRects())
    {
        const active  = toolbarTab === rect.key;
        const hovered = hoverTab === rect.key;
        const bg      = active ? hsl(.33, .5, .3) : hovered ? hsl(0, 0, .28) : hsl(0, 0, .16);
        const center  = drawToolbarFrame(rect, bg, active ? hsl(.33, .8, .55) : hsl(0, 0, .35));
        drawTextScreen(rect.key.toUpperCase(), vec2(center.x, center.y + 1), 15,
            active ? HUD_COLOR : hsl(0, 0, .6), 3, BLACK);
    }
}

function renderUpgradeButtons()
{
    for (const rect of getUpgradeRects())
    {
        const path    = LANE_UPGRADES[rect.key];
        const next    = nextLaneTier(rect.key);
        const owned   = laneTiers[rect.key];
        const canBuy  = next && gold >= next.cost;
        const hovered = hoverUpgrade === rect.key;
        const bg      = hovered && canBuy ? hsl(0, 0, .28) : hsl(0, 0, .16);
        const center  = drawToolbarFrame(rect, bg, next ? (canBuy ? path.color : hsl(0, 0, .35)) : hsl(.13, .9, .55));
        const fg      = canBuy || !next ? HUD_COLOR : hsl(0, 0, .5);
        const pips    = '●'.repeat(owned) + '○'.repeat(path.tiers.length - owned);

        drawTextScreen(path.name, vec2(center.x, rect.y + 18), 16, path.color, 3, BLACK);
        drawTextScreen(pips, vec2(center.x, rect.y + 36), 14, hsl(.13, .9, .65), 2, BLACK);
        drawTextScreen(next ? next.text : laneTier(rect.key).text, vec2(center.x, rect.y + 54), 13, fg, 3, BLACK,
            'center', fontDefault, '', rect.width - 10);
        drawTextScreen(next ? `${next.cost}♛` : 'MAXED', vec2(center.x, rect.y + 71), 16,
            !next ? hsl(.13, .9, .65) : canBuy ? hsl(.13, .9, .65) : hsl(0, .6, .5), 3, BLACK);
    }
}

function renderToolbar()
{
    drawRect(vec2(mainCanvasSize.x / 2, mainCanvasSize.y - TOOLBAR_HEIGHT / 2),
        vec2(mainCanvasSize.x, TOOLBAR_HEIGHT), hsl(0, 0, 0, .55), 0, undefined, true);

    // no shop on a draft board: the bar lists the army instead
    if (isDraftMap())
    {
        renderDraftRoster();
        return;
    }

    renderToolbarTabs();
    renderUpgradeButtons();

    const rects = getToolbarRects();
    for (let i = 0; i < rects.length; ++i)
    {
        const rect       = rects[i];
        const def        = TOWER_TYPES[rect.key];
        const affordable = gold >= def.cost;
        const active     = selectedBuild === rect.key;
        const hovered    = hoverButton === rect.key;
        const center     = vec2(rect.x + rect.width / 2, rect.y + rect.height / 2);

        const bg = active   ? hsl(.33, .5, .3)
                 : hovered  ? hsl(0, 0, .28)
                 : hsl(0, 0, .16);
        drawRect(center, vec2(rect.width, rect.height), bg, 0, undefined, true);
        drawRect(center, vec2(rect.width - 3, rect.height - 3),
            active ? hsl(.33, .8, .55) : hsl(0, 0, .35), 0, undefined, true);
        drawRect(center, vec2(rect.width - 6, rect.height - 6), bg, 0, undefined, true);

        const fg = affordable ? HUD_COLOR : hsl(0, 0, .42);
        drawTextScreen(def.glyph, vec2(center.x, rect.y + 34), 36, fg, 3, BLACK);
        drawTextScreen(def.name, vec2(center.x, rect.y + 54), 15, fg, 3, BLACK);
        drawTextScreen(`${def.cost}♛`, vec2(center.x, rect.y + 72), 17,
            affordable ? hsl(.13, .9, .65) : hsl(0, .6, .5), 3, BLACK);
        drawTextScreen(`${i + 1}`, vec2(rect.x + 10, rect.y + 16), 14, hsl(0, 0, .55), 3, BLACK, 'left');
    }
}

///////////////////////////////////////////////////////////////////////////////
// DRAFT

function getDraftCardRects()
{
    const count  = draftOffers.length;
    const width  = Math.min(DRAFT_CARD_W, (mainCanvasSize.x - 48 - DRAFT_CARD_GAP * (count - 1)) / count);
    const totalW = width * count + DRAFT_CARD_GAP * (count - 1);
    const top    = Math.max(HUD_HEIGHT + 60, (mainCanvasSize.y - DRAFT_CARD_H) / 2 + 20);
    return draftOffers.map((offer, index) => ({
        index, offer, width, height: DRAFT_CARD_H, y: top,
        x: (mainCanvasSize.x - totalW) / 2 + index * (width + DRAFT_CARD_GAP),
    }));
}

// The pick: three cards over a dimmed board, each a piece, its rarity, and the
// one signature it carries.
function renderDraftCards()
{
    drawRect(vec2(mainCanvasSize.x / 2, mainCanvasSize.y / 2), mainCanvasSize,
        hsl(0, 0, 0, .6), 0, undefined, true);

    const cx = mainCanvasSize.x / 2;
    const top = getDraftCardRects()[0]?.y ?? 200;
    drawTextScreen('CHOOSE A PIECE', vec2(cx, top - 30), 34, HUD_COLOR, 5, BLACK);

    for (const rect of getDraftCardRects())
    {
        const {offer}   = rect;
        const def       = TOWER_TYPES[offer.type];
        const sig       = SIGNATURES[offer.signature];
        const rarity    = DRAFT_RARITY[offer.type];
        const hovered   = hoverDraft === rect.index;
        const center    = vec2(rect.x + rect.width / 2, rect.y + rect.height / 2);
        const mid       = rect.x + rect.width / 2;

        drawRect(center, vec2(rect.width, rect.height), hovered ? rarity.color : hsl(0, 0, .4), 0, undefined, true);
        drawRect(center, vec2(rect.width - 5, rect.height - 5), hovered ? hsl(0, 0, .17) : hsl(0, 0, .11), 0, undefined, true);

        drawTextScreen(`${rect.index + 1}`, vec2(rect.x + 16, rect.y + 22), 16, hsl(0, 0, .55), 3, BLACK, 'left');
        drawTextScreen(rarity.label, vec2(mid, rect.y + 24), 14, rarity.color, 3, BLACK);
        drawTextScreen(def.glyph, vec2(mid, rect.y + 90), 76, PIECE_COLOR, 5, BLACK);
        drawTextScreen(def.name, vec2(mid, rect.y + 130), 24, HUD_COLOR, 4, BLACK);

        drawTextScreen(`${sig.icon} ${sig.name}`, vec2(mid, rect.y + 170), 22, sig.color, 4, BLACK);
        wrapTextScreen(sig.text, 15, rect.width - 36).slice(0, 4).forEach((line, i) =>
            drawTextScreen(line, vec2(mid, rect.y + 198 + i * 19), 15, hsl(0, 0, .82), 3, BLACK));

        drawTextScreen(`DMG ${def.damage}   HP ${def.hp}   RATE ${(1 / def.rate).toFixed(1)}/s`,
            vec2(mid, rect.y + rect.height - 52), 13, hsl(0, 0, .6), 3, BLACK);
        wrapTextScreen(def.hint, 12, rect.width - 28).slice(0, 2).forEach((line, i) =>
            drawTextScreen(line, vec2(mid, rect.y + rect.height - 32 + i * 14), 12, hsl(0, 0, .5), 2, BLACK));
    }
}

// The bottom bar on a draft board: one slot per build square, filled left to
// right with the army, each showing the piece and its signature.
function renderDraftRoster()
{
    const slots  = buildCells().length;
    const gap    = 8;
    const width  = Math.min(84, (mainCanvasSize.x - BUTTON_MARGIN * 2 - gap * (slots - 1)) / slots);
    const height = TOOLBAR_HEIGHT - BUTTON_MARGIN * 2;
    const startX = (mainCanvasSize.x - (width * slots + gap * (slots - 1))) / 2;
    const y      = mainCanvasSize.y - TOOLBAR_HEIGHT + BUTTON_MARGIN;

    for (let i = 0; i < slots; ++i)
    {
        const rect   = {x: startX + i * (width + gap), y, width, height};
        const tower  = towers[i];
        const center = drawToolbarFrame(rect, hsl(0, 0, .13), tower ? hsl(0, 0, .4) : hsl(0, 0, .2));
        if (!tower)
            continue;
        const sig = tower.signature && SIGNATURES[tower.signature];
        drawTextScreen(tower.def.glyph, vec2(center.x, rect.y + 34), 36, PIECE_COLOR, 3, BLACK);
        if (sig)
            drawTextScreen(sig.name, vec2(center.x, rect.y + 62), 12, sig.color, 3, BLACK,
                'center', fontDefault, '', width - 6);
        const fill = clamp(tower.hp / tower.maxHp);
        drawRect(vec2(center.x, rect.y + height - 12), vec2((width - 14) * fill, 5),
            hsl(lerp(0, .33, fill), .8, .55), 0, undefined, true);
    }
}

///////////////////////////////////////////////////////////////////////////////
// LEVEL SELECT

// Cell tags for the card thumbnails: 0 empty, 1 route, 2 spawn, 3 King.
const mapPreviewCache = [];

function mapPreviewCells(index)
{
    if (mapPreviewCache[index])
        return mapPreviewCache[index];

    const map  = MAPS[index];
    const grid = [];
    for (let row = 0; row < map.gridH; ++row)
        grid[row] = new Array(map.gridW).fill(0);

    for (const waypoints of map.paths)
    {
        const cells = buildPath(waypoints);
        for (const cell of cells)
            grid[cell.row][cell.col] = 1;
        grid[cells[0].row][cells[0].col] = 2;
    }
    for (const [row, col] of map.blocked ?? [])
        grid[row][col] = 4;
    for (const [row, col] of map.walls ?? [])
        grid[row][col] = 5;
    for (const [row, col] of mapBases(map))
        grid[row][col] = 3;

    return mapPreviewCache[index] = grid;
}

function renderMapThumb(index, left, top, boxSize)
{
    const map    = MAPS[index];
    const grid   = mapPreviewCells(index);
    const cell   = boxSize / Math.max(map.gridW, map.gridH);
    const originX = left + (boxSize - cell * map.gridW) / 2;
    const originY = top  + (boxSize - cell * map.gridH) / 2;

    for (let row = 0; row < map.gridH; ++row)
    for (let col = 0; col < map.gridW; ++col)
    {
        const tag     = grid[row][col];
        const isLight = (row + col) % 2 === 0;
        const color   = tag === 5 ? WALL_COLOR
                      : tag === 4 ? UNUSABLE_COLOR
                      : tag === 3 ? BASE_COLOR
                      : tag === 2 ? hsl(0, .7, .6)
                      : tag === 1 ? (isLight ? PATH_LIGHT : PATH_DARK)
                                  : (isLight ? LIGHT_SQUARE : DARK_SQUARE);
        drawRect(vec2(originX + (col + .5) * cell, originY + (row + .5) * cell),
            vec2(cell - 1), color, 0, undefined, true);
    }
}

function renderLevelSelect()
{
    const cx = mainCanvasSize.x / 2;
    drawRect(vec2(cx, mainCanvasSize.y / 2), mainCanvasSize, hsl(.62, .25, .09), 0, undefined, true);

    if (!MAPS.length)
        drawTextScreen(`No boards found — add ${LEVEL_DIR}${levelFileName(1)} (make one with editor.html)`,
            vec2(cx, mainCanvasSize.y / 2), 20, hsl(0, .7, .65), 4, BLACK);

    for (const rect of getMapCardRects())
    {
        const hovered = hoverMapCard === rect.index;
        const center  = vec2(rect.x + rect.width / 2, rect.y + rect.height / 2);
        const best    = bestWaves[rect.index];

        drawRect(center, vec2(rect.width, rect.height),
            hovered ? hsl(.33, .8, .55) : hsl(0, 0, .35), 0, undefined, true);
        drawRect(center, vec2(rect.width - 4, rect.height - 4),
            hovered ? hsl(.33, .35, .22) : hsl(0, 0, .14), 0, undefined, true);

        const thumb = rect.height - 28;
        renderMapThumb(rect.index, rect.x + 16, rect.y + 14, thumb);

        const textX = rect.x + 16 + thumb + 18;
        drawTextScreen(rect.map.name, vec2(textX, rect.y + 36), 26, HUD_COLOR, 4, BLACK, 'left',
            undefined, '', rect.width - (textX - rect.x) - 40);
        drawTextScreen(`${rect.map.paths.length} spawn${rect.map.paths.length === 1 ? '' : 's'}  —  ${rect.map.gridW}x${rect.map.gridH}`,
            vec2(textX, rect.y + 62), 17, hsl(.13, .9, .65), 3, BLACK, 'left');
        drawTextScreen(rect.map.blurb, vec2(textX, rect.y + 86), 16, hsl(0, 0, .72), 3, BLACK, 'left',
            undefined, '', rect.width - (textX - rect.x) - 16);
        drawTextScreen(best > 0 ? `Best: wave ${best}` : 'Not yet played',
            vec2(textX, rect.y + 110), 16, hsl(0, 0, .55), 3, BLACK, 'left');

        drawTextScreen(`${rect.index + 1}`, vec2(rect.x + rect.width - 16, rect.y + 30),
            18, hsl(0, 0, .5), 3, BLACK, 'right');
    }

    // header and footer sit over the cards, so a scrolled list slides under them.
    // Drawn on the 2D canvas (useWebGL false) because the card text lives there:
    // a WebGL rect would sit under that text and let it show through.
    const bg = hsl(.62, .25, .09);
    drawRect(vec2(cx, (MENU_TOP - 10) / 2), vec2(mainCanvasSize.x, MENU_TOP - 10), bg, 0, false, true);
    drawRect(vec2(cx, mainCanvasSize.y - MENU_BOTTOM / 2 + 5), vec2(mainCanvasSize.x, MENU_BOTTOM + 10), bg, 0, false, true);
    drawTextScreen('GAMBIT DEFENSE', vec2(cx, 76), 54, HUD_COLOR, 6, BLACK);
    drawTextScreen('Choose a board', vec2(cx, 112), 22, hsl(0, 0, .7), 4, BLACK);
    drawTextScreen(menuLayout().maxScroll > 0 ? 'Click a board, or press its number  —  scroll for more'
                                              : 'Click a board, or press its number',
        vec2(cx, mainCanvasSize.y - 28), 18, hsl(0, 0, .65), 4, BLACK);
}

function renderGameOver()
{
    drawRect(vec2(mainCanvasSize.x / 2, mainCanvasSize.y / 2), mainCanvasSize, hsl(0, 0, 0, .72), 0, undefined, true);
    const cx = mainCanvasSize.x / 2, cy = mainCanvasSize.y / 2;
    drawTextScreen('CHECKMATE', vec2(cx, cy - 60), 64, hsl(0, .8, .6), 6, BLACK);
    drawTextScreen(`You held ${wave - 1} wave${wave - 1 === 1 ? '' : 's'} on ${mapDef().name}`,
        vec2(cx, cy + 4), 30, HUD_COLOR, 5, BLACK);
    if (bestWaves[currentMap] > 0)
        drawTextScreen(`Best: ${bestWaves[currentMap]}`, vec2(cx, cy + 42), 24, hsl(.13, .9, .65), 4, BLACK);
    drawTextScreen('R to play again  —  M for boards', vec2(cx, cy + 92), 24, hsl(0, 0, .8), 4, BLACK);
}
