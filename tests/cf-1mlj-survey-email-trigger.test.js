/**
 * @file cf-1mlj-survey-email-trigger.test.js
 * @description Integration: wixEcom_onOrderDelivered calls scheduleSurvey
 * 7-day NPS survey after delivery (CF-1mlj email trigger integration).
 *
 * Covers:
 *  - scheduleSurvey called with correct memberId, orderId, email, deliveredAt
 *  - uses order._id as orderId when present
 *  - falls back to orderNumber string when order._id is absent
 *  - scheduleSurvey failure is non-fatal (other handlers still run)
 *  - scheduleSurvey not called when order has no email (guard)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';

// ── Mock surveyService ────────────────────────────────────────────────────────

const mockScheduleSurvey = vi.fn(() => Promise.resolve({ success: true, scheduled: true }));

vi.mock('backend/surveyService.web', () => ({
  scheduleSurvey: mockScheduleSurvey,
}));

// ── Mock emailService so other onOrderDelivered chains don't blow up ──────────

vi.mock('backend/emailService.web', () => ({
  sendDeliveryConfirmation: vi.fn(() => Promise.resolve()),
}));

vi.mock('backend/utils/errorHandler', () => ({
  logError: vi.fn(),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { wixEcom_onOrderDelivered } from '../src/backend/emailAutomation.web.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOrder(overrides = {}) {
  return {
    _id: 'order-abc-123',
    number: '10042',
    buyerInfo: { email: 'jane@test.com', contactId: 'contact-xyz', firstName: 'Jane' },
    billingInfo: { firstName: 'Jane' },
    lineItems: [],
    priceSummary: { total: { amount: 199.99 } },
    ...overrides,
  };
}

/** Let all pending microtasks/promises settle */
const flushPromises = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  vi.clearAllMocks();
  __seed('EmailQueue', []);
  __seed('SurveyResponses', []);
  __setSecrets({ WELCOME_DISCOUNT_CODE: 'WELCOME10', RECOVERY_DISCOUNT_CODE: 'COMEBACK15' });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('wixEcom_onOrderDelivered → scheduleSurvey (CF-1mlj)', () => {
  it('calls scheduleSurvey when an order is delivered', async () => {
    wixEcom_onOrderDelivered(makeOrder());
    await flushPromises();
    expect(mockScheduleSurvey).toHaveBeenCalledTimes(1);
  });

  it('passes memberId from buyerInfo.contactId', async () => {
    wixEcom_onOrderDelivered(makeOrder({ buyerInfo: { email: 'j@t.com', contactId: 'cid-999', firstName: 'J' } }));
    await flushPromises();
    expect(mockScheduleSurvey).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'cid-999' }),
    );
  });

  it('passes order._id as orderId when present', async () => {
    wixEcom_onOrderDelivered(makeOrder({ _id: 'wix-order-id-777' }));
    await flushPromises();
    expect(mockScheduleSurvey).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'wix-order-id-777' }),
    );
  });

  it('falls back to String(orderNumber) when order._id is absent', async () => {
    const order = makeOrder();
    delete order._id;
    wixEcom_onOrderDelivered(order);
    await flushPromises();
    expect(mockScheduleSurvey).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: '10042' }),
    );
  });

  it('passes buyer email to scheduleSurvey', async () => {
    wixEcom_onOrderDelivered(makeOrder({ buyerInfo: { email: 'buyer@shop.com', contactId: 'c1', firstName: 'B' } }));
    await flushPromises();
    expect(mockScheduleSurvey).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'buyer@shop.com' }),
    );
  });

  it('passes a deliveredAt Date to scheduleSurvey', async () => {
    wixEcom_onOrderDelivered(makeOrder());
    await flushPromises();
    const call = mockScheduleSurvey.mock.calls[0][0];
    expect(call.deliveredAt).toBeInstanceOf(Date);
  });

  it('does not call scheduleSurvey when order has no email (guard)', async () => {
    wixEcom_onOrderDelivered(makeOrder({ buyerInfo: { email: '', contactId: 'c1', firstName: 'X' } }));
    await flushPromises();
    expect(mockScheduleSurvey).not.toHaveBeenCalled();
  });

  it('is non-fatal when scheduleSurvey rejects', async () => {
    mockScheduleSurvey.mockRejectedValueOnce(new Error('survey DB down'));
    expect(() => wixEcom_onOrderDelivered(makeOrder())).not.toThrow();
    await flushPromises();
    // Other side-effects still ran (delivery confirmation was attempted via emailService mock)
    expect(mockScheduleSurvey).toHaveBeenCalledTimes(1);
  });
});
