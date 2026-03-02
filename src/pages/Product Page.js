// Product Page.js - Orchestrator
// Coordinates component initialization and cross-sell sections
import { getRelatedProducts, getSameCollection } from 'backend/productRecommendations.web';
import { trackProductView, getRecentlyViewed } from 'public/galleryHelpers.js';
import { cacheProduct } from 'public/productCache';
import { trackProductPageView } from 'public/engagementTracker';
import { fireViewContent } from 'public/ga4Tracking';
import { collapseOnMobile, initBackToTop, isMobile } from 'public/mobileHelpers';
import { colors } from 'public/designTokens.js';
import { buildGridAlt } from 'public/productPageUtils.js';
import { getCachedProduct } from 'public/productCache';
import wixLocationFrontend from 'wix-location-frontend';

// Components
import { initImageGallery, initProductBadge, initProductVideo } from 'public/ProductGallery.js';
import { initVariantSelector, initSwatchSelector } from 'public/ProductOptions.js';
import { initBreadcrumbs, initProductInfoAccordion, initSocialShare, initDeliveryEstimate, injectProductSchema, initSwatchRequest, initSwatchCTA } from 'public/ProductDetails.js';
import { initProductReviews } from 'public/ProductReviews.js';
import { initFinancingOptions } from 'public/ProductFinancing.js';
import { initQuantitySelector, initAddToCartEnhancements, initStickyCartBar, initBundleSection, initStockUrgency, initBackInStockNotification, initWishlistButton } from 'public/AddToCart.js';
import { initComfortCards } from 'public/ComfortStoryCards.js';
import { initDimensionDisplay, initRoomFitChecker, initSizeComparisonTable } from 'public/ProductSizeGuide.js';
import { getStockStatus } from 'backend/inventoryService.web';
import { trackBrowseSession, captureRemindMeRequest } from 'backend/browseAbandonment.web';
import { makeClickable } from 'public/a11yHelpers.js';
import { initProductSocialProof } from 'public/socialProofToast';
import { validateEmail } from 'public/validators.js';
import { initProductARViewer } from 'public/ProductARViewer.js';
import { initLifestyleGallery } from 'public/LifestyleGallery.js';
import { applyProductPageTokens } from 'public/ProductPagePolish.js';

const state = {
  product: null,
  selectedSwatchId: null,
  selectedQuantity: 1,
  bundleProduct: null,
};

const _browseState = {
  sessionId: '',
  startTime: Date.now(),
  productsViewed: [],
};

$w.onReady(async function () {
  await initProductPage();
});

async function initProductPage() {
  try {
    // Show cached product data instantly while dataset loads (max 5 min stale)
    const slug = wixLocationFrontend.path?.[1] || '';
    const cached = slug ? getCachedProduct(slug) : null;
    const CACHE_MAX_AGE_MS = 5 * 60 * 1000;
    if (cached && (!cached._cachedAt || (Date.now() - cached._cachedAt) < CACHE_MAX_AGE_MS)) {
      try { $w('#productName').text = cached.name; } catch (e) {}
      try { $w('#productPrice').text = cached.formattedPrice; } catch (e) {}
      try { if (cached.mainMedia) $w('#productMainImage').src = cached.mainMedia; } catch (e) {}
    }

    await $w('#productDataset').onReady();
    state.product = $w('#productDataset').getCurrentItem();
    if (!state.product) {
      try { $w('#productName').text = 'Product Not Found'; } catch (e) {}
      try { $w('#productPrice').text = ''; } catch (e) {}
      try { $w('#productDescription').text = 'Sorry, this product is no longer available. Please browse our catalog for similar items.'; } catch (e) {}
      try { $w('#addToCartButton').hide(); } catch (e) {}
      return;
    }

    trackProductView(state.product);
    cacheProduct(state.product);
    trackProductPageView(state.product);
    fireViewContent(state.product);

    const productSections = [
      { name: 'variantSelector', init: () => initVariantSelector($w, state) },
      { name: 'swatchSelector', init: () => initSwatchSelector($w, state) },
      { name: 'relatedProducts', init: loadRelatedProducts },
      { name: 'collectionProducts', init: loadCollectionProducts },
      { name: 'recentlyViewed', init: loadRecentlyViewed },
      { name: 'productSchema', init: () => injectProductSchema($w, state) },
      { name: 'productMeta', init: () => injectProductMeta(state) },
      { name: 'imageGallery', init: () => initImageGallery($w, state) },
      { name: 'arViewer', init: () => initProductARViewer($w, state) },
      { name: 'breadcrumbs', init: () => initBreadcrumbs($w, state) },
      { name: 'addToCart', init: () => initAddToCartEnhancements($w, state) },
      { name: 'quantitySelector', init: () => initQuantitySelector($w, state) },
      { name: 'productBadge', init: () => initProductBadge($w, state) },
      { name: 'productVideo', init: () => initProductVideo($w, state) },
      { name: 'bundleSection', init: () => initBundleSection($w, state) },
      { name: 'stockUrgency', init: () => initStockUrgency($w, state) },
      { name: 'backInStock', init: () => initBackInStockNotification($w, state) },
      { name: 'wishlistButton', init: () => initWishlistButton($w, state) },
      { name: 'productReviews', init: () => initProductReviews($w, state) },
      { name: 'financingOptions', init: () => initFinancingOptions($w, state) },
    ];

    const results = await Promise.allSettled(productSections.map(s => s.init()));

    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(`[ProductPage] Section "${productSections[i].name}" failed:`, result.reason);
        import('backend/errorMonitoring.web').then(({ logError }) => {
          logError({
            message: `Product page section "${productSections[i].name}" failed`,
            stack: result.reason?.stack || String(result.reason),
            page: 'Product Page',
            context: `initProductPage/${productSections[i].name}`,
            severity: 'error',
          });
        }).catch(err => console.error('[ProductPage] Error logging failed:', err.message));
      }
    });

    // Each init wrapped individually so one failure doesn't block the rest
    const secondaryInits = [
      { name: 'socialShare', init: () => initSocialShare($w, state) },
      { name: 'stickyCartBar', init: () => initStickyCartBar($w, state) },
      { name: 'deliveryEstimate', init: () => initDeliveryEstimate($w, state) },
      { name: 'swatchRequest', init: () => initSwatchRequest($w, state) },
      { name: 'swatchCTA', init: () => initSwatchCTA($w, state) },
      { name: 'productInfoAccordion', init: () => initProductInfoAccordion($w) },
      { name: 'comfortCards', init: () => initComfortCards($w, state) },
      { name: 'dimensionDisplay', init: () => initDimensionDisplay($w, state) },
      { name: 'roomFitChecker', init: () => initRoomFitChecker($w, state) },
      { name: 'sizeComparisonTable', init: () => initSizeComparisonTable($w, state) },
      { name: 'inventoryDisplay', init: () => initInventoryDisplay($w, state) },
      { name: 'lifestyleGallery', init: () => initLifestyleGallery($w, state) },
      { name: 'designTokens', init: () => applyProductPageTokens($w) },
      { name: 'collapseOnMobile', init: () => collapseOnMobile($w, ['#recentlyViewedSection', '#relatedSection']) },
      { name: 'backToTop', init: () => initBackToTop($w) },
      { name: 'browseTracking', init: () => initBrowseTracking(state) },
    ];

    for (const section of secondaryInits) {
      try {
        section.init();
      } catch (e) {
        console.error(`[ProductPage] "${section.name}" init failed:`, e);
      }
    }

    // Social proof toast (non-blocking, delayed)
    initProductSocialProof($w, state.product._id, state.product.name).catch(() => {});
  } catch (err) {
    console.error('Error initializing product page:', err);
  }
}

// ── Product Meta Description & Title ─────────────────────────────────

async function injectProductMeta(state) {
  try {
    if (!state.product) return;
    const { injectProductMeta: injectMeta } = await import('public/product/productSchema.js');
    await injectMeta(state.product);
  } catch (e) {
    console.error('[ProductPage] Failed to set meta:', e?.message || e);
  }
}

// ── Cross-Sell Sections ───────────────────────────────────────────────

async function loadRelatedProducts() {
  try {
    if (!state.product) return;
    const category = state.product.collections?.[0] || '';
    const related = await getRelatedProducts(state.product._id, category, 4);
    const repeater = $w('#relatedRepeater');
    if (!repeater || related.length === 0) {
      try { $w('#relatedSection').collapse(); } catch (e) {}
      return;
    }
    repeater.onItemReady(($item, itemData) => {
      $item('#relatedImage').src = itemData.mainMedia;
      $item('#relatedImage').alt = buildGridAlt(itemData);
      $item('#relatedName').text = itemData.name;
      $item('#relatedPrice').text = itemData.formattedPrice;
      if (itemData.ribbon) {
        try { $item('#relatedBadge').text = itemData.ribbon; $item('#relatedBadge').show(); } catch (e) {}
      }
      const nav = () => import('wix-location-frontend').then(({ to }) => to(`/product-page/${itemData.slug}`));
      makeClickable($item('#relatedImage'), nav, { ariaLabel: `View ${itemData.name}` });
      makeClickable($item('#relatedName'), nav, { ariaLabel: `View ${itemData.name} details` });
    });
    repeater.data = related;
  } catch (err) { console.error('Error loading related products:', err); }
}

async function loadCollectionProducts() {
  try {
    if (!state.product?.collections) return;
    const products = await getSameCollection(state.product._id, state.product.collections, 6);
    const repeater = $w('#collectionRepeater');
    if (!repeater || products.length === 0) {
      try { $w('#collectionSection').collapse(); } catch (e) {}
      return;
    }
    repeater.onItemReady(($item, itemData) => {
      $item('#collectionImage').src = itemData.mainMedia;
      $item('#collectionImage').alt = buildGridAlt(itemData);
      $item('#collectionName').text = itemData.name;
      $item('#collectionPrice').text = itemData.formattedPrice;
      const nav = () => import('wix-location-frontend').then(({ to }) => to(`/product-page/${itemData.slug}`));
      makeClickable($item('#collectionImage'), nav, { ariaLabel: `View ${itemData.name}` });
      makeClickable($item('#collectionName'), nav, { ariaLabel: `View ${itemData.name} details` });
    });
    repeater.data = products;
  } catch (err) { console.error('Error loading collection products:', err); }
}

async function loadRecentlyViewed() {
  try {
    const recent = getRecentlyViewed(state.product?._id);
    if (!recent?.length) {
      try { $w('#recentlyViewedSection').collapse(); } catch (e) {}
      return;
    }
    const repeater = $w('#recentlyViewedRepeater');
    if (!repeater) {
      try { $w('#recentlyViewedSection').collapse(); } catch (e) {}
      return;
    }
    $w('#recentlyViewedSection').expand();
    repeater.data = recent;
    repeater.onItemReady(($item, itemData) => {
      $item('#recentImage').src = itemData.mainMedia;
      $item('#recentImage').alt = buildGridAlt(itemData);
      $item('#recentName').text = itemData.name;
      $item('#recentPrice').text = itemData.price;
      const nav = () => import('wix-location-frontend').then(({ to }) => to(`/product-page/${itemData.slug}`));
      makeClickable($item('#recentImage'), nav, { ariaLabel: `View ${itemData.name}` });
      makeClickable($item('#recentName'), nav, { ariaLabel: `View ${itemData.name} details` });
    });
  } catch (e) {}
}

// ── Inventory Stock Display ─────────────────────────────────────────

async function initInventoryDisplay($w, state) {
  try {
    if (!state.product?._id) return;

    const stockInfo = await getStockStatus(state.product._id);

    // Stock status badge
    try {
      const badge = $w('#stockStatus');
      if (badge) {
        if (stockInfo.preOrder) {
          badge.text = 'Pre-Order Available';
          badge.style.color = colors.mountainBlue;
        } else if (stockInfo.status === 'out_of_stock') {
          badge.text = 'Out of Stock';
          badge.style.color = colors.error;
        } else if (stockInfo.status === 'low_stock') {
          badge.text = 'Low Stock — Order Soon';
          badge.style.color = colors.sunsetCoral;
        } else {
          badge.text = 'In Stock';
          badge.style.color = colors.success;
        }
        try { badge.accessibility.ariaLabel = `Stock status: ${badge.text}`; } catch (e) {}
        try { badge.accessibility.ariaLive = 'polite'; } catch (e) {}
      }
    } catch (e) {}

    // Variant stock indicators (if variant selector exists)
    if (stockInfo.variants.length > 0) {
      try {
        const variantRepeater = $w('#variantStockRepeater');
        if (variantRepeater) {
          variantRepeater.data = stockInfo.variants.map(v => ({
            _id: v.variantId,
            ...v,
          }));
          variantRepeater.onItemReady(($item, itemData) => {
            try { $item('#variantStockLabel').text = itemData.variantLabel; } catch (e) {}
            try {
              const statusEl = $item('#variantStockStatus');
              if (statusEl) {
                statusEl.text = itemData.status === 'out_of_stock' ? 'Sold Out'
                  : itemData.status === 'low_stock' ? `Only ${itemData.quantity} left`
                  : 'Available';
                statusEl.style.color = itemData.status === 'out_of_stock' ? colors.error
                  : itemData.status === 'low_stock' ? colors.sunsetCoral
                  : colors.success;
              }
            } catch (e) {}
          });
        }
      } catch (e) {}
    }
  } catch (e) {}
}

// ── Browse Abandonment Tracking ─────────────────────────────────

function initBrowseTracking(state) {
  try {
    if (!state.product) return;

    // Generate or retrieve session ID
    if (typeof sessionStorage !== 'undefined') {
      try {
        _browseState.sessionId = sessionStorage.getItem('cf_browse_session') || '';
        if (!_browseState.sessionId) {
          _browseState.sessionId = 'bs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
          sessionStorage.setItem('cf_browse_session', _browseState.sessionId);
        }
      } catch (e) {}
    }
    if (!_browseState.sessionId) {
      _browseState.sessionId = 'bs_' + Date.now();
    }

    // Record this product view
    _browseState.productsViewed.push({
      productId: state.product._id,
      productName: state.product.name || '',
      price: state.product.price || 0,
      viewStart: Date.now(),
    });

    // Send session data on page visibility change (tab switch, navigate away)
    // Guard against double-send from both visibilitychange and beforeunload
    let _browseSessionSent = false;
    const sendOnce = () => {
      if (_browseSessionSent) return;
      _browseSessionSent = true;
      sendBrowseSession();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') sendOnce();
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', sendOnce);
    }

    // Show "Remind Me" popup after 2 minutes of viewing
    setTimeout(() => {
      showRemindMePopup();
    }, 2 * 60 * 1000);
  } catch (e) {
    // Browse tracking is non-critical
  }
}

function sendBrowseSession() {
  try {
    const now = Date.now();
    const products = _browseState.productsViewed.map(p => ({
      productId: p.productId,
      productName: p.productName,
      price: p.price,
      viewDuration: now - p.viewStart,
    }));

    const currentPath = '/' + (wixLocationFrontend.path || []).join('/');

    trackBrowseSession({
      sessionId: _browseState.sessionId,
      productsViewed: products,
      totalDuration: now - _browseState.startTime,
      entryPage: currentPath,
      exitPage: currentPath,
    }).catch(err => console.error('[ProductPage] trackBrowseSession failed:', err.message));
  } catch (e) {}
}

function showRemindMePopup() {
  try {
    const popup = $w('#remindMePopup');
    if (!popup) return;

    // Don't show if already dismissed this session
    if (typeof sessionStorage !== 'undefined') {
      try {
        if (sessionStorage.getItem('cf_remind_shown')) return;
      } catch (e) {}
    }

    try { $w('#remindMeTitle').text = 'Still deciding?'; } catch (e) {}
    try { $w('#remindMeSubtitle').text = "We'll remind you about this item — no spam, just a gentle nudge."; } catch (e) {}
    try { $w('#remindMeEmailInput').accessibility.ariaLabel = 'Enter your email for reminder'; } catch (e) {}
    try { $w('#remindMeSubmit').accessibility.ariaLabel = 'Get reminded about this product'; } catch (e) {}
    try { $w('#remindMeClose').accessibility.ariaLabel = 'Close reminder popup'; } catch (e) {}

    // Set dialog ARIA attributes
    try { popup.accessibility.role = 'dialog'; } catch (e) {}
    try { popup.accessibility.ariaModal = true; } catch (e) {}
    try { popup.accessibility.ariaLabel = 'Product reminder signup'; } catch (e) {}

    popup.show('fade', { duration: 300 });

    if (typeof sessionStorage !== 'undefined') {
      try { sessionStorage.setItem('cf_remind_shown', '1'); } catch (e) {}
    }

    // Close handler
    try {
      $w('#remindMeClose').onClick(() => {
        popup.hide('fade', { duration: 200 });
      });
    } catch (e) {}

    // Submit handler
    try {
      $w('#remindMeSubmit').onClick(async () => {
        const email = $w('#remindMeEmailInput').value?.trim();
        if (!email || !validateEmail(email)) {
          try {
            const errEl = $w('#remindMeError');
            if (errEl) { errEl.text = 'Please enter a valid email address.'; errEl.show('fade', { duration: 300 }); }
          } catch (e) {}
          return;
        }

        try {
          $w('#remindMeSubmit').disable();
          $w('#remindMeSubmit').label = 'Saving...';

          await captureRemindMeRequest(_browseState.sessionId, email);

          $w('#remindMeSubmit').label = 'Saved!';
          try { $w('#remindMeSuccess').text = "We'll send you a reminder."; } catch (e) {}
          try { $w('#remindMeSuccess').show('fade', { duration: 300 }); } catch (e) {}

          setTimeout(() => {
            try { popup.hide('fade', { duration: 200 }); } catch (e) {}
          }, 3000);
        } catch (err) {
          $w('#remindMeSubmit').enable();
          $w('#remindMeSubmit').label = 'Remind Me';
        }
      });
    } catch (e) {}
  } catch (e) {
    // Remind Me popup is non-critical
  }
}
