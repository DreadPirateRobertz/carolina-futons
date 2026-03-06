/**
 * @module checkoutOptimization
 * @description Checkout optimization service for Carolina Futons.
 * Provides order summary calculations, shipping estimates, address validation,
 * tax estimation, checkout analytics, and express checkout helpers.
 *
 * @requires wix-web-module
 * @requires wix-data
 *
 * @setup
 * Create CMS collection `CheckoutAnalytics` with fields:
 *   sessionId (Text, indexed) - Browser session ID
 *   step (Text, indexed) - 'start'|'address'|'shipping'|'payment'|'complete'|'abandon'
 *   cartTotal (Number) - Cart subtotal at this step
 *   itemCount (Number) - Number of items
 *   timestamp (Date, indexed) - When step occurred
 *   metadata (Text) - JSON string of extra context
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

// ── Constants ──────────────────────────────────────────────────────

const FREE_SHIPPING_THRESHOLD = 999999;
const STANDARD_SHIPPING_RATE = 49.99;
const WHITE_GLOVE_LOCAL = 149;
const WHITE_GLOVE_REGIONAL = 249;
const WHITE_GLOVE_FREE_THRESHOLD = 999999;

const TAX_RATES = {
  NC: 0.0675,
  SC: 0.06,
  GA: 0.04,
  TN: 0.07,
  VA: 0.053,
  DEFAULT: 0.065,
};

const CHECKOUT_STEPS = ['start', 'address', 'shipping', 'payment', 'complete', 'abandon'];

// ── Public API ─────────────────────────────────────────────────────

/**
 * Calculate complete order summary with subtotal, shipping, tax, and total.
 * @param {Object} params
 * @param {Array<{price: number, quantity: number, name?: string}>} params.items - Cart items
 * @param {string} [params.state] - Shipping state (2-letter code)
 * @param {string} [params.shippingMethod] - 'standard'|'white_glove_local'|'white_glove_regional'
 * @param {string} [params.couponCode] - Applied coupon code
 * @returns {{ success: boolean, data?: Object, error?: string }}
 */
export const calculateOrderSummary = webMethod(
  Permissions.Anyone,
  (params) => {
    if (!params || !Array.isArray(params.items) || params.items.length === 0) {
      return { success: false, error: 'Cart items are required.' };
    }

    const items = params.items.slice(0, 50);
    let subtotal = 0;
    let itemCount = 0;

    for (const item of items) {
      const price = Number(item.price) || 0;
      const qty = Math.max(1, Math.min(99, Math.round(Number(item.quantity) || 1)));
      if (price < 0) continue;
      subtotal += price * qty;
      itemCount += qty;
    }

    subtotal = round2(subtotal);

    // Shipping calculation
    const shippingMethod = params.shippingMethod || 'standard';
    const shipping = calculateShipping(subtotal, shippingMethod);

    // Tax estimation
    const state = (params.state || '').toUpperCase().trim();
    const taxRate = TAX_RATES[state] || TAX_RATES.DEFAULT;
    const tax = round2(subtotal * taxRate);

    const total = round2(subtotal + shipping.amount + tax);

    // Free shipping progress
    const freeShippingProgress = subtotal >= FREE_SHIPPING_THRESHOLD
      ? { qualifies: true, remaining: 0, percentage: 100 }
      : {
        qualifies: false,
        remaining: round2(FREE_SHIPPING_THRESHOLD - subtotal),
        percentage: Math.min(99, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100)),
      };

    return {
      success: true,
      data: {
        subtotal,
        itemCount,
        shipping,
        tax,
        taxRate,
        total,
        freeShippingProgress,
        savings: subtotal >= FREE_SHIPPING_THRESHOLD ? STANDARD_SHIPPING_RATE : 0,
      },
    };
  }
);

/**
 * Validate a shipping address for completeness.
 * @param {Object} address
 * @returns {{ success: boolean, valid: boolean, errors?: string[] }}
 */
export const validateShippingAddress = webMethod(
  Permissions.Anyone,
  (address) => {
    if (!address || typeof address !== 'object') {
      return { success: false, valid: false, errors: ['Address is required.'] };
    }

    const errors = [];

    if (!address.fullName || sanitize(address.fullName, 100).length < 2) {
      errors.push('Full name is required (at least 2 characters).');
    }
    if (!address.addressLine1 || sanitize(address.addressLine1, 200).length < 3) {
      errors.push('Street address is required.');
    }
    if (!address.city || sanitize(address.city, 100).length < 2) {
      errors.push('City is required.');
    }
    if (!address.state || !/^[A-Za-z]{2}$/.test(address.state.trim())) {
      errors.push('Valid 2-letter state code is required.');
    }
    if (!address.zip || !/^\d{5}(-\d{4})?$/.test(address.zip.trim())) {
      errors.push('Valid ZIP code is required (e.g., 28792 or 28792-1234).');
    }

    return {
      success: true,
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
);

/**
 * Get shipping options with estimated delivery dates.
 * @param {number} subtotal - Cart subtotal
 * @param {string} [state] - Destination state
 * @returns {{ success: boolean, options: Array }}
 */
export const getShippingOptions = webMethod(
  Permissions.Anyone,
  (subtotal, state) => {
    const total = Number(subtotal) || 0;
    const options = [];

    // Standard shipping
    const standardFree = total >= FREE_SHIPPING_THRESHOLD;
    options.push({
      id: 'standard',
      label: standardFree ? 'FREE Standard Shipping' : 'Standard Shipping',
      price: standardFree ? 0 : STANDARD_SHIPPING_RATE,
      estimatedDays: { min: 5, max: 14 },
      description: 'Curbside delivery via freight carrier',
    });

    // White glove local
    const wgLocalFree = total >= WHITE_GLOVE_FREE_THRESHOLD;
    options.push({
      id: 'white_glove_local',
      label: wgLocalFree ? 'FREE White Glove Local' : 'White Glove Local Delivery',
      price: wgLocalFree ? 0 : WHITE_GLOVE_LOCAL,
      estimatedDays: { min: 3, max: 7 },
      description: 'In-home delivery with assembly (within 50 miles)',
    });

    // White glove regional
    options.push({
      id: 'white_glove_regional',
      label: wgLocalFree ? 'FREE White Glove Regional' : 'White Glove Regional Delivery',
      price: wgLocalFree ? 0 : WHITE_GLOVE_REGIONAL,
      estimatedDays: { min: 5, max: 10 },
      description: 'In-home delivery with assembly (50-200 miles)',
    });

    return { success: true, options };
  }
);

/**
 * Estimate delivery date range based on shipping method.
 * @param {string} shippingMethod - 'standard'|'white_glove_local'|'white_glove_regional'
 * @returns {{ success: boolean, data: { minDate: string, maxDate: string, label: string } }}
 */
export const getDeliveryEstimate = webMethod(
  Permissions.Anyone,
  (shippingMethod) => {
    const method = sanitize(shippingMethod || 'standard', 30);

    const dayRanges = {
      standard: { min: 5, max: 14 },
      white_glove_local: { min: 3, max: 7 },
      white_glove_regional: { min: 5, max: 10 },
    };

    const range = dayRanges[method] || dayRanges.standard;
    const today = new Date();
    const minDate = addBusinessDays(today, range.min);
    const maxDate = addBusinessDays(today, range.max);

    const opts = { month: 'short', day: 'numeric' };
    const minStr = minDate.toLocaleDateString('en-US', opts);
    const maxStr = maxDate.toLocaleDateString('en-US', opts);

    return {
      success: true,
      data: {
        minDate: minDate.toISOString().split('T')[0],
        maxDate: maxDate.toISOString().split('T')[0],
        label: `${minStr} – ${maxStr}`,
      },
    };
  }
);

/**
 * Track a checkout funnel step for analytics.
 * @param {Object} data
 * @param {string} data.sessionId - Browser session identifier
 * @param {string} data.step - Checkout step name
 * @param {number} [data.cartTotal] - Cart value at this step
 * @param {number} [data.itemCount] - Items in cart
 * @param {Object} [data.metadata] - Additional context
 * @returns {Promise<{ success: boolean }>}
 */
export const trackCheckoutStep = webMethod(
  Permissions.Anyone,
  async (data) => {
    try {
      if (!data || typeof data !== 'object') {
        return { success: false, error: 'Tracking data is required.' };
      }

      const sessionId = sanitize(data.sessionId, 100);
      if (!sessionId) {
        return { success: false, error: 'Session ID is required.' };
      }

      const step = sanitize(data.step, 20);
      if (!CHECKOUT_STEPS.includes(step)) {
        return { success: false, error: `Invalid step. Must be one of: ${CHECKOUT_STEPS.join(', ')}` };
      }

      await wixData.insert('CheckoutAnalytics', {
        sessionId,
        step,
        cartTotal: Math.max(0, Number(data.cartTotal) || 0),
        itemCount: Math.max(0, Math.round(Number(data.itemCount) || 0)),
        timestamp: new Date(),
        metadata: data.metadata ? JSON.stringify(data.metadata) : '',
      });

      return { success: true };
    } catch (err) {
      console.error('[checkoutOptimization] Error tracking checkout step:', err);
      return { success: false, error: 'Failed to track checkout step.' };
    }
  }
);

/**
 * Get checkout abandonment data for analysis.
 * Returns sessions that started checkout but didn't complete.
 * @param {number} [daysBack=7] - Look back period in days
 * @returns {Promise<{ success: boolean, data: { totalStarts: number, totalCompletes: number, abandonRate: number } }>}
 */
export const getAbandonmentRate = webMethod(
  Permissions.Admin,
  async (daysBack = 7) => {
    try {
      const days = Math.max(1, Math.min(90, Math.round(Number(daysBack) || 7)));
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);

      const starts = await wixData.query('CheckoutAnalytics')
        .eq('step', 'start')
        .ge('timestamp', cutoff)
        .count();

      const completes = await wixData.query('CheckoutAnalytics')
        .eq('step', 'complete')
        .ge('timestamp', cutoff)
        .count();

      const abandonRate = starts > 0 ? round2(((starts - completes) / starts) * 100) : 0;

      return {
        success: true,
        data: {
          totalStarts: starts,
          totalCompletes: completes,
          abandonRate,
          period: `${days} days`,
        },
      };
    } catch (err) {
      console.error('[checkoutOptimization] Error getting abandonment rate:', err);
      return { success: false, error: 'Failed to calculate abandonment rate.' };
    }
  }
);

/**
 * Generate a checkout summary for express checkout.
 * Combines cart, shipping, and tax into a one-click summary.
 * @param {Object} params
 * @param {Array<{price: number, quantity: number}>} params.items - Cart items
 * @param {Object} params.address - Saved shipping address
 * @returns {{ success: boolean, data?: Object }}
 */
export const getExpressCheckoutSummary = webMethod(
  Permissions.Anyone,
  (params) => {
    if (!params || !Array.isArray(params.items) || params.items.length === 0) {
      return { success: false, error: 'Cart items are required.' };
    }
    if (!params.address || !params.address.state) {
      return { success: false, error: 'Shipping address with state is required.' };
    }

    const orderResult = calculateOrderSummaryInternal(params.items, params.address.state, 'standard');
    if (!orderResult) {
      return { success: false, error: 'Failed to calculate order summary.' };
    }

    return {
      success: true,
      data: {
        ...orderResult,
        shippingAddress: {
          fullName: sanitize(params.address.fullName || '', 100),
          line1: sanitize(params.address.addressLine1 || '', 200),
          city: sanitize(params.address.city || '', 100),
          state: (params.address.state || '').toUpperCase().trim().slice(0, 2),
          zip: sanitize(params.address.zip || '', 10),
        },
        expressReady: true,
      },
    };
  }
);

// ── Internal Helpers ───────────────────────────────────────────────

function calculateShipping(subtotal, method) {
  if (subtotal >= WHITE_GLOVE_FREE_THRESHOLD) {
    return { method, amount: 0, label: 'FREE' };
  }

  if (method === 'white_glove_local') {
    return { method, amount: WHITE_GLOVE_LOCAL, label: `$${WHITE_GLOVE_LOCAL}` };
  }
  if (method === 'white_glove_regional') {
    return { method, amount: WHITE_GLOVE_REGIONAL, label: `$${WHITE_GLOVE_REGIONAL}` };
  }

  // Standard
  if (subtotal >= FREE_SHIPPING_THRESHOLD) {
    return { method: 'standard', amount: 0, label: 'FREE' };
  }
  return { method: 'standard', amount: STANDARD_SHIPPING_RATE, label: `$${STANDARD_SHIPPING_RATE}` };
}

function calculateOrderSummaryInternal(items, state, shippingMethod) {
  let subtotal = 0;
  let itemCount = 0;

  for (const item of items.slice(0, 50)) {
    const price = Number(item.price) || 0;
    const qty = Math.max(1, Math.min(99, Math.round(Number(item.quantity) || 1)));
    if (price < 0) continue;
    subtotal += price * qty;
    itemCount += qty;
  }

  subtotal = round2(subtotal);
  const shipping = calculateShipping(subtotal, shippingMethod || 'standard');
  const taxRate = TAX_RATES[(state || '').toUpperCase().trim()] || TAX_RATES.DEFAULT;
  const tax = round2(subtotal * taxRate);
  const total = round2(subtotal + shipping.amount + tax);

  return { subtotal, itemCount, shipping, tax, taxRate, total };
}

function addBusinessDays(startDate, days) {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
