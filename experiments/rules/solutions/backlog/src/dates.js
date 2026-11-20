// Dates are ISO strings (YYYY-MM-DD), so they compare as text.

/**
 * Whether a date falls in a range; an end that is not given leaves the range open on that side.
 * @param {string} date
 * @param {string | undefined} from
 * @param {string | undefined} to
 */
export function inRange(date, from, to) {
  if (from !== undefined && date < from) return false;
  if (to !== undefined && date > to) return false;
  return true;
}
