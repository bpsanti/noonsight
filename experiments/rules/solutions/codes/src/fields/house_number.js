'use strict';

// The house number of the site.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-535', message: "This field is required." };
  if (!/^[0-9]{1,5}[A-Za-z]?$/.test(text)) return { code: 'PF-238', message: "Enter a house number such as 17 or 17a." };
  return null;
}

module.exports = { validate };
