'use strict';

// What the commands compute from the parsed stock.

const DAY = 24 * 60 * 60 * 1000;

/** Whole days from `today` to `date`, both YYYY-MM-DD. */
function daysUntil(date, today) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
}

/** The batches that expire within the warning window, soonest first; what has already expired is left out. */
function expiring(items, today, days = 7) {
  return items
    .filter((it) => it.expires && it.expires > today && daysUntil(it.expires, today) <= days)
    .sort((a, b) => a.expires.localeCompare(b.expires));
}

/** The batches with less than `min` left, in their own unit. */
function low(items, min = 2) {
  return items.filter((it) => it.qty < min);
}

/** The total of each category, in each unit. */
function report(items) {
  const totals = new Map();
  for (const it of items) {
    const key = `${it.category} ${it.unit}`;
    totals.set(key, (totals.get(key) ?? 0) + it.qty);
  }
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, qty]) => {
      const [category, unit] = key.split(' ');
      return `${category}: ${qty} ${unit}`;
    });
}

module.exports = { daysUntil, expiring, low, report };
