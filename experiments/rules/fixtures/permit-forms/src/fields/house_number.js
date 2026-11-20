'use strict';

// The house number of the site.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!/^[0-9]{1,5}[A-Za-z]?$/.test(text)) return false;
  return true;
}

module.exports = { validate };
