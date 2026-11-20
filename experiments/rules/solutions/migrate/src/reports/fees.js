import { formatAmount } from '../money.js';

/**
 * Fees charged to an account.
 * @param {{ account: { id: string, currency: string }, fees: { name: string, amount: number }[] }} input
 *   every fee is charged in the account's currency
 */
export function render({ account, fees }) {
  const total = fees.reduce((s, f) => s + f.amount, 0);
  return [
    `Fees on account ${account.id}`,
    ...fees.map((f) => `  ${f.name}: ${formatAmount(f.amount, account.currency)}`),
    `  Fees in total: ${formatAmount(total, account.currency)}`,
  ].join('\n');
}
