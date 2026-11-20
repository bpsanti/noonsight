'use strict';

// The company applying, when it is not a person.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text.length > 100) return false;
  return true;
}

module.exports = { validate };
