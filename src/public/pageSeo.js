/**
 * @module pageSeo
 * @description Shared frontend helper for injecting page-level SEO meta tags.
 * Sets title, meta description, Open Graph, and Twitter Card tags via wix-seo-frontend.
 * Canonical URLs are handled globally by masterPage.js — this module handles per-page meta.
 */

import { getPageTitle, getPageMetaDescription } from 'backend/seoHelpers.web';

const BASE_URL = 'https://www.carolinafutons.com';
const SITE_NAME = 'Carolina Futons';
const DEFAULT_IMAGE = 'https://www.carolinafutons.com/logo.png';

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
    const image = data.image || DEFAULT_IMAGE;
    const isProduct = pageType === 'product';

    head.setTitle(title);

    head.setMetaTags([
      { name: 'description', content: description },
      // Open Graph
      { property: 'og:type', content: isProduct ? 'product' : 'website' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:image', content: image },
      // Twitter Card
      { name: 'twitter:card', content: isProduct ? 'summary_large_image' : 'summary' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image },
    ]);
  } catch (e) {
    // SEO injection is non-critical — page still renders
  }
}
