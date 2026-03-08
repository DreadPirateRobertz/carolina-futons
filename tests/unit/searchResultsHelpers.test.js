import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildSkeletonData,
  getActiveFilterCount,
  buildSearchChips,
} from '../../src/public/SearchResultsHelpers.js';

describe('buildSkeletonData', () => {
  it('returns array of skeleton items with correct count', () => {
    const items = buildSkeletonData(6);
    expect(items).toHaveLength(6);
    expect(items[0]._id).toBe('skeleton-0');
    expect(items[0].isSkeleton).toBe(true);
  });

  it('defaults to 8 items when count not specified', () => {
    const items = buildSkeletonData();
    expect(items).toHaveLength(8);
  });

  it('returns empty array for 0 or negative count', () => {
    expect(buildSkeletonData(0)).toHaveLength(0);
    expect(buildSkeletonData(-1)).toHaveLength(0);
  });
});

describe('getActiveFilterCount', () => {
  it('returns 0 when no filters active', () => {
    expect(getActiveFilterCount({ category: '', priceRange: '', material: '', color: '' })).toBe(0);
  });

  it('counts each active filter', () => {
    expect(getActiveFilterCount({ category: 'futons', priceRange: '300-500', material: '', color: '' })).toBe(2);
  });

  it('handles null/undefined filters gracefully', () => {
    expect(getActiveFilterCount(null)).toBe(0);
    expect(getActiveFilterCount(undefined)).toBe(0);
    expect(getActiveFilterCount({})).toBe(0);
  });
});

describe('buildSearchChips', () => {
  it('returns chip objects from query strings', () => {
    const chips = buildSearchChips(['futon frames', 'mattresses', 'murphy beds']);
    expect(chips).toHaveLength(3);
    expect(chips[0]).toEqual({ _id: 'chip-0', label: 'futon frames', query: 'futon frames' });
  });

  it('returns empty array for empty input', () => {
    expect(buildSearchChips([])).toHaveLength(0);
    expect(buildSearchChips(null)).toHaveLength(0);
  });

  it('caps at maxChips', () => {
    const queries = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const chips = buildSearchChips(queries, 6);
    expect(chips).toHaveLength(6);
  });
});
