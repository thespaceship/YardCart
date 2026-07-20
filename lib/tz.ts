/**
 * Yard-local calendar math. Order dates are calendar dates stored as UTC-noon
 * timestamps; "which day is it at the yard" and cutoff hours use the yard's IANA
 * timezone so a UTC server doesn't shift availability windows.
 */

export type LocalNow = { dateKey: string; hour: number };

/** Current date key (YYYY-MM-DD) and hour-of-day in the given IANA timezone. */
export function localNow(timezone: string, at: Date = new Date()): LocalNow {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
    return {
      dateKey: `${parts.year}-${parts.month}-${parts.day}`,
      hour: Number(parts.hour) % 24,
    };
  } catch {
    // bad timezone string → fall back to UTC rather than crash order flow
    return { dateKey: at.toISOString().slice(0, 10), hour: at.getUTCHours() };
  }
}

/** Add n days to a YYYY-MM-DD key (pure calendar math, DST-proof via UTC noon). */
export function addDays(dateKey: string, n: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Day of week for a YYYY-MM-DD key: 0=Sun..6=Sat (UTC-noon, so it's DST-proof). */
export function dayOfWeek(dateKey: string): number {
  return new Date(`${dateKey}T12:00:00Z`).getUTCDay();
}

/** Calendar date key of a stored UTC-noon order date. */
export function storedDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse a YYYY-MM-DD key into the canonical stored timestamp (UTC noon). */
export function keyToStoredDate(dateKey: string): Date {
  return new Date(`${dateKey}T12:00:00Z`);
}
