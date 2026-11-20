'use strict';

// The number of floors below ground.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-155', message: "This field is required." };
  if (!/^-?[0-9]+$/.test(text)) return { code: 'PF-220', message: "Enter a whole number." };
  if (Number(text) < 0 || Number(text) > 3) return { code: 'PF-833', message: "Enter a number from 0 to 3." };
  return null;
}

module.exports = { validate };
