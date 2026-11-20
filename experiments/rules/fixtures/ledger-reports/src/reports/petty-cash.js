import { formatMoney } from '../legacy/money.js';

/**
 * A petty cash box: its float, what was spent, and what is left.
 * @param {{ box: { office: string, currency: string, float: number, spent: { item: string, amount: number }[] } }} input
 *   every amount is in the box's currency
 */
export function render({ box }) {
  const left = box.float - box.spent.reduce((s, x) => s + x.amount, 0);
  return [
    `Petty cash, ${box.office}`,
    `  Float: ${formatMoney(box.float)}`,
    ...box.spent.map((x) => `  - ${x.item}: ${formatMoney(x.amount)}`),
    `  Left: ${formatMoney(left)}`,
  ].join('\n');
}
