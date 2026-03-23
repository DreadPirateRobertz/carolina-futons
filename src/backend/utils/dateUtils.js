/**
 * DST-safe ET date helpers.
 * Uses Intl.DateTimeFormat (IANA tz) for UTC→ET conversion.
 * Calendar-day arithmetic avoids fixed-millisecond DST errors.
 * CF-phase2-streak
 */

/**
 * Returns today's date as "YYYY-MM-DD" in Eastern Time (America/New_York).
 * Correctly handles both EST (UTC-5) and EDT (UTC-4) offsets.
 * @returns {string}
 */
export function getTodayET() {
  // sv-SE locale natively returns "YYYY-MM-DD" — no string parsing required.
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/New_York',
  }).format(new Date());
}

/**
 * Returns yesterday's date as "YYYY-MM-DD" in Eastern Time.
 * Uses calendar-day subtraction via Date.UTC to avoid DST off-by-one errors.
 * DO NOT use Date.now() - 86400000 — spring-forward day is 23h, fall-back is 25h.
 * @returns {string}
 */
export function getYesterdayET() {
  const today = getTodayET(); // e.g. "2026-03-22"
  const [y, m, d] = today.split('-').map(Number);
  // Date.UTC with d-1=0 correctly resolves to last day of previous month.
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
  return [
    yesterday.getUTCFullYear(),
    String(yesterday.getUTCMonth() + 1).padStart(2, '0'),
    String(yesterday.getUTCDate()).padStart(2, '0'),
  ].join('-');
}
