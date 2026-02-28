// Local product cache for PWA-lite offline browsing
// Caches recently viewed products in localStorage for instant re-display
// Uses stale-while-revalidate pattern: show cached data, fetch fresh in background
import { local } from 'wix-storage-frontend';

const CACHE_KEY = 'cf_product_cache';
const RECENT_KEY = 'cf_recently_viewed';
const MAX_PRODUCTS = 20;
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCache() {
  try {
    const raw = local.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function setCache(cache) {
  local.setItem(CACHE_KEY, JSON.stringify(cache));
}

/**
 * Cache a product for offline/instant access.
 * @param {Object} product - Product data with at least _id and slug
 */
export function cacheProduct(product) {
  if (!product || !product.slug) return;
  // Validate slug: only allow lowercase alphanumeric, hyphens
  if (!/^[a-z0-9][a-z0-9-]*$/.test(product.slug)) return;

  const cache = getCache();
  cache[product.slug] = {
    data: {
      _id: product._id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      formattedPrice: product.formattedPrice,
      mainMedia: product.mainMedia,
      description: product.description,
      collections: product.collections,
    },
    cachedAt: Date.now(),
  };

  // LRU eviction: remove oldest entries if over limit
  const entries = Object.entries(cache);
  if (entries.length > MAX_PRODUCTS) {
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    const toRemove = entries.slice(0, entries.length - MAX_PRODUCTS);
    toRemove.forEach(([key]) => delete cache[key]);
  }

  setCache(cache);
  updateRecentlyViewed(product.slug);
}

/**
 * Get a cached product by slug. Returns null if not cached or expired.
 * @param {string} slug
 * @returns {Object|null}
 */
export function getCachedProduct(slug) {
  if (!slug) return null;
  const cache = getCache();
  const entry = cache[slug];
  if (!entry) return null;

  // Check TTL
  if (Date.now() - entry.cachedAt > TTL_MS) {
    delete cache[slug];
    setCache(cache);
    return null;
  }

  return { ...entry.data, _cachedAt: entry.cachedAt };
}

/**
 * Get recently viewed products (most recent first).
 * @param {number} limit - Max products to return (default 4)
 * @returns {Array}
 */
export function getRecentlyViewed(limit = 4) {
  try {
    const raw = local.getItem(RECENT_KEY);
    const slugs = raw ? JSON.parse(raw) : [];
    const cache = getCache();

    return slugs
      .slice(0, limit)
      .map(slug => {
        const entry = cache[slug];
        if (!entry) return null;
        if (Date.now() - entry.cachedAt > TTL_MS) return null;
        return entry.data;
      })
      .filter(Boolean);
  } catch { return []; }
}

/**
 * Get the number of cached products.
 * @returns {number}
 */
export function getCacheSize() {
  return Object.keys(getCache()).length;
}

/**
 * Clear the entire product cache.
 */
export function clearCache() {
  local.removeItem(CACHE_KEY);
  local.removeItem(RECENT_KEY);
}

function updateRecentlyViewed(slug) {
  try {
    const raw = local.getItem(RECENT_KEY);
    let slugs = raw ? JSON.parse(raw) : [];
    // Move to front, deduplicate
    slugs = [slug, ...slugs.filter(s => s !== slug)].slice(0, MAX_PRODUCTS);
    local.setItem(RECENT_KEY, JSON.stringify(slugs));
  } catch { /* storage full or unavailable */ }
}
