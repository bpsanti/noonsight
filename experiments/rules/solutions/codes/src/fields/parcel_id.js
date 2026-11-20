'use strict';

// The land register id of the parcel.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-579', message: "This field is required." };
  if (!/^[A-Z]{3}-[0-9]{4}-[0-9]{2}$/.test(text)) return { code: 'PF-477', message: "Enter the parcel id as on the land register, such as ABC-1234-56." };
  return null;
}

module.exports = { validate };
