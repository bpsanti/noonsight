'use strict';

// The share of the lot the building covers, in percent.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-493', message: "This field is required." };
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(text)) return { code: 'PF-380', message: "Enter a number, with a point for decimals." };
  if (Number(text) < 0 || Number(text) > 100) return { code: 'PF-513', message: "Enter a number from 0 to 100." };
  return null;
}

module.exports = { validate };
