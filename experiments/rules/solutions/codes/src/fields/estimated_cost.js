'use strict';

// The estimated cost of the works, in euros.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-592', message: "This field is required." };
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(text)) return { code: 'PF-571', message: "Enter a number, with a point for decimals." };
  if (Number(text) < 1000 || Number(text) > 50000000) return { code: 'PF-591', message: "Enter a number from 1000 to 50000000." };
  return null;
}

module.exports = { validate };
