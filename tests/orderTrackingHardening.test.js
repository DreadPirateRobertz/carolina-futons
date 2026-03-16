import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler } from './__mocks__/wix-fetch.js';
import { sampleOrder } from './fixtures/products.js';
import {
  lookupOrder,
  subscribeToNotifications,
  unsubscribeFromNotifications,
  getTrackingTimeline,
} from '../src/backend/orderTracking.web.js';

// ── Helpers ─────────────────────────────────────────────────────────

const fulfillmentRecord = {
  _id: 'ful-001',
  orderId: 'order-001',
  orderNumber: '10042',
  trackingNumber: '1Z999AA10123456784',
  carrier: 'UPS',
  serviceName: 'UPS Ground',
  serviceCode: '03',
  status: 'IN_TRANSIT',
  createdDate: new Date(),
};

function buildTrackingMock(statusCode, description = 'Status') {
  return (url) => {
    if (url.includes('/oauth/token')) {
      return {
        ok: true,
        async json() { return { access_token: 'tok', expires_in: '3600' }; },
        async text() { return ''; },
      };
    }
    if (url.includes('/track/')) {
      return {
        ok: true,
        async json() {
          return {
            trackResponse: {
              shipment: [{
                package: [{
                  currentStatus: { description, code: statusCode },
                  deliveryDate: [{ date: '20250625' }],
                  weight: { weight: '85' },
                  activity: [{
                    status: { description, code: statusCode },
                    location: { address: { city: 'Charlotte', stateProvince: 'NC', countryCode: 'US' } },
                    date: '20250620',
                    time: '120000',
                  }],
                }],
              }],
            },
          };
        },
        async text() { return ''; },
      };
    }
    return { ok: true, async json() { return {}; }, async text() { return ''; } };
  };
}

function setupDefaultMocks() {
  __setSecrets({
    UPS_CLIENT_ID: 'test-client-id',
    UPS_CLIENT_SECRET: 'test-client-secret',
    UPS_ACCOUNT_NUMBER: '123456',
    UPS_SANDBOX: 'true',
  });
  __setHandler(buildTrackingMock('IT', 'In Transit'));
}

beforeEach(() => {
  __seed('Stores/Orders', [sampleOrder]);
  __seed('Fulfillments', [fulfillmentRecord]);
  __seed('TrackingNotifications', []);
  setupDefaultMocks();
});

// ── lookupOrder: exception & error statuses ─────────────────────────

describe('lookupOrder exception/error status handling', () => {
  it('shows EXCEPTION status with step=-1 (no timeline steps completed except Order Placed)', async () => {
    __seed('Fulfillments', [{ ...fulfillmentRecord, status: 'EXCEPTION' }]);
    __setHandler(buildTrackingMock('X', 'Exception'));

    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.order.status).toBe('Exception');
    expect(result.order.statusDescription).toContain('issue');
    // step=-1: no steps should be marked completed
    expect(result.timeline.every(s => !s.completed)).toBe(true);
    expect(result.timeline.every(s => !s.current)).toBe(true);
  });

  it('shows RETURNED status with step=-1', async () => {
    __seed('Fulfillments', [{ ...fulfillmentRecord, status: 'RETURNED' }]);
    __setHandler(buildTrackingMock('RS', 'Returned'));

    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.order.status).toBe('Returned');
    expect(result.timeline.every(s => !s.completed)).toBe(true);
  });

  it('shows UNKNOWN status with step=-1 for unrecognized fulfillment status', async () => {
    __seed('Fulfillments', [{ ...fulfillmentRecord, status: 'SOMETHING_WEIRD' }]);

    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.order.status).toBe('Unknown');
    expect(result.timeline.every(s => !s.completed)).toBe(true);
  });

  it('shows OUT_FOR_DELIVERY with steps 0-3 completed', async () => {
    __seed('Fulfillments', [{ ...fulfillmentRecord, status: 'OUT_FOR_DELIVERY' }]);
    __setHandler(buildTrackingMock('OD', 'Out for Delivery'));

    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.order.status).toBe('Out for Delivery');
    expect(result.timeline[0].completed).toBe(true); // Order Placed
    expect(result.timeline[1].completed).toBe(true); // Shipped
    expect(result.timeline[2].completed).toBe(true); // In Transit
    expect(result.timeline[3].completed).toBe(true); // Out for Delivery
    expect(result.timeline[3].current).toBe(true);
    expect(result.timeline[4].completed).toBe(false); // Not delivered yet
  });

  it('shows LABEL_CREATED with only step 0-1 completed', async () => {
    __seed('Fulfillments', [{ ...fulfillmentRecord, status: 'LABEL_CREATED' }]);
    __setHandler(buildTrackingMock('M', 'Manifest'));

    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.order.status).toBe('Label Created');
    expect(result.timeline[0].completed).toBe(true);  // Order Placed
    expect(result.timeline[1].completed).toBe(true);  // Shipped (step 1)
    expect(result.timeline[1].current).toBe(true);
    expect(result.timeline[2].completed).toBe(false);
  });

  it('shows PICKED_UP with steps 0-2 completed', async () => {
    __seed('Fulfillments', [{ ...fulfillmentRecord, status: 'PICKED_UP' }]);
    __setHandler(buildTrackingMock('P', 'Picked Up'));

    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.order.status).toBe('Picked Up');
    expect(result.timeline[0].completed).toBe(true);
    expect(result.timeline[1].completed).toBe(true);
    expect(result.timeline[2].completed).toBe(true); // step 2
    expect(result.timeline[2].current).toBe(true);
    expect(result.timeline[3].completed).toBe(false);
  });
});

// ── lookupOrder: edge cases ─────────────────────────────────────────

describe('lookupOrder edge cases', () => {
  it('handles order with no lineItems', async () => {
    __seed('Stores/Orders', [{ ...sampleOrder, lineItems: undefined }]);
    __seed('Fulfillments', []);
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.lineItems).toEqual([]);
  });

  it('handles order with no totals', async () => {
    __seed('Stores/Orders', [{ ...sampleOrder, totals: undefined }]);
    __seed('Fulfillments', []);
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.totals.subtotal).toBe(0);
    expect(result.totals.shipping).toBe(0);
    expect(result.totals.total).toBe(0);
  });

  it('handles line item with no mediaItem or image', async () => {
    __seed('Stores/Orders', [{
      ...sampleOrder,
      lineItems: [{ name: 'Test Item', quantity: 2 }],
    }]);
    __seed('Fulfillments', []);
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.lineItems[0].image).toBeNull();
    expect(result.lineItems[0].sku).toBe('');
    expect(result.lineItems[0].price).toBe(0);
  });

  it('handles order with no shippingInfo', async () => {
    __seed('Stores/Orders', [{ ...sampleOrder, shippingInfo: undefined }]);
    __seed('Fulfillments', []);
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.shipping.shippingAddress.city).toBe('');
    expect(result.shipping.shippingAddress.state).toBe('');
  });

  it('handles order with no buyerInfo (null)', async () => {
    __seed('Stores/Orders', [{ ...sampleOrder, buyerInfo: null }]);
    // buyerEmail becomes '' which won't match any input
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(false);
  });

  it('handles order with no paymentStatus', async () => {
    __seed('Stores/Orders', [{ ...sampleOrder, paymentStatus: undefined }]);
    __seed('Fulfillments', []);
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.order.paymentStatus).toBe('UNKNOWN');
  });

  it('handles fulfillment with estimatedDelivery but no live tracking', async () => {
    __seed('Fulfillments', [{
      ...fulfillmentRecord,
      estimatedDelivery: '2025-07-01',
    }]);
    // UPS tracking fails
    __setHandler((url) => {
      if (url.includes('/oauth/token')) {
        return { ok: true, async json() { return { access_token: 't', expires_in: '3600' }; }, async text() { return ''; } };
      }
      return { ok: false, status: 500, async json() { return {}; }, async text() { return 'Error'; } };
    });

    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    // Should fall back to fulfillment.estimatedDelivery
    expect(result.shipping.estimatedDelivery).toBe('2025-07-01');
  });
});

// ── subscribeToNotifications edge cases ──────────────────────────────

describe('subscribeToNotifications edge cases', () => {
  it('normalizes email case for comparison', async () => {
    const result = await subscribeToNotifications('10042', 'JANE@EXAMPLE.COM');
    expect(result.success).toBe(true);
  });

  it('handles null order number', async () => {
    const result = await subscribeToNotifications(null, 'jane@example.com');
    expect(result.success).toBe(false);
  });

  it('handles null email', async () => {
    const result = await subscribeToNotifications('10042', null);
    expect(result.success).toBe(false);
  });

  it('handles XSS in order number', async () => {
    // sanitize + regex strip should clean this
    const result = await subscribeToNotifications('<img onerror=alert(1)>10042', 'jane@example.com');
    // After sanitization, the cleaned order number should be "10042"
    expect(result.success).toBe(true);
  });
});

// ── unsubscribeFromNotifications edge cases ──────────────────────────

describe('unsubscribeFromNotifications edge cases', () => {
  it('handles null inputs', async () => {
    const result = await unsubscribeFromNotifications(null, null);
    expect(result.success).toBe(false);
  });

  it('sanitizes order number with special chars', async () => {
    // Even with special chars, should not throw — just clean and query
    const result = await unsubscribeFromNotifications('<script>test</script>', 'jane@example.com');
    expect(result.success).toBe(true); // No match, but succeeds silently
  });
});

// ── getTrackingTimeline: all status code mappings ───────────────────

describe('getTrackingTimeline status code mapping completeness', () => {
  const statusCases = [
    { code: 'D', expected: 'DELIVERED', label: 'Delivered' },
    { code: 'IT', expected: 'IN_TRANSIT', label: 'In Transit' },
    { code: 'I', expected: 'IN_TRANSIT', label: 'In Transit' },
    { code: 'OD', expected: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
    { code: 'M', expected: 'LABEL_CREATED', label: 'Label Created' },
    { code: 'P', expected: 'PICKED_UP', label: 'Picked Up' },
    { code: 'X', expected: 'EXCEPTION', label: 'Exception' },
    { code: 'RS', expected: 'RETURNED', label: 'Returned' },
  ];

  for (const { code, expected, label } of statusCases) {
    it(`maps UPS status code "${code}" to ${expected}`, async () => {
      __setHandler(buildTrackingMock(code, label));
      const result = await getTrackingTimeline('1Z999AA10123456784');
      expect(result.success).toBe(true);
      expect(result.fulfillmentStatus).toBe(expected);
      expect(result.statusLabel).toBe(label);
    });
  }

  it('defaults unknown status code to IN_TRANSIT', async () => {
    __setHandler(buildTrackingMock('ZZ', 'Unknown'));
    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result.success).toBe(true);
    expect(result.fulfillmentStatus).toBe('IN_TRANSIT');
  });

  it('handles lowercase status code from UPS', async () => {
    __setHandler(buildTrackingMock('d', 'Delivered'));
    const result = await getTrackingTimeline('1Z999AA10123456784');
    // Code is uppercased in source: code.toUpperCase()
    expect(result.fulfillmentStatus).toBe('DELIVERED');
  });

  it('handles null status code from UPS gracefully', async () => {
    __setHandler((url) => {
      if (url.includes('/oauth/token')) {
        return { ok: true, async json() { return { access_token: 't', expires_in: '3600' }; }, async text() { return ''; } };
      }
      if (url.includes('/track/')) {
        return {
          ok: true,
          async json() {
            return {
              trackResponse: {
                shipment: [{
                  package: [{
                    currentStatus: { description: 'Unknown', code: null },
                    activity: [],
                  }],
                }],
              },
            };
          },
          async text() { return ''; },
        };
      }
      return { ok: true, async json() { return {}; }, async text() { return ''; } };
    });

    // trackShipment normalizes this — UPS mock returns success with null code
    // The source at line 287 does `(tracking.statusCode || '').toUpperCase()`
    // so null → '' → uppercased '' → defaults to IN_TRANSIT
    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result.success).toBe(true);
    expect(result.fulfillmentStatus).toBe('IN_TRANSIT');
  });
});

// ── getTrackingTimeline: timeline correctness per status ────────────

describe('getTrackingTimeline timeline step correctness', () => {
  it('DELIVERED: all 5 steps completed, step 4 current', async () => {
    __setHandler(buildTrackingMock('D', 'Delivered'));
    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result.timeline.every(s => s.completed)).toBe(true);
    expect(result.timeline[4].current).toBe(true);
    expect(result.timeline[3].current).toBe(false);
  });

  it('OUT_FOR_DELIVERY: steps 0-3 completed, step 3 current', async () => {
    __setHandler(buildTrackingMock('OD', 'Out for Delivery'));
    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result.timeline[0].completed).toBe(true);
    expect(result.timeline[1].completed).toBe(true);
    expect(result.timeline[2].completed).toBe(true);
    expect(result.timeline[3].completed).toBe(true);
    expect(result.timeline[3].current).toBe(true);
    expect(result.timeline[4].completed).toBe(false);
  });

  it('EXCEPTION: no steps completed (step=-1)', async () => {
    __setHandler(buildTrackingMock('X', 'Exception'));
    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result.timeline.every(s => !s.completed)).toBe(true);
    expect(result.timeline.every(s => !s.current)).toBe(true);
  });

  it('RETURNED: no steps completed (step=-1)', async () => {
    __setHandler(buildTrackingMock('RS', 'Returned'));
    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result.timeline.every(s => !s.completed)).toBe(true);
  });
});

// ── getTrackingTimeline: input sanitization ─────────────────────────

describe('getTrackingTimeline input handling', () => {
  it('strips non-alphanumeric chars from tracking number', async () => {
    // "1Z-999-AA1-0123456784" → "1Z999AA10123456784"
    const result = await getTrackingTimeline('1Z-999-AA1-0123456784');
    expect(result.success).toBe(true);
  });

  it('handles null tracking number', async () => {
    const result = await getTrackingTimeline(null);
    expect(result.success).toBe(false);
  });

  it('handles undefined tracking number', async () => {
    const result = await getTrackingTimeline(undefined);
    expect(result.success).toBe(false);
  });

  it('handles numeric tracking number', async () => {
    // sanitize expects string; Number input → sanitize returns ''
    const result = await getTrackingTimeline(12345);
    expect(result.success).toBe(false);
  });
});
