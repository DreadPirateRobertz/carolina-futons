import { describe, it, expect, beforeEach } from 'vitest';

// ── financingCalc tests ─────────────────────────────────────────────

describe('financingCalc — NaN/edge-case input validation', () => {
  let getFinancingWidget, calculateForTerm, getAfterpayBreakdown, getCartFinancing;

  beforeEach(async () => {
    const mod = await import('../../src/backend/financingCalc.web.js');
    getFinancingWidget = mod.getFinancingWidget;
    calculateForTerm = mod.calculateForTerm;
    getAfterpayBreakdown = mod.getAfterpayBreakdown;
    getCartFinancing = mod.getCartFinancing;
  });

  describe('getFinancingWidget', () => {
    it('rejects NaN price', async () => {
      const result = await getFinancingWidget(NaN);
      expect(result.success).toBe(false);
    });

    it('rejects undefined price', async () => {
      const result = await getFinancingWidget(undefined);
      expect(result.success).toBe(false);
    });

    it('rejects null price', async () => {
      const result = await getFinancingWidget(null);
      expect(result.success).toBe(false);
    });

    it('rejects empty string price', async () => {
      const result = await getFinancingWidget('');
      expect(result.success).toBe(false);
    });

    it('rejects non-numeric string price', async () => {
      const result = await getFinancingWidget('abc');
      expect(result.success).toBe(false);
    });

    it('rejects negative price', async () => {
      const result = await getFinancingWidget(-100);
      expect(result.success).toBe(false);
    });

    it('rejects zero price', async () => {
      const result = await getFinancingWidget(0);
      expect(result.success).toBe(false);
    });

    it('rejects Infinity', async () => {
      const result = await getFinancingWidget(Infinity);
      expect(result.success).toBe(false);
    });

    it('accepts valid numeric string', async () => {
      const result = await getFinancingWidget('599.99');
      expect(result.success).toBe(true);
      expect(result.price).toBe(599.99);
    });

    it('accepts valid number', async () => {
      const result = await getFinancingWidget(500);
      expect(result.success).toBe(true);
      expect(result.eligible).toBe(true);
    });
  });

  describe('calculateForTerm', () => {
    it('rejects NaN price with NaN months', async () => {
      const result = await calculateForTerm(NaN, NaN);
      expect(result.success).toBe(false);
    });

    it('rejects valid price with NaN months', async () => {
      const result = await calculateForTerm(500, NaN);
      expect(result.success).toBe(false);
    });

    it('rejects undefined months', async () => {
      const result = await calculateForTerm(500, undefined);
      expect(result.success).toBe(false);
    });

    it('rejects zero months', async () => {
      const result = await calculateForTerm(500, 0);
      expect(result.success).toBe(false);
    });

    it('accepts valid inputs', async () => {
      const result = await calculateForTerm(500, 12);
      expect(result.success).toBe(true);
      expect(result.monthly).toBeGreaterThan(0);
    });
  });

  describe('getAfterpayBreakdown', () => {
    it('rejects NaN price', async () => {
      const result = await getAfterpayBreakdown(NaN);
      expect(result.success).toBe(false);
    });

    it('rejects empty string', async () => {
      const result = await getAfterpayBreakdown('');
      expect(result.success).toBe(false);
    });
  });

  describe('getCartFinancing', () => {
    it('rejects NaN total', async () => {
      const result = await getCartFinancing(NaN);
      expect(result.success).toBe(false);
    });

    it('rejects undefined total', async () => {
      const result = await getCartFinancing(undefined);
      expect(result.success).toBe(false);
    });
  });
});

// ── financingService tests ──────────────────────────────────────────

describe('financingService — NaN/edge-case input validation', () => {
  let calculateMonthlyPayment, getFinancingOptions, getLowestMonthlyDisplay;

  beforeEach(async () => {
    const mod = await import('../../src/backend/financingService.web.js');
    calculateMonthlyPayment = mod.calculateMonthlyPayment;
    getFinancingOptions = mod.getFinancingOptions;
    getLowestMonthlyDisplay = mod.getLowestMonthlyDisplay;
  });

  describe('calculateMonthlyPayment', () => {
    it('handles NaN price gracefully', () => {
      const result = calculateMonthlyPayment(NaN, 12);
      expect(result.monthly).toBe(0);
      expect(result.total).toBe(0);
    });

    it('handles undefined term gracefully (defaults to 1)', () => {
      const result = calculateMonthlyPayment(500, undefined);
      expect(result.term).toBe(1);
      expect(isNaN(result.monthly)).toBe(false);
    });

    it('handles undefined apr gracefully (defaults to 0)', () => {
      const result = calculateMonthlyPayment(500, 12, undefined);
      expect(isNaN(result.monthly)).toBe(false);
      expect(result.monthly).toBeGreaterThan(0);
    });

    it('handles NaN term gracefully', () => {
      const result = calculateMonthlyPayment(500, NaN);
      expect(result.term).toBe(1);
      expect(isNaN(result.monthly)).toBe(false);
    });

    it('handles NaN apr gracefully', () => {
      const result = calculateMonthlyPayment(500, 12, NaN);
      expect(isNaN(result.monthly)).toBe(false);
    });

    it('handles empty string term', () => {
      const result = calculateMonthlyPayment(500, '');
      expect(result.term).toBe(1);
      expect(isNaN(result.monthly)).toBe(false);
    });

    it('handles valid inputs correctly', () => {
      const result = calculateMonthlyPayment(600, 12, 0);
      expect(result.monthly).toBe(50);
      expect(result.total).toBe(600);
      expect(result.interest).toBe(0);
    });
  });

  describe('getFinancingOptions', () => {
    it('returns empty for NaN price', () => {
      const result = getFinancingOptions(NaN);
      expect(result).toEqual([]);
    });

    it('returns empty for undefined price', () => {
      const result = getFinancingOptions(undefined);
      expect(result).toEqual([]);
    });
  });

  describe('getLowestMonthlyDisplay', () => {
    it('returns null for NaN price', () => {
      const result = getLowestMonthlyDisplay(NaN);
      expect(result).toBeNull();
    });

    it('returns null for undefined price', () => {
      const result = getLowestMonthlyDisplay(undefined);
      expect(result).toBeNull();
    });
  });
});

// ── giftCards tests ─────────────────────────────────────────────────

describe('giftCards — input validation edge cases', () => {
  let purchaseGiftCard, redeemGiftCard;

  beforeEach(async () => {
    const { __seed } = await import('../__mocks__/wix-data.js');
    const { __setMember } = await import('../__mocks__/wix-members-backend.js');
    __setMember({ _id: 'member-1' });
    __seed('GiftCards', []);
    const mod = await import('../../src/backend/giftCards.web.js');
    purchaseGiftCard = mod.purchaseGiftCard;
    redeemGiftCard = mod.redeemGiftCard;
  });

  describe('purchaseGiftCard', () => {
    it('rejects NaN amount', async () => {
      const result = await purchaseGiftCard({
        amount: NaN,
        purchaserEmail: 'a@b.com',
        recipientEmail: 'c@d.com',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty string amount', async () => {
      const result = await purchaseGiftCard({
        amount: '',
        purchaserEmail: 'a@b.com',
        recipientEmail: 'c@d.com',
      });
      expect(result.success).toBe(false);
    });

    it('rejects undefined amount', async () => {
      const result = await purchaseGiftCard({
        amount: undefined,
        purchaserEmail: 'a@b.com',
        recipientEmail: 'c@d.com',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-standard amount', async () => {
      const result = await purchaseGiftCard({
        amount: 99,
        purchaserEmail: 'a@b.com',
        recipientEmail: 'c@d.com',
      });
      expect(result.success).toBe(false);
    });

    it('accepts valid amount from allowed list', async () => {
      const result = await purchaseGiftCard({
        amount: 50,
        purchaserEmail: 'buyer@test.com',
        recipientEmail: 'recipient@test.com',
      });
      expect(result.success).toBe(true);
      expect(result.amount).toBe(50);
    });
  });

  describe('redeemGiftCard', () => {
    it('rejects NaN amount', async () => {
      const result = await redeemGiftCard('CF-TEST-CODE', NaN);
      expect(result.success).toBe(false);
    });

    it('rejects empty string amount', async () => {
      const result = await redeemGiftCard('CF-TEST-CODE', '');
      expect(result.success).toBe(false);
    });

    it('rejects non-numeric string amount', async () => {
      const result = await redeemGiftCard('CF-TEST-CODE', 'abc');
      expect(result.success).toBe(false);
    });
  });
});
