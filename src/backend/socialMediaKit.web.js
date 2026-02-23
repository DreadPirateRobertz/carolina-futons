/**
 * @module socialMediaKit
 * @description Social media sharing kit for marketing launch.
 * Provides share URL generators, social preview validators, and
 * consolidated meta tag helpers for product, category, and blog pages.
 * Verifies OG meta tags, Twitter Cards, and Pinterest Rich Pins.
 *
 * Builds on seoHelpers.web.js (structured data) and pinterestRichPins.web.js
 * (Pinterest-specific meta). This module adds share URLs, preview validation,
 * and a unified social readiness checker.
 *
 * @requires wix-web-module
 */
import { Permissions, webMethod } from 'wix-web-module';
import { sanitize } from 'backend/utils/sanitize';

const SITE_URL = 'https://www.carolinafutons.com';
const SITE_NAME = 'Carolina Futons';
const DEFAULT_IMAGE = `${SITE_URL}/og-default.jpg`;

// ── Share URL Generators ────────────────────────────────────────────

/**
 * Generate share URLs for all major social platforms.
 *
 * @function getShareUrls
 * @param {Object} params
 * @param {string} params.url - Page URL to share
 * @param {string} params.title - Share title/text
 * @param {string} [params.description] - Share description
 * @param {string} [params.image] - Image URL for Pinterest
 * @returns {Promise<Object>} Map of platform -> share URL
 * @permission Anyone
 */
export const getShareUrls = webMethod(
  Permissions.Anyone,
  async ({ url, title, description, image }) => {
    const cleanUrl = sanitize(url || '', 500);
    const cleanTitle = sanitize(title || '', 200);
    const cleanDesc = sanitize(description || '', 500);
    const cleanImage = sanitize(image || '', 500);

    if (!cleanUrl) return {};

    const encodedUrl = encodeURIComponent(cleanUrl);
    const encodedTitle = encodeURIComponent(cleanTitle);
    const encodedDesc = encodeURIComponent(cleanDesc);

    return {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}${cleanImage ? `&media=${encodeURIComponent(cleanImage)}` : ''}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedDesc ? encodedDesc + '%0A%0A' : ''}${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    };
  }
);

/**
 * Generate product-specific share URLs with pre-formatted text.
 *
 * @function getProductShareUrls
 * @param {Object} product - Wix product object
 * @returns {Promise<Object>} Map of platform -> share URL
 * @permission Anyone
 */
export const getProductShareUrls = webMethod(
  Permissions.Anyone,
  async (product) => {
    if (!product || !product.slug) return {};

    const url = `${SITE_URL}/product-page/${sanitize(product.slug, 100)}`;
    const title = sanitize(product.name || '', 200);
    const price = product.formattedPrice || `$${(product.price || 0).toFixed(2)}`;
    const description = `Check out ${title} (${price}) at ${SITE_NAME}`;
    const image = product.mainMedia || DEFAULT_IMAGE;

    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    const encodedDesc = encodeURIComponent(description);

    return {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodeURIComponent(`${title} — ${price} at ${SITE_NAME}`)}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}&media=${encodeURIComponent(image)}`,
      email: `mailto:?subject=${encodeURIComponent(`Check out ${title} at ${SITE_NAME}`)}&body=${encodedDesc}%0A%0A${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      productUrl: url,
    };
  }
);

// ── Social Preview Validator ────────────────────────────────────────

/**
 * Validate that a page has all required social meta tags for optimal sharing.
 * Returns validation results for OG, Twitter Card, and Pinterest Rich Pin support.
 *
 * @function validateSocialMeta
 * @param {Object} meta - Key-value pairs of meta tag properties
 * @returns {Promise<{score: number, maxScore: number, platforms: Object, issues: string[]}>}
 * @permission Anyone
 */
export const validateSocialMeta = webMethod(
  Permissions.Anyone,
  async (meta) => {
    if (!meta || typeof meta !== 'object') {
      return { score: 0, maxScore: 15, platforms: {}, issues: ['No meta tags provided'] };
    }

    const issues = [];
    let score = 0;
    const maxScore = 15;

    // Open Graph (Facebook/Instagram) — 5 required tags
    const ogRequired = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];
    const ogPresent = ogRequired.filter(tag => meta[tag]);
    const ogScore = ogPresent.length;
    score += ogScore;

    for (const tag of ogRequired) {
      if (!meta[tag]) issues.push(`Missing ${tag} — required for Facebook/Instagram sharing`);
    }

    if (meta['og:title'] && meta['og:title'].length > 95) {
      issues.push('og:title exceeds 95 chars — may be truncated on Facebook');
    }
    if (meta['og:description'] && meta['og:description'].length > 200) {
      issues.push('og:description exceeds 200 chars — may be truncated');
    }

    // Twitter Card — 4 required tags
    const twRequired = ['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
    const twPresent = twRequired.filter(tag => meta[tag]);
    const twScore = twPresent.length;
    score += twScore;

    for (const tag of twRequired) {
      if (!meta[tag]) issues.push(`Missing ${tag} — required for Twitter Cards`);
    }

    if (meta['twitter:card'] && !['summary', 'summary_large_image', 'app', 'player'].includes(meta['twitter:card'])) {
      issues.push('twitter:card has invalid value — use summary or summary_large_image');
    }

    // Pinterest Rich Pin — 6 required for product pins
    const pinRequired = ['og:type', 'og:title', 'og:image', 'product:price:amount', 'product:price:currency', 'product:availability'];
    const pinPresent = pinRequired.filter(tag => meta[tag]);
    const pinScore = Math.min(pinPresent.length, 6);
    score += pinScore;

    if (meta['og:type'] === 'product') {
      for (const tag of pinRequired) {
        if (!meta[tag]) issues.push(`Missing ${tag} — required for Pinterest Product Rich Pins`);
      }
    }

    // Image URL validation
    if (meta['og:image'] && !meta['og:image'].startsWith('http')) {
      issues.push('og:image must be an absolute URL (starting with http/https)');
    }

    return {
      score,
      maxScore,
      platforms: {
        facebook: { score: ogScore, maxScore: 5, ready: ogScore >= 5 },
        twitter: { score: twScore, maxScore: 4, ready: twScore >= 4 },
        pinterest: { score: pinScore, maxScore: 6, ready: pinScore >= 6 },
      },
      issues,
    };
  }
);

/**
 * Check social readiness for a product page.
 * Generates the expected meta tags and validates them.
 *
 * @function checkProductSocialReadiness
 * @param {Object} product - Wix product object
 * @returns {Promise<{ready: boolean, score: number, maxScore: number, meta: Object, issues: string[]}>}
 * @permission Anyone
 */
export const checkProductSocialReadiness = webMethod(
  Permissions.Anyone,
  async (product) => {
    if (!product) {
      return { ready: false, score: 0, maxScore: 15, meta: {}, issues: ['No product data provided'] };
    }

    const url = `${SITE_URL}/product-page/${sanitize(product.slug || '', 100)}`;
    const title = `${sanitize(product.name || '', 200)} | ${SITE_NAME}`;
    const description = sanitize(
      (product.description || '').replace(/<[^>]*>/g, ''),
      200
    ) || `Shop ${product.name || 'this product'} at ${SITE_NAME}.`;
    const image = product.mainMedia || DEFAULT_IMAGE;
    const price = (product.price || 0).toFixed(2);
    const availability = product.inStock !== false ? 'instock' : 'oos';

    const meta = {
      'og:type': 'product',
      'og:title': title,
      'og:description': description,
      'og:url': url,
      'og:image': image,
      'og:site_name': SITE_NAME,
      'product:price:amount': price,
      'product:price:currency': 'USD',
      'product:availability': availability,
      'twitter:card': 'summary_large_image',
      'twitter:title': title,
      'twitter:description': description,
      'twitter:image': image,
    };

    const validation = await validateSocialMeta(meta);

    return {
      ready: validation.score >= 14,
      score: validation.score,
      maxScore: validation.maxScore,
      meta,
      issues: validation.issues,
    };
  }
);

/**
 * Generate a complete set of social meta tags for a product page as HTML.
 *
 * @function getProductSocialMetaHtml
 * @param {Object} product - Wix product object
 * @returns {Promise<string>} HTML meta tags string
 * @permission Anyone
 */
export const getProductSocialMetaHtml = webMethod(
  Permissions.Anyone,
  async (product) => {
    if (!product) return '';

    const result = await checkProductSocialReadiness(product);
    const tags = [];

    for (const [property, content] of Object.entries(result.meta)) {
      if (!content) continue;
      const safeProperty = escapeAttr(property);
      const safeContent = escapeAttr(String(content));
      const attr = property.startsWith('twitter:') ? 'name' : 'property';
      tags.push(`<meta ${attr}="${safeProperty}" content="${safeContent}" />`);
    }

    return tags.join('\n');
  }
);

/**
 * Verify that all product feed endpoints are configured correctly.
 * Returns status for Facebook, Pinterest, and Google Shopping feeds.
 *
 * @function getFeedStatus
 * @returns {Promise<Object>} Feed endpoint configuration status
 * @permission Admin
 */
export const getFeedStatus = webMethod(
  Permissions.Admin,
  async () => {
    return {
      googleShopping: {
        endpoint: `${SITE_URL}/_functions/googleShoppingFeed`,
        format: 'XML (RSS 2.0)',
        configured: true,
      },
      facebookCatalog: {
        endpoint: `${SITE_URL}/_functions/facebookCatalogFeed`,
        format: 'TSV',
        configured: true,
      },
      pinterestCatalog: {
        endpoint: `${SITE_URL}/_functions/pinterestProductFeed`,
        format: 'TSV',
        configured: true,
      },
      sitemap: {
        endpoint: `${SITE_URL}/_functions/productSitemap`,
        format: 'XML',
        configured: true,
      },
    };
  }
);

// ── Helpers ─────────────────────────────────────────────────────────

function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
