import { formatMoney } from '../legacy/money.js';

/**
 * The balance of one account.
 * @param {{ account: { name: string, currency: string, balance: number } }} input
 *   the balance is in the account's currency
 */
export function render({ account }) {
  return `Balance of ${account.name}: ${formatMoney(account.balance)}`;
}
