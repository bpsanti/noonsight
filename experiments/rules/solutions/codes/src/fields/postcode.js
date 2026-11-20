'use strict';

// The postcode of the site.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-981', message: "This field is required." };
  if (!/^[0-9]{4} ?[A-Z]{2}$/.test(text)) return { code: 'PF-230', message: "Enter a postcode such as 1012 AB." };
  return null;
}

module.exports = { validate };
