'use strict';

// The area of the lot, in square metres.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-973', message: "This field is required." };
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(text)) return { code: 'PF-439', message: "Enter a number, with a point for decimals." };
  if (Number(text) < 10 || Number(text) > 100000) return { code: 'PF-261', message: "Enter a number from 10 to 100000." };
  return null;
}

module.exports = { validate };
