'use strict';

// A description of the works.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (text.length > 2000) return false;
  return true;
}

module.exports = { validate };
