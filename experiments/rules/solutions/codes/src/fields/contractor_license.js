'use strict';

// The contractor's licence number.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-633', message: "This field is required." };
  if (!/^CL[0-9]{6}$/.test(text)) return { code: 'PF-637', message: "Enter the licence number, CL and six digits." };
  return null;
}

module.exports = { validate };
