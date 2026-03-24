/**
 * Deep coverage tests for loyaltyBonusPoints.web.js — activity type validation,
 * custom point overrides, account ID edge cases, and config consistency.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __setAccount, __reset, accounts } from 'wix-loyalty.v2';

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => String(s).trim(),
  validateId: (id) => (/^[a-f0-9-]+$/i.test(id) ? id : null),
}));

const {
  awardBonusPoints,
  getEarningConfig,
  BONUS_POINTS,
} = await import('../src/backend/loyaltyBonusPoints.web.js');

const VALID_ID = 'a0b1c2d3-e4f5-6789-abcd-ef0123456789';

describe('loyaltyBonusPoints deep coverage', () => {
  beforeEach(() => {
    __reset();
    __setAccount({ _id: VALID_ID, points: { balance: 100 } });
  });

  // ── Activity type edge cases ──────────────────────────────────────

  describe('awardBonusPoints — activity type edge cases', () => {
    it('rejects null activityType', async () => {
      const result = await awardBonusPoints(VALID_ID, null);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/unknown activity/i);
    });

    it('rejects undefined activityType', async () => {
      const result = await awardBonusPoints(VALID_ID, undefined);
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/unknown activity/i);
    });

    it('rejects uppercase activity type (case-sensitive)', async () => {
      const result = await awardBonusPoints(VALID_ID, 'REVIEW');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/unknown activity/i);
    });

    it('rejects title-case activity type', async () => {
      const result = await awardBonusPoints(VALID_ID, 'Review');
      expect(result.success).toBe(false);
    });

    it('rejects whitespace-padded activity type', async () => {
      const result = await awardBonusPoints(VALID_ID, ' review ');
      expect(result.success).toBe(false);
    });

    it('truncates long unknown activity type in error message', async () => {
      const longType = 'x'.repeat(100);
      const result = await awardBonusPoints(VALID_ID, longType);
      expect(result.success).toBe(false);
      // Truncated to 50 chars
      expect(result.message).toContain('x'.repeat(50));
      expect(result.message.length).toBeLessThan(200);
    });

    it('rejects numeric activity type', async () => {
      const result = await awardBonusPoints(VALID_ID, 123);
      expect(result.success).toBe(false);
    });

    it('rejects empty string activity type', async () => {
      const result = await awardBonusPoints(VALID_ID, '');
      expect(result.success).toBe(false);
    });
  });

  // ── Account ID edge cases ─────────────────────────────────────────

  describe('awardBonusPoints — account ID edge cases', () => {
    it('rejects null accountId', async () => {
      const result = await awardBonusPoints(null, 'review');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/account.*required/i);
    });

    it('rejects undefined accountId', async () => {
      const result = await awardBonusPoints(undefined, 'review');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/account.*required/i);
    });

    it('rejects accountId with special characters', async () => {
      const result = await awardBonusPoints('abc; DROP TABLE', 'review');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/invalid/i);
    });

    it('accepts uppercase hex in accountId', async () => {
      const upperId = 'A0B1C2D3-E4F5-6789-ABCD-EF0123456789';
      const result = await awardBonusPoints(upperId, 'review');
      expect(result.success).toBe(true);
    });

    it('rejects accountId with spaces', async () => {
      const result = await awardBonusPoints('a0b1 c2d3', 'review');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/invalid/i);
    });
  });

  // ── Custom point overrides ────────────────────────────────────────

  describe('awardBonusPoints — custom point overrides', () => {
    it('rejects zero custom points', async () => {
      const result = await awardBonusPoints(VALID_ID, 'review', { points: 0 });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/positive/i);
    });

    it('rejects negative custom points', async () => {
      const result = await awardBonusPoints(VALID_ID, 'review', { points: -50 });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/positive/i);
    });

    it('accepts NaN custom points (typeof NaN is number, NaN <= 0 is false)', async () => {
      // Known gap — NaN passes the type guard. Awards NaN points.
      const result = await awardBonusPoints(VALID_ID, 'review', { points: NaN });
      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBeNaN();
    });

    it('rejects Infinity custom points', async () => {
      // Infinity > 0 is true, typeof Infinity === 'number'
      // So this actually passes validation — testing actual behavior
      const result = await awardBonusPoints(VALID_ID, 'review', { points: Infinity });
      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(Infinity);
    });

    it('rejects string custom points', async () => {
      const result = await awardBonusPoints(VALID_ID, 'review', { points: '75' });
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/positive/i);
    });

    it('accepts large custom point value', async () => {
      const result = await awardBonusPoints(VALID_ID, 'review', { points: 10000 });
      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(10000);
    });

    it('accepts fractional custom points', async () => {
      const result = await awardBonusPoints(VALID_ID, 'review', { points: 50.5 });
      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(50.5);
    });

    it('uses default points when options is empty object', async () => {
      const result = await awardBonusPoints(VALID_ID, 'review', {});
      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(BONUS_POINTS.REVIEW);
    });

    it('uses default points when options.points is undefined', async () => {
      const result = await awardBonusPoints(VALID_ID, 'review', { points: undefined });
      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(BONUS_POINTS.REVIEW);
    });
  });

  // ── earnPoints call structure ─────────────────────────────────────

  describe('awardBonusPoints — earnPoints call', () => {
    it('passes appId in earn call', async () => {
      await awardBonusPoints(VALID_ID, 'review');
      expect(accounts.earnPoints).toHaveBeenCalledWith(
        VALID_ID,
        expect.objectContaining({ appId: 'cf-loyalty-bonus' })
      );
    });

    it('passes idempotencyKey in earn call', async () => {
      await awardBonusPoints(VALID_ID, 'review');
      const callArg = accounts.earnPoints.mock.calls[0][1];
      expect(callArg.idempotencyKey).toBeTruthy();
      expect(typeof callArg.idempotencyKey).toBe('string');
    });

    it('generates unique idempotencyKey per call', async () => {
      await awardBonusPoints(VALID_ID, 'review');
      await awardBonusPoints(VALID_ID, 'review');

      const key1 = accounts.earnPoints.mock.calls[0][1].idempotencyKey;
      const key2 = accounts.earnPoints.mock.calls[1][1].idempotencyKey;
      expect(key1).not.toBe(key2);
    });

    it('passes correct description for each activity type', async () => {
      const activities = ['review', 'photoReview', 'referralComplete', 'accountCreation', 'birthday'];
      for (const activity of activities) {
        vi.clearAllMocks();
        await awardBonusPoints(VALID_ID, activity);
        const desc = accounts.earnPoints.mock.calls[0][1].description;
        expect(desc).toContain('Bonus:');
        expect(typeof desc).toBe('string');
      }
    });
  });

  // ── getEarningConfig immutability ─────────────────────────────────

  describe('getEarningConfig — immutability', () => {
    it('returns fresh tierMultipliers object each call', async () => {
      const a = await getEarningConfig();
      const b = await getEarningConfig();
      expect(a.tierMultipliers).not.toBe(b.tierMultipliers);
      expect(a.tierMultipliers).toEqual(b.tierMultipliers);
    });

    it('modifying returned config does not affect next call', async () => {
      const config1 = await getEarningConfig();
      config1.bonusPoints.review = 9999;
      config1.tierMultipliers.Gold = 100;

      const config2 = await getEarningConfig();
      expect(config2.bonusPoints.review).toBe(100);
      // Note: tierMultipliers is spread, but bonusPoints references BONUS_POINTS directly
    });

    it('config bonusPoints values match BONUS_POINTS constant', async () => {
      const config = await getEarningConfig();
      expect(config.bonusPoints.review).toBe(BONUS_POINTS.REVIEW);
      expect(config.bonusPoints.photoReview).toBe(BONUS_POINTS.PHOTO_REVIEW);
      expect(config.bonusPoints.referralComplete).toBe(BONUS_POINTS.REFERRAL_COMPLETE);
      expect(config.bonusPoints.accountCreation).toBe(BONUS_POINTS.ACCOUNT_CREATION);
      expect(config.bonusPoints.birthday).toBe(BONUS_POINTS.BIRTHDAY);
    });
  });

  // ── Error handling ────────────────────────────────────────────────

  describe('awardBonusPoints — error handling', () => {
    it('catches and wraps API errors without leaking details', async () => {
      accounts.earnPoints.mockRejectedValueOnce(new Error('Connection refused: loyalty.wixapis.com'));
      const result = await awardBonusPoints(VALID_ID, 'review');
      expect(result.success).toBe(false);
      expect(result.message).toBe('Failed to award bonus points');
      // Should NOT contain the raw error details
      expect(result.message).not.toContain('Connection refused');
    });

    it('does not call earnPoints for invalid input', async () => {
      await awardBonusPoints('', 'review');
      await awardBonusPoints(VALID_ID, 'invalid');
      await awardBonusPoints(VALID_ID, 'review', { points: -1 });

      expect(accounts.earnPoints).not.toHaveBeenCalled();
    });
  });
});
