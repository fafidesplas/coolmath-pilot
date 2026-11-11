// Turns a level module (GDD 6, level data format) into static level data.
import { T, ROWS, HZ } from './config.js';

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

  const lv = { id: data.id, cols, tiles, speed: data.speed, stars: [], flags: [], hints: [], portals: [], movers: [], pads: [], switches: [], goal: cols * T };
  for (const o of data.objects || []) {
    if (o.type === 'star') lv.stars.push({ x: (o.x + 0.5) * T, y: (o.y + 0.5) * T });
    else if (o.type === 'flag') lv.flags.push({ x: o.x * T, ty: o.y });
    else if (o.type === 'goal') lv.goal = o.x * T;
    else if (o.type === 'hint') lv.hints.push({ x: o.x * T, label: o.label || 'TAP!' });
    else if (o.type === 'mover') lv.movers.push({ x0: o.x * T, y0: o.y * T, w: o.w * T, h: o.h * T, dx: (o.dx || 0) * T, dy: (o.dy || 0) * T, per: Math.round((o.period || 3) * HZ), ph: Math.round((o.phase || 0) * HZ) });
    // a speed gate across the whole corridor: from its column on, the speed is the level's speed times mult
    else if (o.type === 'pad') lv.pads.push({ x0: o.x * T, x1: (o.x + (o.len || 3)) * T, mult: o.mult });
    // a gravity switch: a disc at the centre of tile (x, y); touching it sets gravity to g (1 down, -1 up)
    else if (o.type === 'switch') lv.switches.push({ x: (o.x + 0.5) * T, y: (o.y + 0.5) * T, g: o.g });
    else if (o.type === 'portal') lv.portals.push({ x: o.x * T, form: o.form, lanes: o.lanes || null });
  }
  lv.flags.sort((a, b) => a.x - b.x);
  lv.portals.sort((a, b) => a.x - b.x);
  lv.pads.sort((a, b) => a.x0 - b.x0);
  lv.switches.sort((a, b) => a.x - b.x);
  lv.start = data.start;
  // Current and previous rectangles of every moving block (rewritten each step by the sim).
  lv.mv = lv.movers.map(m => ({ x: m.x0, y: m.y0, w: m.w, h: m.h }));
  lv.mvPrev = lv.movers.map(m => ({ x: m.x0, y: m.y0, w: m.w, h: m.h }));
  return lv;
}

export function tileAt(lv, tx, ty) {
  if (ty < 0 || ty >= ROWS) return TILE.EMPTY;           // open above and below: falling out kills
  if (tx < 0) return TILE.SOLID;
  if (tx >= lv.cols) return TILE.EMPTY;
  return lv.tiles[ty * lv.cols + tx];
}

export const isSolid = (lv, tx, ty) => tileAt(lv, tx, ty) === TILE.SOLID;
