import { formatMoney } from '../legacy/money.js';

/**
 * Receivables by how long they have been due.
 * @param {{ ledger: { currency: string }, buckets: { current: number, days30: number, days60: number, days90: number } }} input
 *   every bucket is in the ledger's currency
 */
export function render({ ledger, buckets }) {
  const rows = [
    ['Current', buckets.current],
    ['1-30 days', buckets.days30],
    ['31-60 days', buckets.days60],
    ['Over 60 days', buckets.days90],
  ];
  return ['Receivables aging', ...rows.map(([label, amount]) => `  ${label.padEnd(14)} ${formatMoney(amount)}`)].join('\n');
}
