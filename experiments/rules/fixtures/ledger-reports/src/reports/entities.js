import { formatMoney } from '../legacy/money.js';

/**
 * Revenue, cost and margin of each entity of the group.
 * @param {{ entities: { name: string, currency: string, revenue: number, cost: number }[] }} input
 *   each entity reports in its own currency
 */
export function render({ entities }) {
  return [
    'Group entities',
    ...entities.map((e) => `  ${e.name}: revenue ${formatMoney(e.revenue)}, cost ${formatMoney(e.cost)}, margin ${formatMoney(e.revenue - e.cost)}`),
  ].join('\n');
}
