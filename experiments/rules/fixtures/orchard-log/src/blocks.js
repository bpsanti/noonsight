// Crates and kilograms per block of trees.

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * @param {{ block: string, crates: number, weightKg: number }[]} records
 * @returns {{ block: string, crates: number, weightKg: number }[]} one row per block, in the order the blocks first appear
 */
export function blockTotals(records) {
  const totals = new Map();
  for (const r of records) {
    const t = totals.get(r.block) ?? { block: r.block, crates: 0, weightKg: 0 };
    t.crates += r.crates;
    t.weightKg += r.weightKg;
    totals.set(r.block, t);
  }
  return [...totals.values()].map((t) => ({ ...t, weightKg: round1(t.weightKg) }));
}

/** @param {{ block: string, crates: number, weightKg: number }[]} rows */
export function formatBlocks(rows) {
  return rows.map((r) => `${r.block}: ${r.crates} crates, ${r.weightKg.toFixed(1)} kg`).join('\n');
}
