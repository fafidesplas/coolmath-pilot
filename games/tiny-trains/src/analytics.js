// GameAnalytics stub (GDD 11). Logs every event to the console; the real SDK call
// goes in send() once the game key is confirmed. (Adapted from Echo Steps.)
const log = [];

function send(kind, id, value) {
  log.push({ kind, id, value });
  console.log(`%c[GA] ${kind} ${id}${value !== undefined ? ` = ${value}` : ''}`, 'color:#3B7DD8');
}

export const GA = {
  log,
  // Level ids are already GDD style: "world01:level04".
  progression(status, levelId, value) { send('progression', `${status}:${levelId}`, value); },
  design(id, value) { send('design', id, value); },
};
