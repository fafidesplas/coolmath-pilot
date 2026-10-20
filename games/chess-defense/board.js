/*
    Grid math and the creep paths.

    Rows run top to bottom, columns left to right, matching the chess original.
    World space is Y-up so row 0 draws at the top.

    A map holds one or more routes. Everything downstream — enemies, targeting,
    build validation — works off whichever map is currently loaded, so the board
    dimensions are mutable rather than compile-time constants.
*/

'use strict';

///////////////////////////////////////////////////////////////////////////////
// CURRENT MAP

let GRID_W     = 8;         // real sizes come from loadMap
let GRID_H     = 8;
let PATHS      = [];        // array of routes, each an array of {row, col}
let BASE_CELLS = [];        // the King squares; every route ends on one
let currentMap = 0;

let pathLookup    = [];     // pathLookup[row][col] — is this a route cell?
let blockedLookup = [];     // blockedLookup[row][col] — unusable square?
let wallLookup    = [];     // wallLookup[row][col] — wall square?

function loadMap(index)
{
    currentMap = index;
    const map  = MAPS[index];

    GRID_W    = map.gridW;
    GRID_H    = map.gridH;
    PATHS     = map.paths.map(buildPath);
    BASE_CELLS = mapBases(map).map(([row, col]) => ({row, col}));

    pathLookup = [];
    for (let row = 0; row < GRID_H; ++row)
        pathLookup[row] = new Array(GRID_W).fill(false);
    for (const path of PATHS)
        for (const cell of path)
            pathLookup[cell.row][cell.col] = true;

    // unusable squares: no piece may be built on or moved onto them, but
    // shots and sliding moves still pass over them, as they do the King's
    blockedLookup = [];
    for (let row = 0; row < GRID_H; ++row)
        blockedLookup[row] = new Array(GRID_W).fill(false);
    for (const [row, col] of map.blocked ?? [])
        blockedLookup[row][col] = true;

    // walls: unusable too, and they also stop sliding pieces, shots and moves
    // alike (even with Pierce). Knights and pawns step past them.
    wallLookup = [];
    for (let row = 0; row < GRID_H; ++row)
        wallLookup[row] = new Array(GRID_W).fill(false);
    for (const [row, col] of map.walls ?? [])
        wallLookup[row][col] = true;

    for (const path of PATHS)
        for (const cell of path)
            ASSERT(!wallLookup[cell.row][cell.col],
                `${map.name}: wall on the creep route at row ${cell.row}, col ${cell.col}`);
}

function mapDef()
{
    return MAPS[currentMap];
}

// A draft board has no gold: pieces come from a pick-one-of-three after each
// wave (see signatures.js).
function isDraftMap()
{
    return !!MAPS[currentMap]?.draft;
}

///////////////////////////////////////////////////////////////////////////////
// GRID

function isInBounds(row, col)
{
    return row >= 0 && row < GRID_H && col >= 0 && col < GRID_W;
}

// The checkerboard parity, which is real game state and not just decoration:
// it decides which pieces can touch a warded creep. Matches the shading in
// renderBoard so what you reason about is what you see.
function isLightSquare(row, col)
{
    return (row + col) % 2 === 0;
}

function getCellWorldPos(row, col)
{
    const offsetX = -(GRID_W * CELL_SIZE) / 2 + CELL_SIZE / 2;
    const offsetY = -(GRID_H * CELL_SIZE) / 2 + CELL_SIZE / 2;
    return vec2(offsetX + col * CELL_SIZE, offsetY + (GRID_H - 1 - row) * CELL_SIZE);
}

function worldPosToCell(worldPos)
{
    const offsetX = -(GRID_W * CELL_SIZE) / 2;
    const offsetY = -(GRID_H * CELL_SIZE) / 2;
    const col = Math.floor((worldPos.x - offsetX) / CELL_SIZE);
    const row = GRID_H - 1 - Math.floor((worldPos.y - offsetY) / CELL_SIZE);
    return isInBounds(row, col) ? {row, col} : null;
}

///////////////////////////////////////////////////////////////////////////////
// PATHS
// Expand the waypoint corners into the full list of cells the creeps walk.

function buildPath(waypoints)
{
    const cells = [{row: waypoints[0][0], col: waypoints[0][1]}];
    for (let i = 1; i < waypoints.length; ++i)
    {
        const [fromRow, fromCol] = waypoints[i - 1];
        const [toRow,   toCol]   = waypoints[i];
        const dRow = toRow - fromRow;
        const dCol = toCol - fromCol;
        // Step is axis-aligned or a true 45° diagonal — anything else walks
        // off the intended line because both axes advance every tick.
        ASSERT(!dRow || !dCol || Math.abs(dRow) === Math.abs(dCol),
            `path segment not ortho/diag: [${fromRow},${fromCol}] -> [${toRow},${toCol}]`);
        const dr = Math.sign(dRow);
        const dc = Math.sign(dCol);
        let r = fromRow, c = fromCol;
        while (r !== toRow || c !== toCol)
        {
            r += dr; c += dc;
            cells.push({row: r, col: c});
        }
    }
    return cells;
}

function isPathCell(row, col)
{
    return pathLookup[row][col];
}

function isBlockedCell(row, col)
{
    return blockedLookup[row][col];
}

function isWallCell(row, col)
{
    return wallLookup[row][col];
}

function isBaseCell(row, col)
{
    return BASE_CELLS.some(cell => cell.row === row && cell.col === col);
}

// Whether a piece may ever stand here, King and occupants aside. A board with
// `buildRows` only lets pieces stand on those rows.
function isStandableCell(row, col)
{
    const rows = MAPS[currentMap]?.buildRows;
    return !blockedLookup[row][col] && !wallLookup[row][col] && (!rows || rows.includes(row));
}

// Every square a piece could stand on, King squares aside — the draft board's
// slots. The board is "full" when none of these is free.
function buildCells()
{
    const cells = [];
    for (let row = 0; row < GRID_H; ++row)
    for (let col = 0; col < GRID_W; ++col)
        if (isStandableCell(row, col) && !isBaseCell(row, col))
            cells.push({row, col});
    return cells;
}

function pathEnd(path)
{
    return path.length - 1;
}

// Position anywhere along a route, `t` being a float index into it.
function pathPos(path, t)
{
    const end = pathEnd(path);
    const i   = clamp(Math.floor(t), 0, end);
    const a   = getCellWorldPos(path[i].row, path[i].col);
    if (i >= end)
        return a;
    const b = getCellWorldPos(path[i + 1].row, path[i + 1].col);
    return a.lerp(b, t - i);
}

// The cell an enemy currently counts as standing on for targeting purposes.
function pathCell(path, t)
{
    return path[clamp(Math.round(t), 0, pathEnd(path))];
}
