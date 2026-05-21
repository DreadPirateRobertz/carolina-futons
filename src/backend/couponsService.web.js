/**
 * @module couponsService
 * @description Backend web module for marketing coupon management.
 * Creates and manages discount coupons for welcome offers, birthdays,
 * and loyalty tier upgrades using Wix Marketing Backend Coupons API.
 *
 * @requires wix-web-module
 * @requires wix-marketing-backend
 * @requires backend/utils/sanitize
 */
import { Permissions, webMethod } from 'wix-web-module';
import { coupons } from 'wix-marketing-backend';
import { currentMember } from 'wix-members-backend';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';

/**
 * Create a welcome coupon for a new member (10% off first order).
 *
 * @function createWelcomeCoupon
 * @param {string} email - New member's email
 * @returns {Promise<Object>} { success, code, discount }
 * @permission Admin — called by backend automation, not directly by users
 */
export const createWelcomeCoupon = webMethod(
  Permissions.Admin,
  async (email) => {
    try {
      if (!email) return { success: false, message: 'Email required' };

      const cleanEmail = sanitize(email, 254).toLowerCase();
      if (!validateEmail(cleanEmail)) {
        return { success: false, message: 'Invalid email' };
      }

      const expirationTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      const coupon = await coupons.createCoupon({
        name: `Welcome 10% Off - ${cleanEmail}`,
        code: await generateCode('WELCOME'),
        percentOffRate: 10,
        scope: { namespace: 'stores' },
        minimumSubtotal: 0,
        limitPerCustomer: 1,
        limitedToOneItem: false,
        active: true,
        startTime: new Date(),
        expirationTime,
      });

      try {
        await wixData.insert('MemberCoupons', {
          memberEmail: cleanEmail,
          code: coupon.code,
          couponCode: coupon.code,
          couponId: coupon._id,
          displayName: 'Welcome 10% Off',
          couponType: 'Welcome',
          discount: '10%',
          percentOffRate: 10,
          moneyOffAmount: 0,
          minimumSubtotal: 0,
          expirationTime,
          expiresAt: expirationTime,
          active: true,
        });
      } catch (insertErr) {
        logError(`[couponsService] createWelcomeCoupon MemberCoupons-insert failed email=${cleanEmail}`, insertErr);
      }

      return {
        success: true,
        code: coupon.code,
        discount: '10%',
        expiresIn: '30 days',
      };
    } catch (err) {
      logError('[couponsService] createWelcomeCoupon failed', err);
      return { success: false, message: 'Failed to create coupon' };
    }
  }
);

/**
 * Get active coupons for the current member.
 *
 * Queries the MemberCoupons collection by memberEmail at the database level,
 * ensuring each member only ever sees their own coupons. This replaces the
 * previous queryAllCoupons() + JS-level email filter which fetched all coupon
 * records (including other members' PII in coupon names) before filtering.
 *
 * @function getActiveCoupons
 * @returns {Promise<Array>} List of active coupons with code, discount, expiry
 * @permission SiteMember
 */
export const getActiveCoupons = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member) return [];

      const memberEmail = (
        member.loginEmail ||
        member.contactDetails?.emails?.[0]?.address ||
        ''
      ).toLowerCase();
      if (!memberEmail) return [];

      const result = await wixData.query('MemberCoupons')
        .eq('memberEmail', memberEmail)
        .eq('active', true)
        .find();

      return (result.items || []).map(c => ({
        _id: c._id,
        code: c.couponCode || c.code,
        name: c.couponType || c.displayName,
        discount: c.discount !== undefined ? c.discount
          : c.percentOffRate ? `${c.percentOffRate}%`
          : c.moneyOffAmount ? `$${c.moneyOffAmount} off`
          : '0%',
        minimumSubtotal: c.minimumSubtotal || 0,
        expirationTime: c.expiresAt || c.expirationTime,
        active: c.active,
      }));
    } catch (err) {
      logError('[couponsService] getActiveCoupons failed', err);
      return [];
    }
  }
);

/**
 * Create a birthday coupon (15% off, valid 7 days).
 *
 * @function createBirthdayCoupon
 * @param {string} email - Member's email
 * @param {string} memberName - Member's display name for personalization
 * @returns {Promise<Object>} { success, code, discount }
 * @permission Admin — called by backend automation
 */
export const createBirthdayCoupon = webMethod(
  Permissions.Admin,
  async (email, memberName) => {
    try {
      if (!email) return { success: false, message: 'Email required' };

      const cleanEmail = sanitize(email, 254).toLowerCase();
      if (!validateEmail(cleanEmail)) {
        return { success: false, message: 'Invalid email' };
      }

      const name = sanitize(memberName || 'Valued Customer', 100);

      const expirationTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      const coupon = await coupons.createCoupon({
        name: `Happy Birthday ${name}! 15% Off`,
        code: await generateCode('BDAY'),
        percentOffRate: 15,
        scope: { namespace: 'stores' },
        minimumSubtotal: 0,
        limitPerCustomer: 1,
        limitedToOneItem: false,
        active: true,
        startTime: new Date(),
        expirationTime,
      });

      try {
        await wixData.insert('MemberCoupons', {
          memberEmail: cleanEmail,
          code: coupon.code,
          couponCode: coupon.code,
          couponId: coupon._id,
          displayName: `Happy Birthday ${name}! 15% Off`,
          couponType: 'Birthday',
          discount: '15%',
          percentOffRate: 15,
          moneyOffAmount: 0,
          minimumSubtotal: 0,
          expirationTime,
          expiresAt: expirationTime,
          active: true,
        });
      } catch (insertErr) {
        logError('couponsService:issueBirthdayCoupon-memberCouponsInsertFailed', insertErr);
      }

      return {
        success: true,
        code: coupon.code,
        discount: '15%',
        expiresIn: '7 days',
      };
    } catch (err) {
      logError('[couponsService] createBirthdayCoupon failed', err);
      return { success: false, message: 'Failed to create coupon' };
    }
  }
);

/**
 * Create a loyalty tier upgrade coupon.
 *
 * @function createTierUpgradeCoupon
 * @param {string} email - Member's email
 * @param {string} newTier - The tier they upgraded to (Silver or Gold)
 * @returns {Promise<Object>} { success, code, discount }
 * @permission Admin
 */
export const createTierUpgradeCoupon = webMethod(
  Permissions.Admin,
  async (email, newTier) => {
    try {
      if (!email) return { success: false, message: 'Email required' };

      const cleanEmail = sanitize(email, 254).toLowerCase();
      const tier = sanitize(newTier || '', 20);
      const discountMap = { Silver: 10, Gold: 20 };
      const discount = discountMap[tier] || 10;

      const expirationTime = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days
      const coupon = await coupons.createCoupon({
        name: `${tier} Tier Welcome - ${discount}% Off`,
        code: await generateCode(tier.toUpperCase()),
        percentOffRate: discount,
        scope: { namespace: 'stores' },
        minimumSubtotal: 0,
        limitPerCustomer: 1,
        active: true,
        startTime: new Date(),
        expirationTime,
      });

      try {
        await wixData.insert('MemberCoupons', {
          memberEmail: cleanEmail,
          code: coupon.code,
          couponCode: coupon.code,
          couponId: coupon._id,
          displayName: `${tier} Tier Welcome - ${discount}% Off`,
          couponType: `${tier} Tier`,
          discount: `${discount}%`,
          percentOffRate: discount,
          moneyOffAmount: 0,
          minimumSubtotal: 0,
          expirationTime,
          expiresAt: expirationTime,
          active: true,
        });
      } catch (insertErr) {
        logError('couponsService:issueTierUpgradeCoupon-memberCouponsInsertFailed', insertErr);
      }

      return {
        success: true,
        code: coupon.code,
        discount: `${discount}%`,
        expiresIn: '14 days',
      };
    } catch (err) {
      logError('[couponsService] createTierUpgradeCoupon failed', err);
      return { success: false, message: 'Failed to create coupon' };
    }
  }
);

/**
 * Generate (or retrieve) a recovery coupon for an abandoned cart.
 * Idempotent: calling with the same cartId returns the existing coupon code
 * without creating a new one in the marketing system.
 *
 * @function generateRecoveryCoupon
 * @param {Object} params
 * @param {string} params.cartId - Unique checkout/cart ID for idempotency key
 * @param {string} params.email - Buyer's email address
 * @returns {Promise<Object>}
 *   On success: `{ success: true, code: string, discountPercent: number, expiresAt: string }`.
 *   On failure: `{ success: false, message: string }`.
 * @permission Admin — admin-internal; not intended for direct client use
 */
export const generateRecoveryCoupon = webMethod(
  Permissions.Admin,
  async ({ cartId, email } = {}) => {
    try {
      if (!cartId) return { success: false, message: 'Cart ID required' };
      if (!email) return { success: false, message: 'Email required' };

      const cleanCartId = sanitize(cartId, 50);
      const cleanEmail = sanitize(email, 254).toLowerCase();
      if (!validateEmail(cleanEmail)) {
        return { success: false, message: 'Invalid email' };
      }

      // Idempotency: return existing coupon if one was already created for this cart
      const existing = await wixData.query('RecoveryCoupons')
        .eq('cartId', cleanCartId)
        .find();

      if (existing.items.length > 0) {
        const record = existing.items[0];
        return {
          success: true,
          code: record.code,
          discountPercent: record.discountPercent || 10,
          expiresAt: record.expiresAt,
        };
      }

      // Create new coupon — 10% off, no minimum subtotal, applies to entire cart
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const expiresAtISO = expiresAt.toISOString();
      const coupon = await coupons.createCoupon({
        name: `Cart Recovery 10% Off - ${cleanEmail}`,
        code: await generateCode('RECOVER'),
        percentOffRate: 10,
        scope: { namespace: 'stores' },
        minimumSubtotal: 0,
        limitPerCustomer: 1,
        limitedToOneItem: false,
        active: true,
        startTime: new Date(),
        expirationTime: expiresAt,
      });

      // Persist for idempotency (best-effort: if insert fails, coupon is still usable
      // but a retry will create a second coupon in the marketing system)
      try {
        await wixData.insert('RecoveryCoupons', {
          cartId: cleanCartId,
          email: cleanEmail,
          code: coupon.code,
          discountPercent: 10,
          expiresAt: expiresAtISO,
        });
      } catch (insertErr) {
        logError(`couponsService:generateRecoveryCoupon-recoveryCouponsInsertFailed cartId=${cartId}`, insertErr);
      }

      // Track in MemberCoupons for DB-level member scoping in getActiveCoupons
      try {
        await wixData.insert('MemberCoupons', {
          memberEmail: cleanEmail,
          code: coupon.code,
          couponCode: coupon.code,
          couponId: coupon._id,
          displayName: 'Cart Recovery 10% Off',
          couponType: 'Cart Recovery',
          discount: '10%',
          percentOffRate: 10,
          moneyOffAmount: 0,
          minimumSubtotal: 0,
          expirationTime: expiresAt,
          expiresAt,
          active: true,
        });
      } catch (insertErr) {
        logError(`couponsService:generateRecoveryCoupon-memberCouponsInsertFailed cartId=${cartId}`, insertErr);
      }

      return {
        success: true,
        code: coupon.code,
        discountPercent: 10,
        expiresAt: expiresAtISO,
      };
    } catch (err) {
      logError(`[couponsService] generateRecoveryCoupon failed cartId=${cartId}`, err);
      return { success: false, message: 'Failed to generate recovery coupon' };
    }
  }
);

/**
 * Create a single-use cart recovery coupon (10% off, valid 48 hours).
 *
 * @function createCartRecoveryCoupon
 * @param {string} email - Buyer's email (used for coupon name and validation)
 * @returns {Promise<Object>} { success, code, discount, expiresIn }
 * @permission Admin — called by emailAutomation during cart recovery sequencing
 */
export const createCartRecoveryCoupon = webMethod(
  Permissions.Admin,
  async (email) => {
    try {
      if (!email) return { success: false, message: 'Email required' };

      const cleanEmail = sanitize(email, 254).toLowerCase();
      if (!validateEmail(cleanEmail)) {
        return { success: false, message: 'Invalid email' };
      }

      const expirationTime = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
      const coupon = await coupons.createCoupon({
        name: `Cart Recovery 10% Off - ${cleanEmail}`,
        code: await generateCode('RECOVER'),
        percentOffRate: 10,
        scope: { namespace: 'stores' },
        minimumSubtotal: 0,
        limitPerCustomer: 1,
        usageLimit: 1,
        limitedToOneItem: false,
        active: true,
        startTime: new Date(),
        expirationTime,
      });

      try {
        await wixData.insert('MemberCoupons', {
          memberEmail: cleanEmail,
          code: coupon.code,
          couponCode: coupon.code,
          couponId: coupon._id,
          displayName: 'Cart Recovery 10% Off',
          couponType: 'Cart Recovery',
          discount: '10%',
          percentOffRate: 10,
          moneyOffAmount: 0,
          minimumSubtotal: 0,
          expirationTime,
          expiresAt: expirationTime,
          active: true,
        });
      } catch (insertErr) {
        logError('couponsService:issueCartRecoveryCoupon-memberCouponsInsertFailed', insertErr);
      }

      return {
        success: true,
        code: coupon.code,
        discount: '10%',
        expiresIn: '48 hours',
      };
    } catch (err) {
      logError('[couponsService] createCartRecoveryCoupon failed', err);
      return { success: false, message: 'Failed to create coupon' };
    }
  }
);

// ── Internal helpers ──────────────────────────────────────────────────

async function generateCode(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 for clarity
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = prefix + '-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Check for collision with existing coupons
    try {
      const existing = await coupons.queryV2().eq('code', code).limit(1).find();
      if (!existing.items || existing.items.length === 0) return code;
    } catch (e) {
      // Collision check failed — returning unchecked code; collision is statistically unlikely
      logError(`couponsService:generateCode-collisionCheckFailed attempt=${attempt}`, e);
      return code;
    }
  }
  // Fallback: extend to 8 chars for extra entropy
  let code = prefix + '-';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
