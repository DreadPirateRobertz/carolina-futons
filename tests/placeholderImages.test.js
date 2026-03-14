import { describe, it, expect } from 'vitest';
import {
  getCategoryHeroImage,
  getCategoryCardImage,
  getHomepageHeroImage,
  getPlaceholderProductImages,
  getProductFallbackImage,
  getGridThumbnail,
  getGalleryThumbnail,
  getHomepageHeroAlt,
  getCategoryHeroAlt,
  getCategoryCardAlt,
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

const WIXSTATIC_URL_PATTERN = /^https:\/\/static\.wixstatic\.com\/media\/e04e89_[\w]+~mv2\.\w+\/v1\/fit\/w_\d+,h_\d+,q_\d+\/file\.\w+$/;

// ── getCategoryHeroImage ─────────────────────────────────────────

describe('getCategoryHeroImage', () => {
  it('returns category-specific hero image from Wix CDN', () => {
    const url = getCategoryHeroImage('futon-frames');
    expect(url).toContain('static.wixstatic.com');
    expect(url).toContain('w_1920');
  });

  it('returns fallback for unknown category with correct 1920x600 dimensions', () => {
    const url = getCategoryHeroImage('nonexistent');
    expect(url).toContain('static.wixstatic.com');
    expect(url).toContain('w_1920,h_600');
  });

  it('returns different images for different categories', () => {
    const futon = getCategoryHeroImage('futon-frames');
    const murphy = getCategoryHeroImage('murphy-cabinet-beds');
    expect(futon).not.toBe(murphy);
  });

  it.each(ALL_CATEGORIES)('returns valid 1920x600 wixstatic hero for %s', (cat) => {
    const url = getCategoryHeroImage(cat);
    expect(url).toMatch(WIXSTATIC_URL_PATTERN);
    expect(url).toContain('w_1920,h_600');
  });

  it('all 7 categories have unique hero images', () => {
    const urls = ALL_CATEGORIES.map(getCategoryHeroImage);
    expect(new Set(urls).size).toBe(7);
  });
});

// ── getCategoryCardImage ─────────────────────────────────────────

describe('getCategoryCardImage', () => {
  it('returns 600x400 category card image from Wix CDN', () => {
    const url = getCategoryCardImage('mattresses');
    expect(url).toContain('static.wixstatic.com');
    expect(url).toContain('w_600,h_400');
  });

  it('returns fallback for unknown category with correct 600x400 dimensions', () => {
    const url = getCategoryCardImage('unknown');
    expect(url).toContain('static.wixstatic.com');
    expect(url).toContain('w_600,h_400');
  });

  it.each(ALL_CATEGORIES)('returns valid 600x400 wixstatic card for %s', (cat) => {
    const url = getCategoryCardImage(cat);
    expect(url).toMatch(WIXSTATIC_URL_PATTERN);
    expect(url).toContain('w_600,h_400');
  });

  it('all 7 categories have unique card images', () => {
    const urls = ALL_CATEGORIES.map(getCategoryCardImage);
    expect(new Set(urls).size).toBe(7);
  });

  it('sales category has a valid wixstatic card image', () => {
    const url = getCategoryCardImage('sales');
    expect(url).toMatch(WIXSTATIC_URL_PATTERN);
    expect(url).toContain('w_600,h_400');
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
    expect(images[0]).toContain('static.wixstatic.com');
  });

  it('all images are 800x800 wixstatic URLs', () => {
    const images = getPlaceholderProductImages('platform-beds', 4);
    for (const url of images) {
      expect(url).toContain('w_800');
      expect(url).toContain('h_800');
      expect(url).toContain('static.wixstatic.com');
    }
  });

  it.each(ALL_CATEGORIES)('returns valid wixstatic product images for %s', (cat) => {
    const images = getPlaceholderProductImages(cat, 4);
    expect(images.length).toBe(4);
    for (const url of images) {
      expect(url).toMatch(WIXSTATIC_URL_PATTERN);
      expect(url).toContain('w_800,h_800');
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
    expect(url).toContain('static.wixstatic.com');
    expect(url).toContain('800');
  });

  it('returns generic fallback when no category', () => {
    const url = getProductFallbackImage();
    expect(url).toContain('static.wixstatic.com');
  });

  it('returns generic fallback for unknown category', () => {
    const url = getProductFallbackImage('nonexistent');
    expect(url).toContain('static.wixstatic.com');
  });

  it.each(ALL_CATEGORIES)('returns valid fallback for %s', (cat) => {
    const url = getProductFallbackImage(cat);
    expect(url).toMatch(WIXSTATIC_URL_PATTERN);
    expect(url).toContain('w_800,h_800');
  });
});

// ── getGridThumbnail ─────────────────────────────────────────────

describe('getGridThumbnail', () => {
  it('converts 800x800 wixstatic to 400x400', () => {
    const source = 'https://static.wixstatic.com/media/e04e89_bd61c37885e04934b0d219eb23c5d36f~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg';
    const thumb = getGridThumbnail(source);
    expect(thumb).toContain('w_400');
    expect(thumb).toContain('h_400');
    expect(thumb).not.toContain('w_800');
  });

  it('returns fallback for null input', () => {
    const thumb = getGridThumbnail(null);
    expect(thumb).toContain('w_400');
    expect(thumb).toContain('h_400');
  });

  it('handles Unsplash URLs for backwards compatibility', () => {
    const source = 'https://images.unsplash.com/photo-123?w=800&h=800&fit=crop';
    const thumb = getGridThumbnail(source);
    expect(thumb).toContain('w=400');
    expect(thumb).toContain('h=400');
  });

  it.each(ALL_CATEGORIES)('converts product images to grid size for %s', (cat) => {
    const images = getPlaceholderProductImages(cat, 2);
    for (const url of images) {
      const thumb = getGridThumbnail(url);
      expect(thumb).toContain('w_400');
      expect(thumb).not.toContain('w_800');
    }
  });
});

// ── getGalleryThumbnail ──────────────────────────────────────────

describe('getGalleryThumbnail', () => {
  it('converts 800x800 wixstatic to 100x100', () => {
    const source = 'https://static.wixstatic.com/media/e04e89_bd61c37885e04934b0d219eb23c5d36f~mv2.jpg/v1/fit/w_800,h_800,q_90/file.jpg';
    const thumb = getGalleryThumbnail(source);
    expect(thumb).toContain('w_100');
    expect(thumb).toContain('h_100');
  });

  it('returns fallback for null input', () => {
    const thumb = getGalleryThumbnail(null);
    expect(thumb).toContain('w_100');
    expect(thumb).toContain('h_100');
  });

  it('handles Unsplash URLs for backwards compatibility', () => {
    const source = 'https://images.unsplash.com/photo-123?w=800&h=800&fit=crop';
    const thumb = getGalleryThumbnail(source);
    expect(thumb).toContain('w=100');
    expect(thumb).toContain('h=100');
  });

  it.each(ALL_CATEGORIES)('converts product images to gallery thumbnail for %s', (cat) => {
    const images = getPlaceholderProductImages(cat, 2);
    for (const url of images) {
      const thumb = getGalleryThumbnail(url);
      expect(thumb).toContain('w_100');
      expect(thumb).not.toContain('w_800');
    }
  });
});

// ── getHomepageHeroImage ─────────────────────────────────────────

describe('getHomepageHeroImage', () => {
  it('returns a valid Wix CDN URL', () => {
    const url = getHomepageHeroImage();
    expect(url).toMatch(WIXSTATIC_URL_PATTERN);
  });

  it('returns 1920x800 dimensions', () => {
    const url = getHomepageHeroImage();
    expect(url).toContain('w_1920,h_800');
  });
});

// ── Alt text helpers ─────────────────────────────────────────────

describe('getHomepageHeroAlt', () => {
  it('returns descriptive alt text', () => {
    const alt = getHomepageHeroAlt();
    expect(typeof alt).toBe('string');
    expect(alt.length).toBeGreaterThan(10);
  });

  it('includes brand name for SEO', () => {
    const alt = getHomepageHeroAlt();
    expect(alt).toContain('Carolina Futons');
  });

  it('describes the scene content', () => {
    const alt = getHomepageHeroAlt();
    expect(alt.toLowerCase()).toMatch(/cabin|mountain|living room|cozy/);
  });
});

describe('getCategoryHeroAlt', () => {
  it.each(ALL_CATEGORIES)('returns non-empty alt text for %s', (cat) => {
    const alt = getCategoryHeroAlt(cat);
    expect(typeof alt).toBe('string');
    expect(alt.length).toBeGreaterThan(10);
  });

  it('returns fallback alt for unknown category', () => {
    const alt = getCategoryHeroAlt('nonexistent');
    expect(typeof alt).toBe('string');
    expect(alt.length).toBeGreaterThan(5);
  });

  it('all 7 categories have unique alt text', () => {
    const alts = ALL_CATEGORIES.map(getCategoryHeroAlt);
    expect(new Set(alts).size).toBe(7);
  });

  it('futon-frames alt mentions futon or living room', () => {
    const alt = getCategoryHeroAlt('futon-frames');
    expect(alt.toLowerCase()).toMatch(/futon|living room/);
  });

  it('mattresses alt mentions bedroom or mattress', () => {
    const alt = getCategoryHeroAlt('mattresses');
    expect(alt.toLowerCase()).toMatch(/bedroom|mattress/);
  });
});

describe('getCategoryCardAlt', () => {
  it.each(ALL_CATEGORIES)('returns non-empty alt text for %s', (cat) => {
    const alt = getCategoryCardAlt(cat);
    expect(typeof alt).toBe('string');
    expect(alt.length).toBeGreaterThan(10);
  });

  it('returns fallback alt for unknown category', () => {
    const alt = getCategoryCardAlt('nonexistent');
    expect(typeof alt).toBe('string');
    expect(alt.length).toBeGreaterThan(5);
  });

  it('sales category has card alt text', () => {
    const alt = getCategoryCardAlt('sales');
    expect(typeof alt).toBe('string');
    expect(alt.length).toBeGreaterThan(5);
  });

  it('all 7 categories have unique card alt text', () => {
    const alts = ALL_CATEGORIES.map(getCategoryCardAlt);
    expect(new Set(alts).size).toBe(7);
  });
});
