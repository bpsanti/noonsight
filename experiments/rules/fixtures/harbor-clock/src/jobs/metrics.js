import { inQuietHours } from '../settings.js';

export default {
  name: 'metrics',
  run(settings, now, send) {
    if (settings.pause || inQuietHours(settings, now)) return false;
    if (now.getMinutes() % 15 !== 0) return false;
    send('metrics: berth occupancy reported');
    return true;
  },
};
