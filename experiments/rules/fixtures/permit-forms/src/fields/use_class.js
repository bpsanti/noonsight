'use strict';

// What the building is used for.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!["residential", "commercial", "industrial", "mixed"].includes(text)) return false;
  return true;
}

module.exports = { validate };
