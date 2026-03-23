/**
 * @module productResources.web
 * @description Product Resources webMethod — returns sorted resource links
 * for a given productId. Resource types (SPEC_SHEET, CARE_GUIDE, WARRANTY,
 * VIDEO, POLICY_LINK, ASSEMBLY_GUIDE, etc.) are defined in the CMS collection.
 *
 * Exported webMethods:
 *   getProductResources(productId) — returns sorted array of resources
 *
 * CF-wh4
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { logError } from 'backend/utils/errorHandler';
import { validateId } from 'backend/utils/sanitize';

const PRODUCT_RESOURCES = 'ProductResources';

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
