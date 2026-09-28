/**
 * Date formatting for display.
 *
 * The source spreadsheet stored dates as bare numbers ("5.6" for 5 June) and in
 * at least one row as the text "5,6". Everything here takes a real Date derived
 * from a Firestore Timestamp, so the ambiguity that made sorting and filtering
 * unreliable in the sheet cannot recur.
 */

const LOCALE = 'he-IL';

/** e.g. "5 ביוני 2026" */
export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** e.g. "05/06/2026" — for dense list rows. */
export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

/** e.g. "יום שישי" */
export function formatWeekday(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, { weekday: 'long' }).format(date);
}

/** Midnight local time — tests are recorded by day, not by moment. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** End of today, the latest date a test may legitimately be logged for. */
export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
