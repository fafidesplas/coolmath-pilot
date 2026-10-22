// Turns a level module (GDD 6, level data format) into static level data.
import { T, ROWS } from './config.js';

export const TILE = { EMPTY: 0, SOLID: 1, SPIKE_UP: 2, SPIKE_DOWN: 3 };
const CHARS = { '.': TILE.EMPTY, '#': TILE.SOLID, '^': TILE.SPIKE_UP, v: TILE.SPIKE_DOWN };

export function parseLevel(data) {
  if (data.tiles.length !== ROWS) throw new Error(`${data.id}: needs ${ROWS} rows`);
  const cols = data.tiles[0].length;
  const tiles = new Uint8Array(cols * ROWS);
  data.tiles.forEach((row, y) => {
    if (row.length !== cols) throw new Error(`${data.id}: row ${y} has ${row.length} chars, want ${cols}`);
    for (let x = 0; x < cols; x++) {
      const t = CHARS[row[x]];
      if (t === undefined) throw new Error(`${data.id}: bad tile '${row[x]}' at ${x},${y}`);
      tiles[y * cols + x] = t;
    }
  });

  const lv = { id: data.id, cols, tiles, speed: data.speed, stars: [], flags: [], hints: [], portals: [], goal: cols * T };
  for (const o of data.objects || []) {
    if (o.type === 'star') lv.stars.push({ x: (o.x + 0.5) * T, y: (o.y + 0.5) * T });
    else if (o.type === 'flag') lv.flags.push({ x: o.x * T, ty: o.y });
    else if (o.type === 'goal') lv.goal = o.x * T;
    else if (o.type === 'hint') lv.hints.push({ x: o.x * T, label: o.label || 'TAP!' });
    else if (o.type === 'portal') lv.portals.push({ x: o.x * T, form: o.form, lane: o.lane ?? null });
  }
  lv.flags.sort((a, b) => a.x - b.x);
  lv.portals.sort((a, b) => a.x - b.x);
  lv.start = data.start;
  return lv;
}

export function tileAt(lv, tx, ty) {
  if (ty < 0 || ty >= ROWS) return TILE.EMPTY;           // open above and below: falling out kills
  if (tx < 0) return TILE.SOLID;
  if (tx >= lv.cols) return TILE.EMPTY;
  return lv.tiles[ty * lv.cols + tx];
}

export const isSolid = (lv, tx, ty) => tileAt(lv, tx, ty) === TILE.SOLID;
