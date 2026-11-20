'use strict';

// The number of homes in the building.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-455', message: "This field is required." };
  if (!/^-?[0-9]+$/.test(text)) return { code: 'PF-691', message: "Enter a whole number." };
  if (Number(text) < 1 || Number(text) > 200) return { code: 'PF-902', message: "Enter a number from 1 to 200." };
  return null;
}

module.exports = { validate };
