/**
 * Import/sync scraped product data with Wix Stores/Products.
 *
 * NOTE: Wix Stores products cannot be inserted via wix-data directly.
 * They use the wix-stores-backend SDK. This module handles the mapping
 * from scraped data to Wix Stores product format.
 *
 * Expected input shape per item:
 * {
 *   name: string,
 *   slug?: string,
 *   description: string,          // HTML description
 *   price: number,                // base price in USD
 *   discountedPrice?: number,     // sale price if on sale
 *   sku?: string,
 *   weight?: number,              // lbs
 *   ribbon?: string,              // "Featured", "New", "Sale"
 *   category: string,             // category slug
 *   images: string[],             // image URLs
 *   media?: Array<{               // enriched media objects (from enrichProductImages)
 *     type: string,               // "image"
 *     url: string,                // image URL
 *     alt: string,                // SEO alt text
 *     width?: number,
 *     height?: number,
 *     source?: string             // manufacturer source
 *   }>,
 *   options?: Array<{             // product variants
 *     name: string,               // e.g. "Size", "Color"
 *     choices: string[]           // e.g. ["Full", "Queen"]
 *   }>,
 *   additionalInfo?: Array<{      // info sections
 *     title: string,
 *     description: string         // HTML
 *   }>
 * }
 */
import wixData from 'wix-data';
import { processBatches, requireString, sanitize, sanitizeRichText } from './importConfig';

/**
 * Build Wix-compatible mediaItems array from product data.
 * Prefers enriched media objects (with alt text), falls back to raw image URLs.
 * @param {Object} product - Product data from scrape/enrichment
 * @returns {Array} Wix mediaItems format
 */
function buildMediaItems(product) {
  // Prefer enriched media objects (from enrichProductImages.js)
  if (Array.isArray(product.media) && product.media.length > 0) {
    return product.media.map((m, i) => ({
      src: m.url || '',
      type: m.type || 'image',
      title: product.name || '',
      altText: m.alt || buildDefaultAltText(product.name, i),
      width: m.width || 0,
      height: m.height || 0,
    }));
  }

  // Fall back to raw image URLs array
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images.map((url, i) => ({
      src: url,
      type: 'image',
      title: product.name || '',
      altText: buildDefaultAltText(product.name, i),
    }));
  }

  return [];
}

/**
 * Build a default alt text string when no enriched alt is available.
 * @param {string} name - Product name
 * @param {number} index - Image position
 * @returns {string}
 */
function buildDefaultAltText(name, index) {
  const productName = name || 'Product';
  if (index === 0) return `${productName} - Main Product Image`;
  return `${productName} - View ${index + 1}`;
}

/**
 * Import products into Wix Stores. Uses Stores/Products collection for
 * read-back dedup, but creates via wixData.insert to Stores/Products
 * which Wix routes to the Stores backend.
 *
 * For stores that require the full Products API, the admin should use
 * the Wix Dashboard import CSV feature instead. This module prepares
 * the data in the correct format for either path.
 *
 * @param {Array<Object>} products - Array of product objects matching the input shape in the module header.
 * @returns {Promise<{inserted: number, skipped: number, errors: Array<Object>, prepared: Array<Object>}>}
 *   inserted: records successfully written to Stores/Products.
 *   skipped: records that failed validation or were duplicates.
 *   errors: [{name, error, note?}] — includes both validation and insert failures.
 *   prepared: all valid records ready for CSV export (populated even if insert fails).
 * @throws {Error} Only on unexpected wixData.query failures during dedup prefetch.
 */
export async function importProducts(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return { inserted: 0, skipped: 0, errors: [{ error: 'No product data provided' }], prepared: [] };
  }

  // Pre-fetch existing product names for dedup
  const existingNames = new Set();
  const existingSkus = new Set();
  let skip = 0;
  const PAGE = 100;
  while (true) {
    const page = await wixData.query('Stores/Products')
      .limit(PAGE)
      .skip(skip)
      .find();
    for (const item of page.items) {
      existingNames.add(item.name?.toLowerCase());
      if (item.sku) existingSkus.add(item.sku);
    }
    if (page.items.length < PAGE) break;
    skip += PAGE;
  }

  const prepared = [];

  const results = await processBatches(products, async (batch) => {
    let inserted = 0;
    let skipped = 0;
    const errors = [];

    for (const product of batch) {
      const validationErrors = [
        requireString(product.name, 'name'),
        requireString(product.description, 'description'),
      ].filter(Boolean);

      if (typeof product.price !== 'number' || product.price <= 0) {
        validationErrors.push('price must be a positive number');
      }

      if (validationErrors.length > 0) {
        errors.push({ name: product.name, errors: validationErrors });
        skipped++;
        continue;
      }

      // Dedup by name or SKU
      const nameLower = product.name.toLowerCase();
      if (existingNames.has(nameLower)) {
        skipped++;
        continue;
      }
      if (product.sku && existingSkus.has(product.sku)) {
        skipped++;
        continue;
      }

      // Build media items with alt text for Wix gallery format
      const mediaItems = buildMediaItems(product);

      // Prepare Wix Stores product record.
      // _scraped preserves fields not supported by direct wixData.insert
      // (slug, category, options, additionalInfo) so they can be applied
      // post-import via the Wix Dashboard or a separate enrichment pass.
      const record = {
        name: sanitize(product.name, 500),
        description: sanitizeRichText(product.description, 50000),
        price: product.price,
        sku: product.sku ? sanitize(product.sku, 100) : '',
        weight: typeof product.weight === 'number' ? product.weight : 0,
        ribbon: product.ribbon ? sanitize(product.ribbon, 50) : '',
        mediaItems,
        _scraped: {
          slug: product.slug || '',
          category: product.category || '',
          images: Array.isArray(product.images) ? product.images : [],
          options: Array.isArray(product.options) ? product.options : [],
          additionalInfo: Array.isArray(product.additionalInfo) ? product.additionalInfo : [],
          discountedPrice: product.discountedPrice,
        },
      };

      if (product.discountedPrice && product.discountedPrice < product.price) {
        record.discountedPrice = product.discountedPrice;
      }

      prepared.push(record);

      // Attempt direct insert — may fail if Stores/Products requires
      // the Stores API. In that case, the prepared array is the output.
      try {
        await wixData.insert('Stores/Products', {
          name: record.name,
          description: record.description,
          price: record.price,
          sku: record.sku,
          weight: record.weight,
          ribbon: record.ribbon,
        });
        existingNames.add(nameLower);
        if (record.sku) existingSkus.add(record.sku);
        inserted++;
      } catch (err) {
        // Expected — Stores/Products often needs the Stores API
        errors.push({
          name: product.name,
          error: err.message,
          note: 'Product prepared but may require Wix Dashboard CSV import',
        });
      }
    }

    return { inserted, skipped, errors };
  });

  results.prepared = prepared;
  return results;
}

/**
 * Export products as CSV-ready objects for Wix Dashboard import.
 * Use this if direct wixData.insert to Stores/Products fails.
 * @param {Array} products - Scraped product data.
 * @returns {Array} Objects with Wix CSV import column names.
 */
export function prepareProductsCsv(products) {
  return (products || []).map((p, i) => {
    // Build image URLs — prefer enriched media, fall back to images array
    let imageUrls = '';
    if (Array.isArray(p.media) && p.media.length > 0) {
      imageUrls = p.media.map(m => m.url || '').filter(Boolean).join(';');
    } else if (Array.isArray(p.images)) {
      imageUrls = p.images.join(';');
    }

    // Build alt text for images
    let imageAltText = '';
    if (Array.isArray(p.media) && p.media.length > 0) {
      imageAltText = p.media.map(m => m.alt || '').join(';');
    }

    return {
      handleId: p.slug || `product-${i}`,
      fieldType: 'Product',
      name: p.name || '',
      description: p.description || '',
      productImageUrl: imageUrls,
      productImageAltText: imageAltText,
      price: p.price || 0,
      discountedPrice: p.discountedPrice || '',
      sku: p.sku || '',
      ribbon: p.ribbon || '',
      weight: p.weight || '',
      collection: p.category || '',
      productOptionName1: p.options?.[0]?.name || '',
      productOptionDescription1: p.options?.[0]?.choices?.join(';') || '',
      productOptionName2: p.options?.[1]?.name || '',
      productOptionDescription2: p.options?.[1]?.choices?.join(';') || '',
      additionalInfoTitle1: p.additionalInfo?.[0]?.title || '',
      additionalInfoDescription1: p.additionalInfo?.[0]?.description || '',
      additionalInfoTitle2: p.additionalInfo?.[1]?.title || '',
      additionalInfoDescription2: p.additionalInfo?.[1]?.description || '',
    };
  });
}
