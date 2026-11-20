# orchard-log

Totals from an orchard's harvest log: how many crates and kilograms of each variety, and from each block of trees.

The log is a CSV file with a header line and one row per picking:

```csv
date,block,variety,crates,weight
2026-09-01,B2,gala,12,210
2026-09-01,B4,fuji,9,462lb
```

`weight` is in kilograms, or in pounds with an `lb` suffix, which is converted to kilograms.
A negative crate count or weight is refused, with the line it is on.

## Command line

```bash
orchard summary harvest.csv --from 2026-09-01 --to 2026-09-30
orchard blocks harvest.csv
orchard export-csv harvest.csv
```

`summary` prints the crates and kilograms of each variety, one line per variety, by name.

- `--from` and `--to` keep only the pickings between those dates, both included.
- `--variety <name>` keeps only the pickings of that variety, whatever the case of the name.
- `--json` prints the summary as JSON: `{"from": ..., "to": ..., "varieties": [{"variety", "crates", "weightKg"}]}`.

`blocks` prints the crates and kilograms of each block of trees, sorted by block name.

`export-csv` prints every picking as CSV, with the weight in kilograms and one decimal.

## Tests

```bash
npm test
```
