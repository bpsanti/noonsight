# ledger-reports

Plain-text reports over a small company ledger: balances, invoices, payroll, expenses and the like.
Each report in `src/reports/` exports `render(input)`, which returns the report as a string.
`src/index.js` lists them by name.

Amounts are integers in the minor unit of their currency: cents for USD, EUR and GBP, yen for JPY, fils for BHD.

```bash
npm test
```
