'use strict';

// The applicant's email address.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-632', message: "This field is required." };
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(text)) return { code: 'PF-496', message: "Enter an email address like name@example.com." };
  return null;
}

module.exports = { validate };
