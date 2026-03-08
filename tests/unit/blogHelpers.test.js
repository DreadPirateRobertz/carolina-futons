/**
 * Tests for blogHelpers.js — Blog listing and post page utilities
 */
import { describe, it, expect } from 'vitest';
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

// ── estimateReadingTime ───────────────────────────────────────────────

describe('estimateReadingTime', () => {
  it('returns 1 for short text', () => {
    expect(estimateReadingTime('Hello world')).toBe(1);
  });

  it('returns correct minutes for longer text', () => {
    const words = new Array(400).fill('word').join(' ');
    expect(estimateReadingTime(words)).toBe(2);
  });

  it('rounds up to nearest minute', () => {
    const words = new Array(201).fill('word').join(' ');
    expect(estimateReadingTime(words)).toBe(2);
  });

  it('returns minimum 1 for empty string', () => {
    expect(estimateReadingTime('')).toBe(1);
    expect(estimateReadingTime('   ')).toBe(1);
  });

  it('returns 1 for null/undefined', () => {
    expect(estimateReadingTime(null)).toBe(1);
    expect(estimateReadingTime(undefined)).toBe(1);
  });

  it('returns 1 for non-string input', () => {
    expect(estimateReadingTime(123)).toBe(1);
    expect(estimateReadingTime({})).toBe(1);
  });
});

// ── getCategories ─────────────────────────────────────────────────────

describe('getCategories', () => {
  it('extracts unique sorted categories from posts', () => {
    const posts = [
      { category: 'Design' },
      { category: 'Tips' },
      { category: 'Design' },
      { category: 'News' },
    ];
    expect(getCategories(posts)).toEqual(['Design', 'News', 'Tips']);
  });

  it('returns empty array for null/undefined', () => {
    expect(getCategories(null)).toEqual([]);
    expect(getCategories(undefined)).toEqual([]);
  });

  it('returns empty array for non-array', () => {
    expect(getCategories('not-array')).toEqual([]);
  });

  it('skips posts without category', () => {
    const posts = [{ category: 'A' }, {}, { category: null }, { category: 'B' }];
    expect(getCategories(posts)).toEqual(['A', 'B']);
  });

  it('skips null entries in array', () => {
    expect(getCategories([null, { category: 'X' }])).toEqual(['X']);
  });
});

// ── filterPostsByCategory ─────────────────────────────────────────────

describe('filterPostsByCategory', () => {
  const posts = [
    { title: 'A', category: 'Design' },
    { title: 'B', category: 'Tips' },
    { title: 'C', category: 'Design' },
  ];

  it('filters by category', () => {
    const result = filterPostsByCategory(posts, 'Design');
    expect(result).toHaveLength(2);
    expect(result.every(p => p.category === 'Design')).toBe(true);
  });

  it('returns all posts when category is null', () => {
    expect(filterPostsByCategory(posts, null)).toHaveLength(3);
  });

  it('returns all posts when category is empty string', () => {
    expect(filterPostsByCategory(posts, '')).toHaveLength(3);
  });

  it('returns empty array for null posts', () => {
    expect(filterPostsByCategory(null, 'Design')).toEqual([]);
  });

  it('returns empty for no matches', () => {
    expect(filterPostsByCategory(posts, 'Nonexistent')).toEqual([]);
  });
});

// ── getFeaturedPost ───────────────────────────────────────────────────

describe('getFeaturedPost', () => {
  it('returns the most recently published post', () => {
    const posts = [
      { title: 'Old', publishDate: '2025-01-01' },
      { title: 'Newest', publishDate: '2026-03-01' },
      { title: 'Middle', publishDate: '2025-06-15' },
    ];
    expect(getFeaturedPost(posts).title).toBe('Newest');
  });

  it('returns null for empty array', () => {
    expect(getFeaturedPost([])).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(getFeaturedPost(null)).toBeNull();
    expect(getFeaturedPost(undefined)).toBeNull();
  });

  it('handles posts with missing publishDate', () => {
    const posts = [{ title: 'A' }, { title: 'B', publishDate: '2026-01-01' }];
    const featured = getFeaturedPost(posts);
    expect(featured.title).toBe('B');
  });
});

// ── getRelatedPosts ───────────────────────────────────────────────────

describe('getRelatedPosts', () => {
  const allPosts = [
    { slug: 'current', category: 'Design', tags: ['furniture', 'style'] },
    { slug: 'same-cat', category: 'Design', tags: ['tips'] },
    { slug: 'same-tag', category: 'Tips', tags: ['furniture'] },
    { slug: 'no-match', category: 'News', tags: ['other'] },
    { slug: 'both', category: 'Design', tags: ['furniture', 'style'] },
  ];

  it('excludes the current post', () => {
    const related = getRelatedPosts(allPosts[0], allPosts);
    expect(related.find(p => p.slug === 'current')).toBeUndefined();
  });

  it('prioritizes same category posts', () => {
    const related = getRelatedPosts(allPosts[0], allPosts);
    expect(related[0].slug).toBe('both'); // same category + same tags
  });

  it('returns at most 3 posts', () => {
    const related = getRelatedPosts(allPosts[0], allPosts);
    expect(related.length).toBeLessThanOrEqual(3);
  });

  it('returns empty for null inputs', () => {
    expect(getRelatedPosts(null, allPosts)).toEqual([]);
    expect(getRelatedPosts(allPosts[0], null)).toEqual([]);
  });

  it('returns empty when only current post exists', () => {
    expect(getRelatedPosts(allPosts[0], [allPosts[0]])).toEqual([]);
  });
});

// ── formatPublishDate ─────────────────────────────────────────────────

describe('formatPublishDate', () => {
  it('formats YYYY-MM-DD to readable format', () => {
    const result = formatPublishDate('2026-02-20');
    expect(result).toContain('February');
    expect(result).toContain('20');
    expect(result).toContain('2026');
  });

  it('returns empty string for null/undefined', () => {
    expect(formatPublishDate(null)).toBe('');
    expect(formatPublishDate(undefined)).toBe('');
  });

  it('returns empty string for non-string', () => {
    expect(formatPublishDate(123)).toBe('');
  });

  it('returns empty string for invalid date format', () => {
    expect(formatPublishDate('not-a-date')).toBe('');
    expect(formatPublishDate('2026/02/20')).toBe('');
  });

  it('returns empty string for invalid date values', () => {
    expect(formatPublishDate('2026-13-01')).toBe('');
  });
});

// ── buildAuthorBio ────────────────────────────────────────────────────

describe('buildAuthorBio', () => {
  it('returns Carolina Futons brand info', () => {
    const bio = buildAuthorBio();
    expect(bio.name).toBe('Carolina Futons');
    expect(bio.location).toBe('Hendersonville, NC');
    expect(bio.established).toBe('1991');
    expect(bio.description).toBeTruthy();
  });
});

// ── buildShareUrls ────────────────────────────────────────────────────

describe('buildShareUrls', () => {
  it('returns all share platform URLs', () => {
    const urls = buildShareUrls('https://example.com/post', 'My Post');
    expect(urls.facebook).toContain('facebook.com/sharer');
    expect(urls.pinterest).toContain('pinterest.com/pin');
    expect(urls.twitter).toContain('twitter.com/intent');
    expect(urls.email).toContain('mailto:');
  });

  it('encodes URL and title', () => {
    const urls = buildShareUrls('https://example.com/post?a=1', 'Post & Title');
    expect(urls.facebook).toContain(encodeURIComponent('https://example.com/post?a=1'));
    expect(urls.twitter).toContain(encodeURIComponent('Post & Title'));
  });

  it('returns empty object when url is null', () => {
    expect(buildShareUrls(null, 'Title')).toEqual({});
  });

  it('returns empty object when title is null', () => {
    expect(buildShareUrls('https://example.com', null)).toEqual({});
  });
});
