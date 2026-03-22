/**
 * Backend tests for src/backend/trendingSearches.web.js
 *
 * Tests getTrendingSearches directly using wix-data mock.
 * See CF-ts4n for specification.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __reset as resetData, __setQueryError } from './__mocks__/wix-data.js';
import { getTrendingSearches } from '../src/backend/trendingSearches.web.js';

beforeEach(() => {
  resetData();
});

describe('getTrendingSearches — backend', () => {
  it('returns terms from CMS when record exists', async () => {
    __seed('TrendingSearches', [{
      _id: 'rec-1',
      terms: ['futon frames', 'murphy beds', 'sofa beds'],
    }]);
    const result = await getTrendingSearches();
    expect(result.success).toBe(true);
    expect(result.terms).toEqual(['futon frames', 'murphy beds', 'sofa beds']);
  });

  it('returns DEFAULT_TERMS when collection is empty', async () => {
    __seed('TrendingSearches', []);
    const result = await getTrendingSearches();
    expect(result.success).toBe(true);
    expect(result.terms.length).toBeGreaterThan(0);
    expect(result.terms).toContain('futon frames');
  });

  it('returns DEFAULT_TERMS when terms field is missing', async () => {
    __seed('TrendingSearches', [{ _id: 'rec-1' }]);
    const result = await getTrendingSearches();
    expect(result.success).toBe(true);
    expect(result.terms).toContain('futon frames');
  });

  it('returns DEFAULT_TERMS when terms field is empty array', async () => {
    __seed('TrendingSearches', [{ _id: 'rec-1', terms: [] }]);
    const result = await getTrendingSearches();
    expect(result.success).toBe(true);
    expect(result.terms).toContain('futon frames');
  });

  it('filters out non-string and blank entries from terms array', async () => {
    __seed('TrendingSearches', [{ _id: 'rec-1', terms: ['futon frames', null, 42, '', 'murphy beds'] }]);
    const result = await getTrendingSearches();
    expect(result.success).toBe(true);
    expect(result.terms).toEqual(['futon frames', 'murphy beds']);
  });

  it('returns success: false and DEFAULT_TERMS when wixData throws', async () => {
    __setQueryError('TrendingSearches', new Error('DB unavailable'));
    const result = await getTrendingSearches();
    expect(result.success).toBe(false);
    expect(result.terms).toContain('futon frames');
    expect(result.error).toBeTruthy();
  });

  it('only reads first record (singleton pattern)', async () => {
    __seed('TrendingSearches', [
      { _id: 'rec-1', terms: ['term A', 'term B'] },
      { _id: 'rec-2', terms: ['term C', 'term D'] },
    ]);
    const result = await getTrendingSearches();
    expect(result.terms).toEqual(['term A', 'term B']);
  });

  it('does not throw — always resolves', async () => {
    __setQueryError('TrendingSearches', new Error('catastrophic'));
    await expect(getTrendingSearches()).resolves.toBeDefined();
  });
});
