// GameAnalytics stub (GDD 11). Logs every event to the console; the real SDK call
// goes in send() once the game key is confirmed. (Copied from Ink Path.)
const log = [];

function send(kind, id, value) {
  log.push({ kind, id, value });
  console.log(`%c[GA] ${kind} ${id}${value !== undefined ? ` = ${value}` : ''}`, 'color:#4AA3DF');
}

const pad = n => String(n).padStart(2, '0');
export const levelId = (world, level) => `world${pad(world)}:level${pad(level)}`;

export const GA = {
  log,
  // Start when a level is opened, Complete on the first pass of a visit,
  // Fail when leaving a visit without a pass (GDD 11).
  progression(status, world, level, score) {
    send('progression', `${status}:${levelId(world, level)}`, score);
  },
  design(id, value) { send('design', id, value); },
};
