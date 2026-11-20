'use strict';

// The number of the approved drainage plan, when there is one.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text !== '' && !/^DP-[0-9]{4}$/.test(text)) return { code: 'PF-938', message: "Enter the plan number as DP- and four digits." };
  return null;
}

module.exports = { validate };
