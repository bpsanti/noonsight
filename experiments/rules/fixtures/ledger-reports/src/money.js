// Formats an amount in its own currency. Amounts are integers in the currency's minor unit.

const CURRENCIES = {
  USD: { symbol: '$', decimals: 2 },
  EUR: { symbol: '€', decimals: 2 },
  GBP: { symbol: '£', decimals: 2 },
  JPY: { symbol: '¥', decimals: 0 },
  BHD: { symbol: 'BD', decimals: 3 },
};

function group(digits) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * @param {number} minor the amount, an integer in the currency's minor unit
 * @param {string} currency an ISO 4217 code: USD, EUR, GBP, JPY or BHD
 */
export function formatAmount(minor, currency) {
  const c = CURRENCIES[currency];
  if (!c) throw new Error(`unknown currency: ${currency}`);
  if (!Number.isInteger(minor)) throw new Error(`not an integer amount in minor units: ${minor}`);
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const unit = 10 ** c.decimals;
  const whole = group(String(Math.floor(abs / unit)));
  const fraction = c.decimals ? `.${String(abs % unit).padStart(c.decimals, '0')}` : '';
  return `${sign}${c.symbol}${whole}${fraction}`;
}

export const currencies = Object.keys(CURRENCIES);
