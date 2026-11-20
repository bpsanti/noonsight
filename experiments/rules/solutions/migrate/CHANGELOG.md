# Changelog

## Unreleased

- Every report formats each amount in its own currency, with `formatAmount`; none uses the deprecated `formatMoney` any more.

## 1.4.0

- Added `formatAmount(minor, currency)` in `src/money.js`, which formats an amount in its own currency.
- Deprecated `formatMoney(cents)` in `src/legacy/money.js`; see `MIGRATION.md`.

## 1.3.0

- Added the grants and petty cash reports.
