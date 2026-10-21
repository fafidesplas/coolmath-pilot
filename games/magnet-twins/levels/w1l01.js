// Vertical slice level: a mini Workshop (GDD 6, levels 2–4 in one room).
// Plus pulls the crate across the spikes, the crate is the step up, the door
// needs one robot on each lock plate, and the high bolt needs a launch.
export default {
  id: 'w1l01',
  name: 'Workshop Shift',
  par: { coop: 40, solo: 60 },
  tutorialDone: true,
  tiles: [
    '################################',
    '#....................#.........#',
    '#....................#.........#',
    '#....................#.........#',
    '#....................#.........#',
    '#....................#.........#',
    '#..............................#',
    '#..............................#',
    '#..............................#',
    '#.......##...###################',
    '#............###################',
    '#...^^.......###################',
    '################################',
    '################################',
    '################################',
    '################################',
  ],
  spawn: { plus: [9, 11], minus: [11, 11] },
  exit: [29, 7],
  bolts: [[8.5, 8], [4.5, 10], [24, 2]],
  objects: [
    { type: 'crate', x: 3, y: 11 },
    { type: 'door', id: 'd1', x: 21, y: 6, lock: 'any' },
    { type: 'plate', door: 'd1', x: 15, y: 5 },
    { type: 'plate', door: 'd1', x: 27, y: 5 },
  ],
};
