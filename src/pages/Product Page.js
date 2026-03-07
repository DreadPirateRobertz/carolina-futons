// Product Page.js - Orchestrator
// Coordinates component initialization and cross-sell sections
import { getRelatedProducts, getSameCollection, getCustomersAlsoBought } from 'backend/productRecommendations.web';
import { trackProductView, getRecentlyViewed } from 'public/galleryHelpers.js';
import { cacheProduct } from 'public/productCache';
import { trackProductPageView } from 'public/engagementTracker';
import { fireViewContent } from 'public/ga4Tracking';
import { collapseOnMobile, initBackToTop, isMobile } from 'public/mobileHelpers';
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
import { initFeelAndComfort } from 'public/FeelAndComfort.js';
import { initDimensionDisplay, initRoomFitChecker, initSizeComparisonTable, initDimensionOverlay, initDoorwayPresets, initShippingDimensions, initVisualSizeComparison } from 'public/ProductSizeGuide.js';
import { initInventoryDisplay } from 'public/InventoryDisplay.js';
import { initBrowseTracking as initBrowseTrackingModule, _createBrowseState } from 'public/BrowseReminder.js';
import { makeClickable } from 'public/a11yHelpers.js';
import { initProductSocialProof } from 'public/socialProofToast';
import { initProductARViewer } from 'public/ProductARViewer.js';
import { getFlashSales } from 'backend/promotions.web';
import { initProductUrgencyBadge } from 'public/flashSaleHelpers';
import { initLifestyleGallery } from 'public/LifestyleGallery.js';
import { applyProductPageTokens } from 'public/ProductPagePolish.js';
import { initCustomizationBuilder } from 'public/CustomizationBuilder.js';
import { initProductVideoSection } from 'public/ProductVideoSection.js';
import { initProduct360Viewer } from 'public/Product360Viewer.js';
import { initProductQA } from 'public/ProductQA.js';

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

    const productSections = [
      { name: 'variantSelector', init: () => initVariantSelector($w, state) },
      { name: 'swatchSelector', init: () => initSwatchSelector($w, state) },
      { name: 'relatedProducts', init: loadRelatedProducts },
      { name: 'collectionProducts', init: loadCollectionProducts },
      { name: 'recentlyViewed', init: loadRecentlyViewed },
      { name: 'alsoBought', init: loadAlsoBought },
      { name: 'productSchema', init: () => injectProductSchema($w, state) },
      { name: 'productMeta', init: () => injectProductMeta(state) },
      { name: 'pinterestMeta', init: () => injectPinterestMeta(state) },
      { name: 'imageGallery', init: () => initImageGallery($w, state) },
      { name: 'arViewer', init: () => initProductARViewer($w, state) },
      { name: 'breadcrumbs', init: () => initBreadcrumbs($w, state) },
      { name: 'addToCart', init: () => initAddToCartEnhancements($w, state) },
      { name: 'quantitySelector', init: () => initQuantitySelector($w, state) },
      { name: 'productBadge', init: () => initProductBadge($w, state) },
      { name: 'productVideo', init: () => initProductVideo($w, state) },
      { name: 'bundleSection', init: () => initBundleSection($w, state) },
      { name: 'stockUrgency', init: () => initStockUrgency($w, state) },
      { name: 'flashSaleBadge', init: () => initFlashSaleUrgency() },
      { name: 'backInStock', init: () => initBackInStockNotification($w, state) },
      { name: 'wishlistButton', init: () => initWishlistButton($w, state) },
      { name: 'productReviews', init: () => initProductReviews($w, state) },
      { name: 'financingOptions', init: () => initFinancingOptions($w, state) },
      { name: 'customizationBuilder', init: () => initCustomizationBuilder($w, state) },
      { name: 'productQA', init: () => initProductQA($w, state) },
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
      { name: 'feelAndComfort', init: () => initFeelAndComfort($w, state) },
      { name: 'swatchRequest', init: () => initSwatchRequest($w, state) },
      { name: 'swatchCTA', init: () => initSwatchCTA($w, state) },
      { name: 'productInfoAccordion', init: () => initProductInfoAccordion($w) },
      { name: 'comfortCards', init: () => initComfortCards($w, state) },
      { name: 'dimensionDisplay', init: () => initDimensionDisplay($w, state) },
      { name: 'roomFitChecker', init: () => initRoomFitChecker($w, state) },
      { name: 'doorwayPresets', init: () => initDoorwayPresets($w) },
      { name: 'sizeComparisonTable', init: () => initSizeComparisonTable($w, state) },
      { name: 'dimensionOverlay', init: () => initDimensionOverlay($w, state) },
      { name: 'shippingDimensions', init: () => initShippingDimensions($w, state) },
      { name: 'visualSizeComparison', init: () => initVisualSizeComparison($w, state) },
      { name: 'inventoryDisplay', init: () => initInventoryDisplay($w, state) },
      { name: 'lifestyleGallery', init: () => initLifestyleGallery($w, state) },
      { name: 'videoSection', init: () => initProductVideoSection($w, state) },
      { name: 'viewer360', init: () => initProduct360Viewer($w, state) },
      { name: 'designTokens', init: () => applyProductPageTokens($w) },
      { name: 'collapseOnMobile', init: () => collapseOnMobile($w, ['#recentlyViewedSection', '#relatedSection', '#alsoBoughtSection']) },
      { name: 'backToTop', init: () => initBackToTop($w) },
      { name: 'browseTracking', init: () => initBrowseTrackingModule($w, state, _browseState) },
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

// ── Pinterest Rich Pins Meta ──────────────────────────────────────────

async function injectPinterestMeta(state) {
  try {
    if (!state.product) return;
    const { injectPinterestMeta: injectPins } = await import('public/product/productSchema.js');
    await injectPins(state.product);
  } catch (e) {
    console.error('[ProductPage] Failed to set Pinterest meta:', e?.message || e);
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

