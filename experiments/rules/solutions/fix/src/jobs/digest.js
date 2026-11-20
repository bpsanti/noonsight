import { inQuietHours } from '../settings.js';

export default {
  name: 'digest',
  run(settings, now, send) {
    if (settings.paused || inQuietHours(settings, now)) return false;
    if (now.getMinutes() !== 30) return false;
    send('digest: the last hour of harbor traffic');
    return true;
  },
};
