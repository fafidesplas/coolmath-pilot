import { Game } from './game.js';
import { applyArt, ART_IDS } from './art.js';
import { syncFont } from './render.js';

// Art style from ?art=<id> (presentation build); classic when missing or unknown.
const want = new URLSearchParams(location.search).get('art');
try { await applyArt(ART_IDS.includes(want) ? want : 'classic'); } catch (e) { console.warn('art style failed, using classic', e); }
syncFont();

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.game = game.api;   // testing hook (STANDARDS.md)
canvas.focus();
