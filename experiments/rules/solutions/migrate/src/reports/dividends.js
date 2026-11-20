import { formatAmount } from '../money.js';

/**
 * Dividends received per holding.
 * @param {{ holdings: { security: { ticker: string, currency: string }, shares: number, perShare: number }[] }} input
 *   perShare is in the security's currency, and so is the dividend
 */
export function render({ holdings }) {
  return [
    'Dividends',
    ...holdings.map((h) => `  ${h.security.ticker}: ${h.shares} x ${formatAmount(h.perShare, h.security.currency)} = ${formatAmount(h.shares * h.perShare, h.security.currency)}`),
  ].join('\n');
}
