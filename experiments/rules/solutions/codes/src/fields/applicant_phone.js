'use strict';

// The applicant's phone number.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-401', message: "This field is required." };
  if (!/^\+?[0-9 ]{7,15}$/.test(text)) return { code: 'PF-837', message: "Enter a phone number of 7 to 15 digits." };
  return null;
}

module.exports = { validate };
