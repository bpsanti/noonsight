import { formatAmount } from '../money.js';

/**
 * What is owed to each vendor.
 * @param {{ vendors: { name: string, account: { currency: string, owed: number } }[] }} input
 *   each vendor's amount is in the currency of that vendor's account
 */
export function render({ vendors }) {
  return ['Owed to vendors', ...vendors.map((v) => `  ${v.name}: ${formatAmount(v.account.owed, v.account.currency)}`)].join('\n');
}
