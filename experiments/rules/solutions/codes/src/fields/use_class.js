'use strict';

// What the building is used for.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-974', message: "This field is required." };
  if (!["residential", "commercial", "industrial", "mixed"].includes(text)) return { code: 'PF-704', message: "Choose one of: residential, commercial, industrial, mixed." };
  return null;
}

module.exports = { validate };
