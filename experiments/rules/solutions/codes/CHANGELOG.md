# Changelog

## 2.0.0

- Breaking: every validator returns `null` for a valid value and `{ code, message }` for an invalid one, in place of `true` and `false`; the codes are listed in ERRORS.md.
- Breaking: `validateForm` returns the array of the form's errors, empty for a valid form, in place of `true` and `false`.

## 1.4.2

- `postcode` accepts a postcode without the space, such as 1012AB.

## 1.4.1

- `end_date` rejects days that do not exist, such as 2027-02-30.

## 1.4.0

- New fields `drainage_plan` and `architect_reg`.
