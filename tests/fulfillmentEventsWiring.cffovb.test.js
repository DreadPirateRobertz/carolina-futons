/**
 * @file fulfillmentEventsWiring.cffovb.test.js
 * @description cf-fovb — events.js wires wixEcom_onFulfillmentCreated and
 * wixEcom_onFulfillmentUpdated to handleFulfillmentShippingNotification in
 * emailAutomation.web. Same wiring contract that cf-jmmk's onOrderDelivered
 * fix established: Wix only dispatches handlers exported from events.js.
 *
 * Verifies:
 *   - Both event handlers exist and dispatch on a fresh fulfillment event
 *   - Helper receives the event payload verbatim
 *   - Updated handler also dispatches (fires on tracking-number changes)
 *   - Helper-throw is caught at the events.js boundary so a downstream throw
 *     can't propagate up the Wix dispatcher and break neighboring listeners
 *   - Existing onOrderFulfilled SMS handler is NOT regressed (no double-fire)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { __reset as __resetData } from './__mocks__/wix-data.js';

const mockHandleFulfillmentShippingNotification = vi.fn();
const mockHandleOrderDelivered = vi.fn();

vi.mock('backend/emailAutomation.web', () => ({
  handleFulfillmentShippingNotification: mockHandleFulfillmentShippingNotification,
  handleOrderDelivered: mockHandleOrderDelivered,
  // events.js dynamically imports many other helpers; stub the ones touched
  // by un-related event handlers to harmless no-ops so unrelated handlers
  // don't blow up if they happen to fire during this suite.
  triggerRestockNotifications: vi.fn().mockResolvedValue({ success: true, notified: 0 }),
  triggerWelcomeSequence: vi.fn().mockResolvedValue({ success: true, queued: 3 }),
  triggerPostPurchaseSequence: vi.fn().mockResolvedValue({ success: true, queued: 3 }),
  cancelSequenceForOrder: vi.fn().mockResolvedValue({ success: true }),
}));

import {
  wixEcom_onFulfillmentCreated,
  wixEcom_onFulfillmentUpdated,
  wixEcom_onOrderFulfilled,
} from '../src/backend/events.js';

beforeEach(() => {
  __resetData();
  vi.clearAllMocks();
});

const fulfillmentEvent = (overrides = {}) => ({
  entity: {
    _id: 'fulfillment-001',
    orderNumber: '10042',
    order: {
      number: '10042',
      buyerInfo: { email: 'shopper@example.com', contactId: 'contact-7', firstName: 'Asha' },
      billingInfo: { firstName: 'Asha' },
    },
    trackingInfo: {
      trackingNumber: '1ZW123456789',
      shippingProvider: 'UPS',
      trackingLink: 'https://wwwapps.ups.com/tracking/tracking.cgi?tracknum=1ZW123456789',
    },
    ...overrides,
  },
});

describe('cf-fovb · wixEcom_onFulfillmentCreated wiring', () => {
  it('delegates to handleFulfillmentShippingNotification with the event payload', async () => {
    const ev = fulfillmentEvent();
    await wixEcom_onFulfillmentCreated(ev);
    expect(mockHandleFulfillmentShippingNotification).toHaveBeenCalledTimes(1);
    expect(mockHandleFulfillmentShippingNotification).toHaveBeenCalledWith(ev);
  });

  it('does not throw upstream when the helper synchronously throws', async () => {
    mockHandleFulfillmentShippingNotification.mockImplementationOnce(() => {
      throw new Error('downstream boom');
    });
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(wixEcom_onFulfillmentCreated(fulfillmentEvent())).resolves.toBeUndefined();
    expect(consoleErr).toHaveBeenCalledWith(
      expect.stringContaining('Error handling fulfillment created'),
      expect.any(Error),
    );
    consoleErr.mockRestore();
  });
});

describe('cf-fovb · wixEcom_onFulfillmentUpdated wiring', () => {
  it('delegates to handleFulfillmentShippingNotification with the event payload', async () => {
    const ev = fulfillmentEvent({
      trackingInfo: {
        trackingNumber: '1ZW999000111', // tracking number changed
        shippingProvider: 'UPS',
        trackingLink: 'https://example.com/track/1ZW999000111',
      },
    });
    await wixEcom_onFulfillmentUpdated(ev);
    expect(mockHandleFulfillmentShippingNotification).toHaveBeenCalledTimes(1);
    expect(mockHandleFulfillmentShippingNotification).toHaveBeenCalledWith(ev);
  });

  it('does not throw upstream when the helper synchronously throws', async () => {
    mockHandleFulfillmentShippingNotification.mockImplementationOnce(() => {
      throw new Error('downstream boom');
    });
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(wixEcom_onFulfillmentUpdated(fulfillmentEvent())).resolves.toBeUndefined();
    expect(consoleErr).toHaveBeenCalledWith(
      expect.stringContaining('Error handling fulfillment updated'),
      expect.any(Error),
    );
    consoleErr.mockRestore();
  });

  it('Created and Updated dispatch the SAME helper (single source of truth)', async () => {
    // Pin: future maintainers might be tempted to add a separate
    // handleFulfillmentUpdated helper. The helper's tracking-number-presence
    // guard already does the right thing for both cases, so the wiring stays
    // unified.
    await wixEcom_onFulfillmentCreated(fulfillmentEvent());
    await wixEcom_onFulfillmentUpdated(fulfillmentEvent());
    expect(mockHandleFulfillmentShippingNotification).toHaveBeenCalledTimes(2);
  });
});

describe('cf-fovb · onOrderFulfilled SMS handler regression', () => {
  it('does NOT call handleFulfillmentShippingNotification (SMS is a separate concern)', async () => {
    // The SMS path runs through notificationOrchestrator#handleOrderFulfilled,
    // not through emailAutomation. cf-fovb adds email dispatch on the
    // fulfillment events; onOrderFulfilled keeps its prior SMS-only behaviour
    // so we don't double-up notifications on full-shipment orders.
    await wixEcom_onOrderFulfilled({
      entity: {
        number: '10042',
        buyerInfo: { memberId: 'member-7' },
        fulfillmentStatus: { trackingInfo: { trackingNumber: '1ZW123' } },
      },
    });
    expect(mockHandleFulfillmentShippingNotification).not.toHaveBeenCalled();
  });
});
