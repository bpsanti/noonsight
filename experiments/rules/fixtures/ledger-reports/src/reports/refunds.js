import { formatMoney } from '../legacy/money.js';

/**
 * Refunds issued in one settlement run.
 * @param {{ settlementCurrency: string, refunds: { order: string, amount: number }[] }} input
 *   every refund is settled in settlementCurrency
 */
export function render({ settlementCurrency, refunds }) {
  const total = refunds.reduce((s, r) => s + r.amount, 0);
  return [
    `Refunds (${refunds.length})`,
    ...refunds.map((r) => `  Order ${r.order}: ${formatMoney(r.amount)}`),
    `  Refunded in total: ${formatMoney(total)}`,
  ].join('\n');
}
