import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
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

function loginAsUnauthenticated() {
  __setMember(null);
  __setRoles([]);
}

function setupShipmentMock(shipmentOk = true) {
  __setHandler((url) => {
    if (url.includes('/oauth/token')) {
      return {
        ok: true,
        async json() { return { access_token: 'mock-token', expires_in: '3600' }; },
        async text() { return ''; },
      };
    }
    if (url.includes('/shipments/')) {
      if (!shipmentOk) {
        return {
          ok: false,
          async json() { return { response: { errors: [{ message: 'Invalid address' }] } }; },
          async text() { return 'Invalid address'; },
        };
      }
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
                  currentStatus: { description: 'In Transit', code: 'IT' },
                  deliveryDate: [{ date: '20250625' }],
                  weight: { weight: '85' },
                  activity: [{
                    status: { description: 'Departed', code: 'DP' },
                    location: { address: { city: 'Charlotte', stateProvince: 'NC', countryCode: 'US' } },
                    date: '20250620',
                    time: '080000',
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
  setupShipmentMock();
});

// ── getPendingOrders hardening ──────────────────────────────────────

describe('getPendingOrders hardening', () => {
  it('returns empty for unauthenticated users', async () => {
    loginAsUnauthenticated();
    const orders = await getPendingOrders(50);
    expect(orders).toEqual([]);
  });

  it('clamps negative limit to 1', async () => {
    const orders = await getPendingOrders(-5);
    expect(Array.isArray(orders)).toBe(true);
  });

  it('clamps zero limit to 1', async () => {
    const orders = await getPendingOrders(0);
    expect(Array.isArray(orders)).toBe(true);
  });

  it('handles undefined limit (defaults to 50)', async () => {
    const orders = await getPendingOrders(undefined);
    expect(Array.isArray(orders)).toBe(true);
    expect(orders).toHaveLength(1);
  });

  it('handles NaN limit (defaults to 50)', async () => {
    const orders = await getPendingOrders(NaN);
    expect(Array.isArray(orders)).toBe(true);
  });

  it('handles order with missing lineItems field', async () => {
    __seed('Stores/Orders', [{ ...sampleOrder, lineItems: undefined }]);
    const orders = await getPendingOrders(50);
    expect(orders[0].lineItems).toEqual([]);
  });

  it('handles order with missing totals field', async () => {
    __seed('Stores/Orders', [{ ...sampleOrder, totals: undefined }]);
    const orders = await getPendingOrders(50);
    expect(orders[0].subtotal).toBe(0);
    expect(orders[0].shipping).toBe(0);
    expect(orders[0].total).toBe(0);
  });

  it('handles order with missing buyerNote', async () => {
    __seed('Stores/Orders', [{ ...sampleOrder, buyerNote: undefined }]);
    const orders = await getPendingOrders(50);
    expect(orders[0].buyerNote).toBe('');
  });

  it('handles partially_fulfilled status (not excluded)', async () => {
    __seed('Stores/Orders', [{
      ...sampleOrder,
      fulfillmentStatus: 'PARTIALLY_FULFILLED',
    }]);
    const orders = await getPendingOrders(50);
    // ne('fulfillmentStatus', 'FULFILLED') passes for PARTIALLY_FULFILLED
    expect(orders).toHaveLength(1);
  });
});

// ── fulfillOrder hardening ──────────────────────────────────────────

describe('fulfillOrder hardening', () => {
  it('returns error for null orderId', async () => {
    const result = await fulfillOrder(null, {
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid order ID');
  });

  it('returns error for empty string orderId', async () => {
    const result = await fulfillOrder('', {
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });
    expect(result.success).toBe(false);
  });

  it('returns error for numeric orderId', async () => {
    const result = await fulfillOrder(12345, {
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });
    expect(result.success).toBe(false);
  });

  it('handles order with no billingInfo gracefully', async () => {
    __seed('Stores/Orders', [{ ...sampleOrder, billingInfo: undefined }]);
    const result = await fulfillOrder('order-001', {
      serviceCode: '03',
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });
    // Should still succeed — billingInfo fields default to ''
    expect(result.success).toBe(true);
  });

  it('handles order with no shippingInfo gracefully', async () => {
    __seed('Stores/Orders', [{ ...sampleOrder, shippingInfo: undefined }]);
    const result = await fulfillOrder('order-001', {
      serviceCode: '03',
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });
    expect(result.success).toBe(true);
  });

  it('stores label data from shipment response', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'Fulfillments') inserted = item;
    });

    await fulfillOrder('order-001', {
      serviceCode: '03',
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });

    expect(inserted.labelBase64).toBe('base64data');
  });

  it('stores shipping cost from shipment response', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'Fulfillments') inserted = item;
    });

    await fulfillOrder('order-001', {
      serviceCode: '03',
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });

    expect(inserted.shippingCost).toBe(45);
  });

  it('stores createdDate as Date object', async () => {
    let inserted;
    __onInsert((col, item) => {
      if (col === 'Fulfillments') inserted = item;
    });

    await fulfillOrder('order-001', {
      serviceCode: '03',
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });

    expect(inserted.createdDate).toBeInstanceOf(Date);
  });

  it('handles UPS shipment failure with proper error message', async () => {
    setupShipmentMock(false);
    const result = await fulfillOrder('order-001', {
      serviceCode: '03',
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('handles UPS network exception', async () => {
    __setHandler((url) => {
      if (url.includes('/oauth/token')) {
        return { ok: true, async json() { return { access_token: 't', expires_in: '3600' }; }, async text() { return ''; } };
      }
      throw new Error('Network timeout');
    });

    const result = await fulfillOrder('order-001', {
      serviceCode: '03',
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });
    expect(result.success).toBe(false);
  });

  it('maps all known UPS service codes to names', async () => {
    const serviceCodes = [
      { code: '01', name: 'UPS Next Day Air' },
      { code: '02', name: 'UPS 2nd Day Air' },
      { code: '03', name: 'UPS Ground' },
      { code: '12', name: 'UPS 3 Day Select' },
      { code: '13', name: 'UPS Next Day Air Saver' },
      { code: '14', name: 'UPS Next Day Air Early' },
      { code: '59', name: 'UPS 2nd Day Air A.M.' },
    ];

    for (const { code, name } of serviceCodes) {
      let inserted;
      __onInsert((col, item) => {
        if (col === 'Fulfillments') inserted = item;
      });

      __seed('Fulfillments', []); // Reset
      await fulfillOrder('order-001', {
        serviceCode: code,
        packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
      });

      expect(inserted.serviceName).toBe(name);
    }
  });
});

// ── getTrackingUpdate hardening ─────────────────────────────────────

describe('getTrackingUpdate hardening', () => {
  it('handles null tracking number', async () => {
    const result = await getTrackingUpdate(null);
    expect(result.success).toBe(false);
  });

  it('handles numeric tracking number', async () => {
    const result = await getTrackingUpdate(12345);
    expect(result.success).toBe(false);
  });

  it('stores estimatedDelivery as null when tracking has none', async () => {
    __seed('Fulfillments', [{
      _id: 'ful-001',
      trackingNumber: '1Z999AA10123456784',
      status: 'IN_TRANSIT',
    }]);

    // Mock tracking with no estimatedDelivery
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
                    currentStatus: { description: 'In Transit', code: 'IT' },
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

    let updated;
    __onUpdate((col, item) => {
      if (col === 'Fulfillments') updated = item;
    });

    await getTrackingUpdate('1Z999AA10123456784');
    expect(updated.estimatedDelivery).toBeNull();
  });

  it('returns UPS error when tracking fails', async () => {
    __setHandler((url) => {
      if (url.includes('/oauth/token')) {
        return { ok: true, async json() { return { access_token: 't', expires_in: '3600' }; }, async text() { return ''; } };
      }
      return { ok: false, status: 404, async json() { return {}; }, async text() { return 'Not found'; } };
    });

    const result = await getTrackingUpdate('1ZINVALID');
    expect(result.success).toBe(false);
  });
});

// ── updateAllTracking hardening ─────────────────────────────────────

describe('updateAllTracking hardening', () => {
  it('updates multiple active shipments in batch', async () => {
    __seed('Fulfillments', [
      { _id: 'ful-001', trackingNumber: '1Z999AA10123456784', status: 'IN_TRANSIT' },
      { _id: 'ful-002', trackingNumber: '1Z999AA10123456785', status: 'LABEL_CREATED' },
    ]);

    const result = await updateAllTracking();
    expect(result.success).toBe(true);
    expect(result.updated).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('stores lastActivity from first activity in tracking response', async () => {
    __seed('Fulfillments', [{
      _id: 'ful-001',
      trackingNumber: '1Z999AA10123456784',
      status: 'IN_TRANSIT',
    }]);

    let updated;
    __onUpdate((col, item) => {
      if (col === 'Fulfillments') updated = item;
    });

    await updateAllTracking();
    expect(updated.lastActivity).toBe('Departed');
    expect(updated.lastTrackingUpdate).toBeInstanceOf(Date);
  });

  it('returns error for non-admin', async () => {
    __setMember({ _id: 'user-001' });
    __setRoles([{ _id: 'member', title: 'Member' }]);
    const result = await updateAllTracking();
    expect(result.success).toBe(false);
  });

  it('returns error for unauthenticated', async () => {
    loginAsUnauthenticated();
    const result = await updateAllTracking();
    expect(result.success).toBe(false);
  });

  it('handles empty tracking number in record gracefully', async () => {
    __seed('Fulfillments', [
      { _id: 'ful-001', trackingNumber: '', status: 'IN_TRANSIT' },
    ]);

    const result = await updateAllTracking();
    expect(result.success).toBe(true);
    expect(result.updated).toBe(0);
  });

  it('handles undefined trackingNumber in record gracefully', async () => {
    __seed('Fulfillments', [
      { _id: 'ful-001', status: 'IN_TRANSIT' },
    ]);

    const result = await updateAllTracking();
    expect(result.success).toBe(true);
    expect(result.updated).toBe(0);
  });
});

// ── getFulfillmentHistory hardening ─────────────────────────────────

describe('getFulfillmentHistory hardening', () => {
  it('clamps limit to max 500', async () => {
    __seed('Fulfillments', [
      { _id: 'ful-001', createdDate: new Date(), status: 'DELIVERED' },
    ]);
    const history = await getFulfillmentHistory(999);
    // Should not error — clamped to 500
    expect(Array.isArray(history)).toBe(true);
  });

  it('clamps negative limit to 1', async () => {
    __seed('Fulfillments', [
      { _id: 'ful-001', createdDate: new Date(), status: 'DELIVERED' },
    ]);
    const history = await getFulfillmentHistory(-10);
    expect(Array.isArray(history)).toBe(true);
  });

  it('handles NaN limit (defaults to 100)', async () => {
    __seed('Fulfillments', [
      { _id: 'ful-001', createdDate: new Date(), status: 'DELIVERED' },
    ]);
    const history = await getFulfillmentHistory('invalid');
    expect(Array.isArray(history)).toBe(true);
  });

  it('handles undefined limit (defaults to 100)', async () => {
    __seed('Fulfillments', [
      { _id: 'ful-001', createdDate: new Date(), status: 'DELIVERED' },
    ]);
    const history = await getFulfillmentHistory();
    expect(Array.isArray(history)).toBe(true);
  });

  it('returns error for non-admin', async () => {
    __setMember({ _id: 'user-001' });
    __setRoles([{ _id: 'member', title: 'Member' }]);
    __seed('Fulfillments', [
      { _id: 'ful-001', createdDate: new Date(), status: 'DELIVERED' },
    ]);
    const history = await getFulfillmentHistory();
    expect(history).toEqual([]);
  });

  it('returns error for unauthenticated', async () => {
    loginAsUnauthenticated();
    const history = await getFulfillmentHistory();
    expect(history).toEqual([]);
  });
});

// ── requireAdmin hardening ──────────────────────────────────────────

describe('requireAdmin role checking', () => {
  it('accepts admin role by _id', async () => {
    __setMember({ _id: 'admin-001' });
    __setRoles([{ _id: 'admin', title: 'SomeOtherTitle' }]);
    // Should accept because _id === 'admin'
    const orders = await getPendingOrders(50);
    expect(orders).toHaveLength(1);
  });

  it('accepts admin role by title', async () => {
    __setMember({ _id: 'admin-001' });
    __setRoles([{ _id: 'some-other-id', title: 'Admin' }]);
    const orders = await getPendingOrders(50);
    expect(orders).toHaveLength(1);
  });

  it('rejects member with no _id', async () => {
    __setMember({});
    __setRoles([{ _id: 'admin', title: 'Admin' }]);
    const orders = await getPendingOrders(50);
    expect(orders).toEqual([]);
  });
});
