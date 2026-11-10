// Solve one or more levels and print a table: node tools/levels.mjs [id …]
// Without ids it checks every level file in levels/ (worlds and the forms prototype).
import { readdirSync } from 'node:fs';
import { solve, slack } from './solve.mjs';

export async function loadAll() {
  const dir = new URL('../levels/', import.meta.url);
  const files = readdirSync(dir).filter(f => /^(w\d+l\d+|proto)\.js$/.test(f)).sort();
  return Promise.all(files.map(async f => (await import(new URL(f, dir))).default));
}

// Density rule (GDD 6): something to react to every 0.6–1 s, so no plain stretch
// longer than about 1.5 s after the first 2 s and before the last 2 s (the run-in to
// the goal). A column is "busy" if it has spikes,
// a gap in the floor or ceiling, a platform or a step in the walls.
export function longestClear(lv) {
  const rows = lv.tiles, cols = rows[0].length, R = rows.length;
  const solids = c => { let n = 0; for (let r = 0; r < R; r++) if (rows[r][c] === '#') n++; return n; };
  const busy = c => {
    for (let r = 0; r < R; r++) { const ch = rows[r][c]; if (ch === '^' || ch === 'v') return true; }
    if (rows[0][c] === '.' || rows[R - 1][c] === '.') return true;
    for (let r = 1; r < R - 1; r++) if (rows[r][c] === '#' && rows[r - 1][c] === '.' && rows[r + 1][c] === '.') return true;
    return (c > 0 && solids(c) !== solids(c - 1)) || (c < cols - 1 && solids(c) !== solids(c + 1));
  };
  const goalCol = (lv.objects.find(o => o.type === 'goal') || { x: cols }).x;
  let best = 0, run = 0;
  for (let c = 22; c < Math.min(cols, goalCol) - 22; c++) { if (busy(c)) run = 0; else best = Math.max(best, ++run); }
  return best * 40 / lv.speed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const wanted = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const all = await loadAll();
  const list = wanted.length ? all.filter(l => wanted.includes(l.id)) : all;
  console.log('level   cols  time   stars flips  tightest  longest-clear');
  for (const lv of list) {
    const t0 = Date.now();
    const r = solve(lv);
    const cols = lv.tiles[0].length;
    if (!r.ok) { console.log(`${lv.id.padEnd(7)} ${String(cols).padStart(4)}  NOT beatable: best route reaches column ${r.furthestCol}`); continue; }
    const glides = lv.objects.some(o => o.type === 'portal' && o.form === 'glider');
    const sl = glides && process.argv.includes('--slack') ? `  slack ${slack(lv)} px` : '';
    console.log(`${lv.id.padEnd(7)} ${String(cols).padStart(4)}  ${(r.time).toFixed(1).padStart(4)}s  ${r.stars}/3   ${String(r.presses.length).padStart(3)}   ${String(r.tightestMs).padStart(4)} ms   ${longestClear(lv).toFixed(1)} s   (${((Date.now() - t0) / 1000).toFixed(1)} s to solve)${sl}`);
  }
}
