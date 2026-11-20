'use strict';

// The number of homes in the building.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!/^-?[0-9]+$/.test(text)) return false;
  if (Number(text) < 1 || Number(text) > 200) return false;
  return true;
}

module.exports = { validate };
