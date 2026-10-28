// Echo tapes (GDD 3.5, 12): preallocated typed arrays, nothing allocated in play.
// One entry per running step of a loop: position, pose bits and what the body stood on.
import { ECHO } from './config.js';

export const POSE = { STAND: 1, LEFT: 2, RUN: 4, RISE: 8 };
// Ground refs: 0 air, 1 tile or gate, 2 + k standing on echo k.
export const GROUND = { AIR: 0, SOLID: 1, ECHO0: 2 };

export class Tape {
  constructor(n = ECHO.maxSteps) {
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.pose = new Uint8Array(n);
    this.ground = new Uint8Array(n);
    this.len = 0;
    this.zap = false;
  }
  write(i, x, y, pose, ground) {
    this.x[i] = x; this.y[i] = y; this.pose[i] = pose; this.ground[i] = ground;
  }
}
