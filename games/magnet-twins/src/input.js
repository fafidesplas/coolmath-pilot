// Keyboard and touch to controller bits (GDD 4). Two controllers in co-op, one in solo.
import { B } from './config.js';

const COOP = [
  { L: ['KeyA'], R: ['KeyD'], U: ['KeyW'], D: ['KeyS'], P: ['KeyF', 'KeyE'] },
  { L: ['ArrowLeft'], R: ['ArrowRight'], U: ['ArrowUp'], D: ['ArrowDown'], P: ['Slash', 'ShiftRight'] },
];
const SOLO = {
  L: ['KeyA', 'ArrowLeft'], R: ['KeyD', 'ArrowRight'], U: ['KeyW', 'ArrowUp', 'Space'],
  D: ['KeyS', 'ArrowDown'], P: ['KeyF', 'KeyE', 'Slash', 'ShiftRight'], S: ['Tab', 'KeyQ'],
};
const PREVENT = new Set(['Tab', 'Space', 'Slash', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export class Input {
  constructor(onKey) {
    this.down = new Set();
    this.touchBits = 0;
    this.usedTouch = false;
    this.onKey = onKey;

    window.addEventListener('keydown', e => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (!e.repeat) onKey(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', e => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.touchBits = 0; });

    this.bindTouch();
  }

  bits(map) {
    let b = 0;
    for (const k in map) if (map[k].some(c => this.down.has(c))) b |= B[k];
    return b;
  }

  sample(mode) {
    if (mode === 'solo') return this.bits(SOLO) | this.touchBits;
    return this.bits(COOP[0]) | (this.bits(COOP[1]) << 8);
  }

  bindTouch() {
    const root = document.getElementById('touch');
    if (!root) return;
    for (const btn of root.querySelectorAll('button')) {
      const bit = B[btn.dataset.k];
      let startY = 0;
      btn.addEventListener('pointerdown', e => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        startY = e.clientY;
        this.touchBits |= bit;
        btn.classList.add('on');
      });
      btn.addEventListener('pointermove', e => {
        if (btn.dataset.k !== 'P' || !(this.touchBits & B.P)) return;
        // Drag up or down on Power to aim.
        const dy = e.clientY - startY;
        this.touchBits &= ~(B.AU | B.AD);
        if (dy < -24) this.touchBits |= B.AU;
        else if (dy > 24) this.touchBits |= B.AD;
      });
      const up = () => {
        this.touchBits &= ~bit;
        if (btn.dataset.k === 'P') this.touchBits &= ~(B.AU | B.AD);
        btn.classList.remove('on');
      };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
    }
  }

  showTouch(on) {
    const root = document.getElementById('touch');
    if (root) root.classList.toggle('hidden', !on);
  }
}

export const KEY_LABELS = {
  coop: [
    { move: 'A D', jump: 'W', power: 'F' },
    { move: '← →', jump: '↑', power: '/' },
  ],
  solo: { move: 'A D', jump: 'W', power: 'F', swap: 'TAB' },
};
