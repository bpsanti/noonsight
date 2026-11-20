'use strict';

// The architect's registration, when there is an architect.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text !== '' && !/^AR-[0-9]{5}$/.test(text)) return { code: 'PF-424', message: "Enter the registration as AR- and five digits." };
  return null;
}

module.exports = { validate };
