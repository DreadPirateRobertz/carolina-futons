import { describe, it, expect } from 'vitest';
import {
  getCategoryHeroImage,
  getCategoryCardImage,
  getPlaceholderProductImages,
  getProductFallbackImage,
  getGridThumbnail,
  getGalleryThumbnail,
} from '../src/public/placeholderImages.js';
import { getGalleryConfig } from '../src/public/galleryConfig.js';

const ALL_CATEGORIES = [
  'futon-frames',
  'mattresses',
  'murphy-cabinet-beds',
  'platform-beds',
  'casegoods-accessories',
  'wall-huggers',
  'unfinished-wood',
];

const UNSPLASH_URL_PATTERN = /^https:\/\/images\.unsplash\.com\/photo-[\w-]+\?w=\d+&h=\d+&fit=crop&crop=center$/;

// ── getCategoryHeroImage ─────────────────────────────────────────

describe('getCategoryHeroImage', () => {
  it('returns category-specific hero image', () => {
    const url = getCategoryHeroImage('futon-frames');
    expect(url).toContain('unsplash.com');
    expect(url).toContain('w=1920');
  });

  it('returns fallback for unknown category', () => {
    const url = getCategoryHeroImage('nonexistent');
    expect(url).toContain('unsplash.com');
    expect(url).toContain('1920');
  });

  it('returns different images for different categories', () => {
    const futon = getCategoryHeroImage('futon-frames');
    const murphy = getCategoryHeroImage('murphy-cabinet-beds');
    expect(futon).not.toBe(murphy);
  });

  it.each(ALL_CATEGORIES)('returns valid 1920x600 hero for %s', (cat) => {
    const url = getCategoryHeroImage(cat);
    expect(url).toMatch(UNSPLASH_URL_PATTERN);
    expect(url).toContain('w=1920&h=600');
  });

  it('all 7 categories have unique hero images', () => {
    const urls = ALL_CATEGORIES.map(getCategoryHeroImage);
    expect(new Set(urls).size).toBe(7);
  });
});

// ── getCategoryCardImage ─────────────────────────────────────────

describe('getCategoryCardImage', () => {
  it('returns 600x400 category card image', () => {
    const url = getCategoryCardImage('mattresses');
    expect(url).toContain('w=600');
    expect(url).toContain('h=400');
  });

  it('returns fallback for unknown category', () => {
    const url = getCategoryCardImage('unknown');
    expect(url).toContain('unsplash.com');
  });

  it.each(ALL_CATEGORIES)('returns valid 600x400 card for %s', (cat) => {
    const url = getCategoryCardImage(cat);
    expect(url).toMatch(UNSPLASH_URL_PATTERN);
    expect(url).toContain('w=600&h=400');
  });

  it('all 7 categories have unique card images', () => {
    const urls = ALL_CATEGORIES.map(getCategoryCardImage);
    expect(new Set(urls).size).toBe(7);
  });
});

// ── getPlaceholderProductImages ──────────────────────────────────

describe('getPlaceholderProductImages', () => {
  it('returns requested number of images', () => {
    const images = getPlaceholderProductImages('futon-frames', 3);
    expect(images).toHaveLength(3);
  });

  it('cycles images when count exceeds available', () => {
    const images = getPlaceholderProductImages('wall-huggers', 8);
    expect(images).toHaveLength(8);
    // wall-huggers has 4 images, so index 4 should cycle back to index 0
    expect(images[4]).toBe(images[0]);
  });

  it('falls back to futon-frames for unknown category', () => {
    const images = getPlaceholderProductImages('nonexistent', 2);
    expect(images).toHaveLength(2);
    expect(images[0]).toContain('unsplash.com');
  });

  it('all images are 800x800', () => {
    const images = getPlaceholderProductImages('platform-beds', 4);
    for (const url of images) {
      expect(url).toContain('w=800');
      expect(url).toContain('h=800');
    }
  });

  it.each(ALL_CATEGORIES)('returns valid 800x800 product images for %s', (cat) => {
    const images = getPlaceholderProductImages(cat, 4);
    expect(images.length).toBe(4);
    for (const url of images) {
      expect(url).toMatch(UNSPLASH_URL_PATTERN);
      expect(url).toContain('w=800&h=800');
    }
  });

  it.each(ALL_CATEGORIES)('has enough images for galleryConfig thumbnailCount in %s', (cat) => {
    const config = getGalleryConfig(cat);
    const images = getPlaceholderProductImages(cat, config.thumbnailCount);
    // Every image should be unique (no cycling needed within thumbnailCount)
    const unique = new Set(images);
    expect(unique.size).toBe(config.thumbnailCount);
  });
});

// ── getProductFallbackImage ──────────────────────────────────────

describe('getProductFallbackImage', () => {
  it('returns first image from category when provided', () => {
    const url = getProductFallbackImage('mattresses');
    expect(url).toContain('unsplash.com');
    expect(url).toContain('800');
  });

  it('returns generic fallback when no category', () => {
    const url = getProductFallbackImage();
    expect(url).toContain('unsplash.com');
  });

  it('returns generic fallback for unknown category', () => {
    const url = getProductFallbackImage('nonexistent');
    expect(url).toContain('unsplash.com');
  });

  it.each(ALL_CATEGORIES)('returns valid fallback for %s', (cat) => {
    const url = getProductFallbackImage(cat);
    expect(url).toMatch(UNSPLASH_URL_PATTERN);
    expect(url).toContain('w=800&h=800');
  });
});

// ── getGridThumbnail ─────────────────────────────────────────────

describe('getGridThumbnail', () => {
  it('converts 800x800 to 400x400', () => {
    const source = 'https://images.unsplash.com/photo-123?w=800&h=800&fit=crop';
    const thumb = getGridThumbnail(source);
    expect(thumb).toContain('w=400&h=400');
    expect(thumb).not.toContain('w=800');
  });

  it('returns fallback for null input', () => {
    const thumb = getGridThumbnail(null);
    expect(thumb).toContain('w=400&h=400');
  });

  it.each(ALL_CATEGORIES)('converts product images to grid size for %s', (cat) => {
    const images = getPlaceholderProductImages(cat, 2);
    for (const url of images) {
      const thumb = getGridThumbnail(url);
      expect(thumb).toContain('w=400&h=400');
      expect(thumb).not.toContain('w=800');
    }
  });
});

// ── getGalleryThumbnail ──────────────────────────────────────────

describe('getGalleryThumbnail', () => {
  it('converts 800x800 to 100x100', () => {
    const source = 'https://images.unsplash.com/photo-123?w=800&h=800&fit=crop';
    const thumb = getGalleryThumbnail(source);
    expect(thumb).toContain('w=100&h=100');
  });

  it('returns fallback for null input', () => {
    const thumb = getGalleryThumbnail(null);
    expect(thumb).toContain('w=100&h=100');
  });

  it.each(ALL_CATEGORIES)('converts product images to gallery thumbnail for %s', (cat) => {
    const images = getPlaceholderProductImages(cat, 2);
    for (const url of images) {
      const thumb = getGalleryThumbnail(url);
      expect(thumb).toContain('w=100&h=100');
      expect(thumb).not.toContain('w=800');
    }
  });
});
