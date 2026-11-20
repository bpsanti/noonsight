'use strict';

// The applicant's full name.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-555', message: "This field is required." };
  if (text.length > 80) return { code: 'PF-699', message: "Use at most 80 characters." };
  return null;
}

module.exports = { validate };
