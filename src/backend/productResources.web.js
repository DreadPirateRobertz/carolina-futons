/**
 * @module productResources.web
 * @description Product Resources webMethod — returns sorted resource links
 * for a given productId, plus structured data aggregation for JSON-LD.
 *
 * Exported webMethods:
 *   getProductResources(productId) — returns sorted array of resources
 *   getProductStructuredData(productId) — aggregates product + reviews for JSON-LD (CF-06xu)
 *
 * CF-wh4
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';
import { validateId } from 'backend/utils/sanitize';

const PRODUCT_RESOURCES = 'ProductResources';
const STORES_PRODUCTS = 'Stores/Products';
const REVIEWS = 'Reviews';
const MAX_STRUCTURED_REVIEWS = 3;

/**
 * Returns all active resources for a product, sorted by sortOrder ascending.
 * Caps results at 20 items; products with more resources will be silently truncated.
 *
 * @param {string} productId
 * @returns {Promise<Array<{resourceType: string, label: string, url: string, sortOrder: number}>>}
 *   Returns empty array when productId is invalid, when no records match, or when the
 *   CMS query fails. This function never rejects — errors are logged and suppressed.
 */
export const getProductResources = webMethod(
  Permissions.Anyone,
  async (productId) => {
    const cleanId = validateId(productId);
    if (!cleanId) return [];
    try {
      const res = await wixData.query(PRODUCT_RESOURCES)
        .eq('productId', cleanId)
        .ascending('sortOrder')
        .limit(20)
        // suppressAuth required: ProductResources collection restricts writes to Admin
        // but must be publicly readable via this Permissions.Anyone webMethod.
        .find({ suppressAuth: true });
      return res.items.map(({ resourceType, label, url, sortOrder }) => ({
        resourceType,
        label,
        url,
        sortOrder: sortOrder ?? 0,
      }));
    } catch (err) {
      logError(`productResources.getProductResources — productId=${cleanId}`, err);
      return [];
    }
  },
);

/**
 * Aggregates product data and approved reviews into a schema-ready object
 * for JSON-LD structured data injection on the Product Page.
 *
 * @param {string} productId
 * @returns {Promise<{product: Object, reviews: Array, aggregate: {average: number, total: number}}|null>}
 *   Returns null when productId is invalid or product not found. Never rejects.
 *
 * CF-06xu
 */
export const getProductStructuredData = webMethod(
  Permissions.Anyone,
  async (productId) => {
    const cleanId = validateId(productId);
    if (!cleanId) return null;

    try {
      const [productResult, reviewResult] = await Promise.all([
        wixData.query(STORES_PRODUCTS)
          .eq('_id', cleanId)
          .limit(1)
          .find({ suppressAuth: true }),
        wixData.query(REVIEWS)
          .eq('productId', cleanId)
          .eq('status', 'approved')
          .descending('_createdDate')
          .limit(MAX_STRUCTURED_REVIEWS)
          .find({ suppressAuth: true }),
      ]);

      if (productResult.items.length === 0) return null;

      const raw = productResult.items[0];
      const product = {
        name: raw.name || '',
        description: raw.description || '',
        slug: raw.slug || '',
        sku: raw.sku || '',
        price: raw.discountedPrice ?? raw.price ?? 0,
        inStock: raw.inStock !== false,
        mainMedia: raw.mainMedia || '',
      };

      const reviews = reviewResult.items.map(r => ({
        authorName: r.authorName || 'Anonymous',
        rating: Number(r.rating) || 0,
        body: r.body || '',
        _createdDate: r._createdDate || '',
      }));

      // Compute aggregate from all approved reviews (separate count query).
      // Capped at 1000 — sufficient for furniture products; wixData has no cursor API.
      const countResult = await wixData.query(REVIEWS)
        .eq('productId', cleanId)
        .eq('status', 'approved')
        .limit(1000)
        .find({ suppressAuth: true });

      const allRatings = countResult.items
        .map(r => Number(r.rating))
        .filter(n => !isNaN(n) && n > 0);

      const total = allRatings.length;
      const average = total > 0
        ? allRatings.reduce((s, v) => s + v, 0) / total
        : 0;

      return { product, reviews, aggregate: { average, total } };
    } catch (err) {
      logError(`productResources.getProductStructuredData — productId=${cleanId}`, err);
      return null;
    }
  },
);
