/**
 * @module notificationService
 * @description Backend service for wishlist price drop alerts and back-in-stock
 * notifications. Runs daily via scheduled HTTP endpoint to detect price changes
 * and inventory restocks, then notifies opted-in members via triggered email.
 *
 * @requires wix-web-module
 * @requires wix-crm-backend - Wix Triggered Emails API
 * @requires wix-secrets-backend - SITE_OWNER_CONTACT_ID
 * @requires wix-data
 *
 * @setup
 * 1. Create CMS collection `PriceHistory` with fields:
 *    productId (Text), price (Number), comparePrice (Number),
 *    inStock (Boolean), recordedAt (Date)
 * 2. Create CMS collection `NotificationLog` with fields:
 *    memberId (Text), productId (Text), productName (Text),
 *    alertType (Text: 'price_drop'|'back_in_stock'), previousPrice (Number),
 *    currentPrice (Number), sentAt (Date)
 * 3. Create triggered email templates in Wix Dashboard:
 *    - `price_drop_alert`: variables: productName, previousPrice, currentPrice,
 *      savings, productUrl, productImage
 *    - `back_in_stock_alert`: variables: productName, productUrl, productImage
 * 4. Schedule daily call to /_functions/checkWishlistAlerts (e.g. via cron or
 *    Wix Automations webhook trigger)
 */
import { Permissions, webMethod } from 'wix-web-module';
import { triggeredEmails } from 'wix-crm-backend';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';
import { sanitize, validateId } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';
import { getTodayET, computeStreakDanger } from 'backend/utils/dateUtils';
import { getGamePrefsForMember } from 'backend/memberGamePreferences.web';

const PRICE_DROP_THRESHOLD = 0.10; // 10% minimum drop to trigger alert
const NOTIFICATION_COOLDOWN_DAYS = 7; // Don't re-notify same product within 7 days
const BATCH_SIZE = 50; // Process products in batches

/**
 * Record current prices and stock status for all products.
 * Called by the scheduled HTTP endpoint.
 *
 * @returns {Promise<{recorded: number}>} Count of price snapshots recorded.
 */
export const recordPriceSnapshots = webMethod(
  Permissions.Admin,
  async () => {
    try {
      let recorded = 0;
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const products = await wixData.query('Stores/Products')
          .limit(BATCH_SIZE)
          .skip(skip)
          .find();

        if (products.items.length === 0) {
          hasMore = false;
          break;
        }

        for (const product of products.items) {
          await wixData.insert('PriceHistory', {
            productId: product._id,
            price: product.price || 0,
            comparePrice: product.discountedPrice != null ? product.discountedPrice : (product.price || 0),
            inStock: product.inStock !== false,
            recordedAt: new Date(),
          });
          recorded++;
        }

        skip += BATCH_SIZE;
        hasMore = products.items.length === BATCH_SIZE;
      }

      return { recorded };
    } catch (err) {
      console.error('[notificationService] Error recording price snapshots:', err);
      return { recorded: 0, error: 'Failed to record price snapshots' };
    }
  }
);

/**
 * Check for price drops and back-in-stock events, then notify opted-in
 * wishlist members. Core scheduled job.
 *
 * Flow:
 * 1. Get all current products
 * 2. Compare against most recent PriceHistory for each
 * 3. For price drops >= threshold: find wishlist members, check prefs, send email
 * 4. For back-in-stock: find wishlist members, check prefs, send email
 *
 * @returns {Promise<{priceDropAlerts: number, backInStockAlerts: number}>}
 */
export const checkWishlistAlerts = webMethod(
  Permissions.Admin,
  async () => {
    try {
      let priceDropAlerts = 0;
      let backInStockAlerts = 0;
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const products = await wixData.query('Stores/Products')
          .limit(BATCH_SIZE)
          .skip(skip)
          .find();

        if (products.items.length === 0) break;

        for (const product of products.items) {
          // Get last recorded price for this product
          const history = await wixData.query('PriceHistory')
            .eq('productId', product._id)
            .descending('recordedAt')
            .limit(1)
            .skip(1) // Skip the one we just recorded, get the previous
            .find();

          if (history.items.length === 0) continue;

          const previous = history.items[0];
          const currentPrice = product.price || 0;
          const previousPrice = previous.price || 0;
          const wasOutOfStock = !previous.inStock;
          const isNowInStock = product.inStock !== false;

          // Check price drop
          if (previousPrice > 0 && currentPrice < previousPrice) {
            const dropPercent = (previousPrice - currentPrice) / previousPrice;
            if (dropPercent >= PRICE_DROP_THRESHOLD) {
              const sent = await notifyWishlistMembers(product, 'price_drop', {
                previousPrice,
                currentPrice,
                savings: (previousPrice - currentPrice).toFixed(2),
              });
              priceDropAlerts += sent;
            }
          }

          // Check back-in-stock
          if (wasOutOfStock && isNowInStock) {
            const sent = await notifyWishlistMembers(product, 'back_in_stock', {});
            backInStockAlerts += sent;
          }
        }

        skip += BATCH_SIZE;
        hasMore = products.items.length === BATCH_SIZE;
      }

      return { priceDropAlerts, backInStockAlerts };
    } catch (err) {
      console.error('[notificationService] Error checking wishlist alerts:', err);
      return { priceDropAlerts: 0, backInStockAlerts: 0, error: 'Failed to check alerts' };
    }
  }
);

/**
 * Find all wishlist members for a product and send the appropriate alert.
 * Respects notification preferences and cooldown window.
 *
 * @param {Object} product - Wix product object.
 * @param {string} alertType - 'price_drop' or 'back_in_stock'.
 * @param {Object} alertData - Additional data (previousPrice, currentPrice, savings).
 * @returns {Promise<number>} Number of notifications sent.
 */
async function notifyWishlistMembers(product, alertType, alertData) {
  let sent = 0;

  try {
    // Find all members who wishlisted this product
    const wishlistEntries = await wixData.query('Wishlist')
      .eq('productId', product._id)
      .limit(200)
      .find();

    if (wishlistEntries.items.length === 0) return 0;

    const prefKey = alertType === 'price_drop' ? 'saleAlerts' : 'backInStock';
    const cooldownDate = new Date(Date.now() - NOTIFICATION_COOLDOWN_DAYS * 86400000);

    for (const entry of wishlistEntries.items) {
      try {
        const memberId = entry.memberId;
        if (!memberId) continue;

        // Check member preferences
        const prefs = await wixData.query('MemberPreferences')
          .eq('memberId', memberId)
          .find();

        const memberPrefs = prefs.items?.[0] || {};
        if (memberPrefs[prefKey] === false) continue;

        // Check per-product opt-out
        if (entry.muteAlerts === true) continue;

        // Check cooldown — don't re-notify same member+product+type within window
        const recentNotif = await wixData.query('NotificationLog')
          .eq('memberId', memberId)
          .eq('productId', product._id)
          .eq('alertType', alertType)
          .ge('sentAt', cooldownDate)
          .find();

        if (recentNotif.items.length > 0) continue;

        // Send the notification
        const success = await sendAlert(memberId, product, alertType, alertData);
        if (success) {
          // Log the notification
          await wixData.insert('NotificationLog', {
            memberId,
            productId: product._id,
            productName: product.name || '',
            alertType,
            previousPrice: alertData.previousPrice || 0,
            currentPrice: alertData.currentPrice || product.price || 0,
            sentAt: new Date(),
          });
          sent++;
        }
      } catch (memberErr) {
        console.error(`[notificationService] Error notifying member ${entry.memberId}:`, memberErr);
      }
    }
  } catch (err) {
    console.error('[notificationService] Error in notifyWishlistMembers:', err);
  }

  return sent;
}

/**
 * Send a triggered email alert to a member.
 *
 * @param {string} memberId - Wix member ID.
 * @param {Object} product - Wix product object.
 * @param {string} alertType - 'price_drop' or 'back_in_stock'.
 * @param {Object} alertData - Alert-specific data.
 * @returns {Promise<boolean>} True if sent successfully.
 */
async function sendAlert(memberId, product, alertType, alertData) {
  try {
    // Get member's contact ID for triggered emails
    const memberData = await wixData.query('Members/PrivateMembersData')
      .eq('_id', memberId)
      .find();

    const contactId = memberData.items?.[0]?.contactId;
    if (!contactId) return false;

    const SITE_URL = 'https://www.carolinafutons.com';
    const productUrl = `${SITE_URL}/product-page/${product.slug}`;
    const productImage = product.mainMedia || '';

    if (alertType === 'price_drop') {
      await triggeredEmails.emailContact(
        'price_drop_alert',
        contactId,
        {
          variables: {
            productName: product.name || '',
            previousPrice: `$${Number(alertData.previousPrice).toFixed(2)}`,
            currentPrice: `$${Number(alertData.currentPrice).toFixed(2)}`,
            savings: `$${alertData.savings}`,
            productUrl,
            productImage,
          },
        }
      );
    } else if (alertType === 'back_in_stock') {
      await triggeredEmails.emailContact(
        'back_in_stock_alert',
        contactId,
        {
          variables: {
            productName: product.name || '',
            productUrl,
            productImage,
          },
        }
      );
    }

    return true;
  } catch (err) {
    console.error(`[notificationService] Error sending ${alertType} alert:`, err);
    return false;
  }
}

/**
 * Toggle per-product notification mute on a wishlist item.
 * Allows members to silence alerts for specific products without
 * changing their global notification preferences.
 *
 * @param {string} wishlistItemId - The Wishlist CMS record ID.
 * @param {boolean} muted - True to mute, false to unmute.
 * @returns {Promise<{success: boolean}>}
 */
export const toggleProductAlerts = webMethod(
  Permissions.SiteMember,
  async (wishlistItemId, muted) => {
    try {
      const cleanId = validateId(wishlistItemId);
      if (!cleanId) return { success: false };

      const { currentMember } = await import('wix-members-backend');
      const member = await currentMember.getMember();
      if (!member?._id) return { success: false };

      const item = await wixData.get('Wishlist', cleanId);
      if (!item || item.memberId !== member._id) return { success: false };

      item.muteAlerts = !!muted;
      await wixData.update('Wishlist', item);

      return { success: true };
    } catch (err) {
      console.error('[notificationService] Error toggling product alerts:', err);
      return { success: false };
    }
  }
);

/**
 * Send an operational alert to the site owner via triggered email, falling back to
 * console.error if the SITE_OWNER_CONTACT_ID secret is absent or email delivery fails.
 * Always returns success: true — the alert is guaranteed to surface in Wix logs.
 * Used by cron jobs and backend services to surface critical failures.
 *
 * @param {string} subject - Short alert subject (e.g. 'catalog sync failed')
 * @param {string} message - Detailed message body
 * @returns {Promise<{success: boolean, method: 'triggered_email'|'console'}>}
 */
export const notifyOwner = webMethod(
  Permissions.Admin,
  async (subject, message) => {
    const safeSubject = sanitize(String(subject || ''), 200);
    const safeMessage = sanitize(String(message || ''), 2000);

    try {
      const ownerId = await getSecret('SITE_OWNER_CONTACT_ID');
      if (!ownerId) {
        console.warn('[notificationService] notifyOwner: SITE_OWNER_CONTACT_ID secret not set — falling back to console');
      } else {
        await triggeredEmails.emailContact('owner_alert', ownerId, {
          variables: { subject: safeSubject, message: safeMessage },
        });
        return { success: true, method: 'triggered_email' };
      }
    } catch (emailErr) {
      // Fall through to console fallback if email delivery fails
      console.warn('[notificationService] notifyOwner email failed, falling back to console:', emailErr?.message);
    }

    // Console fallback — ensures the alert surfaces in Wix logs even without email config
    console.error(`[notificationService] OWNER ALERT — ${safeSubject}: ${safeMessage}`);
    return { success: true, method: 'console' };
  }
);

/**
 * Get notification history for the current member's wishlist.
 * Used on Member Page to show recent alerts sent.
 *
 * @param {number} [limit=10] - Max results.
 * @returns {Promise<{items: Array, success: boolean}>}
 */
export const getNotificationHistory = webMethod(
  Permissions.SiteMember,
  async (limit = 10) => {
    try {
      const { currentMember } = await import('wix-members-backend');
      const member = await currentMember.getMember();
      if (!member?._id) return { items: [], success: false };

      const result = await wixData.query('NotificationLog')
        .eq('memberId', member._id)
        .descending('sentAt')
        .limit(Math.min(limit, 50))
        .find();

      return { items: result.items, success: true };
    } catch (err) {
      logError('[notificationService] Error getting notification history', err);
      return { items: [], success: false };
    }
  }
);

// ── Gamification push triggers ────────────────────────────────────────────────

const NOTIFICATIONS_COLLECTION = 'Notifications';
const GET_MY_NOTIFICATIONS_RATE_LIMIT = 20;
const GET_MY_NOTIFICATIONS_WINDOW_MS = 60_000;

/** In-memory rate limit store: memberId → { count, windowStart } */
const _getMyNotificationsRateLimit = new Map();

/** @internal — exposed for test reset only */
export function _resetGetMyNotificationsRateLimit() {
  _getMyNotificationsRateLimit.clear();
}

/**
 * Write a gamification push notification to the Notifications CMS collection.
 * Idempotent for streak_milestone (deduplicates on memberId + milestone) and
 * streak_danger (deduplicates on memberId + dangerDate).
 * Quest complete and challenge_reminder notifications are not deduplicated.
 *
 * @param {string} memberId
 * @param {'streak_milestone'|'daily_quest'|'challenge_reminder'|'streak_danger'} type
 * @param {string} message
 * @param {Object} [extra] - extra fields (e.g. { milestone, dangerDate, deepLink })
 * @returns {Promise<void>} Best-effort: logs on insert failure rather than throwing.
 */
async function writeNotification(memberId, type, message, extra = {}) {
  if (!memberId) return;

  try {
    if (type === 'streak_milestone' && extra.milestone != null) {
      const existing = await wixData
        .query(NOTIFICATIONS_COLLECTION)
        .eq('memberId', memberId)
        .eq('type', 'streak_milestone')
        .eq('milestone', extra.milestone)
        .limit(1)
        .find({ suppressAuth: true });
      if (existing.items.length > 0) return;
    } else if (type === 'streak_danger' && extra.dangerDate) {
      const existing = await wixData
        .query(NOTIFICATIONS_COLLECTION)
        .eq('memberId', memberId)
        .eq('type', 'streak_danger')
        .eq('dangerDate', extra.dangerDate)
        .limit(1)
        .find({ suppressAuth: true });
      if (existing.items.length > 0) return;
    }

    await wixData.insert(NOTIFICATIONS_COLLECTION, {
      memberId,
      type,
      message,
      read: false,
      createdAt: new Date(),
      ...extra,
    }, { suppressAuth: true });
  } catch (err) {
    logError('[notificationService] writeNotification failed', err);
  }
}

/**
 * Send a streak milestone push notification.
 * Idempotent: skips if this member already has a notification for this milestone.
 *
 * @param {string} memberId
 * @param {number} milestone - streak length (e.g. 7, 14, 30)
 * @param {string} badgeLabel - badge name (e.g. 'Week Warrior')
 * @returns {Promise<void>}
 */
export async function sendStreakMilestoneNotification(memberId, milestone, badgeLabel) {
  const message = `You earned the ${badgeLabel} badge! 🔥 ${milestone}-day streak!`;
  await writeNotification(memberId, 'streak_milestone', message, { milestone });
}

/**
 * Send a daily quest completion push notification.
 *
 * @param {string} memberId
 * @param {string} questTitle
 * @param {number} points
 * @returns {Promise<void>}
 */
export async function sendQuestCompleteNotification(memberId, questTitle, points) {
  const message = `Daily quest complete: ${questTitle}. +${points} pts! ✅`;
  await writeNotification(memberId, 'daily_quest', message, { questTitle, points });
}

/**
 * Send a streak danger push notification.
 * Fires when the member has not been active today and fewer than 4 hours remain
 * until the ET calendar-day cutoff. Idempotent per ET date: skips if a
 * streak_danger record already exists for this member on today's ET date.
 *
 * @param {string} memberId
 * @param {string|null|undefined} lastActivityDate - "YYYY-MM-DD" ET from MemberPoints
 * @returns {Promise<void>}
 */
export async function sendStreakDangerNotification(memberId, lastActivityDate) {
  if (!memberId || !validateId(memberId)) return;
  let todayET;
  try {
    todayET = getTodayET();
    if (!computeStreakDanger(lastActivityDate, todayET)) return;
  } catch (err) {
    logError('[notificationService] sendStreakDangerNotification date computation failed', err);
    return;
  }
  const message = '⚠️ Your streak is at risk! Complete a qualifying action before midnight ET to keep it alive.';
  await writeNotification(memberId, 'streak_danger', message, {
    dangerDate: todayET,
    deepLink: '/loyalty?tab=streak',
  });
}

/**
 * Send a challenge reminder notification, gated by member gamification preferences.
 * Skipped when notificationsEnabled is false or challengeReminders is 'never'.
 * Enforces cadence: daily reminders require >= 20h since last; weekly require >= 6 days.
 * On cadence-check failure, fails open (sends the reminder) to avoid silent drops.
 *
 * @param {string} memberId
 * @param {string} message
 * @returns {Promise<void>}
 */
export async function sendChallengeReminder(memberId, message) {
  if (!memberId) return;
  const prefs = await getGamePrefsForMember(memberId);
  if (!prefs.notificationsEnabled || prefs.challengeReminders === 'never') return;

  const minGapMs = prefs.challengeReminders === 'weekly'
    ? 6 * 24 * 3600 * 1000   // 6 days
    : 20 * 3600 * 1000;       // 20 hours (daily, with slack)

  try {
    const lastRes = await wixData
      .query(NOTIFICATIONS_COLLECTION)
      .eq('memberId', memberId)
      .eq('type', 'challenge_reminder')
      .descending('createdAt')
      .limit(1)
      .find({ suppressAuth: true });
    if (lastRes.items.length > 0 && lastRes.items[0].createdAt) {
      const lastSentMs = new Date(lastRes.items[0].createdAt).getTime();
      if (Date.now() - lastSentMs < minGapMs) return;
      // Note: if createdAt is missing on an old record, lastSentMs=NaN → comparison
      // evaluates false → fail open (sends reminder). This is the desired behavior.
    }
  } catch (err) {
    logError('[notificationService] sendChallengeReminder cadence check failed', err);
    // fail open — send the reminder rather than silently drop it
  }

  try {
    await writeNotification(memberId, 'challenge_reminder', message);
  } catch (err) {
    logError('[notificationService] sendChallengeReminder writeNotification failed', err);
  }
}

/**
 * Get the authenticated member's gamification notifications.
 * Supports optional unreadOnly filter and limit (capped at 50).
 * Rate-limited to 20 calls per minute per member.
 *
 * @function getMyNotifications
 * @param {{ limit?: number, unreadOnly?: boolean }} options
 * @returns {Promise<{ notifications: Array } | { status: 401|429, error: string }>}
 * @permission SiteMember
 */
export const getMyNotifications = webMethod(
  Permissions.SiteMember,
  async ({ limit = 20, unreadOnly = false } = {}) => {
    let member;
    try {
      const { currentMember } = await import('wix-members-backend');
      member = await currentMember.getMember();
    } catch {
      return { status: 401, error: 'Unauthenticated' };
    }
    if (!member?._id) return { status: 401, error: 'Unauthenticated' };
    const memberId = member._id;

    const now = Date.now();
    const rl = _getMyNotificationsRateLimit.get(memberId) || { count: 0, windowStart: now };
    if (now - rl.windowStart > GET_MY_NOTIFICATIONS_WINDOW_MS) {
      rl.count = 0;
      rl.windowStart = now;
    }
    rl.count += 1;
    _getMyNotificationsRateLimit.set(memberId, rl);
    if (rl.count > GET_MY_NOTIFICATIONS_RATE_LIMIT) {
      return { status: 429, error: 'Rate limit exceeded' };
    }

    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 50);

    let query = wixData
      .query(NOTIFICATIONS_COLLECTION)
      .eq('memberId', memberId)
      .descending('createdAt');

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const res = await query.limit(safeLimit).find({ suppressAuth: true });

    const notifications = res.items.map(item => ({
      id: item._id,
      type: item.type,
      message: item.message,
      read: item.read,
      createdAt: item.createdAt,
    }));

    return { notifications };
  }
);
