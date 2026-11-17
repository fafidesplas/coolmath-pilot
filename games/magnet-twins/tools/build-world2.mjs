// World 2, Scrapyard: levels as drawings on a grid, same pattern as build-world1.mjs.
// Rows are 40 px; the floor surface is at row 12 (y = 480). `M` is a fixed metal plate.
//   node tools/build-world2.mjs [id …]      then: node tools/simtest.mjs --write --only=<id>
import { Grid, writeLevel } from './grid.mjs';

const only = process.argv.slice(2);
const levels = {};

// 11. Hang On: first fixed plates. A metal beam hangs over a spike field. Plus grabs it from
// below (monkey bars) and crosses; Minus jetpacks off the floor plate onto the top of the beam,
// where a gate blocks the way. Plus, across, holds the lock plate so Minus can walk over.
levels.w2l11 = () => {
  const g = new Grid();
  g.fill(4, 5, 12, 12, 'M');                  // floor plate: Minus's jetpack
  g.fill(8, 21, 8, 8, 'M');                   // the beam
  g.fill(9, 20, 11, 11, '^');                 // spikes under it
  g.fill(15, 15, 1, 4);                       // a wall over the gate on the beam
  return [{ id: 'w2l11', name: 'Hang On', spawn: { plus: [7, 11], minus: [2, 11] }, exit: [28, 10],
    bolts: [[14, 9], [11, 5], [24, 7]],
    objects: [{ type: 'door', id: 'd1', x: 15, y: 5, lock: 'any' }, { type: 'plate', door: 'd1', x: 26, y: 8 }] }, g];
};

// 12. Piggyback: fixed plates used on your twin. Plus rides on Minus's head: Minus dashes off
// the wall plate and jumps the spikes, then jetpacks off the floor plate up to the exit ledge.
levels.w2l12 = () => {
  const g = new Grid();
  g.fill(0, 0, 9, 11, 'M');                   // wall plate, set in the left wall: Minus's dash
  g.fill(4, 8, 11, 11, '^');                  // spikes, too wide to jump
  g.fill(14, 15, 12, 12, 'M');                // floor plate: Minus's jetpack
  g.fill(17, 30, 8, 11);                      // the exit ledge, 4 tiles up
  return [{ id: 'w2l12', name: 'Piggyback', spawn: { plus: [2, 11], minus: [1, 11] }, exit: [28, 6],
    bolts: [[1, 7], [12, 11], [16, 5]], objects: [] }, g];
};

// 13. Cable Car: first hanging platform. The upper floor has a gap too wide to jump; a platform
// hangs on a rail across it. Minus rides it while Plus, in the corridor below, pulls it along a
// step at a time. Across, Minus holds the lock plate so Plus can pass the door below, then
// drops through the hole by the wall.
levels.w2l13 = () => {
  const g = new Grid();
  g.fill(1, 9, 8, 8).fill(22, 28, 8, 8);      // the upper floor, with a gap from 10 to 21 and a hole at 29–30
  return [{ id: 'w2l13', name: 'Cable Car', spawn: { plus: [3, 11], minus: [4, 7] }, exit: [27, 10],
    bolts: [[15, 5], [1, 11], [24, 5]],
    objects: [{ type: 'platform', x: 10, y: 8, rail: 'h', from: 10, to: 21 },
      { type: 'door', id: 'd1', x: 24, y: 9, lock: 'any' }, { type: 'plate', door: 'd1', x: 27, y: 5 }] }, g];
};

for (const [id, build] of Object.entries(levels)) {
  if (only.length && !only.includes(id)) continue;
  const [spec, g] = build();
  writeLevel(spec, g);
  console.log('wrote', id);
}
