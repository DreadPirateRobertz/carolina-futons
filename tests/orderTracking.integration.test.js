import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler } from './__mocks__/wix-fetch.js';
import { sampleOrder } from './fixtures/products.js';
import {
  lookupOrder,
  subscribeToNotifications,
  unsubscribeFromNotifications,
  getTrackingTimeline,
} from '../src/backend/orderTracking.web.js';

// ── UPS mock helpers ────────────────────────────────────────────────

function upsTrackingResponse(statusCode, statusDescription, activities = [], deliveryDate = null) {
  return {
    trackResponse: {
      shipment: [{
        package: [{
          currentStatus: { description: statusDescription, code: statusCode },
          deliveryDate: deliveryDate ? [{ date: deliveryDate }] : [],
          weight: { weight: '85' },
          activity: activities,
        }],
      }],
    },
  };
}

function upsActivity(desc, code, city, state, date, time) {
  return {
    status: { description: desc, code },
    location: { address: { city, stateProvince: state, countryCode: 'US' } },
    date,
    time,
  };
}

function setupUPS(trackHandler) {
  __setSecrets({
    UPS_CLIENT_ID: 'test-client-id',
    UPS_CLIENT_SECRET: 'test-client-secret',
    UPS_ACCOUNT_NUMBER: '123456',
    UPS_SANDBOX: 'true',
  });

  __setHandler((url) => {
    if (url.includes('/oauth/token')) {
      return {
        ok: true,
        async json() { return { access_token: 'mock-token', expires_in: '3600' }; },
        async text() { return ''; },
      };
    }
    if (url.includes('/track/')) return trackHandler(url);
    return { ok: true, async json() { return {}; }, async text() { return ''; } };
  });
}

function setupUPSWithStatus(statusCode, statusDesc, activities = [], deliveryDate = null) {
  setupUPS(() => ({
    ok: true,
    async json() { return upsTrackingResponse(statusCode, statusDesc, activities, deliveryDate); },
    async text() { return ''; },
  }));
}

// ── Fixtures ────────────────────────────────────────────────────────

const FULFILLMENT_IN_TRANSIT = {
  _id: 'ful-001',
  orderId: 'order-001',
  orderNumber: '10042',
  trackingNumber: '1Z999AA10123456784',
  carrier: 'UPS',
  serviceName: 'UPS Ground',
  status: 'IN_TRANSIT',
};

const FULFILLMENT_DELIVERED = {
  ...FULFILLMENT_IN_TRANSIT,
  status: 'DELIVERED',
};

const FULFILLMENT_NO_TRACKING = {
  _id: 'ful-002',
  orderId: 'order-001',
  orderNumber: '10042',
  carrier: 'UPS',
  serviceName: 'UPS Ground',
  status: 'LABEL_CREATED',
};

const NOTIFICATION_ACTIVE = {
  _id: 'notif-001',
  email: 'jane@example.com',
  orderNumber: '10042',
  trackingNumber: '1Z999AA10123456784',
  enabled: true,
};

const IN_TRANSIT_ACTIVITIES = [
  upsActivity('Departed Facility', 'DP', 'Charlotte', 'NC', '20250620', '080000'),
  upsActivity('Origin Scan', 'OR', 'Hendersonville', 'NC', '20250619', '160000'),
];

// ── Tests ───────────────────────────────────────────────────────────

describe('Order Tracking Integration', () => {
  beforeEach(() => {
    resetData();
    __seed('Stores/Orders', [sampleOrder]);
    __seed('Fulfillments', [FULFILLMENT_IN_TRANSIT]);
    __seed('TrackingNotifications', []);
    setupUPSWithStatus('IT', 'In Transit', IN_TRANSIT_ACTIVITIES, '20250625');
  });

  // ── Full order lookup flow ────────────────────────────────────────

  describe('full order lookup flow', () => {
    it('returns complete order with tracking, timeline, items, and totals', async () => {
      const result = await lookupOrder('10042', 'jane@example.com');

      expect(result.success).toBe(true);
      expect(result.order.number).toBe('10042');
      expect(result.order.status).toBe('In Transit');
      expect(result.order.fulfillmentStatus).toBe('IN_TRANSIT');
      expect(result.order.paymentStatus).toBe('PAID');
      expect(result.shipping.carrier).toBe('UPS');
      expect(result.shipping.trackingNumber).toBe('1Z999AA10123456784');
      expect(result.shipping.estimatedDelivery).toBe('20250625');
      expect(result.tracking.activities).toHaveLength(2);
      expect(result.lineItems).toHaveLength(2);
      expect(result.totals.total).toBe(877.99);
      expect(result.timeline).toHaveLength(5);
    });
  });

  // ── Timeline progression through status lifecycle ─────────────────

  describe('timeline progression through status lifecycle', () => {
    it.each([
      ['NOT_FULFILLED', 'Processing', 0, { step0: true, step1: false, step4: false }],
      ['LABEL_CREATED', 'Label Created', 1, { step0: true, step1: true, step2: false }],
      ['IN_TRANSIT', 'In Transit', 2, { step0: true, step1: true, step2: true, step3: false }],
      ['OUT_FOR_DELIVERY', 'Out for Delivery', 3, { step0: true, step3: true, step4: false }],
      ['DELIVERED', 'Delivered', 4, { step0: true, step4: true }],
    ])('status %s → label "%s", current step %d', async (status, label, currentStep, checks) => {
      __seed('Fulfillments', [{ ...FULFILLMENT_IN_TRANSIT, status }]);

      // Set up UPS to return matching status code
      const codeMap = {
        NOT_FULFILLED: ['M', 'Manifest'],
        LABEL_CREATED: ['M', 'Label Created'],
        IN_TRANSIT: ['IT', 'In Transit'],
        OUT_FOR_DELIVERY: ['OD', 'Out for Delivery'],
        DELIVERED: ['D', 'Delivered'],
      };
      const [code, desc] = codeMap[status];
      setupUPSWithStatus(code, desc, [], '20250625');

      const result = await lookupOrder('10042', 'jane@example.com');
      expect(result.success).toBe(true);
      expect(result.order.status).toBe(label);

      // Verify timeline step completion
      for (const [key, expected] of Object.entries(checks)) {
        const stepIdx = Number(key.replace('step', ''));
        expect(result.timeline[stepIdx].completed).toBe(expected);
      }

      // Current step is marked
      expect(result.timeline[currentStep].current).toBe(true);
    });

    it('exception status marks no steps as current (step -1)', async () => {
      __seed('Fulfillments', [{ ...FULFILLMENT_IN_TRANSIT, status: 'EXCEPTION' }]);
      setupUPSWithStatus('X', 'Exception');

      const result = await lookupOrder('10042', 'jane@example.com');
      expect(result.order.status).toBe('Exception');
      // All timeline steps should be not-completed (step -1 means none match)
      result.timeline.forEach(step => {
        expect(step.completed).toBe(false);
        expect(step.current).toBe(false);
      });
    });

    it('returned status also marks no steps as current', async () => {
      __seed('Fulfillments', [{ ...FULFILLMENT_IN_TRANSIT, status: 'RETURNED' }]);
      setupUPSWithStatus('RS', 'Returned to Sender');

      const result = await lookupOrder('10042', 'jane@example.com');
      expect(result.order.status).toBe('Returned');
      result.timeline.forEach(step => {
        expect(step.completed).toBe(false);
      });
    });
  });

  // ── Carrier tracking integration ──────────────────────────────────

  describe('carrier tracking integration', () => {
    it('includes UPS activity timeline with locations', async () => {
      const result = await lookupOrder('10042', 'jane@example.com');
      expect(result.tracking.activities[0].location).toContain('Charlotte');
      expect(result.tracking.activities[1].location).toContain('Hendersonville');
    });

    it('returns null tracking when no fulfillment exists', async () => {
      __seed('Fulfillments', []);
      const result = await lookupOrder('10042', 'jane@example.com');
      expect(result.tracking).toBeNull();
      expect(result.shipping.trackingNumber).toBeNull();
    });

    it('returns null tracking when fulfillment has no tracking number', async () => {
      __seed('Fulfillments', [FULFILLMENT_NO_TRACKING]);
      const result = await lookupOrder('10042', 'jane@example.com');
      expect(result.tracking).toBeNull();
    });

    it('returns order info even when UPS API fails', async () => {
      setupUPS(() => ({
        ok: false,
        status: 500,
        async json() { return {}; },
        async text() { return 'Server Error'; },
      }));

      const result = await lookupOrder('10042', 'jane@example.com');
      expect(result.success).toBe(true);
      expect(result.order.number).toBe('10042');
      expect(result.tracking).toBeNull();
    });

    it('getTrackingTimeline returns standalone timeline for tracking number', async () => {
      const result = await getTrackingTimeline('1Z999AA10123456784');
      expect(result.success).toBe(true);
      expect(result.fulfillmentStatus).toBe('IN_TRANSIT');
      expect(result.statusLabel).toBe('In Transit');
      expect(result.timeline[2].current).toBe(true);
      expect(result.activities).toHaveLength(2);
    });

    it.each([
      ['D', 'DELIVERED', 'Delivered', 4],
      ['IT', 'IN_TRANSIT', 'In Transit', 2],
      ['OD', 'OUT_FOR_DELIVERY', 'Out for Delivery', 3],
      ['M', 'LABEL_CREATED', 'Label Created', 1],
      ['P', 'PICKED_UP', 'Picked Up', 2],
      ['X', 'EXCEPTION', 'Exception', -1],
      ['RS', 'RETURNED', 'Returned', -1],
    ])('getTrackingTimeline maps UPS code %s → %s', async (code, expectedStatus, expectedLabel, expectedStep) => {
      setupUPSWithStatus(code, expectedLabel);
      const result = await getTrackingTimeline('1Z999AA10123456784');
      expect(result.fulfillmentStatus).toBe(expectedStatus);
      expect(result.statusLabel).toBe(expectedLabel);
      if (expectedStep >= 0) {
        expect(result.timeline[expectedStep].current).toBe(true);
      }
    });

    it('getTrackingTimeline rejects empty tracking number', async () => {
      const result = await getTrackingTimeline('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('getTrackingTimeline handles UPS network failure', async () => {
      __setHandler(() => { throw new Error('Network down'); });
      const result = await getTrackingTimeline('1Z999AA10123456784');
      expect(result.success).toBe(false);
    });
  });

  // ── Email notification lifecycle ──────────────────────────────────

  describe('email notification lifecycle', () => {
    it('subscribe → lookup shows enabled → unsubscribe → lookup shows disabled', async () => {
      // Step 1: Subscribe
      const subResult = await subscribeToNotifications('10042', 'jane@example.com');
      expect(subResult.success).toBe(true);
      expect(subResult.alreadySubscribed).toBe(false);

      // Step 2: Lookup shows notifications enabled
      const lookup1 = await lookupOrder('10042', 'jane@example.com');
      expect(lookup1.notificationsEnabled).toBe(true);

      // Step 3: Unsubscribe
      const unsubResult = await unsubscribeFromNotifications('10042', 'jane@example.com');
      expect(unsubResult.success).toBe(true);

      // Step 4: Lookup shows notifications disabled
      const lookup2 = await lookupOrder('10042', 'jane@example.com');
      expect(lookup2.notificationsEnabled).toBe(false);
    });

    it('re-subscribing after unsubscribe re-enables', async () => {
      // Subscribe, unsubscribe, re-subscribe
      await subscribeToNotifications('10042', 'jane@example.com');
      await unsubscribeFromNotifications('10042', 'jane@example.com');
      const result = await subscribeToNotifications('10042', 'jane@example.com');
      expect(result.success).toBe(true);

      const lookup = await lookupOrder('10042', 'jane@example.com');
      expect(lookup.notificationsEnabled).toBe(true);
    });

    it('duplicate subscribe returns alreadySubscribed', async () => {
      await subscribeToNotifications('10042', 'jane@example.com');
      const second = await subscribeToNotifications('10042', 'jane@example.com');
      expect(second.success).toBe(true);
      expect(second.alreadySubscribed).toBe(true);
    });

    it('subscribe stores tracking number from fulfillment', async () => {
      let inserted = null;
      __onInsert((col, item) => {
        if (col === 'TrackingNotifications') inserted = item;
      });

      await subscribeToNotifications('10042', 'jane@example.com');
      expect(inserted.trackingNumber).toBe('1Z999AA10123456784');
    });

    it('subscribe with no fulfillment stores empty tracking number', async () => {
      __seed('Fulfillments', []);
      let inserted = null;
      __onInsert((col, item) => {
        if (col === 'TrackingNotifications') inserted = item;
      });

      await subscribeToNotifications('10042', 'jane@example.com');
      expect(inserted.trackingNumber).toBe('');
    });

    it('unsubscribe is idempotent (no subscription exists)', async () => {
      const result = await unsubscribeFromNotifications('10042', 'jane@example.com');
      expect(result.success).toBe(true);
    });

    it('notifications not checked when order has no tracking number', async () => {
      __seed('Fulfillments', []);
      const result = await lookupOrder('10042', 'jane@example.com');
      expect(result.notificationsEnabled).toBe(false);
    });
  });

  // ── Input validation across all endpoints ─────────────────────────

  describe('input validation across all endpoints', () => {
    it.each([
      ['lookupOrder', (on, em) => lookupOrder(on, em)],
      ['subscribeToNotifications', (on, em) => subscribeToNotifications(on, em)],
    ])('%s rejects wrong email', async (_name, fn) => {
      const result = await fn('10042', 'wrong@example.com');
      expect(result.success).toBe(false);
    });

    it.each([
      ['lookupOrder', (on, em) => lookupOrder(on, em)],
      ['subscribeToNotifications', (on, em) => subscribeToNotifications(on, em)],
    ])('%s rejects nonexistent order', async (_name, fn) => {
      const result = await fn('99999', 'jane@example.com');
      expect(result.success).toBe(false);
    });

    it.each([
      ['lookupOrder', () => lookupOrder('', 'jane@example.com')],
      ['subscribeToNotifications', () => subscribeToNotifications('', 'jane@example.com')],
      ['unsubscribeFromNotifications', () => unsubscribeFromNotifications('', 'jane@example.com')],
    ])('%s rejects empty order number', async (_name, fn) => {
      const result = await fn();
      expect(result.success).toBe(false);
    });

    it('lookupOrder rejects invalid email format', async () => {
      const result = await lookupOrder('10042', 'not-an-email');
      expect(result.success).toBe(false);
    });

    it('lookupOrder is case-insensitive for email matching', async () => {
      const result = await lookupOrder('10042', 'JANE@EXAMPLE.COM');
      expect(result.success).toBe(true);
    });

    it('lookupOrder sanitizes HTML in order number', async () => {
      const result = await lookupOrder('<script>10042</script>', 'jane@example.com');
      expect(result.success).toBe(true);
      expect(result.order.number).toBe('10042');
    });
  });

  // ── Shipping address and line items ───────────────────────────────

  describe('shipping address and line items', () => {
    it('returns shipping address from order', async () => {
      const result = await lookupOrder('10042', 'jane@example.com');
      expect(result.shipping.shippingAddress.city).toBe('Asheville');
      expect(result.shipping.shippingAddress.state).toBe('NC');
      expect(result.shipping.shippingAddress.postalCode).toBe('28801');
    });

    it('returns line item details with name, quantity, sku, price', async () => {
      const result = await lookupOrder('10042', 'jane@example.com');
      expect(result.lineItems).toHaveLength(2);
      const frame = result.lineItems[0];
      expect(frame.name).toBe('Eureka Futon Frame');
      expect(frame.quantity).toBe(1);
      expect(frame.sku).toBe('EUR-FRM-001');
      expect(frame.price).toBe(499);
    });

    it('returns order totals breakdown', async () => {
      const result = await lookupOrder('10042', 'jane@example.com');
      expect(result.totals.subtotal).toBe(848);
      expect(result.totals.shipping).toBe(29.99);
      expect(result.totals.total).toBe(877.99);
    });
  });
});
