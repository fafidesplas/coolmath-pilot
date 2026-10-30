// GameAnalytics stubs (GDD 11): every event is logged to the console until the
// SDK and the game's keys are added.
const log = (...a) => console.log('%c[GA]', 'color:#F08A24;font-weight:bold', ...a);

export const GA = {
  progression(status, id, score) { log(`${status}:${id}`, score ?? ''); },
  design(id, value) { log(id, value ?? ''); },
};
