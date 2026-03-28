// Product Page.js - Orchestrator
// Coordinates component initialization and cross-sell sections
// Performance: uses prioritizeSections for critical/deferred split,
// dynamic import() for below-fold components to reduce initial bundle
import { getRelatedProducts, getSameCollection, getCustomersAlsoBought } from 'backend/productRecommendations.web';
import { trackProductView, getRecentlyViewed } from 'public/galleryHelpers.js';
import { cacheProduct } from 'public/productCache';
// engagementTracker and ga4Tracking are dynamically imported in deferred sections
// to avoid blocking LCP (CF-7zl)
import { collapseOnMobile, initBackToTop, isMobile } from 'public/mobileHelpers';
import { buildGridAlt, isCallForPrice, CALL_FOR_PRICE_TEXT } from 'public/productPageUtils.js';
import { renderSimplePrice } from 'public/productCardHelpers.js';
import { getCachedProduct } from 'public/productCache';
import wixLocationFrontend from 'wix-location-frontend';
import wixData from 'wix-data';
import { prioritizeSections } from 'public/performanceHelpers.js';
import { getImageDimensions } from 'public/galleryConfig.js';

// Critical above-fold components (statically imported)
import { initImageGallery, initProductBadge, initProductVideo } from 'public/ProductGallery.js';
import { initVariantSelector, initSwatchSelector } from 'public/ProductOptions.js';
import { initBreadcrumbs, initProductInfoAccordion, initSocialShare, initDeliveryEstimate, injectProductSchema, initSwatchRequest, initSwatchCTA } from 'public/ProductDetails.js';
import { initQuantitySelector, initAddToCartEnhancements, initStickyCartBar, initBundleSection, initStockUrgency, initBackInStockNotification, initWishlistButton } from 'public/AddToCart.js';
import { initBrowseTracking as initBrowseTrackingModule, _createBrowseState } from 'public/BrowseReminder.js';
import { makeClickable } from 'public/a11yHelpers.js';
import { setCardImage } from 'public/productCardHelpers.js';
import { initProductSocialProof } from 'public/socialProofToast';
import { getFlashSales } from 'backend/promotions.web';
import { getProductVideos } from 'backend/productVideos.web';
import { initProductUrgencyBadge } from 'public/flashSaleHelpers';
import { applyProductPageTokens } from 'public/ProductPagePolish.js';
import { initInventoryDisplay } from 'public/InventoryDisplay.js';
import { injectProductMeta as injectProductSeoMeta, injectPinterestMeta } from 'public/product/productSchema.js';
import { initGiftProductButton as _initGiftProductBtnModule } from 'public/giftProductBtn.js';
import { buildYouTubeEmbed } from 'public/videoHelpers.js';
import { initPDPSocialProofBadge } from 'public/PDPSocialProofBadge.js';
import { initProductStructuredData } from 'public/productStructuredData.js';

// Below-fold components: dynamically imported in deferred section inits
// ProductARViewer, Product360Viewer, ProductVideoSection, CustomizationBuilder,
// LifestyleGallery, ComfortStoryCards, FeelAndComfort,
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
      try { $w('#productName').text = cached.name; } catch (e) { console.warn('[ProductPage] Cached name display failed:', e.message); }
      renderSimplePrice($w('#productPrice'), cached);
      try { if (cached.mainMedia) $w('#productMainImage').src = cached.mainMedia; } catch (e) { console.warn('[ProductPage] Cached image display failed:', e.message); }
    }

    const { items: _productItems } = await wixData.query('Stores/Products').eq('slug', slug).find();
    state.product = _productItems[0] || null;
    if (!state.product) {
      try { $w('#productName').text = 'Product Not Found'; } catch (e) {}
      try { $w('#productPrice').text = ''; } catch (e) {}
      try { $w('#productDescription').text = 'Sorry, this product is no longer available. Please browse our catalog for similar items.'; } catch (e) {}
      try { $w('#addToCartButton').hide(); } catch (e) {}
      return;
    }

    trackProductView(state.product);
    import('public/RecentlyViewedWidget.js').then(({ trackView }) => trackView(state.product._id)).catch((e) => console.error('[RecentlyViewed]', e));
    cacheProduct(state.product);

    // Call-for-price products use a $1.00 Wix placeholder — hide price, disable purchase
    if (isCallForPrice(state.product)) {
      try { $w('#productPrice').text = CALL_FOR_PRICE_TEXT; } catch (e) {}
      try { $w('#productComparePrice').hide(); } catch (e) {}
      try { $w('#addToCartButton').label = 'Call for Pricing'; $w('#addToCartButton').disable(); } catch (e) {}
      try { $w('#quantityInput').hide(); } catch (e) {}
      try { $w('#quantityMinus').hide(); } catch (e) {}
      try { $w('#quantityPlus').hide(); } catch (e) {}
      try { $w('#buyNowButton').hide(); } catch (e) {}
    }

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
      { name: 'productVideo', init: () => initProductVideo($w, state), critical: false },
      { name: 'stockUrgency', init: () => initStockUrgency($w, state), critical: false },
      { name: 'bundleSection', init: () => initBundleSection($w, state), critical: false },
      { name: 'backInStock', init: () => initBackInStockNotification($w, state), critical: false },
      { name: 'wishlistButton', init: () => initWishlistButton($w, state), critical: false },
      { name: 'designTokens', init: () => applyProductPageTokens($w), critical: true },
      // JSON-LD structured data via wix-seo-frontend (SSR-compatible, must be critical for crawlers)
      { name: 'productMeta', init: () => injectProductSeoMeta(state.product), critical: true },

      // ── Deferred (below-fold, fire-and-forget) ──
      // Multi-image gallery enhancements (counter, active thumb, config, scroll)
      { name: 'multiImageGallery', init: async () => {
        const m = await import('public/MultiImageGallery.js');
        m.applyGalleryConfig($w, state);
        m.initGalleryCounter($w, state);
        m.initActiveThumbnail($w, state);
        m.initThumbnailScroll($w, state);
      }, critical: false },
      { name: 'productSchema', init: () => injectProductSchema($w, state), critical: false },
      { name: 'productStructuredData', init: () => initProductStructuredData(state.product?._id, { $w }), critical: false },
      { name: 'pinterestMeta', init: () => injectPinterestMeta(state), critical: false },
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
      { name: 'engagementTracking', init: async () => { const m = await import('public/engagementTracker'); m.trackProductPageView(state.product); }, critical: false },
      { name: 'ga4Tracking', init: async () => { const m = await import('public/ga4Tracking'); m.fireViewContent(state.product); }, critical: false },
      // Cross-sell sections (below fold, backend calls)
      { name: 'relatedProducts', init: loadRelatedProducts, critical: false },
      { name: 'collectionProducts', init: loadCollectionProducts, critical: false },
      { name: 'recentlyViewed', init: loadRecentlyViewed, critical: false },
      { name: 'recentlyViewedWidget', init: async () => { const { renderWidget } = await import('public/RecentlyViewedWidget.js'); return renderWidget($w, { excludeCurrentId: state.product?._id }); }, critical: false },
      { name: 'alsoBought', init: loadAlsoBought, critical: false },
      { name: 'recommendations', init: async () => { const m = await import('public/ProductRecommendations.js'); m.initRecommendationsCarousel($w, state); }, critical: false },
      // Dynamically imported below-fold components
      { name: 'productReviews', init: async () => { const m = await import('public/ProductReviews.js'); m.initProductReviews($w, state); }, critical: false },
      { name: 'financingBadge', init: () => initFinancingBadge($w, state.product), critical: false },
      { name: 'heroFinancingBadge', init: async () => { const m = await import('public/ProductFinancing.js'); await m.renderHeroPricingBadge($w, state.product?.price); }, critical: false },
      { name: 'financingOptions', init: async () => { const m = await import('public/ProductFinancing.js'); m.initFinancingOptions($w, state); }, critical: false },
      { name: 'bundleExperiment', init: async () => {
        const { initBundleDiscountTest } = await import('public/bundleDiscountExperiment');
        const { trackEvent } = await import('public/engagementTracker');
        const { variant, experimentActive } = await initBundleDiscountTest('ProductPage');
        if (experimentActive && variant) {
          trackEvent('ab_experiment_assigned', {
            page: 'product', experiment: 'bundle_discount_test',
            variant: variant.id, discountType: variant.type,
          });
          try {
            $w('#bundleCTA').label = variant.type === 'free_accessory'
              ? `Add Bundle — ${variant.accessoryName} FREE!`
              : `Add Bundle — ${variant.badgeText}`;
            $w('#bundleCTA').expand();
          } catch (e) { /* editor element not yet added */ }
          try {
            $w('#bundleBadge').text = variant.badgeText;
            $w('#bundleBadge').expand();
          } catch (e) {}
        }
      }, critical: false },
      { name: 'roomStaging', init: async () => { const m = await import('public/RoomStagingUI.js'); m.initRoomStaging($w, state); }, critical: false },
      { name: 'liveShowroom', init: async () => { const m = await import('public/LiveShowroomUI.js'); m.initLiveShowroom($w, state); }, critical: false },
      { name: 'arViewer', init: async () => { const m = await import('public/ProductARViewer.js'); m.initProductARViewer($w, state); }, critical: false },
      { name: 'customizationBuilder', init: async () => { const m = await import('public/CustomizationBuilder.js'); m.initCustomizationBuilder($w, state); }, critical: false },
      { name: 'subscribeAndSave', init: async () => { const m = await import('public/SubscribeAndSave.js'); await m.initSubscribeAndSave(state.product?._id, state.product?.name, { $w }); }, critical: false },
      {
        name: 'productQnA',
        critical: false,
        init: async () => {
          const productId = state.product?._id;
          const m = await import('public/ProductQnA.js');
          const { items, hasMore, totalCount, page, error } = await m.loadQnA(productId);
          if (error) console.error('[ProductQnA] loadQnA returned error for product:', productId);
          m.renderQnA($w, items, { hasMore, totalCount });
          m.initSearch($w, productId);
          m.injectSchema($w, productId);

          let currentPage = page;
          try {
            $w('#qnaLoadMore').onClick(async () => {
              const result = await m.loadMore($w, productId, currentPage);
              if (result.appended > 0) currentPage++;
            });
          } catch (e) { console.error('[ProductQnA] qnaLoadMore wiring failed:', e); }
          try {
            $w('#qnaSubmitBtn').onClick(() => m.submitQuestion($w, productId));
          } catch (e) { console.error('[ProductQnA] qnaSubmitBtn wiring failed:', e); }
        },
      },
      { name: 'feelAndComfort', init: async () => { const m = await import('public/FeelAndComfort.js'); m.initFeelAndComfort($w, state); }, critical: false },
      { name: 'comfortCards', init: async () => { const m = await import('public/ComfortStoryCards.js'); m.initComfortCards($w, state); }, critical: false },
      { name: 'lifestyleGallery', init: async () => { const m = await import('public/LifestyleGallery.js'); m.initLifestyleGallery($w, state); }, critical: false },
      { name: 'videoSection', init: async () => { const m = await import('public/ProductVideoSection.js'); m.initProductVideoSection($w, state); }, critical: false },
      // CF-m55f: Direct YouTube embed from product.videoUrl CMS field
      // Requires: #productVideoSection (Box) + #productVideoEmbed (HtmlComponent) in Studio
      { name: 'productYouTubeVideo', init: () => initProductYouTubeVideo($w, state), critical: false },
      // CF-7byz: CMS-driven videos from ProductVideos collection, matched by slug
      // Requires: #productVideoContainer (Box) + #productVideoCatalogEmbed (HtmlComponent) + #productVideoCatalogTitle (Text) in Studio
      { name: 'catalogVideos', init: () => initCatalogVideos($w, state), critical: false },
      { name: 'viewer360', init: async () => { const m = await import('public/Product360Viewer.js'); m.initProduct360Viewer($w, state); }, critical: false },
      // Assembly guide link (fetches by SKU, shows PDF/video)
      { name: 'assemblyGuide', init: async () => {
        const m = await import('public/ProductAssemblyGuide.js');
        await m.initProductAssemblyGuide($w, state);
      }, critical: false },
      // Size guide modal (lazy-loads ProductSizeGuide components on open)
      { name: 'sizeGuide', init: async () => {
        const m = await import('public/SizeGuideModal.js');
        await m.initSizeGuideModal($w, state);
      }, critical: false },
      // Inline dimension diagram + room fit callout (mobile-ported patterns)
      { name: 'dimensionDiagram', init: async () => {
        const m = await import('public/ProductSizeGuide.js');
        m.initDimensionDiagram($w, state);
        m.initRoomFitCallout($w, state);
      }, critical: false },
      // Full swatch request form flow (name, email, address, swatch selection)
      { name: 'swatchRequestFlow', init: async () => { const m = await import('public/SwatchRequestFlow.js'); m.initSwatchRequestFlow($w, state); }, critical: false },
      // CF-uits: Room Planner CTA — links to /room-planner with product preloaded
      { name: 'roomPlannerCTA', init: async () => { const m = await import('public/roomPlannerCTA.js'); m.initRoomPlannerCTA($w, state); }, critical: false },
      // CF-ac80 (S1) / CF-1792 (S3): Showroom CTA + QR mode banner
      { name: 'showroomCTA', init: async () => { const m = await import('backend/showroomService.web.js'); await initShowroomCTA($w, state, m); }, critical: false },
      // CF-9fv2: Gift product button — adds gift card to cart for current product
      { name: 'giftProductButton', init: async () => {
        const product = { productId: state.product?._id || '', productName: state.product?.name || '', price: state.product?.price || 0 };
        const cartModule = await import('wix-stores-frontend').catch(() => null);
        const addToCart = cartModule?.default?.cart?.addProducts?.bind(cartModule.default.cart);
        const navModule = await import('wix-location-frontend').catch(() => null);
        const navigate = (navModule?.default?.to ?? navModule?.to) ? (url => (navModule?.default?.to ?? navModule?.to)(url)) : undefined;
        _initGiftProductBtnModule($w, product, { addToCart, navigate });
      }, critical: false },
      // CF-75d1: Style Quiz CTA — nudges shoppers to the quiz when browsing products
      { name: 'quizCTA', init: () => initProductPageQuizCTA($w), critical: false },
      // CF-o0va: Shipping estimate widget — zip input + rate display
      { name: 'shippingWidget', init: async () => {
        const { initShippingWidget } = await import('public/ShippingWidget.js');
        await initShippingWidget($w, state.product?._id || '');
      }, critical: false },
      // CF-vu9m: PDP shipping estimate badge — surfaces cost before checkout
      { name: 'pdpShippingEstimate', init: async () => {
        const { initPDPShippingEstimate } = await import('public/PDPShippingEstimate.js');
        await initPDPShippingEstimate($w, state.product);
      }, critical: false },
      // CF-z64j: Size guide modal — static dimension table
      { name: 'sizeGuide', init: async () => {
        const { initSizeGuide } = await import('public/SizeGuide.js');
        await initSizeGuide($w);
      }, critical: false },
      // CF-ic1: PDP social proof badge — "X members competing — earn N points on this purchase"
      // Pre-auth: logged-out visitors see neighbor count (no login required).
      // ZIP source: ?zipPrefix URL param; fallback to national count.
      { name: 'socialProofBadge', init: async () => {
        const { getNeighborCount } = await import('backend/socialProofBadge.web');
        const zipPrefix = wixLocationFrontend.query?.zipPrefix || null;
        await initPDPSocialProofBadge($w, state, getNeighborCount, { zipPrefix });
      }, critical: false },
      // CF-e0y2: Gamification chat widget — cold visitors see greeting; members get full chat.
      // getChatGreeting is Permissions.Anyone; chatWithAssistant is Permissions.Member.
      // Non-member send → auth_required → promptLogin modal.
      { name: 'chatWidget', init: async () => {
        const { getChatGreeting, chatWithAssistant: sendChat } = await import('backend/gamificationChatbot.web');
        const productName = state.product?.name || '';
        const greetResult = await getChatGreeting({ productName });
        if (!greetResult.enabled) return;
        // Wire send button first — only show widget if wiring succeeds (avoids dead UI)
        $w('#chatSendBtn').onClick(async () => {
          try {
            const message = $w('#chatInput').value;
            if (!message.trim()) return;
            $w('#chatSendBtn').disable();
            const result = await sendChat(message);
            if (result?.error === 'auth_required') {
              const { authentication } = await import('wix-members-frontend');
              authentication.promptLogin({ modal: true });
            } else if (result?.reply) {
              $w('#chatResponseText').text = result.reply;
              $w('#chatInput').value = '';
            }
          } catch (e) {
            console.error('[ProductPage] chatWidget send failed:', e);
          } finally {
            $w('#chatSendBtn').enable();
          }
        });
        try { $w('#chatGreetingText').text = greetResult.greeting; } catch (e) {}
        try { $w('#chatAssistantWidget').show(); } catch (e) {}
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
    if (state.product?._id) {
      initProductSocialProof($w, state.product._id, state.product.name).catch(() => {});
    }
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


// ── Financing Badge (CF-et8y) ─────────────────────────────────────────

function initFinancingBadge($w, product) {
  if (!product || typeof product.price !== 'number') {
    try { $w('#financingBadge').hide(); } catch (e) {}
    return;
  }
  $w('#financingLink').href = '/financing';
  if (product.price >= 200) {
    const monthly = Math.ceil(product.price / 24);
    $w('#financingMonthly').text = `As low as $${monthly}/mo`;
    $w('#financingBadge').show();
  } else {
    $w('#financingBadge').hide();
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
      if (!itemData) return;
      setCardImage($item('#relatedImage'), itemData, '', getImageDimensions('productGridCard'));
      try { $item('#relatedName').text = itemData.name; } catch (e) {}
      renderSimplePrice($item('#relatedPrice'), itemData);
      if (itemData.ribbon) {
        try { $item('#relatedBadge').text = itemData.ribbon; $item('#relatedBadge').show(); } catch (e) {}
      }
      const slug = itemData.slug || '';
      const name = itemData.name || 'Product';
      const nav = () => import('wix-location-frontend').then(({ to }) => to(`/product-page/${slug}`));
      makeClickable($item('#relatedImage'), nav, { ariaLabel: `View ${name}` });
      makeClickable($item('#relatedName'), nav, { ariaLabel: `View ${name} details` });
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
      if (!itemData) return;
      setCardImage($item('#collectionImage'), itemData, '', getImageDimensions('productGridCard'));
      try { $item('#collectionName').text = itemData.name; } catch (e) {}
      renderSimplePrice($item('#collectionPrice'), itemData);
      const slug = itemData.slug || '';
      const name = itemData.name || 'Product';
      const nav = () => import('wix-location-frontend').then(({ to }) => to(`/product-page/${slug}`));
      makeClickable($item('#collectionImage'), nav, { ariaLabel: `View ${name}` });
      makeClickable($item('#collectionName'), nav, { ariaLabel: `View ${name} details` });
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
    repeater.onItemReady(($item, itemData) => {
      setCardImage($item('#recentImage'), itemData, '', getImageDimensions('productGridCard'));
      try { $item('#recentName').text = itemData.name; } catch (e) {}
      renderSimplePrice($item('#recentPrice'), itemData);
      const nav = () => import('wix-location-frontend').then(({ to }) => to(`/product-page/${itemData.slug}`));
      makeClickable($item('#recentImage'), nav, { ariaLabel: `View ${itemData.name}` });
      makeClickable($item('#recentName'), nav, { ariaLabel: `View ${itemData.name} details` });
      // Quick-add-to-cart button (hide for call-for-price items)
      try {
        const addBtn = $item('#recentAddToCart');
        if (addBtn) {
          if (isCallForPrice(itemData)) { addBtn.hide(); } else {
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
        }
      } catch (e) {}
    });
    repeater.data = recent;
  } catch (e) { console.error('[RecentlyViewedWidget] loadRecentlyViewed error', e); }
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
      setCardImage($item('#alsoBoughtImage'), itemData, '', getImageDimensions('productGridCard'));
      try { $item('#alsoBoughtName').text = itemData.name; } catch (e) {}
      renderSimplePrice($item('#alsoBoughtPrice'), itemData);
      if (itemData.ribbon) {
        try { $item('#alsoBoughtBadge').text = itemData.ribbon; $item('#alsoBoughtBadge').show(); } catch (e) {}
      }
      const nav = () => import('wix-location-frontend').then(({ to }) => to(`/product-page/${itemData.slug}`));
      makeClickable($item('#alsoBoughtImage'), nav, { ariaLabel: `View ${itemData.name}` });
      makeClickable($item('#alsoBoughtName'), nav, { ariaLabel: `View ${itemData.name} details` });
      // Quick-add-to-cart button (hide for call-for-price items)
      try {
        const addBtn = $item('#alsoBoughtAddToCart');
        if (addBtn) {
          if (isCallForPrice(itemData)) { addBtn.hide(); } else {
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
        }
      } catch (e) {}
    });
  } catch (err) { console.error('Error loading also bought:', err); }
}


// ── Gift Product Button (CF-9fv2) ─────────────────────────────────────
// Re-exported from public/giftProductBtn.js for backward compatibility.
export { initGiftProductButton as initGiftProductButton } from 'public/giftProductBtn.js';

// ── Showroom CTA / QR Mode (CF-ac80 S1, CF-1792 S3) ──────────────────
// S1: #showroomCTA button → Wix Bookings "Book a Showroom Visit"
// S3: ?qr=1 → #storeModeBar staff-facing banner

/**
 * @param {Function} $wFn - Wix $w selector
 * @param {object} _state - page state (reserved for product context)
 * @param {object} svc - pre-imported showroomService.web.js module
 */
async function initShowroomCTA($wFn, _state, svc) {
  // S3: QR mode — detect ?qr=1, show #storeModeBar staff banner
  try {
    const wixLoc = await import('wix-location-frontend');
    const query = wixLoc.default?.query ?? wixLoc.query ?? {};
    if (svc.isQrMode(query)) {
      const bar = $wFn('#storeModeBar');
      bar.text = svc.buildStoreModeText();
      bar.show();
    }
  } catch (e) { /* #storeModeBar optional */ }

  // S1: Showroom CTA button → Wix Bookings
  try {
    const btn = $wFn('#showroomCTA');
    btn.label = 'Book a Showroom Visit';
    try { btn.accessibility.ariaLabel = 'Book a showroom visit at Carolina Futons in Hendersonville NC'; } catch (e) {}
    btn.onClick(async () => {
      try {
        const result = await svc.getShowroomBookingUrl();
        if (result.url) {
          const loc = await import('wix-location-frontend');
          (loc.default?.to ?? loc.to)(result.url);
        }
      } catch (err) { console.error('[ProductPage] Showroom booking nav failed:', err); }
    });
  } catch (e) { /* #showroomCTA optional */ }
}

// ── YouTube Video Embed (CF-m55f S1) ─────────────────────────────────
// Shows a product walkthrough YouTube video when product.videoUrl is set.
// Editor elements: #productVideoSection (Box) + #productVideoEmbed (HtmlComponent)

/**
 * Show a YouTube embed for product.videoUrl if present.
 * Collapses #productVideoSection when no video URL or URL is unrecognised.
 * @param {Function} $wFn - Wix $w selector
 * @param {Object} pageState - Product page state (needs pageState.product.videoUrl)
 */
function initProductYouTubeVideo($wFn, pageState) {
  try {
    const videoUrl = pageState?.product?.videoUrl;
    if (!videoUrl) {
      try { $wFn('#productVideoSection').collapse(); } catch (e) {}
      return;
    }

    const iframeHtml = buildYouTubeEmbed(videoUrl);
    if (!iframeHtml) {
      try { $wFn('#productVideoSection').collapse(); } catch (e) {}
      return;
    }

    try { $wFn('#productVideoEmbed').src = iframeHtml; } catch (e) {}
    try {
      $wFn('#productVideoSection').accessibility.role = 'region';
      $wFn('#productVideoSection').accessibility.ariaLabel = 'Product video';
    } catch (e) {}
    try { $wFn('#productVideoSection').expand(); } catch (e) {}
  } catch (e) {
    try { $wFn('#productVideoSection').collapse(); } catch (e2) {}
  }
}

// ── Catalog Videos (CF-7byz) ──────────────────────────────────────────────────
// CMS-driven videos from ProductVideos collection matched by product slug.
// Editor elements: #productVideoContainer (Box) + #productVideoCatalogEmbed (HtmlComponent)
// + optional #productVideoCatalogTitle (Text).

/**
 * Fetches and renders the first matching video from the ProductVideos CMS collection.
 * Collapses #productVideoContainer when the collection has no entry for this slug.
 * @param {Function} $wFn - Wix $w selector
 * @param {Object} pageState - Product page state (needs pageState.product.slug)
 */
export async function initCatalogVideos($wFn, pageState) {
  const slug = pageState?.product?.slug;
  if (!slug) {
    try { $wFn('#productVideoContainer').collapse(); } catch (e) {}
    return;
  }

  try {
    const result = await getProductVideos(slug);
    if (!result.success || !result.data || result.data.length === 0) {
      try { $wFn('#productVideoContainer').collapse(); } catch (e) {}
      return;
    }

    const primary = result.data[0];
    const iframeHtml = primary.youtubeUrl ? buildYouTubeEmbed(primary.youtubeUrl) : null;
    if (!iframeHtml && !primary.mp4Url) {
      try { $wFn('#productVideoContainer').collapse(); } catch (e) {}
      return;
    }

    try { $wFn('#productVideoCatalogTitle').text = primary.title || 'Product Video'; } catch (e) {}

    try { $wFn('#productVideoCatalogEmbed').src = iframeHtml || primary.mp4Url; } catch (e) {}

    try {
      $wFn('#productVideoContainer').accessibility.role = 'region';
      $wFn('#productVideoContainer').accessibility.ariaLabel = `${primary.title || 'Product'} video`;
    } catch (e) {}
    try { $wFn('#productVideoContainer').expand(); } catch (e) {}
  } catch (e) {
    try { $wFn('#productVideoContainer').collapse(); } catch (e2) {}
    throw e; // propagate so prioritizeSections onError can log via errorMonitoring
  }
}

// ── Style Quiz CTA (CF-75d1 S6) ────────────────────────────────────
// Nudges shoppers to the personalized recommendation quiz from the product page.

/**
 * Initialize the style quiz CTA on the product page.
 * Wires #productQuizCTAButton to navigate to /style-quiz.
 * @param {Function} $wFn - Wix $w selector
 */
function initProductPageQuizCTA($wFn) {
  try {
    const btn = $wFn('#productQuizCTAButton');
    if (!btn) return;
    try { btn.accessibility.ariaLabel = 'Take the style quiz to find your perfect furniture'; } catch (e) {}
    btn.onClick(() => {
      import('wix-location-frontend').then(({ to }) => {
        to('/style-quiz');
      });
    });
  } catch (e) {
    // #productQuizCTAButton is optional — collapses gracefully if not in editor
  }
}
