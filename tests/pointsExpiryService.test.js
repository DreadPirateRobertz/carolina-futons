/**
 * @file pointsExpiryService.test.js
 * @description Tests for pointsExpiryService — checkAndExpirePoints + getExpiryWarning.
 *
 * Covers:
 *  - checkAndExpirePoints returns null for missing member
 *  - checkAndExpirePoints returns {expired:false, warningDue:false} when no lastActivityDate
 *  - checkAndExpirePoints returns {expired:false, warningDue:false} for recent activity
 *  - checkAndExpirePoints returns {warningDue:true, expiryDate} in 30-day warning window
 *  - checkAndExpirePoints expiryDate is in the future during warning window
 *  - checkAndExpirePoints zeroes totalPoints after 18-month expiry
 *  - checkAndExpirePoints returns {expired:true} after 18-month expiry
 *  - checkAndExpirePoints inserts PointsExpiryEvents record with correct shape
 *  - checkAndExpirePoints no-ops update/insert when totalPoints already zero
 *  - checkAndExpirePoints no-ops when totalPoints is null (treated as zero)
 *  - checkAndExpirePoints returns null when query throws
 *  - checkAndExpirePoints returns null when update throws
 *  - checkAndExpirePoints is non-fatal when event insert throws
 *  - checkAndExpirePoints passes suppressAuth to find and update
 *  - getExpiryWarning returns null for missing member
 *  - getExpiryWarning returns null when no lastActivityDate
 *  - getExpiryWarning returns null before warning window
 *  - getExpiryWarning returns {daysUntilExpiry, totalPoints} in warning window
 *  - getExpiryWarning daysUntilExpiry is a positive integer
 *  - getExpiryWarning totalPoints defaults to 0 when field missing
 *  - getExpiryWarning returns null after expiry (window closed)
 *  - getExpiryWarning returns null when query throws
 *
 * CF-zjtn
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __getInserted,
  __getUpdated,
  __setQueryError,
  __setUpdateError,
  __setInsertError,
  __getLastFindOptions,
  __getLastUpdateOptions,
} from 'wix-data';
import {
  checkAndExpirePoints,
  getExpiryWarning,
} from '../src/backend/pointsExpiryService.web.js';

// ── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a Date exactly N months and extraDays before now.
 */
function monthsAgo(months, extraDays = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(d.getDate() - extraDays);
  return d;
}

// 19 mo ago → clearly past 18-mo expiry (expiryDate is ~1 month ago)
const EXPIRED_DATE = monthsAgo(19);
// 17 mo + 15 days ago → inside 30-day warning window
const WARNING_DATE = monthsAgo(17, 15);
// 6 mo ago → safe, no action needed
const RECENT_DATE  = monthsAgo(6);

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeRecord(overrides = {}) {
  return {
    _id:              'rec-1',
    memberId:         'mem-1',
    totalPoints:      500,
    lastActivityDate: RECENT_DATE,
    ...overrides,
  };
}

const MEMBER_ID = 'mem-1';

beforeEach(() => {
  __reset();
});

// ── checkAndExpirePoints ──────────────────────────────────────────────────────

describe('checkAndExpirePoints', () => {
  it('returns null when member not found', async () => {
    __seed('MemberPoints', []);
    const result = await checkAndExpirePoints(MEMBER_ID);
    expect(result).toBeNull();
  });

  it('returns {expired:false, warningDue:false} when no lastActivityDate', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: null })]);
    const result = await checkAndExpirePoints(MEMBER_ID);
    expect(result).toEqual({ expired: false, warningDue: false });
  });

  it('returns {expired:false, warningDue:false} for recent activity', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: RECENT_DATE })]);
    const result = await checkAndExpirePoints(MEMBER_ID);
    expect(result).toEqual({ expired: false, warningDue: false });
  });

  it('returns {warningDue:true, expiryDate} when in warning window', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: WARNING_DATE })]);
    const result = await checkAndExpirePoints(MEMBER_ID);
    expect(result.warningDue).toBe(true);
    expect(result.expiryDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('expiryDate is in the future when in warning window', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: WARNING_DATE })]);
    const result = await checkAndExpirePoints(MEMBER_ID);
    expect(new Date(result.expiryDate) > new Date()).toBe(true);
  });

  it('returns {expired:true} after 18-month expiry', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: EXPIRED_DATE })]);
    const result = await checkAndExpirePoints(MEMBER_ID);
    expect(result).toEqual({ expired: true });
  });

  it('zeroes totalPoints when member is expired', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: EXPIRED_DATE, totalPoints: 200 })]);
    await checkAndExpirePoints(MEMBER_ID);
    const [updated] = __getUpdated('MemberPoints');
    expect(updated.totalPoints).toBe(0);
  });

  it('inserts a PointsExpiryEvents record with correct shape', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: EXPIRED_DATE, totalPoints: 300 })]);
    await checkAndExpirePoints(MEMBER_ID);
    const events = __getInserted('PointsExpiryEvents');
    expect(events).toHaveLength(1);
    expect(events[0].memberId).toBe(MEMBER_ID);
    expect(events[0].pointsLost).toBe(300);
    expect(events[0].expiredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('does not update or insert event when totalPoints is already zero', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: EXPIRED_DATE, totalPoints: 0 })]);
    await checkAndExpirePoints(MEMBER_ID);
    expect(__getUpdated('MemberPoints')).toHaveLength(0);
    expect(__getInserted('PointsExpiryEvents')).toHaveLength(0);
  });

  it('does not update or insert event when totalPoints is null', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: EXPIRED_DATE, totalPoints: null })]);
    await checkAndExpirePoints(MEMBER_ID);
    expect(__getUpdated('MemberPoints')).toHaveLength(0);
    expect(__getInserted('PointsExpiryEvents')).toHaveLength(0);
  });

  it('returns {expired:true} even when totalPoints is zero', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: EXPIRED_DATE, totalPoints: 0 })]);
    const result = await checkAndExpirePoints(MEMBER_ID);
    expect(result).toEqual({ expired: true });
  });

  it('returns null when query throws', async () => {
    __setQueryError('MemberPoints', new Error('DB error'));
    const result = await checkAndExpirePoints(MEMBER_ID);
    expect(result).toBeNull();
  });

  it('returns null when update throws', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: EXPIRED_DATE, totalPoints: 100 })]);
    __setUpdateError('MemberPoints', new Error('Update failed'));
    const result = await checkAndExpirePoints(MEMBER_ID);
    expect(result).toBeNull();
  });

  it('still returns {expired:true} when event insert throws (non-fatal)', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: EXPIRED_DATE, totalPoints: 100 })]);
    __setInsertError('PointsExpiryEvents', new Error('Insert failed'));
    const result = await checkAndExpirePoints(MEMBER_ID);
    expect(result).toEqual({ expired: true });
  });

  it('passes suppressAuth to find', async () => {
    __seed('MemberPoints', [makeRecord()]);
    await checkAndExpirePoints(MEMBER_ID);
    expect(__getLastFindOptions('MemberPoints')).toMatchObject({ suppressAuth: true });
  });

  it('passes suppressAuth to update', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: EXPIRED_DATE, totalPoints: 100 })]);
    await checkAndExpirePoints(MEMBER_ID);
    expect(__getLastUpdateOptions('MemberPoints')).toMatchObject({ suppressAuth: true });
  });
});

// ── getExpiryWarning ──────────────────────────────────────────────────────────

describe('getExpiryWarning', () => {
  it('returns null when member not found', async () => {
    __seed('MemberPoints', []);
    const result = await getExpiryWarning(MEMBER_ID);
    expect(result).toBeNull();
  });

  it('returns null when no lastActivityDate', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: null })]);
    const result = await getExpiryWarning(MEMBER_ID);
    expect(result).toBeNull();
  });

  it('returns null for recent activity (before warning window)', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: RECENT_DATE })]);
    const result = await getExpiryWarning(MEMBER_ID);
    expect(result).toBeNull();
  });

  it('returns {daysUntilExpiry, totalPoints} when in warning window', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: WARNING_DATE, totalPoints: 750 })]);
    const result = await getExpiryWarning(MEMBER_ID);
    expect(result).not.toBeNull();
    expect(result.totalPoints).toBe(750);
    expect(result.daysUntilExpiry).toBeGreaterThan(0);
    expect(result.daysUntilExpiry).toBeLessThanOrEqual(31);
  });

  it('daysUntilExpiry is a positive integer', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: WARNING_DATE })]);
    const result = await getExpiryWarning(MEMBER_ID);
    expect(Number.isInteger(result.daysUntilExpiry)).toBe(true);
    expect(result.daysUntilExpiry).toBeGreaterThan(0);
  });

  it('totalPoints defaults to 0 when field is absent', async () => {
    __seed('MemberPoints', [{ _id: 'rec-warn', memberId: MEMBER_ID, lastActivityDate: WARNING_DATE }]);
    const result = await getExpiryWarning(MEMBER_ID);
    expect(result.totalPoints).toBe(0);
  });

  it('returns null when already expired (window closed)', async () => {
    __seed('MemberPoints', [makeRecord({ lastActivityDate: EXPIRED_DATE })]);
    const result = await getExpiryWarning(MEMBER_ID);
    expect(result).toBeNull();
  });

  it('returns null when query throws', async () => {
    __setQueryError('MemberPoints', new Error('DB down'));
    const result = await getExpiryWarning(MEMBER_ID);
    expect(result).toBeNull();
  });
});
