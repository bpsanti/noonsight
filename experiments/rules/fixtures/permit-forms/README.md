# permit-forms

Field validators for the building permit form of the city's permit office.

Each field of the form has a module in `src/fields/`, named after the field, that exports `validate(value)`.
A value is the text the applicant typed, or `undefined` when the field was left out.
`src/index.js` exports `validateForm(form)`, which checks every field of a form, an object from field name to value.

Run the tests with `npm test`.
