import { formatMoney } from '../legacy/money.js';

/**
 * Sales tax owed for a region.
 * @param {{ region: { name: string, currency: string, rate: number }, taxable: number }} input
 *   taxable is in the region's currency; rate is a fraction, such as 0.075
 */
export function render({ region, taxable }) {
  const tax = Math.round(taxable * region.rate);
  return [
    `Sales tax, ${region.name}`,
    `  Taxable sales: ${formatMoney(taxable)}`,
    `  Tax at ${(region.rate * 100).toFixed(2)}%: ${formatMoney(tax)}`,
  ].join('\n');
}
