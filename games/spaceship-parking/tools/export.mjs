// Exports the game as a clean, standalone folder (and zip) for showing to people outside the team.
// Usage, from games/spaceship-parking:   node tools/export.mjs [outDir]     (default: ~/Desktop/spaceship-parking)
// What it does: copies the engine, game code, levels, skin and font into one flat folder, strips every comment
// from the game code, rewrites the few strings that name Park My Boat (the code's origin) or the team (REWRITES below), silences the
// analytics console log, and fails if any name from FORBIDDEN is left anywhere in the output.
// The LittleJS engine keeps its MIT header and the font keeps its OFL license file: both licenses require it.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(os.homedir(), 'Desktop', 'spaceship-parking'));
const SCRIPTS = ['src/physics.js', 'src/boats.js', 'src/render.js', 'levels/levels.js', 'src/jam.js', 'src/main.js', 'src/skin.js', 'src/space.js', 'src/guide.js'];
const REWRITES =
[
    ["'cm_spaceship-parking_save'", "'spaceship-parking_save'"],
    ["'DOCK ALL THE BOATS'", "'SPACESHIP PARKING'"],
    ["function track(...args) { console.log('[GA]', ...args); }", 'function track() {}'],
    [/\bpmbEditor\b/g, 'levelEditor'],
];
const FORBIDDEN = /coolmath|cool math|\bcm_|park.?my.?boat|dock all the boats|pmb|paodrive|salcedo|\bpao\b|gameanalytics|\[GA\]/i;

// Release cuts: everything debug goes (the Test Map and its spawn buttons, ?test ?bonus ?hitbox and the URL tuning
// knobs, window.game.win/load, the level editor hooks). Applied to the comment-stripped code, per file:
// line: drop the whole line holding this text; block: drop from the line holding this text through its matching }
// (and a trailing comma); object: drop the { } literal around this text; replace: [from, to, count].
// Every cut must match exactly (count, default 1), so a change in the game code fails the export instead of shipping debug.
const URL_KNOB = /\+new URLSearchParams\(location\.search\)\.get\('\w+'\) \|\| /g;
const RELEASE =
{
    'levels/levels.js':
    [
        { object: "name: 'Test Map'" },
        { line: "const SHOW_BONUS = new URLSearchParams(location.search).has('bonus');" },
        { line: "const SHOW_TEST = new URLSearchParams(location.search).has('test');" },
        { replace: ["const LEVELS = [...SCALE_LEVELS.filter(L => !L.bonus && !L.test), ...(SHOW_BONUS ? SCALE_LEVELS.filter(L => L.bonus) : []), ...(SHOW_TEST ? SCALE_LEVELS.filter(L => L.test) : [])]",
            'const LEVELS = SCALE_LEVELS.filter(L => !L.bonus)'] },
    ],
    'src/jam.js':
    [
        { line: "if (L.test) jamSpawn('dinghy');" },
        { block: 'function jamSpawn(key)' },
        { block: 'function jamRemove(b)' },
        { block: 'function jamWin()' },
        { line: 'if (level.test) {' },
    ],
    'src/main.js':
    [
        { replace: [URL_KNOB, '', 6] },
        { line: 'if (window.pmbEditor?.active) return;' },
        { replace: ['if (!window.pmbEditor?.active) ', '', 2] },
        { line: 'if (!window.pmbEditor?.testing)' },
        { replace: ["LEVELS[i].test ? 'TEST' : ", ''] },
        { block: 'if (level?.test && !isPaused)' },
        { replace: [' && !LEVELS[i].test', ''] },
        { line: "else if (id.startsWith('spawn:'))" },
        { line: "else if (id == 'remove')" },
        { line: "else if (id == 'clear')" },
        { replace: ['if (window.pmbEditor?.testing) pmbEditor.restartTest(); else ', ''] },
        { line: 'if (window.pmbEditor?.update()) return;' },
        { line: 'if (SHOW_HITBOX) drawHitboxes();' },
        { line: 'const SHOW_HITBOX =' },
        { block: 'function drawHitboxes()' },
        { replace: ['L.bonus || L.test', 'L.bonus', 2] },
        { line: 'const editing = window.pmbEditor?.active;' },
        { line: 'if (editing) pmbEditor.renderWorld();' },
        { line: 'if (editing) return pmbEditor.renderUi();' },
        { line: 'load(i) { loadLevel(i); },' },
        { block: '    win()' },
    ],
    'src/skin.js': [{ replace: ['level.test || ', ''] }],
    'src/space.js': [{ line: 'if (window.pmbEditor?.active) return;' }],
    'src/guide.js': [{ replace: [' || window.pmbEditor?.active', ''] }],
};
// none of this may be left after the cuts
const DEBUG = /location\.search|pmbEditor|levelEditor|\b(level\??|L|LEVELS\[i\])\.test\b|test map|hitbox|jamSpawn|jamRemove|jamWin|\bwin\(/i;

function countOf(code, find) { return typeof find == 'string' ? code.split(find).length - 1 : (code.match(find) || []).length; }
function lineAround(code, at) { const s = code.lastIndexOf('\n', at) + 1, e = code.indexOf('\n', at); return [s, e < 0 ? code.length : e + 1]; }
function closeBrace(code, open)
{
    for (let i = open, depth = 0; i < code.length; i++)
    {
        if (code[i] == '{') depth++;
        else if (code[i] == '}' && --depth == 0) return i;
    }
    throw new Error('unbalanced braces');
}
function applyCut(code, cut, file)
{
    const [kind, arg] = Object.entries(cut)[0];
    const find = kind == 'replace' ? arg[0] : arg, want = kind == 'replace' ? arg[2] ?? 1 : 1, n = countOf(code, find);
    if (n != want) throw new Error(`release cut ${kind} "${find}" matched ${n} times in ${file} (expected ${want})`);
    if (kind == 'replace') return typeof find == 'string' ? code.split(find).join(arg[1]) : code.replace(find, arg[1]);
    const at = code.indexOf(find);
    if (kind == 'line') { const [s, e] = lineAround(code, at); return code.slice(0, s) + code.slice(e); }
    const open = kind == 'object' ? code.lastIndexOf('{', at) : code.indexOf('{', at);
    let end = closeBrace(code, open) + 1;
    if (code[end] == ',') end++;
    const s = kind == 'object' ? lineAround(code, open)[0] : lineAround(code, at)[0];
    return code.slice(0, s) + code.slice(lineAround(code, end - 1)[1]);
}

// Removes // and /* */ comments; strings, template literals (with nested ${}) and regex literals are kept as is.
function stripComments(src)
{
    let out = '', i = 0, prev = '';             // prev: the last significant token, to tell a regex from a division
    const tpl = [];                              // brace depth inside each open template ${ }
    const regexAfter = /^(|[(,=:[!&|?{};+\-*%<>~^]|return|typeof|case|do|else|in|of|new|delete|void|throw|instanceof|yield|await)$/;
    const scanString = q =>
    {
        let s = src[i++];
        while (i < src.length && src[i] != q) { if (src[i] == '\\') s += src[i++]; s += src[i++]; }
        return s + src[i++];
    };
    const scanTemplate = () =>                   // from just after ` or }, up to and including ` or ${
    {
        let s = '';
        while (i < src.length)
        {
            if (src[i] == '\\') { s += src[i] + src[i + 1]; i += 2; continue; }
            if (src[i] == '`') { i++; return s + '`'; }
            if (src[i] == '$' && src[i + 1] == '{') { i += 2; tpl.push(0); return s + '${'; }
            s += src[i++];
        }
        throw new Error('unterminated template');
    };
    while (i < src.length)
    {
        const c = src[i], n = src[i + 1];
        if (c == '/' && n == '/') { while (i < src.length && src[i] != '\n') i++; continue; }
        if (c == '/' && n == '*')
        {
            const end = src.indexOf('*/', i + 2);
            if (end < 0) throw new Error('unterminated comment');
            out += src.slice(i, end).includes('\n') ? '\n' : ' ';
            i = end + 2;
            continue;
        }
        if (c == "'" || c == '"') { out += scanString(c); prev = 'str'; continue; }
        if (c == '`') { i++; out += '`' + scanTemplate(); prev = 'str'; continue; }
        if (c == '/' && regexAfter.test(prev))
        {
            let s = src[i++], cls = false;
            while (i < src.length && (src[i] != '/' || cls))
            {
                if (src[i] == '\\') s += src[i++];
                else if (src[i] == '[') cls = true;
                else if (src[i] == ']') cls = false;
                s += src[i++];
            }
            s += src[i++];
            while (/[a-z]/i.test(src[i] || '')) s += src[i++];
            out += s; prev = 'regex';
            continue;
        }
        if (tpl.length && c == '{') tpl[tpl.length - 1]++;
        if (tpl.length && c == '}')
        {
            if (tpl[tpl.length - 1] == 0) { tpl.pop(); i++; out += '}' + scanTemplate(); prev = 'str'; continue; }
            tpl[tpl.length - 1]--;
        }
        if (/[A-Za-z_$0-9]/.test(c))
        {
            let w = '';
            while (i < src.length && /[A-Za-z_$0-9.]/.test(src[i]) && !(src[i] == '.' && !/[0-9]/.test(w[0]))) w += src[i++];
            out += w; prev = w;
            continue;
        }
        out += c;
        if (!/\s/.test(c)) prev = c;
        i++;
    }
    // tidy: no trailing spaces, no blank lines
    return out.split('\n').map(l => l.trimEnd()).filter(l => l).join('\n') + '\n';
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'js'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });

fs.copyFileSync(path.join(ROOT, 'dist/littlejs.js'), path.join(OUT, 'js/littlejs.js'));
for (const f of ['Righteous-Regular.ttf', 'OFL.txt']) fs.copyFileSync(path.join(ROOT, 'fonts', f), path.join(OUT, 'fonts', f));

for (const f of SCRIPTS)
{
    let code = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    for (const cut of RELEASE[f] || []) code = applyCut(code, cut, f);
    const debug = code.match(DEBUG);
    if (debug) throw new Error(`debug code "${debug[0]}" left in ${f}`);
    for (const [from, to] of REWRITES) code = typeof from == 'string' ? code.split(from).join(to) : code.replace(from, to);
    new Function(code);                          // throws if stripping broke the syntax
    fs.writeFileSync(path.join(OUT, 'js', path.basename(f)), code);
}

const scripts = ['littlejs.js', ...SCRIPTS.map(f => path.basename(f))].map(f => `<script src=js/${f}></script>`).join('\n');
fs.writeFileSync(path.join(OUT, 'index.html'), `<!DOCTYPE html><head>
<title>Spaceship Parking</title>
<meta charset=utf-8>
<meta name=viewport content="width=device-width, initial-scale=1, user-scalable=no">
<style>
html, body { background: #07091C; }
@font-face { font-family: 'Righteous'; src: url(fonts/Righteous-Regular.ttf) format('truetype'); font-display: block; }
</style>
</head><body>
${scripts}
</body>
`);

// nothing that names the harbor game or the team may be left (the engine is checked too, minus its license header)
for (const f of fs.readdirSync(OUT, { recursive: true }))
{
    const p = path.join(OUT, f);
    if (fs.statSync(p).isDirectory() || f.endsWith('.ttf')) continue;
    const text = fs.readFileSync(p, 'utf8'), hit = text.match(FORBIDDEN);
    if (hit) throw new Error(`"${hit[0]}" left in ${f}`);
}

// zip it next to the folder: no macOS extras, no file owner info
const zip = OUT + '.zip';
fs.rmSync(zip, { force: true });
execFileSync('zip', ['-r', '-X', '-q', zip, path.basename(OUT)], { cwd: path.dirname(OUT) });
console.log(`Exported to ${OUT} and ${zip}`);
