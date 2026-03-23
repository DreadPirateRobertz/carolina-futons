/**
 * @file shippingOverrides.test.js
 * @description Unit tests for shippingOverrides.web.js — CMS-driven override rules.
 *
 * Covers:
 *  - applyOverrides: all four rule types + actions (freeShipping, discountShipping, freeWhiteGlove)
 *  - getMatchingActions: forceLTL routing hint
 *  - Rule priority and merging (multiple matching rules)
 *  - Inactive rules are ignored
 *  - CMS miss / query error → fail-open (returns options unchanged)
 *  - detectCategory in shipping-rates-plugin.js: CMS hit, CMS miss fallback, CMS error fallback
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  __reset as resetWixData,
  __seed,
  __setQueryError,
} from './__mocks__/wix-data.js';
import {
  applyOverrides,
  getMatchingActions,
  _invalidateCache,
} from '../src/backend/shippingOverrides.web.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeOptions(overrides = []) {
  return [
    { code: 'ups-ground',     cost: 49, price: '49.00', currency: 'USD' },
    { code: 'ups-express',    cost: 89, price: '89.00', currency: 'USD' },
    { code: 'white-glove-z1', cost: 79, price: '79.00', currency: 'USD' },
    ...overrides,
  ];
}

function makeContext(overrides = {}) {
  return {
    zip: '28701',
    products: [{ productId: 'prod-abc' }],
    orderSubtotal: 500,
    memberId: null,
    ...overrides,
  };
}

function makeRule(overrides = {}) {
  return {
    ruleId: 'rule-1',
    ruleType: 'global',
    condition: {},
    action: { freeShipping: true },
    priority: 10,
    active: true,
    ...overrides,
  };
}

beforeEach(() => {
  resetWixData();
  _invalidateCache();
});

// ── global rule ───────────────────────────────────────────────────────────────

describe('applyOverrides — global rule', () => {
  it('freeShipping:true zeros cost on all options', async () => {
    __seed('ShippingOverrides', [makeRule({ ruleType: 'global', action: { freeShipping: true } })]);
    const result = await applyOverrides(makeOptions(), makeContext());
    expect(result.every(o => o.cost === 0)).toBe(true);
    expect(result.every(o => o.price === '0.00')).toBe(true);
  });

  it('does not mutate original options array', async () => {
    __seed('ShippingOverrides', [makeRule({ action: { freeShipping: true } })]);
    const original = makeOptions();
    const originalCost = original[0].cost;
    await applyOverrides(original, makeContext());
    expect(original[0].cost).toBe(originalCost);
  });
});

// ── product_override rule ─────────────────────────────────────────────────────

describe('applyOverrides — product_override rule', () => {
  it('applies freeShipping when context contains matching productId', async () => {
    __seed('ShippingOverrides', [makeRule({
      ruleType: 'product_override',
      condition: { productId: 'prod-abc' },
      action: { freeShipping: true },
    })]);
    const result = await applyOverrides(makeOptions(), makeContext({ products: [{ productId: 'prod-abc' }] }));
    expect(result[0].cost).toBe(0);
  });

  it('does not apply when no product in context matches', async () => {
    __seed('ShippingOverrides', [makeRule({
      ruleType: 'product_override',
      condition: { productId: 'prod-xyz' },
      action: { freeShipping: true },
    })]);
    const result = await applyOverrides(makeOptions(), makeContext({ products: [{ productId: 'prod-abc' }] }));
    expect(result[0].cost).toBe(49);
  });

  it('matches any product in a multi-item order', async () => {
    __seed('ShippingOverrides', [makeRule({
      ruleType: 'product_override',
      condition: { productId: 'prod-xyz' },
      action: { freeShipping: true },
    })]);
    const context = makeContext({ products: [{ productId: 'prod-abc' }, { productId: 'prod-xyz' }] });
    const result = await applyOverrides(makeOptions(), context);
    expect(result[0].cost).toBe(0);
  });
});

// ── zip_override rule ─────────────────────────────────────────────────────────

describe('applyOverrides — zip_override rule', () => {
  it('applies when zip starts with matching prefix', async () => {
    __seed('ShippingOverrides', [makeRule({
      ruleType: 'zip_override',
      condition: { zipPrefix: '287' },
      action: { freeShipping: true },
    })]);
    const result = await applyOverrides(makeOptions(), makeContext({ zip: '28701' }));
    expect(result[0].cost).toBe(0);
  });

  it('does not apply when zip does not match prefix', async () => {
    __seed('ShippingOverrides', [makeRule({
      ruleType: 'zip_override',
      condition: { zipPrefix: '287' },
      action: { freeShipping: true },
    })]);
    const result = await applyOverrides(makeOptions(), makeContext({ zip: '10001' }));
    expect(result[0].cost).toBe(49);
  });

  it('freeWhiteGlove zeros only white-glove options', async () => {
    __seed('ShippingOverrides', [makeRule({
      ruleType: 'zip_override',
      condition: { zipPrefix: '287' },
      action: { freeWhiteGlove: true },
    })]);
    const result = await applyOverrides(makeOptions(), makeContext({ zip: '28701' }));
    const ground = result.find(o => o.code === 'ups-ground');
    const wg = result.find(o => o.code === 'white-glove-z1');
    expect(ground.cost).toBe(49);       // unchanged
    expect(wg.cost).toBe(0);            // zeroed
    expect(wg.price).toBe('0.00');
  });
});

// ── promo rule ────────────────────────────────────────────────────────────────

describe('applyOverrides — promo rule', () => {
  it('applies discountShipping when orderSubtotal >= minOrderValue', async () => {
    __seed('ShippingOverrides', [makeRule({
      ruleType: 'promo',
      condition: { minOrderValue: 2000 },
      action: { discountShipping: 0.5 },
    })]);
    const result = await applyOverrides(makeOptions(), makeContext({ orderSubtotal: 2500 }));
    expect(result[0].cost).toBe(24.5);   // 49 * 0.5
    expect(result[0].price).toBe('24.50');
  });

  it('does not apply when orderSubtotal < minOrderValue', async () => {
    __seed('ShippingOverrides', [makeRule({
      ruleType: 'promo',
      condition: { minOrderValue: 2000 },
      action: { discountShipping: 0.5 },
    })]);
    const result = await applyOverrides(makeOptions(), makeContext({ orderSubtotal: 1000 }));
    expect(result[0].cost).toBe(49);
  });

  it('applies at exactly minOrderValue boundary', async () => {
    __seed('ShippingOverrides', [makeRule({
      ruleType: 'promo',
      condition: { minOrderValue: 2000 },
      action: { discountShipping: 0.5 },
    })]);
    const result = await applyOverrides(makeOptions(), makeContext({ orderSubtotal: 2000 }));
    expect(result[0].cost).toBe(24.5);
  });

  it('clamps discount to prevent negative costs', async () => {
    __seed('ShippingOverrides', [makeRule({
      ruleType: 'promo',
      condition: { minOrderValue: 0 },
      action: { discountShipping: 1.5 }, // over 100% — clamped to 100%
    })]);
    const result = await applyOverrides(makeOptions(), makeContext());
    expect(result[0].cost).toBe(0);
    expect(result[0].price).toBe('0.00');
  });
});

// ── inactive rules ────────────────────────────────────────────────────────────

describe('applyOverrides — inactive rules', () => {
  it('ignores rules with active:false', async () => {
    __seed('ShippingOverrides', [makeRule({ active: false, action: { freeShipping: true } })]);
    const result = await applyOverrides(makeOptions(), makeContext());
    expect(result[0].cost).toBe(49);
  });
});

// ── multiple matching rules ───────────────────────────────────────────────────

describe('applyOverrides — multiple matching rules', () => {
  it('applies both freeWhiteGlove and discountShipping from different rules', async () => {
    __seed('ShippingOverrides', [
      makeRule({ ruleId: 'r1', priority: 5, ruleType: 'global', action: { discountShipping: 0.1 } }),
      makeRule({ ruleId: 'r2', priority: 10, ruleType: 'zip_override', condition: { zipPrefix: '287' }, action: { freeWhiteGlove: true } }),
    ]);
    const result = await applyOverrides(makeOptions(), makeContext({ zip: '28701' }));
    const ground = result.find(o => o.code === 'ups-ground');
    const wg = result.find(o => o.code === 'white-glove-z1');
    // freeShipping overrides discountShipping (merged actions: last rule wins on conflict)
    // Here both apply: ground gets 10% off, wg gets free
    expect(ground.cost).toBeCloseTo(44.1, 1);  // 49 * 0.9
    expect(wg.cost).toBe(0);
  });
});

// ── getMatchingActions — forceLTL routing hint ────────────────────────────────

describe('getMatchingActions — forceLTL routing hint', () => {
  it('returns forceLTL:true when a matching zip_override sets it', async () => {
    __seed('ShippingOverrides', [makeRule({
      ruleType: 'zip_override',
      condition: { zipPrefix: '287' },
      action: { forceLTL: true, freeWhiteGlove: true },
    })]);
    const actions = await getMatchingActions(makeContext({ zip: '28701' }));
    expect(actions.forceLTL).toBe(true);
    expect(actions.freeWhiteGlove).toBe(true);
  });

  it('returns empty object when no rules match', async () => {
    __seed('ShippingOverrides', [makeRule({
      ruleType: 'zip_override',
      condition: { zipPrefix: '999' },
      action: { forceLTL: true },
    })]);
    const actions = await getMatchingActions(makeContext({ zip: '28701' }));
    expect(actions.forceLTL).toBeUndefined();
  });
});

// ── CMS miss / fail-open ──────────────────────────────────────────────────────

describe('applyOverrides — CMS miss / fail-open', () => {
  it('returns options unchanged when ShippingOverrides collection is empty', async () => {
    __seed('ShippingOverrides', []);
    const options = makeOptions();
    const result = await applyOverrides(options, makeContext());
    expect(result[0].cost).toBe(49);
  });

  it('returns options unchanged when CMS query throws', async () => {
    __setQueryError('ShippingOverrides', new Error('Wix data outage'));
    const options = makeOptions();
    const result = await applyOverrides(options, makeContext());
    expect(result).toHaveLength(options.length);
    expect(result[0].cost).toBe(49);
  });
});

// ── getMatchingActions — CMS fail-open (direct) ───────────────────────────────

describe('getMatchingActions — CMS fail-open', () => {
  it('returns empty object when CMS query throws', async () => {
    __setQueryError('ShippingOverrides', new Error('timeout'));
    const actions = await getMatchingActions(makeContext());
    expect(actions).toEqual({});
  });
});

// ── global rule overrides ZIP rule action (matchAll precedence) ───────────────

describe('applyOverrides — global rule (higher priority) overrides ZIP rule action', () => {
  it('higher-priority global rule cancels ZIP freeShipping via last-write-wins', async () => {
    __seed('ShippingOverrides', [
      makeRule({ ruleId: 'r-zip', priority: 10, ruleType: 'zip_override',
        condition: { zipPrefix: '287' }, action: { freeShipping: true } }),
      makeRule({ ruleId: 'r-global', priority: 20, ruleType: 'global',
        action: { freeShipping: false, discountShipping: 0.1 } }),
    ]);
    const result = await applyOverrides(makeOptions(), makeContext({ zip: '28701' }));
    // ascending sort: zip(10) applied first, global(20) last → global's freeShipping:false wins
    expect(result[0].cost).toBeCloseTo(44.1, 1); // 49 * 0.9
    expect(result[0].price).toBe('44.10');
  });
});

// ── expired override (endDate in past) ────────────────────────────────────────

describe('applyOverrides — endDate expiry', () => {
  it('does not apply rule whose endDate is in the past', async () => {
    __seed('ShippingOverrides', [makeRule({ action: { freeShipping: true }, endDate: '2020-01-01' })]);
    const result = await applyOverrides(makeOptions(), makeContext());
    expect(result[0].cost).toBe(49);
  });

  it('applies rule whose endDate is in the future', async () => {
    __seed('ShippingOverrides', [makeRule({ action: { freeShipping: true }, endDate: '2099-01-01' })]);
    const result = await applyOverrides(makeOptions(), makeContext());
    expect(result[0].cost).toBe(0);
  });

  it('applies rule with no endDate set', async () => {
    __seed('ShippingOverrides', [makeRule({ action: { freeShipping: true } })]);
    const result = await applyOverrides(makeOptions(), makeContext());
    expect(result[0].cost).toBe(0);
  });
});

// ── zero cost — not filtered out ──────────────────────────────────────────────

describe('applyOverrides — zero cost (options not filtered out)', () => {
  it('discountShipping:1.0 sets all costs to zero and keeps all options in result', async () => {
    __seed('ShippingOverrides', [makeRule({ action: { discountShipping: 1.0 } })]);
    const options = makeOptions();
    const result = await applyOverrides(options, makeContext());
    expect(result).toHaveLength(options.length);
    expect(result[0].cost).toBe(0);
    expect(result[0].price).toBe('0.00');
  });

  it('discountShipping:0 leaves costs unchanged', async () => {
    __seed('ShippingOverrides', [makeRule({ action: { discountShipping: 0 } })]);
    const result = await applyOverrides(makeOptions(), makeContext());
    expect(result[0].cost).toBe(49);
  });

  it('freeShipping result keeps all options (none filtered)', async () => {
    __seed('ShippingOverrides', [makeRule({ action: { freeShipping: true } })]);
    const options = makeOptions();
    const result = await applyOverrides(options, makeContext());
    expect(result).toHaveLength(options.length);
  });
});

// ── multiple overrides same key — last write wins ─────────────────────────────

describe('applyOverrides — multiple rules, same action key (last write wins)', () => {
  it('higher-priority rule value overwrites lower-priority for same discountShipping key', async () => {
    __seed('ShippingOverrides', [
      makeRule({ ruleId: 'r1', priority: 5,  ruleType: 'global', action: { discountShipping: 0.1 } }),
      makeRule({ ruleId: 'r2', priority: 20, ruleType: 'global', action: { discountShipping: 0.5 } }),
    ]);
    const result = await applyOverrides(makeOptions(), makeContext());
    // ascending: r1(5) applied first, r2(20) last → r2's 0.5 overwrites r1's 0.1
    expect(result[0].cost).toBeCloseTo(24.5, 1); // 49 * 0.5
  });
});

// ── productIds (array) filter ─────────────────────────────────────────────────

describe('applyOverrides — product_override with productIds array', () => {
  it('applies when a cart product is in the productIds array', async () => {
    __seed('ShippingOverrides', [makeRule({
      ruleType: 'product_override',
      condition: { productIds: ['prod-abc', 'prod-xyz'] },
      action: { freeShipping: true },
    })]);
    const result = await applyOverrides(makeOptions(), makeContext({ products: [{ productId: 'prod-abc' }] }));
    expect(result[0].cost).toBe(0);
  });

  it('does not apply when no cart product is in the productIds array', async () => {
    __seed('ShippingOverrides', [makeRule({
      ruleType: 'product_override',
      condition: { productIds: ['prod-xyz', 'prod-zzz'] },
      action: { freeShipping: true },
    })]);
    const result = await applyOverrides(makeOptions(), makeContext({ products: [{ productId: 'prod-abc' }] }));
    expect(result[0].cost).toBe(49);
  });
});

// ── 5-minute cache ────────────────────────────────────────────────────────────

describe('applyOverrides — caching', () => {
  it('does not re-query CMS on the second call within TTL', async () => {
    // First call: seed free-shipping rule, result should apply it (cost 0)
    __seed('ShippingOverrides', [makeRule({ action: { freeShipping: true } })]);
    const first = await applyOverrides(makeOptions(), makeContext());
    expect(first[0].cost).toBe(0); // free shipping applied

    // Poison the CMS — if the second call hits it, it will throw
    resetWixData();
    __setQueryError('ShippingOverrides', new Error('second CMS query must not happen'));

    // Second call within TTL: must use cached rules, not re-query CMS
    const second = await applyOverrides(makeOptions(), makeContext());
    expect(second[0].cost).toBe(0); // still free shipping from cache, not fail-open (49)
  });
});
