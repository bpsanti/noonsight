'use strict';

// The applicant's email address.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(text)) return false;
  return true;
}

module.exports = { validate };
