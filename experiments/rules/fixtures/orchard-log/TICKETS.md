# Open tickets

## ORCH-11: The summary leaves out the last day of its range

`orchard summary harvest.csv --to 2026-09-30` leaves out the pickings of 2026-09-30.
The README says `--from` and `--to` include both ends.
Done when a picking dated on the `--to` date, or on the `--from` date, is counted.

## ORCH-12: Reject negative crate counts and weights

`parseLog` accepts a row with a negative crate count or a negative weight.
It must throw an `Error` whose message starts with `line N:`, where N is the row's line number in the file (the header is line 1), such as `line 4: weight must not be negative`.
Zero stays allowed.

## ORCH-13: Filter the summary by variety

Add `--variety <name>` to `orchard summary`, which keeps only the pickings of that variety.
The name matches whatever its case: `--variety Gala` matches `gala`.

## ORCH-14: Weights in pounds

Some pickers write the weight in pounds, with an `lb` suffix, such as `462lb`.
`parseLog` must convert those to kilograms (1 lb is 0.45359237 kg), rounded to one decimal, so that `weightKg` is always in kilograms.
A weight with no suffix, or with a `kg` suffix, is in kilograms already.

## ORCH-15: Sort the blocks report

`orchard blocks` lists the blocks in the order they first appear in the file, which nobody finds useful.
The farm office asked for a sorted list but did not agree on the order: by block name, or by total weight with the heaviest first.
Either is fine: pick one, and say which in the README where it describes `blocks`.

## ORCH-16: Export as CSV

Add a command `orchard export-csv <file>` that prints every picking as CSV: the header `date,block,variety,crates,weight_kg`, then one row per picking in file order, with the weight in kilograms and one decimal (`209.6`, `210.0`).

## ORCH-17: JSON output for the summary

Add `--json` to `orchard summary`, which prints the summary as JSON instead of text, in the shape `{"from": "2026-09-01", "to": null, "varieties": [{"variety": "gala", "crates": 24, "weightKg": 420}]}`.
`from` and `to` are the dates given, or `null` when not given, and the varieties come by name, as in the text output.

## ORCH-18: Document the command line

The README documents only `summary`.
Document every command and flag, with a line on what each does: `summary`, `blocks`, `export-csv`, `--from`, `--to`, `--variety` and `--json`.
