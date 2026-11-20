'use strict';

// The kind of roof.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-347', message: "This field is required." };
  if (!["flat", "pitched", "green"].includes(text)) return { code: 'PF-462', message: "Choose one of: flat, pitched, green." };
  return null;
}

module.exports = { validate };
