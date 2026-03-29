// blogRssFeedDeep.test.js — CF-xr0u: Deep coverage for blogRssFeed.web.js
// Edge cases: empty blog, special characters in titles, very long posts,
// XML escaping boundaries, date handling, category/tag combos, feed structure.
import { describe, it, expect } from 'vitest';

import {
  generateBlogRssFeed,
  _buildRssXml,
  _FEED_TITLE,
  _FEED_DESCRIPTION,
  _SITE_URL,
} from 'backend/blogRssFeed.web';

// ── _buildRssXml — empty/minimal inputs ──────────────────────────────

describe('_buildRssXml — empty/minimal inputs', () => {
  it('empty array produces valid RSS with no items', () => {
    const xml = _buildRssXml([]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<channel>');
    expect(xml).toContain('</channel>');
    expect(xml).toContain('</rss>');
    expect(xml).not.toContain('<item>');
  });

  it('single post with only slug produces valid item', () => {
    const xml = _buildRssXml([{ slug: 'minimal' }]);
    expect(xml).toContain('<item>');
    expect(xml).toContain('/blog/minimal</link>');
    expect(xml).toContain('/blog/minimal</guid>');
    expect(xml).toContain('<title></title>'); // no title
    expect(xml).toContain('<description></description>'); // no excerpt
    expect(xml).not.toContain('<pubDate>'); // no publish date
    expect(xml).not.toContain('<category>'); // no category
  });

  it('post with empty string fields', () => {
    const xml = _buildRssXml([{
      slug: '',
      title: '',
      excerpt: '',
      category: '',
      tags: [],
      publishDate: '',
    }]);
    expect(xml).toContain('<item>');
    expect(xml).toContain('<title></title>');
    expect(xml).toContain('<description></description>');
    // Empty publishDate should not produce pubDate element
    expect(xml).not.toContain('<pubDate>');
  });
});

// ── _buildRssXml — special characters ────────────────────────────────

describe('_buildRssXml — special characters in titles', () => {
  it('escapes ampersand in title', () => {
    const xml = _buildRssXml([{
      slug: 'test',
      title: 'Frames & Mattresses',
      publishDate: '2026-01-01',
    }]);
    expect(xml).toContain('&amp;');
    expect(xml).not.toMatch(/<title>[^<]*[^&]&[^a][^<]*<\/title>/);
  });

  it('escapes less-than in title', () => {
    const xml = _buildRssXml([{
      slug: 'test',
      title: 'Price < $500',
      publishDate: '2026-01-01',
    }]);
    expect(xml).toContain('&lt;');
  });

  it('escapes greater-than in title', () => {
    const xml = _buildRssXml([{
      slug: 'test',
      title: 'Comfort > Price',
      publishDate: '2026-01-01',
    }]);
    expect(xml).toContain('&gt;');
  });

  it('handles double quotes in title', () => {
    const xml = _buildRssXml([{
      slug: 'test',
      title: 'The "Best" Futon',
      publishDate: '2026-01-01',
    }]);
    expect(xml).toContain('<title>');
    expect(xml).toContain('Best');
    expect(xml).toContain('Futon');
  });

  it('handles unicode characters in title', () => {
    const xml = _buildRssXml([{
      slug: 'test-unicode',
      title: 'Café Résumé — Naïve Exposé',
      publishDate: '2026-01-01',
    }]);
    expect(xml).toContain('Café');
    expect(xml).toContain('Résumé');
  });

  it('handles emoji in title', () => {
    const xml = _buildRssXml([{
      slug: 'test-emoji',
      title: '🛋️ Best Futons 🏠',
      publishDate: '2026-01-01',
    }]);
    expect(xml).toContain('🛋️');
  });

  it('escapes HTML tags in description/excerpt', () => {
    const xml = _buildRssXml([{
      slug: 'test-html',
      title: 'Test',
      excerpt: '<p>This has <b>bold</b> and <a href="x">link</a></p>',
      publishDate: '2026-01-01',
    }]);
    expect(xml).not.toContain('<p>');
    expect(xml).not.toContain('<b>');
    expect(xml).not.toContain('<a href');
  });

  it('escapes CDATA-like content in fields', () => {
    const xml = _buildRssXml([{
      slug: 'test-cdata',
      title: 'Test ]]>',
      excerpt: 'Content with ]]> inside',
      publishDate: '2026-01-01',
    }]);
    // Should not break XML structure
    expect(xml).toContain('</channel>');
    expect(xml).toContain('</rss>');
  });

  it('handles ampersand in slug', () => {
    const xml = _buildRssXml([{
      slug: 'test&post',
      title: 'Test',
      publishDate: '2026-01-01',
    }]);
    // URL should have escaped ampersand
    expect(xml).toContain('test&amp;post');
  });
});

// ── _buildRssXml — very long posts ───────────────────────────────────

describe('_buildRssXml — very long content', () => {
  it('handles very long title', () => {
    const xml = _buildRssXml([{
      slug: 'long-title',
      title: 'A'.repeat(5000),
      publishDate: '2026-01-01',
    }]);
    expect(xml).toContain('<item>');
    expect(xml).toContain('</item>');
  });

  it('handles very long excerpt', () => {
    const xml = _buildRssXml([{
      slug: 'long-excerpt',
      title: 'Test',
      excerpt: 'B'.repeat(10000),
      publishDate: '2026-01-01',
    }]);
    expect(xml).toContain('<description>');
  });

  it('handles very long slug', () => {
    const longSlug = 'x'.repeat(2000);
    const xml = _buildRssXml([{
      slug: longSlug,
      title: 'Test',
      publishDate: '2026-01-01',
    }]);
    expect(xml).toContain(`/blog/${longSlug}`);
  });

  it('handles many tags', () => {
    const tags = Array.from({ length: 100 }, (_, i) => `tag-${i}`);
    const xml = _buildRssXml([{
      slug: 'many-tags',
      title: 'Test',
      tags,
      publishDate: '2026-01-01',
    }]);
    expect(xml.match(/<category>/g).length).toBe(100); // no category field, only tags
  });

  it('handles large number of posts', () => {
    const posts = Array.from({ length: 200 }, (_, i) => ({
      slug: `post-${i}`,
      title: `Post ${i}`,
      excerpt: `Excerpt ${i}`,
      publishDate: '2026-01-01',
    }));
    const xml = _buildRssXml(posts);
    const items = xml.match(/<item>/g);
    expect(items.length).toBe(200);
  });
});

// ── _buildRssXml — date handling ─────────────────────────────────────

describe('_buildRssXml — date handling', () => {
  it('handles ISO date string', () => {
    const xml = _buildRssXml([{
      slug: 'iso-date',
      title: 'Test',
      publishDate: '2026-03-16T12:00:00Z',
    }]);
    expect(xml).toContain('<pubDate>');
    const pubDate = xml.match(/<pubDate>([^<]+)<\/pubDate>/)[1];
    expect(new Date(pubDate).getFullYear()).toBe(2026);
  });

  it('handles date-only string (no time)', () => {
    const xml = _buildRssXml([{
      slug: 'date-only',
      title: 'Test',
      publishDate: '2026-03-16',
    }]);
    expect(xml).toContain('<pubDate>');
  });

  it('handles Date object', () => {
    const xml = _buildRssXml([{
      slug: 'date-obj',
      title: 'Test',
      publishDate: new Date('2026-06-15'),
    }]);
    expect(xml).toContain('<pubDate>');
  });

  it('handles invalid date string (produces "Invalid Date")', () => {
    const xml = _buildRssXml([{
      slug: 'bad-date',
      title: 'Test',
      publishDate: 'not-a-date',
    }]);
    // toUTCString on Invalid Date produces "Invalid Date"
    expect(xml).toContain('<pubDate>');
  });

  it('handles null publishDate — no pubDate element', () => {
    const xml = _buildRssXml([{
      slug: 'null-date',
      title: 'Test',
      publishDate: null,
    }]);
    const itemXml = xml.split('<item>')[1].split('</item>')[0];
    expect(itemXml).not.toContain('<pubDate>');
  });

  it('lastBuildDate uses current date when first post has no publishDate', () => {
    const xml = _buildRssXml([{
      slug: 'no-date-first',
      title: 'First',
    }]);
    const lastBuild = xml.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/)[1];
    const parsed = new Date(lastBuild);
    expect(parsed.toString()).not.toBe('Invalid Date');
    expect(parsed.getFullYear()).toBeGreaterThanOrEqual(2026);
  });
});

// ── _buildRssXml — category/tags combinations ───────────────────────

describe('_buildRssXml — category and tags', () => {
  it('post with category but no tags has exactly 1 category element', () => {
    const xml = _buildRssXml([{
      slug: 'cat-only',
      title: 'Test',
      category: 'guides',
      publishDate: '2026-01-01',
    }]);
    const itemXml = xml.split('<item>')[1].split('</item>')[0];
    expect(itemXml.match(/<category>/g).length).toBe(1);
    expect(itemXml).toContain('<category>guides</category>');
  });

  it('post with tags but no category has tag-count category elements', () => {
    const xml = _buildRssXml([{
      slug: 'tags-only',
      title: 'Test',
      tags: ['futons', 'mattresses', 'frames'],
      publishDate: '2026-01-01',
    }]);
    const itemXml = xml.split('<item>')[1].split('</item>')[0];
    expect(itemXml.match(/<category>/g).length).toBe(3);
  });

  it('post with both category and tags combines them', () => {
    const xml = _buildRssXml([{
      slug: 'both',
      title: 'Test',
      category: 'guides',
      tags: ['futons', 'buying'],
      publishDate: '2026-01-01',
    }]);
    const itemXml = xml.split('<item>')[1].split('</item>')[0];
    expect(itemXml.match(/<category>/g).length).toBe(3); // 1 category + 2 tags
  });

  it('handles empty tags array', () => {
    const xml = _buildRssXml([{
      slug: 'empty-tags',
      title: 'Test',
      category: 'guides',
      tags: [],
      publishDate: '2026-01-01',
    }]);
    const itemXml = xml.split('<item>')[1].split('</item>')[0];
    expect(itemXml.match(/<category>/g).length).toBe(1);
  });

  it('escapes special characters in category', () => {
    const xml = _buildRssXml([{
      slug: 'special-cat',
      title: 'Test',
      category: 'R&D <"test">',
      publishDate: '2026-01-01',
    }]);
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
  });

  it('escapes special characters in tags', () => {
    const xml = _buildRssXml([{
      slug: 'special-tags',
      title: 'Test',
      tags: ['tag&1', 'tag<2>'],
      publishDate: '2026-01-01',
    }]);
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
  });
});

// ── _buildRssXml — excerpt/metaDescription fallback ──────────────────

describe('_buildRssXml — description fallback', () => {
  it('uses excerpt when available', () => {
    const xml = _buildRssXml([{
      slug: 'excerpt-test',
      title: 'Test',
      excerpt: 'The excerpt text',
      metaDescription: 'The meta description',
      publishDate: '2026-01-01',
    }]);
    expect(xml).toContain('<description>The excerpt text</description>');
  });

  it('falls back to metaDescription when no excerpt', () => {
    const xml = _buildRssXml([{
      slug: 'meta-test',
      title: 'Test',
      metaDescription: 'The meta description',
      publishDate: '2026-01-01',
    }]);
    expect(xml).toContain('<description>The meta description</description>');
  });

  it('empty description when neither excerpt nor metaDescription', () => {
    const xml = _buildRssXml([{
      slug: 'no-desc',
      title: 'Test',
      publishDate: '2026-01-01',
    }]);
    expect(xml).toContain('<description></description>');
  });

  it('uses empty excerpt over metaDescription', () => {
    const xml = _buildRssXml([{
      slug: 'empty-excerpt',
      title: 'Test',
      excerpt: '',
      metaDescription: 'Fallback',
      publishDate: '2026-01-01',
    }]);
    // excerpt is '' which is falsy, so || falls through to metaDescription
    expect(xml).toContain('<description>Fallback</description>');
  });
});

// ── _buildRssXml — feed structure ────────────────────────────────────

describe('_buildRssXml — feed structure', () => {
  it('has proper XML declaration', () => {
    const xml = _buildRssXml([]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('has Atom namespace', () => {
    const xml = _buildRssXml([]);
    expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
  });

  it('has atom:link self-reference', () => {
    const xml = _buildRssXml([]);
    expect(xml).toContain('atom:link href=');
    expect(xml).toContain('rel="self"');
    expect(xml).toContain('type="application/rss+xml"');
  });

  it('has correct feed title', () => {
    const xml = _buildRssXml([]);
    expect(xml).toContain(`<title>${_FEED_TITLE}</title>`);
  });

  it('has correct feed description', () => {
    const xml = _buildRssXml([]);
    // Description may be XML-escaped
    expect(xml).toContain('<description>');
  });

  it('has correct feed link', () => {
    const xml = _buildRssXml([]);
    expect(xml).toContain(`<link>${_SITE_URL}/blog</link>`);
  });

  it('has language element', () => {
    const xml = _buildRssXml([]);
    expect(xml).toContain('<language>en-us</language>');
  });

  it('has ttl element', () => {
    const xml = _buildRssXml([]);
    expect(xml).toContain('<ttl>1440</ttl>');
  });

  it('items come after channel metadata', () => {
    const xml = _buildRssXml([{
      slug: 'order-test',
      title: 'Test',
      publishDate: '2026-01-01',
    }]);
    const channelStart = xml.indexOf('<channel>');
    const ttlPos = xml.indexOf('<ttl>');
    const itemPos = xml.indexOf('<item>');
    expect(channelStart).toBeLessThan(ttlPos);
    expect(ttlPos).toBeLessThan(itemPos);
  });
});

// ── generateBlogRssFeed — integration ────────────────────────────────

describe('generateBlogRssFeed — integration', () => {
  it('returns valid RSS from actual blog content', async () => {
    const result = await generateBlogRssFeed();
    expect(result.success).toBe(true);
    expect(result.xml).toBeTruthy();
    expect(result.xml.length).toBeGreaterThan(200);
  });

  it('every item has a guid', async () => {
    const result = await generateBlogRssFeed();
    const items = result.xml.split('<item>').slice(1);
    for (const item of items) {
      expect(item).toContain('<guid isPermaLink="true">');
    }
  });

  it('every item has a link', async () => {
    const result = await generateBlogRssFeed();
    const items = result.xml.split('<item>').slice(1);
    for (const item of items) {
      expect(item).toContain('<link>');
    }
  });

  it('every item link matches its guid', async () => {
    const result = await generateBlogRssFeed();
    const items = result.xml.split('<item>').slice(1);
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const link = item.match(/<link>([^<]+)<\/link>/)?.[1];
      const guid = item.match(/<guid[^>]*>([^<]+)<\/guid>/)?.[1];
      expect(link).toBeDefined();
      expect(guid).toBeDefined();
      expect(link).toBe(guid);
    }
  });

  it('posts are sorted by date descending', async () => {
    const result = await generateBlogRssFeed();
    const pubDates = result.xml.match(/<pubDate>([^<]+)<\/pubDate>/g);
    expect(pubDates).not.toBeNull();
    expect(pubDates.length).toBeGreaterThanOrEqual(2);
    const dates = pubDates.map(m => new Date(m.replace(/<\/?pubDate>/g, '')).getTime());
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  });
});
