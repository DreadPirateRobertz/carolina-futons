/**
 * @module pageSeo
 * @description Shared frontend helper for injecting page-level SEO meta tags.
 * Sets title, meta description, Open Graph, and Twitter Card tags via wix-seo-frontend.
 * Canonical URLs are handled globally by masterPage.js — this module handles per-page meta.
 */

import { getPageTitle, getPageMetaDescription, getCanonicalUrl } from 'backend/seoHelpers.web';

const SITE_NAME = 'Carolina Futons';
const DEFAULT_IMAGE = 'https://www.carolinafutons.com/logo.png';
const TWITTER_HANDLE = '@CarolinaFutons';

/**
 * Initialize SEO meta tags for a page.
 * @param {string} pageType - Page type: 'home', 'product', 'category', 'blog', 'blogPost', 'faq', 'contact', 'about', etc.
 * @param {Object} [data] - Page-specific data (name, slug, description, image, etc.)
 */
export async function initPageSeo(pageType, data = {}) {
  try {
    const { head } = await import('wix-seo-frontend');

    const title = await getPageTitle(pageType, data);
    const description = await getPageMetaDescription(pageType, data);
    const url = await getCanonicalUrl(pageType, data.slug);
    const image = data.image || DEFAULT_IMAGE;
    const OG_TYPE = { product: 'product', blogPost: 'article', buyingGuide: 'article' };
    const isArticle = pageType === 'blogPost' || pageType === 'buyingGuide';
    const useLargeImage = pageType === 'product' || pageType === 'buyingGuide' || (pageType === 'blogPost' && data.image);
    const ogType = OG_TYPE[pageType] || 'website';

    head.setTitle(title);

    const metaTags = [
      { name: 'description', content: description },
      // Open Graph
      { property: 'og:type', content: ogType },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:image', content: image },
      // Twitter Card
      { name: 'twitter:card', content: useLargeImage ? 'summary_large_image' : 'summary' },
      { name: 'twitter:site', content: TWITTER_HANDLE },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image },
    ];

    if (useLargeImage && data.image) {
      metaTags.push(
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
      );
    }

    if (isArticle && data.category) {
      metaTags.push({ property: 'article:section', content: data.category });
    }

    head.setMetaTags(metaTags);
  } catch (e) {
    // SEO injection is non-critical — page still renders
  }
}
