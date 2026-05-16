/**
 * cf-t8k1.fu2 — Pins the lazy-init contract for internationalShipping.web.js
 * with an EMPTY public/sharedTokens mock.
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
 * first use via a getter. A test file that mocks public/sharedTokens
 * with EMPTY object can still IMPORT the module — only test-bodies
 * that call the zone/rate functions need a fully-shaped mock.
 *
 * This file pins the EMPTY-mock contract via TOP-LEVEL vi.mock (per
 * noDoMockInTestBody invariant, CF-fgsw). The companion file
 * tests/internationalShippingLazyInitPopulated.test.js pins the
 * getter-shape + memoization + cache-reset contracts with a populated
 * mock — split into two files because the per-describe mock-shape
 * swap that would otherwise require vi.doMock is precisely what the
 * invariant forbids.
 */

import { describe, it, expect, vi } from 'vitest';

// EMPTY mock — pre-fix this would have thrown on import below.
vi.mock('public/sharedTokens.js', () => ({}));

// Stub the rest of internationalShipping's import dependencies so the
// import path runs to completion.
vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

describe('cf-t8k1.fu2 — internationalShipping lazy-init contract (empty mock)', () => {
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
