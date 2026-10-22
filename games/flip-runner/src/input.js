// Keys and pointer to a queue of presses (one per sim step, so two quick taps are
// never merged) plus a "held" state for glider form. Key auto-repeat never flips.
const FLIP_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS']);
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  constructor(onKey) {
    this.pending = 0;
    this.accepting = false;     // only queue flips while a run is live
    this.keysDown = new Set();
    this.pointerHeld = false;
    window.addEventListener('keydown', e => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (FLIP_KEYS.has(e.code)) { this.keysDown.add(e.code); if (this.accepting) this.press(); }
      onKey(e.code);
    });
    window.addEventListener('keyup', e => this.keysDown.delete(e.code));
    window.addEventListener('blur', () => { this.keysDown.clear(); this.pointerHeld = false; });
  }

  press() { if (this.pending < 2) this.pending++; }

  get held() { return this.pointerHeld || this.keysDown.size > 0; }

  // bit 1: a press this step, bit 2: the button is held
  sample() {
    let bits = this.held ? 2 : 0;
    if (this.pending > 0) { this.pending--; bits |= 1; }
    return bits;
  }

  clear() { this.pending = 0; }
}

export const isFlipKey = code => FLIP_KEYS.has(code);
