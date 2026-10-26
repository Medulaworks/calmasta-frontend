// How prices are shown. The amounts themselves come from the server (billing config); this only does the arithmetic and
// the formatting, in one place, so the plan cards, the test checkout and the tests never disagree.

/** The per-month price when billed yearly with `discountPct` off, to the cent. */
export const annualPrice = (monthly: number, discountPct: number): number => Math.round(monthly * (1 - discountPct / 100) * 100) / 100;

/** "$12", "$9.60": whole amounts have no decimals. */
export const formatPrice = (currency: string, n: number): string => `${currency}${Number.isInteger(n) ? n : n.toFixed(2)}`;

/** What billing yearly costs in a year. */
export const yearlyTotal = (perMonth: number): number => Math.round(perMonth * 12 * 100) / 100;
