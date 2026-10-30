// Keyboard state (GDD 4). Pointers are handled in main.js, since what a press
// does depends on the screen and its buttons.
export const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
export const DUCK_KEYS = ['ArrowDown', 'KeyS'];
const GROUPS = { jump: JUMP_KEYS, duck: DUCK_KEYS };
const groupOf = code => JUMP_KEYS.includes(code) ? 'jump' : DUCK_KEYS.includes(code) ? 'duck' : null;

// onDown(code, first): first is false while another key of the same group is held.
// onUp(code, last): last is true once no key of the group is held.
// Auto-repeat is dropped: the sim repeats a held jump itself.
export class Keys {
  constructor() {
    this.held = new Set();
    this.onDown = () => {};
    this.onUp = () => {};
    addEventListener('keydown', e => {
      const group = groupOf(e.code);
      if (group) e.preventDefault();
      if (e.repeat) return;
      const first = !group || !this.holds(group);
      this.held.add(e.code);
      this.onDown(e.code, first);
    });
    addEventListener('keyup', e => {
      this.held.delete(e.code);
      const group = groupOf(e.code);
      this.onUp(e.code, !group || !this.holds(group));
    });
    addEventListener('blur', () => this.clear());
  }

  holds(action) { return GROUPS[action].some(k => this.held.has(k)); }
  clear() { this.held.clear(); }
}
