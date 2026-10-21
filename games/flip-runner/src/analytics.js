// GameAnalytics stub (GDD 11). Copied from Magnet Twins, without the mode tier. Logs every event to the console; the real SDK
// call goes in send() once the game key is confirmed.
const log = [];

function send(kind, id, value) {
  log.push({ kind, id, value });
  console.log(`%c[GA] ${kind} ${id}${value !== undefined ? ` = ${value}` : ''}`, 'color:#2F7FE0');
}

const pad = n => String(n).padStart(2, '0');

export const GA = {
  log,
  progression(status, world, level, score) {
    send('progression', `${status}:world${pad(world)}:level${pad(level)}`, score);
  },
  design(id, value) { send('design', id, value); },
};
