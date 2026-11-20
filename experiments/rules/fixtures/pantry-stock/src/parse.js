'use strict';

// A stock file holds one line per batch of an item: name;category;qty;unit;expires
// `expires` is a day as YYYY-MM-DD, or empty for what does not expire. Blank lines and lines that
// start with # are skipped.

function parseLine(line) {
  const text = line.trim();
  if (text === '' || text.startsWith('#')) return null;
  const [name, category, qty, unit, expires] = text.split(';').map((s) => s.trim());
  return { name, category, qty: parseFloat(qty), unit, expires: expires || null };
}

function parseStock(text) {
  return text.split('\n').map(parseLine).filter(Boolean);
}

module.exports = { parseLine, parseStock };
