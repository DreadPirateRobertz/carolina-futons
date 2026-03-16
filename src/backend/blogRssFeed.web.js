/**
 * @module blogRssFeed
 * @description Generates an RSS 2.0 XML feed from static blog content.
 * Exposed as a web method for internal use and as an HTTP function
 * endpoint at /_functions/blogRssFeed for feed readers and aggregators.
 *
 * @requires wix-web-module
 * @requires backend/blogContent
 * @requires backend/utils/httpHelpers
 */
import { Permissions, webMethod } from 'wix-web-module';
import { getAllBlogPosts } from 'backend/blogContent';
import { escapeXml } from 'backend/utils/httpHelpers';

const SITE_URL = 'https://www.carolinafutons.com';
const FEED_TITLE = 'Carolina Futons Blog';
const FEED_DESCRIPTION = 'Guides, tips, and inspiration for futon frames, mattresses, Murphy beds, and small-space furniture.';
const FEED_LANGUAGE = 'en-us';
const FEED_TTL = 1440; // 24 hours in minutes

/**
 * Generate RSS 2.0 XML string from all blog posts.
 *
 * @function generateBlogRssFeed
 * @returns {Promise<{success: boolean, xml?: string, error?: string}>}
 * @permission Anyone
 */
export const generateBlogRssFeed = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const posts = getAllBlogPosts();

      if (!Array.isArray(posts) || posts.length === 0) {
        return { success: true, xml: buildRssXml([]) };
      }

      // Sort by publishDate descending (most recent first)
      const sorted = [...posts].sort((a, b) => {
        const da = a.publishDate ? new Date(a.publishDate).getTime() : 0;
        const db = b.publishDate ? new Date(b.publishDate).getTime() : 0;
        return db - da;
      });

      return { success: true, xml: buildRssXml(sorted) };
    } catch (err) {
      console.error('[blogRssFeed] Error generating RSS feed:', err);
      return { success: false, error: err.message };
    }
  }
);

/**
 * Build RSS 2.0 XML string from an array of blog posts.
 *
 * @param {Array<Object>} posts - Blog post objects from blogContent.js
 * @returns {string} Valid RSS 2.0 XML
 */
function buildRssXml(posts) {
  const lastBuildDate = posts.length > 0 && posts[0].publishDate
    ? new Date(posts[0].publishDate).toUTCString()
    : new Date().toUTCString();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n';
  xml += '  <channel>\n';
  xml += `    <title>${escapeXml(FEED_TITLE)}</title>\n`;
  xml += `    <link>${escapeXml(SITE_URL + '/blog')}</link>\n`;
  xml += `    <description>${escapeXml(FEED_DESCRIPTION)}</description>\n`;
  xml += `    <language>${FEED_LANGUAGE}</language>\n`;
  xml += `    <lastBuildDate>${escapeXml(lastBuildDate)}</lastBuildDate>\n`;
  xml += `    <ttl>${FEED_TTL}</ttl>\n`;
  xml += `    <atom:link href="${escapeXml(SITE_URL + '/_functions/blogRssFeed')}" rel="self" type="application/rss+xml" />\n`;

  for (const post of posts) {
    const postUrl = `${SITE_URL}/blog/${post.slug}`;
    const pubDate = post.publishDate
      ? new Date(post.publishDate).toUTCString()
      : '';

    xml += '    <item>\n';
    xml += `      <title>${escapeXml(post.title || '')}</title>\n`;
    xml += `      <link>${escapeXml(postUrl)}</link>\n`;
    xml += `      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>\n`;
    xml += `      <description>${escapeXml(post.excerpt || post.metaDescription || '')}</description>\n`;

    if (pubDate) {
      xml += `      <pubDate>${escapeXml(pubDate)}</pubDate>\n`;
    }

    if (post.category) {
      xml += `      <category>${escapeXml(post.category)}</category>\n`;
    }

    if (Array.isArray(post.tags)) {
      for (const tag of post.tags) {
        xml += `      <category>${escapeXml(tag)}</category>\n`;
      }
    }

    xml += '    </item>\n';
  }

  xml += '  </channel>\n';
  xml += '</rss>';

  return xml;
}

// Export internals for testing
export { buildRssXml as _buildRssXml };
export const _FEED_TITLE = FEED_TITLE;
export const _FEED_DESCRIPTION = FEED_DESCRIPTION;
export const _SITE_URL = SITE_URL;
