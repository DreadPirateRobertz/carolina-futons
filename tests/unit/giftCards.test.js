import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset } from '../__mocks__/wix-data.js';
import {
  __getEmailLog,
  __reset as __resetCrm,
  __failNextEmail,
} from '../__mocks__/wix-crm-backend.js';
import {
  purchaseGiftCard,
  checkBalance,
  redeemGiftCard,
  getGiftCardOptions,
  _sendGiftCardEmails as sendGiftCardEmails,
  getMyGiftCards,
} from '../../src/backend/giftCards.web.js';

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

  it('allows self-gift (purchaser === recipient)', async () => {
    const result = await purchaseGiftCard({
      amount: 50,
      purchaserEmail: 'me@test.com',
      recipientEmail: 'me@test.com',
      recipientName: 'Me',
      message: 'Treat yourself!',
    });
    expect(result.success).toBe(true);
    expect(result.code).toBeDefined();
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

  it('rejects negative amount', async () => {
    const result = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', -50);
    expect(result.success).toBe(false);
  });

  it('rejects NaN amount', async () => {
    const result = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 'not-a-number');
    expect(result.success).toBe(false);
  });

  it('rejects Infinity amount', async () => {
    const result = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', Infinity);
    expect(result.success).toBe(false);
  });

  it('prevents balance from going negative after redemption', async () => {
    const result = await redeemGiftCard('CF-AAAA-BBBB-CCCC-DDDD', 999999);
    expect(result.success).toBe(true);
    expect(result.remainingBalance).toBe(0);
    expect(result.amountApplied).toBe(100);
  });

  it('rejects redemption on zero-balance card', async () => {
    __seed('GiftCards', [{
      _id: 'gc-zero',
      code: 'CF-ZERO-ZERO-ZERO-ZERO',
      balance: 0,
      initialAmount: 100,
      status: 'active',
      expirationDate: new Date(Date.now() + 86400000 * 30).toISOString(),
    }]);
    const result = await redeemGiftCard('CF-ZERO-ZERO-ZERO-ZERO', 10);
    expect(result.success).toBe(false);
    expect(result.message).toContain('no remaining balance');
  });

  it('rejects redemption on expired card', async () => {
    __seed('GiftCards', [{
      _id: 'gc-exp',
      code: 'CF-EXPI-REDD-CARD-HERE',
      balance: 50,
      initialAmount: 50,
      status: 'active',
      expirationDate: new Date(Date.now() - 86400000).toISOString(),
    }]);
    const result = await redeemGiftCard('CF-EXPI-REDD-CARD-HERE', 25);
    expect(result.success).toBe(false);
    expect(result.message).toContain('expired');
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

// ── sendGiftCardEmails ──────────────────────────────────────────────

describe('sendGiftCardEmails', () => {
  beforeEach(() => {
    __resetCrm();
  });

  it('sends confirmation to purchaser and notification to recipient', async () => {
    const result = await sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 100,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'friend@test.com',
      recipientName: 'Friend',
      message: 'Happy birthday!',
      expirationDate: '2027-03-07T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
    const log = __getEmailLog();
    expect(log).toHaveLength(2);
    expect(log[0].templateId).toBe('gift_card_purchase_confirmation');
    expect(log[1].templateId).toBe('gift_card_received');
  });

  it('includes correct template variables for recipient', async () => {
    await sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 50,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'friend@test.com',
      recipientName: 'Jane',
      message: 'Enjoy!',
      expirationDate: '2027-06-01T00:00:00.000Z',
    });
    const log = __getEmailLog();
    const recipientEmail = log[1];
    expect(recipientEmail.options.variables.code).toBe('CF-AAAA-BBBB-CCCC-DDDD');
    expect(recipientEmail.options.variables.amount).toBe('$50.00');
    expect(recipientEmail.options.variables.recipientName).toBe('Jane');
    expect(recipientEmail.options.variables.message).toBe('Enjoy!');
  });

  it('handles missing optional fields gracefully', async () => {
    const result = await sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 25,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'friend@test.com',
    });
    expect(result.success).toBe(true);
    const log = __getEmailLog();
    expect(log).toHaveLength(2);
    expect(log[1].options.variables.recipientName).toBe('');
    expect(log[1].options.variables.message).toBe('');
  });

  it('still sends recipient email when purchaser email fails', async () => {
    __failNextEmail(); // first email (purchaser) will fail
    const result = await sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 100,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'friend@test.com',
    });
    expect(result.success).toBe(true); // at least one sent
    expect(result.purchaserSent).toBe(false);
    expect(result.recipientSent).toBe(true);
    const log = __getEmailLog();
    expect(log).toHaveLength(1);
    expect(log[0].templateId).toBe('gift_card_received');
  });

  it('returns both sent flags when all succeed', async () => {
    const result = await sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 50,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'friend@test.com',
    });
    expect(result.purchaserSent).toBe(true);
    expect(result.recipientSent).toBe(true);
  });

  it('rejects missing required fields', async () => {
    const result = await sendGiftCardEmails({});
    expect(result.success).toBe(false);
  });

  it('rejects null input', async () => {
    const result = await sendGiftCardEmails(null);
    expect(result.success).toBe(false);
  });

  it('maps correct template to correct contact', async () => {
    await sendGiftCardEmails({
      code: 'CF-AAAA-BBBB-CCCC-DDDD',
      amount: 100,
      purchaserEmail: 'buyer@test.com',
      recipientEmail: 'friend@test.com',
      recipientName: 'Jane',
    });
    const log = __getEmailLog();
    // Purchaser email should NOT contain personal message
    expect(log[0].templateId).toBe('gift_card_purchase_confirmation');
    expect(log[0].options.variables.recipientName).toBe('Jane');
    // Recipient email should contain the code
    expect(log[1].templateId).toBe('gift_card_received');
    expect(log[1].options.variables.code).toBe('CF-AAAA-BBBB-CCCC-DDDD');
    // Contacts should be different
    expect(log[0].contactId).not.toBe(log[1].contactId);
  });
});

// ── getMyGiftCards ──────────────────────────────────────────────────

describe('getMyGiftCards', () => {
  beforeEach(() => {
    __seed('GiftCards', [
      {
        _id: 'gc-bought',
        code: 'CF-AAAA-BBBB-CCCC-DDDD',
        balance: 75,
        initialAmount: 100,
        purchaserEmail: 'me@test.com',
        recipientEmail: 'friend@test.com',
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 30).toISOString(),
      },
      {
        _id: 'gc-received',
        code: 'CF-XXXX-YYYY-ZZZZ-WWWW',
        balance: 50,
        initialAmount: 50,
        purchaserEmail: 'someone@test.com',
        recipientEmail: 'me@test.com',
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 60).toISOString(),
      },
      {
        _id: 'gc-other',
        code: 'CF-NOPE-NOPE-NOPE-NOPE',
        balance: 200,
        initialAmount: 200,
        purchaserEmail: 'other@test.com',
        recipientEmail: 'other2@test.com',
        status: 'active',
        expirationDate: new Date(Date.now() + 86400000 * 90).toISOString(),
      },
    ]);
  });

  it('returns purchased and received cards for email', async () => {
    const result = await getMyGiftCards('me@test.com');
    expect(result.success).toBe(true);
    expect(result.purchased).toHaveLength(1);
    expect(result.received).toHaveLength(1);
    expect(result.purchased[0].maskedCode).toBe('CF-****-****-****-DDDD');
    expect(result.received[0].maskedCode).toBe('CF-****-****-****-WWWW');
  });

  it('does not leak full gift card codes to frontend', async () => {
    const result = await getMyGiftCards('me@test.com');
    expect(result.purchased[0].code).toBeUndefined();
    expect(result.received[0].code).toBeUndefined();
    expect(result.purchased[0].purchaserEmail).toBeUndefined();
    expect(result.purchased[0].recipientEmail).toBeUndefined();
  });

  it('returns empty arrays when no cards found', async () => {
    const result = await getMyGiftCards('nobody@test.com');
    expect(result.success).toBe(true);
    expect(result.purchased).toHaveLength(0);
    expect(result.received).toHaveLength(0);
  });

  it('rejects missing email', async () => {
    const result = await getMyGiftCards(null);
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', async () => {
    const result = await getMyGiftCards('not-an-email');
    expect(result.success).toBe(false);
  });

  it('is case-insensitive on email', async () => {
    const result = await getMyGiftCards('ME@TEST.COM');
    expect(result.success).toBe(true);
    expect(result.purchased).toHaveLength(1);
    expect(result.received).toHaveLength(1);
  });

  it('strips internal wixData fields from results', async () => {
    const result = await getMyGiftCards('me@test.com');
    const card = result.purchased[0];
    expect(card._id).toBeDefined();
    expect(card.balance).toBeDefined();
    expect(card.initialAmount).toBeDefined();
    expect(card.status).toBeDefined();
    expect(card.maskedCode).toBeDefined();
    // Internal fields should be stripped
    expect(card.message).toBeUndefined();
    expect(card.recipientName).toBeUndefined();
  });
});
