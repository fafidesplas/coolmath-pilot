// Turns a level module (GDD 6, level data format) into the sim's starting state.
import { T, COLS, ROWS, ROBOT, CRATE } from './config.js';

export const TILE = { EMPTY: 0, SOLID: 1, METAL: 2, SPIKES: 3, WATER: 4 };
const CHARS = { '.': TILE.EMPTY, '#': TILE.SOLID, M: TILE.METAL, '^': TILE.SPIKES, '~': TILE.WATER };

export function parseLevel(data) {
  if (data.tiles.length !== ROWS) throw new Error(`${data.id}: needs ${ROWS} rows`);
  const tiles = new Uint8Array(COLS * ROWS);
  data.tiles.forEach((row, y) => {
    if (row.length !== COLS) throw new Error(`${data.id}: row ${y} has ${row.length} chars`);
    for (let x = 0; x < COLS; x++) {
      const t = CHARS[row[x]];
      if (t === undefined) throw new Error(`${data.id}: bad tile '${row[x]}' at ${x},${y}`);
      tiles[y * COLS + x] = t;
    }
  });

  // Robots stand on the floor of their spawn tile.
  const robotAt = ([tx, ty]) => ({
    x: tx * T + (T - ROBOT.w) / 2,
    y: (ty + 1) * T - ROBOT.h,
  });

  const crates = [], doors = [], plates = [], checkpoints = [];
  for (const o of data.objects || []) {
    if (o.type === 'crate') crates.push({ x: o.x * T, y: o.y * T + (T - CRATE.size) });
    else if (o.type === 'door') doors.push({ id: o.id, tx: o.x, ty: o.y, lock: o.lock || 'any' });
    else if (o.type === 'plate') plates.push({ door: o.door, x: (o.x + 0.5) * T, y: (o.y + 0.5) * T });
    else if (o.type === 'checkpoint') checkpoints.push({ x: o.x, y: o.y });
  }

  return {
    id: data.id,
    tiles,
    spawn: { plus: robotAt(data.spawn.plus), minus: robotAt(data.spawn.minus) },
    exit: { x: data.exit[0] * T, y: data.exit[1] * T, w: 2 * T, h: 2 * T },
    bolts: (data.bolts || []).map(([bx, by]) => ({ x: (bx + 0.5) * T, y: (by + 0.5) * T })),
    crates, doors, plates, checkpoints,
  };
}

export function tileAt(tiles, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return TILE.SOLID;
  return tiles[ty * COLS + tx];
}
