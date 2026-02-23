/**
 * @module socialProof
 * @description Backend web module for social proof notifications.
 * Provides recent purchase alerts, low stock urgency, and popularity signals
 * for Product and Category pages. Privacy-safe (first name + city only).
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * Uses existing CMS collections: Orders (Wix Stores), InventoryLevels.
 * No new collections required.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

const LOW_STOCK_THRESHOLD = 5;
const RECENT_PURCHASE_HOURS = 48;
const MAX_NOTIFICATIONS_PER_SESSION = 5;
const MIN_NOTIFICATION_INTERVAL_MS = 60000; // 1 minute

// ── Notification Types ──────────────────────────────────────────────

const NOTIFICATION_TYPES = {
  recent_purchase: 'recent_purchase',
  low_stock: 'low_stock',
  popularity: 'popularity',
};

/**
 * Get social proof notifications for a product.
 * Returns up to 3 notification objects, prioritized by type.
 *
 * @function getProductSocialProof
 * @param {string} productId - The product ID
 * @param {string} [productName] - Product name for display
 * @returns {Promise<Object>} { notifications: Array, config: Object }
 * @permission Anyone
 */
export const getProductSocialProof = webMethod(
  Permissions.Anyone,
  async (productId, productName) => {
    try {
      if (!productId) return { notifications: [], config: getConfig() };

      const id = sanitize(productId, 50);
      const name = sanitize(productName || '', 200);

      const [recentPurchases, stockLevel, viewCount] = await Promise.all([
        getRecentPurchases(id),
        getStockLevel(id),
        getApproxViewCount(id),
      ]);

      const notifications = [];

      // Priority 1: Recent purchases
      if (recentPurchases.length > 0) {
        const purchase = recentPurchases[0];
        notifications.push({
          type: NOTIFICATION_TYPES.recent_purchase,
          message: formatPurchaseMessage(purchase, name),
          priority: 1,
          timestamp: purchase.date,
        });
      }

      // Priority 2: Low stock urgency
      if (stockLevel !== null && stockLevel > 0 && stockLevel <= LOW_STOCK_THRESHOLD) {
        notifications.push({
          type: NOTIFICATION_TYPES.low_stock,
          message: `Only ${stockLevel} left in stock`,
          priority: 2,
          urgency: stockLevel <= 2 ? 'high' : 'medium',
        });
      }

      // Priority 3: Popularity signal
      if (viewCount >= 5) {
        notifications.push({
          type: NOTIFICATION_TYPES.popularity,
          message: `${viewCount} people viewed this recently`,
          priority: 3,
        });
      }

      return {
        notifications,
        config: getConfig(),
      };
    } catch (err) {
      console.error('Error getting social proof:', err);
      return { notifications: [], config: getConfig() };
    }
  }
);

/**
 * Get social proof summary for a category page (multiple products).
 * Returns aggregate signals: total recent sales count, products with low stock.
 *
 * @function getCategorySocialProof
 * @param {string} categorySlug - Category slug
 * @returns {Promise<Object>} { recentSalesCount, lowStockProducts, config }
 * @permission Anyone
 */
export const getCategorySocialProof = webMethod(
  Permissions.Anyone,
  async (categorySlug) => {
    try {
      if (!categorySlug) return { recentSalesCount: 0, lowStockProducts: [], config: getConfig() };

      const slug = sanitize(categorySlug, 100);

      // Get low stock products in this category
      const lowStockResult = await wixData.query('InventoryLevels')
        .le('quantity', LOW_STOCK_THRESHOLD)
        .gt('quantity', 0)
        .find();

      const lowStockProducts = (lowStockResult.items || []).map(item => ({
        productId: item.productId,
        productName: item.productName || 'This item',
        quantity: item.quantity,
      }));

      // Count recent sales (last 48h)
      const cutoff = new Date(Date.now() - RECENT_PURCHASE_HOURS * 3600000);
      const salesResult = await wixData.query('Orders')
        .ge('_createdDate', cutoff)
        .find();

      return {
        recentSalesCount: salesResult.items?.length || 0,
        lowStockProducts: lowStockProducts.slice(0, 5),
        config: getConfig(),
      };
    } catch (err) {
      console.error('Error getting category social proof:', err);
      return { recentSalesCount: 0, lowStockProducts: [], config: getConfig() };
    }
  }
);

/**
 * Get display configuration for social proof notifications.
 *
 * @function getSocialProofConfig
 * @returns {Object} Display configuration
 * @permission Anyone
 */
export const getSocialProofConfig = webMethod(
  Permissions.Anyone,
  () => getConfig()
);

// ── Internal helpers ──────────────────────────────────────────────────

function getConfig() {
  return {
    maxPerSession: MAX_NOTIFICATIONS_PER_SESSION,
    minIntervalMs: MIN_NOTIFICATION_INTERVAL_MS,
    autoDismissMs: 5000,
    position: 'bottom-left',
    mobilePosition: 'bottom-full',
  };
}

async function getRecentPurchases(productId) {
  try {
    const cutoff = new Date(Date.now() - RECENT_PURCHASE_HOURS * 3600000);
    const result = await wixData.query('Orders')
      .ge('_createdDate', cutoff)
      .descending('_createdDate')
      .limit(10)
      .find();

    const purchases = [];
    for (const order of result.items || []) {
      const lineItems = order.lineItems || [];
      const match = lineItems.find(li => li.productId === productId);
      if (match) {
        purchases.push({
          firstName: anonymizeName(order.billingInfo?.firstName || ''),
          city: anonymizeCity(order.billingInfo?.city || order.shippingInfo?.city || ''),
          productName: match.name || '',
          date: order._createdDate,
        });
      }
    }
    return purchases;
  } catch (err) {
    return [];
  }
}

async function getStockLevel(productId) {
  try {
    const result = await wixData.query('InventoryLevels')
      .eq('productId', productId)
      .find();

    if (!result.items || result.items.length === 0) return null;

    // Sum across all variants
    const total = result.items.reduce((sum, v) => sum + (v.quantity || 0), 0);
    return total;
  } catch (err) {
    return null;
  }
}

async function getApproxViewCount(productId) {
  try {
    const cutoff = new Date(Date.now() - 24 * 3600000); // Last 24h
    const result = await wixData.query('ProductAnalytics')
      .eq('productId', productId)
      .ge('timestamp', cutoff)
      .count();
    return result || 0;
  } catch (err) {
    return 0;
  }
}

function formatPurchaseMessage(purchase, productName) {
  const name = purchase.firstName || 'Someone';
  const city = purchase.city;
  const product = productName || purchase.productName || 'this item';

  if (city) {
    return `${name} from ${city} recently purchased ${product}`;
  }
  return `${name} recently purchased ${product}`;
}

function anonymizeName(firstName) {
  if (!firstName) return '';
  // Return first name only, capitalized
  const name = firstName.trim();
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

function anonymizeCity(city) {
  if (!city) return '';
  // Return city name, title-cased
  return city.trim().replace(/\b\w/g, c => c.toUpperCase());
}
