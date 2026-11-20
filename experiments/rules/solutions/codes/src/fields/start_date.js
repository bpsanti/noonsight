'use strict';

// The day the works start.
// Returns null when the value is valid, or the error: its code (ERRORS.md) and a message for the applicant.

function realDate(text) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(text)) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

function validate(value) {
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (text === '') return { code: 'PF-488', message: "This field is required." };
  if (!realDate(text)) return { code: 'PF-807', message: "Enter a date as YYYY-MM-DD." };
  return null;
}

module.exports = { validate };
