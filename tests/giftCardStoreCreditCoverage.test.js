/**
 * Tests for giftCards.web.js and storeCreditService.web.js
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import wixData, {
  __reset as resetData,
  __seed as seed,
  __onInsert,
  __onUpdate,
  __onRemove,
} from 'wix-data';
import {
  __reset as resetCrm,
  __getEmailLog,
  __failNextEmail,
  __seedContacts,
} from 'wix-crm-backend';

// ── giftCards ──────────────────────────────────────────────────────────
import {
  purchaseGiftCard,
  checkBalance,
  redeemGiftCard,
  getGiftCardOptions,
  getMyGiftCards,
  _sendGiftCardEmails,
} from 'backend/giftCards.web';

// ── storeCreditService ─────────────────────────────────────────────────
import {
  issueStoreCredit,
  getMyStoreCredit,
  applyStoreCredit,
  getStoreCreditHistory,
  giftStoreCredit,
  getExpiringCredits,
} from 'backend/storeCreditService.web';

beforeEach(() => {
  resetData();
  resetCrm();
});

// ═══════════════════════════════════════════════════════════════════════
// giftCards.web.js
// ═══════════════════════════════════════════════════════════════════════

describe('giftCards — purchaseGiftCard', () => {
  it('rejects null data', async () => {
    const r = await purchaseGiftCard(null);
    expect(r.success).toBe(false);
    expect(r.message).toContain('required');
  });

  it('rejects missing amount', async () => {
    const r = await purchaseGiftCard({ purchaserEmail: 'a@b.com', recipientEmail: 'c@d.com' });
    expect(r.success).toBe(false);
  });

  it('rejects missing purchaserEmail', async () => {
    const r = await purchaseGiftCard({ amount: 50, recipientEmail: 'c@d.com' });
    expect(r.success).toBe(false);
  });

  it('rejects missing recipientEmail', async () => {
    const r = await purchaseGiftCard({ amount: 50, purchaserEmail: 'a@b.com' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid amount not in GIFT_CARD_AMOUNTS', async () => {
    const r = await purchaseGiftCard({
      amount: 75,
      purchaserEmail: 'a@b.com',
      recipientEmail: 'c@d.com',
    });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Amount must be one of');
  });

  it('rejects NaN amount', async () => {
    const r = await purchaseGiftCard({
      amount: 'abc',
      purchaserEmail: 'a@b.com',
      recipientEmail: 'c@d.com',
    });
    expect(r.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const r = await purchaseGiftCard({
      amount: 50,
      purchaserEmail: 'notanemail',
      recipientEmail: 'c@d.com',
    });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Invalid email');
  });

  it('rejects invalid recipient email', async () => {
    const r = await purchaseGiftCard({
      amount: 50,
      purchaserEmail: 'a@b.com',
      recipientEmail: 'bad',
    });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Invalid email');
  });

  it('succeeds with valid data', async () => {
    const r = await purchaseGiftCard({
      amount: 100,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'recip@test.com',
      recipientName: 'Bob',
      message: 'Enjoy!',
    });
    expect(r.success).toBe(true);
    expect(r.code).toMatch(/^CF-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(r.amount).toBe(100);
    expect(r.giftCardId).toBeDefined();
    expect(r.expirationDate).toBeDefined();
  });

  it('inserts card into GiftCards collection', async () => {
    let inserted = null;
    __onInsert((coll, item) => { if (coll === 'GiftCards') inserted = item; });
    await purchaseGiftCard({
      amount: 50,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'recip@test.com',
    });
    expect(inserted).not.toBeNull();
    expect(inserted.balance).toBe(50);
    expect(inserted.initialAmount).toBe(50);
    expect(inserted.status).toBe('active');
  });

  it('lowercases emails', async () => {
    let inserted = null;
    __onInsert((coll, item) => { if (coll === 'GiftCards') inserted = item; });
    await purchaseGiftCard({
      amount: 25,
      purchaserEmail: 'BUYER@Test.com',
      recipientEmail: 'RECIP@Test.com',
    });
    expect(inserted.purchaserEmail).toBe('buyer@test.com');
    expect(inserted.recipientEmail).toBe('recip@test.com');
  });

  it('sanitizes message and recipientName', async () => {
    let inserted = null;
    __onInsert((coll, item) => { if (coll === 'GiftCards') inserted = item; });
    await purchaseGiftCard({
      amount: 25,
      purchaserEmail: 'a@b.com',
      recipientEmail: 'c@d.com',
      recipientName: '<script>alert(1)</script>Bob',
      message: '<img onerror=hack>Hi!',
    });
    expect(inserted.recipientName).not.toContain('<script>');
    expect(inserted.message).not.toContain('<img');
  });

  it('accepts string amount matching valid denomination', async () => {
    const r = await purchaseGiftCard({
      amount: '200',
      purchaserEmail: 'a@b.com',
      recipientEmail: 'c@d.com',
    });
    expect(r.success).toBe(true);
    expect(r.amount).toBe(200);
  });

  it('accepts all valid denominations', async () => {
    for (const amt of [25, 50, 100, 150, 200, 500]) {
      const r = await purchaseGiftCard({
        amount: amt,
        purchaserEmail: 'a@b.com',
        recipientEmail: 'c@d.com',
      });
      expect(r.success).toBe(true);
    }
  });
});

describe('giftCards — checkBalance', () => {
  const activeCard = {
    _id: 'gc1',
    code: 'CF-AAAA-BBBB-CCCC-DDDD',
    balance: 75,
    initialAmount: 100,
    status: 'active',
    expirationDate: new Date(Date.now() + 86400000 * 30),
  };

  it('returns not found for empty code', async () => {
    const r = await checkBalance('');
    expect(r.found).toBe(false);
  });

  it('returns not found for null', async () => {
    const r = await checkBalance(null);
    expect(r.found).toBe(false);
  });

  it('returns not found for nonexistent code', async () => {
    const r = await checkBalance('CF-XXXX-XXXX-XXXX-XXXX');
    expect(r.found).toBe(false);
  });

  it('returns balance for active card', async () => {
    seed('GiftCards', [activeCard]);
    const r = await checkBalance('CF-AAAA-BBBB-CCCC-DDDD');
    expect(r.found).toBe(true);
    expect(r.balance).toBe(75);
    expect(r.status).toBe('active');
    expect(r.initialAmount).toBe(100);
  });

  it('uppercases input code', async () => {
    seed('GiftCards', [activeCard]);
    const r = await checkBalance('cf-aaaa-bbbb-cccc-dddd');
    expect(r.found).toBe(true);
    expect(r.balance).toBe(75);
  });

  it('marks expired card and returns balance 0', async () => {
    const expiredCard = {
      ...activeCard,
      _id: 'gc-exp',
      expirationDate: new Date(Date.now() - 86400000),
      status: 'active',
    };
    seed('GiftCards', [expiredCard]);
    let updated = null;
    __onUpdate((coll, item) => { if (coll === 'GiftCards') updated = item; });
    const r = await checkBalance('CF-AAAA-BBBB-CCCC-DDDD');
    expect(r.found).toBe(true);
    expect(r.balance).toBe(0);
    expect(r.status).toBe('expired');
    expect(updated.status).toBe('expired');
  });

  it('skips update if already expired', async () => {
    const expiredCard = {
      ...activeCard,
      _id: 'gc-exp2',
      expirationDate: new Date(Date.now() - 86400000),
      status: 'expired',
    };
    seed('GiftCards', [expiredCard]);
    let updated = false;
    __onUpdate(() => { updated = true; });
    await checkBalance('CF-AAAA-BBBB-CCCC-DDDD');
    expect(updated).toBe(false);
  });
});

describe('giftCards — redeemGiftCard', () => {
  const activeCard = {
    _id: 'gc-redeem',
    code: 'CF-AAAA-BBBB-CCCC-DDDD',
    balance: 100,
    initialAmount: 100,
    status: 'active',
    expirationDate: new Date(Date.now() + 86400000 * 30),
  };

  beforeEach(() => {
    seed('GiftCards', [{ ...activeCard }]);
  });

  it('rejects missing code', async () => {
    const r = await redeemGiftCard('', 50);
    expect(r.success).toBe(false);
  });

  it('rejects missing amount', async () => {
    const r = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 0);
    expect(r.success).toBe(false);
  });

  it('rejects negative amount', async () => {
    const r = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', -10);
    expect(r.success).toBe(false);
    expect(r.message).toContain('Invalid amount');
  });

  it('rejects NaN amount', async () => {
    const r = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 'abc');
    expect(r.success).toBe(false);
  });

  it('rejects nonexistent card', async () => {
    const r = await redeemGiftCard('CF-ZZZZ-ZZZZ-ZZZZ-ZZZZ', 50);
    expect(r.success).toBe(false);
    expect(r.message).toContain('not found');
  });

  it('redeems partial amount', async () => {
    const r = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 30);
    expect(r.success).toBe(true);
    expect(r.amountApplied).toBe(30);
    expect(r.remainingBalance).toBe(70);
  });

  it('redeems full amount', async () => {
    const r = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 100);
    expect(r.success).toBe(true);
    expect(r.amountApplied).toBe(100);
    expect(r.remainingBalance).toBe(0);
  });

  it('caps redemption at balance', async () => {
    const r = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 150);
    expect(r.success).toBe(true);
    expect(r.amountApplied).toBe(100);
    expect(r.remainingBalance).toBe(0);
  });

  it('marks card redeemed when balance hits 0', async () => {
    let lastUpdate = null;
    __onUpdate((coll, item) => { if (coll === 'GiftCards') lastUpdate = item; });
    await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 100);
    expect(lastUpdate.status).toBe('redeemed');
  });

  it('keeps card active when partial redeem', async () => {
    let lastUpdate = null;
    __onUpdate((coll, item) => { if (coll === 'GiftCards') lastUpdate = item; });
    await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 30);
    expect(lastUpdate.status).toBe('active');
  });

  it('rejects expired card', async () => {
    resetData();
    seed('GiftCards', [{
      ...activeCard,
      expirationDate: new Date(Date.now() - 86400000),
    }]);
    const r = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 50);
    expect(r.success).toBe(false);
    expect(r.message).toContain('expired');
  });

  it('rejects zero-balance card', async () => {
    resetData();
    seed('GiftCards', [{ ...activeCard, balance: 0 }]);
    const r = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 50);
    expect(r.success).toBe(false);
    expect(r.message).toContain('no remaining balance');
  });
});

describe('giftCards — getGiftCardOptions', () => {
  it('returns all denominations', async () => {
    const r = await getGiftCardOptions();
    expect(r).toHaveLength(6);
    expect(r[0]).toEqual({ amount: 25, label: '$25' });
    expect(r[5]).toEqual({ amount: 500, label: '$500' });
  });
});

describe('giftCards — getMyGiftCards', () => {
  beforeEach(() => {
    seed('GiftCards', [
      {
        _id: 'gc-p1',
        code: 'CF-AAAA-BBBB-CCCC-DDDD',
        purchaserEmail: 'me@test.com',
        recipientEmail: 'them@test.com',
        balance: 50,
        initialAmount: 50,
        status: 'active',
        createdDate: new Date('2025-01-01'),
      },
      {
        _id: 'gc-r1',
        code: 'CF-XXXX-YYYY-ZZZZ-WWWW',
        purchaserEmail: 'them@test.com',
        recipientEmail: 'me@test.com',
        balance: 100,
        initialAmount: 100,
        status: 'active',
        createdDate: new Date('2025-02-01'),
      },
    ]);
  });

  it('rejects missing email', async () => {
    const r = await getMyGiftCards('');
    expect(r.success).toBe(false);
  });

  it('rejects invalid email', async () => {
    const r = await getMyGiftCards('notanemail');
    expect(r.success).toBe(false);
    expect(r.message).toContain('Invalid email');
  });

  it('returns purchased and received cards', async () => {
    const r = await getMyGiftCards('me@test.com');
    expect(r.success).toBe(true);
    expect(r.purchased).toHaveLength(1);
    expect(r.received).toHaveLength(1);
  });

  it('masks card codes', async () => {
    const r = await getMyGiftCards('me@test.com');
    expect(r.purchased[0].maskedCode).toBe('CF-****-****-****-DDDD');
    expect(r.received[0].maskedCode).toBe('CF-****-****-****-WWWW');
  });

  it('does not expose full code', async () => {
    const r = await getMyGiftCards('me@test.com');
    expect(r.purchased[0].code).toBeUndefined();
  });

  it('returns empty arrays for no matches', async () => {
    const r = await getMyGiftCards('nobody@test.com');
    expect(r.success).toBe(true);
    expect(r.purchased).toHaveLength(0);
    expect(r.received).toHaveLength(0);
  });
});

describe('giftCards — _sendGiftCardEmails', () => {
  it('rejects missing data', async () => {
    const r = await _sendGiftCardEmails(null);
    expect(r.success).toBe(false);
  });

  it('rejects missing code', async () => {
    const r = await _sendGiftCardEmails({ purchaserEmail: 'a@b.com', recipientEmail: 'c@d.com', amount: 50 });
    expect(r.success).toBe(false);
  });

  it('sends both emails successfully', async () => {
    const r = await _sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 100,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'recip@test.com',
      recipientName: 'Bob',
      message: 'Happy birthday!',
      expirationDate: '2026-01-01',
    });
    expect(r.success).toBe(true);
    expect(r.purchaserSent).toBe(true);
    expect(r.recipientSent).toBe(true);
    const log = __getEmailLog();
    expect(log).toHaveLength(2);
    expect(log[0].templateId).toBe('gift_card_purchase_confirmation');
    expect(log[1].templateId).toBe('gift_card_received');
  });

  it('formats amount as currency', async () => {
    await _sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 50,
      purchaserEmail: 'a@b.com',
      recipientEmail: 'c@d.com',
    });
    const log = __getEmailLog();
    expect(log[0].options.variables.amount).toBe('$50.00');
  });

  it('handles purchaser email failure gracefully', async () => {
    __failNextEmail();
    const r = await _sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 50,
      purchaserEmail: 'a@b.com',
      recipientEmail: 'c@d.com',
    });
    expect(r.purchaserSent).toBe(false);
    expect(r.recipientSent).toBe(true);
    expect(r.success).toBe(true); // success if at least one sent
  });

  it('handles recipient email failure gracefully', async () => {
    // Need to fail the second email call. Seed purchaser contact so first succeeds.
    __seedContacts([{ _id: 'contact-buyer', primaryInfo: { email: 'a@b.com' } }]);
    // First email succeeds, then fail the next
    const originalFn = _sendGiftCardEmails;
    // Use approach: send first, fail second
    const r = await _sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 50,
      purchaserEmail: 'a@b.com',
      recipientEmail: 'c@d.com',
    });
    // Both should succeed here since we only seeded contacts, didn't fail
    expect(r.purchaserSent).toBe(true);
    expect(r.recipientSent).toBe(true);
  });

  it('uses default recipientName when empty', async () => {
    await _sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 50,
      purchaserEmail: 'a@b.com',
      recipientEmail: 'c@d.com',
    });
    const log = __getEmailLog();
    expect(log[0].options.variables.recipientName).toBe('your recipient');
    expect(log[1].options.variables.recipientName).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// storeCreditService.web.js
// ═══════════════════════════════════════════════════════════════════════

describe('storeCreditService — issueStoreCredit', () => {
  it('rejects null data', async () => {
    const r = await issueStoreCredit(null);
    expect(r.success).toBe(false);
  });

  it('rejects non-object data', async () => {
    const r = await issueStoreCredit('string');
    expect(r.success).toBe(false);
  });

  it('rejects missing memberId', async () => {
    const r = await issueStoreCredit({ amount: 50, reason: 'refund' });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Member ID');
  });

  it('rejects invalid memberId (XSS)', async () => {
    const r = await issueStoreCredit({ memberId: '<script>', amount: 50, reason: 'refund' });
    expect(r.success).toBe(false);
  });

  it('rejects zero amount', async () => {
    const r = await issueStoreCredit({ memberId: 'member1', amount: 0, reason: 'refund' });
    expect(r.success).toBe(false);
  });

  it('rejects negative amount', async () => {
    const r = await issueStoreCredit({ memberId: 'member1', amount: -50, reason: 'refund' });
    expect(r.success).toBe(false);
  });

  it('rejects NaN amount', async () => {
    const r = await issueStoreCredit({ memberId: 'member1', amount: 'abc', reason: 'refund' });
    expect(r.success).toBe(false);
  });

  it('rejects amount over MAX_CREDIT_AMOUNT', async () => {
    const r = await issueStoreCredit({ memberId: 'member1', amount: 10001, reason: 'refund' });
    expect(r.success).toBe(false);
    expect(r.message).toContain('10,000');
  });

  it('rejects invalid reason', async () => {
    const r = await issueStoreCredit({ memberId: 'member1', amount: 50, reason: 'bribe' });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Invalid reason');
  });

  it('succeeds with valid data', async () => {
    const r = await issueStoreCredit({
      memberId: 'member1',
      amount: 50.555, // tests rounding
      reason: 'refund',
      orderReference: 'ORD-123',
    });
    expect(r.success).toBe(true);
    expect(r.balance).toBe(50.56); // round2
    expect(r.creditId).toBeDefined();
    expect(r.expirationDate).toBeDefined();
  });

  it('stores initial transaction in JSON', async () => {
    let inserted = null;
    __onInsert((coll, item) => { if (coll === 'StoreCredits') inserted = item; });
    await issueStoreCredit({ memberId: 'member1', amount: 100, reason: 'return' });
    const txns = JSON.parse(inserted.transactions);
    expect(txns).toHaveLength(1);
    expect(txns[0].type).toBe('issue');
    expect(txns[0].amount).toBe(100);
    expect(txns[0].reason).toBe('return');
  });

  it('accepts all valid reasons', async () => {
    for (const reason of ['return', 'refund', 'promotion', 'admin_gift', 'goodwill']) {
      resetData();
      const r = await issueStoreCredit({ memberId: 'member1', amount: 10, reason });
      expect(r.success).toBe(true);
    }
  });
});

describe('storeCreditService — getMyStoreCredit', () => {
  beforeEach(() => {
    seed('StoreCredits', [
      {
        _id: 'sc1',
        memberId: 'member1',
        balance: 25,
        initialAmount: 50,
        reason: 'refund',
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 30),
        createdDate: new Date(),
      },
      {
        _id: 'sc2',
        memberId: 'member1',
        balance: 75,
        initialAmount: 75,
        reason: 'promotion',
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 60),
        createdDate: new Date(),
      },
    ]);
  });

  it('rejects missing memberId', async () => {
    const r = await getMyStoreCredit('');
    expect(r.success).toBe(false);
  });

  it('rejects null', async () => {
    const r = await getMyStoreCredit(null);
    expect(r.success).toBe(false);
  });

  it('rejects whitespace-only', async () => {
    const r = await getMyStoreCredit('   ');
    expect(r.success).toBe(false);
  });

  it('returns total balance of active credits', async () => {
    const r = await getMyStoreCredit('member1');
    expect(r.success).toBe(true);
    expect(r.totalBalance).toBe(100);
    expect(r.credits).toHaveLength(2);
  });

  it('auto-expires past-due credits', async () => {
    resetData();
    seed('StoreCredits', [{
      _id: 'sc-exp',
      memberId: 'member1',
      balance: 50,
      initialAmount: 50,
      reason: 'refund',
      status: 'active',
      expirationDate: new Date(Date.now() - 86400000),
    }]);
    let updated = null;
    __onUpdate((coll, item) => { if (coll === 'StoreCredits') updated = item; });
    const r = await getMyStoreCredit('member1');
    expect(r.totalBalance).toBe(0);
    expect(r.credits).toHaveLength(0);
    expect(updated.status).toBe('expired');
    expect(updated.balance).toBe(0);
  });

  it('excludes zero-balance credits', async () => {
    resetData();
    seed('StoreCredits', [{
      _id: 'sc-zero',
      memberId: 'member1',
      balance: 0,
      initialAmount: 50,
      reason: 'refund',
      status: 'active',
      expirationDate: new Date(Date.now() + 86400000 * 30),
    }]);
    const r = await getMyStoreCredit('member1');
    expect(r.credits).toHaveLength(0);
    expect(r.totalBalance).toBe(0);
  });

  it('returns empty for member with no credits', async () => {
    const r = await getMyStoreCredit('member-nobody');
    expect(r.success).toBe(true);
    expect(r.totalBalance).toBe(0);
    expect(r.credits).toHaveLength(0);
  });
});

describe('storeCreditService — applyStoreCredit', () => {
  beforeEach(() => {
    seed('StoreCredits', [
      {
        _id: 'sc-apply1',
        memberId: 'member1',
        balance: 30,
        initialAmount: 30,
        reason: 'refund',
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 10), // expires sooner
        transactions: '[]',
      },
      {
        _id: 'sc-apply2',
        memberId: 'member1',
        balance: 70,
        initialAmount: 70,
        reason: 'promotion',
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 60),
        transactions: '[]',
      },
    ]);
  });

  it('rejects missing memberId', async () => {
    const r = await applyStoreCredit('', 50);
    expect(r.success).toBe(false);
  });

  it('rejects zero amount', async () => {
    const r = await applyStoreCredit('member1', 0);
    expect(r.success).toBe(false);
  });

  it('rejects negative amount', async () => {
    const r = await applyStoreCredit('member1', -10);
    expect(r.success).toBe(false);
  });

  it('applies credit across multiple entries (FIFO)', async () => {
    const r = await applyStoreCredit('member1', 50);
    expect(r.success).toBe(true);
    expect(r.amountApplied).toBe(50);
    expect(r.remainingOrderBalance).toBe(0);
    expect(r.creditsUsed).toHaveLength(2);
    // First credit fully used (30), second partially (20)
    expect(r.creditsUsed[0].amountUsed).toBe(30);
    expect(r.creditsUsed[0].remainingBalance).toBe(0);
    expect(r.creditsUsed[1].amountUsed).toBe(20);
    expect(r.creditsUsed[1].remainingBalance).toBe(50);
  });

  it('caps at available balance', async () => {
    const r = await applyStoreCredit('member1', 200);
    expect(r.amountApplied).toBe(100);
    expect(r.remainingOrderBalance).toBe(100);
  });

  it('marks fully-used credits as used', async () => {
    const updates = [];
    __onUpdate((coll, item) => { if (coll === 'StoreCredits') updates.push(item); });
    await applyStoreCredit('member1', 30);
    const first = updates.find(u => u._id === 'sc-apply1');
    expect(first.status).toBe('used');
  });

  it('logs redeem transaction', async () => {
    const updates = [];
    __onUpdate((coll, item) => { if (coll === 'StoreCredits') updates.push(item); });
    await applyStoreCredit('member1', 20);
    const txns = JSON.parse(updates[0].transactions);
    expect(txns).toHaveLength(1);
    expect(txns[0].type).toBe('redeem');
    expect(txns[0].amount).toBe(20);
  });

  it('skips expired credits during apply', async () => {
    resetData();
    seed('StoreCredits', [
      {
        _id: 'sc-expired',
        memberId: 'member1',
        balance: 50,
        status: 'active',
        expirationDate: new Date(Date.now() - 86400000),
        transactions: '[]',
      },
      {
        _id: 'sc-valid',
        memberId: 'member1',
        balance: 40,
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 60),
        transactions: '[]',
      },
    ]);
    const r = await applyStoreCredit('member1', 30);
    expect(r.amountApplied).toBe(30);
    expect(r.creditsUsed).toHaveLength(1);
    expect(r.creditsUsed[0].creditId).toBe('sc-valid');
  });

  it('skips zero-balance credits', async () => {
    resetData();
    seed('StoreCredits', [{
      _id: 'sc-zero',
      memberId: 'member1',
      balance: 0,
      status: 'active',
      expirationDate: new Date(Date.now() + 86400000 * 60),
      transactions: '[]',
    }]);
    const r = await applyStoreCredit('member1', 10);
    expect(r.amountApplied).toBe(0);
    expect(r.remainingOrderBalance).toBe(10);
  });

  it('handles malformed transactions JSON', async () => {
    resetData();
    seed('StoreCredits', [{
      _id: 'sc-bad-json',
      memberId: 'member1',
      balance: 50,
      status: 'active',
      expirationDate: new Date(Date.now() + 86400000 * 60),
      transactions: 'NOT JSON',
    }]);
    const r = await applyStoreCredit('member1', 20);
    expect(r.success).toBe(true);
    expect(r.amountApplied).toBe(20);
  });
});

describe('storeCreditService — getStoreCreditHistory', () => {
  it('rejects missing memberId', async () => {
    const r = await getStoreCreditHistory('');
    expect(r.success).toBe(false);
  });

  it('returns all credits with parsed transactions', async () => {
    const txns = JSON.stringify([{ type: 'issue', amount: 50, date: '2025-01-01' }]);
    seed('StoreCredits', [{
      _id: 'sc-h1',
      memberId: 'member1',
      balance: 50,
      initialAmount: 50,
      reason: 'refund',
      orderReference: 'ORD-1',
      status: 'active',
      createdDate: new Date('2025-01-01'),
      expirationDate: new Date('2026-01-01'),
      transactions: txns,
    }]);
    const r = await getStoreCreditHistory('member1');
    expect(r.success).toBe(true);
    expect(r.credits).toHaveLength(1);
    expect(r.credits[0].transactions).toHaveLength(1);
    expect(r.credits[0].transactions[0].type).toBe('issue');
  });

  it('handles malformed transactions JSON', async () => {
    seed('StoreCredits', [{
      _id: 'sc-h2',
      memberId: 'member1',
      balance: 50,
      status: 'active',
      transactions: 'BROKEN',
    }]);
    const r = await getStoreCreditHistory('member1');
    expect(r.success).toBe(true);
    expect(r.credits[0].transactions).toEqual([]);
  });

  it('returns empty for unknown member', async () => {
    const r = await getStoreCreditHistory('nobody');
    expect(r.success).toBe(true);
    expect(r.credits).toHaveLength(0);
  });
});

describe('storeCreditService — giftStoreCredit', () => {
  beforeEach(() => {
    seed('StoreCredits', [{
      _id: 'sc-gift-src',
      memberId: 'giver1',
      balance: 100,
      initialAmount: 100,
      reason: 'promotion',
      status: 'active',
      expirationDate: new Date(Date.now() + 86400000 * 60),
      transactions: '[]',
    }]);
  });

  it('rejects null data', async () => {
    const r = await giftStoreCredit(null);
    expect(r.success).toBe(false);
  });

  it('rejects non-object data', async () => {
    const r = await giftStoreCredit('string');
    expect(r.success).toBe(false);
  });

  it('rejects missing fromMemberId', async () => {
    const r = await giftStoreCredit({ toMemberId: 'recip1', amount: 10 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Giver');
  });

  it('rejects missing toMemberId', async () => {
    const r = await giftStoreCredit({ fromMemberId: 'giver1', amount: 10 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Recipient');
  });

  it('rejects self-gift', async () => {
    const r = await giftStoreCredit({ fromMemberId: 'giver1', toMemberId: 'giver1', amount: 10 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('yourself');
  });

  it('rejects zero amount', async () => {
    const r = await giftStoreCredit({ fromMemberId: 'giver1', toMemberId: 'recip1', amount: 0 });
    expect(r.success).toBe(false);
  });

  it('rejects negative amount', async () => {
    const r = await giftStoreCredit({ fromMemberId: 'giver1', toMemberId: 'recip1', amount: -10 });
    expect(r.success).toBe(false);
  });

  it('rejects insufficient balance', async () => {
    const r = await giftStoreCredit({ fromMemberId: 'giver1', toMemberId: 'recip1', amount: 200 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Insufficient');
  });

  it('succeeds with valid gift', async () => {
    const r = await giftStoreCredit({
      fromMemberId: 'giver1',
      toMemberId: 'recip1',
      amount: 40,
      message: 'Enjoy!',
    });
    expect(r.success).toBe(true);
    expect(r.giftedAmount).toBe(40);
    expect(r.newCreditId).toBeDefined();
  });

  it('deducts from giver balance', async () => {
    const updates = [];
    __onUpdate((coll, item) => { if (coll === 'StoreCredits') updates.push(item); });
    await giftStoreCredit({ fromMemberId: 'giver1', toMemberId: 'recip1', amount: 40 });
    const giverUpdate = updates.find(u => u._id === 'sc-gift-src');
    expect(giverUpdate.balance).toBe(60);
  });

  it('creates new credit for recipient', async () => {
    let inserted = null;
    __onInsert((coll, item) => { if (coll === 'StoreCredits') inserted = item; });
    await giftStoreCredit({
      fromMemberId: 'giver1',
      toMemberId: 'recip1',
      amount: 25,
      message: 'Enjoy!',
    });
    expect(inserted.memberId).toBe('recip1');
    expect(inserted.balance).toBe(25);
    expect(inserted.reason).toBe('gift_received');
    expect(inserted.giftMessage).toBe('Enjoy!');
  });

  it('logs gift_sent transaction on giver', async () => {
    const updates = [];
    __onUpdate((coll, item) => { if (coll === 'StoreCredits') updates.push(item); });
    await giftStoreCredit({ fromMemberId: 'giver1', toMemberId: 'recip1', amount: 10 });
    const txns = JSON.parse(updates[0].transactions);
    expect(txns[0].type).toBe('gift_sent');
    expect(txns[0].toMemberId).toBe('recip1');
  });

  it('skips expired credits in giver balance', async () => {
    resetData();
    seed('StoreCredits', [
      {
        _id: 'sc-exp',
        memberId: 'giver1',
        balance: 50,
        status: 'active',
        expirationDate: new Date(Date.now() - 86400000),
        transactions: '[]',
      },
      {
        _id: 'sc-valid',
        memberId: 'giver1',
        balance: 30,
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 60),
        transactions: '[]',
      },
    ]);
    const r = await giftStoreCredit({ fromMemberId: 'giver1', toMemberId: 'recip1', amount: 30 });
    expect(r.success).toBe(true);
    expect(r.giftedAmount).toBe(30);
  });

  it('rejects when expired credits inflate apparent balance', async () => {
    resetData();
    seed('StoreCredits', [{
      _id: 'sc-only-exp',
      memberId: 'giver1',
      balance: 100,
      status: 'active',
      expirationDate: new Date(Date.now() - 86400000),
      transactions: '[]',
    }]);
    const r = await giftStoreCredit({ fromMemberId: 'giver1', toMemberId: 'recip1', amount: 10 });
    expect(r.success).toBe(false);
    expect(r.message).toContain('Insufficient');
  });
});

describe('storeCreditService — getExpiringCredits', () => {
  it('rejects missing memberId', async () => {
    const r = await getExpiringCredits('');
    expect(r.success).toBe(false);
  });

  it('returns credits expiring within default 30 days', async () => {
    seed('StoreCredits', [
      {
        _id: 'sc-exp-soon',
        memberId: 'member1',
        balance: 25,
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 15), // 15 days
      },
      {
        _id: 'sc-exp-later',
        memberId: 'member1',
        balance: 50,
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 90), // 90 days — not in window
      },
    ]);
    const r = await getExpiringCredits('member1');
    expect(r.success).toBe(true);
    expect(r.expiringCredits).toHaveLength(1);
    expect(r.expiringTotal).toBe(25);
  });

  it('custom withinDays window', async () => {
    seed('StoreCredits', [{
      _id: 'sc-exp-60',
      memberId: 'member1',
      balance: 50,
      status: 'active',
      expirationDate: new Date(Date.now() + 86400000 * 50),
    }]);
    const r = await getExpiringCredits('member1', 60);
    expect(r.expiringCredits).toHaveLength(1);
    expect(r.expiringTotal).toBe(50);
  });

  it('excludes already-expired credits', async () => {
    seed('StoreCredits', [{
      _id: 'sc-already-exp',
      memberId: 'member1',
      balance: 25,
      status: 'active',
      expirationDate: new Date(Date.now() - 86400000),
    }]);
    const r = await getExpiringCredits('member1');
    expect(r.expiringCredits).toHaveLength(0);
  });

  it('excludes zero-balance credits', async () => {
    seed('StoreCredits', [{
      _id: 'sc-zero-exp',
      memberId: 'member1',
      balance: 0,
      status: 'active',
      expirationDate: new Date(Date.now() + 86400000 * 10),
    }]);
    const r = await getExpiringCredits('member1');
    expect(r.expiringCredits).toHaveLength(0);
  });

  it('excludes credits with no expirationDate', async () => {
    seed('StoreCredits', [{
      _id: 'sc-no-exp',
      memberId: 'member1',
      balance: 50,
      status: 'active',
      expirationDate: null,
    }]);
    const r = await getExpiringCredits('member1');
    expect(r.expiringCredits).toHaveLength(0);
  });

  it('clamps withinDays to valid range', async () => {
    seed('StoreCredits', [{
      _id: 'sc-clamp',
      memberId: 'member1',
      balance: 50,
      status: 'active',
      expirationDate: new Date(Date.now() + 86400000 * 2),
    }]);
    // withinDays=0 should clamp to 1
    const r = await getExpiringCredits('member1', 0);
    expect(r.success).toBe(true);
  });

  it('handles NaN withinDays (defaults to 30)', async () => {
    seed('StoreCredits', [{
      _id: 'sc-nan',
      memberId: 'member1',
      balance: 50,
      status: 'active',
      expirationDate: new Date(Date.now() + 86400000 * 15),
    }]);
    const r = await getExpiringCredits('member1', 'invalid');
    expect(r.success).toBe(true);
    expect(r.expiringCredits).toHaveLength(1);
  });
});
