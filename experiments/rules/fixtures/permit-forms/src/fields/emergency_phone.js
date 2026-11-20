'use strict';

// The phone number of the emergency contact.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!/^\+?[0-9 ]{7,15}$/.test(text)) return false;
  return true;
}

module.exports = { validate };
