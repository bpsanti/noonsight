import { inQuietHours } from '../settings.js';

export default {
  name: 'backup',
  run(settings, now, send) {
    if (settings.paused || inQuietHours(settings, now)) return false;
    if (now.getMinutes() !== 0) return false;
    send('backup: hourly snapshot taken');
    return true;
  },
};
