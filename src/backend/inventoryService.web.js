/**
 * @module inventoryService
 * @description Inventory CMS read surface — public stock status / urgency
 * lookups for the storefront, and the customer-facing back-in-stock email
 * signup endpoint.
 *
 * cf-4x7e Pass 2 chunk 13 retired the admin dashboard / write surface
 * (getInventoryDashboard, updateStockLevel, getRestockSuggestions,
 * getBackInStockSignups, getBackInStockDashboard, markSignupsNotified —
 * never wired) plus `getLowStockAlerts` (cross-file name-collision FP
 * with inventoryAlerts.web.js's own webMethod of the same name).
 *
 * Live consumers of the methods kept here:
 *   getStockStatus        — liveInventory.web.js, src/public/InventoryDisplay.js
 *                           (cfutons + stage3)
 *   signUpBackInStock     — liveInventory.web.js (cfutons + stage3)
 *   getInventoryUrgency   — src/public/inventoryUrgency.js (cfutons + stage3)
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 * @requires backend/utils/rateLimit
 * @requires backend/utils/auditLog
 *
 * @setup
 * Requires CMS collections:
 *
 *   InventoryLevels:
 *     productId (text), variantId (text), variantLabel (text),
 *     quantity (number), threshold (number), preOrder (boolean),
 *     lastRestocked (dateTime)
 *
 *   BackInStockSignups:
 *     email (text), productId (text), variantId (text),
 *     productName (text), signedUpAt (dateTime), notified (boolean)
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateEmail } from 'backend/utils/sanitize';
import { checkRateLimit } from 'backend/utils/rateLimit';
import { logAuditEvent } from 'backend/utils/auditLog';

const DEFAULT_LOW_STOCK_THRESHOLD = 5;
const LOW_STOCK_URGENCY_THRESHOLD = 5;
const JUST_RESTOCKED_HOURS = 48;

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
        threshold: item.threshold != null ? item.threshold : DEFAULT_LOW_STOCK_THRESHOLD,
        status: getVariantStatus(item.quantity, item.threshold != null ? item.threshold : DEFAULT_LOW_STOCK_THRESHOLD),
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

      const { allowed } = await checkRateLimit('BackInStockRateLimit', cleanEmail);
      if (!allowed) return { success: false, error: 'Too many requests. Please try again later.' };

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

      logAuditEvent('BackInStockSignups', 'submit', cleanEmail, { productId: cleanProductId });
      return { success: true };
    } catch (err) {
      console.error('Error signing up for back-in-stock:', err);
      return { success: false, error: 'Failed to sign up' };
    }
  }
);

// ── Inventory Urgency ───────────────────────────────────────────────

/**
 * Get inventory urgency level for a product (drives storefront badges).
 *
 * @param {string} productId
 * @returns {Promise<{level: string, count: number, message: string}>}
 * level: 'out' | 'just_restocked' | 'low' | 'none' (evaluated in this precedence order)
 */
export const getInventoryUrgency = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      if (!productId) return { level: 'none', count: 0, message: '' };

      const result = await wixData.query('InventoryLevels')
        .eq('productId', sanitize(productId, 50))
        .find();

      if (result.items.length === 0) return { level: 'none', count: 0, message: '' };

      const totalQty = result.items.reduce((sum, item) => sum + (item.quantity || 0), 0);

      if (totalQty <= 0) {
        return { level: 'out', count: 0, message: 'Out of stock' };
      }

      // Check just restocked: any variant restocked in last 48h
      const cutoff = new Date(Date.now() - JUST_RESTOCKED_HOURS * 60 * 60 * 1000);
      const justRestocked = result.items.some(
        item => item.lastRestocked && new Date(item.lastRestocked) > cutoff
      );
      if (justRestocked) {
        return { level: 'just_restocked', count: totalQty, message: 'Just restocked!' };
      }

      if (totalQty <= LOW_STOCK_URGENCY_THRESHOLD) {
        return { level: 'low', count: totalQty, message: `Only ${totalQty} left!` };
      }

      return { level: 'none', count: totalQty, message: '' };
    } catch (err) {
      console.error('[inventoryService] Error getting inventory urgency:', err);
      return { level: 'none', count: 0, message: '' };
    }
  }
);

// ── Internal Helpers ────────────────────────────────────────────────

function getVariantStatus(quantity, threshold) {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= threshold) return 'low_stock';
  return 'in_stock';
}
