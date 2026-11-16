// Runs every job once per tick and returns the names of the jobs that sent something.

import backup from './jobs/backup.js';
import cleanup from './jobs/cleanup.js';
import digest from './jobs/digest.js';
import metrics from './jobs/metrics.js';
import reminders from './jobs/reminders.js';

export const JOBS = [backup, cleanup, digest, metrics, reminders];

export function tick(settings, now, send) {
  const ran = [];
  for (const job of JOBS) if (job.run(settings, now, send)) ran.push(job.name);
  return ran;
}
