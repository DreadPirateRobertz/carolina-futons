/**
 * @module couponValidation
 * @description Cross-rig coupon/bundle validation endpoint for mobile checkout.
 * Dallas mobile app calls this to validate coupon codes before payment
 * without applying them (no usage increment, no cart mutation).
 *
 * Wraps promotionsEngine.validatePromoCode for code validation and
 * calculates discount preview against provided cart items.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Depends on existing CMS collections:
 *   - PromoCodes (from promotionsEngine)
 *   - Bundles (from bundleService)
 *   - CouponValidationRateLimit: key (Text), count (Number), windowStart (DateTime)
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { logAuditEvent } from 'backend/utils/auditLog';
import { logError } from 'backend/utils/errorHandler';

const MAX_CODE_LENGTH = 30;
const MAX_CART_ITEMS = 50;

/**
 * Round to 2 decimal places.
 */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Parse a comma-separated string into a trimmed, non-empty array.
 */
function parseCSV(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

/**
 * Validate a coupon code against cart items and return discount preview.
 * Read-only — does NOT increment usage or modify cart.
 *
 * @param {string} couponCode - The coupon or promo code to validate
 * @param {Array<{productId: string, quantity: number, price: number, category?: string}>} cartItems
 * @returns {Promise<{valid: boolean, discount?: number, discountType?: string,
 *   freeShipping?: boolean, applicableItems?: string[], subtotalAfterDiscount?: number,
 *   reason?: string, error?: string}>}
 * @permission SiteMember — mobile users are authenticated
 */
export const validateBundleCoupon = webMethod(
  Permissions.SiteMember,
  async (couponCode, cartItems) => {
    try {
      // Get current member for rate limiting
      let memberId = '';
      try {
        const member = await currentMember.getMember();
        if (member) memberId = member._id;
      } catch {
        // Not logged in — shouldn't happen with SiteMember permission
      }

      const rateLimitKey = memberId || 'anon';
      const { allowed } = await checkRateLimit('CouponValidationRateLimit', rateLimitKey, { max: 10, windowMs: 60_000 });
      if (!allowed) {
        return { valid: false, error: 'Too many validation attempts. Please try again later.' };
      }

      // Input validation
      if (!couponCode || typeof couponCode !== 'string') {
        return { valid: false, reason: 'Coupon code is required.' };
      }
      if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        return { valid: false, reason: 'Cart items are required.' };
      }

      const cleanCode = sanitize(couponCode, MAX_CODE_LENGTH).toUpperCase().trim();
      if (!cleanCode) {
        return { valid: false, reason: 'Coupon code is required.' };
      }

      const items = cartItems.slice(0, MAX_CART_ITEMS);

      // 1. Check bundle-specific coupons first
      const bundleResult = await checkBundleCoupon(cleanCode, items);
      if (bundleResult.matched) {
        logAuditEvent('CouponValidation', 'validate_bundle', rateLimitKey, {
          code: cleanCode,
          valid: bundleResult.valid,
        });
        return bundleResult.response;
      }

      // 2. Fall back to promo code validation
      const promoResult = await checkPromoCoupon(cleanCode, items);
      logAuditEvent('CouponValidation', 'validate_promo', rateLimitKey, {
        code: cleanCode,
        valid: promoResult.valid,
      });
      return promoResult;

    } catch (err) {
      logError('couponValidation.validateBundleCoupon', err);
      return { valid: false, error: 'Validation failed. Please try again.' };
    }
  }
);

/**
 * Check if the code matches a bundle coupon.
 * @returns {{ matched: boolean, valid?: boolean, response?: Object }}
 */
async function checkBundleCoupon(code, cartItems) {
  try {
    const bundles = await wixData.query('Bundles')
      .eq('couponCode', code)
      .eq('isActive', true)
      .limit(1)
      .find();

    if (bundles.items.length === 0) {
      return { matched: false };
    }

    const bundle = bundles.items[0];
    const bundleProductIds = [
      bundle.frameProductId,
      bundle.mattressProductId,
      bundle.coverProductId,
    ].filter(Boolean);

    // Check if cart contains the bundle components
    const cartProductIds = cartItems.map(i => i.productId);
    const matchingItems = bundleProductIds.filter(id => cartProductIds.includes(id));

    if (matchingItems.length < bundleProductIds.length) {
      return {
        matched: true,
        valid: false,
        response: {
          valid: false,
          reason: `This bundle coupon requires all bundle items in your cart. Missing ${bundleProductIds.length - matchingItems.length} item(s).`,
          requiredProducts: bundleProductIds,
        },
      };
    }

    // Calculate bundle discount
    const cartSubtotal = calculateSubtotal(cartItems);
    const bundlePrice = bundle.bundlePrice || 0;
    const savings = bundle.savings || 0;
    const discount = round2(Math.min(savings, cartSubtotal));

    return {
      matched: true,
      valid: true,
      response: {
        valid: true,
        discount,
        discountType: 'bundle',
        freeShipping: false,
        applicableItems: bundleProductIds,
        subtotalAfterDiscount: round2(cartSubtotal - discount),
        bundleName: bundle.displayName || '',
        bundlePrice,
      },
    };
  } catch (err) {
    logError('couponValidation.checkBundleCoupon', err);
    return { matched: false };
  }
}

/**
 * Check the code against the PromoCodes collection (standard coupons).
 * Mirrors promotionsEngine.applyPromoCode logic but WITHOUT incrementing usage.
 */
async function checkPromoCoupon(code, cartItems) {
  try {
    const result = await wixData.query('PromoCodes')
      .eq('code', code)
      .limit(1)
      .find();

    if (!result.items || result.items.length === 0) {
      return { valid: false, reason: 'Invalid coupon code.' };
    }

    const promo = result.items[0];
    const now = new Date();

    if (!promo.isActive) {
      return { valid: false, reason: 'This coupon is no longer active.' };
    }
    if (promo.startDate && new Date(promo.startDate) > now) {
      return { valid: false, reason: 'This coupon is not yet active.' };
    }
    if (promo.endDate && new Date(promo.endDate) < now) {
      return { valid: false, reason: 'This coupon has expired.' };
    }
    if (promo.maxUses > 0 && promo.usesCount >= promo.maxUses) {
      return { valid: false, reason: 'This coupon has reached its usage limit.' };
    }

    const subtotal = calculateSubtotal(cartItems);

    if (promo.minSubtotal > 0 && subtotal < promo.minSubtotal) {
      return {
        valid: false,
        reason: `Minimum order of $${promo.minSubtotal} required for this coupon.`,
      };
    }

    // Free shipping
    if (promo.type === 'freeShipping') {
      return {
        valid: true,
        discount: 0,
        discountType: 'freeShipping',
        freeShipping: true,
        subtotalAfterDiscount: subtotal,
      };
    }

    // Calculate eligible items and discount
    const categories = parseCSV(promo.applicableCategories);
    const productIds = parseCSV(promo.applicableProducts);
    const hasRestrictions = categories.length > 0 || productIds.length > 0;

    let eligibleSubtotal = subtotal;
    const applicableItems = [];

    if (hasRestrictions) {
      eligibleSubtotal = 0;
      for (const item of cartItems) {
        const price = Math.max(0, Number(item.price) || 0);
        const qty = Math.max(1, Math.min(99, Math.round(Number(item.quantity) || 1)));
        const matchesCategory = categories.includes(item.category);
        const matchesProduct = productIds.includes(item.productId);
        if (matchesCategory || matchesProduct) {
          eligibleSubtotal += price * qty;
          applicableItems.push(item.productId);
        }
      }
      eligibleSubtotal = round2(eligibleSubtotal);
    }

    let discount = 0;
    if (promo.type === 'percentage') {
      const pct = Math.min(100, Math.max(0, Number(promo.value) || 0));
      discount = round2(eligibleSubtotal * pct / 100);
    } else if (promo.type === 'fixed') {
      discount = Math.min(subtotal, Math.max(0, Number(promo.value) || 0));
    }

    discount = round2(Math.min(discount, subtotal));

    return {
      valid: true,
      discount,
      discountType: promo.type,
      freeShipping: false,
      applicableItems: applicableItems.length > 0 ? applicableItems : undefined,
      subtotalAfterDiscount: round2(subtotal - discount),
    };
  } catch (err) {
    logError('couponValidation.checkPromoCoupon', err);
    return { valid: false, error: 'Validation failed. Please try again.' };
  }
}

/**
 * Calculate cart subtotal from items.
 */
function calculateSubtotal(cartItems) {
  let subtotal = 0;
  for (const item of cartItems) {
    const price = Math.max(0, Number(item.price) || 0);
    const qty = Math.max(1, Math.min(99, Math.round(Number(item.quantity) || 1)));
    subtotal += price * qty;
  }
  return round2(subtotal);
}

// ── Exports for testing ─────────────────────────────────────────────
export { checkBundleCoupon as _checkBundleCoupon };
export { checkPromoCoupon as _checkPromoCoupon };
export { calculateSubtotal as _calculateSubtotal };
