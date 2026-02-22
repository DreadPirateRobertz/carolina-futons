// productSchema.js - SEO Schema Injection, Breadcrumbs, Category Detection
// Handles JSON-LD product schema, breadcrumb schema, Open Graph tags,
// and product category/brand detection for alt text generation.

import { getProductSchema, getBreadcrumbSchema, getProductOgTags, getProductFaqSchema } from 'backend/seoHelpers.web';

/**
 * Inject JSON-LD product schema, FAQ schema, and OG tags.
 */
export async function injectProductSchema($w, product) {
  try {
    if (!product) return;

    const schema = await getProductSchema(product);
    if (schema) {
      $w('#productSchemaHtml').postMessage(schema);
    }

    const faqSchema = await getProductFaqSchema(product);
    if (faqSchema) {
      try { $w('#productFaqSchemaHtml').postMessage(faqSchema); } catch (e) {}
    }

    const ogTags = await getProductOgTags(product);
    if (ogTags) {
      try { $w('#productOgHtml').postMessage(ogTags); } catch (e) {}
    }
  } catch (e) {}
}

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
 * Build keyword-rich alt text for product grid thumbnails.
 * Used by crossSell and productGallery for repeater items.
 */
export function buildGridAlt(product) {
  const brand = detectProductBrand(product);
  const category = detectProductCategory(product);
  const parts = [product.name];
  if (brand) parts.push(brand);
  if (category) parts.push(category);
  parts.push('Carolina Futons');
  const alt = parts.join(' - ');
  return alt.length > 125 ? alt.substring(0, 122) + '...' : alt;
}

export function detectProductBrand(product) {
  if (!product.collections) return '';
  const colls = Array.isArray(product.collections) ? product.collections : [product.collections];
  if (colls.some(c => c.includes('wall-hugger'))) return 'Strata Furniture';
  if (colls.some(c => c.includes('unfinished'))) return 'KD Frames';
  if (colls.some(c => c.includes('mattress'))) return 'Otis Bed';
  return 'Night & Day Furniture';
}

export function detectProductCategory(product) {
  if (!product.collections) return '';
  const colls = Array.isArray(product.collections) ? product.collections : [product.collections];
  if (colls.some(c => c.includes('murphy'))) return 'Murphy Cabinet Bed';
  if (colls.some(c => c.includes('platform'))) return 'Platform Bed';
  if (colls.some(c => c.includes('mattress'))) return 'Futon Mattress';
  if (colls.some(c => c.includes('wall-hugger'))) return 'Wall Hugger Futon Frame';
  if (colls.some(c => c.includes('futon') || c.includes('frame'))) return 'Futon Frame';
  if (colls.some(c => c.includes('casegood') || c.includes('accessor'))) return 'Bedroom Furniture';
  return 'Furniture';
}

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
