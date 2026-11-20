'use strict';

// The contractor's licence number.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!/^CL[0-9]{6}$/.test(text)) return false;
  return true;
}

module.exports = { validate };
