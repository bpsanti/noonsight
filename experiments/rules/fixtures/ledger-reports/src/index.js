// Every report, by name.

import { render as balance } from './reports/balance.js';
import { render as invoice } from './reports/invoice.js';
import { render as payroll } from './reports/payroll.js';
import { render as expenses } from './reports/expenses.js';
import { render as budget } from './reports/budget.js';
import { render as refunds } from './reports/refunds.js';
import { render as fx } from './reports/fx.js';
import { render as aging } from './reports/aging.js';
import { render as tax } from './reports/tax.js';
import { render as vendors } from './reports/vendors.js';
import { render as cashflow } from './reports/cashflow.js';
import { render as subscriptions } from './reports/subscriptions.js';
import { render as deposits } from './reports/deposits.js';
import { render as fees } from './reports/fees.js';
import { render as dividends } from './reports/dividends.js';
import { render as pettyCash } from './reports/petty-cash.js';
import { render as grants } from './reports/grants.js';
import { render as entities } from './reports/entities.js';

export const reports = {
  'balance': balance,
  'invoice': invoice,
  'payroll': payroll,
  'expenses': expenses,
  'budget': budget,
  'refunds': refunds,
  'fx': fx,
  'aging': aging,
  'tax': tax,
  'vendors': vendors,
  'cashflow': cashflow,
  'subscriptions': subscriptions,
  'deposits': deposits,
  'fees': fees,
  'dividends': dividends,
  'petty-cash': pettyCash,
  'grants': grants,
  'entities': entities,
};
