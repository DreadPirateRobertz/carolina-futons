/**
 * Tests for product360Data.js — 360-degree image spin set data module
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { get360Images, has360View, register360SpinSet } from '../src/public/product360Data.js';

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

  it('overwrites existing spin set', () => {
    register360SpinSet('overwrite-test', [{ src: 'old.jpg', alt: 'Old' }]);
    register360SpinSet('overwrite-test', [{ src: 'new.jpg', alt: 'New' }]);
    expect(get360Images('overwrite-test')).toEqual([{ src: 'new.jpg', alt: 'New' }]);
  });
});
