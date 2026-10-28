// Keyboard (GDD 4). Pointer events are bound in game.js, since they need the
// screen layout to tell buttons from the playfield.
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace']);

export class Keys {
  constructor(onKey) {
    window.addEventListener('keydown', e => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      onKey(e.code);
    });
  }
}

// All the positions of a pointer event, including coalesced ones (smooth fast strokes).
export function pointerSamples(e) {
  const list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
  return list && list.length ? list : [e];
}
