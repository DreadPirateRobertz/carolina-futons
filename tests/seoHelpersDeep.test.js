/**
 * Deep coverage tests for seoHelpers.web.js — sanitization edge cases,
 * XSS in meta tags, null/undefined product fields, schema boundary conditions,
 * and alt text truncation.
 */
import { describe, it, expect } from 'vitest';
import {
  getProductSchema,
  getBusinessSchema,
  getBreadcrumbSchema,
  getFaqSchema,
  getProductFaqSchema,
  generateAltText,
  getWebSiteSchema,
  getCollectionSchema,
  getCategoryMetaDescription,
  getProductOgTags,
  getCategoryOgTags,
  getProductMetaTags,
  getCategoryMetaTags,
  getBlogArticleSchema,
  getBlogFaqSchema,
  getPageTitle,
  getCanonicalUrl,
  getPageMetaDescription,
} from '../src/backend/seoHelpers.web.js';

// ── getProductSchema — edge cases ────────────────────────────────────

describe('getProductSchema — edge cases', () => {
  it('returns null for null product', () => {
    expect(getProductSchema(null)).toBeNull();
  });

  it('returns null for undefined product', () => {
    expect(getProductSchema(undefined)).toBeNull();
  });

  it('returns null for non-object product (string)', () => {
    expect(getProductSchema('not-a-product')).toBeNull();
  });

  it('returns null for non-object product (number)', () => {
    expect(getProductSchema(42)).toBeNull();
  });

  it('handles product with no name', () => {
    const schema = JSON.parse(getProductSchema({ slug: 'test' }));
    expect(schema.name).toBe('');
  });

  it('handles product with no slug', () => {
    const schema = JSON.parse(getProductSchema({ name: 'Test Product' }));
    expect(schema.url).toContain('/product-page/');
  });

  it('sanitizes HTML entities in product name for JSON-LD', () => {
    const schema = JSON.parse(getProductSchema({ name: 'Frame <script>alert("xss")</script>' }));
    expect(schema.name).not.toContain('<script>');
    expect(schema.name).toContain('\\u003c');
  });

  it('sanitizes HTML entities in product description', () => {
    const schema = JSON.parse(getProductSchema({
      name: 'Test',
      description: '<p>Great product & <b>bold</b> features</p>',
    }));
    // Description should have HTML stripped then sanitized
    expect(schema.description).not.toContain('<p>');
    expect(schema.description).not.toContain('<b>');
  });

  it('handles product with no collections (defaults to Furniture category)', () => {
    const schema = JSON.parse(getProductSchema({ name: 'Bare Product' }));
    expect(schema.category).toBe('Furniture');
  });

  it('handles product with inStock=undefined (defaults to InStock)', () => {
    const schema = JSON.parse(getProductSchema({ name: 'Test', price: 100 }));
    expect(schema.offers.availability).toBe('https://schema.org/InStock');
  });

  it('includes weight when product has weight', () => {
    const schema = JSON.parse(getProductSchema({ name: 'Heavy Frame', weight: 75 }));
    expect(schema.weight).toBeDefined();
    expect(schema.weight.value).toBe(75);
    expect(schema.weight.unitCode).toBe('LBR');
  });

  it('omits weight when product has no weight', () => {
    const schema = JSON.parse(getProductSchema({ name: 'Light Product' }));
    expect(schema.weight).toBeUndefined();
  });

  it('omits aggregateRating when numericRating is 0', () => {
    const schema = JSON.parse(getProductSchema({ name: 'Unrated', numericRating: 0 }));
    expect(schema.aggregateRating).toBeUndefined();
  });

  it('omits aggregateRating when numericRating is negative', () => {
    const schema = JSON.parse(getProductSchema({ name: 'Bad', numericRating: -1 }));
    expect(schema.aggregateRating).toBeUndefined();
  });

  it('defaults numReviews to 1 when rating exists but no review count', () => {
    const schema = JSON.parse(getProductSchema({ name: 'Rated', numericRating: 4.5 }));
    expect(schema.aggregateRating.reviewCount).toBe(1);
  });

  it('handles product with empty reviews array', () => {
    const schema = JSON.parse(getProductSchema({ name: 'No Reviews', reviews: [] }));
    expect(schema.review).toBeUndefined();
  });

  it('handles review with no author (defaults to Verified Customer)', () => {
    const schema = JSON.parse(getProductSchema({
      name: 'Reviewed',
      reviews: [{ rating: 5, body: 'Great!' }],
    }));
    expect(schema.review[0].author.name).toBe('Verified Customer');
  });

  it('includes review body with HTML stripped', () => {
    const schema = JSON.parse(getProductSchema({
      name: 'Reviewed',
      reviews: [{ rating: 5, body: '<p>Best futon <b>ever</b>!</p>', author: 'Jane' }],
    }));
    expect(schema.review[0].reviewBody).toBe('Best futon ever!');
  });

  it('builds image array from mainMedia and mediaItems', () => {
    const schema = JSON.parse(getProductSchema({
      name: 'Multi Image',
      mainMedia: 'main.jpg',
      mediaItems: [{ src: 'side.jpg' }, { src: 'back.jpg' }],
    }));
    expect(schema.image).toContain('main.jpg');
    expect(schema.image).toContain('side.jpg');
    expect(schema.image).toContain('back.jpg');
  });

  it('normalizes wix:image:// URIs in mediaItems to static.wixstatic.com URLs', () => {
    const schema = JSON.parse(getProductSchema({
      name: 'Wix Image Gallery',
      mainMedia: 'wix:image://v1/main_abc.jpg/photo.jpg#originWidth=1200',
      mediaItems: [
        { src: 'wix:image://v1/side_def.jpg/side.jpg#w=800' },
        { src: 'wix:image://v1/back_ghi.jpg/back.jpg#w=800' },
      ],
    }));
    expect(schema.image).toContain('https://static.wixstatic.com/media/main_abc.jpg');
    expect(schema.image).toContain('https://static.wixstatic.com/media/side_def.jpg');
    expect(schema.image).toContain('https://static.wixstatic.com/media/back_ghi.jpg');
    // no raw wix:image:// URIs should leak into the schema
    expect(schema.image.some(i => typeof i === 'string' && i.startsWith('wix:image:'))).toBe(false);
  });

  it('deduplicates mainMedia in image array', () => {
    const schema = JSON.parse(getProductSchema({
      name: 'Dupe Image',
      mainMedia: 'main.jpg',
      mediaItems: [{ src: 'main.jpg' }, { src: 'other.jpg' }],
    }));
    const mainCount = schema.image.filter(i => i === 'main.jpg').length;
    expect(mainCount).toBe(1);
  });

  it('handles product with size option — adds additionalProperty', () => {
    const schema = JSON.parse(getProductSchema({
      name: 'Sized Frame',
      options: { size: 'Queen' },
    }));
    expect(schema.size).toBe('Queen');
    expect(schema.additionalProperty[0].value).toBe('Queen');
  });

  it('includes priceValidUntil in offers', () => {
    const schema = JSON.parse(getProductSchema({ name: 'Test', price: 100 }));
    expect(schema.offers.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── generateAltText — edge cases ──────────────────────────────────────

describe('generateAltText — edge cases', () => {
  it('returns empty for null product', () => {
    expect(generateAltText(null)).toBe('');
  });

  it('returns empty for undefined product', () => {
    expect(generateAltText(undefined)).toBe('');
  });

  it('truncates alt text to 125 characters', () => {
    const alt = generateAltText({
      name: 'Super Long Product Name That Goes On And On And On And On Forever',
      collections: ['futon-frames'],
      options: { finish: 'Natural Oak', size: 'Queen' },
    }, 'main');
    expect(alt.length).toBeLessThanOrEqual(125);
  });

  it('ends truncated alt with ellipsis', () => {
    const alt = generateAltText({
      name: 'A'.repeat(150),
    }, 'main');
    expect(alt).toMatch(/\.\.\.$/);
    expect(alt.length).toBe(125);
  });

  it('defaults imageType to main', () => {
    const alt = generateAltText({ name: 'Test Frame' });
    expect(alt).toContain('Carolina Futons');
  });

  it('generates lifestyle alt text', () => {
    const alt = generateAltText({ name: 'Eureka', collections: ['futon-frames'] }, 'lifestyle');
    expect(alt).toContain('living room');
  });

  it('generates detail alt text with finish', () => {
    const alt = generateAltText({
      name: 'Eureka',
      options: { finish: 'Walnut' },
    }, 'detail');
    expect(alt).toContain('Walnut finish');
  });

  it('generates detail alt text without finish', () => {
    const alt = generateAltText({ name: 'Eureka' }, 'detail');
    expect(alt).toContain('construction');
  });

  it('generates open position alt text', () => {
    const alt = generateAltText({ name: 'Murphy', collections: ['murphy-cabinet-beds'] }, 'open');
    expect(alt).toContain('open bed position');
  });

  it('generates sofa position alt text', () => {
    const alt = generateAltText({ name: 'Eureka', collections: ['futon-frames'] }, 'sofa');
    expect(alt).toContain('sofa position');
  });

  it('generates gallery alt text', () => {
    const alt = generateAltText({ name: 'Eureka', collections: ['futon-frames'] }, 'gallery');
    expect(alt).toContain('additional view');
  });

  it('generates grid alt text', () => {
    const alt = generateAltText({ name: 'Eureka' }, 'grid');
    expect(alt).toContain('Carolina Futons');
  });

  it('falls back to generic alt for unknown imageType', () => {
    const alt = generateAltText({ name: 'Eureka' }, 'panorama');
    expect(alt).toContain('Carolina Futons');
    expect(alt).toContain('Eureka');
  });
});

// ── getBreadcrumbSchema — edge cases ─────────────────────────────────

describe('getBreadcrumbSchema — edge cases', () => {
  it('returns null for null input', () => {
    expect(getBreadcrumbSchema(null)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getBreadcrumbSchema([])).toBeNull();
  });

  it('last breadcrumb item omits URL per Google guidelines', () => {
    const schema = JSON.parse(getBreadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Futon Frames', url: '/futon-frames' },
      { name: 'Eureka Frame' },
    ]));
    const items = schema.itemListElement;
    expect(items[0].item).toContain('/');
    expect(items[1].item).toContain('/futon-frames');
    expect(items[2].item).toBeUndefined();
  });

  it('single breadcrumb has no URL (it is the last item)', () => {
    const schema = JSON.parse(getBreadcrumbSchema([{ name: 'Home', url: '/' }]));
    expect(schema.itemListElement[0].item).toBeUndefined();
  });

  it('positions are 1-indexed', () => {
    const schema = JSON.parse(getBreadcrumbSchema([
      { name: 'A' }, { name: 'B' }, { name: 'C' },
    ]));
    expect(schema.itemListElement[0].position).toBe(1);
    expect(schema.itemListElement[2].position).toBe(3);
  });
});

// ── getFaqSchema — edge cases ────────────────────────────────────────

describe('getFaqSchema — edge cases', () => {
  it('returns null for null input', () => {
    expect(getFaqSchema(null)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(getFaqSchema([])).toBeNull();
  });

  it('preserves question and answer text exactly', () => {
    const faqs = [{ question: 'Q1?', answer: 'A1.' }];
    const schema = JSON.parse(getFaqSchema(faqs));
    expect(schema.mainEntity[0].name).toBe('Q1?');
    expect(schema.mainEntity[0].acceptedAnswer.text).toBe('A1.');
  });
});

// ── getProductFaqSchema — category-specific questions ────────────────

describe('getProductFaqSchema — edge cases', () => {
  it('returns null for null product', () => {
    expect(getProductFaqSchema(null)).toBeNull();
  });

  it('generates Murphy-specific questions for Murphy bed products', () => {
    const schema = JSON.parse(getProductFaqSchema({
      name: 'Daisy Cabinet Bed',
      collections: ['murphy-cabinet-beds'],
    }));
    const questions = schema.mainEntity.map(q => q.name);
    expect(questions.some(q => q.includes('wall'))).toBe(true);
  });

  it('generates mattress-specific questions for mattress products', () => {
    const schema = JSON.parse(getProductFaqSchema({
      name: 'Haley 110',
      collections: ['mattresses'],
    }));
    const questions = schema.mainEntity.map(q => q.name);
    expect(questions.some(q => q.includes('last') || q.includes('hypoallergenic'))).toBe(true);
  });

  it('generates platform-specific questions', () => {
    const schema = JSON.parse(getProductFaqSchema({
      name: 'Rosemary Platform',
      collections: ['platform-beds'],
    }));
    const questions = schema.mainEntity.map(q => q.name);
    expect(questions.some(q => q.includes('box spring'))).toBe(true);
  });

  it('always includes return policy and shipping questions', () => {
    const schema = JSON.parse(getProductFaqSchema({
      name: 'Generic Product',
      collections: ['other'],
    }));
    const questions = schema.mainEntity.map(q => q.name);
    expect(questions.some(q => q.includes('return policy'))).toBe(true);
    expect(questions.some(q => q.includes('shipping'))).toBe(true);
    expect(questions.some(q => q.includes('delivery'))).toBe(true);
  });

  it('product with no collections gets generic FAQ', () => {
    const schema = JSON.parse(getProductFaqSchema({ name: 'Widget' }));
    expect(schema.mainEntity.length).toBeGreaterThanOrEqual(3); // return, shipping, delivery
  });
});

// ── getCollectionSchema — edge cases ─────────────────────────────────

describe('getCollectionSchema — edge cases', () => {
  it('returns null for null categoryInfo', () => {
    expect(getCollectionSchema(null, [{ name: 'P1' }])).toBeNull();
  });

  it('returns null for null products', () => {
    expect(getCollectionSchema({ slug: 'test', title: 'Test' }, null)).toBeNull();
  });

  it('returns null for empty products array', () => {
    expect(getCollectionSchema({ slug: 'test', title: 'Test' }, [])).toBeNull();
  });

  it('limits product list to 30 items', () => {
    const products = Array.from({ length: 50 }, (_, i) => ({
      name: `Product ${i}`, slug: `prod-${i}`,
    }));
    const schema = JSON.parse(getCollectionSchema({ slug: 'test', title: 'Test' }, products));
    expect(schema.mainEntity.itemListElement).toHaveLength(30);
    expect(schema.mainEntity.numberOfItems).toBe(50);
  });

  it('uses default description when categoryInfo has no description', () => {
    const schema = JSON.parse(getCollectionSchema(
      { slug: 'test', title: 'Test Category' },
      [{ name: 'P1', slug: 'p1' }],
    ));
    expect(schema.description).toContain('Shop Test Category');
  });
});

// ── getProductOgTags — edge cases ────────────────────────────────────

describe('getProductOgTags — edge cases', () => {
  it('returns empty string for null product', () => {
    expect(getProductOgTags(null)).toBe('');
  });

  it('handles product with no description', () => {
    const tags = JSON.parse(getProductOgTags({ name: 'Test', slug: 'test' }));
    expect(tags['og:description']).toContain('Shop Test');
  });

  it('truncates description to 200 chars', () => {
    const tags = JSON.parse(getProductOgTags({
      name: 'Test',
      description: 'x'.repeat(300),
    }));
    expect(tags['og:description'].length).toBeLessThanOrEqual(200);
  });

  it('strips HTML from description in OG tags', () => {
    const tags = JSON.parse(getProductOgTags({
      name: 'Test',
      description: '<p>Great <b>product</b></p>',
    }));
    expect(tags['og:description']).not.toContain('<p>');
    expect(tags['og:description']).not.toContain('<b>');
  });

  it('uses empty string for missing mainMedia', () => {
    const tags = JSON.parse(getProductOgTags({ name: 'Test' }));
    expect(tags['og:image']).toBe('');
  });

  // ── CF-94s: og:image must resolve to an absolute CDN URL ──────────
  // Wix Stores products can expose mainMedia as a `wix:image://v1/<id>`
  // URI. Crawlers (Google / Facebook / Pinterest) cannot resolve that
  // scheme, so og:image must be normalized to https://static.wixstatic...

  it('converts wix:image:// mainMedia to https CDN URL for og:image', () => {
    const tags = JSON.parse(getProductOgTags({
      name: 'Trail Futon',
      slug: 'trail-futon',
      mainMedia: 'wix:image://v1/abc123_def/original.jpg#w=800',
    }));
    expect(tags['og:image']).toMatch(/^https:\/\/static\.wixstatic\.com\/media\//);
    expect(tags['og:image']).toContain('abc123_def');
    expect(tags['og:image']).not.toContain('wix:image');
  });

  it('mirrors the CDN-normalized image on twitter:image', () => {
    const tags = JSON.parse(getProductOgTags({
      name: 'Trail Futon',
      slug: 'trail-futon',
      mainMedia: 'wix:image://v1/abc123_def/original.jpg',
    }));
    expect(tags['twitter:image']).toBe(tags['og:image']);
    expect(tags['twitter:image']).toMatch(/^https:\/\/static\.wixstatic\.com\/media\//);
  });

  it('passes through an already-absolute https mainMedia untouched', () => {
    const https = 'https://example.com/eureka.jpg';
    const tags = JSON.parse(getProductOgTags({
      name: 'Eureka',
      slug: 'eureka',
      mainMedia: https,
    }));
    expect(tags['og:image']).toBe(https);
    expect(tags['twitter:image']).toBe(https);
  });
});

// ── getProductMetaTags — HTML meta tags ──────────────────────────────

describe('getProductMetaTags — edge cases', () => {
  it('returns empty string for null product', async () => {
    expect(await getProductMetaTags(null)).toBe('');
  });

  it('escapes double quotes in product name', async () => {
    const tags = await getProductMetaTags({ name: 'Frame "Deluxe"', slug: 'frame-deluxe' });
    expect(tags).toContain('&quot;');
    expect(tags).not.toContain('content="Frame "');
  });

  it('strips HTML tags from description', async () => {
    const tags = await getProductMetaTags({
      name: 'Test',
      description: '<script>alert("xss")</script>',
    });
    // HTML tags are stripped first by regex, then escapeAttr runs on the result
    expect(tags).not.toContain('<script>');
  });

  it('uses logo as fallback when no mainMedia', async () => {
    const tags = await getProductMetaTags({ name: 'Test', slug: 'test' });
    expect(tags).toContain('logo.png');
  });
});

// ── getBlogArticleSchema — edge cases ────────────────────────────────

describe('getBlogArticleSchema — edge cases', () => {
  it('returns null for null post', () => {
    expect(getBlogArticleSchema(null)).toBeNull();
  });

  it('returns null for post with no title', () => {
    expect(getBlogArticleSchema({ slug: 'test' })).toBeNull();
  });

  it('uses metaDescription when available', () => {
    const schema = JSON.parse(getBlogArticleSchema({
      title: 'Test Post',
      slug: 'test-post',
      metaDescription: 'Custom meta',
    }));
    expect(schema.description).toBe('Custom meta');
  });

  it('falls back to excerpt when no metaDescription', () => {
    const schema = JSON.parse(getBlogArticleSchema({
      title: 'Test Post',
      slug: 'test-post',
      excerpt: 'Short excerpt',
    }));
    expect(schema.description).toBe('Short excerpt');
  });

  it('includes coverImage when present', () => {
    const schema = JSON.parse(getBlogArticleSchema({
      title: 'Test Post',
      slug: 'test-post',
      coverImage: 'https://example.com/cover.jpg',
    }));
    expect(schema.image).toBe('https://example.com/cover.jpg');
  });

  it('omits image when no coverImage', () => {
    const schema = JSON.parse(getBlogArticleSchema({
      title: 'Test Post',
      slug: 'test-post',
    }));
    expect(schema.image).toBeUndefined();
  });

  it('joins keywords with comma separator', () => {
    const schema = JSON.parse(getBlogArticleSchema({
      title: 'Test',
      slug: 'test',
      keywords: ['futon', 'bed', 'furniture'],
    }));
    expect(schema.keywords).toBe('futon, bed, furniture');
  });

  it('omits keywords when empty array', () => {
    const schema = JSON.parse(getBlogArticleSchema({
      title: 'Test',
      slug: 'test',
      keywords: [],
    }));
    expect(schema.keywords).toBeUndefined();
  });
});

// ── getPageTitle — edge cases ────────────────────────────────────────

describe('getPageTitle — edge cases', () => {
  it('returns site name for unknown pageType', () => {
    expect(getPageTitle('nonexistent')).toBe('Carolina Futons');
  });

  it('returns site name when product has no name', () => {
    expect(getPageTitle('product', {})).toBe('Carolina Futons');
  });

  it('uses Shop fallback for unknown category slug', () => {
    expect(getPageTitle('category', { slug: 'unknown-category' })).toContain('Shop');
  });

  it('handles searchResults with query', () => {
    const title = getPageTitle('searchResults', { query: 'futon frame' });
    expect(title).toContain('futon frame');
  });

  it('handles searchResults without query', () => {
    const title = getPageTitle('searchResults', {});
    expect(title).toContain('Search Results');
  });

  it('handles blogPost with title', () => {
    expect(getPageTitle('blogPost', { title: 'My Post' })).toContain('My Post');
  });

  it('handles blogPost without title', () => {
    expect(getPageTitle('blogPost', {})).toContain('Blog');
  });

  it('handles buyingGuide with name', () => {
    expect(getPageTitle('buyingGuide', { name: 'Futon Guide' })).toContain('Futon Guide');
  });

  it('handles buyingGuide without name', () => {
    expect(getPageTitle('buyingGuide', {})).toContain('Buying Guide');
  });
});

// ── getCanonicalUrl — edge cases ─────────────────────────────────────

describe('getCanonicalUrl — edge cases', () => {
  it('returns base URL for home', () => {
    expect(getCanonicalUrl('home')).toBe('https://www.carolinafutons.com');
  });

  it('returns base URL for unknown page type', () => {
    expect(getCanonicalUrl('unknown')).toBe('https://www.carolinafutons.com');
  });

  it('appends product slug to product path', () => {
    expect(getCanonicalUrl('product', 'eureka-frame')).toContain('/product-page/eureka-frame');
  });

  it('appends slug to blog post path', () => {
    expect(getCanonicalUrl('blogPost', 'my-post')).toContain('/blog/my-post');
  });

  it('handles empty slug for product', () => {
    expect(getCanonicalUrl('product', '')).toMatch(/\/product-page\/$/);
  });

  it('uses default empty string when slug omitted', () => {
    expect(getCanonicalUrl('product')).toMatch(/\/product-page\/$/);
  });
});

// ── getPageMetaDescription — edge cases ──────────────────────────────

describe('getPageMetaDescription — edge cases', () => {
  it('returns home description for unknown page type', () => {
    const desc = getPageMetaDescription('nonexistent');
    expect(desc).toContain('Carolina Futons');
  });

  it('strips HTML and truncates product description', () => {
    const desc = getPageMetaDescription('product', {
      description: '<p>' + 'x'.repeat(200) + '</p>',
    });
    expect(desc).not.toContain('<p>');
    expect(desc.length).toBeLessThanOrEqual(160);
  });

  it('uses generic product description when no description provided', () => {
    const desc = getPageMetaDescription('product', { name: 'Test Frame' });
    expect(desc).toContain('Test Frame');
    expect(desc).toContain('Carolina Futons');
  });

  it('uses generic description when product name also missing', () => {
    const desc = getPageMetaDescription('product', {});
    expect(desc).toContain('quality furniture');
  });

  it('strips HTML from blogPost excerpt', () => {
    const desc = getPageMetaDescription('blogPost', {
      title: 'Post',
      excerpt: '<p>Blog <b>excerpt</b></p>',
    });
    expect(desc).not.toContain('<p>');
    expect(desc).toContain('Blog excerpt');
  });

  it('falls back to generic blogPost description without excerpt', () => {
    const desc = getPageMetaDescription('blogPost', { title: 'My Post' });
    expect(desc).toContain('My Post');
  });

  it('uses category meta description for category type', () => {
    const desc = getPageMetaDescription('category', { slug: 'futon-frames' });
    expect(desc).toContain('futon frames');
  });
});

// ── getCategoryMetaDescription — edge cases ──────────────────────────

describe('getCategoryMetaDescription — edge cases', () => {
  it('returns default description for unknown category', () => {
    const desc = getCategoryMetaDescription('unknown-category');
    expect(desc).toContain('largest selection');
  });

  it('returns default description for null category', () => {
    const desc = getCategoryMetaDescription(null);
    expect(desc).toContain('largest selection');
  });

  it('returns specific description for futon-frames', () => {
    const desc = getCategoryMetaDescription('futon-frames');
    expect(desc).toContain('Night & Day');
  });

  it('returns specific description for murphy-cabinet-beds', () => {
    const desc = getCategoryMetaDescription('murphy-cabinet-beds');
    expect(desc).toContain('Murphy');
  });
});

// ── getCategoryOgTags — edge cases ───────────────────────────────────

describe('getCategoryOgTags — edge cases', () => {
  it('uses Shop fallback for unknown category', () => {
    const tags = JSON.parse(getCategoryOgTags('nonexistent'));
    expect(tags['og:title']).toContain('Shop');
  });

  it('uses correct title for known category', () => {
    const tags = JSON.parse(getCategoryOgTags('futon-frames'));
    expect(tags['og:title']).toContain('Futon Frames');
  });

  it('includes twitter card tags', () => {
    const tags = JSON.parse(getCategoryOgTags('futon-frames'));
    expect(tags['twitter:card']).toBe('summary');
  });
});

// ── getBusinessSchema — immutability ─────────────────────────────────

describe('getBusinessSchema — structure', () => {
  it('returns valid JSON-LD with FurnitureStore type', () => {
    const schema = JSON.parse(getBusinessSchema());
    expect(schema['@type']).toBe('FurnitureStore');
    expect(schema.name).toBe('Carolina Futons');
  });

  it('includes geo coordinates', () => {
    const schema = JSON.parse(getBusinessSchema());
    expect(schema.geo.latitude).toBeCloseTo(35.3187, 2);
    expect(schema.geo.longitude).toBeCloseTo(-82.4612, 2);
  });

  it('includes sameAs social links', () => {
    const schema = JSON.parse(getBusinessSchema());
    expect(schema.sameAs).toContain('https://www.facebook.com/carolinafutons');
  });

  it('fresh call returns new string (not cached reference)', () => {
    const a = getBusinessSchema();
    const b = getBusinessSchema();
    expect(a).toEqual(b);
  });
});

// ── getWebSiteSchema — structure ─────────────────────────────────────

describe('getWebSiteSchema — structure', () => {
  it('includes SearchAction', () => {
    const schema = JSON.parse(getWebSiteSchema());
    expect(schema.potentialAction['@type']).toBe('SearchAction');
    expect(schema.potentialAction.target.urlTemplate).toContain('{search_term_string}');
  });
});
