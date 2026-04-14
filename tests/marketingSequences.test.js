/**
 * @file marketingSequences.test.js
 * @description TDD tests for CF-5io3: Marketing Sequences
 *
 * Tests:
 *   triggerWelcomeSequence — reads welcome steps from EmailSequences CMS, enqueues with 0 delay
 *   triggerCartAbandonSequence — enqueues with 1hr delay, passes checkoutId
 *   triggerPostPurchaseSequence — enqueues with 72hr delay
 *   triggerReviewRequestSequence — enqueues with 168hr delay
 *   triggerWinbackSequence — enqueues with 720hr delay
 *   All sequences: skips inactive steps, handles empty CMS, validates required params
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  __seed,
  __reset as resetData,
  __setQueryError,
  __getInserted,
} from './__mocks__/wix-data.js';
import { __reset as resetCRM } from './__mocks__/wix-crm-backend.js';

import {
  triggerWelcomeSequence,
  triggerCartAbandonSequence,
  triggerPostPurchaseSequence,
  triggerReviewRequestSequence,
  triggerWinbackSequence,
  scanAndTriggerWinback,
  EMAIL_SEQUENCES_COLLECTION,
} from '../src/backend/marketingSequences.web.js';

import { EMAIL_QUEUE_COLLECTION } from '../src/backend/emailQueueService.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSequenceStep(overrides = {}) {
  return {
    _id: `seq-${Math.random().toString(36).slice(2, 8)}`,
    sequenceType: 'welcome',
    step: 1,
    templateId: 'tpl-welcome-1',
    delayHours: 0,
    subject: 'Welcome to Carolina Futons!',
    active: true,
    ...overrides,
  };
}

function seedSequence(sequenceType, steps) {
  __seed(EMAIL_SEQUENCES_COLLECTION, steps.map((s, i) => makeSequenceStep({
    sequenceType,
    step: i + 1,
    delayHours: s.delayHours ?? 0,
    templateId: s.templateId ?? `tpl-${sequenceType}-${i + 1}`,
    active: s.active ?? true,
  })));
}

// ── beforeEach / afterEach ────────────────────────────────────────────────────

beforeEach(() => {
  resetData();
  resetCRM();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── EMAIL_SEQUENCES_COLLECTION constant ───────────────────────────────────────

describe('EMAIL_SEQUENCES_COLLECTION', () => {
  it('is a non-empty string', () => {
    expect(typeof EMAIL_SEQUENCES_COLLECTION).toBe('string');
    expect(EMAIL_SEQUENCES_COLLECTION.length).toBeGreaterThan(0);
  });
});

// ── triggerWelcomeSequence ────────────────────────────────────────────────────

describe('triggerWelcomeSequence', () => {
  it('returns success: true with valid params', async () => {
    seedSequence('welcome', [{ delayHours: 0, templateId: 'tpl-welcome-1' }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    const result = await triggerWelcomeSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
    });

    expect(result.success).toBe(true);
  });

  it('enqueues one item per active step', async () => {
    seedSequence('welcome', [
      { delayHours: 0, templateId: 'tpl-welcome-1' },
    ]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await triggerWelcomeSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued.length).toBe(1);
    expect(queued[0].sequenceType).toBe('welcome');
  });

  it('schedules welcome step with 0 delay (scheduledFor ≈ now)', async () => {
    seedSequence('welcome', [{ delayHours: 0 }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    const before = Date.now();
    await triggerWelcomeSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
    });
    const after = Date.now();

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    const scheduledMs = queued[0].scheduledFor.getTime();
    expect(scheduledMs).toBeGreaterThanOrEqual(before);
    expect(scheduledMs).toBeLessThanOrEqual(after + 1000);
  });

  it('passes firstName in variables', async () => {
    seedSequence('welcome', [{ delayHours: 0 }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await triggerWelcomeSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    const vars = JSON.parse(queued[0].variables);
    expect(vars.firstName).toBe('Alice');
  });

  it('skips inactive steps', async () => {
    __seed(EMAIL_SEQUENCES_COLLECTION, [
      makeSequenceStep({ sequenceType: 'welcome', step: 1, active: false }),
    ]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await triggerWelcomeSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued.length).toBe(0);
  });

  it('returns success: true with enqueued: 0 when CMS has no steps', async () => {
    __seed(EMAIL_SEQUENCES_COLLECTION, []);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    const result = await triggerWelcomeSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
    });

    expect(result.success).toBe(true);
    expect(result.enqueued).toBe(0);
  });

  it('returns error on missing email', async () => {
    const result = await triggerWelcomeSequence({
      contactId: 'contact-1',
      firstName: 'Alice',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error on missing contactId', async () => {
    const result = await triggerWelcomeSequence({
      email: 'alice@example.com',
      firstName: 'Alice',
    });

    expect(result.success).toBe(false);
  });

  it('handles CMS query error gracefully', async () => {
    __setQueryError(EMAIL_SEQUENCES_COLLECTION, new Error('CMS unavailable'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await triggerWelcomeSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
    });

    expect(result.success).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
  });
});

// ── triggerCartAbandonSequence ────────────────────────────────────────────────

describe('triggerCartAbandonSequence', () => {
  it('enqueues cart_abandon step with 1hr delay', async () => {
    seedSequence('cart_abandon', [{ delayHours: 1, templateId: 'tpl-cart-abandon-1' }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    const before = Date.now();
    await triggerCartAbandonSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
      checkoutId: 'checkout-abc',
      cartItems: ['futon-1'],
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued.length).toBe(1);
    const scheduledMs = queued[0].scheduledFor.getTime();
    // Should be ~1hr in the future
    expect(scheduledMs).toBeGreaterThanOrEqual(before + 3600 * 1000 - 100);
  });

  it('passes checkoutId to queue item', async () => {
    seedSequence('cart_abandon', [{ delayHours: 1 }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await triggerCartAbandonSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
      checkoutId: 'checkout-abc',
      cartItems: [],
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued[0].checkoutId).toBe('checkout-abc');
  });

  it('uses sequenceType cart_abandon', async () => {
    seedSequence('cart_abandon', [{ delayHours: 1 }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await triggerCartAbandonSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
      checkoutId: 'checkout-abc',
      cartItems: [],
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued[0].sequenceType).toBe('cart_abandon');
  });

  it('returns error on missing email', async () => {
    const result = await triggerCartAbandonSequence({
      contactId: 'contact-1',
      checkoutId: 'checkout-abc',
      cartItems: [],
    });
    expect(result.success).toBe(false);
  });

  it('returns error on missing checkoutId', async () => {
    const result = await triggerCartAbandonSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      cartItems: [],
    });
    expect(result.success).toBe(false);
  });
});

// ── triggerPostPurchaseSequence ───────────────────────────────────────────────

describe('triggerPostPurchaseSequence', () => {
  it('enqueues post_purchase step with 72hr delay', async () => {
    seedSequence('post_purchase', [{ delayHours: 72, templateId: 'tpl-post-purchase-1' }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    const before = Date.now();
    await triggerPostPurchaseSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
      orderNumber: '#1001',
      total: 299.99,
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued.length).toBe(1);
    const scheduledMs = queued[0].scheduledFor.getTime();
    expect(scheduledMs).toBeGreaterThanOrEqual(before + 72 * 3600 * 1000 - 100);
  });

  it('uses sequenceType post_purchase', async () => {
    seedSequence('post_purchase', [{ delayHours: 72 }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await triggerPostPurchaseSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
      orderNumber: '#1001',
      total: 299.99,
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued[0].sequenceType).toBe('post_purchase');
  });

  it('passes orderNumber in variables', async () => {
    seedSequence('post_purchase', [{ delayHours: 72 }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await triggerPostPurchaseSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
      orderNumber: '#1001',
      total: 299.99,
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    const vars = JSON.parse(queued[0].variables);
    expect(vars.orderNumber).toBe('#1001');
  });

  it('returns error on missing email', async () => {
    const result = await triggerPostPurchaseSequence({
      contactId: 'contact-1',
      orderNumber: '#1001',
      total: 99,
    });
    expect(result.success).toBe(false);
  });
});

// ── triggerReviewRequestSequence ──────────────────────────────────────────────

describe('triggerReviewRequestSequence', () => {
  it('enqueues review_request step with 168hr delay', async () => {
    seedSequence('review_request', [{ delayHours: 168, templateId: 'tpl-review-1' }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    const before = Date.now();
    await triggerReviewRequestSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
      productName: 'Futon Sofa',
      orderId: 'order-123',
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued.length).toBe(1);
    const scheduledMs = queued[0].scheduledFor.getTime();
    expect(scheduledMs).toBeGreaterThanOrEqual(before + 168 * 3600 * 1000 - 100);
  });

  it('uses sequenceType review_request', async () => {
    seedSequence('review_request', [{ delayHours: 168 }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await triggerReviewRequestSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
      productName: 'Futon Sofa',
      orderId: 'order-123',
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued[0].sequenceType).toBe('review_request');
  });

  it('passes productName in variables', async () => {
    seedSequence('review_request', [{ delayHours: 168 }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await triggerReviewRequestSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
      productName: 'Futon Sofa',
      orderId: 'order-123',
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    const vars = JSON.parse(queued[0].variables);
    expect(vars.productName).toBe('Futon Sofa');
  });

  it('returns error on missing email', async () => {
    const result = await triggerReviewRequestSequence({
      contactId: 'contact-1',
      productName: 'Futon Sofa',
      orderId: 'order-123',
    });
    expect(result.success).toBe(false);
  });
});

// ── triggerWinbackSequence ────────────────────────────────────────────────────

describe('triggerWinbackSequence', () => {
  it('enqueues winback step with 720hr delay', async () => {
    seedSequence('winback', [{ delayHours: 720, templateId: 'tpl-winback-1' }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    const before = Date.now();
    await triggerWinbackSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued.length).toBe(1);
    const scheduledMs = queued[0].scheduledFor.getTime();
    expect(scheduledMs).toBeGreaterThanOrEqual(before + 720 * 3600 * 1000 - 100);
  });

  it('uses sequenceType winback', async () => {
    seedSequence('winback', [{ delayHours: 720 }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await triggerWinbackSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued[0].sequenceType).toBe('winback');
  });

  it('returns error on missing email', async () => {
    const result = await triggerWinbackSequence({
      contactId: 'contact-1',
      firstName: 'Alice',
    });
    expect(result.success).toBe(false);
  });

  it('handles empty CMS gracefully', async () => {
    __seed(EMAIL_SEQUENCES_COLLECTION, []);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    const result = await triggerWinbackSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
    });

    expect(result.success).toBe(true);
    expect(result.enqueued).toBe(0);
  });
});

// ── Cross-sequence: multiple steps ────────────────────────────────────────────

describe('sequences — multiple steps in CMS', () => {
  it('enqueues all active steps for a sequence', async () => {
    __seed(EMAIL_SEQUENCES_COLLECTION, [
      makeSequenceStep({ sequenceType: 'welcome', step: 1, delayHours: 0, active: true }),
      makeSequenceStep({ sequenceType: 'welcome', step: 2, delayHours: 24, active: true }),
    ]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await triggerWelcomeSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued.length).toBe(2);
    expect(queued[0].sequenceStep).toBe(1);
    expect(queued[1].sequenceStep).toBe(2);
  });

  it('enqueues only active steps when some are inactive', async () => {
    __seed(EMAIL_SEQUENCES_COLLECTION, [
      makeSequenceStep({ sequenceType: 'welcome', step: 1, delayHours: 0, active: true }),
      makeSequenceStep({ sequenceType: 'welcome', step: 2, delayHours: 24, active: false }),
      makeSequenceStep({ sequenceType: 'welcome', step: 3, delayHours: 48, active: true }),
    ]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await triggerWelcomeSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued.length).toBe(2);
    const steps = queued.map(i => i.sequenceStep);
    expect(steps).toContain(1);
    expect(steps).toContain(3);
    expect(steps).not.toContain(2);
  });

  it('schedules steps using delayHours from CMS (not hardcoded)', async () => {
    __seed(EMAIL_SEQUENCES_COLLECTION, [
      makeSequenceStep({ sequenceType: 'welcome', step: 1, delayHours: 0, active: true }),
      makeSequenceStep({ sequenceType: 'welcome', step: 2, delayHours: 48, active: true }),
    ]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    const before = Date.now();
    await triggerWelcomeSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    const step2 = queued.find(q => q.sequenceStep === 2);
    expect(step2.scheduledFor.getTime()).toBeGreaterThanOrEqual(before + 48 * 3600 * 1000 - 100);
  });
});

// ── Error path coverage for triggerReviewRequestSequence + triggerWinbackSequence ──

describe('triggerReviewRequestSequence — error path', () => {
  it('returns success:false when CMS query throws', async () => {
    __setQueryError(EMAIL_SEQUENCES_COLLECTION, new Error('DB error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await triggerReviewRequestSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
      productName: 'Futon',
      orderId: 'order-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    consoleSpy.mockRestore();
  });
});

describe('triggerWinbackSequence — error path', () => {
  it('returns success:false when CMS query throws', async () => {
    __setQueryError(EMAIL_SEQUENCES_COLLECTION, new Error('DB error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await triggerWinbackSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      firstName: 'Alice',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    consoleSpy.mockRestore();
  });
});

describe('triggerCartAbandonSequence — error path', () => {
  it('returns success:false when CMS query throws', async () => {
    __setQueryError(EMAIL_SEQUENCES_COLLECTION, new Error('DB error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await triggerCartAbandonSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      checkoutId: 'checkout-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    consoleSpy.mockRestore();
  });
});

describe('triggerPostPurchaseSequence — error path', () => {
  it('returns success:false when CMS query throws', async () => {
    __setQueryError(EMAIL_SEQUENCES_COLLECTION, new Error('DB error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await triggerPostPurchaseSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      orderNumber: 'ORD-001',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    consoleSpy.mockRestore();
  });
});

// ── Default-param branch coverage (params ?? {}, firstName = '', etc.) ─────────

describe('triggerReviewRequestSequence — null params', () => {
  it('returns error when called with null params', async () => {
    const result = await triggerReviewRequestSequence(null);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('uses default firstName when not provided', async () => {
    seedSequence('review_request', [{ delayHours: 168, templateId: 'tpl-rv' }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await triggerReviewRequestSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      productName: 'Futon',
      orderId: 'order-1',
      // firstName intentionally omitted — hits firstName = '' default branch
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    const vars = JSON.parse(queued[0].variables);
    expect(vars.firstName).toBe('');
  });
});

describe('triggerWinbackSequence — null params', () => {
  it('returns error when called with null params', async () => {
    const result = await triggerWinbackSequence(null);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it('uses default firstName when not provided', async () => {
    seedSequence('winback', [{ delayHours: 720, templateId: 'tpl-wb' }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);

    await triggerWinbackSequence({
      email: 'alice@example.com',
      contactId: 'contact-1',
      // firstName intentionally omitted
    });

    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    const vars = JSON.parse(queued[0].variables);
    expect(vars.firstName).toBe('');
  });
});

// ── scanAndTriggerWinback — cf-amx cron scanner ───────────────────────────────

describe('scanAndTriggerWinback — cf-amx', () => {
  const ORDERS = 'Stores/Orders';
  const DAY_MS = 24 * 60 * 60 * 1000;

  function makeOrder(overrides = {}) {
    return {
      _id: overrides._id ?? `order-${Math.random().toString(36).slice(2, 8)}`,
      _createdDate: overrides._createdDate ?? new Date(Date.now() - 30 * DAY_MS),
      buyerInfo: overrides.buyerInfo ?? {
        email: 'buyer@example.com',
        contactId: 'contact-1',
        firstName: 'Alice',
      },
    };
  }

  it('triggers winback for an order placed ~30 days ago', async () => {
    seedSequence('winback', [{ delayHours: 720, templateId: 'tpl-wb' }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);
    __seed(ORDERS, [makeOrder({ _createdDate: new Date(Date.now() - 30 * DAY_MS) })]);

    const result = await scanAndTriggerWinback();

    expect(result.success).toBe(true);
    expect(result.triggered).toBe(1);
    const queued = __getInserted(EMAIL_QUEUE_COLLECTION);
    expect(queued).toHaveLength(1);
    expect(queued[0].sequenceType).toBe('winback');
  });

  it('skips orders outside the 30–37 day lookback window', async () => {
    seedSequence('winback', [{ delayHours: 720, templateId: 'tpl-wb' }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);
    __seed(ORDERS, [
      makeOrder({ _id: 'too-recent', _createdDate: new Date(Date.now() - 20 * DAY_MS) }),
      makeOrder({ _id: 'too-old',    _createdDate: new Date(Date.now() - 60 * DAY_MS) }),
    ]);

    const result = await scanAndTriggerWinback();
    expect(result.triggered).toBe(0);
    expect(__getInserted(EMAIL_QUEUE_COLLECTION)).toHaveLength(0);
  });

  it('dedups multiple orders from the same buyer to a single winback trigger', async () => {
    seedSequence('winback', [{ delayHours: 720, templateId: 'tpl-wb' }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);
    const buyer = { email: 'repeat@example.com', contactId: 'c-repeat', firstName: 'Repeat' };
    __seed(ORDERS, [
      makeOrder({ _id: 'o1', _createdDate: new Date(Date.now() - 30 * DAY_MS), buyerInfo: buyer }),
      makeOrder({ _id: 'o2', _createdDate: new Date(Date.now() - 32 * DAY_MS), buyerInfo: buyer }),
    ]);

    const result = await scanAndTriggerWinback();
    expect(result.triggered).toBe(1);
    expect(__getInserted(EMAIL_QUEUE_COLLECTION)).toHaveLength(1);
  });

  it('skips buyers whose winback is already in EmailQueue (idempotent re-run)', async () => {
    seedSequence('winback', [{ delayHours: 720, templateId: 'tpl-wb' }]);
    __seed(ORDERS, [makeOrder({ _createdDate: new Date(Date.now() - 30 * DAY_MS) })]);
    __seed(EMAIL_QUEUE_COLLECTION, [{
      _id: 'dup-wb',
      recipientEmail: 'buyer@example.com',
      sequenceType: 'winback',
      sequenceStep: 1,
      status: 'pending',
    }]);

    await scanAndTriggerWinback();
    // enqueueEmail dedup prevents a second queue row — only the pre-seeded row
    // should remain.
    const winbackRows = __getInserted(EMAIL_QUEUE_COLLECTION)
      .filter(r => r.sequenceType === 'winback');
    expect(winbackRows).toHaveLength(1);
    expect(winbackRows[0]._id).toBe('dup-wb');
  });

  it('skips orders missing buyerInfo.email', async () => {
    seedSequence('winback', [{ delayHours: 720, templateId: 'tpl-wb' }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);
    __seed(ORDERS, [makeOrder({
      _createdDate: new Date(Date.now() - 30 * DAY_MS),
      buyerInfo: { email: '', contactId: 'c-1', firstName: '' },
    })]);

    const result = await scanAndTriggerWinback();
    expect(result.triggered).toBe(0);
  });

  it('skips orders missing buyerInfo.contactId', async () => {
    seedSequence('winback', [{ delayHours: 720, templateId: 'tpl-wb' }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);
    __seed(ORDERS, [makeOrder({
      _createdDate: new Date(Date.now() - 30 * DAY_MS),
      buyerInfo: { email: 'no-cid@example.com', contactId: '', firstName: '' },
    })]);

    const result = await scanAndTriggerWinback();
    expect(result.triggered).toBe(0);
  });

  it('returns { success: false } on query error', async () => {
    __setQueryError(ORDERS, new Error('query boom'));
    const result = await scanAndTriggerWinback();
    expect(result.success).toBe(false);
    expect(result.triggered).toBe(0);
  });

  it('reports scanned and triggered counts', async () => {
    seedSequence('winback', [{ delayHours: 720, templateId: 'tpl-wb' }]);
    __seed(EMAIL_QUEUE_COLLECTION, []);
    __seed(ORDERS, [
      makeOrder({ _id: 'o1', _createdDate: new Date(Date.now() - 30 * DAY_MS),
        buyerInfo: { email: 'a@x.com', contactId: 'c-a', firstName: 'A' } }),
      makeOrder({ _id: 'o2', _createdDate: new Date(Date.now() - 31 * DAY_MS),
        buyerInfo: { email: 'b@x.com', contactId: 'c-b', firstName: 'B' } }),
      makeOrder({ _id: 'o3', _createdDate: new Date(Date.now() - 10 * DAY_MS), // out of window
        buyerInfo: { email: 'c@x.com', contactId: 'c-c', firstName: 'C' } }),
    ]);

    const result = await scanAndTriggerWinback();
    expect(result.success).toBe(true);
    // scanned counts orders returned by the range query (window filter),
    // so the out-of-window order is excluded.
    expect(result.scanned).toBe(2);
    expect(result.triggered).toBe(2);
  });
});
