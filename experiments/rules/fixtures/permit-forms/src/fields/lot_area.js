'use strict';

// The area of the lot, in square metres.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(text)) return false;
  if (Number(text) < 10 || Number(text) > 100000) return false;
  return true;
}

module.exports = { validate };
