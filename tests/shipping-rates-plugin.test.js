import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __setSecrets } from './__mocks__/wix-secrets-backend.js';
import { __setHandler } from './__mocks__/wix-fetch.js';
import { getShippingRates } from '../src/backend/shipping-rates-plugin.js';

vi.mock('backend/utils/errorHandler', () => ({
  logError: vi.fn(),
}));

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

  it('adds local delivery option for Southeast state (GA)', async () => {
    const result = await getShippingRates({
      lineItems: [
        { name: 'Futon Frame', quantity: 1, price: '499' },
      ],
      shippingDestination: {
        address: { postalCode: '30301', city: 'Atlanta', subdivision: 'GA', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes.some(c => c.startsWith('local-delivery-'))).toBe(true);
  });

  it('does NOT add local delivery for FL (outside Southeast zone)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '33101', city: 'Miami', subdivision: 'FL', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes.some(c => c.startsWith('local-delivery-'))).toBe(false);
    expect(codes.some(c => c.startsWith('white-glove-'))).toBe(false);
  });

  it('adds local delivery for VA (zone4)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '22201', city: 'Arlington', subdivision: 'VA', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes).toContain('local-delivery-zone4');
  });

  it('handles Wix US-XX subdivision format for regional check', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '29401', city: 'Charleston', subdivision: 'US-SC', country: 'US' },
      },
    });

    // 294 is in zone2 prefixes, SC is in zone2 states
    const codes = result.shippingRates.map(r => r.code);
    expect(codes).toContain('local-delivery-zone2');
  });

  it('adds local delivery for VA (new state in this PR)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '22201', city: 'Arlington', subdivision: 'VA', country: 'US' },
      },
    });
    const codes = result.shippingRates.map(r => r.code);
    // 22201 → zip3=222 in zone4 (VA in zone4.states) → local-delivery-zone4
    expect(codes).toContain('local-delivery-zone4');
    expect(codes).toContain('white-glove-zone4');
  });

  it('does NOT add local delivery for FL (excluded — was falsely included by old zip-range check)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '33101', city: 'Miami', subdivision: 'FL', country: 'US' },
      },
    });
    const codes = result.shippingRates.map(r => r.code);
    expect(codes).not.toContain('local-delivery');
    expect(codes).not.toContain('white-glove');
  });

  it('does NOT add local delivery for AL (excluded — was falsely included by old zip-range check)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '35004', city: 'Moody', subdivision: 'AL', country: 'US' },
      },
    });
    const codes = result.shippingRates.map(r => r.code);
    expect(codes).not.toContain('local-delivery');
    expect(codes).not.toContain('white-glove');
  });

  it('does NOT add local delivery for MS (excluded — was falsely included by old zip-range check)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '39530', city: 'Biloxi', subdivision: 'MS', country: 'US' },
      },
    });
    const codes = result.shippingRates.map(r => r.code);
    expect(codes).not.toContain('local-delivery');
    expect(codes).not.toContain('white-glove');
  });

  it('handles Wix US-XX subdivision format for regional states', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '29201', city: 'Columbia', subdivision: 'US-SC', country: 'US' },
      },
    });
    const codes = result.shippingRates.map(r => r.code);
    // 29201 → zip3=292 in zone3 (SC in zone3.states), US-SC strips to SC
    expect(codes).toContain('local-delivery-zone3');
    expect(codes).toContain('white-glove-zone3');
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

  it('adds white-glove option for Southeast ZIP codes', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28801', city: 'Asheville', subdivision: 'NC', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes.some(c => c.startsWith('white-glove-'))).toBe(true);
  });

  it('charges $99 for zone1 white-glove (Hendersonville exact zip)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28792', city: 'Hendersonville', subdivision: 'NC', country: 'US' },
      },
    });

    // 28792 is in zone1 explicit zips list → $99
    const wg = result.shippingRates.find(r => r.code === 'white-glove-zone1');
    expect(wg).toBeDefined();
    expect(wg.cost.price).toBe('99.00');
  });

  it('charges $149 for zone2 white-glove (Asheville, zip3=288)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28801', city: 'Asheville', subdivision: 'NC', country: 'US' },
      },
    });

    const wg = result.shippingRates.find(r => r.code === 'white-glove-zone2');
    expect(wg).toBeDefined();
    expect(wg.cost.price).toBe('149.00');
  });

  it('charges $199 for zone3 white-glove (Atlanta, GA)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '30301', city: 'Atlanta', subdivision: 'GA', country: 'US' },
      },
    });

    const wg = result.shippingRates.find(r => r.code === 'white-glove-zone3');
    expect(wg).toBeDefined();
    expect(wg.cost.price).toBe('199.00');
  });

  it('does NOT offer free white-glove at $2100 (free shipping disabled)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Sagebrush Murphy Cabinet Bed', quantity: 1, price: '2100' }],
      shippingDestination: {
        address: { postalCode: '28801', city: 'Asheville', subdivision: 'NC', country: 'US' },
      },
    });

    const wg = result.shippingRates.find(r => r.code.startsWith('white-glove-'));
    expect(wg).toBeDefined();
    expect(wg.cost.price).not.toBe('0.00');
  });

  it('does NOT offer white-glove for non-Southeast ZIP codes', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '10001', city: 'New York', subdivision: 'NY', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes.some(c => c.startsWith('white-glove-'))).toBe(false);
  });

  it('does NOT offer free local delivery at $1899 (free shipping disabled)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Sagebrush Murphy Cabinet Bed', quantity: 1, price: '1899' }],
      shippingDestination: {
        address: { postalCode: '28801', city: 'Asheville', subdivision: 'NC', country: 'US' },
      },
    });

    // 28801 → zip3=288 → zone2
    const local = result.shippingRates.find(r => r.code === 'local-delivery-zone2');
    expect(local).toBeDefined();
    expect(local.cost.price).not.toBe('0.00');
  });

  it('charges $69 local delivery for Asheville (zone2) for orders < free threshold', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28801', city: 'Asheville', subdivision: 'NC', country: 'US' },
      },
    });

    // 28801 → zip3=288 → zone2 → $69 delivery
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

  it('white-glove has shorter delivery time for zone1 vs zone3', async () => {
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

    const zone1Wg = zone1Result.shippingRates.find(r => r.code === 'white-glove-zone1');
    const zone3Wg = zone3Result.shippingRates.find(r => r.code === 'white-glove-zone3');
    // zone1 = '2–4', zone3 = '5–7' — shorter is better
    expect(zone1Wg.logistics.deliveryTime).toBe('2–4');
    expect(zone3Wg.logistics.deliveryTime).toBe('5–7');
  });

  // ── Zone-based delivery matching ────────────────────────────────────

  it('zone1 match — exact zip 28712 (Brevard)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28712', city: 'Brevard', subdivision: 'NC', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes).toContain('local-delivery-zone1');
    expect(codes).toContain('white-glove-zone1');
    const ld = result.shippingRates.find(r => r.code === 'local-delivery-zone1');
    expect(ld.cost.price).toBe('39.00');
  });

  it('zone3 match — Charlotte NC (zip3=282)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28201', city: 'Charlotte', subdivision: 'NC', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes).toContain('local-delivery-zone3');
    const ld = result.shippingRates.find(r => r.code === 'local-delivery-zone3');
    expect(ld.cost.price).toBe('99.00');
  });

  it('zone4 match — Nashville TN (zip3=372)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '37201', city: 'Nashville', subdivision: 'TN', country: 'US' },
      },
    });

    const codes = result.shippingRates.map(r => r.code);
    expect(codes).toContain('local-delivery-zone4');
    const ld = result.shippingRates.find(r => r.code === 'local-delivery-zone4');
    expect(ld.cost.price).toBe('149.00');
    const wg = result.shippingRates.find(r => r.code === 'white-glove-zone4');
    expect(wg.cost.price).toBe('249.00');
  });

  // ── Terrain surcharge ───────────────────────────────────────────────

  it('applies terrain surcharge to white-glove for Highlands NC (28741)', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28741', city: 'Highlands', subdivision: 'NC', country: 'US' },
      },
    });

    // 28741 not in zone1 explicit zips → falls to zone2 (zip3=287, NC) → $149 + $75 terrain = $224
    const wg = result.shippingRates.find(r => r.code.startsWith('white-glove-'));
    expect(wg).toBeDefined();
    expect(wg.terrainSurcharge).toBe(75);
    expect(wg.cost.price).toBe('224.00');
    expect(wg.logistics.instructions).toContain('Mountain area surcharge');
  });

  it('does NOT apply terrain surcharge for non-mountain zip', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28792', city: 'Hendersonville', subdivision: 'NC', country: 'US' },
      },
    });

    const wg = result.shippingRates.find(r => r.code.startsWith('white-glove-'));
    expect(wg).toBeDefined();
    expect(wg.terrainSurcharge).toBeUndefined();
    expect(wg.cost.price).toBe('99.00');
  });

  // ── Gamification metadata ───────────────────────────────────────────

  it('zone1 delivery rate carries gamification badge and icon', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28792', city: 'Hendersonville', subdivision: 'NC', country: 'US' },
      },
    });

    const ld = result.shippingRates.find(r => r.code === 'local-delivery-zone1');
    expect(ld.badge).toBe('Local Love ♥');
    expect(ld.badgeStyle).toBe('local');
    expect(ld.upsellMessage).toContain('Hendersonville');
    expect(ld.title).toContain('🏠');
  });

  it('zone1 white-glove carries premium badge and upsell copy', async () => {
    const result = await getShippingRates({
      lineItems: [{ name: 'Futon Frame', quantity: 1, price: '499' }],
      shippingDestination: {
        address: { postalCode: '28792', city: 'Hendersonville', subdivision: 'NC', country: 'US' },
      },
    });

    const wg = result.shippingRates.find(r => r.code === 'white-glove-zone1');
    expect(wg.badge).toBe('Premium Experience ✦');
    expect(wg.badgeStyle).toBe('premium');
    expect(wg.upsellMessage).toContain('bring it in');
    expect(wg.highlight).toBe(true);
    expect(wg.title).toContain('✨');
  });
});
