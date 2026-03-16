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
} from '../src/backend/blogContent.js';
import {
  getBlogArticleSchema,
  getBlogFaqSchema,
} from '../src/backend/seoHelpers.web.js';

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

  it('returns unique slugs (no duplicates)', () => {
    const slugs = getBlogSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('all slugs are lowercase kebab-case', () => {
    const slugs = getBlogSlugs();
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe('getBlogPost', () => {
  it('returns null for unknown slug', () => {
    expect(getBlogPost('nonexistent-slug')).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getBlogPost(undefined)).toBeNull();
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

  it('all posts have unique titles', () => {
    const titles = EXPECTED_SLUGS.map(s => getBlogPost(s).title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('all posts have unique meta descriptions', () => {
    const descs = EXPECTED_SLUGS.map(s => getBlogPost(s).metaDescription);
    expect(new Set(descs).size).toBe(descs.length);
  });

  it('all posts have unique excerpts', () => {
    const excerpts = EXPECTED_SLUGS.map(s => getBlogPost(s).excerpt);
    expect(new Set(excerpts).size).toBe(excerpts.length);
  });

  it.each(EXPECTED_SLUGS)('post %s has a valid category', (slug) => {
    const validCategories = ['Buying Guides', 'Comparisons', 'Care & Maintenance', 'Lifestyle'];
    expect(validCategories).toContain(getBlogPost(slug).category);
  });

  it.each(EXPECTED_SLUGS)('post %s excerpt is between 50-300 chars', (slug) => {
    const len = getBlogPost(slug).excerpt.length;
    expect(len).toBeGreaterThanOrEqual(50);
    expect(len).toBeLessThanOrEqual(300);
  });

  it.each(EXPECTED_SLUGS)('post %s keywords are all lowercase strings', (slug) => {
    const post = getBlogPost(slug);
    for (const kw of post.keywords) {
      expect(typeof kw).toBe('string');
      expect(kw).toBe(kw.toLowerCase());
      expect(kw.length).toBeGreaterThan(0);
    }
  });

  it.each(EXPECTED_SLUGS)('post %s tags are non-empty strings', (slug) => {
    const post = getBlogPost(slug);
    for (const tag of post.tags) {
      expect(typeof tag).toBe('string');
      expect(tag.length).toBeGreaterThan(0);
    }
  });

  it.each(EXPECTED_SLUGS)('post %s title is under 80 chars (SEO best practice)', (slug) => {
    expect(getBlogPost(slug).title.length).toBeLessThanOrEqual(80);
  });

  it.each(EXPECTED_SLUGS)('post %s metaDescription is at least 50 chars', (slug) => {
    expect(getBlogPost(slug).metaDescription.length).toBeGreaterThanOrEqual(50);
  });
});

describe('getBlogFaqs', () => {
  it('returns null for unknown slug', () => {
    expect(getBlogFaqs('nonexistent')).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getBlogFaqs(undefined)).toBeNull();
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

  it.each(EXPECTED_SLUGS)('FAQ questions are unique within %s', (slug) => {
    const faqs = getBlogFaqs(slug);
    const questions = faqs.map(f => f.question);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it.each(EXPECTED_SLUGS)('FAQ answers are substantive (>50 chars) for %s', (slug) => {
    const faqs = getBlogFaqs(slug);
    for (const faq of faqs) {
      expect(faq.answer.length).toBeGreaterThan(50);
    }
  });

  it('returns same reference as post.faqs', () => {
    const post = getBlogPost('best-futons-for-everyday-sleeping');
    const faqs = getBlogFaqs('best-futons-for-everyday-sleeping');
    expect(faqs).toBe(post.faqs);
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

  it('contains the same posts accessible via getBlogPost', () => {
    const all = getAllBlogPosts();
    const slugs = all.map(p => p.slug);
    expect(slugs.sort()).toEqual([...EXPECTED_SLUGS].sort());
  });

  it('every post has all required fields', () => {
    const requiredFields = ['slug', 'title', 'metaDescription', 'keywords', 'excerpt', 'category', 'tags', 'publishDate', 'faqs'];
    const posts = getAllBlogPosts();
    for (const post of posts) {
      for (const field of requiredFields) {
        expect(post).toHaveProperty(field);
        expect(post[field]).not.toBeNull();
        expect(post[field]).not.toBeUndefined();
      }
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

  it.each(EXPECTED_SLUGS)('generates parseable JSON-LD for every post %s', (slug) => {
    const post = getBlogPost(slug);
    const json = getBlogArticleSchema(post);
    expect(json).toBeTruthy();
    expect(() => JSON.parse(json)).not.toThrow();
    const schema = JSON.parse(json);
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('Article');
    expect(schema.headline).toBe(post.title);
  });

  it.each(EXPECTED_SLUGS)('schema mainEntityOfPage uses post slug for %s', (slug) => {
    const post = getBlogPost(slug);
    const schema = JSON.parse(getBlogArticleSchema(post));
    expect(schema.mainEntityOfPage['@id']).toContain(`/blog/${slug}`);
  });

  it.each(EXPECTED_SLUGS)('schema datePublished matches post publishDate for %s', (slug) => {
    const post = getBlogPost(slug);
    const schema = JSON.parse(getBlogArticleSchema(post));
    expect(schema.datePublished).toBe(post.publishDate);
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

  it.each(EXPECTED_SLUGS)('FAQ schema entity count matches post FAQs for %s', (slug) => {
    const schema = JSON.parse(getBlogFaqSchema(slug));
    const postFaqs = getBlogFaqs(slug);
    expect(schema.mainEntity).toHaveLength(postFaqs.length);
  });

  it.each(EXPECTED_SLUGS)('FAQ schema questions match post FAQ questions for %s', (slug) => {
    const schema = JSON.parse(getBlogFaqSchema(slug));
    const postFaqs = getBlogFaqs(slug);
    for (let i = 0; i < postFaqs.length; i++) {
      expect(schema.mainEntity[i].name).toBe(postFaqs[i].question);
      expect(schema.mainEntity[i].acceptedAnswer.text).toBe(postFaqs[i].answer);
    }
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

  it('returns unique slugs (no duplicates)', () => {
    const slugs = getBuyingGuideSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('all guide category slugs are lowercase kebab-case', () => {
    const slugs = getBuyingGuideSlugs();
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
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

  it('returns null for undefined input', () => {
    expect(getBuyingGuide(undefined)).toBeNull();
  });

  it('all guides have unique titles', () => {
    const titles = EXPECTED_GUIDE_SLUGS.map(s => getBuyingGuide(s).title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('all guides have unique slugs', () => {
    const slugs = EXPECTED_GUIDE_SLUGS.map(s => getBuyingGuide(s).slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('all guides have unique meta descriptions', () => {
    const descs = EXPECTED_GUIDE_SLUGS.map(s => getBuyingGuide(s).metaDescription);
    expect(new Set(descs).size).toBe(descs.length);
  });

  it.each(EXPECTED_GUIDE_SLUGS)('guide %s categoryName is non-empty title case', (slug) => {
    const name = getBuyingGuide(slug).categoryName;
    expect(name.length).toBeGreaterThan(0);
    expect(name[0]).toBe(name[0].toUpperCase());
  });

  it.each(EXPECTED_GUIDE_SLUGS)('guide %s excerpt is between 50-400 chars', (slug) => {
    const len = getBuyingGuide(slug).excerpt.length;
    expect(len).toBeGreaterThanOrEqual(50);
    expect(len).toBeLessThanOrEqual(400);
  });

  it.each(EXPECTED_GUIDE_SLUGS)('guide %s section headings are unique', (slug) => {
    const headings = getBuyingGuide(slug).sections.map(s => s.heading);
    expect(new Set(headings).size).toBe(headings.length);
  });

  it.each(EXPECTED_GUIDE_SLUGS)('guide %s has between 4-8 sections', (slug) => {
    const len = getBuyingGuide(slug).sections.length;
    expect(len).toBeGreaterThanOrEqual(4);
    expect(len).toBeLessThanOrEqual(8);
  });

  it.each(EXPECTED_GUIDE_SLUGS)('guide %s internal link URLs are unique', (slug) => {
    const urls = getBuyingGuide(slug).internalLinks.map(l => l.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it.each(EXPECTED_GUIDE_SLUGS)('guide %s keywords are non-empty strings', (slug) => {
    for (const kw of getBuyingGuide(slug).keywords) {
      expect(typeof kw).toBe('string');
      expect(kw.length).toBeGreaterThan(0);
    }
  });

  it.each(EXPECTED_GUIDE_SLUGS)('guide %s slug contains categorySlug', (slug) => {
    const guide = getBuyingGuide(slug);
    expect(guide.slug).toContain(guide.categorySlug);
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

  it('contains the same guides accessible via getBuyingGuide', () => {
    const all = getAllBuyingGuides();
    const slugs = all.map(g => g.categorySlug);
    expect(slugs.sort()).toEqual([...EXPECTED_GUIDE_SLUGS].sort());
  });

  it('every guide has all required fields', () => {
    const requiredFields = ['slug', 'categorySlug', 'categoryName', 'title', 'metaDescription', 'keywords', 'excerpt', 'category', 'tags', 'publishDate', 'relatedProductCategory', 'internalLinks', 'sections', 'comparisonTable', 'faqs'];
    const guides = getAllBuyingGuides();
    for (const guide of guides) {
      for (const field of requiredFields) {
        expect(guide).toHaveProperty(field);
      }
    }
  });

  it('no guide has isPlaceholder flag', () => {
    const guides = getAllBuyingGuides();
    for (const guide of guides) {
      expect(guide.isPlaceholder).toBeUndefined();
    }
  });
});

describe('getBuyingGuideFaqs', () => {
  it('returns null for unknown slug', () => {
    expect(getBuyingGuideFaqs('nonexistent')).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getBuyingGuideFaqs(undefined)).toBeNull();
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

  it.each(EXPECTED_GUIDE_SLUGS)('FAQ questions are unique within %s', (slug) => {
    const faqs = getBuyingGuideFaqs(slug);
    const questions = faqs.map(f => f.question);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it.each(EXPECTED_GUIDE_SLUGS)('FAQ answers are substantive (>80 chars) for %s', (slug) => {
    const faqs = getBuyingGuideFaqs(slug);
    for (const faq of faqs) {
      expect(faq.answer.length).toBeGreaterThan(80);
    }
  });

  it('returns same reference as guide.faqs', () => {
    const guide = getBuyingGuide('futon-frames');
    const faqs = getBuyingGuideFaqs('futon-frames');
    expect(faqs).toBe(guide.faqs);
  });
});

describe('getBuyingGuideComparisonTable', () => {
  it('returns null for unknown slug', () => {
    expect(getBuyingGuideComparisonTable('nonexistent')).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getBuyingGuideComparisonTable(undefined)).toBeNull();
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

  it.each(EXPECTED_GUIDE_SLUGS)('table headers are unique for %s', (slug) => {
    const headers = getBuyingGuideComparisonTable(slug).headers;
    expect(new Set(headers).size).toBe(headers.length);
  });

  it.each(EXPECTED_GUIDE_SLUGS)('table cells are non-empty strings for %s', (slug) => {
    const table = getBuyingGuideComparisonTable(slug);
    for (const header of table.headers) {
      expect(typeof header).toBe('string');
      expect(header.length).toBeGreaterThan(0);
    }
    for (const row of table.rows) {
      for (const cell of row) {
        expect(typeof cell).toBe('string');
        expect(cell.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(EXPECTED_GUIDE_SLUGS)('first column values are unique (row labels) for %s', (slug) => {
    const rows = getBuyingGuideComparisonTable(slug).rows;
    const firstCol = rows.map(r => r[0]);
    expect(new Set(firstCol).size).toBe(firstCol.length);
  });

  it('returns same reference as guide.comparisonTable', () => {
    const guide = getBuyingGuide('futon-mattresses');
    const table = getBuyingGuideComparisonTable('futon-mattresses');
    expect(table).toBe(guide.comparisonTable);
  });
});

describe('getPlaceholderGuide', () => {
  it('returns null for empty input', () => {
    expect(getPlaceholderGuide('')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getPlaceholderGuide(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(getPlaceholderGuide(undefined)).toBeNull();
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

  it('has null slug and categorySlug', () => {
    const placeholder = getPlaceholderGuide('Hammocks');
    expect(placeholder.slug).toBeNull();
    expect(placeholder.categorySlug).toBeNull();
  });

  it('has category "Buying Guides"', () => {
    const placeholder = getPlaceholderGuide('Rugs');
    expect(placeholder.category).toBe('Buying Guides');
  });

  it('has empty arrays for tags, keywords, internalLinks', () => {
    const placeholder = getPlaceholderGuide('Lamps');
    expect(placeholder.tags).toEqual([]);
    expect(placeholder.keywords).toEqual([]);
    expect(placeholder.internalLinks).toEqual([]);
  });

  it('relatedProductCategory matches input name', () => {
    const placeholder = getPlaceholderGuide('Throw Pillows');
    expect(placeholder.relatedProductCategory).toBe('Throw Pillows');
  });

  it('metaDescription uses lowercase category name', () => {
    const placeholder = getPlaceholderGuide('Bean Bags');
    expect(placeholder.metaDescription).toContain('bean bags');
  });

  it('title includes "Coming Soon"', () => {
    const placeholder = getPlaceholderGuide('Ottomans');
    expect(placeholder.title).toContain('Coming Soon');
  });

  it('returns distinct objects each call', () => {
    const a = getPlaceholderGuide('Test');
    const b = getPlaceholderGuide('Test');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('getBuyingGuideWordCount', () => {
  it('returns 0 for unknown slug', () => {
    expect(getBuyingGuideWordCount('nonexistent')).toBe(0);
  });

  it('returns 0 for undefined input', () => {
    expect(getBuyingGuideWordCount(undefined)).toBe(0);
  });

  it('returns 0 for null input', () => {
    expect(getBuyingGuideWordCount(null)).toBe(0);
  });

  it.each(EXPECTED_GUIDE_SLUGS)('guide %s exceeds 1000 words', (slug) => {
    const count = getBuyingGuideWordCount(slug);
    expect(count).toBeGreaterThan(1000);
  });

  it.each(EXPECTED_GUIDE_SLUGS)('guide %s word count is under 5000 (reasonable upper bound)', (slug) => {
    const count = getBuyingGuideWordCount(slug);
    expect(count).toBeLessThan(5000);
  });

  it('returns a positive integer', () => {
    const count = getBuyingGuideWordCount('futon-frames');
    expect(Number.isInteger(count)).toBe(true);
    expect(count).toBeGreaterThan(0);
  });
});

// ── Cross-module data integrity ─────────────────────────────────────

describe('cross-module data integrity', () => {
  it('blog post slugs and buying guide slugs are disjoint sets', () => {
    const blogSlugs = new Set(getBlogSlugs());
    const guideSlugs = new Set(getBuyingGuideSlugs());
    for (const slug of blogSlugs) {
      expect(guideSlugs.has(slug)).toBe(false);
    }
  });

  it('all blog posts share the same publish date format', () => {
    const dates = getAllBlogPosts().map(p => p.publishDate);
    for (const d of dates) {
      expect(d).toMatch(/^2026-\d{2}-\d{2}$/);
    }
  });

  it('all buying guides share the same publish date format', () => {
    const dates = getAllBuyingGuides().map(g => g.publishDate);
    for (const d of dates) {
      expect(d).toMatch(/^2026-\d{2}-\d{2}$/);
    }
  });

  it('no duplicate FAQ questions across all blog posts', () => {
    const allQuestions = [];
    for (const slug of getBlogSlugs()) {
      const faqs = getBlogFaqs(slug);
      allQuestions.push(...faqs.map(f => f.question));
    }
    expect(new Set(allQuestions).size).toBe(allQuestions.length);
  });

  it('no duplicate FAQ questions across all buying guides', () => {
    const allQuestions = [];
    for (const slug of getBuyingGuideSlugs()) {
      const faqs = getBuyingGuideFaqs(slug);
      allQuestions.push(...faqs.map(f => f.question));
    }
    expect(new Set(allQuestions).size).toBe(allQuestions.length);
  });

  it('total blog post count matches slugs count', () => {
    expect(getAllBlogPosts().length).toBe(getBlogSlugs().length);
  });

  it('total buying guide count matches slugs count', () => {
    expect(getAllBuyingGuides().length).toBe(getBuyingGuideSlugs().length);
  });
});
