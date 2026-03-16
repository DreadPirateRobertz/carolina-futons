import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
}));

vi.mock('public/sharedTokens.js', () => ({
  internationalShippingConfig: {
    zones: {
      canada: { countries: ['CA'], name: 'Canada', baseRate: 79.99, perPoundRate: 1.25, estimatedDays: '7-14' },
      europe: { countries: ['GB', 'DE', 'FR'], name: 'Europe', baseRate: 149.99, perPoundRate: 2.50, estimatedDays: '14-21' },
      asia_pacific: { countries: ['JP', 'AU'], name: 'Asia Pacific', baseRate: 199.99, perPoundRate: 3.25, estimatedDays: '14-28' },
      other: { countries: [], name: 'International', baseRate: 249.99, perPoundRate: 4.00, estimatedDays: '21-35' },
    },
    restrictedCountries: ['CU', 'IR', 'KP', 'SY', 'SD'],
    freeInternationalThreshold: 2999,
  },
  business: {},
}));

let mod;
beforeEach(async () => {
  vi.resetModules();
  mod = await import('../src/backend/internationalShipping.web.js');
});

// ── getShippingZone ──────────────────────────────────────────────

describe('getShippingZone', () => {
  it('rejects invalid country code', async () => {
    const r = await mod.getShippingZone('123');
    expect(r.success).toBe(false);
  });

  it('rejects US as domestic', async () => {
    const r = await mod.getShippingZone('US');
    expect(r.success).toBe(false);
    expect(r.error).toContain('domestic');
  });

  it('rejects restricted country', async () => {
    const r = await mod.getShippingZone('CU');
    expect(r.success).toBe(false);
    expect(r.error).toContain('restricted');
  });

  it('returns Canada zone', async () => {
    const r = await mod.getShippingZone('CA');
    expect(r.success).toBe(true);
    expect(r.zone).toBe('canada');
    expect(r.zoneName).toBe('Canada');
  });

  it('returns Europe zone', async () => {
    const r = await mod.getShippingZone('GB');
    expect(r.success).toBe(true);
    expect(r.zone).toBe('europe');
  });

  it('falls back to other zone for unknown country', async () => {
    const r = await mod.getShippingZone('BR');
    expect(r.success).toBe(true);
    expect(r.zone).toBe('other');
  });
});

// ── isShippableCountry ───────────────────────────────────────────

describe('isShippableCountry', () => {
  it('returns true for shippable country', async () => {
    const r = await mod.isShippableCountry('CA');
    expect(r.success).toBe(true);
    expect(r.shippable).toBe(true);
  });

  it('returns false for restricted country', async () => {
    const r = await mod.isShippableCountry('KP');
    expect(r.shippable).toBe(false);
  });
});

// ── getInternationalShippingEstimate ─────────────────────────────

describe('getInternationalShippingEstimate', () => {
  it('rejects US', async () => {
    const r = await mod.getInternationalShippingEstimate('US', 50, 500);
    expect(r.success).toBe(false);
  });

  it('calculates Canada rate', async () => {
    const r = await mod.getInternationalShippingEstimate('CA', 50, 500);
    expect(r.success).toBe(true);
    expect(r.estimate.baseRate).toBe(79.99);
    expect(r.estimate.weightCharge).toBe(62.5); // 50 * 1.25
    expect(r.estimate.totalRate).toBe(142.49); // 79.99 + 62.5
    expect(r.estimate.freeShipping).toBe(false);
  });

  it('gives free shipping above threshold', async () => {
    const r = await mod.getInternationalShippingEstimate('CA', 50, 3000);
    expect(r.estimate.freeShipping).toBe(true);
    expect(r.estimate.totalRate).toBe(0);
  });

  it('rejects restricted country', async () => {
    const r = await mod.getInternationalShippingEstimate('IR', 10, 100);
    expect(r.success).toBe(false);
  });
});

// ── getInternationalShippingRates ────────────────────────────────

describe('getInternationalShippingRates', () => {
  it('rejects invalid destination', async () => {
    const r = await mod.getInternationalShippingRates({ country: '' }, [], 100);
    expect(r.success).toBe(false);
  });

  it('returns standard and express rates', async () => {
    const r = await mod.getInternationalShippingRates(
      { country: 'GB' }, [{ weight: 30 }], 500,
    );
    expect(r.success).toBe(true);
    expect(r.rates).toHaveLength(2);
    expect(r.rates[0].code).toContain('standard');
    expect(r.rates[1].code).toContain('express');
    expect(r.rates[1].cost).toBeGreaterThan(r.rates[0].cost);
  });

  it('sets free shipping for high-value orders', async () => {
    const r = await mod.getInternationalShippingRates(
      { country: 'CA' }, [{ weight: 20 }], 3500,
    );
    expect(r.rates[0].cost).toBe(0);
    expect(r.rates[0].title).toContain('Free');
  });
});
