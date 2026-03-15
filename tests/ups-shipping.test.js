import { describe, it, expect, beforeEach } from 'vitest';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler } from './__mocks__/wix-fetch.js';
import {
  getUPSRates,
  createShipment,
  trackShipment,
  validateAddress,
  getPackageDimensions,
} from '../src/backend/ups-shipping.web.js';

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

  it('does NOT return free shipping at $1200 (below free shipping threshold)', async () => {
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

  it('handles empty packages array gracefully', async () => {
    const rates = await getUPSRates(
      { postalCode: '28801', city: 'Asheville', state: 'NC', country: 'US' },
      [],
      500,
    );
    expect(Array.isArray(rates)).toBe(true);
  });

  it('handles null packages gracefully', async () => {
    const rates = await getUPSRates(
      { postalCode: '28801', city: 'Asheville', state: 'NC', country: 'US' },
      null,
      500,
    );
    expect(Array.isArray(rates)).toBe(true);
  });

  it('caps packages at 20 to prevent API amplification', async () => {
    let capturedBody = null;
    __setHandler((url, options) => {
      if (url.includes('/oauth/token')) {
        return { ok: true, async json() { return { access_token: 'tok', expires_in: '3600' }; }, async text() { return ''; } };
      }
      if (url.includes('/rating/')) {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          async json() {
            return { RateResponse: { RatedShipment: [{ Service: { Code: '03' }, TotalCharges: { MonetaryValue: '49.99', CurrencyCode: 'USD' }, GuaranteedDelivery: { BusinessDaysInTransit: '5' } }] } };
          },
          async text() { return ''; },
        };
      }
      return { ok: true, async json() { return {}; }, async text() { return ''; } };
    });

    // Send 25 packages — should be capped to 20
    const packages = Array.from({ length: 25 }, () => ({ length: 48, width: 30, height: 12, weight: 50 }));
    await getUPSRates(
      { postalCode: '28801', city: 'Asheville', state: 'NC', country: 'US' },
      packages,
      500,
    );
    expect(capturedBody).not.toBeNull();
    expect(capturedBody.RateRequest.Shipment.Package).toHaveLength(20);
  });

  it('returns free-ground when order meets free shipping threshold', async () => {
    const rates = await getUPSRates(
      { postalCode: '28801', city: 'Asheville', state: 'NC', country: 'US' },
      [{ weight: 50 }],
      999999, // shippingConfig.freeThreshold (currently $999,999)
    );
    expect(rates).toHaveLength(1);
    expect(rates[0].code).toBe('free-ground');
    expect(rates[0].cost).toBe(0);
  });

  it('returns free-ground when order exceeds free shipping threshold', async () => {
    const rates = await getUPSRates(
      { postalCode: '28801', city: 'Asheville', state: 'NC', country: 'US' },
      [{ weight: 50 }],
      1000000, // above shippingConfig.freeThreshold
    );
    expect(rates).toHaveLength(1);
    expect(rates[0].code).toBe('free-ground');
  });

  it('falls back to Southeast regional rate ($39.99) for ZIP 300-399', async () => {
    __setHandler(() => { throw new Error('Network error'); });
    const rates = await getUPSRates({ postalCode: '30301' }, [{ weight: 50 }], 500);
    expect(rates[0].cost).toBe(39.99);
    expect(rates[0].isEstimate).toBe(true);
  });

  it('falls back to Northeast regional rate ($59.99) for ZIP 100-199', async () => {
    __setHandler(() => { throw new Error('Network error'); });
    const rates = await getUPSRates({ postalCode: '10001' }, [{ weight: 50 }], 500);
    expect(rates[0].cost).toBe(59.99);
  });

  it('falls back to West Coast regional rate ($79.99) for ZIP 900-999', async () => {
    __setHandler(() => { throw new Error('Network error'); });
    const rates = await getUPSRates({ postalCode: '90210' }, [{ weight: 50 }], 500);
    expect(rates[0].cost).toBe(79.99);
  });

  it('falls back to default rate ($49.99) for non-regional ZIP', async () => {
    __setHandler(() => { throw new Error('Network error'); });
    const rates = await getUPSRates({ postalCode: '60601' }, [{ weight: 50 }], 500);
    expect(rates[0].cost).toBe(49.99);
  });

  it('fallback returns both ground and 2-day estimates', async () => {
    __setHandler(() => { throw new Error('Network error'); });
    const rates = await getUPSRates({ postalCode: '60601' }, [{ weight: 50 }], 500);
    expect(rates).toHaveLength(2);
    expect(rates[0].code).toBe('ups-ground-est');
    expect(rates[1].code).toBe('ups-2day-est');
    expect(rates[1].cost).toBe(49.99 + 40);
  });

  it('handles null destination address on fallback', async () => {
    __setHandler(() => { throw new Error('Network error'); });
    const rates = await getUPSRates(null, [{ weight: 50 }], 500);
    expect(Array.isArray(rates)).toBe(true);
    expect(rates.length).toBeGreaterThan(0);
    expect(rates[0].cost).toBe(49.99); // default tier
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

  it('creates return label with swapped ShipTo/ShipFrom', async () => {
    let capturedBody = null;
    __setHandler((url, options) => {
      if (url.includes('/oauth/token')) {
        return { ok: true, async json() { return { access_token: 'tok', expires_in: '3600' }; }, async text() { return ''; } };
      }
      if (url.includes('/shipments/')) {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          async json() {
            return {
              ShipmentResponse: {
                ShipmentResults: {
                  ShipmentIdentificationNumber: '1Z999AA10123456784',
                  PackageResults: [{ TrackingNumber: '1Z999AA10123456784', ShippingLabel: { GraphicImage: 'base64' } }],
                  ShipmentCharges: { TotalCharges: { MonetaryValue: '0.00', CurrencyCode: 'USD' } },
                  BillingWeight: { Weight: '85' },
                },
              },
            };
          },
          async text() { return ''; },
        };
      }
      return { ok: true, async json() { return {}; }, async text() { return ''; } };
    });

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
      returnLabel: true,
      packages: [{ length: 80, width: 40, height: 12, weight: 85, description: 'Futon Frame' }],
    });

    expect(result.success).toBe(true);
    // Return label: ShipTo should be the business (Carolina Futons), ShipFrom should be customer
    const shipment = capturedBody.ShipmentRequest.Shipment;
    expect(shipment.ShipTo.Name).toContain('Carolina');
    expect(shipment.ShipFrom.Name).toBe('Jane Smith');
    expect(shipment.Description).toContain('Return');
  });

  it('handles multiple packages in a single shipment', async () => {
    let capturedBody = null;
    __setHandler((url, options) => {
      if (url.includes('/oauth/token')) {
        return { ok: true, async json() { return { access_token: 'tok', expires_in: '3600' }; }, async text() { return ''; } };
      }
      if (url.includes('/shipments/')) {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          async json() {
            return {
              ShipmentResponse: {
                ShipmentResults: {
                  ShipmentIdentificationNumber: '1Z999AA10123456784',
                  PackageResults: [
                    { TrackingNumber: '1Z999AA10123456784', ShippingLabel: { GraphicImage: 'pdf1' } },
                    { TrackingNumber: '1Z999AA10123456785', ShippingLabel: { GraphicImage: 'pdf2' } },
                  ],
                  ShipmentCharges: { TotalCharges: { MonetaryValue: '105.00', CurrencyCode: 'USD' } },
                  BillingWeight: { Weight: '135' },
                },
              },
            };
          },
          async text() { return ''; },
        };
      }
      return { ok: true, async json() { return {}; }, async text() { return ''; } };
    });

    const result = await createShipment({
      orderId: '10043',
      recipientName: 'John Doe',
      addressLine1: '456 Oak Ave',
      city: 'Charlotte',
      state: 'NC',
      postalCode: '28202',
      packages: [
        { length: 80, width: 40, height: 12, weight: 85, description: 'Futon Frame' },
        { length: 78, width: 54, height: 14, weight: 55, description: 'Futon Mattress' },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.labels).toHaveLength(2);
    expect(result.totalCharge).toBe(105);
    expect(capturedBody.ShipmentRequest.Shipment.Package).toHaveLength(2);
  });

  it('returns error when packages is undefined', async () => {
    const result = await createShipment({
      orderId: '10044',
      recipientName: 'Test User',
      addressLine1: '1 Main St',
      city: 'Asheville',
      state: 'NC',
      postalCode: '28801',
      // no packages field
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

  it('strips special characters from tracking number before lookup', async () => {
    let capturedUrl = null;
    __setHandler((url) => {
      if (url.includes('/oauth/token')) {
        return { ok: true, async json() { return { access_token: 'tok', expires_in: '3600' }; }, async text() { return ''; } };
      }
      if (url.includes('/track/')) {
        capturedUrl = url;
        return {
          ok: true,
          async json() {
            return {
              trackResponse: {
                shipment: [{
                  package: [{
                    currentStatus: { description: 'Delivered', code: 'D' },
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

    // Tracking number with dashes and spaces — should be cleaned to alphanumeric
    await trackShipment('1Z-999-AA1 0123 456784');
    expect(capturedUrl).toContain('1Z999AA10123456784');
    expect(capturedUrl).not.toMatch(/[-\s]/);
  });

  it('rejects tracking number longer than 35 characters', async () => {
    const longTracking = 'A'.repeat(36);
    const result = await trackShipment(longTracking);
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

  it('returns invalid (not ambiguous) for NoCandidatesIndicator', async () => {
    __setHandler((url) => {
      if (url.includes('/oauth/token')) {
        return { ok: true, async json() { return { access_token: 'tok', expires_in: '3600' }; }, async text() { return ''; } };
      }
      if (url.includes('/addressvalidation/')) {
        return {
          ok: true,
          async json() {
            return { XAVResponse: { NoCandidatesIndicator: '' } };
          },
          async text() { return ''; },
        };
      }
      return { ok: true, async json() { return {}; }, async text() { return ''; } };
    });

    const result = await validateAddress({
      addressLine1: '999 Fake Blvd',
      city: 'Nowhere',
      state: 'ZZ',
      postalCode: '00000',
    });
    expect(result.valid).toBe(false);
    expect(result.ambiguous).toBe(false);
    expect(result.candidates).toEqual([]);
    // Should NOT have unavailable flag — API responded, address just doesn't exist
    expect(result.unavailable).toBeUndefined();
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

  it('returns futon-mattress dimensions', () => {
    const dims = getPackageDimensions('futon-mattress');
    expect(dims.length).toBe(78);
    expect(dims.width).toBe(54);
    expect(dims.height).toBe(14);
    expect(dims.weight).toBe(55);
  });

  it('returns platform-bed dimensions', () => {
    const dims = getPackageDimensions('platform-bed');
    expect(dims.length).toBe(80);
    expect(dims.width).toBe(42);
    expect(dims.height).toBe(8);
    expect(dims.weight).toBe(70);
  });

  it('returns casegoods dimensions', () => {
    const dims = getPackageDimensions('casegoods');
    expect(dims.length).toBe(36);
    expect(dims.width).toBe(20);
    expect(dims.height).toBe(36);
    expect(dims.weight).toBe(45);
  });

  it('returns accessory dimensions', () => {
    const dims = getPackageDimensions('accessory');
    expect(dims.length).toBe(24);
    expect(dims.width).toBe(18);
    expect(dims.height).toBe(12);
    expect(dims.weight).toBe(15);
  });

  it('returns default dimensions for undefined category', () => {
    expect(getPackageDimensions(undefined).weight).toBe(50);
  });

  it('returns default dimensions for null category', () => {
    expect(getPackageDimensions(null).weight).toBe(50);
  });
});
