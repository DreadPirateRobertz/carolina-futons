/**
 * sommelierService.test.js — CF-d9s
 * Branch coverage for the Sommelier recommendation engine:
 * validateParams, scoreProduct, getRecommendations, savePreferences, getMyPreferences.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __reset, __setQueryError } from './__mocks__/wix-data.js';
import { __setMember, __reset as resetMember } from './__mocks__/wix-members-backend.js';

import {
  VALID_COMFORTS,
  VALID_SIZES,
  VALID_BUDGETS,
  getRecommendations,
  savePreferences,
  getMyPreferences,
} from '../src/backend/sommelierService.web.js';

const MEMBER_ID = 'member-sommelier-1';
function setMember() { __setMember({ _id: MEMBER_ID }); }

function makeProduct(overrides = {}) {
  return {
    _id: 'prod-1',
    name: 'Medium Oak Futon Frame',
    slug: 'medium-oak',
    price: 750,
    formattedPrice: '$750',
    mainMedia: 'https://example.com/oak.jpg',
    description: 'A medium versatile futon frame.',
    availableSizes: ['full', 'queen'],
    numericRating: 4.5,
    inStock: true,
    ...overrides,
  };
}

beforeEach(() => {
  __reset();
  resetMember();
  vi.restoreAllMocks();
});

// ── Constants ──────────────────────────────────────────────────────────────

describe('VALID_COMFORTS / VALID_SIZES / VALID_BUDGETS', () => {
  it('exports valid comfort options', () => {
    expect(VALID_COMFORTS).toContain('plush');
    expect(VALID_COMFORTS).toContain('medium');
    expect(VALID_COMFORTS).toContain('firm');
  });

  it('exports valid size options', () => {
    expect(VALID_SIZES).toContain('twin');
    expect(VALID_SIZES).toContain('full');
    expect(VALID_SIZES).toContain('queen');
    expect(VALID_SIZES).toContain('king');
  });

  it('exports valid budget options', () => {
    expect(VALID_BUDGETS).toContain('under-500');
    expect(VALID_BUDGETS).toContain('500-1000');
    expect(VALID_BUDGETS).toContain('1000-2000');
    expect(VALID_BUDGETS).toContain('over-2000');
  });
});

// ── getRecommendations ─────────────────────────────────────────────────────

describe('getRecommendations — param validation', () => {
  it('returns error for null params', async () => {
    const result = await getRecommendations(null);
    expect(result.success).toBe(false);
    expect(result.recommendations).toEqual([]);
  });

  it('returns error for invalid comfort', async () => {
    const result = await getRecommendations({ comfort: 'rock-hard', size: 'queen', budget: '500-1000' });
    expect(result.success).toBe(false);
  });

  it('returns error for invalid size', async () => {
    const result = await getRecommendations({ comfort: 'medium', size: 'california-king', budget: '500-1000' });
    expect(result.success).toBe(false);
  });

  it('returns error for invalid budget', async () => {
    const result = await getRecommendations({ comfort: 'medium', size: 'queen', budget: 'free' });
    expect(result.success).toBe(false);
  });

  it('returns error for non-object params', async () => {
    const result = await getRecommendations('invalid');
    expect(result.success).toBe(false);
  });
});

describe('getRecommendations — with products', () => {
  it('returns top 3 recommendations for valid params', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', name: 'Plush Futon', description: 'ultra plush soft', price: 750, availableSizes: ['queen'], numericRating: 4.8 }),
      makeProduct({ _id: 'p2', name: 'Medium Frame', description: 'medium balanced', price: 700, availableSizes: ['queen'], numericRating: 4.2 }),
      makeProduct({ _id: 'p3', name: 'Firm Support', description: 'firm supportive', price: 800, availableSizes: ['twin'], numericRating: 3.8 }),
      makeProduct({ _id: 'p4', name: 'Basic Frame', description: 'basic frame', price: 650, availableSizes: ['full'], numericRating: 3.0 }),
    ]);
    const result = await getRecommendations({ comfort: 'plush', size: 'queen', budget: '500-1000' });
    expect(result.success).toBe(true);
    expect(result.recommendations.length).toBeLessThanOrEqual(3);
    expect(result.recommendations[0]).toHaveProperty('product');
    expect(result.recommendations[0]).toHaveProperty('score');
    expect(result.recommendations[0]).toHaveProperty('matchScore');
  });

  it('returns empty recommendations when no products in budget', async () => {
    __seed('Stores/Products', []);
    const result = await getRecommendations({ comfort: 'firm', size: 'twin', budget: 'under-500' });
    expect(result.success).toBe(true);
    expect(result.recommendations).toEqual([]);
  });

  it('scores products with matching comfort keyword', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', name: 'Plush Luxury Frame', description: 'ultra soft pillow-top', price: 750, availableSizes: ['queen'], numericRating: 5 }),
      makeProduct({ _id: 'p2', name: 'Basic Frame', description: 'no comfort keywords', price: 600, availableSizes: ['queen'], numericRating: 3 }),
    ]);
    const result = await getRecommendations({ comfort: 'plush', size: 'queen', budget: '500-1000' });
    expect(result.success).toBe(true);
    // plush frame should score higher
    expect(result.recommendations[0].product._id).toBe('p1');
  });

  it('includes products not in stock and low rating (score branch coverage)', async () => {
    __seed('Stores/Products', [
      makeProduct({ _id: 'p1', price: 400, numericRating: 3.5, inStock: false, availableSizes: ['twin'] }),
    ]);
    const result = await getRecommendations({ comfort: 'firm', size: 'twin', budget: 'under-500' });
    expect(result.success).toBe(true);
    // inStock false + numericRating <= 4 = no tie-breaker bonus branches
  });

  it('returns success false on DB error', async () => {
    __setQueryError('Stores/Products', new Error('DB down'));
    const result = await getRecommendations({ comfort: 'medium', size: 'full', budget: '500-1000' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('internal_error');
  });
});

describe('getRecommendations — budget ranges', () => {
  it('handles under-500 budget', async () => {
    __seed('Stores/Products', [makeProduct({ price: 400 })]);
    const result = await getRecommendations({ comfort: 'medium', size: 'full', budget: 'under-500' });
    expect(result.success).toBe(true);
  });

  it('handles 1000-2000 budget', async () => {
    __seed('Stores/Products', [makeProduct({ price: 1500 })]);
    const result = await getRecommendations({ comfort: 'firm', size: 'king', budget: '1000-2000' });
    expect(result.success).toBe(true);
  });

  it('handles over-2000 budget', async () => {
    __seed('Stores/Products', [makeProduct({ price: 2500 })]);
    const result = await getRecommendations({ comfort: 'plush', size: 'queen', budget: 'over-2000' });
    expect(result.success).toBe(true);
  });
});

// ── savePreferences ────────────────────────────────────────────────────────

describe('savePreferences', () => {
  it('inserts new MemberProfiles record when none exists', async () => {
    setMember();
    __seed('MemberProfiles', []);
    const result = await savePreferences({ comfort: 'medium', size: 'queen', budget: '500-1000' });
    expect(result.success).toBe(true);
  });

  it('updates existing MemberProfiles record', async () => {
    setMember();
    __seed('MemberProfiles', [
      { _id: 'mp-1', memberId: MEMBER_ID, sommelierPrefs: '{"comfort":"plush","size":"full","budget":"under-500"}' },
    ]);
    const result = await savePreferences({ comfort: 'medium', size: 'queen', budget: '500-1000' });
    expect(result.success).toBe(true);
  });

  it('returns error for invalid params', async () => {
    setMember();
    const result = await savePreferences({ comfort: 'invalid', size: 'queen', budget: '500-1000' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/invalid/i);
  });

  it('returns error when member not authenticated', async () => {
    __setMember(null);
    const result = await savePreferences({ comfort: 'medium', size: 'queen', budget: '500-1000' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth/i);
  });

  it('returns error on DB failure', async () => {
    setMember();
    __setQueryError('MemberProfiles', new Error('DB down'));
    const result = await savePreferences({ comfort: 'firm', size: 'twin', budget: 'under-500' });
    expect(result.success).toBe(false);
    expect(result.error).toBe('internal_error');
  });
});

// ── getMyPreferences ───────────────────────────────────────────────────────

describe('getMyPreferences', () => {
  it('returns saved preferences when present', async () => {
    setMember();
    __seed('MemberProfiles', [
      { _id: 'mp-1', memberId: MEMBER_ID, sommelierPrefs: '{"comfort":"plush","size":"queen","budget":"500-1000"}' },
    ]);
    const result = await getMyPreferences();
    expect(result.success).toBe(true);
    expect(result.prefs).toEqual({ comfort: 'plush', size: 'queen', budget: '500-1000' });
  });

  it('returns prefs: null when no profile found', async () => {
    setMember();
    __seed('MemberProfiles', []);
    const result = await getMyPreferences();
    expect(result.success).toBe(true);
    expect(result.prefs).toBeNull();
  });

  it('returns prefs: null when sommelierPrefs field is empty', async () => {
    setMember();
    __seed('MemberProfiles', [
      { _id: 'mp-1', memberId: MEMBER_ID, sommelierPrefs: '' },
    ]);
    const result = await getMyPreferences();
    expect(result.success).toBe(true);
    expect(result.prefs).toBeNull();
  });

  it('returns prefs: null when JSON is malformed (catch branch)', async () => {
    setMember();
    __seed('MemberProfiles', [
      { _id: 'mp-1', memberId: MEMBER_ID, sommelierPrefs: 'not-valid-json' },
    ]);
    const result = await getMyPreferences();
    expect(result.success).toBe(true);
    expect(result.prefs).toBeNull();
  });

  it('returns error when member not authenticated', async () => {
    __setMember(null);
    const result = await getMyPreferences();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth/i);
  });

  it('returns error on DB failure', async () => {
    setMember();
    __setQueryError('MemberProfiles', new Error('DB error'));
    const result = await getMyPreferences();
    expect(result.success).toBe(false);
    expect(result.error).toBe('internal_error');
  });
});
