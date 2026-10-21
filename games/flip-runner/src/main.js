import { Game } from './game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.game = game.api;   // testing hook (STANDARDS.md)
canvas.focus();
