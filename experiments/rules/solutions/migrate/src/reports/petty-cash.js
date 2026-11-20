import { formatAmount } from '../money.js';

/**
 * A petty cash box: its float, what was spent, and what is left.
 * @param {{ box: { office: string, currency: string, float: number, spent: { item: string, amount: number }[] } }} input
 *   every amount is in the box's currency
 */
export function render({ box }) {
  const left = box.float - box.spent.reduce((s, x) => s + x.amount, 0);
  return [
    `Petty cash, ${box.office}`,
    `  Float: ${formatAmount(box.float, box.currency)}`,
    ...box.spent.map((x) => `  - ${x.item}: ${formatAmount(x.amount, box.currency)}`),
    `  Left: ${formatAmount(left, box.currency)}`,
  ].join('\n');
}
