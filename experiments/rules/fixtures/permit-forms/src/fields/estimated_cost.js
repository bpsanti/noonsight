'use strict';

// The estimated cost of the works, in euros.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(text)) return false;
  if (Number(text) < 1000 || Number(text) > 50000000) return false;
  return true;
}

module.exports = { validate };
