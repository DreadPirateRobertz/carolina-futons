// Product Page.ve2z7.js - Individual Product Display
// Handles variant selection with independent pricing, cross-sell,
// gallery enhancement, lightbox, zoom, recently viewed, and SEO schema injection
import { getRelatedProducts, getSameCollection, getBundleSuggestion } from 'backend/productRecommendations.web';
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
import wixWindowFrontend from 'wix-window-frontend';

let currentProduct = null;
let productVariants = [];

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
      loadRelatedProducts(),
      loadCollectionProducts(),
      loadRecentlyViewed(),
      injectProductSchema(),
      initImageGallery(),
      initBreadcrumbs(),
      initAddToCartEnhancements(),
      initProductBadge(),
      initBundleSection(),
      initStickyCartBar(),
      initStockUrgency(),
      initDeliveryEstimate(),
      initWishlistButton(),
      initBackInStockNotification(),
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

    const variants = await wixStoresFrontend.getProductVariants(currentProduct._id, { choices });
    if (variants && variants.length > 0 && !variants[0].inStock) {
      section.expand();
    } else {
      section.collapse();
    }
  } catch (e) {
    // Default to hidden if we can't check stock
  }
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
        $w('#addBundleBtn').disable();
        $w('#addBundleBtn').label = 'Adding...';
        await wixStoresFrontend.cart.addProducts([
          { productId: currentProduct._id, quantity: 1 },
          { productId: bundle.product._id, quantity: 1 },
        ]);
        $w('#addBundleBtn').label = 'Bundle Added!';
      });
    } catch (e) {}

    // Click bundle image/name to navigate to that product
    const navigateToBundle = () => {
      import('wix-location').then(({ to }) => {
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

    // Sticky Add to Cart mirrors the main button
    try {
      $w('#stickyAddBtn').onClick(async () => {
        $w('#stickyAddBtn').disable();
        $w('#stickyAddBtn').label = 'Adding...';
        await wixStoresFrontend.cart.addProducts([
          { productId: currentProduct._id, quantity: 1 },
        ]);
        $w('#stickyAddBtn').label = 'Added!';
        setTimeout(() => {
          $w('#stickyAddBtn').label = 'Add to Cart';
          $w('#stickyAddBtn').enable();
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

    // Local delivery for Asheville-area ZIPs (287-289 prefix)
    try {
      import('wix-site-frontend').then(site => {
        const zip = site.currentPage?.visitorZip || '';
        if (/^28[789]/.test(zip)) {
          el.text = `Local delivery available — call for scheduling`;
        }
      });
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

function setWishlistActive(active) {
  try {
    const icon = $w('#wishlistIcon');
    if (icon) {
      // Toggle filled/unfilled heart via CSS class or src swap
      icon.src = active
        ? 'https://static.wixstatic.com/media/heart-filled.png'
        : 'https://static.wixstatic.com/media/heart-outline.png';
    }
  } catch (e) {}
}
