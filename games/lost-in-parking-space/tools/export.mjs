// Exports the game as a clean, standalone folder (and zip) for showing to people outside the team.
// Usage, from games/lost-in-parking-space:   node tools/export.mjs [outDir]     (default: ~/Desktop/lost-in-parking-space)
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
const OUT = path.resolve(process.argv[2] || path.join(os.homedir(), 'Desktop', 'lost-in-parking-space'));
const SCRIPTS = ['src/physics.js', 'src/boats.js', 'src/render.js', 'levels/levels.js', 'src/jam.js', 'src/main.js', 'src/skin.js'];
const REWRITES =
[
    ["'cm_lost-in-parking-space_save'", "'lost-in-parking-space_save'"],
    ["'DOCK ALL THE BOATS'", "'LOST IN PARKING SPACE'"],
    ["function track(...args) { console.log('[GA]', ...args); }", 'function track() {}'],
    [/\bpmbEditor\b/g, 'levelEditor'],
];
const FORBIDDEN = /coolmath|cool math|\bcm_|park.?my.?boat|dock all the boats|pmb|paodrive|salcedo|\bpao\b|gameanalytics|\[GA\]/i;

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
    for (const [from, to] of REWRITES) code = typeof from == 'string' ? code.split(from).join(to) : code.replace(from, to);
    new Function(code);                          // throws if stripping broke the syntax
    fs.writeFileSync(path.join(OUT, 'js', path.basename(f)), code);
}

const scripts = ['littlejs.js', ...SCRIPTS.map(f => path.basename(f))].map(f => `<script src=js/${f}></script>`).join('\n');
fs.writeFileSync(path.join(OUT, 'index.html'), `<!DOCTYPE html><head>
<title>Lost in Parking Space</title>
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
