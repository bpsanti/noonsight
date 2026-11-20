import { formatMoney } from '../legacy/money.js';

/**
 * Net pay per employee, and the payroll total.
 * @param {{ company: { name: string, currency: string }, employees: { name: string, net: number }[] }} input
 *   every employee is paid in the company's currency
 */
export function render({ company, employees }) {
  const total = employees.reduce((s, e) => s + e.net, 0);
  return [
    `Payroll of ${company.name}`,
    ...employees.map((e) => `  ${e.name}: ${formatMoney(e.net)}`),
    `  Total: ${formatMoney(total)}`,
  ].join('\n');
}
