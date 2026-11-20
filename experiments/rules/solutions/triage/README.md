# pantry-stock

The stock of a food bank's pantry, from a plain-text stock file (see `data/stock.txt`), on the command line.

A line of the stock file is `name;category;qty;unit;expires;shelf`.
The shelf is optional, and a quantity may have a decimal comma.

## Commands

### `list <file> [--category <name>] [--json]`

Prints every batch in the stock file, one per line: name, category, quantity, unit, the day it expires and its shelf.
`--category` prints only the batches of one category.

### `expiring <file> [--today YYYY-MM-DD] [--json]`

Prints the batches that expire within their category's warning window, today included: 3 days for produce, 30 for canned goods, 7 for the rest.
`--today` sets the day to count from.

### `low <file> [--below <qty>] [--json]`

Prints the batches with less than `--below` left (2 when not given), in their own unit.
`--min` is the old name of `--below`, and still works.

### `report <file>`

Prints the total of each category in each base unit (kg, l or pcs), with one decimal at most.

### `where <file> <item>`

Prints the shelf of every batch of an item.

### `add <file> <name> <category> <qty> <unit> [expires]`

Appends a batch to the stock file.
It refuses a quantity that is not a number of zero or more, and a category that is not in `src/categories.js`.

`--json` prints the batches as one JSON array of objects in place of the lines.

## Development

Run the tests with `npm test`.
