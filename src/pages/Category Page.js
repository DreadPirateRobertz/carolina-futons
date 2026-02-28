// Category Page.js - Product Category / Collection Pages
// Handles filtering, sorting, product grid with engagement features,
// category hero content, product badges, recently viewed, and SEO meta
// Used for: Futon Frames, Mattresses, Murphy Beds, Platform Beds, etc.
import wixData from 'wix-data';
import wixLocationFrontend from 'wix-location-frontend';
import { getCollectionSchema, getBreadcrumbSchema, getCategoryMetaDescription, getCategoryOgTags } from 'backend/seoHelpers.web';
import { getProductBadge, getRecentlyViewed, addToCompare, removeFromCompare, getCompareList } from 'public/galleryHelpers';
import { getProductFallbackImage } from 'public/placeholderImages.js';
import { getSwatchPreviewColors } from 'backend/swatchService.web';
import { searchProducts, getFilterValues } from 'backend/searchService.web';
import { isMobile, initBackToTop } from 'public/mobileHelpers';
import { trackEvent } from 'public/engagementTracker';
import { colors } from 'public/designTokens.js';
import { getRecentlyViewed as getCachedRecentlyViewed } from 'public/productCache';
import { enableSwipe } from 'public/touchHelpers';
import { announce, makeClickable } from 'public/a11yHelpers.js';
import { initCategorySocialProof } from 'public/socialProofToast';

let currentSort = 'bestselling';
let currentFilters = {};
let currentQuickViewProduct = null;
let _debounceTimer = null;
let _filterSessionState = {}; // persists across category nav within session

// ── Category Content Map ─────────────────────────────────────────────
// Marketing copy and hero config for each category

const CATEGORY_CONTENT = {
  'futon-frames': {
    title: 'Futon Frames',
    subtitle: 'Handcrafted frames for every room — from classic hardwood to contemporary designs',
    heroGradient: `linear-gradient(135deg, ${colors.sandBase} 0%, ${colors.sandDark} 100%)`,
  },
  'mattresses': {
    title: 'Mattresses',
    subtitle: 'Premium mattresses crafted for comfort — find your perfect sleep surface',
    heroGradient: `linear-gradient(135deg, ${colors.sandLight} 0%, ${colors.sandBase} 100%)`,
  },
  'murphy-cabinet-beds': {
    title: 'Murphy Cabinet Beds',
    subtitle: 'Space-saving elegance — beautiful cabinet beds that transform any room',
    heroGradient: `linear-gradient(135deg, ${colors.mountainBlueLight} 0%, ${colors.mountainBlue} 100%)`,
  },
  'platform-beds': {
    title: 'Platform Beds',
    subtitle: 'Modern simplicity meets mountain craftsmanship',
    heroGradient: `linear-gradient(135deg, ${colors.sandBase} 0%, ${colors.mauve} 100%)`,
  },
  'casegoods-accessories': {
    title: 'Casegoods & Accessories',
    subtitle: 'Complete your space with matching nightstands, dressers, and storage',
    heroGradient: `linear-gradient(135deg, ${colors.sandDark} 0%, ${colors.sandBase} 100%)`,
  },
  'wall-huggers': {
    title: 'Wall Hugger Frames',
    subtitle: 'Space-efficient frames designed to sit close to your wall',
    heroGradient: `linear-gradient(135deg, ${colors.sandBase} 0%, ${colors.mountainBlueLight} 100%)`,
  },
  'unfinished-wood': {
    title: 'Unfinished Wood',
    subtitle: 'Raw hardwood frames ready for your personal finish',
    heroGradient: `linear-gradient(135deg, ${colors.sandLight} 0%, ${colors.sandDark} 100%)`,
  },
  'sales': {
    title: 'Sale',
    subtitle: 'Current deals on quality furniture — limited time savings',
    heroGradient: `linear-gradient(135deg, ${colors.sunsetCoralLight} 0%, ${colors.sunsetCoral} 100%)`,
  },
};

$w.onReady(async function () {
  const currentPath = wixLocationFrontend.path?.[0] || '';

  initCategoryHero(currentPath);
  initSortControls();
  initFilterControls();
  initAdvancedFilters(currentPath);
  initProductGrid();
  updateResultCount(currentPath);
  initRecentlyViewed();
  initQuickViewHandlers();
  injectCategoryMeta(currentPath);
  await injectCategorySchema();
  initCategorySwipe(currentPath);
  initBackToTop($w);
  restoreFiltersFromUrl(currentPath);
  trackEvent('page_view', { page: 'category', category: currentPath });

  // Social proof toast (non-blocking, delayed)
  initCategorySocialProof($w, currentPath).catch(() => {});
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

  // Visible breadcrumb row: Home > Category
  try {
    $w('#breadcrumbHome').text = 'Home';
    $w('#breadcrumbHome').onClick(() => {
      import('wix-location-frontend').then(({ to }) => to('/'));
    });
    $w('#breadcrumbCurrent').text = content.title;
  } catch (e) {}

  try {
    $w('#categoryHeroSection').style.backgroundColor = '';
    $w('#categoryHeroSection').style.backgroundImage = content.heroGradient;
  } catch (e) {
    // backgroundImage may not be supported on all element types;
    // fall back to a solid color from the gradient start
    try {
      const solidColor = content.heroGradient.match(/#[A-Fa-f0-9]{6}/)?.[0] || colors.sandBase;
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
      { label: 'Best Selling', value: 'bestselling' },
      { label: 'Name (A-Z)', value: 'name-asc' },
      { label: 'Name (Z-A)', value: 'name-desc' },
      { label: 'Price: Low to High', value: 'price-asc' },
      { label: 'Price: High to Low', value: 'price-desc' },
      { label: 'Newest First', value: 'date-desc' },
    ];

    sortDropdown.value = 'bestselling';

    // Accessibility
    try { sortDropdown.accessibility.ariaLabel = 'Sort products by'; } catch (e) {}

    sortDropdown.onChange(() => {
      currentSort = sortDropdown.value;
      const label = sortDropdown.options.find(o => o.value === currentSort)?.label || currentSort;
      announce($w, `Sorting by ${label}`);
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
      case 'bestselling':
        sort = wixData.sort().descending('numericRating');
        break;
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
  // Accessibility: label filter controls
  try { $w('#filterBrand').accessibility.ariaLabel = 'Filter by brand'; } catch (e) {}
  try { $w('#filterPrice').accessibility.ariaLabel = 'Filter by price range'; } catch (e) {}
  try { $w('#filterSize').accessibility.ariaLabel = 'Filter by size'; } catch (e) {}
  try { $w('#clearFilters').accessibility.ariaLabel = 'Clear all filters'; } catch (e) {}

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
    // Refresh result count after filter applies
    setTimeout(() => {
      try {
        const count = dataset.getTotalCount();
        $w('#resultCount').text = `${count} product${count !== 1 ? 's' : ''}`;
        if (count === 0) {
          showEmptyState(wixLocationFrontend.path?.[0] || '');
        } else {
          try { $w('#emptyStateSection').hide(); } catch (e) {}
        }
      } catch (e) {}
    }, 300);
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

      makeClickable($item('#gridImage'), navigateToProduct, { ariaLabel: `View ${itemData.name}` });
      makeClickable($item('#gridName'), navigateToProduct, { ariaLabel: `View ${itemData.name} details` });

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

      // Review stars (loaded async from cached summaries)
      initGridReviewStars($item, itemData);

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

// ── Grid Review Stars ────────────────────────────────────────────────
// Shows star rating + count on product cards from bulk review summaries

let _reviewSummariesCache = null;
let _reviewSummariesPromise = null;

async function loadReviewSummaries(productIds) {
  if (_reviewSummariesCache) return _reviewSummariesCache;
  if (_reviewSummariesPromise) return _reviewSummariesPromise;

  _reviewSummariesPromise = (async () => {
    try {
      const { getCategoryReviewSummaries } = await import('backend/reviewsService.web');
      _reviewSummariesCache = await getCategoryReviewSummaries(productIds);
      return _reviewSummariesCache;
    } catch (e) {
      return {};
    }
  })();

  return _reviewSummariesPromise;
}

async function initGridReviewStars($item, itemData) {
  try {
    const starsEl = $item('#gridReviewStars');
    const countEl = $item('#gridReviewCount');
    if (!starsEl && !countEl) return;

    // Collect product IDs from the repeater dataset for bulk load
    const summaries = await loadReviewSummaries([itemData._id]);
    const summary = summaries[itemData._id];

    if (!summary || summary.total === 0) {
      try { if (starsEl) starsEl.collapse(); } catch (e) {}
      try { if (countEl) countEl.collapse(); } catch (e) {}
      return;
    }

    if (starsEl) {
      const fullStars = Math.floor(summary.average);
      const halfStar = summary.average - fullStars >= 0.5;
      let stars = '★'.repeat(fullStars);
      if (halfStar) stars += '½';
      stars += '☆'.repeat(5 - fullStars - (halfStar ? 1 : 0));
      starsEl.text = stars;
      try { starsEl.expand(); } catch (e) {}
    }

    if (countEl) {
      countEl.text = `(${summary.total})`;
      try { countEl.expand(); } catch (e) {}
    }
  } catch (e) {}
}

// ── Quick View Modal ────────────────────────────────────────────────

// Register quick view handlers once to avoid accumulation
function initQuickViewHandlers() {
  try {
    try { $w('#qvViewFull').accessibility.ariaLabel = 'View full product details'; } catch (e) {}
    try { $w('#qvAddToCart').accessibility.ariaLabel = 'Add to cart'; } catch (e) {}
    try { $w('#qvClose').accessibility.ariaLabel = 'Close quick view'; } catch (e) {}

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
        $w('#qvAddToCart').disable();
        $w('#qvAddToCart').label = 'Adding...';
        const { addToCart } = await import('public/cartService');
        await addToCart(currentQuickViewProduct._id);
        $w('#qvAddToCart').label = 'Added!';
        announce($w, `${currentQuickViewProduct.name} added to cart`);
        setTimeout(() => {
          try { $w('#quickViewModal').hide('fade', { duration: 200 }); } catch (e) {}
        }, 1000);
      } catch (err) {
        console.error('Error adding to cart from quick view:', err);
        $w('#qvAddToCart').label = 'Error — Try Again';
        $w('#qvAddToCart').enable();
        announce($w, 'Error adding to cart. Please try again.');
      }
    });

    $w('#qvClose').onClick(() => {
      $w('#quickViewModal').hide('fade', { duration: 200 });
      announce($w, 'Quick view closed');
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
    $w('#qvAddToCart').enable();

    // Set dialog ARIA attributes for quick view modal
    try { $w('#quickViewModal').accessibility.role = 'dialog'; } catch (e) {}
    try { $w('#quickViewModal').accessibility.ariaModal = true; } catch (e) {}
    try { $w('#quickViewModal').accessibility.ariaLabel = `Quick view: ${product.name}`; } catch (e) {}

    $w('#quickViewModal').show('fade', { duration: 200 });
    announce($w, `Quick view opened for ${product.name}`);
    // Close handler is registered once in initQuickViewHandlers — not here
  } catch (e) {}
}

// ── Result Count & Empty State ──────────────────────────────────────

function updateResultCount(currentPath) {
  try {
    const dataset = $w('#categoryDataset');
    if (!dataset) return;

    // Use onReady for initial load, then refresh count directly
    const refreshCount = () => {
      try {
        const count = dataset.getTotalCount();
        try {
          $w('#resultCount').text = `${count} product${count !== 1 ? 's' : ''}`;
        } catch (e) {}

        if (count === 0) {
          showEmptyState(currentPath);
        } else {
          try { $w('#emptyStateSection').hide(); } catch (e) {}
        }
      } catch (e) {}
    };

    dataset.onReady(() => {
      refreshCount();
      // Re-count when dataset content changes (after filter/sort)
      try {
        dataset.onCurrentIndexChanged(() => refreshCount());
      } catch (e) {}
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
    // Merge session-based (galleryHelpers) and cross-session (productCache) sources
    const sessionItems = getRecentlyViewed() || [];
    const cachedItems = getCachedRecentlyViewed(4) || [];

    // Deduplicate by slug, session items take priority (fresher)
    const seen = new Set();
    const recentItems = [];
    for (const item of [...sessionItems, ...cachedItems]) {
      if (item.slug && !seen.has(item.slug)) {
        seen.add(item.slug);
        recentItems.push(item);
      }
    }

    if (recentItems.length === 0) {
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
        import('wix-location-frontend').then(({ to }) => {
          to(`/product-page/${itemData.slug}`);
        });
      };

      try { makeClickable($item('#recentImage'), navigateToProduct, { ariaLabel: `View ${itemData.name}` }); } catch (e) {}
      try { makeClickable($item('#recentName'), navigateToProduct, { ariaLabel: `View ${itemData.name} details` }); } catch (e) {}
    });

    $w('#recentlyViewedSection').show();
  } catch (e) {
    try { $w('#recentlyViewedSection').hide(); } catch (e2) {}
  }
}

// ── Category Swipe Navigation ────────────────────────────────────────
// Swipe left/right on the product grid to navigate between categories

const CATEGORY_ORDER = [
  'futon-frames', 'mattresses', 'murphy-cabinet-beds',
  'platform-beds', 'casegoods-accessories', 'wall-huggers',
  'unfinished-wood', 'sales',
];

function initCategorySwipe(currentPath) {
  try {
    const gridEl = typeof document !== 'undefined'
      ? document.querySelector('[id*="productGridRepeater"]')
      : null;
    if (!gridEl) return;

    const currentIndex = CATEGORY_ORDER.indexOf(currentPath);
    if (currentIndex === -1) return;

    enableSwipe(gridEl, (direction) => {
      let nextIndex;
      if (direction === 'left') {
        nextIndex = currentIndex + 1;
      } else if (direction === 'right') {
        nextIndex = currentIndex - 1;
      } else {
        return;
      }
      if (nextIndex < 0 || nextIndex >= CATEGORY_ORDER.length) return;
      const nextCategory = CATEGORY_ORDER[nextIndex];
      trackEvent('category_swipe', { from: currentPath, to: nextCategory, direction });
      wixLocationFrontend.to(`/${nextCategory}`);
    }, { threshold: 60 });
  } catch (e) {}
}

// ── Advanced Faceted Filters ────────────────────────────────────────
// Powered by searchService.web.js — faceted search with debounced application

async function initAdvancedFilters(currentPath) {
  try {
    // Load available filter values for this category
    const facets = await getFilterValues(currentPath);
    if (!facets) return;

    // Populate material checkboxes
    try {
      const materialGroup = $w('#filterMaterial');
      if (materialGroup && facets.materials.length > 0) {
        materialGroup.options = facets.materials.map(m => ({
          label: `${m.value} (${m.count})`,
          value: m.value,
        }));
        try { materialGroup.accessibility.ariaLabel = 'Filter by material'; } catch (e) {}
        materialGroup.onChange(() => {
          currentFilters.material = materialGroup.value;
          debouncedApplyAdvancedFilters(currentPath);
        });
      }
    } catch (e) {}

    // Populate color swatches
    try {
      const colorGroup = $w('#filterColor');
      if (colorGroup && facets.colors.length > 0) {
        colorGroup.options = facets.colors.map(c => ({
          label: `${c.value} (${c.count})`,
          value: c.value,
        }));
        try { colorGroup.accessibility.ariaLabel = 'Filter by color'; } catch (e) {}
        colorGroup.onChange(() => {
          currentFilters.color = colorGroup.value;
          debouncedApplyAdvancedFilters(currentPath);
        });
      }
    } catch (e) {}

    // Populate feature tag toggles
    try {
      const featureGroup = $w('#filterFeatures');
      if (featureGroup && facets.features.length > 0) {
        featureGroup.options = facets.features.map(f => ({
          label: `${formatFeatureLabel(f.value)} (${f.count})`,
          value: f.value,
        }));
        try { featureGroup.accessibility.ariaLabel = 'Filter by features'; } catch (e) {}
        featureGroup.onChange(() => {
          currentFilters.features = featureGroup.value
            ? (Array.isArray(featureGroup.value) ? featureGroup.value : [featureGroup.value])
            : [];
          debouncedApplyAdvancedFilters(currentPath);
        });
      }
    } catch (e) {}

    // Price range slider (enhanced from existing dropdown)
    try {
      const priceSlider = $w('#filterPriceRange');
      if (priceSlider) {
        try { priceSlider.accessibility.ariaLabel = 'Filter by price range'; } catch (e) {}
        priceSlider.onChange(() => {
          currentFilters.priceRange = priceSlider.value;
          debouncedApplyAdvancedFilters(currentPath);
        });
      }
    } catch (e) {}

    // Dimension range inputs
    try {
      const widthMin = $w('#filterWidthMin');
      const widthMax = $w('#filterWidthMax');
      if (widthMin && widthMax && facets.dimensions.width.max > 0) {
        widthMin.placeholder = `${facets.dimensions.width.min}"`;
        widthMax.placeholder = `${facets.dimensions.width.max}"`;
        try { widthMin.accessibility.ariaLabel = 'Minimum width in inches'; } catch (e) {}
        try { widthMax.accessibility.ariaLabel = 'Maximum width in inches'; } catch (e) {}
        const onWidthChange = () => {
          const min = parseFloat(widthMin.value) || 0;
          const max = parseFloat(widthMax.value) || Infinity;
          if (min || max !== Infinity) {
            currentFilters.widthRange = [min, max === Infinity ? 999 : max];
          } else {
            delete currentFilters.widthRange;
          }
          debouncedApplyAdvancedFilters(currentPath);
        };
        widthMin.onChange(onWidthChange);
        widthMax.onChange(onWidthChange);
      }
    } catch (e) {}

    try {
      const depthMin = $w('#filterDepthMin');
      const depthMax = $w('#filterDepthMax');
      if (depthMin && depthMax && facets.dimensions.depth.max > 0) {
        depthMin.placeholder = `${facets.dimensions.depth.min}"`;
        depthMax.placeholder = `${facets.dimensions.depth.max}"`;
        try { depthMin.accessibility.ariaLabel = 'Minimum depth in inches'; } catch (e) {}
        try { depthMax.accessibility.ariaLabel = 'Maximum depth in inches'; } catch (e) {}
        const onDepthChange = () => {
          const min = parseFloat(depthMin.value) || 0;
          const max = parseFloat(depthMax.value) || Infinity;
          if (min || max !== Infinity) {
            currentFilters.depthRange = [min, max === Infinity ? 999 : max];
          } else {
            delete currentFilters.depthRange;
          }
          debouncedApplyAdvancedFilters(currentPath);
        };
        depthMin.onChange(onDepthChange);
        depthMax.onChange(onDepthChange);
      }
    } catch (e) {}

    // Live result count display
    try {
      $w('#filterResultCount').text = `${facets.totalProducts} products`;
    } catch (e) {}

    // Clear All button (enhanced)
    try {
      $w('#clearAllFilters').onClick(() => {
        clearAllAdvancedFilters(currentPath);
      });
      try { $w('#clearAllFilters').accessibility.ariaLabel = 'Clear all filters'; } catch (e) {}
    } catch (e) {}

    // Mobile: filter drawer toggle
    try {
      if (isMobile()) {
        initFilterDrawer();
      }
    } catch (e) {}
  } catch (e) {}
}

function debouncedApplyAdvancedFilters(currentPath) {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    applyAdvancedFilters(currentPath);
  }, 300);
}

async function applyAdvancedFilters(currentPath) {
  try {
    // Show loading indicator
    try { $w('#filterLoadingIndicator').show(); } catch (e) {}

    const result = await searchProducts({
      category: currentPath,
      priceRange: currentFilters.priceRange || undefined,
      material: currentFilters.material || undefined,
      color: currentFilters.color || undefined,
      features: currentFilters.features || undefined,
      widthRange: currentFilters.widthRange || undefined,
      depthRange: currentFilters.depthRange || undefined,
      sortBy: currentSort === 'bestselling' ? 'bestselling'
        : currentSort === 'price-asc' ? 'price-asc'
        : currentSort === 'price-desc' ? 'price-desc'
        : currentSort === 'name-asc' ? 'name-asc'
        : currentSort === 'name-desc' ? 'name-desc'
        : currentSort === 'date-desc' ? 'newest'
        : 'bestselling',
      limit: 50,
    });

    // Update live result count
    try {
      $w('#filterResultCount').text = `${result.total} product${result.total !== 1 ? 's' : ''}`;
    } catch (e) {}
    try {
      $w('#resultCount').text = `${result.total} product${result.total !== 1 ? 's' : ''}`;
    } catch (e) {}

    // Announce result count to screen readers
    announce($w, `Showing ${result.total} product${result.total !== 1 ? 's' : ''}`);

    // Handle zero results
    if (result.total === 0) {
      showNoMatchesState(currentPath);
    } else {
      try { $w('#noMatchesSection').hide(); } catch (e) {}
      try { $w('#emptyStateSection').hide(); } catch (e) {}
    }

    // Update URL with filter state (shareable)
    updateUrlWithFilters(currentFilters);

    // Save filter state for session persistence
    _filterSessionState[currentPath] = { ...currentFilters };

    // Track filter interaction
    trackEvent('filter_applied', {
      category: currentPath,
      filters: Object.keys(currentFilters).filter(k => currentFilters[k]),
      resultCount: result.total,
    });

    // Hide loading indicator
    try { $w('#filterLoadingIndicator').hide(); } catch (e) {}

    // Also apply to dataset for grid rendering
    applyFilters();
  } catch (e) {
    try { $w('#filterLoadingIndicator').hide(); } catch (e2) {}
  }
}

function clearAllAdvancedFilters(currentPath) {
  currentFilters = {};

  // Reset all filter UI elements
  try { $w('#filterMaterial').value = ''; } catch (e) {}
  try { $w('#filterColor').value = ''; } catch (e) {}
  try { $w('#filterFeatures').value = []; } catch (e) {}
  try { $w('#filterPriceRange').value = ''; } catch (e) {}
  try { $w('#filterPrice').value = ''; } catch (e) {}
  try { $w('#filterBrand').value = ''; } catch (e) {}
  try { $w('#filterSize').value = ''; } catch (e) {}
  try { $w('#filterWidthMin').value = ''; } catch (e) {}
  try { $w('#filterWidthMax').value = ''; } catch (e) {}
  try { $w('#filterDepthMin').value = ''; } catch (e) {}
  try { $w('#filterDepthMax').value = ''; } catch (e) {}

  // Clear URL params
  updateUrlWithFilters({});

  // Clear session state for this category
  delete _filterSessionState[currentPath];

  // Refresh with no filters
  applyAdvancedFilters(currentPath);
  applyFilters();

  trackEvent('filters_cleared', { category: currentPath });
}

function showNoMatchesState(currentPath) {
  try {
    const content = CATEGORY_CONTENT[currentPath];
    const categoryName = content ? content.title : 'this category';

    try {
      $w('#noMatchesTitle').text = 'No products match';
    } catch (e) {}

    try {
      $w('#noMatchesMessage').text =
        `Try removing some filters or broadening your search. We have ${categoryName} in many styles and price points.`;
    } catch (e) {}

    try {
      $w('#noMatchesSuggestion').text = 'Try adjusting your price range or removing material filters.';
    } catch (e) {}

    try { $w('#noMatchesSection').show(); } catch (e) {}
  } catch (e) {}
}

// ── Filter URL State ────────────────────────────────────────────

function updateUrlWithFilters(filters) {
  try {
    const params = {};
    if (filters.priceRange) params.price = filters.priceRange;
    if (filters.material) params.material = filters.material;
    if (filters.color) params.color = filters.color;
    if (filters.features && filters.features.length > 0) params.features = filters.features.join(',');
    if (filters.widthRange) params.width = filters.widthRange.join('-');
    if (filters.depthRange) params.depth = filters.depthRange.join('-');
    if (filters.brand) params.brand = filters.brand;
    if (filters.price) params.priceDropdown = filters.price;
    if (filters.size) params.size = filters.size;

    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    // Update URL without page reload using pushState (not wixLocationFrontend.to which navigates)
    try {
      if (typeof window !== 'undefined' && window.history && window.history.pushState) {
        const path = '/' + (wixLocationFrontend.path?.[0] || '');
        const newUrl = queryString ? `${path}?${queryString}` : path;
        window.history.pushState({ filters }, '', newUrl);
      }
    } catch (e) {
      // URL update is best-effort; don't break filters if it fails
    }
  } catch (e) {}
}

function restoreFiltersFromUrl(currentPath) {
  try {
    const query = wixLocationFrontend.query || {};

    // Restore from URL params
    if (query.price) currentFilters.priceRange = query.price;
    if (query.material) currentFilters.material = query.material;
    if (query.color) currentFilters.color = query.color;
    if (query.features) currentFilters.features = query.features.split(',');
    if (query.width) {
      const [min, max] = query.width.split('-').map(Number);
      if (!isNaN(min) && !isNaN(max)) currentFilters.widthRange = [min, max];
    }
    if (query.depth) {
      const [min, max] = query.depth.split('-').map(Number);
      if (!isNaN(min) && !isNaN(max)) currentFilters.depthRange = [min, max];
    }
    if (query.brand) currentFilters.brand = query.brand;
    if (query.size) currentFilters.size = query.size;

    // Or restore from session state if no URL params
    if (Object.keys(currentFilters).length === 0 && _filterSessionState[currentPath]) {
      Object.assign(currentFilters, _filterSessionState[currentPath]);
    }

    // Apply restored filters if any
    if (Object.keys(currentFilters).length > 0) {
      // Set UI elements to match restored state
      try { if (currentFilters.material) $w('#filterMaterial').value = currentFilters.material; } catch (e) {}
      try { if (currentFilters.color) $w('#filterColor').value = currentFilters.color; } catch (e) {}
      try { if (currentFilters.features) $w('#filterFeatures').value = currentFilters.features; } catch (e) {}
      try { if (currentFilters.priceRange) $w('#filterPriceRange').value = currentFilters.priceRange; } catch (e) {}
      try { if (currentFilters.brand) $w('#filterBrand').value = currentFilters.brand; } catch (e) {}
      try { if (currentFilters.price) $w('#filterPrice').value = currentFilters.price; } catch (e) {}
      try { if (currentFilters.size) $w('#filterSize').value = currentFilters.size; } catch (e) {}

      applyAdvancedFilters(currentPath);
    }
  } catch (e) {}
}

// ── Mobile Filter Drawer ────────────────────────────────────────

function initFilterDrawer() {
  try {
    // Toggle filter drawer as bottom sheet on mobile
    $w('#filterToggleBtn').onClick(() => {
      try {
        const drawer = $w('#filterDrawer');
        if (drawer.hidden) {
          drawer.show('slide', { duration: 300, direction: 'bottom' });
          try { $w('#filterDrawerOverlay').show('fade', { duration: 200 }); } catch (e) {}
          try { $w('#filterToggleBtn').accessibility.ariaExpanded = true; } catch (e) {}
          announce($w, 'Filters panel opened');
        } else {
          drawer.hide('slide', { duration: 300, direction: 'bottom' });
          try { $w('#filterDrawerOverlay').hide('fade', { duration: 200 }); } catch (e) {}
          try { $w('#filterToggleBtn').accessibility.ariaExpanded = false; } catch (e) {}
          announce($w, 'Filters panel closed');
        }
      } catch (e) {}
    });

    // Close drawer on overlay tap
    try {
      $w('#filterDrawerOverlay').onClick(() => {
        try { $w('#filterDrawer').hide('slide', { duration: 300, direction: 'bottom' }); } catch (e) {}
        try { $w('#filterDrawerOverlay').hide('fade', { duration: 200 }); } catch (e) {}
      });
    } catch (e) {}

    // "Apply" button in drawer
    try {
      $w('#filterDrawerApply').onClick(() => {
        try { $w('#filterDrawer').hide('slide', { duration: 300, direction: 'bottom' }); } catch (e) {}
        try { $w('#filterDrawerOverlay').hide('fade', { duration: 200 }); } catch (e) {}
      });
    } catch (e) {}

    // Show toggle button, keep drawer collapsed initially
    try { $w('#filterToggleBtn').show(); } catch (e) {}
    try { $w('#filterDrawer').hide(); } catch (e) {}

    // ARIA
    try { $w('#filterToggleBtn').accessibility.ariaLabel = 'Open filters'; } catch (e) {}
    try { $w('#filterDrawerApply').accessibility.ariaLabel = 'Apply filters and close'; } catch (e) {}
  } catch (e) {}
}

function formatFeatureLabel(tag) {
  return tag.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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
    const total = Math.min(dataset.getTotalCount(), 30);
    const result = await dataset.getItems(0, total);
    const products = (result?.items || []).map(item => ({
      slug: item.slug,
      name: item.name,
      mainMedia: item.mainMedia,
    }));

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

    // Inject Open Graph tags for social sharing
    const ogTags = await getCategoryOgTags(currentPath);
    if (ogTags) {
      try { $w('#categoryOgHtml').postMessage(ogTags); } catch (e) {}
    }
  } catch (e) {}
}
