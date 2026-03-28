/**
<<<<<<< HEAD
 * birthdayRewardService.test.js — CF-28jp: Birthday + anniversary milestone rewards
 * Tests for src/backend/birthdayRewardService.web.js
 * TDD: written before implementation.
 *
 * CMS collections used:
 *   MemberProfiles — member birthday/joinDate/contactId data
 *   BirthdayRewards — dedup ledger (memberId + rewardType + year)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __getInserted, __setQueryError, __setInsertError } from 'wix-data';
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
  checkAndSendPurchaseAnniversaryRewards,
} from '../src/backend/birthdayRewardService.web.js';

// ── Date helpers ──────────────────────────────────────────────────────

const TODAY = new Date();
const TODAY_MONTH = TODAY.getMonth() + 1; // 1-based
const TODAY_DAY   = TODAY.getDate();

// Month and day that is always ≥ 4 days from today — 6 months away, midmonth.
// Used to seed a profile that is definitively outside the ±3-day birthday window.
const FAR_MONTH = ((TODAY_MONTH + 5) % 12) + 1;
const FAR_DAY   = 15;

// ET date string for today — derived from Intl to match getTodayET() in service.
const TODAY_ET = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric', month: '2-digit', day: '2-digit',
}).format(TODAY);
// Year as seen by ET-aware services (checkAndSendBirthdayRewards, checkAndSendPurchaseAnniversaryRewards).
const TODAY_ET_YEAR = Number(TODAY_ET.slice(0, 4));

// Compute a firstPurchaseDate that is exactly N years before today (ET), as YYYY-MM-DD.
function firstPurchaseNYearsAgo(n) {
  const [y, m, d] = TODAY_ET.split('-').map(Number);
  let ay = y - n, am = m, ad = d;
  // Clamp Feb 29 → Feb 28 in non-leap years (mirrors getAnniversaryYear logic)
  if (am === 2 && ad === 29 && !( (ay % 4 === 0 && ay % 100 !== 0) || ay % 400 === 0 )) ad = 28;
  return `${ay}-${String(am).padStart(2, '0')}-${String(ad).padStart(2, '0')}`;
}

function yearsAgo(n) {
  const d = new Date(TODAY);
  d.setFullYear(d.getFullYear() - n);
  return d;
}

function makeProfile(overrides = {}) {
  return {
    _id:               overrides._id              || 'profile-1',
    memberId:          overrides.memberId         || 'mem-1',
    email:             overrides.email            || 'jane@example.com',
    memberName:        overrides.memberName       || 'Jane Doe',
    contactId:         overrides.contactId        || 'contact-1',
    birthdayMonth:     overrides.birthdayMonth    ?? TODAY_MONTH,
    birthdayDay:       overrides.birthdayDay      ?? TODAY_DAY,
    joinDate:          overrides.joinDate         || yearsAgo(2),
    firstPurchaseDate: overrides.firstPurchaseDate ?? null,
=======
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
>>>>>>> origin/cf-28jp-birthday-anniversary-rewards
    ...overrides,
  };
}

<<<<<<< HEAD
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

  it('skips member whose birthday is more than 3 days away (outside 7-day window)', async () => {
    // FAR_MONTH/FAR_DAY is 6 months from today — guaranteed outside ±3-day window
    __seed('MemberProfiles', [makeProfile({ birthdayMonth: FAR_MONTH, birthdayDay: FAR_DAY })]);
    const result = await checkAndSendBirthdayRewards();
    expect(result.sent).toBe(0);
  });

  it('skips member with no birthdayMonth set', async () => {
    __seed('MemberProfiles', [makeProfile({ birthdayMonth: null, birthdayDay: null })]);
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
    expect(records[0].year).toBe(TODAY_ET_YEAR);
  });

  it('skips member who already received birthday reward this year', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    __seed('BirthdayRewards', [{
      _id: 'ded-1',
      memberId: 'mem-1',
      rewardType: 'birthday',
      year: TODAY_ET_YEAR,
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
      year: TODAY_ET_YEAR - 1,
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

  it('increments failed when isAlreadySent query throws', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    __setQueryError('BirthdayRewards', new Error('DB error'));
    const result = await checkAndSendBirthdayRewards();
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('increments failed when createBirthdayCoupon throws', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    couponMocks.createBirthdayCoupon.mockRejectedValueOnce(new Error('Network error'));
    const result = await checkAndSendBirthdayRewards();
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('still returns sent after dedup insert throws (email already sent)', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    __setInsertError('BirthdayRewards', new Error('DB write error'));
    const result = await checkAndSendBirthdayRewards();
    // Email was sent; dedup insert failure does not change 'sent' outcome
    expect(result.sent).toBe(1);
  });

  it('increments failed when coupon returns success:false without message', async () => {
    __seed('MemberProfiles', [makeProfile()]);
    couponMocks.createBirthdayCoupon.mockResolvedValueOnce({ success: false });
    const result = await checkAndSendBirthdayRewards();
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
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

  it('skips member whose join anniversary date does not match today', async () => {
    // FAR_MONTH is 6 months away — guaranteed different month from today
    const d = new Date(TODAY.getFullYear() - 1, FAR_MONTH - 1, FAR_DAY);
    __seed('MemberProfiles', [makeProfile({ joinDate: d })]);
    const result = await checkAndSendAnniversaryRewards();
    expect(result.sent).toBe(0);
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

// ── checkAndSendPurchaseAnniversaryRewards ────────────────────────────

describe('checkAndSendPurchaseAnniversaryRewards — matching', () => {
  it('sends 1yr purchase anniversary reward', async () => {
    __seed('MemberProfiles', [makeProfile({ firstPurchaseDate: firstPurchaseNYearsAgo(1) })]);
    const result = await checkAndSendPurchaseAnniversaryRewards();
    expect(result.sent).toBe(1);
  });

  it('sends 2yr purchase anniversary reward', async () => {
    __seed('MemberProfiles', [makeProfile({ firstPurchaseDate: firstPurchaseNYearsAgo(2) })]);
    const result = await checkAndSendPurchaseAnniversaryRewards();
    expect(result.sent).toBe(1);
  });

  it('skips member with no firstPurchaseDate', async () => {
    __seed('MemberProfiles', [makeProfile({ firstPurchaseDate: null })]);
    const result = await checkAndSendPurchaseAnniversaryRewards();
    expect(result.sent).toBe(0);
  });

  it('skips member at 3yr purchase anniversary (not a milestone)', async () => {
    __seed('MemberProfiles', [makeProfile({ firstPurchaseDate: firstPurchaseNYearsAgo(3) })]);
    const result = await checkAndSendPurchaseAnniversaryRewards();
    expect(result.sent).toBe(0);
  });

  it('returns 0 sent when MemberProfiles query throws', async () => {
    __setQueryError('MemberProfiles', new Error('CMS unavailable'));
    const result = await checkAndSendPurchaseAnniversaryRewards();
    expect(result).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(couponMocks.createTierUpgradeCoupon).not.toHaveBeenCalled();
  });
});

describe('checkAndSendPurchaseAnniversaryRewards — discount tiers', () => {
  it('1yr purchase anniversary uses 10% discount', async () => {
    __seed('MemberProfiles', [makeProfile({ firstPurchaseDate: firstPurchaseNYearsAgo(1) })]);
    await checkAndSendPurchaseAnniversaryRewards();
    const record = __getInserted('BirthdayRewards').find(r => r.rewardType === 'purchase_anniversary_1yr');
    expect(record.discountPercent).toBe(10);
  });

  it('2yr purchase anniversary uses 15% discount', async () => {
    __seed('MemberProfiles', [makeProfile({ firstPurchaseDate: firstPurchaseNYearsAgo(2) })]);
    await checkAndSendPurchaseAnniversaryRewards();
    const record = __getInserted('BirthdayRewards').find(r => r.rewardType === 'purchase_anniversary_2yr');
    expect(record.discountPercent).toBe(15);
  });
});

describe('checkAndSendPurchaseAnniversaryRewards — email templates', () => {
  it('1yr uses purchase_anniversary_1yr email template', async () => {
    __seed('MemberProfiles', [makeProfile({ firstPurchaseDate: firstPurchaseNYearsAgo(1) })]);
    await checkAndSendPurchaseAnniversaryRewards();
    const log = __getEmailLog();
    expect(log.find(e => e.templateId === 'purchase_anniversary_1yr')).toBeDefined();
  });

  it('2yr uses purchase_anniversary_2yr email template', async () => {
    __seed('MemberProfiles', [makeProfile({ firstPurchaseDate: firstPurchaseNYearsAgo(2) })]);
    await checkAndSendPurchaseAnniversaryRewards();
    const log = __getEmailLog();
    expect(log.find(e => e.templateId === 'purchase_anniversary_2yr')).toBeDefined();
  });
});

describe('checkAndSendPurchaseAnniversaryRewards — deduplication', () => {
  it('skips 1yr reward if already sent this year', async () => {
    __seed('MemberProfiles', [makeProfile({ firstPurchaseDate: firstPurchaseNYearsAgo(1) })]);
    __seed('BirthdayRewards', [{
      _id: 'ded-1',
      memberId: 'mem-1',
      rewardType: 'purchase_anniversary_1yr',
      year: TODAY_ET_YEAR,
    }]);
    const result = await checkAndSendPurchaseAnniversaryRewards();
    expect(result.sent).toBe(0);
  });

  it('inserts dedup record with correct rewardType and year', async () => {
    __seed('MemberProfiles', [makeProfile({ firstPurchaseDate: firstPurchaseNYearsAgo(2) })]);
    await checkAndSendPurchaseAnniversaryRewards();
    const records = __getInserted('BirthdayRewards');
    expect(records[0].rewardType).toBe('purchase_anniversary_2yr');
    expect(records[0].year).toBe(TODAY_ET_YEAR);
  });
});

describe('checkAndSendPurchaseAnniversaryRewards — email failure', () => {
  it('does not insert dedup record when email fails', async () => {
    __seed('MemberProfiles', [makeProfile({ firstPurchaseDate: firstPurchaseNYearsAgo(1) })]);
    __failNextEmail();
    await checkAndSendPurchaseAnniversaryRewards();
    expect(__getInserted('BirthdayRewards').length).toBe(0);
  });

  it('increments failed (not sent) when email fails', async () => {
    __seed('MemberProfiles', [makeProfile({ firstPurchaseDate: firstPurchaseNYearsAgo(1) })]);
    __failNextEmail();
    const result = await checkAndSendPurchaseAnniversaryRewards();
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
  });
=======
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
>>>>>>> origin/cf-28jp-birthday-anniversary-rewards
});
