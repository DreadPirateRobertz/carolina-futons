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
import { sanitize, validateEmail } from 'backend/utils/sanitize';

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

      const coupon = await coupons.createCoupon({
        name: `Welcome 10% Off - ${cleanEmail}`,
        code: generateCode('WELCOME'),
        percentOffRate: 10,
        scope: { namespace: 'stores' },
        minimumSubtotal: 0,
        limitPerCustomer: 1,
        limitedToOneItem: false,
        active: true,
        startTime: new Date(),
        expirationTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });

      return {
        success: true,
        code: coupon.code,
        discount: '10%',
        expiresIn: '30 days',
      };
    } catch (err) {
      console.error('Error creating welcome coupon:', err);
      return { success: false, message: 'Failed to create coupon' };
    }
  }
);

/**
 * Get active coupons for the current member.
 *
 * @function getActiveCoupons
 * @returns {Promise<Array>} List of active coupons with code, discount, expiry
 * @permission SiteMember
 */
export const getActiveCoupons = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const result = await coupons.queryAllCoupons()
        .eq('active', true)
        .find();

      return (result.items || []).map(c => ({
        _id: c._id,
        code: c.code,
        name: c.name,
        discount: c.percentOffRate ? `${c.percentOffRate}% off` : `$${c.moneyOffAmount || 0} off`,
        minimumSubtotal: c.minimumSubtotal || 0,
        expirationTime: c.expirationTime,
        active: c.active,
      }));
    } catch (err) {
      console.error('Error getting coupons:', err);
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

      const coupon = await coupons.createCoupon({
        name: `Happy Birthday ${name}! 15% Off`,
        code: generateCode('BDAY'),
        percentOffRate: 15,
        scope: { namespace: 'stores' },
        minimumSubtotal: 0,
        limitPerCustomer: 1,
        limitedToOneItem: false,
        active: true,
        startTime: new Date(),
        expirationTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      return {
        success: true,
        code: coupon.code,
        discount: '15%',
        expiresIn: '7 days',
      };
    } catch (err) {
      console.error('Error creating birthday coupon:', err);
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

      const coupon = await coupons.createCoupon({
        name: `${tier} Tier Welcome - ${discount}% Off`,
        code: generateCode(tier.toUpperCase()),
        percentOffRate: discount,
        scope: { namespace: 'stores' },
        minimumSubtotal: 0,
        limitPerCustomer: 1,
        active: true,
        startTime: new Date(),
        expirationTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
      });

      return {
        success: true,
        code: coupon.code,
        discount: `${discount}%`,
        expiresIn: '14 days',
      };
    } catch (err) {
      console.error('Error creating tier upgrade coupon:', err);
      return { success: false, message: 'Failed to create coupon' };
    }
  }
);

// ── Internal helpers ──────────────────────────────────────────────────

function generateCode(prefix) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 for clarity
  let code = prefix + '-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
