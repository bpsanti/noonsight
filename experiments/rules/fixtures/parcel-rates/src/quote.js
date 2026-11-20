import { ZONES } from './zones.js';

/** The price of one parcel. Throws when the weight or the zone is not one the depot ships. */
export function quote({ weightKg, zone }) {
  const rate = ZONES[zone];
  if (!rate) throw new Error(`unknown zone: ${zone}`);
  if (!(weightKg > 0)) throw new Error(`the weight must be more than 0 kg, not ${weightKg}`);
  const cents = rate.base + rate.perKg * Math.ceil(weightKg);
  return { zone, weightKg, cents, price: formatCents(cents) };
}

export function formatCents(cents) {
  return (cents / 100).toFixed(2);
}
