import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('public/blogHelpers', () => ({
  estimateReadingTime: vi.fn((text) => {
    if (!text || typeof text !== 'string') return 1;
    return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 200));
  }),
  getFeaturedPost: vi.fn(),
}));
vi.mock('public/engagementTracker', () => ({
  trackEvent: vi.fn(),
}));
vi.mock('public/a11yHelpers', () => ({
  announce: vi.fn(),
}));
vi.mock('public/designTokens.js', () => ({
  colors: {
    espresso: '#1E3A5F',
    espressoLight: '#3D5A80',
    mountainBlue: '#5B8FA8',
    sunsetCoral: '#4A7D94',
    sandBase: '#F0F4F8',
    sandDark: '#E2E8F0',
    muted: '#646C79',
  },
  spacing: { xs: '6px', sm: '8px', md: '16px', lg: '24px' },
}));

import {
  buildTeaserData,
  buildTeaserCardHtml,
  buildBlogTeaserSection,
  initHomeBlogTeasers,
  MAX_TEASERS,
  EXCERPT_MAX_LENGTH,
  truncateExcerpt,
} from '../src/public/HomeBlogTeasers.js';
import { trackEvent } from 'public/engagementTracker';

// ── Fixtures ────────────────────────────────────────────────────────
const MOCK_POSTS = [
  {
    title: 'Best Futons for Everyday Sleeping',
    slug: 'best-futons-everyday-sleeping',
    excerpt: 'Yes, you can sleep on a futon every night. Here is how to choose the right one for your needs and budget.',
    plainContent: 'Yes, you can sleep on a futon every night...',
    category: 'Buying Guides',
    publishDate: '2026-03-10',
    coverImage: 'https://example.com/image1.jpg',
  },
  {
    title: 'Futon vs Sofa Bed: The Honest Comparison',
    slug: 'futon-vs-sofa-bed',
    excerpt: 'We sell futons, but we will tell you when a sofa bed might be better.',
    plainContent: 'We sell futons, but we will tell you...',
    category: 'Comparisons',
    publishDate: '2026-03-08',
    coverImage: 'https://example.com/image2.jpg',
  },
  {
    title: 'Small Space Furniture Solutions',
    slug: 'small-space-furniture',
    excerpt: 'Futons, Murphy beds, and platform beds compared for apartments, studios, and guest rooms.',
    plainContent: 'Futons, Murphy beds, and platform beds...',
    category: 'Room Ideas',
    publishDate: '2026-03-05',
    coverImage: null,
  },
  {
    title: 'Old Post That Should Not Appear',
    slug: 'old-post',
    excerpt: 'This is an older post.',
    plainContent: 'This is an older post...',
    category: 'Archive',
    publishDate: '2025-01-01',
    coverImage: null,
  },
];

function create$w(elementMap = {}) {
  return (selector) => elementMap[selector] || null;
}

function mockHtmlElement(id) {
  return {
    _id: id,
    html: '',
    accessibility: {},
    collapsed: false,
    collapse: vi.fn(function () { this.collapsed = true; }),
  };
}

describe('HomeBlogTeasers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── truncateExcerpt ──────────────────────────────────────────────
  describe('truncateExcerpt', () => {
    it('returns empty string for null/undefined', () => {
      expect(truncateExcerpt(null, 100)).toBe('');
      expect(truncateExcerpt(undefined, 100)).toBe('');
    });

    it('returns empty string for non-string input', () => {
      expect(truncateExcerpt(42, 100)).toBe('');
    });

    it('returns text as-is if shorter than max', () => {
      expect(truncateExcerpt('Short text', 100)).toBe('Short text');
    });

    it('truncates at word boundary with ellipsis', () => {
      const text = 'This is a longer sentence that needs to be truncated at a reasonable point';
      const result = truncateExcerpt(text, 40);
      expect(result.length).toBeLessThanOrEqual(43); // 40 + "..."
      expect(result).toMatch(/\.\.\.$/);
    });

    it('trims whitespace before processing', () => {
      expect(truncateExcerpt('  hello  ', 100)).toBe('hello');
    });

    it('handles text exactly at max length', () => {
      const text = 'x'.repeat(120);
      expect(truncateExcerpt(text, 120)).toBe(text);
    });
  });

  // ── buildTeaserData ──────────────────────────────────────────────
  describe('buildTeaserData', () => {
    it('returns null for null/undefined post', () => {
      expect(buildTeaserData(null)).toBeNull();
      expect(buildTeaserData(undefined)).toBeNull();
    });

    it('extracts title, excerpt, category, slug from post', () => {
      const result = buildTeaserData(MOCK_POSTS[0]);
      expect(result.title).toBe('Best Futons for Everyday Sleeping');
      expect(result.slug).toBe('best-futons-everyday-sleeping');
      expect(result.category).toBe('Buying Guides');
    });

    it('truncates excerpt to EXCERPT_MAX_LENGTH', () => {
      const longPost = {
        ...MOCK_POSTS[0],
        excerpt: 'A'.repeat(200) + ' word boundary here',
      };
      const result = buildTeaserData(longPost);
      expect(result.excerpt.length).toBeLessThanOrEqual(EXCERPT_MAX_LENGTH + 3);
    });

    it('computes reading time from plainContent', () => {
      const result = buildTeaserData(MOCK_POSTS[0]);
      expect(result.readingTime).toBeGreaterThanOrEqual(1);
    });

    it('includes cover image when available', () => {
      const result = buildTeaserData(MOCK_POSTS[0]);
      expect(result.image).toBe('https://example.com/image1.jpg');
    });

    it('sets image to null when no coverImage', () => {
      const result = buildTeaserData(MOCK_POSTS[2]);
      expect(result.image).toBeNull();
    });

    it('defaults title to Untitled for missing title', () => {
      const result = buildTeaserData({ slug: 'test' });
      expect(result.title).toBe('Untitled');
    });

    it('defaults category to empty string for missing category', () => {
      const result = buildTeaserData({ title: 'Test' });
      expect(result.category).toBe('');
    });

    it('falls back to plainContent when excerpt is missing', () => {
      const post = { title: 'No Excerpt', plainContent: 'Some content here' };
      const result = buildTeaserData(post);
      expect(result.excerpt).toBe('Some content here');
    });
  });

  // ── buildTeaserCardHtml ──────────────────────────────────────────
  describe('buildTeaserCardHtml', () => {
    it('returns empty string for null teaser', () => {
      expect(buildTeaserCardHtml(null)).toBe('');
    });

    it('includes the post title', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('Best Futons for Everyday Sleeping');
    });

    it('includes the excerpt', () => {
      const teaser = buildTeaserData(MOCK_POSTS[1]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('sofa bed');
    });

    it('includes reading time', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('min read');
    });

    it('includes a Read more link to the blog post', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('/blog/best-futons-everyday-sleeping');
      expect(html).toContain('Read more');
    });

    it('includes category badge when category is present', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('Buying Guides');
    });

    it('omits category badge when category is empty', () => {
      const teaser = buildTeaserData({ title: 'No Cat', slug: 'test' });
      const html = buildTeaserCardHtml(teaser);
      expect(html).not.toContain('text-transform:uppercase');
    });

    it('includes cover image when available', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('<img');
      expect(html).toContain('https://example.com/image1.jpg');
    });

    it('omits image when not available', () => {
      const teaser = buildTeaserData(MOCK_POSTS[2]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).not.toContain('<img');
    });

    it('includes lazy loading for images', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('loading="lazy"');
    });

    it('wraps in article element with role', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('<article');
      expect(html).toContain('role="article"');
    });

    it('includes accessible aria-label on read more link', () => {
      const teaser = buildTeaserData(MOCK_POSTS[0]);
      const html = buildTeaserCardHtml(teaser);
      expect(html).toContain('aria-label="Read Best Futons for Everyday Sleeping"');
    });
  });

  // ── buildBlogTeaserSection ───────────────────────────────────────
  describe('buildBlogTeaserSection', () => {
    it('returns empty string for null/undefined posts', () => {
      expect(buildBlogTeaserSection(null)).toBe('');
      expect(buildBlogTeaserSection(undefined)).toBe('');
    });

    it('returns empty string for empty array', () => {
      expect(buildBlogTeaserSection([])).toBe('');
    });

    it('includes section header with "From Our Blog"', () => {
      const html = buildBlogTeaserSection(MOCK_POSTS);
      expect(html).toContain('From Our Blog');
    });

    it('limits to MAX_TEASERS (3) posts', () => {
      const html = buildBlogTeaserSection(MOCK_POSTS);
      // 4 posts in fixture, but only 3 should appear (MAX_TEASERS = 3)
      expect(html).toContain('Best Futons');
      expect(html).toContain('Futon vs Sofa Bed');
      expect(html).toContain('Small Space');
      expect(html).not.toContain('Old Post That Should Not Appear');
    });

    it('sorts posts by publishDate descending (newest first)', () => {
      const html = buildBlogTeaserSection(MOCK_POSTS);
      const bestIdx = html.indexOf('Best Futons');
      const vsIdx = html.indexOf('Futon vs Sofa Bed');
      const smallIdx = html.indexOf('Small Space');
      expect(bestIdx).toBeLessThan(vsIdx);
      expect(vsIdx).toBeLessThan(smallIdx);
    });

    it('includes "View all posts" link to /blog', () => {
      const html = buildBlogTeaserSection(MOCK_POSTS);
      expect(html).toContain('/blog');
      expect(html).toContain('View all posts');
    });

    it('uses grid layout with role="feed"', () => {
      const html = buildBlogTeaserSection(MOCK_POSTS);
      expect(html).toContain('display:grid');
      expect(html).toContain('role="feed"');
    });

    it('handles single post gracefully', () => {
      const html = buildBlogTeaserSection([MOCK_POSTS[0]]);
      expect(html).toContain('Best Futons');
      expect(html).toContain('From Our Blog');
    });
  });

  // ── initHomeBlogTeasers ──────────────────────────────────────────
  describe('initHomeBlogTeasers', () => {
    it('collapses container when no posts returned', async () => {
      vi.doMock('backend/blogService.web', () => ({
        getAllBlogPosts: vi.fn().mockResolvedValue([]),
      }));

      const container = mockHtmlElement('blogTeaserSection');
      const $w = create$w({ '#blogTeaserSection': container });

      await initHomeBlogTeasers($w);

      expect(container.collapse).toHaveBeenCalled();
    });

    it('does nothing when container element is missing', async () => {
      const $w = create$w({});
      await expect(initHomeBlogTeasers($w)).resolves.toBeUndefined();
    });

    it('collapses container on error', async () => {
      vi.doMock('backend/blogService.web', () => ({
        getAllBlogPosts: vi.fn().mockRejectedValue(new Error('CMS offline')),
      }));

      const container = mockHtmlElement('blogTeaserSection');
      const $w = create$w({ '#blogTeaserSection': container });

      await initHomeBlogTeasers($w);

      expect(container.collapse).toHaveBeenCalled();
    });
  });

  // ── Constants ────────────────────────────────────────────────────
  describe('constants', () => {
    it('MAX_TEASERS is 3', () => {
      expect(MAX_TEASERS).toBe(3);
    });

    it('EXCERPT_MAX_LENGTH is 120', () => {
      expect(EXCERPT_MAX_LENGTH).toBe(120);
    });
  });
});
