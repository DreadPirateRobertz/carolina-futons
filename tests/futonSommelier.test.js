/**
 * @file futonSommelier.test.js
 * @description CF-ofc0: Tests for Futon Sommelier AI decision engine.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __getInserted } from './__mocks__/wix-data.js';

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
});
