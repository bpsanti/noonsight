'use strict';

// The company applying, when it is not a person.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text.length > 100) return { code: 'PF-319', message: "Use at most 100 characters." };
  return null;
}

module.exports = { validate };
