/**
 * cf-r6q7 (cf-t8k1.fu2) — Pins the lazy-init contract for
 * internationalShipping.web.js module-init reads.
 *
 * Pre-fix shape: top-level
 *   `const { zones, restrictedCountries, freeInternationalThreshold } = internationalShippingConfig;`
 * threw TypeError during module import if the public/sharedTokens mock
 * didn't return `internationalShippingConfig`. Blocked the entire test
 * file's collection before any test body ran — sibling of the cf-t8k1
 * trap that PR #1363 / PR #1364 closed for ups-shipping.web.js.
 *
 * Post-fix shape: 3 lazy-init getters
 *   - getInternationalZones()
 *   - getRestrictedCountries()
 *   - getFreeInternationalThreshold()
 * each cached via module-level `let _cache = null`.
 *
 * Contracts pinned:
 *  1. Module imports cleanly with EMPTY public/sharedTokens mock
 *  2. Getters throw at CALL-TIME (not module-init) when fields are missing
 *  3. Getters return correct values when mock IS shaped
 *  4. Getters are memoized — repeat calls return identical references
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Deliberately empty mock — pre-fix this would throw on import below.
vi.mock('public/sharedTokens.js', () => ({}));

// Stub the rest so the import path runs to completion.
vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

describe('cf-r6q7 — internationalShipping lazy-init contract', () => {
  it('imports cleanly with EMPTY public/sharedTokens mock (no module-init deref)', async () => {
    // Pre-fix: this import throws TypeError ("Cannot destructure property
    // 'zones' of undefined") because internationalShippingConfig is
    // destructured at module top-level.
    //
    // Post-fix: import succeeds because the destructure is deferred into
    // getter functions called only when zone / restriction / threshold
    // lookups actually fire.
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(mod).toBeDefined();
    expect(typeof mod.getInternationalZones).toBe('function');
    expect(typeof mod.getRestrictedCountries).toBe('function');
    expect(typeof mod.getFreeInternationalThreshold).toBe('function');
  });

  it('getInternationalZones throws clearly when sharedTokens fields are missing', async () => {
    // Calling the getter when the mock is empty is still expected to
    // throw — but it throws at CALL TIME from a specific operation, not
    // at module-init blocking unrelated tests.
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(() => mod.getInternationalZones()).toThrow();
  });
});

describe('cf-r6q7 — internationalShipping lazy-init with proper mock', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock('public/sharedTokens.js', () => ({
      internationalShippingConfig: {
        zones: {
          canada: { name: 'Canada', countries: ['CA'], rates: { ground: 50 } },
          other: { name: 'Other', countries: [], rates: { ground: 200 } },
        },
        restrictedCountries: ['XX', 'YY'],
        freeInternationalThreshold: 5000,
      },
      business: { name: 'Test Co' },
    }));
    vi.doMock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
    vi.doMock('wix-web-module', () => ({
      Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
      webMethod: (_perm, fn) => fn,
    }));
  });

  it('getInternationalZones returns the zones object shape', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    const zones = mod.getInternationalZones();
    expect(zones).toHaveProperty('canada');
    expect(zones.canada.name).toBe('Canada');
    expect(zones.canada.countries).toEqual(['CA']);
  });

  it('getRestrictedCountries returns the restriction list', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(mod.getRestrictedCountries()).toEqual(['XX', 'YY']);
  });

  it('getFreeInternationalThreshold returns the threshold dollars', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(mod.getFreeInternationalThreshold()).toBe(5000);
  });

  it('getInternationalZones is memoized — repeat calls return identical reference', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    const a = mod.getInternationalZones();
    const b = mod.getInternationalZones();
    expect(a).toBe(b);
  });

  it('getRestrictedCountries is memoized — repeat calls return identical reference', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    const a = mod.getRestrictedCountries();
    const b = mod.getRestrictedCountries();
    expect(a).toBe(b);
  });
});
