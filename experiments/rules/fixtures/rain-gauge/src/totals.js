import { within } from './periods.js';

/** The rain of each period, in the order of the periods. */
export function totalsBy(readings, periods) {
  return periods.map((period) => ({
    label: period.label,
    mm: round(readings.filter((r) => within(period, r.hour)).reduce((sum, r) => sum + r.mm, 0)),
  }));
}

export function seasonTotal(readings) {
  return round(readings.reduce((sum, r) => sum + r.mm, 0));
}

function round(mm) {
  return Math.round(mm * 10) / 10;
}
