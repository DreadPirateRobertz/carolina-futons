/**
 * @module batchAltText
 * @description Batch-update product image alt text in Wix Store.
 * Queries all products, generates SEO-friendly alt text using the
 * same pattern as buildGridAlt/imageAltText, and writes it back to
 * each product's media items.
 *
 * Run from admin page or dashboard: import { runBatchAltTextUpdate } from 'backend/batchAltText.web';
 *
 * @requires wix-web-module
 * @requires wix-stores-backend
 */
import { Permissions, webMethod } from 'wix-web-module';
import { products } from 'wix-stores-backend';

// ── Brand & category detection (matches productPageUtils.js) ─────

const BRAND_RULES = [
  { match: 'wall-hugger', brand: 'Strata Furniture' },
  { match: 'unfinished', brand: 'KD Frames' },
  { match: 'otis', brand: 'Otis Bed' },
  { match: 'mattress', brand: 'Otis Bed' },
  { match: 'arizona', brand: 'Arizona' },
];

const CATEGORY_RULES = [
  { match: 'murphy', label: 'Murphy Cabinet Bed' },
  { match: 'platform', label: 'Platform Bed' },
  { match: 'mattress', label: 'Futon Mattress' },
  { match: 'wall-hugger', label: 'Wall Hugger Futon Frame' },
  { match: 'futon', label: 'Futon Frame' },
  { match: 'frame', label: 'Futon Frame' },
  { match: 'casegood', label: 'Bedroom Furniture' },
  { match: 'accessor', label: 'Bedroom Furniture' },
  { match: 'cover', label: 'Futon Cover' },
  { match: 'pillow', label: 'Pillow' },
];

const POSITION_LABELS = [
  'Main Product Image',
  'Alternate View',
  'Detail View',
  'Additional View',
];

function detectBrand(collectionSlugs) {
  if (!collectionSlugs || collectionSlugs.length === 0) return 'Night & Day Furniture';
  const joined = collectionSlugs.join(' ').toLowerCase();
  for (const rule of BRAND_RULES) {
    if (joined.includes(rule.match)) return rule.brand;
  }
  return 'Night & Day Furniture';
}

function detectCategory(collectionSlugs) {
  if (!collectionSlugs || collectionSlugs.length === 0) return 'Furniture';
  const joined = collectionSlugs.join(' ').toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (joined.includes(rule.match)) return rule.label;
  }
  return 'Furniture';
}

function detectImageContext(url) {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes('lifestyle') || lower.includes('room') || lower.includes('scene')) return 'Lifestyle Room Setting';
  if (lower.includes('detail') || lower.includes('closeup')) return 'Detail Close-up';
  if (lower.includes('dimension') || lower.includes('spec')) return 'Dimensions Diagram';
  if (lower.includes('trundle') || lower.includes('drawer') || lower.includes('storage')) return 'With Storage Option';
  if (lower.includes('front')) return 'Front View';
  if (lower.includes('side')) return 'Side View';
  if (lower.includes('back') || lower.includes('rear')) return 'Back View';
  return null;
}

/**
 * Generate alt text for a product image.
 * @param {string} productName
 * @param {string} brand
 * @param {string} category
 * @param {number} imageIndex
 * @param {string} [imageUrl]
 * @returns {string}
 */
function buildAltText(productName, brand, category, imageIndex, imageUrl) {
  const parts = [productName];
  if (brand && !productName.toLowerCase().startsWith(brand.toLowerCase())) {
    parts.unshift(brand);
  }
  if (category && !productName.toLowerCase().includes(category.toLowerCase().split(' ')[0])) {
    parts.push(category);
  }

  const urlContext = detectImageContext(imageUrl);
  if (urlContext) {
    parts.push(`- ${urlContext}`);
  } else if (imageIndex < POSITION_LABELS.length) {
    parts.push(`- ${POSITION_LABELS[imageIndex]}`);
  } else {
    parts.push(`- View ${imageIndex + 1}`);
  }

  const alt = parts.join(' ');
  return alt.length > 125 ? alt.substring(0, 122) + '...' : alt;
}

// ── Batch update ─────────────────────────────────────────────────

/**
 * Batch-update alt text for all product images in the Wix Store.
 * Skips products whose media already has alt text.
 * @param {Object} [opts]
 * @param {boolean} [opts.force=false] - Overwrite existing alt text
 * @param {boolean} [opts.dryRun=false] - Preview without writing
 * @returns {{ updated: number, skipped: number, errors: string[], previews: Array }}
 */
export const runBatchAltTextUpdate = webMethod(
  Permissions.Admin,
  async (opts = {}) => {
    const { force = false, dryRun = false } = opts;
    const results = { updated: 0, skipped: 0, errors: [], previews: [] };

    try {
      // Query all products (Wix limits to 100 per query, paginate)
      let allProducts = [];
      let skip = 0;
      const limit = 100;

      while (true) {
        const query = await products.queryProducts()
          .skip(skip)
          .limit(limit)
          .find();

        allProducts = allProducts.concat(query.items);
        if (query.items.length < limit) break;
        skip += limit;
      }

      for (const product of allProducts) {
        try {
          const media = product.mediaItems || [];
          if (media.length === 0) {
            results.skipped++;
            continue;
          }

          // Get collection slugs for brand/category detection
          const collectionSlugs = (product.collections || []).map(c =>
            typeof c === 'string' ? c : (c.slug || c.name || '')
          );
          const brand = detectBrand(collectionSlugs);
          const category = detectCategory(collectionSlugs);

          let needsUpdate = false;
          const updatedMedia = media.map((item, index) => {
            const currentAlt = item.title || item.altText || '';
            if (currentAlt.length >= 10 && !force) {
              return item;
            }
            needsUpdate = true;
            const newAlt = buildAltText(
              product.name,
              brand,
              category,
              index,
              item.src || item.url || ''
            );
            return { ...item, title: newAlt, altText: newAlt };
          });

          if (!needsUpdate) {
            results.skipped++;
            continue;
          }

          if (dryRun) {
            results.previews.push({
              name: product.name,
              id: product._id,
              alts: updatedMedia.map(m => m.title || m.altText),
            });
            results.updated++;
            continue;
          }

          await products.updateProductFields(product._id, {
            mediaItems: updatedMedia,
          });
          results.updated++;
        } catch (err) {
          results.errors.push(`${product.name}: ${err.message}`);
        }
      }
    } catch (err) {
      results.errors.push(`Query failed: ${err.message}`);
    }

    return results;
  }
);

/**
 * Preview alt text for a single product (for testing).
 * @param {string} productId
 * @returns {{ name: string, media: Array<{src: string, currentAlt: string, newAlt: string}> }}
 */
export const previewProductAltText = webMethod(
  Permissions.Admin,
  async (productId) => {
    try {
      const product = await products.getProduct(productId);
      if (!product) return { error: 'Product not found' };

      const collectionSlugs = (product.collections || []).map(c =>
        typeof c === 'string' ? c : (c.slug || c.name || '')
      );
      const brand = detectBrand(collectionSlugs);
      const category = detectCategory(collectionSlugs);

      const media = (product.mediaItems || []).map((item, index) => ({
        src: item.src || item.url || '',
        currentAlt: item.title || item.altText || '(empty)',
        newAlt: buildAltText(product.name, brand, category, index, item.src || item.url || ''),
      }));

      return { name: product.name, brand, category, media };
    } catch (err) {
      return { error: err.message };
    }
  }
);
