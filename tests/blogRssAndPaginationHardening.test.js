/**
 * Hardening tests for:
 *   1. generateBlogRssFeed webMethod — empty blog (0 posts) returns valid RSS,
 *      not a 500 error, and the XML is well-formed.
 *   2. getPublishedBlogPosts pagination — page 2 returns the correctly offset
 *      posts (not page 1 posts repeated) verified by post identity.
 *
 * Separation rationale:
 *   - blogRssFeedDeep.test.js tests _buildRssXml directly with real blog data.
 *   - blogRssFeedEdgeCases.test.js tests the HTTP endpoint get_blogRssFeed.
 *   - This file tests the webMethod generateBlogRssFeed with a mocked empty
 *     getAllBlogPosts — a code path not exercised by either existing file.
 *   - blogServiceCms.test.js tests CMS pagination length; this file verifies
 *     the identity (slug) of posts returned on page 2 and page 3.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock wix-web-module so webMethod() unwraps to the raw async function ──
vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember' },
  webMethod: vi.fn((_, fn) => fn),
}));

// ── Controllable mock for backend/blogContent ─────────────────────────
const mockGetAllBlogPosts = vi.fn(() => []);

vi.mock('backend/blogContent', () => ({
  getAllBlogPosts: () => mockGetAllBlogPosts(),
  getBlogPost: vi.fn(),
  getBlogSlugs: vi.fn(() => []),
  getBlogFaqs: vi.fn(() => []),
}));

// ── Import module under test ─────────────────────────────────────────
import {
  generateBlogRssFeed,
  _buildRssXml,
} from '../src/backend/blogRssFeed.web.js';

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
  mockGetAllBlogPosts.mockReturnValue([]);
  resetBlog();
});

// ── generateBlogRssFeed — empty blog (0 posts) ────────────────────────

describe('generateBlogRssFeed — empty blog returns valid RSS, not 500', () => {
  it('returns success: true when getAllBlogPosts returns empty array', async () => {
    mockGetAllBlogPosts.mockReturnValue([]);
    const result = await generateBlogRssFeed();
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns an xml string (not null or undefined) for empty blog', async () => {
    mockGetAllBlogPosts.mockReturnValue([]);
    const result = await generateBlogRssFeed();
    expect(typeof result.xml).toBe('string');
    expect(result.xml.length).toBeGreaterThan(0);
  });

  it('empty blog XML starts with the standard XML declaration', async () => {
    mockGetAllBlogPosts.mockReturnValue([]);
    const { xml } = await generateBlogRssFeed();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('empty blog XML has the <channel> wrapper and no <item> elements', async () => {
    mockGetAllBlogPosts.mockReturnValue([]);
    const { xml } = await generateBlogRssFeed();
    expect(xml).toContain('<channel>');
    expect(xml).toContain('</channel>');
    expect(xml).toContain('</rss>');
    expect(xml).not.toContain('<item>');
  });

  it('empty blog XML contains the feed title and description elements', async () => {
    mockGetAllBlogPosts.mockReturnValue([]);
    const { xml } = await generateBlogRssFeed();
    // Channel must include <title> and <description> channel metadata
    expect(xml).toContain('<title>');
    expect(xml).toContain('<description>');
    expect(xml).toContain('<language>');
  });
});

// ── RSS XML well-formedness — special chars ───────────────────────────
//
// Verifies that the XML produced by _buildRssXml is structurally sound when
// post fields contain characters that are illegal in raw XML (&, <, >, ").
// We check for well-formedness by confirming that every element that receives
// user content uses proper XML entities rather than bare special characters.

describe('_buildRssXml — XML well-formedness with combined special chars', () => {
  it('XML with & < > in both title and description has no bare special chars in content', () => {
    const xml = _buildRssXml([{
      slug: 'combo-test',
      title: 'Frames & Mattresses: Wood < Metal > Fabric',
      excerpt: 'Budget < $500 & comfort > price. The "best" choice.',
      publishDate: '2026-01-15',
    }]);
    // Within element content (between > and <), there must be no unescaped & < >
    // Extract all text nodes by stripping tags and check for bare & and <
    const textContent = xml.replace(/<[^>]+>/g, ' ');
    expect(textContent).not.toContain('&mattresses');   // bare & not followed by entity
    expect(textContent).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;|#)/); // bare &
  });

  it('XML with ampersand in title uses &amp; entity', () => {
    const xml = _buildRssXml([{
      slug: 'amp-title',
      title: 'Beds & Sofas',
      publishDate: '2026-01-15',
    }]);
    // The <title> element must contain &amp; not bare &
    const titleMatch = xml.match(/<title>([^<]*)<\/title>/g);
    // Find the item title (second <title> in the doc)
    const itemTitle = titleMatch ? titleMatch[titleMatch.length - 1] : '';
    expect(itemTitle).toContain('&amp;');
    expect(itemTitle).not.toMatch(/<title>[^<]*[^;]&[^a]/);
  });

  it('XML with HTML tags in excerpt is structurally sound (no raw < in content)', () => {
    const xml = _buildRssXml([{
      slug: 'html-excerpt',
      title: 'Test',
      excerpt: '<p>Bold <b>text</b> and <a href="x">link</a></p>',
      publishDate: '2026-01-15',
    }]);
    // The overall XML must close properly
    expect(xml).toContain('</channel>');
    expect(xml).toContain('</rss>');
    // The excerpt must not leave raw HTML tags as element content
    const descMatch = xml.match(/<description>([\s\S]*?)<\/description>/g);
    if (descMatch) {
      for (const d of descMatch) {
        // raw < inside content (not a tag) would be like ">text<" without proper escaping
        const innerContent = d.replace(/^<description>/, '').replace(/<\/description>$/, '');
        expect(innerContent).not.toContain('<p>');
        expect(innerContent).not.toContain('<b>');
      }
    }
  });
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
