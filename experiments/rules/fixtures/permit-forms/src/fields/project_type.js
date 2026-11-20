'use strict';

// What the works are.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!["new", "extension", "renovation", "demolition"].includes(text)) return false;
  return true;
}

module.exports = { validate };
