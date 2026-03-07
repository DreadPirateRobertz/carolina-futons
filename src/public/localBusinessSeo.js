/**
 * @module localBusinessSeo
 * SSR injection of LocalBusiness/FurnitureStore structured data, meta tags,
 * and canonical URLs for Contact and Store Locator pages via wix-seo-frontend.
 *
 * These functions complement the existing HtmlComponent-based schema injection
 * by adding SSR-level head tags that crawlers can index without JavaScript.
 */
import { getBusinessSchema, getPageTitle, getPageMetaDescription, getCanonicalUrl } from 'backend/seoHelpers.web';
import { getStoreLocatorSchema } from 'backend/storeLocatorService.web';

/**
 * Inject SSR meta tags and FurnitureStore structured data for the Contact page.
 * Sets title, description, canonical, and JSON-LD via wix-seo-frontend head.
 * @returns {Promise<void>}
 */
export async function injectContactSeoSsr() {
  try {
    const { head } = await import('wix-seo-frontend');

    const [title, description, canonical] = await Promise.all([
      getPageTitle('contact'),
      getPageMetaDescription('contact'),
      getCanonicalUrl('contact'),
    ]);

    if (title) head.setTitle(title);
    if (description) head.setMetaTag('description', description);
    if (canonical) head.setLinks([{ rel: 'canonical', href: canonical }]);

    const schemas = [];
    try {
      const businessJson = await getBusinessSchema();
      if (businessJson) schemas.push(JSON.parse(businessJson));
    } catch (e) { /* schema failed */ }

    if (schemas.length > 0) {
      head.setStructuredData(schemas);
    }
  } catch (e) {
    // SSR injection is non-critical
  }
}

/**
 * Inject SSR meta tags and FurnitureStore structured data for the Store Locator page.
 * Uses the store-locator-specific schema which includes showroom-specific details.
 * @returns {Promise<void>}
 */
export async function injectStoreLocatorSeoSsr() {
  try {
    const { head } = await import('wix-seo-frontend');

    const [title, description, canonical] = await Promise.all([
      getPageTitle('contact', { variant: 'store-locator' }),
      getPageMetaDescription('contact'),
      getCanonicalUrl('contact', 'store-locator'),
    ]);

    if (title) head.setTitle(title);
    if (description) head.setMetaTag('description', description);
    if (canonical) head.setLinks([{ rel: 'canonical', href: canonical }]);

    const schemas = [];
    try {
      const storeJson = await getStoreLocatorSchema();
      if (storeJson) schemas.push(JSON.parse(storeJson));
    } catch (e) { /* schema failed */ }

    if (schemas.length > 0) {
      head.setStructuredData(schemas);
    }
  } catch (e) {
    // SSR injection is non-critical
  }
}
