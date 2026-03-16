/**
 * @module membershipService
 * @description CF+ Premium membership management via Wix Pricing Plans.
 * Handles membership status, benefits, and badge display for paid subscribers.
 *
 * @requires wix-web-module
 * @requires wix-pricing-plans.v2
 * @requires wix-members-backend
 *
 * @setup
 * 1. Install Wix Pricing Plans app in Dashboard
 * 2. Create plans with slugs: cf-plus-monthly, cf-plus-annual
 * 3. Configure plan pricing in Dashboard > Pricing Plans
 */
import { Permissions, webMethod } from 'wix-web-module';
import { orders, plans } from 'wix-pricing-plans.v2';
import { currentMember } from 'wix-members-backend';

/** Plan slug identifiers — must match Wix Dashboard plan slugs. */
export const PLAN_SLUGS = {
  MONTHLY: 'cf-plus-monthly',
  ANNUAL: 'cf-plus-annual',
};

const CF_PLUS_SLUG_SET = new Set([PLAN_SLUGS.MONTHLY, PLAN_SLUGS.ANNUAL]);

/** Benefits granted to active CF+ members. */
export const CF_PLUS_BENEFITS = {
  freeShippingThreshold: 0,
  discountPercent: 10,
  earlyAccess: true,
  prioritySupport: true,
};

const BADGE_CONFIG = {
  label: 'CF+',
  color: '#1a5276',
};

// ── Helpers ──────────────────────────────────────────────────────

async function getMember() {
  try {
    return await currentMember.getMember();
  } catch {
    return null;
  }
}

async function getActiveOrder() {
  const member = await getMember();
  if (!member) return null;

  try {
    const result = await orders.listOrders();
    const orderList = result.orders || [];
    return orderList.find(o => o.status === 'ACTIVE') || null;
  } catch (err) {
    console.error('[membershipService] Error fetching orders:', err);
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────

/**
 * List available CF+ membership plans.
 *
 * @function getMembershipPlans
 * @returns {Promise<Array>} Active CF+ plans with pricing
 * @permission Anyone — public info for marketing
 */
export const getMembershipPlans = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const result = await plans.listPublicPlans();
      const allPlans = result.plans || [];
      return allPlans.filter(p => CF_PLUS_SLUG_SET.has(p.slug) && p.active);
    } catch (err) {
      console.error('[membershipService] Error listing plans:', err);
      return [];
    }
  }
);

/**
 * Get current member's CF+ membership status.
 *
 * @function getMembershipStatus
 * @returns {Promise<Object>} { active, planName?, startDate?, endDate? }
 * @permission SiteMember
 */
export const getMembershipStatus = webMethod(
  Permissions.SiteMember,
  async () => {
    const order = await getActiveOrder();
    if (!order) {
      return { active: false };
    }

    return {
      active: true,
      planName: order.planName || 'CF+',
      startDate: order.startDate || null,
      endDate: order.endDate || null,
      orderId: order._id,
    };
  }
);

/**
 * Quick boolean check: is current member an active CF+ subscriber?
 *
 * @function isCFPlusMember
 * @returns {Promise<boolean>}
 * @permission SiteMember
 */
export const isCFPlusMember = webMethod(
  Permissions.SiteMember,
  async () => {
    const order = await getActiveOrder();
    return order !== null;
  }
);

/**
 * Get active benefits for current member.
 * Returns full CF+ benefits if active, or defaults for non-members.
 *
 * @function getMemberBenefits
 * @returns {Promise<Object>} { freeShipping, discountPercent, earlyAccess, prioritySupport, badge }
 * @permission SiteMember
 */
export const getMemberBenefits = webMethod(
  Permissions.SiteMember,
  async () => {
    const order = await getActiveOrder();
    if (!order) {
      return {
        freeShipping: false,
        discountPercent: 0,
        earlyAccess: false,
        prioritySupport: false,
        badge: null,
      };
    }

    return {
      freeShipping: true,
      discountPercent: CF_PLUS_BENEFITS.discountPercent,
      earlyAccess: CF_PLUS_BENEFITS.earlyAccess,
      prioritySupport: CF_PLUS_BENEFITS.prioritySupport,
      badge: BADGE_CONFIG.label,
    };
  }
);

/**
 * Get badge display data for current member.
 * Returns null for non-members, badge config for active CF+ members.
 *
 * @function getMemberBadge
 * @returns {Promise<Object|null>} { label, color, planName } or null
 * @permission SiteMember
 */
export const getMemberBadge = webMethod(
  Permissions.SiteMember,
  async () => {
    const order = await getActiveOrder();
    if (!order) return null;

    return {
      label: BADGE_CONFIG.label,
      color: BADGE_CONFIG.color,
      planName: order.planName || 'CF+',
    };
  }
);
