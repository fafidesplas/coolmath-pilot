// Level list for the level select (GDD 6). The prototype has World 1, levels 1–5.
import world01 from './world01.js';

export const WORLDS = [
  { name: 'Village', levels: world01 },
];

export const ALL_LEVELS = WORLDS.flatMap(w => w.levels);

// Accepts "world01:level03", "1-3" or a plain index "3".
export function findLevel(ref) {
  if (!ref) return null;
  const byId = ALL_LEVELS.find(l => l.id === ref);
  if (byId) return byId;
  const m = /^(\d+)-(\d+)$/.exec(ref);
  if (m) return WORLDS[+m[1] - 1]?.levels[+m[2] - 1] || null;
  if (/^\d+$/.test(ref)) return ALL_LEVELS[+ref - 1] || null;
  return null;
}

export function levelPos(level) {
  for (let w = 0; w < WORLDS.length; w++) {
    const i = WORLDS[w].levels.indexOf(level);
    if (i >= 0) return { world: w + 1, level: i + 1, label: `${w + 1}-${i + 1}` };
  }
  return { world: 1, level: 0, label: '?' };
}
