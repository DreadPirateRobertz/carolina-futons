/**
 * @module wishlistAlerts
 * @description Wishlist price drop alerts and back-in-stock notifications.
 * Tracks daily price snapshots, detects >=10% drops from 30-day high,
 * monitors inventory for back-in-stock events, and sends batch notifications.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * 1. Create `PriceHistory` CMS collection:
 *    productId (text), price (number), date (date)
 *
 * 2. Create `WishlistAlertsSent` CMS collection:
 *    memberId (text), productId (text), alertType (text: price_drop|back_in_stock),
 *    sentAt (dateTime), price (number)
 *
 * 3. Create `WishlistAlertPrefs` CMS collection:
 *    memberId (text), productId (text), priceDrops (boolean), backInStock (boolean)
 *
 * 4. Existing `Wishlist` collection must have: memberId, productId, name, price, inStock
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { triggeredEmails } from 'wix-crm-backend';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

const PRICE_DROP_THRESHOLD = 0.10; // 10%
const PRICE_DROP_LOOKBACK_DAYS = 30;
const ALERT_COOLDOWN_DAYS = 7;
const LOW_STOCK_THRESHOLD = 5; // default units

// ── Price History ───────────────────────────────────────────────────

/**
 * Record a daily price snapshot for a product.
 *
 * @param {string} productId
 * @param {number} price
 * @returns {Promise<{success: boolean}>}
 */
export const recordPriceSnapshot = webMethod(
  Permissions.Admin,
  async (productId, price) => {
    try {
      if (!productId) return { success: false };
      const cleanId = sanitize(productId, 50);
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) return { success: false };

      // Dedup: skip if snapshot already recorded today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const existing = await wixData.query('PriceHistory')
        .eq('productId', cleanId)
        .ge('date', today)
        .lt('date', tomorrow)
        .find();

      if (existing.items.length > 0) return { success: true };

      await wixData.insert('PriceHistory', {
        productId: cleanId,
        price: numPrice,
        date: new Date(),
      });

      return { success: true };
    } catch (err) {
      console.error('Error recording price snapshot:', err);
      return { success: false };
    }
  }
);

/**
 * Get price history for a product.
 *
 * @param {string} productId
 * @param {number} [days=30]
 * @returns {Promise<{prices: Array<{price: number, date: Date}>}>}
 */
export const getPriceHistory = webMethod(
  Permissions.Anyone,
  async (productId, days = 30) => {
    try {
      if (!productId) return { prices: [] };

      const safeDays = Math.min(365, Math.max(1, Math.round(Number(days) || 30)));
      const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);
      const result = await wixData.query('PriceHistory')
        .eq('productId', sanitize(productId, 50))
        .ge('date', since)
        .ascending('date')
        .limit(365)
        .find();

      return {
        prices: result.items.map(i => ({ price: i.price, date: i.date })),
      };
    } catch (err) {
      console.error('Error fetching price history:', err);
      return { prices: [] };
    }
  }
);

// ── Price Drop Detection ────────────────────────────────────────────

/**
 * Check all wishlisted products for price drops >=10% from 30-day high.
 * Sends notifications to members who have the item wishlisted.
 * Respects 7-day cooldown window per product per member.
 *
 * @returns {Promise<{success: boolean, alertsSent: number, productsChecked: number}>}
 */
export const checkPriceDrops = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const since = new Date(Date.now() - PRICE_DROP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
      const cooldownSince = new Date(Date.now() - ALERT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

      // Get all price history in lookback window
      const historyResult = await wixData.query('PriceHistory')
        .ge('date', since)
        .find();

      // Group by productId, find 30-day high and current price
      const productPrices = {};
      for (const item of historyResult.items) {
        if (!productPrices[item.productId]) {
          productPrices[item.productId] = { high: 0, current: 0, currentDate: null };
        }
        const entry = productPrices[item.productId];
        if (item.price > entry.high) entry.high = item.price;
        if (!entry.currentDate || new Date(item.date) > new Date(entry.currentDate)) {
          entry.current = item.price;
          entry.currentDate = item.date;
        }
      }

      let alertsSent = 0;
      const productsChecked = Object.keys(productPrices).length;

      for (const [productId, prices] of Object.entries(productPrices)) {
        if (prices.high <= 0) continue;

        const dropPercent = (prices.high - prices.current) / prices.high;
        if (dropPercent < PRICE_DROP_THRESHOLD) continue;

        // Find members with this item wishlisted
        const wishlistResult = await wixData.query('Wishlist')
          .eq('productId', productId)
          .find();

        for (const wishItem of wishlistResult.items) {
          if (!wishItem.memberId) continue;

          // Check notification preferences
          if (await isAlertDisabled(wishItem.memberId, productId, 'priceDrops')) continue;

          // Check cooldown: was a price drop alert sent in the last 7 days?
          const recentAlert = await wixData.query('WishlistAlertsSent')
            .eq('memberId', wishItem.memberId)
            .eq('productId', productId)
            .eq('alertType', 'price_drop')
            .ge('sentAt', cooldownSince)
            .find();

          if (recentAlert.items.length > 0) continue;

          // Record alert
          await wixData.insert('WishlistAlertsSent', {
            memberId: wishItem.memberId,
            productId,
            alertType: 'price_drop',
            sentAt: new Date(),
            price: prices.current,
            previousHigh: prices.high,
            dropPercent: Math.round(dropPercent * 100),
          });

          // Send email notification (best-effort — failure doesn't block alert)
          try {
            await triggeredEmails.emailMember('wishlist_price_drop', wishItem.memberId, {
              variables: {
                productName: wishItem.name || '',
                currentPrice: `$${prices.current.toFixed(2)}`,
                previousHigh: `$${prices.high.toFixed(2)}`,
                dropPercent: String(Math.round(dropPercent * 100)),
              },
            });
          } catch (emailErr) {
            console.error('Failed to send price drop email:', emailErr);
          }

          alertsSent++;
        }
      }

      return { success: true, alertsSent, productsChecked };
    } catch (err) {
      console.error('Error checking price drops:', err);
      return { success: false, alertsSent: 0, productsChecked: 0 };
    }
  }
);

// ── Back In Stock Detection ─────────────────────────────────────────

/**
 * Check wishlisted items that were out of stock and are now available.
 * Sends back-in-stock notifications to members.
 *
 * @returns {Promise<{success: boolean, alertsSent: number}>}
 */
export const checkBackInStock = webMethod(
  Permissions.Admin,
  async () => {
    try {
      // Find wishlist items marked as out-of-stock
      const wishlistResult = await wixData.query('Wishlist')
        .eq('inStock', false)
        .find();

      if (wishlistResult.items.length === 0) {
        return { success: true, alertsSent: 0 };
      }

      // Get unique product IDs
      const productIds = [...new Set(wishlistResult.items.map(i => i.productId).filter(Boolean))];

      // Check current stock status from Products collection
      let alertsSent = 0;

      for (const productId of productIds) {
        const productResult = await wixData.query('Stores/Products')
          .eq('_id', productId)
          .find();

        const product = productResult.items[0];
        if (!product || !product.inStock) continue;

        // Product is back in stock — notify wishlisted members
        const members = wishlistResult.items.filter(w => w.productId === productId);

        for (const wishItem of members) {
          if (!wishItem.memberId) continue;

          // Check notification preferences
          if (await isAlertDisabled(wishItem.memberId, productId, 'backInStock')) continue;

          // Check if already notified for this restock
          const alreadyNotified = await wixData.query('WishlistAlertsSent')
            .eq('memberId', wishItem.memberId)
            .eq('productId', productId)
            .eq('alertType', 'back_in_stock')
            .ge('sentAt', new Date(Date.now() - ALERT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000))
            .find();

          if (alreadyNotified.items.length > 0) continue;

          await wixData.insert('WishlistAlertsSent', {
            memberId: wishItem.memberId,
            productId,
            alertType: 'back_in_stock',
            sentAt: new Date(),
            productName: product.name || wishItem.name || '',
          });

          // Send email notification (best-effort)
          try {
            await triggeredEmails.emailMember('wishlist_back_in_stock', wishItem.memberId, {
              variables: {
                productName: product.name || wishItem.name || '',
              },
            });
          } catch (emailErr) {
            console.error('Failed to send back-in-stock email:', emailErr);
          }

          // Update wishlist item stock status
          await wixData.update('Wishlist', {
            ...wishItem,
            inStock: true,
          });

          alertsSent++;
        }
      }

      return { success: true, alertsSent };
    } catch (err) {
      console.error('Error checking back-in-stock:', err);
      return { success: false, alertsSent: 0 };
    }
  }
);

// ── Low Stock Detection ─────────────────────────────────────────────

/**
 * Check wishlisted products with low stock and notify members.
 * Uses per-product thresholds from InventoryThresholds collection,
 * falling back to default LOW_STOCK_THRESHOLD (5 units).
 *
 * @returns {Promise<{success: boolean, alertsSent: number}>}
 */
export const checkLowStock = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const cooldownSince = new Date(Date.now() - ALERT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

      // Get all wishlisted product IDs
      const wishlistResult = await wixData.query('Wishlist').find();
      if (wishlistResult.items.length === 0) {
        return { success: true, alertsSent: 0 };
      }

      const productIds = [...new Set(wishlistResult.items.map(i => i.productId).filter(Boolean))];
      let alertsSent = 0;

      for (const productId of productIds) {
        const productResult = await wixData.query('Stores/Products')
          .eq('_id', productId)
          .find();

        const product = productResult.items[0];
        if (!product || !product.inStock) continue;

        // Determine threshold: per-product override or default
        let threshold = LOW_STOCK_THRESHOLD;
        const thresholdResult = await wixData.query('InventoryThresholds')
          .eq('productId', productId)
          .find();

        if (thresholdResult.items.length > 0 && thresholdResult.items[0].lowStockThreshold != null) {
          threshold = thresholdResult.items[0].lowStockThreshold;
        }

        const qty = product.quantityInStock;
        if (qty == null || qty >= threshold) continue;

        // Product is low stock — notify wishlisted members
        const members = wishlistResult.items.filter(w => w.productId === productId);

        for (const wishItem of members) {
          if (!wishItem.memberId) continue;

          // Check cooldown
          const recentAlert = await wixData.query('WishlistAlertsSent')
            .eq('memberId', wishItem.memberId)
            .eq('productId', productId)
            .eq('alertType', 'low_stock')
            .ge('sentAt', cooldownSince)
            .find();

          if (recentAlert.items.length > 0) continue;

          await wixData.insert('WishlistAlertsSent', {
            memberId: wishItem.memberId,
            productId,
            alertType: 'low_stock',
            sentAt: new Date(),
            productName: product.name || '',
            quantityInStock: qty,
          });

          // Send email notification (best-effort)
          try {
            await triggeredEmails.emailMember('wishlist_low_stock', wishItem.memberId, {
              variables: {
                productName: product.name || '',
                quantityInStock: String(qty),
              },
            });
          } catch (emailErr) {
            console.error('Failed to send low stock email:', emailErr);
          }

          alertsSent++;
        }
      }

      return { success: true, alertsSent };
    } catch (err) {
      console.error('Error checking low stock:', err);
      return { success: false, alertsSent: 0 };
    }
  }
);

// ── Notification Preferences ────────────────────────────────────────

/**
 * Get notification preferences for a member's wishlisted products.
 *
 * @param {string} memberId
 * @returns {Promise<{prefs: Array<{productId: string, priceDrops: boolean, backInStock: boolean}>}>}
 */
export const getAlertPrefs = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { prefs: [] };

      const result = await wixData.query('WishlistAlertPrefs')
        .eq('memberId', member._id)
        .find();

      return {
        prefs: result.items.map(i => ({
          productId: i.productId,
          priceDrops: i.priceDrops !== false,
          backInStock: i.backInStock !== false,
        })),
      };
    } catch (err) {
      console.error('Error fetching alert prefs:', err);
      return { prefs: [] };
    }
  }
);

/**
 * Update notification preference for a specific wishlisted product.
 *
 * @param {string} memberId
 * @param {string} productId
 * @param {Object} prefs - { priceDrops?: boolean, backInStock?: boolean }
 * @returns {Promise<{success: boolean}>}
 */
export const updateAlertPrefs = webMethod(
  Permissions.SiteMember,
  async (productId, prefs = {}) => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id || !productId) return { success: false };
      const cleanMemberId = member._id;
      const cleanProductId = sanitize(productId, 50);

      // Find existing pref
      const existing = await wixData.query('WishlistAlertPrefs')
        .eq('memberId', cleanMemberId)
        .eq('productId', cleanProductId)
        .find();

      if (existing.items.length > 0) {
        const record = existing.items[0];
        if (prefs.priceDrops !== undefined) record.priceDrops = !!prefs.priceDrops;
        if (prefs.backInStock !== undefined) record.backInStock = !!prefs.backInStock;
        await wixData.update('WishlistAlertPrefs', record);
      } else {
        await wixData.insert('WishlistAlertPrefs', {
          memberId: cleanMemberId,
          productId: cleanProductId,
          priceDrops: prefs.priceDrops !== false,
          backInStock: prefs.backInStock !== false,
        });
      }

      return { success: true };
    } catch (err) {
      console.error('Error updating alert prefs:', err);
      return { success: false };
    }
  }
);

// ── Alert History ──────────────────────────────────────────────────

/**
 * Get the current member's wishlist alert history (most recent first).
 *
 * @returns {Promise<{alerts: Array<{productId: string, alertType: string, sentAt: Date, price?: number, productName?: string}>}>}
 */
export const getAlertHistory = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const member = await currentMember.getMember();
      if (!member?._id) return { alerts: [] };

      const result = await wixData.query('WishlistAlertsSent')
        .eq('memberId', member._id)
        .descending('sentAt')
        .limit(50)
        .find();

      return {
        alerts: result.items.map(i => ({
          productId: i.productId,
          alertType: i.alertType,
          sentAt: i.sentAt,
          price: i.price,
          previousHigh: i.previousHigh,
          dropPercent: i.dropPercent,
          productName: i.productName,
          quantityInStock: i.quantityInStock,
        })),
      };
    } catch (err) {
      console.error('Error fetching alert history:', err);
      return { alerts: [] };
    }
  }
);

// ── Internal Helpers ────────────────────────────────────────────────

/**
 * Check if a member has disabled a specific alert type for a product.
 */
async function isAlertDisabled(memberId, productId, alertField) {
  try {
    const result = await wixData.query('WishlistAlertPrefs')
      .eq('memberId', memberId)
      .eq('productId', productId)
      .find();

    if (result.items.length === 0) return false; // Default: enabled
    return result.items[0][alertField] === false;
  } catch {
    return false;
  }
}

// Export constants for testing
export const _PRICE_DROP_THRESHOLD = PRICE_DROP_THRESHOLD;
export const _ALERT_COOLDOWN_DAYS = ALERT_COOLDOWN_DAYS;
export const _LOW_STOCK_THRESHOLD = LOW_STOCK_THRESHOLD;
