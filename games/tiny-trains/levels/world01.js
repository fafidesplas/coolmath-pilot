// World 1 — Village (GDD 6), levels 1-1 to 1-8. Same shape as the GDD's level JSON,
// kept as a JS module so the browser and node can both import it without fetch.
// rot: 0–3 clockwise from north. Switch `set`: 0 straight, 1 curved (the start).
// For a switch, rot is the heading of a facing train on the straight branch; the
// curved branch turns right of it (left with mirror). See src/track.js.
// `par` and `solution` are checked by tools/simtest.mjs (brute force over all setups).

const st = (x, y, rot) => ({ x, y, t: 'straight', rot });
const cv = (x, y, rot) => ({ x, y, t: 'curve', rot });
const sw = (x, y, rot, mirror, set) => ({ x, y, t: 'switch', rot, mirror, set });
const station = (x, y, rot, color) => ({ x, y, t: 'station', rot, color });
const buffer = (x, y, rot) => ({ x, y, t: 'buffer', rot });
const depot = (x, y, rot) => ({ x, y, t: 'depot', rot });

export default [
  {
    id: 'world01:level01',
    name: 'First Switch',
    tip: 'Tap the switch, then press GO.',
    w: 5, h: 3,
    tiles: [
      depot(0, 1, 1), st(1, 1, 1), sw(2, 1, 1, false, 0), st(3, 1, 1), buffer(4, 1, 3),
      cv(2, 2, 0), st(3, 2, 1), station(4, 2, 3, 'red'),
    ],
    trains: [{ id: 0, color: 'red', depot: [0, 1], depart: 0 }],
    tickLimit: 20,
    par: 1,
    solution: { switches: { '2,1': 1 } },
    tutorial: true,
  },
  {
    id: 'world01:level02',
    name: 'Two Turns',
    tip: 'Trace the path: every switch must point the right way.',
    w: 6, h: 3,
    tiles: [
      cv(1, 0, 1), st(2, 0, 1), st(3, 0, 1), st(4, 0, 1), buffer(5, 0, 3),
      depot(0, 1, 1), sw(1, 1, 1, true, 1), st(2, 1, 1), sw(3, 1, 1, false, 0), st(4, 1, 1), buffer(5, 1, 3),
      cv(3, 2, 0), st(4, 2, 1), station(5, 2, 3, 'red'),
    ],
    trains: [{ id: 0, color: 'red', depot: [0, 1], depart: 0 }],
    tickLimit: 20,
    par: 2,
    solution: { switches: { '1,1': 0, '3,1': 1 } },
  },
  {
    id: 'world01:level03',
    name: 'Two Colors',
    tip: 'Each train stops only at its own color and shape.',
    w: 6, h: 4,
    tiles: [
      depot(0, 0, 1), st(1, 0, 1), sw(2, 0, 1, false, 1), st(3, 0, 1), st(4, 0, 1), station(5, 0, 3, 'red'),
      cv(2, 1, 0), st(3, 1, 1), cv(4, 1, 2),
      depot(0, 2, 1), sw(1, 2, 1, false, 1), st(2, 2, 1), st(3, 2, 1), sw(4, 2, 3, false, 0), station(5, 2, 3, 'blue'),
      cv(1, 3, 0), st(2, 3, 1), st(3, 3, 1), st(4, 3, 1), buffer(5, 3, 3),
    ],
    trains: [
      { id: 0, color: 'red', depot: [0, 0], depart: 0 },
      { id: 1, color: 'blue', depot: [0, 2], depart: 0 },
    ],
    tickLimit: 24,
    par: 2,
    solution: { switches: { '2,0': 0, '1,2': 0, '4,2': 0 } },
  },
  {
    id: 'world01:level04',
    name: 'Merge',
    tip: 'Coming in from a branch, a switch always lets you through.',
    w: 7, h: 4,
    tiles: [
      depot(0, 0, 1), sw(1, 0, 1, false, 1), st(2, 0, 1), st(3, 0, 1), st(4, 0, 1), st(5, 0, 1), buffer(6, 0, 3),
      cv(1, 1, 0), st(2, 1, 1), sw(3, 1, 3, true, 0), st(4, 1, 1), st(5, 1, 1), station(6, 1, 3, 'red'),
      depot(0, 2, 1), sw(1, 2, 1, false, 0), st(2, 2, 1), cv(3, 2, 3),
      cv(1, 3, 0), st(2, 3, 1), st(3, 3, 1), st(4, 3, 1), st(5, 3, 1), station(6, 3, 3, 'blue'),
    ],
    trains: [
      { id: 0, color: 'red', depot: [0, 0], depart: 0 },
      { id: 1, color: 'blue', depot: [0, 2], depart: 0 },
    ],
    ticket: [4, 3],
    tickLimit: 24,
    par: 1,
    solution: { switches: { '1,0': 1, '3,1': 0, '1,2': 1 } },
  },
  {
    id: 'world01:level05',
    name: 'Wait Your Turn',
    tip: 'Watch the clocks: blue leaves 3 ticks later.',
    w: 7, h: 4,
    tiles: [
      station(0, 0, 1, 'red'), st(1, 0, 1), cv(2, 0, 2),
      depot(0, 1, 1), st(1, 1, 1), sw(2, 1, 3, false, 0), sw(3, 1, 1, false, 0), sw(4, 1, 1, false, 0), st(5, 1, 1), station(6, 1, 3, 'blue'),
      cv(2, 2, 1), cv(3, 2, 3), st(4, 2, 0),
      cv(2, 3, 0), st(3, 3, 1), sw(4, 3, 3, false, 1), st(5, 3, 1), depot(6, 3, 3),
    ],
    trains: [
      { id: 0, color: 'red', depot: [6, 3], depart: 0 },
      { id: 1, color: 'blue', depot: [0, 1], depart: 3 },
    ],
    ticket: [3, 3],
    tickLimit: 30,
    par: 2,
    solution: { switches: { '2,1': 1, '3,1': 0, '4,1': 0, '4,3': 0 } },
  },
  {
    id: 'world01:level06',
    name: 'Scenic Route',
    tip: 'The ticket is on the long way round. Who can take it safely?',
    w: 7, h: 5,
    tiles: [
      depot(0, 1, 1), sw(1, 1, 1, false, 1), st(2, 1, 1), st(3, 1, 1), st(4, 1, 1), sw(5, 1, 3, true, 0), station(6, 1, 3, 'red'),
      cv(1, 2, 0), sw(2, 2, 3, true, 1), st(3, 2, 1), sw(4, 2, 1, false, 1), cv(5, 2, 3),
      station(0, 3, 1, 'blue'), st(1, 3, 1), sw(2, 3, 1, true, 0), st(3, 3, 1), sw(4, 3, 3, false, 1), st(5, 3, 1), depot(6, 3, 3),
    ],
    trains: [
      { id: 0, color: 'red', depot: [0, 1], depart: 0 },
      { id: 1, color: 'blue', depot: [6, 3], depart: 0 },
    ],
    ticket: [5, 2],
    tickLimit: 24,
    par: 2,
    solution: { switches: { '1,1': 1, '4,2': 0, '4,3': 0 } },
  },
];
