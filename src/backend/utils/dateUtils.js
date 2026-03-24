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
 * Returns the date one calendar day before the given ET date string.
 * Uses Date.UTC arithmetic to avoid DST off-by-one errors.
 * DO NOT use ms subtraction — spring-forward day is 23h, fall-back is 25h.
 * @param {string} etDate - "YYYY-MM-DD"
 * @returns {string}
 */
export function getYesterdayOf(etDate) {
  const [y, m, d] = etDate.split('-').map(Number);
  // Date.UTC with d-1=0 correctly resolves to last day of previous month.
  const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
  return [
    yesterday.getUTCFullYear(),
    String(yesterday.getUTCMonth() + 1).padStart(2, '0'),
    String(yesterday.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Returns yesterday's date as "YYYY-MM-DD" in Eastern Time.
 * @returns {string}
 */
export function getYesterdayET() {
  return getYesterdayOf(getTodayET());
}

/**
 * Converts a Unix timestamp in seconds to "YYYY-MM-DD" in Eastern Time.
 * Use this instead of getTodayET() when you have an event origin timestamp
 * (e.g. webhook payload.ts) to avoid streak breaks from delivery lag.
 * @param {number} tsSeconds - Unix timestamp in seconds
 * @returns {string}
 */
export function tsToETDate(tsSeconds) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/New_York',
  }).format(new Date(tsSeconds * 1000));
}

/**
 * Returns the UTC timestamp (ms) of the next ET calendar-day midnight.
 * DST-safe: uses Intl.DateTimeFormat to find the current ET date, then
 * calculates the UTC equivalent of the next ET midnight.
 *
 * Approach: construct "tomorrow noon UTC" as a reference point, then ask Intl
 * what ET hour that corresponds to. The difference (12 - etHour) gives the
 * ET→UTC offset for that day (DST-aware). Subtract the ET offset from noon
 * to get the UTC timestamp of tomorrow's ET midnight.
 *
 * @returns {number} UTC timestamp in milliseconds
 */
export function getNextETMidnightUTC() {
  const todayET = getTodayET(); // "YYYY-MM-DD"
  const [y, m, d] = todayET.split('-').map(Number);

  // UTC timestamp of "tomorrow at 12:00:00 UTC" — a stable reference point
  const tomorrowNoonUTC = Date.UTC(y, m - 1, d + 1, 12, 0, 0);

  // Ask Intl what ET hour "tomorrow noon UTC" corresponds to (DST-aware)
  const etHourAtNoon = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      hour12: false,
    }).format(new Date(tomorrowNoonUTC))
  );

  // ET offset at tomorrow = (12 - etHourAtNoon) hours
  // e.g. EDT (UTC-4): etHour = 8 → offset = 4h
  // e.g. EST (UTC-5): etHour = 7 → offset = 5h
  const etOffsetMs = (12 - etHourAtNoon) * 3600 * 1000;
  // Tomorrow midnight ET = tomorrow noon UTC - 12h + ET offset
  return tomorrowNoonUTC - 12 * 3600 * 1000 + etOffsetMs;
}

/**
 * Returns true when the member has not been active today AND fewer than
 * 4 hours remain until the next ET calendar-day boundary.
 *
 * @param {string|null|undefined} lastActivityDate - "YYYY-MM-DD" in ET, or falsy for new members
 * @param {string} todayET - "YYYY-MM-DD" representing current ET calendar day
 * @returns {boolean}
 */
export function computeStreakDanger(lastActivityDate, todayET) {
  if (!lastActivityDate) return false;
  if (lastActivityDate === todayET) return false;

  const msUntilMidnight = getNextETMidnightUTC() - Date.now();
  const fourHoursMs = 4 * 3600 * 1000;
  return msUntilMidnight < fourHoursMs;
}
