import { mayRun } from '../settings.js';

export default {
  name: 'reminders',
  run(settings, now, send) {
    if (!mayRun(settings, now)) return false;
    if (now.getHours() !== 8 || now.getMinutes() !== 0) return false;
    send('reminders: departures due today');
    return true;
  },
};
