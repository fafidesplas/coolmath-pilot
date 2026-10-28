// Sculptures built from a picture (GDD 3.2). Pure and deterministic: the same
// picture, cuts, depth and seed always give the same blocks (simtest checks a
// fingerprint, so shipped levels can't change by accident).
// Every picture cell gets one block at a random depth in its column; then, while
// the sculpture is in several pieces, the cheapest bridge between two touching
// columns is filled with hidden blocks in one column. All blocks of a column share
// its color and shape, so from the front the sculpture is exactly the picture.
import { parsePicture, sideFull } from './shadow.js';

export const SCULPT_VERSION = 1;

// mulberry32
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NEIGHBORS = [[1, 0, 'r', 'l'], [-1, 0, 'l', 'r'], [0, 1, 't', 'b'], [0, -1, 'b', 't']];

// Connected pieces of a block list (face sharing; x/y sides only where both full).
export function components(blocks) {
  const at = new Map(blocks.map((b, i) => [`${b[0]},${b[1]},${b[2]}`, i]));
  const parent = blocks.map((_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const join = (a, b) => { parent[find(a)] = find(b); };
  blocks.forEach((b, i) => {
    const up = at.get(`${b[0]},${b[1]},${b[2] + 1}`);
    if (up !== undefined) join(i, up);
    for (const [dx, dy, s, o] of NEIGHBORS) {
      const j = at.get(`${b[0] + dx},${b[1] + dy},${b[2]}`);
      if (j !== undefined && sideFull(b[4], s) && sideFull(blocks[j][4], o)) join(i, j);
    }
  });
  return blocks.map((_, i) => find(i));
}

export function isConnected(blocks) {
  const c = components(blocks);
  return c.every(r => r === c[0]);
}

export function sculpt(picture, cuts, depth, seed) {
  const { cells } = parsePicture(picture, cuts);
  const rand = rng(seed);
  const col = new Map(cells.map(c => [`${c.x},${c.y}`, c]));
  const blocks = [];
  const has = new Set();
  const add = (c, z) => {
    const k = `${c.x},${c.y},${z}`;
    if (has.has(k)) return;
    has.add(k);
    blocks.push([c.x, c.y, z, c.color, c.shape]);
  };
  for (const c of cells) add(c, Math.floor(rand() * depth));

  for (let guard = 0; guard < 500; guard++) {
    const comp = components(blocks);
    if (comp.every(r => r === comp[0])) break;
    // Every pair of blocks in touching columns but in different pieces is a
    // candidate bridge; its cost is the number of blocks it adds.
    const zs = new Map();
    blocks.forEach((b, i) => {
      const k = `${b[0]},${b[1]}`;
      if (!zs.has(k)) zs.set(k, []);
      zs.get(k).push(i);
    });
    let best = [], bestCost = Infinity;
    for (const c of cells) {
      for (const [dx, dy, s, o] of NEIGHBORS) {
        const nb = col.get(`${c.x + dx},${c.y + dy}`);
        if (!nb || !sideFull(c.shape, s) || !sideFull(nb.shape, o)) continue;
        for (const i of zs.get(`${c.x},${c.y}`)) {
          for (const j of zs.get(`${nb.x},${nb.y}`)) {
            if (comp[i] === comp[j]) continue;
            const cost = Math.abs(blocks[i][2] - blocks[j][2]);
            if (cost < bestCost) { bestCost = cost; best = []; }
            if (cost === bestCost) best.push([c, blocks[i][2], blocks[j][2]]);
          }
        }
      }
    }
    if (!best.length) throw new Error('picture is not connected through full cell sides');
    const [c, za, zb] = best[Math.floor(rand() * best.length)];
    for (let z = Math.min(za, zb); z <= Math.max(za, zb); z++) add(c, z);
  }
  blocks.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2]);
  return blocks;
}

// Short stable hash of a block list (FNV-1a), for the generator fingerprint.
export function fingerprint(blocks) {
  let h = 0x811c9dc5;
  for (const b of blocks) for (const v of b) { h ^= v + 7; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
