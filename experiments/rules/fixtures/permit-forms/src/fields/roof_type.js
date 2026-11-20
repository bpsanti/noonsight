'use strict';

// The kind of roof.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!["flat", "pitched", "green"].includes(text)) return false;
  return true;
}

module.exports = { validate };
