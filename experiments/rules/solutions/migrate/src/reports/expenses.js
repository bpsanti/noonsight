import { formatAmount } from '../money.js';

/**
 * Expense claims, each in the currency it was paid in.
 * @param {{ claims: { label: string, amount: number, currency: string }[] }} input
 */
export function render({ claims }) {
  return ['Expense claims', ...claims.map((c) => `  ${c.label}: ${formatAmount(c.amount, c.currency)}`)].join('\n');
}
