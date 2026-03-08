import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Blog page helpers (will be extracted to public/blogHelpers.js) ──

import {
  estimateReadingTime,
  getCategories,
  filterPostsByCategory,
  getFeaturedPost,
  getRelatedPosts,
  formatPublishDate,
  buildAuthorBio,
  buildShareUrls,
} from '../../src/public/blogHelpers.js';
import { getAllBlogPosts, getBlogPost } from '../../src/backend/blogContent.js';

// ── estimateReadingTime ──────────────────────────────────────────────

describe('estimateReadingTime', () => {
  it('returns 1 for short text', () => {
    expect(estimateReadingTime('Hello world')).toBe(1);
  });

  it('returns correct minutes for medium text (~200 wpm)', () => {
    const words = Array(400).fill('word').join(' ');
    expect(estimateReadingTime(words)).toBe(2);
  });

  it('returns correct minutes for long text', () => {
    const words = Array(1000).fill('word').join(' ');
    expect(estimateReadingTime(words)).toBe(5);
  });

  it('returns 1 for empty string', () => {
    expect(estimateReadingTime('')).toBe(1);
  });

  it('returns 1 for null/undefined', () => {
    expect(estimateReadingTime(null)).toBe(1);
    expect(estimateReadingTime(undefined)).toBe(1);
  });

  it('rounds up partial minutes', () => {
    const words = Array(250).fill('word').join(' ');
    // 250 / 200 = 1.25 → rounds up to 2
    expect(estimateReadingTime(words)).toBe(2);
  });

  it('handles text with multiple spaces and newlines', () => {
    const text = '  word  word   word\n\nword  word  ';
    expect(estimateReadingTime(text)).toBe(1);
  });
});

// ── getCategories ────────────────────────────────────────────────────

describe('getCategories', () => {
  it('returns unique categories from posts', () => {
    const posts = [
      { category: 'Buying Guides' },
      { category: 'Comparisons' },
      { category: 'Buying Guides' },
      { category: 'Care & Maintenance' },
    ];
    const categories = getCategories(posts);
    expect(categories).toHaveLength(3);
    expect(categories).toContain('Buying Guides');
    expect(categories).toContain('Comparisons');
    expect(categories).toContain('Care & Maintenance');
  });

  it('returns empty array for empty input', () => {
    expect(getCategories([])).toEqual([]);
  });

  it('returns empty array for null input', () => {
    expect(getCategories(null)).toEqual([]);
  });

  it('skips posts without a category', () => {
    const posts = [{ category: 'A' }, {}, { category: 'B' }];
    expect(getCategories(posts)).toEqual(['A', 'B']);
  });

  it('returns sorted categories', () => {
    const posts = [
      { category: 'Zzz' },
      { category: 'Aaa' },
      { category: 'Mmm' },
    ];
    expect(getCategories(posts)).toEqual(['Aaa', 'Mmm', 'Zzz']);
  });
});

// ── filterPostsByCategory ────────────────────────────────────────────

describe('filterPostsByCategory', () => {
  const posts = [
    { slug: 'a', category: 'Buying Guides' },
    { slug: 'b', category: 'Comparisons' },
    { slug: 'c', category: 'Buying Guides' },
  ];

  it('filters posts by category', () => {
    const filtered = filterPostsByCategory(posts, 'Buying Guides');
    expect(filtered).toHaveLength(2);
    expect(filtered[0].slug).toBe('a');
    expect(filtered[1].slug).toBe('c');
  });

  it('returns all posts when category is null', () => {
    expect(filterPostsByCategory(posts, null)).toHaveLength(3);
  });

  it('returns all posts when category is empty string', () => {
    expect(filterPostsByCategory(posts, '')).toHaveLength(3);
  });

  it('returns empty array when no posts match', () => {
    expect(filterPostsByCategory(posts, 'Nonexistent')).toHaveLength(0);
  });

  it('returns empty array for null posts', () => {
    expect(filterPostsByCategory(null, 'Buying Guides')).toEqual([]);
  });
});

// ── getFeaturedPost ──────────────────────────────────────────────────

describe('getFeaturedPost', () => {
  it('returns the most recent post', () => {
    const posts = [
      { slug: 'old', publishDate: '2025-01-01' },
      { slug: 'new', publishDate: '2026-02-20' },
      { slug: 'mid', publishDate: '2025-06-15' },
    ];
    expect(getFeaturedPost(posts).slug).toBe('new');
  });

  it('returns null for empty array', () => {
    expect(getFeaturedPost([])).toBeNull();
  });

  it('returns null for null input', () => {
    expect(getFeaturedPost(null)).toBeNull();
  });

  it('returns first post when dates are equal', () => {
    const posts = [
      { slug: 'a', publishDate: '2026-01-01' },
      { slug: 'b', publishDate: '2026-01-01' },
    ];
    const featured = getFeaturedPost(posts);
    expect(featured).toBeTruthy();
  });

  it('handles posts without publishDate', () => {
    const posts = [
      { slug: 'no-date' },
      { slug: 'has-date', publishDate: '2026-01-01' },
    ];
    expect(getFeaturedPost(posts).slug).toBe('has-date');
  });
});

// ── getRelatedPosts ──────────────────────────────────────────────────

describe('getRelatedPosts', () => {
  const allPosts = [
    { slug: 'a', category: 'Buying Guides', tags: ['futon frames'] },
    { slug: 'b', category: 'Comparisons', tags: ['futon frames', 'sofa beds'] },
    { slug: 'c', category: 'Buying Guides', tags: ['mattresses'] },
    { slug: 'd', category: 'Care & Maintenance', tags: ['futon frames', 'cleaning'] },
    { slug: 'e', category: 'Buying Guides', tags: ['sleeping'] },
  ];

  it('returns posts from same category, excluding current', () => {
    const related = getRelatedPosts(allPosts[0], allPosts);
    expect(related.every(p => p.slug !== 'a')).toBe(true);
  });

  it('returns at most 3 related posts', () => {
    const related = getRelatedPosts(allPosts[0], allPosts);
    expect(related.length).toBeLessThanOrEqual(3);
  });

  it('prioritizes same-category posts', () => {
    const related = getRelatedPosts(allPosts[0], allPosts);
    // Posts c and e are same category (Buying Guides)
    const categorySlugs = related.filter(p => p.category === 'Buying Guides').map(p => p.slug);
    expect(categorySlugs.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty array for null currentPost', () => {
    expect(getRelatedPosts(null, allPosts)).toEqual([]);
  });

  it('returns empty array for null allPosts', () => {
    expect(getRelatedPosts(allPosts[0], null)).toEqual([]);
  });

  it('returns empty array when allPosts only has current post', () => {
    expect(getRelatedPosts(allPosts[0], [allPosts[0]])).toEqual([]);
  });
});

// ── formatPublishDate ────────────────────────────────────────────────

describe('formatPublishDate', () => {
  it('formats YYYY-MM-DD to readable date', () => {
    expect(formatPublishDate('2026-02-20')).toBe('February 20, 2026');
  });

  it('returns empty string for null', () => {
    expect(formatPublishDate(null)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(formatPublishDate('')).toBe('');
  });

  it('returns empty string for invalid date', () => {
    expect(formatPublishDate('not-a-date')).toBe('');
  });

  it('formats various valid dates', () => {
    expect(formatPublishDate('2025-01-01')).toBe('January 1, 2025');
    expect(formatPublishDate('2026-12-25')).toBe('December 25, 2026');
  });
});

// ── buildAuthorBio ───────────────────────────────────────────────────

describe('buildAuthorBio', () => {
  it('returns Carolina Futons author object', () => {
    const bio = buildAuthorBio();
    expect(bio.name).toBe('Carolina Futons');
    expect(bio.description).toBeTruthy();
    expect(bio.description.length).toBeGreaterThan(20);
  });

  it('includes location info', () => {
    const bio = buildAuthorBio();
    expect(bio.location).toContain('Hendersonville');
  });

  it('includes year established', () => {
    const bio = buildAuthorBio();
    expect(bio.established).toBe('1991');
  });
});

// ── buildShareUrls ───────────────────────────────────────────────────

describe('buildShareUrls', () => {
  it('builds share URLs for a blog post', () => {
    const urls = buildShareUrls('https://carolinafutons.com/blog/test', 'Test Title');
    expect(urls.facebook).toContain('facebook.com');
    expect(urls.facebook).toContain(encodeURIComponent('https://carolinafutons.com/blog/test'));
    expect(urls.pinterest).toContain('pinterest.com');
    expect(urls.twitter).toContain('twitter.com');
    expect(urls.email).toContain('mailto:');
  });

  it('encodes special characters in title', () => {
    const urls = buildShareUrls('https://example.com', 'A & B: Test');
    expect(urls.twitter).toContain(encodeURIComponent('A & B: Test'));
  });

  it('returns empty object for null url', () => {
    expect(buildShareUrls(null, 'Title')).toEqual({});
  });

  it('returns empty object for null title', () => {
    expect(buildShareUrls('https://example.com', null)).toEqual({});
  });
});

// ── Integration: blogContent data works with helpers ─────────────────

describe('Blog helpers integration with blogContent', () => {
  it('getAllBlogPosts returns posts that work with getCategories', () => {
    const posts = getAllBlogPosts();
    const categories = getCategories(posts);
    expect(categories.length).toBeGreaterThanOrEqual(1);
  });

  it('getAllBlogPosts returns posts that work with getFeaturedPost', () => {
    const posts = getAllBlogPosts();
    const featured = getFeaturedPost(posts);
    expect(featured).toBeTruthy();
    expect(featured.slug).toBeTruthy();
    expect(featured.title).toBeTruthy();
  });

  it('getAllBlogPosts returns posts with reading time > 0', () => {
    const posts = getAllBlogPosts();
    for (const post of posts) {
      const time = estimateReadingTime(post.excerpt);
      expect(time).toBeGreaterThanOrEqual(1);
    }
  });

  it('each post can find related posts', () => {
    const posts = getAllBlogPosts();
    for (const post of posts) {
      const related = getRelatedPosts(post, posts);
      // related should not include current post
      expect(related.every(r => r.slug !== post.slug)).toBe(true);
    }
  });

  it('formatPublishDate works for all posts', () => {
    const posts = getAllBlogPosts();
    for (const post of posts) {
      const formatted = formatPublishDate(post.publishDate);
      expect(formatted).toBeTruthy();
      expect(formatted.length).toBeGreaterThan(5);
    }
  });
});
