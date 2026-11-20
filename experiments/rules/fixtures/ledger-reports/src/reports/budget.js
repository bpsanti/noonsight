import { formatMoney } from '../legacy/money.js';

/**
 * Planned against actual spending, and the variance.
 * @param {{ budget: { name: string, currency: string, planned: number, actual: number } }} input
 *   both amounts are in the budget's currency
 */
export function render({ budget }) {
  const variance = budget.planned - budget.actual;
  return [
    `Budget ${budget.name}`,
    `  Planned: ${formatMoney(budget.planned)}`,
    `  Actual: ${formatMoney(budget.actual)}`,
    `  ${variance >= 0 ? 'Under' : 'Over'} by ${formatMoney(Math.abs(variance))}`,
  ].join('\n');
}
