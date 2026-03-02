import { describe, it, expect } from 'vitest';
import {
  buildFilterChips,
  removeFilter,
  clearAllFilters,
  serializeFiltersToUrl,
  deserializeFiltersFromUrl,
  formatFeatureLabel,
  sanitizeFilterInput,
} from '../src/public/categoryFilterHelpers.js';

// ── sanitizeFilterInput ───────────────────────────────────────────

describe('sanitizeFilterInput', () => {
  it('strips HTML tags from input', () => {
    expect(sanitizeFilterInput('<b>bold</b>')).toBe('bold');
  });

  it('strips script tags', () => {
    expect(sanitizeFilterInput('<script>alert("xss")</script>hardwood')).toBe('hardwood');
  });

  it('decodes HTML entities', () => {
    expect(sanitizeFilterInput('Night &amp; Day')).toBe('Night & Day');
  });

  it('trims whitespace', () => {
    expect(sanitizeFilterInput('  hardwood  ')).toBe('hardwood');
  });

  it('truncates to maxLen', () => {
    const long = 'a'.repeat(300);
    expect(sanitizeFilterInput(long, 100)).toHaveLength(100);
  });

  it('returns empty string for non-string input', () => {
    expect(sanitizeFilterInput(null)).toBe('');
    expect(sanitizeFilterInput(undefined)).toBe('');
    expect(sanitizeFilterInput(42)).toBe('');
  });

  it('defaults maxLen to 200', () => {
    const long = 'b'.repeat(250);
    expect(sanitizeFilterInput(long)).toHaveLength(200);
  });

  it('handles nested HTML tags', () => {
    expect(sanitizeFilterInput('<div><img onerror=alert(1)>wood</div>')).toBe('wood');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeFilterInput('')).toBe('');
  });
});

// ── formatFeatureLabel ───────────────────────────────────────────

describe('formatFeatureLabel', () => {
  it('capitalizes hyphenated words', () => {
    expect(formatFeatureLabel('wall-hugger')).toBe('Wall Hugger');
  });

  it('capitalizes single word', () => {
    expect(formatFeatureLabel('sleeper')).toBe('Sleeper');
  });

  it('handles multiple hyphens', () => {
    expect(formatFeatureLabel('extra-firm-support')).toBe('Extra Firm Support');
  });

  it('handles empty string', () => {
    expect(formatFeatureLabel('')).toBe('');
  });
});

// ── buildFilterChips ─────────────────────────────────────────────

describe('buildFilterChips', () => {
  it('returns empty array when no filters active', () => {
    expect(buildFilterChips({})).toEqual([]);
  });

  it('builds chip for material filter', () => {
    const chips = buildFilterChips({ material: 'hardwood' });
    expect(chips).toHaveLength(1);
    expect(chips[0]).toEqual({
      _id: 'chip-material',
      label: 'Material: hardwood',
      key: 'material',
    });
  });

  it('builds chip for color filter', () => {
    const chips = buildFilterChips({ color: 'walnut' });
    expect(chips).toHaveLength(1);
    expect(chips[0].label).toBe('Color: walnut');
    expect(chips[0].key).toBe('color');
  });

  it('builds chips for multiple feature tags', () => {
    const chips = buildFilterChips({ features: ['wall-hugger', 'sleeper'] });
    expect(chips).toHaveLength(2);
    expect(chips[0].label).toBe('Feature: Wall Hugger');
    expect(chips[0].key).toBe('features');
    expect(chips[0].value).toBe('wall-hugger');
    expect(chips[1].label).toBe('Feature: Sleeper');
    expect(chips[1].value).toBe('sleeper');
  });

  it('builds chip for price range', () => {
    const chips = buildFilterChips({ priceRange: '300-500' });
    expect(chips).toHaveLength(1);
    expect(chips[0].label).toBe('Price: 300-500');
    expect(chips[0].key).toBe('priceRange');
  });

  it('builds chip for brand', () => {
    const chips = buildFilterChips({ brand: 'Strata' });
    expect(chips).toHaveLength(1);
    expect(chips[0].label).toBe('Brand: Strata');
  });

  it('builds chip for size', () => {
    const chips = buildFilterChips({ size: 'Queen' });
    expect(chips).toHaveLength(1);
    expect(chips[0].label).toBe('Size: Queen');
  });

  it('builds chip for comfort level', () => {
    const chips = buildFilterChips({ comfortLevel: '3' });
    expect(chips).toHaveLength(1);
    expect(chips[0].label).toBe('Comfort: 3');
  });

  it('builds chips for width range', () => {
    const chips = buildFilterChips({ widthRange: [30, 80] });
    expect(chips).toHaveLength(1);
    expect(chips[0].label).toBe('Width: 30"-80"');
  });

  it('builds chips for depth range', () => {
    const chips = buildFilterChips({ depthRange: [20, 60] });
    expect(chips).toHaveLength(1);
    expect(chips[0].label).toBe('Depth: 20"-60"');
  });

  it('builds multiple chips from combined filters', () => {
    const chips = buildFilterChips({
      material: 'hardwood',
      brand: 'Strata',
      priceRange: '500-800',
    });
    expect(chips).toHaveLength(3);
    const keys = chips.map(c => c.key);
    expect(keys).toContain('material');
    expect(keys).toContain('brand');
    expect(keys).toContain('priceRange');
  });

  it('ignores empty features array', () => {
    const chips = buildFilterChips({ features: [] });
    expect(chips).toEqual([]);
  });

  it('ignores falsy filter values', () => {
    const chips = buildFilterChips({ material: '', brand: null, color: undefined });
    expect(chips).toEqual([]);
  });
});

// ── removeFilter ─────────────────────────────────────────────────

describe('removeFilter', () => {
  it('removes a simple key', () => {
    const filters = { material: 'hardwood', brand: 'Strata' };
    const result = removeFilter(filters, 'material');
    expect(result.material).toBeUndefined();
    expect(result.brand).toBe('Strata');
  });

  it('removes a specific feature value', () => {
    const filters = { features: ['wall-hugger', 'sleeper', 'outdoor'] };
    const result = removeFilter(filters, 'features', 'sleeper');
    expect(result.features).toEqual(['wall-hugger', 'outdoor']);
  });

  it('removes features key when last feature removed', () => {
    const filters = { features: ['sleeper'] };
    const result = removeFilter(filters, 'features', 'sleeper');
    expect(result.features).toBeUndefined();
  });

  it('removes widthRange and returns clean state', () => {
    const filters = { widthRange: [30, 80], material: 'metal' };
    const result = removeFilter(filters, 'widthRange');
    expect(result.widthRange).toBeUndefined();
    expect(result.material).toBe('metal');
  });

  it('removes depthRange', () => {
    const filters = { depthRange: [20, 60] };
    const result = removeFilter(filters, 'depthRange');
    expect(result.depthRange).toBeUndefined();
  });

  it('does not mutate the original filters object', () => {
    const filters = { material: 'hardwood', brand: 'Strata' };
    const result = removeFilter(filters, 'material');
    expect(filters.material).toBe('hardwood');
    expect(result).not.toBe(filters);
  });

  it('handles removing non-existent key gracefully', () => {
    const filters = { brand: 'Strata' };
    const result = removeFilter(filters, 'color');
    expect(result).toEqual({ brand: 'Strata' });
  });
});

// ── clearAllFilters ─────────────────────────────────────────────

describe('clearAllFilters', () => {
  it('returns empty object', () => {
    expect(clearAllFilters()).toEqual({});
  });
});

// ── serializeFiltersToUrl ───────────────────────────────────────

describe('serializeFiltersToUrl', () => {
  it('returns empty string for empty filters', () => {
    expect(serializeFiltersToUrl({})).toBe('');
  });

  it('serializes material filter', () => {
    const qs = serializeFiltersToUrl({ material: 'hardwood' });
    expect(qs).toBe('material=hardwood');
  });

  it('serializes price range', () => {
    const qs = serializeFiltersToUrl({ priceRange: '300-500' });
    expect(qs).toBe('price=300-500');
  });

  it('serializes features as comma-separated', () => {
    const qs = serializeFiltersToUrl({ features: ['sleeper', 'wall-hugger'] });
    expect(qs).toBe('features=sleeper%2Cwall-hugger');
  });

  it('serializes width range as dash-separated', () => {
    const qs = serializeFiltersToUrl({ widthRange: [30, 80] });
    expect(qs).toBe('width=30-80');
  });

  it('serializes depth range', () => {
    const qs = serializeFiltersToUrl({ depthRange: [20, 60] });
    expect(qs).toBe('depth=20-60');
  });

  it('serializes brand', () => {
    const qs = serializeFiltersToUrl({ brand: 'Night & Day' });
    expect(qs).toBe('brand=Night%20%26%20Day');
  });

  it('serializes size', () => {
    const qs = serializeFiltersToUrl({ size: 'Queen' });
    expect(qs).toBe('size=Queen');
  });

  it('serializes comfort level', () => {
    const qs = serializeFiltersToUrl({ comfortLevel: '3' });
    expect(qs).toBe('comfort=3');
  });

  it('serializes dropdown price as priceDropdown', () => {
    const qs = serializeFiltersToUrl({ price: '0-300' });
    expect(qs).toBe('priceDropdown=0-300');
  });

  it('serializes multiple filters joined with &', () => {
    const qs = serializeFiltersToUrl({ material: 'hardwood', brand: 'Strata' });
    expect(qs).toContain('material=hardwood');
    expect(qs).toContain('brand=Strata');
    expect(qs).toContain('&');
  });

  it('omits falsy values', () => {
    const qs = serializeFiltersToUrl({ material: '', brand: null, color: undefined });
    expect(qs).toBe('');
  });

  it('omits empty features array', () => {
    const qs = serializeFiltersToUrl({ features: [] });
    expect(qs).toBe('');
  });
});

// ── deserializeFiltersFromUrl ───────────────────────────────────

describe('deserializeFiltersFromUrl', () => {
  it('returns empty object for empty query', () => {
    expect(deserializeFiltersFromUrl({})).toEqual({});
  });

  it('deserializes material', () => {
    const result = deserializeFiltersFromUrl({ material: 'hardwood' });
    expect(result.material).toBe('hardwood');
  });

  it('deserializes price to priceRange', () => {
    const result = deserializeFiltersFromUrl({ price: '300-500' });
    expect(result.priceRange).toBe('300-500');
  });

  it('deserializes features from comma-separated', () => {
    const result = deserializeFiltersFromUrl({ features: 'sleeper,wall-hugger' });
    expect(result.features).toEqual(['sleeper', 'wall-hugger']);
  });

  it('deserializes width range', () => {
    const result = deserializeFiltersFromUrl({ width: '30-80' });
    expect(result.widthRange).toEqual([30, 80]);
  });

  it('deserializes depth range', () => {
    const result = deserializeFiltersFromUrl({ depth: '20-60' });
    expect(result.depthRange).toEqual([20, 60]);
  });

  it('deserializes brand', () => {
    const result = deserializeFiltersFromUrl({ brand: 'Strata' });
    expect(result.brand).toBe('Strata');
  });

  it('deserializes size', () => {
    const result = deserializeFiltersFromUrl({ size: 'Queen' });
    expect(result.size).toBe('Queen');
  });

  it('deserializes comfort', () => {
    const result = deserializeFiltersFromUrl({ comfort: '3' });
    expect(result.comfortLevel).toBe('3');
  });

  it('sanitizes all values to prevent XSS', () => {
    const result = deserializeFiltersFromUrl({
      material: '<script>alert(1)</script>hardwood',
    });
    expect(result.material).toBe('hardwood');
    expect(result.material).not.toContain('<script>');
  });

  it('sanitizes features individually', () => {
    const result = deserializeFiltersFromUrl({
      features: '<b>bold</b>,normal',
    });
    expect(result.features).toEqual(['bold', 'normal']);
  });

  it('rejects invalid width range (NaN)', () => {
    const result = deserializeFiltersFromUrl({ width: 'abc-def' });
    expect(result.widthRange).toBeUndefined();
  });

  it('rejects invalid depth range', () => {
    const result = deserializeFiltersFromUrl({ depth: 'not-numbers' });
    expect(result.depthRange).toBeUndefined();
  });

  it('ignores unknown query params', () => {
    const result = deserializeFiltersFromUrl({ unknown: 'value', material: 'metal' });
    expect(result.unknown).toBeUndefined();
    expect(result.material).toBe('metal');
  });

  it('handles null query', () => {
    expect(deserializeFiltersFromUrl(null)).toEqual({});
  });

  it('handles undefined query', () => {
    expect(deserializeFiltersFromUrl(undefined)).toEqual({});
  });

  it('roundtrips with serializeFiltersToUrl for simple filters', () => {
    const original = { material: 'hardwood', brand: 'Strata', size: 'Queen' };
    const qs = serializeFiltersToUrl(original);
    const params = {};
    qs.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v);
    });
    const restored = deserializeFiltersFromUrl(params);
    expect(restored.material).toBe('hardwood');
    expect(restored.brand).toBe('Strata');
    expect(restored.size).toBe('Queen');
  });
});
