/**
 * Hardening tests for getPublishedBlogPosts pagination — page 2 returns
 * the correctly offset posts (not page 1 posts repeated) verified by
 * post identity.
 *
 * blogServiceCms.test.js tests CMS pagination length; this file verifies
 * the identity (slug) of posts returned on page 2 and page 3.
 *
 * (Earlier this file also covered blogRssFeed; that module was retired
 * in cf-66ne chunk 3 because get_blogRssFeed in http-functions.js inlined
 * the RSS-generation logic. Live RSS path is now tested by
 * blogRssFeedEdgeCases.test.js.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Controllable mock for wix-blog-backend (blog list pagination) ─────
import {
  __setPosts,
  __reset as resetBlog,
} from './__mocks__/wix-blog-backend.js';

import { getPublishedBlogPosts } from '../src/backend/blogService.web.js';

// ── Fixtures ─────────────────────────────────────────────────────────

function makePost(n, overrides = {}) {
  return {
    _id: `post-${n}`,
    title: `Post ${n}`,
    slug: `post-${n}`,
    excerpt: `Excerpt ${n}`,
    publishedDate: new Date(2026, 0, n).toISOString(),
    media: { wixMedia: { image: { url: '' } } },
    categories: [],
    author: { authorName: 'Author' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetBlog();
});

// ── getPublishedBlogPosts — page 2 returns the correctly offset posts ──

describe('getPublishedBlogPosts — page 2 offset identity', () => {
  it('page 2 (perPage=9) returns posts 10–14 by slug, not posts 1–9', async () => {
    // 14 posts total: slugs post-1 … post-14
    __setPosts(Array.from({ length: 14 }, (_, i) => makePost(i + 1)));
    const result = await getPublishedBlogPosts(2, 9);
    expect(result.posts).toHaveLength(5);
    // Page 2 offset = 9 → posts 10–14 are returned
    const slugs = result.posts.map(p => p.slug);
    expect(slugs).toContain('post-10');
    expect(slugs).toContain('post-14');
    expect(slugs).not.toContain('post-1');
    expect(slugs).not.toContain('post-9');
  });

  it('page 3 (perPage=5) returns the third page of posts with correct offset', async () => {
    // 15 posts total: page 3 = offset 10 → posts 11–15
    __setPosts(Array.from({ length: 15 }, (_, i) => makePost(i + 1)));
    const result = await getPublishedBlogPosts(3, 5);
    expect(result.posts).toHaveLength(5);
    const slugs = result.posts.map(p => p.slug);
    expect(slugs).toContain('post-11');
    expect(slugs).toContain('post-15');
    expect(slugs).not.toContain('post-1');
    expect(slugs).not.toContain('post-10');
  });

  it('page 2 result sets hasPrevPage:true and correct page number', async () => {
    __setPosts(Array.from({ length: 14 }, (_, i) => makePost(i + 1)));
    const result = await getPublishedBlogPosts(2, 9);
    expect(result.page).toBe(2);
    expect(result.hasPrevPage).toBe(true);
  });
});
