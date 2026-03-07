// faqSeo.js - FAQ Page SEO injection via wix-seo-frontend (SSR)
// Consolidates FAQ structured data and meta tag injection for crawler visibility.

import { getFaqSchema, getPageTitle, getPageMetaDescription, getCanonicalUrl } from 'backend/seoHelpers.web';
import { getFaqData, buildFaqSchemaData } from 'public/faqHelpers.js';

/**
 * Inject FAQ structured data and meta tags via wix-seo-frontend for SSR.
 * Sets FAQPage JSON-LD schema, page title, meta description, and canonical URL.
 * Each injection step is independently guarded — one failure does not block the others.
 */
export async function injectFaqSeo() {
  try {
    const { head } = await import('wix-seo-frontend');

    // Inject FAQPage JSON-LD structured data
    try {
      const schemaData = buildFaqSchemaData(getFaqData());
      const schemaJson = await getFaqSchema(schemaData);
      if (schemaJson) {
        const schema = JSON.parse(schemaJson);
        head.setStructuredData([schema]);
      }
    } catch (e) { /* schema injection failed — continue with meta tags */ }

    // Set page title
    try {
      const title = await getPageTitle('faq');
      if (title) head.setTitle(title);
    } catch (e) { /* title failed — continue */ }

    // Set meta description
    try {
      const description = await getPageMetaDescription('faq');
      if (description) head.setMetaTag('description', description);
    } catch (e) { /* description failed — continue */ }

    // Set canonical URL
    try {
      const canonical = await getCanonicalUrl('faq');
      if (canonical) head.setLinks([{ rel: 'canonical', href: canonical }]);
    } catch (e) { /* canonical failed — continue */ }
  } catch (e) {
    // wix-seo-frontend import failed — non-critical
  }
}
