/**
 * @module inventoryService
 * @description Inventory management backend: variant-level stock tracking,
 * low stock alerts, restock suggestions based on sales velocity,
 * back-in-stock email signup, and pre-order mode.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * 1. Create `InventoryLevels` CMS collection:
 *    productId (text), variantId (text), sku (text), productName (text),
 *    variantLabel (text), quantity (number), threshold (number),
 *    preOrder (boolean), lastRestocked (dateTime), updatedAt (dateTime)
 *
 * 2. Create `BackInStockSignups` CMS collection:
 *    email (text), productId (text), variantId (text),
 *    productName (text), signedUpAt (dateTime), notified (boolean)
 *
 * 3. Create `InventoryLog` CMS collection:
 *    productId (text), variantId (text), change (number),
 *    reason (text), timestamp (dateTime)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';

const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const SALES_VELOCITY_DAYS = 30;

// ── Stock Status ────────────────────────────────────────────────────

/**
 * Get stock status for a product (all variants).
 *
 * @param {string} productId
 * @returns {Promise<{status: string, variants: Array, preOrder: boolean}>}
 * status: 'in_stock' | 'low_stock' | 'out_of_stock'
 */
export const getStockStatus = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      if (!productId) return { status: 'out_of_stock', variants: [], preOrder: false };

      const result = await wixData.query('InventoryLevels')
        .eq('productId', sanitize(productId, 50))
        .find();

      if (result.items.length === 0) {
        return { status: 'in_stock', variants: [], preOrder: false };
      }

      const variants = result.items.map(item => ({
        variantId: item.variantId,
        variantLabel: item.variantLabel || '',
        quantity: item.quantity,
        threshold: item.threshold || DEFAULT_LOW_STOCK_THRESHOLD,
        status: getVariantStatus(item.quantity, item.threshold || DEFAULT_LOW_STOCK_THRESHOLD),
        preOrder: !!item.preOrder,
      }));

      const totalQty = variants.reduce((sum, v) => sum + v.quantity, 0);
      const anyPreOrder = variants.some(v => v.preOrder);
      const lowestQty = Math.min(...variants.map(v => v.quantity));
      const lowestThreshold = Math.min(...variants.map(v => v.threshold));

      let status;
      if (totalQty <= 0 && !anyPreOrder) {
        status = 'out_of_stock';
      } else if (lowestQty > 0 && lowestQty <= lowestThreshold) {
        status = 'low_stock';
      } else {
        status = 'in_stock';
      }

      return { status, variants, preOrder: anyPreOrder };
    } catch (err) {
      console.error('Error getting stock status:', err);
      return { status: 'in_stock', variants: [], preOrder: false };
    }
  }
);

// ── Inventory Dashboard ─────────────────────────────────────────────

/**
 * Get all products sorted by stock level for admin dashboard.
 *
 * @param {string} [filter] - 'low_stock' | 'out_of_stock' | 'all'
 * @returns {Promise<{products: Array}>}
 */
export const getInventoryDashboard = webMethod(
  Permissions.Admin,
  async (filter = 'all') => {
    try {
      const result = await wixData.query('InventoryLevels')
        .ascending('quantity')
        .limit(200)
        .find();

      let items = result.items.map(item => ({
        _id: item._id,
        productId: item.productId,
        variantId: item.variantId,
        sku: item.sku || '',
        productName: item.productName || '',
        variantLabel: item.variantLabel || '',
        quantity: item.quantity,
        threshold: item.threshold || DEFAULT_LOW_STOCK_THRESHOLD,
        status: getVariantStatus(item.quantity, item.threshold || DEFAULT_LOW_STOCK_THRESHOLD),
        preOrder: !!item.preOrder,
        lastRestocked: item.lastRestocked,
      }));

      if (filter === 'low_stock') {
        items = items.filter(i => i.status === 'low_stock');
      } else if (filter === 'out_of_stock') {
        items = items.filter(i => i.status === 'out_of_stock');
      }

      return { products: items };
    } catch (err) {
      console.error('Error getting inventory dashboard:', err);
      return { products: [] };
    }
  }
);

// ── Stock Updates ───────────────────────────────────────────────────

/**
 * Update stock level for a product variant.
 *
 * @param {string} productId
 * @param {string} variantId
 * @param {number} quantity - New absolute quantity
 * @param {Object} [options] - { threshold, preOrder, reason }
 * @returns {Promise<{success: boolean, previousQty: number, alerts: string[]}>}
 */
export const updateStockLevel = webMethod(
  Permissions.Admin,
  async (productId, variantId, quantity, options = {}) => {
    try {
      if (!productId || !variantId) return { success: false, previousQty: 0, alerts: [] };

      const cleanProductId = sanitize(productId, 50);
      const cleanVariantId = sanitize(variantId, 50);
      const newQty = Math.max(0, Math.floor(Number(quantity) || 0));
      const alerts = [];

      // Find existing record
      const existing = await wixData.query('InventoryLevels')
        .eq('productId', cleanProductId)
        .eq('variantId', cleanVariantId)
        .find();

      const previousQty = existing.items.length > 0 ? existing.items[0].quantity : 0;
      const threshold = options.threshold !== undefined
        ? Math.max(0, Number(options.threshold) || 0)
        : (existing.items[0]?.threshold || DEFAULT_LOW_STOCK_THRESHOLD);

      const record = {
        productId: cleanProductId,
        variantId: cleanVariantId,
        sku: options.sku ? sanitize(options.sku, 50) : (existing.items[0]?.sku || ''),
        productName: options.productName ? sanitize(options.productName, 200) : (existing.items[0]?.productName || ''),
        variantLabel: options.variantLabel ? sanitize(options.variantLabel, 200) : (existing.items[0]?.variantLabel || ''),
        quantity: newQty,
        threshold,
        preOrder: options.preOrder !== undefined ? !!options.preOrder : (existing.items[0]?.preOrder || false),
        updatedAt: new Date(),
      };

      if (existing.items.length > 0) {
        record._id = existing.items[0]._id;
        record.lastRestocked = newQty > previousQty ? new Date() : existing.items[0].lastRestocked;
        await wixData.update('InventoryLevels', record);
      } else {
        record.lastRestocked = new Date();
        await wixData.insert('InventoryLevels', record);
      }

      // Log the change
      if (previousQty !== newQty) {
        await wixData.insert('InventoryLog', {
          productId: cleanProductId,
          variantId: cleanVariantId,
          change: newQty - previousQty,
          reason: sanitize(options.reason || '', 200),
          timestamp: new Date(),
        });
      }

      // Generate alerts
      if (newQty <= 0 && previousQty > 0) {
        alerts.push('out_of_stock');
      } else if (newQty <= threshold && newQty > 0) {
        alerts.push('low_stock');
      }

      // Trigger back-in-stock notifications if restocked
      if (newQty > 0 && previousQty <= 0) {
        alerts.push('back_in_stock');
      }

      return { success: true, previousQty, alerts };
    } catch (err) {
      console.error('Error updating stock level:', err);
      return { success: false, previousQty: 0, alerts: [] };
    }
  }
);

// ── Restock Suggestions ─────────────────────────────────────────────

/**
 * Get restock suggestions based on sales velocity.
 * Calculates days until out of stock at current sales rate.
 *
 * @returns {Promise<{suggestions: Array}>}
 */
export const getRestockSuggestions = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const since = new Date(Date.now() - SALES_VELOCITY_DAYS * 24 * 60 * 60 * 1000);

      // Get inventory changes (negative = sold)
      const logResult = await wixData.query('InventoryLog')
        .ge('timestamp', since)
        .find();

      // Group sales by product+variant
      const salesByVariant = {};
      for (const entry of logResult.items) {
        if (entry.change >= 0) continue; // skip restocks
        const key = `${entry.productId}:${entry.variantId}`;
        salesByVariant[key] = (salesByVariant[key] || 0) + Math.abs(entry.change);
      }

      // Get current inventory levels
      const inventoryResult = await wixData.query('InventoryLevels')
        .find();

      const suggestions = [];

      for (const item of inventoryResult.items) {
        const key = `${item.productId}:${item.variantId}`;
        const totalSold = salesByVariant[key] || 0;
        const dailyRate = totalSold / SALES_VELOCITY_DAYS;

        if (dailyRate <= 0) continue;

        const daysUntilOOS = item.quantity > 0 ? Math.floor(item.quantity / dailyRate) : 0;
        const suggestedRestock = Math.ceil(dailyRate * 30); // 30-day supply

        suggestions.push({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName || '',
          variantLabel: item.variantLabel || '',
          currentQty: item.quantity,
          dailySalesRate: Math.round(dailyRate * 100) / 100,
          daysUntilOOS,
          suggestedRestock,
        });
      }

      // Sort by urgency (lowest days until OOS first)
      suggestions.sort((a, b) => a.daysUntilOOS - b.daysUntilOOS);

      return { suggestions };
    } catch (err) {
      console.error('Error generating restock suggestions:', err);
      return { suggestions: [] };
    }
  }
);

// ── Back In Stock Signup ────────────────────────────────────────────

/**
 * Sign up for back-in-stock notification.
 *
 * @param {Object} params - { email, productId, variantId, productName }
 * @returns {Promise<{success: boolean}>}
 */
export const signUpBackInStock = webMethod(
  Permissions.Anyone,
  async (params = {}) => {
    try {
      const { email, productId, variantId, productName } = params;

      if (!email || !validateEmail(email)) return { success: false, error: 'Valid email required' };
      if (!productId) return { success: false, error: 'Product ID required' };

      const cleanEmail = sanitize(email, 254).toLowerCase();
      const cleanProductId = sanitize(productId, 50);
      const cleanVariantId = variantId ? sanitize(variantId, 50) : '';

      // Dedup
      const existing = await wixData.query('BackInStockSignups')
        .eq('email', cleanEmail)
        .eq('productId', cleanProductId)
        .eq('notified', false)
        .find();

      if (existing.items.length > 0) return { success: true }; // Already signed up

      await wixData.insert('BackInStockSignups', {
        email: cleanEmail,
        productId: cleanProductId,
        variantId: cleanVariantId,
        productName: sanitize(productName || '', 200),
        signedUpAt: new Date(),
        notified: false,
      });

      return { success: true };
    } catch (err) {
      console.error('Error signing up for back-in-stock:', err);
      return { success: false, error: 'Failed to sign up' };
    }
  }
);

/**
 * Get pending back-in-stock signups for a product.
 *
 * @param {string} productId
 * @returns {Promise<{signups: Array}>}
 */
export const getBackInStockSignups = webMethod(
  Permissions.Admin,
  async (productId) => {
    try {
      if (!productId) return { signups: [] };

      const result = await wixData.query('BackInStockSignups')
        .eq('productId', sanitize(productId, 50))
        .eq('notified', false)
        .find();

      return {
        signups: result.items.map(i => ({
          _id: i._id,
          email: i.email,
          variantId: i.variantId,
          signedUpAt: i.signedUpAt,
        })),
      };
    } catch (err) {
      console.error('Error getting back-in-stock signups:', err);
      return { signups: [] };
    }
  }
);

// ── Low Stock Alerts ────────────────────────────────────────────────

/**
 * Get all products below their stock threshold.
 *
 * @returns {Promise<{alerts: Array}>}
 */
export const getLowStockAlerts = webMethod(
  Permissions.Admin,
  async () => {
    try {
      const result = await wixData.query('InventoryLevels')
        .ascending('quantity')
        .find();

      const alerts = result.items
        .filter(item => {
          const threshold = item.threshold || DEFAULT_LOW_STOCK_THRESHOLD;
          return item.quantity <= threshold;
        })
        .map(item => ({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName || '',
          variantLabel: item.variantLabel || '',
          quantity: item.quantity,
          threshold: item.threshold || DEFAULT_LOW_STOCK_THRESHOLD,
          status: getVariantStatus(item.quantity, item.threshold || DEFAULT_LOW_STOCK_THRESHOLD),
          sku: item.sku || '',
        }));

      return { alerts };
    } catch (err) {
      console.error('Error getting low stock alerts:', err);
      return { alerts: [] };
    }
  }
);

// ── Internal Helpers ────────────────────────────────────────────────

function getVariantStatus(quantity, threshold) {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= threshold) return 'low_stock';
  return 'in_stock';
}

// Export for testing
export const _DEFAULT_LOW_STOCK_THRESHOLD = DEFAULT_LOW_STOCK_THRESHOLD;
export const _getVariantStatus = getVariantStatus;
