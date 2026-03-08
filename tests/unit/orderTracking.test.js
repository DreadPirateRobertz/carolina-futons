import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from '../__mocks__/wix-data.js';
import { __setSecrets } from '../__mocks__/wix-secrets-backend.js';
import { __setHandler } from '../__mocks__/wix-fetch.js';
import { sampleOrder } from '../fixtures/products.js';
import {
  lookupOrder,
  subscribeToNotifications,
  unsubscribeFromNotifications,
  getTrackingTimeline,
} from '../../src/backend/orderTracking.web.js';

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

const notificationRecord = {
  _id: 'notif-001',
  email: 'jane@example.com',
  orderNumber: '10042',
  trackingNumber: '1Z999AA10123456784',
  enabled: true,
};

function setupUPSMocks() {
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
    if (url.includes('/track/')) {
      return {
        ok: true,
        async json() {
          return {
            trackResponse: {
              shipment: [{
                package: [{
                  currentStatus: { description: 'In Transit', code: 'IT' },
                  deliveryDate: [{ date: '20250625' }],
                  weight: { weight: '85' },
                  activity: [
                    {
                      status: { description: 'Departed Facility', code: 'DP' },
                      location: { address: { city: 'Charlotte', stateProvince: 'NC', countryCode: 'US' } },
                      date: '20250620',
                      time: '080000',
                    },
                    {
                      status: { description: 'Origin Scan', code: 'OR' },
                      location: { address: { city: 'Hendersonville', stateProvince: 'NC', countryCode: 'US' } },
                      date: '20250619',
                      time: '160000',
                    },
                  ],
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
}

beforeEach(() => {
  __seed('Stores/Orders', [sampleOrder]);
  __seed('Fulfillments', [fulfillmentRecord]);
  __seed('TrackingNotifications', []);
  setupUPSMocks();
});

// ── lookupOrder ─────────────────────────────────────────────────────

describe('lookupOrder', () => {
  it('returns order with tracking details for valid order + email', async () => {
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.order.number).toBe('10042');
    expect(result.order.status).toBe('In Transit');
    expect(result.shipping.trackingNumber).toBe('1Z999AA10123456784');
  });

  it('returns correct order metadata', async () => {
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.order.paymentStatus).toBe('PAID');
    expect(result.order.fulfillmentStatus).toBe('IN_TRANSIT');
  });

  it('returns shipping details', async () => {
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.shipping.carrier).toBe('UPS');
    expect(result.shipping.serviceName).toBe('UPS Ground');
    expect(result.shipping.shippingAddress.city).toBe('Asheville');
    expect(result.shipping.shippingAddress.state).toBe('NC');
  });

  it('returns live UPS tracking data', async () => {
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.tracking).not.toBeNull();
    expect(result.tracking.status).toBe('In Transit');
    expect(result.tracking.activities).toHaveLength(2);
    expect(result.tracking.activities[0].location).toContain('Charlotte');
  });

  it('returns estimated delivery date from UPS', async () => {
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.shipping.estimatedDelivery).toBe('20250625');
  });

  it('returns line items with quantities', async () => {
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0].name).toBe('Eureka Futon Frame');
    expect(result.lineItems[0].quantity).toBe(1);
    expect(result.lineItems[1].name).toBe('Moonshadow Futon Mattress');
  });

  it('returns order totals', async () => {
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.totals.subtotal).toBe(848);
    expect(result.totals.shipping).toBe(29.99);
    expect(result.totals.total).toBe(877.99);
  });

  it('returns timeline with correct step progression', async () => {
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.timeline).toHaveLength(5);
    expect(result.timeline[0].label).toBe('Order Placed');
    expect(result.timeline[0].completed).toBe(true);
    expect(result.timeline[1].label).toBe('Shipped');
    expect(result.timeline[1].completed).toBe(true);
    expect(result.timeline[2].label).toBe('In Transit');
    expect(result.timeline[2].completed).toBe(true);
    expect(result.timeline[2].current).toBe(true);
    expect(result.timeline[3].completed).toBe(false);
    expect(result.timeline[4].completed).toBe(false);
  });

  it('returns notificationsEnabled as false when not subscribed', async () => {
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.notificationsEnabled).toBe(false);
  });

  it('returns notificationsEnabled as true when subscribed', async () => {
    __seed('TrackingNotifications', [notificationRecord]);
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.notificationsEnabled).toBe(true);
  });

  it('rejects wrong email address', async () => {
    const result = await lookupOrder('10042', 'wrong@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects nonexistent order number', async () => {
    const result = await lookupOrder('99999', 'jane@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rejects empty order number', async () => {
    const result = await lookupOrder('', 'jane@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('rejects invalid email format', async () => {
    const result = await lookupOrder('10042', 'not-an-email');
    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('rejects null email', async () => {
    const result = await lookupOrder('10042', null);
    expect(result.success).toBe(false);
  });

  it('is case-insensitive for email', async () => {
    const result = await lookupOrder('10042', 'JANE@EXAMPLE.COM');
    expect(result.success).toBe(true);
  });

  it('handles order with no fulfillment (processing state)', async () => {
    __seed('Fulfillments', []);
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.order.status).toBe('Processing');
    expect(result.shipping.trackingNumber).toBeNull();
    expect(result.tracking).toBeNull();
  });

  it('shows Processing timeline for unfulfilled order', async () => {
    __seed('Fulfillments', []);
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.timeline[0].completed).toBe(true); // Order Placed
    expect(result.timeline[0].current).toBe(true);
    expect(result.timeline[1].completed).toBe(false); // Not shipped yet
  });

  it('handles UPS tracking failure gracefully', async () => {
    __setHandler((url) => {
      if (url.includes('/oauth/token')) {
        return {
          ok: true,
          async json() { return { access_token: 'tok', expires_in: '3600' }; },
          async text() { return ''; },
        };
      }
      return {
        ok: false,
        status: 500,
        async json() { return {}; },
        async text() { return 'Server Error'; },
      };
    });

    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.tracking).toBeNull();
    // Should still return order info even if tracking fails
    expect(result.order.number).toBe('10042');
  });

  it('sanitizes order number with special chars', async () => {
    const result = await lookupOrder('<script>10042</script>', 'jane@example.com');
    // Script tags get stripped, leaving just "10042"
    expect(result.success).toBe(true);
  });

  it('strips HTML from order number', async () => {
    const result = await lookupOrder('10042<img onerror=alert(1)>', 'jane@example.com');
    expect(result.success).toBe(true);
  });

  it('returns correct structure on success', async () => {
    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('order');
    expect(result).toHaveProperty('shipping');
    expect(result).toHaveProperty('tracking');
    expect(result).toHaveProperty('timeline');
    expect(result).toHaveProperty('lineItems');
    expect(result).toHaveProperty('totals');
    expect(result).toHaveProperty('notificationsEnabled');
  });

  it('returns correct structure on failure', async () => {
    const result = await lookupOrder('99999', 'jane@example.com');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('error');
    expect(result.success).toBe(false);
  });
});

// ── lookupOrder with delivered status ───────────────────────────────

describe('lookupOrder delivered status', () => {
  it('shows completed timeline for delivered order', async () => {
    __seed('Fulfillments', [{ ...fulfillmentRecord, status: 'DELIVERED' }]);
    __setHandler((url) => {
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
                    currentStatus: { description: 'Delivered', code: 'D' },
                    deliveryDate: [{ date: '20250622' }],
                    activity: [{
                      status: { description: 'Delivered', code: 'D' },
                      location: { address: { city: 'Asheville', stateProvince: 'NC' } },
                      date: '20250622',
                      time: '140000',
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
    });

    const result = await lookupOrder('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.order.status).toBe('Delivered');
    expect(result.timeline[4].completed).toBe(true); // Delivered step
    expect(result.timeline[4].current).toBe(true);
  });
});

// ── subscribeToNotifications ────────────────────────────────────────

describe('subscribeToNotifications', () => {
  it('creates notification subscription', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'TrackingNotifications') inserted = item;
    });

    const result = await subscribeToNotifications('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.alreadySubscribed).toBe(false);
    expect(inserted).not.toBeNull();
    expect(inserted.email).toBe('jane@example.com');
    expect(inserted.orderNumber).toBe('10042');
    expect(inserted.enabled).toBe(true);
  });

  it('returns alreadySubscribed for duplicate', async () => {
    __seed('TrackingNotifications', [notificationRecord]);
    const result = await subscribeToNotifications('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(result.alreadySubscribed).toBe(true);
  });

  it('re-enables disabled subscription', async () => {
    __seed('TrackingNotifications', [{ ...notificationRecord, enabled: false }]);
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'TrackingNotifications') updated = item;
    });

    const result = await subscribeToNotifications('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(updated).not.toBeNull();
    expect(updated.enabled).toBe(true);
  });

  it('rejects wrong email', async () => {
    const result = await subscribeToNotifications('10042', 'wrong@example.com');
    expect(result.success).toBe(false);
  });

  it('rejects nonexistent order', async () => {
    const result = await subscribeToNotifications('99999', 'jane@example.com');
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', async () => {
    const result = await subscribeToNotifications('10042', 'bademail');
    expect(result.success).toBe(false);
  });

  it('rejects empty order number', async () => {
    const result = await subscribeToNotifications('', 'jane@example.com');
    expect(result.success).toBe(false);
  });

  it('stores tracking number from fulfillment', async () => {
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'TrackingNotifications') inserted = item;
    });

    await subscribeToNotifications('10042', 'jane@example.com');
    expect(inserted.trackingNumber).toBe('1Z999AA10123456784');
  });

  it('handles missing fulfillment gracefully', async () => {
    __seed('Fulfillments', []);
    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'TrackingNotifications') inserted = item;
    });

    const result = await subscribeToNotifications('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(inserted.trackingNumber).toBe('');
  });
});

// ── unsubscribeFromNotifications ────────────────────────────────────

describe('unsubscribeFromNotifications', () => {
  it('disables existing subscription', async () => {
    __seed('TrackingNotifications', [notificationRecord]);
    let updated = null;
    __onUpdate((col, item) => {
      if (col === 'TrackingNotifications') updated = item;
    });

    const result = await unsubscribeFromNotifications('10042', 'jane@example.com');
    expect(result.success).toBe(true);
    expect(updated).not.toBeNull();
    expect(updated.enabled).toBe(false);
  });

  it('succeeds silently when no subscription exists', async () => {
    const result = await unsubscribeFromNotifications('10042', 'jane@example.com');
    expect(result.success).toBe(true);
  });

  it('rejects empty order number', async () => {
    const result = await unsubscribeFromNotifications('', 'jane@example.com');
    expect(result.success).toBe(false);
  });

  it('rejects empty email', async () => {
    const result = await unsubscribeFromNotifications('10042', '');
    expect(result.success).toBe(false);
  });
});

// ── getTrackingTimeline ─────────────────────────────────────────────

describe('getTrackingTimeline', () => {
  it('returns timeline for valid tracking number', async () => {
    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result.success).toBe(true);
    expect(result.status).toBe('In Transit');
    expect(result.fulfillmentStatus).toBe('IN_TRANSIT');
    expect(result.timeline).toHaveLength(5);
  });

  it('returns activities from UPS', async () => {
    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result.activities).toHaveLength(2);
    expect(result.activities[0].location).toContain('Charlotte');
    expect(result.activities[1].location).toContain('Hendersonville');
  });

  it('returns estimated delivery', async () => {
    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result.estimatedDelivery).toBe('20250625');
  });

  it('returns correct timeline progress for in-transit', async () => {
    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result.timeline[0].completed).toBe(true); // Order Placed
    expect(result.timeline[1].completed).toBe(true); // Shipped
    expect(result.timeline[2].completed).toBe(true); // In Transit
    expect(result.timeline[2].current).toBe(true);
    expect(result.timeline[3].completed).toBe(false); // Out for Delivery
    expect(result.timeline[4].completed).toBe(false); // Delivered
  });

  it('maps delivered status correctly', async () => {
    __setHandler((url) => {
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
                    currentStatus: { description: 'Delivered', code: 'D' },
                    deliveryDate: [{ date: '20250622' }],
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

    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result.fulfillmentStatus).toBe('DELIVERED');
    expect(result.statusLabel).toBe('Delivered');
    expect(result.timeline[4].completed).toBe(true);
    expect(result.timeline[4].current).toBe(true);
  });

  it('maps exception status correctly', async () => {
    __setHandler((url) => {
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
                    currentStatus: { description: 'Exception', code: 'X' },
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

    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result.fulfillmentStatus).toBe('EXCEPTION');
    expect(result.statusLabel).toBe('Exception');
  });

  it('rejects empty tracking number', async () => {
    const result = await getTrackingTimeline('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('sanitizes tracking number', async () => {
    const result = await getTrackingTimeline('<script>1Z999AA10123456784</script>');
    // Script tags stripped, alphanumeric preserved
    expect(result.success).toBe(true);
  });

  it('handles UPS API failure', async () => {
    __setHandler((url) => {
      if (url.includes('/oauth/token')) {
        return {
          ok: true,
          async json() { return { access_token: 'tok', expires_in: '3600' }; },
          async text() { return ''; },
        };
      }
      return {
        ok: false,
        status: 404,
        async json() { return {}; },
        async text() { return 'Not Found'; },
      };
    });

    const result = await getTrackingTimeline('1ZINVALID');
    expect(result.success).toBe(false);
  });

  it('handles network error', async () => {
    __setHandler(() => {
      throw new Error('Network down');
    });

    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result.success).toBe(false);
  });

  it('returns correct structure', async () => {
    const result = await getTrackingTimeline('1Z999AA10123456784');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('status');
    expect(result).toHaveProperty('statusCode');
    expect(result).toHaveProperty('fulfillmentStatus');
    expect(result).toHaveProperty('statusLabel');
    expect(result).toHaveProperty('estimatedDelivery');
    expect(result).toHaveProperty('activities');
    expect(result).toHaveProperty('timeline');
  });
});
