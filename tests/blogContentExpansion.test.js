import { describe, it, expect } from 'vitest';
import {
  getBlogSlugs,
  getBlogPost,
  getBlogFaqs,
  getAllBlogPosts,
} from '../src/backend/blogContent.js';

const NEW_SLUGS = [
  'top-murphy-cabinet-beds',
  'platform-bed-buyers-guide',
  'choosing-futon-cover',
  'wood-frame-care-guide',
  'studio-apartment-furniture',
  'eco-friendly-furniture-guide',
];

// ── New posts exist and are well-formed ─────────────────────────────

describe('blog content expansion — 6 new posts', () => {
  it('all 6 new slugs are registered', () => {
    const slugs = getBlogSlugs();
    for (const slug of NEW_SLUGS) {
      expect(slugs).toContain(slug);
    }
  });

  it('total blog post count is now 14', () => {
    expect(getAllBlogPosts()).toHaveLength(14);
  });

  for (const slug of NEW_SLUGS) {
    describe(`post: ${slug}`, () => {
      it('has all required fields', () => {
        const post = getBlogPost(slug);
        expect(post).not.toBeNull();
        expect(post.slug).toBe(slug);
        expect(post.title).toBeTruthy();
        expect(post.metaDescription).toBeTruthy();
        expect(post.keywords).toBeInstanceOf(Array);
        expect(post.keywords.length).toBeGreaterThanOrEqual(3);
        expect(post.excerpt).toBeTruthy();
        expect(post.category).toBeTruthy();
        expect(post.tags).toBeInstanceOf(Array);
        expect(post.tags.length).toBeGreaterThanOrEqual(2);
        expect(post.publishDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      it('has at least 4 FAQs', () => {
        const faqs = getBlogFaqs(slug);
        expect(faqs).toBeInstanceOf(Array);
        expect(faqs.length).toBeGreaterThanOrEqual(4);
      });

      it('FAQs have question and answer', () => {
        const faqs = getBlogFaqs(slug);
        for (const faq of faqs) {
          expect(faq.question).toBeTruthy();
          expect(faq.answer).toBeTruthy();
          expect(faq.question.endsWith('?')).toBe(true);
          expect(faq.answer.length).toBeGreaterThan(50);
        }
      });

      it('meta description is between 50 and 160 characters', () => {
        const post = getBlogPost(slug);
        expect(post.metaDescription.length).toBeGreaterThanOrEqual(50);
        expect(post.metaDescription.length).toBeLessThanOrEqual(160);
      });

      it('title is under 70 characters', () => {
        const post = getBlogPost(slug);
        expect(post.title.length).toBeLessThanOrEqual(70);
      });

      it('slug matches the object key (consistency check)', () => {
        const post = getBlogPost(slug);
        expect(post.slug).toBe(slug);
      });
    });
  }
});

// ── Content accuracy (catalog-verified claims) ──────────────────────

describe('blog content accuracy — catalog data alignment', () => {
  it('Murphy cabinet beds post references freestanding design', () => {
    const post = getBlogPost('top-murphy-cabinet-beds');
    const allText = post.faqs.map(f => f.answer).join(' ');
    expect(allText).toContain('freestanding');
  });

  it('Murphy post mentions Night & Day as manufacturer', () => {
    const post = getBlogPost('top-murphy-cabinet-beds');
    const allText = post.faqs.map(f => f.answer).join(' ');
    expect(allText).toContain('Night & Day');
  });

  it('Murphy post quotes accurate price range', () => {
    const post = getBlogPost('top-murphy-cabinet-beds');
    const allText = post.faqs.map(f => f.answer).join(' ');
    // Catalog range: $2,100 (Murphy Cube) to $3,500
    expect(allText).toContain('2,100');
  });

  it('platform bed post distinguishes KD Frames and Night & Day', () => {
    const post = getBlogPost('platform-bed-buyers-guide');
    const allText = post.faqs.map(f => f.answer).join(' ');
    expect(allText).toContain('KD Frames');
    expect(allText).toContain('Night & Day');
    expect(allText).toContain('Athens, Georgia');
  });

  it('platform bed post uses real catalog finishes', () => {
    const post = getBlogPost('platform-bed-buyers-guide');
    const allText = post.faqs.map(f => f.answer).join(' ');
    expect(allText).toContain('cherry');
    expect(allText).toContain('chocolate');
    // Should NOT contain fabricated finish names
    expect(allText.toLowerCase()).not.toContain('honey oak');
    expect(allText.toLowerCase()).not.toContain('rosewood');
  });

  it('eco-friendly post mentions plantation-grown rubberwood', () => {
    const post = getBlogPost('eco-friendly-furniture-guide');
    const allText = post.faqs.map(f => f.answer).join(' ');
    expect(allText).toContain('plantation-grown rubberwood');
    expect(allText).toContain('CertiPUR-US');
  });

  it('wood care post covers both manufacturers', () => {
    const post = getBlogPost('wood-frame-care-guide');
    const allText = post.title + ' ' + post.excerpt + ' ' + post.faqs.map(f => f.answer).join(' ');
    expect(allText).toContain('Night & Day');
    expect(allText).toContain('KD Frames');
  });

  it('no post contains fabricated finish names', () => {
    const posts = getAllBlogPosts();
    for (const post of posts) {
      const allText = (post.excerpt || '') + ' ' +
        (post.faqs || []).map(f => `${f.question} ${f.answer}`).join(' ');
      const lower = allText.toLowerCase();
      expect(lower).not.toContain('honey oak');
      expect(lower).not.toContain('dark espresso');
      expect(lower).not.toContain('rosewood');
    }
  });
});

// ── Categories and related posts ────────────────────────────────────

describe('new posts integrate with existing blog system', () => {
  it('new posts use valid existing categories', () => {
    const validCategories = ['Buying Guides', 'Comparisons', 'Care & Maintenance', 'Room Design'];
    for (const slug of NEW_SLUGS) {
      const post = getBlogPost(slug);
      expect(validCategories).toContain(post.category);
    }
  });

  it('all blog posts have unique slugs', () => {
    const slugs = getBlogSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('all blog posts have unique titles', () => {
    const posts = getAllBlogPosts();
    const titles = posts.map(p => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
