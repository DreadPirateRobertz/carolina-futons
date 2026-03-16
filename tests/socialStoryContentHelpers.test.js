/**
 * CF-6s2m — Tests for social story platform-specific formatting and
 * template variety (product spotlight, new arrival, seasonal, testimonial).
 * All product data from catalog-MASTER.json.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PLATFORM_SPECS,
  formatForPlatform,
  buildProductSpotlight,
  buildNewArrivalStory,
  buildSeasonalPromo,
  buildTestimonialStory,
  buildTemplateData,
  STORY_TYPES,
} from '../src/public/socialStoryHelpers.js';

const catalog = JSON.parse(
  readFileSync(resolve(__dirname, '../content/catalog-MASTER.json'), 'utf-8')
);
const products = catalog.products;
const monterey = products.find(p => p.name === 'Monterey Futon Frame');
const sunrise = products.find(p => p.name === 'Sunrise Futon Frame');

// ── PLATFORM_SPECS ──────────────────────────────────────────────────

describe('PLATFORM_SPECS', () => {
  it('defines instagram and facebook platforms', () => {
    expect(PLATFORM_SPECS.instagram).toBeDefined();
    expect(PLATFORM_SPECS.facebook).toBeDefined();
  });

  it('both platforms use 9:16 aspect ratio', () => {
    expect(PLATFORM_SPECS.instagram.aspectRatio).toBe('9:16');
    expect(PLATFORM_SPECS.facebook.aspectRatio).toBe('9:16');
  });

  it('both platforms are 1080x1920', () => {
    for (const platform of ['instagram', 'facebook']) {
      expect(PLATFORM_SPECS[platform].width).toBe(1080);
      expect(PLATFORM_SPECS[platform].height).toBe(1920);
    }
  });

  it('instagram has longer caption limit than facebook', () => {
    expect(PLATFORM_SPECS.instagram.maxCaptionLength).toBeGreaterThan(
      PLATFORM_SPECS.facebook.maxCaptionLength
    );
  });

  it('defines safe zones for text overlay', () => {
    for (const platform of ['instagram', 'facebook']) {
      const spec = PLATFORM_SPECS[platform];
      expect(spec.safeZone.top).toBeGreaterThan(0);
      expect(spec.safeZone.bottom).toBeGreaterThan(0);
    }
  });

  it('instagram supports swipe-up, facebook does not', () => {
    expect(PLATFORM_SPECS.instagram.supportsSwipeUp).toBe(true);
    expect(PLATFORM_SPECS.facebook.supportsSwipeUp).toBe(false);
  });
});

// ── formatForPlatform ───────────────────────────────────────────────

describe('formatForPlatform', () => {
  const template = buildTemplateData(STORY_TYPES.NEW_ARRIVAL, {
    productName: 'Test Product',
    price: '$100',
  });

  it('returns null for null template', () => {
    expect(formatForPlatform(null, 'instagram')).toBeNull();
  });

  it('returns null for null platform', () => {
    expect(formatForPlatform(template, null)).toBeNull();
  });

  it('returns null for unknown platform', () => {
    expect(formatForPlatform(template, 'tiktok')).toBeNull();
  });

  it('sets platform-specific dimensions', () => {
    const ig = formatForPlatform(template, 'instagram');
    expect(ig.width).toBe(1080);
    expect(ig.height).toBe(1920);
    expect(ig.platform).toBe('instagram');
    expect(ig.aspectRatio).toBe('9:16');
  });

  it('includes safe zone and CTA placement', () => {
    const fb = formatForPlatform(template, 'facebook');
    expect(fb.safeZone).toEqual(PLATFORM_SPECS.facebook.safeZone);
    expect(fb.ctaPlacement).toBe('bottom-center');
  });

  it('truncates caption to platform max length', () => {
    const longCaption = 'A'.repeat(3000);
    const data = { ...template, caption: longCaption };

    const ig = formatForPlatform(data, 'instagram');
    expect(ig.caption.length).toBeLessThanOrEqual(2200);

    const fb = formatForPlatform(data, 'facebook');
    expect(fb.caption.length).toBeLessThanOrEqual(500);
  });

  it('preserves original template fields', () => {
    const ig = formatForPlatform(template, 'instagram');
    expect(ig.type).toBe(STORY_TYPES.NEW_ARRIVAL);
    expect(ig.brandName).toBe('Carolina Futons');
    expect(ig.productName).toBe('Test Product');
  });

  it('includes text overlay settings', () => {
    const ig = formatForPlatform(template, 'instagram');
    expect(ig.textOverlay.maxLines).toBe(4);
    expect(ig.textOverlay.fontSize).toBe(48);
  });
});

// ── buildProductSpotlight ───────────────────────────────────────────

describe('buildProductSpotlight', () => {
  it('returns null for null product', () => {
    expect(buildProductSpotlight(null)).toBeNull();
  });

  it('returns null for product without name', () => {
    expect(buildProductSpotlight({ price: 100 })).toBeNull();
  });

  it('builds spotlight from real catalog product', () => {
    const story = buildProductSpotlight(monterey);
    expect(story).not.toBeNull();
    expect(story.productName).toBe('Monterey Futon Frame');
    expect(story.caption).toContain('Monterey Futon Frame');
    expect(story.caption).toContain('$549.00');
    expect(story.templateVariant).toBe('product_spotlight');
  });

  it('defaults to instagram platform', () => {
    const story = buildProductSpotlight(monterey);
    expect(story.platform).toBe('instagram');
  });

  it('can target facebook platform', () => {
    const story = buildProductSpotlight(monterey, 'facebook');
    expect(story.platform).toBe('facebook');
    expect(story.caption.length).toBeLessThanOrEqual(500);
  });

  it('includes product image URL from catalog', () => {
    const story = buildProductSpotlight(monterey);
    expect(story.imageUrl).toBe(monterey.images[0]);
  });

  it('includes shop CTA in caption', () => {
    const story = buildProductSpotlight(monterey);
    expect(story.caption).toContain('carolinafutons.com');
  });

  it('handles product without price', () => {
    const noPrice = { name: 'Test Item', slug: 'test', images: ['img.jpg'] };
    const story = buildProductSpotlight(noPrice);
    expect(story).not.toBeNull();
    expect(story.caption).not.toContain('Starting at');
  });

  it('handles product without description', () => {
    const minimal = { name: 'Minimal', price: 99, slug: 'min' };
    const story = buildProductSpotlight(minimal);
    expect(story).not.toBeNull();
    expect(story.caption).toContain('Minimal');
  });

  it('truncates long descriptions in caption', () => {
    const longDesc = { name: 'Long', price: 50, description: 'X'.repeat(300) };
    const story = buildProductSpotlight(longDesc);
    // Description portion should be truncated to 120 chars
    expect(story.caption.length).toBeLessThan(300);
  });
});

// ── buildNewArrivalStory ────────────────────────────────────────────

describe('buildNewArrivalStory', () => {
  it('returns null for null product', () => {
    expect(buildNewArrivalStory(null)).toBeNull();
  });

  it('builds new arrival from real catalog product', () => {
    const story = buildNewArrivalStory(sunrise);
    expect(story).not.toBeNull();
    expect(story.productName).toBe('Sunrise Futon Frame');
    expect(story.caption).toContain('JUST IN');
    expect(story.caption).toContain('Sunrise Futon Frame');
    expect(story.templateVariant).toBe('new_arrival');
  });

  it('includes price in caption', () => {
    const story = buildNewArrivalStory(sunrise);
    expect(story.caption).toContain(`$${Number(sunrise.price).toFixed(2)}`);
  });

  it('formats for facebook with shorter caption', () => {
    const story = buildNewArrivalStory(sunrise, 'facebook');
    expect(story.platform).toBe('facebook');
    expect(story.caption.length).toBeLessThanOrEqual(500);
  });

  it('uses real product images', () => {
    const story = buildNewArrivalStory(monterey);
    expect(story.imageUrl).toBe(monterey.images[0]);
  });
});

// ── buildSeasonalPromo ──────────────────────────────────────────────

describe('buildSeasonalPromo', () => {
  it('returns null for null params', () => {
    expect(buildSeasonalPromo(null)).toBeNull();
  });

  it('returns null without seasonName', () => {
    expect(buildSeasonalPromo({ promoText: 'Sale!' })).toBeNull();
  });

  it('builds seasonal promo with real catalog products', () => {
    const story = buildSeasonalPromo({
      seasonName: 'Spring Sale',
      promoText: 'Up to 30% off select frames',
      promoCode: 'SPRING30',
      featuredProducts: [monterey, sunrise],
    });

    expect(story).not.toBeNull();
    expect(story.caption).toContain('Spring Sale');
    expect(story.caption).toContain('Up to 30% off');
    expect(story.caption).toContain('SPRING30');
    expect(story.caption).toContain('Monterey Futon Frame');
    expect(story.caption).toContain('Sunrise Futon Frame');
    expect(story.templateVariant).toBe('seasonal_promo');
  });

  it('caps featured products at 3', () => {
    const many = products.slice(0, 5);
    const story = buildSeasonalPromo({
      seasonName: 'Big Sale',
      featuredProducts: many,
    });
    expect(story.featuredProducts.length).toBeLessThanOrEqual(3);
  });

  it('includes promo code when provided', () => {
    const story = buildSeasonalPromo({
      seasonName: 'Summer',
      promoCode: 'SAVE20',
    });
    expect(story.promoCode).toBe('SAVE20');
    expect(story.caption).toContain('SAVE20');
  });

  it('works without featured products', () => {
    const story = buildSeasonalPromo({
      seasonName: 'Fall Clearance',
      promoText: 'Everything must go',
    });
    expect(story).not.toBeNull();
    expect(story.caption).toContain('Fall Clearance');
  });

  it('formats for facebook', () => {
    const story = buildSeasonalPromo(
      { seasonName: 'Winter Sale' },
      'facebook'
    );
    expect(story.platform).toBe('facebook');
  });
});

// ── buildTestimonialStory ───────────────────────────────────────────

describe('buildTestimonialStory', () => {
  it('returns null for null params', () => {
    expect(buildTestimonialStory(null)).toBeNull();
  });

  it('returns null without customerName', () => {
    expect(buildTestimonialStory({ quote: 'Great!' })).toBeNull();
  });

  it('returns null without quote', () => {
    expect(buildTestimonialStory({ customerName: 'Jane' })).toBeNull();
  });

  it('builds testimonial with real product reference', () => {
    const story = buildTestimonialStory({
      customerName: 'Sarah',
      quote: 'Best futon frame we ever bought!',
      rating: 5,
      product: monterey,
    });

    expect(story).not.toBeNull();
    expect(story.caption).toContain('Sarah');
    expect(story.caption).toContain('Best futon frame');
    expect(story.caption).toContain('Monterey Futon Frame');
    expect(story.caption).toContain('★★★★★');
    expect(story.templateVariant).toBe('testimonial');
  });

  it('defaults to 5-star rating', () => {
    const story = buildTestimonialStory({
      customerName: 'Bob',
      quote: 'Love it!',
    });
    expect(story.caption).toContain('★★★★★');
    expect(story.rating).toBe(5);
  });

  it('clamps rating to 1-5 range', () => {
    const low = buildTestimonialStory({
      customerName: 'Jane',
      quote: 'OK',
      rating: 0,
    });
    expect(low.caption).toContain('★'); // At least 1 star

    const high = buildTestimonialStory({
      customerName: 'Jane',
      quote: 'Amazing',
      rating: 10,
    });
    expect(high.caption).toMatch(/★{5}/); // Max 5 stars
  });

  it('works without product reference', () => {
    const story = buildTestimonialStory({
      customerName: 'Tom',
      quote: 'Excellent service',
    });
    expect(story).not.toBeNull();
    expect(story.caption).not.toContain('About:');
  });

  it('truncates long quotes', () => {
    const story = buildTestimonialStory({
      customerName: 'Kim',
      quote: 'X'.repeat(500),
    });
    // Quote in caption should be truncated to 200
    expect(story.caption).toContain('"' + 'X'.repeat(200) + '"');
  });

  it('formats for facebook', () => {
    const story = buildTestimonialStory(
      { customerName: 'Dan', quote: 'Great!' },
      'facebook'
    );
    expect(story.platform).toBe('facebook');
    expect(story.caption.length).toBeLessThanOrEqual(500);
  });
});

// ── Cross-platform comparison ───────────────────────────────────────

describe('Platform comparison — same product, different platforms', () => {
  it('instagram and facebook produce different safe zones', () => {
    const ig = buildProductSpotlight(monterey, 'instagram');
    const fb = buildProductSpotlight(monterey, 'facebook');

    expect(ig.safeZone.top).not.toBe(fb.safeZone.top);
    expect(ig.textOverlay.maxLines).not.toBe(fb.textOverlay.maxLines);
  });

  it('same product name appears on both platforms', () => {
    const ig = buildProductSpotlight(monterey, 'instagram');
    const fb = buildProductSpotlight(monterey, 'facebook');

    expect(ig.productName).toBe(monterey.name);
    expect(fb.productName).toBe(monterey.name);
  });
});

// ── Catalog data integrity ──────────────────────────────────────────

describe('Catalog data integrity in story templates', () => {
  it('product spotlight uses only names from catalog-MASTER.json', () => {
    const allNames = new Set(products.map(p => p.name));
    for (const product of products.slice(0, 5)) {
      if (!product.name) continue;
      const story = buildProductSpotlight(product);
      if (story) {
        expect(allNames.has(story.productName)).toBe(true);
      }
    }
  });

  it('seasonal promo uses real prices from catalog', () => {
    const featured = products.filter(p => p.price != null).slice(0, 3);
    const story = buildSeasonalPromo({
      seasonName: 'Test Sale',
      featuredProducts: featured,
    });

    for (const p of featured) {
      expect(story.caption).toContain(`$${Number(p.price).toFixed(2)}`);
    }
  });

  it('new arrival uses real image URLs from catalog', () => {
    const withImages = products.filter(p => p.images?.length > 0);
    const story = buildNewArrivalStory(withImages[0]);
    expect(story.imageUrl).toBe(withImages[0].images[0]);
  });
});
