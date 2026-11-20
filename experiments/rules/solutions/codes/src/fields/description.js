'use strict';

// A description of the works.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-988', message: "This field is required." };
  if (text.length > 2000) return { code: 'PF-309', message: "Use at most 2000 characters." };
  return null;
}

module.exports = { validate };
