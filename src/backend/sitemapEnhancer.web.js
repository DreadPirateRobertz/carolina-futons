/**
 * @module sitemapEnhancer
 * @description Generates enhanced XML sitemaps with:
 *   - lastmod dates sourced from CMS _updatedDate fields
 *   - priority hints (home=1.0, products=0.8, guides=0.6, blog=0.7)
 *   - image sitemap entries (image:image blocks) for product pages
 *
 * All public helper functions are exported for unit testing.
 * The webMethod wraps the query + build pipeline.
 *
 * Image sitemap spec: https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/mediaHelpers
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { getImageUrl } from 'backend/utils/mediaHelpers';

const SITE_URL = 'https://www.carolinafutons.com';

// ── Priority rules ────────────────────────────────────────────────────────────

const PRIORITY_MAP = {
  home: 1.0,
  product: 0.8,
  category: 0.8,
  blog: 0.7,
  guide: 0.6,
  static: 0.5,
};

/**
 * Return the sitemap priority for a given page type.
 * @param {'home'|'product'|'category'|'blog'|'guide'|'static'} pageType
 * @returns {number}
 */
export function getPriority(pageType) {
  return PRIORITY_MAP[pageType] ?? PRIORITY_MAP.static;
}

// ── Date formatting ───────────────────────────────────────────────────────────

/**
 * Format a Date or ISO string to YYYY-MM-DD for sitemap lastmod.
 * Returns '' for null/undefined/invalid values.
 * @param {Date|string|null|undefined} date
 * @returns {string}
 */
export function formatLastmod(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

// ── Image entry builder ───────────────────────────────────────────────────────

/**
 * Build an image entry object for inclusion in a sitemap URL block.
 * Returns null if imageUrl is empty.
 *
 * @param {string} imageUrl  Absolute HTTPS URL to the image.
 * @param {string} [title]   Image title (will be XML-escaped).
 * @param {string} [caption] Optional caption.
 * @returns {{ url: string, title: string, caption: string }|null}
 */
export function buildImageEntry(imageUrl, title = '', caption = '') {
  if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) return null;
  return {
    url: imageUrl,
    title: String(title || '').trim(),
    caption: String(caption || '').trim(),
  };
}

// ── Product entry builder ─────────────────────────────────────────────────────

/**
 * Build an enhanced sitemap entry for a product.
 * Includes lastmod from _updatedDate and image entries from media fields.
 *
 * @param {Object} product   Wix Stores product record.
 * @param {string} [siteUrl] Base site URL (defaults to production URL).
 * @returns {{ loc: string, lastmod: string, priority: number, changefreq: string, images: Array }}
 */
export function buildProductEntry(product, siteUrl = SITE_URL) {
  const slug = product.slug || product._id || '';
  const loc = `${siteUrl}/product-page/${encodeURIComponent(slug)}`;
  const lastmod = formatLastmod(product._updatedDate || product._createdDate);
  const images = [];

  // Primary image
  const mainUrl = getImageUrl(product.mainMedia);
  const mainEntry = buildImageEntry(mainUrl, product.name);
  if (mainEntry) images.push(mainEntry);

  // Additional media items (up to 5 for image sitemap)
  if (Array.isArray(product.mediaItems)) {
    for (const item of product.mediaItems.slice(1, 6)) {
      const imgUrl = getImageUrl(item);
      const entry = buildImageEntry(imgUrl, product.name);
      if (entry) images.push(entry);
    }
  }

  return {
    loc,
    lastmod,
    priority: getPriority('product'),
    changefreq: 'weekly',
    images,
  };
}

// ── XML builder ───────────────────────────────────────────────────────────────

/**
 * Escape XML special characters.
 * @param {string} str
 * @returns {string}
 */
export function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a complete XML sitemap string from an array of entry objects.
 * Automatically includes the image sitemap namespace when any entry has images.
 *
 * Entry shape:
 *   { loc, lastmod?, priority?, changefreq?, images?: [{ url, title, caption }] }
 *
 * @param {Array} entries
 * @returns {string} XML string.
 */
export function buildSitemapXml(entries) {
  const hasImages = entries.some(e => e.images && e.images.length > 0);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
  if (hasImages) {
    xml += '\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"';
  }
  xml += '>\n';

  for (const entry of entries) {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(entry.loc)}</loc>\n`;
    if (entry.lastmod) xml += `    <lastmod>${escapeXml(entry.lastmod)}</lastmod>\n`;
    if (entry.changefreq) xml += `    <changefreq>${escapeXml(entry.changefreq)}</changefreq>\n`;
    if (entry.priority != null) xml += `    <priority>${entry.priority.toFixed(1)}</priority>\n`;

    if (entry.images && entry.images.length > 0) {
      for (const img of entry.images) {
        xml += '    <image:image>\n';
        xml += `      <image:loc>${escapeXml(img.url)}</image:loc>\n`;
        if (img.title) xml += `      <image:title>${escapeXml(img.title)}</image:title>\n`;
        if (img.caption) xml += `      <image:caption>${escapeXml(img.caption)}</image:caption>\n`;
        xml += '    </image:image>\n';
      }
    }

    xml += '  </url>\n';
  }

  xml += '</urlset>';
  return xml;
}

// ── Web method ────────────────────────────────────────────────────────────────

/**
 * Return enhanced sitemap entries for all visible products.
 * Includes lastmod, priority hints, and image entries.
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.includeImages=true]  Include image sitemap entries.
 * @param {string}  [opts.siteUrl]             Override base URL (for testing).
 * @returns {Promise<{success: boolean, entries: Array, xml: string, count: number, error?: string}>}
 */
export const getProductSitemapEntries = webMethod(
  Permissions.Anyone,
  async (opts = {}) => {
    try {
      const includeImages = (opts || {}).includeImages !== false;
      const siteUrl = (opts || {}).siteUrl || SITE_URL;

      const products = [];
      let skip = 0;
      const pageSize = 100;

      while (true) {
        const page = await wixData
          .query('Stores/Products')
          .eq('visible', true)
          .skip(skip)
          .limit(pageSize)
          .find();
        products.push(...page.items);
        if (page.items.length < pageSize) break;
        skip += pageSize;
      }

      const entries = products.map(p => {
        const entry = buildProductEntry(p, siteUrl);
        if (!includeImages) entry.images = [];
        return entry;
      });

      const xml = buildSitemapXml(entries);

      return { success: true, entries, xml, count: entries.length };
    } catch (err) {
      console.error('[sitemapEnhancer] getProductSitemapEntries error:', err);
      return { success: false, entries: [], xml: '', count: 0, error: 'Failed to generate sitemap.' };
    }
  }
);
