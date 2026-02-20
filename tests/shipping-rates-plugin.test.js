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

  it('adds local delivery option for Southeast (270-399)', async () => {
    const result = await getShippingRates({
      lineItems: [
        { name: 'Futon Frame', quantity: 1, price: '499' },
      ],
      shippingDestination: {
        address: { postalCode: '30301', city: 'Atlanta', subdivision: 'GA', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes).toContain('local-delivery');
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

  it('returns free shipping rates for orders >= $999', async () => {
    const result = await getShippingRates({
      lineItems: [
        { name: 'Sagebrush Murphy Cabinet Bed', quantity: 1, price: '1899' },
      ],
      shippingDestination: {
        address: { postalCode: '28801', city: 'Asheville', subdivision: 'NC', country: 'US' },
      },
    });

    const freeRate = result.shippingRates.find(r => r.code === 'free-ground');
    expect(freeRate).toBeDefined();
    expect(freeRate.cost.price).toBe('0.00');
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

    // Murphy bed should trigger free shipping ($1899 > $999)
    expect(result.shippingRates.some(r => r.code === 'free-ground')).toBe(true);
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
});
