/**
 * cf-t8k1.fu1 — Pins the lazy-init contract for ups-shipping.web.js
 * module-init reads.
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
 * Three contracts pinned below:
 *  1. Module imports cleanly with EMPTY public/sharedTokens mock
 *  2. Getter returns the right shape when sharedTokens IS mocked
 *  3. Getter is memoized — second call doesn't re-deref sharedTokens
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Deliberately empty mock — pre-fix this would throw on import below.
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

describe('cf-t8k1.fu1 — ups-shipping lazy-init contract', () => {
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

describe('cf-t8k1.fu1 — ups-shipping lazy-init with proper mock', () => {
  beforeEach(() => {
    vi.resetModules();
    // vi.doMock here (not top-level vi.mock) is required because the lazy-init
    // contract test in the prior describe block needs the EMPTY mock active
    // during its module-import, and this describe block needs a populated mock
    // after vi.resetModules(). Standard vi.mock() can't be swapped at runtime.
    vi.doMock('public/sharedTokens', () => ({ // vi-domock-legacy
      brand: { name: 'Test Co' },
      business: {
        phoneDigits: '5550000000',
        address: { street: '1 Way', city: 'TestCity', state: 'TS', zip: '12345' },
      },
      shippingConfig: { freeThreshold: 750 },
    }));
    // Re-stub the other dependencies since vi.resetModules cleared them
    vi.doMock('wix-secrets-backend', () => ({ getSecret: vi.fn() })); // vi-domock-legacy
    vi.doMock('wix-fetch', () => ({ fetch: vi.fn() })); // vi-domock-legacy
    vi.doMock('backend/utils/sanitize', () => ({ sanitize: (s) => s })); // vi-domock-legacy
    vi.doMock('wix-web-module', () => ({ // vi-domock-legacy
      Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
      webMethod: (_perm, fn) => fn,
    }));
  });

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
