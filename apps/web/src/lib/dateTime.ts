/**
 * A short date and time, e.g. "Nov 10, 3:42 PM" (in the reader's language and
 * time zone). The year is added when it isn't the current one.
 */
export function shortDateTime(
  timestamp: number,
  now = Date.now(),
  locale?: string,
  timeZone?: string,
): string {
  const yearOf = (t: number) =>
    new Intl.DateTimeFormat('en', { year: 'numeric', timeZone }).format(t);
  return new Intl.DateTimeFormat(locale, {
    year: yearOf(timestamp) === yearOf(now) ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(timestamp);
}
