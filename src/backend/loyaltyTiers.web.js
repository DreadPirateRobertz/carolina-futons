/**
 * @module loyaltyTiers
 * @description Customer loyalty tier system based on lifetime spend.
 * Tracks spend thresholds, assigns tiers, provides tier-specific benefits
 * including discount percentages, early access flags, and free shipping
 * threshold overrides.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 * @requires backend/utils/sanitize
 *
 * @setup
 * Create CMS collections:
 *   LoyaltyTiers - Tier definitions (seeded once)
 *     name (Text, indexed) - 'Bronze'|'Silver'|'Gold'|'Platinum'
 *     minSpend (Number) - Minimum lifetime spend for this tier
 *     discountPercent (Number) - Tier discount percentage
 *     freeShippingThreshold (Number) - Free shipping minimum order
 *     earlyAccess (Boolean) - Whether tier gets early access
 *     sortOrder (Number) - Display order
 *
 *   CustomerTierHistory - Member tier records
 *     memberId (Text, indexed) - Member ID
 *     lifetimeSpend (Number) - Total lifetime spend
 *     currentTier (Text, indexed) - Current tier name
 *     previousTier (Text) - Previous tier before last change
 *     tierChangedAt (Date) - When tier last changed
 *     _createdDate (Date) - Auto
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_TIERS = [
  { name: 'Bronze', minSpend: 0, discountPercent: 0, freeShippingThreshold: 150, earlyAccess: false, sortOrder: 0 },
  { name: 'Silver', minSpend: 500, discountPercent: 5, freeShippingThreshold: 100, earlyAccess: false, sortOrder: 1 },
  { name: 'Gold', minSpend: 1500, discountPercent: 10, freeShippingThreshold: 50, earlyAccess: true, sortOrder: 2 },
  { name: 'Platinum', minSpend: 3000, discountPercent: 15, freeShippingThreshold: 0, earlyAccess: true, sortOrder: 3 },
];

const VALID_TIER_NAMES = ['Bronze', 'Silver', 'Gold', 'Platinum'];

// ── Helpers ──────────────────────────────────────────────────────────

async function getMember() {
  try {
    return await currentMember.getMember();
  } catch {
    return null;
  }
}

function determineTierFromSpend(spend, tiers) {
  // Sort descending by minSpend, find the first tier the spend qualifies for
  const sorted = [...tiers].sort((a, b) => b.minSpend - a.minSpend);
  for (const tier of sorted) {
    if (spend >= tier.minSpend) return tier;
  }
  return tiers.find(t => t.minSpend === 0) || tiers[0];
}

async function getTierDefinitions() {
  const result = await wixData.query('LoyaltyTiers')
    .ascending('sortOrder')
    .limit(10)
    .find();

  if (result.items.length === 0) return DEFAULT_TIERS;
  return result.items;
}

// ── getTier ─────────────────────────────────────────────────────────

/**
 * Gets the current member's loyalty tier and benefits.
 */
export const getTier = webMethod(Permissions.SiteMember, async () => {
  try {
    const member = await getMember();
    if (!member) return { success: false, error: 'Not authenticated' };

    const tiers = await getTierDefinitions();

    // Look up customer's tier history
    const history = await wixData.query('CustomerTierHistory')
      .eq('memberId', member._id)
      .limit(1)
      .find();

    let record = history.items[0];
    if (!record) {
      // New customer — create Bronze record
      record = await wixData.insert('CustomerTierHistory', {
        memberId: member._id,
        lifetimeSpend: 0,
        currentTier: 'Bronze',
        previousTier: null,
        tierChangedAt: new Date(),
      });
    }

    const tierDef = tiers.find(t => t.name === record.currentTier) || tiers[0];
    const nextTier = tiers.find(t => t.minSpend > (record.lifetimeSpend || 0));
    const spendToNext = nextTier ? nextTier.minSpend - (record.lifetimeSpend || 0) : 0;

    return {
      success: true,
      data: {
        tier: tierDef.name,
        lifetimeSpend: record.lifetimeSpend || 0,
        discountPercent: tierDef.discountPercent,
        freeShippingThreshold: tierDef.freeShippingThreshold,
        earlyAccess: tierDef.earlyAccess || false,
        nextTier: nextTier ? nextTier.name : null,
        spendToNext: Math.max(0, spendToNext),
        tierChangedAt: record.tierChangedAt,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to get tier' };
  }
});

// ── updateTier ──────────────────────────────────────────────────────

/**
 * Updates a customer's lifetime spend and recalculates their tier.
 * Admin only — called after order completion.
 * @param {string} memberId - The member ID
 * @param {number} orderAmount - The order total to add to lifetime spend
 */
export const updateTier = webMethod(Permissions.Admin, async (memberId, orderAmount) => {
  try {
    if (!memberId || typeof memberId !== 'string') {
      return { success: false, error: 'Invalid member ID' };
    }
    if (typeof orderAmount !== 'number' || orderAmount < 0) {
      return { success: false, error: 'Order amount must be a non-negative number' };
    }

    const cleanId = sanitize(memberId, 50);
    const tiers = await getTierDefinitions();

    // Get or create tier history
    const history = await wixData.query('CustomerTierHistory')
      .eq('memberId', cleanId)
      .limit(1)
      .find();

    let record = history.items[0];
    if (!record) {
      record = await wixData.insert('CustomerTierHistory', {
        memberId: cleanId,
        lifetimeSpend: 0,
        currentTier: 'Bronze',
        previousTier: null,
        tierChangedAt: new Date(),
      });
    }

    const newSpend = (record.lifetimeSpend || 0) + orderAmount;
    const newTier = determineTierFromSpend(newSpend, tiers);
    const tierChanged = newTier.name !== record.currentTier;

    await wixData.update('CustomerTierHistory', {
      ...record,
      lifetimeSpend: newSpend,
      currentTier: newTier.name,
      previousTier: tierChanged ? record.currentTier : record.previousTier,
      tierChangedAt: tierChanged ? new Date() : record.tierChangedAt,
    });

    return {
      success: true,
      data: {
        memberId: cleanId,
        lifetimeSpend: newSpend,
        currentTier: newTier.name,
        previousTier: tierChanged ? record.currentTier : record.previousTier,
        tierChanged,
        discountPercent: newTier.discountPercent,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to update tier' };
  }
});

// ── calculateRewards ────────────────────────────────────────────────

/**
 * Calculates applicable rewards for a given order based on member tier.
 * @param {string} memberId - The member ID
 * @param {number} orderTotal - The order total before discounts
 */
export const calculateRewards = webMethod(Permissions.Anyone, async (memberId, orderTotal) => {
  try {
    if (!memberId || typeof memberId !== 'string') {
      return { success: false, error: 'Invalid member ID' };
    }
    if (typeof orderTotal !== 'number' || orderTotal < 0) {
      return { success: false, error: 'Order total must be a non-negative number' };
    }

    const cleanId = sanitize(memberId, 50);
    const tiers = await getTierDefinitions();

    const history = await wixData.query('CustomerTierHistory')
      .eq('memberId', cleanId)
      .limit(1)
      .find();

    if (history.items.length === 0) {
      return {
        success: true,
        data: {
          tier: 'Bronze',
          discountPercent: 0,
          discountAmount: 0,
          freeShipping: false,
          finalTotal: orderTotal,
        },
      };
    }

    const record = history.items[0];
    const tierDef = tiers.find(t => t.name === record.currentTier) || tiers[0];
    const discountAmount = Math.round(orderTotal * (tierDef.discountPercent / 100) * 100) / 100;
    const finalTotal = Math.round((orderTotal - discountAmount) * 100) / 100;
    const freeShipping = orderTotal >= tierDef.freeShippingThreshold;

    return {
      success: true,
      data: {
        tier: tierDef.name,
        discountPercent: tierDef.discountPercent,
        discountAmount,
        freeShipping,
        freeShippingThreshold: tierDef.freeShippingThreshold,
        earlyAccess: tierDef.earlyAccess || false,
        finalTotal,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to calculate rewards' };
  }
});

// ── getTierDefinitions (public) ─────────────────────────────────────

/**
 * Returns all tier definitions with benefits — public for marketing display.
 */
export const getAllTiers = webMethod(Permissions.Anyone, async () => {
  try {
    const tiers = await getTierDefinitions();
    return {
      success: true,
      data: tiers.map(t => ({
        name: t.name,
        minSpend: t.minSpend,
        discountPercent: t.discountPercent,
        freeShippingThreshold: t.freeShippingThreshold,
        earlyAccess: t.earlyAccess || false,
      })),
    };
  } catch (err) {
    return { success: false, error: 'Failed to load tiers' };
  }
});

// ── getCustomerTierHistory (admin) ──────────────────────────────────

/**
 * Returns tier history for a specific customer. Admin only.
 * @param {string} memberId - The member ID
 */
export const getCustomerTierHistory = webMethod(Permissions.Admin, async (memberId) => {
  try {
    if (!memberId || typeof memberId !== 'string') {
      return { success: false, error: 'Invalid member ID' };
    }

    const cleanId = sanitize(memberId, 50);

    const history = await wixData.query('CustomerTierHistory')
      .eq('memberId', cleanId)
      .limit(1)
      .find();

    if (history.items.length === 0) {
      return { success: false, error: 'Customer not found' };
    }

    const record = history.items[0];
    const tiers = await getTierDefinitions();
    const tierDef = tiers.find(t => t.name === record.currentTier) || tiers[0];

    return {
      success: true,
      data: {
        memberId: record.memberId,
        lifetimeSpend: record.lifetimeSpend || 0,
        currentTier: record.currentTier,
        previousTier: record.previousTier,
        tierChangedAt: record.tierChangedAt,
        discountPercent: tierDef.discountPercent,
        freeShippingThreshold: tierDef.freeShippingThreshold,
        earlyAccess: tierDef.earlyAccess || false,
        createdDate: record._createdDate,
      },
    };
  } catch (err) {
    return { success: false, error: 'Failed to load customer tier history' };
  }
});
