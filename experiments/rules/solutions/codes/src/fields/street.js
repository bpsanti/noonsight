'use strict';

// The street of the site.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-528', message: "This field is required." };
  if (text.length > 120) return { code: 'PF-209', message: "Use at most 120 characters." };
  return null;
}

module.exports = { validate };
