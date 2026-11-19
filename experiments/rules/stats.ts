// The statistics the summary gives beside the counts: an interval for a share, a two-sided test for
// each comparison of the arms, and Holm's correction across the comparisons a design tests. Exact or
// closed-form methods only, so the same runs always give the same numbers.

/** The Wilson score interval of k successes in n tries, at 95 percent. */
export function wilson(k: number, n: number, z = 1.959964): readonly [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

const logFactorials: number[] = [0];

function logFactorial(n: number): number {
  for (let i = logFactorials.length; i <= n; i++) logFactorials.push((logFactorials[i - 1] ?? 0) + Math.log(i));
  return logFactorials[n] ?? NaN;
}

/**
 * The two-sided p of Fisher's exact test on a 2x2 table: k1 successes of n1 against k2 of n2. It
 * sums the probability of every table with the same margins that is no more likely than the one seen.
 */
export function fisher(k1: number, n1: number, k2: number, n2: number): number {
  const k = k1 + k2;
  const n = n1 + n2;
  const logP = (a: number): number => logFactorial(k) + logFactorial(n - k) + logFactorial(n1) + logFactorial(n2) - logFactorial(n) - logFactorial(a) - logFactorial(k - a) - logFactorial(n1 - a) - logFactorial(n2 - k + a);
  const seen = logP(k1);
  let p = 0;
  for (let a = Math.max(0, k - n2); a <= Math.min(k, n1); a++) {
    const l = logP(a);
    if (l <= seen + 1e-7) p += Math.exp(l);
  }
  return Math.min(1, p);
}

/** The standard normal distribution function, by the Abramowitz and Stegun 7.1.26 approximation of erf. */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/**
 * The Mann-Whitney U test of two samples: U of the first, and the two-sided p by the normal
 * approximation with the tie correction and a continuity correction. Fit for samples of about ten
 * or more each, which is what the comparisons that use it have.
 */
export function mannWhitney(x: readonly number[], y: readonly number[]): { u: number; p: number } {
  const n1 = x.length;
  const n2 = y.length;
  if (n1 === 0 || n2 === 0) return { u: NaN, p: NaN };
  const all = [...x.map((v) => ({ v, first: true })), ...y.map((v) => ({ v, first: false }))].sort((a, b) => a.v - b.v);
  let rankFirst = 0;
  let ties = 0;
  for (let i = 0; i < all.length; ) {
    let j = i;
    while (j + 1 < all.length && all[j + 1]?.v === all[i]?.v) j++;
    const rank = (i + j) / 2 + 1;
    const size = j - i + 1;
    ties += size ** 3 - size;
    for (let m = i; m <= j; m++) if (all[m]?.first) rankFirst += rank;
    i = j + 1;
  }
  const u = rankFirst - (n1 * (n1 + 1)) / 2;
  const n = n1 + n2;
  const variance = ((n1 * n2) / 12) * (n + 1 - ties / (n * (n - 1)));
  if (variance <= 0) return { u, p: 1 };
  const z = (Math.abs(u - (n1 * n2) / 2) - 0.5) / Math.sqrt(variance);
  return { u, p: Math.min(1, 2 * (1 - normalCdf(Math.max(0, z)))) };
}

/** Holm's step-down adjustment of p values, in the order given. */
export function holm(ps: readonly number[]): number[] {
  const order = ps.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const out = new Array<number>(ps.length).fill(NaN);
  let running = 0;
  order.forEach(({ p, i }, rank) => {
    running = Math.max(running, Math.min(1, (ps.length - rank) * p));
    out[i] = running;
  });
  return out;
}

export function median(xs: readonly number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? NaN) : ((s[mid - 1] ?? NaN) + (s[mid] ?? NaN)) / 2;
}

/** A p value as the summaries print it. */
export function formatP(p: number): string {
  if (Number.isNaN(p)) return 'n/a';
  if (p < 0.001) return '< 0.001';
  return p < 0.01 ? p.toFixed(3) : p.toFixed(2);
}
