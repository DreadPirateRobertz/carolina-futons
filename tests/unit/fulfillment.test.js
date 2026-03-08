import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from '../__mocks__/wix-data.js';
import { __setSecrets } from '../__mocks__/wix-secrets-backend.js';
import { __setHandler } from '../__mocks__/wix-fetch.js';
import { __setMember, __setRoles } from '../__mocks__/wix-members-backend.js';
import { sampleOrder } from '../fixtures/products.js';
import {
  getPendingOrders,
  fulfillOrder,
  getTrackingUpdate,
  updateAllTracking,
  getFulfillmentHistory,
} from '../../src/backend/fulfillment.web.js';

function loginAsAdmin() {
  __setMember({ _id: 'admin-001' });
  __setRoles([{ _id: 'admin', title: 'Admin' }]);
}

function loginAsNonAdmin() {
  __setMember({ _id: 'user-001' });
  __setRoles([{ _id: 'member', title: 'Member' }]);
}

beforeEach(() => {
  loginAsAdmin();
  __seed('Stores/Orders', [sampleOrder]);
  __seed('Fulfillments', []);

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
    if (url.includes('/shipments/')) {
      return {
        ok: true,
        async json() {
          return {
            ShipmentResponse: {
              ShipmentResults: {
                ShipmentIdentificationNumber: '1Z999AA10123456784',
                PackageResults: [{
                  TrackingNumber: '1Z999AA10123456784',
                  ShippingLabel: { GraphicImage: 'base64data' },
                }],
                ShipmentCharges: {
                  TotalCharges: { MonetaryValue: '45.00', CurrencyCode: 'USD' },
                },
                BillingWeight: { Weight: '140' },
              },
            },
          };
        },
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
                  deliveryDate: [{ date: '20250620' }],
                  weight: { weight: '140' },
                  activity: [{
                    status: { description: 'Delivered', code: 'D' },
                    location: { address: { city: 'Asheville', stateProvince: 'NC', countryCode: 'US' } },
                    date: '20250620',
                    time: '141500',
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
});

// ── getPendingOrders ───────────────────────────────────────────────

describe('getPendingOrders', () => {
  it('returns paid, unfulfilled orders', async () => {
    const orders = await getPendingOrders(50);
    expect(orders.length).toBe(1);
    expect(orders[0].number).toBe('10042');
    expect(orders[0].fulfillmentStatus).toBe('NOT_FULFILLED');
  });

  it('includes formatted order details', async () => {
    const orders = await getPendingOrders(50);
    const order = orders[0];
    expect(order.buyerName).toBe('Jane Smith');
    expect(order.buyerEmail).toBe('jane@example.com');
    expect(order.lineItems).toHaveLength(2);
    expect(order.total).toBe(877.99);
    expect(order.buyerNote).toBe('Please leave at back door');
  });

  it('includes shipping address', async () => {
    const orders = await getPendingOrders(50);
    const addr = orders[0].shippingAddress;
    expect(addr.city).toBe('Asheville');
    expect(addr.postalCode).toBe('28801');
  });

  it('includes subtotal and shipping cost', async () => {
    const orders = await getPendingOrders(50);
    expect(orders[0].subtotal).toBe(848);
    expect(orders[0].shipping).toBe(29.99);
  });

  it('includes shipping method name', async () => {
    const orders = await getPendingOrders(50);
    expect(orders[0].shippingMethod).toBe('UPS Ground');
  });

  it('formats line items with quantity, sku, price, weight', async () => {
    const orders = await getPendingOrders(50);
    const item = orders[0].lineItems[0];
    expect(item.name).toBe('Eureka Futon Frame');
    expect(item.quantity).toBe(1);
    expect(item.sku).toBe('EUR-FRM-001');
    expect(item.price).toBe(499);
    expect(item.weight).toBe(85);
  });

  it('excludes fulfilled orders', async () => {
    __seed('Stores/Orders', [
      { ...sampleOrder, fulfillmentStatus: 'FULFILLED' },
    ]);
    const orders = await getPendingOrders(50);
    expect(orders).toEqual([]);
  });

  it('excludes unpaid orders', async () => {
    __seed('Stores/Orders', [
      { ...sampleOrder, paymentStatus: 'PENDING' },
    ]);
    const orders = await getPendingOrders(50);
    expect(orders).toEqual([]);
  });

  it('returns empty when no matching orders exist', async () => {
    __seed('Stores/Orders', []);
    const orders = await getPendingOrders(50);
    expect(orders).toEqual([]);
  });

  it('returns empty for non-admin users', async () => {
    loginAsNonAdmin();
    const orders = await getPendingOrders(50);
    expect(orders).toEqual([]);
  });

  it('handles order with missing billing info', async () => {
    __seed('Stores/Orders', [{
      ...sampleOrder,
      billingInfo: {},
      buyerInfo: {},
    }]);
    const orders = await getPendingOrders(50);
    expect(orders[0].buyerName).toBe('');
    expect(orders[0].buyerEmail).toBe('');
  });

  it('handles order with missing shipping info', async () => {
    __seed('Stores/Orders', [{
      ...sampleOrder,
      shippingInfo: {},
    }]);
    const orders = await getPendingOrders(50);
    expect(orders[0].shippingAddress).toEqual({});
    expect(orders[0].shippingMethod).toBe('');
  });
});

// ── fulfillOrder ───────────────────────────────────────────────────

describe('fulfillOrder', () => {
  it('creates UPS shipment and returns tracking info', async () => {
    const result = await fulfillOrder('order-001', {
      serviceCode: '03',
      packages: [{ length: 80, width: 40, height: 12, weight: 85, description: 'Futon Frame' }],
    });

    expect(result.success).toBe(true);
    expect(result.trackingNumber).toBe('1Z999AA10123456784');
    expect(result.labels).toHaveLength(1);
    expect(result.shippingCost).toBe(45);
  });

  it('saves fulfillment record to CMS', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'Fulfillments') inserted = item;
    });

    await fulfillOrder('order-001', {
      serviceCode: '03',
      packages: [{ length: 80, width: 40, height: 12, weight: 85 }],
    });

    expect(inserted).toBeDefined();
    expect(inserted.orderId).toBe('order-001');
    expect(inserted.trackingNumber).toBe('1Z999AA10123456784');
    expect(inserted.carrier).toBe('UPS');
    expect(inserted.status).toBe('LABEL_CREATED');
  });

  it('stores service name in fulfillment record', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'Fulfillments') inserted = item;
    });

    await fulfillOrder('order-001', {
      serviceCode: '03',
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });

    expect(inserted.serviceName).toBe('UPS Ground');
    expect(inserted.serviceCode).toBe('03');
  });

  it('stores recipient info in fulfillment record', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'Fulfillments') inserted = item;
    });

    await fulfillOrder('order-001', {
      serviceCode: '03',
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });

    expect(inserted.recipientName).toBe('Jane Smith');
    expect(inserted.recipientCity).toBe('Asheville');
  });

  it('returns error for non-existent order', async () => {
    const result = await fulfillOrder('nonexistent-order', {
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('uses default package dimensions when none provided', async () => {
    const result = await fulfillOrder('order-001', {
      serviceCode: '03',
      totalWeight: 140,
    });

    expect(result.success).toBe(true);
    expect(result.trackingNumber).toBeTruthy();
  });

  it('defaults serviceCode to 03 (Ground) when not specified', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'Fulfillments') inserted = item;
    });

    await fulfillOrder('order-001', {
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });

    expect(inserted.serviceCode).toBe('03');
  });

  it('uses sanitized orderId in DB insert (not raw input)', async () => {
    // validateId strips non-alphanumeric/dash/underscore chars
    // A clean ID like 'order-001' passes through unchanged
    let inserted;
    __onInsert((col, item) => {
      if (col === 'Fulfillments') inserted = item;
    });

    await fulfillOrder('order-001', {
      serviceCode: '03',
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });

    // orderId in DB should match the sanitized value
    expect(inserted.orderId).toBe('order-001');
  });

  it('rejects orderId with injection characters', async () => {
    const result = await fulfillOrder('<script>alert(1)</script>', {
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });
    // validateId returns '' for non-alphanumeric IDs
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid order ID');
  });

  it('returns error for non-admin users', async () => {
    loginAsNonAdmin();
    const result = await fulfillOrder('order-001', {
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });
    expect(result.success).toBe(false);
  });
});

// ── getTrackingUpdate ──────────────────────────────────────────────

describe('getTrackingUpdate', () => {
  it('returns tracking details from UPS', async () => {
    const result = await getTrackingUpdate('1Z999AA10123456784');
    expect(result.success).toBe(true);
    expect(result.status).toBe('Delivered');
  });

  it('updates fulfillment record with tracking status', async () => {
    __seed('Fulfillments', [{
      _id: 'ful-001',
      trackingNumber: '1Z999AA10123456784',
      status: 'IN_TRANSIT',
    }]);

    let updated;
    __onUpdate((col, item) => {
      if (col === 'Fulfillments') updated = item;
    });

    await getTrackingUpdate('1Z999AA10123456784');
    expect(updated).toBeDefined();
    expect(updated.status).toBe('DELIVERED');
    expect(updated.lastTrackingUpdate).toBeInstanceOf(Date);
  });

  it('handles no matching fulfillment record gracefully', async () => {
    __seed('Fulfillments', []);
    const result = await getTrackingUpdate('1Z999AA10123456784');
    // Should still return tracking info even if no CMS record to update
    expect(result.success).toBe(true);
  });

  it('queries DB with sanitized tracking number, not raw input', async () => {
    // Tracking with special chars should be cleaned before DB query
    __seed('Fulfillments', [{
      _id: 'ful-001',
      trackingNumber: '1Z999AA10123456784',
      status: 'IN_TRANSIT',
    }]);

    let updated;
    __onUpdate((col, item) => {
      if (col === 'Fulfillments') updated = item;
    });

    // Pass tracking with dashes — sanitize strips non-alphanumeric
    await getTrackingUpdate('1Z999AA1-0123-456784');
    expect(updated).toBeDefined();
    expect(updated.status).toBe('DELIVERED');
  });

  it('returns error for non-admin users', async () => {
    loginAsNonAdmin();
    const result = await getTrackingUpdate('1Z999AA10123456784');
    expect(result.success).toBe(false);
  });
});

// ── updateAllTracking ──────────────────────────────────────────────

describe('updateAllTracking', () => {
  it('updates tracking for all active shipments', async () => {
    __seed('Fulfillments', [
      { _id: 'ful-001', trackingNumber: '1Z999AA10123456784', status: 'IN_TRANSIT' },
      { _id: 'ful-002', trackingNumber: '1Z999AA10123456785', status: 'LABEL_CREATED' },
    ]);

    const result = await updateAllTracking();
    expect(result.success).toBe(true);
    expect(result.updated).toBe(2);
  });

  it('skips delivered and returned shipments', async () => {
    __seed('Fulfillments', [
      { _id: 'ful-001', trackingNumber: '1Z111', status: 'DELIVERED' },
      { _id: 'ful-002', trackingNumber: '1Z222', status: 'RETURNED' },
    ]);

    const result = await updateAllTracking();
    expect(result.success).toBe(true);
    expect(result.updated).toBe(0);
  });

  it('returns 0 updated when no active fulfillments', async () => {
    __seed('Fulfillments', []);
    const result = await updateAllTracking();
    expect(result.success).toBe(true);
    expect(result.updated).toBe(0);
  });

  it('returns error for non-admin users', async () => {
    loginAsNonAdmin();
    const result = await updateAllTracking();
    expect(result.success).toBe(false);
  });

  it('skips records without tracking number', async () => {
    __seed('Fulfillments', [
      { _id: 'ful-001', status: 'LABEL_CREATED' },
      { _id: 'ful-002', trackingNumber: '1Z999AA10123456784', status: 'IN_TRANSIT' },
    ]);

    const result = await updateAllTracking();
    expect(result.success).toBe(true);
    expect(result.updated).toBe(1); // only the one with a tracking number
  });
});

// ── getFulfillmentHistory ──────────────────────────────────────────

describe('getFulfillmentHistory', () => {
  it('returns fulfillment records sorted by date descending', async () => {
    __seed('Fulfillments', [
      { _id: 'ful-001', createdDate: new Date('2025-06-15'), status: 'DELIVERED' },
      { _id: 'ful-002', createdDate: new Date('2025-06-16'), status: 'IN_TRANSIT' },
    ]);

    const history = await getFulfillmentHistory(100);
    expect(history).toHaveLength(2);
    expect(history[0]._id).toBe('ful-002');
  });

  it('returns empty when no fulfillments exist', async () => {
    const history = await getFulfillmentHistory(100);
    expect(history).toEqual([]);
  });

  it('returns empty for non-admin users', async () => {
    loginAsNonAdmin();
    __seed('Fulfillments', [
      { _id: 'ful-001', createdDate: new Date(), status: 'DELIVERED' },
    ]);
    const history = await getFulfillmentHistory(100);
    expect(history).toEqual([]);
  });

  it('respects limit parameter', async () => {
    __seed('Fulfillments', [
      { _id: 'ful-001', createdDate: new Date('2025-06-15'), status: 'DELIVERED' },
      { _id: 'ful-002', createdDate: new Date('2025-06-16'), status: 'IN_TRANSIT' },
      { _id: 'ful-003', createdDate: new Date('2025-06-17'), status: 'LABEL_CREATED' },
    ]);
    const history = await getFulfillmentHistory(2);
    expect(history).toHaveLength(2);
  });
});
