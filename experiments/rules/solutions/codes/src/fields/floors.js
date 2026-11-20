'use strict';

// The number of floors above ground.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-407', message: "This field is required." };
  if (!/^-?[0-9]+$/.test(text)) return { code: 'PF-191', message: "Enter a whole number." };
  if (Number(text) < 1 || Number(text) > 12) return { code: 'PF-979', message: "Enter a number from 1 to 12." };
  return null;
}

module.exports = { validate };
