// Category Page.u0gn0.js - Product Category / Collection Pages
// Handles filtering, sorting, product grid with engagement features,
// category hero content, product badges, recently viewed, and SEO meta
// Used for: Futon Frames, Mattresses, Murphy Beds, Platform Beds, etc.
import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';
import { getCollectionSchema, getBreadcrumbSchema, getCategoryMetaDescription } from 'backend/seoHelpers.web';
import { getProductBadge, getRecentlyViewed } from 'public/galleryHelpers';
import { getProductFallbackImage } from 'public/placeholderImages.js';
import { getSwatchPreviewColors } from 'backend/swatchService.web';

let currentSort = 'name-asc';
let currentFilters = {};
let currentQuickViewProduct = null;

// ── Category Content Map ─────────────────────────────────────────────
// Marketing copy and hero config for each category

const CATEGORY_CONTENT = {
  'futon-frames': {
    title: 'Futon Frames',
    subtitle: 'Handcrafted frames for every room — from classic hardwood to contemporary designs',
    heroGradient: 'linear-gradient(135deg, #E8D5B7 0%, #D4BC96 100%)',
  },
  'mattresses': {
    title: 'Mattresses',
    subtitle: 'Premium mattresses crafted for comfort — find your perfect sleep surface',
    heroGradient: 'linear-gradient(135deg, #F2E8D5 0%, #E8D5B7 100%)',
  },
  'murphy-cabinet-beds': {
    title: 'Murphy Cabinet Beds',
    subtitle: 'Space-saving elegance — beautiful cabinet beds that transform any room',
    heroGradient: 'linear-gradient(135deg, #A8CCD8 0%, #5B8FA8 100%)',
  },
  'platform-beds': {
    title: 'Platform Beds',
    subtitle: 'Modern simplicity meets mountain craftsmanship',
    heroGradient: 'linear-gradient(135deg, #E8D5B7 0%, #C9A0A0 100%)',
  },
  'casegoods-accessories': {
    title: 'Casegoods & Accessories',
    subtitle: 'Complete your space with matching nightstands, dressers, and storage',
    heroGradient: 'linear-gradient(135deg, #D4BC96 0%, #E8D5B7 100%)',
  },
  'wall-huggers': {
    title: 'Wall Hugger Frames',
    subtitle: 'Space-efficient frames designed to sit close to your wall',
    heroGradient: 'linear-gradient(135deg, #E8D5B7 0%, #A8CCD8 100%)',
  },
  'unfinished-wood': {
    title: 'Unfinished Wood',
    subtitle: 'Raw hardwood frames ready for your personal finish',
    heroGradient: 'linear-gradient(135deg, #F2E8D5 0%, #D4BC96 100%)',
  },
  'sales': {
    title: 'Sale',
    subtitle: 'Current deals on quality furniture — limited time savings',
    heroGradient: 'linear-gradient(135deg, #F2A882 0%, #E8845C 100%)',
  },
};

$w.onReady(async function () {
  const currentPath = wixLocationFrontend.path?.[0] || '';

  initCategoryHero(currentPath);
  initSortControls();
  initFilterControls();
  initProductGrid();
  updateResultCount(currentPath);
  initRecentlyViewed();
  injectCategoryMeta(currentPath);
  await injectCategorySchema();
});

// ── Category Hero ────────────────────────────────────────────────────

function initCategoryHero(currentPath) {
  const content = CATEGORY_CONTENT[currentPath];
  if (!content) return;

  try {
    $w('#categoryHeroTitle').text = content.title;
  } catch (e) {}

  try {
    $w('#categoryHeroSubtitle').text = content.subtitle;
  } catch (e) {}

  try {
    $w('#categoryHeroSection').style.backgroundColor = '';
    $w('#categoryHeroSection').style.backgroundImage = content.heroGradient;
  } catch (e) {
    // backgroundImage may not be supported on all element types;
    // fall back to a solid color from the gradient start
    try {
      const solidColor = content.heroGradient.match(/#[A-Fa-f0-9]{6}/)?.[0] || '#E8D5B7';
      $w('#categoryHeroSection').style.backgroundColor = solidColor;
    } catch (e2) {}
  }
}

// ── SEO Meta Description ─────────────────────────────────────────────

async function injectCategoryMeta(currentPath) {
  try {
    const metaDescription = await getCategoryMetaDescription(currentPath);
    if (metaDescription) {
      const { head } = await import('wix-seo-frontend');
      head.setMetaTag('description', metaDescription);

      // Also set OG description
      head.setMetaTag('og:description', metaDescription);

      // Set title from category content if available
      const content = CATEGORY_CONTENT[currentPath];
      if (content) {
        head.setTitle(`${content.title} | Carolina Futons - Hendersonville, NC`);
        head.setMetaTag('og:title', `${content.title} | Carolina Futons`);
      }
    }
  } catch (e) {}
}

// ── Sort Controls ───────────────────────────────────────────────────

function initSortControls() {
  try {
    const sortDropdown = $w('#sortDropdown');
    if (!sortDropdown) return;

    sortDropdown.options = [
      { label: 'Name (A-Z)', value: 'name-asc' },
      { label: 'Name (Z-A)', value: 'name-desc' },
      { label: 'Price: Low to High', value: 'price-asc' },
      { label: 'Price: High to Low', value: 'price-desc' },
      { label: 'Newest First', value: 'date-desc' },
    ];

    sortDropdown.value = 'name-asc';

    sortDropdown.onChange(() => {
      currentSort = sortDropdown.value;
      applySort();
    });
  } catch (e) {}
}

function applySort() {
  try {
    const dataset = $w('#categoryDataset');
    if (!dataset) return;

    let sort;
    switch (currentSort) {
      case 'name-asc':
        sort = wixData.sort().ascending('name');
        break;
      case 'name-desc':
        sort = wixData.sort().descending('name');
        break;
      case 'price-asc':
        sort = wixData.sort().ascending('price');
        break;
      case 'price-desc':
        sort = wixData.sort().descending('price');
        break;
      case 'date-desc':
        sort = wixData.sort().descending('_createdDate');
        break;
      default:
        sort = wixData.sort();
    }
    dataset.setSort(sort);
  } catch (e) {
    console.error('Error applying sort:', e);
  }
}

// ── Filter Controls ─────────────────────────────────────────────────
// Filter by brand, price range, size, finish

function initFilterControls() {
  // Brand filter — includes Wall Hugger and Unfinished Wood brands
  try {
    const brandFilter = $w('#filterBrand');
    if (brandFilter) {
      brandFilter.options = [
        { label: 'All Brands', value: '' },
        { label: 'Night & Day Furniture', value: 'Night & Day' },
        { label: 'Strata Furniture', value: 'Strata' },
        { label: 'Wall Hugger Frames', value: 'Wall Hugger' },
        { label: 'KD Frames', value: 'KD Frames' },
        { label: 'Unfinished Wood', value: 'Unfinished' },
        { label: 'Otis Bed', value: 'Otis' },
      ];
      brandFilter.value = '';
      brandFilter.onChange(() => {
        currentFilters.brand = brandFilter.value;
        applyFilters();
      });
    }
  } catch (e) {}

  // Price range filter
  try {
    const priceFilter = $w('#filterPrice');
    if (priceFilter) {
      priceFilter.options = [
        { label: 'All Prices', value: '' },
        { label: 'Under $300', value: '0-300' },
        { label: '$300 - $500', value: '300-500' },
        { label: '$500 - $800', value: '500-800' },
        { label: '$800 - $1200', value: '800-1200' },
        { label: 'Over $1200', value: '1200-99999' },
      ];
      priceFilter.value = '';
      priceFilter.onChange(() => {
        currentFilters.price = priceFilter.value;
        applyFilters();
      });
    }
  } catch (e) {}

  // Size filter
  try {
    const sizeFilter = $w('#filterSize');
    if (sizeFilter) {
      sizeFilter.options = [
        { label: 'All Sizes', value: '' },
        { label: 'Full', value: 'Full' },
        { label: 'Queen', value: 'Queen' },
        { label: 'Twin', value: 'Twin' },
      ];
      sizeFilter.value = '';
      sizeFilter.onChange(() => {
        currentFilters.size = sizeFilter.value;
        applyFilters();
      });
    }
  } catch (e) {}

  // Clear all filters button
  try {
    $w('#clearFilters').onClick(() => {
      currentFilters = {};
      try { $w('#filterBrand').value = ''; } catch (e) {}
      try { $w('#filterPrice').value = ''; } catch (e) {}
      try { $w('#filterSize').value = ''; } catch (e) {}
      applyFilters();
    });
  } catch (e) {}
}

function applyFilters() {
  try {
    const dataset = $w('#categoryDataset');
    if (!dataset) return;

    let filter = wixData.filter();

    if (currentFilters.brand) {
      filter = filter.contains('brand', currentFilters.brand);
    }

    if (currentFilters.price) {
      const [min, max] = currentFilters.price.split('-').map(Number);
      filter = filter.ge('price', min).le('price', max);
    }

    if (currentFilters.size) {
      filter = filter.hasSome('productOptions.Size', [currentFilters.size]);
    }

    dataset.setFilter(filter);
    updateResultCount();
  } catch (e) {
    console.error('Error applying filters:', e);
  }
}

// ── Product Grid ────────────────────────────────────────────────────
// Enhanced product cards with hover effects, quick-view, and badges

function initProductGrid() {
  try {
    const repeater = $w('#productGridRepeater');
    if (!repeater) return;

    repeater.onItemReady(($item, itemData) => {
      // Set product image with SEO alt text (fallback to placeholder if no image)
      const category = wixLocationFrontend.path?.[0] || '';
      $item('#gridImage').src = itemData.mainMedia || getProductFallbackImage(category);
      $item('#gridImage').alt = buildAltText(itemData);

      // Product info
      $item('#gridName').text = itemData.name;
      $item('#gridPrice').text = itemData.formattedPrice;

      // Sale pricing
      if (itemData.formattedDiscountedPrice) {
        $item('#gridPrice').text = itemData.formattedDiscountedPrice;
        try {
          $item('#gridOrigPrice').text = itemData.formattedPrice;
          $item('#gridOrigPrice').show();
          $item('#gridSaleBadge').show();
        } catch (e) {}
      }

      // Product badge from galleryHelpers (Sale, New, Featured, In-Store Only)
      try {
        const badge = getProductBadge(itemData);
        if (badge) {
          $item('#gridBadge').text = badge;
          $item('#gridBadge').show();
        } else {
          $item('#gridBadge').hide();
        }
      } catch (e) {}

      // Brand label
      try {
        const brand = detectBrand(itemData);
        if (brand) {
          $item('#gridBrand').text = brand;
          $item('#gridBrand').show();
        }
      } catch (e) {}

      // Ribbon badge (Featured, New, etc.)
      if (itemData.ribbon) {
        try {
          $item('#gridRibbon').text = itemData.ribbon;
          $item('#gridRibbon').show();
        } catch (e) {}
      }

      // Click to product page
      const navigateToProduct = () => {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };

      $item('#gridImage').onClick(navigateToProduct);
      $item('#gridName').onClick(navigateToProduct);

      // Fabric swatch preview dots (3-4 color circles)
      initGridSwatchPreview($item, itemData);

      // "Available in 700+ fabrics" badge
      try {
        // Show badge for products that have fabric options (frames, not mattresses)
        const colls = Array.isArray(itemData.collections) ? itemData.collections : [];
        const hasFabricOptions = colls.some(c =>
          c.includes('futon') || c.includes('frame') || c.includes('wall-hugger') ||
          c.includes('unfinished') || c.includes('platform')
        );
        if (hasFabricOptions) {
          $item('#gridFabricBadge').text = 'Available in 700+ fabrics';
          $item('#gridFabricBadge').show();
        } else {
          $item('#gridFabricBadge').hide();
        }
      } catch (e) {}

      // Quick view button
      try {
        $item('#quickViewBtn').onClick(() => {
          openQuickView(itemData);
        });
      } catch (e) {}

      // Compare button
      try {
        const compareBtn = $item('#gridCompareBtn');
        if (compareBtn) {
          // Set initial state
          const currentList = getCompareList();
          const isInList = currentList.some(p => p._id === itemData._id);
          compareBtn.label = isInList ? 'Remove from Compare' : 'Compare';

          compareBtn.onClick(() => {
            const list = getCompareList();
            const alreadyComparing = list.some(p => p._id === itemData._id);

            if (alreadyComparing) {
              removeFromCompare(itemData._id);
              compareBtn.label = 'Compare';
            } else {
              const added = addToCompare({
                _id: itemData._id,
                name: itemData.name,
                slug: itemData.slug,
                formattedPrice: itemData.formattedPrice,
                mainMedia: itemData.mainMedia,
              });
              if (added) {
                compareBtn.label = 'Remove from Compare';
              }
            }

            // Refresh the global compare bar on masterPage
            refreshCompareBarUI();
          });
        }
      } catch (e) {}
    });
  } catch (e) {
    console.error('Error initializing product grid:', e);
  }
}

// ── Grid Swatch Preview Dots ────────────────────────────────────────
// Shows 3-4 small color circles on product cards for items with fabric options

async function initGridSwatchPreview($item, itemData) {
  try {
    const preview = $item('#gridSwatchPreview');
    if (!preview) return;

    // Only load swatches for products that likely have fabric options
    const colls = Array.isArray(itemData.collections) ? itemData.collections : [];
    const hasFabricOptions = colls.some(c =>
      c.includes('futon') || c.includes('frame') || c.includes('wall-hugger') ||
      c.includes('unfinished') || c.includes('platform')
    );

    if (!hasFabricOptions) {
      preview.collapse();
      return;
    }

    const swatchColors = await getSwatchPreviewColors(itemData._id, 4);
    if (!swatchColors || swatchColors.length === 0) {
      preview.collapse();
      return;
    }

    // Set color dots (up to 4 pre-placed dot elements in the editor)
    const dotIds = ['#swatchDot1', '#swatchDot2', '#swatchDot3', '#swatchDot4'];
    dotIds.forEach((dotId, i) => {
      try {
        const dot = $item(dotId);
        if (i < swatchColors.length) {
          dot.style.backgroundColor = swatchColors[i].colorHex;
          dot.show();
        } else {
          dot.hide();
        }
      } catch (e) {}
    });

    preview.expand();
  } catch (e) {
    try { $item('#gridSwatchPreview').collapse(); } catch (e2) {}
  }
}

// ── Quick View Modal ────────────────────────────────────────────────

// Register quick view handlers once to avoid accumulation
function initQuickViewHandlers() {
  try {
    $w('#qvViewFull').onClick(() => {
      if (currentQuickViewProduct) {
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${currentQuickViewProduct.slug}`);
        });
      }
    });

    $w('#qvAddToCart').onClick(async () => {
      if (!currentQuickViewProduct) return;
      try {
        const { default: wixStoresFrontend } = await import('wix-stores-frontend');
        await wixStoresFrontend.cart.addProducts([{ productId: currentQuickViewProduct._id, quantity: 1 }]);
        $w('#qvAddToCart').label = 'Added!';
        setTimeout(() => {
          $w('#quickViewModal').hide('fade', { duration: 200 });
        }, 1000);
      } catch (err) {
        console.error('Error adding to cart from quick view:', err);
      }
    });

    $w('#qvClose').onClick(() => {
      $w('#quickViewModal').hide('fade', { duration: 200 });
    });
  } catch (e) {}
}

function openQuickView(product) {
  try {
    currentQuickViewProduct = product;
    $w('#qvImage').src = product.mainMedia;
    $w('#qvImage').alt = buildAltText(product);
    $w('#qvName').text = product.name;
    $w('#qvPrice').text = product.formattedPrice;
    $w('#qvDescription').text = stripHtml(product.description || '');
    $w('#qvAddToCart').label = 'Add to Cart';
    $w('#quickViewModal').show('fade', { duration: 200 });
  } catch (e) {}
}

// ── Result Count & Empty State ──────────────────────────────────────

function updateResultCount(currentPath) {
  try {
    const dataset = $w('#categoryDataset');
    if (!dataset) return;

    dataset.onReady(() => {
      const count = dataset.getTotalCount();
      try {
        $w('#resultCount').text = `${count} product${count !== 1 ? 's' : ''}`;
      } catch (e) {}

      // Show empty state if no products found
      if (count === 0) {
        showEmptyState(currentPath);
      } else {
        try { $w('#emptyStateSection').hide(); } catch (e) {}
      }
    });
  } catch (e) {}
}

function showEmptyState(currentPath) {
  try {
    const content = CATEGORY_CONTENT[currentPath];
    const categoryName = content ? content.title : 'this category';

    try {
      $w('#emptyStateTitle').text = `No products found`;
    } catch (e) {}

    try {
      $w('#emptyStateMessage').text =
        `We're updating our ${categoryName} collection. Check back soon or visit our Hendersonville showroom to see what's available in store.`;
    } catch (e) {}

    // Show illustration placeholder
    try { $w('#emptyStateIllustration').show(); } catch (e) {}

    $w('#emptyStateSection').show();
  } catch (e) {}
}

// ── Recently Viewed ─────────────────────────────────────────────────

function initRecentlyViewed() {
  try {
    const recentItems = getRecentlyViewed();
    if (!recentItems || recentItems.length === 0) {
      try { $w('#recentlyViewedSection').hide(); } catch (e) {}
      return;
    }

    try {
      $w('#recentlyViewedTitle').text = 'Recently Viewed';
    } catch (e) {}

    const repeater = $w('#recentlyViewedRepeater');
    if (!repeater) {
      try { $w('#recentlyViewedSection').hide(); } catch (e) {}
      return;
    }

    repeater.data = recentItems.slice(0, 6);

    repeater.onItemReady(($item, itemData) => {
      try {
        $item('#recentImage').src = itemData.mainMedia;
        $item('#recentImage').alt = `${itemData.name} - Carolina Futons`;
      } catch (e) {}

      try { $item('#recentName').text = itemData.name; } catch (e) {}
      try { $item('#recentPrice').text = itemData.price; } catch (e) {}

      const navigateToProduct = () => {
        import('wix-location').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };

      try { $item('#recentImage').onClick(navigateToProduct); } catch (e) {}
      try { $item('#recentName').onClick(navigateToProduct); } catch (e) {}
    });

    $w('#recentlyViewedSection').show();
  } catch (e) {
    try { $w('#recentlyViewedSection').hide(); } catch (e2) {}
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function buildAltText(product) {
  const brand = detectBrand(product);
  const category = detectCategory(product);
  const parts = [product.name];
  if (brand) parts.push(brand);
  if (category) parts.push(category);
  parts.push('Carolina Futons Hendersonville NC');
  const alt = parts.join(' - ');
  return alt.length > 125 ? alt.substring(0, 122) + '...' : alt;
}

function detectBrand(product) {
  if (!product.collections) return '';
  const colls = Array.isArray(product.collections) ? product.collections : [product.collections];

  if (colls.some(c => c.includes('wall-hugger'))) return 'Strata Furniture';
  if (colls.some(c => c.includes('unfinished'))) return 'KD Frames';
  if (colls.some(c => c.includes('mattress'))) return 'Otis Bed';
  return 'Night & Day Furniture';
}

function detectCategory(product) {
  if (!product.collections) return '';
  const colls = Array.isArray(product.collections) ? product.collections : [product.collections];

  if (colls.some(c => c.includes('murphy'))) return 'Murphy Cabinet Bed';
  if (colls.some(c => c.includes('platform'))) return 'Platform Bed';
  if (colls.some(c => c.includes('mattress'))) return 'Futon Mattress';
  if (colls.some(c => c.includes('wall-hugger'))) return 'Wall Hugger Futon Frame';
  if (colls.some(c => c.includes('futon') || c.includes('frame'))) return 'Futon Frame';
  if (colls.some(c => c.includes('casegood') || c.includes('accessor'))) return 'Bedroom Furniture';
  return '';
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

// ── Compare Bar Refresh ──────────────────────────────────────────
// Updates the masterPage compare bar from this page context

function refreshCompareBarUI() {
  try {
    const compareBar = $w('#compareBar');
    if (!compareBar) return;

    const items = getCompareList();

    if (items.length === 0) {
      compareBar.hide('slide', { duration: 200, direction: 'bottom' });
      return;
    }

    const repeater = $w('#compareRepeater');
    if (repeater) {
      repeater.data = items.map(p => ({ ...p, _id: p._id }));
      repeater.onItemReady(($item, itemData) => {
        try { $item('#compareThumb').src = itemData.mainMedia; } catch (e) {}
        try { $item('#compareName').text = itemData.name; } catch (e) {}
        try { $item('#comparePrice').text = itemData.price; } catch (e) {}
        try {
          $item('#compareRemove').onClick(() => {
            removeFromCompare(itemData._id);
            refreshCompareBarUI();
          });
        } catch (e) {}
      });
    }

    compareBar.show('slide', { duration: 200, direction: 'bottom' });
  } catch (e) {}
}

// ── Category Schema Injection ─────────────────────────────────────

async function injectCategorySchema() {
  try {
    const currentPath = wixLocationFrontend.path?.[0] || '';
    const categoryMap = {
      'futon-frames': { slug: 'futon-frames', title: 'Futon Frames' },
      'mattresses': { slug: 'mattresses', title: 'Futon Mattresses' },
      'murphy-cabinet-beds': { slug: 'murphy-cabinet-beds', title: 'Murphy Cabinet Beds' },
      'platform-beds': { slug: 'platform-beds', title: 'Platform Beds' },
      'casegoods-accessories': { slug: 'casegoods-accessories', title: 'Casegoods & Accessories' },
      'wall-huggers': { slug: 'wall-huggers', title: 'Wall Hugger Futon Frames' },
      'unfinished-wood': { slug: 'unfinished-wood', title: 'Unfinished Wood Futon Frames' },
    };

    const categoryInfo = categoryMap[currentPath];
    if (!categoryInfo) return;

    // Collect visible products from the dataset for ItemList
    const dataset = $w('#categoryDataset');
    if (!dataset) return;

    await dataset.onReady();
    const products = [];
    const total = Math.min(dataset.getTotalCount(), 30);
    for (let i = 0; i < total; i++) {
      const result = await dataset.getItems(i, 1);
      const item = result?.items?.[0];
      if (item) {
        products.push({
          slug: item.slug,
          name: item.name,
          mainMedia: item.mainMedia,
        });
      }
    }

    const schema = await getCollectionSchema(categoryInfo, products);
    if (schema) {
      try {
        $w('#categorySchemaHtml').postMessage(schema);
      } catch (e) {}
    }

    // Inject breadcrumb schema
    const breadcrumbs = [
      { name: 'Home', url: '/' },
      { name: categoryInfo.title, url: null },
    ];
    const breadcrumbSchema = await getBreadcrumbSchema(breadcrumbs);
    if (breadcrumbSchema) {
      try {
        $w('#categoryBreadcrumbSchemaHtml').postMessage(breadcrumbSchema);
      } catch (e) {}
    }
  } catch (e) {}
}
