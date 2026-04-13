/** @module completeTheLookService - PDP "Complete the Look" room outfit cross-sell.
 *
 * Fetches a curated room set (hero image + accessory items) for a given product.
 * Admins author looks via createLook/updateLook; the public getCompleteTheLook
 * endpoint returns the look for a product or null when none is configured.
 *
 * CF-cxe (web equivalent of CFM cm-0q4).
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { validateId } from 'backend/utils/sanitize';

const COLLECTION = 'CompleteTheLook';
const MAX_ITEMS = 12;

function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .filter(it => it && typeof it === 'object' && it.productId)
    .slice(0, MAX_ITEMS)
    .map(it => ({
      productId: String(it.productId),
      imageUrl: typeof it.imageUrl === 'string' ? it.imageUrl : '',
      name: typeof it.name === 'string' ? it.name : '',
      price: Number.isFinite(Number(it.price)) ? Number(it.price) : 0,
    }));
}

/**
 * Fetch the "Complete the Look" room set for a product.
 * @param {string} productId
 * @returns {Promise<{productId:string,roomHeroImage:string,roomItems:Array}|null>}
 * @permission Anyone
 */
export const getCompleteTheLook = webMethod(
  Permissions.Anyone,
  async (productId) => {
    const cleanId = validateId(productId);
    if (!cleanId) return null;
    try {
      const res = await wixData.query(COLLECTION)
        .eq('productId', cleanId)
        .limit(1)
        .find();
      const look = res.items && res.items[0];
      if (!look) return null;
      return {
        productId: cleanId,
        roomHeroImage: typeof look.roomHeroImage === 'string' ? look.roomHeroImage : '',
        roomItems: normalizeItems(look.roomItems),
      };
    } catch (err) {
      console.error('[completeTheLookService] getCompleteTheLook failed', err);
      return null;
    }
  }
);

/**
 * Admin: create a new look configuration.
 * @param {{productId:string, roomHeroImage?:string, roomItems?:Array}} data
 * @returns {Promise<{success:boolean, look?:Object, error?:string}>}
 * @permission Admin
 */
export const createLook = webMethod(
  Permissions.Admin,
  async (data) => {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'invalid-input' };
    }
    const productId = validateId(data.productId);
    if (!productId) return { success: false, error: 'invalid-productId' };
    try {
      const look = await wixData.insert(COLLECTION, {
        productId,
        roomHeroImage: typeof data.roomHeroImage === 'string' ? data.roomHeroImage : '',
        roomItems: normalizeItems(data.roomItems),
      });
      return { success: true, look };
    } catch (err) {
      console.error('[completeTheLookService] createLook failed', err);
      return { success: false, error: 'insert-failed' };
    }
  }
);

/**
 * Admin: update an existing look configuration.
 * @param {{_id:string, productId:string, roomHeroImage?:string, roomItems?:Array}} data
 * @returns {Promise<{success:boolean, look?:Object, error?:string}>}
 * @permission Admin
 */
export const updateLook = webMethod(
  Permissions.Admin,
  async (data) => {
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'invalid-input' };
    }
    const _id = validateId(data._id);
    const productId = validateId(data.productId);
    if (!_id || !productId) return { success: false, error: 'invalid-input' };
    try {
      const look = await wixData.update(COLLECTION, {
        _id,
        productId,
        roomHeroImage: typeof data.roomHeroImage === 'string' ? data.roomHeroImage : '',
        roomItems: normalizeItems(data.roomItems),
      });
      return { success: true, look };
    } catch (err) {
      console.error('[completeTheLookService] updateLook failed', err);
      return { success: false, error: 'update-failed' };
    }
  }
);
