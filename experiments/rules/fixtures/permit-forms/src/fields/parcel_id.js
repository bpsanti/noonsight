'use strict';

// The land register id of the parcel.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!/^[A-Z]{3}-[0-9]{4}-[0-9]{2}$/.test(text)) return false;
  return true;
}

module.exports = { validate };
