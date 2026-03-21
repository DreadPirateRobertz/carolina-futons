/**
 * birthdayRewardService.test.js — CF-28jp: Birthday + anniversary milestone rewards
 * Tests for src/backend/birthdayRewardService.web.js
 * TDD: written before implementation.
 *
 * CMS collections used:
 *   MemberProfiles — member birthday/joinDate/contactId data
 *   BirthdayRewards — dedup ledger (memberId + rewardType + year)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __getInserted, __setQueryError } from 'wix-data';
import { __reset as __resetCrm, __getEmailLog, __failNextEmail } from 'wix-crm-backend';

// ── Mock couponsService.web (already-built helpers) ───────────────────

const couponMocks = vi.hoisted(() => ({
  createBirthdayCoupon: vi.fn(),
  createTierUpgradeCoupon: vi.fn(),
}));

vi.mock('backend/couponsService.web', () => ({
  createBirthdayCoupon: couponMocks.createBirthdayCoupon,
  createTierUpgradeCoupon: couponMocks.createTierUpgradeCoupon,
}));

import {
  checkAndSendBirthdayRewards,
  checkAndSendAnniversaryRewards,
} from '../src/backend/birthdayRewardService.web.js';

// ── Date helpers ──────────────────────────────────────────────────────

const TODAY = new Date();
const TODAY_MONTH = TODAY.getMonth() + 1; // 1-based
const TODAY_DAY   = TODAY.getDate();

function yearsAgo(n) {
  const d = new Date(TODAY);
  d.setFullYear(d.getFullYear() - n);
  return d;
}

function makeProfile(overrides = {}) {
  return {
    _id:           overrides._id          || 'profile-1',
    memberId:      overrides.memberId     || 'mem-1',
    email:         overrides.email        || 'jane@example.com',
    memberName:    overrides.memberName   || 'Jane Doe',
    contactId:     overrides.contactId   || 'contact-1',
    birthdayMonth: overrides.birthdayMonth ?? TODAY_MONTH,
    birthdayDay:   overrides.birthdayDay  ?? TODAY_DAY,
    joinDate:      overrides.joinDate     || yearsAgo(2),
    ...overrides,
  };
}

// ── Setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  __reset();
  __resetCrm();
  vi.clearAllMocks();
  couponMocks.createBirthdayCoupon.mockResolvedValue({ success: true, code: 'BDAY15', discount: 15 });
  couponMocks.createTierUpgradeCoupon.mockResolvedValue({ success: true, code: 'ANNIV10', discount: 10 });
});

// ── checkAndSendBirthdayRewards ───────────────────────────────────────

describe('checkAndSendBirthdayRewards — matching', () => {
  it('sends birthday reward to member whose birthday is today', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    const result = await checkAndSendBirthdayRewards();
    expect(result.sent).toBe(1);
  });

  it('skips member whose birthday is a different day', async () => {
    __seed('MemberProfiles', [makeProfile({ birthdayDay: (TODAY_DAY % 28) + 1 === TODAY_DAY ? 1 : (TODAY_DAY % 28) + 1 })]);
    const result = await checkAndSendBirthdayRewards();
    expect(result.sent).toBe(0);
  });

  it('skips member whose birthday month does not match', async () => {
    __seed('MemberProfiles', [makeProfile({ birthdayMonth: (TODAY_MONTH % 12) + 1 })]);
    const result = await checkAndSendBirthdayRewards();
    expect(result.sent).toBe(0);
  });

  it('sends to multiple members with matching birthdays', async () => {
    __seed('MemberProfiles', [
      makeProfile({ _id: 'p1', memberId: 'mem-1', email: 'a@test.com' }),
      makeProfile({ _id: 'p2', memberId: 'mem-2', email: 'b@test.com' }),
    ]);
    const result = await checkAndSendBirthdayRewards();
    expect(result.sent).toBe(2);
  });

  it('returns 0 sent when no members have today as birthday', async () => {
    __seed('MemberProfiles', []);
    const result = await checkAndSendBirthdayRewards();
    expect(result.sent).toBe(0);
  });
});

describe('checkAndSendBirthdayRewards — coupon creation', () => {
  it('calls createBirthdayCoupon with email and memberName', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    await checkAndSendBirthdayRewards();
    expect(couponMocks.createBirthdayCoupon).toHaveBeenCalledWith('jane@example.com', 'Jane Doe');
  });

  it('sends triggered email to member contactId', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    await checkAndSendBirthdayRewards();
    const log = __getEmailLog();
    const email = log.find(e => e.templateId === 'birthday_reward');
    expect(email).toBeDefined();
    expect(email.contactId).toBe('contact-1');
  });

  it('email variables include coupon code', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    await checkAndSendBirthdayRewards();
    const log = __getEmailLog();
    const email = log.find(e => e.templateId === 'birthday_reward');
    expect(email.options.variables.couponCode).toBe('BDAY15');
  });
});

describe('checkAndSendBirthdayRewards — deduplication', () => {
  it('inserts a BirthdayRewards dedup record after sending', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    await checkAndSendBirthdayRewards();
    const records = __getInserted('BirthdayRewards');
    expect(records.length).toBe(1);
    expect(records[0].memberId).toBe('mem-1');
    expect(records[0].rewardType).toBe('birthday');
    expect(records[0].year).toBe(TODAY.getFullYear());
  });

  it('skips member who already received birthday reward this year', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    __seed('BirthdayRewards', [{
      _id: 'ded-1',
      memberId: 'mem-1',
      rewardType: 'birthday',
      year: TODAY.getFullYear(),
    }]);
    const result = await checkAndSendBirthdayRewards();
    expect(result.sent).toBe(0);
    expect(couponMocks.createBirthdayCoupon).not.toHaveBeenCalled();
  });

  it('allows birthday reward if previous record was from last year', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    __seed('BirthdayRewards', [{
      _id: 'ded-1',
      memberId: 'mem-1',
      rewardType: 'birthday',
      year: TODAY.getFullYear() - 1,
    }]);
    const result = await checkAndSendBirthdayRewards();
    expect(result.sent).toBe(1);
  });

  it('does not insert dedup record when coupon creation fails', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    couponMocks.createBirthdayCoupon.mockResolvedValueOnce({ success: false, message: 'Error' });
    await checkAndSendBirthdayRewards();
    expect(__getInserted('BirthdayRewards').length).toBe(0);
  });
});

describe('checkAndSendBirthdayRewards — resilience', () => {
  it('still processes other members when one fails', async () => {
    __seed('MemberProfiles', [
      makeProfile({ _id: 'p1', memberId: 'mem-1', email: 'a@test.com', contactId: 'c1' }),
      makeProfile({ _id: 'p2', memberId: 'mem-2', email: 'b@test.com', contactId: 'c2' }),
    ]);
    couponMocks.createBirthdayCoupon
      .mockResolvedValueOnce({ success: false, message: 'Coupon error' })
      .mockResolvedValueOnce({ success: true, code: 'BDAY15', discount: 15 });
    const result = await checkAndSendBirthdayRewards();
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
  });

  it('returns { sent, skipped, failed } summary', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    const result = await checkAndSendBirthdayRewards();
    expect(result).toHaveProperty('sent');
    expect(result).toHaveProperty('skipped');
    expect(result).toHaveProperty('failed');
  });

  it('does not insert dedup record when email fails', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    __failNextEmail();
    await checkAndSendBirthdayRewards();
    expect(__getInserted('BirthdayRewards').length).toBe(0);
  });

  it('increments failed (not sent) when email fails', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    __failNextEmail();
    const result = await checkAndSendBirthdayRewards();
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
  });

  it('returns zero counts and does not call coupon service when MemberProfiles query throws', async () => {
    __setQueryError('MemberProfiles', new Error('CMS unavailable'));
    const result = await checkAndSendBirthdayRewards();
    expect(result).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(couponMocks.createBirthdayCoupon).not.toHaveBeenCalled();
  });
});

// ── checkAndSendAnniversaryRewards ────────────────────────────────────

describe('checkAndSendAnniversaryRewards — milestone matching', () => {
  it('sends 1yr reward to member who joined exactly 1 year ago', async () => {
    __seed('MemberProfiles', [makeProfile({ joinDate: yearsAgo(1) })]);
    const result = await checkAndSendAnniversaryRewards();
    expect(result.sent).toBe(1);
  });

  it('sends 3yr reward to member who joined exactly 3 years ago', async () => {
    __seed('MemberProfiles', [makeProfile({ joinDate: yearsAgo(3) })]);
    const result = await checkAndSendAnniversaryRewards();
    expect(result.sent).toBe(1);
  });

  it('sends 5yr reward to member who joined exactly 5 years ago', async () => {
    __seed('MemberProfiles', [makeProfile({ joinDate: yearsAgo(5) })]);
    const result = await checkAndSendAnniversaryRewards();
    expect(result.sent).toBe(1);
  });

  it('skips member who joined 2 years ago (not a milestone)', async () => {
    __seed('MemberProfiles', [makeProfile({ joinDate: yearsAgo(2) })]);
    const result = await checkAndSendAnniversaryRewards();
    expect(result.sent).toBe(0);
  });

  it('skips member who joined today (0yr — not a milestone)', async () => {
    __seed('MemberProfiles', [makeProfile({ joinDate: new Date() })]);
    const result = await checkAndSendAnniversaryRewards();
    expect(result.sent).toBe(0);
  });
});

describe('checkAndSendAnniversaryRewards — discount tiers', () => {
  it('1yr anniversary uses 10% discount', async () => {
    __seed('MemberProfiles', [makeProfile({ joinDate: yearsAgo(1) })]);
    await checkAndSendAnniversaryRewards();
    const record = __getInserted('BirthdayRewards').find(r => r.rewardType === 'anniversary_1yr');
    expect(record.discountPercent).toBe(10);
  });

  it('3yr anniversary uses 15% discount', async () => {
    __seed('MemberProfiles', [makeProfile({ joinDate: yearsAgo(3) })]);
    await checkAndSendAnniversaryRewards();
    const record = __getInserted('BirthdayRewards').find(r => r.rewardType === 'anniversary_3yr');
    expect(record.discountPercent).toBe(15);
  });

  it('5yr anniversary uses 20% discount', async () => {
    __seed('MemberProfiles', [makeProfile({ joinDate: yearsAgo(5) })]);
    await checkAndSendAnniversaryRewards();
    const record = __getInserted('BirthdayRewards').find(r => r.rewardType === 'anniversary_5yr');
    expect(record.discountPercent).toBe(20);
  });

  it('5yr sends anniversary email with vip_badge flag', async () => {
    __seed('MemberProfiles', [makeProfile({ joinDate: yearsAgo(5) })]);
    await checkAndSendAnniversaryRewards();
    const log = __getEmailLog();
    const email = log.find(e => e.templateId === 'anniversary_5yr');
    expect(email.options.variables.vipBadge).toBe(true);
  });
});

describe('checkAndSendAnniversaryRewards — email templates', () => {
  it('1yr uses anniversary_1yr email template', async () => {
    __seed('MemberProfiles', [makeProfile({ joinDate: yearsAgo(1) })]);
    await checkAndSendAnniversaryRewards();
    const log = __getEmailLog();
    expect(log.find(e => e.templateId === 'anniversary_1yr')).toBeDefined();
  });

  it('3yr uses anniversary_3yr email template', async () => {
    __seed('MemberProfiles', [makeProfile({ joinDate: yearsAgo(3) })]);
    await checkAndSendAnniversaryRewards();
    const log = __getEmailLog();
    expect(log.find(e => e.templateId === 'anniversary_3yr')).toBeDefined();
  });

  it('5yr uses anniversary_5yr email template', async () => {
    __seed('MemberProfiles', [makeProfile({ joinDate: yearsAgo(5) })]);
    await checkAndSendAnniversaryRewards();
    const log = __getEmailLog();
    expect(log.find(e => e.templateId === 'anniversary_5yr')).toBeDefined();
  });
});

describe('checkAndSendAnniversaryRewards — resilience', () => {
  it('returns zero counts when MemberProfiles query throws', async () => {
    __setQueryError('MemberProfiles', new Error('CMS unavailable'));
    const result = await checkAndSendAnniversaryRewards();
    expect(result).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(couponMocks.createTierUpgradeCoupon).not.toHaveBeenCalled();
  });
});

describe('checkAndSendAnniversaryRewards — deduplication', () => {
  it('skips 1yr reward if already sent this year', async () => {
    __seed('MemberProfiles', [makeProfile({ joinDate: yearsAgo(1) })]);
    __seed('BirthdayRewards', [{
      _id: 'ded-1',
      memberId: 'mem-1',
      rewardType: 'anniversary_1yr',
      year: TODAY.getFullYear(),
    }]);
    const result = await checkAndSendAnniversaryRewards();
    expect(result.sent).toBe(0);
  });

  it('inserts BirthdayRewards dedup record with correct rewardType', async () => {
    __seed('MemberProfiles', [makeProfile({ joinDate: yearsAgo(3) })]);
    await checkAndSendAnniversaryRewards();
    const records = __getInserted('BirthdayRewards');
    expect(records[0].rewardType).toBe('anniversary_3yr');
    expect(records[0].year).toBe(TODAY.getFullYear());
  });
});
