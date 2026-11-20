'use strict';

// The distance from the building to the street, in metres.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-755', message: "This field is required." };
  if (!/^-?[0-9]+(\.[0-9]+)?$/.test(text)) return { code: 'PF-480', message: "Enter a number, with a point for decimals." };
  if (Number(text) < 0 || Number(text) > 50) return { code: 'PF-104', message: "Enter a number from 0 to 50." };
  return null;
}

module.exports = { validate };
