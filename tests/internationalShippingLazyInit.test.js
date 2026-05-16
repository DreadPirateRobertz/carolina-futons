/**
 * cf-r6q7 (cf-t8k1.fu2) — Pins the lazy-init contract for
 * internationalShipping.web.js with an EMPTY public/sharedTokens mock.
 *
 * Mirrors PR fu1's split-file structure exactly (cf-t8k1.fu1):
 * companion file tests/internationalShippingLazyInitPopulated.test.js
 * pins the populated-mock contracts. Split because the CF-fgsw
 * noDoMockInTestBody invariant forbids per-test mock-shape swaps via
 * `vi.doMock` — each test file declares its mock shape once at top level.
 *
 * The local invariant pinned here: module imports cleanly with a
 * TRULY EMPTY sharedTokens mock (named exports resolve to undefined).
 * Getter calls then throw synchronously, surfacing the misconfig at
 * first use rather than at module-import time. Pre-fix this module
 * destructured `const { zones, restrictedCountries, freeInternationalThreshold } =
 * internationalShippingConfig` at top-level, which blocked the entire
 * test file's collection with TypeError during import.
 */

import { describe, it, expect, vi } from 'vitest';

// EMPTY mock — named imports resolve to undefined. Pre-fix this would
// have crashed module import; post-fix import succeeds and only the
// getter calls would surface the missing-config TypeError.
vi.mock('public/sharedTokens.js', () => ({}));

// Stub remaining transitive imports so the module-load path runs to
// completion under this minimal mock surface.
vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

describe('cf-r6q7 — internationalShipping lazy-init contract (empty mock)', () => {
  it('imports cleanly with EMPTY public/sharedTokens mock (no module-init deref)', async () => {
    // Pre-fix: TypeError during import — top-level destructure on
    // undefined `internationalShippingConfig` crashes module load and
    // blocks any test in the file from running.
    //
    // Post-fix: import succeeds; named exports are present.
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(mod).toBeDefined();
    expect(typeof mod.getInternationalZones).toBe('function');
    expect(typeof mod.getRestrictedCountries).toBe('function');
    expect(typeof mod.getFreeInternationalThreshold).toBe('function');
  });

  it('getInternationalZones throws clearly when sharedTokens is empty', async () => {
    // Mirrors fu1's `getOriginAddress throws clearly` test — the
    // getter call surfaces the missing-config TypeError at use-site,
    // NOT silently into `undefined`. With the empty mock above,
    // `internationalShippingConfig` is undefined, so `.zones` throws.
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(() => mod.getInternationalZones()).toThrow();
  });

  it('getRestrictedCountries throws clearly when sharedTokens is empty', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(() => mod.getRestrictedCountries()).toThrow();
  });

  it('getFreeInternationalThreshold throws clearly when sharedTokens is empty', async () => {
    const mod = await import('../src/backend/internationalShipping.web.js');
    expect(() => mod.getFreeInternationalThreshold()).toThrow();
  });
});
