import { Game } from './game.js';

const game = new Game({
  bg: document.getElementById('bg'),
  gl: document.getElementById('gl'),
  ui: document.getElementById('ui'),
});
window.game = game.api;   // testing hook (STANDARDS.md, GDD 12)
document.getElementById('ui').focus();
