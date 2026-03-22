/**
 * blogServiceCms.test.js — CF-f224-1
 * TDD tests for getPublishedBlogPosts web method (CMS-driven blog listing).
 * Uses wix-blog-backend mock; covers pagination, sort, filtering, and error paths.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  __setPosts,
  __setTotal,
  __setListError,
  __reset as resetBlog,
} from './__mocks__/wix-blog-backend.js';

import { getPublishedBlogPosts } from '../src/backend/blogService.web.js';

// ── Fixtures ─────────────────────────────────────────────────────────

function makePost(n, overrides = {}) {
  return {
    _id: `post-${n}`,
    title: `Post ${n}`,
    slug: `post-${n}`,
    excerpt: `Excerpt for post ${n}`,
    publishedDate: new Date(2026, 0, n).toISOString(),
    media: { wixMedia: { image: { url: `https://img.example.com/${n}.jpg` } } },
    categories: [{ label: 'Buying Guides', _id: 'cat-1' }],
    author: { authorName: 'Carolina Futons Team' },
    ...overrides,
  };
}

function makePosts(count) {
  return Array.from({ length: count }, (_, i) => makePost(i + 1));
}

beforeEach(() => {
  resetBlog();
});

// ── getPublishedBlogPosts — happy path ────────────────────────────────

describe('getPublishedBlogPosts — basic fetch', () => {
  it('returns first page of posts with default page size 9', async () => {
    __setPosts(makePosts(14));
    const result = await getPublishedBlogPosts();
    expect(result.posts).toHaveLength(9);
    expect(result.total).toBe(14);
    expect(result.page).toBe(1);
  });

  it('returns correct posts for page 2', async () => {
    __setPosts(makePosts(14));
    const result = await getPublishedBlogPosts(2);
    expect(result.posts).toHaveLength(5); // 14 - 9 = 5 remaining
    expect(result.page).toBe(2);
  });

  it('accepts custom perPage', async () => {
    __setPosts(makePosts(20));
    const result = await getPublishedBlogPosts(1, 6);
    expect(result.posts).toHaveLength(6);
    expect(result.perPage).toBe(6);
  });

  it('returns empty posts array when no posts exist', async () => {
    __setPosts([]);
    const result = await getPublishedBlogPosts();
    expect(result.posts).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns empty posts array when page is beyond total', async () => {
    __setPosts(makePosts(5));
    const result = await getPublishedBlogPosts(3, 9); // page 3, only 5 posts
    expect(result.posts).toEqual([]);
  });
});

// ── getPublishedBlogPosts — pagination metadata ───────────────────────

describe('getPublishedBlogPosts — pagination metadata', () => {
  it('includes totalPages in result', async () => {
    __setPosts(makePosts(14));
    const result = await getPublishedBlogPosts(1, 9);
    expect(result.totalPages).toBe(2); // ceil(14/9) = 2
  });

  it('totalPages is 1 for fewer posts than perPage', async () => {
    __setPosts(makePosts(4));
    const result = await getPublishedBlogPosts(1, 9);
    expect(result.totalPages).toBe(1);
  });

  it('totalPages is 0 when no posts', async () => {
    __setPosts([]);
    const result = await getPublishedBlogPosts();
    expect(result.totalPages).toBe(0);
  });

  it('hasNextPage is true when more pages exist', async () => {
    __setPosts(makePosts(14));
    const result = await getPublishedBlogPosts(1, 9);
    expect(result.hasNextPage).toBe(true);
  });

  it('hasNextPage is false on last page', async () => {
    __setPosts(makePosts(14));
    const result = await getPublishedBlogPosts(2, 9);
    expect(result.hasNextPage).toBe(false);
  });

  it('hasPrevPage is false on first page', async () => {
    __setPosts(makePosts(14));
    const result = await getPublishedBlogPosts(1);
    expect(result.hasPrevPage).toBe(false);
  });

  it('hasPrevPage is true on page 2+', async () => {
    __setPosts(makePosts(14));
    const result = await getPublishedBlogPosts(2);
    expect(result.hasPrevPage).toBe(true);
  });
});

// ── getPublishedBlogPosts — post shape ────────────────────────────────

describe('getPublishedBlogPosts — post shape normalization', () => {
  it('each post has required display fields', async () => {
    __setPosts([makePost(1)]);
    const { posts } = await getPublishedBlogPosts();
    const post = posts[0];
    expect(post).toHaveProperty('_id');
    expect(post).toHaveProperty('title');
    expect(post).toHaveProperty('slug');
    expect(post).toHaveProperty('excerpt');
    expect(post).toHaveProperty('publishedDate');
    expect(post).toHaveProperty('coverImageUrl');
    expect(post).toHaveProperty('category');
    expect(post).toHaveProperty('authorName');
  });

  it('extracts coverImageUrl from nested wixMedia path', async () => {
    __setPosts([makePost(1, {
      media: { wixMedia: { image: { url: 'https://img.example.com/cover.jpg' } } },
    })]);
    const { posts } = await getPublishedBlogPosts();
    expect(posts[0].coverImageUrl).toBe('https://img.example.com/cover.jpg');
  });

  it('coverImageUrl is empty string when media is absent', async () => {
    __setPosts([makePost(1, { media: null })]);
    const { posts } = await getPublishedBlogPosts();
    expect(posts[0].coverImageUrl).toBe('');
  });

  it('category is first category label when present', async () => {
    __setPosts([makePost(1, {
      categories: [{ label: 'Comparisons', _id: 'cat-2' }],
    })]);
    const { posts } = await getPublishedBlogPosts();
    expect(posts[0].category).toBe('Comparisons');
  });

  it('category is empty string when categories is empty', async () => {
    __setPosts([makePost(1, { categories: [] })]);
    const { posts } = await getPublishedBlogPosts();
    expect(posts[0].category).toBe('');
  });

  it('authorName falls back to store name when absent', async () => {
    __setPosts([makePost(1, { author: null })]);
    const { posts } = await getPublishedBlogPosts();
    expect(typeof posts[0].authorName).toBe('string');
    expect(posts[0].authorName.length).toBeGreaterThan(0);
  });
});

// ── getPublishedBlogPosts — page bounds ───────────────────────────────

describe('getPublishedBlogPosts — page clamping', () => {
  it('clamps page < 1 to page 1', async () => {
    __setPosts(makePosts(5));
    const result = await getPublishedBlogPosts(0);
    expect(result.page).toBe(1);
    expect(result.posts).toHaveLength(5);
  });

  it('clamps page < 1 (negative) to page 1', async () => {
    __setPosts(makePosts(5));
    const result = await getPublishedBlogPosts(-3);
    expect(result.page).toBe(1);
  });

  it('clamps perPage < 1 to 1', async () => {
    __setPosts(makePosts(5));
    const result = await getPublishedBlogPosts(1, 0);
    expect(result.posts).toHaveLength(1);
  });

  it('clamps perPage > 100 to 100', async () => {
    __setPosts(makePosts(5));
    const result = await getPublishedBlogPosts(1, 999);
    expect(result.perPage).toBe(100);
  });
});

// ── getPublishedBlogPosts — error handling ────────────────────────────

describe('getPublishedBlogPosts — error paths', () => {
  it('returns empty result with error flag when CMS throws', async () => {
    __setListError(new Error('Blog API down'));
    const result = await getPublishedBlogPosts();
    expect(result.posts).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.error).toBe(true);
  });

  it('does not throw — always returns an object', async () => {
    __setListError(new Error('Network failure'));
    await expect(getPublishedBlogPosts()).resolves.toBeDefined();
  });
});
