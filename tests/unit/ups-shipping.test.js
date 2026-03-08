import { describe, it, expect, beforeEach } from 'vitest';
import { __setSecrets } from '../__mocks__/wix-secrets-backend.js';
import { __setHandler } from '../__mocks__/wix-fetch.js';
import {
  getUPSRates,
  createShipment,
  trackShipment,
  validateAddress,
  getPackageDimensions,
} from '../../src/backend/ups-shipping.web.js';

beforeEach(() => {
  __setSecrets({
    UPS_CLIENT_ID: 'test-client-id',
    UPS_CLIENT_SECRET: 'test-client-secret',
    UPS_ACCOUNT_NUMBER: '123456',
    UPS_SANDBOX: 'true',
  });

  // Default fetch handler: return OAuth token for auth, rates for rating API
  __setHandler((url, options) => {
    if (url.includes('/oauth/token')) {
      return {
        ok: true,
        async json() {
          return { access_token: 'mock-token-123', expires_in: '3600' };
        },
        async text() { return ''; },
      };
    }

    if (url.includes('/rating/')) {
      return {
        ok: true,
        async json() {
          return {
            RateResponse: {
              RatedShipment: [
                {
                  Service: { Code: '03' },
                  TotalCharges: { MonetaryValue: '49.99', CurrencyCode: 'USD' },
                  GuaranteedDelivery: { BusinessDaysInTransit: '5' },
                },
                {
                  Service: { Code: '02' },
                  TotalCharges: { MonetaryValue: '89.99', CurrencyCode: 'USD' },
                  GuaranteedDelivery: { BusinessDaysInTransit: '2' },
                },
              ],
            },
          };
        },
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
                  ShippingLabel: { GraphicImage: 'base64PDFdata' },
                }],
                ShipmentCharges: {
                  TotalCharges: { MonetaryValue: '52.50', CurrencyCode: 'USD' },
                },
                BillingWeight: { Weight: '85' },
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
                  deliveryDate: [{ date: '20250620' }],
                  weight: { weight: '85' },
                  activity: [
                    {
                      status: { description: 'Departed Facility', code: 'DP' },
                      location: { address: { city: 'Hendersonville', stateProvince: 'NC', countryCode: 'US' } },
                      date: '20250618',
                      time: '143000',
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

    if (url.includes('/addressvalidation/')) {
      return {
        ok: true,
        async json() {
          return { XAVResponse: { ValidAddressIndicator: '' } };
        },
        async text() { return ''; },
      };
    }

    return { ok: true, async json() { return {}; }, async text() { return ''; } };
  });
});

// ── getUPSRates ────────────────────────────────────────────────────

describe('getUPSRates', () => {
  it('returns shipping rates sorted by cost', async () => {
    const rates = await getUPSRates(
      { postalCode: '28801', city: 'Asheville', state: 'NC', country: 'US' },
      [{ length: 80, width: 40, height: 12, weight: 85 }],
      500,
    );
    expect(rates.length).toBe(2);
    expect(rates[0].code).toBe('ups-03'); // Ground (cheaper)
    expect(rates[0].cost).toBe(49.99);
    expect(rates[1].code).toBe('ups-02'); // 2nd Day
    expect(rates[1].cost).toBe(89.99);
  });

  it('does NOT return free shipping at $1200 (free shipping disabled)', async () => {
    const rates = await getUPSRates(
      { postalCode: '28801', city: 'Asheville', state: 'NC', country: 'US' },
      [{ length: 80, width: 40, height: 12, weight: 85 }],
      1200,
    );
    expect(rates.length).toBeGreaterThanOrEqual(1);
    expect(rates.some(r => r.code === 'free-ground')).toBe(false);
  });

  it('returns fallback rates on API error', async () => {
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

    const rates = await getUPSRates(
      { postalCode: '28801', city: 'Asheville', state: 'NC', country: 'US' },
      [{ weight: 50 }],
      500,
    );
    expect(rates.length).toBeGreaterThan(0);
    expect(rates[0].isEstimate).toBe(true);
  });

  it('uses fallback rates with regional pricing', async () => {
    __setHandler(() => {
      throw new Error('Network error');
    });

    // NC prefix (287) -> $29.99 ground
    const ncRates = await getUPSRates(
      { postalCode: '28792' },
      [{ weight: 50 }],
      500,
    );
    expect(ncRates[0].cost).toBe(29.99);
  });

  it('includes service name and estimated delivery', async () => {
    const rates = await getUPSRates(
      { postalCode: '28801', city: 'Asheville', state: 'NC', country: 'US' },
      [{ weight: 50 }],
      500,
    );
    expect(rates[0].title).toBe('UPS Ground');
    expect(rates[0].estimatedDelivery).toBeTruthy();
  });
});

// ── createShipment ─────────────────────────────────────────────────

describe('createShipment', () => {
  it('creates shipment and returns tracking number and labels', async () => {
    const result = await createShipment({
      orderId: '10042',
      recipientName: 'Jane Smith',
      recipientPhone: '8285551234',
      addressLine1: '123 Main St',
      city: 'Asheville',
      state: 'NC',
      postalCode: '28801',
      country: 'US',
      serviceCode: '03',
      packages: [{ length: 80, width: 40, height: 12, weight: 85, description: 'Futon Frame' }],
    });

    expect(result.success).toBe(true);
    expect(result.trackingNumber).toBe('1Z999AA10123456784');
    expect(result.labels).toHaveLength(1);
    expect(result.labels[0].labelFormat).toBe('PDF');
    expect(result.totalCharge).toBe(52.5);
  });

  it('returns error on API failure', async () => {
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
        status: 400,
        async json() { return {}; },
        async text() { return 'Bad Request'; },
      };
    });

    const result = await createShipment({
      orderId: '10042',
      recipientName: 'Jane',
      addressLine1: '123 Main',
      city: 'Asheville',
      state: 'NC',
      postalCode: '28801',
      packages: [{ length: 48, width: 30, height: 12, weight: 50 }],
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

// ── trackShipment ──────────────────────────────────────────────────

describe('trackShipment', () => {
  it('returns tracking details with activities', async () => {
    const result = await trackShipment('1Z999AA10123456784');
    expect(result.success).toBe(true);
    expect(result.trackingNumber).toBe('1Z999AA10123456784');
    expect(result.status).toBe('In Transit');
    expect(result.activities).toHaveLength(1);
    expect(result.activities[0].location).toContain('Hendersonville');
  });

  it('returns error on API failure', async () => {
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

    const result = await trackShipment('1ZINVALID');
    expect(result.success).toBe(false);
  });

  it('does not leak internal error details to public callers', async () => {
    __setHandler(() => {
      throw new Error('UPS API key expired: client_id=abc123, secret=xyz789');
    });

    const result = await trackShipment('1Z999AA10123456784');
    expect(result.success).toBe(false);
    // Must NOT contain the internal error message
    expect(result.error).not.toContain('UPS API');
    expect(result.error).not.toContain('abc123');
    expect(result.error).not.toContain('secret');
    // Should return a generic user-facing message
    expect(result.error).toBe('Unable to retrieve tracking information');
  });

  it('rejects tracking numbers that are too short', async () => {
    const result = await trackShipment('ABC');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid tracking number format');
  });

  it('rejects empty tracking number', async () => {
    const result = await trackShipment('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid tracking number format');
  });

  it('rejects null/undefined tracking number', async () => {
    const result = await trackShipment(null);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid tracking number format');
  });
});

// ── validateAddress ────────────────────────────────────────────────

describe('validateAddress', () => {
  it('returns valid for a good address', async () => {
    const result = await validateAddress({
      addressLine1: '123 Main St',
      city: 'Asheville',
      state: 'NC',
      postalCode: '28801',
    });
    expect(result.valid).toBe(true);
  });

  it('returns ambiguous with candidates', async () => {
    __setHandler((url) => {
      if (url.includes('/oauth/token')) {
        return {
          ok: true,
          async json() { return { access_token: 'tok', expires_in: '3600' }; },
          async text() { return ''; },
        };
      }
      if (url.includes('/addressvalidation/')) {
        return {
          ok: true,
          async json() {
            return {
              XAVResponse: {
                AmbiguousAddressIndicator: '',
                Candidate: [{
                  AddressKeyFormat: {
                    AddressLine: ['123 MAIN ST'],
                    PoliticalDivision2: 'ASHEVILLE',
                    PoliticalDivision1: 'NC',
                    PostcodePrimaryLow: '28801',
                  },
                }],
              },
            };
          },
          async text() { return ''; },
        };
      }
      return { ok: true, async json() { return {}; }, async text() { return ''; } };
    });

    const result = await validateAddress({
      addressLine1: '123 Main',
      city: 'Asheville',
      state: 'NC',
      postalCode: '28801',
    });
    expect(result.valid).toBe(false);
    expect(result.ambiguous).toBe(true);
    expect(result.candidates).toHaveLength(1);
  });

  it('returns invalid with unavailable flag on API error', async () => {
    __setHandler(() => {
      throw new Error('Network down');
    });

    const result = await validateAddress({
      addressLine1: '123 Main St',
      city: 'Asheville',
      state: 'NC',
      postalCode: '28801',
    });
    expect(result.valid).toBe(false);
    expect(result.unavailable).toBe(true);
    expect(result.error).toBe('validation unavailable');
  });

  it('returns invalid with unavailable flag on non-ok API response', async () => {
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
        status: 503,
        async json() { return {}; },
        async text() { return 'Service Unavailable'; },
      };
    });

    const result = await validateAddress({
      addressLine1: '123 Main St',
      city: 'Asheville',
      state: 'NC',
      postalCode: '28801',
    });
    expect(result.valid).toBe(false);
    expect(result.unavailable).toBe(true);
    expect(result.error).toBe('validation unavailable');
  });

  it('returns invalid with unavailable flag on unrecognized response format', async () => {
    __setHandler((url) => {
      if (url.includes('/oauth/token')) {
        return {
          ok: true,
          async json() { return { access_token: 'tok', expires_in: '3600' }; },
          async text() { return ''; },
        };
      }
      if (url.includes('/addressvalidation/')) {
        return {
          ok: true,
          async json() { return { XAVResponse: { UnexpectedField: 'something' } }; },
          async text() { return ''; },
        };
      }
      return { ok: true, async json() { return {}; }, async text() { return ''; } };
    });

    const result = await validateAddress({
      addressLine1: '123 Main St',
      city: 'Asheville',
      state: 'NC',
      postalCode: '28801',
    });
    expect(result.valid).toBe(false);
    expect(result.unavailable).toBe(true);
  });
});

// ── getPackageDimensions ───────────────────────────────────────────

describe('getPackageDimensions', () => {
  it('returns futon-frame dimensions', () => {
    const dims = getPackageDimensions('futon-frame');
    expect(dims.length).toBe(80);
    expect(dims.width).toBe(40);
    expect(dims.height).toBe(12);
    expect(dims.weight).toBe(85);
  });

  it('returns murphy-bed dimensions', () => {
    const dims = getPackageDimensions('murphy-bed');
    expect(dims.weight).toBe(150);
  });

  it('returns default dimensions for unknown category', () => {
    const dims = getPackageDimensions('something-else');
    expect(dims.length).toBe(48);
    expect(dims.weight).toBe(50);
  });
});
