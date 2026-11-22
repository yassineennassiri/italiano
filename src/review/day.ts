/**
 * Review days (SPEC §10.5): a card due "tomorrow" is due from midnight, so a
 * mistake made in the evening is back the next morning. Days are counted in
 * Genoa's time zone, where the learner is; the server may run in UTC.
 */
export const REVIEW_TIME_ZONE = "Europe/Rome";

/** The zone's offset from UTC at `at`, in milliseconds (+1 h in winter in Genoa). */
function offsetAt(at: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(at)
      .map((part) => [part.type, Number(part.value)]),
  );
  const local = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return local - Math.floor(at.getTime() / 1000) * 1000;
}

/** Midnight in the zone, `days` days after the day that `now` falls on there. */
export function dueAt(now: Date, days: number, timeZone = REVIEW_TIME_ZONE): Date {
  const local = new Date(now.getTime() + offsetAt(now, timeZone));
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days);
  // The offset at midnight itself, which differs from now's across a clock change.
  const guess = midnight - offsetAt(new Date(midnight), timeZone);
  return new Date(midnight - offsetAt(new Date(guess), timeZone));
}
