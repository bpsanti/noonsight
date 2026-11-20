'use strict';

// The applicant's full name.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (text.length > 80) return false;
  return true;
}

module.exports = { validate };
