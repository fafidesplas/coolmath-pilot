// Is each star reachable on its own, and which ones together? node tools/stars.mjs w1l04
import { solve } from './solve.mjs';
const [id] = process.argv.slice(2);
const data = (await import(new URL(`../levels/${id}.js`, import.meta.url))).default;
const stars = data.objects.filter(o => o.type === 'star');
const withOnly = keep => ({ ...data, objects: data.objects.filter(o => o.type !== 'star' || keep.includes(o)) });
for (const st of stars) {
  const r = solve(withOnly([st]));
  console.log(`star at col ${st.x} row ${st.y}:`, r.ok ? `reachable (${r.stars}/1, tightest ${r.tightestMs} ms)` : 'level not beatable');
  if (r.ok && r.stars < 1) console.log('   -> the level can be finished but this star cannot be banked');
}
