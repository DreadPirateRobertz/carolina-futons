/** @module galleryHelpers - Product gallery interaction and engagement tracking.
 *
 * Provides recently-viewed tracking (session storage), product comparison lists,
 * abandoned-browse data capture (time-on-page, scroll-to-pricing, variant clicks),
 * image lightbox/zoom initializers, lazy loading, and a floating comparison bar.
 *
 * Dependencies: wix-storage-frontend (session), designTokens (colors),
 * touchHelpers (swipe gestures for mobile lightbox).
 */
import { session } from 'wix-storage-frontend';
import { colors } from 'public/designTokens.js';
import { enableSwipe } from 'public/touchHelpers';

// Recently viewed products tracking (stored in session storage)
const RECENTLY_VIEWED_KEY = 'cf_recently_viewed';
const MAX_RECENT = 12;

/**
 * Record a product view in session storage for "Recently Viewed" display.
 * Deduplicates by product ID (moves to front if already present) and caps
 * the list at MAX_RECENT (12) items. Also kicks off browse-tracking for
 * abandoned-browse recovery signals.
 * @param {Object} product - Wix product object (must have _id)
 * @returns {void}
 */
export function trackProductView(product) {
  if (!product || !product._id) return;

  try {
    const stored = session.getItem(RECENTLY_VIEWED_KEY);
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

    session.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recent));
  } catch (e) {
    // Session storage may not be available
  }

  // Start enriched browse tracking for this product view
  startBrowseTracking(product._id);
}

// ── Abandoned Browse Data Capture ─────────────────────────────────
// Tracks engagement signals: time on page, scroll to pricing, variant interactions

const BROWSE_DATA_KEY = 'cf_browse_data';

// Store refs for cleanup on SPA navigation
let _browseScrollHandler = null;
let _browseUnloadHandler = null;
let _browseVisChangeHandler = null;

function startBrowseTracking(productId) {
  // Clean up any previous tracking listeners first
  cleanupBrowseTracking();

  try {
    const startTime = Date.now();
    let scrolledToPricing = false;
    let variantInteractions = 0;

    // Track scroll to pricing section using DOM API (no $w in public modules)
    // Store handler reference for SPA cleanup
    _browseScrollHandler = () => {
      try {
        if (typeof document !== 'undefined') {
          const pricingEl = document.querySelector('[data-testid="product-price"], [id*="productPrice"]');
          if (pricingEl) {
            const rect = pricingEl.getBoundingClientRect();
            if (rect.top < window.innerHeight) {
              scrolledToPricing = true;
              window.removeEventListener('scroll', _browseScrollHandler);
              _browseScrollHandler = null;
            }
          }
        }
      } catch (e) {}
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('scroll', _browseScrollHandler, { passive: true });
    }

    // Variant interactions are tracked by page-level code which has $w access.
    // This module only records the counter via the browse data store.

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

    _browseUnloadHandler = recordBrowseData;
    _browseVisChangeHandler = () => {
      if (document.visibilityState === 'hidden') {
        recordBrowseData();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', _browseUnloadHandler);
      document.addEventListener('visibilitychange', _browseVisChangeHandler);
    }
  } catch (e) {
    // Browse tracking is non-critical
  }
}

/**
 * Remove all browse tracking event listeners.
 * Call on SPA page navigation to prevent memory leaks.
 */
export function cleanupBrowseTracking() {
  try {
    if (typeof window !== 'undefined') {
      if (_browseScrollHandler) {
        window.removeEventListener('scroll', _browseScrollHandler);
        _browseScrollHandler = null;
      }
      if (_browseUnloadHandler) {
        window.removeEventListener('beforeunload', _browseUnloadHandler);
        _browseUnloadHandler = null;
      }
    }
    if (typeof document !== 'undefined' && _browseVisChangeHandler) {
      document.removeEventListener('visibilitychange', _browseVisChangeHandler);
      _browseVisChangeHandler = null;
    }
  } catch (e) {}
}

/**
 * Retrieve accumulated browse engagement data from sessionStorage.
 * Returns a map of productId to engagement signals (timeSpentMs,
 * scrolledToPricing, variantInteractions, timestamp) for use by
 * cart-recovery and abandoned-browse emails.
 * @returns {Object.<string, {timeSpentMs: number, scrolledToPricing: boolean, variantInteractions: number, timestamp: string}>}
 */
export function getBrowseData() {
  try {
    const stored = sessionStorage.getItem(BROWSE_DATA_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (e) {
    return {};
  }
}

/**
 * Clear all recently viewed products and browse data from session storage.
 * Call on logout to ensure no PII-adjacent data persists.
 */
export function clearRecentlyViewed() {
  try {
    session.removeItem(RECENTLY_VIEWED_KEY);
  } catch (e) {}
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(BROWSE_DATA_KEY);
    }
  } catch (e) {}
}

/**
 * Get the list of recently viewed products from session storage.
 * Optionally excludes a product (e.g., the one currently being viewed).
 * @param {string|null} [excludeId=null] - Product ID to exclude from results
 * @returns {Array<{_id: string, name: string, slug: string, price: string, mainMedia: string}>}
 */
export function getRecentlyViewed(excludeId = null) {
  try {
    const stored = session.getItem(RECENTLY_VIEWED_KEY);
    if (!stored) return [];

    let recent = JSON.parse(stored);
    if (excludeId) {
      recent = recent.filter(p => p._id !== excludeId);
    }
    return recent;
  } catch (e) {
    console.error('[galleryHelpers] Failed to parse recently viewed:', e.message);
    return [];
  }
}

// Product comparison helper
const COMPARE_KEY = 'cf_compare_list';
const MAX_COMPARE = 4;

/**
 * Add a product to the comparison list (session storage).
 * Rejects duplicates and enforces a maximum of 4 items.
 * Validates product._id format to prevent injection.
 * @param {Object} product - Wix product object (must have _id, name, slug, formattedPrice, mainMedia)
 * @returns {boolean} True if added, false if duplicate/full/invalid
 */
export function addToCompare(product) {
  try {
    if (!product || !product._id) return false;
    // Validate _id: only allow alphanumeric, hyphens, underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(product._id)) return false;

    const stored = session.getItem(COMPARE_KEY);
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

    session.setItem(COMPARE_KEY, JSON.stringify(compareList));
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Remove a product from the comparison list by ID.
 * @param {string} productId - Product ID to remove
 * @returns {void}
 */
export function removeFromCompare(productId) {
  try {
    const stored = session.getItem(COMPARE_KEY);
    if (!stored) return;

    let compareList = JSON.parse(stored);
    compareList = compareList.filter(p => p._id !== productId);
    session.setItem(COMPARE_KEY, JSON.stringify(compareList));
  } catch (e) {
    console.error('[galleryHelpers] Failed to parse compare list:', e.message);
  }
}

/**
 * Get the current product comparison list from session storage.
 * @returns {Array<{_id: string, name: string, slug: string, price: string, mainMedia: string}>}
 */
export function getCompareList() {
  try {
    const stored = session.getItem(COMPARE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Clear the entire comparison list from session storage.
 * @returns {void}
 */
export function clearCompareList() {
  try {
    session.removeItem(COMPARE_KEY);
  } catch (e) {}
}

/**
 * Smooth-scroll to a page element by Wix selector.
 * Caller must pass $w from page context because public modules lack direct $w access.
 * @param {Function} $w - Wix page selector function
 * @param {string} selector - Element selector (e.g. '#reviewsSection')
 * @returns {void}
 */
export function scrollToElement($w, selector) {
  try {
    const element = $w(selector);
    if (element) {
      element.scrollTo();
    }
  } catch (e) {}
}

/**
 * Strip HTML tags from a product description and truncate to a maximum length.
 * Truncation breaks at word boundaries and appends an ellipsis.
 * @param {string} html - Raw HTML description string
 * @param {number} [maxLength=200] - Maximum character length
 * @returns {string} Plain text, truncated with '...' if needed
 */
export function formatDescription(html, maxLength = 200) {
  if (!html) return '';
  const text = html.replace(/<[^>]*>/g, '').trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
}

/**
 * Determine the badge label for a product card overlay.
 * Priority: explicit ribbon > active discount ('Sale') > in-store-only > new (within 30 days) > null.
 * @param {Object} product - Wix product object
 * @returns {string|null} Badge text or null if no badge applies
 */
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

// ══════════════════════════════════════════════════════════════════════
// UI Builder Functions — Lightbox, Zoom, Recently Viewed, Badges, etc.
// ══════════════════════════════════════════════════════════════════════

// ── Recently Viewed Section Builder ─────────────────────────────────
// Renders a 'Recently Viewed' horizontal scroll from session storage.
// Naming convention: containerId '#xyzSection' → repeater '#xyzRepeater'

/**
 * Populate a "Recently Viewed" section with data from session storage.
 * Collapses the container if no recent products exist; otherwise populates
 * the derived repeater (e.g., '#xyzSection' derives '#xyzRepeater') and expands.
 * @param {Function} $w - Wix page selector function
 * @param {string} containerId - Container element ID (e.g., '#recentlyViewedSection')
 * @param {Function} repeaterItemHandler - onItemReady callback for repeater items
 * @returns {void}
 */
export function buildRecentlyViewedSection($w, containerId, repeaterItemHandler) {
  const recent = getRecentlyViewed();

  try {
    if (recent.length === 0) {
      $w(containerId).collapse();
      return;
    }

    // Derive repeater ID: '#xyzSection' → '#xyzRepeater'
    const repeaterId = containerId.replace(/Section$/, 'Repeater');
    const repeater = $w(repeaterId);

    // Ensure each item has a string _id for the Wix repeater
    repeater.data = recent.map((item, i) => ({
      ...item,
      _id: item._id || `rv-${i}`,
    }));
    repeater.onItemReady(repeaterItemHandler);

    $w(containerId).expand();
  } catch (e) {
    console.error('buildRecentlyViewedSection:', e);
  }
}

// ── Product Badge Overlay Config ────────────────────────────────────
// Returns { text, bgColor, textColor } using designTokens for badge state

/**
 * Build badge overlay styling for a product card using design tokens.
 * Returns text, background color, and text color keyed to badge state (Sale, New, Featured, In-Store Only).
 * @param {Object} product - Wix product object
 * @returns {{text: string, bgColor: string, textColor: string}|null} Badge config or null if no badge
 */
export function buildProductBadgeOverlay(product) {
  const badge = getProductBadge(product);
  if (!badge) return null;

  const configs = {
    Sale:            { text: 'Sale',          bgColor: colors.sunsetCoral,  textColor: colors.white },
    New:             { text: 'New',           bgColor: colors.mountainBlue, textColor: colors.white },
    Featured:        { text: 'Featured',      bgColor: colors.espresso,     textColor: colors.sandBase },
    'In-Store Only': { text: 'In-Store Only', bgColor: colors.sandDark,      textColor: colors.espresso },
  };

  return configs[badge] || { text: badge, bgColor: colors.espresso, textColor: colors.white };
}

// ── Image Lightbox ──────────────────────────────────────────────────
// Fullscreen overlay gallery with prev/next navigation, close button,
// and keyboard support (Esc, arrows).
// Page elements: #lightboxOverlay, #lightboxImage, #lightboxClose,
//   #lightboxPrev, #lightboxNext, #lightboxCounter

/**
 * Initialize a fullscreen image lightbox with prev/next navigation.
 * Binds gallery thumbnail clicks, main image clicks, keyboard shortcuts
 * (Escape, ArrowLeft, ArrowRight), and mobile swipe gestures.
 * Page elements required: #lightboxOverlay, #lightboxImage, #lightboxClose,
 * #lightboxPrev, #lightboxNext, #lightboxCounter.
 * @param {Function} $w - Wix page selector function
 * @param {Object} galleryElement - Wix gallery $w element with .items and .onItemClicked
 * @param {Object} mainImageElement - Wix image $w element for the main product photo
 * @returns {{open: Function, close: Function, handleKeydown: Function, destroy: Function}|null} Lightbox controller or null if no images
 */
export function initImageLightbox($w, galleryElement, mainImageElement) {
  let images = [];
  let imageAlts = [];
  let currentIndex = 0;
  let isOpen = false;

  // Collect image sources and alt text from gallery
  try {
    if (galleryElement && galleryElement.items) {
      images = galleryElement.items.map(item => item.src);
      imageAlts = galleryElement.items.map(item => item.title || item.alt || 'Product image');
    }
  } catch (e) {}

  // Fallback to main image if gallery is empty
  if (images.length === 0 && mainImageElement) {
    try {
      images = [mainImageElement.src];
      imageAlts = [mainImageElement.alt || 'Product image'];
    } catch (e) {}
  }
  if (images.length === 0) return null;

  function showImage(index) {
    currentIndex = ((index % images.length) + images.length) % images.length;
    try {
      $w('#lightboxImage').src = images[currentIndex];
      $w('#lightboxImage').alt = imageAlts[currentIndex] || 'Product image';
      $w('#lightboxCounter').text = `${currentIndex + 1} / ${images.length}`;
    } catch (e) {}

    // Hide nav for single-image galleries
    if (images.length <= 1) {
      try { $w('#lightboxPrev').hide(); } catch (e) {}
      try { $w('#lightboxNext').hide(); } catch (e) {}
      try { $w('#lightboxCounter').hide(); } catch (e) {}
    }
  }

  function openLightbox(startIndex = 0) {
    isOpen = true;
    showImage(startIndex);
    try {
      const overlay = $w('#lightboxOverlay');
      overlay.show('fade', { duration: 250 });
      try { overlay.accessibility.role = 'dialog'; } catch (e) {}
      try { overlay.accessibility.ariaModal = true; } catch (e) {}
      try { overlay.accessibility.ariaLabel = 'Product image lightbox'; } catch (e) {}
    } catch (e) {}
  }

  function closeLightbox() {
    isOpen = false;
    try {
      $w('#lightboxOverlay').hide('fade', { duration: 200 });
    } catch (e) {}
  }

  // Gallery thumbnail click → open at that image
  try {
    galleryElement.onItemClicked((event) => {
      const idx = images.indexOf(event.item.src);
      openLightbox(idx >= 0 ? idx : 0);
    });
  } catch (e) {}

  // Main image click → open at current image
  try {
    mainImageElement.onClick(() => {
      const idx = images.indexOf(mainImageElement.src);
      openLightbox(idx >= 0 ? idx : 0);
    });
  } catch (e) {}

  // Navigation controls with ARIA labels
  try {
    $w('#lightboxPrev').onClick(() => showImage(currentIndex - 1));
    try { $w('#lightboxPrev').accessibility.ariaLabel = 'Previous image'; } catch (e) {}
  } catch (e) {}
  try {
    $w('#lightboxNext').onClick(() => showImage(currentIndex + 1));
    try { $w('#lightboxNext').accessibility.ariaLabel = 'Next image'; } catch (e) {}
  } catch (e) {}
  try {
    $w('#lightboxClose').onClick(closeLightbox);
    try { $w('#lightboxClose').accessibility.ariaLabel = 'Close lightbox'; } catch (e) {}
  } catch (e) {}

  // Keyboard support (Esc, arrow keys)
  function handleKeydown(e) {
    if (!isOpen) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showImage(currentIndex - 1);
    if (e.key === 'ArrowRight') showImage(currentIndex + 1);
  }
  try {
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', handleKeydown);
    }
  } catch (e) {}

  // Swipe navigation for mobile lightbox
  let cleanupSwipe = null;
  try {
    const overlayEl = $w('#lightboxOverlay');
    if (overlayEl) {
      const swipeTarget = overlayEl.htmlElement || overlayEl;
      if (swipeTarget.addEventListener) {
        cleanupSwipe = enableSwipe(swipeTarget, (direction) => {
          if (direction === 'left') showImage(currentIndex + 1);
          else if (direction === 'right') showImage(currentIndex - 1);
        }, { threshold: 40 });
      }
    }
  } catch (e) {}

  function destroy() {
    try {
      if (typeof document !== 'undefined') {
        document.removeEventListener('keydown', handleKeydown);
      }
      if (cleanupSwipe) cleanupSwipe();
    } catch (e) {}
  }

  return { open: openLightbox, close: closeLightbox, handleKeydown, destroy };
}

// ── Image Zoom ──────────────────────────────────────────────────────
// Hover zoom on product images with smooth transitions.
// Page elements: #imageZoomOverlay, #imageZoomImage
// Desktop: hover to zoom; mobile: pinch handled natively by platform.

/**
 * Initialize hover-zoom on a product image (desktop only; mobile uses native pinch).
 * Shows a zoomed overlay on mouse-enter and hides on mouse-leave.
 * Page elements required: #imageZoomOverlay, #imageZoomImage.
 * @param {Function} $w - Wix page selector function
 * @param {Object} imageElement - Wix image $w element to attach zoom behavior to
 * @param {number} [zoomFactor=2] - Magnification level
 * @returns {{zoomFactor: number, show: Function, hide: Function}|null} Zoom controller or null if no element
 */
export function initImageZoom($w, imageElement, zoomFactor = 2) {
  if (!imageElement) return null;

  let isZoomed = false;

  function showZoom() {
    isZoomed = true;
    try {
      $w('#imageZoomImage').src = imageElement.src;
      try { $w('#imageZoomImage').alt = imageElement.alt || 'Zoomed product image'; } catch (e) {}
      $w('#imageZoomOverlay').show('fade', { duration: 150 });
    } catch (e) {}
  }

  function hideZoom() {
    isZoomed = false;
    try {
      $w('#imageZoomOverlay').hide('fade', { duration: 150 });
    } catch (e) {}
  }

  try {
    imageElement.onMouseIn(showZoom);
    imageElement.onMouseOut(hideZoom);
  } catch (e) {
    console.error('initImageZoom:', e);
  }

  return { zoomFactor, show: showZoom, hide: hideZoom };
}

// ── Lazy Load Images ────────────────────────────────────────────────
// Viewport-triggered reveal for below-fold product images.
// Uses Wix onViewportEnter for intersection observation.
// Supports explicit dimensions to prevent CLS (Cumulative Layout Shift).

const DEFAULT_IMAGE_IDS = ['#productImage', '#gridImage', '#featuredImage', '#saleImage', '#collectionImage'];

/**
 * Initialize viewport-triggered lazy loading for product images in a repeater.
 * Uses Wix onViewportEnter for intersection observation. Supports explicit
 * dimensions to prevent Cumulative Layout Shift (CLS).
 * @param {Object} repeaterItems - Wix repeater element with .forEachItem method
 * @param {Object} [opts] - Options
 * @param {Array<string>} [opts.imageIds] - Image element IDs to look for in each repeater item
 * @param {number} [opts.fadeDuration=300] - Fade-in duration in ms
 * @param {{width: number, height: number}|null} [opts.dimensions=null] - Explicit image dimensions to prevent CLS
 * @returns {void}
 */
export function initLazyLoadImages(repeaterItems, opts = {}) {
  if (!repeaterItems) return;

  const {
    imageIds = DEFAULT_IMAGE_IDS,
    fadeDuration = 300,
    dimensions = null,
  } = opts;

  try {
    if (typeof repeaterItems.forEachItem === 'function') {
      repeaterItems.forEachItem(($item) => {
        revealImageOnViewport($item, imageIds, fadeDuration, dimensions);
      });
    }
  } catch (e) {
    console.error('initLazyLoadImages:', e);
  }
}

function revealImageOnViewport($item, imageIds, fadeDuration, dimensions) {
  for (const imgId of imageIds) {
    try {
      const img = $item(imgId);
      if (!img || typeof img.onViewportEnter !== 'function') continue;

      // Set explicit dimensions to prevent CLS
      if (dimensions) {
        try {
          img.style.width = `${dimensions.width}px`;
          img.style.height = `${dimensions.height}px`;
        } catch (e) { /* style may not be settable */ }
      }

      img.hide();
      img.onViewportEnter(() => {
        img.show('fade', { duration: fadeDuration });
      });
      return;
    } catch (e) {
      continue;
    }
  }
}

// ── Comparison Bar ──────────────────────────────────────────────────
// Floating compare bar showing 2–4 selected products with Compare button.
// Page elements: #compareBar, #compareBarRepeater, #compareButton,
//   #compareClearBtn, #compareCount

/**
 * Build and populate the floating product comparison bar at the bottom of the page.
 * Collapses if the comparison list is empty; otherwise shows thumbnails, a count label,
 * a "Compare" button (enabled at 2+ items), and a "Clear All" button.
 * Page elements required: #compareBar, #compareBarRepeater, #compareButton,
 * #compareClearBtn, #compareCount.
 * @param {Function} $w - Wix page selector function
 * @returns {void}
 */
export function buildComparisonBar($w) {
  const compareList = getCompareList();

  try {
    const bar = $w('#compareBar');

    if (compareList.length === 0) {
      bar.collapse();
      return;
    }

    // Populate comparison items
    try {
      const repeater = $w('#compareBarRepeater');
      repeater.data = compareList.map((item, i) => ({
        ...item,
        _id: item._id || `cmp-${i}`,
      }));
      repeater.onItemReady(($item, itemData) => {
        try {
          $item('#compareItemImage').src = itemData.mainMedia;
          $item('#compareItemImage').alt = `${itemData.name} - compare`;
          $item('#compareItemName').text = itemData.name;
          $item('#compareItemRemove').onClick(() => {
            removeFromCompare(itemData._id);
            buildComparisonBar($w);
          });
        } catch (e) {}
      });
    } catch (e) {}

    // Update count label
    try {
      $w('#compareCount').text = `${compareList.length} item${compareList.length !== 1 ? 's' : ''} selected`;
    } catch (e) {}

    // Compare button — enabled when 2+ items selected
    try {
      $w('#compareButton').onClick(() => {
        const ids = compareList.map(p => encodeURIComponent(p._id)).join(',');
        import('wix-location-frontend').then(({ to }) => {
          to(`/compare?ids=${ids}`);
        });
      });
      if (compareList.length >= 2) {
        $w('#compareButton').enable();
      } else {
        $w('#compareButton').disable();
      }
    } catch (e) {}

    // Clear all button
    try {
      $w('#compareClearBtn').onClick(() => {
        try { sessionStorage.removeItem(COMPARE_KEY); } catch (e) {}
        buildComparisonBar($w);
      });
    } catch (e) {}

    bar.expand();
  } catch (e) {
    console.error('buildComparisonBar:', e);
  }
}
