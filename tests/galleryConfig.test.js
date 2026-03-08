import { describe, it, expect } from 'vitest';
import {
  getGalleryConfig,
  getImageDimensions,
  getGridColumns,
  imageSizes,
} from '../src/public/galleryConfig.js';

// ── getGalleryConfig ────────────────────────────────────────────────

describe('getGalleryConfig', () => {
  it('returns default config for unknown category', () => {
    const config = getGalleryConfig('nonexistent');
    expect(config.thumbnailCount).toBe(4);
    expect(config.enableZoom).toBe(true);
    expect(config.enableLightbox).toBe(true);
    expect(config.zoomLevel).toBe(2);
    expect(config.mainImageFit).toBe('contain');
  });

  it('applies futon-frames overrides', () => {
    const config = getGalleryConfig('futon-frames');
    expect(config.thumbnailCount).toBe(5);
    expect(config.zoomLevel).toBe(2.5);
    expect(config.thumbnailPosition).toBe('left');
    // Defaults still present
    expect(config.enableZoom).toBe(true);
  });

  it('applies murphy-cabinet-beds overrides with autoPlay', () => {
    const config = getGalleryConfig('murphy-cabinet-beds');
    expect(config.autoPlayGallery).toBe(true);
    expect(config.thumbnailCount).toBe(6);
  });

  it('applies unfinished-wood with highest zoom level', () => {
    const config = getGalleryConfig('unfinished-wood');
    expect(config.zoomLevel).toBe(3);
  });

  it('all known categories return valid configs', () => {
    const categories = [
      'futon-frames', 'mattresses', 'murphy-cabinet-beds',
      'platform-beds', 'casegoods-accessories', 'wall-huggers', 'unfinished-wood',
    ];
    for (const cat of categories) {
      const config = getGalleryConfig(cat);
      expect(config.thumbnailCount).toBeGreaterThan(0);
      expect(config.enableZoom).toBe(true);
    }
  });
});

// ── getImageDimensions ──────────────────────────────────────────────

describe('getImageDimensions', () => {
  it('returns hero dimensions', () => {
    const dims = getImageDimensions('hero');
    expect(dims).toEqual({ width: 1920, height: 600 });
  });

  it('returns product page main dimensions (1:1)', () => {
    const dims = getImageDimensions('productPageMain');
    expect(dims.width).toBe(dims.height);
  });

  it('returns grid card dimensions (1:1)', () => {
    const dims = getImageDimensions('productGridCard');
    expect(dims.width).toBe(dims.height);
  });

  it('falls back to productGridCard for unknown context', () => {
    const dims = getImageDimensions('unknown');
    expect(dims).toEqual(imageSizes.productGridCard);
  });

  it('returns correct productGridCard dimensions', () => {
    const dims = getImageDimensions('productGridCard');
    expect(dims).toEqual({ width: 400, height: 400 });
  });

  it('returns correct productPageMain dimensions', () => {
    const dims = getImageDimensions('productPageMain');
    expect(dims).toEqual({ width: 800, height: 800 });
  });

  it('returns correct thumbnail dimensions', () => {
    const dims = getImageDimensions('thumbnail');
    expect(dims).toEqual({ width: 100, height: 100 });
  });

  it('returns correct categoryCard dimensions (3:2)', () => {
    const dims = getImageDimensions('categoryCard');
    expect(dims).toEqual({ width: 600, height: 400 });
  });

  it('always returns { width, height } shape', () => {
    for (const context of ['hero', 'productGridCard', 'productPageMain', 'thumbnail', 'categoryCard', 'nonexistent']) {
      const dims = getImageDimensions(context);
      expect(dims).toHaveProperty('width');
      expect(dims).toHaveProperty('height');
      expect(typeof dims.width).toBe('number');
      expect(typeof dims.height).toBe('number');
    }
  });

  it('falls back to productGridCard for undefined/null', () => {
    expect(getImageDimensions(undefined)).toEqual(imageSizes.productGridCard);
    expect(getImageDimensions(null)).toEqual(imageSizes.productGridCard);
  });
});

// ── getGridColumns ──────────────────────────────────────────────────

describe('getGridColumns', () => {
  it('returns 3 columns for desktop (>= 1200px)', () => {
    expect(getGridColumns(1400)).toBe(3);
    expect(getGridColumns(1200)).toBe(3);
  });

  it('returns 2 columns for tablet (768-1199px)', () => {
    expect(getGridColumns(768)).toBe(2);
    expect(getGridColumns(1000)).toBe(2);
  });

  it('returns 1 column for mobile (< 768px)', () => {
    expect(getGridColumns(375)).toBe(1);
    expect(getGridColumns(767)).toBe(1);
  });
});
