'use strict';

// A stock file holds one line per batch of an item: name;category;qty;unit;expires;shelf
// `expires` is a day as YYYY-MM-DD, or empty for what does not expire. `shelf` is optional, so the
// older five-field lines read with no shelf. A quantity may have a decimal comma. Blank lines and
// lines that start with # are skipped.

function parseLine(line) {
  const text = line.trim();
  if (text === '' || text.startsWith('#')) return null;
  const [name, category, qty, unit, expires, shelf] = text.split(';').map((s) => s.trim());
  return { name, category, qty: parseQty(qty), unit, expires: expires || null, shelf: shelf || null };
}

/** A quantity, with a decimal point or a decimal comma; NaN when it is not a number. */
function parseQty(text) {
  const t = String(text ?? '').trim().replace(',', '.');
  return /^-?[0-9]+(\.[0-9]+)?$/.test(t) ? Number(t) : NaN;
}

function parseStock(text) {
  return text.split('\n').map(parseLine).filter(Boolean);
}

module.exports = { parseLine, parseQty, parseStock };
