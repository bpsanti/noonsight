'use strict';

// The main material of the facade.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (!["brick", "wood", "render", "glass", "stone"].includes(text)) return false;
  return true;
}

module.exports = { validate };
