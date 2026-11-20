'use strict';

// What the works are.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-116', message: "This field is required." };
  if (!["new", "extension", "renovation", "demolition"].includes(text)) return { code: 'PF-895', message: "Choose one of: new, extension, renovation, demolition." };
  return null;
}

module.exports = { validate };
