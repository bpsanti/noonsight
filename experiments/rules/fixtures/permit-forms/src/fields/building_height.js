'use strict';

// The height of the building, in metres.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(text)) return false;
  if (Number(text) < 1 || Number(text) > 60) return false;
  return true;
}

module.exports = { validate };
