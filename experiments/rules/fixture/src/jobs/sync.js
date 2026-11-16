// The tide sync runs on its own timer, outside the scheduler.

export function startSync(send) {
  return setInterval(() => send('sync: tide table refreshed'), 15 * 60 * 1000);
}
