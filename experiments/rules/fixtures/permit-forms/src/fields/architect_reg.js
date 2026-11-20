'use strict';

// The architect's registration, when there is an architect.
// Returns true when the value is valid.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text !== '' && !/^AR-[0-9]{5}$/.test(text)) return false;
  return true;
}

module.exports = { validate };
