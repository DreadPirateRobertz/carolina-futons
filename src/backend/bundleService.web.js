/**
 * @module bundleService
 * @description Frame+Mattress+Cover bundle logic for Bundle Builder.
 * Queries the Bundles CMS collection, adds bundle items to cart as 3 plain
 * line items (no customTextFields — not supported by wix-ecom-backend),
 * applies a coupon code for the bundle discount, and writes a UserBundleCart
 * record for server-side cohesion tracking.
 *
 * Security: all pricing and coupon codes derived from CMS — no client-supplied
 * prices or coupons accepted.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-ecom-backend
 *
 * @setup
 * 1. Create CMS collection `Bundles` with fields:
 *      displayName       (Text)    - Bundle display name
 *      frameProductId    (Text)    - Wix product ID of the frame
 *      mattressProductId (Text)    - Wix product ID of the mattress
 *      coverProductId    (Text)    - Wix product ID of the cover
 *      bundlePrice       (Number)  - Discounted bundle price
 *      savings           (Number)  - Dollar savings vs. individual prices
 *      couponCode        (Text)    - Wix Marketing coupon code to auto-apply (optional)
 *      isActive          (Boolean) - Whether bundle is available for purchase
 *    Index: compound index on [frameProductId, isActive] — required for
 *    getBundlesByFrame query performance.
 *
 * 2. Create CMS collection `UserBundleCart` with fields:
 *      sessionId         (Text, indexed) - Sanitized session identifier (null for anonymous)
 *      bundleId          (Text, indexed) - CMS _id of the Bundles record
 *      bundleTag         (Text)    - 'bundle:<bundleId>' for display grouping
 *      frameProductId    (Text)    - Snapshot of component product IDs at add time
 *      mattressProductId (Text)    - Snapshot of component product IDs at add time
 *      coverProductId    (Text)    - Snapshot of component product IDs at add time
 *      addedAt           (Date)    - Timestamp of bundle add
 *    Index: [sessionId] — required for validateBundleCohesion query performance.
 *    Permissions: Anyone can insert (addBundle writes anonymously); Admin read only.
 *
 * 3. Wix Marketing Dashboard: create one coupon code per active bundle.
 *    Set coupon type to "free shipping" or "fixed amount" as appropriate.
 *    Populate the couponCode field in each Bundles CMS record.
 *    Coupons are applied server-side after cart.addProducts — never client-supplied.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { cart as ecomCart } from 'wix-ecom-backend';
import { validateId } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';
import { getBundleTag } from 'public/bundleHelpers';

const COLLECTION = 'Bundles';
const UBC_COLLECTION = 'UserBundleCart';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build the normalized bundle shape for API responses.
 * @param {Object} item - Raw CMS record
 * @returns {Object} Normalized bundle
 */
function formatBundle(item) {
  return {
    _id: item._id,
    displayName: item.displayName || '',
    frameProductId: item.frameProductId || '',
    mattressProductId: item.mattressProductId || '',
    coverProductId: item.coverProductId || '',
    bundlePrice: Number(item.bundlePrice) || 0,
    savings: Math.max(0, Number(item.savings) || 0),
    couponCode: item.couponCode || null,
    isActive: Boolean(item.isActive),
    components: [
      { type: 'frame', productId: item.frameProductId || '' },
      { type: 'mattress', productId: item.mattressProductId || '' },
      { type: 'cover', productId: item.coverProductId || '' },
    ],
  };
}

/**
 * Build 3 plain line items for cart.addProducts from a bundle CMS record.
 * No customTextFields — wix-ecom-backend does not support this field.
 * Returns null if any component productId is missing (malformed CMS data).
 * @param {Object} bundle - Normalized bundle (from formatBundle)
 * @returns {Object[]|null} Array of 3 line items, or null if a component is missing
 */
function buildLineItems(bundle) {
  const { frameProductId, mattressProductId, coverProductId } = bundle;
  if (!frameProductId || !mattressProductId || !coverProductId) return null;

  return [
    { productId: frameProductId, quantity: 1 },
    { productId: mattressProductId, quantity: 1 },
    { productId: coverProductId, quantity: 1 },
  ];
}

// ── getBundlesByFrame ─────────────────────────────────────────────────────────

/**
 * Return all active bundles that include the given frame product.
 *
 * @param {string} frameId - Wix product ID of the frame
 * @returns {Promise<{success: boolean, bundles?: Object[], error?: string}>}
 */
export const getBundlesByFrame = webMethod(
  Permissions.Anyone,
  async (frameId) => {
    const cleanId = validateId(frameId, 100);
    if (!cleanId) {
      return { success: false, error: 'Invalid frameId.' };
    }

    try {
      const result = await wixData.query(COLLECTION)
        .eq('frameProductId', cleanId)
        .eq('isActive', true)
        .find();

      return {
        success: true,
        bundles: result.items.map(formatBundle),
      };
    } catch (err) {
      logError('bundleService.getBundlesByFrame', err);
      return { success: false, error: 'Failed to load bundles.' };
    }
  }
);

// ── addBundle ─────────────────────────────────────────────────────────────────

/**
 * Add a bundle's 3 components to the cart as plain line items, apply the
 * bundle coupon code from CMS (if any), and write a UserBundleCart record
 * for server-side cohesion tracking.
 *
 * Pricing is authoritative from CMS — caller supplies only the bundleId.
 * Coupon application failure is non-fatal (logged, not surfaced to caller).
 *
 * @param {string} bundleId - CMS _id of the bundle record
 * @param {string} [sessionId] - Browser session identifier for cohesion tracking
 * @returns {Promise<{success: boolean, bundleTag?: string, productsAdded?: number,
 *   bundlePrice?: number, savings?: number, displayName?: string,
 *   error?: string, errorCode?: 'BUNDLE_NOT_FOUND'|'BUNDLE_INCOMPLETE'}>}
 *   errorCode is only present on named error cases; general failures omit it.
 */
export const addBundle = webMethod(
  Permissions.Anyone,
  async (bundleId, sessionId = null) => {
    const cleanId = validateId(bundleId, 100);
    if (!cleanId) {
      return { success: false, error: 'Invalid bundleId.' };
    }
    // Sanitize caller-supplied sessionId before CMS storage — reject invalid, truncate long
    const cleanSessionId = sessionId ? (validateId(sessionId, 128) || null) : null;

    try {
      const result = await wixData.query(COLLECTION)
        .eq('_id', cleanId)
        .eq('isActive', true)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Bundle not found.', errorCode: 'BUNDLE_NOT_FOUND' };
      }

      const bundle = formatBundle(result.items[0]);
      const lineItems = buildLineItems(bundle);

      if (!lineItems) {
        logError('bundleService.addBundle', new Error(`Bundle ${cleanId} has missing component IDs in CMS`));
        return { success: false, error: 'Bundle configuration is incomplete.', errorCode: 'BUNDLE_INCOMPLETE' };
      }

      await ecomCart.addProducts(lineItems);

      // Apply bundle coupon from CMS — non-fatal if it fails
      if (bundle.couponCode) {
        try {
          await ecomCart.applyCoupon(bundle.couponCode);
        } catch (couponErr) {
          logError('bundleService.addBundle.applyCoupon', couponErr);
        }
      }

      // Write UserBundleCart record for server-side cohesion tracking
      const bundleTag = getBundleTag(bundle._id);
      try {
        await wixData.insert(UBC_COLLECTION, {
          sessionId: cleanSessionId,
          bundleId: bundle._id,
          bundleTag,
          frameProductId: bundle.frameProductId,
          mattressProductId: bundle.mattressProductId,
          coverProductId: bundle.coverProductId,
          addedAt: new Date(),
        });
      } catch (ubcErr) {
        logError('bundleService.addBundle.userBundleCart', ubcErr);
      }

      return {
        success: true,
        bundleTag,
        productsAdded: lineItems.length,
        bundlePrice: bundle.bundlePrice,
        savings: bundle.savings,
        displayName: bundle.displayName,
      };
    } catch (err) {
      logError('bundleService.addBundle', err);
      return { success: false, error: 'Failed to add bundle to cart.' };
    }
  }
);

// ── validateBundleCohesion ────────────────────────────────────────────────────

/**
 * Check whether all bundle groups tracked in UserBundleCart for the given
 * session still have all 3 component productIds present in the current cart.
 *
 * Detects orphaned bundle items (e.g. user removed one piece of a bundle).
 * Uses server-side CMS tracking instead of customTextFields on cart items
 * (customTextFields is not supported by wix-ecom-backend.cart.addProducts).
 *
 * @param {string|null} sessionId - Session identifier to look up tracked bundles
 * @param {Object[]} [cartItems] - Current cart line items with at least { productId }
 * @returns {Promise<{valid: boolean, brokenBundles: Object[]}>}
 */
export const validateBundleCohesion = webMethod(
  Permissions.Anyone,
  async (sessionId, cartItems) => {
    // Sanitize caller-supplied sessionId before querying CMS
    const cleanSessionId = sessionId ? (validateId(sessionId, 128) || null) : null;
    if (!cleanSessionId) {
      return { valid: true, brokenBundles: [] };
    }

    const items = Array.isArray(cartItems) ? cartItems : [];
    const cartProductIds = new Set(items.map(i => i.productId).filter(Boolean));

    try {
      const result = await wixData.query(UBC_COLLECTION)
        .eq('sessionId', cleanSessionId)
        .find();

      if (result.items.length === 0) {
        return { valid: true, brokenBundles: [] };
      }

      const brokenBundles = [];

      for (const record of result.items) {
        const components = [
          record.frameProductId,
          record.mattressProductId,
          record.coverProductId,
        ];
        const presentCount = components.filter(id => id && cartProductIds.has(id)).length;
        const expectedCount = 3;

        if (presentCount < expectedCount) {
          brokenBundles.push({
            bundleTag: record.bundleTag,
            componentCount: presentCount,
            expectedCount,
            message: `Bundle is incomplete: ${presentCount} of ${expectedCount} items present. Removing part of a bundle may affect bundle pricing.`,
          });
        }
      }

      return {
        valid: brokenBundles.length === 0,
        brokenBundles,
      };
    } catch (err) {
      logError('bundleService.validateBundleCohesion', err);
      // Do NOT return valid:true on CMS failure — cohesion is unknown, not confirmed valid
      return { valid: false, error: 'Unable to verify bundle cohesion.', brokenBundles: [] };
    }
  }
);
