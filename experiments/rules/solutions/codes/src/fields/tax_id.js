'use strict';

// The applicant's tax number.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-829', message: "This field is required." };
  if (!/^[0-9]{9}$/.test(text)) return { code: 'PF-243', message: "Enter the nine digits of the tax number." };
  return null;
}

module.exports = { validate };
