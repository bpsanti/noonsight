import { mayRun } from '../settings.js';

export default {
  name: 'cleanup',
  run(settings, now, send) {
    if (!mayRun(settings, now)) return false;
    if (now.getDay() !== 0 || now.getHours() !== 9 || now.getMinutes() !== 0) return false;
    send('cleanup: old notices removed');
    return true;
  },
};
