// productSchema.js - SEO Schema Injection, Breadcrumbs, Category Detection
// Handles JSON-LD product schema, breadcrumb schema, Open Graph tags,
// and product category/brand detection for alt text generation.

import { getProductSchema, getBreadcrumbSchema, getProductOgTags, getProductFaqSchema, getPageTitle, getPageMetaDescription, getCanonicalUrl } from 'backend/seoHelpers.web';
import { getProductPinData } from 'backend/pinterestRichPins.web';
import { detectProductBrand } from 'public/productPageUtils.js';

/**
 * Initialize breadcrumb navigation and inject breadcrumb schema.
 */
export async function initBreadcrumbs($w, product) {
  try {
    if (!product) return;

    const category = getCategoryFromCollections(product.collections);
    const breadcrumbs = [
      { name: 'Home', url: '/' },
      { name: category.label, url: category.path },
      { name: product.name, url: null },
    ];

    try {
      $w('#breadcrumb1').text = 'Home';
      $w('#breadcrumb1').onClick(() => {
        import('wix-location-frontend').then(({ to }) => to('/'));
      });
      $w('#breadcrumb2').text = category.label;
      $w('#breadcrumb2').onClick(() => {
        import('wix-location-frontend').then(({ to }) => to(category.path));
      });
      $w('#breadcrumb3').text = product.name;
    } catch (e) {}

    const schema = await getBreadcrumbSchema(breadcrumbs);
    if (schema) {
      try {
        $w('#breadcrumbSchemaHtml').postMessage(schema);
      } catch (e) {}
    }
  } catch (e) {}
}

/**
 * Inject dynamic meta tags (title, description, canonical, OG) via wix-seo-frontend.
 * Complements the HtmlComponent-based schema injection with proper head-level meta.
 */
export async function injectProductMeta(product) {
  try {
    if (!product) return;

    const { head } = await import('wix-seo-frontend');

    const title = await getPageTitle('product', { name: product.name });
    if (title) head.setTitle(title);

    const description = await getPageMetaDescription('product', {
      description: product.description,
      name: product.name,
    });
    if (description) head.setMetaTag('description', description);

    const canonical = await getCanonicalUrl('product', product.slug);
    if (canonical) head.setLinks([{ rel: 'canonical', href: canonical }]);

    // Robots meta — noindex out-of-stock products to avoid thin content
    if (product.inStock === false) {
      head.setMetaTag('robots', 'noindex, follow');
    }

    // Set OG meta tags via wix-seo-frontend for crawler access
    try {
      const ogTags = await getProductOgTags(product);
      if (ogTags) {
        const tags = JSON.parse(ogTags);
        for (const [key, value] of Object.entries(tags)) {
          if (key.startsWith('og:') || key.startsWith('product:')) {
            head.setMetaTag(key, value);
          } else if (key.startsWith('twitter:')) {
            head.setMetaTag(key, value);
          }
        }
      }
    } catch (e) { /* OG tag parsing failed — continue with structured data */ }

    // Inject JSON-LD structured data via wix-seo-frontend for SSR
    const schemas = [];
    try {
      const productSchemaJson = await getProductSchema(product);
      if (productSchemaJson) schemas.push(JSON.parse(productSchemaJson));
    } catch (e) { /* schema generation failed — continue */ }

    try {
      const category = getCategoryFromCollections(product.collections);
      const breadcrumbs = [
        { name: 'Home', url: '/' },
        { name: category.label, url: category.path },
        { name: product.name, url: null },
      ];
      const breadcrumbJson = await getBreadcrumbSchema(breadcrumbs);
      if (breadcrumbJson) schemas.push(JSON.parse(breadcrumbJson));
    } catch (e) { /* breadcrumb schema failed — continue */ }

    try {
      const faqJson = await getProductFaqSchema(product);
      if (faqJson) schemas.push(JSON.parse(faqJson));
    } catch (e) { /* FAQ schema failed — continue */ }

    if (schemas.length > 0) {
      head.setStructuredData(schemas);
    }

    // Set Pinterest Rich Pin meta tags
    await injectPinterestMeta(product);
  } catch (e) {
    // Meta tag injection is non-critical
  }
}

/**
 * Inject Pinterest Rich Pin meta tags via wix-seo-frontend.
 * Adds Pinterest-specific product metadata (pinterest:description,
 * pinterest-rich-pin, product:retailer_item_id, sale price) that
 * complement the standard OG tags already set by injectProductMeta.
 */
export async function injectPinterestMeta(product) {
  try {
    if (!product) return;

    const { head } = await import('wix-seo-frontend');

    const pinResult = await getProductPinData({
      name: product.name,
      slug: product.slug,
      description: product.description,
      image: product.mainMedia,
      price: product.price,
      salePrice: product.discountedPrice || undefined,
      inStock: product.inStock !== false,
      brand: detectProductBrand(product) || undefined,
      category: detectProductCategory(product) || undefined,
      sku: product.sku || product._id,
    });

    if (!pinResult.success || !pinResult.meta) return;

    // Set Pinterest-specific tags that aren't covered by standard OG injection
    const pinterestTags = [
      'pinterest:description',
      'pinterest-rich-pin',
      'product:availability',
      'product:retailer_item_id',
      'product:category',
      'product:sale_price:amount',
      'product:sale_price:currency',
    ];

    for (const tag of pinterestTags) {
      if (pinResult.meta[tag]) {
        head.setMetaTag(tag, pinResult.meta[tag]);
      }
    }
  } catch (e) {
    // Pinterest meta injection is non-critical
  }
}

/**
 * Build keyword-rich alt text for product grid thumbnails.
 * Used by crossSell and productGallery for repeater items.
 */
export function buildGridAlt(product) {
  if (!product) return 'Carolina Futons';
  const brand = detectProductBrand(product);
  const category = detectProductCategory(product);
  const parts = [product.name];
  if (brand) parts.push(brand);
  if (category) parts.push(category);
  parts.push('Carolina Futons');
  const alt = parts.join(' - ');
  return alt.length > 125 ? alt.substring(0, 122) + '...' : alt;
}


/**
 * Detect product category label from collections.
 * @param {Object|null} product - Wix product object
 * @returns {string} Category label, or empty string if undetectable
 */
export function detectProductCategory(product) {
  if (!product || !product.collections) return '';
  const colls = Array.isArray(product.collections) ? product.collections : [product.collections];
  if (colls.some(c => c.includes('murphy'))) return 'Murphy Cabinet Bed';
  if (colls.some(c => c.includes('platform'))) return 'Platform Bed';
  if (colls.some(c => c.includes('mattress'))) return 'Futon Mattress';
  if (colls.some(c => c.includes('wall-hugger'))) return 'Wall Hugger Futon Frame';
  if (colls.some(c => c.includes('futon') || c.includes('frame'))) return 'Futon Frame';
  if (colls.some(c => c.includes('casegood') || c.includes('accessor'))) return 'Bedroom Furniture';
  return 'Furniture';
}

/**
 * Map product collections to a category label and URL path for breadcrumbs.
 * @param {Array<string>|string|null} collections - Product collection slugs
 * @returns {{label: string, path: string}} Category label and URL path
 */
export function getCategoryFromCollections(collections) {
  if (!collections) return { label: 'Shop', path: '/shop-main' };

  const collArr = Array.isArray(collections) ? collections : [collections];

  if (collArr.some(c => c.includes('murphy'))) return { label: 'Murphy Cabinet Beds', path: '/murphy-cabinet-beds' };
  if (collArr.some(c => c.includes('platform'))) return { label: 'Platform Beds', path: '/platform-beds' };
  if (collArr.some(c => c.includes('mattress'))) return { label: 'Mattresses', path: '/mattresses' };
  if (collArr.some(c => c.includes('wall-hugger'))) return { label: 'Wall Hugger Frames', path: '/wall-huggers' };
  if (collArr.some(c => c.includes('unfinished'))) return { label: 'Unfinished Wood', path: '/unfinished-wood' };
  if (collArr.some(c => c.includes('casegood') || c.includes('accessor'))) return { label: 'Casegoods & Accessories', path: '/casegoods-accessories' };
  if (collArr.some(c => c.includes('futon') || c.includes('frame'))) return { label: 'Futon Frames', path: '/futon-frames' };

  return { label: 'Shop', path: '/shop-main' };
}
