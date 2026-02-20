import { describe, it, expect } from 'vitest';
import {
  getCategoryHeroImage,
  getCategoryCardImage,
  getPlaceholderProductImages,
  getProductFallbackImage,
  getGridThumbnail,
  getGalleryThumbnail,
} from '../src/public/placeholderImages.js';

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
});

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
});

describe('getPlaceholderProductImages', () => {
  it('returns requested number of images', () => {
    const images = getPlaceholderProductImages('futon-frames', 3);
    expect(images).toHaveLength(3);
  });

  it('cycles images when count exceeds available', () => {
    const images = getPlaceholderProductImages('murphy-cabinet-beds', 8);
    expect(images).toHaveLength(8);
    // Should cycle: image[4] === image[0] (only 4 murphy images)
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
});

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
});

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
});

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
});
