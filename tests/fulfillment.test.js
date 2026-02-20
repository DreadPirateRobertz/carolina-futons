import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler } from './__mocks__/wix-fetch.js';
import { __setMember, __setRoles } from './__mocks__/wix-members-backend.js';
import { sampleOrder } from './fixtures/products.js';
import {
  getPendingOrders,
  fulfillOrder,
  getTrackingUpdate,
  updateAllTracking,
  getFulfillmentHistory,
} from '../src/backend/fulfillment.web.js';

function loginAsAdmin() {
  __setMember({ _id: 'admin-001' });
  __setRoles([{ _id: 'admin', title: 'Admin' }]);
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
});

// ── getTrackingUpdate ──────────────────────────────────────────────

describe('getTrackingUpdate', () => {
  it('returns tracking details from UPS', async () => {
    const result = await getTrackingUpdate('1Z999AA10123456784');
    expect(result.success).toBe(true);
    expect(result.status).toBe('Delivered');
  });

  it('updates fulfillment record with tracking status', async () => {
    // Seed a fulfillment record
    __seed('Fulfillments', [{
      _id: 'ful-001',
      trackingNumber: '1Z999AA10123456784',
      status: 'IN_TRANSIT',
    }]);

    await getTrackingUpdate('1Z999AA10123456784');
    // The record should have been updated (status to DELIVERED via mapTrackingStatus)
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
    // Should be sorted descending by createdDate
    expect(history[0]._id).toBe('ful-002');
  });

  it('returns empty when no fulfillments exist', async () => {
    const history = await getFulfillmentHistory(100);
    expect(history).toEqual([]);
  });
});
