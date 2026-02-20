import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset } from './__mocks__/wix-data.js';
import {
  purchaseGiftCard,
  checkBalance,
  redeemGiftCard,
  getGiftCardOptions,
} from '../src/backend/giftCards.web.js';

// ── purchaseGiftCard ─────────────────────────────────────────────────

describe('purchaseGiftCard', () => {
  it('creates a gift card with valid data', async () => {
    const result = await purchaseGiftCard({
      amount: 100,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'friend@test.com',
      recipientName: 'Friend',
      message: 'Happy birthday!',
    });
    expect(result.success).toBe(true);
    expect(result.code).toMatch(/^CF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(result.amount).toBe(100);
    expect(result.giftCardId).toBeDefined();
    expect(result.expirationDate).toBeDefined();
  });

  it('rejects invalid amount', async () => {
    const result = await purchaseGiftCard({
      amount: 75,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'friend@test.com',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Amount must be');
  });

  it('accepts all valid denominations', async () => {
    for (const amount of [25, 50, 100, 150, 200, 500]) {
      const result = await purchaseGiftCard({
        amount,
        purchaserEmail: 'buyer@test.com',
        recipientEmail: 'friend@test.com',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects missing required fields', async () => {
    const result = await purchaseGiftCard({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const result = await purchaseGiftCard({
      amount: 50,
      purchaserEmail: 'not-an-email',
      recipientEmail: 'friend@test.com',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid email');
  });
});

// ── checkBalance ─────────────────────────────────────────────────────

describe('checkBalance', () => {
  beforeEach(() => {
    __seed('GiftCards', [
      {
        _id: 'gc-1',
        code: 'CF-AAAA-BBBB-CCCC-DDDD',
        balance: 75,
        initialAmount: 100,
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      },
      {
        _id: 'gc-2',
        code: 'CF-XXXX-YYYY-ZZZZ-WWWW',
        balance: 50,
        initialAmount: 50,
        status: 'active',
        expirationDate: new Date(Date.now() - 86400000).toISOString(), // expired
      },
    ]);
  });

  it('returns balance for valid active card', async () => {
    const result = await checkBalance('CF-AAAA-BBBB-CCCC-DDDD');
    expect(result.found).toBe(true);
    expect(result.balance).toBe(75);
    expect(result.status).toBe('active');
    expect(result.initialAmount).toBe(100);
  });

  it('returns not found for nonexistent code', async () => {
    const result = await checkBalance('CF-NOPE-NOPE-NOPE-NOPE');
    expect(result.found).toBe(false);
  });

  it('returns expired status for expired card', async () => {
    const result = await checkBalance('CF-XXXX-YYYY-ZZZZ-WWWW');
    expect(result.found).toBe(true);
    expect(result.balance).toBe(0);
    expect(result.status).toBe('expired');
  });

  it('handles null code', async () => {
    const result = await checkBalance(null);
    expect(result.found).toBe(false);
  });

  it('is case-insensitive', async () => {
    const result = await checkBalance('cf-aaaa-bbbb-cccc-dddd');
    expect(result.found).toBe(true);
    expect(result.balance).toBe(75);
  });
});

// ── redeemGiftCard ───────────────────────────────────────────────────

describe('redeemGiftCard', () => {
  beforeEach(() => {
    __seed('GiftCards', [
      {
        _id: 'gc-1',
        code: 'CF-AAAA-BBBB-CCCC-DDDD',
        balance: 100,
        initialAmount: 100,
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      },
    ]);
  });

  it('redeems partial amount', async () => {
    const result = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 40);
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(40);
    expect(result.remainingBalance).toBe(60);
  });

  it('redeems full amount and marks as redeemed', async () => {
    const result = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 100);
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(100);
    expect(result.remainingBalance).toBe(0);
  });

  it('caps redemption at available balance', async () => {
    const result = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 200);
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(100);
    expect(result.remainingBalance).toBe(0);
  });

  it('rejects missing code', async () => {
    const result = await redeemGiftCard(null, 50);
    expect(result.success).toBe(false);
  });

  it('rejects invalid amount', async () => {
    const result = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 0);
    expect(result.success).toBe(false);
  });

  it('rejects nonexistent card', async () => {
    const result = await redeemGiftCard('CF-NOPE-NOPE-NOPE-NOPE', 50);
    expect(result.success).toBe(false);
  });
});

// ── getGiftCardOptions ───────────────────────────────────────────────

describe('getGiftCardOptions', () => {
  it('returns all denominations', async () => {
    const options = await getGiftCardOptions();
    expect(options).toHaveLength(6);
    expect(options.map(o => o.amount)).toEqual([25, 50, 100, 150, 200, 500]);
  });

  it('formats labels with dollar sign', async () => {
    const options = await getGiftCardOptions();
    expect(options[0].label).toBe('$25');
    expect(options[5].label).toBe('$500');
  });
});
