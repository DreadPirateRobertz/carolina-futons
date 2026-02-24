/**
 * @module inventoryAlerts
 * @description Inventory threshold alerts and low-stock urgency messaging.
 * Displays "Only X left!" warnings on product/category pages, sends admin
 * alerts when SKUs fall below reorder thresholds, and provides a low-stock
 * dashboard for inventory management.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires wix-members-backend
 *
 * @setup
 * Create CMS collection "InventoryThresholds" with fields:
 * - productId (Text) - Reference to Stores/Products
 * - sku (Text) - Product SKU for quick lookup
 * - productName (Text) - Cached product name
 * - urgencyThreshold (Number) - Show "Only X left!" when stock <= this (default 5)
 * - reorderThreshold (Number) - Alert admin when stock <= this (default 10)
 * - currentStock (Number) - Last known stock level
 * - lastChecked (DateTime) - When stock was last synced
 * - reorderAlertSent (Boolean) - Whether admin has been notified
 * - _createdDate (DateTime) - Auto
 *
 * Create CMS collection "LowStockAlerts" with fields:
 * - productId (Text) - Product that triggered alert
 * - sku (Text) - Product SKU
 * - productName (Text) - Product name at time of alert
 * - stockLevel (Number) - Stock when alert was generated
 * - thresholdType (Text) - "urgency" | "reorder"
 * - status (Text) - "active" | "acknowledged" | "resolved"
 * - acknowledgedBy (Text) - Admin member ID
 * - acknowledgedAt (DateTime) - When acknowledged
 * - _createdDate (DateTime) - Auto
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';
import { sanitize } from 'backend/utils/sanitize';

const THRESHOLDS_COLLECTION = 'InventoryThresholds';
const ALERTS_COLLECTION = 'LowStockAlerts';
const DEFAULT_URGENCY_THRESHOLD = 5;
const DEFAULT_REORDER_THRESHOLD = 10;

// ── Admin check ─────────────────────────────────────────────────────

async function requireAdmin() {
  const member = await currentMember.getMember();
  if (!member || !member._id) {
    throw new Error('Authentication required.');
  }
  const roles = await currentMember.getRoles();
  const isAdmin = roles.some(r => r.title === 'Admin' || r._id === 'admin');
  if (!isAdmin) {
    throw new Error('Admin access required.');
  }
  return member._id;
}

// ── getStockStatus (public) ─────────────────────────────────────────

export const getStockStatus = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      const cleanId = sanitize(productId, 50);
      if (!cleanId) {
        return { success: false, error: 'Product ID required' };
      }

      // Look up threshold config for this product
      const thresholdResult = await wixData.query(THRESHOLDS_COLLECTION)
        .eq('productId', cleanId)
        .find();

      if (thresholdResult.items.length === 0) {
        // No threshold configured — return default (no urgency shown)
        return {
          success: true,
          showUrgency: false,
          inStock: true,
          message: '',
        };
      }

      const config = thresholdResult.items[0];
      const stock = config.currentStock;
      const urgencyThreshold = config.urgencyThreshold || DEFAULT_URGENCY_THRESHOLD;

      if (stock <= 0) {
        return {
          success: true,
          showUrgency: false,
          inStock: false,
          message: 'Out of stock',
          stockLevel: 0,
        };
      }

      if (stock <= urgencyThreshold) {
        return {
          success: true,
          showUrgency: true,
          inStock: true,
          message: `Only ${stock} left in stock!`,
          stockLevel: stock,
        };
      }

      return {
        success: true,
        showUrgency: false,
        inStock: true,
        message: 'In stock',
        stockLevel: stock,
      };
    } catch (err) {
      console.error('getStockStatus error:', err);
      return { success: false, error: 'Unable to check stock status' };
    }
  }
);

// ── getBatchStockStatus (public, for category pages) ────────────────

export const getBatchStockStatus = webMethod(
  Permissions.Anyone,
  async (productIds = []) => {
    try {
      if (!Array.isArray(productIds) || productIds.length === 0) {
        return { success: true, statuses: {} };
      }

      const cleanIds = productIds
        .map(id => sanitize(id, 50))
        .filter(Boolean)
        .slice(0, 50);

      if (cleanIds.length === 0) {
        return { success: true, statuses: {} };
      }

      const result = await wixData.query(THRESHOLDS_COLLECTION)
        .hasSome('productId', cleanIds)
        .find();

      const statuses = {};

      for (const config of result.items) {
        const stock = config.currentStock;
        const urgencyThreshold = config.urgencyThreshold || DEFAULT_URGENCY_THRESHOLD;

        if (stock <= 0) {
          statuses[config.productId] = {
            showUrgency: false,
            inStock: false,
            message: 'Out of stock',
            stockLevel: 0,
          };
        } else if (stock <= urgencyThreshold) {
          statuses[config.productId] = {
            showUrgency: true,
            inStock: true,
            message: `Only ${stock} left in stock!`,
            stockLevel: stock,
          };
        } else {
          statuses[config.productId] = {
            showUrgency: false,
            inStock: true,
            message: 'In stock',
            stockLevel: stock,
          };
        }
      }

      return { success: true, statuses };
    } catch (err) {
      console.error('getBatchStockStatus error:', err);
      return { success: false, error: 'Unable to check stock statuses' };
    }
  }
);

// ── syncInventory (admin — updates stock levels) ────────────────────

export const syncInventory = webMethod(
  Permissions.SiteMember,
  async (inventoryUpdates = []) => {
    try {
      await requireAdmin();

      if (!Array.isArray(inventoryUpdates) || inventoryUpdates.length === 0) {
        return { success: false, error: 'Inventory updates array required' };
      }

      let synced = 0;
      let alertsCreated = 0;
      const now = new Date();

      for (const update of inventoryUpdates.slice(0, 100)) {
        const cleanId = sanitize(update.productId, 50);
        const cleanSku = sanitize(update.sku, 50);
        const cleanName = sanitize(update.productName, 200);
        const stock = typeof update.stock === 'number' ? Math.max(0, Math.floor(update.stock)) : null;

        if (!cleanId || stock === null) continue;

        // Find or create threshold config
        const existing = await wixData.query(THRESHOLDS_COLLECTION)
          .eq('productId', cleanId)
          .find();

        let config;
        if (existing.items.length > 0) {
          config = existing.items[0];
          const previousStock = config.currentStock;
          config.currentStock = stock;
          config.lastChecked = now;
          if (cleanSku) config.sku = cleanSku;
          if (cleanName) config.productName = cleanName;

          // Reset reorder alert if stock has been replenished above threshold
          const reorderThreshold = config.reorderThreshold || DEFAULT_REORDER_THRESHOLD;
          if (stock > reorderThreshold && config.reorderAlertSent) {
            config.reorderAlertSent = false;
          }

          await wixData.update(THRESHOLDS_COLLECTION, config);

          // Check if we need to create a reorder alert
          if (stock <= reorderThreshold && !config.reorderAlertSent) {
            await wixData.insert(ALERTS_COLLECTION, {
              productId: cleanId,
              sku: config.sku || cleanSku || '',
              productName: config.productName || cleanName || '',
              stockLevel: stock,
              thresholdType: 'reorder',
              status: 'active',
              acknowledgedBy: '',
              acknowledgedAt: null,
            });
            config.reorderAlertSent = true;
            await wixData.update(THRESHOLDS_COLLECTION, config);
            alertsCreated++;
          }
        } else {
          // Create new threshold config with defaults
          const reorderThreshold = DEFAULT_REORDER_THRESHOLD;
          const needsAlert = stock <= reorderThreshold;

          config = await wixData.insert(THRESHOLDS_COLLECTION, {
            productId: cleanId,
            sku: cleanSku || '',
            productName: cleanName || '',
            urgencyThreshold: DEFAULT_URGENCY_THRESHOLD,
            reorderThreshold,
            currentStock: stock,
            lastChecked: now,
            reorderAlertSent: needsAlert,
          });

          if (needsAlert) {
            await wixData.insert(ALERTS_COLLECTION, {
              productId: cleanId,
              sku: cleanSku || '',
              productName: cleanName || '',
              stockLevel: stock,
              thresholdType: 'reorder',
              status: 'active',
              acknowledgedBy: '',
              acknowledgedAt: null,
            });
            alertsCreated++;
          }
        }

        synced++;
      }

      return { success: true, synced, alertsCreated };
    } catch (err) {
      console.error('syncInventory error:', err);
      return { success: false, error: 'Inventory sync failed' };
    }
  }
);

// ── getLowStockAlerts (admin dashboard) ─────────────────────────────

export const getLowStockAlerts = webMethod(
  Permissions.SiteMember,
  async (options = {}) => {
    try {
      await requireAdmin();

      const { status = 'active', limit = 50 } = options;
      const safeLimit = Math.min(Math.max(1, limit), 100);

      let query = wixData.query(ALERTS_COLLECTION)
        .descending('_createdDate')
        .limit(safeLimit);

      const VALID_STATUSES = ['active', 'acknowledged', 'resolved'];
      if (status && !VALID_STATUSES.includes(status)) {
        return { success: false, error: 'Invalid status filter' };
      }

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const result = await query.find();

      return {
        success: true,
        alerts: result.items.map(a => ({
          _id: a._id,
          productId: a.productId,
          sku: a.sku,
          productName: a.productName,
          stockLevel: a.stockLevel,
          thresholdType: a.thresholdType,
          status: a.status,
          acknowledgedBy: a.acknowledgedBy || null,
          acknowledgedAt: a.acknowledgedAt || null,
          createdDate: a._createdDate,
        })),
        totalCount: result.totalCount,
      };
    } catch (err) {
      console.error('getLowStockAlerts error:', err);
      return { success: false, error: 'Failed to load alerts' };
    }
  }
);

// ── acknowledgeAlert (admin) ────────────────────────────────────────

export const acknowledgeAlert = webMethod(
  Permissions.SiteMember,
  async (alertId) => {
    try {
      const adminId = await requireAdmin();

      const cleanId = sanitize(alertId, 50);
      if (!cleanId) return { success: false, error: 'Alert ID required' };

      const alert = await wixData.get(ALERTS_COLLECTION, cleanId);
      if (!alert) {
        return { success: false, error: 'Alert not found' };
      }

      if (alert.status !== 'active') {
        return { success: false, error: 'Alert is not active' };
      }

      alert.status = 'acknowledged';
      alert.acknowledgedBy = adminId;
      alert.acknowledgedAt = new Date();
      await wixData.update(ALERTS_COLLECTION, alert);

      return { success: true, status: 'acknowledged' };
    } catch (err) {
      console.error('acknowledgeAlert error:', err);
      return { success: false, error: 'Failed to acknowledge alert' };
    }
  }
);

// ── resolveAlert (admin) ────────────────────────────────────────────

export const resolveAlert = webMethod(
  Permissions.SiteMember,
  async (alertId) => {
    try {
      await requireAdmin();

      const cleanId = sanitize(alertId, 50);
      if (!cleanId) return { success: false, error: 'Alert ID required' };

      const alert = await wixData.get(ALERTS_COLLECTION, cleanId);
      if (!alert) {
        return { success: false, error: 'Alert not found' };
      }

      if (alert.status === 'resolved') {
        return { success: false, error: 'Alert already resolved' };
      }

      alert.status = 'resolved';
      await wixData.update(ALERTS_COLLECTION, alert);

      return { success: true, status: 'resolved' };
    } catch (err) {
      console.error('resolveAlert error:', err);
      return { success: false, error: 'Failed to resolve alert' };
    }
  }
);

// ── updateThreshold (admin) ─────────────────────────────────────────

export const updateThreshold = webMethod(
  Permissions.SiteMember,
  async (productId, thresholds = {}) => {
    try {
      await requireAdmin();

      const cleanId = sanitize(productId, 50);
      if (!cleanId) return { success: false, error: 'Product ID required' };

      const { urgencyThreshold, reorderThreshold } = thresholds;

      const existing = await wixData.query(THRESHOLDS_COLLECTION)
        .eq('productId', cleanId)
        .find();

      if (existing.items.length === 0) {
        return { success: false, error: 'Product threshold not found. Sync inventory first.' };
      }

      const config = existing.items[0];

      if (typeof urgencyThreshold === 'number' && urgencyThreshold >= 0) {
        config.urgencyThreshold = Math.floor(urgencyThreshold);
      }
      if (typeof reorderThreshold === 'number' && reorderThreshold >= 0) {
        config.reorderThreshold = Math.floor(reorderThreshold);
      }

      await wixData.update(THRESHOLDS_COLLECTION, config);

      return {
        success: true,
        urgencyThreshold: config.urgencyThreshold,
        reorderThreshold: config.reorderThreshold,
      };
    } catch (err) {
      console.error('updateThreshold error:', err);
      return { success: false, error: 'Failed to update threshold' };
    }
  }
);

// ── getLowStockSummary (admin dashboard) ────────────────────────────

export const getLowStockSummary = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      await requireAdmin();

      // Get all threshold configs
      const all = await wixData.query(THRESHOLDS_COLLECTION)
        .limit(1000)
        .find();

      let outOfStock = 0;
      let urgencyLevel = 0;
      let reorderLevel = 0;
      let healthy = 0;

      for (const config of all.items) {
        const stock = config.currentStock;
        const urgency = config.urgencyThreshold || DEFAULT_URGENCY_THRESHOLD;
        const reorder = config.reorderThreshold || DEFAULT_REORDER_THRESHOLD;

        if (stock <= 0) {
          outOfStock++;
        } else if (stock <= urgency) {
          urgencyLevel++;
        } else if (stock <= reorder) {
          reorderLevel++;
        } else {
          healthy++;
        }
      }

      // Count active alerts
      const activeAlerts = await wixData.query(ALERTS_COLLECTION)
        .eq('status', 'active')
        .count();

      return {
        success: true,
        summary: {
          totalProducts: all.items.length,
          outOfStock,
          urgencyLevel,
          reorderLevel,
          healthy,
          activeAlerts,
        },
      };
    } catch (err) {
      console.error('getLowStockSummary error:', err);
      return { success: false, error: 'Failed to load summary' };
    }
  }
);
