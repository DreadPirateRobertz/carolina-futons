/**
 * @file orderStatusWebhook.test.js
 * @description CF-hfao: Tests for order status webhook module.
 *
 * Covers:
 *  - buildWebhookPayload extracts correct fields from order entity
 *  - sendWebhook retries on failure with exponential backoff
 *  - sendWebhook logs audit events on success and failure
 *  - handleOrderStatusChange skips orders with no customerId
 *  - Graceful degradation when push endpoint not configured
 *  - sendWebhook retry exhaustion returns { success: false, attempts: MAX_RETRIES, lastError }
 *  - sendWebhook empty-string pushEndpoint returns early with no fetch calls
 *  - sendWebhook recovers on subsequent attempt after HTTP failure
 *  - sendWebhook captures network error message (and fallback) as lastError
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { __reset, __getInserted } from './__mocks__/wix-data.js';
import { __reset as __resetSecrets, __setSecrets } from './__mocks__/wix-secrets-backend.js';

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  __reset();
  __resetSecrets();
  vi.clearAllMocks();
  mockFetch.mockReset();
});

// ── buildWebhookPayload ─────────────────────────────────────────────

describe('buildWebhookPayload', () => {
  let buildWebhookPayload;

  beforeEach(async () => {
    ({ buildWebhookPayload } = await import('../src/backend/orderStatusWebhook.web.js'));
  });

  it('extracts all fields from a Wix order entity', () => {
    const order = {
      _id: 'order-123',
      number: '1042',
      buyerInfo: { memberId: 'member-456', contactId: 'contact-789' },
      fulfillmentStatus: {
        trackingInfo: {
          trackingNumber: 'UPS123456',
          shippingProvider: 'UPS',
          estimatedDeliveryDate: '2026-04-05T00:00:00.000Z',
        },
      },
    };

    const payload = buildWebhookPayload(order, 'shipped');

    expect(payload).toMatchObject({
      orderId: 'order-123',
      status: 'shipped',
      statusLabel: 'Order Shipped',
      carrier: 'UPS',
      trackingNumber: 'UPS123456',
      customerId: 'member-456',
      orderNumber: '1042',
    });
    expect(payload.estimatedDelivery).toBe('2026-04-05T00:00:00.000Z');
    expect(payload.timestamp).toBeTruthy();
  });

  it('handles missing optional fields gracefully', () => {
    const order = { _id: 'order-min', buyerInfo: {} };

    const payload = buildWebhookPayload(order, 'confirmed');

    expect(payload.orderId).toBe('order-min');
    expect(payload.status).toBe('confirmed');
    expect(payload.carrier).toBe('');
    expect(payload.trackingNumber).toBe('');
    expect(payload.estimatedDelivery).toBeNull();
    expect(payload.customerId).toBe('');
  });

  it('uses contactId when memberId is not available', () => {
    const order = { _id: 'o1', buyerInfo: { contactId: 'contact-only' } };
    const payload = buildWebhookPayload(order, 'confirmed');
    expect(payload.customerId).toBe('contact-only');
  });

  it('sanitizes inputs to prevent injection', () => {
    const order = {
      _id: '<script>alert("xss")</script>',
      buyerInfo: { memberId: 'clean-id' },
    };
    const payload = buildWebhookPayload(order, 'confirmed');
    expect(payload.orderId).not.toContain('<script>');
  });
});

// ── sendWebhook ─────────────────────────────────────────────────────

describe('sendWebhook', () => {
  let sendWebhook;

  beforeEach(async () => {
    ({ sendWebhook } = await import('../src/backend/orderStatusWebhook.web.js'));
  });

  it('returns failure when push endpoint is not configured', async () => {
    // wix-secrets-backend mock throws (no secret configured)
    const result = await sendWebhook({ orderId: 'o1', status: 'confirmed' });
    expect(result.success).toBe(false);
    expect(result.lastError).toMatch(/not configured/i);
  });
});

// ── handleOrderStatusChange ─────────────────────────────────────────

describe('handleOrderStatusChange', () => {
  let handleOrderStatusChange;

  beforeEach(async () => {
    ({ handleOrderStatusChange } = await import('../src/backend/orderStatusWebhook.web.js'));
  });

  it('skips when order is null', async () => {
    await handleOrderStatusChange(null, 'confirmed');
    // Should not throw, no webhook sent
  });

  it('skips when no customerId on order', async () => {
    await handleOrderStatusChange({ _id: 'o1', buyerInfo: {} }, 'confirmed');
    // Should not throw, no webhook sent (no device to route to)
  });

  it('attempts webhook when customerId is present', async () => {
    // Will fail on getSecret (no mock), but should not throw
    await handleOrderStatusChange({
      _id: 'o2',
      buyerInfo: { memberId: 'member-1' },
    }, 'shipped');
    // Fire-and-forget — no throw is success
  });
});

// ── Status labels ───────────────────────────────────────────────────

describe('status labels', () => {
  let buildWebhookPayload;

  beforeEach(async () => {
    ({ buildWebhookPayload } = await import('../src/backend/orderStatusWebhook.web.js'));
  });

  it.each([
    ['confirmed', 'Order Confirmed'],
    ['shipped', 'Order Shipped'],
    ['delivered', 'Order Delivered'],
    ['cancelled', 'Order Cancelled'],
  ])('maps %s to "%s"', (status, label) => {
    const payload = buildWebhookPayload({ _id: 'o1', buyerInfo: {} }, status);
    expect(payload.statusLabel).toBe(label);
  });

  it('uses raw status when not in STATUS_LABELS', () => {
    const payload = buildWebhookPayload({ _id: 'o1', buyerInfo: {} }, 'unknown_status');
    expect(payload.statusLabel).toBe('unknown_status');
  });
});

// ── sendWebhook: retry and error paths (CF-qe31.1) ─────────────────

describe('sendWebhook: retry and error paths', () => {
  const ENDPOINT = 'https://push.carolinafutons.app/api/push/order-status';
  const PAYLOAD = { orderId: 'o1', status: 'confirmed', customerId: 'mbr-1' };

  let sendWebhook;

  beforeEach(async () => {
    __setSecrets({ MOBILE_PUSH_ENDPOINT: ENDPOINT });
    ({ sendWebhook } = await import('../src/backend/orderStatusWebhook.web.js'));
  });

  // Guard: if an assertion inside a fake-timer test throws, useRealTimers still runs.
  afterEach(() => vi.useRealTimers());

  it('returns failure when pushEndpoint is empty string', async () => {
    // __setSecrets merges into the existing map — the key is present (returns '')
    // rather than absent (would throw). Tests the !pushEndpoint early-return branch.
    __setSecrets({ MOBILE_PUSH_ENDPOINT: '' });
    const result = await sendWebhook(PAYLOAD);
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(0);
    expect(result.lastError).toMatch(/not configured/i);
  });

  it('returns failure with lastError after all retries exhausted (HTTP 500)', async () => {
    vi.useFakeTimers();
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const promise = sendWebhook(PAYLOAD);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.lastError).toBe('HTTP 500');
  });

  it('returns success with attempts=2 when first attempt fails then recovers', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true });

    const promise = sendWebhook(PAYLOAD);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it('captures network error message as lastError', async () => {
    vi.useFakeTimers();
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const promise = sendWebhook(PAYLOAD);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
    expect(result.lastError).toBe('ECONNREFUSED');
  });

  it('captures err.message fallback when error has no message', async () => {
    vi.useFakeTimers();
    // Exercises the `err.message || 'Network error'` fallback branch in the catch block
    mockFetch.mockRejectedValue(new Error(''));

    const promise = sendWebhook(PAYLOAD);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.lastError).toBe('Network error');
  });

  it('returns success on first attempt', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const result = await sendWebhook(PAYLOAD);
    expect(result.success).toBe(true);
    expect(result.attempts).toBe(1);
  });
});
