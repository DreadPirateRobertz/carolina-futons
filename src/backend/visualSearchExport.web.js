/**
 * @module visualSearchExport
 * @description Batch product image catalog export for mobile visual search.
 * Generates a JSON payload with all product image URLs for dallas mobile
 * app to download and compute ML embeddings client-side.
 *
 * Endpoints:
 *   generateExport()      — Cron-triggered nightly batch generation (4am ET)
 *   getExportData()       — Direct fallback for mobile clients (rate-limited)
 *
 * Contract (agreed with dallas mobile team):
 *   { version, generatedAt, totalProducts, products: [{ id, name, slug, sku,
 *     category, price, images: [{ url, width, height }] }] }
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * 1. Add to Wix Secrets Manager:
 *      CRON_SECRET — shared secret for cron endpoint auth
 *
 * 2. Create CMS collection `VisualSearchExportCache`:
 *      key (Text, unique) — 'latest'
 *      payload (Text) — JSON string of the export data
 *      generatedAt (DateTime) — when the export was generated
 *      productCount (Number) — number of products in the export
 *
 * 3. Configure cron in vercel.json / Wix Jobs:
 *      Schedule: daily at 4am ET (after GC cron at 3am)
 *      Endpoint: generateExport with CRON_SECRET
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { getImageUrl } from 'backend/utils/mediaHelpers';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { logAuditEvent } from 'backend/utils/auditLog';
import { logError } from 'backend/utils/errorHandler';

const CACHE_COLLECTION = 'VisualSearchExportCache';
const CACHE_KEY = 'latest';
const PAGE_SIZE = 1000;
const EXPORT_VERSION = '1.0.0';

// Default image dimensions for Wix CDN images (fit/w_2000,h_2000)
const DEFAULT_WIDTH = 2000;
const DEFAULT_HEIGHT = 2000;

/**
 * Fetch all products from Stores/Products, paginating past the 1000-item limit.
 * @returns {Promise<Array>} All product records
 */
async function fetchAllProducts() {
  let allItems = [];
  let skip = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await wixData.query('Stores/Products')
      .limit(PAGE_SIZE)
      .skip(skip)
      .find({ suppressAuth: true });
    const items = result.items ?? [];
    allItems = allItems.concat(items);
    skip += PAGE_SIZE;
    hasMore = items.length === PAGE_SIZE;
  }

  return allItems;
}

/**
 * Transform a Wix product record into the mobile export format.
 * @param {Object} product - Wix Stores/Products record
 * @returns {Object} Mobile-friendly product with image URLs
 */
function transformProduct(product) {
  const mainImage = getImageUrl(product.mainMedia);
  const additionalImages = (product.mediaItems || [])
    .map(m => getImageUrl(m.src || m))
    .filter(Boolean);

  // Deduplicate: main image may also appear in mediaItems
  const allUrls = [...new Set([mainImage, ...additionalImages].filter(Boolean))];

  return {
    id: product._id,
    name: product.name || '',
    slug: product.slug || '',
    sku: product.sku || '',
    category: product.productType || '',
    price: product.price || 0,
    images: allUrls.map(url => ({
      url,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    })),
  };
}

/**
 * Build the full export payload from all products.
 * @returns {Promise<Object>} Export payload matching the mobile contract
 */
async function buildExportPayload() {
  const products = await fetchAllProducts();

  const transformed = products
    .filter(p => p.visible !== false) // Skip hidden/draft products
    .map(transformProduct);

  return {
    version: EXPORT_VERSION,
    generatedAt: new Date().toISOString(),
    totalProducts: transformed.length,
    products: transformed,
  };
}

// ── generateExport (cron endpoint) ──────────────────────────────────

/**
 * Generate and cache the batch export. Called by nightly cron at 4am ET.
 * Authenticates via CRON_SECRET to prevent unauthorized triggers.
 *
 * @param {string} cronSecret - Cron authentication secret
 * @returns {Promise<{success: boolean, productCount?: number, error?: string}>}
 * @permission Admin — cron endpoint, not public
 */
export const generateExport = webMethod(
  Permissions.Admin,
  async (cronSecret) => {
    try {
      const { getSecret } = await import('wix-secrets-backend');
      const expectedSecret = await getSecret('CRON_SECRET');
      if (!cronSecret || cronSecret !== expectedSecret) {
        return { success: false, error: 'Authentication failed' };
      }

      const payload = await buildExportPayload();
      const payloadJson = JSON.stringify(payload);

      // Upsert to cache collection
      const existing = await wixData.query(CACHE_COLLECTION)
        .eq('key', CACHE_KEY)
        .limit(1)
        .find({ suppressAuth: true });

      if (existing.items.length > 0) {
        await wixData.update(CACHE_COLLECTION, {
          ...existing.items[0],
          payload: payloadJson,
          generatedAt: new Date(),
          productCount: payload.totalProducts,
        }, { suppressAuth: true });
      } else {
        await wixData.insert(CACHE_COLLECTION, {
          key: CACHE_KEY,
          payload: payloadJson,
          generatedAt: new Date(),
          productCount: payload.totalProducts,
        }, { suppressAuth: true });
      }

      logAuditEvent('VisualSearchExportCache', 'generate', 'cron', { productCount: payload.totalProducts });
      return { success: true, productCount: payload.totalProducts };
    } catch (err) {
      logError('visualSearchExport.generateExport', err);
      return { success: false, error: 'Export generation failed' };
    }
  }
);

// ── getExportData (public fallback) ─────────────────────────────────

/**
 * Get the latest cached export data. Rate-limited to 10/min per caller.
 * Mobile clients use this as a fallback if the cached export is stale.
 *
 * @param {string} [clientId] - Mobile client identifier for rate limiting
 * @returns {Promise<{success: boolean, data?: Object, staleMinutes?: number, error?: string}>}
 * @permission Anyone — mobile clients fetch without auth
 */
export const getExportData = webMethod(
  Permissions.Anyone,
  async (clientId = 'anon') => {
    try {
      const { allowed } = await checkRateLimit('VisualSearchExportRateLimit', clientId, { max: 10, windowMs: 60_000 });
      if (!allowed) return { success: false, error: 'Too many requests. Please try again later.' };

      // Try to serve from cache first
      const cached = await wixData.query(CACHE_COLLECTION)
        .eq('key', CACHE_KEY)
        .limit(1)
        .find({ suppressAuth: true });

      if (cached.items.length > 0) {
        const record = cached.items[0];
        const staleMinutes = Math.round((Date.now() - new Date(record.generatedAt).getTime()) / 60_000);

        let data;
        try {
          data = JSON.parse(record.payload);
        } catch {
          return { success: false, error: 'Cached export data is corrupt. Please try again later.' };
        }

        logAuditEvent('VisualSearchExportCache', 'fetch', clientId, { staleMinutes });
        return { success: true, data, staleMinutes };
      }

      // No cache — generate on-demand (first call or cache cleared)
      const payload = await buildExportPayload();
      logAuditEvent('VisualSearchExportCache', 'fetch_generated', clientId, { productCount: payload.totalProducts });
      return { success: true, data: payload, staleMinutes: 0 };
    } catch (err) {
      logError('visualSearchExport.getExportData', err);
      return { success: false, error: 'Export data unavailable' };
    }
  }
);

// ── Exports for testing ─────────────────────────────────────────────
export { transformProduct as _transformProduct };
export { buildExportPayload as _buildExportPayload };
