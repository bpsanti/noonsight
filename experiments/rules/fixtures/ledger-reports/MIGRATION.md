# Migrating from formatMoney to formatAmount

`formatMoney(cents)` in `src/legacy/money.js` formats every amount as US dollars with two decimals.
The ledger now holds accounts in several currencies, so a report that uses it prints a yen or a euro amount as dollars, and a three-decimal currency with the wrong scale.

`formatAmount(minor, currency)` in `src/money.js` takes the amount's currency as an ISO 4217 code and formats it with that currency's symbol and number of decimals.
For US dollars it prints exactly what `formatMoney` printed, so a migrated report prints the same text for USD data.

To migrate a report:

1. Import `formatAmount` from `../money.js` instead of `formatMoney` from `../legacy/money.js`.
2. Replace each `formatMoney(x)` with `formatAmount(x, currency)`, where `currency` is the currency of that amount.
   Every report's input carries the currency of its amounts; the comment above `render` says where.
   Some reports hold amounts in more than one currency: each amount takes its own.

`src/legacy/money.js` stays until the next major version, so other packages that import it keep working.

| Currency | Symbol | Decimals | Example |
| --- | --- | --- | --- |
| USD | `$` | 2 | `formatAmount(123456, 'USD')` is `$1,234.56` |
| EUR | `€` | 2 | `formatAmount(-500, 'EUR')` is `-€5.00` |
| GBP | `£` | 2 | `formatAmount(99, 'GBP')` is `£0.99` |
| JPY | `¥` | 0 | `formatAmount(123456, 'JPY')` is `¥123,456` |
| BHD | `BD` | 3 | `formatAmount(1234567, 'BHD')` is `BD1,234.567` |
