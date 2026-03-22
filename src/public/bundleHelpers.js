/**
 * @module bundleHelpers
 * @description Pure cart utilities for bundle cohesion display and validation.
 * No Wix dependencies — safe to use in both frontend pages and backend modules.
 *
 * Bundle items are tagged via customTextFields: [{ title: 'bundleTag', value: 'bundle:<id>' }]
 * so that all 3 components (frame + mattress + cover) can be grouped in the cart UI.
 */

/**
 * Expected number of components in a complete bundle (frame + mattress + cover).
 * Exported so bundleService.web.js can share the same source of truth.
 */
export const BUNDLE_COMPONENT_COUNT = 3;

/**
 * Generate the bundleTag value for a given bundleId.
 * Returns 'bundle:null' / 'bundle:undefined' if bundleId is null/undefined —
 * callers should validate bundleId before calling.
 * @param {string} bundleId
 * @returns {string} e.g. 'bundle:bundle-001'
 */
export function getBundleTag(bundleId) {
  return `bundle:${bundleId}`;
}

/**
 * Extract the bundleTag from a cart line item's customTextFields.
 * @param {Object} lineItem - Cart line item
 * @returns {string|null} bundleTag value or null if not a bundle item
 */
export function extractBundleTag(lineItem) {
  const fields = lineItem?.customTextFields;
  if (!Array.isArray(fields)) return null;
  const field = fields.find(f => f.title === 'bundleTag');
  return field ? field.value : null;
}

/**
 * Group cart line items by bundleTag, excluding non-bundle items.
 * @param {Object[]} cartItems - Cart line items
 * @returns {Object<string, Object[]>} Map of bundleTag → line items
 */
export function groupBundleItems(cartItems) {
  const groups = {};
  for (const item of cartItems) {
    const tag = extractBundleTag(item);
    if (!tag) continue;
    if (!groups[tag]) groups[tag] = [];
    groups[tag].push(item);
  }
  return groups;
}

/**
 * Find bundles in the cart that are missing components.
 * A complete bundle has exactly {@link BUNDLE_COMPONENT_COUNT} items with the same tag.
 *
 * Note: this function returns { bundleTag, componentCount, expectedCount } only.
 * The backend's validateBundleCohesion adds a human-readable `message` field on top.
 *
 * @param {Object[]} cartItems - Cart line items
 * @returns {Array<{bundleTag: string, componentCount: number, expectedCount: number}>}
 */
export function findBrokenBundles(cartItems) {
  const groups = groupBundleItems(cartItems);
  const broken = [];
  for (const [bundleTag, items] of Object.entries(groups)) {
    if (items.length < BUNDLE_COMPONENT_COUNT) {
      broken.push({
        bundleTag,
        componentCount: items.length,
        expectedCount: BUNDLE_COMPONENT_COUNT,
      });
    }
  }
  return broken;
}

/**
 * Format bundle savings for display.
 * @param {{ savings: number, bundlePrice: number }} bundle
 * @returns {string} e.g. 'Save $75 (12% off)' or 'Bundle price' when savings <= 0
 */
export function formatBundleSavings({ savings, bundlePrice }) {
  if (!savings || savings <= 0) return 'Bundle price';
  const originalPrice = bundlePrice + savings;
  const pct = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;
  return `Save $${savings} (${pct}% off)`;
}
