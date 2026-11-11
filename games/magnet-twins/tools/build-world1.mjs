// World 1, Workshop: levels as drawings on a grid. Rows are 40 px; the floor surface is at
// row 12 (y = 480). Spawn rows are the row the robot stands in.
//   node tools/build-world1.mjs [id …]      then: node tools/simtest.mjs --write
import { Grid, writeLevel } from './grid.mjs';

const only = process.argv.slice(2);
const levels = {};

// 1. Hello, Twins: no metal. A staircase, a shared exit, a bolt too high for one jump.
levels.w1l01 = () => {
  const g = new Grid();
  g.fill(8, 10, 10, 11).fill(11, 13, 8, 11).fill(14, 16, 6, 11).fill(17, 30, 6, 11);   // steps up to a plateau
  g.fill(21, 24, 3, 3);                                                                 // a shelf 3 tiles above the plateau
  return [{ id: 'w1l01', name: 'Hello, Twins', spawn: { plus: [2, 11], minus: [4, 11] }, exit: [27, 4],
    bolts: [[5, 11], [12, 7], [22, 2]], tutorialDone: false, objects: [] }, g];
};

// 2. Pull: a crate beyond the spikes. Plus pulls it over; it is the step up the ledge.
levels.w1l02 = () => {
  const g = new Grid();
  g.fill(13, 30, 9, 11);
  g.put(4, 11, '^').put(5, 11, '^');
  return [{ id: 'w1l02', name: 'Pull', spawn: { plus: [9, 11], minus: [11, 11] }, exit: [28, 7], bolts: [[6, 11], [13, 8], [17, 6]],
    objects: [{ type: 'crate', x: 3, y: 11 }] }, g];
};

// 3. Push: a crate on a high shelf. Minus pushes it off; it lands by the ledge and is the step.
levels.w1l03 = () => {
  const g = new Grid();
  g.fill(3, 5, 10, 11).fill(6, 11, 9, 11);          // a step, then a shelf 3 tiles up
  g.fill(17, 30, 9, 11);                            // the ledge with the exit
  return [{ id: 'w1l03', name: 'Push', spawn: { plus: [1, 11], minus: [2, 11] }, exit: [28, 7], bolts: [[8, 8], [14, 11], [22, 6]],
    objects: [{ type: 'crate', x: 11, y: 8 }] }, g];
};

// 4. Hold the Door: one robot holds the lock plate while the other goes through.
levels.w1l04 = () => {
  const g = new Grid();
  g.fill(16, 16, 1, 8);                             // the wall over the door
  return [{ id: 'w1l04', name: 'Hold the Door', spawn: { plus: [4, 11], minus: [6, 11] }, exit: [28, 10], bolts: [[8, 11], [20, 11], [26, 9]],
    objects: [{ type: 'door', id: 'd1', x: 16, y: 9, lock: 'any' }, { type: 'plate', door: 'd1', x: 9, y: 10 }, { type: 'plate', door: 'd1', x: 23, y: 10 }] }, g];
};

// 5. Your Lock, My Lock: two corridors. Plus opens Minus's + door, Minus opens Plus's − door.
levels.w1l05 = () => {
  const g = new Grid();
  g.fill(1, 25, 8, 8);                              // a slab: the floor of the upper corridor, the ceiling of the lower
  g.fill(7, 25, 1, 4);                              // the roof of the upper corridor
  return [{ id: 'w1l05', name: 'Your Lock, My Lock', spawn: { plus: [2, 11], minus: [2, 7] }, exit: [28, 10], bolts: [[5, 11], [10, 7], [20, 11]],
    objects: [{ type: 'door', id: 'd1', x: 14, y: 5, lock: 'plus' }, { type: 'plate', door: 'd1', x: 8, y: 10 },
      { type: 'door', id: 'd2', x: 14, y: 9, lock: 'minus' }, { type: 'plate', door: 'd2', x: 22, y: 6 }] }, g];
};

// 6. Boost: a ledge 4 tiles up. Minus launches Plus; Plus then pulls Minus up.
levels.w1l06 = () => {
  const g = new Grid();
  g.fill(14, 30, 8, 11);
  g.fill(11, 12, 11, 11);                           // a one-tile step in front of the ledge
  return [{ id: 'w1l06', name: 'Boost', spawn: { plus: [3, 11], minus: [5, 11] }, exit: [28, 6], bolts: [[8, 11], [18, 7], [12, 8]], objects: [] }, g];
};

// 7. Tower: a 4-tile wall and a crate at its foot. Stand on the crate, stack, climb; the last one is pulled up.
levels.w1l07 = () => {
  const g = new Grid();
  g.fill(14, 30, 8, 11);
  return [{ id: 'w1l07', name: 'Tower', spawn: { plus: [2, 11], minus: [4, 11] }, exit: [28, 6], bolts: [[6, 11], [9, 8], [18, 7]],
    objects: [{ type: 'crate', x: 13, y: 11 }] }, g];
};

// 10. Workshop Exam: the slice level. Pull the crate across the spikes, step up on it, hold
// the door for each other. (To be extended into the real exam with a launch and a checkpoint.)
levels.w1l10 = () => {
  const g = new Grid();
  g.fill(21, 21, 1, 5);                       // the wall above the door
  g.fill(8, 9, 9, 9);                         // a little block
  g.fill(13, 30, 9, 11);                      // the plateau
  g.put(4, 11, '^').put(5, 11, '^');
  return [{ id: 'w1l10', name: 'Workshop Exam', spawn: { plus: [9, 11], minus: [11, 11] }, exit: [29, 7], bolts: [[8, 8], [11, 9], [24, 6]],
    objects: [{ type: 'crate', x: 3, y: 11 }, { type: 'door', id: 'd1', x: 21, y: 6, lock: 'any' }, { type: 'plate', door: 'd1', x: 15, y: 5 }, { type: 'plate', door: 'd1', x: 27, y: 5 }] }, g];
};

for (const [id, build] of Object.entries(levels)) {
  if (only.length && !only.includes(id)) continue;
  const [spec, g] = build();
  writeLevel(spec, g);
  console.log('wrote', id);
}
