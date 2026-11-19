// Periods of the season, in hours from its opening.
// A period covers its start hour and every hour up to, but not including, its end hour,
// so consecutive periods share no hour.

export const HOURS_PER_WEEK = 7 * 24;

export function weeks(count) {
  const periods = [];
  for (let i = 0; i < count; i++) periods.push({ label: `week ${i + 1}`, start: i * HOURS_PER_WEEK, end: (i + 1) * HOURS_PER_WEEK });
  return periods;
}

export function within(period, hour) {
  return hour >= period.start && hour <= period.end;
}
