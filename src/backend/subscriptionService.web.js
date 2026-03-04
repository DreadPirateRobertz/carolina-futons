/**
 * @module subscriptionService
 * @description Backend web module for subscription/auto-delivery management.
 * Supports bedding and accessory recurring deliveries with frequency management,
 * skip/pause controls, and tiered subscriber discounts.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * 1. Create CMS collection "Subscriptions" with fields:
 *    _id, memberId, productId, productName, frequency, quantity,
 *    nextShipDate, status, discount, createdDate, pausedAt,
 *    cancelledAt, cancellationReason, skippedDates
 * 2. Set collection permissions: Site Member read/write own items
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize, validateId } from 'backend/utils/sanitize';

const COLLECTION = 'Subscriptions';

const VALID_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'quarterly'];

const FREQUENCY_DAYS = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
};

const MAX_CONSECUTIVE_SKIPS = 3;
const MAX_QUANTITY = 10;
const BASE_DISCOUNT = 10;
const MULTI_DISCOUNT = 15;
const MULTI_THRESHOLD = 3;

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Get the current logged-in member or null.
 * @returns {Promise<Object|null>}
 */
async function getMember() {
  try {
    return await currentMember.getMember();
  } catch {
    return null;
  }
}

/**
 * Calculate next ship date from now based on frequency.
 * @param {string} frequency
 * @returns {string} ISO date string
 */
function calcNextShipDate(frequency) {
  const days = FREQUENCY_DAYS[frequency] || 30;
  const next = new Date(Date.now() + days * 86400000);
  return next.toISOString();
}

/**
 * Find a subscription by ID owned by the given member.
 * @param {string} subId
 * @param {string} memberId
 * @returns {Promise<Object|null>}
 */
async function findOwnedSub(subId, memberId) {
  const cleanId = validateId(subId);
  if (!cleanId) return null;
  const result = await wixData.query(COLLECTION)
    .eq('_id', cleanId)
    .eq('memberId', memberId)
    .find();
  return result.items.length > 0 ? result.items[0] : null;
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Get available subscription frequency options.
 *
 * @function getSubscriptionPlans
 * @returns {Promise<Array>} Frequency options with label, intervalDays, discount
 * @permission Anyone — public info for product pages
 */
export const getSubscriptionPlans = webMethod(
  Permissions.Anyone,
  async () => {
    return [
      { frequency: 'weekly', label: 'Every Week', intervalDays: 7, discount: BASE_DISCOUNT },
      { frequency: 'biweekly', label: 'Every 2 Weeks', intervalDays: 14, discount: BASE_DISCOUNT },
      { frequency: 'monthly', label: 'Every Month', intervalDays: 30, discount: BASE_DISCOUNT },
      { frequency: 'quarterly', label: 'Every 3 Months', intervalDays: 90, discount: BASE_DISCOUNT },
    ];
  }
);

/**
 * Create a new subscription for the current member.
 *
 * @function createSubscription
 * @param {Object} options
 * @param {string} options.productId - Product to subscribe to
 * @param {string} options.productName - Display name of the product
 * @param {string} options.frequency - Delivery frequency (weekly|biweekly|monthly|quarterly)
 * @param {number} [options.quantity=1] - Quantity per delivery (max 10)
 * @returns {Promise<Object>} { success, subscription?, message? }
 * @permission SiteMember
 */
export const createSubscription = webMethod(
  Permissions.SiteMember,
  async (options = {}) => {
    try {
      const member = await getMember();
      if (!member) {
        return { success: false, message: 'Must be logged in to subscribe' };
      }

      const { productId, productName, frequency } = options;
      let { quantity } = options;

      // Validate productId
      const cleanProductId = validateId(productId);
      if (!cleanProductId) {
        return { success: false, message: 'Product ID is required and must be valid' };
      }

      // Validate frequency
      if (!frequency || !VALID_FREQUENCIES.includes(frequency)) {
        return { success: false, message: 'Valid frequency is required (weekly, biweekly, monthly, quarterly)' };
      }

      // Validate and cap quantity
      if (quantity === undefined || quantity === null) {
        quantity = 1;
      }
      quantity = Number(quantity);
      if (!Number.isFinite(quantity) || quantity < 1) {
        return { success: false, message: 'Valid quantity is required (minimum 1)' };
      }
      quantity = Math.min(Math.floor(quantity), MAX_QUANTITY);

      // Sanitize product name
      const cleanName = sanitize(productName || '', 200);

      // Check for duplicate active subscription
      const existing = await wixData.query(COLLECTION)
        .eq('memberId', member._id)
        .eq('productId', cleanProductId)
        .eq('status', 'active')
        .find();
      if (existing.items.length > 0) {
        return { success: false, message: 'You already have an active subscription for this product' };
      }

      // Also check paused (still counts as active)
      const paused = await wixData.query(COLLECTION)
        .eq('memberId', member._id)
        .eq('productId', cleanProductId)
        .eq('status', 'paused')
        .find();
      if (paused.items.length > 0) {
        return { success: false, message: 'You already have a paused subscription for this product' };
      }

      const subscription = await wixData.insert(COLLECTION, {
        memberId: member._id,
        productId: cleanProductId,
        productName: cleanName,
        frequency,
        quantity,
        nextShipDate: calcNextShipDate(frequency),
        status: 'active',
        discount: BASE_DISCOUNT,
        createdDate: new Date().toISOString(),
        pausedAt: null,
        cancelledAt: null,
        cancellationReason: null,
        skippedDates: [],
      });

      return { success: true, subscription };
    } catch (err) {
      console.error('Error creating subscription:', err);
      return { success: false, message: 'Failed to create subscription' };
    }
  }
);

/**
 * Get all subscriptions for the current member.
 *
 * @function getMySubscriptions
 * @returns {Promise<Object>} { success, subscriptions[] }
 * @permission SiteMember
 */
export const getMySubscriptions = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await getMember();
      if (!member) {
        return { success: false, message: 'Must be logged in', subscriptions: [] };
      }

      const result = await wixData.query(COLLECTION)
        .eq('memberId', member._id)
        .descending('createdDate')
        .find();

      return { success: true, subscriptions: result.items };
    } catch (err) {
      console.error('Error getting subscriptions:', err);
      return { success: false, message: 'Failed to load subscriptions', subscriptions: [] };
    }
  }
);

/**
 * Get details for a specific subscription.
 *
 * @function getSubscriptionDetails
 * @param {string} subscriptionId
 * @returns {Promise<Object>} { success, subscription?, message? }
 * @permission SiteMember — only own subscriptions
 */
export const getSubscriptionDetails = webMethod(
  Permissions.SiteMember,
  async (subscriptionId) => {
    try {
      const member = await getMember();
      if (!member) {
        return { success: false, message: 'Must be logged in' };
      }

      const sub = await findOwnedSub(subscriptionId, member._id);
      if (!sub) {
        return { success: false, message: 'Subscription not found' };
      }

      return { success: true, subscription: sub };
    } catch (err) {
      console.error('Error getting subscription details:', err);
      return { success: false, message: 'Failed to load subscription' };
    }
  }
);

/**
 * Update delivery frequency for a subscription.
 *
 * @function updateFrequency
 * @param {string} subscriptionId
 * @param {string} newFrequency - New frequency value
 * @returns {Promise<Object>} { success, subscription?, message? }
 * @permission SiteMember
 */
export const updateFrequency = webMethod(
  Permissions.SiteMember,
  async (subscriptionId, newFrequency) => {
    try {
      const member = await getMember();
      if (!member) {
        return { success: false, message: 'Must be logged in' };
      }

      if (!newFrequency || !VALID_FREQUENCIES.includes(newFrequency)) {
        return { success: false, message: 'Valid frequency is required (weekly, biweekly, monthly, quarterly)' };
      }

      const sub = await findOwnedSub(subscriptionId, member._id);
      if (!sub) {
        return { success: false, message: 'Subscription not found' };
      }

      if (sub.status === 'cancelled') {
        return { success: false, message: 'Cannot update a cancelled subscription' };
      }

      sub.frequency = newFrequency;
      sub.nextShipDate = calcNextShipDate(newFrequency);
      const updated = await wixData.update(COLLECTION, sub);

      return { success: true, subscription: updated };
    } catch (err) {
      console.error('Error updating frequency:', err);
      return { success: false, message: 'Failed to update frequency' };
    }
  }
);

/**
 * Pause an active subscription.
 *
 * @function pauseSubscription
 * @param {string} subscriptionId
 * @returns {Promise<Object>} { success, subscription?, message? }
 * @permission SiteMember
 */
export const pauseSubscription = webMethod(
  Permissions.SiteMember,
  async (subscriptionId) => {
    try {
      const member = await getMember();
      if (!member) {
        return { success: false, message: 'Must be logged in' };
      }

      const sub = await findOwnedSub(subscriptionId, member._id);
      if (!sub) {
        return { success: false, message: 'Subscription not found' };
      }

      if (sub.status === 'paused') {
        return { success: false, message: 'Subscription is already paused' };
      }
      if (sub.status === 'cancelled') {
        return { success: false, message: 'Cannot pause a cancelled subscription' };
      }

      sub.status = 'paused';
      sub.pausedAt = new Date().toISOString();
      const updated = await wixData.update(COLLECTION, sub);

      return { success: true, subscription: updated };
    } catch (err) {
      console.error('Error pausing subscription:', err);
      return { success: false, message: 'Failed to pause subscription' };
    }
  }
);

/**
 * Resume a paused subscription.
 *
 * @function resumeSubscription
 * @param {string} subscriptionId
 * @returns {Promise<Object>} { success, subscription?, message? }
 * @permission SiteMember
 */
export const resumeSubscription = webMethod(
  Permissions.SiteMember,
  async (subscriptionId) => {
    try {
      const member = await getMember();
      if (!member) {
        return { success: false, message: 'Must be logged in' };
      }

      const sub = await findOwnedSub(subscriptionId, member._id);
      if (!sub) {
        return { success: false, message: 'Subscription not found' };
      }

      if (sub.status !== 'paused') {
        return { success: false, message: 'Subscription is not paused' };
      }

      sub.status = 'active';
      sub.pausedAt = null;
      sub.nextShipDate = calcNextShipDate(sub.frequency);
      const updated = await wixData.update(COLLECTION, sub);

      return { success: true, subscription: updated };
    } catch (err) {
      console.error('Error resuming subscription:', err);
      return { success: false, message: 'Failed to resume subscription' };
    }
  }
);

/**
 * Skip the next scheduled delivery.
 *
 * @function skipNextDelivery
 * @param {string} subscriptionId
 * @returns {Promise<Object>} { success, subscription?, message? }
 * @permission SiteMember
 */
export const skipNextDelivery = webMethod(
  Permissions.SiteMember,
  async (subscriptionId) => {
    try {
      const member = await getMember();
      if (!member) {
        return { success: false, message: 'Must be logged in' };
      }

      const sub = await findOwnedSub(subscriptionId, member._id);
      if (!sub) {
        return { success: false, message: 'Subscription not found' };
      }

      if (sub.status !== 'active') {
        return { success: false, message: 'Can only skip deliveries on active subscriptions' };
      }

      const skipped = sub.skippedDates || [];
      if (skipped.length >= MAX_CONSECUTIVE_SKIPS) {
        return { success: false, message: `Cannot skip more than ${MAX_CONSECUTIVE_SKIPS} consecutive deliveries. Consider pausing instead.` };
      }

      // Record the skipped date and advance to next
      skipped.push(sub.nextShipDate);
      sub.skippedDates = skipped;
      sub.nextShipDate = calcNextShipDate(sub.frequency);
      const updated = await wixData.update(COLLECTION, sub);

      return { success: true, subscription: updated };
    } catch (err) {
      console.error('Error skipping delivery:', err);
      return { success: false, message: 'Failed to skip delivery' };
    }
  }
);

/**
 * Cancel a subscription.
 *
 * @function cancelSubscription
 * @param {string} subscriptionId
 * @param {string} [reason] - Optional cancellation reason
 * @returns {Promise<Object>} { success, subscription?, message? }
 * @permission SiteMember
 */
export const cancelSubscription = webMethod(
  Permissions.SiteMember,
  async (subscriptionId, reason) => {
    try {
      const member = await getMember();
      if (!member) {
        return { success: false, message: 'Must be logged in' };
      }

      const sub = await findOwnedSub(subscriptionId, member._id);
      if (!sub) {
        return { success: false, message: 'Subscription not found' };
      }

      if (sub.status === 'cancelled') {
        return { success: false, message: 'Subscription is already cancelled' };
      }

      sub.status = 'cancelled';
      sub.cancelledAt = new Date().toISOString();
      sub.cancellationReason = reason ? sanitize(reason, 500) : null;
      const updated = await wixData.update(COLLECTION, sub);

      return { success: true, subscription: updated };
    } catch (err) {
      console.error('Error cancelling subscription:', err);
      return { success: false, message: 'Failed to cancel subscription' };
    }
  }
);

/**
 * Get subscriber discount for the current member.
 * 10% for 1-2 active subscriptions, 15% for 3+.
 *
 * @function getSubscriberDiscount
 * @returns {Promise<Object>} { success, discount, activeCount }
 * @permission SiteMember
 */
export const getSubscriberDiscount = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await getMember();
      if (!member) {
        return { success: false, message: 'Must be logged in', discount: 0, activeCount: 0 };
      }

      const result = await wixData.query(COLLECTION)
        .eq('memberId', member._id)
        .eq('status', 'active')
        .find();

      const activeCount = result.items.length;
      let discount = 0;
      if (activeCount >= MULTI_THRESHOLD) {
        discount = MULTI_DISCOUNT;
      } else if (activeCount > 0) {
        discount = BASE_DISCOUNT;
      }

      return { success: true, discount, activeCount };
    } catch (err) {
      console.error('Error getting subscriber discount:', err);
      return { success: false, message: 'Failed to get discount', discount: 0, activeCount: 0 };
    }
  }
);
