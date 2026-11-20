'use strict';

// The number of parking spaces on the site.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-512', message: "This field is required." };
  if (!/^-?[0-9]+$/.test(text)) return { code: 'PF-478', message: "Enter a whole number." };
  if (Number(text) < 0 || Number(text) > 500) return { code: 'PF-423', message: "Enter a number from 0 to 500." };
  return null;
}

module.exports = { validate };
