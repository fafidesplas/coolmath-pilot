// GameAnalytics stub (GDD 11). Logs every event to the console; the real SDK call
// goes in send() once the game key is confirmed. (Copied from Flip Runner.)
const log = [];

function send(kind, id, value) {
  log.push({ kind, id, value });
  console.log(`%c[GA] ${kind} ${id}${value !== undefined ? ` = ${value}` : ''}`, 'color:#B48CFF');
}

const pad = n => String(n).padStart(2, '0');

export const GA = {
  log,
  // Progression ids use the room's place in its world: room 15 is world02:level03.
  progression(status, world, level, value) {
    send('progression', `${status}:world${pad(world)}:level${pad(level)}`, value);
  },
  design(id, value) { send('design', id, value); },
};
