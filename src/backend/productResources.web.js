/**
 * @module productResources.web
 * @description Product Resources webMethod — returns sorted resource links
 * (spec sheets, care guides, videos, assembly guides) for a given productId.
 *
 * Exported webMethods:
 *   getProductResources(productId) — returns sorted array of resources
 *
 * CF-wh4
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';

const PRODUCT_RESOURCES = 'ProductResources';

/**
 * Returns all active resources for a product, sorted by sortOrder ascending.
 *
 * @param {string} productId
 * @returns {Promise<Array<{resourceType: string, label: string, url: string, sortOrder: number}>>}
 */
export const getProductResources = webMethod(
  Permissions.Anyone,
  async (productId) => {
    if (!productId) return [];
    try {
      const res = await wixData.query(PRODUCT_RESOURCES)
        .eq('productId', productId)
        .ascending('sortOrder')
        .find({ suppressAuth: true });
      return res.items.map(({ resourceType, label, url, sortOrder }) => ({
        resourceType,
        label,
        url,
        sortOrder: sortOrder ?? 0,
      }));
    } catch (err) {
      logError('productResources.getProductResources', err);
      return [];
    }
  },
);
