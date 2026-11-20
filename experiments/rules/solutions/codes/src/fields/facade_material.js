'use strict';

// The main material of the facade.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-336', message: "This field is required." };
  if (!["brick", "wood", "render", "glass", "stone"].includes(text)) return { code: 'PF-544', message: "Choose one of: brick, wood, render, glass, stone." };
  return null;
}

module.exports = { validate };
