import { Game } from './game.js';
import { THEMES, ART, preloadAll } from './theme.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.game = game.api;   // testing hook (STANDARDS.md)

// Art-style pill (presentation): click or press V to cycle. Keeps ?art= in the URL
// (other params such as ?room= or ?hints= stay) without reloading.
const pill = document.createElement('button');
pill.id = 'art-pill';
pill.type = 'button';
pill.title = 'Switch art style (V)';
document.body.appendChild(pill);
const label = id => {
  const i = THEMES.findIndex(t => t.id === id);
  pill.textContent = `ART ${i + 1}/${THEMES.length}: ${THEMES[i].name}  ›`;
};
game.onArtChange = id => {
  label(id);
  const url = new URL(location.href);
  if (id === 'classic') url.searchParams.delete('art'); else url.searchParams.set('art', id);
  try { history.replaceState(null, '', url); } catch (e) { /* file:// or sandboxed */ }
};
pill.addEventListener('click', () => { game.cycleArt(); game.sound.unlock(); game.sound.play('click'); canvas.focus(); });
pill.addEventListener('keydown', e => e.preventDefault());   // Space/Enter must not re-click it while playing
label(ART.cur.id);
setTimeout(preloadAll, 1500);   // after the first screen is up

canvas.focus();
