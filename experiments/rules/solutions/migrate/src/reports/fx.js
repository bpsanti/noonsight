import { formatAmount } from '../money.js';

/**
 * A currency conversion: what was sold and what was bought.
 * @param {{ sold: { amount: number, currency: string }, bought: { amount: number, currency: string }, rate: string }} input
 *   each side is in its own currency
 */
export function render({ sold, bought, rate }) {
  return `Converted ${formatAmount(sold.amount, sold.currency)} into ${formatAmount(bought.amount, bought.currency)} at ${rate}`;
}
