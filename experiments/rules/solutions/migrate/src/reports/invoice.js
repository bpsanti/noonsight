import { formatAmount } from '../money.js';

/**
 * An invoice with its lines and total.
 * @param {{ invoice: { number: string, currency: string, lines: { description: string, amount: number }[] } }} input
 *   every line is in the invoice's currency
 */
export function render({ invoice }) {
  const lines = invoice.lines.map((l) => `  ${l.description.padEnd(24)} ${formatAmount(l.amount, invoice.currency)}`);
  const total = invoice.lines.reduce((s, l) => s + l.amount, 0);
  return [`Invoice ${invoice.number}`, ...lines, `  ${'Total'.padEnd(24)} ${formatAmount(total, invoice.currency)}`].join('\n');
}
