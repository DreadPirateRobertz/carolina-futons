/**
 * @file fulfillmentNotificationHelper.cffovb.test.js
 * @description cf-fovb — handleFulfillmentShippingNotification helper. Pins:
 *   - Parcel tracking → sendShippingNotification with carrier + trackingUrl
 *   - LTL freight tracking → sendFreightShippingNotification with PRO number
 *   - Missing email → no-op
 *   - Missing tracking number → no-op (cf-fovb guard for non-tracking
 *     onFulfillmentUpdated events)
 *   - Field-resolution fallbacks (order.buyerInfo.email vs fulfillment.buyerInfo.email)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('backend/emailService.web', () => ({
  sendShippingNotification: vi.fn().mockResolvedValue({ success: true }),
  sendFreightShippingNotification: vi.fn().mockResolvedValue({ success: true }),
  sendOrderConfirmation: vi.fn().mockResolvedValue({ success: true }),
  sendDeliveryConfirmation: vi.fn().mockResolvedValue({ success: true }),
}));

import { handleFulfillmentShippingNotification } from '../src/backend/emailAutomation.web.js';
import {
  sendShippingNotification as mockSendShippingNotification,
  sendFreightShippingNotification as mockSendFreightShippingNotification,
} from 'backend/emailService.web';

beforeEach(() => {
  vi.clearAllMocks();
});

const baseEvent = (overrides = {}) => ({
  entity: {
    _id: 'fulfillment-001',
    orderNumber: '10042',
    order: {
      number: '10042',
      buyerInfo: { email: 'shopper@example.com', contactId: 'contact-7' },
      billingInfo: { firstName: 'Asha' },
    },
    trackingInfo: {
      trackingNumber: '1ZW123456789',
      shippingProvider: 'UPS',
      trackingLink: 'https://example.com/track/1ZW123456789',
    },
    ...overrides,
  },
});

describe('cf-fovb · handleFulfillmentShippingNotification — parcel tracking', () => {
  it('routes UPS tracking to sendShippingNotification with the parcel template', () => {
    handleFulfillmentShippingNotification(baseEvent());
    expect(mockSendShippingNotification).toHaveBeenCalledTimes(1);
    expect(mockSendFreightShippingNotification).not.toHaveBeenCalled();
    expect(mockSendShippingNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 'contact-7',
        email: 'shopper@example.com',
        firstName: 'Asha',
        orderNumber: '10042',
        trackingNumber: '1ZW123456789',
        trackingUrl: 'https://example.com/track/1ZW123456789',
        carrier: 'UPS',
      }),
    );
  });
});

describe('cf-fovb · handleFulfillmentShippingNotification — LTL freight routing', () => {
  it('routes XPO Logistics tracking to sendFreightShippingNotification', () => {
    handleFulfillmentShippingNotification(baseEvent({
      trackingInfo: {
        trackingNumber: 'XPO-PRO-123',
        shippingProvider: 'XPO Logistics',
      },
    }));
    expect(mockSendFreightShippingNotification).toHaveBeenCalledTimes(1);
    expect(mockSendShippingNotification).not.toHaveBeenCalled();
    const args = mockSendFreightShippingNotification.mock.calls[0][0];
    expect(args.proNumber).toBe('XPO-PRO-123');
    expect(args.carrier).toBeTruthy(); // freight payload sets a display carrier
  });
});

describe('cf-fovb · handleFulfillmentShippingNotification — guards', () => {
  it('no-op when email is absent (no buyer info)', () => {
    handleFulfillmentShippingNotification({
      entity: {
        order: { number: '10042' },
        trackingInfo: { trackingNumber: '1ZW123', shippingProvider: 'UPS' },
      },
    });
    expect(mockSendShippingNotification).not.toHaveBeenCalled();
    expect(mockSendFreightShippingNotification).not.toHaveBeenCalled();
  });

  it('no-op when trackingNumber is absent — cf-fovb guard for non-tracking onFulfillmentUpdated fires', () => {
    // wixEcom_onFulfillmentUpdated also fires for status-only changes (e.g.
    // a fulfillment marked in_progress with no tracking yet). Without a
    // tracking number there is no useful customer-facing partial-shipment
    // email to send — silent no-op.
    handleFulfillmentShippingNotification(baseEvent({
      trackingInfo: { shippingProvider: 'UPS' }, // no trackingNumber
    }));
    expect(mockSendShippingNotification).not.toHaveBeenCalled();
    expect(mockSendFreightShippingNotification).not.toHaveBeenCalled();
  });

  it('falls back to fulfillment.buyerInfo.email when order.buyerInfo is unavailable', () => {
    handleFulfillmentShippingNotification({
      entity: {
        orderNumber: '99001',
        buyerInfo: { email: 'fallback@example.com', contactId: 'contact-fb' },
        trackingInfo: { trackingNumber: '1ZW000', shippingProvider: 'UPS' },
      },
    });
    expect(mockSendShippingNotification).toHaveBeenCalledTimes(1);
    expect(mockSendShippingNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'fallback@example.com',
        contactId: 'contact-fb',
        orderNumber: '99001',
      }),
    );
  });
});
