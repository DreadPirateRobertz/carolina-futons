/**
 * cf-t8k1.fu2 — Pins the lazy-init getter shape + memoization +
 * cache-reset invariants for internationalShipping.web.js with a
 * POPULATED public/sharedTokens mock.
 *
 * Companion file to tests/internationalShippingLazyInit.test.js (the
 * empty-mock contract test). Split into two files because the
 * noDoMockInTestBody invariant (CF-fgsw) forbids per-describe
 * mock-shape swaps via vi.doMock — each test file must declare its
 * mock shape once at the top level. This file pins the populated case.
 */

import { describe, it, expect, vi } from 'vitest';

// Populated mock — the shape internationalShipping.web.js needs to
// compute zones / restrictedCountries / freeInternationalThreshold via
// the lazy-init getters.
vi.mock('public/sharedTokens.js', () => ({
  internationalShippingConfig: {
    zones: {
      americas: { name: 'Americas', countries: ['CA', 'MX'], baseRate: 50, perPoundRate: 2, estimatedDays: '5-7' },
      europe: { name: 'Europe', countries: ['GB', 'DE'], baseRate: 100, perPoundRate: 4, estimatedDays: '7-14' },
      other: { name: 'Other', countries: [], baseRate: 200, perPoundRate: 6, estimatedDays: '14-21' },
    },
    restrictedCountries: ['KP', 'IR'],
    freeInternationalThreshold: 2500,
  },
}));

vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

describe('cf-t8k1.fu2 — internationalShipping lazy-init contract (populated mock)', () => {
  it('getInternationalZones returns the zone map', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    const zones = mod.getInternationalZones();
    expect(zones.americas.name).toBe('Americas');
    expect(zones.americas.countries).toEqual(['CA', 'MX']);
    expect(zones.europe.baseRate).toBe(100);
    expect(zones.other.estimatedDays).toBe('14-21');
  });

  it('getRestrictedCountries returns the restricted-country list', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(mod.getRestrictedCountries()).toEqual(['KP', 'IR']);
  });

  it('getFreeInternationalThreshold returns the threshold value', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(mod.getFreeInternationalThreshold()).toBe(2500);
  });

  it('getInternationalZones is memoized — repeat calls return identical reference', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    const a = mod.getInternationalZones();
    const b = mod.getInternationalZones();
    expect(a).toBe(b);
  });

  it('__resetCacheForTests clears all three caches', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    const before = mod.getInternationalZones();
    mod.__resetCacheForTests();
    const after = mod.getInternationalZones();
    expect(after).toEqual(before);
  });
});
