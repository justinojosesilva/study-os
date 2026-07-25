import { APP_TIMEZONE } from "@/lib/date";

/**
 * Runs once, before the server accepts any request.
 *
 * Pins the process timezone so every ambient `Date` (getHours, getDate,
 * setHours) and every `Intl` default resolves in the study timezone instead of
 * the host's. Vercel runs in UTC, so without this an evening session — 21:00 in
 * São Paulo — is read as 00:00 the next day, shifting the agenda, the heatmap
 * and the streak by one day.
 *
 * Kept in code rather than a TZ env var on purpose: an env var only exists
 * where someone remembered to set it, and this bug is invisible in local
 * development (a machine in São Paulo is already correct).
 */
export function register() {
  process.env.TZ = APP_TIMEZONE;
}
