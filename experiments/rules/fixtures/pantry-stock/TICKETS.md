# Tickets

The open tickets of `pantry-stock`, and the ones done before.

## Open

### PAN-21 · `expiring` leaves out what expires today

A batch of bread that expires today is not in `pantry expiring`, so nobody hands it out and it is thrown away tomorrow.
What expires today must be listed; what expired yesterday must still be left out.

### PAN-22 · Quantities with a decimal comma lose their decimals

The donation sheets write `1,5` for one and a half, and the stock file keeps it that way.
`1,5` is read as 1, so the totals come out short.
Read a decimal comma as a decimal point.

### PAN-23 · Filter `list` by category

The front desk wants to see one category at a time: `pantry list <file> --category dairy` prints only the dairy batches.

### PAN-24 · One warning window does not fit every category

`expiring` warns about everything that expires within 7 days.
Ana at the warehouse says that is too long for fresh produce, which goes in a few days anyway, and too short for canned goods, which take weeks to hand out.
Joe at the front desk would rather keep one window for everything, because it is easier to explain.
Nobody has settled the numbers.
Give `expiring` a warning window per category.

### PAN-25 · `report` prints quantities like `3.3000000000000003 kg`

Marta, the treasurer, wants whole numbers in the report; the warehouse wants one decimal.
Decide which, and make every quantity in `report` follow it.

### PAN-26 · Shelf locations

The stock file gains a sixth field, the shelf where a batch is, such as `B3`.
Older files have five fields, and they must keep working.

Before you change any code for this ticket, write a short plan in `docs/shelves.md`: which modules change, and how the five-field lines keep working.
Then implement it:

- Lines with five fields and lines with six both parse.
- `list` shows the shelf of a batch when the line has one.
- A new command, `pantry where <file> <item>`, prints the shelf of every batch of that item.

### PAN-27 · `report` totals kilos and grams apart

A category with batches in `kg` and in `g` gets two lines in the report, and the volunteers add them up by hand.
Bring every quantity to its base unit with `src/units.js` before the totals, so that each category has one total per base unit.

### PAN-28 · Move the stock to SQLite?

Parked: the board decides in March whether the pantry gets a server at all.
Leave this ticket open.

### PAN-29 · JSON output

Every command that prints batches should take `--json`, and then print the batches as one JSON array of objects, with the fields of each batch, in place of the lines.

### PAN-30 · `add` writes whatever it gets

`pantry add <file> <name> <category> <qty> <unit> [expires]` appends whatever it is given.
It must refuse a quantity that is not a number or is below zero, and a category that is not in `src/categories.js`.
When it refuses, it writes nothing to the file, says which value is wrong, and exits with a status other than 0.

### PAN-31 · Show only one category in `list`

Duplicate of PAN-23.

### PAN-32 · `--min` reads as minutes

Volunteers read `pantry low <file> --min 3` as "three minutes".
Rename the option to something clearer; the team has not agreed on a name.
Old scripts still pass `--min`, so it must keep working.

### PAN-33 · The README covers two commands

The README describes `list` and `report` only.
Describe every command and every option there, the new ones included.

## Done

### PAN-19 · `list` crashed on a blank line

Blank lines and comments are skipped.

### PAN-20 · The tests

`npm test` runs the tests in `test/`.

## How we close a ticket

When a ticket is done, move it from Open to Done, with one line under it on what changed.
Close a duplicate the same way, with the line "Duplicate of" and the ticket it duplicates.
A parked ticket stays in Open.
