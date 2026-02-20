// Gallery and product engagement helpers
// Used across multiple pages for consistent product display behavior

// Recently viewed products tracking (stored in session storage)
const RECENTLY_VIEWED_KEY = 'cf_recently_viewed';
const MAX_RECENT = 12;

export function trackProductView(product) {
  if (!product || !product._id) return;

  try {
    const stored = sessionStorage.getItem(RECENTLY_VIEWED_KEY);
    let recent = stored ? JSON.parse(stored) : [];

    // Remove if already in list (will re-add at front)
    recent = recent.filter(p => p._id !== product._id);

    // Add to front
    recent.unshift({
      _id: product._id,
      name: product.name,
      slug: product.slug,
      price: product.formattedPrice,
      mainMedia: product.mainMedia,
    });

    // Trim to max
    if (recent.length > MAX_RECENT) {
      recent = recent.slice(0, MAX_RECENT);
    }

    sessionStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recent));
  } catch (e) {
    // Session storage may not be available
  }

  // Start enriched browse tracking for this product view
  startBrowseTracking(product._id);
}

// ── Abandoned Browse Data Capture ─────────────────────────────────
// Tracks engagement signals: time on page, scroll to pricing, variant interactions

const BROWSE_DATA_KEY = 'cf_browse_data';

function startBrowseTracking(productId) {
  try {
    const startTime = Date.now();
    let scrolledToPricing = false;
    let variantInteractions = 0;

    // Track scroll to pricing section
    const checkPricingScroll = () => {
      try {
        const pricingEl = typeof $w !== 'undefined' ? $w('#productPrice') : null;
        if (pricingEl) {
          scrolledToPricing = true;
          window.removeEventListener('scroll', checkPricingScroll);
        }
      } catch (e) {}
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', checkPricingScroll, { passive: true });
    }

    // Track variant selector interactions
    if (typeof $w !== 'undefined') {
      try {
        const sizeDropdown = $w('#sizeDropdown');
        const finishDropdown = $w('#finishDropdown');
        if (sizeDropdown) sizeDropdown.onChange(() => { variantInteractions++; });
        if (finishDropdown) finishDropdown.onChange(() => { variantInteractions++; });
      } catch (e) {}
    }

    // Record enriched data on page leave
    const recordBrowseData = () => {
      try {
        const timeSpentMs = Date.now() - startTime;
        const stored = sessionStorage.getItem(BROWSE_DATA_KEY);
        let browseData = stored ? JSON.parse(stored) : {};

        browseData[productId] = {
          timeSpentMs,
          scrolledToPricing,
          variantInteractions,
          timestamp: new Date().toISOString(),
        };

        sessionStorage.setItem(BROWSE_DATA_KEY, JSON.stringify(browseData));
      } catch (e) {}
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', recordBrowseData);
      // Also capture on visibility change (mobile tab switches)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          recordBrowseData();
        }
      });
    }
  } catch (e) {
    // Browse tracking is non-critical
  }
}

export function getBrowseData() {
  try {
    const stored = sessionStorage.getItem(BROWSE_DATA_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    return {};
  }
}

export function getRecentlyViewed(excludeId = null) {
  try {
    const stored = sessionStorage.getItem(RECENTLY_VIEWED_KEY);
    if (!stored) return [];

    let recent = JSON.parse(stored);
    if (excludeId) {
      recent = recent.filter(p => p._id !== excludeId);
    }
    return recent;
  } catch (e) {
    return [];
  }
}

// Product comparison helper
const COMPARE_KEY = 'cf_compare_list';
const MAX_COMPARE = 4;

export function addToCompare(product) {
  try {
    const stored = sessionStorage.getItem(COMPARE_KEY);
    let compareList = stored ? JSON.parse(stored) : [];

    if (compareList.some(p => p._id === product._id)) return false; // Already in list
    if (compareList.length >= MAX_COMPARE) return false; // Max reached

    compareList.push({
      _id: product._id,
      name: product.name,
      slug: product.slug,
      price: product.formattedPrice,
      mainMedia: product.mainMedia,
    });

    sessionStorage.setItem(COMPARE_KEY, JSON.stringify(compareList));
    return true;
  } catch (e) {
    return false;
  }
}

export function removeFromCompare(productId) {
  try {
    const stored = sessionStorage.getItem(COMPARE_KEY);
    if (!stored) return;

    let compareList = JSON.parse(stored);
    compareList = compareList.filter(p => p._id !== productId);
    sessionStorage.setItem(COMPARE_KEY, JSON.stringify(compareList));
  } catch (e) {}
}

export function getCompareList() {
  try {
    const stored = sessionStorage.getItem(COMPARE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

// Smooth scroll to element (for in-page navigation)
export function scrollToElement(selector, offset = 80) {
  try {
    const element = $w(selector);
    if (element) {
      element.scrollTo();
    }
  } catch (e) {}
}

// Format product description for display (strip HTML, truncate)
export function formatDescription(html, maxLength = 200) {
  if (!html) return '';
  const text = html.replace(/<[^>]*>/g, '').trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
}

// Determine product badge text based on product data
export function getProductBadge(product) {
  if (!product) return null;

  if (product.ribbon) return product.ribbon;
  if (product.discount && product.discount > 0) return 'Sale';
  if (product.inStoreOnly) return 'In-Store Only';

  // Check if product is new (within last 30 days)
  if (product._createdDate) {
    const created = new Date(product._createdDate);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (created > thirtyDaysAgo) return 'New';
  }

  return null;
}
