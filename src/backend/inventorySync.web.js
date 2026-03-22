/**
 * @module inventorySync
 * @description Scheduled job: sync Wix Stores product stock into InventoryThresholds CMS.
 * Reads `product.stock.quantity` (or sums variant quantities for tracked products),
 * upserts InventoryThresholds.currentStock, and raises LowStockAlerts when a
 * product crosses below its reorder threshold for the first time.
 *
 * Called by Wix Jobs Scheduler (see jobs.config → syncInventoryFromStore).
 * Also exported as a webMethod so admins can trigger on-demand.
 *
 * @requires wix-stores-backend
 * @requires wix-data
 *
 * @setup
 * Existing CMS collections (from inventoryAlerts.web.js):
 *   InventoryThresholds — productId, currentStock, urgencyThreshold,
 *                         reorderThreshold, reorderAlertSent, lastChecked
 *   LowStockAlerts      — productId, stockLevel, thresholdType, status
 */
import { Permissions, webMethod } from 'wix-web-module';
import { products } from 'wix-stores-backend';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

const THRESHOLDS_COLLECTION = 'InventoryThresholds';
const ALERTS_COLLECTION = 'LowStockAlerts';
const DEFAULT_URGENCY_THRESHOLD = 5;
const DEFAULT_REORDER_THRESHOLD = 10;
const PAGE_SIZE = 100;
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 500;

// ── Internal helpers ─────────────────────────────────────────────────

/**
 * Compute total available stock for a product.
 * Uses variant-level quantities when trackInventory is true; falls back to
 * the product-level inStock boolean (returns 1 or 0) when not tracked.
 *
 * @param {Object} product - Wix Stores product object
 * @returns {number} Total stock quantity (>= 0)
 */
export function computeProductStock(product) {
  if (!product) return 0;
  const stock = product.stock;
  if (!stock) return 0;

  if (!stock.trackInventory) {
    // Not tracked — treat inStock boolean as 1 (available) or 0 (unavailable)
    return stock.inStock ? 1 : 0;
  }

  // Variant-level tracking: sum quantities across all variants
  const variants = product.variants;
  if (Array.isArray(variants) && variants.length > 0) {
    return variants.reduce((sum, v) => {
      const qty = v?.stock?.quantity;
      return sum + (typeof qty === 'number' && qty > 0 ? qty : 0);
    }, 0);
  }

  // Product-level quantity fallback (single-variant products)
  const qty = stock.quantity;
  return typeof qty === 'number' && qty > 0 ? qty : 0;
}

/**
 * Upsert one product's stock into InventoryThresholds and raise a
 * LowStockAlerts entry if the product newly crosses below reorderThreshold.
 *
 * @param {Object} product - Wix Stores product
 * @param {number} stock - Computed stock level
 * @param {Date} now - Timestamp for lastChecked
 * @returns {Promise<{synced: boolean, alertCreated: boolean}>}
 */
async function upsertProductThreshold(product, stock, now) {
  const productId = sanitize(product._id, 50);
  const productName = sanitize(product.name || '', 200);
  const sku = sanitize(
    (product.variants && product.variants[0]?.sku) || product.sku || '',
    50,
  );

  const existing = await wixData.query(THRESHOLDS_COLLECTION)
    .eq('productId', productId)
    .find();

  let alertCreated = false;

  if (existing.items.length > 0) {
    const config = existing.items[0];
    const reorderThreshold = config.reorderThreshold != null
      ? config.reorderThreshold
      : DEFAULT_REORDER_THRESHOLD;

    config.currentStock = stock;
    config.lastChecked = now;
    if (productName) config.productName = productName;

    // Reset reorderAlertSent flag when stock recovers above threshold
    if (stock > reorderThreshold && config.reorderAlertSent) {
      config.reorderAlertSent = false;
    }

    await wixData.update(THRESHOLDS_COLLECTION, config);

    // Raise alert on first crossing below reorder threshold
    if (stock <= reorderThreshold && !config.reorderAlertSent) {
      await wixData.insert(ALERTS_COLLECTION, {
        productId,
        sku: config.sku || sku,
        productName: config.productName || productName,
        stockLevel: stock,
        thresholdType: stock <= 0 ? 'out_of_stock' : 'reorder',
        status: 'active',
        acknowledgedBy: '',
        acknowledgedAt: null,
      });
      config.reorderAlertSent = true;
      await wixData.update(THRESHOLDS_COLLECTION, config);
      alertCreated = true;
    }
  } else {
    // First time we've seen this product — create threshold record with defaults
    const reorderThreshold = DEFAULT_REORDER_THRESHOLD;
    const needsAlert = stock <= reorderThreshold;

    await wixData.insert(THRESHOLDS_COLLECTION, {
      productId,
      sku,
      productName,
      urgencyThreshold: DEFAULT_URGENCY_THRESHOLD,
      reorderThreshold,
      currentStock: stock,
      lastChecked: now,
      reorderAlertSent: needsAlert,
    });

    if (needsAlert) {
      await wixData.insert(ALERTS_COLLECTION, {
        productId,
        sku,
        productName,
        stockLevel: stock,
        thresholdType: stock <= 0 ? 'out_of_stock' : 'reorder',
        status: 'active',
        acknowledgedBy: '',
        acknowledgedAt: null,
      });
      alertCreated = true;
    }
  }

  return { synced: true, alertCreated };
}

/**
 * Pause execution for `ms` milliseconds. Used for rate-limit batching.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Exported sync function (cron entry point) ────────────────────────

/**
 * Sync all Wix Stores product stock levels into InventoryThresholds.
 * Runs on schedule (jobs.config) and can be called ad-hoc by admins.
 *
 * Paginates through all products in batches of PAGE_SIZE, then writes
 * to CMS in sub-batches of BATCH_SIZE with a BATCH_DELAY_MS pause to
 * stay within Wix CMS write rate limits.
 *
 * @returns {Promise<{success: boolean, synced: number, alertsCreated: number, errors: number}>}
 */
export async function syncInventoryFromStore() {
  let synced = 0;
  let alertsCreated = 0;
  let errors = 0;
  const now = new Date();

  try {
    let query = products.queryProducts().limit(PAGE_SIZE);
    let result = await query.find();
    let page = result;

    while (page && page.items.length > 0) {
      // Process this page in BATCH_SIZE sub-batches with rate-limit delay
      for (let i = 0; i < page.items.length; i += BATCH_SIZE) {
        const batch = page.items.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (product) => {
            try {
              const stock = computeProductStock(product);
              const result = await upsertProductThreshold(product, stock, now);
              if (result.synced) synced++;
              if (result.alertCreated) alertsCreated++;
            } catch (err) {
              errors++;
              console.error(`[inventorySync] Failed to sync product ${product._id}:`, err?.message ?? err);
            }
          }),
        );

        // Rate-limit pause between sub-batches (skip after last batch)
        if (i + BATCH_SIZE < page.items.length) {
          await delay(BATCH_DELAY_MS);
        }
      }

      // Advance to next page
      if (page.hasNext()) {
        page = await page.next();
      } else {
        break;
      }
    }

    console.log(`[inventorySync] Sync complete: ${synced} products, ${alertsCreated} alerts, ${errors} errors`);
    return { success: true, synced, alertsCreated, errors };
  } catch (err) {
    console.error('[inventorySync] Sync failed:', err?.message ?? err);
    return { success: false, synced, alertsCreated, errors };
  }
}

// ── Admin on-demand trigger ──────────────────────────────────────────

/**
 * Admin-only webMethod to trigger inventory sync immediately (no cron).
 * Useful after a bulk restock or before a flash sale.
 *
 * @returns {Promise<{success: boolean, synced: number, alertsCreated: number, errors: number}>}
 */
export const triggerInventorySync = webMethod(
  Permissions.Admin,
  () => syncInventoryFromStore(),
);

// ── Export internals for testing ─────────────────────────────────────
export const _computeProductStock = computeProductStock;
export const _upsertProductThreshold = upsertProductThreshold;
export const _BATCH_SIZE = BATCH_SIZE;
export const _PAGE_SIZE = PAGE_SIZE;
