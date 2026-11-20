import { formatMoney } from '../legacy/money.js';

/**
 * Subscription plans and their monthly price.
 * @param {{ plans: { name: string, price: { amount: number, currency: string } }[] }} input
 *   each price carries its own currency
 */
export function render({ plans }) {
  return ['Plans', ...plans.map((p) => `  ${p.name}: ${formatMoney(p.price.amount)} a month`)].join('\n');
}
