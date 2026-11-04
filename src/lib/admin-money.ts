// Plan prices are whole cents everywhere in the staff area, so 12.99 is never a floating-point guess.

export const CURRENCY = "USD";

/** 1200 -> "$12", 1299 -> "$12.99". Whole-dollar prices drop the ".00" so cards stay calm. */
export function fmtMoney(cents: number, currency = CURRENCY): string {
  return new Intl.NumberFormat("en", { style: "currency", currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(cents / 100);
}

/** What someone typed in a price box -> cents, or null if it isn't a price. Accepts "12", "12.5", "$12.99". */
export function toCents(text: string): number | null {
  const t = text.trim().replace(/^\$/, "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Cents -> what goes in a price box: 1200 -> "12", 1250 -> "12.50". */
export const centsToInput = (cents: number) => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));

/** How much cheaper a year is than twelve months, as a whole percent. 0 when there is no saving. */
export function yearlySavings(monthlyCents: number, yearlyCents: number): number {
  if (monthlyCents <= 0 || yearlyCents <= 0) return 0;
  return Math.max(0, Math.round((1 - yearlyCents / (monthlyCents * 12)) * 100));
}
