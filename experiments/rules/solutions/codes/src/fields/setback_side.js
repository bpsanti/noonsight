'use strict';

// The distance from the building to the side boundary, in metres.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-856', message: "This field is required." };
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(text)) return { code: 'PF-690', message: "Enter a number, with a point for decimals." };
  if (Number(text) < 0 || Number(text) > 20) return { code: 'PF-848', message: "Enter a number from 0 to 20." };
  return null;
}

module.exports = { validate };
