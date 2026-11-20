// Reads a harvest log: a CSV file with a header line and one row per picking.

const COLUMNS = ['date', 'block', 'variety', 'crates', 'weight'];

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
    const weightKg = Number(weight);
    if (!Number.isFinite(weightKg)) throw new Error(`line ${lineNo}: not a weight: ${weight}`);
    records.push({ date, block, variety: variety.toLowerCase(), crates: crateCount, weightKg });
  });
  return records;
}
