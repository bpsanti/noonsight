import { weeks } from './periods.js';
import { forStation } from './readings.js';
import { seasonTotal, totalsBy } from './totals.js';

/** The season report of one station: a line per week, then the season's total. */
export function seasonReport(readings, station, weekCount) {
  const own = forStation(readings, station);
  const lines = [`Station ${station}`];
  for (const week of totalsBy(own, weeks(weekCount))) lines.push(`${week.label}: ${week.mm.toFixed(1)} mm`);
  lines.push(`season: ${seasonTotal(own).toFixed(1)} mm`);
  return lines.join('\n');
}
