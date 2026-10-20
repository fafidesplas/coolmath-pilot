/*
    Gambit Defense level editor.
    - Opens every board in levels/ through the same loader the game uses, or
      starts a new one.
    - Draw lane: click squares to add corners to the active lane. Each corner
      must sit on a straight rank/file or a true 45° diagonal from the last one.
      Backspace removes the last corner.
    - Place King: click a square to add a King, click one again to remove it.
      Every lane has to end on a King; several Kings share one HP pool.
    - Unusable squares: click or drag to mark squares no piece can be built on
      or moved to (drag from a marked square to clear). Shots and sliding moves
      still pass over them. Saved as `blocked`.
    - Walls: painted the same way. Also unusable, and they stop sliding pieces
      (bishop/rook/queen) — their shots, even with Pierce, and their moves.
      Knights and pawns jump past. Not allowed on a lane. Saved as `walls`.
      A square is one or the other; painting one kind replaces the other.
    - Right click deletes what is on a square, in any tool: a wall or unusable
      mark first, then a lane corner (the active lane's, else another lane's,
      which becomes active). Right drag clears walls and unusable squares.
    - Save writes levels/levelNN.js. The game picks up every file there on its
      next load, as long as the numbers have no gaps.

    The checks mirror what the game ASSERTs on load (board.js), so a level that
    passes here will not trip the game.
*/

'use strict';

const $ = id => document.getElementById(id);

const LANE_HUES = [.58, .02, .33, .12, .8, .45, .92, .2];

let level;              // the board being edited, in level-file shape
let routeTags;          // per lane: true if tagged 'diag' (Courier lane)
let activeLane = 0;
let tool       = 'path';
let hoverCell  = null;
let paintBlock = null;  // while dragging a square tool: true marks, false clears
let erasing    = false; // while the right button is held: deleting squares
let eraseSaved = false; // this right-button stroke has taken its undo snapshot

// square tools -> the level list each one paints
const SQUARE_TOOLS = {block: 'blocked', wall: 'walls'};
let undoStack  = [];
let levelsDir  = null;  // FileSystemDirectoryHandle once the user picks levels/

///////////////////////////////////////////////////////////////////////////////
// LEVEL STATE

function newLevel()
{
    return {
        name:  'NEW BOARD',
        blurb: 'Describe the board in one line.',
        gridW: 10,
        gridH: 10,
        bases: [[9, 5]],
        hpMul: 1,
        paths: [[]],
        blocked: [],
        walls: [],
    };
}

function openLevel(def)
{
    level = JSON.parse(JSON.stringify({
        name: def.name, blurb: def.blurb, gridW: def.gridW, gridH: def.gridH,
        bases: mapBases(def), hpMul: def.hpMul ?? 1, paths: def.paths,
        blocked: def.blocked ?? [],
        walls: def.walls ?? [],
    }));
    if (def.wardsOnly)
        level.wardsOnly = true;
    // draft-board fields have no editor controls yet; carry them through a re-save
    if (def.draft)
        level.draft = true;
    if (def.buildRows)
        level.buildRows = [...def.buildRows];
    if (def.startPieces)
        level.startPieces = def.startPieces.map(piece => [...piece]);
    routeTags  = level.paths.map((_, i) => !!def.pathRoutes && def.pathRoutes[i] === 'diag');
    activeLane = 0;
    undoStack  = [];
    $('number').value = def.number ?? nextFreeNumber();
    syncFields();
    refresh();
}

function snapshot()
{
    undoStack.push(JSON.stringify({level, routeTags, activeLane}));
    if (undoStack.length > 200)
        undoStack.shift();
}

function undo()
{
    if (!undoStack.length)
        return;
    ({level, routeTags, activeLane} = JSON.parse(undoStack.pop()));
    syncFields();
    refresh();
}

function nextFreeNumber()
{
    return MAPS.reduce((max, map) => Math.max(max, map.number), 0) + 1;
}

///////////////////////////////////////////////////////////////////////////////
// GEOMETRY — kept in step with board.js

function inBounds([row, col])
{
    return row >= 0 && row < level.gridH && col >= 0 && col < level.gridW;
}

function isStraightOrDiagonal([r0, c0], [r1, c1])
{
    const dRow = r1 - r0, dCol = c1 - c0;
    if (!dRow && !dCol)
        return false;
    return !dRow || !dCol || Math.abs(dRow) === Math.abs(dCol);
}

function isDiagonal([r0, c0], [r1, c1])
{
    return r0 !== r1 && Math.abs(r1 - r0) === Math.abs(c1 - c0);
}

// Every square a lane walks, corners included.
function laneCells(waypoints)
{
    if (!waypoints.length)
        return [];
    const cells = [waypoints[0]];
    for (let i = 1; i < waypoints.length; ++i)
    {
        const [r0, c0] = waypoints[i - 1], [r1, c1] = waypoints[i];
        if (!isStraightOrDiagonal(waypoints[i - 1], waypoints[i]))
            continue;
        const dr = Math.sign(r1 - r0), dc = Math.sign(c1 - c0);
        let r = r0, c = c0;
        while (r !== r1 || c !== c1)
        {
            r += dr; c += dc;
            cells.push([r, c]);
        }
    }
    return cells;
}

function pathGrid()
{
    const grid = [];
    for (let row = 0; row < level.gridH; ++row)
        grid[row] = new Array(level.gridW).fill(false);
    for (const lane of level.paths)
        for (const cell of laneCells(lane))
            if (inBounds(cell))
                grid[cell[0]][cell[1]] = true;
    return grid;
}

function hasCell(list, [row, col])
{
    return list.some(([r, c]) => r === row && c === col);
}


function findProblems()
{
    const problems = [];
    if (!level.name.trim())
        problems.push('Board needs a name.');
    if (!level.bases.length)
        problems.push('Place at least one King.');
    if (level.bases.some(cell => !inBounds(cell)))
        problems.push('A King is off the board.');
    if (!level.paths.some(lane => lane.length))
        problems.push('Draw at least one lane.');
    if (level.bases.some(cell => hasCell(level.blocked, cell)))
        problems.push('A King stands on an unusable square — clear it.');
    if (level.bases.some(cell => hasCell(level.walls, cell)))
        problems.push('A King stands on a wall — clear it.');

    level.paths.forEach((lane, i) =>
    {
        const label = `Lane ${i + 1}`;
        if (!lane.length)
            return problems.push(`${label} is empty — draw it or delete it.`);
        if (lane.length < 2)
            problems.push(`${label} needs at least two corners.`);
        if (lane.some(cell => !inBounds(cell)))
            problems.push(`${label} runs off the board.`);
        for (let j = 1; j < lane.length; ++j)
            if (!isStraightOrDiagonal(lane[j - 1], lane[j]))
                problems.push(`${label}: corner ${j} → ${j + 1} is not straight or 45°.`);
        const end = lane[lane.length - 1];
        if (!hasCell(level.bases, end))
            problems.push(`${label} must end on a King.`);
    });

    // creeps cannot walk through a wall (board.js ASSERTs this)
    const grid      = pathGrid();
    const laneWalls = level.walls.filter(cell => inBounds(cell) && grid[cell[0]][cell[1]]);
    if (laneWalls.length)
        problems.push(`Wall on a lane at row,col ${laneWalls.slice(0, 4).map(String).join('  ')}`
            + (laneWalls.length > 4 ? ` +${laneWalls.length - 4} more` : '') + ' — creeps can\'t walk through walls.');

    return problems;
}

///////////////////////////////////////////////////////////////////////////////
// EXPORT

function pairList(cells)
{
    return '[' + cells.map(([r, c]) => `[${r}, ${c}]`).join(', ') + ']';
}

// Empty lanes are dropped on export, along with their Courier tags.
function exportDef()
{
    const kept = level.paths.map((lane, i) => i).filter(i => level.paths[i].length);
    return {lanes: kept.map(i => level.paths[i]), tags: kept.map(i => routeTags[i])};
}

function levelSource()
{
    const {lanes, tags} = exportDef();
    const lines = [
        `// ${level.name} — Gambit Defense level (editor.html)`,
        'addLevel({',
        `    name:  ${JSON.stringify(level.name)},`,
        `    blurb: ${JSON.stringify(level.blurb)},`,
        `    gridW: ${level.gridW},`,
        `    gridH: ${level.gridH},`,
        level.bases.length === 1
            ? `    base:  ${pairList(level.bases).slice(1, -1)},`
            : `    bases: ${pairList(level.bases)},`,
        `    hpMul: ${level.hpMul},`,
    ];
    if (level.wardsOnly)
        lines.push('    wardsOnly: true,');
    if (level.draft)
        lines.push('    draft: true,');
    if (level.buildRows)
        lines.push(`    buildRows: [${level.buildRows.join(', ')}],`);
    if (level.startPieces)
        lines.push(`    startPieces: [${level.startPieces.map(piece => JSON.stringify(piece)).join(', ')}],`);
    if (tags.some(tag => tag))
        lines.push(`    pathRoutes: [${tags.map(tag => tag ? '"diag"' : 'null').join(', ')}],`);
    lines.push('    paths: [');
    for (const lane of lanes)
        lines.push(`        ${pairList(lane)},`);
    lines.push('    ],');
    for (const key of ['blocked', 'walls'])
        if (level[key].length)
            lines.push(`    ${(key + ':').padEnd(8)} ${pairList(sortedCells(level[key]))},`);
    lines.push('});', '');
    return lines.join('\n');
}

// Row-major, so the file diffs cleanly however the squares were painted.
function sortedCells(cells)
{
    return [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

function fileName()
{
    return levelFileName(Math.max(1, Math.floor(Number($('number').value) || 1)));
}

function setStatus(text, isError)
{
    $('status').textContent = text;
    $('status').className   = isError ? 'err' : 'ok';
}

// Keeps the Open list current after a save without reloading the page.
function rememberSaved()
{
    const number = Number(fileName().match(/\d+/)[0]);
    const def    = JSON.parse(JSON.stringify(level));
    const {lanes, tags} = exportDef();
    def.paths  = lanes;
    def.number = number;
    if (tags.some(tag => tag))
        def.pathRoutes = tags.map(tag => tag ? 'diag' : null);
    for (const key of ['blocked', 'walls'])
        if (!def[key].length)
            delete def[key];
    const index = MAPS.findIndex(map => map.number === number);
    if (index >= 0)
        MAPS[index] = def;
    else
        MAPS.push(def);
    MAPS.sort((a, b) => a.number - b.number);
    fillLevelSelect(number);
}

function canSave()
{
    const problems = findProblems();
    if (problems.length)
        setStatus('Fix the checks above first — the game would reject this board.', true);
    return !problems.length;
}

// Writes straight into levels/ where the browser allows it (Chrome/Edge), so
// saving is one click after the folder is picked once per session.
async function saveToFolder()
{
    if (!canSave())
        return;
    if (!window.showDirectoryPicker)
    {
        downloadFile();
        setStatus(`This browser can't write folders — downloaded ${fileName()}, move it into levels/.`);
        return;
    }
    try
    {
        if (!levelsDir)
        {
            levelsDir = await showDirectoryPicker({id: 'gambitLevels', mode: 'readwrite'});
            if (levelsDir.name !== 'levels')
                setStatus(`Picked "${levelsDir.name}" — the game only reads chessDefense/levels/.`, true);
        }
        const name   = fileName();
        const handle = await levelsDir.getFileHandle(name, {create: true});
        const writer = await handle.createWritable();
        await writer.write(levelSource());
        await writer.close();
        rememberSaved();
        if (levelsDir.name === 'levels')
            setStatus(`Saved levels/${name}. Reload the game to play it.`);
    }
    catch (e)
    {
        if (e.name !== 'AbortError')
            setStatus(`Save failed: ${e.message}`, true);
    }
}

function downloadFile()
{
    if (!canSave())
        return;
    const link    = document.createElement('a');
    link.href     = URL.createObjectURL(new Blob([levelSource()], {type: 'text/javascript'}));
    link.download = fileName();
    link.click();
    URL.revokeObjectURL(link.href);
    rememberSaved();
    setStatus(`Downloaded ${fileName()} — move it into levels/.`);
}

async function copySource()
{
    try
    {
        await navigator.clipboard.writeText(levelSource());
        setStatus(`Copied — paste into levels/${fileName()}.`);
    }
    catch (e)
    {
        $('preview').select();
        setStatus('Clipboard blocked — the preview is selected, copy it by hand.', true);
    }
}

///////////////////////////////////////////////////////////////////////////////
// EDITING

function withoutCell(list, cell)
{
    return list.filter(([r, c]) => r !== cell[0] || c !== cell[1]);
}

// Marks or clears one square for the current square tool; paintBlock says
// which. Marking takes the square away from the other kind.
function paintCell(cell)
{
    const key = SQUARE_TOOLS[tool];
    if (hasCell(level[key], cell) === paintBlock)
        return;
    for (const other of Object.values(SQUARE_TOOLS))
        level[other] = withoutCell(level[other], cell);
    if (paintBlock)
        level[key].push(cell);
    refresh();
}

// Right click: delete one thing on the square. A wall or unusable mark goes
// first; otherwise (first square of the stroke only, so a drag never eats
// lanes) a lane corner. The undo snapshot is taken only once something
// actually changes, so a click on an empty square leaves no undo step.
function eraseCell(cell, firstSquare)
{
    const save = () =>
    {
        if (!eraseSaved)
            snapshot();
        eraseSaved = true;
    };

    for (const key of Object.values(SQUARE_TOOLS))
        if (hasCell(level[key], cell))
        {
            save();
            level[key] = withoutCell(level[key], cell);
            refresh();
            return;
        }
    if (!firstSquare)
        return;

    const order = [activeLane, ...level.paths.keys()].filter((i, j, all) => all.indexOf(i) === j);
    const lane  = order.find(i => hasCell(level.paths[i], cell));
    if (lane !== undefined)
    {
        save();
        level.paths[lane] = withoutCell(level.paths[lane], cell);
        activeLane = lane;
        refresh();
        return;
    }

    if (hasCell(level.bases, cell))
    {
        if (level.bases.length === 1)
            return setStatus('The last King can\'t be deleted — place another first.', true);
        save();
        level.bases = withoutCell(level.bases, cell);
        refresh();
    }
}

function clickCell(cell, button)
{
    if (button !== 0)
    {
        erasing    = true;
        eraseSaved = false;
        eraseCell(cell, true);
        return;
    }

    if (SQUARE_TOOLS[tool])
    {
        // the stroke keeps whatever the first square chose, so a drag never
        // flickers squares back and forth; one undo step per stroke
        snapshot();
        paintBlock = !hasCell(level[SQUARE_TOOLS[tool]], cell);
        paintCell(cell);
        return;
    }

    if (tool === 'king')
    {
        // click toggles a King; the last one stays so the board always has one
        if (hasCell(level.bases, cell))
        {
            if (level.bases.length === 1)
                return setStatus('The last King can\'t be removed — place another first.', true);
            snapshot();
            level.bases = withoutCell(level.bases, cell);
        }
        else
        {
            snapshot();
            level.bases.push(cell);
        }
        refresh();
        return;
    }

    const lane = level.paths[activeLane];
    const last = lane[lane.length - 1];
    if (last && !isStraightOrDiagonal(last, cell))
    {
        setStatus('Corners must be on the same rank, file, or a 45° diagonal.', true);
        return;
    }
    snapshot();
    lane.push(cell);
    // a lane that is all diagonals is a bishop road; Couriers walk those
    if (lane.length === 2)
        routeTags[activeLane] = isDiagonal(lane[0], lane[1]);
    else if (routeTags[activeLane] && !isDiagonal(last, cell))
        routeTags[activeLane] = false;
    refresh();
}

function removeLastCorner()
{
    const lane = level.paths[activeLane];
    if (!lane.length)
        return;
    snapshot();
    lane.pop();
    refresh();
}

function setTool(name)
{
    tool = name;
    $('toolPath').classList.toggle('on', tool === 'path');
    $('toolKing').classList.toggle('on', tool === 'king');
    $('toolBlock').classList.toggle('on', tool === 'block');
    $('toolWall').classList.toggle('on', tool === 'wall');
    render();
}

function syncFields()
{
    for (const key of ['name', 'blurb', 'gridW', 'gridH', 'hpMul'])
        $(key).value = level[key];
    $('wardsOnly').checked = !!level.wardsOnly;
}

function readFields()
{
    snapshot();
    level.name  = $('name').value;
    level.blurb = $('blurb').value;
    level.gridW = clamp(Math.floor(Number($('gridW').value) || 4), 4, 30);
    level.gridH = clamp(Math.floor(Number($('gridH').value) || 4), 4, 30);
    level.hpMul = Math.max(.1, Number($('hpMul').value) || 1);
    level.blocked = level.blocked.filter(inBounds);   // shrinking drops them (undo restores)
    level.walls   = level.walls.filter(inBounds);
    if ($('wardsOnly').checked)
        level.wardsOnly = true;
    else
        delete level.wardsOnly;
    refresh();
}

///////////////////////////////////////////////////////////////////////////////
// SIDEBAR

function fillLevelSelect(selectedNumber)
{
    const select = $('levelSelect');
    select.innerHTML = '';
    select.add(new Option('+ New board', 'new'));
    for (const map of MAPS)
        select.add(new Option(`${levelFileName(map.number)} — ${map.name}`, map.number));
    select.value = selectedNumber ?? 'new';
}

function laneColor(i, alpha = 1)
{
    return hsl(LANE_HUES[i % LANE_HUES.length], .85, .62, alpha).toString();
}

function renderLanes()
{
    const list = $('lanes');
    list.innerHTML = '';
    level.paths.forEach((lane, i) =>
    {
        const row = document.createElement('div');
        row.className = 'lane' + (i === activeLane ? ' active' : '');
        row.innerHTML = `<span class=swatch style="background:${laneColor(i)}"></span>
            <span class=info>Lane ${i + 1} · ${lane.length} corner${lane.length === 1 ? '' : 's'}</span>
            <label title="Couriers only walk lanes tagged diag"><input type=checkbox ${routeTags[i] ? 'checked' : ''}> Courier</label>
            <button title="Delete lane">×</button>`;
        row.onclick = () => { activeLane = i; setTool('path'); refresh(); };
        row.querySelector('input').onclick = e =>
        {
            e.stopPropagation();
            snapshot();
            routeTags[i] = e.target.checked;
            refresh();
        };
        row.querySelector('button').onclick = e =>
        {
            e.stopPropagation();
            snapshot();
            level.paths.splice(i, 1);
            routeTags.splice(i, 1);
            if (!level.paths.length)
            {
                level.paths.push([]);
                routeTags.push(false);
            }
            activeLane = Math.min(activeLane, level.paths.length - 1);
            refresh();
        };
        list.appendChild(row);
    });
}

function renderProblems()
{
    const problems = findProblems();
    $('problems').innerHTML = problems.length
        ? problems.map(p => `<div class=err>✗ ${p}</div>`).join('')
        : '<div class=ok>✓ Ready to save</div>';
}

function refresh()
{
    renderLanes();
    renderProblems();
    $('preview').value     = levelSource();
    $('fileName').textContent = `levels/${fileName()}`
        + (MAPS.some(map => levelFileName(map.number) === fileName()) ? '  (overwrites existing)' : '');
    render();
}

///////////////////////////////////////////////////////////////////////////////
// BOARD CANVAS

const canvas  = $('board');
const context = canvas.getContext('2d');

function boardLayout()
{
    const cell = Math.floor(Math.min((canvas.width - 40) / level.gridW, (canvas.height - 40) / level.gridH));
    return {
        cell,
        x: Math.floor((canvas.width  - cell * level.gridW) / 2),
        y: Math.floor((canvas.height - cell * level.gridH) / 2),
    };
}

function cellCenter([row, col], layout)
{
    return [layout.x + (col + .5) * layout.cell, layout.y + (row + .5) * layout.cell];
}

function eventCell(e)
{
    const layout = boardLayout();
    const rect   = canvas.getBoundingClientRect();
    const px     = (e.clientX - rect.left) * canvas.width  / rect.width;
    const py     = (e.clientY - rect.top)  * canvas.height / rect.height;
    const cell   = [Math.floor((py - layout.y) / layout.cell), Math.floor((px - layout.x) / layout.cell)];
    return inBounds(cell) ? cell : null;
}

function drawLaneLine(cells, color, width, layout)
{
    if (cells.length < 2)
        return;
    context.strokeStyle = color;
    context.lineWidth   = width;
    context.lineJoin    = context.lineCap = 'round';
    context.beginPath();
    cells.forEach((cell, i) =>
    {
        const [x, y] = cellCenter(cell, layout);
        i ? context.lineTo(x, y) : context.moveTo(x, y);
    });
    context.stroke();
}

function render()
{
    if (!level)
        return;
    const layout = boardLayout();
    const size   = layout.cell;
    const grid   = pathGrid();

    context.fillStyle = hsl(.62, .25, .09).toString();
    context.fillRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < level.gridH; ++row)
    for (let col = 0; col < level.gridW; ++col)
    {
        const light = (row + col) % 2 === 0;
        context.fillStyle = (grid[row][col] ? (light ? PATH_LIGHT : PATH_DARK)
                                            : (light ? LIGHT_SQUARE : DARK_SQUARE)).toString();
        context.fillRect(layout.x + col * size, layout.y + row * size, size, size);
    }

    // unusable squares: dark slab with an X, inset on a lane so it stays visible
    for (const cell of level.blocked.filter(inBounds))
    {
        const inset = grid[cell[0]][cell[1]] ? size * .15 : size * .03;
        const x = layout.x + cell[1] * size + inset, y = layout.y + cell[0] * size + inset;
        const w = size - inset * 2;
        context.fillStyle = UNUSABLE_COLOR.toString();
        context.fillRect(x, y, w, w);
        context.strokeStyle = UNUSABLE_MARK.toString();
        context.lineWidth   = Math.max(2, size * .06);
        context.beginPath();
        context.moveTo(x + w * .22, y + w * .22); context.lineTo(x + w * .78, y + w * .78);
        context.moveTo(x + w * .78, y + w * .22); context.lineTo(x + w * .22, y + w * .78);
        context.stroke();
    }

    // walls: raised stone block with a brick seam, red-edged if on a lane
    for (const cell of level.walls.filter(inBounds))
    {
        const x = layout.x + cell[1] * size, y = layout.y + cell[0] * size;
        const pad = size * .04, w = size - pad * 2;
        context.fillStyle = WALL_EDGE.toString();
        context.fillRect(x + pad, y + pad, w, w);
        context.fillStyle = WALL_COLOR.toString();
        context.fillRect(x + pad * 2, y + pad, w - pad * 2, w - pad * 2.5);
        context.strokeStyle = WALL_EDGE.toString();
        context.lineWidth   = Math.max(1.5, size * .04);
        context.beginPath();
        context.moveTo(x + pad * 2, y + size / 2); context.lineTo(x + size - pad * 2, y + size / 2);
        context.moveTo(x + size / 2, y + pad);     context.lineTo(x + size / 2, y + size / 2);
        context.moveTo(x + size / 4, y + size / 2); context.lineTo(x + size / 4, y + size - pad * 2);
        context.moveTo(x + size * .75, y + size / 2); context.lineTo(x + size * .75, y + size - pad * 2);
        context.stroke();
        if (grid[cell[0]][cell[1]])
        {
            context.strokeStyle = 'rgba(255,90,80,.9)';
            context.lineWidth   = 3;
            context.strokeRect(x + 2, y + 2, size - 4, size - 4);
        }
    }

    // coordinates along the edges, row/col as the level file stores them
    context.fillStyle    = '#6f7890';
    context.font         = `${Math.max(9, size * .28)}px system-ui`;
    context.textAlign    = 'center';
    context.textBaseline = 'middle';
    for (let col = 0; col < level.gridW; ++col)
        context.fillText(col, layout.x + (col + .5) * size, layout.y - 12);
    for (let row = 0; row < level.gridH; ++row)
        context.fillText(row, layout.x - 12, layout.y + (row + .5) * size);

    // lanes, the active one on top
    const order = level.paths.map((_, i) => i).filter(i => i !== activeLane).concat(activeLane);
    for (const i of order)
    {
        const lane   = level.paths[i];
        const active = i === activeLane;
        drawLaneLine(lane.filter(inBounds), laneColor(i, active ? .95 : .5), size * (active ? .14 : .09), layout);

        lane.forEach((cell, j) =>
        {
            if (!inBounds(cell))
                return;
            const [x, y] = cellCenter(cell, layout);
            context.beginPath();
            context.arc(x, y, size * (j ? .16 : .3), 0, Math.PI * 2);
            context.fillStyle = j ? laneColor(i, active ? 1 : .6) : hsl(0, .7, .6, .85).toString();
            context.fill();
            if (active)
            {
                context.fillStyle = '#10141f';
                context.font      = `bold ${Math.max(9, size * .2)}px system-ui`;
                context.fillText(j + 1, x, y + 1);
            }
        });
    }

    // the Kings
    for (const base of level.bases.filter(inBounds))
    {
        const [x, y] = cellCenter(base, layout);
        context.font         = `${size * .8}px serif`;
        context.lineWidth    = size * .07;
        context.strokeStyle  = PIECE_OUTLINE.toString();
        context.strokeText('♚', x, y + size * .04);
        context.fillStyle    = BASE_COLOR.toString();
        context.fillText('♚', x, y + size * .04);
    }

    // where the next click would go
    if (hoverCell)
    {
        const lane = level.paths[activeLane];
        const last = lane[lane.length - 1];
        const ok   = tool !== 'path' || !last || isStraightOrDiagonal(last, hoverCell);
        if (tool === 'path' && last && inBounds(last))
        {
            context.setLineDash([size * .15, size * .15]);
            drawLaneLine([last, hoverCell], ok ? 'rgba(120,255,140,.8)' : 'rgba(255,90,80,.8)', size * .08, layout);
            context.setLineDash([]);
        }
        context.strokeStyle = ok ? 'rgba(120,255,140,.9)' : 'rgba(255,90,80,.9)';
        context.lineWidth   = 3;
        context.strokeRect(layout.x + hoverCell[1] * size + 1.5, layout.y + hoverCell[0] * size + 1.5, size - 3, size - 3);
    }

    $('hint').textContent = tool === 'king'
        ? 'Place King: click a square to add or remove a King. Every lane must end on one; all Kings share one HP pool. Right click deletes what is on a square.'
        : tool === 'block'
        ? 'Unusable squares: click or drag to mark squares no piece can stand on; drag from a marked square to clear. Right click deletes.'
          + (hoverCell ? `   ·   row ${hoverCell[0]}, col ${hoverCell[1]}` : '')
        : tool === 'wall'
        ? 'Walls: click or drag to place walls that stop bishops, rooks and queens; drag from a wall to clear. Right click deletes.'
          + (hoverCell ? `   ·   row ${hoverCell[0]}, col ${hoverCell[1]}` : '')
        : `Lane ${activeLane + 1}: click to add a corner (first corner = spawn). Backspace removes the last one; right click deletes a square's corner.`
          + (hoverCell ? `   ·   row ${hoverCell[0]}, col ${hoverCell[1]}` : '');
}

function resizeCanvas()
{
    const rect    = $('boardWrap').getBoundingClientRect();
    canvas.width  = Math.floor(rect.width  * devicePixelRatio);
    canvas.height = Math.floor(rect.height * devicePixelRatio);
    render();
}

///////////////////////////////////////////////////////////////////////////////
// WIRING

canvas.addEventListener('mousemove', e =>
{
    const cell = eventCell(e);
    if (String(cell) !== String(hoverCell))
    {
        hoverCell = cell;
        if (cell && paintBlock !== null && e.buttons)
            paintCell(cell);
        else if (cell && erasing && e.buttons)
            eraseCell(cell, false);
        render();
    }
});
window.addEventListener('mouseup', () => { paintBlock = null; erasing = false; });
canvas.addEventListener('mouseleave', () => { hoverCell = null; render(); });
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mousedown', e =>
{
    const cell = eventCell(e);
    hoverCell  = cell;   // so a drag's first move off this square always counts
    if (cell)
        clickCell(cell, e.button);
});

document.addEventListener('keydown', e =>
{
    if (e.target.matches('input, textarea, select'))
        return;
    if ((e.metaKey || e.ctrlKey) && e.code === 'KeyZ')
    {
        e.preventDefault();
        undo();
    }
    else if (e.code === 'Backspace' || e.code === 'Delete')
    {
        e.preventDefault();
        removeLastCorner();
    }
    else if (e.code === 'KeyK')
        setTool('king');
    else if (e.code === 'KeyL')
        setTool('path');
    else if (e.code === 'KeyB')
        setTool('block');
    else if (e.code === 'KeyW')
        setTool('wall');
});

for (const key of ['name', 'blurb', 'gridW', 'gridH', 'hpMul', 'wardsOnly'])
    $(key).addEventListener('change', readFields);
$('number').addEventListener('input', refresh);

$('levelSelect').onchange = e =>
{
    const value = e.target.value;
    openLevel(value === 'new' ? newLevel() : MAPS.find(map => map.number === Number(value)));
};
$('toolPath').onclick  = () => setTool('path');
$('toolKing').onclick  = () => setTool('king');
$('toolBlock').onclick = () => setTool('block');
$('toolWall').onclick  = () => setTool('wall');
$('undo').onclick      = undo;
$('addLane').onclick   = () =>
{
    snapshot();
    level.paths.push([]);
    routeTags.push(false);
    activeLane = level.paths.length - 1;
    setTool('path');
    refresh();
};
$('clearLane').onclick = () =>
{
    snapshot();
    level.paths[activeLane] = [];
    refresh();
};
$('save').onclick     = saveToFolder;
$('download').onclick = downloadFile;
$('copy').onclick     = copySource;

window.addEventListener('resize', resizeCanvas);

loadLevels(() =>
{
    fillLevelSelect();
    openLevel(newLevel());
    setTool('path');
    resizeCanvas();
    setStatus(`${MAPS.length} board${MAPS.length === 1 ? '' : 's'} found in levels/.`);
});
