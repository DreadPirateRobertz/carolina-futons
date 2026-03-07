// Product Page.js - Orchestrator
// Coordinates component initialization and cross-sell sections
// Performance: uses prioritizeSections for critical/deferred split,
// dynamic import() for below-fold components to reduce initial bundle
import { getRelatedProducts, getSameCollection, getCustomersAlsoBought } from 'backend/productRecommendations.web';
import { trackProductView, getRecentlyViewed } from 'public/galleryHelpers.js';
import { cacheProduct } from 'public/productCache';
import { trackProductPageView } from 'public/engagementTracker';
import { fireViewContent } from 'public/ga4Tracking';
import { collapseOnMobile, initBackToTop, isMobile } from 'public/mobileHelpers';
import { buildGridAlt } from 'public/productPageUtils.js';
import { getCachedProduct } from 'public/productCache';
import wixLocationFrontend from 'wix-location-frontend';
import { prioritizeSections } from 'public/performanceHelpers.js';

// Critical above-fold components (statically imported)
import { initImageGallery, initProductBadge, initProductVideo } from 'public/ProductGallery.js';
import { initVariantSelector, initSwatchSelector } from 'public/ProductOptions.js';
import { initBreadcrumbs, initProductInfoAccordion, initSocialShare, initDeliveryEstimate, initSwatchRequest, initSwatchCTA } from 'public/ProductDetails.js';
import { initQuantitySelector, initAddToCartEnhancements, initStickyCartBar, initBundleSection, initStockUrgency, initBackInStockNotification, initWishlistButton } from 'public/AddToCart.js';
import { initBrowseTracking as initBrowseTrackingModule, _createBrowseState } from 'public/BrowseReminder.js';
import { makeClickable } from 'public/a11yHelpers.js';
import { initProductSocialProof } from 'public/socialProofToast';
import { getFlashSales } from 'backend/promotions.web';
import { initProductUrgencyBadge } from 'public/flashSaleHelpers';
import { applyProductPageTokens } from 'public/ProductPagePolish.js';
import { initInventoryDisplay } from 'public/InventoryDisplay.js';
import { injectProductMeta as injectProductSeoMeta } from 'public/product/productSchema.js';

// Below-fold components: dynamically imported in deferred section inits
// ProductARViewer, Product360Viewer, ProductVideoSection, CustomizationBuilder,
// LifestyleGallery, ComfortStoryCards, FeelAndComfort, ProductQA,
// ProductReviews, ProductFinancing, ProductSizeGuide

const state = {
  product: null,
  selectedSwatchId: null,
  selectedQuantity: 1,
  bundleProduct: null,
};

const _browseState = _createBrowseState();

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

    // Mountain skyline SVG border — gradient variant for product hero
    try {
      import('public/MountainSkyline.js').then(({ initMountainSkyline }) => {
        initMountainSkyline($w, { variant: 'gradient', containerId: '#productHeroSkyline' });
      }).catch(() => {
        // MountainSkyline module not yet available — silently skip
      });
    } catch (e) {}

    // Critical: above-fold content that affects LCP (variant selector, gallery, add-to-cart, breadcrumbs)
    // Deferred: below-fold content loaded fire-and-forget (reviews, cross-sell, AR, video, etc.)
    const sections = [
      // ── Critical (above-fold, affects LCP) ──
      { name: 'variantSelector', init: () => initVariantSelector($w, state), critical: true },
      { name: 'swatchSelector', init: () => initSwatchSelector($w, state), critical: true },
      { name: 'imageGallery', init: () => initImageGallery($w, state), critical: true },
      { name: 'breadcrumbs', init: () => initBreadcrumbs($w, state), critical: true },
      { name: 'addToCart', init: () => initAddToCartEnhancements($w, state), critical: true },
      { name: 'quantitySelector', init: () => initQuantitySelector($w, state), critical: true },
      { name: 'productBadge', init: () => initProductBadge($w, state), critical: true },
      { name: 'productVideo', init: () => initProductVideo($w, state), critical: true },
      { name: 'stockUrgency', init: () => initStockUrgency($w, state), critical: true },
      { name: 'bundleSection', init: () => initBundleSection($w, state), critical: true },
      { name: 'backInStock', init: () => initBackInStockNotification($w, state), critical: true },
      { name: 'wishlistButton', init: () => initWishlistButton($w, state), critical: true },
      { name: 'designTokens', init: () => applyProductPageTokens($w), critical: true },
      // JSON-LD structured data via wix-seo-frontend (SSR-compatible, must be critical for crawlers)
      { name: 'productMeta', init: () => injectProductSeoMeta(state.product), critical: true },

      // ── Deferred (below-fold, fire-and-forget) ──
      { name: 'flashSaleBadge', init: () => initFlashSaleUrgency(), critical: false },
      { name: 'socialShare', init: () => initSocialShare($w, state), critical: false },
      { name: 'stickyCartBar', init: () => initStickyCartBar($w, state), critical: false },
      { name: 'deliveryEstimate', init: () => initDeliveryEstimate($w, state), critical: false },
      { name: 'swatchRequest', init: () => initSwatchRequest($w, state), critical: false },
      { name: 'swatchCTA', init: () => initSwatchCTA($w, state), critical: false },
      { name: 'productInfoAccordion', init: () => initProductInfoAccordion($w), critical: false },
      { name: 'inventoryDisplay', init: () => initInventoryDisplay($w, state), critical: false },
      { name: 'collapseOnMobile', init: () => collapseOnMobile($w, ['#recentlyViewedSection', '#relatedSection', '#alsoBoughtSection']), critical: false },
      { name: 'backToTop', init: () => initBackToTop($w), critical: false },
      { name: 'browseTracking', init: () => initBrowseTrackingModule($w, state, _browseState), critical: false },
      // Cross-sell sections (below fold, backend calls)
      { name: 'relatedProducts', init: loadRelatedProducts, critical: false },
      { name: 'collectionProducts', init: loadCollectionProducts, critical: false },
      { name: 'recentlyViewed', init: loadRecentlyViewed, critical: false },
      { name: 'alsoBought', init: loadAlsoBought, critical: false },
      // Dynamically imported below-fold components
      { name: 'productReviews', init: async () => { const m = await import('public/ProductReviews.js'); m.initProductReviews($w, state); }, critical: false },
      { name: 'financingOptions', init: async () => { const m = await import('public/ProductFinancing.js'); m.initFinancingOptions($w, state); }, critical: false },
      { name: 'arViewer', init: async () => { const m = await import('public/ProductARViewer.js'); m.initProductARViewer($w, state); }, critical: false },
      { name: 'customizationBuilder', init: async () => { const m = await import('public/CustomizationBuilder.js'); m.initCustomizationBuilder($w, state); }, critical: false },
      { name: 'productQA', init: async () => { const m = await import('public/ProductQA.js'); m.initProductQA($w, state); }, critical: false },
      { name: 'feelAndComfort', init: async () => { const m = await import('public/FeelAndComfort.js'); m.initFeelAndComfort($w, state); }, critical: false },
      { name: 'comfortCards', init: async () => { const m = await import('public/ComfortStoryCards.js'); m.initComfortCards($w, state); }, critical: false },
      { name: 'lifestyleGallery', init: async () => { const m = await import('public/LifestyleGallery.js'); m.initLifestyleGallery($w, state); }, critical: false },
      { name: 'videoSection', init: async () => { const m = await import('public/ProductVideoSection.js'); m.initProductVideoSection($w, state); }, critical: false },
      { name: 'viewer360', init: async () => { const m = await import('public/Product360Viewer.js'); m.initProduct360Viewer($w, state); }, critical: false },
      // Size guide modal (lazy-loads ProductSizeGuide components on open)
      { name: 'sizeGuide', init: async () => {
        const m = await import('public/SizeGuideModal.js');
        await m.initSizeGuideModal($w, state);
      }, critical: false },
    ];

    const { critical: criticalResults } = await prioritizeSections(sections, {
      onError: (section, reason) => {
        console.error(`[ProductPage] Deferred section "${section.name}" failed:`, reason);
        import('backend/errorMonitoring.web').then(({ logError }) => {
          logError({
            message: `Product page section "${section.name}" failed`,
            stack: reason?.stack || String(reason),
            page: 'Product Page',
            context: `initProductPage/deferred/${section.name}`,
            severity: 'warning',
          });
        }).catch(err => console.error('[ProductPage] Error logging failed:', err.message));
      },
    });

    criticalResults.forEach((result, i) => {
      if (result.status === 'rejected') {
        const criticalSections = sections.filter(s => s.critical);
        console.error(`[ProductPage] Critical section "${criticalSections[i].name}" failed:`, result.reason);
        import('backend/errorMonitoring.web').then(({ logError }) => {
          logError({
            message: `Product page section "${criticalSections[i].name}" failed`,
            stack: result.reason?.stack || String(result.reason),
            page: 'Product Page',
            context: `initProductPage/${criticalSections[i].name}`,
            severity: 'error',
          });
        }).catch(err => console.error('[ProductPage] Error logging failed:', err.message));
      }
    });

    // Social proof toast (non-blocking, delayed)
    initProductSocialProof($w, state.product._id, state.product.name).catch(() => {});
  } catch (err) {
    console.error('Error initializing product page:', err);
  }
}

// ── Flash Sale Urgency Badge ──────────────────────────────────────────

async function initFlashSaleUrgency() {
  try {
    if (!state.product) return;
    const deals = await getFlashSales();
    if (!deals || deals.length === 0) return;

    // Find a deal that applies to this product (sitewide or matching product)
    const deal = deals[0]; // Use the most urgent (soonest ending) deal
    initProductUrgencyBadge($w, { deal });
  } catch (e) {
    // Flash sale badge is non-critical — silent fail
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
    try {
      $w('#recentlyViewedSection').accessibility.ariaLabel = 'Recently viewed products';
      $w('#recentlyViewedSection').accessibility.role = 'region';
    } catch (e) {}
    repeater.data = recent;
    repeater.onItemReady(($item, itemData) => {
      try { $item('#recentImage').src = itemData.mainMedia; } catch (e) {}
      try { $item('#recentImage').alt = buildGridAlt(itemData); } catch (e) {}
      try { $item('#recentName').text = itemData.name; } catch (e) {}
      try { $item('#recentPrice').text = itemData.price; } catch (e) {}
      const nav = () => import('wix-location-frontend').then(({ to }) => to(`/product-page/${itemData.slug}`));
      makeClickable($item('#recentImage'), nav, { ariaLabel: `View ${itemData.name}` });
      makeClickable($item('#recentName'), nav, { ariaLabel: `View ${itemData.name} details` });
      // Quick-add-to-cart button
      try {
        const addBtn = $item('#recentAddToCart');
        if (addBtn) {
          try { addBtn.accessibility.ariaLabel = `Add ${itemData.name} to cart`; } catch (e) {}
          addBtn.onClick(async () => {
            try {
              addBtn.disable();
              addBtn.label = 'Adding...';
              const { addToCart } = await import('public/cartService.js');
              await addToCart(itemData._id);
              addBtn.label = 'Added!';
              setTimeout(() => { try { addBtn.label = 'Add to Cart'; addBtn.enable(); } catch (e) {} }, 2000);
            } catch (err) {
              addBtn.label = 'Add to Cart';
              addBtn.enable();
            }
          });
        }
      } catch (e) {}
    });
  } catch (e) {}
}

async function loadAlsoBought() {
  try {
    if (!state.product?._id) return;
    const result = await getCustomersAlsoBought(state.product._id, 4);
    if (!result?.success || !result.products?.length) {
      try { $w('#alsoBoughtSection').collapse(); } catch (e) {}
      return;
    }
    const repeater = $w('#alsoBoughtRepeater');
    if (!repeater) {
      try { $w('#alsoBoughtSection').collapse(); } catch (e) {}
      return;
    }
    try { $w('#alsoBoughtSection').expand(); } catch (e) {}
    try {
      $w('#alsoBoughtSection').accessibility.ariaLabel = 'Customers also bought';
      $w('#alsoBoughtSection').accessibility.role = 'region';
    } catch (e) {}
    repeater.data = result.products;
    repeater.onItemReady(($item, itemData) => {
      try { $item('#alsoBoughtImage').src = itemData.mainMedia; } catch (e) {}
      try { $item('#alsoBoughtImage').alt = buildGridAlt(itemData); } catch (e) {}
      try { $item('#alsoBoughtName').text = itemData.name; } catch (e) {}
      try { $item('#alsoBoughtPrice').text = itemData.formattedPrice; } catch (e) {}
      if (itemData.ribbon) {
        try { $item('#alsoBoughtBadge').text = itemData.ribbon; $item('#alsoBoughtBadge').show(); } catch (e) {}
      }
      const nav = () => import('wix-location-frontend').then(({ to }) => to(`/product-page/${itemData.slug}`));
      makeClickable($item('#alsoBoughtImage'), nav, { ariaLabel: `View ${itemData.name}` });
      makeClickable($item('#alsoBoughtName'), nav, { ariaLabel: `View ${itemData.name} details` });
      // Quick-add-to-cart button
      try {
        const addBtn = $item('#alsoBoughtAddToCart');
        if (addBtn) {
          try { addBtn.accessibility.ariaLabel = `Add ${itemData.name} to cart`; } catch (e) {}
          addBtn.onClick(async () => {
            try {
              addBtn.disable();
              addBtn.label = 'Adding...';
              const { addToCart } = await import('public/cartService.js');
              await addToCart(itemData._id);
              addBtn.label = 'Added!';
              setTimeout(() => { try { addBtn.label = 'Add to Cart'; addBtn.enable(); } catch (e) {} }, 2000);
            } catch (err) {
              addBtn.label = 'Add to Cart';
              addBtn.enable();
            }
          });
        }
      } catch (e) {}
    });
  } catch (err) { console.error('Error loading also bought:', err); }
}

