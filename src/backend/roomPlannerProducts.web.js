/**
 * @module roomPlannerProducts
 * @description Room Planner S8 — product catalog integration.
 * Fetches real products from Wix Stores filtered by the
 * 'room-planner-compatible' tag, with pagination support.
 *
 * @setup
 * Tag products in CMS admin with 'room-planner-compatible' to include them
 * in the Room Planner product picker. Use addRoomPlannerTag / removeRoomPlannerTag
 * (Admin-only) to manage tags programmatically.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { validateId } from 'backend/utils/sanitize';

const COLLECTION = 'Stores/Products';
const ROOM_PLANNER_TAG = 'room-planner-compatible';
const PAGE_SIZE = 20;

/**
 * Get paginated room-planner-compatible products from Wix Stores.
 *
 * @param {Object} [options]
 * @param {number} [options.skip=0] - Number of items to skip (for pagination).
 * @param {number} [options.limit=20] - Max items to return (capped at 20).
 * @returns {Promise<{success: boolean, products: Array, totalCount: number, hasMore: boolean}>}
 */
export const getRoomPlannerProducts = webMethod(
  Permissions.Anyone,
  async ({ skip = 0, limit = PAGE_SIZE } = {}) => {
    try {
      const safeSkip = Math.max(0, Math.round(Number(skip) || 0));
      const safeLimit = Math.min(PAGE_SIZE, Math.max(1, Math.round(Number(limit) || PAGE_SIZE)));

      const result = await wixData.query(COLLECTION)
        .hasSome('tags', [ROOM_PLANNER_TAG])
        .skip(safeSkip)
        .limit(safeLimit)
        .find();

      const products = result.items.map(item => ({
        _id: item._id,
        name: item.name,
        slug: item.slug,
        price: item.price,
        mainMedia: item.mainMedia,
        description: item.description,
      }));

      const totalCount = result.totalCount;
      const hasMore = safeSkip + products.length < totalCount;

      return { success: true, products, totalCount, hasMore };
    } catch (err) {
      console.error('[roomPlannerProducts] getRoomPlannerProducts error:', err?.message ?? err);
      return { success: false, products: [], totalCount: 0, hasMore: false, error: 'Failed to load products.' };
    }
  }
);

/**
 * Add the 'room-planner-compatible' tag to a product.
 * Admin only — called from CMS admin panel to opt a product into the room planner.
 *
 * @param {string} productId - Wix product ID.
 * @returns {Promise<{success: boolean}>}
 */
export const addRoomPlannerTag = webMethod(
  Permissions.Admin,
  async (productId) => {
    try {
      const cleanId = validateId(productId);
      if (!cleanId) return { success: false, error: 'Invalid product ID.' };

      const product = await wixData.get(COLLECTION, cleanId);
      if (!product) return { success: false, error: 'Product not found.' };

      const tags = Array.isArray(product.tags) ? product.tags : [];
      if (!tags.includes(ROOM_PLANNER_TAG)) {
        product.tags = [...tags, ROOM_PLANNER_TAG];
        await wixData.update(COLLECTION, product);
      }

      return { success: true };
    } catch (err) {
      console.error('[roomPlannerProducts] addRoomPlannerTag error:', err?.message ?? err);
      return { success: false, error: 'Failed to add tag.' };
    }
  }
);

/**
 * Remove the 'room-planner-compatible' tag from a product.
 * Admin only.
 *
 * @param {string} productId - Wix product ID.
 * @returns {Promise<{success: boolean}>}
 */
export const removeRoomPlannerTag = webMethod(
  Permissions.Admin,
  async (productId) => {
    try {
      const cleanId = validateId(productId);
      if (!cleanId) return { success: false, error: 'Invalid product ID.' };

      const product = await wixData.get(COLLECTION, cleanId);
      if (!product) return { success: false, error: 'Product not found.' };

      const tags = Array.isArray(product.tags) ? product.tags : [];
      if (tags.includes(ROOM_PLANNER_TAG)) {
        product.tags = tags.filter(t => t !== ROOM_PLANNER_TAG);
        await wixData.update(COLLECTION, product);
      }

      return { success: true };
    } catch (err) {
      console.error('[roomPlannerProducts] removeRoomPlannerTag error:', err?.message ?? err);
      return { success: false, error: 'Failed to remove tag.' };
    }
  }
);
