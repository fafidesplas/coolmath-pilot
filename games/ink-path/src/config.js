// Every tuning number from GDD.md lives here, in one place. No DOM, so the sim
// and the tools can import it in Node.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 80;
export const FIELD_W = 1280;     // playfield (GDD 3.1), origin at its top-left, y down
export const FIELD_H = 640;

export const HZ = 120;
export const STEP = 1 / HZ;
export const MAX_FRAME_DT = 0.05;
export const SIM_VERSION = 1;    // bump when a change would alter saved best lines

// Dot (GDD 3.3)
export const BALL = {
  r: 18,
  gravity: 1800,
  maxSpeed: 1500,
  roll: 60,                      // rolling resistance, px/s² while touching anything
};

// Contacts (GDD 3.3)
export const CONTACT = {
  glance: 0.42261826174069944,   // sin 25°, a literal so the sim never calls Math.sin
  wallBounce: 0.3,
  bounceMin: 60,                 // walls bounce only when hit faster than this
  lip: 10,                       // stroke ends and convex corners up to this far into the path roll over
  lipKeep: 0.95,
  passes: 4,
};

// Pen and ink (GDD 3.4)
export const PEN = {
  inkR: 5,                       // capsule radius: contact distance 18 + 5 = 23 px
  lazy: 4,                       // lazy string length
  spacing: 6,                    // a point every 6 px of tip motion
  minLen: 20,                    // shorter lines are ignored
  rdp: 1.5,
  resume: 40,                    // pointer back within this of the tip resumes a blocked line
  ballClear: 32,                 // no ink within this of a waiting ball
  redrawDrag: 6,                 // drag this far during a run to abandon it
};

export const DROP_DELAY = 0.15;  // ink "sets", then the trapdoors open

// Failing fast (GDD 3.6)
export const FAIL = {
  margin: 40,                    // lost when the center leaves the playfield by this much
  box: 12,                       // half of the 24 × 24 px stuck box
  boxSteps: 120,                 // 1.0 s
  turnSpeed: 60,
  turns: 2,
  loopDist: 8,
  loopSpeed: 30,
  loopMinSteps: 60,              // 0.5 s
  loopMaxSteps: 480,             // 4 s
  sampleEvery: 6,                // loop history sample every 50 ms
  timeoutSteps: 12 * 120,
  feedback: 0.3,                 // face and bubble before the reset
  reset: 0.25,
};

// Cups (GDD 3.7)
export const CUP = {
  wall: 12,
  depth: 64,
  inset: 6,                      // capture when within (w/2 − 6) of the center line
  above: 12,                     // ... and lower than 12 px above the rim
  close: 24,                     // "So close!" when a lost ball passed this near the mouth
};
export const WIN_DELAY = 1.0;    // results follow about 1 s after the last capture

export const HINT_AFTER = 3;     // failed attempts before the hint button shows

export const COLORS = {
  paper: '#F6EFE3',
  outline: '#2B2B2B',
  ink: '#3A6FD8',
  coral: '#EF5B5B',
  green: '#5CC46B',
  yellow: '#FFC93C',
  card: '#E7D3B0',               // cardboard: a shade of paper
  grey: '#9A948A',
};

export const SAVE_KEY = 'cm_ink-path_save';
export const SETTINGS_KEY = 'cm_ink-path_settings';
