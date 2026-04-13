/**
 * @module seoAutoMeta
 * @description Auto-generates SEO meta descriptions for products that are
 * missing custom descriptions. Stores generated descriptions in the
 * ProductMetaDescriptions CMS collection so they can be served without
 * re-generating on every request.
 *
 * Generated descriptions are XSS-safe: all product fields are sanitized
 * with the shared `sanitize()` utility before being composed into the string.
 *
 * @setup
 * Create `ProductMetaDescriptions` CMS collection with fields:
 *   productId    (text, indexed, unique)
 *   description  (text)
 *   generatedAt  (dateTime)
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

const COLLECTION = 'ProductMetaDescriptions';
const PRODUCTS_COLLECTION = 'Stores/Products';
const MAX_META_LEN = 155;
const STORE_NAME = 'Carolina Futons';

// ── Brand detection (mirrors googleMerchantFeed.web.js logic) ─────────────────

function getBrand(collections) {
  const collArr = Array.isArray(collections) ? collections : [collections || ''];
  if (collArr.some(c => c.includes('wall-hugger'))) return 'Strata Furniture';
  if (collArr.some(c => c.includes('unfinished'))) return 'KD Frames';
  if (collArr.some(c => c.includes('otis') || c.includes('mattress'))) return 'Otis Bed';
  if (collArr.some(c => c.includes('arizona'))) return 'Arizona';
  return 'Night & Day Furniture';
}

// ── Category descriptor (human-readable for prose meta description) ───────────

function getCategoryDescriptor(collections) {
  const collArr = Array.isArray(collections) ? collections : [collections || ''];
  if (collArr.some(c => c.includes('murphy'))) return 'a space-saving murphy cabinet bed';
  if (collArr.some(c => c.includes('platform'))) return 'a platform bed';
  if (collArr.some(c => c.includes('mattress'))) return 'a quality futon mattress';
  if (collArr.some(c => c.includes('wall-hugger'))) return 'a wall-hugger futon frame';
  if (collArr.some(c => c.includes('unfinished'))) return 'an unfinished wood futon frame';
  if (collArr.some(c => c.includes('cover'))) return 'a futon cover';
  if (collArr.some(c => c.includes('outdoor'))) return 'outdoor furniture';
  if (collArr.some(c => c.includes('pillow'))) return 'a futon pillow or bolster';
  if (collArr.some(c => c.includes('log'))) return 'a log-style futon frame';
  if (collArr.some(c => c.includes('casegood') || c.includes('accessor'))) return 'bedroom furniture';
  if (collArr.some(c => c.includes('futon') || c.includes('frame'))) return 'a futon frame';
  return 'quality furniture';
}

// ── Core generation ───────────────────────────────────────────────────────────

/**
 * Generate a meta description for a product.
 * All product fields are sanitized before use — safe against XSS stored in CMS.
 *
 * Output format: "{Brand} {name} — {categoryDescriptor}. Shop at Carolina Futons{priceHint}."
 * Result is capped at MAX_META_LEN (155) characters.
 *
 * @param {Object} product - Wix Stores product object.
 * @returns {string} Generated meta description.
 */
export function generateMetaDescription(product) {
  if (!product || !product.name) {
    return `Shop quality futons, mattresses, and bedroom furniture at ${STORE_NAME}.`;
  }

  const name = sanitize(product.name, 100);
  const brand = sanitize(getBrand(product.collections), 50);
  const categoryDesc = getCategoryDescriptor(product.collections);

  // Use discounted price if present, else regular price
  const price = product.discountedPrice != null ? product.discountedPrice : product.price;

  let desc = `${brand} ${name} — ${categoryDesc}. Shop at ${STORE_NAME}`;
  if (price != null && Number(price) > 0) {
    desc += ` starting at $${Number(price).toFixed(0)}`;
  }
  desc += '.';

  if (desc.length > MAX_META_LEN) {
    desc = desc.slice(0, MAX_META_LEN - 1) + '\u2026';
  }

  return desc;
}

// ── Web methods ───────────────────────────────────────────────────────────────

/**
 * Get or generate a meta description for a single product.
 * Returns a saved description if one exists; otherwise generates one on the fly
 * without persisting it (use backfillProductMetaDescriptions to persist in bulk).
 *
 * @param {string} productId
 * @returns {Promise<{success: boolean, productId: string, description: string, source: 'saved'|'generated', error?: string}>}
 */
export const getProductMetaDescription = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      if (!productId || typeof productId !== 'string') {
        return { success: false, productId: '', description: '', error: 'productId is required.' };
      }

      // Check for saved description first
      const existing = await wixData
        .query(COLLECTION)
        .eq('productId', productId)
        .limit(1)
        .find();

      if (existing.items.length > 0) {
        return {
          success: true,
          productId,
          description: existing.items[0].description,
          source: 'saved',
        };
      }

      // Fetch product and generate
      const product = await wixData.get(PRODUCTS_COLLECTION, productId);
      const description = generateMetaDescription(product || null);

      return { success: true, productId, description, source: 'generated' };
    } catch (err) {
      console.error('[seoAutoMeta] getProductMetaDescription error:', err);
      return { success: false, productId: productId || '', description: '', error: 'Failed to get meta description.' };
    }
  }
);

/**
 * Scan all visible products and generate meta descriptions for any that don't
 * already have one saved. Inserts new records into ProductMetaDescriptions.
 * Idempotent — skips products that already have a saved description.
 *
 * @returns {Promise<{success: boolean, generated: number, skipped: number, error?: string}>}
 */
export const backfillProductMetaDescriptions = webMethod(
  Permissions.Admin,
  async () => {
    try {
      // Fetch all visible products (paginated)
      const products = [];
      let skip = 0;
      const pageSize = 100;
      while (true) {
        const page = await wixData
          .query(PRODUCTS_COLLECTION)
          .eq('visible', true)
          .skip(skip)
          .limit(pageSize)
          .find();
        products.push(...page.items);
        if (page.items.length < pageSize) break;
        skip += pageSize;
      }

      // Fetch all existing saved descriptions (paginated) for dedup
      const savedIds = new Set();
      let savedSkip = 0;
      while (true) {
        const savedPage = await wixData
          .query(COLLECTION)
          .skip(savedSkip)
          .limit(pageSize)
          .find();
        for (const item of savedPage.items) savedIds.add(item.productId);
        if (savedPage.items.length < pageSize) break;
        savedSkip += pageSize;
      }

      let generated = 0;
      let skipped = 0;

      for (const product of products) {
        if (savedIds.has(product._id)) {
          skipped++;
          continue;
        }

        const description = generateMetaDescription(product);
        try {
          await wixData.insert(COLLECTION, {
            productId: product._id,
            description,
            generatedAt: new Date(),
          });
          generated++;
        } catch (insertErr) {
          // Likely a duplicate from a concurrent run — skip silently
          console.error('[seoAutoMeta] insert error for', product._id, insertErr?.message);
        }
      }

      return { success: true, generated, skipped };
    } catch (err) {
      console.error('[seoAutoMeta] backfillProductMetaDescriptions error:', err);
      return { success: false, generated: 0, skipped: 0, error: 'Backfill failed.' };
    }
  }
);
