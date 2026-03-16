/**
 * CF-4z4d — Hardening tests for Google Merchant Feed, SEO Content Hub,
 * and Topic Clusters. Covers bug fixes, uncovered branches, and edge cases.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import {
  generateFeed,
  getFeedData,
} from '../src/backend/googleMerchantFeed.web.js';
import {
  getContentHub,
  getPillarGuide,
  getPillarGuideSlugs,
  getHubSchema,
  getGuideSchema,
  getSitemapEntries,
} from '../src/backend/seoContentHub.web.js';
import {
  getTopicCluster,
  generateInternalLinks,
  getSchemaMarkup,
  getSEOScore,
  getSitemapData,
} from '../src/backend/topicClusters.web.js';

beforeEach(() => {
  __seed('Stores/Products', []);
});

// ── Google Merchant Feed — bug fixes ────────────────────────────────

describe('Google Merchant Feed — discountedPrice falsy-zero fix', () => {
  it('includes sale price of $0.00 in XML feed', async () => {
    __seed('Stores/Products', [{
      _id: 'free-item',
      name: 'Free Sample',
      slug: 'free-sample',
      description: 'A free item',
      price: 100,
      discountedPrice: 0,
      visible: true,
      inStock: true,
      collections: ['futon-frames'],
      mainMedia: 'https://example.com/img.jpg',
    }]);

    const xml = await generateFeed();
    expect(xml).toContain('<g:sale_price>0.00 USD</g:sale_price>');
  });

  it('includes sale price of $0 in JSON feed data', async () => {
    __seed('Stores/Products', [{
      _id: 'free-item',
      name: 'Free Sample',
      slug: 'free-sample',
      price: 100,
      discountedPrice: 0,
      visible: true,
      inStock: true,
      collections: [],
      mainMedia: '',
    }]);

    const data = await getFeedData();
    expect(data[0].salePrice).toBe(0);
  });

  it('does not include sale price when discountedPrice is null', async () => {
    __seed('Stores/Products', [{
      _id: 'no-sale',
      name: 'Regular Item',
      slug: 'regular',
      price: 200,
      discountedPrice: null,
      visible: true,
      inStock: true,
      collections: [],
      mainMedia: '',
    }]);

    const xml = await generateFeed();
    expect(xml).not.toContain('sale_price');
  });
});

describe('Google Merchant Feed — category mapping coverage', () => {
  const categoryTests = [
    { collection: 'covers', expectedType: 'Futon Covers', label: 'covers' },
    { collection: 'outdoor-furniture', expectedType: 'Outdoor Furniture', label: 'outdoor' },
    { collection: 'pillows', expectedType: 'Pillows &amp; Bolsters', label: 'pillows' },
    { collection: 'log-frames', expectedType: 'Futon Frames &gt; Log Futon', label: 'log frames' },
  ];

  for (const tc of categoryTests) {
    it(`maps ${tc.label} to correct product type in feed`, async () => {
      __seed('Stores/Products', [{
        _id: `cat-${tc.collection}`,
        name: `Test ${tc.label}`,
        slug: `test-${tc.collection}`,
        price: 99,
        visible: true,
      inStock: true,
        collections: [tc.collection],
        mainMedia: '',
      }]);

      const xml = await generateFeed();
      expect(xml).toContain(`<g:product_type>${tc.expectedType}</g:product_type>`);
    });
  }

  it('maps covers to correct Google category ID', async () => {
    __seed('Stores/Products', [{
      _id: 'cover-1',
      name: 'Test Cover',
      slug: 'test-cover',
      price: 50,
      visible: true,
      inStock: true,
      collections: ['covers'],
      mainMedia: '',
    }]);

    const xml = await generateFeed();
    expect(xml).toContain('<g:google_product_category>2720</g:google_product_category>');
  });

  it('maps outdoor to correct Google category ID', async () => {
    __seed('Stores/Products', [{
      _id: 'outdoor-1',
      name: 'Outdoor Chair',
      slug: 'outdoor-chair',
      price: 300,
      visible: true,
      inStock: true,
      collections: ['outdoor-furniture'],
      mainMedia: '',
    }]);

    const xml = await generateFeed();
    expect(xml).toContain('<g:google_product_category>2780</g:google_product_category>');
  });
});

describe('Google Merchant Feed — XML generation', () => {
  it('generates valid XML with RSS wrapper', async () => {
    __seed('Stores/Products', [{
      _id: 'p1',
      name: 'Monterey Futon',
      slug: 'monterey',
      description: '<p>A great <strong>futon</strong> frame.</p>',
      price: 549,
      visible: true,
      inStock: true,
      collections: ['futon-frames'],
      mainMedia: 'https://example.com/img.jpg',
      sku: 'CF-MONTEREY',
    }]);

    const xml = await generateFeed();
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain('</rss>');
  });

  it('escapes XML special characters in product names', async () => {
    __seed('Stores/Products', [{
      _id: 'xml-escape',
      name: 'Frame & Cover "Bundle" <Special>',
      slug: 'bundle',
      price: 100,
      visible: true,
      inStock: true,
      collections: [],
      mainMedia: '',
    }]);

    const xml = await generateFeed();
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&quot;');
    expect(xml).toContain('&lt;Special&gt;');
  });

  it('strips HTML from descriptions', async () => {
    __seed('Stores/Products', [{
      _id: 'html-desc',
      name: 'HTML Product',
      slug: 'html',
      description: '<p>Clean <b>text</b>&nbsp;here.</p>',
      price: 100,
      visible: true,
      inStock: true,
      collections: [],
      mainMedia: '',
    }]);

    const xml = await generateFeed();
    expect(xml).toContain('Clean text here.');
    expect(xml).not.toContain('<p>');
    expect(xml).not.toContain('<b>');
  });

  it('marks out-of-stock products correctly', async () => {
    __seed('Stores/Products', [{
      _id: 'oos',
      name: 'Out of Stock Item',
      slug: 'oos',
      price: 200,
      visible: true,
      inStock: false,
      collections: [],
      mainMedia: '',
    }]);

    const xml = await generateFeed();
    expect(xml).toContain('<g:availability>out_of_stock</g:availability>');
  });

  it('includes additional images when available', async () => {
    __seed('Stores/Products', [{
      _id: 'multi-img',
      name: 'Multi Image',
      slug: 'multi',
      price: 300,
      visible: true,
      inStock: true,
      collections: [],
      mainMedia: 'https://example.com/main.jpg',
      mediaItems: [
        'https://example.com/main.jpg',
        'https://example.com/side.jpg',
        'https://example.com/back.jpg',
      ],
    }]);

    const xml = await generateFeed();
    expect(xml).toContain('additional_image_link');
  });

  it('includes MPN from SKU', async () => {
    __seed('Stores/Products', [{
      _id: 'sku-test',
      name: 'SKU Product',
      slug: 'sku',
      price: 100,
      visible: true,
      inStock: true,
      collections: [],
      mainMedia: '',
      sku: 'CF-TEST-123',
    }]);

    const xml = await generateFeed();
    expect(xml).toContain('<g:mpn>CF-TEST-123</g:mpn>');
  });

  it('includes shipping info', async () => {
    __seed('Stores/Products', [{
      _id: 'ship',
      name: 'Ship Test',
      slug: 'ship',
      price: 100,
      visible: true,
      inStock: true,
      collections: [],
      mainMedia: '',
    }]);

    const xml = await generateFeed();
    expect(xml).toContain('<g:country>US</g:country>');
    expect(xml).toContain('49.99 USD');
  });

  it('returns empty feed when no products', async () => {
    __seed('Stores/Products', []);
    const xml = await generateFeed();
    expect(xml).toContain('<channel>');
    expect(xml).not.toContain('<g:id>');
  });

  it('paginates through products', async () => {
    // Seed exactly 1 product — just verifies pagination loop terminates
    __seed('Stores/Products', [{
      _id: 'single',
      name: 'Single',
      slug: 'single',
      price: 100,
      visible: true,
      inStock: true,
      collections: [],
      mainMedia: '',
    }]);

    const xml = await generateFeed();
    expect(xml).toContain('Single');
  });
});

describe('Google Merchant Feed — getFeedData', () => {
  it('returns JSON array of product data', async () => {
    __seed('Stores/Products', [{
      _id: 'json-1',
      name: 'JSON Product',
      slug: 'json-product',
      description: 'A product',
      price: 299,
      visible: true,
      inStock: true,
      collections: ['murphy-cabinet-beds'],
      mainMedia: 'https://example.com/img.jpg',
      sku: 'CF-JSON',
    }]);

    const data = await getFeedData();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('JSON Product');
    expect(data[0].price).toBe(299);
    expect(data[0].availability).toBe('in_stock');
    expect(data[0].brand).toBe('Night & Day Furniture');
    expect(data[0].googleProductCategory).toContain('Murphy');
    expect(data[0].productType).toContain('Murphy');
    expect(data[0].sku).toBe('CF-JSON');
    expect(data[0].identifierExists).toBe(false);
  });

  it('returns empty array when no products exist', async () => {
    __seed('Stores/Products', []);
    const data = await getFeedData();
    expect(data).toHaveLength(0);
  });
});

// ── Brand detection ─────────────────────────────────────────────────

describe('Google Merchant Feed — brand detection', () => {
  it('detects Strata Furniture for wall-hugger collections', async () => {
    __seed('Stores/Products', [{
      _id: 'wh-1',
      name: 'Wall Hugger',
      slug: 'wh',
      price: 500,
      visible: true,
      inStock: true,
      collections: ['wall-hugger-frames'],
      mainMedia: '',
    }]);

    const data = await getFeedData();
    expect(data[0].brand).toBe('Strata Furniture');
  });

  it('detects KD Frames for unfinished collections', async () => {
    __seed('Stores/Products', [{
      _id: 'uf-1',
      name: 'Unfinished Frame',
      slug: 'uf',
      price: 300,
      visible: true,
      inStock: true,
      collections: ['unfinished-wood'],
      mainMedia: '',
    }]);

    const data = await getFeedData();
    expect(data[0].brand).toBe('KD Frames');
  });

  it('detects Otis Bed for mattress collections', async () => {
    __seed('Stores/Products', [{
      _id: 'mat-1',
      name: 'Otis Mattress',
      slug: 'otis',
      price: 200,
      visible: true,
      inStock: true,
      collections: ['otis-mattresses'],
      mainMedia: '',
    }]);

    const data = await getFeedData();
    expect(data[0].brand).toBe('Otis Bed');
  });

  it('defaults to Night & Day Furniture for standard frames', async () => {
    __seed('Stores/Products', [{
      _id: 'nd-1',
      name: 'Standard Frame',
      slug: 'std',
      price: 400,
      visible: true,
      inStock: true,
      collections: ['futon-frames'],
      mainMedia: '',
    }]);

    const data = await getFeedData();
    expect(data[0].brand).toBe('Night & Day Furniture');
  });
});

// ── SEO Content Hub — edge cases ────────────────────────────────────

describe('SEO Content Hub hardening', () => {
  it('getContentHub returns all 8 guides', async () => {
    const result = await getContentHub();
    expect(result.success).toBe(true);
    expect(result.hub.guideCount).toBe(8);
    expect(result.hub.guides).toHaveLength(8);
  });

  it('getPillarGuide returns null for empty slug', async () => {
    const result = await getPillarGuide('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('getPillarGuide returns null guide for unknown slug', async () => {
    const result = await getPillarGuide('nonexistent');
    expect(result.success).toBe(true);
    expect(result.guide).toBeNull();
  });

  it('getPillarGuide returns related guides', async () => {
    const result = await getPillarGuide('futon-frames');
    expect(result.success).toBe(true);
    expect(result.guide.slug).toBe('futon-frames');
    expect(result.relatedGuides.length).toBeGreaterThan(0);
    // Related guides should include mattresses
    expect(result.relatedGuides.some(g => g.slug === 'mattresses')).toBe(true);
  });

  it('getPillarGuideSlugs returns 8 slugs', async () => {
    const result = await getPillarGuideSlugs();
    expect(result.success).toBe(true);
    expect(result.slugs).toHaveLength(8);
    expect(result.slugs).toContain('futon-frames');
    expect(result.slugs).toContain('bundle-deals');
  });

  it('getHubSchema returns valid JSON-LD schemas', async () => {
    const result = await getHubSchema();
    expect(result.success).toBe(true);

    const collection = JSON.parse(result.collectionSchema);
    expect(collection['@type']).toBe('CollectionPage');
    expect(collection.mainEntity['@type']).toBe('ItemList');
    expect(collection.mainEntity.numberOfItems).toBe(8);

    const breadcrumb = JSON.parse(result.breadcrumbSchema);
    expect(breadcrumb['@type']).toBe('BreadcrumbList');
    expect(breadcrumb.itemListElement).toHaveLength(2);
  });

  it('getGuideSchema returns empty for unknown slug', async () => {
    const result = await getGuideSchema('nonexistent');
    expect(result.success).toBe(true);
    expect(result.breadcrumbSchema).toBe('');
  });

  it('getGuideSchema returns valid breadcrumb with 3 levels', async () => {
    const result = await getGuideSchema('mattresses');
    expect(result.success).toBe(true);

    const bc = JSON.parse(result.breadcrumbSchema);
    expect(bc.itemListElement).toHaveLength(3);
    expect(bc.itemListElement[2].name).toBe('Mattresses');

    const nav = JSON.parse(result.navigationSchema);
    expect(nav['@type']).toBe('SiteNavigationElement');
    expect(nav.hasPart.length).toBeGreaterThan(0);
  });

  it('getSitemapEntries returns hub + 8 guide entries', async () => {
    const result = await getSitemapEntries();
    expect(result.success).toBe(true);
    expect(result.entries.length).toBe(9); // 1 hub + 8 guides
    expect(result.entries[0].priority).toBe(0.9);
  });
});

// ── Topic Clusters — edge cases ─────────────────────────────────────

describe('Topic Clusters hardening', () => {
  it('getTopicCluster returns null for empty slug', async () => {
    const result = await getTopicCluster('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('getTopicCluster returns null for unknown cluster', async () => {
    const result = await getTopicCluster('nonexistent');
    expect(result.success).toBe(true);
    expect(result.cluster).toBeNull();
  });

  it('getTopicCluster returns full cluster data', async () => {
    const result = await getTopicCluster('futon-frames');
    expect(result.success).toBe(true);
    expect(result.cluster.pillarTitle).toContain('Futon Frame');
    expect(result.cluster.keywords.length).toBeGreaterThan(0);
    expect(result.cluster.spokePages.length).toBe(4);
    expect(result.cluster.spokeCount).toBe(4);
    expect(result.cluster.spokePages[0].url).toContain('/buying-guides/');
  });

  it('generateInternalLinks returns pillar-to-spoke links', async () => {
    const result = await generateInternalLinks('futon-frames', 5);
    expect(result.success).toBe(true);
    expect(result.links.some(l => l.relationship === 'pillar-to-spoke')).toBe(true);
  });

  it('generateInternalLinks returns spoke-to-pillar links', async () => {
    const result = await generateInternalLinks('wood-vs-metal-frames', 5);
    expect(result.success).toBe(true);
    expect(result.links.some(l => l.relationship === 'spoke-to-pillar')).toBe(true);
    expect(result.links.some(l => l.relationship === 'spoke-to-spoke')).toBe(true);
  });

  it('generateInternalLinks returns cross-cluster links for pillars', async () => {
    const result = await generateInternalLinks('futon-frames', 20);
    expect(result.success).toBe(true);
    expect(result.links.some(l => l.relationship === 'cross-cluster')).toBe(true);
  });

  it('generateInternalLinks respects maxLinks limit', async () => {
    const result = await generateInternalLinks('futon-frames', 2);
    expect(result.links.length).toBeLessThanOrEqual(2);
  });

  it('generateInternalLinks clamps maxLinks to 1-20', async () => {
    const result = await generateInternalLinks('futon-frames', 0);
    expect(result.links.length).toBeGreaterThanOrEqual(1);
  });

  it('getSchemaMarkup generates Article schema for pillar page', async () => {
    const result = await getSchemaMarkup('futon-frames', {
      description: 'Complete buying guide',
      image: 'https://example.com/hero.jpg',
    });
    expect(result.success).toBe(true);
    const article = JSON.parse(result.schemas.article);
    expect(article['@type']).toBe('Article');
    expect(article.headline).toContain('Futon Frame');
  });

  it('getSchemaMarkup generates HowTo for howto spoke pages', async () => {
    const result = await getSchemaMarkup('futon-frame-assembly', {
      steps: [
        { name: 'Unbox', text: 'Open the box' },
        { name: 'Assemble', text: 'Follow instructions' },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.schemas.howTo).toBeDefined();
    const howTo = JSON.parse(result.schemas.howTo);
    expect(howTo['@type']).toBe('HowTo');
    expect(howTo.step).toHaveLength(2);
  });

  it('getSchemaMarkup generates FAQ when FAQs provided', async () => {
    const result = await getSchemaMarkup('futon-frames', {
      faqs: [
        { question: 'What sizes?', answer: 'Full, Queen, King' },
        { question: 'What wood?', answer: 'Hardwood' },
        { question: 'How long?', answer: '3-5 days' },
      ],
    });
    expect(result.success).toBe(true);
    const faq = JSON.parse(result.schemas.faq);
    expect(faq['@type']).toBe('FAQPage');
    expect(faq.mainEntity).toHaveLength(3);
  });

  it('getSchemaMarkup generates 4-level breadcrumb for spoke pages', async () => {
    const result = await getSchemaMarkup('wood-vs-metal-frames');
    expect(result.success).toBe(true);
    const bc = JSON.parse(result.schemas.breadcrumb);
    expect(bc.itemListElement).toHaveLength(4);
    expect(bc.itemListElement[2].name).toContain('Futon Frame');
    expect(bc.itemListElement[3].name).toContain('Wood vs Metal');
  });

  it('getSEOScore returns perfect score for complete page', async () => {
    const result = await getSEOScore({
      slug: 'futon-frames',
      title: 'The Complete Futon Frame Buying Guide 2026',
      description: 'Everything you need to know before buying a futon frame. Compare wood vs metal, sizes, styles, weight capacity, and our top picks for every budget.',
      content: 'word '.repeat(1500),
      image: 'https://example.com/hero.jpg',
      imageAlt: 'Futon frames in a showroom',
      faqs: [
        { question: 'Q1', answer: 'A1' },
        { question: 'Q2', answer: 'A2' },
        { question: 'Q3', answer: 'A3' },
      ],
      internalLinkCount: 5,
    });
    expect(result.success).toBe(true);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
  });

  it('getSEOScore returns low score for minimal page', async () => {
    const result = await getSEOScore({
      slug: 'unknown-page',
      title: 'Short',
    });
    expect(result.success).toBe(true);
    expect(result.score).toBeLessThan(30);
    expect(result.grade).toMatch(/[D-F]/);
  });

  it('getSEOScore rejects missing slug', async () => {
    const result = await getSEOScore({});
    expect(result.success).toBe(false);
  });

  it('getSitemapData returns hub + pillar + spoke entries', async () => {
    const result = await getSitemapData();
    expect(result.success).toBe(true);
    expect(result.stats.hubPages).toBe(1);
    expect(result.stats.pillarPages).toBe(8);
    expect(result.stats.spokePages).toBeGreaterThan(10);
    expect(result.entries.some(e => e.type === 'hub')).toBe(true);
    expect(result.entries.some(e => e.type === 'pillar')).toBe(true);
    expect(result.entries.some(e => e.type === 'spoke')).toBe(true);
  });
});
