'use strict';

// The number of floors below ground.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!/^-?[0-9]+$/.test(text)) return false;
  if (Number(text) < 0 || Number(text) > 3) return false;
  return true;
}

module.exports = { validate };
