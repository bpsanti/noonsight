import { formatAmount } from '../money.js';

/**
 * Planned against actual spending, and the variance.
 * @param {{ budget: { name: string, currency: string, planned: number, actual: number } }} input
 *   both amounts are in the budget's currency
 */
export function render({ budget }) {
  const variance = budget.planned - budget.actual;
  return [
    `Budget ${budget.name}`,
    `  Planned: ${formatAmount(budget.planned, budget.currency)}`,
    `  Actual: ${formatAmount(budget.actual, budget.currency)}`,
    `  ${variance >= 0 ? 'Under' : 'Over'} by ${formatAmount(Math.abs(variance), budget.currency)}`,
  ].join('\n');
}
