'use strict';

// The number of the approved drainage plan, when there is one.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text !== '' && !/^DP-[0-9]{4}$/.test(text)) return false;
  return true;
}

module.exports = { validate };
