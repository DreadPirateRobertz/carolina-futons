import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', Admin: 'Admin', SiteMember: 'SiteMember' },
  webMethod: (_perm, fn) => fn,
}));

let mod;
beforeEach(async () => {
  vi.resetModules();
  mod = await import('../src/backend/financingService.web.js');
});

describe('calculateMonthlyPayment', () => {
  it('returns zero for invalid price', () => {
    const r = mod.calculateMonthlyPayment(0, 4);
    expect(r.monthly).toBe(0);
    expect(r.total).toBe(0);
  });

  it('calculates 0% APR simple division', () => {
    const r = mod.calculateMonthlyPayment(400, 4, 0);
    expect(r.monthly).toBe(100);
    expect(r.total).toBe(400);
    expect(r.interest).toBe(0);
  });

  it('calculates with APR (amortization)', () => {
    const r = mod.calculateMonthlyPayment(1000, 24, 9.99);
    expect(r.monthly).toBeGreaterThan(0);
    expect(r.interest).toBeGreaterThan(0);
    expect(r.total).toBeGreaterThan(1000);
    expect(r.apr).toBe(9.99);
  });

  it('handles NaN term gracefully', () => {
    const r = mod.calculateMonthlyPayment(100, NaN, 0);
    expect(r.term).toBe(1);
    expect(r.monthly).toBe(100);
  });
});

describe('getFinancingOptions', () => {
  it('returns empty for price below minimum', () => {
    const r = mod.getFinancingOptions(10);
    expect(r).toEqual([]);
  });

  it('returns Pay in 4 for $100', () => {
    const r = mod.getFinancingOptions(100);
    expect(r.length).toBeGreaterThanOrEqual(1);
    expect(r[0].term).toBe(4);
    expect(r[0].apr).toBe(0);
    expect(r[0].label).toBe('Pay in 4');
  });

  it('returns multiple plans for $1000', () => {
    const r = mod.getFinancingOptions(1000);
    expect(r.length).toBeGreaterThanOrEqual(4);
    const terms = r.map(p => p.term);
    expect(terms).toContain(4);
    expect(terms).toContain(12);
    expect(terms).toContain(36);
  });

  it('calculates monthly for each plan', () => {
    const r = mod.getFinancingOptions(600);
    for (const plan of r) {
      expect(plan.monthly).toBeGreaterThan(0);
      expect(plan.total).toBeGreaterThanOrEqual(600);
    }
  });
});

describe('getLowestMonthlyDisplay', () => {
  it('returns null for price below minimum', () => {
    const r = mod.getLowestMonthlyDisplay(10);
    expect(r).toBeNull();
  });

  it('returns "As low as" text for valid price', () => {
    const r = mod.getLowestMonthlyDisplay(600);
    expect(r).toMatch(/^As low as \$\d+\/mo$/);
  });

  it('uses longest 0% term for lowest monthly', () => {
    // $600 qualifies for 12-month 0% plan → $50/mo
    const r = mod.getLowestMonthlyDisplay(600);
    expect(r).toBe('As low as $50/mo');
  });
});
