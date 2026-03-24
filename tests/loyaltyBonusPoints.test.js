import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __setAccount, __reset, accounts } from 'wix-loyalty.v2';

// ── Mock Infrastructure ──────────────────────────────────────────

vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => String(s).trim(),
  validateId: (id) => (/^[a-f0-9-]+$/i.test(id) ? id : null),
}));

// ── Import SUT ──────────────────────────────────────────────────

const {
  awardBonusPoints,
  getEarningConfig,
  BONUS_POINTS,
} = await import('../src/backend/loyaltyBonusPoints.web.js');

// ── Tests ───────────────────────────────────────────────────────

describe('loyaltyBonusPoints — CF-pa20', () => {
  beforeEach(() => {
    __reset();
    __setAccount({ _id: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789', points: { balance: 100 } });
  });

  // ── getEarningConfig ──────────────────────────────────────────

  describe('getEarningConfig', () => {
    it('returns earning config with points per dollar', async () => {
      const config = await getEarningConfig();
      expect(config.pointsPerDollar).toBe(2);
    });

    it('returns bonus point amounts for all activity types', async () => {
      const config = await getEarningConfig();
      expect(config.bonusPoints).toEqual({
        review: 100,
        photoReview: 150,
        referralComplete: 500,
        accountCreation: 50,
        birthday: 200,
      });
    });

    it('returns tier multipliers', async () => {
      const config = await getEarningConfig();
      expect(config.tierMultipliers).toEqual({
        Bronze: 1,
        Silver: 1,
        Gold: 1.5,
        Platinum: 2,
      });
    });
  });

  // ── BONUS_POINTS constant ─────────────────────────────────────

  describe('BONUS_POINTS constant', () => {
    it('exports point values for each activity', () => {
      expect(BONUS_POINTS.REVIEW).toBe(100);
      expect(BONUS_POINTS.PHOTO_REVIEW).toBe(150);
      expect(BONUS_POINTS.REFERRAL_COMPLETE).toBe(500);
      expect(BONUS_POINTS.ACCOUNT_CREATION).toBe(50);
      expect(BONUS_POINTS.BIRTHDAY).toBe(200);
    });
  });

  // ── awardBonusPoints ──────────────────────────────────────────

  describe('awardBonusPoints', () => {
    it('awards points for a review submission', async () => {
      const result = await awardBonusPoints('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'review');
      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(100);
      expect(result.reason).toBe('review');
      expect(accounts.earnPoints).toHaveBeenCalledWith(
        'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
        expect.objectContaining({ points: 100 })
      );
    });

    it('awards points for a photo review', async () => {
      const result = await awardBonusPoints('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'photoReview');
      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(150);
    });

    it('awards points for a completed referral', async () => {
      const result = await awardBonusPoints('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'referralComplete');
      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(500);
    });

    it('awards points for account creation', async () => {
      const result = await awardBonusPoints('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'accountCreation');
      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(50);
    });

    it('awards birthday bonus points', async () => {
      const result = await awardBonusPoints('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'birthday');
      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(200);
    });

    it('rejects unknown activity type', async () => {
      const result = await awardBonusPoints('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'unknown_activity');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/unknown activity/i);
      expect(accounts.earnPoints).not.toHaveBeenCalled();
    });

    it('rejects missing account ID', async () => {
      const result = await awardBonusPoints('', 'review');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/account.*required/i);
    });

    it('rejects invalid account ID format', async () => {
      const result = await awardBonusPoints('DROP TABLE;', 'review');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/invalid/i);
    });

    it('handles API errors gracefully', async () => {
      accounts.earnPoints.mockRejectedValueOnce(new Error('API down'));
      const result = await awardBonusPoints('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'review');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/failed/i);
    });

    it('includes activity description in earn call', async () => {
      await awardBonusPoints('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'review');
      expect(accounts.earnPoints).toHaveBeenCalledWith(
        'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
        expect.objectContaining({
          description: expect.stringContaining('review'),
        })
      );
    });

    it('allows custom point override', async () => {
      const result = await awardBonusPoints('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'review', { points: 75 });
      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(75);
      expect(accounts.earnPoints).toHaveBeenCalledWith(
        'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
        expect.objectContaining({ points: 75 })
      );
    });
  });
});
