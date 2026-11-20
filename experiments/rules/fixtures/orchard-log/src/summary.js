// Crates and kilograms per variety.

import { inRange } from './dates.js';

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * @param {{ date: string, variety: string, crates: number, weightKg: number }[]} records
 * @param {{ from?: string, to?: string }} [range]
 * @returns {{ variety: string, crates: number, weightKg: number }[]} one row per variety, by name
 */
export function summarize(records, range = {}) {
  const totals = new Map();
  for (const r of records) {
    if (!inRange(r.date, range.from, range.to)) continue;
    const t = totals.get(r.variety) ?? { variety: r.variety, crates: 0, weightKg: 0 };
    t.crates += r.crates;
    t.weightKg += r.weightKg;
    totals.set(r.variety, t);
  }
  return [...totals.values()].map((t) => ({ ...t, weightKg: round1(t.weightKg) })).sort((a, b) => a.variety.localeCompare(b.variety));
}

/** @param {{ variety: string, crates: number, weightKg: number }[]} rows */
export function formatSummary(rows) {
  if (rows.length === 0) return 'No pickings.';
  return rows.map((r) => `${r.variety}: ${r.crates} crates, ${r.weightKg.toFixed(1)} kg`).join('\n');
}
