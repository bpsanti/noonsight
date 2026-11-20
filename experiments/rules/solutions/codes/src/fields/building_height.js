'use strict';

// The height of the building, in metres.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-697', message: "This field is required." };
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(text)) return { code: 'PF-774', message: "Enter a number, with a point for decimals." };
  if (Number(text) < 1 || Number(text) > 60) return { code: 'PF-661', message: "Enter a number from 1 to 60." };
  return null;
}

module.exports = { validate };
