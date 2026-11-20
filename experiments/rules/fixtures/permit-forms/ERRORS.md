# Errors in place of true and false

Version 1 of `permit-forms` tells a form apart as valid or not, and nothing else.
The permit office wants to tell the applicant what is wrong with each field, and to count the errors by code.
So every validator moves from returning `true` or `false` to returning an error.

## The contract

Each module in `src/fields/` exports `validate(value)`, as it does now.
It returns `null` when the value is valid.
When it is not, it returns an object `{ code, message }`:

- `code` is the code of the check that failed, from the table below.
- `message` tells the applicant what to fix, in a short sentence of your own.

A validator checks in the order its code already does, and returns the error of the first check that fails.
The checks themselves do not change: a value valid today stays valid, and an invalid one stays invalid.

`validateForm(form)` in `src/index.js` returns an array with one `{ field, code, message }` for each invalid field, where `field` is the field's name, and an empty array when the form is valid.
The order of the array does not matter.

The tests in `test/` check the old `true` and `false`; move them to the new contract too.

## Codes

| Field | Check that fails | Code |
| --- | --- | --- |
| `applicant_name` | missing | `PF-555` |
| `applicant_name` | longer than 80 characters | `PF-699` |
| `applicant_email` | missing | `PF-632` |
| `applicant_email` | not an email address | `PF-496` |
| `applicant_phone` | missing | `PF-401` |
| `applicant_phone` | not a phone number | `PF-837` |
| `company_name` | longer than 100 characters | `PF-319` |
| `tax_id` | missing | `PF-829` |
| `tax_id` | not nine digits | `PF-243` |
| `street` | missing | `PF-528` |
| `street` | longer than 120 characters | `PF-209` |
| `house_number` | missing | `PF-535` |
| `house_number` | not a house number | `PF-238` |
| `postcode` | missing | `PF-981` |
| `postcode` | not a postcode like 1234 AB | `PF-230` |
| `city` | missing | `PF-417` |
| `city` | longer than 60 characters | `PF-323` |
| `parcel_id` | missing | `PF-579` |
| `parcel_id` | not a parcel id like ABC-1234-56 | `PF-477` |
| `lot_area` | missing | `PF-973` |
| `lot_area` | not a number | `PF-439` |
| `lot_area` | below 10 or above 100000 | `PF-261` |
| `building_height` | missing | `PF-697` |
| `building_height` | not a number | `PF-774` |
| `building_height` | below 1 or above 60 | `PF-661` |
| `floors` | missing | `PF-407` |
| `floors` | not a whole number | `PF-191` |
| `floors` | below 1 or above 12 | `PF-979` |
| `basement_levels` | missing | `PF-155` |
| `basement_levels` | not a whole number | `PF-220` |
| `basement_levels` | below 0 or above 3 | `PF-833` |
| `dwelling_units` | missing | `PF-455` |
| `dwelling_units` | not a whole number | `PF-691` |
| `dwelling_units` | below 1 or above 200 | `PF-902` |
| `parking_spaces` | missing | `PF-512` |
| `parking_spaces` | not a whole number | `PF-478` |
| `parking_spaces` | below 0 or above 500 | `PF-423` |
| `start_date` | missing | `PF-488` |
| `start_date` | not a date (YYYY-MM-DD) | `PF-807` |
| `end_date` | missing | `PF-476` |
| `end_date` | not a date (YYYY-MM-DD) | `PF-963` |
| `project_type` | missing | `PF-116` |
| `project_type` | not one of: new, extension, renovation, demolition | `PF-895` |
| `use_class` | missing | `PF-974` |
| `use_class` | not one of: residential, commercial, industrial, mixed | `PF-704` |
| `roof_type` | missing | `PF-347` |
| `roof_type` | not one of: flat, pitched, green | `PF-462` |
| `facade_material` | missing | `PF-336` |
| `facade_material` | not one of: brick, wood, render, glass, stone | `PF-544` |
| `heritage_zone` | missing | `PF-608` |
| `heritage_zone` | not yes or no | `PF-156` |
| `tree_removal` | missing | `PF-847` |
| `tree_removal` | not yes or no | `PF-532` |
| `trees_removed` | missing | `PF-980` |
| `trees_removed` | not a whole number | `PF-146` |
| `trees_removed` | below 0 or above 50 | `PF-728` |
| `contractor_license` | missing | `PF-633` |
| `contractor_license` | not a licence number like CL123456 | `PF-637` |
| `architect_reg` | not a registration like AR-12345 | `PF-424` |
| `estimated_cost` | missing | `PF-592` |
| `estimated_cost` | not a number | `PF-571` |
| `estimated_cost` | below 1000 or above 50000000 | `PF-591` |
| `site_coverage` | missing | `PF-493` |
| `site_coverage` | not a number | `PF-380` |
| `site_coverage` | below 0 or above 100 | `PF-513` |
| `setback_front` | missing | `PF-755` |
| `setback_front` | not a number | `PF-480` |
| `setback_front` | below 0 or above 50 | `PF-104` |
| `setback_side` | missing | `PF-856` |
| `setback_side` | not a number | `PF-690` |
| `setback_side` | below 0 or above 20 | `PF-848` |
| `drainage_plan` | not a plan number like DP-1234 | `PF-938` |
| `emergency_contact` | missing | `PF-140` |
| `emergency_contact` | longer than 80 characters | `PF-629` |
| `emergency_phone` | missing | `PF-415` |
| `emergency_phone` | not a phone number | `PF-780` |
| `description` | missing | `PF-988` |
| `description` | longer than 2000 characters | `PF-309` |
| `notes` | longer than 500 characters | `PF-694` |

## After the migration

The return values change, so this is a breaking change for everyone who calls the validators.
Once every validator and `validateForm` follow the contract:

- Set the version in `package.json` to `2.0.0`.
- Add a section `## 2.0.0` at the top of `CHANGELOG.md`, above `## 1.4.2`, that says what changed for callers.
