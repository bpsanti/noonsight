'use strict';

// The units of the stock, and how much of its base unit (kg, l or pcs) one of each is.
// TODO(PAN-27): the donation sheets also write units in the ways listed in data/unit-aliases.txt,
// which nothing reads yet.

const UNITS = {
  kg: { base: 'kg', factor: 1 },
  g: { base: 'kg', factor: 0.001 },
  l: { base: 'l', factor: 1 },
  ml: { base: 'l', factor: 0.001 },
  pcs: { base: 'pcs', factor: 1 },
};

/** The quantity in the base unit of its unit; a unit it does not know is left as it is. */
function toBase(qty, unit) {
  const u = UNITS[unit];
  if (!u) return { qty, unit };
  return { qty: qty * u.factor, unit: u.base };
}

module.exports = { UNITS, toBase };
