// Run one solution script and show where it ends: node tools/try.mjs w1l01 [coop|solo]
import { Bot } from './bot.mjs';
import { SCRIPTS } from './solutions.mjs';
import { WORLDS, DEBUG_LEVELS } from '../levels/index.js';
const [id, mode = 'coop'] = process.argv.slice(2);
const level = [...WORLDS.flatMap(w => w.levels), ...Object.values(DEBUG_LEVELS)].find(l => l.id === id);
const bot = new Bot(level, mode);
let err = null;
try { SCRIPTS[id](bot, level); } catch (e) { err = e; }
const R = bot.R;
console.log(`${id} ${mode}: ${bot.sim.done ? 'REACHED THE EXIT' : 'not finished'} at ${bot.time.toFixed(2)} s, bolts ${bot.sim.boltCount}/3`);
console.log(`  plus  at (${R[0].x.toFixed(0)}, ${R[0].y.toFixed(0)}) grounded ${R[0].grounded}`);
console.log(`  minus at (${R[1].x.toFixed(0)}, ${R[1].y.toFixed(0)}) grounded ${R[1].grounded}`);
console.log('  exit box', JSON.stringify(level.exit), 'crates', bot.sim.crates.map(c => `(${c.x.toFixed(0)},${c.y.toFixed(0)})`).join(' '));
console.log('  bolts missing:', bot.sim.bolts.map((b, i) => (b.got ? null : `#${i + 1} at (${(b.x / 40 - 0.5).toFixed(0)},${(b.y / 40 - 0.5).toFixed(0)})`)).filter(Boolean).join(' ') || 'none');
console.log('  doors:', bot.sim.gates.map(g => `${g.id} open ${g.open.toFixed(2)}`).join(' '), ' plates touched:', bot.sim.plates.map(p => p.touched ? 1 : 0).join(''));
if (err) console.log('  error:', err.message);
