// Keyboard (GDD 3.6, 4): key down and up, browser auto-repeat ignored (the game
// runs its own 300 ms / 150 ms repeat). Pointer events are bound in game.js.
const PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export class Keys {
  constructor(onDown, onUp) {
    window.addEventListener('keydown', e => {
      if (PREVENT.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      onDown(e.code);
    });
    window.addEventListener('keyup', e => onUp(e.code));
    window.addEventListener('blur', () => onUp('*'));
  }
}
