import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __reset, __onInsert, __onUpdate } from './__mocks__/wix-data.js';

vi.mock('wix-crm-backend', () => ({
  triggeredEmails: { emailContact: vi.fn(async () => ({})) },
  contacts: { queryContacts: vi.fn() },
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async (key) => {
    if (key === 'WELCOME_DISCOUNT_CODE') return 'WELCOME10';
    if (key === 'RECOVERY_DISCOUNT_CODE') return 'RECOVER15';
    if (key === 'REVIEW_DISCOUNT_CODE') return 'REVIEW10';
    return '';
  }),
}));

import { triggeredEmails } from 'wix-crm-backend';
import { getSecret } from 'wix-secrets-backend';

import {
  triggerWelcomeSequence, triggerPostPurchaseSequence,
  triggerAbandonedCartRecovery, triggerReengagement,
  processEmailQueue, unsubscribeContact,
  getEmailAutomationStats, recordEmailEvent, getEmailEvents,
  triggerRestockNotifications, triggerReviewThanks,
  wixMembers_onMemberCreated, wixEcom_onOrderCreated, wixEcom_onOrderCanceled,
} from '../src/backend/emailAutomation.web.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
  __seed('EmailQueue', []);
  __seed('Unsubscribes', []);
  __seed('AbandonedCarts', []);
  __seed('EmailEvents', []);
  __seed('BackInStockSignups', []);
});

// ── 1. processEmailQueue retry logic ─────────────────────────────────

describe('processEmailQueue retry logic', () => {
  it('attempt 1 failure: stays pending with 15min backoff', async () => {
    triggeredEmails.emailContact.mockRejectedValueOnce(new Error('Timeout'));
    const now = new Date();
    __seed('EmailQueue', [{
      _id: 'q1', templateId: 'welcome_series_1', recipientEmail: 'a@b.com',
      recipientContactId: 'c1', variables: {}, sequenceType: 'welcome',
      sequenceStep: 1, status: 'pending', scheduledFor: new Date(now - 1000),
      attempt: 0, lastError: '',
    }]);

    const updates = [];
    __onUpdate((col, item) => { if (col === 'EmailQueue') updates.push(item); });

    const res = await processEmailQueue();
    expect(res.failed).toBe(1);
    expect(updates.length).toBe(1);
    expect(updates[0].status).toBe('pending');
    expect(updates[0].attempt).toBe(1);
    expect(updates[0].lastError).toBe('Timeout');
    // 15 min backoff
    expect(updates[0].scheduledFor.getTime()).toBeGreaterThan(now.getTime());
    expect(updates[0].scheduledFor.getTime()).toBeLessThanOrEqual(now.getTime() + 16 * 60 * 1000);
  });

  it('attempt 2 failure: stays pending with 1hr backoff', async () => {
    triggeredEmails.emailContact.mockRejectedValueOnce(new Error('Timeout'));
    const now = new Date();
    __seed('EmailQueue', [{
      _id: 'q2', templateId: 'welcome_series_1', recipientEmail: 'a@b.com',
      recipientContactId: 'c1', variables: {}, sequenceType: 'welcome',
      sequenceStep: 1, status: 'pending', scheduledFor: new Date(now - 1000),
      attempt: 1, lastError: 'Timeout',
    }]);

    const updates = [];
    __onUpdate((col, item) => { if (col === 'EmailQueue') updates.push(item); });

    await processEmailQueue();
    expect(updates[0].status).toBe('pending');
    expect(updates[0].attempt).toBe(2);
    // 1hr backoff
    expect(updates[0].scheduledFor.getTime()).toBeGreaterThan(now.getTime() + 59 * 60 * 1000);
  });

  it('attempt 3 failure: transitions to failed permanently', async () => {
    triggeredEmails.emailContact.mockRejectedValueOnce(new Error('Permanent'));
    const now = new Date();
    __seed('EmailQueue', [{
      _id: 'q3', templateId: 'welcome_series_1', recipientEmail: 'a@b.com',
      recipientContactId: 'c1', variables: {}, sequenceType: 'welcome',
      sequenceStep: 1, status: 'pending', scheduledFor: new Date(now - 1000),
      attempt: 2, lastError: '',
    }]);

    const updates = [];
    __onUpdate((col, item) => { if (col === 'EmailQueue') updates.push(item); });

    const res = await processEmailQueue();
    expect(res.failed).toBe(1);
    expect(updates[0].status).toBe('failed');
    expect(updates[0].attempt).toBe(3);
  });
});

// ── 2. processEmailQueue cart recovery check ─────────────────────────

describe('processEmailQueue cart recovery cancellation', () => {
  it('cancels cart_recovery email when cart status is recovered', async () => {
    const now = new Date();
    __seed('EmailQueue', [{
      _id: 'qcr1', templateId: 'cart_recovery_2', recipientEmail: 'buyer@x.com',
      recipientContactId: '', variables: { checkoutId: 'chk-99' },
      sequenceType: 'cart_recovery', sequenceStep: 2, status: 'pending',
      scheduledFor: new Date(now - 1000), attempt: 0, lastError: '',
    }]);
    __seed('AbandonedCarts', [{
      _id: 'ac1', checkoutId: 'chk-99', status: 'recovered',
    }]);

    const updates = [];
    __onUpdate((col, item) => { if (col === 'EmailQueue') updates.push(item); });

    const res = await processEmailQueue();
    expect(res.cancelled).toBe(1);
    expect(updates[0].status).toBe('cancelled');
    expect(updates[0].lastError).toBe('Cart recovered before send');
  });

  it('sends cart_recovery email when cart is still abandoned', async () => {
    const now = new Date();
    __seed('EmailQueue', [{
      _id: 'qcr2', templateId: 'cart_recovery_1', recipientEmail: 'buyer@x.com',
      recipientContactId: 'c5', variables: { checkoutId: 'chk-100' },
      sequenceType: 'cart_recovery', sequenceStep: 1, status: 'pending',
      scheduledFor: new Date(now - 1000), attempt: 0, lastError: '',
    }]);
    __seed('AbandonedCarts', [{
      _id: 'ac2', checkoutId: 'chk-100', status: 'abandoned',
    }]);

    const res = await processEmailQueue();
    expect(res.sent).toBe(1);
  });
});

// ── 3. processEmailQueue no contactId ────────────────────────────────

describe('processEmailQueue no contactId', () => {
  it('increments attempt and sets lastError when contactId is missing', async () => {
    const now = new Date();
    __seed('EmailQueue', [{
      _id: 'qnc1', templateId: 'welcome_series_1', recipientEmail: 'a@b.com',
      recipientContactId: '', variables: {}, sequenceType: 'welcome',
      sequenceStep: 1, status: 'pending', scheduledFor: new Date(now - 1000),
      attempt: 0, lastError: '',
    }]);

    const updates = [];
    __onUpdate((col, item) => { if (col === 'EmailQueue') updates.push(item); });

    const res = await processEmailQueue();
    expect(res.failed).toBe(1);
    expect(updates[0].attempt).toBe(1);
    expect(updates[0].lastError).toBe('No contact ID for recipient');
  });
});

// ── 4. triggerAbandonedCartRecovery edge cases ───────────────────────

describe('triggerAbandonedCartRecovery edge cases', () => {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  it('produces empty itemSummary for malformed lineItems JSON', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-mal', checkoutId: 'chk-mal', status: 'abandoned',
      recoveryEmailSent: false, abandonedAt: twoHoursAgo,
      buyerEmail: 'valid@test.com', buyerName: 'Jo',
      cartTotal: 100, lineItems: '{broken json',
    }]);

    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    const res = await triggerAbandonedCartRecovery();
    expect(res.cartsProcessed).toBe(1);
    // All 3 steps queued, each with empty itemSummary
    expect(inserts.length).toBe(3);
    expect(inserts[0].variables.itemSummary).toBe('');
  });

  it('skips carts with invalid email', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-bad', checkoutId: 'chk-bad', status: 'abandoned',
      recoveryEmailSent: false, abandonedAt: twoHoursAgo,
      buyerEmail: 'not-an-email', buyerName: 'Jo', cartTotal: 50,
      lineItems: '[]',
    }]);

    const res = await triggerAbandonedCartRecovery();
    expect(res.cartsProcessed).toBe(0);
  });

  it('skips carts with empty email', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-noe', checkoutId: 'chk-noe', status: 'abandoned',
      recoveryEmailSent: false, abandonedAt: twoHoursAgo,
      buyerEmail: '', cartTotal: 50, lineItems: '[]',
    }]);

    const res = await triggerAbandonedCartRecovery();
    expect(res.cartsProcessed).toBe(0);
  });

  it('deduplicates by checkoutId — skips already-queued cart', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-dup', checkoutId: 'chk-dup', status: 'abandoned',
      recoveryEmailSent: false, abandonedAt: twoHoursAgo,
      buyerEmail: 'buyer@test.com', buyerName: 'Dup', cartTotal: 200,
      lineItems: '[]',
    }]);
    __seed('EmailQueue', [{
      _id: 'eq-dup', recipientEmail: 'buyer@test.com',
      sequenceType: 'cart_recovery', checkoutId: 'chk-dup',
      status: 'pending',
    }]);

    const res = await triggerAbandonedCartRecovery();
    expect(res.cartsProcessed).toBe(0);
  });
});

// ── 5. triggerReengagement skips ─────────────────────────────────────

describe('triggerReengagement skips', () => {
  const longAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);

  it('skips contacts already sent reengagement', async () => {
    __seed('EmailQueue', [
      {
        _id: 'pp1', recipientEmail: 'old@buyer.com', recipientContactId: 'c10',
        sequenceType: 'post_purchase', sequenceStep: 1, status: 'sent',
        sentAt: longAgo, variables: { firstName: 'Old' },
      },
      {
        _id: 're1', recipientEmail: 'old@buyer.com',
        sequenceType: 'reengagement', sequenceStep: 1, status: 'sent',
      },
    ]);

    const res = await triggerReengagement();
    expect(res.contacted).toBe(0);
  });

  it('skips unsubscribed contacts', async () => {
    __seed('EmailQueue', [{
      _id: 'pp2', recipientEmail: 'unsub@buyer.com', recipientContactId: 'c11',
      sequenceType: 'post_purchase', sequenceStep: 1, status: 'sent',
      sentAt: longAgo, variables: { firstName: 'Unsub' },
    }]);
    __seed('Unsubscribes', [{
      _id: 'u1', email: 'unsub@buyer.com', sequenceType: 'reengagement',
    }]);

    const res = await triggerReengagement();
    expect(res.contacted).toBe(0);
  });

  it('queues reengagement for eligible dormant contact', async () => {
    __seed('EmailQueue', [{
      _id: 'pp3', recipientEmail: 'eligible@buyer.com', recipientContactId: 'c12',
      sequenceType: 'post_purchase', sequenceStep: 1, status: 'sent',
      sentAt: longAgo, variables: { firstName: 'Eli' },
    }]);

    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    const res = await triggerReengagement();
    expect(res.contacted).toBe(1);
    expect(inserts[0].sequenceType).toBe('reengagement');
    expect(inserts[0].templateId).toBe('reengagement_1');
  });
});

// ── 6. unsubscribeContact specifics ──────────────────────────────────

describe('unsubscribeContact type-specific cancellation', () => {
  it('"all" cancels all pending emails for recipient', async () => {
    __seed('EmailQueue', [
      { _id: 'e1', recipientEmail: 'u@x.com', sequenceType: 'welcome', status: 'pending' },
      { _id: 'e2', recipientEmail: 'u@x.com', sequenceType: 'cart_recovery', status: 'pending' },
      { _id: 'e3', recipientEmail: 'u@x.com', sequenceType: 'post_purchase', status: 'sent' },
    ]);

    const updates = [];
    __onUpdate((col, item) => { if (col === 'EmailQueue') updates.push(item); });

    const res = await unsubscribeContact('u@x.com', 'all');
    expect(res.success).toBe(true);
    // Only 2 pending items cancelled (sent one untouched)
    expect(updates.filter(u => u.status === 'cancelled').length).toBe(2);
  });

  it('specific type only cancels matching sequence pending emails', async () => {
    __seed('EmailQueue', [
      { _id: 'e4', recipientEmail: 'v@x.com', sequenceType: 'welcome', status: 'pending' },
      { _id: 'e5', recipientEmail: 'v@x.com', sequenceType: 'cart_recovery', status: 'pending' },
    ]);

    const updates = [];
    __onUpdate((col, item) => { if (col === 'EmailQueue') updates.push(item); });

    await unsubscribeContact('v@x.com', 'welcome');
    const cancelled = updates.filter(u => u.status === 'cancelled');
    expect(cancelled.length).toBe(1);
    expect(cancelled[0]._id).toBe('e4');
  });
});

// ── 7. getEmailAutomationStats edge cases ────────────────────────────

describe('getEmailAutomationStats', () => {
  it('handles unknown sequenceType in stats gracefully', async () => {
    __seed('EmailQueue', [
      { _id: 's1', sequenceType: 'restock', status: 'sent', createdAt: new Date() },
      { _id: 's2', sequenceType: 'welcome', status: 'sent', createdAt: new Date() },
    ]);

    const res = await getEmailAutomationStats();
    expect(res.stats.restock).toBeDefined();
    expect(res.stats.restock.sent).toBe(1);
    expect(res.stats.welcome.sent).toBe(1);
  });

  it('A/B results only count sent items, not pending or failed', async () => {
    __seed('EmailQueue', [
      { _id: 'ab1', sequenceType: 'welcome', abVariant: 'A', status: 'sent', createdAt: new Date() },
      { _id: 'ab2', sequenceType: 'welcome', abVariant: 'A', status: 'pending', createdAt: new Date() },
      { _id: 'ab3', sequenceType: 'welcome', abVariant: 'B', status: 'failed', createdAt: new Date() },
      { _id: 'ab4', sequenceType: 'welcome', abVariant: 'B', status: 'sent', createdAt: new Date() },
    ]);

    const res = await getEmailAutomationStats();
    expect(res.abResults.A.sent).toBe(1);
    expect(res.abResults.B.sent).toBe(1);
  });
});

// ── 8. recordEmailEvent validation ───────────────────────────────────

describe('recordEmailEvent validation', () => {
  it('rejects invalid eventType', async () => {
    const res = await recordEmailEvent({ emailQueueId: 'eq1', eventType: 'bounce' });
    expect(res.success).toBe(false);
  });

  it('rejects missing emailQueueId', async () => {
    const res = await recordEmailEvent({ eventType: 'open' });
    expect(res.success).toBe(false);
  });

  it('rejects empty params', async () => {
    const res = await recordEmailEvent({});
    expect(res.success).toBe(false);
  });

  it('accepts valid open event', async () => {
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailEvents') inserts.push(item); });

    const res = await recordEmailEvent({ emailQueueId: 'eq1', eventType: 'open' });
    expect(res.success).toBe(true);
    expect(inserts[0].eventType).toBe('open');
  });

  it('accepts valid click event with linkUrl', async () => {
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailEvents') inserts.push(item); });

    const res = await recordEmailEvent({ emailQueueId: 'eq1', eventType: 'click', linkUrl: 'https://cf.com/product' });
    expect(res.success).toBe(true);
    expect(inserts[0].linkUrl).toBe('https://cf.com/product');
  });
});

// ── 9. getEmailEvents filtering ──────────────────────────────────────

describe('getEmailEvents', () => {
  it('filters by sequenceType via cross-reference', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-w1', sequenceType: 'welcome' },
      { _id: 'eq-c1', sequenceType: 'cart_recovery' },
    ]);
    __seed('EmailEvents', [
      { _id: 'ev1', emailQueueId: 'eq-w1', eventType: 'open', timestamp: new Date() },
      { _id: 'ev2', emailQueueId: 'eq-c1', eventType: 'click', timestamp: new Date() },
      { _id: 'ev3', emailQueueId: 'eq-w1', eventType: 'click', timestamp: new Date() },
    ]);

    const res = await getEmailEvents('welcome');
    expect(res.opens).toBe(1);
    expect(res.clicks).toBe(1);
    expect(res.events.length).toBe(2);
  });

  it('returns all events when no sequenceType filter', async () => {
    __seed('EmailEvents', [
      { _id: 'ev4', emailQueueId: 'eq1', eventType: 'open', timestamp: new Date() },
      { _id: 'ev5', emailQueueId: 'eq2', eventType: 'click', timestamp: new Date() },
    ]);

    const res = await getEmailEvents();
    expect(res.opens).toBe(1);
    expect(res.clicks).toBe(1);
    expect(res.events.length).toBe(2);
  });
});

// ── 10. triggerRestockNotifications edge cases ───────────────────────

describe('triggerRestockNotifications', () => {
  it('skips subscribers with invalid email', async () => {
    const res = await triggerRestockNotifications('prod1', [
      { email: 'bad-email', productName: 'Futon' },
    ]);
    expect(res.notified).toBe(0);
  });

  it('skips unsubscribed subscribers', async () => {
    __seed('Unsubscribes', [
      { _id: 'u-r1', email: 'unsub@test.com', sequenceType: 'restock' },
    ]);

    const res = await triggerRestockNotifications('prod1', [
      { email: 'unsub@test.com', productName: 'Futon' },
    ]);
    expect(res.notified).toBe(0);
  });

  it('marks subscriber as notified when _id present', async () => {
    __seed('BackInStockSignups', [
      { _id: 'bis1', email: 'sub@test.com', productName: 'Futon', notified: false },
    ]);

    const updates = [];
    __onUpdate((col, item) => { if (col === 'BackInStockSignups') updates.push(item); });

    const res = await triggerRestockNotifications('prod1', [
      { _id: 'bis1', email: 'sub@test.com', productName: 'Futon' },
    ]);
    expect(res.notified).toBe(1);
    expect(updates[0].notified).toBe(true);
    expect(updates[0].notifiedAt).toBeDefined();
  });

  it('does not update BackInStockSignups when subscriber has no _id', async () => {
    const updates = [];
    __onUpdate((col, item) => { if (col === 'BackInStockSignups') updates.push(item); });

    const res = await triggerRestockNotifications('prod1', [
      { email: 'anon@test.com', productName: 'Futon' },
    ]);
    expect(res.notified).toBe(1);
    expect(updates.length).toBe(0);
  });

  it('counts failed subscribers individually', async () => {
    // First insert succeeds, second throws
    let insertCount = 0;
    __onInsert((col) => {
      if (col === 'EmailQueue') {
        insertCount++;
        if (insertCount === 2) throw new Error('DB write failed');
      }
    });

    const res = await triggerRestockNotifications('prod1', [
      { email: 'ok@test.com', productName: 'Futon A' },
      { email: 'fail@test.com', productName: 'Futon B' },
    ]);
    expect(res.notified).toBe(1);
    expect(res.failed).toBe(1);
  });

  it('returns early for empty/invalid inputs', async () => {
    expect((await triggerRestockNotifications('', [])).success).toBe(false);
    expect((await triggerRestockNotifications('prod1', [])).success).toBe(false);
    expect((await triggerRestockNotifications('prod1', 'not-array')).success).toBe(false);
  });
});

// ── 11. triggerReviewThanks edge cases ───────────────────────────────

describe('triggerReviewThanks', () => {
  it('still sends email when discount secret is unavailable', async () => {
    getSecret.mockRejectedValueOnce(new Error('Secret not found'));

    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    const res = await triggerReviewThanks('c1', 'rev@test.com', 'Jane', 'Modern Futon');
    expect(res.success).toBe(true);
    expect(inserts[0].variables.discountCode).toBe('');
    expect(inserts[0].variables.discountAvailable).toBe(false);
  });

  it('skips unsubscribed reviewer', async () => {
    __seed('Unsubscribes', [
      { _id: 'u-rt', email: 'unsub@rev.com', sequenceType: 'review_thanks' },
    ]);

    const res = await triggerReviewThanks('c2', 'unsub@rev.com', 'Bob', 'Chair');
    expect(res.success).toBe(false);
  });

  it('rejects invalid email', async () => {
    const res = await triggerReviewThanks('c3', 'bad-email', 'X', 'Y');
    expect(res.success).toBe(false);
  });

  it('rejects empty email', async () => {
    const res = await triggerReviewThanks('c4', '', 'X', 'Y');
    expect(res.success).toBe(false);
  });
});

// ── 12. wixMembers_onMemberCreated ───────────────────────────────────

describe('wixMembers_onMemberCreated', () => {
  it('extracts email from loginEmail', async () => {
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    await wixMembers_onMemberCreated({
      entity: {
        _id: 'm1',
        loginEmail: 'login@test.com',
        contactDetails: { firstName: 'Al' },
      },
    });
    // Allow async .catch handler to complete
    await new Promise(r => setTimeout(r, 50));
    expect(inserts.length).toBeGreaterThan(0);
    expect(inserts[0].recipientEmail).toBe('login@test.com');
  });

  it('falls back to contactDetails.emails[0]', async () => {
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    await wixMembers_onMemberCreated({
      entity: {
        _id: 'm2',
        contactDetails: { emails: ['fallback@test.com'], firstName: 'Bo' },
      },
    });
    await new Promise(r => setTimeout(r, 50));
    expect(inserts.length).toBeGreaterThan(0);
    expect(inserts[0].recipientEmail).toBe('fallback@test.com');
  });

  it('handles missing email — does nothing', async () => {
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    wixMembers_onMemberCreated({ entity: { _id: 'm3' } });
    await new Promise(r => setTimeout(r, 50));
    expect(inserts.length).toBe(0);
  });

  it('extracts firstName from profile.nickname fallback', async () => {
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    await wixMembers_onMemberCreated({
      entity: {
        _id: 'm4',
        loginEmail: 'nick@test.com',
        profile: { nickname: 'Nicky' },
      },
    });
    await new Promise(r => setTimeout(r, 50));
    expect(inserts[0].variables.firstName).toBe('Nicky');
  });
});

// ── 13. wixEcom_onOrderCreated lineItem extraction ───────────────────

describe('wixEcom_onOrderCreated', () => {
  it('extracts lineItems from .name field', async () => {
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    await wixEcom_onOrderCreated({
      entity: {
        buyerInfo: { email: 'buyer@test.com', contactId: 'c1' },
        number: 'ORD-1',
        totals: { total: 500 },
        lineItems: [{ name: 'Classic Futon', quantity: 1, price: 500 }],
      },
    });
    await new Promise(r => setTimeout(r, 50));
    expect(inserts.length).toBeGreaterThan(0);
    expect(inserts[0].variables.productNames).toContain('Classic Futon');
  });

  it('extracts lineItems from .productName.original fallback', async () => {
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    await wixEcom_onOrderCreated({
      entity: {
        buyerInfo: { email: 'buyer2@test.com', contactId: 'c2' },
        number: 'ORD-2',
        priceSummary: { total: { amount: 300 } },
        lineItems: [{ productName: { original: 'Modern Sofa' }, quantity: 2, price: { amount: 150 } }],
      },
    });
    await new Promise(r => setTimeout(r, 50));
    expect(inserts.length).toBeGreaterThan(0);
    expect(inserts[0].variables.productNames).toContain('Modern Sofa');
  });

  it('does nothing when email is missing', async () => {
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    wixEcom_onOrderCreated({ entity: { buyerInfo: {}, number: 'ORD-3' } });
    await new Promise(r => setTimeout(r, 50));
    expect(inserts.length).toBe(0);
  });
});

// ── 14. wixEcom_onOrderCanceled ──────────────────────────────────────

describe('wixEcom_onOrderCanceled', () => {
  it('cancels pending post-purchase emails for the order', async () => {
    __seed('EmailQueue', [
      {
        _id: 'pp-cancel1', recipientEmail: 'cancel@test.com',
        sequenceType: 'post_purchase', status: 'pending', sequenceStep: 2,
        variables: { orderNumber: 'ORD-X' },
      },
    ]);

    const updates = [];
    __onUpdate((col, item) => { if (col === 'EmailQueue') updates.push(item); });

    await wixEcom_onOrderCanceled({
      entity: { buyerInfo: { email: 'cancel@test.com' }, number: 'ORD-X' },
    });
    await new Promise(r => setTimeout(r, 50));
    expect(updates.length).toBe(1);
    expect(updates[0].status).toBe('cancelled');
    expect(updates[0].lastError).toBe('Order ORD-X cancelled');
  });

  it('does nothing when email missing', async () => {
    const updates = [];
    __onUpdate((col, item) => updates.push(item));

    wixEcom_onOrderCanceled({ entity: { buyerInfo: {}, number: 'ORD-Y' } });
    await new Promise(r => setTimeout(r, 50));
    expect(updates.length).toBe(0);
  });
});

// ── 15. A/B variant selection ────────────────────────────────────────

describe('A/B variant selection in welcome sequence', () => {
  it('step 1 gets abVariant set, other steps get null', async () => {
    // ab@test.com hashes to variant A (deterministic)
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    await triggerWelcomeSequence('c1', 'ab@test.com', 'Tester');

    expect(inserts.length).toBe(3);
    expect(inserts[0].abVariant).toBe('A');
    expect(inserts[0].variables.subjectLine).toContain('Welcome to Carolina Futons');
    expect(inserts[1].abVariant).toBeNull();
    expect(inserts[2].abVariant).toBeNull();
    expect(inserts[1].variables.subjectLine).toBeUndefined();
  });

  it('variant B personalizes subject with firstName', async () => {
    // alice@test.com hashes to variant B (deterministic)
    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    await triggerWelcomeSequence('c2', 'alice@test.com', 'Dana');

    expect(inserts[0].abVariant).toBe('B');
    expect(inserts[0].variables.subjectLine).toContain('Dana');
  });
});

// ── Additional edge cases ────────────────────────────────────────────

describe('processEmailQueue unsubscribe-after-queue', () => {
  it('cancels email if recipient unsubscribed since queuing', async () => {
    const now = new Date();
    __seed('EmailQueue', [{
      _id: 'q-unsub', templateId: 'welcome_series_2', recipientEmail: 'late-unsub@test.com',
      recipientContactId: 'c99', variables: {}, sequenceType: 'welcome',
      sequenceStep: 2, status: 'pending', scheduledFor: new Date(now - 1000),
      attempt: 0, lastError: '',
    }]);
    __seed('Unsubscribes', [
      { _id: 'u-late', email: 'late-unsub@test.com', sequenceType: 'welcome' },
    ]);

    const updates = [];
    __onUpdate((col, item) => { if (col === 'EmailQueue') updates.push(item); });

    const res = await processEmailQueue();
    expect(res.cancelled).toBe(1);
    expect(updates[0].lastError).toBe('Recipient unsubscribed');
  });

  it('cancels email if recipient unsubscribed from all', async () => {
    const now = new Date();
    __seed('EmailQueue', [{
      _id: 'q-unsub-all', templateId: 'post_purchase_1', recipientEmail: 'allout@test.com',
      recipientContactId: 'c100', variables: {}, sequenceType: 'post_purchase',
      sequenceStep: 1, status: 'pending', scheduledFor: new Date(now - 1000),
      attempt: 0, lastError: '',
    }]);
    __seed('Unsubscribes', [
      { _id: 'u-all', email: 'allout@test.com', sequenceType: 'all' },
    ]);

    const res = await processEmailQueue();
    expect(res.cancelled).toBe(1);
  });
});

describe('triggerAbandonedCartRecovery lineItems as array', () => {
  it('handles lineItems already as array (not JSON string)', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    __seed('AbandonedCarts', [{
      _id: 'ac-arr', checkoutId: 'chk-arr', status: 'abandoned',
      recoveryEmailSent: false, abandonedAt: twoHoursAgo,
      buyerEmail: 'array@test.com', buyerName: 'Arr',
      cartTotal: 150, lineItems: [{ name: 'Futon Frame', quantity: 1 }],
    }]);

    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    const res = await triggerAbandonedCartRecovery();
    expect(res.cartsProcessed).toBe(1);
    expect(inserts[0].variables.itemSummary).toBe('Futon Frame (x1)');
  });
});

describe('triggerWelcomeSequence deduplication', () => {
  it('does not re-queue welcome if already queued for this email', async () => {
    __seed('EmailQueue', [{
      _id: 'existing-w', recipientEmail: 'dupe@test.com',
      sequenceType: 'welcome', sequenceStep: 1, status: 'sent',
    }]);

    const res = await triggerWelcomeSequence('c50', 'dupe@test.com', 'Dupe');
    expect(res.success).toBe(false);
    expect(res.queued).toBe(0);
  });
});

describe('triggerWelcomeSequence discount unavailable', () => {
  it('queues emails without discount when secret fails', async () => {
    getSecret.mockRejectedValueOnce(new Error('Secret not found'));

    const inserts = [];
    __onInsert((col, item) => { if (col === 'EmailQueue') inserts.push(item); });

    const res = await triggerWelcomeSequence('c60', 'nodiscount@test.com', 'No');
    expect(res.success).toBe(true);
    expect(inserts[0].variables.discountCode).toBe('');
    expect(inserts[0].variables.discountAvailable).toBe(false);
  });
});
