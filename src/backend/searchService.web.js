/**
 * @module searchService
 * @description Full-text product search engine with autocomplete, faceted
 * filtering, sorting, and popular query tracking. Powers both category
 * filter pages and the Search Results page.
 *
 * Frontend calls these methods via debounced controls; results include
 * filtered products, available facet values with counts, and autocomplete
 * suggestions for type-ahead UX.
 *
 * @requires wix-web-module
 * @requires wix-data
 */
import { Permissions, webMethod } from 'wix-web-module';
import wixData from 'wix-data';
import { sanitize, validateSlug } from 'backend/utils/sanitize';

// ─── Cache Layer ─────────────────────────────────────────────────
// Shared TTL cache for facets, search results, and autocomplete.

const _cache = {};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const AUTOCOMPLETE_TTL_MS = 2 * 60 * 1000; // 2 minutes
const SEARCH_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
const MAX_SEARCH_CACHE_ENTRIES = 50;

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

function getSearchCacheKey(query, params) {
  const normalized = (query || '').toLowerCase().trim();
  const sort = params.sortBy || 'relevance';
  const cat = params.category || '';
  const price = params.priceRange || '';
  const offset = params.offset || 0;
  return `search:${normalized}:${sort}:${cat}:${price}:${offset}`;
}

function getCachedSearch(key) {
  const entry = _cache[key];
  if (!entry) return null;
  if (Date.now() - entry.timestamp > SEARCH_CACHE_TTL_MS) {
    delete _cache[key];
    return null;
  }
  return entry.data;
}

function setCachedSearch(key, data) {
  // Evict oldest search entries if over limit
  const searchKeys = Object.keys(_cache).filter(k => k.startsWith('search:'));
  if (searchKeys.length >= MAX_SEARCH_CACHE_ENTRIES) {
    let oldest = searchKeys[0];
    for (const k of searchKeys) {
      if (_cache[k].timestamp < _cache[oldest].timestamp) oldest = k;
    }
    delete _cache[oldest];
  }
  _cache[key] = { data, timestamp: Date.now() };
}

// ─── Popular Query Tracking ──────────────────────────────────────
// In-memory frequency counter for search queries. Decays over time.

const _queryFrequency = {};
const MAX_TRACKED_QUERIES = 200;
const QUERY_DECAY_MS = 24 * 60 * 60 * 1000; // 24 hours

function recordQuery(query) {
  const normalized = (query || '').toLowerCase().trim();
  if (!normalized || normalized.length < 2) return;
  const now = Date.now();
  if (!_queryFrequency[normalized]) {
    // Evict least frequent if at capacity
    const keys = Object.keys(_queryFrequency);
    if (keys.length >= MAX_TRACKED_QUERIES) {
      let minKey = keys[0];
      for (const k of keys) {
        if (_queryFrequency[k].count < _queryFrequency[minKey].count) minKey = k;
      }
      delete _queryFrequency[minKey];
    }
    _queryFrequency[normalized] = { count: 0, lastSeen: now };
  }
  _queryFrequency[normalized].count++;
  _queryFrequency[normalized].lastSeen = now;
}

function getTopQueries(limit = 8) {
  const now = Date.now();
  return Object.entries(_queryFrequency)
    .filter(([, data]) => now - data.lastSeen < QUERY_DECAY_MS)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, limit)
    .map(([query, data]) => ({ query, count: data.count }));
}

// Exported for testing
export function __clearCache() {
  Object.keys(_cache).forEach(k => delete _cache[k]);
  Object.keys(_queryFrequency).forEach(k => delete _queryFrequency[k]);
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

// ─── Product field mapper (shared) ───────────────────────────────

function mapProduct(item) {
  return {
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
    description: item.description,
  };
}

// ─── Category label map ──────────────────────────────────────────

const CATEGORY_LABELS = {
  'futon-frames': 'Futon Frames',
  'mattresses': 'Mattresses',
  'murphy-cabinet-beds': 'Murphy Cabinet Beds',
  'platform-beds': 'Platform Beds',
  'casegoods-accessories': 'Casegoods & Accessories',
  'wall-huggers': 'Wall Huggers',
  'unfinished-wood': 'Unfinished Wood',
  'front-loading-nesting': 'Front Loading & Nesting',
};

// ─── fullTextSearch ──────────────────────────────────────────────

/**
 * Full-text product search across name, description, and category.
 * Supports all faceted filters, sorting, and pagination. Results are
 * cached by query+params for fast repeat lookups.
 *
 * @param {Object} params
 * @param {string} params.query - Search query text
 * @param {string} [params.category] - Category slug filter
 * @param {string} [params.priceRange] - Price bucket key
 * @param {string} [params.material] - Material filter
 * @param {string} [params.color] - Color filter
 * @param {string[]} [params.features] - Feature tag filters
 * @param {boolean} [params.inStockOnly] - Only show in-stock items
 * @param {string} [params.sortBy] - Sort: relevance, price-asc, price-desc, name-asc, name-desc, newest
 * @param {number} [params.limit] - Max results (default 24)
 * @param {number} [params.offset] - Pagination offset (default 0)
 * @returns {Promise<{products: Object[], total: number, query: string, facets: Object}>}
 */
export const fullTextSearch = webMethod(
  Permissions.Anyone,
  async (params = {}) => {
    try {
      const {
        query: rawQuery,
        category,
        priceRange,
        material,
        color,
        features,
        inStockOnly,
        sortBy = 'relevance',
        limit = 24,
        offset = 0,
      } = params;

      const sanitizedQuery = sanitize(rawQuery || '', 200);
      if (!sanitizedQuery) {
        return { products: [], total: 0, query: '', facets: {} };
      }
      const normalizedQuery = sanitizedQuery.toLowerCase();

      // Track query for popular searches
      recordQuery(normalizedQuery);

      // Check search cache
      const cacheKey = getSearchCacheKey(normalizedQuery, params);
      const cached = getCachedSearch(cacheKey);
      if (cached) return cached;

      // Wix Data doesn't support OR across fields in a single query,
      // so we run parallel queries on name and description and merge.
      // Use sanitized (non-lowercased) for wixData since contains is case-insensitive.
      const nameQuery = wixData.query('Stores/Products')
        .contains('name', sanitizedQuery)
        .limit(1000);
      const descQuery = wixData.query('Stores/Products')
        .contains('description', sanitizedQuery)
        .limit(1000);

      const [nameResults, descResults] = await Promise.all([
        nameQuery.find(),
        descQuery.find(),
      ]);

      // Merge and deduplicate
      const seen = new Set();
      let merged = [];
      // Name matches get higher relevance (appear first in relevance sort)
      for (const item of nameResults.items) {
        if (!seen.has(item._id)) {
          seen.add(item._id);
          merged.push({ ...item, _relevance: 2 });
        }
      }
      for (const item of descResults.items) {
        if (!seen.has(item._id)) {
          seen.add(item._id);
          merged.push({ ...item, _relevance: 1 });
        }
      }

      // Apply filters on merged results
      const cleanCategory = category ? validateSlug(category) : '';
      if (cleanCategory) {
        merged = merged.filter(item =>
          Array.isArray(item.collections) && item.collections.includes(cleanCategory)
        );
      }

      if (priceRange) {
        const range = PRICE_RANGES.find(r => r.key === priceRange);
        if (range) {
          merged = merged.filter(item => {
            const p = item.price || 0;
            return p >= range.min && (range.max === Infinity ? true : p <= range.max);
          });
        }
      }

      if (material) {
        const cleanMaterial = sanitize(material, 100);
        if (cleanMaterial) {
          merged = merged.filter(item => item.material === cleanMaterial);
        }
      }

      if (color) {
        const cleanColor = sanitize(color, 50);
        if (cleanColor) {
          merged = merged.filter(item => item.color === cleanColor);
        }
      }

      if (Array.isArray(features) && features.length > 0) {
        const validFeatures = features.filter(f => KNOWN_FEATURES.includes(f));
        for (const feature of validFeatures) {
          merged = merged.filter(item =>
            Array.isArray(item.featureTags) && item.featureTags.includes(feature)
          );
        }
      }

      if (inStockOnly) {
        merged = merged.filter(item => item.inStock === true);
      }

      // Sort
      switch (sortBy) {
        case 'price-asc':
          merged.sort((a, b) => (a.price || 0) - (b.price || 0));
          break;
        case 'price-desc':
          merged.sort((a, b) => (b.price || 0) - (a.price || 0));
          break;
        case 'name-asc':
          merged.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          break;
        case 'name-desc':
          merged.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
          break;
        case 'newest':
          merged.sort((a, b) => {
            const da = a._createdDate ? new Date(a._createdDate).getTime() : 0;
            const db = b._createdDate ? new Date(b._createdDate).getTime() : 0;
            return db - da;
          });
          break;
        case 'relevance':
        default:
          merged.sort((a, b) => (b._relevance || 0) - (a._relevance || 0));
          break;
      }

      const total = merged.length;

      // Paginate
      const safeLimit = Math.min(Math.max(1, Number(limit) || 24), 100);
      const safeOffset = Math.max(0, Number(offset) || 0);
      const page = merged.slice(safeOffset, safeOffset + safeLimit);

      const products = page.map(mapProduct);

      const result = {
        products,
        total,
        query: normalizedQuery,
        facets: await buildFacets(cleanCategory),
      };

      setCachedSearch(cacheKey, result);
      return result;
    } catch (err) {
      console.error('Error in fullTextSearch:', err);
      return { products: [], total: 0, query: '', facets: {} };
    }
  }
);

// ─── getAutocompleteSuggestions ───────────────────────────────────

/**
 * Fast autocomplete suggestions for search-as-you-type. Returns matching
 * product names and category labels for the given prefix.
 *
 * @param {string} prefix - The partial search text (minimum 2 chars)
 * @param {number} [limit] - Max suggestions (default 8)
 * @returns {Promise<{suggestions: Array<{text: string, type: string, slug: string}>}>}
 */
export const getAutocompleteSuggestions = webMethod(
  Permissions.Anyone,
  async (prefix, limit = 8) => {
    try {
      const sanitizedPrefix = sanitize(prefix || '', 100);
      const normalizedPrefix = sanitizedPrefix.toLowerCase();
      if (normalizedPrefix.length < 2) {
        return { suggestions: [] };
      }

      // Check autocomplete cache
      const cacheKey = `autocomplete:${normalizedPrefix}`;
      const cachedEntry = _cache[cacheKey];
      if (cachedEntry && Date.now() - cachedEntry.timestamp < AUTOCOMPLETE_TTL_MS) {
        return cachedEntry.data;
      }

      const safeLimit = Math.min(Math.max(1, Number(limit) || 8), 20);

      // Query products whose names contain the prefix
      const results = await wixData.query('Stores/Products')
        .contains('name', sanitizedPrefix)
        .ascending('name')
        .limit(50)
        .find();

      const suggestions = [];
      const seen = new Set();

      // Add matching category labels first
      for (const [slug, label] of Object.entries(CATEGORY_LABELS)) {
        if (label.toLowerCase().includes(normalizedPrefix) && !seen.has(slug)) {
          seen.add(slug);
          suggestions.push({ text: label, type: 'category', slug });
        }
      }

      // Add matching product names
      for (const item of results.items) {
        if (suggestions.length >= safeLimit) break;
        const key = item.name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          suggestions.push({
            text: item.name,
            type: 'product',
            slug: item.slug,
          });
        }
      }

      // Add popular queries that match
      const popular = getTopQueries(20);
      for (const entry of popular) {
        if (suggestions.length >= safeLimit) break;
        if (entry.query.includes(normalizedPrefix) && !seen.has(entry.query)) {
          seen.add(entry.query);
          suggestions.push({
            text: entry.query,
            type: 'popular',
            slug: '',
          });
        }
      }

      const result = { suggestions: suggestions.slice(0, safeLimit) };
      _cache[cacheKey] = { data: result, timestamp: Date.now() };
      return result;
    } catch (err) {
      console.error('Error in getAutocompleteSuggestions:', err);
      return { suggestions: [] };
    }
  }
);

// ─── getPopularSearches ──────────────────────────────────────────

/**
 * Returns the most popular recent search queries. Used for "trending
 * searches" display and empty-state suggestions.
 *
 * @param {number} [limit] - Max queries to return (default 8)
 * @returns {Promise<{queries: Array<{query: string, count: number}>}>}
 */
export const getPopularSearches = webMethod(
  Permissions.Anyone,
  async (limit = 8) => {
    try {
      const safeLimit = Math.min(Math.max(1, Number(limit) || 8), 20);
      return { queries: getTopQueries(safeLimit) };
    } catch (err) {
      console.error('Error in getPopularSearches:', err);
      return { queries: [] };
    }
  }
);

// ─── recordSearchQuery ───────────────────────────────────────────

/**
 * Record a search query for popularity tracking. Called by the Search
 * Results page on each search to build the trending queries dataset.
 *
 * @param {string} query - The search query to record
 * @returns {Promise<{success: boolean}>}
 */
export const recordSearchQuery = webMethod(
  Permissions.Anyone,
  async (query) => {
    try {
      const cleanQuery = sanitize(query || '', 200).toLowerCase();
      if (cleanQuery.length < 2) return { success: false };
      recordQuery(cleanQuery);
      return { success: true };
    } catch (err) {
      console.error('Error in recordSearchQuery:', err);
      return { success: false };
    }
  }
);
