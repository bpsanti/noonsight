'use strict';

// Anything else the applicant wants to add.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text.length > 500) return { code: 'PF-694', message: "Use at most 500 characters." };
  return null;
}

module.exports = { validate };
