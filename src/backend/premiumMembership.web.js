/**
 * @module premiumMembership
 * @description CF+ Premium membership subscription system.
 * Manages paid membership plans with benefits: free shipping,
 * exclusive discounts, and early access to new products.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 * @requires backend/utils/sanitize
 *
 * @setup
 * Create CMS collection "PremiumMemberships" with fields:
 *   memberId (Text, indexed) - Member ID
 *   planType (Text) - 'monthly' | 'annual'
 *   status (Text) - 'active' | 'cancelled' | 'expired'
 *   startDate (DateTime) - Subscription start
 *   endDate (DateTime) - Subscription end / renewal date
 *   cancelledAt (DateTime) - When cancelled (if applicable)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';

// ── Plan Definitions ────────────────────────────────────────────────

const CF_PLUS_DISCOUNT_PERCENT = 10;

const PLANS = [
  {
    id: 'cf-plus-monthly',
    type: 'monthly',
    price: 14.99,
    label: 'CF+ Monthly',
    durationDays: 30,
    benefits: [
      'Free shipping on all orders',
      `${CF_PLUS_DISCOUNT_PERCENT}% off every order`,
      'Early access to new products',
      'Member-only promotions',
    ],
  },
  {
    id: 'cf-plus-annual',
    type: 'annual',
    price: 119.99,
    label: 'CF+ Annual',
    durationDays: 365,
    benefits: [
      'Free shipping on all orders',
      `${CF_PLUS_DISCOUNT_PERCENT}% off every order`,
      'Early access to new products',
      'Member-only promotions',
      'Save $60/year vs monthly',
    ],
  },
];

const VALID_PLAN_TYPES = new Set(PLANS.map(p => p.type));

// ── Helpers ─────────────────────────────────────────────────────────

async function getMember() {
  try {
    return await currentMember.getMember();
  } catch {
    return null;
  }
}

async function getActiveMembership(memberId) {
  const result = await wixData.query('PremiumMemberships')
    .eq('memberId', memberId)
    .eq('status', 'active')
    .find();

  if (result.items.length === 0) return null;

  const membership = result.items[0];

  // Check expiration
  if (membership.endDate && new Date(membership.endDate) < new Date()) {
    await wixData.update('PremiumMemberships', { ...membership, status: 'expired' });
    return null;
  }

  return membership;
}

// ── getMembershipPlans ──────────────────────────────────────────────

/**
 * Returns available CF+ membership plans with pricing and benefits.
 * @returns {Promise<{success: boolean, plans: Array}>}
 * @permission Anyone
 */
export const getMembershipPlans = webMethod(
  Permissions.Anyone,
  async () => {
    return {
      success: true,
      plans: PLANS.map(p => ({
        id: p.id,
        type: p.type,
        price: p.price,
        label: p.label,
        benefits: [...p.benefits],
      })),
    };
  }
);

// ── checkMembershipStatus ───────────────────────────────────────────

/**
 * Check if the current member has an active CF+ subscription.
 * @returns {Promise<{success: boolean, isActive: boolean, planType?: string, endDate?: Date}>}
 * @permission SiteMember
 */
export const checkMembershipStatus = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await getMember();
      if (!member?._id) return { success: false, error: 'Not authenticated' };

      const membership = await getActiveMembership(member._id);

      if (!membership) {
        return { success: true, isActive: false };
      }

      return {
        success: true,
        isActive: true,
        planType: membership.planType,
        endDate: membership.endDate,
        startDate: membership.startDate,
      };
    } catch (err) {
      console.error('[premiumMembership] checkMembershipStatus error:', err);
      return { success: false, error: 'Failed to check membership status' };
    }
  }
);

// ── getMemberBenefits ───────────────────────────────────────────────

/**
 * Get active benefits for the current member.
 * @returns {Promise<{success: boolean, freeShipping: boolean, discountPercent: number, earlyAccess: boolean}>}
 * @permission SiteMember
 */
export const getMemberBenefits = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await getMember();
      if (!member?._id) return { success: false, error: 'Not authenticated' };

      const membership = await getActiveMembership(member._id);

      if (!membership) {
        return {
          success: true,
          freeShipping: false,
          discountPercent: 0,
          earlyAccess: false,
        };
      }

      return {
        success: true,
        freeShipping: true,
        discountPercent: CF_PLUS_DISCOUNT_PERCENT,
        earlyAccess: true,
      };
    } catch (err) {
      console.error('[premiumMembership] getMemberBenefits error:', err);
      return { success: false, error: 'Failed to get benefits' };
    }
  }
);

// ── activateMembership ──────────────────────────────────────────────

/**
 * Activate a CF+ membership for a member. Admin only — called after payment.
 * @param {string} memberId - Member ID
 * @param {string} planType - 'monthly' or 'annual'
 * @returns {Promise<{success: boolean, membershipId?: string}>}
 * @permission Admin
 */
export const activateMembership = webMethod(
  Permissions.Admin,
  async (memberId, planType) => {
    try {
      if (!memberId || typeof memberId !== 'string') {
        return { success: false, error: 'Member ID required' };
      }

      if (!VALID_PLAN_TYPES.has(planType)) {
        return { success: false, error: 'Invalid plan type' };
      }

      const cleanId = sanitize(memberId, 50);
      const plan = PLANS.find(p => p.type === planType);

      // Cancel any existing active membership
      const existing = await wixData.query('PremiumMemberships')
        .eq('memberId', cleanId)
        .eq('status', 'active')
        .find();

      for (const old of existing.items) {
        await wixData.update('PremiumMemberships', {
          ...old,
          status: 'cancelled',
          cancelledAt: new Date(),
        });
      }

      // Create new membership
      const now = new Date();
      const endDate = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

      const membership = await wixData.insert('PremiumMemberships', {
        memberId: cleanId,
        planType,
        status: 'active',
        startDate: now,
        endDate,
      });

      return {
        success: true,
        membershipId: membership._id,
        planType,
        endDate,
      };
    } catch (err) {
      console.error('[premiumMembership] activateMembership error:', err);
      return { success: false, error: 'Failed to activate membership' };
    }
  }
);

// ── cancelMembership ────────────────────────────────────────────────

/**
 * Cancel a member's active CF+ subscription.
 * @param {string} memberId - Member ID
 * @returns {Promise<{success: boolean}>}
 * @permission Admin
 */
export const cancelMembership = webMethod(
  Permissions.Admin,
  async (memberId) => {
    try {
      if (!memberId || typeof memberId !== 'string') {
        return { success: false, error: 'Member ID required' };
      }

      const cleanId = sanitize(memberId, 50);

      const result = await wixData.query('PremiumMemberships')
        .eq('memberId', cleanId)
        .eq('status', 'active')
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'No active membership found' };
      }

      const membership = result.items[0];
      await wixData.update('PremiumMemberships', {
        ...membership,
        status: 'cancelled',
        cancelledAt: new Date(),
      });

      return { success: true };
    } catch (err) {
      console.error('[premiumMembership] cancelMembership error:', err);
      return { success: false, error: 'Failed to cancel membership' };
    }
  }
);

// ── applyMemberDiscount ─────────────────────────────────────────────

/**
 * Calculate CF+ member discount at checkout.
 * @param {number} orderTotal - Order total before discount
 * @returns {Promise<{success: boolean, discountAmount: number, discountPercent: number, freeShipping: boolean, finalTotal: number}>}
 * @permission SiteMember
 */
export const applyMemberDiscount = webMethod(
  Permissions.SiteMember,
  async (orderTotal) => {
    try {
      const total = Number(orderTotal);
      if (!isFinite(total) || total < 0) {
        return { success: false, error: 'Invalid order total' };
      }

      const member = await getMember();
      if (!member?._id) return { success: false, error: 'Not authenticated' };

      const membership = await getActiveMembership(member._id);

      if (!membership) {
        return {
          success: true,
          discountAmount: 0,
          discountPercent: 0,
          freeShipping: false,
          finalTotal: total,
        };
      }

      const discountAmount = Math.round(total * CF_PLUS_DISCOUNT_PERCENT / 100 * 100) / 100;
      const finalTotal = Math.round((total - discountAmount) * 100) / 100;

      return {
        success: true,
        discountAmount,
        discountPercent: CF_PLUS_DISCOUNT_PERCENT,
        freeShipping: true,
        finalTotal,
      };
    } catch (err) {
      console.error('[premiumMembership] applyMemberDiscount error:', err);
      return { success: false, error: 'Failed to apply discount' };
    }
  }
);

// ── CF-ortb: Premium upsell data ──────────────────────────────────────────────

/**
 * Minimum tier to show the CF+ upsell CTA.
 * Trail Blazer (0 pts) = too new, Mountain Guide (500+ pts) = engaged enough.
 */
const UPSELL_MIN_TIER = 'Mountain Guide';
const UPSELL_ELIGIBLE_TIERS = new Set(['Mountain Guide', 'Summit Master', 'Blue Ridge Legend']);

/**
 * Returns upsell eligibility, current membership status, and plan details
 * for the premium upsell widget on the Member Page.
 *
 * Eligible if: member tier is Mountain Guide+ AND not already a CF+ subscriber.
 * Returns null for non-members.
 *
 * CF-ortb
 *
 * @returns {Promise<{ eligible: boolean, alreadyMember: boolean, tier: string,
 *   plans: Array, benefits: string[] } | null>}
 */
export const getPremiumUpsellData = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await getMember();
      if (!member?._id) return null;

      // Check current tier
      const pointsResult = await wixData.query('MemberPoints')
        .eq('memberId', member._id)
        .limit(1)
        .find();

      const tier = pointsResult.items.length > 0
        ? (pointsResult.items[0].tier || 'Trail Blazer')
        : 'Trail Blazer';

      // Check existing CF+ membership
      const membership = await getActiveMembership(member._id);
      const alreadyMember = !!membership;

      // Eligible: tier is Mountain Guide+ AND not already subscribed
      const eligible = UPSELL_ELIGIBLE_TIERS.has(tier) && !alreadyMember;

      return {
        eligible,
        alreadyMember,
        tier,
        plans: PLANS.map(p => ({
          id: p.id,
          type: p.type,
          price: p.price,
          label: p.label,
        })),
        benefits: PLANS[0].benefits, // same benefits for all plans
      };
    } catch (err) {
      console.error('[premiumMembership] getPremiumUpsellData error:', err);
      return null;
    }
  }
);
