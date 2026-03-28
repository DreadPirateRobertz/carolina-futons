/**
 * @file notificationOrchestrator.test.js
 * @description Tests for SMS notification orchestrator (cf-6sx7).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock smsService dynamic import
const mockSendOrderShippedSMS = vi.fn();
const mockSendDeliveryConfirmedSMS = vi.fn();

vi.mock('backend/smsService.web', () => ({
  sendOrderShippedSMS: (...args) => mockSendOrderShippedSMS(...args),
  sendDeliveryConfirmedSMS: (...args) => mockSendDeliveryConfirmedSMS(...args),
}));

import {
  buildTrackingUrl,
  handleOrderFulfilled,
  handleDeliveryConfirmed,
  triggerOrderShippedSMS,
  triggerDeliveryConfirmedSMS,
} from '../src/backend/notificationOrchestrator.web.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockSendOrderShippedSMS.mockResolvedValue({ success: true });
  mockSendDeliveryConfirmedSMS.mockResolvedValue({ success: true });
});

// ── buildTrackingUrl ────────────────────────────────────────────────

describe('buildTrackingUrl', () => {
  it('builds UPS tracking URL from tracking number', () => {
    const url = buildTrackingUrl('1Z999AA10123456784');
    expect(url).toBe('https://www.ups.com/track?tracknum=1Z999AA10123456784');
  });

  it('strips non-alphanumeric characters', () => {
    const url = buildTrackingUrl('1Z-999-AA1-0123');
    expect(url).toContain('1Z999AA10123');
    expect(url).not.toContain('-');
  });

  it('returns empty string for empty input', () => {
    expect(buildTrackingUrl('')).toBe('');
    expect(buildTrackingUrl(null)).toBe('');
    expect(buildTrackingUrl(undefined)).toBe('');
  });
});

// ── handleOrderFulfilled ────────────────────────────────────────────

describe('handleOrderFulfilled', () => {
  it('sends SMS with tracking URL on order fulfilled', async () => {
    const result = await handleOrderFulfilled({
      memberId: 'mem-1',
      orderNumber: 'ORD-001',
      trackingNumber: '1Z999AA10123456784',
    });

    expect(result.sent).toBe(true);
    expect(mockSendOrderShippedSMS).toHaveBeenCalledWith({
      memberId: 'mem-1',
      orderNumber: 'ORD-001',
      trackingUrl: 'https://www.ups.com/track?tracknum=1Z999AA10123456784',
    });
  });

  it('sends SMS without tracking URL when no tracking number', async () => {
    await handleOrderFulfilled({
      memberId: 'mem-1',
      orderNumber: 'ORD-002',
    });

    expect(mockSendOrderShippedSMS).toHaveBeenCalledWith({
      memberId: 'mem-1',
      orderNumber: 'ORD-002',
      trackingUrl: '',
    });
  });

  it('returns missing_params when memberId is absent', async () => {
    const result = await handleOrderFulfilled({ orderNumber: 'ORD-001' });
    expect(result.sent).toBe(false);
    expect(result.reason).toBe('missing_params');
    expect(mockSendOrderShippedSMS).not.toHaveBeenCalled();
  });

  it('returns missing_params when orderNumber is absent', async () => {
    const result = await handleOrderFulfilled({ memberId: 'mem-1' });
    expect(result.sent).toBe(false);
    expect(result.reason).toBe('missing_params');
  });

  it('returns missing_params for empty call', async () => {
    const result = await handleOrderFulfilled();
    expect(result.sent).toBe(false);
    expect(result.reason).toBe('missing_params');
  });

  it('handles smsService failure gracefully', async () => {
    mockSendOrderShippedSMS.mockRejectedValue(new Error('Twilio down'));

    const result = await handleOrderFulfilled({
      memberId: 'mem-1',
      orderNumber: 'ORD-001',
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('error');
  });

  it('passes through opt-out reason from smsService', async () => {
    mockSendOrderShippedSMS.mockResolvedValue({ success: false, reason: 'sms_disabled' });

    const result = await handleOrderFulfilled({
      memberId: 'mem-1',
      orderNumber: 'ORD-001',
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('sms_disabled');
  });
});

// ── handleDeliveryConfirmed ─────────────────────────────────────────

describe('handleDeliveryConfirmed', () => {
  it('sends delivery confirmed SMS', async () => {
    const result = await handleDeliveryConfirmed({
      memberId: 'mem-1',
      orderNumber: 'ORD-001',
    });

    expect(result.sent).toBe(true);
    expect(mockSendDeliveryConfirmedSMS).toHaveBeenCalledWith({
      memberId: 'mem-1',
      orderNumber: 'ORD-001',
    });
  });

  it('returns missing_params without memberId', async () => {
    const result = await handleDeliveryConfirmed({ orderNumber: 'ORD-001' });
    expect(result.sent).toBe(false);
    expect(result.reason).toBe('missing_params');
  });

  it('returns missing_params without orderNumber', async () => {
    const result = await handleDeliveryConfirmed({ memberId: 'mem-1' });
    expect(result.sent).toBe(false);
    expect(result.reason).toBe('missing_params');
  });

  it('handles smsService failure gracefully', async () => {
    mockSendDeliveryConfirmedSMS.mockRejectedValue(new Error('Network error'));

    const result = await handleDeliveryConfirmed({
      memberId: 'mem-1',
      orderNumber: 'ORD-001',
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe('error');
  });
});

// ── Admin endpoints ─────────────────────────────────────────────────

describe('triggerOrderShippedSMS', () => {
  it('delegates to handleOrderFulfilled', async () => {
    const result = await triggerOrderShippedSMS('mem-1', 'ORD-001', '1Z123');
    expect(result.sent).toBe(true);
    expect(mockSendOrderShippedSMS).toHaveBeenCalled();
  });
});

describe('triggerDeliveryConfirmedSMS', () => {
  it('delegates to handleDeliveryConfirmed', async () => {
    const result = await triggerDeliveryConfirmedSMS('mem-1', 'ORD-001');
    expect(result.sent).toBe(true);
    expect(mockSendDeliveryConfirmedSMS).toHaveBeenCalled();
  });
});
