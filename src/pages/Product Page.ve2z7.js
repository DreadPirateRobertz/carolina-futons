// Product Page.ve2z7.js - Individual Product Display
// Handles variant selection with independent pricing, cross-sell,
// gallery enhancement, lightbox, zoom, recently viewed, fabric swatch
// visualizer, and SEO schema injection
import { getRelatedProducts, getSameCollection } from 'backend/productRecommendations.web';
import { getProductSwatches, getAllSwatchFamilies, getSwatchCount } from 'backend/swatchService.web';
import { getProductSchema, generateAltText, getBreadcrumbSchema } from 'backend/seoHelpers.web';
import {
  trackProductView,
  getRecentlyViewed,
  getProductBadge,
  initImageLightbox,
  initImageZoom,
} from 'public/galleryHelpers.js';
import wixLocationFrontend from 'wix-location-frontend';
import wixStoresFrontend from 'wix-stores-frontend';

let currentProduct = null;
let productVariants = [];
let selectedSwatchId = null;

$w.onReady(async function () {
  await initProductPage();
});

// ── Main Initialization ─────────────────────────────────────────────

async function initProductPage() {
  try {
    // Get the current product from the dataset
    await $w('#productDataset').onReady();
    currentProduct = $w('#productDataset').getCurrentItem();

    if (!currentProduct) return;

    // Track this product view in session storage for "Recently Viewed"
    trackProductView(currentProduct);

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
      initProductBadge(),
    ]);
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
      stockBadge.style.color = '#4A7C59'; // Forest green
    } else {
      stockBadge.text = 'Special Order';
      stockBadge.style.color = '#E8845C'; // Sunset coral
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

    const variant = await wixStoresFrontend.getProductVariants(currentProduct._id, { choices });

    if (variant && variant.length > 0) {
      const selected = variant[0];
      updateVariantPrice({ variant: selected });
      updateStockStatus(selected);
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
        import('wix-location').then(({ to }) => {
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
          $item('#swatchThumb').style.borderColor = '#5B8FA8'; // Mountain blue
          $item('#swatchThumb').style.borderWidth = '3px';
        } else {
          $item('#swatchThumb').style.borderColor = '#D4BC96'; // Sand dark
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
          $item('#sgThumb').style.borderColor = '#5B8FA8';
          $item('#sgThumb').style.borderWidth = '3px';
        } else {
          $item('#sgThumb').style.borderColor = '#D4BC96';
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

    repeater.data = related;
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
        import('wix-location').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };
      $item('#relatedImage').onClick(navigateToProduct);
      $item('#relatedName').onClick(navigateToProduct);
    });
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

    repeater.data = collectionProducts;
    repeater.onItemReady(($item, itemData) => {
      $item('#collectionImage').src = itemData.mainMedia;
      $item('#collectionImage').alt = buildGridAlt(itemData);
      $item('#collectionName').text = itemData.name;
      $item('#collectionPrice').text = itemData.formattedPrice;

      $item('#collectionImage').onClick(() => {
        import('wix-location').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      });
    });
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
        generateAltText(currentProduct, 'main').then(alt => {
          mainImage.alt = alt;
        });
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
        import('wix-location').then(({ to }) => {
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
// Preload gallery thumbnails for smoother browsing

function preloadGalleryThumbnails() {
  try {
    const gallery = $w('#productGallery');
    if (!gallery || !gallery.items) return;

    gallery.items.forEach(item => {
      if (item.src) {
        const img = new Image();
        img.src = item.src;
      }
    });
  } catch (e) {}
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
        import('wix-location').then(({ to }) => to('/'));
      });
      $w('#breadcrumb2').text = category.label;
      $w('#breadcrumb2').onClick(() => {
        import('wix-location').then(({ to }) => to(category.path));
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

// ── Add to Cart Enhancements ────────────────────────────────────────
// Success feedback and cross-sell prompt after adding to cart

function initAddToCartEnhancements() {
  try {
    const addToCartBtn = $w('#addToCartButton');
    if (!addToCartBtn) return;

    // Listen for successful add-to-cart
    wixStoresFrontend.onCartChanged(() => {
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

// ── Product Schema Injection ────────────────────────────────────────

async function injectProductSchema() {
  try {
    if (!currentProduct) return;

    const schema = await getProductSchema(currentProduct);
    if (schema) {
      $w('#productSchemaHtml').postMessage(schema);
    }
  } catch (e) {}
}
