'use strict';

// The applicant's tax number.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!/^[0-9]{9}$/.test(text)) return false;
  return true;
}

module.exports = { validate };
