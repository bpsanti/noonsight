'use strict';

// Anything else the applicant wants to add.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text.length > 500) return false;
  return true;
}

module.exports = { validate };
