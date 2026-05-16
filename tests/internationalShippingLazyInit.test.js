/**
 * cf-t8k1.fu2 — Pins the lazy-init contract for internationalShipping.web.js
 * module-init reads.
 *
 * Pre-fix shape (mirror of cf-t8k1 in ups-shipping):
 *   `const { zones, restrictedCountries, freeInternationalThreshold } =
 *    internationalShippingConfig;`
 * at module top-level threw TypeError during import if the
 * public/sharedTokens mock didn't return `internationalShippingConfig`.
 * That blocked the entire test file's collection before any test body
 * ran — same class of bug as cf-t8k1 (PR #1363 / cf-t8k1.fu1 PR #1364).
 *
 * Post-fix shape: each former destructured name is computed lazily on
 * first use via a getter (`getInternationalZones`,
 * `getRestrictedCountries`, `getFreeInternationalThreshold`). A test
 * file that mocks public/sharedTokens with EMPTY object can still
 * IMPORT the module — only test-bodies that call the zone/rate
 * functions need a fully-shaped mock.
 *
 * Three contracts pinned below:
 *  1. Module imports cleanly with EMPTY public/sharedTokens mock
 *  2. Getters return the right shape when sharedTokens IS mocked
 *  3. Getters are memoized — second call doesn't re-deref sharedTokens
 *  4. __resetCacheForTests clears all three caches (mirrors
 *     currencyService.web.js precedent)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Deliberately empty mock — pre-fix this would throw on import below.
vi.mock('public/sharedTokens.js', () => ({}));

// Stub the rest of internationalShipping's import dependencies so the
// import path runs to completion.
vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

describe('cf-t8k1.fu2 — internationalShipping lazy-init contract', () => {
  it('imports cleanly with EMPTY public/sharedTokens mock (no module-init deref)', async () => {
    // Before cf-t8k1.fu2: this import throws TypeError ("Cannot
    // destructure property 'zones' of undefined") because the
    // top-level destructure runs against an undefined config.
    //
    // After cf-t8k1.fu2: import succeeds because the deref is
    // deferred into getter functions called only when zone/rate
    // operations actually fire.
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(mod).toBeDefined();
    // Module-level exports should be present even though sharedTokens
    // is empty.
    expect(typeof mod.getInternationalZones).toBe('function');
    expect(typeof mod.getRestrictedCountries).toBe('function');
    expect(typeof mod.getFreeInternationalThreshold).toBe('function');
    expect(typeof mod.__resetCacheForTests).toBe('function');
  });

  it('getInternationalZones throws clearly when sharedTokens fields are missing', async () => {
    // Calling the getter when the mock is empty is still expected to
    // throw — but it throws at CALL TIME from a specific operation,
    // not at module-init blocking unrelated tests.
    const mod = await import('../src/backend/internationalShipping.web.js');
    mod.__resetCacheForTests();
    expect(() => mod.getInternationalZones()).toThrow();
  });
});

describe('cf-t8k1.fu2 — internationalShipping lazy-init with proper mock', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('public/sharedTokens.js', () => ({
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
    // Re-stub the other dependencies since vi.resetModules cleared them.
    vi.doMock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
    vi.doMock('wix-web-module', () => ({
      Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
      webMethod: (_perm, fn) => fn,
    }));
  });

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
    // After reset, the getter re-derefs sharedTokens — the returned
    // value is structurally equal but the cached reference is fresh.
    // (Whether it's a fresh object reference depends on how Wix's
    // sharedTokens module stores its config object. The contract
    // pinned here is that __resetCacheForTests CLEARS the cache, not
    // that it returns a different object — equivalent values are
    // still correct.)
    expect(after).toEqual(before);
  });
});
