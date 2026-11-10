// Level kit (phase 3a): build a level as a small program instead of typing a
// 16-row text grid. Columns are tiles (1 tile = 40 px = 1/11 s at world 1 speed).
//
//   const c = new Cave(330);
//   c.room(92, 129, 2, 11);          // a tall room: open rows 2..10
//   c.floorSpikes(96, 99);           // spikes on whatever the floor is there
//   c.island(50, 70, 7, 8);          // a platform of solid rows 7..8
//   c.star(105, 2); c.flagFloor(80); c.hint(6);
//   writeLevel('w1l02', 'Ping Pong', c, { speed: 440 });
import { writeFileSync } from 'node:fs';

export const ROWS = 16;

export class Cave {
  constructor(cols, top = 5, bottom = 11) {
    this.cols = cols;
    this.top = Array(cols).fill(top);          // first open row
    this.bottom = Array(cols).fill(bottom);    // first floor row
    this.fs = new Set();                       // floor spikes (on the local floor)
    this.cs = new Set();                       // ceiling spikes (on the local ceiling)
    this.floorGap = new Set();
    this.ceilGap = new Set();
    this.cells = new Map();                    // 'c,r' -> char override
    this.objects = [];
    this.speed = 440;                          // the level's speed: movers need it (see mover())
  }

  // Set the corridor for columns c0..c1 (inclusive): open rows top..bottom-1.
  room(c0, c1, top, bottom) {
    for (let c = c0; c <= c1; c++) { this.top[c] = top; this.bottom[c] = bottom; }
    return this;
  }
  // Move the floor (or ceiling) one tile at a time between two columns, so every
  // step is a 1-tile auto-step instead of a wall.
  rampFloor(c0, from, to) {
    const dir = Math.sign(to - from); let c = c0;
    for (let r = from; r !== to + dir; r += dir, c += 3) this.room(c, c + 2, this.top[c], r);
    return c;
  }
  rampCeil(c0, from, to) {
    const dir = Math.sign(to - from); let c = c0;
    for (let r = from; r !== to + dir; r += dir, c += 3) this.room(c, c + 2, r, this.bottom[c]);
    return c;
  }
  // A column of rock from the floor and the ceiling of the local room, leaving a gap of
  // open rows gapTop..gapBottom (inclusive). Glider rooms are full of these.
  pillar(c, gapTop, gapBottom, width = 2) {
    for (let k = 0; k < width; k++) {
      const col = c + k;
      for (let r = this.top[col]; r < gapTop; r++) this.put(col, r, '#');
      for (let r = gapBottom + 1; r < this.bottom[col]; r++) this.put(col, r, '#');
    }
    return this;
  }
  // Open the corridor from the standard 5..11 to top..bottom (or back) in 1-tile steps.
  // Returns the first column after the funnel.
  funnel(c0, topFrom, topTo, botFrom, botTo) {
    const e1 = this.rampCeil(c0, topFrom, topTo), e2 = this.rampFloor(c0, botFrom, botTo);
    return Math.max(e1, e2);
  }
  floorSpikes(c0, c1) { for (let c = c0; c <= c1; c++) this.fs.add(c); return this; }
  ceilSpikes(c0, c1) { for (let c = c0; c <= c1; c++) this.cs.add(c); return this; }
  floorGapAt(c0, c1) { for (let c = c0; c <= c1; c++) this.floorGap.add(c); return this; }
  ceilGapAt(c0, c1) { for (let c = c0; c <= c1; c++) this.ceilGap.add(c); return this; }
  put(c, r, ch) { this.cells.set(`${c},${r}`, ch); return this; }
  block(c0, c1, r0, r1, ch = '#') {
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) this.put(c, r, ch);
    return this;
  }
  // A platform with optional spikes on its top and underside (column ranges).
  island(c0, c1, r0, r1, { top = [], under = [] } = {}) {
    this.block(c0, c1, r0, r1);
    for (const [a, b] of top) for (let c = a; c <= b; c++) this.put(c, r0 - 1, '^');
    for (const [a, b] of under) for (let c = a; c <= b; c++) this.put(c, r1 + 1, 'v');
    return this;
  }

  // A block that slides from (x, y) to (x + dx, y + dy) and back, one round trip per `period` seconds.
  // The bat runs at a constant speed, so when it reaches a block is fixed: the block's phase
  // decides what it finds. `at` says where on its path the block is at that moment:
  // 'start' (resting at its first position), 'far' (at the far end), 'out' (halfway, going
  // out), 'back' (halfway, coming back). `ref` is the part of the block the bat reaches:
  // 'left' (its left edge) or 'center'.
  mover(x, y, w, h, dx, dy, period, at = 'start', ref = 'center') {
    const stepsPerCol = 40 / (this.speed / 120);
    const arriveCol = ref === 'left' ? x : x + w / 2;
    const arrive = Math.round((arriveCol * 40 - 140) / (this.speed / 120));   // bat starts at x = 128 (+12 to its center)
    const per = Math.round(period * 120);
    const u = { start: 0, far: 0.5, out: 0.25, back: 0.75 }[at];
    const ph = (((Math.round(u * per) - arrive) % per) + per) % per;
    this.objects.push({ type: 'mover', x, y, w, h, dx, dy, period, phase: Math.round(ph / 120 * 1e6) / 1e6 });
    return this;
  }

  star(c, r) { this.objects.push({ type: 'star', x: c, y: r }); return this; }
  flag(c, r) { this.objects.push({ type: 'flag', x: c, y: r }); return this; }
  flagFloor(c) { return this.flag(c, this.bottom[c] - 1); }
  flagCeiling(c) { return this.flag(c, this.top[c]); }
  hint(c, label) { this.objects.push(label ? { type: 'hint', x: c, label } : { type: 'hint', x: c }); return this; }
  portal(c, form, lanes) { this.objects.push(lanes ? { type: 'portal', x: c, form, lanes } : { type: 'portal', x: c, form }); return this; }
  goal(c) { this.objects.push({ type: 'goal', x: c }); return this; }

  // Cut the map to just past the goal (never longer than it was built).
  fit() {
    const g = this.objects.find(o => o.type === 'goal');
    if (g) this.cols = Math.min(this.cols, g.x + 14);
    return this;
  }

  rows() {
    const out = [];
    for (let r = 0; r < ROWS; r++) {
      let line = '';
      for (let c = 0; c < this.cols; c++) {
        let ch = '.';
        if (r < this.top[c] && !this.ceilGap.has(c)) ch = '#';
        if (r >= this.bottom[c] && !this.floorGap.has(c)) ch = '#';
        const o = this.cells.get(`${c},${r}`);
        if (o) ch = o;
        if (this.fs.has(c) && r === this.bottom[c] - 1 && ch === '.') ch = '^';
        if (this.cs.has(c) && r === this.top[c] && ch === '.') ch = 'v';
        line += ch;
      }
      out.push(line);
    }
    return out;
  }
}

export function writeLevel(id, name, cave, { speed = 440, start = { x: 3, y: 10, gravity: 1 }, dir = new URL('../levels/', import.meta.url) } = {}) {
  cave.fit();
  const rows = cave.rows();
  const level = { id, name, speed, start, tiles: rows, objects: cave.objects };
  const body = JSON.stringify(level, null, 2)
    .replace(/"tiles": \[[^\]]*\]/s, () => `"tiles": [\n${rows.map(r => `    '${r}',`).join('\n')}\n  ]`);
  writeFileSync(new URL(`${id}.js`, dir), `// ${name}. Generated by tools/build-world1.mjs (the level kit).\nexport default ${body};\n`);
  return level;
}
