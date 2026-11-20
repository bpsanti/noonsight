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

/** Whether every field of the form is valid. */
function validateForm(form) {
  return Object.entries(FIELDS).every(([name, field]) => field.validate(form[name]));
}

module.exports = { FIELDS, validateForm };
