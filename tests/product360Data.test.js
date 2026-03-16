/**
 * Tests for product360Data.js — 360-degree image spin set data module
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  get360Images,
  has360View,
  register360SpinSet,
  buildSpinSet,
  SPIN_CDN_BASE,
  DEFAULT_FRAME_COUNT,
} from '../src/public/product360Data.js';

describe('get360Images', () => {
  it('returns empty array for unknown slug', () => {
    expect(get360Images('nonexistent-product')).toEqual([]);
  });

  it('returns empty array for null/undefined input', () => {
    expect(get360Images(null)).toEqual([]);
    expect(get360Images(undefined)).toEqual([]);
    expect(get360Images('')).toEqual([]);
  });

  it('returns empty array for non-string input', () => {
    expect(get360Images(123)).toEqual([]);
    expect(get360Images({})).toEqual([]);
  });

  it('returns registered spin set after registration', () => {
    const images = [
      { src: 'img1.jpg', alt: 'View 1' },
      { src: 'img2.jpg', alt: 'View 2' },
    ];
    register360SpinSet('test-product-360', images);
    expect(get360Images('test-product-360')).toEqual(images);
  });
});

describe('has360View', () => {
  it('returns false for null product', () => {
    expect(has360View(null)).toBe(false);
    expect(has360View(undefined)).toBe(false);
  });

  it('returns false for product without spin set', () => {
    expect(has360View({ slug: 'no-spin-set', _id: 'abc' })).toBe(false);
  });

  it('returns true for product with registered spin set (by slug)', () => {
    register360SpinSet('has-spin', [{ src: 'a.jpg', alt: 'A' }]);
    expect(has360View({ slug: 'has-spin' })).toBe(true);
  });

  it('returns true for product with registered spin set (by _id)', () => {
    register360SpinSet('id-spin', [{ src: 'b.jpg', alt: 'B' }]);
    expect(has360View({ _id: 'id-spin' })).toBe(true);
  });

  it('prefers slug over _id', () => {
    register360SpinSet('slug-pref', [{ src: 'c.jpg', alt: 'C' }]);
    expect(has360View({ slug: 'slug-pref', _id: 'unknown' })).toBe(true);
  });
});

describe('has360View — additional edge cases', () => {
  it('returns false for product with neither slug nor _id', () => {
    expect(has360View({})).toBe(false);
    expect(has360View({ name: 'Test' })).toBe(false);
  });

  it('returns false for product with empty string slug and no _id', () => {
    expect(has360View({ slug: '' })).toBe(false);
  });

  it('falls back to _id when slug is empty string', () => {
    register360SpinSet('fallback-id', [{ src: 'f.jpg', alt: 'F' }]);
    expect(has360View({ slug: '', _id: 'fallback-id' })).toBe(true);
  });

  it('returns false when registered spin set is empty array', () => {
    register360SpinSet('empty-spin', []);
    expect(has360View({ slug: 'empty-spin' })).toBe(false);
  });
});

describe('buildSpinSet', () => {
  it('generates correct number of frames', () => {
    const set = buildSpinSet('test-slug', 'Test Product');
    expect(set).toHaveLength(DEFAULT_FRAME_COUNT);
    expect(set).toHaveLength(36);
  });

  it('generates CDN URLs with zero-padded frame numbers', () => {
    const set = buildSpinSet('monterey', 'Monterey');
    expect(set[0].src).toBe(`${SPIN_CDN_BASE}/monterey/monterey-00.jpg`);
    expect(set[9].src).toBe(`${SPIN_CDN_BASE}/monterey/monterey-09.jpg`);
    expect(set[10].src).toBe(`${SPIN_CDN_BASE}/monterey/monterey-10.jpg`);
    expect(set[35].src).toBe(`${SPIN_CDN_BASE}/monterey/monterey-35.jpg`);
  });

  it('generates descriptive alt text with angle', () => {
    const set = buildSpinSet('test', 'Test Product');
    expect(set[0].alt).toBe('Test Product — 360° view, angle 0°');
    expect(set[18].alt).toBe('Test Product — 360° view, angle 180°');
  });

  it('respects custom frame count', () => {
    const set = buildSpinSet('test', 'Test', 8);
    expect(set).toHaveLength(8);
    expect(set[1].alt).toContain('angle 45°');
  });
});

describe('pre-configured spin sets', () => {
  it('has spin sets for Murphy cabinet beds', () => {
    expect(get360Images('murphy-queen-vertical')).toHaveLength(36);
    expect(get360Images('murphy-full-horizontal')).toHaveLength(36);
    expect(get360Images('murphy-queen-bookcase')).toHaveLength(36);
    expect(get360Images('murphy-twin-cabinet')).toHaveLength(36);
    expect(get360Images('murphy-queen-desk')).toHaveLength(36);
    expect(get360Images('murphy-full-storage')).toHaveLength(36);
  });

  it('has spin sets for top futon frames', () => {
    expect(get360Images('asheville')).toHaveLength(36);
    expect(get360Images('blue-ridge')).toHaveLength(36);
    expect(get360Images('pisgah')).toHaveLength(36);
    expect(get360Images('biltmore')).toHaveLength(36);
    expect(get360Images('monterey')).toHaveLength(36);
  });

  it('has360View returns true for configured products', () => {
    expect(has360View({ slug: 'monterey' })).toBe(true);
    expect(has360View({ slug: 'murphy-queen-vertical' })).toBe(true);
  });
});

describe('register360SpinSet', () => {
  it('ignores null/empty slug', () => {
    register360SpinSet(null, [{ src: 'x.jpg', alt: 'X' }]);
    register360SpinSet('', [{ src: 'x.jpg', alt: 'X' }]);
    // No error thrown
  });

  it('ignores non-array images', () => {
    register360SpinSet('bad-images', 'not-array');
    expect(get360Images('bad-images')).toEqual([]);
  });

  it('accepts truthy non-string slugs without error but they are unretrievable', () => {
    expect(() => register360SpinSet(123, [{ src: 'x.jpg', alt: 'X' }])).not.toThrow();
    expect(() => register360SpinSet(true, [{ src: 'y.jpg', alt: 'Y' }])).not.toThrow();
    expect(get360Images(123)).toEqual([]);
    expect(get360Images(true)).toEqual([]);
  });

  it('stores empty array as valid spin set', () => {
    register360SpinSet('empty-valid', []);
    expect(get360Images('empty-valid')).toEqual([]);
  });

  it('overwrites existing spin set', () => {
    register360SpinSet('overwrite-test', [{ src: 'old.jpg', alt: 'Old' }]);
    register360SpinSet('overwrite-test', [{ src: 'new.jpg', alt: 'New' }]);
    expect(get360Images('overwrite-test')).toEqual([{ src: 'new.jpg', alt: 'New' }]);
  });

  it('ignores undefined and null images arg', () => {
    register360SpinSet('undef-imgs', undefined);
    register360SpinSet('null-imgs', null);
    expect(get360Images('undef-imgs')).toEqual([]);
    expect(get360Images('null-imgs')).toEqual([]);
  });
});
