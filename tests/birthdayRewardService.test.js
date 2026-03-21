/**
 * Tests for birthdayRewardService.web.js — CF-28jp.
 * Birthday + anniversary milestone reward triggers.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock wix-data ─────────────────────────────────────────────────

vi.mock('wix-data', () => {
  const store = { BirthdayRewards: [], 'Members/PrivateMembersData': [] };
  const queryErrors = {};

  function makeQuery(collection) {
    let items = [...(store[collection] || [])];
    const q = {
      eq(field, val) { items = items.filter(i => i[field] === val); return q; },
      find: vi.fn(async () => {
        if (queryErrors[collection]) throw queryErrors[collection];
        return { items, totalCount: items.length };
      }),
    };
    return q;
  }

  return {
    default: {
      query: vi.fn((col) => makeQuery(col)),
      insert: vi.fn(async (col, item) => {
        store[col] = store[col] || [];
        store[col].push({ _id: `generated-${Math.random()}`, ...item });
        return item;
      }),
    },
    __store: store,
    __queryErrors: queryErrors,
    __reset() {
      store.BirthdayRewards = [];
      store['Members/PrivateMembersData'] = [];
      for (const k of Object.keys(queryErrors)) delete queryErrors[k];
    },
  };
});

const wixDataMock = await import('wix-data');
const { __store, __queryErrors, __reset } = wixDataMock;

import {
  getTodayParts,
  isAnniversaryToday,
  yearsElapsed,
  checkAndSendBirthdayRewards,
  checkAndSendAnniversaryRewards,
} from '../src/backend/birthdayRewardService.web.js';

// ── helpers ───────────────────────────────────────────────────────

function makeMember(overrides = {}) {
  return {
    _id: 'member-1',
    loginEmail: 'user@example.com',
    firstName: 'Jane',
    birthday_month: 3,
    birthday_day: 21,
    join_month: 3,
    join_day: 21,
    _createdDate: new Date('2025-03-21').toISOString(),
    ...overrides,
  };
}

const TODAY = new Date('2026-03-21T12:00:00Z');
const mockCoupon = vi.fn().mockResolvedValue({ success: true, code: 'BDAY15' });
const mockEmail = vi.fn().mockResolvedValue(undefined);

// ── getTodayParts ────────────────────────────────────────────────

describe('getTodayParts', () => {
  it('returns correct month, day, year', () => {
    const parts = getTodayParts(new Date('2026-03-21'));
    expect(parts.month).toBe(3);
    expect(parts.day).toBe(21);
    expect(parts.year).toBe(2026);
  });

  it('handles January correctly (1-based month)', () => {
    const parts = getTodayParts(new Date('2026-01-01'));
    expect(parts.month).toBe(1);
    expect(parts.day).toBe(1);
  });

  it('handles December correctly', () => {
    const parts = getTodayParts(new Date('2026-12-31'));
    expect(parts.month).toBe(12);
    expect(parts.day).toBe(31);
  });
});

// ── isAnniversaryToday ───────────────────────────────────────────

describe('isAnniversaryToday', () => {
  it('returns true when date month+day matches', () => {
    expect(isAnniversaryToday('1990-03-21', 3, 21)).toBe(true);
  });

  it('returns false when month differs', () => {
    expect(isAnniversaryToday('1990-04-21', 3, 21)).toBe(false);
  });

  it('returns false when day differs', () => {
    expect(isAnniversaryToday('1990-03-20', 3, 21)).toBe(false);
  });

  it('returns false for null/undefined date', () => {
    expect(isAnniversaryToday(null, 3, 21)).toBe(false);
    expect(isAnniversaryToday(undefined, 3, 21)).toBe(false);
  });

  it('returns false for invalid date string', () => {
    expect(isAnniversaryToday('not-a-date', 3, 21)).toBe(false);
  });
});

// ── yearsElapsed ─────────────────────────────────────────────────

describe('yearsElapsed', () => {
  it('returns 1 on exact 1-year anniversary', () => {
    expect(yearsElapsed('2025-03-21', new Date('2026-03-21'))).toBe(1);
  });

  it('returns 3 on 3-year anniversary', () => {
    expect(yearsElapsed('2023-03-21', new Date('2026-03-21'))).toBe(3);
  });

  it('returns 5 on 5-year anniversary', () => {
    expect(yearsElapsed('2021-03-21', new Date('2026-03-21'))).toBe(5);
  });

  it('returns 0 before first year anniversary', () => {
    expect(yearsElapsed('2026-01-01', new Date('2026-03-21'))).toBe(0);
  });

  it('returns 0 for null/undefined joinDate', () => {
    expect(yearsElapsed(null)).toBe(0);
    expect(yearsElapsed(undefined)).toBe(0);
  });

  it('returns 0 for invalid date', () => {
    expect(yearsElapsed('not-a-date')).toBe(0);
  });

  it('does not count anniversary if today is one day before', () => {
    // Join date Mar 22, checking Mar 21 — not yet an anniversary
    expect(yearsElapsed('2025-03-22', new Date('2026-03-21'))).toBe(0);
  });
});

// ── checkAndSendBirthdayRewards ───────────────────────────────────

describe('checkAndSendBirthdayRewards', () => {
  beforeEach(() => {
    __reset();
    vi.clearAllMocks();
    mockCoupon.mockResolvedValue({ success: true, code: 'BDAY15' });
    mockEmail.mockResolvedValue(undefined);
  });

  it('sends birthday reward to matching member', async () => {
    __store['Members/PrivateMembersData'].push(makeMember());

    const result = await checkAndSendBirthdayRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(1);
    expect(result.errors).toBe(0);
    expect(mockCoupon).toHaveBeenCalledWith('user@example.com', 'Jane');
    expect(mockEmail).toHaveBeenCalledWith('user@example.com', 'Jane', 'BDAY15');
  });

  it('skips member when no birthday match (different month)', async () => {
    __store['Members/PrivateMembersData'].push(makeMember({ birthday_month: 4 }));

    const result = await checkAndSendBirthdayRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(0);
  });

  it('prevents duplicate reward in same year (idempotency)', async () => {
    __store['Members/PrivateMembersData'].push(makeMember());
    __store['BirthdayRewards'].push({
      memberId: 'member-1', type: 'birthday', rewardYear: 2026,
    });

    const result = await checkAndSendBirthdayRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockCoupon).not.toHaveBeenCalled();
  });

  it('allows reward again in a different year', async () => {
    __store['Members/PrivateMembersData'].push(makeMember());
    // Rewarded in 2025, not 2026
    __store['BirthdayRewards'].push({
      memberId: 'member-1', type: 'birthday', rewardYear: 2025,
    });

    const result = await checkAndSendBirthdayRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(1);
  });

  it('records reward in BirthdayRewards collection after sending', async () => {
    __store['Members/PrivateMembersData'].push(makeMember());

    await checkAndSendBirthdayRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    const rewards = __store['BirthdayRewards'];
    expect(rewards).toHaveLength(1);
    expect(rewards[0].type).toBe('birthday');
    expect(rewards[0].couponCode).toBe('BDAY15');
    expect(rewards[0].rewardYear).toBe(2026);
  });

  it('skips member with missing email', async () => {
    __store['Members/PrivateMembersData'].push(makeMember({ loginEmail: '' }));

    const result = await checkAndSendBirthdayRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('counts error and continues when coupon creation fails', async () => {
    __store['Members/PrivateMembersData'].push(makeMember());
    mockCoupon.mockResolvedValue({ success: false, message: 'Coupon service down' });

    const result = await checkAndSendBirthdayRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.errors).toBe(1);
    expect(result.sent).toBe(0);
    expect(mockEmail).not.toHaveBeenCalled();
  });

  it('handles multiple members — sends to all eligible', async () => {
    __store['Members/PrivateMembersData'].push(
      makeMember({ _id: 'm1', loginEmail: 'a@test.com' }),
      makeMember({ _id: 'm2', loginEmail: 'b@test.com' }),
    );

    const result = await checkAndSendBirthdayRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(2);
    expect(mockCoupon).toHaveBeenCalledTimes(2);
  });

  it('counts error and continues when one member throws', async () => {
    __store['Members/PrivateMembersData'].push(
      makeMember({ _id: 'm1', loginEmail: 'a@test.com' }),
      makeMember({ _id: 'm2', loginEmail: 'b@test.com' }),
    );
    let callCount = 0;
    mockCoupon.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error('Network timeout');
      return { success: true, code: 'BDAY15' };
    });

    const result = await checkAndSendBirthdayRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(1);
    expect(result.errors).toBe(1);
  });

  it('returns error count when query throws', async () => {
    __queryErrors['Members/PrivateMembersData'] = new Error('DB unavailable');

    const result = await checkAndSendBirthdayRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.errors).toBeGreaterThan(0);
    expect(result.sent).toBe(0);
  });

  it('counts error when sendEmail throws — no reward recorded', async () => {
    __store['Members/PrivateMembersData'].push(makeMember());
    mockEmail.mockRejectedValueOnce(new Error('SMTP failure'));

    const result = await checkAndSendBirthdayRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(0);
    expect(result.errors).toBe(1);
    // No dedup record written since email failed before recordReward
    expect(__store['BirthdayRewards']).toHaveLength(0);
  });

  it('counts error when recordReward (wixData.insert) throws', async () => {
    __store['Members/PrivateMembersData'].push(makeMember());
    wixDataMock.default.insert.mockRejectedValueOnce(new Error('Insert timeout'));

    const result = await checkAndSendBirthdayRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(0);
    expect(result.errors).toBe(1);
  });

  it('counts error when dedup query (BirthdayRewards) throws', async () => {
    __store['Members/PrivateMembersData'].push(makeMember());
    __queryErrors['BirthdayRewards'] = new Error('Dedup query failed');

    const result = await checkAndSendBirthdayRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(0);
    expect(result.errors).toBe(1);
    expect(mockCoupon).not.toHaveBeenCalled();
  });
});

// ── checkAndSendAnniversaryRewards ────────────────────────────────

describe('checkAndSendAnniversaryRewards', () => {
  beforeEach(() => {
    __reset();
    vi.clearAllMocks();
    mockCoupon.mockResolvedValue({ success: true, code: 'ANNIV10' });
    mockEmail.mockResolvedValue(undefined);
  });

  it('sends 1-year anniversary reward on exact 1-year mark', async () => {
    __store['Members/PrivateMembersData'].push(
      makeMember({ _createdDate: new Date('2025-03-21').toISOString() })
    );

    const result = await checkAndSendAnniversaryRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(1);
    expect(mockCoupon).toHaveBeenCalledWith('user@example.com', 'Jane', 10);
    expect(mockEmail).toHaveBeenCalledWith('user@example.com', 'Jane', 'ANNIV10', 1, null);
  });

  it('sends 3-year anniversary reward on exact 3-year mark', async () => {
    __store['Members/PrivateMembersData'].push(
      makeMember({ _createdDate: new Date('2023-03-21').toISOString() })
    );

    const result = await checkAndSendAnniversaryRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(1);
    expect(mockCoupon).toHaveBeenCalledWith('user@example.com', 'Jane', 15);
    expect(mockEmail).toHaveBeenCalledWith('user@example.com', 'Jane', 'ANNIV10', 3, null);
  });

  it('sends 5-year anniversary reward with vip_for_a_day badge', async () => {
    __store['Members/PrivateMembersData'].push(
      makeMember({ _createdDate: new Date('2021-03-21').toISOString() })
    );

    const result = await checkAndSendAnniversaryRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(1);
    expect(mockCoupon).toHaveBeenCalledWith('user@example.com', 'Jane', 20);
    expect(mockEmail).toHaveBeenCalledWith('user@example.com', 'Jane', 'ANNIV10', 5, 'vip_for_a_day');
  });

  it('skips non-milestone years (e.g. 2 years)', async () => {
    __store['Members/PrivateMembersData'].push(
      makeMember({ _createdDate: new Date('2024-03-21').toISOString() })
    );

    const result = await checkAndSendAnniversaryRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockCoupon).not.toHaveBeenCalled();
  });

  it('skips non-milestone years (e.g. 4 years)', async () => {
    __store['Members/PrivateMembersData'].push(
      makeMember({ _createdDate: new Date('2022-03-21').toISOString() })
    );

    const result = await checkAndSendAnniversaryRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.skipped).toBe(1);
  });

  it('prevents duplicate anniversary reward in same year (idempotency)', async () => {
    __store['Members/PrivateMembersData'].push(
      makeMember({ _createdDate: new Date('2025-03-21').toISOString() })
    );
    __store['BirthdayRewards'].push({
      memberId: 'member-1', type: 'anniversary', rewardYear: 2026,
    });

    const result = await checkAndSendAnniversaryRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('records reward in BirthdayRewards collection with milestone', async () => {
    __store['Members/PrivateMembersData'].push(
      makeMember({ _createdDate: new Date('2025-03-21').toISOString() })
    );

    await checkAndSendAnniversaryRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    const rewards = __store['BirthdayRewards'];
    expect(rewards).toHaveLength(1);
    expect(rewards[0].type).toBe('anniversary');
    expect(rewards[0].milestone).toBe(1);
    expect(rewards[0].rewardYear).toBe(2026);
  });

  it('skips member with missing joinDate', async () => {
    __store['Members/PrivateMembersData'].push(
      makeMember({ _createdDate: null })
    );

    const result = await checkAndSendAnniversaryRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.skipped).toBe(1);
  });

  it('handles query error gracefully', async () => {
    __queryErrors['Members/PrivateMembersData'] = new Error('DB timeout');

    const result = await checkAndSendAnniversaryRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.errors).toBeGreaterThan(0);
  });

  it('birthday dedup does not block anniversary reward', async () => {
    // Member has birthday reward but not anniversary reward — should still send
    __store['Members/PrivateMembersData'].push(
      makeMember({ _createdDate: new Date('2025-03-21').toISOString() })
    );
    __store['BirthdayRewards'].push({
      memberId: 'member-1', type: 'birthday', rewardYear: 2026,
    });

    const result = await checkAndSendAnniversaryRewards({
      now: TODAY,
      createCoupon: mockCoupon,
      sendEmail: mockEmail,
    });

    expect(result.sent).toBe(1);
  });
});
