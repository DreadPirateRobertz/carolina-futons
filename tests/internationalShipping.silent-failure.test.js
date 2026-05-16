// cf-44qt (cf-r6q7.fu1): silent-failure cleanup on
// getInternationalShippingRates. Pre-cf-44qt the catch block returned
// { success: true, rates: [$199.99 fabrication], estimated: true } on
// ANY throw — including the missing-config throw that cf-r6q7 made
// reachable at runtime. Result: checkout silently charged the
// customer $199.99 for an international ship rate that never came from
// the real zone config.
//
// This test pins the new shape: catch returns
// { success: false, error, code: 'INTERNATIONAL_RATE_ERROR' } and the
// /checkout caller is responsible for graceful fallback.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// sharedTokens mock with zones=null forces the for-loop's
// Object.entries(null) to throw, triggering the catch block on
// demand (config-shape robustness test).
vi.mock('public/sharedTokens.js', () => ({
  internationalShippingConfig: {
    zones: null,
    restrictedCountries: [],
    freeInternationalThreshold: 100000,
  },
  business: {},
}));

// logError spy — verify the catch wires Sentry-style telemetry
// instead of bare console.error. Mocked at the errorHandler boundary
// so the real impl's @sentry/nextjs import doesn't need to load.
const logError = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({
  logError: (...args) => logError(...args),
}));

beforeEach(() => {
  logError.mockReset();
});

describe('getInternationalShippingRates — catch-block silent failure (cf-44qt)', () => {
  it('returns { success: false, error, code } on internal throw (NOT the $199.99 fabrication)', async () => {
    const { getInternationalShippingRates } = await import(
      '../src/backend/internationalShipping.web.js'
    );
    const result = await getInternationalShippingRates(
      { country: 'CA', postalCode: 'M5V 2T6' },
      [{ weight: 50 }],
      299.99,
    );
    // Pre-cf-44qt: success=true with $199.99 fabrication
    // Post-cf-44qt: success=false with explicit error code
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.code).toBe('INTERNATIONAL_RATE_ERROR');
    // Defense: absence of any fabricated rate array
    expect(result.rates).toBeUndefined();
  });

  it('wires logError on the throw path (Sentry telemetry, not console.error)', async () => {
    const { getInternationalShippingRates } = await import(
      '../src/backend/internationalShipping.web.js'
    );
    await getInternationalShippingRates(
      { country: 'CA', postalCode: 'M5V 2T6' },
      [{ weight: 50 }],
      299.99,
    );
    expect(logError).toHaveBeenCalledTimes(1);
    // First arg = context tag; second arg = the Error instance.
    const [context, err] = logError.mock.calls[0];
    expect(context).toMatch(/getInternationalShippingRates/);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('getShippingZone / isShippableCountry / getInternationalShippingEstimate — logError wiring (cf-44qt)', () => {
  // The other 3 catch blocks should ALSO route through logError. zones=null
  // triggers them via the same Object.entries / .includes paths.
  it('getShippingZone routes throw through logError', async () => {
    const { getShippingZone } = await import(
      '../src/backend/internationalShipping.web.js'
    );
    await getShippingZone('CA');
    // CA is the canada zone normally; with zones=null Object.entries
    // throws in the for-of loop.
    expect(logError).toHaveBeenCalled();
    const [context] = logError.mock.calls[0];
    expect(context).toMatch(/getShippingZone/);
  });

  it('getInternationalShippingEstimate routes throw through logError', async () => {
    const { getInternationalShippingEstimate } = await import(
      '../src/backend/internationalShipping.web.js'
    );
    await getInternationalShippingEstimate('CA', 50, 299.99);
    expect(logError).toHaveBeenCalled();
    const [context] = logError.mock.calls[0];
    expect(context).toMatch(/getInternationalShippingEstimate/);
  });
});
