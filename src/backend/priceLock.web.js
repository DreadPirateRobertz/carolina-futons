/**
 * @module priceLock.web
 * @description Price Lock Guarantee — $25 refundable deposit locks today's price
 * for 30/60/90 days. Converts "I'll think about it" into a committed micro-transaction.
 *
 * @setup
 * Create `PriceLocks` CMS collection in Wix Dashboard:
 *   _id (auto), memberId (Text, indexed), productId (Text, indexed),
 *   productName (Text), lockedPrice (Number), currentPrice (Number),
 *   deposit (Number), tier (Text: 30|60|90), status (Text: active|redeemed|expired|refunded),
 *   createdAt (DateTime), expiresAt (DateTime, indexed), redeemedAt (DateTime, nullable),
 *   email (Text, indexed)
 *
 * Permissions: Member (create/redeem), Admin (expire/refund/list)
 *
 * CF-tjf0
 */

import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';
import { logAuditEvent } from 'backend/utils/auditLog';
import { checkRateLimit } from 'backend/utils/rateLimit';

// ── Constants ────────────────────────────────────────────────────────

const COLLECTION = 'PriceLocks';
const DEPOSIT_AMOUNT = 25;
const MAX_ACTIVE_LOCKS_PER_MEMBER = 5;

const TIERS = {
  30: { days: 30, label: '30-day lock' },
  60: { days: 60, label: '60-day lock' },
  90: { days: 90, label: '90-day lock' },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── Create Price Lock ────────────────────────────────────────────────

/**
 * Create a price lock for a product at the current price.
 *
 * @param {Object} params
 * @param {string} params.productId - Wix Stores product ID
 * @param {number} params.currentPrice - Current product price to lock
 * @param {string} params.productName - Product display name
 * @param {string} params.email - Member's email for notifications
 * @param {number} [params.tier=30] - Lock duration: 30, 60, or 90 days
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const createPriceLock = webMethod(
  Permissions.SiteMember,
  async ({ productId, currentPrice, productName, email, tier = 30 }, memberId) => {
    try {
      if (!memberId) return { success: false, error: 'Authentication required' };

      const cleanProductId = sanitize(productId, 50);
      const cleanName = sanitize(productName, 200);
      const cleanEmail = sanitize(email, 254).toLowerCase();
      const tierKey = String(tier);

      if (!cleanProductId) return { success: false, error: 'Product ID is required' };
      if (!TIERS[tierKey]) return { success: false, error: 'Invalid tier. Choose 30, 60, or 90 days.' };
      if (typeof currentPrice !== 'number' || currentPrice <= 0) {
        return { success: false, error: 'Invalid price' };
      }
      if (cleanEmail && !validateEmail(cleanEmail)) {
        return { success: false, error: 'Invalid email address' };
      }

      // Rate limit: 3 locks per hour per member
      const { allowed } = await checkRateLimit('PriceLockRateLimit', memberId, { max: 3 });
      if (!allowed) {
        return { success: false, error: 'Too many requests. Please try again later.' };
      }

      // Check active lock limit
      const activeLocks = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .eq('status', 'active')
        .find({ suppressAuth: true });

      if (activeLocks.items.length >= MAX_ACTIVE_LOCKS_PER_MEMBER) {
        return {
          success: false,
          error: `Maximum ${MAX_ACTIVE_LOCKS_PER_MEMBER} active price locks allowed. Redeem or cancel an existing lock first.`,
        };
      }

      // Check for existing active lock on same product
      const existing = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .eq('productId', cleanProductId)
        .eq('status', 'active')
        .find({ suppressAuth: true });

      if (existing.items.length > 0) {
        return {
          success: false,
          error: 'You already have an active price lock on this product.',
          existingLock: {
            lockedPrice: existing.items[0].lockedPrice,
            expiresAt: existing.items[0].expiresAt,
          },
        };
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + TIERS[tierKey].days * MS_PER_DAY);

      const lock = await wixData.insert(COLLECTION, {
        memberId,
        productId: cleanProductId,
        productName: cleanName,
        lockedPrice: currentPrice,
        currentPrice,
        deposit: DEPOSIT_AMOUNT,
        tier: tierKey,
        status: 'active',
        createdAt: now,
        expiresAt,
        redeemedAt: null,
        email: cleanEmail,
      }, { suppressAuth: true });

      logAuditEvent(COLLECTION, 'create', memberId, {
        productId: cleanProductId,
        lockedPrice: currentPrice,
        tier: tierKey,
        expiresAt: expiresAt.toISOString(),
      });

      return {
        success: true,
        data: {
          _id: lock._id,
          productId: cleanProductId,
          productName: cleanName,
          lockedPrice: currentPrice,
          deposit: DEPOSIT_AMOUNT,
          tier: tierKey,
          tierLabel: TIERS[tierKey].label,
          expiresAt,
        },
      };
    } catch (err) {
      logError('priceLock.createPriceLock', err);
      return { success: false, error: 'Failed to create price lock' };
    }
  }
);

// ── Get Member's Active Locks ────────────────────────────────────────

/**
 * Get all active price locks for the current member.
 * @returns {Promise<{success: boolean, locks: Array}>}
 */
export const getMyPriceLocks = webMethod(
  Permissions.SiteMember,
  async (memberId) => {
    try {
      if (!memberId) return { success: false, locks: [] };

      const { currentMember } = await import('wix-members-backend');
      const caller = await currentMember.getMember();
      if (!caller?._id || caller._id !== memberId) return { success: false, locks: [] };

      const result = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .eq('status', 'active')
        .descending('createdAt')
        .find({ suppressAuth: true });

      const now = new Date();
      const locks = result.items.map(lock => ({
        _id: lock._id,
        productId: lock.productId,
        productName: lock.productName,
        lockedPrice: lock.lockedPrice,
        deposit: lock.deposit,
        tier: lock.tier,
        tierLabel: TIERS[lock.tier]?.label || `${lock.tier}-day lock`,
        expiresAt: lock.expiresAt,
        daysRemaining: Math.max(0, Math.ceil((new Date(lock.expiresAt).getTime() - now.getTime()) / MS_PER_DAY)),
        isExpiringSoon: (new Date(lock.expiresAt).getTime() - now.getTime()) < 7 * MS_PER_DAY,
      }));

      return { success: true, locks };
    } catch (err) {
      logError('priceLock.getMyPriceLocks', err);
      return { success: false, locks: [] };
    }
  }
);

// ── Check Price Lock for Product ─────────────────────────────────────

/**
 * Check if a member has an active price lock on a specific product.
 * Used by PDP to show "Price locked at $X" badge.
 *
 * @param {string} productId
 * @returns {Promise<{hasLock: boolean, lock?: Object}>}
 */
export const checkPriceLock = webMethod(
  Permissions.SiteMember,
  async (productId, memberId) => {
    try {
      if (!memberId || !productId) return { hasLock: false };

      const cleanProductId = sanitize(productId, 50);
      const result = await wixData.query(COLLECTION)
        .eq('memberId', memberId)
        .eq('productId', cleanProductId)
        .eq('status', 'active')
        .find({ suppressAuth: true });

      if (result.items.length === 0) return { hasLock: false };

      const lock = result.items[0];
      const now = new Date();
      const expired = new Date(lock.expiresAt).getTime() < now.getTime();

      if (expired) {
        // Auto-expire on read
        await wixData.update(COLLECTION, { ...lock, status: 'expired' }, { suppressAuth: true });
        return { hasLock: false };
      }

      return {
        hasLock: true,
        lock: {
          _id: lock._id,
          lockedPrice: lock.lockedPrice,
          deposit: lock.deposit,
          expiresAt: lock.expiresAt,
          daysRemaining: Math.max(0, Math.ceil((new Date(lock.expiresAt).getTime() - now.getTime()) / MS_PER_DAY)),
        },
      };
    } catch (err) {
      logError('priceLock.checkPriceLock', err);
      return { hasLock: false };
    }
  }
);

// ── Redeem Price Lock ────────────────────────────────────────────────

/**
 * Redeem a price lock — applies locked price at checkout.
 * The $25 deposit is credited toward the purchase.
 *
 * @param {string} lockId - Price lock record ID
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export const redeemPriceLock = webMethod(
  Permissions.SiteMember,
  async (lockId, memberId) => {
    try {
      if (!memberId || !lockId) return { success: false, error: 'Invalid request' };

      const lock = await wixData.get(COLLECTION, sanitize(lockId, 50), { suppressAuth: true });
      if (!lock) return { success: false, error: 'Price lock not found' };
      if (lock.memberId !== memberId) return { success: false, error: 'Unauthorized' };
      if (lock.status !== 'active') return { success: false, error: `Price lock is ${lock.status}` };

      const now = new Date();
      if (new Date(lock.expiresAt).getTime() < now.getTime()) {
        await wixData.update(COLLECTION, { ...lock, status: 'expired' }, { suppressAuth: true });
        return { success: false, error: 'Price lock has expired' };
      }

      await wixData.update(COLLECTION, {
        ...lock,
        status: 'redeemed',
        redeemedAt: now,
      }, { suppressAuth: true });

      logAuditEvent(COLLECTION, 'redeem', memberId, {
        lockId: lock._id,
        productId: lock.productId,
        lockedPrice: lock.lockedPrice,
        depositCredited: lock.deposit,
      });

      return {
        success: true,
        data: {
          productId: lock.productId,
          lockedPrice: lock.lockedPrice,
          depositCredit: lock.deposit,
          effectivePrice: lock.lockedPrice - lock.deposit,
        },
      };
    } catch (err) {
      logError('priceLock.redeemPriceLock', err);
      return { success: false, error: 'Failed to redeem price lock' };
    }
  }
);

// ── Expire Stale Locks (Cron) ────────────────────────────────────────

/**
 * Expire all price locks past their expiration date.
 * Called by GC cron or dedicated cron.
 *
 * @returns {Promise<{expired: number}>}
 */
export const expireStale = webMethod(
  Permissions.Admin,
  async () => {
    let expired = 0;
    const now = new Date();

    for (let pass = 0; pass < 5; pass++) {
      const stale = await wixData.query(COLLECTION)
        .eq('status', 'active')
        .lt('expiresAt', now)
        .limit(100)
        .find({ suppressAuth: true });

      if (stale.items.length === 0) break;

      for (const lock of stale.items) {
        try {
          await wixData.update(COLLECTION, { ...lock, status: 'expired' }, { suppressAuth: true });
          expired++;
        } catch (err) {
          logError(`priceLock.expireStale[${lock._id}]`, err, { silent: true });
        }
      }

      if (stale.items.length < 100) break;
    }

    return { expired };
  }
);

// ── Exports for Testing ──────────────────────────────────────────────

export const _COLLECTION = COLLECTION;
export const _DEPOSIT_AMOUNT = DEPOSIT_AMOUNT;
export const _MAX_ACTIVE_LOCKS_PER_MEMBER = MAX_ACTIVE_LOCKS_PER_MEMBER;
export const _TIERS = TIERS;
