// The solution script of every level: macro-actions run by the bot in co-op and in solo.
// Coordinates are pixels (a tile is 40 px; a robot is ~30 wide and 36 tall).
import { B } from '../src/config.js';
const T = 40;
const col = c => c * T + T / 2;       // x of the middle of a column

export const SCRIPTS = {};

// 1. Hello, Twins
SCRIPTS.w1l01 = b => {
  b.walkTo(1, col(5));                                  // Minus takes the bolt on the ground
  for (const i of [0, 1]) {                             // both climb the staircase
    b.hopTo(i, col(9), 400);
    b.hopTo(i, col(12), 320);
    b.hopTo(i, col(15), 240);
    b.hopTo(i, col(18), 240);
  }
  // Plus stands on Minus's head to reach the shelf (3 tiles up) and its bolt
  b.walkTo(1, col(20));
  b.hopTo(0, col(20), b.R[1].y);
  b.hopTo(0, col(22), 120);
  b.walkTo(0, col(28));                                  // Plus first, so Minus can still reach the exit
  b.walkTo(1, col(27));
  b.wait(60);
};

// 2. Pull
SCRIPTS.w1l02 = b => {
  const crate = b.sim.crates[0];
  b.walkTo(1, 505);
  b.walkTo(0, 258);                                      // takes the bolt, then pulls the crate across the spikes
  b.power(0, true);
  b.wait(80);
  b.walkTo(0, 430);                                      // carries it to the ledge, then lets go
  b.power(0, false);
  b.wait(20);
  b.hopTo(0, crate.x + 20, crate.y);
  b.hopTo(0, 560, 360);
  b.walkTo(1, crate.x + crate.w + 22);
  b.hopTo(1, crate.x + 20, crate.y);
  b.hopTo(1, 540, 360);
  b.hopTo(0, col(17), 360);                              // a hop for the high bolt
  b.walkTo(0, col(29));
  b.walkTo(1, col(28));
  b.wait(60);
};

// 3. Push
SCRIPTS.w1l03 = b => {
  const crate = b.sim.crates[0];
  for (const i of [1, 0]) { b.hopTo(i, col(4), 400); b.hopTo(i, col(7), 360); }
  b.walkTo(1, col(8));                                   // Minus takes the bolt and pushes the crate off the shelf
  b.face(1, 1);
  b.power(1, true);
  b.wait(60);
  b.power(1, false);
  b.wait(200);
  b.walkTo(1, col(13));                                  // both walk off the shelf
  b.walkTo(0, col(12));
  b.hopTo(1, crate.x + 20, crate.y);                     // Minus: crate, then the ledge
  b.hopTo(1, col(18), 360);
  b.hopTo(0, crate.x + 20, crate.y);
  b.hopTo(0, col(19), 360);
  b.walkTo(0, col(22) - 20);
  b.hopTo(0, col(22), 360);                              // a hop for the high bolt
  b.walkTo(0, col(29));                                  // Plus is ahead of Minus on the ledge
  b.walkTo(1, col(28));
  b.wait(60);
};

// 4. Hold the Door
SCRIPTS.w1l04 = b => {
  b.walkTo(1, col(12));                                  // robots cannot pass each other: Minus steps ahead first
  b.walkTo(0, col(9));                                   // Plus under the left plate holds the door
  b.power(0, true, B.U);
  b.wait(40);
  b.walkTo(1, col(23));                                  // Minus goes through and holds the right plate
  b.power(1, true, B.U);
  b.wait(40);
  b.power(0, false);
  b.walkTo(0, col(21));                                  // now Plus goes through
  b.power(1, false);
  b.walkTo(1, col(25) + 20);
  b.hopTo(1, col(26), 480);                              // a hop for the high bolt
  b.walkTo(1, col(29));                                  // Minus is the one on the right
  b.walkTo(0, col(28));
  b.wait(60);
};

// 5. Your Lock, My Lock
SCRIPTS.w1l05 = b => {
  b.walkTo(0, col(8));                                   // Plus holds P+ and opens Minus's door
  b.power(0, true, B.U);
  b.wait(40);
  b.walkTo(1, col(22));                                  // Minus goes through and holds P−, opening Plus's door
  b.power(1, true, B.U);
  b.wait(40);
  b.power(0, false);
  b.walkTo(0, col(25));
  b.power(1, false);
  b.walkTo(1, col(26));
  b.walkTo(1, col(29));                                  // the one on the right goes first
  b.walkTo(0, col(28));
  b.wait(60);
};

// 6. Boost
SCRIPTS.w1l06 = b => {
  b.walkTo(1, col(8));                                   // takes the bolt on the floor
  b.hopTo(1, col(12), 440);                              // Minus on the one-tile step in front of the ledge
  b.hopTo(0, col(12), b.R[1].y);                         // Plus stands on Minus's head
  b.walkTo(0, b.center(1));                              // centred on the head
  b.power(1, true, B.U);                                 // Minus pushes up: Plus rises
  b.steer(0, 0, 40, 1);                                  // Plus stays centred over Minus while it rises
  b.hopTo(0, col(16), 320);                              // Plus jumps off the field onto the ledge
  b.power(1, false);
  b.wait(30);
  // Plus waits at the edge facing the drop with its power on; Minus jumps into the cone and is pulled up
  b.walkTo(0, 575);
  b.face(0, -1);
  b.power(0, true);
  b.hopTo(1, 480, 440);
  b.walkTo(1, 470);
  b.hopTo(1, 540, 320, 3);
  b.power(0, false);
  b.hopTo(0, col(18), 320);
  b.walkTo(0, col(29));
  b.walkTo(1, col(28));
  b.wait(60);
};

// 7. Tower
SCRIPTS.w1l07 = b => {
  const crate = b.sim.crates[0];
  b.walkTo(1, col(6));                                   // Minus takes the bolt on the floor
  b.walkTo(1, col(9));                                   // a bolt in the air: Plus stands on Minus and jumps
  b.hopTo(0, col(9), b.R[1].y);
  b.walkTo(0, b.center(1));
  b.hopTo(0, b.center(1), b.R[1].y);
  b.walkTo(0, col(7));
  b.walkTo(1, crate.x + 20 - 40);                        // Minus climbs the crate (it stands against the wall)
  b.hopTo(1, crate.x + 20, crate.y);
  b.walkTo(0, col(11));
  b.hopTo(0, b.center(1), b.R[1].y);                     // Plus on Minus's head
  b.walkTo(0, b.center(1));
  b.climbTo(0, col(15), 320);                            // straight up, then over the edge onto the ledge
  b.walkTo(0, 608);                                      // Plus stands back from the edge facing the drop, power on
  b.face(0, -1);
  b.power(0, true);
  b.hopTo(1, crate.x + 20, 320, 4, 40);                       // Minus jumps straight up from the crate into the cone and is pulled up
  b.walkTo(1, 572);
  b.power(0, false);
  b.hopTo(0, col(18), 320);
  b.walkTo(0, col(29));
  b.walkTo(1, col(28));
  b.wait(60);
};

// 8. Wet Feet
SCRIPTS.w1l08 = b => {
  // Never stand with the body over water: it kills even at the very edge, so run up from 22 px inside the edge.
  const hop = (i, from, to, y) => { b.walkTo(i, from); b.hopTo(i, to, y, 6); };
  hop(1, 258, col(10) + 30, 440);                        // Minus leads (he spawns ahead), Plus follows
  hop(0, 258, col(10) - 30, 440);
  hop(1, 458, col(15) + 30, 400);
  hop(0, 458, col(15) - 30, 400);
  hop(1, 658, col(20) + 30, 360);
  hop(0, 658, col(20) - 30, 360);
  hop(1, 858, col(26), 320);
  hop(0, 858, col(25), 320);
  b.walkTo(1, col(29));
  b.walkTo(0, col(28));
  b.wait(60);
};

// 9. Carry
SCRIPTS.w1l09 = b => {
  const crate = b.sim.crates[0];
  b.walkTo(0, 280);
  b.hopTo(0, 340, 440);                                  // Plus over the crate (a bolt sits above it)...
  b.walkTo(0, 345);
  b.hopTo(0, 475, 480, 4);                               // ...and over the spike pit
  b.walkTo(0, 470);
  b.face(0, -1);
  b.power(0, true);                                      // pulls the crate across the spikes
  b.wait(40);
  while (crate.x < 580) b.tick(b.frame(0, B.R));         // then carries it: walking away with the power on
  b.power(0, false);
  b.hopTo(0, crate.x + 20, 440, 6);                      // Plus rides the crate while Minus pushes it
  b.walkTo(1, 330);                                      // Minus crosses the pit
  b.hopTo(1, 475, 480, 4);
  b.focus(1);
  for (let k = 0; k < 900 && crate.x < 759.5; k++) b.tick(b.frame(1, B.R));   // and pushes the crate against the wall
  b.settle(1);
  b.focus(0);
  for (let k = 0; k < 90; k++) b.tick(b.frame(0, B.L));  // Plus steps off to the left, behind Minus
  b.settle(0);
  // from here it is level 7 again, 240 px further right
  const W = 240;
  b.hopTo(1, crate.x + 20, crate.y);
  b.walkTo(0, 460 + W);
  b.hopTo(0, b.center(1), b.R[1].y);                     // Plus on Minus's head (a bolt in the air)
  b.walkTo(0, b.center(1));
  b.climbTo(0, col(15) + W, 320);                        // straight up, then over the edge onto the ledge
  b.walkTo(0, 608 + W);
  b.face(0, -1);
  b.power(0, true);
  b.hopTo(1, crate.x + 20, 320, 4, 40);                  // Minus jumps from the crate into the cone and is pulled up
  b.power(0, false);
  b.hopTo(0, col(18) + W, 320);
  b.walkTo(0, col(29));
  b.walkTo(1, col(28));
  b.wait(60);
};

// 10. Workshop Exam (the slice level): pull the crate across the spikes, use it as a step,
// hold the door for each other, launch for the high bolt.
SCRIPTS.w1l10 = b => {
  const crate = b.sim.crates[0];
  b.walkTo(0, 270);                                      // Plus is a step for Minus: the little block is 3 tiles up
  b.hopTo(1, 270, b.R[0].y);
  b.climbTo(1, 350, 360);                                // Minus takes the bolt on the block
  b.walkTo(1, 505);
  b.walkTo(0, 258);
  b.power(0, true);
  b.wait(80);
  b.walkTo(0, 430);
  b.power(0, false);
  b.wait(20);
  b.hopTo(0, crate.x + 20, crate.y);
  b.hopTo(0, 560, 360);
  b.walkTo(1, crate.x + crate.w + 22);
  b.hopTo(1, crate.x + 20, crate.y);
  b.hopTo(1, 540, 360);
  b.walkTo(0, 620);
  b.power(0, true, B.U);
  b.wait(50);
  b.walkTo(1, 1100);
  b.power(1, true, B.U);
  b.wait(50);
  b.power(0, false);
  b.walkTo(0, 1040);
  b.hopTo(0, col(24), 360);                              // a hop for the high bolt
  b.hopTo(0, 1218, 360);
  b.power(1, false);
  b.walkTo(1, 1178);
  b.wait(60, 1);
};
