// Calendar-date helpers for timetable validity.

/** Today's date in France, as YYYY-MM-DD: timetables are French local dates. */
export function todayInFrance(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);
}

/**
 * Whole calendar days from today (in France) to `validTo`: 0 on the last
 * valid day, negative once it has passed. Comparing dates rather than
 * instants keeps a feed valid until the end of its last day; measuring from
 * midnight UTC called it expired from the morning of that day.
 */
export function daysUntil(validTo: string, now: Date = new Date()): number {
  const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Math.round((day(validTo) - day(todayInFrance(now))) / 86_400_000);
}
