/**
 * @file loyaltyCalendarRewards.test.js
 * @description TDD tests for CF-p6v2 calendar-based rewards:
 *   checkBirthdayReward  — 7-day birthday window, once per year (birthday fetched from CMS)
 *   checkAnniversaryReward — 1-year and 2-year purchase anniversaries
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __reset, accounts } from 'wix-loyalty.v2';

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => String(s).trim(),
  validateId: (id) => (/^[a-f0-9-]+$/i.test(id) ? id : null),
}));

vi.mock('backend/utils/errorHandler', () => ({
  logError: vi.fn(),
}));

// ── wix-data mock (MemberProfiles CMS) ────────────────────────────────────────

const mockFind = vi.fn();
const mockLimit = vi.fn().mockReturnValue({ find: mockFind });
const mockEq    = vi.fn().mockReturnValue({ limit: mockLimit });
const mockQuery = vi.fn().mockReturnValue({ eq: mockEq });

vi.mock('wix-data', () => ({
  default: { query: mockQuery },
}));

/** Helper: configure the MemberProfiles mock to return a profile with the given birthday. */
function setProfileBirthday(month, day) {
  mockFind.mockResolvedValue({
    items: [{ birthdayMonth: month, birthdayDay: day }],
  });
}

/** Helper: configure the MemberProfiles mock to return no profile. */
function setNoProfile() {
  mockFind.mockResolvedValue({ items: [] });
}

// Set fake timers before import so getTodayET() sees our frozen clock
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-03-22T14:00:00Z'));

// todayET for 2026-03-22T14:00:00Z = "2026-03-22" (ET = UTC-4 EDT, so 10:00 ET)

const { checkBirthdayReward, checkAnniversaryReward } = await import(
  '../src/backend/loyaltyBonusPoints.web.js'
);

beforeEach(() => {
  __reset();
  // Default: profile has birthday Mar 22 (today)
  setProfileBirthday(3, 22);
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── checkBirthdayReward ───────────────────────────────────────────────────────

describe('checkBirthdayReward', () => {
  it('awards points when today is within the birthday window', async () => {
    // CMS profile has birthday Mar 22 — today IS the birthday
    const result = await checkBirthdayReward('acc-1', 'mem-1');
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(200);
    expect(accounts.earnPoints).toHaveBeenCalledTimes(1);
  });

  it('awards points when today is 3 days before birthday', async () => {
    // birthday Mar 25 — today is Mar 22 (3 days before)
    setProfileBirthday(3, 25);
    const result = await checkBirthdayReward('acc-1', 'mem-1');
    expect(result.success).toBe(true);
    expect(result.pointsAwarded).toBe(200);
  });

  it('skips when today is outside the birthday window (4+ days away)', async () => {
    // birthday Apr 1 — today is Mar 22 (10 days before)
    setProfileBirthday(4, 1);
    const result = await checkBirthdayReward('acc-1', 'mem-1');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('outside_window');
    expect(accounts.earnPoints).not.toHaveBeenCalled();
  });

  it('is idempotent — does not double-award in the same year', async () => {
    // Award once
    await checkBirthdayReward('acc-1', 'mem-1');
    // Award again same day
    await checkBirthdayReward('acc-1', 'mem-1');
    // Wix idempotencyKey deduplication: earnPoints called twice with same key
    // Both calls happen but Wix dedupes on the key — our contract is success both times
    expect(accounts.earnPoints).toHaveBeenCalledTimes(2);
    const firstKey  = accounts.earnPoints.mock.calls[0][1].idempotencyKey;
    const secondKey = accounts.earnPoints.mock.calls[1][1].idempotencyKey;
    expect(firstKey).toBe(secondKey); // same deterministic key = Wix dedupes
  });

  it('uses year-scoped idempotency key (mem-1_birthday_2026)', async () => {
    await checkBirthdayReward('acc-1', 'mem-1');
    const key = accounts.earnPoints.mock.calls[0][1].idempotencyKey;
    expect(key).toBe('mem-1_birthday_2026');
  });

  it('returns early when accountId is missing', async () => {
    const result = await checkBirthdayReward(null, 'mem-1');
    expect(result.success).toBe(false);
    expect(accounts.earnPoints).not.toHaveBeenCalled();
  });

  it('returns early when memberId is missing', async () => {
    const result = await checkBirthdayReward('acc-1', null);
    expect(result.success).toBe(false);
    expect(accounts.earnPoints).not.toHaveBeenCalled();
  });

  it('returns no_birthday_on_file when profile has no birthday fields', async () => {
    mockFind.mockResolvedValue({ items: [{ memberId: 'mem-1' }] }); // no birthdayMonth/Day
    const result = await checkBirthdayReward('acc-1', 'mem-1');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_birthday_on_file');
    expect(accounts.earnPoints).not.toHaveBeenCalled();
  });

  it('returns no_birthday_on_file when profile is not found in CMS', async () => {
    setNoProfile();
    const result = await checkBirthdayReward('acc-1', 'mem-1');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_birthday_on_file');
    expect(accounts.earnPoints).not.toHaveBeenCalled();
  });

  it('returns profile_fetch_failed when wixData.query throws', async () => {
    mockFind.mockRejectedValueOnce(new Error('DB error'));
    const result = await checkBirthdayReward('acc-1', 'mem-1');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('profile_fetch_failed');
    expect(accounts.earnPoints).not.toHaveBeenCalled();
  });

  it('queries MemberProfiles with the correct memberId', async () => {
    await checkBirthdayReward('acc-1', 'mem-42');
    expect(mockQuery).toHaveBeenCalledWith('MemberProfiles');
    expect(mockEq).toHaveBeenCalledWith('memberId', 'mem-42');
  });

  it('does not throw when earnPoints rejects', async () => {
    accounts.earnPoints.mockRejectedValueOnce(new Error('Wix error'));
    await expect(checkBirthdayReward('acc-1', 'mem-1')).resolves.not.toThrow();
  });
});

// ── checkAnniversaryReward ────────────────────────────────────────────────────

describe('checkAnniversaryReward', () => {
  it('awards points on the exact 1-year anniversary', async () => {
    // First purchase: 2025-03-22 → 1-year anniversary: 2026-03-22
    const result = await checkAnniversaryReward('acc-1', '2025-03-22', 'mem-1');
    expect(result.success).toBe(true);
    expect(result.anniversaryYear).toBe(1);
    expect(accounts.earnPoints).toHaveBeenCalledTimes(1);
  });

  it('awards points on the exact 2-year anniversary', async () => {
    // First purchase: 2024-03-22 → 2-year anniversary: 2026-03-22
    const result = await checkAnniversaryReward('acc-1', '2024-03-22', 'mem-1');
    expect(result.success).toBe(true);
    expect(result.anniversaryYear).toBe(2);
  });

  it('skips when today is not an anniversary', async () => {
    // First purchase: 2025-06-15 → no anniversary today
    const result = await checkAnniversaryReward('acc-1', '2025-06-15', 'mem-1');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_anniversary');
    expect(accounts.earnPoints).not.toHaveBeenCalled();
  });

  it('skips for 3-year anniversary (only 1 and 2 are rewarded)', async () => {
    // First purchase: 2023-03-22 → 3-year anniversary today
    const result = await checkAnniversaryReward('acc-1', '2023-03-22', 'mem-1');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_anniversary');
  });

  it('uses year-scoped idempotency key (mem-1_anniversary_1_2026)', async () => {
    await checkAnniversaryReward('acc-1', '2025-03-22', 'mem-1');
    const key = accounts.earnPoints.mock.calls[0][1].idempotencyKey;
    expect(key).toBe('mem-1_anniversary_1_2026');
  });

  it('uses year-scoped idempotency key for year 2 (mem-1_anniversary_2_2026)', async () => {
    await checkAnniversaryReward('acc-1', '2024-03-22', 'mem-1');
    const key = accounts.earnPoints.mock.calls[0][1].idempotencyKey;
    expect(key).toBe('mem-1_anniversary_2_2026');
  });

  it('skips when firstPurchaseDate is null (no purchase history)', async () => {
    const result = await checkAnniversaryReward('acc-1', null, 'mem-1');
    expect(result.success).toBe(false);
    expect(result.reason).toBe('not_anniversary');
    expect(accounts.earnPoints).not.toHaveBeenCalled();
  });

  it('returns early when accountId is missing', async () => {
    const result = await checkAnniversaryReward(null, '2025-03-22', 'mem-1');
    expect(result.success).toBe(false);
    expect(accounts.earnPoints).not.toHaveBeenCalled();
  });

  it('handles Feb 29 first purchase in non-leap anniversary year', async () => {
    // First purchase: 2024-02-29 (leap year) → 1-year anniversary in 2025 = Feb 28
    // System time is 2026-03-22, not Feb 28 2025 → should skip
    const result = await checkAnniversaryReward('acc-1', '2024-02-29', 'mem-1');
    expect(result.success).toBe(false);
  });

  it('does not throw when earnPoints rejects', async () => {
    accounts.earnPoints.mockRejectedValueOnce(new Error('Wix error'));
    await expect(
      checkAnniversaryReward('acc-1', '2025-03-22', 'mem-1')
    ).resolves.not.toThrow();
  });
});
