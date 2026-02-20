// Product Page.ve2z7.js - Individual Product Display
// Handles variant selection with independent pricing, cross-sell,
// gallery enhancement, and SEO schema injection
import { getRelatedProducts, getSameCollection, getBundleSuggestion } from 'backend/productRecommendations.web';
import { getProductSchema, generateAltText, getBreadcrumbSchema } from 'backend/seoHelpers.web';
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

    await Promise.all([
      initVariantSelector(),
      loadRelatedProducts(),
      loadCollectionProducts(),
      injectProductSchema(),
      initImageGallery(),
      initBreadcrumbs(),
      initAddToCartEnhancements(),
      initBundleSection(),
      initStickyCartBar(),
      initStockUrgency(),
      initDeliveryEstimate(),
      initWishlistButton(),
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

    // Gallery thumbnail click handling
    const gallery = $w('#productGallery');
    if (gallery) {
      gallery.onItemClicked((event) => {
        try {
          $w('#productMainImage').src = event.item.src;
        } catch (e) {}
      });
    }
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
