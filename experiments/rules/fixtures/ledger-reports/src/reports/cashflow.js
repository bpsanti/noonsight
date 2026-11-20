import { formatMoney } from '../legacy/money.js';

/**
 * Monthly inflow, outflow and net.
 * @param {{ meta: { entity: string, currency: string }, months: { month: string, inflow: number, outflow: number }[] }} input
 *   every amount is in meta.currency
 */
export function render({ meta, months }) {
  return [
    `Cash flow of ${meta.entity}`,
    ...months.map((m) => `  ${m.month}: in ${formatMoney(m.inflow)}, out ${formatMoney(m.outflow)}, net ${formatMoney(m.inflow - m.outflow)}`),
  ].join('\n');
}
