/**
 * @module bundleDeals
 * @description Bundle deals webMethod layer for home-page and site-wide product bundles.
 * Reads pre-configured bundles from the ProductBundle CMS collection and handles
 * adding all bundle products to the visitor's Wix cart with auto-coupon application.
 *
 * Security: addBundleToCart derives all pricing from CMS — no client-supplied
 * totals are accepted. Coupon application is idempotent (skipped if already applied).
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-ecom-backend
 *
 * @setup
 * Create CMS collection `ProductBundle` with fields:
 *   name        (Text)    - Bundle display name
 *   slug        (Text)    - URL slug, indexed
 *   products    (Text)    - JSON array of {productId, qty} objects
 *   bundlePrice (Number)  - Discounted bundle price
 *   savings     (Number)  - Dollar savings vs. individual prices
 *   description (Text)    - Short marketing description
 *   image       (Image)   - Bundle hero image
 *   couponCode  (Text)    - Wix Marketing coupon code to auto-apply
 *   isActive    (Boolean) - Whether bundle is currently offered
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { cart as ecomCart } from 'wix-ecom-backend';
import { validateId, validateSlug } from 'backend/utils/sanitize';

const COLLECTION = 'ProductBundle';

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Parse the `products` field from CMS — stored as a JSON string.
 * @param {*} raw
 * @returns {Array<{productId: string, qty: number}>}
 */
function parseProducts(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (e) {
      console.error('[bundleDeals] parseProducts: malformed JSON in products field:', e.message);
      return [];
    }
  }
  return [];
}

/**
 * Normalize a raw CMS item into the public bundle shape.
 * @param {Object} item - Raw CMS record
 * @returns {Object} Normalized bundle
 */
function formatBundle(item) {
  return {
    _id: item._id,
    name: item.name || '',
    slug: item.slug || '',
    products: parseProducts(item.products),
    bundlePrice: Number(item.bundlePrice) || 0,
    savings: Number(item.savings) || 0,
    description: item.description || '',
    imageUrl: item.image || '',
    couponCode: item.couponCode || null,
  };
}

// ── listBundles ───────────────────────────────────────────────────────

/**
 * List all active bundles.
 *
 * @returns {Promise<{success: boolean, bundles: Array}>}
 */
export const listBundles = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const result = await wixData.query(COLLECTION)
        .eq('isActive', true)
        .ascending('name')
        .find();
      return { success: true, bundles: result.items.map(formatBundle) };
    } catch (err) {
      console.error('[bundleDeals] listBundles error:', err.message);
      return { success: false, bundles: [] };
    }
  }
);

// ── getBundleBySlug ───────────────────────────────────────────────────

/**
 * Get a single active bundle by its URL slug.
 *
 * @param {string} slug - Bundle slug (e.g. 'complete-futon-set')
 * @returns {Promise<{success: boolean, bundle: Object|null, error?: string}>}
 */
export const getBundleBySlug = webMethod(
  Permissions.Anyone,
  async (slug) => {
    try {
      const cleanSlug = validateSlug(slug);
      if (!cleanSlug) {
        return { success: false, bundle: null, error: 'Invalid slug.' };
      }

      const result = await wixData.query(COLLECTION)
        .eq('slug', cleanSlug)
        .eq('isActive', true)
        .find();

      if (result.items.length === 0) {
        return { success: true, bundle: null };
      }

      return { success: true, bundle: formatBundle(result.items[0]) };
    } catch (err) {
      console.error('[bundleDeals] getBundleBySlug error:', slug, err.message);
      return { success: false, bundle: null, error: 'Failed to fetch bundle.' };
    }
  }
);

// ── addBundleToCart ───────────────────────────────────────────────────

/**
 * Add all products from a bundle to the visitor's cart and auto-apply the
 * bundle coupon code (if any).
 *
 * Security: prices and coupon code come exclusively from the CMS record —
 * no client-supplied values are used. Coupon application is idempotent:
 * if the same coupon is already applied to the cart, it is skipped rather
 * than triggering a second application error.
 *
 * @param {string} slug - Bundle slug
 * @returns {Promise<{success: boolean, bundleName?: string, bundlePrice?: number,
 *   savings?: number, productsAdded?: number, couponApplied?: boolean, error?: string}>}
 */
export const addBundleToCart = webMethod(
  Permissions.Anyone,
  async (slug) => {
    try {
      const cleanSlug = validateSlug(slug);
      if (!cleanSlug) {
        return { success: false, error: 'Invalid bundle slug.' };
      }

      // 1. Fetch bundle from CMS — server is the authoritative source for coupon code;
      //    line-item prices come from the Wix product catalog, not bundlePrice
      const result = await wixData.query(COLLECTION)
        .eq('slug', cleanSlug)
        .eq('isActive', true)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'Bundle not found.', errorCode: 'BUNDLE_NOT_FOUND' };
      }

      const bundle = result.items[0];
      const products = parseProducts(bundle.products);

      if (products.length === 0) {
        return { success: false, error: 'Bundle has no products.' };
      }

      // 2. Build line items — sanitize productId, enforce qty >= 1
      const lineItems = products
        .filter(p => p && p.productId)
        .map(p => ({
          productId: validateId(String(p.productId), 50),
          quantity: Math.max(1, Math.floor(Number(p.qty) || 1)),
        }))
        .filter(p => p.productId);

      if (lineItems.length === 0) {
        return { success: false, error: 'Bundle has no valid products.' };
      }

      // 3. Add all products to cart (single API call)
      await ecomCart.addProducts(lineItems);

      // 4. Auto-apply coupon from CMS (idempotent — skip if already applied)
      let couponApplied = false;
      if (bundle.couponCode) {
        let alreadyApplied = false;
        try {
          const currentCart = await ecomCart.getCurrentCart();
          alreadyApplied = currentCart?.appliedCoupon?.code === bundle.couponCode;
        } catch (cartErr) {
          // Non-fatal: if we can't read cart state, attempt coupon apply anyway
          console.warn('[bundleDeals] getCurrentCart failed (non-fatal):', cartErr.message);
        }
        if (!alreadyApplied) {
          try {
            await ecomCart.applyCoupon(bundle.couponCode);
            couponApplied = true;
          } catch (couponErr) {
            // Non-fatal: products are already in cart; log and continue
            console.warn('[bundleDeals] Coupon apply failed (non-fatal):', bundle.couponCode, couponErr.message);
          }
        }
      }

      return {
        success: true,
        bundleName: bundle.name,
        bundlePrice: Number(bundle.bundlePrice) || 0,
        savings: Number(bundle.savings) || 0,
        productsAdded: lineItems.length,
        couponApplied,
      };
    } catch (err) {
      console.error('[bundleDeals] addBundleToCart error:', slug, err.message);
      return { success: false, error: 'Failed to add bundle to cart.' };
    }
  }
);
