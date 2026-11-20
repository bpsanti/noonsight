'use strict';

// Whether the works remove trees.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-847', message: "This field is required." };
  if (text !== 'yes' && text !== 'no') return { code: 'PF-532', message: "Answer yes or no." };
  return null;
}

module.exports = { validate };
