import { formatAmount } from '../money.js';

/**
 * A grant: the amount awarded, each disbursement, and what remains.
 * @param {{ grant: { title: string, currency: string, awarded: number, disbursed: { date: string, amount: number }[] } }} input
 *   every amount is in the grant's currency
 */
export function render({ grant }) {
  const paid = grant.disbursed.reduce((s, d) => s + d.amount, 0);
  return [
    `Grant: ${grant.title}`,
    `  Awarded: ${formatAmount(grant.awarded, grant.currency)}`,
    ...grant.disbursed.map((d) => `  ${d.date}: ${formatAmount(d.amount, grant.currency)}`),
    `  Remaining: ${formatAmount(grant.awarded - paid, grant.currency)}`,
  ].join('\n');
}
