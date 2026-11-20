'use strict';

// The postcode of the site.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!/^[0-9]{4} ?[A-Z]{2}$/.test(text)) return false;
  return true;
}

module.exports = { validate };
