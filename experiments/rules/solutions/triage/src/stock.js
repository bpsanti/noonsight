'use strict';

// What the commands compute from the parsed stock.

const { toBase } = require('./units.js');

const DAY = 24 * 60 * 60 * 1000;

/** The warning window of each category, in days: short for fresh produce, long for canned goods. */
const WINDOWS = { produce: 3, canned: 30 };
const DEFAULT_WINDOW = 7;

/** Whole days from `today` to `date`, both YYYY-MM-DD. */
function daysUntil(date, today) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
}

/** The batches that expire within their category's warning window, today included, soonest first; what has already expired is left out. */
function expiring(items, today) {
  return items
    .filter((it) => it.expires && it.expires >= today && daysUntil(it.expires, today) <= (WINDOWS[it.category] ?? DEFAULT_WINDOW))
    .sort((a, b) => a.expires.localeCompare(b.expires));
}

/** The batches with less than `min` left, in their own unit. */
function low(items, min = 2) {
  return items.filter((it) => it.qty < min);
}

/** A quantity with one decimal at most. */
function round(qty) {
  return Number(qty.toFixed(1));
}

/** The total of each category, in each base unit. */
function report(items) {
  const totals = new Map();
  for (const it of items) {
    const { qty, unit } = toBase(it.qty, it.unit);
    const key = `${it.category} ${unit}`;
    totals.set(key, (totals.get(key) ?? 0) + qty);
  }
  return [...totals]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, qty]) => {
      const [category, unit] = key.split(' ');
      return `${category}: ${round(qty)} ${unit}`;
    });
}

module.exports = { DEFAULT_WINDOW, WINDOWS, daysUntil, expiring, low, report };
