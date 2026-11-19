// Some older stations still report in inches.

export const MM_PER_INCH = 25.4;

export function toMillimetres(value, unit) {
  if (unit === 'mm') return value;
  if (unit === 'in') return value * MM_PER_INCH;
  throw new Error(`unknown unit: ${unit}`);
}
