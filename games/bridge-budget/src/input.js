// Keyboard (GDD 4). Pointer events are bound in game.js, since they need the
// screen layout to tell buttons from the playfield. (Copied from Ink Path.)
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Tab']);

export class Keys {
  constructor(onKey) {
    window.addEventListener('keydown', e => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      onKey(e.code, e);
    });
  }
}
