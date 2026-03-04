/**
 * @module promotionsEngine
 * @description Backend web module for promotions, promo codes, flash sales, and BOGO deals.
 * Validates and applies promo codes, manages time-limited flash sales,
 * and calculates Buy One Get One savings.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 *
 * @setup
 * Create CMS collections:
 *
 * `PromoCodes`:
 *   code (Text, indexed, unique) - Promo code string (stored uppercase)
 *   type (Text) - 'percentage' | 'fixed' | 'freeShipping'
 *   value (Number) - Discount value (percent or dollar amount)
 *   isActive (Boolean) - Whether code is currently active
 *   startDate (Date) - When code becomes valid
 *   endDate (Date) - When code expires
 *   minSubtotal (Number) - Minimum cart subtotal required
 *   maxUses (Number) - Max redemptions (0 = unlimited)
 *   usesCount (Number) - Current redemption count
 *   applicableCategories (Text) - Comma-separated category slugs (empty = all)
 *   applicableProducts (Text) - Comma-separated product IDs (empty = all)
 *
 * `FlashSales`:
 *   title (Text) - Sale display title
 *   discountPercent (Number) - Discount percentage (1-100)
 *   isActive (Boolean) - Whether sale is active
 *   startTime (Date) - Sale start time
 *   endTime (Date) - Sale end time
 *   maxQuantity (Number) - Max items per customer (0 = unlimited)
 *   productIds (Text) - Comma-separated product IDs
 *
 * `BOGODeals`:
 *   title (Text) - Deal display title
 *   buyCategory (Text) - Category slug for "buy" items
 *   buyQuantity (Number) - Quantity to buy
 *   getCategory (Text) - Category slug for "get" items
 *   getQuantity (Number) - Quantity received
 *   getDiscountPercent (Number) - Discount on "get" items (100 = free)
 *   isActive (Boolean) - Whether deal is active
 *   startDate (Date) - Deal start date
 *   endDate (Date) - Deal end date
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

// ── Constants ──────────────────────────────────────────────────────

const VALID_PROMO_TYPES = ['percentage', 'fixed', 'freeShipping'];
const MAX_CODE_LENGTH = 50;

// ── Public API ─────────────────────────────────────────────────────

/**
 * Validate a promo code without applying it.
 * @param {string} code - The promo code to validate
 * @returns {Promise<{success: boolean, valid?: boolean, promo?: Object, reason?: string, error?: string}>}
 */
export const validatePromoCode = webMethod(
  Permissions.Anyone,
  async (code) => {
    try {
      if (!code || typeof code !== 'string') {
        return { success: false, error: 'Promo code is required' };
      }

      const cleanCode = sanitize(code, MAX_CODE_LENGTH).toUpperCase().trim();
      if (!cleanCode) {
        return { success: false, error: 'Promo code is required' };
      }

      const result = await wixData.query('PromoCodes')
        .eq('code', cleanCode)
        .limit(1)
        .find();

      if (!result.items || result.items.length === 0) {
        return { success: true, valid: false, reason: 'Invalid promo code' };
      }

      const promo = result.items[0];
      const now = new Date();

      if (!promo.isActive) {
        return { success: true, valid: false, reason: 'This promo code is no longer active' };
      }

      if (promo.startDate && new Date(promo.startDate) > now) {
        return { success: true, valid: false, reason: 'This promo code is not yet active' };
      }

      if (promo.endDate && new Date(promo.endDate) < now) {
        return { success: true, valid: false, reason: 'This promo code has expired' };
      }

      if (promo.maxUses > 0 && promo.usesCount >= promo.maxUses) {
        return { success: true, valid: false, reason: 'This promo code has reached its usage limit' };
      }

      return {
        success: true,
        valid: true,
        promo: {
          code: promo.code,
          type: promo.type,
          value: promo.value,
          minSubtotal: promo.minSubtotal || 0,
          applicableCategories: promo.applicableCategories || '',
          applicableProducts: promo.applicableProducts || '',
        },
      };
    } catch (err) {
      console.error('[promotionsEngine] Error validating promo code:', err);
      return { success: false, error: 'Failed to validate promo code' };
    }
  }
);

/**
 * Apply a promo code to a cart and calculate the discount.
 * @param {string} code - The promo code
 * @param {Array<{_id: string, name?: string, price: number, quantity: number, category?: string}>} cartItems
 * @returns {Promise<Object>}
 */
export const applyPromoCode = webMethod(
  Permissions.Anyone,
  async (code, cartItems) => {
    try {
      if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        return { success: false, error: 'Cart items are required' };
      }

      const validation = await validatePromoCode(code);
      if (!validation.success) return validation;
      if (!validation.valid) return { success: true, valid: false, reason: validation.reason };

      const promo = validation.promo;
      const items = cartItems.slice(0, 50);

      // Calculate subtotal
      let subtotal = 0;
      for (const item of items) {
        const price = Math.max(0, Number(item.price) || 0);
        const qty = Math.max(1, Math.min(99, Math.round(Number(item.quantity) || 1)));
        subtotal += price * qty;
      }
      subtotal = round2(subtotal);

      // Check minimum subtotal
      if (promo.minSubtotal > 0 && subtotal < promo.minSubtotal) {
        return {
          success: true,
          valid: false,
          reason: `Minimum order of $${promo.minSubtotal} required for this code`,
        };
      }

      // Free shipping — no dollar discount
      if (promo.type === 'freeShipping') {
        await incrementUsage(code);
        return {
          success: true,
          valid: true,
          discount: 0,
          discountType: 'freeShipping',
          freeShipping: true,
          subtotalAfterDiscount: subtotal,
          code: promo.code,
        };
      }

      // Determine eligible items
      const categories = parseCSV(promo.applicableCategories);
      const productIds = parseCSV(promo.applicableProducts);
      const hasRestrictions = categories.length > 0 || productIds.length > 0;

      let eligibleSubtotal = subtotal;
      if (hasRestrictions) {
        eligibleSubtotal = 0;
        for (const item of items) {
          const price = Math.max(0, Number(item.price) || 0);
          const qty = Math.max(1, Math.min(99, Math.round(Number(item.quantity) || 1)));
          const matchesCategory = categories.length > 0 && categories.includes(item.category);
          const matchesProduct = productIds.length > 0 && productIds.includes(item._id);
          if (matchesCategory || matchesProduct) {
            eligibleSubtotal += price * qty;
          }
        }
        eligibleSubtotal = round2(eligibleSubtotal);
      }

      let discount = 0;
      if (promo.type === 'percentage') {
        const pct = Math.min(100, Math.max(0, Number(promo.value) || 0));
        discount = round2(eligibleSubtotal * pct / 100);
      } else if (promo.type === 'fixed') {
        discount = Math.min(subtotal, Math.max(0, Number(promo.value) || 0));
      }

      discount = round2(Math.min(discount, subtotal));
      const subtotalAfterDiscount = round2(subtotal - discount);

      await incrementUsage(code);

      return {
        success: true,
        valid: true,
        discount,
        discountType: promo.type,
        freeShipping: false,
        subtotalAfterDiscount,
        code: promo.code,
      };
    } catch (err) {
      console.error('[promotionsEngine] Error applying promo code:', err);
      return { success: false, error: 'Failed to apply promo code' };
    }
  }
);

/**
 * Get currently active flash sales.
 * @returns {Promise<{success: boolean, sales: Array}>}
 */
export const getActiveFlashSales = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const now = new Date();

      const result = await wixData.query('FlashSales')
        .eq('isActive', true)
        .le('startTime', now)
        .find();

      const sales = (result.items || [])
        .filter(sale => new Date(sale.endTime) > now)
        .map(sale => {
          const remainingMs = Math.max(0, new Date(sale.endTime).getTime() - now.getTime());
          return {
            _id: sale._id,
            title: sale.title,
            discountPercent: sale.discountPercent,
            startTime: sale.startTime,
            endTime: sale.endTime,
            remainingMs,
            maxQuantity: sale.maxQuantity || 0,
            productIds: sale.productIds || '',
          };
        });

      return { success: true, sales };
    } catch (err) {
      console.error('[promotionsEngine] Error fetching flash sales:', err);
      return { success: true, sales: [] };
    }
  }
);

/**
 * Get currently active BOGO deals.
 * @returns {Promise<{success: boolean, deals: Array}>}
 */
export const getActiveBOGODeals = webMethod(
  Permissions.Anyone,
  async () => {
    try {
      const now = new Date();

      const result = await wixData.query('BOGODeals')
        .eq('isActive', true)
        .le('startDate', now)
        .find();

      const deals = (result.items || [])
        .filter(deal => new Date(deal.endDate) > now)
        .map(deal => ({
          _id: deal._id,
          title: deal.title,
          buyCategory: deal.buyCategory,
          buyQuantity: deal.buyQuantity,
          getCategory: deal.getCategory,
          getQuantity: deal.getQuantity,
          getDiscountPercent: deal.getDiscountPercent,
          startDate: deal.startDate,
          endDate: deal.endDate,
        }));

      return { success: true, deals };
    } catch (err) {
      console.error('[promotionsEngine] Error fetching BOGO deals:', err);
      return { success: true, deals: [] };
    }
  }
);

/**
 * Calculate BOGO savings for a cart.
 * @param {Array<{_id: string, name?: string, price: number, quantity: number, category?: string}>} cartItems
 * @returns {Promise<{success: boolean, totalSavings: number, appliedDeals: Array}>}
 */
export const calculateBOGOSavings = webMethod(
  Permissions.Anyone,
  async (cartItems) => {
    try {
      if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        return { success: true, totalSavings: 0, appliedDeals: [] };
      }

      const dealsResult = await getActiveBOGODeals();
      if (!dealsResult.success || dealsResult.deals.length === 0) {
        return { success: true, totalSavings: 0, appliedDeals: [] };
      }

      const appliedDeals = [];
      let totalSavings = 0;

      for (const deal of dealsResult.deals) {
        // Count qualifying "buy" items
        let buyCount = 0;
        for (const item of cartItems) {
          if (item.category === deal.buyCategory) {
            buyCount += Math.max(1, Math.round(Number(item.quantity) || 1));
          }
        }

        if (buyCount < deal.buyQuantity) continue;

        // How many times the deal applies
        const dealApplications = Math.floor(buyCount / deal.buyQuantity);

        // Find "get" items (cheapest first for fairness)
        const getItems = cartItems
          .filter(item => item.category === deal.getCategory)
          .sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));

        if (getItems.length === 0) continue;

        // Calculate savings for get items
        let remainingFree = dealApplications * deal.getQuantity;
        let dealSavings = 0;

        for (const item of getItems) {
          if (remainingFree <= 0) break;
          const qty = Math.min(remainingFree, Math.max(1, Math.round(Number(item.quantity) || 1)));
          const price = Math.max(0, Number(item.price) || 0);
          const discountPct = Math.min(100, Math.max(0, deal.getDiscountPercent));
          dealSavings += round2(price * qty * discountPct / 100);
          remainingFree -= qty;
        }

        if (dealSavings > 0) {
          appliedDeals.push({
            dealId: deal._id,
            title: deal.title,
            savings: round2(dealSavings),
          });
          totalSavings += dealSavings;
        }
      }

      return {
        success: true,
        totalSavings: round2(totalSavings),
        appliedDeals,
      };
    } catch (err) {
      console.error('[promotionsEngine] Error calculating BOGO savings:', err);
      return { success: true, totalSavings: 0, appliedDeals: [] };
    }
  }
);

/**
 * Create a new flash sale (Admin only).
 * @param {Object} params
 * @param {string} params.title - Sale title
 * @param {number} params.discountPercent - Discount (1-100)
 * @param {number} params.durationHours - Sale duration in hours
 * @param {string} [params.productIds] - Comma-separated product IDs
 * @param {number} [params.maxQuantity] - Max per customer (0 = unlimited)
 * @returns {Promise<{success: boolean, sale?: Object, error?: string}>}
 */
export const createFlashSale = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      if (!params || typeof params !== 'object') {
        return { success: false, error: 'Parameters are required' };
      }

      const title = sanitize(params.title || '', 200);
      if (!title) {
        return { success: false, error: 'Title is required' };
      }

      const discountPercent = Number(params.discountPercent) || 0;
      if (discountPercent <= 0 || discountPercent > 100) {
        return { success: false, error: 'Discount must be between 1 and 100 percent' };
      }

      const durationHours = Number(params.durationHours) || 0;
      if (durationHours <= 0) {
        return { success: false, error: 'Duration must be greater than 0 hours' };
      }

      const now = new Date();
      const endTime = new Date(now.getTime() + durationHours * 3600000);

      const sale = await wixData.insert('FlashSales', {
        title,
        discountPercent,
        isActive: true,
        startTime: now,
        endTime,
        maxQuantity: Math.max(0, Math.round(Number(params.maxQuantity) || 0)),
        productIds: sanitize(params.productIds || '', 2000),
      });

      return { success: true, sale };
    } catch (err) {
      console.error('[promotionsEngine] Error creating flash sale:', err);
      return { success: false, error: 'Failed to create flash sale' };
    }
  }
);

/**
 * Create a new promo code (Admin only).
 * @param {Object} params
 * @param {string} params.code - Promo code string
 * @param {string} params.type - 'percentage' | 'fixed' | 'freeShipping'
 * @param {number} [params.value] - Discount value
 * @param {number} params.durationDays - Validity period in days
 * @param {number} [params.minSubtotal] - Minimum cart subtotal
 * @param {number} [params.maxUses] - Maximum redemptions (0 = unlimited)
 * @param {string} [params.applicableCategories] - Comma-separated categories
 * @param {string} [params.applicableProducts] - Comma-separated product IDs
 * @returns {Promise<{success: boolean, promo?: Object, error?: string}>}
 */
export const createPromoCode = webMethod(
  Permissions.Admin,
  async (params) => {
    try {
      if (!params || typeof params !== 'object') {
        return { success: false, error: 'Parameters are required' };
      }

      const code = sanitize(params.code || '', MAX_CODE_LENGTH).toUpperCase().trim();
      if (!code) {
        return { success: false, error: 'Promo code is required' };
      }

      const type = (params.type || '').trim();
      if (!VALID_PROMO_TYPES.includes(type)) {
        return { success: false, error: `Invalid type. Must be one of: ${VALID_PROMO_TYPES.join(', ')}` };
      }

      const value = Number(params.value) || 0;
      if (type === 'percentage' && (value <= 0 || value > 100)) {
        return { success: false, error: 'Percentage discount must be between 1 and 100' };
      }
      if (type === 'fixed' && value < 0) {
        return { success: false, error: 'Fixed discount cannot be negative' };
      }

      const durationDays = Number(params.durationDays) || 0;
      if (durationDays <= 0) {
        return { success: false, error: 'Duration must be greater than 0 days' };
      }

      // Check for duplicate
      const existing = await wixData.query('PromoCodes')
        .eq('code', code)
        .limit(1)
        .find();

      if (existing.items && existing.items.length > 0) {
        return { success: false, error: 'A promo code with this code already exists' };
      }

      const now = new Date();
      const endDate = new Date(now.getTime() + durationDays * 86400000);

      const promo = await wixData.insert('PromoCodes', {
        code,
        type,
        value: type === 'freeShipping' ? 0 : value,
        isActive: true,
        startDate: now,
        endDate,
        minSubtotal: Math.max(0, Number(params.minSubtotal) || 0),
        maxUses: Math.max(0, Math.round(Number(params.maxUses) || 0)),
        usesCount: 0,
        applicableCategories: sanitize(params.applicableCategories || '', 500),
        applicableProducts: sanitize(params.applicableProducts || '', 2000),
      });

      return { success: true, promo };
    } catch (err) {
      console.error('[promotionsEngine] Error creating promo code:', err);
      return { success: false, error: 'Failed to create promo code' };
    }
  }
);

// ── Internal Helpers ───────────────────────────────────────────────

async function incrementUsage(code) {
  try {
    const cleanCode = sanitize(code, MAX_CODE_LENGTH).toUpperCase().trim();
    const result = await wixData.query('PromoCodes')
      .eq('code', cleanCode)
      .limit(1)
      .find();

    if (result.items && result.items.length > 0) {
      const promo = result.items[0];
      promo.usesCount = (promo.usesCount || 0) + 1;
      await wixData.update('PromoCodes', promo);
    }
  } catch (err) {
    console.error('[promotionsEngine] Error incrementing usage:', err);
  }
}

function parseCSV(str) {
  if (!str || typeof str !== 'string') return [];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
