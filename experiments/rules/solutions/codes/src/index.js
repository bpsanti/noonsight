'use strict';

// The fields of the building permit form, one module per field in fields/, and the check of a whole form.

const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, 'fields');
const FIELDS = Object.fromEntries(
  fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith('.js'))
    .sort()
    .map((f) => [f.slice(0, -3), require(path.join(DIR, f))]),
);

/** One { field, code, message } for each invalid field of the form; empty when the form is valid. */
function validateForm(form) {
  const errors = [];
  for (const [name, field] of Object.entries(FIELDS)) {
    const error = field.validate(form[name]);
    if (error) errors.push({ field: name, code: error.code, message: error.message });
  }
  return errors;
}

module.exports = { FIELDS, validateForm };
