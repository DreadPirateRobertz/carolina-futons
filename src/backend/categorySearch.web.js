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
