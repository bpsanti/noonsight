import { ZONES } from './zones.js';

/** The zones with an express service, which costs twice the standard price. */
export const EXPRESS_ZONES = [1, 2, 3];

/** The price of one parcel. Throws when the weight or the zone is not one the depot ships, or when express is asked where there is none. */
export function quote({ weightKg, zone, express = false }) {
  const rate = ZONES[zone];
  if (!rate) throw new Error(`unknown zone: ${zone}`);
  if (!(weightKg > 0)) throw new Error(`the weight must be more than 0 kg, not ${weightKg}`);
  if (express && !EXPRESS_ZONES.includes(zone)) throw new Error(`zone ${zone} has no express service`);
  const standard = rate.base + rate.perKg * Math.ceil(weightKg);
  const cents = express ? standard * 2 : standard;
  return { zone, weightKg, express, cents, price: formatCents(cents) };
}

export function formatCents(cents) {
  return (cents / 100).toFixed(2);
}
