/**
 * cf-r6q7 (cf-t8k1.fu2) — Pins the lazy-init getter shape + memoization
 * invariant for internationalShipping.web.js with a POPULATED
 * public/sharedTokens mock.
 *
 * Companion file to tests/internationalShippingLazyInit.test.js (the
 * empty-mock contract test). Split into two files because the
 * CF-fgsw noDoMockInTestBody invariant forbids per-describe
 * mock-shape swaps via `vi.doMock` — each test file must declare its
 * mock shape once at the top level. This file pins the populated case.
 */

import { describe, it, expect, vi } from 'vitest';

// Populated mock — the shape internationalShipping.web.js needs to
// compute zones, restricted, and threshold via the lazy-init getters.
vi.mock('public/sharedTokens.js', () => ({
  internationalShippingConfig: {
    zones: {
      na: { name: 'North America', countries: ['CA', 'MX'], baseRate: 25, perPoundRate: 2, estimatedDays: '7-14' },
      eu: { name: 'Europe', countries: ['GB', 'FR', 'DE'], baseRate: 40, perPoundRate: 3, estimatedDays: '10-20' },
      other: { name: 'Other', countries: [], baseRate: 50, perPoundRate: 5, estimatedDays: '14-28' },
    },
    restrictedCountries: ['CU', 'IR', 'KP'],
    freeInternationalThreshold: 1500,
  },
  business: { address: {} },
}));

vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

describe('cf-r6q7 — internationalShipping lazy-init contract (populated mock)', () => {
  it('getInternationalZones returns the zones map', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    const zones = mod.getInternationalZones();
    expect(zones).toBeDefined();
    expect(zones.na.countries).toContain('CA');
    expect(zones.eu.countries).toContain('GB');
  });

  it('getRestrictedCountries returns the restricted list', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(mod.getRestrictedCountries()).toEqual(['CU', 'IR', 'KP']);
  });

  it('getFreeInternationalThreshold returns the configured threshold', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(mod.getFreeInternationalThreshold()).toBe(1500);
  });

  it('getInternationalZones is memoized — repeat calls return identical reference', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    const a = mod.getInternationalZones();
    const b = mod.getInternationalZones();
    expect(a).toBe(b); // Identity equality is the singleton contract.
  });

  it('getRestrictedCountries + getFreeInternationalThreshold are independently memoized', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(mod.getRestrictedCountries()).toBe(mod.getRestrictedCountries());
    expect(mod.getFreeInternationalThreshold()).toBe(mod.getFreeInternationalThreshold());
  });

  it('getShippingZone webMethod uses getter — proves consumer-level continuity', async () => {
    // pr-test-analyzer Gap 2 — verify webMethod consumer flows through
    // the new getters cleanly with a populated config.
    const mod = await import('../src/backend/internationalShipping.web.js');
    const result = await mod.getShippingZone('CA');
    expect(result.success).toBe(true);
    expect(result.zone).toBe('na');
  });
});
