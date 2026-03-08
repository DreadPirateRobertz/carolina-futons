import { describe, it, expect } from 'vitest';
import {
  getBlogSlugs,
  getBlogPost,
  getBlogFaqs,
  getAllBlogPosts,
  getBuyingGuideSlugs,
  getBuyingGuide,
  getAllBuyingGuides,
  getBuyingGuideFaqs,
  getBuyingGuideComparisonTable,
  getPlaceholderGuide,
  getBuyingGuideWordCount,
} from '../../src/backend/blogContent.js';
import {
  getBlogArticleSchema,
  getBlogFaqSchema,
} from '../../src/backend/seoHelpers.web.js';

const EXPECTED_SLUGS = [
  'best-futons-for-everyday-sleeping',
  'futon-frame-buying-guide',
  'how-to-choose-futon-mattress',
  'murphy-bed-vs-futon',
  'futon-care-guide',
  'futon-vs-sofa-bed',
  'small-space-furniture-guide',
  'platform-bed-guide',
];

// ── blogContent exports ──────────────────────────────────────────────

describe('getBlogSlugs', () => {
  it('returns all 8 pillar post slugs', () => {
    const slugs = getBlogSlugs();
    expect(slugs).toHaveLength(8);
    for (const expected of EXPECTED_SLUGS) {
      expect(slugs).toContain(expected);
    }
  });
});

describe('getBlogPost', () => {
  it('returns null for unknown slug', () => {
    expect(getBlogPost('nonexistent-slug')).toBeNull();
  });

  it.each(EXPECTED_SLUGS)('returns valid post data for %s', (slug) => {
    const post = getBlogPost(slug);
    expect(post).toBeTruthy();
    expect(post.slug).toBe(slug);
    expect(post.title).toBeTruthy();
    expect(post.title.length).toBeGreaterThan(10);
    expect(post.metaDescription).toBeTruthy();
    expect(post.metaDescription.length).toBeLessThanOrEqual(160);
    expect(post.keywords).toBeInstanceOf(Array);
    expect(post.keywords.length).toBeGreaterThanOrEqual(3);
    expect(post.excerpt).toBeTruthy();
    expect(post.category).toBeTruthy();
    expect(post.tags).toBeInstanceOf(Array);
    expect(post.tags.length).toBeGreaterThanOrEqual(2);
    expect(post.publishDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getBlogFaqs', () => {
  it('returns null for unknown slug', () => {
    expect(getBlogFaqs('nonexistent')).toBeNull();
  });

  it.each(EXPECTED_SLUGS)('returns 4-5 FAQs for %s', (slug) => {
    const faqs = getBlogFaqs(slug);
    expect(faqs).toBeInstanceOf(Array);
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs.length).toBeLessThanOrEqual(5);
  });

  it.each(EXPECTED_SLUGS)('FAQs have question and answer fields for %s', (slug) => {
    const faqs = getBlogFaqs(slug);
    for (const faq of faqs) {
      expect(faq.question).toBeTruthy();
      expect(faq.question.endsWith('?')).toBe(true);
      expect(faq.answer).toBeTruthy();
      expect(faq.answer.length).toBeGreaterThan(20);
    }
  });
});

describe('getAllBlogPosts', () => {
  it('returns array of all 8 posts', () => {
    const posts = getAllBlogPosts();
    expect(posts).toHaveLength(8);
    for (const post of posts) {
      expect(post.slug).toBeTruthy();
      expect(post.title).toBeTruthy();
      expect(post.faqs).toBeInstanceOf(Array);
    }
  });
});

// ── Blog schema functions in seoHelpers ──────────────────────────────

describe('getBlogArticleSchema', () => {
  it('returns null for null input', () => {
    expect(getBlogArticleSchema(null)).toBeNull();
  });

  it('returns null for empty object', () => {
    expect(getBlogArticleSchema({})).toBeNull();
  });

  it('generates valid Article JSON-LD', () => {
    const post = getBlogPost('best-futons-for-everyday-sleeping');
    const json = getBlogArticleSchema(post);
    expect(json).toBeTruthy();
    const schema = JSON.parse(json);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Article');
    expect(schema.headline).toBe(post.title);
    expect(schema.description).toBe(post.metaDescription);
  });

  it('includes publisher info', () => {
    const post = getBlogPost('futon-frame-buying-guide');
    const schema = JSON.parse(getBlogArticleSchema(post));
    expect(schema.publisher['@type']).toBe('Organization');
    expect(schema.publisher.name).toBe('Carolina Futons');
    expect(schema.publisher.logo).toBeTruthy();
  });

  it('includes author as Organization', () => {
    const post = getBlogPost('murphy-bed-vs-futon');
    const schema = JSON.parse(getBlogArticleSchema(post));
    expect(schema.author['@type']).toBe('Organization');
    expect(schema.author.name).toBe('Carolina Futons');
  });

  it('includes mainEntityOfPage with blog URL', () => {
    const post = getBlogPost('platform-bed-guide');
    const schema = JSON.parse(getBlogArticleSchema(post));
    expect(schema.mainEntityOfPage['@id']).toContain('/blog/platform-bed-guide');
  });

  it('includes keywords when present', () => {
    const post = getBlogPost('futon-vs-sofa-bed');
    const schema = JSON.parse(getBlogArticleSchema(post));
    expect(schema.keywords).toBeTruthy();
    expect(schema.keywords).toContain('futon vs sofa bed');
  });

  it('includes publishDate', () => {
    const post = getBlogPost('futon-care-guide');
    const schema = JSON.parse(getBlogArticleSchema(post));
    expect(schema.datePublished).toBe('2026-02-20');
    expect(schema.dateModified).toBe('2026-02-20');
  });
});

describe('getBlogFaqSchema', () => {
  it('returns null for unknown slug', () => {
    expect(getBlogFaqSchema('nonexistent-slug')).toBeNull();
  });

  it.each(EXPECTED_SLUGS)('generates valid FAQPage schema for %s', (slug) => {
    const json = getBlogFaqSchema(slug);
    expect(json).toBeTruthy();
    const schema = JSON.parse(json);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.mainEntity).toBeInstanceOf(Array);
    expect(schema.mainEntity.length).toBeGreaterThanOrEqual(4);
  });

  it('FAQ entities have correct Question/Answer structure', () => {
    const schema = JSON.parse(getBlogFaqSchema('best-futons-for-everyday-sleeping'));
    for (const entity of schema.mainEntity) {
      expect(entity['@type']).toBe('Question');
      expect(entity.name).toBeTruthy();
      expect(entity.acceptedAnswer['@type']).toBe('Answer');
      expect(entity.acceptedAnswer.text).toBeTruthy();
    }
  });

  it('first FAQ for everyday sleeping post is about sleeping on futon', () => {
    const schema = JSON.parse(getBlogFaqSchema('best-futons-for-everyday-sleeping'));
    expect(schema.mainEntity[0].name).toContain('sleep on a futon every night');
  });
});

// ── Category Buying Guides ──────────────────────────────────────────

const EXPECTED_GUIDE_SLUGS = [
  'futon-frames',
  'futon-mattresses',
  'futon-covers',
  'pillows-bolsters',
  'storage-solutions',
  'outdoor-futons',
  'accessories',
  'bundle-deals',
];

describe('getBuyingGuideSlugs', () => {
  it('returns all 8 category slugs', () => {
    const slugs = getBuyingGuideSlugs();
    expect(slugs).toHaveLength(8);
    for (const expected of EXPECTED_GUIDE_SLUGS) {
      expect(slugs).toContain(expected);
    }
  });

  it('returns a new array each call (not a reference)', () => {
    const a = getBuyingGuideSlugs();
    const b = getBuyingGuideSlugs();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('getBuyingGuide', () => {
  it('returns null for unknown slug', () => {
    expect(getBuyingGuide('nonexistent')).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(getBuyingGuide('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getBuyingGuide(null)).toBeNull();
  });

  it.each(EXPECTED_GUIDE_SLUGS)('returns valid guide for %s', (slug) => {
    const guide = getBuyingGuide(slug);
    expect(guide).toBeTruthy();
    expect(guide.categorySlug).toBe(slug);
    expect(guide.categoryName).toBeTruthy();
    expect(guide.title).toBeTruthy();
    expect(guide.title.length).toBeGreaterThan(20);
    expect(guide.metaDescription).toBeTruthy();
    expect(guide.metaDescription.length).toBeLessThanOrEqual(160);
    expect(guide.keywords).toBeInstanceOf(Array);
    expect(guide.keywords.length).toBeGreaterThanOrEqual(3);
    expect(guide.excerpt).toBeTruthy();
    expect(guide.category).toBe('Buying Guides');
    expect(guide.tags).toBeInstanceOf(Array);
    expect(guide.tags.length).toBeGreaterThanOrEqual(2);
    expect(guide.publishDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(EXPECTED_GUIDE_SLUGS)('guide %s has sections with heading and content', (slug) => {
    const guide = getBuyingGuide(slug);
    expect(guide.sections).toBeInstanceOf(Array);
    expect(guide.sections.length).toBeGreaterThanOrEqual(4);
    for (const section of guide.sections) {
      expect(section.heading).toBeTruthy();
      expect(section.content).toBeTruthy();
      expect(section.content.length).toBeGreaterThan(50);
    }
  });

  it.each(EXPECTED_GUIDE_SLUGS)('guide %s has relatedProductCategory', (slug) => {
    const guide = getBuyingGuide(slug);
    expect(guide.relatedProductCategory).toBeTruthy();
  });

  it.each(EXPECTED_GUIDE_SLUGS)('guide %s has internal links', (slug) => {
    const guide = getBuyingGuide(slug);
    expect(guide.internalLinks).toBeInstanceOf(Array);
    expect(guide.internalLinks.length).toBeGreaterThanOrEqual(2);
    for (const link of guide.internalLinks) {
      expect(link.text).toBeTruthy();
      expect(link.url).toBeTruthy();
      expect(link.url.startsWith('/')).toBe(true);
    }
  });

  it.each(EXPECTED_GUIDE_SLUGS)('guide %s has a unique slug field', (slug) => {
    const guide = getBuyingGuide(slug);
    expect(guide.slug).toBeTruthy();
    expect(guide.slug).toContain('buying-guide');
  });
});

describe('getAllBuyingGuides', () => {
  it('returns array of all 8 guides', () => {
    const guides = getAllBuyingGuides();
    expect(guides).toHaveLength(8);
    for (const guide of guides) {
      expect(guide.categorySlug).toBeTruthy();
      expect(guide.title).toBeTruthy();
      expect(guide.sections).toBeInstanceOf(Array);
    }
  });
});

describe('getBuyingGuideFaqs', () => {
  it('returns null for unknown slug', () => {
    expect(getBuyingGuideFaqs('nonexistent')).toBeNull();
  });

  it.each(EXPECTED_GUIDE_SLUGS)('returns 4-5 FAQs for %s', (slug) => {
    const faqs = getBuyingGuideFaqs(slug);
    expect(faqs).toBeInstanceOf(Array);
    expect(faqs.length).toBeGreaterThanOrEqual(4);
    expect(faqs.length).toBeLessThanOrEqual(5);
  });

  it.each(EXPECTED_GUIDE_SLUGS)('FAQs have question and answer fields for %s', (slug) => {
    const faqs = getBuyingGuideFaqs(slug);
    for (const faq of faqs) {
      expect(faq.question).toBeTruthy();
      expect(faq.question.endsWith('?')).toBe(true);
      expect(faq.answer).toBeTruthy();
      expect(faq.answer.length).toBeGreaterThan(20);
    }
  });
});

describe('getBuyingGuideComparisonTable', () => {
  it('returns null for unknown slug', () => {
    expect(getBuyingGuideComparisonTable('nonexistent')).toBeNull();
  });

  it.each(EXPECTED_GUIDE_SLUGS)('returns valid table for %s', (slug) => {
    const table = getBuyingGuideComparisonTable(slug);
    expect(table).toBeTruthy();
    expect(table.headers).toBeInstanceOf(Array);
    expect(table.headers.length).toBeGreaterThanOrEqual(3);
    expect(table.rows).toBeInstanceOf(Array);
    expect(table.rows.length).toBeGreaterThanOrEqual(4);
  });

  it.each(EXPECTED_GUIDE_SLUGS)('table rows match header count for %s', (slug) => {
    const table = getBuyingGuideComparisonTable(slug);
    for (const row of table.rows) {
      expect(row).toHaveLength(table.headers.length);
    }
  });
});

describe('getPlaceholderGuide', () => {
  it('returns null for empty input', () => {
    expect(getPlaceholderGuide('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getPlaceholderGuide(null)).toBeNull();
  });

  it('returns placeholder with isPlaceholder flag', () => {
    const placeholder = getPlaceholderGuide('New Category');
    expect(placeholder.isPlaceholder).toBe(true);
  });

  it('includes category name in title and description', () => {
    const placeholder = getPlaceholderGuide('Bean Bags');
    expect(placeholder.title).toContain('Bean Bags');
    expect(placeholder.metaDescription).toContain('Bean Bags');
    expect(placeholder.categoryName).toBe('Bean Bags');
  });

  it('has empty sections and faqs', () => {
    const placeholder = getPlaceholderGuide('Test Category');
    expect(placeholder.sections).toEqual([]);
    expect(placeholder.faqs).toEqual([]);
    expect(placeholder.comparisonTable).toBeNull();
    expect(placeholder.publishDate).toBeNull();
  });
});

describe('getBuyingGuideWordCount', () => {
  it('returns 0 for unknown slug', () => {
    expect(getBuyingGuideWordCount('nonexistent')).toBe(0);
  });

  it.each(EXPECTED_GUIDE_SLUGS)('guide %s exceeds 1000 words', (slug) => {
    const count = getBuyingGuideWordCount(slug);
    expect(count).toBeGreaterThan(1000);
  });
});
