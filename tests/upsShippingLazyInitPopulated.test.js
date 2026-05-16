/**
 * cf-t8k1.fu1 — Pins the lazy-init getter shape + memoization invariant
 * for ups-shipping.web.js with a POPULATED public/sharedTokens mock.
 *
 * Companion file to tests/upsShippingLazyInit.test.js (the empty-mock
 * contract test). Split into two files because the noDoMockInTestBody
 * invariant (CF-fgsw) forbids per-describe mock-shape swaps via
 * vi.doMock — each test file must declare its mock shape once at the
 * top level. This file pins the populated case.
 */

import { describe, it, expect, vi } from 'vitest';

// Populated mock — the shape ups-shipping.web.js needs to compute
// ORIGIN_ADDRESS + FREE_SHIPPING_THRESHOLD via the lazy-init getters.
vi.mock('public/sharedTokens', () => ({
  brand: { name: 'Test Co' },
  business: {
    phoneDigits: '5550000000',
    address: { street: '1 Way', city: 'TestCity', state: 'TS', zip: '12345' },
  },
  shippingConfig: { freeThreshold: 750 },
}));

vi.mock('wix-secrets-backend', () => ({ getSecret: vi.fn() }));
vi.mock('wix-fetch', () => ({ fetch: vi.fn() }));
vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

describe('cf-t8k1.fu1 — ups-shipping lazy-init contract (populated mock)', () => {
  it('getOriginAddress returns the brand + business address shape', async () => {
    const mod = await import('../src/backend/ups-shipping.web.js');
    const origin = mod.getOriginAddress();
    expect(origin.Name).toBe('Test Co');
    expect(origin.AddressLine).toEqual(['1 Way']);
    expect(origin.City).toBe('TestCity');
    expect(origin.StateProvinceCode).toBe('TS');
    expect(origin.PostalCode).toBe('12345');
    expect(origin.CountryCode).toBe('US');
  });

  it('getFreeShippingThreshold returns shippingConfig.freeThreshold', async () => {
    const mod = await import('../src/backend/ups-shipping.web.js');
    expect(mod.getFreeShippingThreshold()).toBe(750);
  });

  it('getOriginAddress is memoized — repeat calls return identical object', async () => {
    const mod = await import('../src/backend/ups-shipping.web.js');
    const a = mod.getOriginAddress();
    const b = mod.getOriginAddress();
    expect(a).toBe(b); // Same reference, not a fresh object each call.
  });
});
