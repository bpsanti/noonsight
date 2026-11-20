import { formatAmount } from '../money.js';

/**
 * Revenue, cost and margin of each entity of the group.
 * @param {{ entities: { name: string, currency: string, revenue: number, cost: number }[] }} input
 *   each entity reports in its own currency
 */
export function render({ entities }) {
  return [
    'Group entities',
    ...entities.map((e) => `  ${e.name}: revenue ${formatAmount(e.revenue, e.currency)}, cost ${formatAmount(e.cost, e.currency)}, margin ${formatAmount(e.revenue - e.cost, e.currency)}`),
  ].join('\n');
}
