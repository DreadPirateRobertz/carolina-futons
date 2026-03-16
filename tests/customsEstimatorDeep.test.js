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
  customsConfig: {
    defaultHSCode: '9403',
    dutyRates: {
      CA: { rate: 0, description: 'Duty-free under USMCA' },
      GB: { rate: 0.02, description: '~2% duty + 20% VAT' },
      AU: { rate: 0.05, description: '~5% duty + 10% GST' },
    },
    vatRates: { CA: 0.05, GB: 0.20, AU: 0.10, DE: 0.19 },
    deMinimisUSD: { CA: 20, GB: 135, AU: 1000 },
  },
  internationalShippingConfig: {
    restrictedCountries: ['CU', 'IR', 'KP', 'SY', 'SD'],
  },
}));

let mod;
beforeEach(async () => {
  vi.resetModules();
  mod = await import('../src/backend/customsEstimator.web.js');
});

// ── getVATRate ───────────────────────────────────────────────────

describe('getVATRate', () => {
  it('rejects invalid code', async () => {
    const r = await mod.getVATRate('123');
    expect(r.success).toBe(false);
  });

  it('returns VAT rate for known country', async () => {
    const r = await mod.getVATRate('GB');
    expect(r.success).toBe(true);
    expect(r.rate).toBe(0.20);
  });

  it('returns 0 for unknown country', async () => {
    const r = await mod.getVATRate('BR');
    expect(r.success).toBe(true);
    expect(r.rate).toBe(0);
  });
});

// ── getDutyRate ──────────────────────────────────────────────────

describe('getDutyRate', () => {
  it('returns 0 for Canada (USMCA)', async () => {
    const r = await mod.getDutyRate('CA');
    expect(r.rate).toBe(0);
    expect(r.description).toContain('USMCA');
  });

  it('returns default for unknown country', async () => {
    const r = await mod.getDutyRate('BR');
    expect(r.rate).toBe(0.05);
  });
});

// ── estimateCustomsDuties ────────────────────────────────────────

describe('estimateCustomsDuties', () => {
  it('rejects US', async () => {
    const r = await mod.estimateCustomsDuties('US', 1000, 50);
    expect(r.success).toBe(false);
  });

  it('returns zero for zero value', async () => {
    const r = await mod.estimateCustomsDuties('GB', 0, 50);
    expect(r.success).toBe(true);
    expect(r.estimate.totalDutiesAndTaxes).toBe(0);
    expect(r.estimate.deMinimisApplied).toBe(true);
  });

  it('calculates duties for GB', async () => {
    const r = await mod.estimateCustomsDuties('GB', 1000, 50);
    expect(r.success).toBe(true);
    // Duty: 1000 * 0.02 = 20
    // VAT: (1000 + 20) * 0.20 = 204
    expect(r.estimate.dutyAmount).toBe(20);
    expect(r.estimate.vatAmount).toBe(204);
    expect(r.estimate.totalDutiesAndTaxes).toBe(224);
  });

  it('applies de minimis for small orders to GB', async () => {
    const r = await mod.estimateCustomsDuties('GB', 100, 10);
    // GB de minimis is 135, so 100 < 135 => duty waived
    expect(r.estimate.deMinimisApplied).toBe(true);
    expect(r.estimate.dutyAmount).toBe(0);
    // VAT still applies: 100 * 0.20 = 20
    expect(r.estimate.vatAmount).toBe(20);
  });

  it('includes HS code and disclaimer', async () => {
    const r = await mod.estimateCustomsDuties('AU', 500, 30);
    expect(r.estimate.hsCode).toBe('9403');
    expect(r.estimate.disclaimer).toContain('Estimates only');
  });
});

// ── calculateLandedCost ──────────────────────────────────────────

describe('calculateLandedCost', () => {
  it('rejects US', async () => {
    const r = await mod.calculateLandedCost('US', 500, 50, 30);
    expect(r.success).toBe(false);
  });

  it('calculates total landed cost', async () => {
    // GB: product=1000, shipping=100, duty=1000*0.02=20, VAT=(1000+100+20)*0.20=224
    const r = await mod.calculateLandedCost('GB', 1000, 100, 50);
    expect(r.success).toBe(true);
    expect(r.landedCost.productCost).toBe(1000);
    expect(r.landedCost.shippingCost).toBe(100);
    expect(r.landedCost.dutyAmount).toBe(20);
    expect(r.landedCost.vatAmount).toBe(224);
    expect(r.landedCost.totalLandedCost).toBe(1344);
  });

  it('applies de minimis for small product cost', async () => {
    // AU de minimis = 1000, product = 500 < 1000 => no duty
    const r = await mod.calculateLandedCost('AU', 500, 80, 20);
    expect(r.landedCost.dutyAmount).toBe(0);
    // VAT: (500+80+0)*0.10 = 58
    expect(r.landedCost.vatAmount).toBe(58);
    expect(r.landedCost.totalLandedCost).toBe(638);
  });
});
