/**
 * Local-time date helpers. The study week starts on Monday.
 *
 * "Local" here means APP_TIMEZONE, not the host's ambient timezone. The server
 * process is pinned to it at startup (see `src/instrumentation.ts`) — without
 * that pin, a host running in UTC (Vercel does) buckets an evening session into
 * the *next* calendar day, shifting the agenda, heatmap and streak.
 *
 * This is the single timezone seam, mirroring `getCurrentUserId()`: when real
 * multi-tenancy lands it becomes a `users.timezone` column and only these
 * helpers change.
 */
export const APP_TIMEZONE = "America/Sao_Paulo";

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

// en-CA renders as "YYYY-MM-DD", which is exactly the key format we want.
const DATE_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * "YYYY-MM-DD" key for the calendar day `date` falls on in APP_TIMEZONE.
 *
 * Anchored to the zone rather than the ambient one so the key is identical on
 * the server and in the browser — the same session can't land on two different
 * days. Never use `toISOString().slice(0, 10)` for this: it is always UTC, so
 * anything after 21:00 in São Paulo would be filed under the next day.
 */
export function toDateKey(date: Date): string {
  return DATE_KEY_FORMAT.format(date);
}

const TIME_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

/** "21:00" — the wall-clock time in APP_TIMEZONE, not the viewer's. */
export function formatTime(date: Date): string {
  return TIME_FORMAT.format(date);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
