/**
 * @module sizeGuide
 * @description Product dimension data service and room fit calculation logic.
 * Provides dimension data for products (open and closed positions),
 * unit conversion (in/cm), and room fit checks against doorways,
 * hallways, and room dimensions.
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';

const CM_PER_INCH = 2.54;
const TIGHT_FIT_THRESHOLD = 2; // inches — warn when clearance < 2"

// ─── getProductDimensions ────────────────────────────────────────

/**
 * Get dimensions for a product in both open and closed positions.
 * Returns null if the product has no dimension data.
 *
 * @param {string} productId - Wix product ID
 * @param {string} [unit='in'] - 'in' for inches, 'cm' for centimeters
 * @returns {Promise<Object|null>} Dimension data or null
 */
export const getProductDimensions = webMethod(
  Permissions.Anyone,
  async (productId, unit = 'in') => {
    try {
      if (!productId) return null;

      const result = await wixData.query('ProductDimensions')
        .eq('productId', productId)
        .limit(1)
        .find();

      if (result.items.length === 0) return null;

      const dims = result.items[0];
      const convert = (val) => {
        if (typeof val !== 'number') return null;
        return unit === 'cm' ? Math.round(val * CM_PER_INCH * 10) / 10 : val;
      };

      // Shipping/box dimensions (if available in CMS)
      const hasShipping = typeof dims.shippingWidth === 'number'
        || typeof dims.shippingDepth === 'number'
        || typeof dims.shippingHeight === 'number';

      return {
        productId: dims.productId,
        unit: unit === 'cm' ? 'cm' : 'in',
        closed: {
          width: convert(dims.closedWidth),
          depth: convert(dims.closedDepth),
          height: convert(dims.closedHeight),
        },
        open: {
          width: convert(dims.openWidth),
          depth: convert(dims.openDepth),
          height: convert(dims.openHeight),
        },
        shipping: hasShipping ? {
          width: convert(dims.shippingWidth),
          depth: convert(dims.shippingDepth),
          height: convert(dims.shippingHeight),
          weight: dims.shippingWeight || null,
        } : null,
        weight: dims.weight || null,
        seatHeight: convert(dims.seatHeight),
        mattressSize: dims.mattressSize || null,
      };
    } catch (err) {
      console.error('Error fetching product dimensions:', err);
      return null;
    }
  }
);

// ─── checkRoomFit ────────────────────────────────────────────────

/**
 * Check whether a product fits through doorways/hallways and into a room.
 * Returns fit status for each check with clearance amounts.
 *
 * @param {string} productId - Wix product ID
 * @param {Object} roomDims - Customer's room measurements (in inches)
 * @param {number} [roomDims.doorwayWidth] - Doorway width
 * @param {number} [roomDims.doorwayHeight] - Doorway height
 * @param {number} [roomDims.hallwayWidth] - Hallway width
 * @param {number} [roomDims.roomWidth] - Room width
 * @param {number} [roomDims.roomDepth] - Room depth
 * @returns {Promise<Object>} Fit check results
 */
export const checkRoomFit = webMethod(
  Permissions.Anyone,
  async (productId, roomDims = {}) => {
    try {
      if (!productId) {
        return { success: false, error: 'Product ID required' };
      }

      const result = await wixData.query('ProductDimensions')
        .eq('productId', productId)
        .limit(1)
        .find();

      if (result.items.length === 0) {
        return { success: false, error: 'No dimension data available for this product' };
      }

      const dims = result.items[0];
      const checks = [];

      // Doorway fit check — product must fit through on its side or upright
      if (typeof roomDims.doorwayWidth === 'number' && typeof roomDims.doorwayHeight === 'number') {
        const productPassDims = getSmallestPassThroughDims(dims);
        const doorFit = checkPassThrough(
          productPassDims,
          roomDims.doorwayWidth,
          roomDims.doorwayHeight
        );
        checks.push({
          check: 'doorway',
          fits: doorFit.fits,
          clearanceWidth: doorFit.clearanceWidth,
          clearanceHeight: doorFit.clearanceHeight,
          tight: doorFit.fits && (doorFit.clearanceWidth < TIGHT_FIT_THRESHOLD || doorFit.clearanceHeight < TIGHT_FIT_THRESHOLD),
        });
      }

      // Hallway fit check — width matters most
      if (typeof roomDims.hallwayWidth === 'number') {
        const minProductWidth = Math.min(
          dims.closedWidth || Infinity,
          dims.closedDepth || Infinity
        );
        const clearance = roomDims.hallwayWidth - minProductWidth;
        checks.push({
          check: 'hallway',
          fits: clearance >= 0,
          clearance,
          tight: clearance >= 0 && clearance < TIGHT_FIT_THRESHOLD,
        });
      }

      // Room fit check — product in open position must fit in room
      if (typeof roomDims.roomWidth === 'number' && typeof roomDims.roomDepth === 'number') {
        const openWidth = dims.openWidth || dims.closedWidth || 0;
        const openDepth = dims.openDepth || dims.closedDepth || 0;

        // Try both orientations
        const fit1 = {
          widthClearance: roomDims.roomWidth - openWidth,
          depthClearance: roomDims.roomDepth - openDepth,
        };
        const fit2 = {
          widthClearance: roomDims.roomWidth - openDepth,
          depthClearance: roomDims.roomDepth - openWidth,
        };

        // Pick the best orientation
        const best = (fit1.widthClearance >= 0 && fit1.depthClearance >= 0) ? fit1
          : (fit2.widthClearance >= 0 && fit2.depthClearance >= 0) ? fit2
          : fit1; // default to first even if it doesn't fit

        const fits = best.widthClearance >= 0 && best.depthClearance >= 0;
        checks.push({
          check: 'room',
          fits,
          clearanceWidth: best.widthClearance,
          clearanceDepth: best.depthClearance,
          tight: fits && (best.widthClearance < TIGHT_FIT_THRESHOLD || best.depthClearance < TIGHT_FIT_THRESHOLD),
        });
      }

      const allFit = checks.every(c => c.fits);
      const anyTight = checks.some(c => c.tight);

      return {
        success: true,
        allFit,
        anyTight,
        checks,
      };
    } catch (err) {
      console.error('Error checking room fit:', err);
      return { success: false, error: 'Failed to check room fit' };
    }
  }
);

// ─── getDimensionsByCategory ─────────────────────────────────────

/**
 * Get dimension summary for all products in a category (for size guide pages).
 *
 * @param {string} category - Category slug
 * @returns {Promise<Object[]>} Array of dimension summaries
 */
export const getDimensionsByCategory = webMethod(
  Permissions.Anyone,
  async (category) => {
    try {
      if (!category) return [];

      const productResults = await wixData.query('Stores/Products')
        .hasSome('collections', [category])
        .limit(100)
        .find();

      if (productResults.items.length === 0) return [];

      const productIds = productResults.items.map(p => p._id);
      const dimResults = await wixData.query('ProductDimensions')
        .hasSome('productId', productIds)
        .limit(100)
        .find();

      const dimMap = {};
      for (const d of dimResults.items) {
        dimMap[d.productId] = d;
      }

      return productResults.items.map(product => {
        const dims = dimMap[product._id];
        return {
          productId: product._id,
          name: product.name,
          slug: product.slug,
          hasDimensions: !!dims,
          closedWidth: dims?.closedWidth || null,
          closedDepth: dims?.closedDepth || null,
          closedHeight: dims?.closedHeight || null,
          openWidth: dims?.openWidth || null,
          openDepth: dims?.openDepth || null,
          openHeight: dims?.openHeight || null,
          weight: dims?.weight || null,
          mattressSize: dims?.mattressSize || null,
        };
      });
    } catch (err) {
      console.error('Error fetching category dimensions:', err);
      return [];
    }
  }
);

// ─── getComparisonTable ──────────────────────────────────────────

/**
 * Get a dimension comparison table for products in the same category.
 * Returns the current product's dimensions alongside similar products
 * for side-by-side size comparison.
 *
 * @param {string} productId - Wix product ID
 * @param {string} [unit='in'] - 'in' for inches, 'cm' for centimeters
 * @param {number} [limit=5] - Max number of similar products to include
 * @returns {Promise<Object>} Comparison table data
 * @permission Anyone — public product info
 */
export const getComparisonTable = webMethod(
  Permissions.Anyone,
  async (productId, unit = 'in', limit = 5) => {
    try {
      if (!productId) {
        return { success: false, error: 'Product ID required' };
      }

      // Get the current product to find its category
      const productResult = await wixData.query('Stores/Products')
        .eq('_id', productId)
        .limit(1)
        .find();

      if (productResult.items.length === 0) {
        return { success: false, error: 'Product not found' };
      }

      const product = productResult.items[0];
      const category = (product.collections || [])[0];
      if (!category) {
        return { success: false, error: 'Product has no category' };
      }

      // Get all products in the same category
      const categoryProducts = await wixData.query('Stores/Products')
        .hasSome('collections', [category])
        .limit(100)
        .find();

      if (categoryProducts.items.length === 0) {
        return { success: true, category, products: [], columns: [] };
      }

      const categoryProductIds = categoryProducts.items.map(p => p._id);
      const dimResults = await wixData.query('ProductDimensions')
        .hasSome('productId', categoryProductIds)
        .limit(100)
        .find();

      const dimMap = {};
      for (const d of dimResults.items) {
        dimMap[d.productId] = d;
      }

      // Build rows: current product first, then others with dimensions
      const convert = (val) => {
        if (typeof val !== 'number') return null;
        return unit === 'cm' ? Math.round(val * CM_PER_INCH * 10) / 10 : val;
      };

      const buildEntry = (prod, dims) => ({
        productId: prod._id,
        name: prod.name,
        slug: prod.slug,
        isCurrent: prod._id === productId,
        closed: dims ? {
          width: convert(dims.closedWidth),
          depth: convert(dims.closedDepth),
          height: convert(dims.closedHeight),
        } : null,
        open: dims ? {
          width: convert(dims.openWidth),
          depth: convert(dims.openDepth),
          height: convert(dims.openHeight),
        } : null,
        weight: dims?.weight || null,
        mattressSize: dims?.mattressSize || null,
      });

      // Current product first
      const currentDims = dimMap[productId];
      const entries = [buildEntry(product, currentDims)];

      // Add similar products (those with dimension data, excluding current)
      const safeLimit = Math.min(Math.max(1, limit), 10);
      const others = categoryProducts.items
        .filter(p => p._id !== productId && dimMap[p._id])
        .slice(0, safeLimit);

      for (const p of others) {
        entries.push(buildEntry(p, dimMap[p._id]));
      }

      return {
        success: true,
        category,
        unit: unit === 'cm' ? 'cm' : 'in',
        products: entries,
      };
    } catch (err) {
      console.error('Error building comparison table:', err);
      return { success: false, error: 'Failed to build comparison table' };
    }
  }
);

// ─── convertUnit ─────────────────────────────────────────────────

/**
 * Convert a value between inches and centimeters.
 * Exported for frontend use.
 *
 * @param {number} value - The value to convert
 * @param {string} from - 'in' or 'cm'
 * @param {string} to - 'in' or 'cm'
 * @returns {number} Converted value (rounded to 1 decimal)
 */
export const convertUnit = webMethod(
  Permissions.Anyone,
  (value, from, to) => {
    if (typeof value !== 'number' || isNaN(value)) return 0;
    if (from === to) return value;
    if (from === 'in' && to === 'cm') return Math.round(value * CM_PER_INCH * 10) / 10;
    if (from === 'cm' && to === 'in') return Math.round((value / CM_PER_INCH) * 10) / 10;
    return value;
  }
);

// ─── Internal helpers ────────────────────────────────────────────

/**
 * Get the smallest pass-through dimensions for a product.
 * For delivery, the product can be rotated to find the best orientation.
 */
function getSmallestPassThroughDims(dims) {
  const w = dims.closedWidth || 0;
  const d = dims.closedDepth || 0;
  const h = dims.closedHeight || 0;
  const sorted = [w, d, h].sort((a, b) => a - b);
  return { width: sorted[0], height: sorted[1], length: sorted[2] };
}

/**
 * Check if product fits through an opening (doorway/hallway).
 * The product's two smallest dimensions must fit the opening.
 */
function checkPassThrough(productDims, openingWidth, openingHeight) {
  const clearanceWidth = openingWidth - productDims.width;
  const clearanceHeight = openingHeight - productDims.height;
  return {
    fits: clearanceWidth >= 0 && clearanceHeight >= 0,
    clearanceWidth,
    clearanceHeight,
  };
}
