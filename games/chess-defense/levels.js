/*
    Level loading. Every board lives in its own file, levels/levelNN.js, which
    is nothing but one `addLevel({...})` call — editor.html writes them.

    A page opened from file:// cannot list a folder, so the loader probes
    level01.js, level02.js, ... in order and stops at the first number that is
    missing. Number the files without gaps; the number is the board's order
    on the level select.

    The zipped build concatenates levels/*.js into the bundle (build.json
    sources), so MAPS is already full by the time loadLevels runs and the
    probe is skipped.
*/

'use strict';

const LEVEL_DIR    = 'levels/';
const LEVEL_PREFIX = 'level';

// A board's King squares. One King is written `base: [row, col]`; several are
// `bases: [[row, col], ...]`. Every King shares the one HP pool.
function mapBases(def)
{
    return def.bases ?? [def.base];
}

function levelFileName(number)
{
    return LEVEL_PREFIX + String(number).padStart(2, '0') + '.js';
}

// Called by each level file. The file number comes from the script's own name
// when there is one; bundled levels have none and simply append in order.
function addLevel(def)
{
    const src   = document.currentScript && document.currentScript.src || '';
    const match = src.match(/level(\d+)\.js/);
    def.number  = match ? Number(match[1]) : MAPS.length + 1;
    MAPS.push(def);
}

// Probes levels/ one file at a time, then calls onDone. Sequential so the
// boards land in file order and only one missing-file error hits the console.
function loadLevels(onDone)
{
    if (MAPS.length)
    {
        onDone();
        return;
    }

    let number = 1;
    const next = () =>
    {
        const script   = document.createElement('script');
        script.src     = LEVEL_DIR + levelFileName(number);
        script.onload  = () => { ++number; next(); };
        script.onerror = () => { script.remove(); onDone(); };
        document.head.appendChild(script);
    };
    next();
}
