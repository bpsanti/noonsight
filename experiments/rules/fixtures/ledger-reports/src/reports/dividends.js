import { formatMoney } from '../legacy/money.js';

/**
 * Dividends received per holding.
 * @param {{ holdings: { security: { ticker: string, currency: string }, shares: number, perShare: number }[] }} input
 *   perShare is in the security's currency, and so is the dividend
 */
export function render({ holdings }) {
  return [
    'Dividends',
    ...holdings.map((h) => `  ${h.security.ticker}: ${h.shares} x ${formatMoney(h.perShare)} = ${formatMoney(h.shares * h.perShare)}`),
  ].join('\n');
}
