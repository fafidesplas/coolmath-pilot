// Keys and pointer to a queue of flip presses: one press per sim step, so two
// quick taps are never merged. Key auto-repeat never flips (GDD 3.3).
const FLIP_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS']);
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  constructor(onKey) {
    this.pending = 0;
    this.accepting = false;     // only queue flips while a run is live
    window.addEventListener('keydown', e => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (FLIP_KEYS.has(e.code) && this.accepting) this.press();
      onKey(e.code);
    });
  }

  press() { if (this.pending < 2) this.pending++; }

  sample() {
    if (this.pending > 0) { this.pending--; return 1; }
    return 0;
  }

  clear() { this.pending = 0; }
}

export const isFlipKey = code => FLIP_KEYS.has(code);
