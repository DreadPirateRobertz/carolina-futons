// liveInventory.web.js — Live Inventory backend web methods
// Thin frontend-facing API for the product page LiveInventory module.
// Wraps the core inventoryService to return a simplified shape:
//   { success, status, quantity }
// and delegates stock notification signup to signUpBackInStock.

import { Permissions, webMethod } from 'wix-web-module';
import { getStockStatus, signUpBackInStock } from 'backend/inventoryService.web';
import { validateEmail } from 'backend/utils/sanitize';

// ── getProductInventory ───────────────────────────────────────────────

/**
 * Get inventory status for a product page.
 * Returns a simplified shape for the LiveInventory frontend module.
 *
 * @param {string} productId
 * @returns {Promise<{success: boolean, status: string, quantity: number, error?: string}>}
 *   status: 'in_stock' | 'low_stock' | 'out_of_stock'
 *   quantity: lowest variant quantity (used for "Only X left!" display)
 */
export const getProductInventory = webMethod(
  Permissions.Anyone,
  async (productId) => {
    try {
      if (!productId) return { success: false, error: 'Product ID required' };

      const result = await getStockStatus(productId);
      const status = result?.status;
      const variants = result?.variants ?? [];

      // Use the lowest variant quantity for "Only X left!" display.
      // 999 is a sentinel meaning "ample stock" when variant data is unavailable.
      const rawMin = variants.length > 0
        ? variants.reduce((min, v) => Math.min(min, v.quantity), Infinity)
        : (status === 'out_of_stock' ? 0 : 999);
      const quantity = Number.isFinite(rawMin) ? rawMin : 999;

      return { success: true, status, quantity };
    } catch (e) {
      console.error('[liveInventory] getProductInventory failed:', e);
      return { success: false, error: 'Failed to fetch inventory' };
    }
  }
);

// ── registerStockNotification ─────────────────────────────────────────

/**
 * Register a customer email for back-in-stock notification.
 *
 * @param {string} productId
 * @param {string} email
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const registerStockNotification = webMethod(
  Permissions.Anyone,
  async (productId, email) => {
    try {
      if (!productId) return { success: false, error: 'Product ID required' };
      if (!email || !validateEmail(email)) return { success: false, error: 'Valid email required' };

      return await signUpBackInStock({ productId, email });
    } catch (e) {
      console.error('[liveInventory] registerStockNotification failed:', e);
      return { success: false, error: 'Failed to register notification' };
    }
  }
);
