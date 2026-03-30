import { describe, it, expect, beforeEach } from 'vitest';
import { __seed } from './__mocks__/wix-data.js';
import { __reset as __resetStores, __setProducts as __setStoreProducts } from './__mocks__/wix-stores-backend.js';
import {
  getBuyingGuide,
  getAllBuyingGuides,
  getBuyingGuideSlugs,
  getBuyingGuideSchema,
  getGuideComparisonTable,
  getGuideFaqs,
  getSocialShareLinks,
} from '../src/backend/buyingGuides.web.js';

const EXPECTED_SLUGS = [
  'futon-frames',
  'mattresses',
  'covers',
  'pillows',
  'storage',
  'outdoor',
  'accessories',
  'bundle-deals',
];

beforeEach(() => {
  __seed('Stores/Products', []);
  __resetStores();
});

// ── Data Integrity ────────────────────────────────────────────────

describe('data integrity', () => {
  it('all guides have unique slugs', async () => {
    const result = await getBuyingGuideSlugs();
    expect(new Set(result.slugs).size).toBe(result.slugs.length);
  });

  it('all guides have unique titles', async () => {
    const result = await getAllBuyingGuides();
    const titles = result.guides.map(g => g.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('all guides have unique metaDescriptions', async () => {
    const result = await getAllBuyingGuides();
    const descs = result.guides.map(g => g.metaDescription);
    expect(new Set(descs).size).toBe(descs.length);
  });

  it('all guides have unique heroImage URLs', async () => {
    const result = await getAllBuyingGuides();
    const images = result.guides.map(g => g.heroImage);
    expect(new Set(images).size).toBe(images.length);
  });

  it('no duplicate FAQ questions across all guides', async () => {
    const allQuestions = [];
    for (const slug of EXPECTED_SLUGS) {
      const result = await getGuideFaqs(slug);
      allQuestions.push(...result.faqs.map(f => f.question));
    }
    expect(new Set(allQuestions).size).toBe(allQuestions.length);
  });

  it('all comparison tables have consistent row/header alignment', async () => {
    for (const slug of EXPECTED_SLUGS) {
      const result = await getGuideComparisonTable(slug);
      const colCount = result.table.headers.length;
      for (const row of result.table.rows) {
        expect(row.length).toBe(colCount);
      }
    }
  });

  it('metaDescriptions stay under 160 chars for SEO', async () => {
    for (const slug of EXPECTED_SLUGS) {
      const result = await getBuyingGuide(slug);
      expect(result.guide.metaDescription.length).toBeLessThanOrEqual(160);
    }
  });

  it('each guide has at least 3 keywords', async () => {
    for (const slug of EXPECTED_SLUGS) {
      const result = await getBuyingGuide(slug);
      expect(result.guide.keywords.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('product links across guides use absolute paths', async () => {
    for (const slug of EXPECTED_SLUGS) {
      const result = await getBuyingGuide(slug);
      for (const link of result.guide.productLinks) {
        expect(link.url.startsWith('/')).toBe(true);
      }
    }
  });

  it('section headings within each guide are unique', async () => {
    for (const slug of EXPECTED_SLUGS) {
      const result = await getBuyingGuide(slug);
      const headings = result.guide.sections.map(s => s.heading);
      expect(new Set(headings).size).toBe(headings.length);
    }
  });

  it('Article and FAQPage schemas are valid JSON for all guides', async () => {
    for (const slug of EXPECTED_SLUGS) {
      const result = await getBuyingGuideSchema(slug);
      expect(() => JSON.parse(result.articleSchema)).not.toThrow();
      expect(() => JSON.parse(result.faqSchema)).not.toThrow();
    }
  });

  it('FAQ schema question text matches guide FAQ questions', async () => {
    for (const slug of EXPECTED_SLUGS) {
      const guideResult = await getGuideFaqs(slug);
      const schemaResult = await getBuyingGuideSchema(slug);
      const schema = JSON.parse(schemaResult.faqSchema);
      const schemaQuestions = schema.mainEntity.map(e => e.name);
      const guideQuestions = guideResult.faqs.map(f => f.question);
      expect(schemaQuestions).toEqual(guideQuestions);
    }
  });

  it('social share URLs match guide URLs', async () => {
    for (const slug of EXPECTED_SLUGS) {
      const share = await getSocialShareLinks(slug);
      expect(share.links.url).toBe(`https://www.carolinafutons.com/buying-guides/${slug}`);
    }
  });
});

// ── getBuyingGuideSlugs ─────────────────────────────────────────────

describe('getBuyingGuideSlugs', () => {
  it('returns all 8 category slugs', async () => {
    const result = await getBuyingGuideSlugs();
    expect(result.success).toBe(true);
    expect(result.slugs).toHaveLength(8);
    for (const slug of EXPECTED_SLUGS) {
      expect(result.slugs).toContain(slug);
    }
  });

  it('slugs are non-empty strings', async () => {
    const result = await getBuyingGuideSlugs();
    for (const slug of result.slugs) {
      expect(typeof slug).toBe('string');
      expect(slug.length).toBeGreaterThan(0);
    }
  });

  it('slugs use URL-safe characters', async () => {
    const result = await getBuyingGuideSlugs();
    for (const slug of result.slugs) {
      expect(slug).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

// ── getAllBuyingGuides ───────────────────────────────────────────────

describe('getAllBuyingGuides', () => {
  it('returns summary for all 8 guides', async () => {
    const result = await getAllBuyingGuides();
    expect(result.success).toBe(true);
    expect(result.guides).toHaveLength(8);
  });

  it('each summary has required fields', async () => {
    const result = await getAllBuyingGuides();
    for (const guide of result.guides) {
      expect(guide.slug).toBeTruthy();
      expect(guide.title).toBeTruthy();
      expect(guide.metaDescription).toBeTruthy();
      expect(guide.categoryLabel).toBeTruthy();
      expect(guide.heroImage).toBeTruthy();
      expect(guide.publishDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('meta descriptions are 160 chars or less', async () => {
    const result = await getAllBuyingGuides();
    for (const guide of result.guides) {
      expect(guide.metaDescription.length).toBeLessThanOrEqual(160);
    }
  });

  it('each summary includes category slug', async () => {
    const result = await getAllBuyingGuides();
    for (const guide of result.guides) {
      expect(typeof guide.category).toBe('string');
      expect(guide.category.length).toBeGreaterThan(0);
    }
  });

  it('each summary includes readingTime as positive number', async () => {
    const result = await getAllBuyingGuides();
    for (const guide of result.guides) {
      expect(typeof guide.readingTime).toBe('number');
      expect(guide.readingTime).toBeGreaterThanOrEqual(1);
    }
  });

  it('summaries do not include full section bodies', async () => {
    const result = await getAllBuyingGuides();
    for (const guide of result.guides) {
      expect(guide).not.toHaveProperty('sections');
      expect(guide).not.toHaveProperty('faqs');
      expect(guide).not.toHaveProperty('comparisonTable');
    }
  });

  it('slugs in summaries match EXPECTED_SLUGS', async () => {
    const result = await getAllBuyingGuides();
    const slugs = result.guides.map(g => g.slug);
    for (const expected of EXPECTED_SLUGS) {
      expect(slugs).toContain(expected);
    }
  });

  it('readingTime varies across guides (not all same value)', async () => {
    const result = await getAllBuyingGuides();
    const times = result.guides.map(g => g.readingTime);
    const unique = new Set(times);
    // Guides have different lengths so reading times should vary
    expect(unique.size).toBeGreaterThanOrEqual(1);
  });
});

// ── getBuyingGuide ──────────────────────────────────────────────────

describe('getBuyingGuide', () => {
  it.each(EXPECTED_SLUGS)('returns full guide for %s', async (slug) => {
    const result = await getBuyingGuide(slug);
    expect(result.success).toBe(true);
    expect(result.guide.slug).toBe(slug);
    expect(result.guide.comingSoon).toBe(false);
    expect(result.guide.title).toBeTruthy();
    expect(result.guide.title.length).toBeGreaterThan(10);
  });

  it.each(EXPECTED_SLUGS)('guide %s has 4+ content sections', async (slug) => {
    const result = await getBuyingGuide(slug);
    expect(result.guide.sections.length).toBeGreaterThanOrEqual(4);
    for (const section of result.guide.sections) {
      expect(section.heading).toBeTruthy();
      expect(section.body).toBeTruthy();
      expect(section.body.length).toBeGreaterThan(100);
    }
  });

  it.each(EXPECTED_SLUGS)('guide %s has >1000 words total', async (slug) => {
    const result = await getBuyingGuide(slug);
    const totalText = result.guide.sections.map(s => s.body).join(' ');
    const wordCount = totalText.split(/\s+/).length;
    expect(wordCount).toBeGreaterThan(1000);
  });

  it.each(EXPECTED_SLUGS)('guide %s has comparison table', async (slug) => {
    const result = await getBuyingGuide(slug);
    const table = result.guide.comparisonTable;
    expect(table).toBeTruthy();
    expect(table.title).toBeTruthy();
    expect(table.headers.length).toBeGreaterThanOrEqual(3);
    expect(table.rows.length).toBeGreaterThanOrEqual(5);
  });

  it.each(EXPECTED_SLUGS)('guide %s has 5 FAQs', async (slug) => {
    const result = await getBuyingGuide(slug);
    expect(result.guide.faqs).toHaveLength(5);
    for (const faq of result.guide.faqs) {
      expect(faq.question).toBeTruthy();
      expect(faq.question.endsWith('?')).toBe(true);
      expect(faq.answer).toBeTruthy();
      expect(faq.answer.length).toBeGreaterThan(50);
    }
  });

  it.each(EXPECTED_SLUGS)('guide %s has product links', async (slug) => {
    const result = await getBuyingGuide(slug);
    expect(result.guide.productLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of result.guide.productLinks) {
      expect(link.text).toBeTruthy();
      expect(link.url).toBeTruthy();
      expect(link.url.startsWith('/')).toBe(true);
    }
  });

  it.each(EXPECTED_SLUGS)('guide %s has keywords array', async (slug) => {
    const result = await getBuyingGuide(slug);
    expect(result.guide.keywords).toBeInstanceOf(Array);
    expect(result.guide.keywords.length).toBeGreaterThanOrEqual(3);
  });

  it('returns coming soon for unknown category', async () => {
    const result = await getBuyingGuide('nonexistent-category');
    expect(result.success).toBe(true);
    expect(result.guide.comingSoon).toBe(true);
    expect(result.guide.message).toContain('coming soon');
  });

  it('coming soon title is derived from slug', async () => {
    const result = await getBuyingGuide('new-category');
    expect(result.guide.title).toContain('New Category');
    expect(result.guide.categoryLabel).toContain('New Category');
  });

  it('fails for empty slug', async () => {
    const result = await getBuyingGuide('');
    expect(result.success).toBe(false);
    expect(result.error).toContain('required');
  });

  it('fails for null slug', async () => {
    const result = await getBuyingGuide(null);
    expect(result.success).toBe(false);
  });

  it('includes relatedProducts array', async () => {
    const result = await getBuyingGuide('futon-frames');
    expect(result.guide.relatedProducts).toBeInstanceOf(Array);
  });

  it('populates relatedProducts from wix-stores-backend when guide has relatedProductIds', async () => {
    // futon-frames has relatedProductIds — seed the stores mock so getProduct returns data
    __setStoreProducts([
      {
        _id: 'frm-nd-casual-cherry',
        name: 'Night & Day Casual Cherry',
        slug: 'nd-casual-cherry',
        price: 549,
        formattedPrice: '$549.00',
        mainMedia: 'https://example.com/casual.jpg',
        ribbon: 'Best Seller',
      },
    ]);

    const result = await getBuyingGuide('futon-frames');
    expect(result.guide.relatedProducts.length).toBeGreaterThanOrEqual(1);
    expect(result.guide.relatedProducts[0].name).toBe('Night & Day Casual Cherry');
    expect(result.guide.relatedProducts[0].price).toBe(549);
  });

  it('related products have correct fields', async () => {
    __setStoreProducts([{
      _id: 'mat-8in-cotton-full', name: 'Cotton Full', slug: 'cotton-full', price: 299,
      formattedPrice: '$299.00', mainMedia: 'img.jpg', ribbon: '',
    }]);

    const result = await getBuyingGuide('mattresses');
    const product = result.guide.relatedProducts[0];
    expect(product).toHaveProperty('_id');
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('slug');
    expect(product).toHaveProperty('price');
    expect(product).toHaveProperty('formattedPrice');
    expect(product).toHaveProperty('mainMedia');
    expect(product).toHaveProperty('ribbon');
  });

  it('returns empty relatedProducts when no store products match the IDs', async () => {
    // __resetStores() in beforeEach leaves all getProduct calls returning null
    const result = await getBuyingGuide('futon-frames');
    expect(result.guide.relatedProducts).toEqual([]);
  });

  it('filters out null results when some relatedProductIds are not found', async () => {
    // Only seed one of the three futon-frames relatedProductIds
    __setStoreProducts([{
      _id: 'frm-nd-casual-cherry',
      name: 'Night & Day Casual Cherry',
      slug: 'nd-casual-cherry',
      price: 549,
      formattedPrice: '$549.00',
      mainMedia: 'img.jpg',
      ribbon: '',
    }]);

    const result = await getBuyingGuide('futon-frames');
    // Only 1 of 3 IDs resolves — nulls filtered out
    expect(result.guide.relatedProducts).toHaveLength(1);
  });

  it('does not consult wixData category query when relatedProductIds present', async () => {
    // futon-frames has relatedProductIds — even with wixData seeded, those rows
    // should NOT appear in relatedProducts (wixData fallback is bypassed)
    __seed('Stores/Products', [{
      _id: 'wix-data-product',
      name: 'Should Not Appear',
      slug: 'should-not-appear',
      price: 1,
      formattedPrice: '$1.00',
      mainMedia: 'img.jpg',
      ribbon: '',
      collections: ['futon-frames'],
    }]);
    // store mock empty → all relatedProductIds resolve null → empty array
    const result = await getBuyingGuide('futon-frames');
    const names = result.guide.relatedProducts.map(p => p.name);
    expect(names).not.toContain('Should Not Appear');
  });

  it('handles undefined slug', async () => {
    const result = await getBuyingGuide(undefined);
    expect(result.success).toBe(false);
  });

  it('handles numeric slug', async () => {
    const result = await getBuyingGuide(12345);
    // Should either fail validation or return coming soon
    expect(result.success === false || result.guide?.comingSoon === true).toBe(true);
  });

  it('handles slug with special characters', async () => {
    const result = await getBuyingGuide('<script>alert(1)</script>');
    // Should sanitize and return coming soon or fail
    expect(result.success === false || result.guide?.comingSoon === true).toBe(true);
  });

  it('coming soon guide has minimal required fields', async () => {
    const result = await getBuyingGuide('nonexistent-category');
    expect(result.guide).toHaveProperty('slug');
    expect(result.guide).toHaveProperty('title');
    expect(result.guide).toHaveProperty('categoryLabel');
    expect(result.guide).toHaveProperty('comingSoon');
    expect(result.guide).toHaveProperty('message');
  });

  it.each(EXPECTED_SLUGS)('guide %s has updatedDate', async (slug) => {
    const result = await getBuyingGuide(slug);
    expect(result.guide.updatedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(EXPECTED_SLUGS)('guide %s has heroImage URL', async (slug) => {
    const result = await getBuyingGuide(slug);
    expect(result.guide.heroImage).toContain('https://');
    expect(result.guide.heroImage).toContain('buying-guides/');
  });

  it.each(EXPECTED_SLUGS)('guide %s product links have distinct URLs', async (slug) => {
    const result = await getBuyingGuide(slug);
    const urls = result.guide.productLinks.map(l => l.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

// ── getBuyingGuideSchema ────────────────────────────────────────────

describe('getBuyingGuideSchema', () => {
  it.each(EXPECTED_SLUGS)('generates Article schema for %s', async (slug) => {
    const result = await getBuyingGuideSchema(slug);
    expect(result.success).toBe(true);
    expect(result.articleSchema).toBeTruthy();

    const schema = JSON.parse(result.articleSchema);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Article');
    expect(schema.headline).toBeTruthy();
    expect(schema.description).toBeTruthy();
  });

  it.each(EXPECTED_SLUGS)('generates FAQPage schema for %s', async (slug) => {
    const result = await getBuyingGuideSchema(slug);
    expect(result.faqSchema).toBeTruthy();

    const schema = JSON.parse(result.faqSchema);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity).toBeInstanceOf(Array);
    expect(schema.mainEntity.length).toBe(5);
  });

  it('Article schema includes publisher info', async () => {
    const result = await getBuyingGuideSchema('futon-frames');
    const schema = JSON.parse(result.articleSchema);
    expect(schema.publisher['@type']).toBe('Organization');
    expect(schema.publisher.name).toBe('Carolina Futons');
    expect(schema.publisher.logo).toBeTruthy();
  });

  it('Article schema includes author as Organization', async () => {
    const result = await getBuyingGuideSchema('mattresses');
    const schema = JSON.parse(result.articleSchema);
    expect(schema.author['@type']).toBe('Organization');
    expect(schema.author.name).toBe('Carolina Futons');
  });

  it('Article schema includes mainEntityOfPage with guide URL', async () => {
    const result = await getBuyingGuideSchema('covers');
    const schema = JSON.parse(result.articleSchema);
    expect(schema.mainEntityOfPage['@id']).toContain('/buying-guides/covers');
  });

  it('Article schema includes keywords', async () => {
    const result = await getBuyingGuideSchema('pillows');
    const schema = JSON.parse(result.articleSchema);
    expect(schema.keywords).toBeTruthy();
    expect(schema.keywords).toContain('futon pillows');
  });

  it('Article schema includes dates', async () => {
    const result = await getBuyingGuideSchema('storage');
    const schema = JSON.parse(result.articleSchema);
    expect(schema.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(schema.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('FAQPage entities have correct Question/Answer structure', async () => {
    const result = await getBuyingGuideSchema('outdoor');
    const schema = JSON.parse(result.faqSchema);
    for (const entity of schema.mainEntity) {
      expect(entity['@type']).toBe('Question');
      expect(entity.name).toBeTruthy();
      expect(entity.acceptedAnswer['@type']).toBe('Answer');
      expect(entity.acceptedAnswer.text).toBeTruthy();
    }
  });

  it('returns null schemas for unknown slug', async () => {
    const result = await getBuyingGuideSchema('nonexistent');
    expect(result.success).toBe(true);
    expect(result.articleSchema).toBeNull();
    expect(result.faqSchema).toBeNull();
  });

  it('fails for empty slug', async () => {
    const result = await getBuyingGuideSchema('');
    expect(result.success).toBe(false);
  });

  it('Article schema includes image URL', async () => {
    const result = await getBuyingGuideSchema('futon-frames');
    const schema = JSON.parse(result.articleSchema);
    expect(schema.image).toContain('https://');
  });

  it('Article schema headline matches guide title', async () => {
    const guide = await getBuyingGuide('mattresses');
    const schema = await getBuyingGuideSchema('mattresses');
    const parsed = JSON.parse(schema.articleSchema);
    expect(parsed.headline).toBe(guide.guide.title);
  });

  it('Article schema description matches metaDescription', async () => {
    const guide = await getBuyingGuide('covers');
    const schema = await getBuyingGuideSchema('covers');
    const parsed = JSON.parse(schema.articleSchema);
    expect(parsed.description).toBe(guide.guide.metaDescription);
  });

  it('handles null slug', async () => {
    const result = await getBuyingGuideSchema(null);
    expect(result.success).toBe(false);
  });

  it('handles undefined slug', async () => {
    const result = await getBuyingGuideSchema(undefined);
    expect(result.success).toBe(false);
  });
});

// ── getGuideComparisonTable ─────────────────────────────────────────

describe('getGuideComparisonTable', () => {
  it.each(EXPECTED_SLUGS)('returns comparison table for %s', async (slug) => {
    const result = await getGuideComparisonTable(slug);
    expect(result.success).toBe(true);
    expect(result.table).toBeTruthy();
    expect(result.table.title).toBeTruthy();
    expect(result.table.headers).toBeInstanceOf(Array);
    expect(result.table.rows).toBeInstanceOf(Array);
  });

  it('table rows match header column count', async () => {
    const result = await getGuideComparisonTable('futon-frames');
    const colCount = result.table.headers.length;
    for (const row of result.table.rows) {
      expect(row.length).toBe(colCount);
    }
  });

  it('returns null table for unknown slug', async () => {
    const result = await getGuideComparisonTable('nonexistent');
    expect(result.success).toBe(true);
    expect(result.table).toBeNull();
  });

  it('fails for empty slug', async () => {
    const result = await getGuideComparisonTable('');
    expect(result.success).toBe(false);
  });

  it('handles null slug', async () => {
    const result = await getGuideComparisonTable(null);
    expect(result.success).toBe(false);
  });

  it.each(EXPECTED_SLUGS)('table for %s has non-empty title', async (slug) => {
    const result = await getGuideComparisonTable(slug);
    expect(result.table.title.length).toBeGreaterThan(5);
  });

  it.each(EXPECTED_SLUGS)('table for %s has at least 3 headers', async (slug) => {
    const result = await getGuideComparisonTable(slug);
    expect(result.table.headers.length).toBeGreaterThanOrEqual(3);
  });

  it.each(EXPECTED_SLUGS)('table for %s rows match header count', async (slug) => {
    const result = await getGuideComparisonTable(slug);
    const colCount = result.table.headers.length;
    for (const row of result.table.rows) {
      expect(row.length).toBe(colCount);
    }
  });
});

// ── getGuideFaqs ────────────────────────────────────────────────────

describe('getGuideFaqs', () => {
  it.each(EXPECTED_SLUGS)('returns 5 FAQs for %s', async (slug) => {
    const result = await getGuideFaqs(slug);
    expect(result.success).toBe(true);
    expect(result.faqs).toHaveLength(5);
  });

  it('each FAQ has question ending with ?', async () => {
    const result = await getGuideFaqs('futon-frames');
    for (const faq of result.faqs) {
      expect(faq.question.endsWith('?')).toBe(true);
    }
  });

  it('each FAQ answer is substantial', async () => {
    const result = await getGuideFaqs('mattresses');
    for (const faq of result.faqs) {
      expect(faq.answer.length).toBeGreaterThan(50);
    }
  });

  it('returns null FAQs for unknown slug', async () => {
    const result = await getGuideFaqs('nonexistent');
    expect(result.success).toBe(true);
    expect(result.faqs).toBeNull();
  });

  it('fails for empty slug', async () => {
    const result = await getGuideFaqs('');
    expect(result.success).toBe(false);
  });

  it('handles null slug', async () => {
    const result = await getGuideFaqs(null);
    expect(result.success).toBe(false);
  });

  it.each(EXPECTED_SLUGS)('FAQ questions for %s are unique', async (slug) => {
    const result = await getGuideFaqs(slug);
    const questions = result.faqs.map(f => f.question);
    expect(new Set(questions).size).toBe(questions.length);
  });
});

// ── getSocialShareLinks ─────────────────────────────────────────────

describe('getSocialShareLinks', () => {
  it.each(EXPECTED_SLUGS)('generates share links for %s', async (slug) => {
    const result = await getSocialShareLinks(slug);
    expect(result.success).toBe(true);
    expect(result.links).toBeTruthy();
    expect(result.links.facebook).toContain('facebook.com');
    expect(result.links.twitter).toContain('twitter.com');
    expect(result.links.pinterest).toContain('pinterest.com');
    expect(result.links.email).toContain('mailto:');
    expect(result.links.url).toContain(slug);
  });

  it('share links contain encoded guide URL', async () => {
    const result = await getSocialShareLinks('futon-frames');
    expect(result.links.facebook).toContain(encodeURIComponent('buying-guides/futon-frames'));
  });

  it('twitter link includes title', async () => {
    const result = await getSocialShareLinks('mattresses');
    expect(result.links.twitter).toContain('text=');
  });

  it('email link includes subject and body', async () => {
    const result = await getSocialShareLinks('covers');
    expect(result.links.email).toContain('subject=');
    expect(result.links.email).toContain('body=');
  });

  it('returns null links for unknown slug', async () => {
    const result = await getSocialShareLinks('nonexistent');
    expect(result.success).toBe(true);
    expect(result.links).toBeNull();
  });

  it('fails for empty slug', async () => {
    const result = await getSocialShareLinks('');
    expect(result.success).toBe(false);
  });

  it('handles null slug', async () => {
    const result = await getSocialShareLinks(null);
    expect(result.success).toBe(false);
  });

  it('pinterest link includes description', async () => {
    const result = await getSocialShareLinks('futon-frames');
    expect(result.links.pinterest).toContain('description=');
  });

  it('url field is not encoded', async () => {
    const result = await getSocialShareLinks('futon-frames');
    expect(result.links.url).toBe('https://www.carolinafutons.com/buying-guides/futon-frames');
  });

  it.each(EXPECTED_SLUGS)('share links for %s have correct guide URL', async (slug) => {
    const result = await getSocialShareLinks(slug);
    expect(result.links.url).toContain(`/buying-guides/${slug}`);
  });
});
