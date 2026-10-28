// Keys and touch buttons to one bitmask per sim step (GDD 4). A press is latched
// until the next sample, so a quick tap between two steps is never lost. Key
// auto-repeat is ignored.
import { BIT } from './config.js';

const KEY_BITS = {
  ArrowLeft: BIT.LEFT, KeyA: BIT.LEFT,
  ArrowRight: BIT.RIGHT, KeyD: BIT.RIGHT,
  Space: BIT.JUMP, ArrowUp: BIT.JUMP, KeyW: BIT.JUMP,
  KeyE: BIT.LOOP, Enter: BIT.LOOP,
  Backspace: BIT.DEL, Delete: BIT.DEL,
};
const FFWD_KEYS = new Set(['ArrowDown', 'KeyS']);
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Tab']);

export class Input {
  constructor(onKey) {
    this.down = new Set();
    this.keyBits = 0;
    this.ignore = 0;            // bits held since before the room started
    this.touchBits = 0;
    this.latch = 0;
    this.ffwdTouch = false;
    this.accepting = false;      // only latch while a room is live
    window.addEventListener('keydown', e => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.recompute();
      const b = KEY_BITS[e.code];
      if (b && this.accepting) { this.latch |= b; this.ignore &= ~b; }
      onKey(e.code);
    });
    window.addEventListener('keyup', e => { this.down.delete(e.code); this.recompute(); });
    window.addEventListener('blur', () => this.releaseAll());
  }

  recompute() {
    let b = 0;
    for (const c of this.down) b |= KEY_BITS[c] || 0;
    this.keyBits = b;
    this.ignore &= b;
  }

  ignoreHeld() { this.ignore = this.keyBits; }

  releaseAll() { this.down.clear(); this.keyBits = 0; this.touchBits = 0; this.ffwdTouch = false; }

  press(bit) { if (this.accepting) this.latch |= bit; }

  get ffwd() { return this.ffwdTouch || [...FFWD_KEYS].some(k => this.down.has(k)); }

  // Movement bits held right now (used for fast-forward "standing still").
  get held() { return this.keyBits | this.touchBits; }

  sample() {
    const bits = (this.accepting ? (this.keyBits & ~this.ignore) | this.touchBits : 0) | this.latch;
    this.latch = 0;
    return bits;
  }

  clear(mask = ~0) { this.latch &= ~mask; }
}
