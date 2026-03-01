/**
 * SearchResultsHelpers.js — Helpers for Search Results page polish
 *
 * Skeleton data generation, active filter counting, search chip building.
 * Extracted to keep Search Results.js focused on page orchestration.
 *
 * CF-z5tk: Search Results page polish
 *
 * @module SearchResultsHelpers
 */

/**
 * Generate skeleton placeholder items for the product grid loading state.
 * @param {number} [count=8] - Number of skeleton items
 * @returns {Array<{_id: string, isSkeleton: boolean}>}
 */
export function buildSkeletonData(count = 8) {
  if (!count || count <= 0) return [];
  return Array.from({ length: count }, (_, i) => ({
    _id: `skeleton-${i}`,
    isSkeleton: true,
    name: '',
    formattedPrice: '',
    mainMedia: '',
  }));
}

/**
 * Count how many filters are currently active.
 * @param {Object} filters - Filter state object
 * @returns {number}
 */
export function getActiveFilterCount(filters) {
  if (!filters) return 0;
  return ['category', 'priceRange', 'material', 'color'].filter(
    key => filters[key] && filters[key] !== ''
  ).length;
}

/**
 * Build clickable search chip data from query strings.
 * @param {string[]} queries - Search query strings
 * @param {number} [maxChips=8] - Maximum chips to return
 * @returns {Array<{_id: string, label: string, query: string}>}
 */
export function buildSearchChips(queries, maxChips = 8) {
  if (!queries || !Array.isArray(queries)) return [];
  return queries.slice(0, maxChips).map((q, i) => ({
    _id: `chip-${i}`,
    label: q,
    query: q,
  }));
}
