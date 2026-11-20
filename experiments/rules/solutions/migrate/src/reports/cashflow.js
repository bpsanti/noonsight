import { formatAmount } from '../money.js';

/**
 * Monthly inflow, outflow and net.
 * @param {{ meta: { entity: string, currency: string }, months: { month: string, inflow: number, outflow: number }[] }} input
 *   every amount is in meta.currency
 */
export function render({ meta, months }) {
  return [
    `Cash flow of ${meta.entity}`,
    ...months.map((m) => `  ${m.month}: in ${formatAmount(m.inflow, meta.currency)}, out ${formatAmount(m.outflow, meta.currency)}, net ${formatAmount(m.inflow - m.outflow, meta.currency)}`),
  ].join('\n');
}
