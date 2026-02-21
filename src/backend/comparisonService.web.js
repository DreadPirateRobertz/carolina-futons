/**
 * @module comparisonService
 * @description Product comparison data service.
 * Fetches full product details for side-by-side comparison,
 * builds category-specific spec rows, computes winner badges,
 * and flags cells that differ between compared products.
 *
 * @requires wix-web-module
 * @requires wix-data
 * @requires backend/utils/sanitize
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { validateId } from 'backend/utils/sanitize';

const MAX_COMPARE = 4;

// Category-specific attribute definitions
const CATEGORY_ATTRIBUTES = {
  'futon-frames': [
    { key: 'featureTags', label: 'Features', format: 'tags' },
    { key: 'material', label: 'Frame Material', format: 'text' },
    { key: 'options.finish', label: 'Finish', format: 'text' },
    { key: 'options.size', label: 'Size', format: 'text' },
  ],
  'mattresses': [
    { key: 'material', label: 'Cover Material', format: 'text' },
    { key: 'options.size', label: 'Size', format: 'text' },
    { key: 'options.comfort', label: 'Comfort Level', format: 'text' },
  ],
  'murphy-cabinet-beds': [
    { key: 'material', label: 'Cabinet Material', format: 'text' },
    { key: 'featureTags', label: 'Features', format: 'tags' },
  ],
  'platform-beds': [
    { key: 'material', label: 'Frame Material', format: 'text' },
    { key: 'featureTags', label: 'Features', format: 'tags' },
  ],
  'casegoods-accessories': [
    { key: 'material', label: 'Material', format: 'text' },
    { key: 'color', label: 'Color', format: 'text' },
  ],
  'outdoor': [
    { key: 'material', label: 'Material', format: 'text' },
    { key: 'featureTags', label: 'Features', format: 'tags' },
  ],
};

// Common attributes shown for all products
const COMMON_ATTRIBUTES = [
  { key: 'brand', label: 'Brand', format: 'text' },
  { key: 'material', label: 'Material', format: 'text' },
  { key: 'color', label: 'Color', format: 'text' },
  { key: 'dimensions', label: 'Dimensions (W x D x H)', format: 'dimensions' },
  { key: 'featureTags', label: 'Features', format: 'tags' },
  { key: 'inStock', label: 'Availability', format: 'stock' },
];

// ─── getComparisonData ───────────────────────────────────────────

/**
 * Fetch full product data for comparison. Returns comparison rows,
 * winner badges, and diff highlighting.
 *
 * @param {string[]} productIds - Array of 2-4 product IDs
 * @returns {Promise<Object>} Comparison data
 */
export const getComparisonData = webMethod(
  Permissions.Anyone,
  async (productIds) => {
    try {
      if (!Array.isArray(productIds) || productIds.length < 2) {
        return { success: false, error: 'At least 2 products required' };
      }

      const validIds = productIds
        .slice(0, MAX_COMPARE)
        .map(id => validateId(id))
        .filter(Boolean);

      if (validIds.length < 2) {
        return { success: false, error: 'At least 2 valid product IDs required' };
      }

      // Fetch products
      const result = await wixData.query('Stores/Products')
        .hasSome('_id', validIds)
        .limit(MAX_COMPARE)
        .find();

      const products = result.items;
      if (products.length < 2) {
        return { success: false, error: 'Could not find enough products' };
      }

      // Preserve requested order
      const ordered = validIds
        .map(id => products.find(p => p._id === id))
        .filter(Boolean);

      // Determine shared category (if any)
      const sharedCategory = findSharedCategory(ordered);

      // Build spec rows
      const rows = buildComparisonRows(ordered, sharedCategory);

      // Compute winner badges
      const badges = computeWinnerBadges(ordered);

      // Build product summaries
      const summaries = ordered.map(p => ({
        _id: p._id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        formattedPrice: p.formattedPrice,
        discountedPrice: p.discountedPrice || null,
        formattedDiscountedPrice: p.formattedDiscountedPrice || null,
        mainMedia: p.mainMedia,
        ribbon: p.ribbon || '',
        inStock: p.inStock !== false,
        numericRating: p.numericRating || null,
        numReviews: p.numReviews || 0,
        collections: p.collections || [],
      }));

      return {
        success: true,
        products: summaries,
        rows,
        badges,
        sharedCategory,
      };
    } catch (err) {
      console.error('[comparisonService] Error fetching comparison data:', err);
      return { success: false, error: 'Failed to load comparison data' };
    }
  }
);

// ─── Internal helpers ────────────────────────────────────────────

/**
 * Find the first category shared by all products, or null.
 */
function findSharedCategory(products) {
  if (!products.length) return null;
  const firstCols = products[0].collections || [];
  for (const col of firstCols) {
    if (products.every(p => (p.collections || []).includes(col))) {
      return col;
    }
  }
  return null;
}

/**
 * Resolve a nested key path like 'options.size' from a product object.
 */
function getNestedValue(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Format a cell value based on the attribute's format type.
 */
function formatValue(value, format) {
  if (value === undefined || value === null) return '—';

  switch (format) {
    case 'text':
      return String(value);
    case 'tags':
      return Array.isArray(value) ? (value.length ? value.join(', ') : '—') : String(value);
    case 'dimensions':
      if (typeof value === 'object' && value.width != null) {
        return `${value.width}" × ${value.depth}" × ${value.height}"`;
      }
      return '—';
    case 'stock':
      return value ? 'In Stock' : 'Out of Stock';
    case 'price':
      return typeof value === 'number' ? `$${value.toFixed(2)}` : String(value);
    case 'rating':
      return typeof value === 'number' ? `${value}/5` : '—';
    default:
      return String(value);
  }
}

/**
 * Build comparison rows from products. Uses category-specific attributes
 * when all products share a category, otherwise falls back to common attributes.
 */
function buildComparisonRows(products, sharedCategory) {
  // Always include price and rating rows first
  const rows = [];

  // Price row
  const priceRow = {
    label: 'Price',
    cells: products.map(p => ({
      value: p.formattedDiscountedPrice || p.formattedPrice,
      raw: p.discountedPrice || p.price,
    })),
    differs: false,
  };
  priceRow.differs = hasDifferences(priceRow.cells.map(c => c.raw));
  rows.push(priceRow);

  // Rating row
  const ratingRow = {
    label: 'Rating',
    cells: products.map(p => ({
      value: p.numericRating ? `${p.numericRating}/5 (${p.numReviews || 0} reviews)` : 'No reviews',
      raw: p.numericRating || 0,
    })),
    differs: false,
  };
  ratingRow.differs = hasDifferences(ratingRow.cells.map(c => c.raw));
  rows.push(ratingRow);

  // Select attribute set
  let attributes;
  if (sharedCategory && CATEGORY_ATTRIBUTES[sharedCategory]) {
    attributes = CATEGORY_ATTRIBUTES[sharedCategory];
  } else {
    attributes = COMMON_ATTRIBUTES;
  }

  // Build rows for each attribute
  for (const attr of attributes) {
    const cells = products.map(p => {
      const raw = getNestedValue(p, attr.key);
      return {
        value: formatValue(raw, attr.format),
        raw,
      };
    });

    const differs = hasDifferences(cells.map(c => JSON.stringify(c.raw)));
    rows.push({ label: attr.label, cells, differs });
  }

  return rows;
}

/**
 * Check if values differ across cells.
 */
function hasDifferences(values) {
  if (values.length < 2) return false;
  const first = values[0];
  return values.some(v => v !== first);
}

/**
 * Compute winner badges: best value, best rated, most popular.
 */
function computeWinnerBadges(products) {
  const badges = {};

  // Best value: lowest effective price
  const withPrices = products.filter(p => typeof p.price === 'number');
  if (withPrices.length >= 2) {
    const sorted = [...withPrices].sort((a, b) => {
      const aPrice = a.discountedPrice || a.price;
      const bPrice = b.discountedPrice || b.price;
      return aPrice - bPrice;
    });
    badges.bestValue = sorted[0]._id;
  }

  // Best rated: highest numericRating
  const withRatings = products.filter(p => typeof p.numericRating === 'number' && p.numericRating > 0);
  if (withRatings.length >= 2) {
    const sorted = [...withRatings].sort((a, b) => b.numericRating - a.numericRating);
    badges.bestRated = sorted[0]._id;
  }

  // Most popular: highest numReviews (proxy for popularity)
  const withReviews = products.filter(p => typeof p.numReviews === 'number' && p.numReviews > 0);
  if (withReviews.length >= 2) {
    const sorted = [...withReviews].sort((a, b) => b.numReviews - a.numReviews);
    badges.mostPopular = sorted[0]._id;
  }

  return badges;
}

// ─── buildShareableUrl ───────────────────────────────────────────

/**
 * Build a shareable comparison URL from product IDs.
 *
 * @param {string[]} productIds - Array of product IDs
 * @returns {string} URL path with product IDs as query params
 */
export const buildShareableUrl = webMethod(
  Permissions.Anyone,
  async (productIds) => {
    try {
      if (!Array.isArray(productIds) || productIds.length < 2) return '';
      const validIds = productIds.slice(0, MAX_COMPARE).map(id => validateId(id)).filter(Boolean);
      if (validIds.length < 2) return '';
      return `/compare?ids=${validIds.join(',')}`;
    } catch (err) {
      return '';
    }
  }
);

// Exported for testing
export { findSharedCategory, buildComparisonRows, computeWinnerBadges, formatValue, hasDifferences, getNestedValue, CATEGORY_ATTRIBUTES, COMMON_ATTRIBUTES, MAX_COMPARE };
