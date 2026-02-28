/**
 * recentlyViewed.js — Shared recently viewed carousel and cross-sell section.
 *
 * Provides sessionStorage-backed view history, a "Recently Viewed" repeater
 * initializer, and a "Customers Also Bought" section powered by
 * getSimilarProducts from the backend.
 *
 * CF-78g2: Recently viewed + personalized recommendations
 */
import { session } from 'wix-storage-frontend';
import { getRecentlyViewed, cacheProduct } from 'public/productCache';
import { getSimilarProducts } from 'backend/productRecommendations.web';
import { makeClickable } from 'public/a11yHelpers.js';

const SESSION_KEY = 'cf_session_viewed';
const MAX_HISTORY = 20;

// ── Session View History ─────────────────────────────────────────────

/**
 * Track a product view in session storage and product cache.
 * @param {Object} product - Product with at least slug, _id, name, price, mainMedia
 */
export function trackProductView(product) {
  if (!product || !product.slug) return;

  cacheProduct(product);

  try {
    const raw = session.getItem(SESSION_KEY);
    let history = raw ? JSON.parse(raw) : [];

    // Deduplicate — remove existing entry for this slug
    history = history.filter(p => p.slug !== product.slug);

    // Add to front (most recent)
    history.unshift({
      _id: product._id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      formattedPrice: product.formattedPrice,
      mainMedia: product.mainMedia,
    });

    // Cap at max
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }

    session.setItem(SESSION_KEY, JSON.stringify(history));
  } catch { /* storage unavailable */ }
}

/**
 * Get session view history.
 * @param {number} [limit=20] - Max items to return
 * @returns {Array<Object>}
 */
export function getViewHistory(limit = MAX_HISTORY) {
  try {
    const raw = session.getItem(SESSION_KEY);
    if (!raw) return [];
    const history = JSON.parse(raw);
    if (!Array.isArray(history)) return [];
    return history.slice(0, limit);
  } catch { return []; }
}

/**
 * Clear session view history.
 */
export function clearViewHistory() {
  try { session.removeItem(SESSION_KEY); } catch { /* noop */ }
}

// ── Recently Viewed Carousel ─────────────────────────────────────────

/**
 * Initialize the "Recently Viewed" repeater section.
 * Merges session history with productCache for cross-session persistence.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} [options]
 * @param {string} [options.title='Recently Viewed'] - Section heading
 * @param {number} [options.limit=6] - Max products to show
 * @param {string} [options.excludeSlug] - Slug to exclude (current product)
 * @param {string} [options.sectionId='#recentlyViewedSection']
 * @param {string} [options.repeaterId='#recentlyViewedRepeater']
 * @param {string} [options.titleId='#recentlyViewedTitle']
 */
export function initRecentlyViewedCarousel($w, options = {}) {
  const {
    title = 'Recently Viewed',
    limit = 6,
    excludeSlug,
    sectionId = '#recentlyViewedSection',
    repeaterId = '#recentlyViewedRepeater',
    titleId = '#recentlyViewedTitle',
  } = options;

  try {
    let products = getRecentlyViewed(limit);

    if (excludeSlug) {
      products = products.filter(p => p.slug !== excludeSlug);
    }

    if (!products || products.length === 0) {
      try { $w(sectionId).collapse(); } catch (e) { /* element may not exist */ }
      return;
    }

    // Set title
    try { $w(titleId).text = title; } catch (e) { /* noop */ }

    // ARIA landmark
    try {
      $w(sectionId).accessibility.ariaLabel = 'Recently Viewed Products';
      $w(sectionId).accessibility.role = 'region';
    } catch (e) { /* noop */ }

    // Wire repeater
    const repeater = $w(repeaterId);
    repeater.onItemReady(($item, itemData) => {
      try {
        $item('#recentImage').src = itemData.mainMedia;
        $item('#recentImage').alt = `${itemData.name} - Carolina Futons`;
      } catch (e) { /* noop */ }

      try { $item('#recentName').text = itemData.name; } catch (e) { /* noop */ }
      try { $item('#recentPrice').text = itemData.formattedPrice || String(itemData.price); } catch (e) { /* noop */ }

      const navigateToProduct = () => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };

      try { makeClickable($item('#recentImage'), navigateToProduct, { ariaLabel: `View ${itemData.name}` }); } catch (e) { /* noop */ }
      try { makeClickable($item('#recentName'), navigateToProduct, { ariaLabel: `View ${itemData.name} details` }); } catch (e) { /* noop */ }
    });

    repeater.data = products;
    $w(sectionId).expand();
  } catch (e) {
    try { $w(sectionId || '#recentlyViewedSection').collapse(); } catch (e2) { /* noop */ }
  }
}

// ── Customers Also Bought ────────────────────────────────────────────

/**
 * Initialize the "Customers Also Bought" cross-sell section.
 * Fetches similar products from backend and populates repeater.
 *
 * @param {Function} $w - Wix selector function
 * @param {Object} product - Current product (needs _id)
 * @param {Object} [options]
 * @param {number} [options.limit=4] - Max recommendations
 */
export async function initAlsoBoughtSection($w, product, options = {}) {
  const { limit = 4 } = options;
  const sectionId = '#alsoBoughtSection';
  const repeaterId = '#alsoBoughtRepeater';
  const titleId = '#alsoBoughtTitle';

  try {
    if (!product || !product._id) {
      try { $w(sectionId).collapse(); } catch (e) { /* noop */ }
      return;
    }

    const result = await getSimilarProducts(product._id, { limit });

    if (!result.success || !result.products || result.products.length === 0) {
      try { $w(sectionId).collapse(); } catch (e) { /* noop */ }
      return;
    }

    // Set title
    try { $w(titleId).text = 'Customers Also Bought'; } catch (e) { /* noop */ }

    // ARIA landmark
    try {
      $w(sectionId).accessibility.ariaLabel = 'Customers Also Bought';
      $w(sectionId).accessibility.role = 'region';
    } catch (e) { /* noop */ }

    // Wire repeater
    const repeater = $w(repeaterId);
    repeater.onItemReady(($item, itemData) => {
      try {
        $item('#alsoBoughtImage').src = itemData.mainMedia;
        $item('#alsoBoughtImage').alt = `${itemData.name} - Carolina Futons`;
      } catch (e) { /* noop */ }

      try { $item('#alsoBoughtName').text = itemData.name; } catch (e) { /* noop */ }
      try { $item('#alsoBoughtPrice').text = itemData.formattedPrice || String(itemData.price); } catch (e) { /* noop */ }

      const navigateToProduct = () => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };

      try { makeClickable($item('#alsoBoughtImage'), navigateToProduct, { ariaLabel: `View ${itemData.name}` }); } catch (e) { /* noop */ }
      try { makeClickable($item('#alsoBoughtName'), navigateToProduct, { ariaLabel: `View ${itemData.name} details` }); } catch (e) { /* noop */ }
    });

    repeater.data = result.products;
    $w(sectionId).expand();
  } catch (e) {
    try { $w(sectionId).collapse(); } catch (e2) { /* noop */ }
  }
}
