/**
 * cf-t8k1.fu1 — Pins the lazy-init contract for ups-shipping.web.js
 * with an EMPTY public/sharedTokens mock.
 *
 * Pre-fix shape: top-level `const ORIGIN_ADDRESS = { Name: brand.name, ... }`
 * threw TypeError during module import if the public/sharedTokens mock
 * didn't return `brand`. That blocked the entire test file's collection
 * before any test body ran — see cf-t8k1 (PR #1363).
 *
 * Post-fix shape: the constant is computed lazily on first use via a
 * getter function. A test file that mocks public/sharedTokens with
 * EMPTY object can still IMPORT the module — only test-bodies that call
 * the rate/label/tracking functions need a fully-shaped mock.
 *
 * This file pins the empty-mock contract via TOP-LEVEL vi.mock (per
 * noDoMockInTestBody invariant, CF-fgsw). The companion file
 * tests/upsShippingLazyInitPopulated.test.js pins the getter-shape +
 * memoization contracts with a populated mock — split into two files
 * because the per-describe mock-shape swap that would otherwise require
 * vi.doMock is precisely what the invariant forbids.
 */

import { describe, it, expect, vi } from 'vitest';

// EMPTY mock — pre-fix this would have thrown on import below.
vi.mock('public/sharedTokens', () => ({}));

// Stub the rest of ups-shipping's import dependencies so the import path
// runs to completion.
vi.mock('wix-secrets-backend', () => ({ getSecret: vi.fn() }));
vi.mock('wix-fetch', () => ({ fetch: vi.fn() }));
vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

describe('cf-t8k1.fu1 — ups-shipping lazy-init contract (empty mock)', () => {
  it('imports cleanly with EMPTY public/sharedTokens mock (no module-init deref)', async () => {
    // Before cf-t8k1.fu1: this import throws TypeError ("Cannot read
    // properties of undefined (reading 'name')") because `brand.name`
    // is destructured at module top-level.
    //
    // After cf-t8k1.fu1: import succeeds because the brand.name read
    // is deferred into a getter function called only when shipping
    // operations actually fire.
    const mod = await import('../src/backend/ups-shipping.web.js');
    expect(mod).toBeDefined();
    // Module-level exports should be present even though sharedTokens
    // is empty. The lazy-init pattern means a test that doesn't exercise
    // rate / label / tracking surfaces doesn't need to mock the brand.
    expect(typeof mod.getOriginAddress).toBe('function');
    expect(typeof mod.getFreeShippingThreshold).toBe('function');
  });

  it('getOriginAddress throws clearly when sharedTokens fields are missing', async () => {
    // Calling the getter when the mock is empty is still expected to
    // throw — but it throws at CALL TIME from a specific operation, not
    // at module-init blocking unrelated tests.
    const mod = await import('../src/backend/ups-shipping.web.js');
    expect(() => mod.getOriginAddress()).toThrow();
  });
});
