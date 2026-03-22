/**
 * @module bundleService
 * @description Frame+Mattress+Cover bundle logic for Bundle Builder S1.
 * Queries the Bundles CMS collection, adds bundle items to cart as 3 tagged
 * line items, and validates bundle cohesion (detects split bundles in cart).
 *
 * Security: all pricing derived from CMS — no client-supplied prices accepted.
 * Bundle items are tagged via customTextFields so frontend can group them visually.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-ecom-backend
 *
 * @setup
 * Create CMS collection `Bundles` with fields:
 *   displayName       (Text)    - Bundle display name
 *   frameProductId    (Text)    - Wix product ID of the frame
 *   mattressProductId (Text)    - Wix product ID of the mattress
 *   coverProductId    (Text)    - Wix product ID of the cover
 *   bundlePrice       (Number)  - Discounted bundle price
 *   savings           (Number)  - Dollar savings vs. individual prices
 *   isActive          (Boolean) - Whether bundle is available for purchase
 *
 * Index: create a compound index on [frameProductId, isActive] —
 * required for getBundlesByFrame query performance.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { cart as ecomCart } from 'wix-ecom-backend';
import { validateId } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';
import { getBundleTag, findBrokenBundles } from 'public/bundleHelpers';

const COLLECTION = 'Bundles';

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
    isActive: Boolean(item.isActive),
    components: [
      { type: 'frame', productId: item.frameProductId || '' },
      { type: 'mattress', productId: item.mattressProductId || '' },
      { type: 'cover', productId: item.coverProductId || '' },
    ],
  };
}

/**
 * Build 3 tagged line items for cart.addProducts from a bundle CMS record.
 * Returns null if any component productId is missing (malformed CMS data).
 * @param {Object} bundle - Normalized bundle (from formatBundle)
 * @returns {Object[]|null} Array of 3 line items, or null if a component is missing
 */
function buildLineItems(bundle) {
  const { frameProductId, mattressProductId, coverProductId } = bundle;
  if (!frameProductId || !mattressProductId || !coverProductId) return null;

  const tagField = [{ title: 'bundleTag', value: getBundleTag(bundle._id) }];
  return [
    { productId: frameProductId, quantity: 1, customTextFields: tagField },
    { productId: mattressProductId, quantity: 1, customTextFields: tagField },
    { productId: coverProductId, quantity: 1, customTextFields: tagField },
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
 * Add a bundle's 3 components to the cart as tagged line items.
 * Pricing is authoritative from CMS — caller supplies only the bundleId.
 *
 * @param {string} bundleId - CMS _id of the bundle record
 * @returns {Promise<{success: boolean, bundleTag?: string, productsAdded?: number,
 *   bundlePrice?: number, savings?: number, displayName?: string,
 *   error?: string, errorCode?: 'BUNDLE_NOT_FOUND'|'BUNDLE_INCOMPLETE'}>}
 *   errorCode is only present on named error cases; general failures omit it.
 */
export const addBundle = webMethod(
  Permissions.Anyone,
  async (bundleId) => {
    const cleanId = validateId(bundleId, 100);
    if (!cleanId) {
      return { success: false, error: 'Invalid bundleId.' };
    }

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

      return {
        success: true,
        bundleTag: getBundleTag(bundle._id),
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
 * Check whether all bundle groups in the cart have all 3 components present.
 * Detects orphaned bundle items (e.g. user removed one piece of a bundle).
 *
 * Note: accepts caller-supplied cart data and is informational only — it does
 * not cross-reference bundle IDs against CMS. Fabricated bundleTags will be
 * flagged as broken if they lack 3 items, but will not trigger false "valid"
 * responses. This is acceptable for S1 (display/warning use case).
 *
 * @param {Object[]} cartItems - Cart line items (with customTextFields)
 * @returns {Promise<{valid: boolean, brokenBundles: Object[]}>}
 */
export const validateBundleCohesion = webMethod(
  Permissions.Anyone,
  async (cartItems) => {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return { valid: true, brokenBundles: [] };
    }

    try {
      const broken = findBrokenBundles(cartItems);
      const brokenBundles = broken.map(b => ({
        ...b,
        message: `Bundle is incomplete: ${b.componentCount} of ${b.expectedCount} items present. Removing part of a bundle may affect bundle pricing.`,
      }));

      return {
        valid: brokenBundles.length === 0,
        brokenBundles,
      };
    } catch (err) {
      logError('bundleService.validateBundleCohesion', err);
      return { valid: true, brokenBundles: [] };
    }
  }
);
