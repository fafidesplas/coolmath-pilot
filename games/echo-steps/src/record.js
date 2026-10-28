// Input recordings (GDD 6): one bitmask per 120 Hz step from the room start,
// stored only when it changes. { v: 1, level, frames: N, inputs: [[step, bits], …] }

export function encodeRecording(level, frames) {
  const inputs = [];
  let last = -1;
  frames.forEach((bits, i) => { if (bits !== last) { inputs.push([i, bits]); last = bits; } });
  return { v: 1, level, frames: frames.length, inputs };
}

export function decodeRecording(rec) {
  const out = new Array(rec.frames).fill(0);
  let k = 0, bits = 0;
  for (let i = 0; i < rec.frames; i++) {
    while (k < rec.inputs.length && rec.inputs[k][0] <= i) bits = rec.inputs[k++][1];
    out[i] = bits;
  }
  return out;
}

export class Recorder {
  constructor() { this.frames = []; }
  push(bits) { this.frames.push(bits); }
  finish(level) { return encodeRecording(level, this.frames); }
}
