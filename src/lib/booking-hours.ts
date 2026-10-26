// How a week of working hours reads in a list: days that share the same hours are grouped, so Monday to Friday 9 to 5
// is one short phrase instead of five repeats.

type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type Windows = Array<{ start: string; end: string }>;
const DAYS: Array<[Weekday, string]> = [["mon", "Mon"], ["tue", "Tue"], ["wed", "Wed"], ["thu", "Thu"], ["fri", "Fri"], ["sat", "Sat"], ["sun", "Sun"]];

const hours = (w: Windows) => w.map((x) => `${x.start}–${x.end}`).join(", ");

/** "Mon–Fri 09:00–12:30, 13:30–17:00 · Sat 10:00–12:00"; "No days set" for an empty week. */
export function summarizeWeek(weekly: Partial<Record<Weekday, Windows>>): string {
  const groups: Array<{ first: string; last: string; lastIndex: number; count: number; text: string }> = [];
  DAYS.forEach(([id, label], i) => {
    const w = weekly[id];
    if (!w?.length) return;
    const text = hours(w);
    const prev = groups[groups.length - 1];
    // Only the day directly after the previous one, with identical hours, joins its group.
    if (prev && prev.lastIndex === i - 1 && prev.text === text) {
      prev.last = label;
      prev.lastIndex = i;
      prev.count++;
    } else groups.push({ first: label, last: label, lastIndex: i, count: 1, text });
  });
  if (groups.length === 0) return "No days set";
  return groups.map((g) => `${g.count === 1 ? g.first : g.count === 2 ? `${g.first} and ${g.last}` : `${g.first}–${g.last}`} ${g.text}`).join(" · ");
}
