/**
 * @module categorySearch
 * @description Backend service for advanced product search and multi-faceted
 * filtering on category pages. Provides query building, facet metadata with
 * cached counts, and filter relaxation suggestions for zero-result states.
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize } from 'backend/utils/sanitize';

// ── Facet metadata cache ────────────────────────────────────────────
// Caches available filter values per category to avoid re-querying on every
// page load. TTL-based: entries expire after CACHE_TTL_MS milliseconds.

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const _facetCache = new Map();

function getCachedFacets(category) {
  const entry = _facetCache.get(category);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    _facetCache.delete(category);
    return null;
  }
  return entry.data;
}

function setCachedFacets(category, data) {
  _facetCache.set(category, { data, timestamp: Date.now() });
}

// Exported for testing only
export function __clearCache() {
  _facetCache.clear();
}

// ── Sort map ────────────────────────────────────────────────────────

const SORT_OPTIONS = {
  'bestselling': { field: 'numericRating', dir: 'desc' },
  'name-asc': { field: 'name', dir: 'asc' },
  'name-desc': { field: 'name', dir: 'desc' },
  'price-asc': { field: 'price', dir: 'asc' },
  'price-desc': { field: 'price', dir: 'desc' },
  'date-desc': { field: '_createdDate', dir: 'desc' },
  'rating-desc': { field: 'numericRating', dir: 'desc' },
};

// ── searchProducts ──────────────────────────────────────────────────

/**
 * Full-text product search with multi-faceted filtering. Supports category,
 * text query, price range, materials, colors, feature tags, brands,
 * dimension ranges, stock status, and sort order. All string inputs are
 * sanitized. Pagination is capped at 100 items per page.
 *
 * Queries CMS: Stores/Products
 *
 * @param {Object} [params={}] - Search and filter parameters.
 * @param {string}   [params.category]     - Collection slug to filter by.
 * @param {string}   [params.searchQuery]  - Free-text search (matched against product name).
 * @param {number}   [params.priceMin]     - Minimum price (inclusive).
 * @param {number}   [params.priceMax]     - Maximum price (inclusive).
 * @param {string[]} [params.materials]    - Material values to include (multi-select OR).
 * @param {string[]} [params.colors]       - Color values to include.
 * @param {string[]} [params.featureTags]  - Feature tag values to include.
 * @param {string[]} [params.brands]       - Brand names to include.
 * @param {number}   [params.widthMin]     - Minimum width in inches.
 * @param {number}   [params.widthMax]     - Maximum width in inches.
 * @param {number}   [params.depthMin]     - Minimum depth in inches.
 * @param {number}   [params.depthMax]     - Maximum depth in inches.
 * @param {number}   [params.heightMin]    - Minimum height in inches.
 * @param {number}   [params.heightMax]    - Maximum height in inches.
 * @param {boolean}  [params.inStockOnly]  - When true, exclude out-of-stock items.
 * @param {string}   [params.sort='bestselling'] - Sort key (see SORT_OPTIONS).
 * @param {number}   [params.limit=50]     - Page size (max 100).
 * @param {number}   [params.skip=0]       - Offset for pagination.
 * @returns {Promise<{items: Object[], totalCount: number, hasMore: boolean}>}
 * @permission Permissions.Anyone
 */
export const searchProducts = webMethod(
  Permissions.Anyone,
  async (params = {}) => {
    try {
      const {
        category,
        searchQuery,
        priceMin,
        priceMax,
        materials,
        colors,
        featureTags,
        brands,
        widthMin,
        widthMax,
        depthMin,
        depthMax,
        heightMin,
        heightMax,
        inStockOnly,
        sort = 'bestselling',
        limit = 50,
        skip = 0,
      } = params;

      let query = wixData.query('Stores/Products');

      // Category filter
      if (category) {
        const cleanCategory = sanitize(category, 100);
        if (cleanCategory) {
          query = query.hasSome('collections', [cleanCategory]);
        }
      }

      // Text search across name and description
      if (searchQuery) {
        const cleanQuery = sanitize(searchQuery, 200);
        if (cleanQuery) {
          query = query.contains('name', cleanQuery);
        }
      }

      // Price range
      if (typeof priceMin === 'number' && priceMin > 0) {
        query = query.ge('price', priceMin);
      }
      if (typeof priceMax === 'number' && priceMax > 0) {
        query = query.le('price', priceMax);
      }

      // Materials (multi-select)
      if (Array.isArray(materials) && materials.length > 0) {
        const cleanMaterials = materials
          .map(m => sanitize(m, 50))
          .filter(Boolean);
        if (cleanMaterials.length > 0) {
          query = query.hasSome('material', cleanMaterials);
        }
      }

      // Colors (multi-select)
      if (Array.isArray(colors) && colors.length > 0) {
        const cleanColors = colors
          .map(c => sanitize(c, 50))
          .filter(Boolean);
        if (cleanColors.length > 0) {
          query = query.hasSome('color', cleanColors);
        }
      }

      // Feature tags (multi-select)
      if (Array.isArray(featureTags) && featureTags.length > 0) {
        const cleanTags = featureTags
          .map(t => sanitize(t, 50))
          .filter(Boolean);
        if (cleanTags.length > 0) {
          query = query.hasSome('featureTags', cleanTags);
        }
      }

      // Brands (multi-select)
      if (Array.isArray(brands) && brands.length > 0) {
        const cleanBrands = brands
          .map(b => sanitize(b, 100))
          .filter(Boolean);
        if (cleanBrands.length > 0) {
          query = query.hasSome('brand', cleanBrands);
        }
      }

      // Dimension ranges
      if (typeof widthMin === 'number' && widthMin > 0) {
        query = query.ge('dimensions.width', widthMin);
      }
      if (typeof widthMax === 'number' && widthMax > 0) {
        query = query.le('dimensions.width', widthMax);
      }
      if (typeof depthMin === 'number' && depthMin > 0) {
        query = query.ge('dimensions.depth', depthMin);
      }
      if (typeof depthMax === 'number' && depthMax > 0) {
        query = query.le('dimensions.depth', depthMax);
      }
      if (typeof heightMin === 'number' && heightMin > 0) {
        query = query.ge('dimensions.height', heightMin);
      }
      if (typeof heightMax === 'number' && heightMax > 0) {
        query = query.le('dimensions.height', heightMax);
      }

      // In-stock only
      if (inStockOnly) {
        query = query.eq('inStock', true);
      }

      // Sort
      const sortOption = SORT_OPTIONS[sort] || SORT_OPTIONS['bestselling'];
      if (sortOption.dir === 'desc') {
        query = query.descending(sortOption.field);
      } else {
        query = query.ascending(sortOption.field);
      }

      // Pagination
      const safeLimit = Math.min(Math.max(1, limit), 100);
      const safeSkip = Math.max(0, Math.floor(skip) || 0);
      query = query.skip(safeSkip).limit(safeLimit);

      const result = await query.find();

      return {
        items: result.items,
        totalCount: result.totalCount,
        hasMore: result.totalCount > skip + safeLimit,
      };
    } catch (err) {
      console.error('searchProducts error:', err);
      return { items: [], totalCount: 0, hasMore: false };
    }
  }
);

// ── getFilteredProductCount ─────────────────────────────────────────

/**
 * Returns just the matching product count for a given filter combination.
 * Used by the UI to show "X products found" badges on filter chips before
 * the user commits to a full search.
 *
 * Queries CMS: Stores/Products
 *
 * @param {Object} [params={}] - Same filter shape as searchProducts (minus sort/pagination).
 * @returns {Promise<{count: number}>}
 * @permission Permissions.Anyone
 */
export const getFilteredProductCount = webMethod(
  Permissions.Anyone,
  async (params = {}) => {
    try {
      const {
        category,
        searchQuery,
        priceMin,
        priceMax,
        materials,
        colors,
        featureTags,
        brands,
        inStockOnly,
      } = params;

      let query = wixData.query('Stores/Products');

      if (category) {
        query = query.hasSome('collections', [sanitize(category, 100)]);
      }
      if (searchQuery) {
        const clean = sanitize(searchQuery, 200);
        if (clean) query = query.contains('name', clean);
      }
      if (typeof priceMin === 'number' && priceMin > 0) {
        query = query.ge('price', priceMin);
      }
      if (typeof priceMax === 'number' && priceMax > 0) {
        query = query.le('price', priceMax);
      }
      if (Array.isArray(materials) && materials.length > 0) {
        query = query.hasSome('material', materials.map(m => sanitize(m, 50)).filter(Boolean));
      }
      if (Array.isArray(colors) && colors.length > 0) {
        query = query.hasSome('color', colors.map(c => sanitize(c, 50)).filter(Boolean));
      }
      if (Array.isArray(featureTags) && featureTags.length > 0) {
        query = query.hasSome('featureTags', featureTags.map(t => sanitize(t, 50)).filter(Boolean));
      }
      if (Array.isArray(brands) && brands.length > 0) {
        query = query.hasSome('brand', brands.map(b => sanitize(b, 100)).filter(Boolean));
      }
      if (inStockOnly) {
        query = query.eq('inStock', true);
      }

      const count = await query.count();
      return { count };
    } catch (err) {
      console.error('getFilteredProductCount error:', err);
      return { count: 0 };
    }
  }
);

// ── getFacetMetadata ────────────────────────────────────────────────

/**
 * Builds available filter facets for a category (or all products). Scans
 * up to 100 products and extracts distinct materials, colors, feature tags,
 * brands, price range, and dimension ranges. Results are cached for 5 min
 * to avoid redundant queries on every page load.
 *
 * Queries CMS: Stores/Products
 *
 * @param {string} [category] - Optional collection slug. Omit for site-wide facets.
 * @returns {Promise<{totalProducts: number, priceRange: {min: number, max: number}, materials: string[], colors: string[], featureTags: string[], brands: string[], dimensionRange: Object}>}
 * @permission Permissions.Anyone
 */
export const getFacetMetadata = webMethod(
  Permissions.Anyone,
  async (category) => {
    try {
      const cleanCategory = category ? sanitize(category, 100) : '';

      // Check cache
      const cacheKey = cleanCategory || '__all__';
      const cached = getCachedFacets(cacheKey);
      if (cached) return cached;

      // Query all products in category (or all products if no category)
      let query = wixData.query('Stores/Products');
      if (cleanCategory) {
        query = query.hasSome('collections', [cleanCategory]);
      }
      query = query.limit(100);

      const result = await query.find();
      const items = result.items;

      // Build facets from results
      const priceRange = { min: Infinity, max: -Infinity };
      const materialSet = new Set();
      const colorSet = new Set();
      const featureTagSet = new Set();
      const brandSet = new Set();
      const dimensionRange = {
        width: { min: Infinity, max: -Infinity },
        depth: { min: Infinity, max: -Infinity },
        height: { min: Infinity, max: -Infinity },
      };

      for (const item of items) {
        // Price
        if (typeof item.price === 'number') {
          if (item.price < priceRange.min) priceRange.min = item.price;
          if (item.price > priceRange.max) priceRange.max = item.price;
        }

        // Material
        if (item.material) materialSet.add(item.material);

        // Color
        if (item.color) colorSet.add(item.color);

        // Feature tags
        if (Array.isArray(item.featureTags)) {
          item.featureTags.forEach(t => featureTagSet.add(t));
        }

        // Brand
        if (item.brand) brandSet.add(item.brand);

        // Dimensions
        if (item.dimensions) {
          for (const axis of ['width', 'depth', 'height']) {
            const val = item.dimensions[axis];
            if (typeof val === 'number') {
              if (val < dimensionRange[axis].min) dimensionRange[axis].min = val;
              if (val > dimensionRange[axis].max) dimensionRange[axis].max = val;
            }
          }
        }
      }

      // Clean up Infinity values for empty categories
      if (priceRange.min === Infinity) { priceRange.min = 0; priceRange.max = 0; }
      for (const axis of ['width', 'depth', 'height']) {
        if (dimensionRange[axis].min === Infinity) {
          dimensionRange[axis].min = 0;
          dimensionRange[axis].max = 0;
        }
      }

      const facets = {
        totalProducts: items.length,
        priceRange,
        materials: [...materialSet].sort(),
        colors: [...colorSet].sort(),
        featureTags: [...featureTagSet].sort(),
        brands: [...brandSet].sort(),
        dimensionRange,
      };

      setCachedFacets(cacheKey, facets);
      return facets;
    } catch (err) {
      console.error('getFacetMetadata error:', err);
      return {
        totalProducts: 0,
        priceRange: { min: 0, max: 0 },
        materials: [],
        colors: [],
        featureTags: [],
        brands: [],
        dimensionRange: {
          width: { min: 0, max: 0 },
          depth: { min: 0, max: 0 },
          height: { min: 0, max: 0 },
        },
      };
    }
  }
);

// ── suggestFilterRelaxation ─────────────────────────────────────────

/**
 * When a search returns zero results, this function identifies which single
 * filter removal would yield results. It tries dropping each active filter
 * one at a time and returns suggestions sorted by the most results gained.
 * Helps the user recover from over-filtered dead ends.
 *
 * Queries CMS: Stores/Products
 *
 * @param {Object} [params={}] - The current filter set that produced zero results.
 * @returns {Promise<{suggestions: Array<{filter: string, label: string, resultCount: number}>}>}
 * @permission Permissions.Anyone
 */
export const suggestFilterRelaxation = webMethod(
  Permissions.Anyone,
  async (params = {}) => {
    try {
      const { category, priceMin, priceMax, materials, colors, featureTags, brands, inStockOnly } = params;
      const suggestions = [];

      // Try removing one filter at a time and check if results appear
      const filterKeys = [];
      if (typeof priceMin === 'number' || typeof priceMax === 'number') filterKeys.push('price');
      if (Array.isArray(materials) && materials.length > 0) filterKeys.push('materials');
      if (Array.isArray(colors) && colors.length > 0) filterKeys.push('colors');
      if (Array.isArray(featureTags) && featureTags.length > 0) filterKeys.push('featureTags');
      if (Array.isArray(brands) && brands.length > 0) filterKeys.push('brands');
      if (inStockOnly) filterKeys.push('inStockOnly');

      for (const key of filterKeys) {
        const relaxed = { ...params };
        if (key === 'price') { delete relaxed.priceMin; delete relaxed.priceMax; }
        else if (key === 'inStockOnly') { relaxed.inStockOnly = false; }
        else { relaxed[key] = []; }

        let query = wixData.query('Stores/Products');
        if (category) query = query.hasSome('collections', [sanitize(category, 100)]);

        // Re-apply remaining filters
        if (key !== 'price') {
          if (typeof relaxed.priceMin === 'number' && relaxed.priceMin > 0) query = query.ge('price', relaxed.priceMin);
          if (typeof relaxed.priceMax === 'number' && relaxed.priceMax > 0) query = query.le('price', relaxed.priceMax);
        }
        if (key !== 'materials' && Array.isArray(relaxed.materials) && relaxed.materials.length > 0) {
          query = query.hasSome('material', relaxed.materials);
        }
        if (key !== 'colors' && Array.isArray(relaxed.colors) && relaxed.colors.length > 0) {
          query = query.hasSome('color', relaxed.colors);
        }
        if (key !== 'featureTags' && Array.isArray(relaxed.featureTags) && relaxed.featureTags.length > 0) {
          query = query.hasSome('featureTags', relaxed.featureTags);
        }
        if (key !== 'brands' && Array.isArray(relaxed.brands) && relaxed.brands.length > 0) {
          query = query.hasSome('brand', relaxed.brands);
        }
        if (key !== 'inStockOnly' && relaxed.inStockOnly) {
          query = query.eq('inStock', true);
        }

        const count = await query.count();
        if (count > 0) {
          const labels = {
            price: 'price range',
            materials: 'material',
            colors: 'color',
            featureTags: 'feature',
            brands: 'brand',
            inStockOnly: 'in-stock only',
          };
          suggestions.push({
            filter: key,
            label: labels[key] || key,
            resultCount: count,
          });
        }
      }

      // Sort by most results gained
      suggestions.sort((a, b) => b.resultCount - a.resultCount);

      return { suggestions };
    } catch (err) {
      console.error('suggestFilterRelaxation error:', err);
      return { suggestions: [] };
    }
  }
);
