// Gallery and product engagement helpers
// Used across multiple pages for consistent product display behavior
import { session } from 'wix-storage-frontend';

// Recently viewed products tracking (stored in session storage)
const RECENTLY_VIEWED_KEY = 'cf_recently_viewed';
const MAX_RECENT = 12;

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

export function addToCompare(product) {
  try {
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

export function getCompareList() {
  try {
    const stored = session.getItem(COMPARE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

export function clearCompareList() {
  try {
    session.removeItem(COMPARE_KEY);
  } catch (e) {}
}

// Smooth scroll to element (for in-page navigation)
// Caller must pass $w from page context since public modules don't have access to $w
export function scrollToElement($w, selector) {
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

// ══════════════════════════════════════════════════════════════════════
// UI Builder Functions — Lightbox, Zoom, Recently Viewed, Badges, etc.
// ══════════════════════════════════════════════════════════════════════

// ── Recently Viewed Section Builder ─────────────────────────────────
// Renders a 'Recently Viewed' horizontal scroll from session storage.
// Naming convention: containerId '#xyzSection' → repeater '#xyzRepeater'

export function buildRecentlyViewedSection(containerId, repeaterItemHandler) {
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

export function buildProductBadgeOverlay(product) {
  const badge = getProductBadge(product);
  if (!badge) return null;

  const configs = {
    Sale:            { text: 'Sale',          bgColor: colors.sunsetCoral,  textColor: colors.white },
    New:             { text: 'New',           bgColor: colors.mountainBlue, textColor: colors.white },
    Featured:        { text: 'Featured',      bgColor: colors.espresso,     textColor: colors.sandBase },
    'In-Store Only': { text: 'In-Store Only', bgColor: colors.mauve,        textColor: colors.espresso },
  };

  return configs[badge] || { text: badge, bgColor: colors.espresso, textColor: colors.white };
}

// ── Image Lightbox ──────────────────────────────────────────────────
// Fullscreen overlay gallery with prev/next navigation, close button,
// and keyboard support (Esc, arrows).
// Page elements: #lightboxOverlay, #lightboxImage, #lightboxClose,
//   #lightboxPrev, #lightboxNext, #lightboxCounter

export function initImageLightbox(galleryElement, mainImageElement) {
  let images = [];
  let currentIndex = 0;
  let isOpen = false;

  // Collect image sources from gallery
  try {
    if (galleryElement && galleryElement.items) {
      images = galleryElement.items.map(item => item.src);
    }
  } catch (e) {}

  // Fallback to main image if gallery is empty
  if (images.length === 0 && mainImageElement) {
    try { images = [mainImageElement.src]; } catch (e) {}
  }
  if (images.length === 0) return null;

  function showImage(index) {
    currentIndex = ((index % images.length) + images.length) % images.length;
    try {
      $w('#lightboxImage').src = images[currentIndex];
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
      $w('#lightboxOverlay').show('fade', { duration: 250 });
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

  // Navigation controls
  try { $w('#lightboxPrev').onClick(() => showImage(currentIndex - 1)); } catch (e) {}
  try { $w('#lightboxNext').onClick(() => showImage(currentIndex + 1)); } catch (e) {}
  try { $w('#lightboxClose').onClick(closeLightbox); } catch (e) {}

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

  return { open: openLightbox, close: closeLightbox, handleKeydown };
}

// ── Image Zoom ──────────────────────────────────────────────────────
// Hover zoom on product images with smooth transitions.
// Page elements: #imageZoomOverlay, #imageZoomImage
// Desktop: hover to zoom; mobile: pinch handled natively by platform.

export function initImageZoom(imageElement, zoomFactor = 2) {
  if (!imageElement) return null;

  let isZoomed = false;

  function showZoom() {
    isZoomed = true;
    try {
      $w('#imageZoomImage').src = imageElement.src;
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

export function initLazyLoadImages(repeaterItems) {
  if (!repeaterItems) return;

  try {
    if (typeof repeaterItems.forEachItem === 'function') {
      repeaterItems.forEachItem(($item) => {
        revealImageOnViewport($item);
      });
    }
  } catch (e) {
    console.error('initLazyLoadImages:', e);
  }
}

function revealImageOnViewport($item) {
  const imageIds = ['#productImage', '#gridImage', '#featuredImage', '#saleImage', '#collectionImage'];
  for (const imgId of imageIds) {
    try {
      const img = $item(imgId);
      if (!img || typeof img.onViewportEnter !== 'function') continue;

      img.hide();
      img.onViewportEnter(() => {
        img.show('fade', { duration: 300 });
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

export function buildComparisonBar() {
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
          $item('#compareItemName').text = itemData.name;
          $item('#compareItemRemove').onClick(() => {
            removeFromCompare(itemData._id);
            buildComparisonBar();
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
        const ids = compareList.map(p => p._id).join(',');
        import('wix-location-frontend').then(({ to }) => {
          to(`/compare?products=${ids}`);
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
        buildComparisonBar();
      });
    } catch (e) {}

    bar.expand();
  } catch (e) {
    console.error('buildComparisonBar:', e);
  }
}
