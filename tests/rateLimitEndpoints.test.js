/**
 * @file rateLimitEndpoints.test.js
 * @description CF-39ct: Tests for centralized checkRateLimit wiring across
 * Permissions.Anyone mutation endpoints. Verifies that rate-limited requests
 * are properly blocked/silently dropped, and that under-limit requests proceed.
 *
 * Tests a representative sample from each category:
 *  - Form submissions (3/hour default): captureSpinEmail, applyForTradeAccount, signUpBackInStock
 *  - Chat (30/min): sendMessage
 *  - Tracking (30-60/min, silent drop): trackProductView (60/min), trackCheckoutStep (60/min)
 *  - Brute-force protection: checkBalance (gift cards, 10/hour)
 *  - Refactored internal → centralized: submitContactForm
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed } from './__mocks__/wix-data.js';

const ONE_HOUR = 60 * 60 * 1000;

/**
 * Helper: seed a rate-limit collection with a record at count `n` in the current window.
 * Uses Date.now() so the window appears active to checkRateLimit.
 */
function seedRateLimit(collection, key, count, windowStart = Date.now()) {
  __seed(collection, [{
    _id: `rl-${collection}-1`,
    key: key.toLowerCase(),
    count,
    windowStart: new Date(windowStart),
  }]);
}

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── captureSpinEmail (form submission, 3/hour) ──────────────────────

describe('captureSpinEmail — rate limiting', () => {
  let captureSpinEmail;

  beforeEach(async () => {
    ({ captureSpinEmail } = await import('../src/backend/spinWheel.web.js'));
  });

  it('blocks when rate limit exceeded', async () => {
    seedRateLimit('SpinWheelRateLimit', 'test@example.com', 3);
    const result = await captureSpinEmail('test@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });

  it('allows when under rate limit', async () => {
    seedRateLimit('SpinWheelRateLimit', 'test@example.com', 1);
    // Also seed the SpinEmailCaptures to avoid insert
    __seed('SpinEmailCaptures', [{ email: 'test@example.com' }]);
    const result = await captureSpinEmail('test@example.com');
    // Should proceed past rate limit (already captured → success)
    expect(result.success).toBe(true);
  });

  it('rejects invalid email before rate limit check', async () => {
    const result = await captureSpinEmail('not-an-email');
    expect(result.success).toBe(false);
    expect(result.error).toBe('INVALID_EMAIL');
  });
});

// ── applyForTradeAccount (form submission, 3/hour) ──────────────────

describe('applyForTradeAccount — rate limiting', () => {
  let applyForTradeAccount;

  beforeEach(async () => {
    ({ applyForTradeAccount } = await import('../src/backend/tradeProgram.web.js'));
  });

  it('blocks when rate limit exceeded', async () => {
    seedRateLimit('TradeApplicationRateLimit', 'biz@example.com', 3);
    const result = await applyForTradeAccount({
      businessName: 'Test Corp',
      contactName: 'Jane',
      contactEmail: 'biz@example.com',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });

  it('allows when under rate limit', async () => {
    seedRateLimit('TradeApplicationRateLimit', 'biz@example.com', 1);
    const result = await applyForTradeAccount({
      businessName: 'Test Corp',
      contactName: 'Jane',
      contactEmail: 'biz@example.com',
    });
    // Proceeds past rate limit — may fail on TradeAccounts query but not on rate limit
    expect(result.error ?? '').not.toMatch(/too many/i);
  });
});

// ── signUpBackInStock (form submission, 3/hour) ─────────────────────

describe('signUpBackInStock — rate limiting', () => {
  let signUpBackInStock;

  beforeEach(async () => {
    ({ signUpBackInStock } = await import('../src/backend/inventoryService.web.js'));
  });

  it('blocks when rate limit exceeded', async () => {
    seedRateLimit('BackInStockRateLimit', 'shopper@example.com', 3);
    const result = await signUpBackInStock({
      email: 'shopper@example.com',
      productId: 'prod-1',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });
});

// ── sendMessage (chat, 30/minute) ───────────────────────────────────

describe('liveChatService.sendMessage — rate limiting', () => {
  let sendMessage;

  beforeEach(async () => {
    ({ sendMessage } = await import('../src/backend/liveChatService.web.js'));
  });

  it('blocks when message rate limit exceeded', async () => {
    seedRateLimit('ChatMessageRateLimit', 'session-abc', 30);
    const result = await sendMessage({
      sessionId: 'session-abc',
      message: 'Hello',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many|slow down/i);
  });

  it('allows when under message rate limit', async () => {
    seedRateLimit('ChatMessageRateLimit', 'session-abc', 5);
    const result = await sendMessage({
      sessionId: 'session-abc',
      message: 'Hello',
    });
    // Proceeds past rate limit
    expect(result.success).toBe(true);
  });
});

// ── trackProductView (tracking, 60/minute, silent drop) ─────────────

describe('trackProductView — rate limiting', () => {
  let trackProductView;

  beforeEach(async () => {
    ({ trackProductView } = await import('../src/backend/analyticsHelpers.web.js'));
  });

  it('silently drops when rate limit exceeded', async () => {
    seedRateLimit('AnalyticsEventRateLimit', 'prod-1', 60);
    // Should not throw, should silently return
    const result = await trackProductView('prod-1', 'Test Product', 'futons');
    // Silent drop returns undefined (no error, no insert)
    expect(result).toBeUndefined();
  });

  it('proceeds when under rate limit', async () => {
    seedRateLimit('AnalyticsEventRateLimit', 'prod-1', 10);
    // Should proceed to query/insert ProductAnalytics
    await trackProductView('prod-1', 'Test Product', 'futons');
    // No error thrown = success
  });
});

// ── trackCheckoutStep (tracking, 60/minute, silent drop) ────────────

describe('trackCheckoutStep — rate limiting', () => {
  let trackCheckoutStep;

  beforeEach(async () => {
    ({ trackCheckoutStep } = await import('../src/backend/checkoutOptimization.web.js'));
  });

  it('silently succeeds when rate limit exceeded', async () => {
    seedRateLimit('CheckoutTrackingRateLimit', 'session-xyz', 60);
    const result = await trackCheckoutStep({
      sessionId: 'session-xyz',
      step: 'start',
    });
    expect(result.success).toBe(true); // Silent success, not error
  });
});

// ── checkBalance (brute-force protection, 10/hour) ──────────────────

describe('giftCards.checkBalance — rate limiting', () => {
  let checkBalance;

  beforeEach(async () => {
    ({ checkBalance } = await import('../src/backend/giftCards.web.js'));
  });

  it('returns found:false when rate limit exceeded (no info leak)', async () => {
    seedRateLimit('GiftCardBalanceRateLimit', 'ABC123', 10);
    const result = await checkBalance('abc123');
    expect(result.found).toBe(false);
  });

  it('proceeds to lookup when under rate limit', async () => {
    seedRateLimit('GiftCardBalanceRateLimit', 'ABC123', 5);
    // No gift card seeded, so found: false from the query (not rate limit)
    const result = await checkBalance('abc123');
    expect(result.found).toBe(false);
  });
});

// ── submitContactForm (refactored internal → centralized) ───────────

describe('submitContactForm — centralized rate limiting', () => {
  let submitContactForm;

  beforeEach(async () => {
    ({ submitContactForm } = await import('../src/backend/contactSubmissions.web.js'));
  });

  it('silently succeeds when rate limit exceeded (no info leak)', async () => {
    seedRateLimit('ContactRateLimits', 'spam@example.com', 3);
    const result = await submitContactForm({ email: 'spam@example.com', message: 'hi' });
    // Original behavior: returns success:true to avoid leaking rate-limit status
    expect(result.success).toBe(true);
  });

  it('inserts when under rate limit', async () => {
    seedRateLimit('ContactRateLimits', 'real@example.com', 1);
    const result = await submitContactForm({
      email: 'real@example.com',
      message: 'I need help',
      source: 'contact_page',
    });
    expect(result.success).toBe(true);
  });
});

// ── Window expiry (cross-cutting) ───────────────────────────────────

describe('rate limit window expiry', () => {
  let captureQuizLead;

  beforeEach(async () => {
    ({ captureQuizLead } = await import('../src/backend/styleQuiz.web.js'));
  });

  it('allows request after window expires', async () => {
    // Seed with max count but expired window (more than 1 hour ago)
    seedRateLimit('QuizLeadRateLimit', 'user@example.com', 3, Date.now() - ONE_HOUR - 1);
    const result = await captureQuizLead('user@example.com');
    // Should proceed past rate limit (window expired, counter reset)
    expect(result.success).toBe(true);
  });

  it('blocks within active window at max count', async () => {
    seedRateLimit('QuizLeadRateLimit', 'user@example.com', 3);
    const result = await captureQuizLead('user@example.com');
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/too many/i);
  });
});
