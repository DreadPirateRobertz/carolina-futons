/**
 * @module priceDropCron
 * @description 24-hour cron job that detects product price drops, queues
 * mobile push notifications, and emails price-alert subscribers.
 *
 * When a product price drops >=5% compared to the last recorded price in
 * ProductPriceHistory:
 *   1. A PriceDropQueue entry is inserted for mobile consumption.
 *   2. In-app loyalty notifications are sent to wishlisted members.
 *   3. Email notifications (CF-hwr1.3) are queued in EmailQueue for every
 *      active PriceAlerts subscriber — deduped per (email, productId) per
 *      24-hour window.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup CMS collections required:
 * 1. ProductPriceHistory — productId (text, indexed), price (number),
 *    recordedAt (dateTime)
 *    — One row per product, updated each cron run.
 *
 * 2. PriceDropQueue — productId (text, indexed), oldPrice (number),
 *    newPrice (number), pctDrop (number), detectedAt (dateTime)
 *    — Deduped per product per 24-hour window.
 *    — Mobile polls or queries this collection for push notifications.
 *
 * 3. PriceAlerts — productId (text, indexed), email (text, indexed),
 *    active (boolean, indexed), subscribedAt (dateTime)
 *    — Managed by priceAlertService.web.js.
 *
 * 4. EmailQueue — consumed by processEmailQueue cron (every 15 min).
 *    Template: 'price-drop-alert'. Variables: productName, oldPrice,
 *    newPrice, savings, savingsPct, pdpUrl.
 *
 * @cron Defined in jobs.config as detectPriceDrops (daily at 08:00 UTC).
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

const PRICE_HISTORY_COLLECTION = 'ProductPriceHistory';
const PRICE_DROP_QUEUE_COLLECTION = 'PriceDropQueue';
const PRODUCTS_COLLECTION = 'Stores/Products';
const WISHLIST_COLLECTION = 'Wishlist';
const NOTIFICATIONS_COLLECTION = 'Notifications';
const PRICE_ALERTS_COLLECTION = 'PriceAlerts';
const EMAIL_QUEUE_COLLECTION = 'EmailQueue';

/** Template ID used when queuing price-drop alert emails. */
const PRICE_DROP_EMAIL_TEMPLATE = 'price-drop-alert';

/** Minimum percent drop (as a fraction) to trigger a queue entry. */
const MIN_DROP_FRACTION = 0.05; // 5%

/** Dedup window: suppress duplicate queue entries within this many ms. */
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Main cron entrypoints ──────────────────────────────────────────────────

/**
 * Scan all published Wix store products for price drops vs the last recorded
 * price in ProductPriceHistory. On a >=5% drop:
 *   1. Insert a deduped entry to PriceDropQueue (for mobile consumption).
 *   2. Send an in-app loyalty notification to members who wishlisted the item.
 *
 * Called daily by the jobs scheduler (see jobs.config).
 *
 * @function detectPriceDrops
 * @returns {Promise<{success: boolean, productsScanned: number, dropsDetected: number, notificationsSent: number, emailsQueued: number}>}
 * @permission Admin
 */
export const detectPriceDrops = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const products = await fetchAllProducts();
      let dropsDetected = 0;
      let notificationsSent = 0;
      let emailsQueued = 0;

      for (const product of products) {
        const { productId, currentPrice, name, slug } = product;
        if (!productId || currentPrice == null || !isFinite(currentPrice) || currentPrice < 0) continue;

        const lastRecord = await getLastPriceRecord(productId);

        if (lastRecord) {
          const oldPrice = lastRecord.price;
          if (isFinite(oldPrice) && oldPrice > 0 && currentPrice < oldPrice) {
            const pctDrop = (oldPrice - currentPrice) / oldPrice;
            if (pctDrop >= MIN_DROP_FRACTION) {
              const queued = await enqueuePriceDrop(productId, oldPrice, currentPrice, pctDrop);
              if (queued) {
                dropsDetected++;
                notificationsSent += await notifyWishlistedMembers(productId, oldPrice, currentPrice, pctDrop);
                emailsQueued += await emailPriceAlertSubscribers(productId, name, slug, oldPrice, currentPrice, pctDrop);
              }
            }
          }
        }

        // Update (or create) the price history record for next run
        await upsertPriceRecord(productId, currentPrice, lastRecord);
      }

      return {
        success: true,
        productsScanned: products.length,
        dropsDetected,
        notificationsSent,
        emailsQueued,
      };
    } catch (err) {
      console.error('[priceDropCron] detectPriceDrops failed:', err?.message);
      return { success: false, productsScanned: 0, dropsDetected: 0, notificationsSent: 0, emailsQueued: 0 };
    }
  }
);

/**
 * Queue price drop notifications for wishlisted members of a specific product.
 * Called by detectPriceDrops internally; also exported for manual triggering.
 *
 * @function queuePriceDropNotifications
 * @param {string} productId
 * @param {number} oldPrice
 * @param {number} newPrice
 * @returns {Promise<{success: boolean, notificationsSent: number}>}
 * @permission Admin
 */
export const queuePriceDropNotifications = webMethod(
  Permissions.Admin,
  async (productId, oldPrice, newPrice) => {
    if (!productId || !isFinite(oldPrice) || !isFinite(newPrice) || oldPrice <= 0) {
      return { success: false, notificationsSent: 0 };
    }
    try {
      const pctDrop = (oldPrice - newPrice) / oldPrice;
      const sent = await notifyWishlistedMembers(productId, oldPrice, newPrice, pctDrop);
      return { success: true, notificationsSent: sent };
    } catch (err) {
      console.error('[priceDropCron] queuePriceDropNotifications failed:', err?.message);
      return { success: false, notificationsSent: 0 };
    }
  }
);

// ── PriceDropQueue helpers ────────────────────────────────────────────────

/**
 * Insert a PriceDropQueue entry if none exists for this product within the
 * dedup window. Returns true if a new entry was created.
 */
async function enqueuePriceDrop(productId, oldPrice, newPrice, pctDrop) {
  const windowStart = new Date(Date.now() - DEDUP_WINDOW_MS);

  const existing = await wixData
    .query(PRICE_DROP_QUEUE_COLLECTION)
    .eq('productId', productId)
    .ge('detectedAt', windowStart)
    .limit(1)
    .find({ suppressAuth: true });

  if (existing.items.length > 0) return false; // already queued in this window

  await wixData.insert(
    PRICE_DROP_QUEUE_COLLECTION,
    {
      productId,
      oldPrice,
      newPrice,
      pctDrop: Math.round(pctDrop * 100) / 100, // two decimal places
      detectedAt: new Date(),
    },
    { suppressAuth: true }
  );

  return true;
}

// ── ProductPriceHistory helpers ───────────────────────────────────────────

/**
 * Fetch the most recent price history record for a product.
 * Returns null if no record exists yet.
 */
async function getLastPriceRecord(productId) {
  const result = await wixData
    .query(PRICE_HISTORY_COLLECTION)
    .eq('productId', productId)
    .descending('recordedAt')
    .limit(1)
    .find({ suppressAuth: true });

  return result.items[0] ?? null;
}

/**
 * Create or update the ProductPriceHistory record for a product.
 * We always insert a new record (immutable history log).
 */
async function upsertPriceRecord(productId, price, _existing) {
  // Always insert a fresh snapshot — history is append-only.
  // The existing parameter is accepted for testability but not needed here.
  await wixData.insert(
    PRICE_HISTORY_COLLECTION,
    { productId, price, recordedAt: new Date() },
    { suppressAuth: true }
  );
}

// ── Product catalog helpers ───────────────────────────────────────────────

/**
 * Fetch all published Wix store products with price and id.
 * Returns array of { productId, currentPrice, name }.
 */
async function fetchAllProducts() {
  const results = [];
  let offset = 0;
  const limit = 100;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await wixData
      .query(PRODUCTS_COLLECTION)
      .limit(limit)
      .skip(offset)
      .find({ suppressAuth: true });

    for (const item of batch.items) {
      const price = item.price ?? item.discountedPrice ?? null;
      if (price != null) {
        results.push({ productId: item._id, currentPrice: Number(price), name: item.name || '', slug: item.slug || '' });
      }
    }

    if (batch.items.length < limit) break;
    offset += limit;
  }

  return results;
}

// ── Wishlist notification helpers ─────────────────────────────────────────

/**
 * Send in-app loyalty notifications to all members who wishlisted this product.
 * Returns the count of notifications sent.
 */
async function notifyWishlistedMembers(productId, oldPrice, newPrice, pctDrop) {
  const wishlistResult = await wixData
    .query(WISHLIST_COLLECTION)
    .eq('productId', productId)
    .limit(500)
    .find({ suppressAuth: true });

  if (wishlistResult.items.length === 0) return 0;

  const productName = wishlistResult.items[0]?.name || 'An item on your wishlist';
  const dropPct = Math.round(pctDrop * 100);
  const message = `Price drop! ${productName} is now $${newPrice.toFixed(2)} — ${dropPct}% off the price you saved.`;

  let sent = 0;
  for (const wishItem of wishlistResult.items) {
    if (!wishItem.memberId) continue;
    try {
      await wixData.insert(
        NOTIFICATIONS_COLLECTION,
        {
          memberId: wishItem.memberId,
          type: 'price_drop',
          message,
          productId,
          oldPrice,
          newPrice,
          pctDrop: dropPct,
          read: false,
          createdAt: new Date(),
        },
        { suppressAuth: true }
      );
      sent++;
    } catch (err) {
      console.error('[priceDropCron] Failed to notify member:', wishItem.memberId, err?.message);
    }
  }

  return sent;
}

// ── Price-alert email helpers (CF-hwr1.3) ─────────────────────────────────────

/**
 * Queue price-drop notification emails for all active PriceAlerts subscribers.
 * Deduped: skips any subscriber who already received an email for this product
 * within the last 24 hours (checked via EmailQueue.checkoutId = productId).
 *
 * @param {string} productId
 * @param {string} productName
 * @param {string} productSlug  — Used to build PDP URL; falls back to productId.
 * @param {number} oldPrice
 * @param {number} newPrice
 * @param {number} pctDrop      — Fraction (e.g. 0.12 = 12%)
 * @returns {Promise<number>}   — Count of emails queued this run.
 */
async function emailPriceAlertSubscribers(productId, productName, productSlug, oldPrice, newPrice, pctDrop) {
  const subResult = await wixData
    .query(PRICE_ALERTS_COLLECTION)
    .eq('productId', productId)
    .eq('active', true)
    .limit(500)
    .find({ suppressAuth: true });

  if (subResult.items.length === 0) return 0;

  const windowStart = new Date(Date.now() - DEDUP_WINDOW_MS);
  const savings = oldPrice - newPrice;
  const savingsPct = Math.round(pctDrop * 100);
  const pdpUrl = productSlug
    ? `/product-page/${productSlug}`
    : `/product-page/${productId}`;

  let queued = 0;

  for (const sub of subResult.items) {
    if (!sub.email) continue;

    // Dedup: skip if already queued for this (email, productId) within 24h
    const existing = await wixData
      .query(EMAIL_QUEUE_COLLECTION)
      .eq('sequenceType', 'price_drop_alert')
      .eq('recipientEmail', sub.email)
      .eq('checkoutId', productId)
      .ge('createdAt', windowStart)
      .limit(1)
      .find({ suppressAuth: true });

    if (existing.items.length > 0) continue;

    try {
      await wixData.insert(
        EMAIL_QUEUE_COLLECTION,
        {
          templateId:         PRICE_DROP_EMAIL_TEMPLATE,
          recipientEmail:     sub.email,
          recipientContactId: '',
          variables: {
            productName: productName || 'A product you saved',
            oldPrice:    oldPrice.toFixed(2),
            newPrice:    newPrice.toFixed(2),
            savings:     savings.toFixed(2),
            savingsPct:  String(savingsPct),
            pdpUrl,
          },
          sequenceType:  'price_drop_alert',
          sequenceStep:  1,
          checkoutId:    productId,   // reused as productId dedup key
          status:        'pending',
          scheduledFor:  new Date(),
          sentAt:        null,
          attempt:       0,
          lastError:     '',
          abVariant:     null,
          createdAt:     new Date(),
        },
        { suppressAuth: true }
      );
      queued++;
    } catch (err) {
      console.error('[priceDropCron] Failed to queue email for subscriber:', sub.email, err?.message);
    }
  }

  return queued;
}

// ── Test helpers ──────────────────────────────────────────────────────────

/** Exposed for unit tests only — not part of the public API. */
export const _MIN_DROP_FRACTION = MIN_DROP_FRACTION;
export const _DEDUP_WINDOW_MS = DEDUP_WINDOW_MS;
export const _PRICE_DROP_EMAIL_TEMPLATE = PRICE_DROP_EMAIL_TEMPLATE;
export { enqueuePriceDrop as _enqueuePriceDrop };
export { getLastPriceRecord as _getLastPriceRecord };
export { upsertPriceRecord as _upsertPriceRecord };
export { fetchAllProducts as _fetchAllProducts };
export { notifyWishlistedMembers as _notifyWishlistedMembers };
export { emailPriceAlertSubscribers as _emailPriceAlertSubscribers };
