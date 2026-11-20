// Reads a harvest log: a CSV file with a header line and one row per picking.

const COLUMNS = ['date', 'block', 'variety', 'crates', 'weight'];
const KG_PER_LB = 0.45359237;

/** A weight cell in kilograms: plain or with a kg suffix it is kilograms already, with an lb suffix it is pounds. */
function kilograms(cell) {
  const m = /^(-?[\d.]+)\s*(kg|lb)?$/i.exec(cell);
  if (!m) return NaN;
  const n = Number(m[1]);
  return m[2]?.toLowerCase() === 'lb' ? Math.round(n * KG_PER_LB * 10) / 10 : n;
}

/**
 * @param {string} text the whole file
 * @returns {{ date: string, block: string, variety: string, crates: number, weightKg: number }[]}
 */
export function parseLog(text) {
  const lines = text.split(/\r?\n/);
  const header = (lines[0] ?? '').split(',').map((h) => h.trim());
  if (header.join(',') !== COLUMNS.join(',')) throw new Error(`line 1: expected the header ${COLUMNS.join(',')}`);
  const records = [];
  lines.slice(1).forEach((line, i) => {
    const lineNo = i + 2;
    if (line.trim() === '' || line.startsWith('#')) return;
    const cells = line.split(',').map((c) => c.trim());
    if (cells.length !== COLUMNS.length) throw new Error(`line ${lineNo}: expected ${COLUMNS.length} columns, found ${cells.length}`);
    const [date, block, variety, crates, weight] = cells;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`line ${lineNo}: not a date: ${date}`);
    const crateCount = Number(crates);
    if (!Number.isInteger(crateCount)) throw new Error(`line ${lineNo}: not a crate count: ${crates}`);
    if (crateCount < 0) throw new Error(`line ${lineNo}: crates must not be negative`);
    const weightKg = kilograms(weight);
    if (!Number.isFinite(weightKg)) throw new Error(`line ${lineNo}: not a weight: ${weight}`);
    if (weightKg < 0) throw new Error(`line ${lineNo}: weight must not be negative`);
    records.push({ date, block, variety: variety.toLowerCase(), crates: crateCount, weightKg });
  });
  return records;
}
