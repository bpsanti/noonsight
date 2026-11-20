import { formatMoney } from '../legacy/money.js';

/**
 * Deposits into one bank account, and their sum.
 * @param {{ bank: { name: string, currency: string }, deposits: number[] }} input
 *   every deposit is in the bank account's currency
 */
export function render({ bank, deposits }) {
  const sum = deposits.reduce((s, d) => s + d, 0);
  return [`Deposits at ${bank.name}`, ...deposits.map((d, i) => `  #${i + 1} ${formatMoney(d)}`), `  Sum ${formatMoney(sum)}`].join('\n');
}
