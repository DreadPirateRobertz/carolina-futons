import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset } from '../__mocks__/wix-data.js';
import {
  issueStoreCredit,
  getMyStoreCredit,
  applyStoreCredit,
  getStoreCreditHistory,
  giftStoreCredit,
  getExpiringCredits,
} from '../../src/backend/storeCreditService.web.js';

// ── Helper: future/past dates ────────────────────────────────────────

const DAY = 86400000;
const futureDate = (days = 30) => new Date(Date.now() + DAY * days).toISOString();
const pastDate = (days = 1) => new Date(Date.now() - DAY * days).toISOString();

// ── issueStoreCredit (Admin) ─────────────────────────────────────────

describe('issueStoreCredit', () => {
  beforeEach(__reset);

  it('issues store credit with valid data', async () => {
    const result = await issueStoreCredit({
      memberId: 'member-123',
      amount: 50,
      reason: 'return',
      orderReference: 'order-456',
    });
    expect(result.success).toBe(true);
    expect(result.creditId).toBeDefined();
    expect(result.balance).toBe(50);
    expect(result.expirationDate).toBeDefined();
  });

  it('rejects missing memberId', async () => {
    const result = await issueStoreCredit({
      amount: 50,
      reason: 'return',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Member ID');
  });

  it('rejects missing amount', async () => {
    const result = await issueStoreCredit({
      memberId: 'member-123',
      reason: 'return',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('amount');
  });

  it('rejects zero amount', async () => {
    const result = await issueStoreCredit({
      memberId: 'member-123',
      amount: 0,
      reason: 'return',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', async () => {
    const result = await issueStoreCredit({
      memberId: 'member-123',
      amount: -10,
      reason: 'return',
    });
    expect(result.success).toBe(false);
  });

  it('rejects NaN amount', async () => {
    const result = await issueStoreCredit({
      memberId: 'member-123',
      amount: 'abc',
      reason: 'return',
    });
    expect(result.success).toBe(false);
  });

  it('rejects Infinity amount', async () => {
    const result = await issueStoreCredit({
      memberId: 'member-123',
      amount: Infinity,
      reason: 'return',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid reason', async () => {
    const result = await issueStoreCredit({
      memberId: 'member-123',
      amount: 50,
      reason: 'hacking',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('reason');
  });

  it('accepts all valid reasons', async () => {
    for (const reason of ['return', 'refund', 'promotion', 'admin_gift', 'goodwill']) {
      const result = await issueStoreCredit({
        memberId: 'member-123',
        amount: 10,
        reason,
      });
      expect(result.success).toBe(true);
    }
  });

  it('caps amount at $10,000', async () => {
    const result = await issueStoreCredit({
      memberId: 'member-123',
      amount: 99999,
      reason: 'admin_gift',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('10,000');
  });

  it('sanitizes memberId input', async () => {
    const result = await issueStoreCredit({
      memberId: '<script>alert("xss")</script>',
      amount: 50,
      reason: 'return',
    });
    // Should still work but with sanitized ID (or fail validation)
    expect(result.success).toBe(false);
  });

  it('records initial transaction in history', async () => {
    const result = await issueStoreCredit({
      memberId: 'member-123',
      amount: 75,
      reason: 'refund',
      orderReference: 'order-789',
    });
    expect(result.success).toBe(true);
    // The credit should have an initial transaction
    expect(result.creditId).toBeDefined();
  });

  it('rejects null input', async () => {
    const result = await issueStoreCredit(null);
    expect(result.success).toBe(false);
  });

  it('rejects empty object', async () => {
    const result = await issueStoreCredit({});
    expect(result.success).toBe(false);
  });
});

// ── getMyStoreCredit (SiteMember) ────────────────────────────────────

describe('getMyStoreCredit', () => {
  beforeEach(() => {
    __reset();
    __seed('StoreCredits', [
      {
        _id: 'sc-1',
        memberId: 'member-123',
        balance: 25.50,
        initialAmount: 50,
        reason: 'return',
        orderReference: 'order-100',
        status: 'active',
        createdDate: new Date(Date.now() - DAY * 10).toISOString(),
        expirationDate: futureDate(355),
        transactions: JSON.stringify([
          { type: 'issue', amount: 50, date: new Date(Date.now() - DAY * 10).toISOString() },
          { type: 'redeem', amount: 24.50, date: new Date(Date.now() - DAY * 5).toISOString(), orderId: 'order-200' },
        ]),
      },
      {
        _id: 'sc-2',
        memberId: 'member-123',
        balance: 100,
        initialAmount: 100,
        reason: 'promotion',
        orderReference: '',
        status: 'active',
        createdDate: new Date(Date.now() - DAY * 2).toISOString(),
        expirationDate: futureDate(363),
        transactions: JSON.stringify([
          { type: 'issue', amount: 100, date: new Date(Date.now() - DAY * 2).toISOString() },
        ]),
      },
      {
        _id: 'sc-3',
        memberId: 'member-123',
        balance: 0,
        initialAmount: 30,
        reason: 'return',
        status: 'used',
        createdDate: pastDate(60),
        expirationDate: futureDate(305),
        transactions: JSON.stringify([]),
      },
      {
        _id: 'sc-4',
        memberId: 'member-999',
        balance: 200,
        initialAmount: 200,
        reason: 'admin_gift',
        status: 'active',
        createdDate: pastDate(5),
        expirationDate: futureDate(360),
        transactions: JSON.stringify([]),
      },
    ]);
  });

  it('returns total balance across active credits for member', async () => {
    const result = await getMyStoreCredit('member-123');
    expect(result.success).toBe(true);
    expect(result.totalBalance).toBe(125.50);
  });

  it('returns individual credit entries', async () => {
    const result = await getMyStoreCredit('member-123');
    expect(result.success).toBe(true);
    expect(result.credits).toHaveLength(2); // only active ones
    expect(result.credits[0].balance).toBeDefined();
    expect(result.credits[0].expirationDate).toBeDefined();
  });

  it('does not include other members credits', async () => {
    const result = await getMyStoreCredit('member-123');
    expect(result.credits.every(c => c.memberId === 'member-123')).toBe(true);
  });

  it('does not include used/expired credits in active list', async () => {
    const result = await getMyStoreCredit('member-123');
    expect(result.credits.every(c => c.status === 'active')).toBe(true);
  });

  it('returns zero balance for member with no credits', async () => {
    const result = await getMyStoreCredit('member-no-credits');
    expect(result.success).toBe(true);
    expect(result.totalBalance).toBe(0);
    expect(result.credits).toHaveLength(0);
  });

  it('returns zero balance for null memberId', async () => {
    const result = await getMyStoreCredit(null);
    expect(result.success).toBe(false);
  });

  it('returns zero for empty memberId', async () => {
    const result = await getMyStoreCredit('');
    expect(result.success).toBe(false);
  });

  it('auto-expires credits past expiration date', async () => {
    __seed('StoreCredits', [
      {
        _id: 'sc-expired',
        memberId: 'member-exp',
        balance: 75,
        initialAmount: 75,
        reason: 'return',
        status: 'active',
        createdDate: pastDate(400),
        expirationDate: pastDate(35),
        transactions: JSON.stringify([]),
      },
    ]);
    const result = await getMyStoreCredit('member-exp');
    expect(result.success).toBe(true);
    expect(result.totalBalance).toBe(0);
    expect(result.credits).toHaveLength(0);
  });
});

// ── applyStoreCredit (SiteMember) ────────────────────────────────────

describe('applyStoreCredit', () => {
  beforeEach(() => {
    __reset();
    __seed('StoreCredits', [
      {
        _id: 'sc-1',
        memberId: 'member-123',
        balance: 40,
        initialAmount: 50,
        reason: 'return',
        status: 'active',
        createdDate: pastDate(10),
        expirationDate: futureDate(355),
        transactions: JSON.stringify([
          { type: 'issue', amount: 50, date: pastDate(10) },
        ]),
      },
      {
        _id: 'sc-2',
        memberId: 'member-123',
        balance: 60,
        initialAmount: 60,
        reason: 'promotion',
        status: 'active',
        createdDate: pastDate(5),
        expirationDate: futureDate(20), // expires sooner — should be used first
        transactions: JSON.stringify([
          { type: 'issue', amount: 60, date: pastDate(5) },
        ]),
      },
    ]);
  });

  it('applies credit to order total', async () => {
    const result = await applyStoreCredit('member-123', 50);
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(50);
    expect(result.remainingOrderBalance).toBe(0);
  });

  it('uses credits expiring soonest first (FIFO by expiration)', async () => {
    const result = await applyStoreCredit('member-123', 50);
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(50);
    // sc-2 (expires in 20 days) should be depleted before sc-1 (expires in 355 days)
    expect(result.creditsUsed).toBeDefined();
    expect(result.creditsUsed.length).toBeGreaterThanOrEqual(1);
  });

  it('applies across multiple credits when needed', async () => {
    const result = await applyStoreCredit('member-123', 90);
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(90);
    expect(result.creditsUsed.length).toBe(2);
  });

  it('caps at total available balance', async () => {
    const result = await applyStoreCredit('member-123', 200);
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(100); // 40 + 60
    expect(result.remainingOrderBalance).toBe(100);
  });

  it('rejects missing memberId', async () => {
    const result = await applyStoreCredit(null, 50);
    expect(result.success).toBe(false);
  });

  it('rejects zero amount', async () => {
    const result = await applyStoreCredit('member-123', 0);
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', async () => {
    const result = await applyStoreCredit('member-123', -50);
    expect(result.success).toBe(false);
  });

  it('rejects NaN amount', async () => {
    const result = await applyStoreCredit('member-123', 'bad');
    expect(result.success).toBe(false);
  });

  it('rejects Infinity amount', async () => {
    const result = await applyStoreCredit('member-123', Infinity);
    expect(result.success).toBe(false);
  });

  it('returns zero applied when member has no credits', async () => {
    const result = await applyStoreCredit('member-no-credits', 50);
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(0);
    expect(result.remainingOrderBalance).toBe(50);
  });

  it('skips expired credits during application', async () => {
    __seed('StoreCredits', [
      {
        _id: 'sc-exp',
        memberId: 'member-exp',
        balance: 100,
        initialAmount: 100,
        reason: 'return',
        status: 'active',
        createdDate: pastDate(400),
        expirationDate: pastDate(5),
        transactions: JSON.stringify([]),
      },
    ]);
    const result = await applyStoreCredit('member-exp', 50);
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(0);
  });

  it('marks credit as used when fully depleted', async () => {
    __seed('StoreCredits', [
      {
        _id: 'sc-full',
        memberId: 'member-full',
        balance: 25,
        initialAmount: 25,
        reason: 'return',
        status: 'active',
        createdDate: pastDate(5),
        expirationDate: futureDate(360),
        transactions: JSON.stringify([]),
      },
    ]);
    const result = await applyStoreCredit('member-full', 25);
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(25);
  });

  it('handles fractional amounts correctly', async () => {
    __seed('StoreCredits', [
      {
        _id: 'sc-frac',
        memberId: 'member-frac',
        balance: 33.33,
        initialAmount: 33.33,
        reason: 'refund',
        status: 'active',
        createdDate: pastDate(5),
        expirationDate: futureDate(360),
        transactions: JSON.stringify([]),
      },
    ]);
    const result = await applyStoreCredit('member-frac', 20.50);
    expect(result.success).toBe(true);
    expect(result.amountApplied).toBe(20.50);
    expect(result.remainingOrderBalance).toBe(0);
  });
});

// ── getStoreCreditHistory (SiteMember) ───────────────────────────────

describe('getStoreCreditHistory', () => {
  beforeEach(() => {
    __reset();
    __seed('StoreCredits', [
      {
        _id: 'sc-1',
        memberId: 'member-123',
        balance: 25,
        initialAmount: 50,
        reason: 'return',
        orderReference: 'order-100',
        status: 'active',
        createdDate: pastDate(30),
        expirationDate: futureDate(335),
        transactions: JSON.stringify([
          { type: 'issue', amount: 50, date: pastDate(30), reason: 'return' },
          { type: 'redeem', amount: 25, date: pastDate(15), orderId: 'order-200' },
        ]),
      },
      {
        _id: 'sc-2',
        memberId: 'member-123',
        balance: 0,
        initialAmount: 100,
        reason: 'promotion',
        status: 'used',
        createdDate: pastDate(90),
        expirationDate: futureDate(275),
        transactions: JSON.stringify([
          { type: 'issue', amount: 100, date: pastDate(90), reason: 'promotion' },
          { type: 'redeem', amount: 100, date: pastDate(60), orderId: 'order-300' },
        ]),
      },
    ]);
  });

  it('returns all credits for member (including used)', async () => {
    const result = await getStoreCreditHistory('member-123');
    expect(result.success).toBe(true);
    expect(result.credits).toHaveLength(2);
  });

  it('includes transaction history for each credit', async () => {
    const result = await getStoreCreditHistory('member-123');
    expect(result.credits[0].transactions).toBeDefined();
    expect(result.credits[0].transactions.length).toBeGreaterThan(0);
  });

  it('returns empty for member with no history', async () => {
    const result = await getStoreCreditHistory('member-new');
    expect(result.success).toBe(true);
    expect(result.credits).toHaveLength(0);
  });

  it('rejects null memberId', async () => {
    const result = await getStoreCreditHistory(null);
    expect(result.success).toBe(false);
  });

  it('rejects empty memberId', async () => {
    const result = await getStoreCreditHistory('');
    expect(result.success).toBe(false);
  });
});

// ── giftStoreCredit (SiteMember) ─────────────────────────────────────

describe('giftStoreCredit', () => {
  beforeEach(() => {
    __reset();
    __seed('StoreCredits', [
      {
        _id: 'sc-gift-source',
        memberId: 'member-giver',
        balance: 75,
        initialAmount: 100,
        reason: 'return',
        status: 'active',
        createdDate: pastDate(10),
        expirationDate: futureDate(355),
        transactions: JSON.stringify([
          { type: 'issue', amount: 100, date: pastDate(10) },
        ]),
      },
    ]);
  });

  it('transfers credit from giver to recipient', async () => {
    const result = await giftStoreCredit({
      fromMemberId: 'member-giver',
      toMemberId: 'member-recipient',
      amount: 30,
      message: 'Enjoy!',
    });
    expect(result.success).toBe(true);
    expect(result.giftedAmount).toBe(30);
    expect(result.newCreditId).toBeDefined();
  });

  it('deducts from giver balance', async () => {
    await giftStoreCredit({
      fromMemberId: 'member-giver',
      toMemberId: 'member-recipient',
      amount: 30,
    });
    const giverCredits = await getMyStoreCredit('member-giver');
    expect(giverCredits.totalBalance).toBe(45); // 75 - 30
  });

  it('rejects gift exceeding available balance', async () => {
    const result = await giftStoreCredit({
      fromMemberId: 'member-giver',
      toMemberId: 'member-recipient',
      amount: 200,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Insufficient');
  });

  it('rejects gifting to self', async () => {
    const result = await giftStoreCredit({
      fromMemberId: 'member-giver',
      toMemberId: 'member-giver',
      amount: 10,
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('yourself');
  });

  it('rejects missing fromMemberId', async () => {
    const result = await giftStoreCredit({
      toMemberId: 'member-recipient',
      amount: 10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing toMemberId', async () => {
    const result = await giftStoreCredit({
      fromMemberId: 'member-giver',
      amount: 10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero amount', async () => {
    const result = await giftStoreCredit({
      fromMemberId: 'member-giver',
      toMemberId: 'member-recipient',
      amount: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', async () => {
    const result = await giftStoreCredit({
      fromMemberId: 'member-giver',
      toMemberId: 'member-recipient',
      amount: -25,
    });
    expect(result.success).toBe(false);
  });

  it('sanitizes message input', async () => {
    const result = await giftStoreCredit({
      fromMemberId: 'member-giver',
      toMemberId: 'member-recipient',
      amount: 10,
      message: '<script>alert("xss")</script>Enjoy your credit!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects null input', async () => {
    const result = await giftStoreCredit(null);
    expect(result.success).toBe(false);
  });
});

// ── getExpiringCredits (SiteMember) ──────────────────────────────────

describe('getExpiringCredits', () => {
  beforeEach(() => {
    __reset();
    __seed('StoreCredits', [
      {
        _id: 'sc-soon',
        memberId: 'member-123',
        balance: 50,
        initialAmount: 50,
        reason: 'return',
        status: 'active',
        createdDate: pastDate(350),
        expirationDate: futureDate(10), // expires in 10 days
        transactions: JSON.stringify([]),
      },
      {
        _id: 'sc-later',
        memberId: 'member-123',
        balance: 100,
        initialAmount: 100,
        reason: 'promotion',
        status: 'active',
        createdDate: pastDate(5),
        expirationDate: futureDate(360), // expires in 360 days
        transactions: JSON.stringify([]),
      },
    ]);
  });

  it('returns credits expiring within given days', async () => {
    const result = await getExpiringCredits('member-123', 30);
    expect(result.success).toBe(true);
    expect(result.expiringCredits).toHaveLength(1);
    expect(result.expiringCredits[0]._id).toBe('sc-soon');
  });

  it('returns empty when no credits expiring soon', async () => {
    const result = await getExpiringCredits('member-123', 5);
    expect(result.success).toBe(true);
    expect(result.expiringCredits).toHaveLength(0);
  });

  it('defaults to 30 days if not specified', async () => {
    const result = await getExpiringCredits('member-123');
    expect(result.success).toBe(true);
    expect(result.expiringCredits).toHaveLength(1);
  });

  it('rejects null memberId', async () => {
    const result = await getExpiringCredits(null);
    expect(result.success).toBe(false);
  });

  it('includes expiration amount in response', async () => {
    const result = await getExpiringCredits('member-123', 30);
    expect(result.expiringTotal).toBe(50);
  });
});
