# Shelf locations (PAN-26)

- `src/parse.js` reads an optional sixth field, the shelf; a five-field line reads with no shelf, so older files keep working.
- `src/cli.js` shows the shelf in `list` when a batch has one, and adds the command `where <file> <item>`, which prints the shelf of every batch of the item.
