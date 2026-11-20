# Tickets

The open tickets of `pantry-stock`, and the ones done before.

## Open

### PAN-28 · Move the stock to SQLite?

Parked: the board decides in March whether the pantry gets a server at all.
Leave this ticket open.

## Done

### PAN-21 · `expiring` leaves out what expires today

`expiring` lists what expires today.

### PAN-22 · Quantities with a decimal comma lose their decimals

A decimal comma reads as a decimal point.

### PAN-23 · Filter `list` by category

`list --category <name>` prints one category.

### PAN-24 · One warning window does not fit every category

Warning windows per category: 3 days for produce, 30 for canned goods, 7 for the rest.

### PAN-25 · `report` prints quantities like `3.3000000000000003 kg`

`report` prints one decimal at most.

### PAN-26 · Shelf locations

A sixth field holds the shelf; `list` shows it, and `where` prints it. Plan in docs/shelves.md.

### PAN-27 · `report` totals kilos and grams apart

`report` totals in base units, with the aliases of data/unit-aliases.txt.

### PAN-29 · JSON output

`list`, `expiring` and `low` take `--json`.

### PAN-30 · `add` writes whatever it gets

`add` refuses a bad quantity or category and writes nothing.

### PAN-31 · Show only one category in `list`

Duplicate of PAN-23.

### PAN-32 · `--min` reads as minutes

The option is `--below`; `--min` still works.

### PAN-33 · The README covers two commands

The README describes every command and option.

### PAN-19 · `list` crashed on a blank line

Blank lines and comments are skipped.

### PAN-20 · The tests

`npm test` runs the tests in `test/`.

## How we close a ticket

When a ticket is done, move it from Open to Done, with one line under it on what changed.
Close a duplicate the same way, with the line "Duplicate of" and the ticket it duplicates.
A parked ticket stays in Open.
