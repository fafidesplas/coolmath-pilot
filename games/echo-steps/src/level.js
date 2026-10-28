// Turns a room (GDD 6, level data format) into static room data for the sim.
// The vertical slice supports tiles, spawn, exit, plates, gates (normal, AND,
// inverted) and cues; later elements throw so a room never silently misbehaves.
import { T, COLS, ROWS, HZ, PLAYER, EXIT_INNER, CHANNELS } from './config.js';

export const TILE = { EMPTY: 0, SOLID: 1, ONEWAY: 2 };
const CHARS = { '.': TILE.EMPTY, '#': TILE.SOLID, '-': TILE.ONEWAY };

const chIndex = (id, c) => {
  const i = CHANNELS.indexOf(c);
  if (i < 0) throw new Error(`${id}: bad channel '${c}'`);
  return i;
};

export function parseLevel(d) {
  if (d.tiles.length !== ROWS) throw new Error(`${d.id}: needs ${ROWS} rows`);
  const tiles = new Uint8Array(COLS * ROWS);
  d.tiles.forEach((row, y) => {
    if (row.length !== COLS) throw new Error(`${d.id}: row ${y} has ${row.length} chars, want ${COLS}`);
    for (let x = 0; x < COLS; x++) {
      const t = CHARS[row[x]];
      if (t === undefined) throw new Error(`${d.id}: bad tile '${row[x]}' at ${x},${y}`);
      if (t === TILE.ONEWAY) throw new Error(`${d.id}: one-way ledges are not in the slice yet`);
      tiles[y * COLS + x] = t;
    }
  });
  const loopSteps = Math.round(d.loop * HZ);
  if (d.loop < 5 || d.loop > 10) throw new Error(`${d.id}: loop must be 5–10 s`);
  const lv = {
    id: d.id, name: d.name, tiles, loopSteps, loop: d.loop,
    slots: d.slots || 4,
    par: { echoes: d.par.echoes, time: d.par.time },
    spawn: { col: d.spawn[0], row: d.spawn[1], x: d.spawn[0] * T + (T - PLAYER.w) / 2, y: (d.spawn[1] + 1) * T - PLAYER.h },
    exit: {
      col: d.exit.x, row: d.exit.y, lock: !!d.exit.lock,
      x: d.exit.x * T + (T - EXIT_INNER.w) / 2, y: (d.exit.y + 1) * T - EXIT_INNER.h, w: EXIT_INNER.w, h: EXIT_INNER.h,
    },
    plates: [], gates: [], cues: [],
  };
  for (const o of d.objects || []) {
    if (o.type === 'plate') {
      lv.plates.push({ col: o.x, row: o.y, x0: o.x * T, x1: o.x * T + T, y: (o.y + 1) * T, ch: chIndex(d.id, o.ch) });
    } else if (o.type === 'gate') {
      const list = Array.isArray(o.on) ? o.on : [o.on];
      let mask = 0;
      for (const c of list) mask |= 1 << chIndex(d.id, c);
      lv.gates.push({ col: o.x, row: o.y, h: o.h, x: o.x * T, y: o.y * T, w: T, hpx: o.h * T, mask, chans: list.map(c => chIndex(d.id, c)), invert: !!o.invert });
    } else if (o.type === 'cue') {
      lv.cues.push({ ...o });
    } else {
      throw new Error(`${d.id}: '${o.type}' is not in the vertical slice yet`);
    }
  }
  return lv;
}

export const tileAt = (lv, c, r) => (c < 0 || c >= COLS || r < 0 || r >= ROWS ? TILE.SOLID : lv.tiles[r * COLS + c]);
export const isSolid = (lv, c, r) => tileAt(lv, c, r) === TILE.SOLID;

// Gate open state wanted for a channel bitmask (AND over its channels, then invert).
export const gateWants = (g, ch) => ((ch & g.mask) === g.mask) !== g.invert;
