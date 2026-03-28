/**
 * @file futonSommelier.test.js
 * @description CF-ofc0: Tests for Futon Sommelier AI decision engine.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __getInserted, __onInsert, __onUpdate } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';

beforeEach(() => {
  __reset();
  vi.clearAllMocks();
});

// ── LIFESTYLE_FACTORS ───────────────────────────────────────────────

describe('LIFESTYLE_FACTORS', () => {
  let LIFESTYLE_FACTORS;

  beforeEach(async () => {
    ({ LIFESTYLE_FACTORS } = await import('../src/backend/futonSommelier.web.js'));
  });

  it('defines 8 lifestyle factors', () => {
    expect(Object.keys(LIFESTYLE_FACTORS)).toHaveLength(8);
  });

  it('each factor has question and options', () => {
    for (const factor of Object.values(LIFESTYLE_FACTORS)) {
      expect(factor.question).toBeTruthy();
      expect(factor.options.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ── _matchesBudget ──────────────────────────────────────────────────

describe('_matchesBudget', () => {
  let _matchesBudget;

  beforeEach(async () => {
    ({ _matchesBudget } = await import('../src/backend/futonSommelier.web.js'));
  });

  it('returns positive for price within budget', () => {
    expect(_matchesBudget(400, 'under_500')).toBe(15);
    expect(_matchesBudget(750, '500_to_1000')).toBe(15);
  });

  it('returns positive for under-budget', () => {
    expect(_matchesBudget(300, '500_to_1000')).toBe(5);
  });

  it('returns negative for over-budget', () => {
    expect(_matchesBudget(2000, 'under_500')).toBe(-15);
  });

  it('returns positive for flexible budget', () => {
    expect(_matchesBudget(5000, 'flexible')).toBe(15);
  });
});

// ── _matchesTrait ───────────────────────────────────────────────────

describe('_matchesTrait', () => {
  let _matchesTrait;

  beforeEach(async () => {
    ({ _matchesTrait } = await import('../src/backend/futonSommelier.web.js'));
  });

  it('matches durability from description', () => {
    const product = { description: 'Built with solid hardwood for lasting durability' };
    expect(_matchesTrait(product, product.description.toLowerCase(), '', 'durability')).toBe(true);
  });

  it('matches firmness from description', () => {
    const product = { description: 'High-density foam for firm support' };
    expect(_matchesTrait(product, product.description.toLowerCase(), '', 'firmness_high')).toBe(true);
  });

  it('matches compact from category', () => {
    const product = { description: '', category: 'murphy-cabinet-beds' };
    expect(_matchesTrait(product, '', '', 'compact')).toBe(true);
  });

  it('returns false for unmatched trait', () => {
    const product = { description: 'A simple wooden frame' };
    expect(_matchesTrait(product, product.description.toLowerCase(), '', 'uv_resistant')).toBe(false);
  });

  it('matches queen_size from variants', () => {
    const product = { description: '', variants: [{ label: 'Queen / Cherry' }] };
    expect(_matchesTrait(product, '', '', 'queen_size')).toBe(true);
  });
});

// ── _scoreProducts ──────────────────────────────────────────────────

describe('_scoreProducts', () => {
  let _scoreProducts;

  beforeEach(async () => {
    ({ _scoreProducts } = await import('../src/backend/futonSommelier.web.js'));
  });

  const products = [
    {
      _id: 'p1', name: 'Hardwood Frame', slug: 'hardwood',
      description: 'Solid hardwood construction, durable and built to last',
      category: 'futon-frames', price: 600, variants: [],
    },
    {
      _id: 'p2', name: 'Budget Lounger', slug: 'budget',
      description: 'Affordable compact frame, great for dorm rooms',
      category: 'futon-frames', price: 299, variants: [],
    },
    {
      _id: 'p3', name: 'Premium Mattress', slug: 'premium-mattress',
      description: 'Thick high-density foam mattress with medium firm feel, queen size available',
      category: 'mattresses', price: 450, variants: [{ label: 'Queen' }],
    },
  ];

  it('boosts durable products for pet owners', () => {
    const scored = _scoreProducts(products, { pets: 'dog_large' });
    const hardwood = scored.find(p => p._id === 'p1');
    expect(hardwood.score).toBeGreaterThan(50); // Base + durability + hardwood bonuses
    expect(hardwood.matchReasons.length).toBeGreaterThan(0);
  });

  it('boosts firm mattresses for back issues', () => {
    const scored = _scoreProducts(products, { backIssues: 'chronic_back' });
    const mattress = scored.find(p => p._id === 'p3');
    expect(mattress.score).toBeGreaterThan(50);
    expect(mattress.matchReasons).toEqual(expect.arrayContaining([
      expect.stringMatching(/firm|thick/i),
    ]));
  });

  it('boosts budget products for dorm use', () => {
    const scored = _scoreProducts(products, { primaryUse: 'dorm' });
    const budget = scored.find(p => p._id === 'p2');
    expect(budget.score).toBeGreaterThan(50);
  });

  it('applies budget scoring', () => {
    const scored = _scoreProducts(products, { budget: 'under_500' });
    const budget = scored.find(p => p._id === 'p2');
    const expensive = scored.find(p => p._id === 'p1');
    expect(budget.score).toBeGreaterThan(expensive.score);
  });

  it('boosts compact products for small rooms', () => {
    const scored = _scoreProducts(products, { roomSize: 'small_under_120sqft' });
    const compact = scored.find(p => p._id === 'p2');
    expect(compact.matchReasons).toEqual(expect.arrayContaining([
      expect.stringMatching(/compact|space/i),
    ]));
  });
});

// ── _generateReasoning ──────────────────────────────────────────────

describe('_generateReasoning', () => {
  let _generateReasoning;

  beforeEach(async () => {
    ({ _generateReasoning } = await import('../src/backend/futonSommelier.web.js'));
  });

  it('generates reasoning with primary use', () => {
    const reasoning = _generateReasoning(
      { primaryUse: 'daily_sleeping' },
      [{ name: 'Test Frame', matchReasons: ['Firm support'] }],
    );
    expect(reasoning).toContain('daily sleeping');
    expect(reasoning).toContain('Test Frame');
  });

  it('includes pet and back concerns in reasoning', () => {
    const reasoning = _generateReasoning(
      { primaryUse: 'lounging', pets: 'dog_large', backIssues: 'chronic_back' },
      [{ name: 'Tough Frame', matchReasons: ['Durable'] }],
    );
    expect(reasoning).toContain('pet-friendly');
    expect(reasoning).toContain('back support');
  });

  it('handles empty recommendations', () => {
    const reasoning = _generateReasoning({ primaryUse: 'dorm' }, []);
    expect(reasoning).toContain('dorm');
  });
});

// ── getRecommendation ───────────────────────────────────────────────

describe('getRecommendation', () => {
  let getRecommendation;

  beforeEach(async () => {
    ({ getRecommendation } = await import('../src/backend/futonSommelier.web.js'));
  });

  it('rejects missing answers', async () => {
    const result = await getRecommendation(null);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/required/i);
  });

  it('rejects fewer than 3 answers', async () => {
    const result = await getRecommendation({ primaryUse: 'dorm', pets: 'no_pets' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/at least 3/i);
  });

  it('rejects invalid answer values', async () => {
    const result = await getRecommendation({
      primaryUse: 'INVALID',
      pets: 'INVALID',
      backIssues: 'INVALID',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/at least 3/i);
  });

  it('returns recommendations for valid answers', async () => {
    __seed('Stores/Products', [
      {
        _id: 'p1', name: 'Monterey Frame', slug: 'monterey',
        description: 'Solid hardwood, durable, queen available',
        category: 'futon-frames', price: 549, visible: true,
        variants: [{ label: 'Queen' }],
      },
      {
        _id: 'p2', name: 'Budget Frame', slug: 'budget',
        description: 'Compact affordable frame for small spaces',
        category: 'futon-frames', price: 299, visible: true,
        variants: [],
      },
    ]);

    const result = await getRecommendation({
      primaryUse: 'daily_sleeping',
      pets: 'dog_large',
      backIssues: 'none',
      budget: '500_to_1000',
    });

    expect(result.success).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.reasoning).toBeTruthy();
    expect(result.sessionKey).toBeTruthy();
    expect(result.cached).toBe(false);
  });

  it('returns cached results for same session key', async () => {
    __seed('SommelierSessions', [{
      sessionKey: 'cached-session',
      recommendations: JSON.stringify([{ name: 'Cached Product', score: 80 }]),
      reasoning: 'Cached reasoning',
    }]);

    const result = await getRecommendation(
      { primaryUse: 'dorm', pets: 'no_pets', budget: 'under_500' },
      'cached-session',
    );

    expect(result.success).toBe(true);
    expect(result.cached).toBe(true);
    expect(result.recommendations[0].name).toBe('Cached Product');
  });

  it('rate-limits per session', async () => {
    __seed('SommelierRateLimit', [{
      _id: 'rl-1',
      key: 'flood-session',
      count: 5,
      windowStart: new Date(),
    }]);

    const result = await getRecommendation(
      { primaryUse: 'dorm', pets: 'no_pets', budget: 'under_500' },
      'flood-session',
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });
});

// ── getLifestyleQuestions ────────────────────────────────────────────

describe('getLifestyleQuestions', () => {
  let getLifestyleQuestions;

  beforeEach(async () => {
    ({ getLifestyleQuestions } = await import('../src/backend/futonSommelier.web.js'));
  });

  it('returns all questions with ids and options', () => {
    const result = getLifestyleQuestions();
    expect(result.questions).toHaveLength(8);
    for (const q of result.questions) {
      expect(q.id).toBeTruthy();
      expect(q.question).toBeTruthy();
      expect(q.options.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ── rateRecommendation ──────────────────────────────────────────────

describe('rateRecommendation', () => {
  let rateRecommendation;

  beforeEach(async () => {
    ({ rateRecommendation } = await import('../src/backend/futonSommelier.web.js'));
  });

  it('saves feedback rating', async () => {
    __seed('SommelierSessions', [{
      _id: 'sess-1',
      sessionKey: 'rated-session',
      feedbackRating: 0,
    }]);

    const result = await rateRecommendation('rated-session', 5);
    expect(result.success).toBe(true);
  });

  it('rejects invalid rating', async () => {
    const result = await rateRecommendation('sess-1', 6);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/between 1 and 5/i);
  });

  it('rejects missing session key', async () => {
    const result = await rateRecommendation(null, 4);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Session key');
  });

  it('rejects non-number rating', async () => {
    const result = await rateRecommendation('sess-1', 'five');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/between 1 and 5/i);
  });

  it('returns error when session not found', async () => {
    // No SommelierSessions seed — query returns empty
    const result = await rateRecommendation('nonexistent-session', 4);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ── getRecommendation — additional branch coverage ────────────────────

describe('getRecommendation — additional branches', () => {
  let getRecommendation;

  beforeEach(async () => {
    ({ getRecommendation } = await import('../src/backend/futonSommelier.web.js'));
  });

  it('returns error when product catalog is empty', async () => {
    __seed('Stores/Products', []); // no products
    const result = await getRecommendation({
      primaryUse: 'daily_sleeping',
      pets: 'no_pets',
      backIssues: 'none',
      budget: '500_to_1000',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('unavailable');
  });

  it('falls through cache miss and computes fresh recommendations', async () => {
    // sessionKey provided but SommelierSessions is empty (cache miss)
    __seed('Stores/Products', [{
      _id: 'p1', name: 'Budget Compact Frame', slug: 'compact',
      description: 'compact affordable frame', category: 'futon-frames',
      price: 299, visible: true, variants: [],
    }]);
    const result = await getRecommendation(
      { primaryUse: 'dorm', pets: 'no_pets', backIssues: 'none', budget: 'under_500' },
      'cache-miss-session',
    );
    expect(result.success).toBe(true);
    expect(result.cached).toBe(false);
  });
});

// ── _matchesBudget — additional branch coverage ───────────────────────

describe('_matchesBudget — additional branches', () => {
  let _matchesBudget;

  beforeEach(async () => {
    ({ _matchesBudget } = await import('../src/backend/futonSommelier.web.js'));
  });

  it('returns -5 when price is slightly over budget (within 120%)', async () => {
    // price=550 on budget under_500 (max=500): 550 <= 600 → -5
    expect(_matchesBudget(550, 'under_500')).toBe(-5);
  });
});

// ── _generateReasoning — additional branch coverage ────────────────────

describe('_generateReasoning — additional branches', () => {
  let _generateReasoning;

  beforeEach(async () => {
    ({ _generateReasoning } = await import('../src/backend/futonSommelier.web.js'));
  });

  it('handles answers with no primaryUse', async () => {
    const result = _generateReasoning({ pets: 'no_pets', backIssues: 'none' }, []);
    expect(typeof result).toBe('string');
  });

  it('includes sun-resistant when sunExposure is not minimal', async () => {
    const result = _generateReasoning(
      { primaryUse: 'lounging', pets: 'no_pets', backIssues: 'none', sunExposure: 'high' },
      [],
    );
    expect(result).toContain('sun');
  });

  it('skips pet mention when pets is no_pets', async () => {
    const result = _generateReasoning(
      { primaryUse: 'lounging', pets: 'no_pets', backIssues: 'none' },
      [],
    );
    expect(result).not.toContain('pet');
  });
});

// ── recordSommelierResult (CF-a220) ─────────────────────────────────

describe('recordSommelierResult', () => {
  let recordSommelierResult, getSommelierResults, _RESULTS_COLLECTION;

  beforeEach(async () => {
    __reset();
    __setMember({ _id: 'member-1', contactDetails: { firstName: 'Sarah' } });
    ({ recordSommelierResult, getSommelierResults, _RESULTS_COLLECTION } =
      await import('../src/backend/futonSommelier.web.js'));
  });

  it('inserts a new result for a member', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'SommelierResults') inserted = item; });

    const result = await recordSommelierResult('member-1', {
      topCategory: 'modern',
      flavors: ['minimalist', 'warm'],
      recommendations: [
        { productId: 'prod-1', productName: 'Kodiak Frame', score: 0.95 },
      ],
    });

    expect(result.success).toBe(true);
    expect(inserted).not.toBeNull();
    expect(inserted.topCategory).toBe('modern');
    expect(JSON.parse(inserted.flavors)).toEqual(['minimalist', 'warm']);
    expect(JSON.parse(inserted.recommendations)).toHaveLength(1);
  });

  it('upserts — updates existing result instead of duplicating', async () => {
    __seed('SommelierResults', [{
      _id: 'existing-1', memberId: 'member-1',
      topCategory: 'rustic', flavors: '["farmhouse"]',
      recommendations: '[]', updatedAt: new Date('2026-03-01'),
    }]);

    let updated = null;
    __onUpdate((col, item) => { if (col === 'SommelierResults') updated = item; });

    const result = await recordSommelierResult('member-1', {
      topCategory: 'modern',
      flavors: ['clean-line'],
      recommendations: [],
    });

    expect(result.success).toBe(true);
    expect(updated).not.toBeNull();
    expect(updated.topCategory).toBe('modern');
    expect(updated._id).toBe('existing-1');
  });

  it('rejects when memberId does not match session', async () => {
    const result = await recordSommelierResult('member-999', {
      topCategory: 'modern', flavors: [], recommendations: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/unauthorized/i);
  });

  it('rejects without memberId', async () => {
    const result = await recordSommelierResult(null, {
      topCategory: 'modern', flavors: [], recommendations: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('memberId');
  });

  it('rejects without topCategory', async () => {
    const result = await recordSommelierResult('member-1', {
      topCategory: '', flavors: [], recommendations: [],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('topCategory');
  });

  it('caps flavors at 10 and recommendations at 5', async () => {
    let inserted = null;
    __onInsert((col, item) => { if (col === 'SommelierResults') inserted = item; });

    const manyFlavors = Array.from({ length: 20 }, (_, i) => `flavor-${i}`);
    const manyRecs = Array.from({ length: 10 }, (_, i) => ({
      productId: `prod-${i}`, productName: `Product ${i}`, score: 0.5,
    }));

    await recordSommelierResult('member-1', {
      topCategory: 'eclectic',
      flavors: manyFlavors,
      recommendations: manyRecs,
    });

    expect(JSON.parse(inserted.flavors)).toHaveLength(10);
    expect(JSON.parse(inserted.recommendations)).toHaveLength(5);
  });
});

// ── getSommelierResults (CF-a220) ────────────────────────────────────

describe('getSommelierResults', () => {
  let getSommelierResults;

  beforeEach(async () => {
    __reset();
    __setMember({ _id: 'member-1', contactDetails: { firstName: 'Sarah' } });
    ({ getSommelierResults } = await import('../src/backend/futonSommelier.web.js'));
  });

  it('returns stored results for a member', async () => {
    __seed('SommelierResults', [{
      _id: 'res-1', memberId: 'member-1',
      topCategory: 'modern', flavors: '["minimalist"]',
      recommendations: '[{"productId":"p1","productName":"Frame","score":0.9}]',
      updatedAt: new Date(),
    }]);

    const result = await getSommelierResults('member-1');
    expect(result.success).toBe(true);
    expect(result.result.topCategory).toBe('modern');
    expect(result.result.flavors).toEqual(['minimalist']);
    expect(result.result.recommendations).toHaveLength(1);
  });

  it('returns null result for member with no quiz data', async () => {
    const result = await getSommelierResults('member-1');
    expect(result.success).toBe(true);
    expect(result.result).toBeNull();
  });

  it('rejects unauthorized read', async () => {
    const result = await getSommelierResults('member-999');
    expect(result.success).toBe(false);
  });
});
