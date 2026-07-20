/** Local-time date helpers. The study week starts on Monday. */

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfWeek(): Date {
  const d = startOfToday();
  const dow = d.getDay(); // 0 = Sunday
  const diff = dow === 0 ? 6 : dow - 1; // days since Monday
  d.setDate(d.getDate() - diff);
  return d;
}

const MONTHS_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** "dez 2026" */
export function formatMonthYear(date: Date): string {
  return `${MONTHS_PT[date.getMonth()]} ${date.getFullYear()}`;
}

/** Whole days from today until `date` (negative = past). */
export function daysUntil(date: Date): number {
  const ms = startOfDay(date).getTime() - startOfToday().getTime();
  return Math.round(ms / 86_400_000);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Local-time "YYYY-MM-DD" key (not UTC) — stable bucket for a calendar day. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
