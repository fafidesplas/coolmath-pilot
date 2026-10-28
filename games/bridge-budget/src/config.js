// Every tuning number from GDD.md lives here, in one place. No DOM, so the sim
// and the tools can import it in Node. Physics units: meters, kg, newtons, seconds.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const TOP_H = 64;          // top bar, information only (GDD 3.1)
export const BAR_H = 96;          // toolbar
export const FIELD_Y = TOP_H;     // playfield: 1280 × 560 px between the bars
export const FIELD_W = 1280;
export const FIELD_H = 560;
export const CELL = 40;           // 1 grid cell = 1 m = 40 px
export const COLS = 32;
export const ROWS = 14;

// Simulation (GDD 3.2)
export const HZ = 120;
export const STEP = 1 / HZ;
export const SUBSTEPS = 8;
export const MAX_FRAME_DT = 0.05;
export const SIM = {
  gravity: 9.81,
  rampTime: 0.5,                  // gravity rises 0 → full over the first 0.5 s
  axialDamping: 100,              // /s, relative velocity along each member
  settleDamping: 8,               // /s, on bridge joints only, during the settle phase
  settleTime: 1.0,
  maxSpeed: 30,                   // m/s velocity clamp
  minJointMass: 10,               // kg
  breakStretch: 1.5,              // a member stretched past 150% of its rest length breaks
  debrisY: ROWS + 2,              // joints this far down stop simulating
};
export const SIM_VERSION = 1;     // bump when a change would alter saved bests

// Materials (GDD 3.3). ea in N, limits in N, mass in kg/m, cost in $/m.
export const MATERIALS = {
  road:  { cost: 200, max: 2.5, mass: 60, ea: 4.0e6, tension: 40e3, compression: 40e3, key: 1, name: 'Road' },
  wood:  { cost: 100, max: 3,   mass: 20, ea: 1.0e6, tension: 30e3, compression: 30e3, key: 2, name: 'Wood' },
  steel: { cost: 250, max: 4,   mass: 40, ea: 3.0e6, tension: 90e3, compression: 90e3, key: 3, name: 'Steel' },
  cable: { cost: 60,  max: 14,  mass: 6,  ea: 3.0e6, tension: 80e3, compression: 0,    key: 4, name: 'Cable' },
};
export const MATERIAL_ORDER = ['road', 'wood', 'steel', 'cable'];
export const UNLOCK = { road: 1, wood: 2, steel: 5, cable: 14 };   // level number

// Vehicles (GDD 3.5)
export const VEHICLES = {
  car:   { mass: 1000, base: 1.4, r: 0.3, cruise: 5,   name: 'Car',   tons: 1 },
  truck: { mass: 3000, base: 2.0, r: 0.4, cruise: 4,   name: 'Truck', tons: 3 },
  bus:   { mass: 4000, base: 3.0, r: 0.4, cruise: 3.5, name: 'Bus',   tons: 4 },
};
export const DRIVE = {
  accel: 3,                       // m/s² up to cruise
  mu: 0.7,                        // tyre friction
  engine: 0.55,                   // drive force cap, × g × vehicle mass
  startBefore: 4,                 // front wheel starts 4 m before the gap edge
  convoyGap: 2.5,
};

// Test rules (GDD 3.7)
export const TEST = {
  fallDepth: 4,                   // center 4 m below the lower bank top
  stuckDist: 0.2, stuckTime: 3,
  timeout: 30,
  afterPass: 1.5,                 // keep simulating after the pass, then results
  stampDelay: 0.5, stampShow: 1.2,
  closeCall: 0.95,
  slowmo: 0.3, slowmoTime: 1.0,
  fast: 2,
};

// Building (GDD 3.4)
export const BUILD = {
  pickMouse: 0.75,                // cells
  pickTouch: 1.0,
  clickSlop: 8,                   // px: press and release closer than this = click-click
  maxMembers: 160,
  maxJoints: 100,
  eraseDist: 0.3,                 // cells from a member
  autosave: 1.0,                  // s after a change
  steep: 1,                       // |dy| ≥ |dx| (45°) shows "Steep!"
};

export const STARS = { target: 105, budget: 130 };   // percent of the reference cost
export const HINT_AFTER = 3;

export const COLORS = {
  cream: '#F6EFE3',
  ink: '#2B2B2B',
  blue: '#4AA3DF',
  steel: '#47708F',
  green: '#5CC46B',
  yellow: '#FFC93C',
  wood: '#C98F55',
  earth: '#A86E3F',
  red: '#EF5B5B',
  grey: '#9A948A',
};

export const SAVE_KEY = 'cm_bridge-budget_save';
export const SETTINGS_KEY = 'cm_bridge-budget_settings';
