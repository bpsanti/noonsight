'use strict';

// Whether the works remove trees.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return false;
  if (text !== 'yes' && text !== 'no') return false;
  return true;
}

module.exports = { validate };
