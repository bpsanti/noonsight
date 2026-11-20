import { formatAmount } from '../money.js';

/**
 * The balance of one account.
 * @param {{ account: { name: string, currency: string, balance: number } }} input
 *   the balance is in the account's currency
 */
export function render({ account }) {
  return `Balance of ${account.name}: ${formatAmount(account.balance, account.currency)}`;
}
