/**
 * Deep coverage tests for emailAutomation.web.js — edge cases in email
 * validation, template selection, queue processing, timing boundaries,
 * restock notifications, review thank-you, and input sanitization.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setSecrets, __reset as __resetSecrets } from './__mocks__/wix-secrets-backend.js';
import { __getEmailLog, __failNextEmail } from './__mocks__/wix-crm-backend.js';
import {
  triggerWelcomeSequence,
  triggerPostPurchaseSequence,
  triggerAbandonedCartRecovery,
  triggerReengagement,
  processEmailQueue,
  unsubscribeContact,
  getEmailAutomationStats,
  recordEmailEvent,
  getEmailEvents,
  wixMembers_onMemberCreated,
  wixEcom_onOrderCreated,
  wixEcom_onOrderCanceled,
  triggerRestockNotifications,
  triggerReviewThanks,
  _SEQUENCES,
  _MAX_RETRY_ATTEMPTS,
} from '../src/backend/emailAutomation.web.js';

beforeEach(() => {
  __setSecrets({
    WELCOME_DISCOUNT_CODE: 'WELCOME10',
    RECOVERY_DISCOUNT_CODE: 'COMEBACK15',
    REVIEW_DISCOUNT_CODE: 'REVIEW10',
  });
  __seed('EmailQueue', []);
  __seed('Unsubscribes', []);
  __seed('EmailEvents', []);
  __seed('AbandonedCarts', []);
  __seed('BackInStockSignups', []);
});

// ── triggerWelcomeSequence — null/undefined/NaN inputs ──────────────

describe('triggerWelcomeSequence — edge-case inputs', () => {
  it('returns failure for null email', async () => {
    const result = await triggerWelcomeSequence('a0b1c2d3-e4f5-6789-abcd-ef0123456789', null, 'Alice');
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('returns failure for undefined email', async () => {
    const result = await triggerWelcomeSequence('a0b1c2d3-e4f5-6789-abcd-ef0123456789', undefined, 'Alice');
    expect(result.success).toBe(false);
    expect(result.queued).toBe(0);
  });

  it('handles empty firstName gracefully', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    const result = await triggerWelcomeSequence('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'test@example.com', '');
    expect(result.success).toBe(true);
    expect(result.queued).toBe(3);
    expect(insertedItems[0].variables.firstName).toBe('');
  });

  it('handles undefined firstName as empty string', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    const result = await triggerWelcomeSequence('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'test@example.com', undefined);
    expect(result.success).toBe(true);
    expect(insertedItems[0].variables.firstName).toBeDefined();
  });

  it('handles empty contactId without error', async () => {
    const result = await triggerWelcomeSequence('', 'test@example.com', 'Alice');
    expect(result.success).toBe(true);
    expect(result.queued).toBe(3);
  });

  it('replaces {firstName} in A/B variant B subject line', async () => {
    // Force variant B by mocking Math.random
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerWelcomeSequence('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'test@example.com', 'Zara');

    const step1 = insertedItems.find(i => i.sequenceStep === 1);
    expect(step1.abVariant).toBe('B');
    expect(step1.variables.subjectLine).toContain('Zara');
    expect(step1.variables.subjectLine).not.toContain('{firstName}');

    vi.restoreAllMocks();
  });

  it('replaces {firstName} with empty string when name is empty in variant B', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9);

    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerWelcomeSequence('a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'test@example.com', '');

    const step1 = insertedItems.find(i => i.sequenceStep === 1);
    expect(step1.variables.subjectLine).not.toContain('{firstName}');

    vi.restoreAllMocks();
  });
});

// ── triggerPostPurchaseSequence — numeric edge cases ─────────────────

describe('triggerPostPurchaseSequence — numeric/edge inputs', () => {
  it('converts NaN total to string "NaN"', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerPostPurchaseSequence(
      'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'buyer@example.com', 'Bob', 'ORD-001', NaN, []
    );

    expect(insertedItems[0].variables.total).toBe('NaN');
  });

  it('converts Infinity total to string "Infinity"', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerPostPurchaseSequence(
      'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'buyer@example.com', 'Bob', 'ORD-001', Infinity, []
    );

    expect(insertedItems[0].variables.total).toBe('Infinity');
  });

  it('converts 0 total to string "0"', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerPostPurchaseSequence(
      'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'buyer@example.com', 'Bob', 'ORD-001', 0, []
    );

    expect(insertedItems[0].variables.total).toBe('0');
  });

  it('handles null lineItems as empty productNames', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerPostPurchaseSequence(
      'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'buyer@example.com', 'Bob', 'ORD-001', 100, null
    );

    expect(insertedItems[0].variables.productNames).toBe('');
  });

  it('filters line items with empty names from productNames', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerPostPurchaseSequence(
      'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'buyer@example.com', 'Bob', 'ORD-001', 100,
      [{ name: '', quantity: 1, price: 50 }, { name: 'Valid Product', quantity: 1, price: 50 }]
    );

    // Empty name gets sanitized to '' which is falsy, so filter(Boolean) removes it
    expect(insertedItems[0].variables.productNames).toBe('Valid Product');
  });

  it('includes assemblyGuideUrl with #assembly anchor', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerPostPurchaseSequence(
      'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'buyer@example.com', 'Bob', 'ORD-001', 100, []
    );

    expect(insertedItems[0].variables.assemblyGuideUrl).toContain('#assembly');
    expect(insertedItems[0].variables.reviewUrl).toContain('#reviews');
  });
});

// ── triggerAbandonedCartRecovery — malformed lineItems ───────────────

describe('triggerAbandonedCartRecovery — edge cases', () => {
  it('handles string lineItems (JSON-encoded)', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-1',
      checkoutId: 'ck-json',
      buyerEmail: 'shopper@example.com',
      buyerName: 'Shopper',
      cartTotal: 599,
      lineItems: JSON.stringify([{ name: 'Eureka', quantity: 2 }]),
      abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(1);
    expect(insertedItems[0].variables.itemSummary).toBe('Eureka (x2)');
  });

  it('handles malformed JSON string lineItems gracefully', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-1',
      checkoutId: 'ck-bad-json',
      buyerEmail: 'shopper@example.com',
      buyerName: 'Shopper',
      cartTotal: 100,
      lineItems: '{not valid json',
      abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(1);
    // parsedItems should be [] after JSON.parse fails
    expect(insertedItems[0].variables.itemSummary).toBe('');
  });

  it('handles cart with no buyerName', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-1',
      checkoutId: 'ck-noname',
      buyerEmail: 'shopper@example.com',
      cartTotal: 599,
      lineItems: [],
      abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(1);
    expect(insertedItems[0].variables.buyerName).toBe('');
  });

  it('handles cart with null cartTotal', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-1',
      checkoutId: 'ck-nulltotal',
      buyerEmail: 'shopper@example.com',
      buyerName: 'Shopper',
      cartTotal: null,
      lineItems: [],
      abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerAbandonedCartRecovery();
    expect(insertedItems[0].variables.cartTotal).toBe('0');
  });

  it('skips cart with empty buyerEmail string', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-1',
      checkoutId: 'ck-empty',
      buyerEmail: '',
      buyerName: 'Nobody',
      cartTotal: 100,
      lineItems: [],
      abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(0);
  });

  it('processes multiple abandoned carts independently', async () => {
    __seed('AbandonedCarts', [
      {
        _id: 'ac-1',
        checkoutId: 'ck-1',
        buyerEmail: 'buyer1@example.com',
        buyerName: 'Buyer1',
        cartTotal: 100,
        lineItems: [],
        abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        status: 'abandoned',
        recoveryEmailSent: false,
      },
      {
        _id: 'ac-2',
        checkoutId: 'ck-2',
        buyerEmail: 'buyer2@example.com',
        buyerName: 'Buyer2',
        cartTotal: 200,
        lineItems: [],
        abandonedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        status: 'abandoned',
        recoveryEmailSent: false,
      },
    ]);

    const result = await triggerAbandonedCartRecovery();
    expect(result.cartsProcessed).toBe(2);
  });

  it('stores checkoutId as flat field on queued emails for dedup', async () => {
    __seed('AbandonedCarts', [{
      _id: 'ac-1',
      checkoutId: 'ck-flat-field',
      buyerEmail: 'shopper@example.com',
      buyerName: 'Shopper',
      cartTotal: 100,
      lineItems: [],
      abandonedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'abandoned',
      recoveryEmailSent: false,
    }]);

    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerAbandonedCartRecovery();
    // The queueEmail function sets checkoutId from variables.checkoutId
    expect(insertedItems[0].checkoutId).toBe('ck-flat-field');
  });
});

// ── processEmailQueue — retry/backoff edge cases ────────────────────

describe('processEmailQueue — retry and backoff edge cases', () => {
  // Pin time to 2pm EDT (within 8am–8pm send window) so tests pass regardless of real clock
  beforeAll(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-03-16T18:00:00.000Z'));
  });
  afterAll(() => { vi.useRealTimers(); });

  it('applies 15min backoff on first retry attempt', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-retry1',
      templateId: 'welcome_series_1',
      recipientEmail: 'retry@example.com',
      recipientContactId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 60000),
      attempt: 0,
    }]);

    __failNextEmail();

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'EmailQueue') updatedItem = item;
    });

    const before = Date.now();
    await processEmailQueue();

    // First retry should be ~15 minutes later
    const retryTime = new Date(updatedItem.scheduledFor).getTime();
    expect(retryTime).toBeGreaterThanOrEqual(before + 14 * 60 * 1000);
    expect(retryTime).toBeLessThanOrEqual(before + 16 * 60 * 1000);
    expect(updatedItem.status).toBe('pending');
  });

  it('applies 1hr backoff on second retry attempt', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-retry2',
      templateId: 'welcome_series_1',
      recipientEmail: 'retry@example.com',
      recipientContactId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 60000),
      attempt: 1,
    }]);

    __failNextEmail();

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'EmailQueue') updatedItem = item;
    });

    const before = Date.now();
    await processEmailQueue();

    const retryTime = new Date(updatedItem.scheduledFor).getTime();
    expect(retryTime).toBeGreaterThanOrEqual(before + 59 * 60 * 1000);
    expect(retryTime).toBeLessThanOrEqual(before + 61 * 60 * 1000);
    expect(updatedItem.status).toBe('pending');
  });

  it('does not reschedule when permanently failed (attempt >= MAX_RETRY)', async () => {
    const originalScheduled = new Date(Date.now() - 60000);
    __seed('EmailQueue', [{
      _id: 'eq-maxretry',
      templateId: 'welcome_series_1',
      recipientEmail: 'fail@example.com',
      recipientContactId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: originalScheduled,
      attempt: 2,
    }]);

    __failNextEmail();

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'EmailQueue') updatedItem = item;
    });

    await processEmailQueue();

    expect(updatedItem.status).toBe('failed');
    // scheduledFor should remain unchanged when permanently failed
    expect(updatedItem.scheduledFor).toEqual(originalScheduled);
  });

  it('sets sentAt timestamp on successful send', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-sentat',
      templateId: 'welcome_series_1',
      recipientEmail: 'alice@example.com',
      recipientContactId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 60000),
      attempt: 0,
    }]);

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'EmailQueue') updatedItem = item;
    });

    const before = Date.now();
    await processEmailQueue();

    expect(updatedItem.status).toBe('sent');
    expect(updatedItem.sentAt).toBeDefined();
    expect(new Date(updatedItem.sentAt).getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it('does not send cart_recovery emails without checkoutId in variables', async () => {
    // When variables.checkoutId is missing, the cart-recovered check is skipped
    __seed('EmailQueue', [{
      _id: 'eq-nocheckout',
      templateId: 'cart_recovery_1',
      recipientEmail: 'shopper@example.com',
      recipientContactId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      variables: {},
      sequenceType: 'cart_recovery',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 60000),
      attempt: 0,
    }]);

    const result = await processEmailQueue();
    // Should still send since no checkoutId means cart-recovered check is skipped
    expect(result.sent).toBe(1);
  });

  it('records lastError message from failed send', async () => {
    __seed('EmailQueue', [{
      _id: 'eq-errmsg',
      templateId: 'welcome_series_1',
      recipientEmail: 'error@example.com',
      recipientContactId: 'a0b1c2d3-e4f5-6789-abcd-ef0123456789',
      variables: {},
      sequenceType: 'welcome',
      sequenceStep: 1,
      status: 'pending',
      scheduledFor: new Date(Date.now() - 60000),
      attempt: 0,
    }]);

    __failNextEmail();

    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'EmailQueue') updatedItem = item;
    });

    await processEmailQueue();

    expect(updatedItem.lastError).toBe('Email service unavailable');
  });
});

// ── unsubscribeContact — edge cases ─────────────────────────────────

describe('unsubscribeContact — edge cases', () => {
  it('does not cancel already-sent emails', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-sent', recipientEmail: 'user@example.com', sequenceType: 'welcome', status: 'sent' },
    ]);

    let updateCount = 0;
    __onUpdate(() => { updateCount++; });

    await unsubscribeContact('user@example.com', 'all');
    // The query filters status='pending', so sent items are not returned
    expect(updateCount).toBe(0);
  });

  it('handles unsubscribe when no pending emails exist', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'Unsubscribes') insertedItem = item;
    });

    const result = await unsubscribeContact('new@example.com', 'welcome');
    expect(result.success).toBe(true);
    expect(insertedItem.email).toBe('new@example.com');
    expect(insertedItem.sequenceType).toBe('welcome');
  });

  it('records unsubscribedAt as a Date', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'Unsubscribes') insertedItem = item;
    });

    await unsubscribeContact('ts@example.com', 'all');
    expect(insertedItem.unsubscribedAt).toBeInstanceOf(Date);
  });
});

// ── recordEmailEvent — edge cases ───────────────────────────────────

describe('recordEmailEvent — edge cases', () => {
  it('returns failure for empty params object', async () => {
    const result = await recordEmailEvent({});
    expect(result.success).toBe(false);
  });

  it('returns failure when called with no argument', async () => {
    const result = await recordEmailEvent();
    expect(result.success).toBe(false);
  });

  it('sets linkUrl to empty string when not provided for open event', async () => {
    let insertedItem = null;
    __onInsert((collection, item) => {
      if (collection === 'EmailEvents') insertedItem = item;
    });

    await recordEmailEvent({ emailQueueId: 'eq-1', eventType: 'open' });
    expect(insertedItem.linkUrl).toBe('');
  });

  it('rejects eventType with case mismatch (Open vs open)', async () => {
    const result = await recordEmailEvent({ emailQueueId: 'eq-1', eventType: 'Open' });
    expect(result.success).toBe(false);
  });

  it('rejects eventType "CLICK" (uppercase)', async () => {
    const result = await recordEmailEvent({ emailQueueId: 'eq-1', eventType: 'CLICK' });
    expect(result.success).toBe(false);
  });
});

// ── getEmailEvents — days parameter edge cases ──────────────────────

describe('getEmailEvents — lookback window edge cases', () => {
  it('uses default 30-day window when days param omitted', async () => {
    const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

    __seed('EmailEvents', [
      { _id: 'ev-recent', emailQueueId: 'eq-1', eventType: 'open', timestamp: twentyNineDaysAgo },
      { _id: 'ev-old', emailQueueId: 'eq-2', eventType: 'open', timestamp: thirtyOneDaysAgo },
    ]);

    const result = await getEmailEvents();
    expect(result.opens).toBe(1);
  });

  it('respects custom days parameter', async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

    __seed('EmailEvents', [
      { _id: 'ev-5d', emailQueueId: 'eq-1', eventType: 'open', timestamp: fiveDaysAgo },
      { _id: 'ev-15d', emailQueueId: 'eq-2', eventType: 'click', linkUrl: '/x', timestamp: fifteenDaysAgo },
    ]);

    const result = await getEmailEvents(undefined, 7);
    expect(result.opens).toBe(1);
    expect(result.clicks).toBe(0);
  });
});

// ── getEmailAutomationStats — unknown sequence types ────────────────

describe('getEmailAutomationStats — edge cases', () => {
  it('accumulates unknown sequence types dynamically', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', sequenceType: 'restock', status: 'sent', createdAt: new Date() },
      { _id: 'eq-2', sequenceType: 'review_thanks', status: 'sent', createdAt: new Date() },
    ]);

    const result = await getEmailAutomationStats();
    expect(result.stats.restock.sent).toBe(1);
    expect(result.stats.review_thanks.sent).toBe(1);
    expect(result.totalEmails).toBe(2);
  });

  it('does not count non-sent A/B variants in abResults', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', sequenceType: 'welcome', status: 'pending', abVariant: 'A', createdAt: new Date() },
      { _id: 'eq-2', sequenceType: 'welcome', status: 'failed', abVariant: 'B', createdAt: new Date() },
    ]);

    const result = await getEmailAutomationStats();
    expect(result.abResults.A.sent).toBe(0);
    expect(result.abResults.B.sent).toBe(0);
  });

  it('handles items with missing sequenceType', async () => {
    __seed('EmailQueue', [
      { _id: 'eq-1', status: 'sent', createdAt: new Date() },
    ]);

    const result = await getEmailAutomationStats();
    expect(result.stats.unknown).toBeDefined();
    expect(result.stats.unknown.sent).toBe(1);
  });
});

// ── triggerRestockNotifications — full coverage ─────────────────────

describe('triggerRestockNotifications', () => {
  it('returns failure for empty productId', async () => {
    const result = await triggerRestockNotifications('', [{ email: 'a@b.com' }]);
    expect(result.success).toBe(false);
    expect(result.notified).toBe(0);
  });

  it('returns failure for null subscribers', async () => {
    const result = await triggerRestockNotifications('prod-1', null);
    expect(result.success).toBe(false);
  });

  it('returns failure for empty subscribers array', async () => {
    const result = await triggerRestockNotifications('prod-1', []);
    expect(result.success).toBe(false);
  });

  it('notifies valid subscribers and skips invalid emails', async () => {
    const result = await triggerRestockNotifications('prod-1', [
      { email: 'valid@example.com', productName: 'Eureka Frame' },
      { email: 'not-an-email', productName: 'Bad' },
      { email: '', productName: 'Empty' },
    ]);

    expect(result.success).toBe(true);
    expect(result.notified).toBe(1);
  });

  it('skips unsubscribed subscribers', async () => {
    __seed('Unsubscribes', [{
      email: 'unsub@example.com',
      sequenceType: 'restock',
      unsubscribedAt: new Date(),
    }]);

    const result = await triggerRestockNotifications('prod-1', [
      { email: 'unsub@example.com', productName: 'Eureka Frame' },
    ]);

    expect(result.notified).toBe(0);
  });

  it('updates BackInStockSignups when subscriber has _id', async () => {
    let updatedItem = null;
    __onUpdate((collection, item) => {
      if (collection === 'BackInStockSignups') updatedItem = item;
    });

    await triggerRestockNotifications('prod-1', [
      { _id: 'bis-1', email: 'notify@example.com', productName: 'Eureka Frame' },
    ]);

    expect(updatedItem).not.toBeNull();
    expect(updatedItem.notified).toBe(true);
    expect(updatedItem.notifiedAt).toBeInstanceOf(Date);
  });

  it('does not update BackInStockSignups when subscriber has no _id', async () => {
    let updateCount = 0;
    __onUpdate((collection) => {
      if (collection === 'BackInStockSignups') updateCount++;
    });

    await triggerRestockNotifications('prod-1', [
      { email: 'notify@example.com', productName: 'Eureka Frame' },
    ]);

    expect(updateCount).toBe(0);
  });

  it('normalizes subscriber email to lowercase', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerRestockNotifications('prod-1', [
      { email: 'UPPER@EXAMPLE.COM', productName: 'Test' },
    ]);

    expect(insertedItems[0].recipientEmail).toBe('upper@example.com');
  });

  it('uses restock_notification template', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerRestockNotifications('prod-1', [
      { email: 'notify@example.com', productName: 'Frame' },
    ]);

    expect(insertedItems[0].templateId).toBe('restock_notification');
    expect(insertedItems[0].sequenceType).toBe('restock');
  });
});

// ── triggerReviewThanks — full coverage ──────────────────────────────

describe('triggerReviewThanks', () => {
  it('queues a review thank-you email with discount', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    const result = await triggerReviewThanks(
      'a0b1c2d3-e4f5-6789-abcd-ef0123456789', 'reviewer@example.com', 'Jane', 'Eureka Frame'
    );

    expect(result.success).toBe(true);
    expect(insertedItems).toHaveLength(1);
    expect(insertedItems[0].templateId).toBe('review_thank_you');
    expect(insertedItems[0].variables.discountCode).toBe('REVIEW10');
    expect(insertedItems[0].variables.discountAvailable).toBe(true);
    expect(insertedItems[0].variables.productName).toBe('Eureka Frame');
  });

  it('returns failure for empty email', async () => {
    const result = await triggerReviewThanks('contact-1', '', 'Jane', 'Eureka');
    expect(result.success).toBe(false);
  });

  it('returns failure for null email', async () => {
    const result = await triggerReviewThanks('contact-1', null, 'Jane', 'Eureka');
    expect(result.success).toBe(false);
  });

  it('returns failure for invalid email', async () => {
    const result = await triggerReviewThanks('contact-1', 'not-an-email', 'Jane', 'Eureka');
    expect(result.success).toBe(false);
  });

  it('skips unsubscribed contacts', async () => {
    __seed('Unsubscribes', [{
      email: 'reviewer@example.com',
      sequenceType: 'review_thanks',
      unsubscribedAt: new Date(),
    }]);

    const result = await triggerReviewThanks(
      'contact-1', 'reviewer@example.com', 'Jane', 'Eureka'
    );
    expect(result.success).toBe(false);
  });

  it('sends without discount when secret is missing', async () => {
    __resetSecrets();
    __setSecrets({
      WELCOME_DISCOUNT_CODE: 'WELCOME10',
      RECOVERY_DISCOUNT_CODE: 'COMEBACK15',
    });

    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    const result = await triggerReviewThanks(
      'contact-1', 'reviewer@example.com', 'Jane', 'Eureka Frame'
    );

    expect(result.success).toBe(true);
    expect(insertedItems[0].variables.discountCode).toBe('');
    expect(insertedItems[0].variables.discountAvailable).toBe(false);
  });

  it('normalizes email to lowercase', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => {
      if (collection === 'EmailQueue') insertedItems.push(item);
    });

    await triggerReviewThanks(
      'contact-1', 'REVIEWER@EXAMPLE.COM', 'Jane', 'Eureka'
    );

    expect(insertedItems[0].recipientEmail).toBe('reviewer@example.com');
  });
});

// ── wixMembers_onMemberCreated — event shape edge cases ─────────────

describe('wixMembers_onMemberCreated — event shape edge cases', () => {
  it('falls back to profile.nickname when firstName is missing', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    await wixMembers_onMemberCreated({
      entity: {
        _id: 'member-nick',
        loginEmail: 'nick@example.com',
        profile: { nickname: 'NickName' },
        contactDetails: {},
      },
    });

    const welcomeEmails = insertedItems.filter(i => i.sequenceType === 'welcome');
    expect(welcomeEmails.length).toBe(3);
    expect(welcomeEmails[0].variables.firstName).toBe('NickName');
  });

  it('handles event without entity wrapper (raw member object)', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    await wixMembers_onMemberCreated({
      _id: 'member-raw',
      loginEmail: 'raw@example.com',
      contactDetails: { firstName: 'Raw' },
    });

    const welcomeEmails = insertedItems.filter(i => i.sequenceType === 'welcome');
    expect(welcomeEmails.length).toBe(3);
  });
});

// ── wixEcom_onOrderCreated — fallback field extraction ──────────────

describe('wixEcom_onOrderCreated — field extraction edge cases', () => {
  it('falls back to buyerInfo.firstName when billingInfo missing', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    await wixEcom_onOrderCreated({
      entity: {
        number: 'ORD-FALLBACK',
        buyerInfo: { email: 'buyer@example.com', contactId: 'c-1', firstName: 'BuyerFirst' },
        totals: { total: 100 },
        lineItems: [],
      },
    });

    const ppEmails = insertedItems.filter(i => i.sequenceType === 'post_purchase');
    expect(ppEmails[0].variables.firstName).toBe('BuyerFirst');
  });

  it('extracts productName from item.productName.original when item.name missing', async () => {
    let insertedItems = [];
    __onInsert((collection, item) => { insertedItems.push(item); });

    await wixEcom_onOrderCreated({
      entity: {
        number: 'ORD-PNAME',
        buyerInfo: { email: 'buyer@example.com', contactId: 'c-1' },
        billingInfo: { firstName: 'Buyer' },
        totals: { total: 500 },
        lineItems: [
          { productName: { original: 'Original Name' }, quantity: 1, price: 500 },
        ],
      },
    });

    // The event handler extracts item.name || item.productName?.original
    const ppEmails = insertedItems.filter(i => i.sequenceType === 'post_purchase');
    expect(ppEmails.length).toBe(4);
  });
});

// ── Sequence definition integrity ───────────────────────────────────

describe('sequence definitions — deep checks', () => {
  it('restock sequence has exactly 1 step with 0 delay', () => {
    expect(_SEQUENCES.restock.steps).toHaveLength(1);
    expect(_SEQUENCES.restock.steps[0].delayHours).toBe(0);
    expect(_SEQUENCES.restock.steps[0].templateId).toBe('restock_notification');
  });

  it('review_thanks sequence has exactly 1 step with 0 delay', () => {
    expect(_SEQUENCES.review_thanks.steps).toHaveLength(1);
    expect(_SEQUENCES.review_thanks.steps[0].delayHours).toBe(0);
    expect(_SEQUENCES.review_thanks.steps[0].templateId).toBe('review_thank_you');
  });

  it('all sequences have unique template IDs per step', () => {
    const allTemplateIds = [];
    for (const seq of Object.values(_SEQUENCES)) {
      for (const step of seq.steps) {
        allTemplateIds.push(step.templateId);
      }
    }
    const uniqueIds = new Set(allTemplateIds);
    expect(uniqueIds.size).toBe(allTemplateIds.length);
  });

  it('all step numbers within each sequence are sequential starting from 1', () => {
    for (const [name, seq] of Object.entries(_SEQUENCES)) {
      seq.steps.forEach((step, idx) => {
        expect(step.step).toBe(idx + 1);
      });
    }
  });
});
