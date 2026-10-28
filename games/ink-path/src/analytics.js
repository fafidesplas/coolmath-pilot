// GameAnalytics stub (GDD 11). Logs every event to the console; the real SDK call
// goes in send() once the game key is confirmed. (Copied from Flip Runner.)
const log = [];

function send(kind, id, value) {
  log.push({ kind, id, value });
  console.log(`%c[GA] ${kind} ${id}${value !== undefined ? ` = ${value}` : ''}`, 'color:#3A6FD8');
}

const pad = n => String(n).padStart(2, '0');
export const levelId = (world, level) => `world${pad(world)}:level${pad(level)}`;

export const GA = {
  log,
  // Start / Complete / Fail, one per attempt (each drop).
  progression(status, world, level, score) {
    send('progression', `${status}:${levelId(world, level)}`, score);
  },
  design(id, value) { send('design', id, value); },
};
