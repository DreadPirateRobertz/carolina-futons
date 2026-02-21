// Product Page.js - Individual Product Display
// Handles variant selection with independent pricing, cross-sell,
// gallery enhancement, lightbox, zoom, recently viewed, and SEO schema injection
import { getRelatedProducts, getSameCollection, getBundleSuggestion } from 'backend/productRecommendations.web';
import { getProductSchema, generateAltText, getBreadcrumbSchema, getProductOgTags } from 'backend/seoHelpers.web';
import { getProductSwatches, getSwatchCount, getAllSwatchFamilies } from 'backend/swatchService.web';
import { submitSwatchRequest } from 'backend/emailService.web';
import {
  trackProductView,
  getRecentlyViewed,
  getProductBadge,
  initImageLightbox,
  initImageZoom,
} from 'public/galleryHelpers.js';
import { getProductFallbackImage, getPlaceholderProductImages } from 'public/placeholderImages.js';
import { colors } from 'public/designTokens.js';
import wixLocationFrontend from 'wix-location-frontend';
import { getProductVariants, addToCart, onCartChanged } from 'public/cartService';
import { isMobile, collapseOnMobile, initBackToTop } from 'public/mobileHelpers';
import { trackProductPageView, trackCartAdd, trackGalleryInteraction, trackSwatchView, trackSocialShare } from 'public/engagementTracker';
import { cacheProduct, getCachedProduct } from 'public/productCache';
import { enableSwipe } from 'public/touchHelpers';
import wixWindowFrontend from 'wix-window-frontend';

let currentProduct = null;
let productVariants = [];
let selectedSwatchId = null;
let selectedQuantity = 1;

$w.onReady(async function () {
  await initProductPage();
});

// ── Main Initialization ─────────────────────────────────────────────

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

    // Get the current product from the dataset
    await $w('#productDataset').onReady();
    currentProduct = $w('#productDataset').getCurrentItem();

    if (!currentProduct) return;

    // Track this product view in session storage for "Recently Viewed"
    trackProductView(currentProduct);
    // Cache product for cross-session recently viewed and instant display
    cacheProduct(currentProduct);
    // Track in engagement funnel
    trackProductPageView(currentProduct);

    await Promise.all([
      initVariantSelector(),
      initSwatchSelector(),
      loadRelatedProducts(),
      loadCollectionProducts(),
      loadRecentlyViewed(),
      injectProductSchema(),
      initImageGallery(),
      initBreadcrumbs(),
      initAddToCartEnhancements(),
      initQuantitySelector(),
      initProductBadge(),
      initProductVideo(),
      initBundleSection(),
      initStockUrgency(),
      initBackInStockNotification(),
      initWishlistButton(),
    ]);

    initSocialShare();
    initStickyCartBar();
    initDeliveryEstimate();
    initSwatchRequest();
    initProductInfoAccordion();

    // Mobile: collapse non-essential sections, add back-to-top
    collapseOnMobile($w, ['#recentlyViewedSection', '#relatedProductsSection']);
    initBackToTop($w);
  } catch (err) {
    console.error('Error initializing product page:', err);
  }
}

// ── Variant Selector with Independent Pricing ───────────────────────
// Each variant (size + finish combination) has its own price.
// Changing one variant option updates price without affecting others.

async function initVariantSelector() {
  try {
    // Hook into custom dropdown variant selectors
    // Each dropdown (size, finish) independently updates the price
    // for its specific variant without affecting other options
    const sizeDropdown = $w('#sizeDropdown');
    const finishDropdown = $w('#finishDropdown');

    if (sizeDropdown) {
      sizeDropdown.onChange(() => handleCustomVariantChange());
    }
    if (finishDropdown) {
      finishDropdown.onChange(() => handleCustomVariantChange());
    }

    // Also listen for Wix product widget's built-in choice changes
    // The dataset fires onCurrentIndexChanged when variant choices update
    try {
      $w('#productDataset').onCurrentIndexChanged(() => {
        const updated = $w('#productDataset').getCurrentItem();
        if (updated) {
          currentProduct = updated;
        }
      });
    } catch (e) {}
  } catch (e) {
    // Variant elements may not exist for simple products
  }
}

function updateVariantPrice(variant) {
  try {
    const priceElement = $w('#productPrice');
    const comparePriceElement = $w('#productComparePrice');

    if (variant.variant && variant.variant.price) {
      priceElement.text = formatCurrency(variant.variant.price);
    }

    // Show compare/strike-through price if variant is on sale
    if (variant.variant && variant.variant.comparePrice) {
      if (comparePriceElement) {
        comparePriceElement.text = formatCurrency(variant.variant.comparePrice);
        comparePriceElement.show();
      }
    } else {
      if (comparePriceElement) {
        comparePriceElement.hide();
      }
    }
  } catch (e) {
    // Price elements may use default Wix binding
  }
}

function updateStockStatus(variant) {
  try {
    const stockBadge = $w('#stockStatus');
    if (!stockBadge) return;

    if (variant.inStock) {
      stockBadge.text = 'In Stock';
      stockBadge.style.color = colors.success;
    } else {
      stockBadge.text = 'Special Order';
      stockBadge.style.color = colors.sunsetCoral;
    }
    stockBadge.show();
  } catch (e) {}
}

function updateVariantImage(variant) {
  try {
    if (variant.imageSrc) {
      $w('#productMainImage').src = variant.imageSrc;
    }

    // Update gallery thumbnails for this variant's media set
    if (variant.mediaItems && variant.mediaItems.length > 0) {
      try {
        const gallery = $w('#productGallery');
        if (gallery) {
          gallery.items = variant.mediaItems.map(item => ({
            type: 'image',
            src: item.src || item.url,
            alt: item.alt || currentProduct?.name || '',
          }));
        }
      } catch (e) {}
    }
  } catch (e) {}
}

async function handleCustomVariantChange() {
  try {
    const size = $w('#sizeDropdown').value;
    const finish = $w('#finishDropdown').value;

    if (!size && !finish) return;

    // Query for the specific variant matching selected options
    const choices = {};
    if (size) choices['Size'] = size;
    if (finish) choices['Finish'] = finish;

    const variant = await getProductVariants(currentProduct._id, choices);

    if (variant && variant.length > 0) {
      const selected = variant[0];
      updateVariantPrice({ variant: selected });
      updateStockStatus(selected);
      updateVariantImage(selected);
      // Sync sticky cart bar price with new variant
      updateStickyPrice(selected);
    }
  } catch (e) {
    console.error('Error handling variant change:', e);
  }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// ── Fabric Swatch Selector ───────────────────────────────────────────
// Displays available fabric swatches below the gallery. Clicking a swatch
// either switches to that variant's images (Approach 1) or applies a color
// tint overlay to the main product image (Approach 2 fallback).

async function initSwatchSelector() {
  try {
    const swatchSection = $w('#swatchSection');
    if (!swatchSection || !currentProduct) {
      try { $w('#swatchSection').collapse(); } catch (e) {}
      return;
    }

    // Fetch swatches and total count in parallel
    const [swatches, totalCount, families] = await Promise.all([
      getProductSwatches(currentProduct._id),
      getSwatchCount(currentProduct._id),
      getAllSwatchFamilies(),
    ]);

    if (!swatches || swatches.length === 0) {
      swatchSection.collapse();
      return;
    }

    // Update swatch count display
    try {
      $w('#swatchCount').text = `Showing ${swatches.length} of ${totalCount}+ available fabrics`;
    } catch (e) {}

    // Set up color family filter
    initSwatchColorFilter(families);

    // Render swatch grid
    renderSwatchGrid(swatches);

    // Set up "View All Swatches" button → opens full swatch gallery lightbox
    try {
      $w('#swatchViewAll').onClick(() => openSwatchGallery());
    } catch (e) {}

    // Set up "Request Free Swatches" link
    try {
      $w('#swatchRequestLink').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to('/request-swatches');
        });
      });
    } catch (e) {}

    swatchSection.expand();
  } catch (e) {
    console.error('Error initializing swatch selector:', e);
    try { $w('#swatchSection').collapse(); } catch (e2) {}
  }
}

function initSwatchColorFilter(families) {
  try {
    const filter = $w('#swatchColorFilter');
    if (!filter || !families || families.length === 0) return;

    const options = [{ label: 'All', value: '' }];
    families.forEach(family => {
      if (family) {
        const label = family.charAt(0).toUpperCase() + family.slice(1);
        options.push({ label, value: family });
      }
    });

    filter.options = options;
    filter.value = '';

    filter.onChange(async () => {
      const colorFamily = filter.value || null;
      const filtered = await getProductSwatches(currentProduct._id, colorFamily);
      renderSwatchGrid(filtered);
    });
  } catch (e) {}
}

function renderSwatchGrid(swatches) {
  try {
    const grid = $w('#swatchGrid');
    if (!grid) return;

    grid.data = swatches.map((s, i) => ({
      ...s,
      _id: s._id || `swatch-${i}`,
    }));

    grid.onItemReady(($item, itemData) => {
      // Swatch thumbnail image
      try {
        if (itemData.swatchImage) {
          $item('#swatchThumb').src = itemData.swatchImage;
          $item('#swatchThumb').alt = itemData.swatchName || 'Fabric swatch';
        } else if (itemData.colorHex) {
          // Fallback: use color hex as background for a colored box
          $item('#swatchThumb').style.backgroundColor = itemData.colorHex;
        }
      } catch (e) {}

      // Swatch name tooltip (show on hover via text element)
      try {
        $item('#swatchLabel').text = itemData.swatchName || '';
      } catch (e) {}

      // Click handler: select this swatch
      try {
        $item('#swatchThumb').onClick(() => selectSwatch(itemData));
      } catch (e) {}

      // Highlight the currently selected swatch
      try {
        if (selectedSwatchId === itemData._id) {
          $item('#swatchThumb').style.borderColor = colors.mountainBlue;
          $item('#swatchThumb').style.borderWidth = '3px';
        } else {
          $item('#swatchThumb').style.borderColor = colors.sandDark;
          $item('#swatchThumb').style.borderWidth = '1px';
        }
      } catch (e) {}
    });
  } catch (e) {
    console.error('Error rendering swatch grid:', e);
  }
}

async function selectSwatch(swatch) {
  selectedSwatchId = swatch._id;

  // Re-render grid to update selection highlight
  try {
    const grid = $w('#swatchGrid');
    if (grid && grid.data) {
      // Trigger re-render by reassigning data
      grid.data = [...grid.data];
    }
  } catch (e) {}

  // Approach 1: Try to match a product variant with this fabric/finish name
  try {
    const finishDropdown = $w('#finishDropdown');
    if (finishDropdown && finishDropdown.options) {
      const matchingOption = finishDropdown.options.find(
        opt => opt.label.toLowerCase() === swatch.swatchName.toLowerCase()
      );
      if (matchingOption) {
        finishDropdown.value = matchingOption.value;
        await handleCustomVariantChange();
        return; // Variant matched — gallery will update via variant images
      }
    }
  } catch (e) {}

  // Approach 2 fallback: Apply color tint overlay to the main product image
  applySwatchTint(swatch.colorHex);
}

function applySwatchTint(colorHex) {
  if (!colorHex) return;

  try {
    const tintOverlay = $w('#swatchTintOverlay');
    if (tintOverlay) {
      tintOverlay.style.backgroundColor = colorHex;
      tintOverlay.style.opacity = 0.25;
      tintOverlay.show('fade', { duration: 200 });
    }
  } catch (e) {}
}

// ── Full Swatch Gallery Lightbox ──────────────────────────────────────
// Grid of all available swatches in a modal overlay with search and detail view

async function openSwatchGallery() {
  try {
    const modal = $w('#swatchGalleryModal');
    if (!modal) return;

    // Load all swatches (no limit) for the full gallery
    const allSwatches = await getProductSwatches(currentProduct._id, null, 500);
    if (!allSwatches || allSwatches.length === 0) return;

    renderSwatchGalleryGrid(allSwatches);

    // Search filter within the lightbox
    try {
      $w('#swatchSearch').onInput((event) => {
        const query = (event.target.value || '').toLowerCase();
        const filtered = allSwatches.filter(s =>
          (s.swatchName || '').toLowerCase().includes(query) ||
          (s.colorFamily || '').toLowerCase().includes(query) ||
          (s.material || '').toLowerCase().includes(query)
        );
        renderSwatchGalleryGrid(filtered);
      });
    } catch (e) {}

    // Close button
    try {
      $w('#swatchGalleryClose').onClick(() => {
        modal.hide('fade', { duration: 200 });
      });
    } catch (e) {}

    modal.show('fade', { duration: 250 });
  } catch (e) {
    console.error('Error opening swatch gallery:', e);
  }
}

function renderSwatchGalleryGrid(swatches) {
  try {
    const grid = $w('#swatchGalleryGrid');
    if (!grid) return;

    grid.data = swatches.map((s, i) => ({
      ...s,
      _id: s._id || `sg-${i}`,
    }));

    grid.onItemReady(($item, itemData) => {
      // Larger swatch thumbnail (120x120)
      try {
        if (itemData.swatchImage) {
          $item('#sgThumb').src = itemData.swatchImage;
          $item('#sgThumb').alt = itemData.swatchName || 'Fabric swatch';
        } else if (itemData.colorHex) {
          $item('#sgThumb').style.backgroundColor = itemData.colorHex;
        }
      } catch (e) {}

      // Swatch name and details
      try { $item('#sgName').text = itemData.swatchName || ''; } catch (e) {}
      try { $item('#sgMaterial').text = itemData.material || ''; } catch (e) {}

      // Click to select and apply to product
      try {
        $item('#sgThumb').onClick(() => {
          selectSwatch(itemData);
          // Show detail panel
          showSwatchDetail(itemData);
        });
      } catch (e) {}

      // Selection highlight
      try {
        if (selectedSwatchId === itemData._id) {
          $item('#sgThumb').style.borderColor = colors.mountainBlue;
          $item('#sgThumb').style.borderWidth = '3px';
        } else {
          $item('#sgThumb').style.borderColor = colors.sandDark;
          $item('#sgThumb').style.borderWidth = '1px';
        }
      } catch (e) {}
    });
  } catch (e) {}
}

function showSwatchDetail(swatch) {
  try {
    const detail = $w('#swatchDetail');
    if (!detail) return;

    try { $w('#swatchDetailName').text = swatch.swatchName || ''; } catch (e) {}
    try { $w('#swatchDetailMaterial').text = swatch.material ? `Material: ${swatch.material}` : ''; } catch (e) {}
    try { $w('#swatchDetailCare').text = swatch.careInstructions ? `Care: ${swatch.careInstructions}` : ''; } catch (e) {}
    try { $w('#swatchDetailFamily').text = swatch.colorFamily ? `Color Family: ${swatch.colorFamily.charAt(0).toUpperCase() + swatch.colorFamily.slice(1)}` : ''; } catch (e) {}

    if (swatch.swatchImage) {
      try {
        $w('#swatchDetailImage').src = swatch.swatchImage;
        $w('#swatchDetailImage').show();
      } catch (e) {}
    }

    detail.expand();
  } catch (e) {}
}

// ── Related Products ("You Might Also Like") ────────────────────────
// Cross-category recommendations

async function loadRelatedProducts() {
  try {
    if (!currentProduct) return;

    const category = currentProduct.collections?.[0] || '';
    const related = await getRelatedProducts(currentProduct._id, category, 4);

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
        try {
          $item('#relatedBadge').text = itemData.ribbon;
          $item('#relatedBadge').show();
        } catch (e) {}
      }

      // Click to navigate
      const navigateToProduct = () => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };
      $item('#relatedImage').onClick(navigateToProduct);
      $item('#relatedName').onClick(navigateToProduct);
    });
    repeater.data = related;
  } catch (err) {
    console.error('Error loading related products:', err);
  }
}

// ── Same Collection ("More From This Collection") ───────────────────
// Products sharing the same collection/brand

async function loadCollectionProducts() {
  try {
    if (!currentProduct || !currentProduct.collections) return;

    const collectionProducts = await getSameCollection(
      currentProduct._id,
      currentProduct.collections,
      6
    );

    const repeater = $w('#collectionRepeater');
    if (!repeater || collectionProducts.length === 0) {
      try { $w('#collectionSection').collapse(); } catch (e) {}
      return;
    }

    repeater.onItemReady(($item, itemData) => {
      $item('#collectionImage').src = itemData.mainMedia;
      $item('#collectionImage').alt = buildGridAlt(itemData);
      $item('#collectionName').text = itemData.name;
      $item('#collectionPrice').text = itemData.formattedPrice;

      const navigateToProduct = () => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };
      $item('#collectionImage').onClick(navigateToProduct);
      $item('#collectionName').onClick(navigateToProduct);
    });
    repeater.data = collectionProducts;
  } catch (err) {
    console.error('Error loading collection products:', err);
  }
}

// ── Image Gallery Enhancement ───────────────────────────────────────
// Thumbnail navigation, zoom effect, alt text injection

function initImageGallery() {
  try {
    // Set SEO-optimized alt text on main image
    if (currentProduct) {
      const mainImage = $w('#productMainImage');
      if (mainImage) {
        // Fallback image when product has no mainMedia
        if (!currentProduct.mainMedia) {
          const category = currentProduct.collections?.[0] || '';
          mainImage.src = getProductFallbackImage(category);
        }
        generateAltText(currentProduct, 'main').then(alt => {
          mainImage.alt = alt;
        });
      }

      // Fill gallery with placeholders when fewer than expected thumbnails
      const gallery = $w('#productGallery');
      if (gallery) {
        const mediaItems = currentProduct.mediaItems || [];
        if (mediaItems.length < 3) {
          const category = currentProduct.collections?.[0] || '';
          const placeholders = getPlaceholderProductImages(category, 4);
          const combined = [
            ...mediaItems,
            ...placeholders.slice(mediaItems.length).map(src => ({
              src,
              type: 'image',
              title: currentProduct.name || 'Product image',
            })),
          ];
          try {
            gallery.items = combined;
          } catch (e) {}
        }
      }
    }

    // Gallery thumbnail click handling with active-state highlighting
    const gallery = $w('#productGallery');
    if (gallery) {
      gallery.onItemClicked((event) => {
        try {
          $w('#productMainImage').src = event.item.src;
        } catch (e) {}
      });
    }

    // Mobile swipe navigation on product gallery
    try {
      const galleryEl = gallery?.getElement?.() || (typeof document !== 'undefined' ? document.querySelector('[id*="productGallery"]') : null);
      if (galleryEl) {
        let currentGalleryIndex = 0;
        enableSwipe(galleryEl, (direction) => {
          try {
            const items = gallery.items || [];
            if (items.length === 0) return;
            if (direction === 'left') {
              currentGalleryIndex = Math.min(currentGalleryIndex + 1, items.length - 1);
            } else if (direction === 'right') {
              currentGalleryIndex = Math.max(currentGalleryIndex - 1, 0);
            }
            $w('#productMainImage').src = items[currentGalleryIndex].src;
            trackGalleryInteraction('swipe', direction);
          } catch (e) {}
        }, { threshold: 40 });
      }
    } catch (e) {}

    // Fullscreen lightbox on main image click
    initImageLightbox('#productGallery', '#productMainImage');

    // Hover zoom on main product image
    initImageZoom('#productMainImage');

    // Preload gallery thumbnail images for smoother browsing
    preloadGalleryThumbnails();
  } catch (e) {}
}

// ── Recently Viewed Products ────────────────────────────────────────
// Horizontal section below cross-sell showing products viewed this session

async function loadRecentlyViewed() {
  try {
    const recentProducts = getRecentlyViewed(currentProduct?._id);

    if (!recentProducts || recentProducts.length === 0) {
      try { $w('#recentlyViewedSection').collapse(); } catch (e) {}
      return;
    }

    const repeater = $w('#recentlyViewedRepeater');
    if (!repeater) {
      try { $w('#recentlyViewedSection').collapse(); } catch (e) {}
      return;
    }

    $w('#recentlyViewedSection').expand();
    repeater.data = recentProducts;
    repeater.onItemReady(($item, itemData) => {
      $item('#recentImage').src = itemData.mainMedia;
      $item('#recentImage').alt = buildGridAlt(itemData);
      $item('#recentName').text = itemData.name;
      $item('#recentPrice').text = itemData.price;

      // Click to navigate to product
      const navigateToProduct = () => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };
      $item('#recentImage').onClick(navigateToProduct);
      $item('#recentName').onClick(navigateToProduct);
    });
  } catch (e) {}
}

// ── Product Badge Overlay ───────────────────────────────────────────
// Shows sale/new/featured badge on main image area

function initProductBadge() {
  try {
    const badge = getProductBadge(currentProduct);
    const badgeOverlay = $w('#productBadgeOverlay');
    if (!badgeOverlay) return;

    if (badge) {
      badgeOverlay.text = badge;
      badgeOverlay.show();
    } else {
      badgeOverlay.hide();
    }
  } catch (e) {}
}

// ── Image Preloading ────────────────────────────────────────────────
// Gallery images are preloaded by Wix's built-in gallery component.
// No manual preloading needed — Wix Velo doesn't support new Image().

function preloadGalleryThumbnails() {
  // Intentional no-op: Wix gallery handles its own image loading.
  // Kept as stub in case future Wix API exposes preload controls.
}

// ── Breadcrumbs ─────────────────────────────────────────────────────

async function initBreadcrumbs() {
  try {
    if (!currentProduct) return;

    const category = getCategoryFromCollections(currentProduct.collections);
    const breadcrumbs = [
      { name: 'Home', url: '/' },
      { name: category.label, url: category.path },
      { name: currentProduct.name, url: null },
    ];

    // Update breadcrumb UI elements
    try {
      $w('#breadcrumb1').text = 'Home';
      $w('#breadcrumb1').onClick(() => {
        import('wix-location-frontend').then(({ to }) => to('/'));
      });
      $w('#breadcrumb2').text = category.label;
      $w('#breadcrumb2').onClick(() => {
        import('wix-location-frontend').then(({ to }) => to(category.path));
      });
      $w('#breadcrumb3').text = currentProduct.name;
    } catch (e) {}

    // Inject breadcrumb schema
    const schema = await getBreadcrumbSchema(breadcrumbs);
    if (schema) {
      try {
        $w('#breadcrumbSchemaHtml').postMessage(schema);
      } catch (e) {}
    }
  } catch (e) {}
}

// Build keyword-rich alt text for product grid thumbnails
function buildGridAlt(product) {
  const brand = detectProductBrand(product);
  const category = detectProductCategory(product);
  const parts = [product.name];
  if (brand) parts.push(brand);
  if (category) parts.push(category);
  parts.push('Carolina Futons');
  const alt = parts.join(' - ');
  return alt.length > 125 ? alt.substring(0, 122) + '...' : alt;
}

function detectProductBrand(product) {
  if (!product.collections) return '';
  const colls = Array.isArray(product.collections) ? product.collections : [product.collections];
  if (colls.some(c => c.includes('wall-hugger'))) return 'Strata Furniture';
  if (colls.some(c => c.includes('unfinished'))) return 'KD Frames';
  if (colls.some(c => c.includes('mattress'))) return 'Otis Bed';
  return 'Night & Day Furniture';
}

function detectProductCategory(product) {
  if (!product.collections) return '';
  const colls = Array.isArray(product.collections) ? product.collections : [product.collections];
  if (colls.some(c => c.includes('murphy'))) return 'Murphy Cabinet Bed';
  if (colls.some(c => c.includes('platform'))) return 'Platform Bed';
  if (colls.some(c => c.includes('mattress'))) return 'Futon Mattress';
  if (colls.some(c => c.includes('wall-hugger'))) return 'Wall Hugger Futon Frame';
  if (colls.some(c => c.includes('futon') || c.includes('frame'))) return 'Futon Frame';
  if (colls.some(c => c.includes('casegood') || c.includes('accessor'))) return 'Bedroom Furniture';
  return 'Furniture';
}

function getCategoryFromCollections(collections) {
  if (!collections) return { label: 'Shop', path: '/shop-main' };

  const collArr = Array.isArray(collections) ? collections : [collections];

  if (collArr.some(c => c.includes('murphy'))) return { label: 'Murphy Cabinet Beds', path: '/murphy-cabinet-beds' };
  if (collArr.some(c => c.includes('platform'))) return { label: 'Platform Beds', path: '/platform-beds' };
  if (collArr.some(c => c.includes('mattress'))) return { label: 'Mattresses', path: '/mattresses' };
  if (collArr.some(c => c.includes('wall-hugger'))) return { label: 'Wall Hugger Frames', path: '/wall-huggers' };
  if (collArr.some(c => c.includes('unfinished'))) return { label: 'Unfinished Wood', path: '/unfinished-wood' };
  if (collArr.some(c => c.includes('casegood') || c.includes('accessor'))) return { label: 'Casegoods & Accessories', path: '/casegoods-accessories' };
  if (collArr.some(c => c.includes('futon') || c.includes('frame'))) return { label: 'Futon Frames', path: '/futon-frames' };

  return { label: 'Shop', path: '/shop-main' };
}

// ── Back-in-Stock Notification ──────────────────────────────────────
// Shows email signup when a variant is out of stock / special order

async function initBackInStockNotification() {
  try {
    const section = $w('#backInStockSection');
    const emailInput = $w('#backInStockEmail');
    const submitBtn = $w('#backInStockBtn');
    const successMsg = $w('#backInStockSuccess');

    if (!section || !emailInput || !submitBtn) return;

    // Initially hide - only show when variant is out of stock
    section.collapse();
    if (successMsg) successMsg.hide();

    // Check initial stock status
    updateBackInStockVisibility(section);

    // Re-check when variant changes
    const sizeDropdown = $w('#sizeDropdown');
    const finishDropdown = $w('#finishDropdown');
    if (sizeDropdown) sizeDropdown.onChange(() => updateBackInStockVisibility(section));
    if (finishDropdown) finishDropdown.onChange(() => updateBackInStockVisibility(section));

    // Handle email submission
    submitBtn.onClick(async () => {
      const email = emailInput.value?.trim();
      if (!email || !email.includes('@')) return;

      try {
        const { submitContactForm } = await import('backend/contactSubmissions.web');
        await submitContactForm({
          email,
          source: 'back_in_stock',
          status: 'back_in_stock_request',
          productId: currentProduct?._id || '',
          productName: currentProduct?.name || '',
          notes: `Back in stock request for ${currentProduct?.name || 'unknown product'}`,
        });

        // Show success
        submitBtn.hide();
        emailInput.hide();
        if (successMsg) {
          successMsg.text = "We'll email you when this item is back in stock!";
          successMsg.show('fade', { duration: 300 });
        }
      } catch (err) {
        console.error('Back in stock submission error:', err);
      }
    });
  } catch (e) {
    // Back-in-stock is non-critical
  }
}

async function updateBackInStockVisibility(section) {
  try {
    const size = $w('#sizeDropdown')?.value;
    const finish = $w('#finishDropdown')?.value;

    if (!size && !finish) {
      // Check base product stock
      const stockBadge = $w('#stockStatus');
      if (stockBadge && stockBadge.text === 'Special Order') {
        section.expand();
      }
      return;
    }

    const choices = {};
    if (size) choices['Size'] = size;
    if (finish) choices['Finish'] = finish;

    const variants = await getProductVariants(currentProduct._id, choices);
    if (variants && variants.length > 0 && !variants[0].inStock) {
      section.expand();
    } else {
      section.collapse();
    }
  } catch (e) {
    // Default to hidden if we can't check stock
  }
}

// ── Quantity Selector ──────────────────────────────────────────────
// +/- buttons to set quantity before add-to-cart

function initQuantitySelector() {
  try {
    const qtyInput = $w('#quantityInput');
    const qtyMinus = $w('#quantityMinus');
    const qtyPlus = $w('#quantityPlus');
    if (!qtyInput) return;

    qtyInput.value = '1';
    selectedQuantity = 1;

    // Accessibility: label the quantity controls
    try { qtyInput.accessibility.ariaLabel = 'Product quantity'; } catch (e) {}
    try { qtyMinus.accessibility.ariaLabel = 'Decrease quantity'; } catch (e) {}
    try { qtyPlus.accessibility.ariaLabel = 'Increase quantity'; } catch (e) {}

    qtyInput.onInput(() => {
      const val = parseInt(qtyInput.value, 10);
      if (val > 0 && val <= 99) {
        selectedQuantity = val;
      } else {
        selectedQuantity = 1;
        qtyInput.value = '1';
      }
    });

    if (qtyMinus) {
      qtyMinus.onClick(() => {
        if (selectedQuantity > 1) {
          selectedQuantity--;
          qtyInput.value = String(selectedQuantity);
        }
      });
    }

    if (qtyPlus) {
      qtyPlus.onClick(() => {
        if (selectedQuantity < 99) {
          selectedQuantity++;
          qtyInput.value = String(selectedQuantity);
        }
      });
    }
  } catch (e) {
    // Quantity selector elements may not exist — default to 1
  }
}

// ── Add to Cart Enhancements ────────────────────────────────────────
// Success feedback and cross-sell prompt after adding to cart

function initAddToCartEnhancements() {
  try {
    const addToCartBtn = $w('#addToCartButton');
    if (!addToCartBtn) return;

    // Override default add-to-cart to support quantity selection
    addToCartBtn.onClick(async () => {
      if (!currentProduct) return;
      try {
        addToCartBtn.disable();
        addToCartBtn.label = 'Adding...';
        await addToCart(currentProduct._id, selectedQuantity);
        trackCartAdd(currentProduct, selectedQuantity);
        addToCartBtn.label = 'Added!';
      } catch (err) {
        console.error('Error adding to cart:', err);
        addToCartBtn.label = 'Error — Try Again';
      }
      setTimeout(() => {
        try {
          addToCartBtn.label = 'Add to Cart';
          addToCartBtn.enable();
        } catch (e) {}
      }, 2000);
    });

    // Listen for successful add-to-cart (covers side cart trigger)
    onCartChanged(() => {
      showAddToCartSuccess();
    });
  } catch (e) {}
}

function showAddToCartSuccess() {
  try {
    const successBox = $w('#addToCartSuccess');
    if (successBox) {
      successBox.show('fade', { duration: 300 });
      setTimeout(() => {
        successBox.hide('fade', { duration: 300 });
      }, 4000);
    }
  } catch (e) {}
}

// ── Fabric Swatch Request ───────────────────────────────────────────
// "Request Free Swatches" button + modal for products with fabric options

function initSwatchRequest() {
  try {
    const swatchBtn = $w('#swatchRequestBtn');
    if (!swatchBtn || !currentProduct) return;

    // Only show for products that have fabric/finish options
    const hasOptions = currentProduct.productOptions?.some(
      opt => /finish|fabric|color|cover/i.test(opt.name)
    );

    if (!hasOptions) {
      swatchBtn.hide();
      return;
    }

    swatchBtn.show();

    swatchBtn.onClick(() => {
      openSwatchModal();
    });

    // Wire up submit
    try {
      $w('#swatchSubmit').onClick(() => handleSwatchSubmit());
    } catch (e) {}
  } catch (e) {}
}

function openSwatchModal() {
  try {
    const modal = $w('#swatchModal');
    if (!modal) return;

    // Display product name
    try {
      $w('#swatchProductName').text = currentProduct.name;
    } catch (e) {}

    // Populate checkbox options from product's fabric/finish choices
    try {
      const optionsRepeater = $w('#swatchOptions');
      if (optionsRepeater) {
        const fabricOptions = [];
        (currentProduct.productOptions || []).forEach(opt => {
          if (/finish|fabric|color|cover/i.test(opt.name)) {
            (opt.choices || []).forEach(choice => {
              fabricOptions.push({
                _id: choice.value,
                label: choice.description || choice.value,
                optionName: opt.name,
                checked: false,
              });
            });
          }
        });

        optionsRepeater.data = fabricOptions;
        optionsRepeater.onItemReady(($item, itemData) => {
          try {
            $item('#swatchCheckbox').label = itemData.label;
            $item('#swatchCheckbox').checked = false;
          } catch (e) {}
        });
      }
    } catch (e) {}

    // Reset form fields
    try { $w('#swatchName').value = ''; } catch (e) {}
    try { $w('#swatchEmail').value = ''; } catch (e) {}
    try { $w('#swatchAddress').value = ''; } catch (e) {}
    try { $w('#swatchSuccess').hide(); } catch (e) {}

    modal.show('fade', { duration: 200 });
  } catch (e) {}
}

async function handleSwatchSubmit() {
  try {
    const name = $w('#swatchName').value?.trim();
    const email = $w('#swatchEmail').value?.trim();
    const address = $w('#swatchAddress').value?.trim();

    if (!name || !email || !address) return;

    // Collect selected swatches from repeater checkboxes
    const selectedSwatches = [];
    try {
      const optionsRepeater = $w('#swatchOptions');
      optionsRepeater.forEachItem(($item, itemData) => {
        try {
          if ($item('#swatchCheckbox').checked) {
            selectedSwatches.push(itemData.label);
          }
        } catch (e) {}
      });
    } catch (e) {}

    if (selectedSwatches.length === 0) return;

    $w('#swatchSubmit').disable();

    await submitSwatchRequest({
      name,
      email,
      address,
      productId: currentProduct._id,
      productName: currentProduct.name,
      swatchNames: selectedSwatches,
    });

    // Show success state
    try {
      $w('#swatchSuccess').show('fade', { duration: 300 });
    } catch (e) {}

    // Auto-close after a moment
    setTimeout(() => {
      try {
        $w('#swatchModal').hide('fade', { duration: 200 });
        $w('#swatchSubmit').enable();
      } catch (e) {}
    }, 3000);
  } catch (err) {
    console.error('Error submitting swatch request:', err);
    try {
      $w('#swatchSubmit').enable();
      const errorMsg = $w('#swatchError');
      if (errorMsg) {
        errorMsg.text = 'Something went wrong. Please call us at (828) 252-9449.';
        errorMsg.show('fade', { duration: 300 });
      }
    } catch (e) {}
  }
}

// ── Product Video ──────────────────────────────────────────────────
// Shows product demo video if the product has video media items

function initProductVideo() {
  try {
    const videoSection = $w('#productVideoSection');
    if (!videoSection || !currentProduct) return;

    // Check if product has video media
    const mediaItems = currentProduct.mediaItems || [];
    const videoItem = mediaItems.find(item =>
      item.mediaType === 'video' || item.type === 'video'
    );

    if (!videoItem) {
      videoSection.collapse();
      return;
    }

    try {
      $w('#productVideoTitle').text = 'See It In Action';
    } catch (e) {}

    // Set video source — Wix VideoPlayer or VideoBox element
    try {
      const player = $w('#productVideo');
      if (player) {
        if (videoItem.src) {
          player.src = videoItem.src;
        } else if (videoItem.url) {
          player.src = videoItem.url;
        }
        player.mute();
      }
    } catch (e) {}

    // Link to full product videos page
    try {
      $w('#viewAllVideosLink').onClick(() => {
        import('wix-location-frontend').then(({ to }) => {
          to('/product-videos');
        });
      });
    } catch (e) {}

    videoSection.expand();
  } catch (e) {
    // Video section is optional — collapse if any error
    try { $w('#productVideoSection').collapse(); } catch (e2) {}
  }
}

// ── Product Info Accordion ─────────────────────────────────────────
// Collapsible sections for Description, Dimensions, Care, Shipping

function initProductInfoAccordion() {
  try {
    // Each accordion section has a header button and content box:
    //   #infoHeaderDescription / #infoContentDescription
    //   #infoHeaderDimensions  / #infoContentDimensions
    //   #infoHeaderCare        / #infoContentCare
    //   #infoHeaderShipping    / #infoContentShipping
    const sections = ['Description', 'Dimensions', 'Care', 'Shipping'];
    const openStates = {};

    sections.forEach(section => {
      try {
        const header = $w(`#infoHeader${section}`);
        const content = $w(`#infoContent${section}`);
        if (!header || !content) return;

        // Accessibility: mark headers as expandable controls
        try { header.accessibility.ariaLabel = `${section} section`; } catch (e) {}

        // Start with Description expanded, others collapsed
        if (section === 'Description') {
          content.expand();
          openStates[section] = true;
          try { $w(`#infoArrow${section}`).text = '−'; } catch (e) {}
          try { header.accessibility.ariaExpanded = true; } catch (e) {}
        } else {
          content.collapse();
          openStates[section] = false;
          try { $w(`#infoArrow${section}`).text = '+'; } catch (e) {}
          try { header.accessibility.ariaExpanded = false; } catch (e) {}
        }

        header.onClick(() => {
          if (openStates[section]) {
            content.collapse();
            openStates[section] = false;
            try { $w(`#infoArrow${section}`).text = '+'; } catch (e) {}
            try { header.accessibility.ariaExpanded = false; } catch (e) {}
          } else {
            content.expand();
            openStates[section] = true;
            try { $w(`#infoArrow${section}`).text = '−'; } catch (e) {}
            try { header.accessibility.ariaExpanded = true; } catch (e) {}
          }
        });
      } catch (e) {}
    });

    // Populate shipping info from store constants
    try {
      $w('#infoContentShipping').text =
        'Free standard shipping on orders $999+. ' +
        'White-glove delivery available: $149 local (WNC), $249 regional, free on orders over $1,999. ' +
        'Standard delivery: 5–10 business days. ' +
        'Local customers: call (828) 252-9449 to schedule Wed–Sat delivery.';
    } catch (e) {}
  } catch (e) {
    // Accordion elements may not exist — non-critical
  }
}

// ── Social Share Buttons ────────────────────────────────────────────
// Share product on Facebook, Pinterest, and copy link

function initSocialShare() {
  try {
    if (!currentProduct) return;
    const url = `https://www.carolinafutons.com/product-page/${currentProduct.slug}`;
    const title = currentProduct.name;
    const image = currentProduct.mainMedia || '';

    // Accessibility: label share buttons
    try { $w('#shareFacebook').accessibility.ariaLabel = 'Share on Facebook'; } catch (e) {}
    try { $w('#sharePinterest').accessibility.ariaLabel = 'Share on Pinterest'; } catch (e) {}
    try { $w('#shareEmail').accessibility.ariaLabel = 'Share via email'; } catch (e) {}
    try { $w('#shareCopyLink').accessibility.ariaLabel = 'Copy product link'; } catch (e) {}

    // Facebook
    try {
      $w('#shareFacebook').onClick(() => {
        trackSocialShare('facebook', 'product');
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
        });
      });
    } catch (e) {}

    // Pinterest
    try {
      $w('#sharePinterest').onClick(() => {
        trackSocialShare('pinterest', 'product');
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(image)}&description=${encodeURIComponent(title)}`);
        });
      });
    } catch (e) {}

    // Email share
    try {
      $w('#shareEmail').onClick(() => {
        trackSocialShare('email', 'product');
        const subject = encodeURIComponent(`Check out ${title} from Carolina Futons`);
        const body = encodeURIComponent(`I thought you might like this: ${title}\n\n${url}`);
        import('wix-window-frontend').then(({ openUrl }) => {
          openUrl(`mailto:?subject=${subject}&body=${body}`);
        });
      });
    } catch (e) {}

    // Copy link
    try {
      $w('#shareCopyLink').onClick(() => {
        trackSocialShare('copy_link', 'product');
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard.writeText(url).then(() => {
            $w('#shareCopyLink').label = 'Copied!';
            setTimeout(() => {
              try { $w('#shareCopyLink').label = 'Copy Link'; } catch (e) {}
            }, 2000);
          });
        }
      });
    } catch (e) {}
  } catch (e) {}
}

// ── Product Schema Injection ────────────────────────────────────────

async function injectProductSchema() {
  try {
    if (!currentProduct) return;

    const schema = await getProductSchema(currentProduct);
    if (schema) {
      $w('#productSchemaHtml').postMessage(schema);
    }

    // Inject Open Graph tags for social sharing
    const ogTags = await getProductOgTags(currentProduct);
    if (ogTags) {
      try { $w('#productOgHtml').postMessage(ogTags); } catch (e) {}
    }
  } catch (e) {}
}

// ── Frequently Bought Together Bundle ─────────────────────────────
// Shows complementary product with 5% bundle discount

let bundleProduct = null;

async function initBundleSection() {
  try {
    if (!currentProduct) return;

    const bundle = await getBundleSuggestion(currentProduct._id);
    if (!bundle || !bundle.product) {
      try { $w('#bundleSection').collapse(); } catch (e) {}
      return;
    }

    bundleProduct = bundle.product;

    try {
      $w('#bundleSection').expand();
      $w('#bundleImage').src = bundle.product.mainMedia;
      $w('#bundleImage').alt = bundle.product.name + ' — bundle suggestion';
      $w('#bundleName').text = bundle.product.name;
      $w('#bundlePrice').text = formatCurrency(bundle.bundlePrice);
      $w('#bundleSavings').text = `Save ${formatCurrency(bundle.savings)}`;
    } catch (e) {}

    try {
      $w('#addBundleBtn').onClick(async () => {
        try {
          $w('#addBundleBtn').disable();
          $w('#addBundleBtn').label = 'Adding...';
          await addToCart(currentProduct._id, selectedQuantity);
          await addToCart(bundle.product._id, 1);
          $w('#addBundleBtn').label = 'Bundle Added!';
          trackCartAdd(currentProduct, selectedQuantity);
        } catch (err) {
          console.error('Error adding bundle to cart:', err);
          $w('#addBundleBtn').label = 'Error — Try Again';
        }
        setTimeout(() => {
          try {
            $w('#addBundleBtn').label = 'Add Both to Cart';
            $w('#addBundleBtn').enable();
          } catch (e) {}
        }, 3000);
      });
    } catch (e) {}

    // Click bundle image/name to navigate to that product
    const navigateToBundle = () => {
      import('wix-location-frontend').then(({ to }) => {
        to(`/product-page/${bundle.product.slug}`);
      });
    };
    try { $w('#bundleImage').onClick(navigateToBundle); } catch (e) {}
    try { $w('#bundleName').onClick(navigateToBundle); } catch (e) {}
  } catch (err) {
    console.error('Error loading bundle section:', err);
  }
}

// ── Sticky Add-to-Cart Bar ───────────────────────────────────────
// Fixed bottom bar appears when main Add to Cart scrolls out of view

function updateStickyPrice(variant) {
  try {
    if (variant && variant.price) {
      $w('#stickyPrice').text = formatCurrency(variant.price);
    }
  } catch (e) {}
}

function initStickyCartBar() {
  try {
    const stickyBar = $w('#stickyCartBar');
    if (!stickyBar) return;

    // Initially hidden
    stickyBar.hide();

    // Set product info in sticky bar
    if (currentProduct) {
      try { $w('#stickyProductName').text = currentProduct.name; } catch (e) {}
      try { $w('#stickyPrice').text = currentProduct.formattedPrice; } catch (e) {}
    }

    // Sticky Add to Cart mirrors the main button (respects quantity)
    try {
      $w('#stickyAddBtn').onClick(async () => {
        try {
          $w('#stickyAddBtn').disable();
          $w('#stickyAddBtn').label = 'Adding...';
          await addToCart(currentProduct._id, selectedQuantity);
          trackCartAdd(currentProduct, selectedQuantity);
          $w('#stickyAddBtn').label = 'Added!';
        } catch (err) {
          $w('#stickyAddBtn').label = 'Error — Try Again';
        }
        setTimeout(() => {
          try {
            $w('#stickyAddBtn').label = 'Add to Cart';
            $w('#stickyAddBtn').enable();
          } catch (e) {}
        }, 2000);
      });
    } catch (e) {}

    // Monitor scroll to show/hide sticky bar
    let stickyVisible = false;
    wixWindowFrontend.onScroll(async (event) => {
      try {
        const btnBounds = await $w('#addToCartButton').getBoundingRect();
        const shouldShow = btnBounds.top < 0;

        if (shouldShow && !stickyVisible) {
          stickyVisible = true;
          stickyBar.show('slide', { direction: 'bottom', duration: 250 });
        } else if (!shouldShow && stickyVisible) {
          stickyVisible = false;
          stickyBar.hide('slide', { direction: 'bottom', duration: 250 });
        }
      } catch (e) {}
    });
  } catch (e) {}
}

// ── Stock Urgency Indicators ─────────────────────────────────────
// "Only X left" warning and popularity badge

async function initStockUrgency() {
  try {
    if (!currentProduct) return;

    // Stock urgency: show when quantity < 5
    try {
      const stockUrgency = $w('#stockUrgency');
      if (stockUrgency) {
        if (currentProduct.quantityInStock != null && currentProduct.quantityInStock < 5 && currentProduct.quantityInStock > 0) {
          stockUrgency.text = `Only ${currentProduct.quantityInStock} left in stock`;
          stockUrgency.show();
        } else {
          stockUrgency.hide();
        }
      }
    } catch (e) {}

    // Popularity badge: check ProductAnalytics CMS for recent sales data
    try {
      const badge = $w('#popularityBadge');
      if (badge) {
        const analytics = await import('wix-data').then(mod =>
          mod.default.query('ProductAnalytics')
            .eq('productId', currentProduct._id)
            .find()
        );

        if (analytics.items.length > 0 && analytics.items[0].weekSales > 0) {
          badge.text = `Popular — ${analytics.items[0].weekSales} sold this week`;
          badge.show();
        } else {
          badge.hide();
        }
      }
    } catch (e) {
      // ProductAnalytics collection may not exist — skip gracefully
      try { $w('#popularityBadge').hide(); } catch (e2) {}
    }
  } catch (e) {}
}

// ── Delivery Estimate ────────────────────────────────────────────
// Shows estimated delivery range (5-10 business days from today)

function initDeliveryEstimate() {
  try {
    const el = $w('#deliveryEstimate');
    if (!el || !currentProduct) return;

    const today = new Date();
    const minDate = addBusinessDays(today, 5);
    const maxDate = addBusinessDays(today, 10);

    const opts = { month: 'short', day: 'numeric', year: 'numeric' };
    const minStr = minDate.toLocaleDateString('en-US', opts);
    const maxStr = maxDate.toLocaleDateString('en-US', opts);

    el.text = `Estimated delivery: ${minStr} – ${maxStr}`;
    el.show();

    // White-glove delivery note for furniture items
    try {
      const isLargeItem = currentProduct.weight > 50 ||
        (currentProduct.collections || []).some(c => /murphy|platform|futon|frame/i.test(c));
      if (isLargeItem) {
        const whiteGloveEl = $w('#whiteGloveNote');
        if (whiteGloveEl) {
          whiteGloveEl.text = 'White-glove delivery available — call (828) 252-9449 to schedule';
          whiteGloveEl.show();
        }
      }
    } catch (e) {}
  } catch (e) {}
}

function addBusinessDays(startDate, days) {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

// ── Wishlist / Save Button ───────────────────────────────────────
// Heart icon to save product to Wishlist CMS collection

async function initWishlistButton() {
  try {
    const btn = $w('#wishlistBtn');
    if (!btn || !currentProduct) return;

    const { currentMember } = await import('wix-members-frontend');
    const member = await currentMember.getMember();

    // Check if already wishlisted
    if (member) {
      try {
        const wixData = (await import('wix-data')).default;
        const existing = await wixData.query('Wishlist')
          .eq('memberId', member._id)
          .eq('productId', currentProduct._id)
          .find();

        if (existing.items.length > 0) {
          setWishlistActive(true);
        }
      } catch (e) {}
    }

    btn.onClick(async () => {
      // Check login first
      const { currentMember: cm, authentication } = await import('wix-members-frontend');
      const m = await cm.getMember();

      if (!m) {
        authentication.promptLogin();
        return;
      }

      const wixData = (await import('wix-data')).default;
      const existing = await wixData.query('Wishlist')
        .eq('memberId', m._id)
        .eq('productId', currentProduct._id)
        .find();

      if (existing.items.length > 0) {
        // Remove from wishlist
        await wixData.remove('Wishlist', existing.items[0]._id);
        setWishlistActive(false);
      } else {
        // Add to wishlist
        await wixData.insert('Wishlist', {
          memberId: m._id,
          productId: currentProduct._id,
          productName: currentProduct.name,
          productImage: currentProduct.mainMedia,
          addedDate: new Date(),
        });
        setWishlistActive(true);
      }
    });
  } catch (e) {
    // Members API unavailable — hide wishlist button
    try { $w('#wishlistBtn').hide(); } catch (e2) {}
  }
}

// SVG data URI heart icons — filled (coral) and outline (espresso)
// Uses design system colors instead of external wixstatic.com URLs
const HEART_FILLED_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${colors.sunsetCoral}"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`)}`;
const HEART_OUTLINE_SVG = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${colors.espresso}" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`)}`;

function setWishlistActive(active) {
  try {
    const icon = $w('#wishlistIcon');
    if (icon) {
      icon.src = active ? HEART_FILLED_SVG : HEART_OUTLINE_SVG;
    }
    // Update ARIA label to reflect current state
    try {
      const btn = $w('#wishlistBtn');
      btn.accessibility.ariaLabel = active ? 'Remove from wishlist' : 'Add to wishlist';
    } catch (e) {}
  } catch (e) {}
}
