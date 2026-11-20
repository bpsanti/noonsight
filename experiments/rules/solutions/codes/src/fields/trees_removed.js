'use strict';

// How many trees the works remove.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-980', message: "This field is required." };
  if (!/^-?[0-9]+$/.test(text)) return { code: 'PF-146', message: "Enter a whole number." };
  if (Number(text) < 0 || Number(text) > 50) return { code: 'PF-728', message: "Enter a number from 0 to 50." };
  return null;
}

module.exports = { validate };
