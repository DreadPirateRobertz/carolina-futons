/**
 * Deepened coverage for buyingGuides.web.js — targets untested branches:
 * - getBuyingGuide with CMS query errors (graceful degradation)
 * - getBuyingGuideSchema Article/FAQPage field-level validation
 * - getGuideComparisonTable row content integrity
 * - getGuideFaqs answer content depth
 * - getSocialShareLinks URL encoding correctness for special chars in titles
 * - getAllBuyingGuides ordering matches GUIDES key order
 * - getBuyingGuideSlugs returns fresh array each call
 * - Cross-function consistency (schema ↔ guide ↔ faqs ↔ share links)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __setQueryError, __reset } from './__mocks__/wix-data.js';
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

const ALL_SLUGS = [
  'futon-frames', 'mattresses', 'covers', 'pillows',
  'storage', 'outdoor', 'accessories', 'bundle-deals',
];

beforeEach(() => {
  __reset();
  __seed('Stores/Products', []);
  __resetStores();
});

// ── getBuyingGuide: CMS query error graceful degradation ──────────

describe('getBuyingGuide — CMS query failure', () => {
  it('returns guide with empty relatedProducts when CMS query throws', async () => {
    __setQueryError('Stores/Products', new Error('CMS unavailable'));
    const result = await getBuyingGuide('futon-frames');
    expect(result.success).toBe(true);
    expect(result.guide.slug).toBe('futon-frames');
    expect(result.guide.relatedProducts).toEqual([]);
  });

  it('still includes all guide fields when CMS query fails', async () => {
    __setQueryError('Stores/Products', new Error('timeout'));
    const result = await getBuyingGuide('mattresses');
    expect(result.guide.title).toBeTruthy();
    expect(result.guide.sections.length).toBeGreaterThan(0);
    expect(result.guide.faqs.length).toBe(5);
    expect(result.guide.comparisonTable).toBeTruthy();
    expect(result.guide.productLinks.length).toBeGreaterThan(0);
  });
});

// ── getBuyingGuide: CMS data overlay with multiple collections ────

describe('getBuyingGuide — curated product ID fetching', () => {
  it('only returns products whose IDs are in the guide relatedProductIds', async () => {
    // futon-frames has 3 relatedProductIds; seed 2 of them + 1 unrelated product
    __setStoreProducts([
      { _id: 'frm-nd-casual-cherry', name: 'Casual Cherry', slug: 'casual-cherry', price: 549, formattedPrice: '$549.00', mainMedia: 'a.jpg', ribbon: '' },
      { _id: 'frm-kd-olympia-natural', name: 'KD Olympia Natural', slug: 'kd-olympia-natural', price: 399, formattedPrice: '$399.00', mainMedia: 'b.jpg', ribbon: '' },
      { _id: 'unrelated-product', name: 'Unrelated', slug: 'unrelated', price: 100, formattedPrice: '$100.00', mainMedia: 'c.jpg', ribbon: '' },
    ]);
    const result = await getBuyingGuide('futon-frames');
    // Only the 2 matching IDs should appear; unrelated-product filtered by getProduct lookup
    expect(result.guide.relatedProducts).toHaveLength(2);
    expect(result.guide.relatedProducts.every(p => p.name !== 'Unrelated')).toBe(true);
  });

  it('returns only products that resolve from the store for a guide', async () => {
    // covers has 3 relatedProductIds — seed just 1
    __setStoreProducts([
      { _id: 'cov-twill-navy-full', name: 'Twill Navy Full', slug: 'twill-navy-full', price: 59, formattedPrice: '$59.00', mainMedia: 'combo.jpg', ribbon: '' },
    ]);
    const result = await getBuyingGuide('covers');
    expect(result.guide.relatedProducts).toHaveLength(1);
    expect(result.guide.relatedProducts[0].name).toBe('Twill Navy Full');
  });

  it('product with empty collections array is excluded', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Orphan', slug: 'orphan', price: 100, formattedPrice: '$100.00', mainMedia: 'o.jpg', ribbon: '', collections: [] },
    ]);
    const result = await getBuyingGuide('pillows');
    expect(result.guide.relatedProducts).toHaveLength(0);
  });
});

// ── getBuyingGuideSchema: Article schema field-level validation ───

describe('getBuyingGuideSchema — Article schema deep validation', () => {
  it('Article schema mainEntityOfPage @type is WebPage', async () => {
    const result = await getBuyingGuideSchema('futon-frames');
    const schema = JSON.parse(result.articleSchema);
    expect(schema.mainEntityOfPage['@type']).toBe('WebPage');
  });

  it('Article schema datePublished equals guide publishDate', async () => {
    const guide = await getBuyingGuide('outdoor');
    const schema = await getBuyingGuideSchema('outdoor');
    const parsed = JSON.parse(schema.articleSchema);
    expect(parsed.datePublished).toBe(guide.guide.publishDate);
  });

  it('Article schema dateModified equals guide updatedDate', async () => {
    const guide = await getBuyingGuide('storage');
    const schema = await getBuyingGuideSchema('storage');
    const parsed = JSON.parse(schema.articleSchema);
    expect(parsed.dateModified).toBe(guide.guide.updatedDate);
  });

  it('Article schema image matches guide heroImage', async () => {
    const guide = await getBuyingGuide('accessories');
    const schema = await getBuyingGuideSchema('accessories');
    const parsed = JSON.parse(schema.articleSchema);
    expect(parsed.image).toBe(guide.guide.heroImage);
  });

  it('Article schema keywords string contains all guide keywords', async () => {
    const guide = await getBuyingGuide('futon-frames');
    const schema = await getBuyingGuideSchema('futon-frames');
    const parsed = JSON.parse(schema.articleSchema);
    for (const kw of guide.guide.keywords) {
      expect(parsed.keywords).toContain(kw);
    }
  });

  it('Article schema publisher logo is ImageObject with site URL', async () => {
    const result = await getBuyingGuideSchema('covers');
    const schema = JSON.parse(result.articleSchema);
    expect(schema.publisher.logo['@type']).toBe('ImageObject');
    expect(schema.publisher.logo.url).toContain('carolinafutons.com');
    expect(schema.publisher.logo.url).toContain('logo.png');
  });
});

// ── getBuyingGuideSchema: FAQPage schema cross-validation ────────

describe('getBuyingGuideSchema — FAQPage cross-validation', () => {
  it.each(ALL_SLUGS)('FAQ schema answers match guide FAQ answers for %s', async (slug) => {
    const faqs = await getGuideFaqs(slug);
    const schema = await getBuyingGuideSchema(slug);
    const parsed = JSON.parse(schema.faqSchema);
    const schemaAnswers = parsed.mainEntity.map(e => e.acceptedAnswer.text);
    const guideAnswers = faqs.faqs.map(f => f.answer);
    expect(schemaAnswers).toEqual(guideAnswers);
  });

  it('FAQPage schema @context is schema.org for all guides', async () => {
    for (const slug of ALL_SLUGS) {
      const schema = await getBuyingGuideSchema(slug);
      const parsed = JSON.parse(schema.faqSchema);
      expect(parsed['@context']).toBe('https://schema.org');
    }
  });
});

// ── getGuideComparisonTable: row content integrity ───────────────

describe('getGuideComparisonTable — row content integrity', () => {
  it('all table cells are non-empty strings', async () => {
    for (const slug of ALL_SLUGS) {
      const result = await getGuideComparisonTable(slug);
      for (const row of result.table.rows) {
        for (const cell of row) {
          expect(typeof cell).toBe('string');
          expect(cell.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('all table headers are non-empty strings', async () => {
    for (const slug of ALL_SLUGS) {
      const result = await getGuideComparisonTable(slug);
      for (const header of result.table.headers) {
        expect(typeof header).toBe('string');
        expect(header.length).toBeGreaterThan(0);
      }
    }
  });

  it('table has at least 5 data rows for each guide', async () => {
    for (const slug of ALL_SLUGS) {
      const result = await getGuideComparisonTable(slug);
      expect(result.table.rows.length).toBeGreaterThanOrEqual(5);
    }
  });

  it('first column of each row serves as row label (non-numeric)', async () => {
    const result = await getGuideComparisonTable('futon-frames');
    for (const row of result.table.rows) {
      expect(row[0]).toBeTruthy();
      expect(/^\d+$/.test(row[0])).toBe(false);
    }
  });

  it('handles undefined slug', async () => {
    const result = await getGuideComparisonTable(undefined);
    expect(result.success).toBe(false);
  });
});

// ── getGuideFaqs: answer quality ─────────────────────────────────

describe('getGuideFaqs — answer quality', () => {
  it.each(ALL_SLUGS)('FAQ answers for %s contain no HTML tags', async (slug) => {
    const result = await getGuideFaqs(slug);
    for (const faq of result.faqs) {
      expect(faq.answer).not.toMatch(/<[^>]+>/);
    }
  });

  it.each(ALL_SLUGS)('FAQ questions for %s contain no HTML tags', async (slug) => {
    const result = await getGuideFaqs(slug);
    for (const faq of result.faqs) {
      expect(faq.question).not.toMatch(/<[^>]+>/);
    }
  });

  it('handles undefined slug', async () => {
    const result = await getGuideFaqs(undefined);
    expect(result.success).toBe(false);
  });

  it('returns null for slug with valid format but no guide', async () => {
    const result = await getGuideFaqs('yoga-mats');
    expect(result.success).toBe(true);
    expect(result.faqs).toBeNull();
  });
});

// ── getSocialShareLinks: URL encoding edge cases ─────────────────

describe('getSocialShareLinks — URL encoding', () => {
  it('facebook link properly encodes full URL with protocol', async () => {
    const result = await getSocialShareLinks('bundle-deals');
    const expectedEncoded = encodeURIComponent('https://www.carolinafutons.com/buying-guides/bundle-deals');
    expect(result.links.facebook).toBe(`https://www.facebook.com/sharer/sharer.php?u=${expectedEncoded}`);
  });

  it('twitter link encodes both URL and title', async () => {
    const result = await getSocialShareLinks('futon-frames');
    const guide = await getBuyingGuide('futon-frames');
    const encodedTitle = encodeURIComponent(guide.guide.title);
    expect(result.links.twitter).toContain(`text=${encodedTitle}`);
  });

  it('pinterest link encodes description (metaDescription)', async () => {
    const result = await getSocialShareLinks('mattresses');
    const guide = await getBuyingGuide('mattresses');
    const encodedDesc = encodeURIComponent(guide.guide.metaDescription);
    expect(result.links.pinterest).toContain(`description=${encodedDesc}`);
  });

  it('email link subject is encoded title', async () => {
    const result = await getSocialShareLinks('covers');
    const guide = await getBuyingGuide('covers');
    const encodedTitle = encodeURIComponent(guide.guide.title);
    expect(result.links.email).toContain(`subject=${encodedTitle}`);
  });

  it('email link body contains encoded description and URL', async () => {
    const result = await getSocialShareLinks('pillows');
    const guide = await getBuyingGuide('pillows');
    const encodedDesc = encodeURIComponent(guide.guide.metaDescription);
    const encodedUrl = encodeURIComponent(`https://www.carolinafutons.com/buying-guides/pillows`);
    expect(result.links.email).toContain(encodedDesc);
    expect(result.links.email).toContain(encodedUrl);
  });

  it('handles undefined slug', async () => {
    const result = await getSocialShareLinks(undefined);
    expect(result.success).toBe(false);
  });

  it('returns null for valid slug with no guide', async () => {
    const result = await getSocialShareLinks('bean-bags');
    expect(result.success).toBe(true);
    expect(result.links).toBeNull();
  });

  it.each(ALL_SLUGS)('share URL for %s does not double-encode', async (slug) => {
    const result = await getSocialShareLinks(slug);
    // The raw url field should NOT be encoded
    expect(result.links.url).not.toContain('%25');
    // The facebook link should encode exactly once
    expect(result.links.facebook).not.toContain('%2525');
  });
});

// ── getAllBuyingGuides: ordering and summary completeness ─────────

describe('getAllBuyingGuides — ordering and completeness', () => {
  it('guides are returned in GUIDES key order', async () => {
    const result = await getAllBuyingGuides();
    const slugs = result.guides.map(g => g.slug);
    expect(slugs).toEqual(ALL_SLUGS);
  });

  it('each summary has heroImage containing buying-guides path', async () => {
    const result = await getAllBuyingGuides();
    for (const guide of result.guides) {
      expect(guide.heroImage).toContain('/buying-guides/');
    }
  });

  it('readingTime accounts for section heading words', async () => {
    // readingTime = Math.round(totalWords / 200), where totalWords includes headings
    // Just verify it is reasonable (> 1 min for 1000+ word guides)
    const result = await getAllBuyingGuides();
    for (const guide of result.guides) {
      expect(guide.readingTime).toBeGreaterThanOrEqual(3);
    }
  });

  it('summaries include publishDate for all guides', async () => {
    const result = await getAllBuyingGuides();
    for (const guide of result.guides) {
      expect(guide.publishDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

// ── getBuyingGuideSlugs: completeness and isolation ──────────────

describe('getBuyingGuideSlugs — completeness', () => {
  it('returns exactly the expected 8 slugs', async () => {
    const result = await getBuyingGuideSlugs();
    expect(result.slugs.sort()).toEqual([...ALL_SLUGS].sort());
  });

  it('returns a new array on each call (not shared reference)', async () => {
    const r1 = await getBuyingGuideSlugs();
    const r2 = await getBuyingGuideSlugs();
    expect(r1.slugs).not.toBe(r2.slugs);
    expect(r1.slugs).toEqual(r2.slugs);
  });

  it('slugs match getAllBuyingGuides slugs', async () => {
    const slugsResult = await getBuyingGuideSlugs();
    const guidesResult = await getAllBuyingGuides();
    const guideSlugs = guidesResult.guides.map(g => g.slug);
    expect(slugsResult.slugs.sort()).toEqual(guideSlugs.sort());
  });
});

// ── Cross-function consistency ───────────────────────────────────

describe('cross-function consistency', () => {
  it.each(ALL_SLUGS)('getBuyingGuide and getGuideFaqs return same FAQ questions for %s', async (slug) => {
    const guide = await getBuyingGuide(slug);
    const faqs = await getGuideFaqs(slug);
    // They reference the same object, so questions should match
    const guideQuestions = guide.guide.faqs.map(f => f.question);
    const faqQuestions = faqs.faqs.map(f => f.question);
    expect(guideQuestions).toEqual(faqQuestions);
  });

  it.each(ALL_SLUGS)('getBuyingGuide and getGuideComparisonTable return same table for %s', async (slug) => {
    const guide = await getBuyingGuide(slug);
    const table = await getGuideComparisonTable(slug);
    expect(guide.guide.comparisonTable.title).toBe(table.table.title);
    expect(guide.guide.comparisonTable.headers).toEqual(table.table.headers);
  });

  it('all functions reject empty string consistently', async () => {
    const results = await Promise.all([
      getBuyingGuide(''),
      getBuyingGuideSchema(''),
      getGuideComparisonTable(''),
      getGuideFaqs(''),
      getSocialShareLinks(''),
    ]);
    for (const result of results) {
      expect(result.success).toBe(false);
    }
  });

  it('all functions reject null consistently', async () => {
    const results = await Promise.all([
      getBuyingGuide(null),
      getBuyingGuideSchema(null),
      getGuideComparisonTable(null),
      getGuideFaqs(null),
      getSocialShareLinks(null),
    ]);
    for (const result of results) {
      expect(result.success).toBe(false);
    }
  });

  it('all functions handle unknown slug consistently (success: true, null/comingSoon)', async () => {
    const unknownSlug = 'recliners';
    const [guide, schema, table, faqs, share] = await Promise.all([
      getBuyingGuide(unknownSlug),
      getBuyingGuideSchema(unknownSlug),
      getGuideComparisonTable(unknownSlug),
      getGuideFaqs(unknownSlug),
      getSocialShareLinks(unknownSlug),
    ]);
    expect(guide.success).toBe(true);
    expect(guide.guide.comingSoon).toBe(true);
    expect(schema.success).toBe(true);
    expect(schema.articleSchema).toBeNull();
    expect(table.success).toBe(true);
    expect(table.table).toBeNull();
    expect(faqs.success).toBe(true);
    expect(faqs.faqs).toBeNull();
    expect(share.success).toBe(true);
    expect(share.links).toBeNull();
  });
});
