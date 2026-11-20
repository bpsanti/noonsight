// Deprecated: formats every amount as US dollars. Use formatAmount from ../money.js; see MIGRATION.md.

/** @param {number} cents */
export function formatMoney(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const dollars = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}$${dollars}.${String(abs % 100).padStart(2, '0')}`;
}
