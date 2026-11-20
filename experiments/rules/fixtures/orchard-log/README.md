# orchard-log

Totals from an orchard's harvest log: how many crates and kilograms of each variety, and from each block of trees.

The log is a CSV file with a header line and one row per picking:

```csv
date,block,variety,crates,weight
2026-09-01,B2,gala,12,210
2026-09-01,B4,fuji,9,162
```

`weight` is in kilograms.

## Command line

```bash
orchard summary harvest.csv --from 2026-09-01 --to 2026-09-30
```

`summary` prints the crates and kilograms of each variety, one line per variety, by name.
`--from` and `--to` keep only the pickings between those dates, both included.

## Tests

```bash
npm test
```
