// Product Page.js - Orchestrator
// Coordinates component initialization and cross-sell sections
import { getRelatedProducts, getSameCollection } from 'backend/productRecommendations.web';
import { trackProductView, getRecentlyViewed } from 'public/galleryHelpers.js';
import { cacheProduct } from 'public/productCache';
import { trackProductPageView } from 'public/engagementTracker';
import { collapseOnMobile, initBackToTop } from 'public/mobileHelpers';
import { buildGridAlt } from 'public/productPageUtils.js';
import { getCachedProduct } from 'public/productCache';
import wixLocationFrontend from 'wix-location-frontend';

// Components
import { initImageGallery, initProductBadge, initProductVideo } from 'public/ProductGallery.js';
import { initVariantSelector, initSwatchSelector } from 'public/ProductOptions.js';
import { initBreadcrumbs, initProductInfoAccordion, initSocialShare, initDeliveryEstimate, injectProductSchema, initSwatchRequest } from 'public/ProductDetails.js';
import { initProductReviews } from 'public/ProductReviews.js';
import { initFinancingOptions } from 'public/ProductFinancing.js';
import { initQuantitySelector, initAddToCartEnhancements, initStickyCartBar, initBundleSection, initStockUrgency, initBackInStockNotification, initWishlistButton } from 'public/AddToCart.js';
import { getProductDimensions, checkRoomFit, convertUnit } from 'backend/sizeGuide.web';

const state = {
  product: null,
  selectedSwatchId: null,
  selectedQuantity: 1,
  bundleProduct: null,
};

$w.onReady(async function () {
  await initProductPage();
});

async function initProductPage() {
  try {
    // Show cached product data instantly while dataset loads
    const slug = wixLocationFrontend.path?.[1] || '';
    const cached = slug ? getCachedProduct(slug) : null;
    if (cached) {
      try { $w('#productName').text = cached.name; } catch (e) {}
      try { $w('#productPrice').text = cached.formattedPrice; } catch (e) {}
      try { if (cached.mainMedia) $w('#productMainImage').src = cached.mainMedia; } catch (e) {}
    }

    await $w('#productDataset').onReady();
    state.product = $w('#productDataset').getCurrentItem();
    if (!state.product) return;

    trackProductView(state.product);
    cacheProduct(state.product);
    trackProductPageView(state.product);

    await Promise.all([
      initVariantSelector($w, state),
      initSwatchSelector($w, state),
      loadRelatedProducts(),
      loadCollectionProducts(),
      loadRecentlyViewed(),
      injectProductSchema($w, state),
      initImageGallery($w, state),
      initBreadcrumbs($w, state),
      initAddToCartEnhancements($w, state),
      initQuantitySelector($w, state),
      initProductBadge($w, state),
      initProductVideo($w, state),
      initBundleSection($w, state),
      initStockUrgency($w, state),
      initBackInStockNotification($w, state),
      initWishlistButton($w, state),
      initProductReviews($w, state),
      initFinancingOptions($w, state),
    ]);

    initSocialShare($w, state);
    initStickyCartBar($w, state);
    initDeliveryEstimate($w, state);
    initSwatchRequest($w, state);
    initProductInfoAccordion($w);
    initDimensionDisplay($w, state);
    initRoomFitChecker($w, state);

    collapseOnMobile($w, ['#recentlyViewedSection', '#relatedProductsSection']);
    initBackToTop($w);
  } catch (err) {
    console.error('Error initializing product page:', err);
  }
}

// ── Dimension Display & Room Fit Checker ──────────────────────────────

let _currentUnit = 'in';

async function initDimensionDisplay($w, state) {
  try {
    if (!state.product) return;

    const dims = await getProductDimensions(state.product._id, 'in');

    if (!dims) {
      // No dimension data — show placeholder
      try { $w('#dimensionSection').expand(); } catch (e) {}
      try { $w('#dimensionTitle').text = 'Dimensions'; } catch (e) {}
      try { $w('#dimensionPlaceholder').text = 'Dimensions coming soon'; } catch (e) {}
      try { $w('#dimensionPlaceholder').show(); } catch (e) {}
      try { $w('#dimensionGrid').hide(); } catch (e) {}
      return;
    }

    state.dimensions = dims;

    // Show dimension section
    try { $w('#dimensionSection').expand(); } catch (e) {}
    try { $w('#dimensionTitle').text = 'Dimensions'; } catch (e) {}
    try { $w('#dimensionPlaceholder').hide(); } catch (e) {}
    try { $w('#dimensionGrid').show(); } catch (e) {}

    renderDimensions($w, dims);

    // Unit toggle (in/cm)
    try {
      const unitToggle = $w('#unitToggle');
      if (unitToggle) {
        unitToggle.options = [
          { label: 'Inches', value: 'in' },
          { label: 'Centimeters', value: 'cm' },
        ];
        unitToggle.value = 'in';
        try { unitToggle.accessibility.ariaLabel = 'Switch dimension units'; } catch (e) {}

        unitToggle.onChange(async () => {
          _currentUnit = unitToggle.value;
          const converted = await getProductDimensions(state.product._id, _currentUnit);
          if (converted) {
            state.dimensions = converted;
            renderDimensions($w, converted);
          }
        });
      }
    } catch (e) {}

    // Weight display
    if (dims.weight) {
      try { $w('#productWeight').text = `Weight: ${dims.weight} lbs`; } catch (e) {}
    }

    // Mattress size
    if (dims.mattressSize) {
      try { $w('#mattressSize').text = `Mattress Size: ${dims.mattressSize}`; } catch (e) {}
    }
  } catch (e) {}
}

function renderDimensions($w, dims) {
  const unit = dims.unit === 'cm' ? 'cm' : '"';
  const fmt = (v) => v != null ? `${v}${unit}` : '—';

  // Closed position
  try {
    $w('#closedDimsLabel').text = 'Closed (Sofa Position)';
  } catch (e) {}
  try {
    $w('#closedDims').text = `${fmt(dims.closed.width)} W × ${fmt(dims.closed.depth)} D × ${fmt(dims.closed.height)} H`;
  } catch (e) {}

  // Open position
  try {
    $w('#openDimsLabel').text = 'Open (Bed Position)';
  } catch (e) {}
  try {
    $w('#openDims').text = `${fmt(dims.open.width)} W × ${fmt(dims.open.depth)} D × ${fmt(dims.open.height)} H`;
  } catch (e) {}

  // Seat height
  if (dims.seatHeight) {
    try { $w('#seatHeight').text = `Seat Height: ${fmt(dims.seatHeight)}`; } catch (e) {}
  }
}

async function initRoomFitChecker($w, state) {
  try {
    if (!state.product) return;

    // Set up room fit checker form
    try { $w('#roomFitTitle').text = 'Will It Fit?'; } catch (e) {}
    try { $w('#roomFitTitle').accessibility.ariaLabel = 'Room fit checker'; } catch (e) {}

    // ARIA labels for input fields
    try { $w('#doorwayWidth').accessibility.ariaLabel = 'Doorway width in inches'; } catch (e) {}
    try { $w('#doorwayHeight').accessibility.ariaLabel = 'Doorway height in inches'; } catch (e) {}
    try { $w('#hallwayWidth').accessibility.ariaLabel = 'Hallway width in inches'; } catch (e) {}
    try { $w('#roomWidth').accessibility.ariaLabel = 'Room width in inches'; } catch (e) {}
    try { $w('#roomDepth').accessibility.ariaLabel = 'Room depth in inches'; } catch (e) {}

    // Check fit button
    try {
      $w('#checkFitBtn').onClick(async () => {
        try {
          $w('#checkFitBtn').disable();
          $w('#checkFitBtn').label = 'Checking...';

          const roomDims = {};
          try {
            const dw = parseFloat($w('#doorwayWidth').value);
            const dh = parseFloat($w('#doorwayHeight').value);
            if (!isNaN(dw) && !isNaN(dh)) {
              roomDims.doorwayWidth = dw;
              roomDims.doorwayHeight = dh;
            }
          } catch (e) {}

          try {
            const hw = parseFloat($w('#hallwayWidth').value);
            if (!isNaN(hw)) roomDims.hallwayWidth = hw;
          } catch (e) {}

          try {
            const rw = parseFloat($w('#roomWidth').value);
            const rd = parseFloat($w('#roomDepth').value);
            if (!isNaN(rw) && !isNaN(rd)) {
              roomDims.roomWidth = rw;
              roomDims.roomDepth = rd;
            }
          } catch (e) {}

          const result = await checkRoomFit(state.product._id, roomDims);
          displayFitResults($w, result);

          $w('#checkFitBtn').label = 'Check Fit';
          $w('#checkFitBtn').enable();
        } catch (e) {
          try { $w('#checkFitBtn').label = 'Check Fit'; } catch (e2) {}
          try { $w('#checkFitBtn').enable(); } catch (e2) {}
        }
      });
      try { $w('#checkFitBtn').accessibility.ariaLabel = 'Check if product fits your space'; } catch (e) {}
    } catch (e) {}
  } catch (e) {}
}

function displayFitResults($w, result) {
  try {
    if (!result.success) {
      try { $w('#fitResultText').text = result.error || 'Unable to check fit'; } catch (e) {}
      try { $w('#fitResultSection').show(); } catch (e) {}
      return;
    }

    const { allFit, anyTight, checks } = result;
    const lines = [];

    for (const check of checks) {
      const icon = check.fits ? (check.tight ? '\u26A0' : '\u2713') : '\u2717';
      const label = check.check === 'doorway' ? 'Doorway'
        : check.check === 'hallway' ? 'Hallway'
        : 'Room';
      const detail = check.fits
        ? (check.tight ? 'Tight fit — measure carefully' : 'Good fit')
        : 'Will not fit';
      lines.push(`${icon} ${label}: ${detail}`);
    }

    if (allFit && !anyTight) {
      lines.unshift('Great news — this product fits your space!');
    } else if (allFit && anyTight) {
      lines.unshift('This product fits, but some areas are tight (< 2" clearance).');
    } else {
      lines.unshift('This product may not fit your space.');
    }

    try { $w('#fitResultText').text = lines.join('\n'); } catch (e) {}
    try { $w('#fitResultSection').show(); } catch (e) {}
  } catch (e) {}
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
      $item('#relatedImage').onClick(nav);
      $item('#relatedName').onClick(nav);
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
      $item('#collectionImage').onClick(nav);
      $item('#collectionName').onClick(nav);
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
      $item('#recentImage').onClick(nav);
      $item('#recentName').onClick(nav);
    });
  } catch (e) {}
}
