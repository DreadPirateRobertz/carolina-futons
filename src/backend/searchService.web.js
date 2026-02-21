/**
 * @module searchService
 * @description Faceted search and filtering engine for category pages.
 * Provides server-side product queries with filter value aggregation,
 * price range buckets, dimension ranges, material/color/feature facets.
 *
 * Frontend calls these methods via debounced filter controls; results
 * include both filtered products and available facet values with counts.
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateSlug } from 'backend/utils/sanitize';

// ─── Filter Value Cache ──────────────────────────────────────────
// In-memory cache of available filter values per category.
// TTL-based: refreshed when stale or on cache miss.

const _cache = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(category) {
  return `facets:${category || 'all'}`;
}

function getCachedFacets(category) {
  const key = getCacheKey(category);
  const entry = _cache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    delete _cache[key];
    return null;
  }
  return entry.data;
}

function setCachedFacets(category, data) {
  _cache[getCacheKey(category)] = { data, timestamp: Date.now() };
}

// Exported for testing
export function __clearCache() {
  Object.keys(_cache).forEach(k => delete _cache[k]);
}

// ─── Price Range Buckets ─────────────────────────────────────────

const PRICE_RANGES = [
  { label: 'Under $300', min: 0, max: 299.99, key: '0-300' },
  { label: '$300 – $500', min: 300, max: 500, key: '300-500' },
  { label: '$500 – $800', min: 500, max: 800, key: '500-800' },
  { label: '$800 – $1,200', min: 800, max: 1200, key: '800-1200' },
  { label: 'Over $1,200', min: 1200, max: Infinity, key: '1200-up' },
];

// ─── Feature Tags ────────────────────────────────────────────────

const KNOWN_FEATURES = [
  'wall-hugger', 'sleeper', 'outdoor', 'storage', 'reclining',
  'usb-charging', 'made-in-usa', 'eco-friendly',
];

// ─── searchProducts ──────────────────────────────────────────────

/**
 * Search products with faceted filters. Returns filtered product list
 * plus available facet values with counts for the active category.
 *
 * @param {Object} params
 * @param {string} [params.category] - Category slug to filter by
 * @param {string} [params.priceRange] - Price range key (e.g. '300-500')
 * @param {string} [params.material] - Material filter value
 * @param {string} [params.color] - Color filter value
 * @param {string[]} [params.features] - Feature tag filters
 * @param {number[]} [params.widthRange] - [min, max] width in inches
 * @param {number[]} [params.depthRange] - [min, max] depth in inches
 * @param {string} [params.sortBy] - Sort field (price-asc, price-desc, name-asc, name-desc, newest, bestselling)
 * @param {number} [params.limit] - Max results (default 50)
 * @param {number} [params.offset] - Skip N results (default 0)
 * @returns {Promise<{products: Object[], total: number, facets: Object}>}
 */
export const searchProducts = webMethod(
  Permissions.Anyone,
  async (params = {}) => {
    try {
      const {
        category,
        priceRange,
        material,
        color,
        features,
        widthRange,
        depthRange,
        sortBy = 'bestselling',
        limit = 50,
        offset = 0,
      } = params;

      // Build query
      let query = wixData.query('Stores/Products');

      // Category filter
      const cleanCategory = category ? validateSlug(category) : '';
      if (cleanCategory) {
        query = query.hasSome('collections', [cleanCategory]);
      }

      // Price range filter
      if (priceRange) {
        const range = PRICE_RANGES.find(r => r.key === priceRange);
        if (range) {
          query = query.ge('price', range.min);
          if (range.max !== Infinity) {
            query = query.le('price', range.max);
          }
        }
      }

      // Material filter
      if (material) {
        const cleanMaterial = sanitize(material, 100);
        if (cleanMaterial) {
          query = query.eq('material', cleanMaterial);
        }
      }

      // Color filter
      if (color) {
        const cleanColor = sanitize(color, 50);
        if (cleanColor) {
          query = query.eq('color', cleanColor);
        }
      }

      // Feature tag filters (AND logic — must have all selected features)
      if (Array.isArray(features) && features.length > 0) {
        const validFeatures = features.filter(f => KNOWN_FEATURES.includes(f));
        for (const feature of validFeatures) {
          query = query.hasSome('featureTags', [feature]);
        }
      }

      // Dimension range filters
      if (Array.isArray(widthRange) && widthRange.length === 2) {
        const [minW, maxW] = widthRange.map(Number);
        if (!isNaN(minW)) query = query.ge('width', minW);
        if (!isNaN(maxW)) query = query.le('width', maxW);
      }

      if (Array.isArray(depthRange) && depthRange.length === 2) {
        const [minD, maxD] = depthRange.map(Number);
        if (!isNaN(minD)) query = query.ge('depth', minD);
        if (!isNaN(maxD)) query = query.le('depth', maxD);
      }

      // Sorting
      switch (sortBy) {
        case 'price-asc':
          query = query.ascending('price');
          break;
        case 'price-desc':
          query = query.descending('price');
          break;
        case 'name-asc':
          query = query.ascending('name');
          break;
        case 'name-desc':
          query = query.descending('name');
          break;
        case 'newest':
          query = query.descending('_createdDate');
          break;
        case 'bestselling':
        default:
          query = query.descending('numericRating');
          break;
      }

      // Pagination
      const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 100);
      const safeOffset = Math.max(0, Number(offset) || 0);

      const results = await query.skip(safeOffset).limit(safeLimit).find();

      const products = results.items.map(item => ({
        _id: item._id,
        name: item.name,
        slug: item.slug,
        price: item.price,
        formattedPrice: item.formattedPrice,
        discountedPrice: item.discountedPrice,
        formattedDiscountedPrice: item.formattedDiscountedPrice,
        mainMedia: item.mainMedia,
        ribbon: item.ribbon,
        collections: item.collections,
        material: item.material,
        color: item.color,
        featureTags: item.featureTags,
        width: item.width,
        depth: item.depth,
        inStock: item.inStock,
        numericRating: item.numericRating,
      }));

      // Build facets for current category
      const facets = await buildFacets(cleanCategory);

      return {
        products,
        total: results.totalCount,
        facets,
      };
    } catch (err) {
      console.error('Error in searchProducts:', err);
      return { products: [], total: 0, facets: {} };
    }
  }
);

// ─── getFilterValues ─────────────────────────────────────────────

/**
 * Get available filter values for a category (cached).
 * Used to populate filter UI before the user makes any selections.
 *
 * @param {string} [category] - Category slug
 * @returns {Promise<Object>} Facet values with counts
 */
export const getFilterValues = webMethod(
  Permissions.Anyone,
  async (category = '') => {
    try {
      const cleanCategory = category ? validateSlug(category) : '';
      return await buildFacets(cleanCategory);
    } catch (err) {
      console.error('Error in getFilterValues:', err);
      return {
        priceRanges: [],
        materials: [],
        colors: [],
        features: [],
        dimensions: { width: { min: 0, max: 0 }, depth: { min: 0, max: 0 } },
      };
    }
  }
);

// ─── buildFacets (internal) ──────────────────────────────────────

async function buildFacets(category) {
  // Check cache first
  const cached = getCachedFacets(category);
  if (cached) return cached;

  let query = wixData.query('Stores/Products');
  if (category) {
    query = query.hasSome('collections', [category]);
  }

  const allResults = await query.limit(1000).find();
  const items = allResults.items;

  // Price range counts
  const priceRanges = PRICE_RANGES.map(range => ({
    ...range,
    count: items.filter(item => {
      const p = item.price || 0;
      return p >= range.min && (range.max === Infinity ? true : p <= range.max);
    }).length,
  }));

  // Material counts
  const materialCounts = {};
  for (const item of items) {
    if (item.material) {
      materialCounts[item.material] = (materialCounts[item.material] || 0) + 1;
    }
  }
  const materials = Object.entries(materialCounts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);

  // Color counts
  const colorCounts = {};
  for (const item of items) {
    if (item.color) {
      colorCounts[item.color] = (colorCounts[item.color] || 0) + 1;
    }
  }
  const colors = Object.entries(colorCounts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);

  // Feature tag counts
  const featureCounts = {};
  for (const item of items) {
    if (Array.isArray(item.featureTags)) {
      for (const tag of item.featureTags) {
        if (KNOWN_FEATURES.includes(tag)) {
          featureCounts[tag] = (featureCounts[tag] || 0) + 1;
        }
      }
    }
  }
  const featuresList = Object.entries(featureCounts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);

  // Dimension ranges
  const widths = items.map(i => i.width).filter(w => typeof w === 'number');
  const depths = items.map(i => i.depth).filter(d => typeof d === 'number');

  const dimensions = {
    width: {
      min: widths.length > 0 ? Math.min(...widths) : 0,
      max: widths.length > 0 ? Math.max(...widths) : 0,
    },
    depth: {
      min: depths.length > 0 ? Math.min(...depths) : 0,
      max: depths.length > 0 ? Math.max(...depths) : 0,
    },
  };

  const facets = {
    priceRanges,
    materials,
    colors,
    features: featuresList,
    dimensions,
    totalProducts: items.length,
  };

  setCachedFacets(category, facets);
  return facets;
}
