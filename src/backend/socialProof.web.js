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
 * Existing CMS collections used: Orders (Wix Stores), InventoryLevels, ProductAnalytics, Reviews.
 * New collections (CF-ej3t):
 *   ViewerCount — productId (text), viewCount (number), lastSold24h (number), updatedAt (date)
 *   RateLimitSessions — productId (text), sessionToken (text), createdAt (date)
 * Create both manually in Wix CMS before deploying.
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateId } from 'backend/utils/sanitize';
import { logError } from 'backend/utils/errorHandler';

const LOW_STOCK_THRESHOLD = 5;
const RECENT_PURCHASE_HOURS = 48;
const MAX_NOTIFICATIONS_PER_SESSION = 5;
const MIN_NOTIFICATION_INTERVAL_MS = 60000; // 1 minute

// ── Notification Types ──────────────────────────────────────────────

const NOTIFICATION_TYPES = {
  recent_purchase: 'recent_purchase',
  low_stock: 'low_stock',
  popularity: 'popularity',
  review_count: 'review_count',
};

const MIN_REVIEW_COUNT = 5;

/**
 * Get social proof notifications for a product.
 * Returns up to 4 notification objects, prioritized by type.
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

      const [recentPurchases, stockLevel, viewCount, reviewData] = await Promise.all([
        getRecentPurchases(id),
        getStockLevel(id),
        getApproxViewCount(id),
        getReviewCount(id),
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

      // Priority 4: Review count
      if (reviewData.count >= MIN_REVIEW_COUNT) {
        notifications.push({
          type: NOTIFICATION_TYPES.review_count,
          message: `${reviewData.count} reviews — rated ${reviewData.averageRating}/5 stars`,
          priority: 4,
        });
      }

      return {
        notifications,
        config: getConfig(),
      };
    } catch (err) {
      logError('socialProof.getSocialProof', err);
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

      // Get low stock products (site-wide — category filter not yet implemented)
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
      logError('socialProof.getCategorySocialProof', err);
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

// ── ViewerCount webMethods (CF-ej3t) ─────────────────────────────────

const VIEWER_COLLECTION      = 'ViewerCount';
const RATE_LIMIT_COLLECTION  = 'RateLimitSessions';
const RATE_LIMIT_TTL_MS      = 60000; // 60 seconds

/**
 * Get viewer count and recent sales count for a product.
 * Returns zeros on any CMS error (fail-safe — callers must hide badges
 * rather than showing stale/incorrect data).
 *
 * @function getViewerCount
 * @param {string} productId
 * @returns {Promise<{ viewCount: number, lastSold24h: number }>}
 * @permission Anyone
 */
export const getViewerCount = webMethod(
  Permissions.Anyone,
  async (productId) => {
    if (!productId) return { viewCount: 0, lastSold24h: 0 };
    const id = validateId(productId, 50);
    if (!id) return { viewCount: 0, lastSold24h: 0 };
    try {
      const result = await wixData.query(VIEWER_COLLECTION)
        .eq('productId', id)
        .find();
      if (!result.items || result.items.length === 0) {
        return { viewCount: 0, lastSold24h: 0 };
      }
      const record = result.items[0];
      return {
        viewCount:   Math.max(0, record.viewCount   || 0),
        lastSold24h: Math.max(0, record.lastSold24h || 0),
      };
    } catch (err) {
      logError('socialProof.getViewerCount', err);
      return { viewCount: 0, lastSold24h: 0 };
    }
  }
);

/**
 * Increment the viewer count for a product by 1.
 * Upserts the ViewerCount record; creates it on first call with lastSold24h: 0
 * (lastSold24h is managed separately by the order-processing pipeline).
 *
 * Enforces a server-side 60s cooldown per (productId, sessionToken) via the
 * RateLimitSessions CMS collection. If sessionToken is omitted, the server-side
 * check is skipped (client-side sessionStorage rate limiting still applies).
 *
 * NOTE: The read-then-write is not atomic (Wix Data has no native atomic increment).
 * Concurrent calls for the same product can lose increments. Viewer counts are
 * decorative-only — best-effort accuracy is acceptable for this use case.
 *
 * Returns { ok: true } on success, { ok: false } on error or rate-limited.
 *
 * @function incrementViewerCount
 * @param {string} productId
 * @param {string} [sessionToken] - Client session token for server-side rate limiting
 * @returns {Promise<{ ok: boolean }>}
 * @permission Anyone
 */
export const incrementViewerCount = webMethod(
  Permissions.Anyone,
  async (productId, sessionToken) => {
    if (!productId) return { ok: false };
    const id = validateId(productId, 50);
    if (!id) return { ok: false };

    // Server-side rate limiting: reject duplicate increments within TTL window
    if (sessionToken) {
      const token = sanitize(sessionToken, 100);
      if (token) {
        try {
          const cutoff = new Date(Date.now() - RATE_LIMIT_TTL_MS);
          const rateCheck = await wixData.query(RATE_LIMIT_COLLECTION)
            .eq('productId', id)
            .eq('sessionToken', token)
            .ge('createdAt', cutoff)
            .find();
          if (rateCheck.items?.length > 0) {
            return { ok: false }; // within cooldown window
          }
          await wixData.insert(RATE_LIMIT_COLLECTION, {
            productId: id,
            sessionToken: token,
            createdAt: new Date(),
          });
        } catch (err) {
          logError('socialProof.incrementViewerCount.rateLimit', err);
          // Non-fatal: if rate limit check fails, proceed with increment
        }
      }
    }

    try {
      const result = await wixData.query(VIEWER_COLLECTION)
        .eq('productId', id)
        .find();

      const now = new Date();
      if (result.items?.length > 0) {
        const existing = result.items[0];
        await wixData.update(VIEWER_COLLECTION, {
          ...existing,
          viewCount: (existing.viewCount || 0) + 1,
          updatedAt: now,
        });
      } else {
        await wixData.insert(VIEWER_COLLECTION, {
          productId: id,
          viewCount:   1,
          lastSold24h: 0,
          updatedAt:   now,
        });
      }
      return { ok: true };
    } catch (err) {
      logError('socialProof.incrementViewerCount', err);
      return { ok: false };
    }
  }
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
    logError('socialProof.getRecentPurchases', err);
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
    logError('socialProof.getStockLevel', err);
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
    logError('socialProof.getApproxViewCount', err);
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

async function getReviewCount(productId) {
  try {
    const result = await wixData.query('Reviews')
      .eq('productId', productId)
      .eq('status', 'approved')
      .find();

    const items = result.items || [];
    if (items.length === 0) return { count: 0, averageRating: 0 };

    const sum = items.reduce((acc, r) => acc + (r.rating || 0), 0);
    const avg = Math.round((sum / items.length) * 10) / 10;

    return { count: items.length, averageRating: avg };
  } catch (err) {
    logError('socialProof.getReviewCount', err);
    return { count: 0, averageRating: 0 };
  }
}

function anonymizeCity(city) {
  if (!city) return '';
  // Return city name, title-cased
  return city.trim().replace(/\b\w/g, c => c.toUpperCase());
}

// ── ZIP-based social proof (CF-rhqm) ─────────────────────────────────

/**
 * Count recent furniture buyers near a ZIP code (by 3-digit prefix).
 * Returns { count, city } for display as "X people near [City] bought this week."
 * Queries Stores/Orders for completed orders with matching ZIP prefix.
 *
 * Privacy-safe: only returns aggregate count and city name, no PII.
 *
 * CF-rhqm
 *
 * @param {string} zipPrefix — 3-digit ZIP prefix (e.g. '287' for Hendersonville, NC area)
 * @param {number} [days=7] — lookback window in days
 * @returns {Promise<{ count: number, city: string } | null>}
 */
export const getLocalBuyerCount = webMethod(
  Permissions.Anyone,
  async (zipPrefix, days = 7) => {
    if (!zipPrefix || typeof zipPrefix !== 'string') return null;

    const cleaned = zipPrefix.replace(/\D/g, '').slice(0, 3);
    if (cleaned.length < 3) return null;

    try {
      const cutoff = new Date(Date.now() - days * 86_400_000);

      const orderResult = await wixData
        .query('Stores/Orders')
        .ge('_createdDate', cutoff)
        .startsWith('shippingInfo.shipmentDetails.address.postalCode', cleaned)
        .limit(1000)
        .find({ suppressAuth: true });

      // Deduplicate by buyer email for accurate people count
      const uniqueBuyers = new Set();
      let sampleCity = '';
      for (const order of orderResult.items) {
        const email = order.buyerInfo?.email;
        if (email) uniqueBuyers.add(email.toLowerCase());
        if (!sampleCity) {
          sampleCity = order.shippingInfo?.shipmentDetails?.address?.city || '';
        }
      }

      return {
        count: uniqueBuyers.size,
        city: anonymizeCity(sampleCity),
      };
    } catch (err) {
      logError('getLocalBuyerCount — failed', err);
      return null;
    }
  }
);
