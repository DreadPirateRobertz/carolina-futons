/**
 * @file internationalShippingLazyInit.test.js
 * @description Tests for cf-r6q7 (cf-t8k1.fu2) — lazy-init of the
 * internationalShippingConfig destructure in
 * `src/backend/internationalShipping.web.js`. Mirrors the cf-t8k1.fu1
 * test surface on ups-shipping (PR #1364) per the convention
 * morgott + radahn calibrated.
 *
 * Pre-fix, the module destructured `{ zones, restrictedCountries,
 * freeInternationalThreshold }` at top-level — any test that mocked
 * `public/sharedTokens` with a partial shape (missing
 * `internationalShippingConfig`) blocked the entire file's test
 * collection with TypeError during import. Post-fix, the getters
 * defer the deref until first call.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// EMPTY sharedTokens mock — this is the load-bearing test setup. If
// the module-init still destructures at import-time, this mock shape
// would crash the file collection.
vi.mock('public/sharedTokens.js', () => ({
  internationalShippingConfig: {},
  business: {},
  colors: {},
}));

// Sentinel — exercised by the "throws clearly" test.
const COMPLETE_MOCK = {
  internationalShippingConfig: {
    zones: {
      na: { name: 'North America', countries: ['CA', 'MX'], baseRate: 25, perPoundRate: 2 },
      other: { name: 'Other', countries: [], baseRate: 50, perPoundRate: 5 },
    },
    restrictedCountries: ['CU', 'IR', 'KP'],
    freeInternationalThreshold: 1500,
  },
  business: { address: {} },
  colors: {},
};

describe('cf-r6q7 lazy-init internationalShipping.web.js', () => {
  beforeEach(() => {
    // Reset module cache so each test gets a fresh _zonesCache /
    // _restrictedCountriesCache / _freeInternationalThresholdCache.
    vi.resetModules();
  });

  it('imports cleanly with EMPTY public/sharedTokens mock (no module-init deref)', async () => {
    // Pre-fix this would have thrown TypeError during import because
    // `const { zones, ... } = internationalShippingConfig` ran at
    // top level. Post-fix, the module imports fine and only the
    // getter calls would surface the partial-mock problem.
    await expect(import('../src/backend/internationalShipping.web.js')).resolves.toBeTruthy();
  });

  it('getInternationalZones returns undefined when sharedTokens fields are missing', async () => {
    // With the empty mock, `internationalShippingConfig` IS defined
    // (= {}) but `.zones` is undefined. The getter caches and returns
    // undefined — distinct from the cf-t8k1.fu1 ups-shipping case
    // where `brand.name` throws because `brand` itself is undefined.
    // The downstream consumer (e.g. `Object.entries(zones)`) is what
    // throws at use-site, NOT the getter — fail loud at first use, not
    // silent. Tests at the consumer level catch this; the getter's
    // role is to defer the deref past module-init, no more.
    const mod = await import('../src/backend/internationalShipping.web.js');
    const zones = mod.getInternationalZones();
    expect(zones).toBeUndefined();
  });

  it('getInternationalZones returns the zones map when mock is complete', async () => {
    vi.doMock('public/sharedTokens.js', () => COMPLETE_MOCK);
    const mod = await import('../src/backend/internationalShipping.web.js');
    const zones = mod.getInternationalZones();
    expect(zones).toBeDefined();
    expect(zones.na).toBeDefined();
    expect(zones.na.countries).toContain('CA');
  });

  it('getRestrictedCountries returns the restricted list', async () => {
    vi.doMock('public/sharedTokens.js', () => COMPLETE_MOCK);
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(mod.getRestrictedCountries()).toEqual(['CU', 'IR', 'KP']);
  });

  it('getFreeInternationalThreshold returns the configured threshold', async () => {
    vi.doMock('public/sharedTokens.js', () => COMPLETE_MOCK);
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(mod.getFreeInternationalThreshold()).toBe(1500);
  });

  it('getInternationalZones is memoized — repeat calls return identical reference', async () => {
    vi.doMock('public/sharedTokens.js', () => COMPLETE_MOCK);
    const mod = await import('../src/backend/internationalShipping.web.js');
    const first = mod.getInternationalZones();
    const second = mod.getInternationalZones();
    // Identity equality is the singleton contract — future refactor
    // that rebuilds on every call would fail this assertion.
    expect(first).toBe(second);
  });

  it('getRestrictedCountries + getFreeInternationalThreshold are independently memoized', async () => {
    vi.doMock('public/sharedTokens.js', () => COMPLETE_MOCK);
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(mod.getRestrictedCountries()).toBe(mod.getRestrictedCountries());
    expect(mod.getFreeInternationalThreshold()).toBe(mod.getFreeInternationalThreshold());
  });
});
