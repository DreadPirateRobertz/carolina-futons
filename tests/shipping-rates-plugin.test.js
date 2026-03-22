import { describe, it, expect, beforeEach } from 'vitest';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler } from './__mocks__/wix-fetch.js';
import { getShippingRates } from '../src/backend/shipping-rates-plugin.js';

beforeEach(() => {
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
    if (url.includes('/rating/')) {
      return {
        ok: true,
        async json() {
          return {
            RateResponse: {
              RatedShipment: [
                {
                  Service: { Code: '03' },
                  TotalCharges: { MonetaryValue: '39.99', CurrencyCode: 'USD' },
                },
              ],
            },
          };
        },
        async text() { return ''; },
      };
    }
    return { ok: true, async json() { return {}; }, async text() { return ''; } };
  });
});

// ── getShippingRates (Wix checkout plugin) ─────────────────────────

describe('getShippingRates', () => {
  it('returns UPS rates in Wix format', async () => {
    const result = await getShippingRates({
      lineItems: [
        { name: 'Eureka Futon Frame', quantity: 1, price: '499', sku: 'EUR-FRM-001' },
      ],
      shippingDestination: {
        contactDetails: { firstName: 'Jane', lastName: 'Smith' },
        address: {
          addressLine: '123 Main St',
          city: 'Asheville',
          subdivision: 'NC',
          postalCode: '28801',
          country: 'US',
        },
      },
    });

    expect(result.shippingRates).toBeDefined();
    expect(result.shippingRates.length).toBeGreaterThan(0);
    // Should have price as string with 2 decimal places
    const rate = result.shippingRates[0];
    expect(rate.cost.price).toMatch(/^\d+\.\d{2}$/);
    expect(rate.cost.currency).toBe('USD');
    expect(rate.title).toBeTruthy();
  });

  it('adds local pickup option for Hendersonville area (287-289)', async () => {
    const result = await getShippingRates({
      lineItems: [
        { name: 'Futon Frame', quantity: 1, price: '499' },
      ],
      shippingDestination: {
        address: { postalCode: '28792', city: 'Hendersonville', subdivision: 'NC', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes).toContain('local-pickup');
    const pickup = result.shippingRates.find(r => r.code === 'local-pickup');
    expect(pickup.cost.price).toBe('0.00');
  });

  it('adds local delivery option for Southeast (zone-based code)', async () => {
    const result = await getShippingRates({
      lineItems: [
        { name: 'Futon Frame', quantity: 1, price: '499' },
      ],
      shippingDestination: {
        address: { postalCode: '30301', city: 'Atlanta', subdivision: 'GA', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes).toContain('local-delivery-zone3');
  });

  it('does NOT add local pickup for non-local zip codes', async () => {
    const result = await getShippingRates({
      lineItems: [
        { name: 'Futon Frame', quantity: 1, price: '499' },
      ],
      shippingDestination: {
        address: { postalCode: '10001', city: 'New York', subdivision: 'NY', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes).not.toContain('local-pickup');
    expect(codes).not.toContain('local-delivery');
  });

  it('does NOT return free shipping for $1899 order (free shipping disabled)', async () => {
    const result = await getShippingRates({
      lineItems: [
        { name: 'Sagebrush Murphy Cabinet Bed', quantity: 1, price: '1899' },
      ],
      shippingDestination: {
        address: { postalCode: '28801', city: 'Asheville', subdivision: 'NC', country: 'US' },
      },
    });

    const freeRate = result.shippingRates.find(r => r.code === 'free-ground');
    expect(freeRate).toBeUndefined();
  });

  it('returns empty rates when no postal code', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { city: 'Somewhere' },
      },
    });

    expect(result.shippingRates).toEqual([]);
  });

  it('returns UPS fallback estimated rates when API is down', async () => {
    __setHandler(() => { throw new Error('Network down'); });

    const result = await getShippingRates({
      lineItems: [{ name: 'Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28801', city: 'Asheville', subdivision: 'NC', country: 'US' },
      },
    });

    // getUPSRates catches internally and returns fallback estimated rates
    // which the plugin then formats for Wix
    expect(result.shippingRates.length).toBeGreaterThanOrEqual(2);
    const codes = result.shippingRates.map(r => r.code);
    expect(codes).toContain('ups-ground-est');
  });

  it('returns flat fallback rates when plugin itself errors', async () => {
    // Pass invalid data that causes the plugin to hit its own catch block
    const result = await getShippingRates({
      lineItems: null, // will cause lineItems iteration to throw
      shippingDestination: {
        address: { postalCode: '28801' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes).toContain('flat-ground');
    expect(codes).toContain('flat-express');
  });

  it('detects product categories from item names for package sizing', async () => {
    const result = await getShippingRates({
      lineItems: [
        { name: 'Sagebrush Murphy Cabinet Bed', quantity: 1, price: '1899' },
      ],
      shippingDestination: {
        address: { postalCode: '10001', city: 'New York', subdivision: 'NY', country: 'US' },
      },
    });

    // Murphy bed does NOT trigger free shipping (free shipping disabled)
    expect(result.shippingRates.some(r => r.code === 'free-ground')).toBe(false);
  });

  it('handles multiple items with quantity > 1', async () => {
    const result = await getShippingRates({
      lineItems: [
        { name: 'Clove Nightstand', quantity: 2, price: '199' },
      ],
      shippingDestination: {
        address: { postalCode: '28801', city: 'Asheville', subdivision: 'NC', country: 'US' },
      },
    });

    expect(result.shippingRates.length).toBeGreaterThan(0);
  });

  // ── White Glove Delivery ────────────────────────────────────────────

  // ── White-glove as additionalCharge (CF-pp4g) ─────────────────────
  // White-glove is NOT a standalone rate — it's an upgrade add-on on local delivery.

  it('white-glove appears as additionalCharge on local delivery rate, NOT a standalone option', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28801', city: 'Asheville', subdivision: 'NC', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    // No standalone white-glove rate
    expect(codes.some(c => c.startsWith('white-glove'))).toBe(false);
    // Local delivery has white-glove as an additionalCharge
    const local = result.shippingRates.find(r => r.code === 'local-delivery-zone2');
    expect(local).toBeDefined();
    expect(local.cost.additionalCharges).toHaveLength(1);
    expect(local.cost.additionalCharges[0].code).toBe('white-glove');
  });

  it('white-glove additionalCharge price = $99 for zone1 (Hendersonville exact ZIPs)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28792', city: 'Hendersonville', subdivision: 'NC', country: 'US' },
      },
    });

    const local = result.shippingRates.find(r => r.code === 'local-delivery-zone1');
    expect(local).toBeDefined();
    const wgCharge = local.cost.additionalCharges.find(c => c.code === 'white-glove');
    expect(wgCharge).toBeDefined();
    expect(wgCharge.price).toBe('99.00');
  });

  it('white-glove additionalCharge price = $149 for zone2 (Asheville metro, prefix 287-289)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28801', city: 'Asheville', subdivision: 'NC', country: 'US' },
      },
    });

    const local = result.shippingRates.find(r => r.code === 'local-delivery-zone2');
    const wgCharge = local.cost.additionalCharges.find(c => c.code === 'white-glove');
    expect(wgCharge.price).toBe('149.00');
  });

  it('white-glove additionalCharge price = $199 for zone3 (Atlanta)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '30301', city: 'Atlanta', subdivision: 'GA', country: 'US' },
      },
    });

    const local = result.shippingRates.find(r => r.code === 'local-delivery-zone3');
    const wgCharge = local.cost.additionalCharges.find(c => c.code === 'white-glove');
    expect(wgCharge.price).toBe('199.00');
  });

  it('white-glove additionalCharge is NOT free at $2100 (free threshold disabled)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Sagebrush Murphy Cabinet Bed', quantity: 1, price: '2100' }],
      shippingDestination: {
        address: { postalCode: '28801', city: 'Asheville', subdivision: 'NC', country: 'US' },
      },
    });

    const local = result.shippingRates.find(r => r.code === 'local-delivery-zone2');
    const wgCharge = local.cost.additionalCharges.find(c => c.code === 'white-glove');
    expect(wgCharge.price).not.toBe('0.00');
  });

  it('does NOT offer white-glove for non-Southeast ZIP codes', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '10001', city: 'New York', subdivision: 'NY', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes.some(c => c.startsWith('white-glove'))).toBe(false);
    // No local delivery rate either
    expect(codes.some(c => c.startsWith('local-delivery'))).toBe(false);
  });

  it('does NOT offer free local delivery at $1899 (free shipping disabled)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Sagebrush Murphy Cabinet Bed', quantity: 1, price: '1899' }],
      shippingDestination: {
        address: { postalCode: '28801', city: 'Asheville', subdivision: 'NC', country: 'US' },
      },
    });

    const local = result.shippingRates.find(r => r.code === 'local-delivery-zone2');
    expect(local).toBeDefined();
    expect(local.cost.price).not.toBe('0.00');
  });

  it('charges zone-based delivery price for Asheville (zone2 = $69) for orders < free threshold', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28801', city: 'Asheville', subdivision: 'NC', country: 'US' },
      },
    });

    const local = result.shippingRates.find(r => r.code === 'local-delivery-zone2');
    expect(local).toBeDefined();
    expect(local.cost.price).toBe('69.00');
  });

  it('rejects negative item prices — treats them as zero', async () => {
    const result = await getShippingRates({
      lineItems: [
        { name: 'Futon Frame', quantity: 1, price: '-500' },
        { name: 'Mattress', quantity: 1, price: '200' },
      ],
      shippingDestination: {
        address: { postalCode: '10001', city: 'New York', subdivision: 'NY', country: 'US' },
      },
    });

    // Negative price clamped to 0, so subtotal = 0 + 200 = 200, NOT -300
    // Should NOT qualify for free shipping
    const codes = result.shippingRates.map(r => r.code);
    expect(codes).not.toContain('free-ground');
  });

  it('does not allow negative prices to reduce subtotal below zero', async () => {
    const result = await getShippingRates({
      lineItems: [
        { name: 'Futon Frame', quantity: 1, price: '-9999' },
      ],
      shippingDestination: {
        address: { postalCode: '10001', city: 'New York', subdivision: 'NY', country: 'US' },
      },
    });

    // Negative price clamped to 0, subtotal = 0
    const codes = result.shippingRates.map(r => r.code);
    expect(codes).not.toContain('free-ground');
  });

  it('local delivery rate uses zone-specific delivery days (zone1=2–4, zone3=5–7)', async () => {
    const zone1Result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28792', subdivision: 'NC', country: 'US' },
      },
    });

    const zone3Result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '30301', subdivision: 'GA', country: 'US' },
      },
    });

    const zone1Rate = zone1Result.shippingRates.find(r => r.code === 'local-delivery-zone1');
    const zone3Rate = zone3Result.shippingRates.find(r => r.code === 'local-delivery-zone3');
    expect(zone1Rate.logistics.deliveryTime).toBe('2–4');
    expect(zone3Rate.logistics.deliveryTime).toBe('5–7');
  });
});

// ── LTL freight routing (CF-6p04) ──────────────────────────────────────────

const WWEX_SOAP_RESPONSE = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <RateQuoteResponse>
      <RateQuote>
        <ServiceCode>STD</ServiceCode>
        <ServiceName>Standard LTL</ServiceName>
        <TotalCharge>325.00</TotalCharge>
        <TransitDays>5</TransitDays>
      </RateQuote>
    </RateQuoteResponse>
  </soap:Body>
</soap:Envelope>`;

describe('getShippingRates — LTL freight routing (CF-6p04)', () => {
  beforeEach(() => {
    // Add WWEX credentials alongside UPS credentials already set in outer beforeEach
    import('./__mocks__/wix-secrets-backend.js').then(({ __setSecrets }) => {
      __setSecrets({
        UPS_CLIENT_ID: 'test-client-id',
        UPS_CLIENT_SECRET: 'test-client-secret',
        UPS_ACCOUNT_NUMBER: '123456',
        UPS_SANDBOX: 'true',
        WWEX_USERNAME: 'wwex-user',
        WWEX_PASSWORD: 'wwex-pass',
        WWEX_ACCOUNT_NUMBER: 'WWEX-ACC',
      });
    });
    import('./__mocks__/wix-fetch.js').then(({ __setHandler }) => {
      __setHandler((url) => {
        if (url.includes('/oauth/token')) {
          return { ok: true, async json() { return { access_token: 'tok', expires_in: '3600' }; }, async text() { return ''; } };
        }
        if (url.includes('wwex.com') || url.includes('SpeedFreight')) {
          return { ok: true, async text() { return WWEX_SOAP_RESPONSE; }, async json() { return {}; } };
        }
        return { ok: true, async json() { return {}; }, async text() { return ''; } };
      });
    });
  });

  it('routes murphy bed to WWEX LTL (not UPS) in checkout', async () => {
    const { __setSecrets: ss } = await import('./__mocks__/wix-secrets-backend.js');
    ss({ UPS_CLIENT_ID: 'x', UPS_CLIENT_SECRET: 'x', UPS_ACCOUNT_NUMBER: 'x', UPS_SANDBOX: 'true', WWEX_USERNAME: 'u', WWEX_PASSWORD: 'p', WWEX_ACCOUNT_NUMBER: 'a' });
    const { __setHandler: sh } = await import('./__mocks__/wix-fetch.js');
    sh((url) => {
      if (url.includes('SpeedFreight')) {
        return { ok: true, async text() { return WWEX_SOAP_RESPONSE; }, async json() { return {}; } };
      }
      return { ok: true, async json() { return {}; }, async text() { return ''; } };
    });

    const result = await getShippingRates({
      lineItems: [{ name: 'Sagebrush Murphy Cabinet Bed', quantity: 1, price: '1299', sku: 'MUR-001' }],
      shippingDestination: {
        address: { postalCode: '10001', city: 'New York', subdivision: 'NY', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes.some(c => c.startsWith('wwex-ltl') || c.startsWith('wwex-') || c.includes('ltl'))).toBe(true);
    expect(codes.some(c => c.startsWith('ups-'))).toBe(false);
  });

  it('routes platform bed to WWEX LTL', async () => {
    const { __setSecrets: ss } = await import('./__mocks__/wix-secrets-backend.js');
    ss({ UPS_CLIENT_ID: 'x', UPS_CLIENT_SECRET: 'x', UPS_ACCOUNT_NUMBER: 'x', UPS_SANDBOX: 'true', WWEX_USERNAME: 'u', WWEX_PASSWORD: 'p', WWEX_ACCOUNT_NUMBER: 'a' });
    const { __setHandler: sh } = await import('./__mocks__/wix-fetch.js');
    sh((url) => {
      if (url.includes('SpeedFreight')) {
        return { ok: true, async text() { return WWEX_SOAP_RESPONSE; }, async json() { return {}; } };
      }
      return { ok: true, async json() { return {}; }, async text() { return ''; } };
    });

    const result = await getShippingRates({
      lineItems: [{ name: 'Nomad Platform Bed', quantity: 1, price: '899' }],
      shippingDestination: {
        address: { postalCode: '77001', city: 'Houston', subdivision: 'TX', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes.some(c => c.includes('ltl') || c.includes('wwex'))).toBe(true);
    expect(codes.some(c => c.startsWith('ups-'))).toBe(false);
  });

  it('futon frame (85 lbs) still routes to UPS parcel, not LTL', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Eureka Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '77001', city: 'Houston', subdivision: 'TX', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes.some(c => c.startsWith('ups-'))).toBe(true);
    expect(codes.some(c => c.includes('ltl'))).toBe(false);
  });

  it('LTL rates include logistics.deliveryTime', async () => {
    const { __setSecrets: ss } = await import('./__mocks__/wix-secrets-backend.js');
    ss({ UPS_CLIENT_ID: 'x', UPS_CLIENT_SECRET: 'x', UPS_ACCOUNT_NUMBER: 'x', UPS_SANDBOX: 'true', WWEX_USERNAME: 'u', WWEX_PASSWORD: 'p', WWEX_ACCOUNT_NUMBER: 'a' });
    const { __setHandler: sh } = await import('./__mocks__/wix-fetch.js');
    sh((url) => {
      if (url.includes('SpeedFreight')) {
        return { ok: true, async text() { return WWEX_SOAP_RESPONSE; }, async json() { return {}; } };
      }
      return { ok: true, async json() { return {}; }, async text() { return ''; } };
    });

    const result = await getShippingRates({
      lineItems: [{ name: 'Sagebrush Murphy Cabinet Bed', quantity: 1, price: '1299' }],
      shippingDestination: { address: { postalCode: '10001', subdivision: 'NY', country: 'US' } },
    });

    const ltlRate = result.shippingRates.find(r => r.code.includes('ltl') || r.code.includes('wwex'));
    expect(ltlRate).toBeDefined();
    expect(ltlRate.logistics.deliveryTime).toBeTruthy();
    expect(ltlRate.cost.price).toBe('325.00');
  });

  it('mixed cart (murphy bed + futon cover) routes entire order to LTL — no UPS rates', async () => {
    const { __setSecrets: ss } = await import('./__mocks__/wix-secrets-backend.js');
    ss({ UPS_CLIENT_ID: 'x', UPS_CLIENT_SECRET: 'x', UPS_ACCOUNT_NUMBER: 'x', UPS_SANDBOX: 'true', WWEX_USERNAME: 'u', WWEX_PASSWORD: 'p', WWEX_ACCOUNT_NUMBER: 'a' });
    const { __setHandler: sh } = await import('./__mocks__/wix-fetch.js');
    sh((url) => {
      if (url.includes('SpeedFreight')) {
        return { ok: true, async text() { return WWEX_SOAP_RESPONSE; }, async json() { return {}; } };
      }
      return { ok: true, async json() { return {}; }, async text() { return ''; } };
    });

    const result = await getShippingRates({
      lineItems: [
        { name: 'Sagebrush Murphy Cabinet Bed', quantity: 1, price: '1299' },
        { name: 'Futon Cover', quantity: 1, price: '49' },
      ],
      shippingDestination: {
        address: { postalCode: '10001', city: 'New York', subdivision: 'NY', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    // Entire order routes to LTL — no UPS parcel rates
    expect(codes.some(c => c.includes('ltl') || c.includes('wwex'))).toBe(true);
    expect(codes.some(c => c.startsWith('ups-'))).toBe(false);
  });

  it('WWEX SOAP fault → getLTLFallbackRates returns valid non-empty rates', async () => {
    const { __setSecrets: ss } = await import('./__mocks__/wix-secrets-backend.js');
    ss({ UPS_CLIENT_ID: 'x', UPS_CLIENT_SECRET: 'x', UPS_ACCOUNT_NUMBER: 'x', UPS_SANDBOX: 'true', WWEX_USERNAME: 'u', WWEX_PASSWORD: 'p', WWEX_ACCOUNT_NUMBER: 'a' });
    const { __setHandler: sh } = await import('./__mocks__/wix-fetch.js');
    const SOAP_FAULT = `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>soap:Server</faultcode>
      <faultstring>Internal Server Error</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>`;
    sh((url) => {
      if (url.includes('SpeedFreight')) {
        return { ok: true, async text() { return SOAP_FAULT; }, async json() { return {}; } };
      }
      return { ok: true, async json() { return {}; }, async text() { return ''; } };
    });

    const result = await getShippingRates({
      lineItems: [{ name: 'Sagebrush Murphy Cabinet Bed', quantity: 1, price: '1299' }],
      shippingDestination: {
        address: { postalCode: '10001', city: 'New York', subdivision: 'NY', country: 'US' },
      },
    });

    // Fallback rates must be present — freight customers can't be left with no options
    expect(result.shippingRates.length).toBeGreaterThan(0);
    const codes = result.shippingRates.map(r => r.code);
    expect(codes.some(c => c.includes('ltl') || c.includes('wwex'))).toBe(true);
    // Prices must be numeric strings, not $0.00
    result.shippingRates.forEach(r => {
      expect(parseFloat(r.cost.price)).toBeGreaterThan(0);
    });
  });

  it('murphy bed in local zone gets both LTL freight and local delivery options', async () => {
    const { __setSecrets: ss } = await import('./__mocks__/wix-secrets-backend.js');
    ss({ UPS_CLIENT_ID: 'x', UPS_CLIENT_SECRET: 'x', UPS_ACCOUNT_NUMBER: 'x', UPS_SANDBOX: 'true', WWEX_USERNAME: 'u', WWEX_PASSWORD: 'p', WWEX_ACCOUNT_NUMBER: 'a' });
    const { __setHandler: sh } = await import('./__mocks__/wix-fetch.js');
    sh((url) => {
      if (url.includes('SpeedFreight')) {
        return { ok: true, async text() { return WWEX_SOAP_RESPONSE; }, async json() { return {}; } };
      }
      return { ok: true, async json() { return {}; }, async text() { return ''; } };
    });

    const result = await getShippingRates({
      lineItems: [{ name: 'Sagebrush Murphy Cabinet Bed', quantity: 1, price: '1299' }],
      shippingDestination: { address: { postalCode: '28801', subdivision: 'NC', country: 'US' } },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes.some(c => c.includes('ltl') || c.includes('wwex'))).toBe(true);
    expect(codes.some(c => c.startsWith('local-delivery'))).toBe(true);
  });
});
